import { promises as fs } from "node:fs";
import path from "node:path";
import { applyPostgresSchema, syncPostgresReportingTables } from "../scripts/migrate-json-to-postgres.js";

const DEFAULT_COLLECTIONS = {
  leads: "leads.json",
  sessions: "auth-sessions.json",
  auditLog: "audit-log.json",
  otpChallenges: "auth-otp.json",
  operations: "operations-state.json"
};

function normalizeMode(value) {
  const mode = String(value || "auto").trim().toLowerCase();
  return ["auto", "json", "postgres"].includes(mode) ? mode : "auto";
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function createJsonStorage({ dataDir, collections }) {
  return {
    async init() {
      await ensureDir(dataDir);
    },
    async loadAll() {
      await ensureDir(dataDir);
      const entries = await Promise.all(
        Object.entries(collections).map(async ([key, fileName]) => {
          const fallback = key === "operations" ? null : [];
          return [key, await readJsonFile(path.join(dataDir, fileName), fallback)];
        })
      );
      return Object.fromEntries(entries);
    },
    async saveAll(snapshot) {
      await ensureDir(dataDir);
      await Promise.all(
        Object.entries(collections).map(([key, fileName]) => writeJsonFile(path.join(dataDir, fileName), snapshot[key]))
      );
    },
    async diagnostics() {
      return {
        mode: "json",
        connected: true,
        fallbackActive: false,
        detail: "Using local JSON file persistence."
      };
    },
    async reportingSnapshot() {
      return {
        mode: "json",
        available: false,
        generatedAt: new Date().toISOString(),
        detail: "Structured reporting tables are available when Postgres storage is active."
      };
    }
  };
}

async function readSingle(pool, sql, params = []) {
  const response = await pool.query(sql, params);
  return response.rows[0] || {};
}

async function readGroups(pool, tableName, columnName, limit = 8) {
  const response = await pool.query(
    `
      SELECT COALESCE(NULLIF(${columnName}, ''), 'Unspecified') AS label, COUNT(*)::int AS count
      FROM ${tableName}
      GROUP BY 1
      ORDER BY count DESC, label ASC
      LIMIT $1
    `,
    [limit]
  );
  return response.rows.map((row) => ({
    label: row.label,
    count: Number(row.count || 0)
  }));
}

async function readScopeRollups(pool, scope) {
  const configs = {
    agency: {
      column: "agency_id",
      labelJoin: "LEFT JOIN axiom_organisations label_record ON label_record.id = base.scope_id",
      labelExpr: "COALESCE(NULLIF(label_record.name, ''), NULLIF(base.scope_id, 'unassigned'), 'Unassigned agency')"
    },
    branch: {
      column: "branch_id",
      labelJoin: "LEFT JOIN axiom_branches label_record ON label_record.id = base.scope_id",
      labelExpr: "COALESCE(NULLIF(label_record.name, ''), NULLIF(base.scope_id, 'unassigned'), 'Unassigned branch')"
    },
    province: {
      column: "province_id",
      labelJoin: "",
      labelExpr: "COALESCE(NULLIF(INITCAP(REPLACE(base.scope_id, '-', ' ')), 'Unassigned'), 'Unassigned province')"
    },
    agent: {
      column: "assigned_agent_id",
      labelJoin: `
        LEFT JOIN LATERAL (
          SELECT name
          FROM axiom_users
          WHERE id = base.scope_id OR agent_id = base.scope_id
          ORDER BY CASE WHEN role = 'agent' THEN 0 ELSE 1 END, updated_at DESC
          LIMIT 1
        ) label_record ON true
      `,
      labelExpr: "COALESCE(NULLIF(label_record.name, ''), NULLIF(base.scope_id, 'unassigned'), 'Unassigned agent')"
    }
  };
  const config = configs[scope];
  if (!config) return [];

  const column = config.column;
  const response = await pool.query(
    `
      WITH scope_keys AS (
        SELECT COALESCE(NULLIF(${column}, ''), 'unassigned') AS scope_id FROM axiom_leads
        UNION
        SELECT COALESCE(NULLIF(${column}, ''), 'unassigned') AS scope_id FROM axiom_cases
        UNION
        SELECT COALESCE(NULLIF(${column}, ''), 'unassigned') AS scope_id FROM axiom_tasks
        UNION
        SELECT COALESCE(NULLIF(${column}, ''), 'unassigned') AS scope_id FROM axiom_commission_protection
        UNION
        SELECT COALESCE(NULLIF(${column}, ''), 'unassigned') AS scope_id FROM axiom_service_pulse
      ),
      base AS (
        SELECT scope_id
        FROM scope_keys
        WHERE scope_id <> 'unassigned'
        GROUP BY scope_id
      )
      SELECT
        base.scope_id AS id,
        ${config.labelExpr} AS label,
        (SELECT COUNT(*)::int FROM axiom_leads WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id) AS leads,
        (SELECT COUNT(*)::int FROM axiom_cases WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id) AS cases,
        (SELECT COUNT(*)::int FROM axiom_tasks WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id AND status <> 'done') AS open_tasks,
        (SELECT COUNT(*)::int FROM axiom_commission_protection WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id) AS protected_deals,
        (SELECT COALESCE(ROUND(AVG(score)::numeric, 1), 0) FROM axiom_service_pulse WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id) AS avg_service_score,
        (SELECT COUNT(*)::int FROM axiom_service_pulse WHERE COALESCE(NULLIF(${column}, ''), 'unassigned') = base.scope_id AND score <= 6) AS recovery_items
      FROM base
      ${config.labelJoin}
      ORDER BY leads DESC, cases DESC, label ASC
      LIMIT 12
    `
  );

  return response.rows.map((row) => ({
    id: row.id,
    label: row.label,
    leads: Number(row.leads || 0),
    cases: Number(row.cases || 0),
    openTasks: Number(row.open_tasks || 0),
    protectedDeals: Number(row.protected_deals || 0),
    avgServiceScore: Number(row.avg_service_score || 0),
    recoveryItems: Number(row.recovery_items || 0)
  }));
}

function asCount(row, key) {
  return Number(row?.[key] || 0);
}

function actionsOpenCount(groups) {
  return (groups || []).reduce((total, item) => {
    const label = String(item.label || "").toLowerCase();
    const isClosed = /done|complete|closed|resolved|cancelled/.test(label);
    return isClosed ? total : total + Number(item.count || 0);
  }, 0);
}

async function buildPostgresReportingSnapshot(pool, reportingProjection) {
  const [
    totals,
    leadQuality,
    leadIntent,
    leadStatus,
    sourceToSale,
    casesByStage,
    casesByStatus,
    tasksByStatus,
    tasksByPriority,
    remindersByStatus,
    escalationsBySeverity,
    commissionSummary,
    commissionByPayment,
    commissionByReferral,
    commsSummary,
    commsByStatus,
    commsByKind,
    commsByCategory,
    servicePulseSummary,
    servicePulseByRole,
    servicePulseByAgent,
    agencyRollups,
    branchRollups,
    provinceRollups,
    agentRollups,
    networkByProvince,
    networkByVerification,
    networkByOutreach,
    networkByPilot
  ] = await Promise.all([
    readSingle(
      pool,
      `
        SELECT
          (SELECT COUNT(*)::int FROM axiom_leads) AS leads,
          (SELECT COUNT(*)::int FROM axiom_cases) AS cases,
          (SELECT COUNT(*)::int FROM axiom_tasks) AS tasks,
          (SELECT COUNT(*)::int FROM axiom_reminders) AS reminders,
          (SELECT COUNT(*)::int FROM axiom_escalations) AS escalations,
          (SELECT COUNT(*)::int FROM axiom_commission_protection) AS commission_items,
          (SELECT COUNT(*)::int FROM axiom_deal_rooms) AS deal_rooms,
          (SELECT COUNT(*)::int FROM axiom_communications) AS communications,
          (SELECT COUNT(*)::int FROM axiom_service_pulse) AS service_pulse,
          (SELECT COUNT(*)::int FROM axiom_agent_network_records) AS agent_network_records,
          (SELECT COUNT(*)::int FROM axiom_audit_events) AS audit_events,
          (SELECT COUNT(*)::int FROM axiom_leads WHERE created_at >= NOW() - INTERVAL '7 days') AS leads_7d
      `
    ),
    readGroups(pool, "axiom_leads", "lead_quality_band"),
    readGroups(pool, "axiom_leads", "intent"),
    readGroups(pool, "axiom_leads", "status"),
    pool
      .query(
        `
          SELECT
            COALESCE(NULLIF(source_key, ''), 'Unspecified') AS source,
            COUNT(*)::int AS leads,
            COUNT(*) FILTER (WHERE lead_quality_band IN ('hot', 'warm'))::int AS priority,
            COUNT(*) FILTER (WHERE status NOT IN ('', 'new'))::int AS active
          FROM axiom_leads
          GROUP BY 1
          ORDER BY leads DESC, source ASC
          LIMIT 8
        `
      )
      .then((response) =>
        response.rows.map((row) => ({
          source: row.source,
          leads: Number(row.leads || 0),
          priority: Number(row.priority || 0),
          active: Number(row.active || 0)
        }))
      ),
    readGroups(pool, "axiom_cases", "stage"),
    readGroups(pool, "axiom_cases", "status"),
    readGroups(pool, "axiom_tasks", "status"),
    readGroups(pool, "axiom_tasks", "priority"),
    readGroups(pool, "axiom_reminders", "status"),
    readGroups(pool, "axiom_escalations", "severity"),
    readSingle(
      pool,
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(payment_status, '')) LIKE '%paid%')::int AS paid,
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(payment_status, '')) LIKE '%await%'
               OR LOWER(COALESCE(payment_status, '')) LIKE '%due%'
               OR LOWER(COALESCE(referral_status, '')) LIKE '%pending%'
               OR LOWER(COALESCE(risk_tag, '')) LIKE '%risk%'
          )::int AS attention
        FROM axiom_commission_protection
      `
    ),
    readGroups(pool, "axiom_commission_protection", "payment_status"),
    readGroups(pool, "axiom_commission_protection", "referral_status"),
    readSingle(
      pool,
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
          COUNT(*) FILTER (WHERE status = 'awaiting_approval')::int AS awaiting_approval,
          COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered
        FROM axiom_communications
      `
    ),
    readGroups(pool, "axiom_communications", "status"),
    readGroups(pool, "axiom_communications", "kind"),
    readGroups(pool, "axiom_communications", "category"),
    readSingle(
      pool,
      `
        SELECT
          COUNT(*)::int AS total,
          COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_score,
          COUNT(*) FILTER (WHERE score <= 6)::int AS recovery,
          COUNT(*) FILTER (WHERE used_for_matching = true)::int AS matching_inputs
        FROM axiom_service_pulse
      `
    ),
    readGroups(pool, "axiom_service_pulse", "respondent_role"),
    pool
      .query(
        `
          SELECT
            COALESCE(NULLIF(agent_name, ''), 'Unassigned') AS agent,
            COUNT(*)::int AS count,
            COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_score,
            COUNT(*) FILTER (WHERE score <= 6)::int AS recovery
          FROM axiom_service_pulse
          GROUP BY 1
          ORDER BY avg_score DESC, count DESC, agent ASC
          LIMIT 6
        `
      )
      .then((response) =>
        response.rows.map((row) => ({
          agent: row.agent,
          count: Number(row.count || 0),
          avgScore: Number(row.avg_score || 0),
          recovery: Number(row.recovery || 0)
        }))
      ),
    readScopeRollups(pool, "agency"),
    readScopeRollups(pool, "branch"),
    readScopeRollups(pool, "province"),
    readScopeRollups(pool, "agent"),
    readGroups(pool, "axiom_agent_network_records", "province"),
    readGroups(pool, "axiom_agent_network_records", "verification_status"),
    readGroups(pool, "axiom_agent_network_records", "outreach_status"),
    readGroups(pool, "axiom_agent_network_records", "pilot_status")
  ]);

  return {
    mode: "postgres",
    available: true,
    source: "structured reporting tables",
    generatedAt: new Date().toISOString(),
    projection: reportingProjection,
    totals: {
      leads: asCount(totals, "leads"),
      cases: asCount(totals, "cases"),
      tasks: asCount(totals, "tasks"),
      reminders: asCount(totals, "reminders"),
      escalations: asCount(totals, "escalations"),
      commissionItems: asCount(totals, "commission_items"),
      dealRooms: asCount(totals, "deal_rooms"),
      communications: asCount(totals, "communications"),
      servicePulse: asCount(totals, "service_pulse"),
      agentNetworkRecords: asCount(totals, "agent_network_records"),
      auditEvents: asCount(totals, "audit_events")
    },
    momentum: {
      leads7d: asCount(totals, "leads_7d")
    },
    rollups: {
      national: {
        label: "National",
        leads: asCount(totals, "leads"),
        cases: asCount(totals, "cases"),
        openTasks: actionsOpenCount(tasksByStatus),
        protectedDeals: asCount(commissionSummary, "total"),
        avgServiceScore: Number(servicePulseSummary.avg_score || 0),
        recoveryItems: asCount(servicePulseSummary, "recovery")
      },
      agencies: agencyRollups,
      branches: branchRollups,
      provinces: provinceRollups,
      agents: agentRollups
    },
    pipeline: {
      leadQuality,
      leadIntent,
      leadStatus,
      sourceToSale,
      casesByStage,
      casesByStatus
    },
    actions: {
      tasksByStatus,
      tasksByPriority,
      remindersByStatus,
      escalationsBySeverity
    },
    protection: {
      total: asCount(commissionSummary, "total"),
      paid: asCount(commissionSummary, "paid"),
      attention: asCount(commissionSummary, "attention"),
      byPaymentStatus: commissionByPayment,
      byReferralStatus: commissionByReferral
    },
    communications: {
      total: asCount(commsSummary, "total"),
      queued: asCount(commsSummary, "queued"),
      awaitingApproval: asCount(commsSummary, "awaiting_approval"),
      delivered: asCount(commsSummary, "delivered"),
      byStatus: commsByStatus,
      byKind: commsByKind,
      byCategory: commsByCategory
    },
    servicePulse: {
      total: asCount(servicePulseSummary, "total"),
      avgScore: Number(servicePulseSummary.avg_score || 0),
      recovery: asCount(servicePulseSummary, "recovery"),
      matchingInputs: asCount(servicePulseSummary, "matching_inputs"),
      byRole: servicePulseByRole,
      byAgent: servicePulseByAgent
    },
    agentNetwork: {
      byProvince: networkByProvince,
      byVerification: networkByVerification,
      byOutreach: networkByOutreach,
      byPilot: networkByPilot
    }
  };
}

async function tryCreatePostgresStorage({ env, dataDir, collections, fallbackMode }) {
  const connectionString = String(env.DATABASE_URL || "").trim();
  if (!connectionString) {
    if (fallbackMode === "postgres") {
      throw new Error("DATABASE_URL is required when STORAGE_MODE=postgres.");
    }
    return null;
  }

  let pgModule;
  try {
    pgModule = await import("pg");
  } catch (error) {
    if (fallbackMode === "postgres") {
      throw new Error('Postgres driver "pg" is not installed.');
    }
    return null;
  }

  const { Pool } = pgModule;
  const pool = new Pool({
    connectionString,
    ssl: env.DATABASE_SSL === "false" ? false : undefined
  });

  const tableName = String(env.STORAGE_TABLE_NAME || "axiom_state_blobs")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "");

  const identifier = `"${tableName}"`;
  const bootstrapSql = `
    CREATE TABLE IF NOT EXISTS ${identifier} (
      state_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  const reportingProjection = {
    enabled: true,
    lastSyncedAt: null,
    lastCounts: null,
    lastError: null
  };

  try {
    await pool.query(bootstrapSql);
    await applyPostgresSchema(pool);
  } catch (error) {
    await pool.end().catch(() => {});
    if (fallbackMode === "postgres") throw error;
    return null;
  }

  return {
    async init() {
      return undefined;
    },
    async loadAll() {
      const result = {};
      for (const key of Object.keys(collections)) {
        const response = await pool.query(`SELECT payload FROM ${identifier} WHERE state_key = $1`, [key]);
        if (response.rows[0]?.payload !== undefined) {
          result[key] = response.rows[0].payload;
        } else {
          result[key] = key === "operations" ? null : [];
        }
      }
      return result;
    },
    async saveAll(snapshot) {
      for (const key of Object.keys(collections)) {
        await pool.query(
          `
            INSERT INTO ${identifier} (state_key, payload, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (state_key)
            DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
          `,
          [key, JSON.stringify(snapshot[key] ?? null)]
        );
      }

      try {
        const counts = await syncPostgresReportingTables(pool, snapshot, { includeBlobs: false });
        reportingProjection.lastSyncedAt = new Date().toISOString();
        reportingProjection.lastCounts = counts;
        reportingProjection.lastError = null;
      } catch (error) {
        reportingProjection.lastError = error instanceof Error ? error.message : "Reporting projection failed.";
        if (env.STORAGE_REPORTING_STRICT === "true") {
          throw error;
        }
      }
    },
    async diagnostics() {
      const ping = await pool.query("SELECT NOW() AS now");
      return {
        mode: "postgres",
        connected: true,
        fallbackActive: false,
        tableName,
        connectedAt: ping.rows[0]?.now || null,
        reportingProjection,
        detail: "Using Postgres persistence with live reporting-table projection."
      };
    },
    async reportingSnapshot() {
      return buildPostgresReportingSnapshot(pool, reportingProjection);
    },
    async close() {
      await pool.end();
    }
  };
}

export async function createStorage(env = process.env, options = {}) {
  const mode = normalizeMode(env.STORAGE_MODE);
  const dataDir = options.dataDir;
  const collections = { ...DEFAULT_COLLECTIONS, ...(options.collections || {}) };

  const jsonStorage = createJsonStorage({ dataDir, collections });

  if (mode === "json") {
    await jsonStorage.init();
    return jsonStorage;
  }

  const postgresStorage = await tryCreatePostgresStorage({
    env,
    dataDir,
    collections,
    fallbackMode: mode
  });

  if (postgresStorage) {
    await postgresStorage.init();
    return postgresStorage;
  }

  await jsonStorage.init();
  return {
    ...jsonStorage,
    async diagnostics() {
      return {
        mode: "json",
        connected: true,
        fallbackActive: true,
        detail: "Postgres not active yet, so Axiom is using JSON file persistence."
      };
    }
  };
}
