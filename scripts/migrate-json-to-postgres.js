import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const schemaPath = path.join(rootDir, "database", "schema.sql");

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null).map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function recordDate(record, key = "createdAt") {
  return asDate(record?.[key]) || new Date().toISOString();
}

function jsonParam(value) {
  return JSON.stringify(value ?? null);
}

async function readJson(fileName, fallback) {
  try {
    const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadState() {
  return {
    leads: await readJson("leads.json", []),
    sessions: await readJson("auth-sessions.json", []),
    auditLog: await readJson("audit-log.json", []),
    otpChallenges: await readJson("auth-otp.json", []),
    operations: await readJson("operations-state.json", {})
  };
}

async function connect() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to migrate JSON data into Postgres.");
  }

  let pgModule;
  try {
    pgModule = await import("pg");
  } catch {
    throw new Error('The "pg" package is required. Run npm install before using this migration.');
  }

  const { Pool } = pgModule;
  return new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false" ? false : undefined
  });
}

async function applySchema(pool) {
  const schema = await fs.readFile(schemaPath, "utf8");
  await pool.query(schema);
}

export async function applyPostgresSchema(pool) {
  await applySchema(pool);
}

async function upsertStateBlob(client, key, payload) {
  await client.query(
    `
      INSERT INTO axiom_state_blobs (state_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (state_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [key, jsonParam(payload)]
  );
}

async function upsertOrganisation(client, record) {
  await client.query(
    `
      INSERT INTO axiom_organisations (id, name, status, province_ids, branch_ids, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        province_ids = EXCLUDED.province_ids,
        branch_ids = EXCLUDED.branch_ids,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.name || record.id),
      asText(record.status || "active"),
      asArray(record.provinceIds),
      asArray(record.branchIds),
      jsonParam(record)
    ]
  );
}

async function upsertBranch(client, record) {
  await client.query(
    `
      INSERT INTO axiom_branches (id, organisation_id, name, province_id, admin_ids, agent_ids, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        organisation_id = EXCLUDED.organisation_id,
        name = EXCLUDED.name,
        province_id = EXCLUDED.province_id,
        admin_ids = EXCLUDED.admin_ids,
        agent_ids = EXCLUDED.agent_ids,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.agencyId || record.organisationId) || null,
      asText(record.name || record.id),
      asText(record.provinceId),
      asArray(record.adminIds),
      asArray(record.agentIds),
      jsonParam(record)
    ]
  );
}

async function upsertUser(client, record) {
  const contact = record.contact && typeof record.contact === "object" ? record.contact : {};
  await client.query(
    `
      INSERT INTO axiom_users
        (id, role, name, contact_email, contact_mobile, agency_id, branch_id, province_id, agent_id, scope, status, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        role = EXCLUDED.role,
        name = EXCLUDED.name,
        contact_email = EXCLUDED.contact_email,
        contact_mobile = EXCLUDED.contact_mobile,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        scope = EXCLUDED.scope,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.role || record.partyType || "user"),
      asText(record.name || record.id),
      asText(contact.email || record.email),
      asText(contact.mobile || contact.whatsapp || record.mobile),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId || (record.role === "agent" ? record.id : "")),
      jsonParam(record.scope || {}),
      asText(record.status || "active"),
      jsonParam(record)
    ]
  );
}

async function upsertLead(client, record) {
  const contact = record.contact && typeof record.contact === "object" ? record.contact : {};
  const leadId = asText(record.leadId || record.id);
  await client.query(
    `
      INSERT INTO axiom_leads
        (id, intent, label, status, lead_quality_band, source_key, client_name, client_email, client_mobile,
         agency_id, branch_id, province_id, agent_id, assigned_agent_id, created_at, updated_at, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        intent = EXCLUDED.intent,
        label = EXCLUDED.label,
        status = EXCLUDED.status,
        lead_quality_band = EXCLUDED.lead_quality_band,
        source_key = EXCLUDED.source_key,
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        client_mobile = EXCLUDED.client_mobile,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      leadId,
      asText(record.intent || "unknown"),
      asText(record.label || record.caseName || leadId),
      asText(record.status || "new"),
      asText(record.leadQuality?.band || record.qualityBand),
      asText(record.sourceToSale?.sourceKey || record.sourceKey),
      asText(record.clientName || record.name || contact.name),
      asText(contact.email || record.email),
      asText(contact.mobile || contact.whatsapp || record.mobile || record.whatsapp),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      recordDate(record),
      jsonParam(record)
    ]
  );
}

async function upsertCase(client, record) {
  const id = asText(record.caseId || record.id || record.roomId);
  if (!id) return;
  await client.query(
    `
      INSERT INTO axiom_cases
        (id, lead_id, case_name, stage, status, progress, agency_id, branch_id, province_id, agent_id, assigned_agent_id, created_at, updated_at, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        lead_id = EXCLUDED.lead_id,
        case_name = EXCLUDED.case_name,
        stage = EXCLUDED.stage,
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      id,
      asText(record.leadId) || null,
      asText(record.caseName || record.title || id),
      asText(record.stage || record.milestone || record.status),
      asText(record.status || "active"),
      asNumber(record.progress),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      recordDate(record),
      jsonParam(record)
    ]
  );
}

async function upsertQueueRecord(client, table, record, fields) {
  await client.query(
    `
      INSERT INTO ${table} (${fields.columns.join(", ")}, payload, updated_at)
      VALUES (${fields.placeholders.join(", ")}, $${fields.values.length + 1}::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET ${fields.updateSet.join(", ")}, payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [...fields.values, jsonParam(record)]
  );
}

async function upsertTask(client, record) {
  await upsertQueueRecord(client, "axiom_tasks", record, {
    columns: [
      "id",
      "case_id",
      "title",
      "category",
      "priority",
      "status",
      "owner_id",
      "owner_name",
      "due_label",
      "next_action",
      "agency_id",
      "branch_id",
      "province_id",
      "agent_id",
      "assigned_agent_id"
    ],
    placeholders: Array.from({ length: 15 }, (_, index) => `$${index + 1}`),
    values: [
      asText(record.id),
      asText(record.caseId),
      asText(record.title),
      asText(record.category),
      asText(record.priority),
      asText(record.status),
      asText(record.ownerId),
      asText(record.ownerName),
      asText(record.dueLabel),
      asText(record.nextAction),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId)
    ],
    updateSet: [
      "case_id = EXCLUDED.case_id",
      "title = EXCLUDED.title",
      "category = EXCLUDED.category",
      "priority = EXCLUDED.priority",
      "status = EXCLUDED.status",
      "owner_id = EXCLUDED.owner_id",
      "owner_name = EXCLUDED.owner_name",
      "due_label = EXCLUDED.due_label",
      "next_action = EXCLUDED.next_action",
      "agency_id = EXCLUDED.agency_id",
      "branch_id = EXCLUDED.branch_id",
      "province_id = EXCLUDED.province_id",
      "agent_id = EXCLUDED.agent_id",
      "assigned_agent_id = EXCLUDED.assigned_agent_id"
    ]
  });
}

async function upsertReminder(client, record) {
  await client.query(
    `
      INSERT INTO axiom_reminders
        (id, case_id, case_name, client_name, owner_name, due_label, status, note, agency_id, branch_id, province_id, agent_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        case_id = EXCLUDED.case_id,
        case_name = EXCLUDED.case_name,
        client_name = EXCLUDED.client_name,
        owner_name = EXCLUDED.owner_name,
        due_label = EXCLUDED.due_label,
        status = EXCLUDED.status,
        note = EXCLUDED.note,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.caseId),
      asText(record.caseName),
      asText(record.client),
      asText(record.ownerName),
      asText(record.dueLabel),
      asText(record.status),
      asText(record.note),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertEscalation(client, record) {
  await client.query(
    `
      INSERT INTO axiom_escalations
        (id, case_id, case_name, severity, owner_name, reason, next_action, agency_id, branch_id, province_id, agent_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        case_id = EXCLUDED.case_id,
        case_name = EXCLUDED.case_name,
        severity = EXCLUDED.severity,
        owner_name = EXCLUDED.owner_name,
        reason = EXCLUDED.reason,
        next_action = EXCLUDED.next_action,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.caseId),
      asText(record.caseName),
      asText(record.severity),
      asText(record.ownerName),
      asText(record.reason),
      asText(record.nextAction),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertCommission(client, record) {
  await client.query(
    `
      INSERT INTO axiom_commission_protection
        (id, case_id, case_name, agent_name, split, fee, due_date, payment_status, referral_status, risk_tag,
         agency_id, branch_id, province_id, agent_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        case_id = EXCLUDED.case_id,
        case_name = EXCLUDED.case_name,
        agent_name = EXCLUDED.agent_name,
        split = EXCLUDED.split,
        fee = EXCLUDED.fee,
        due_date = EXCLUDED.due_date,
        payment_status = EXCLUDED.payment_status,
        referral_status = EXCLUDED.referral_status,
        risk_tag = EXCLUDED.risk_tag,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.caseId),
      asText(record.caseName),
      asText(record.agent),
      asText(record.split),
      asText(record.fee),
      asText(record.dueDate),
      asText(record.paymentStatus),
      asText(record.referralStatus),
      asText(record.riskTag),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertDealRoom(client, record) {
  await client.query(
    `
      INSERT INTO axiom_deal_rooms
        (id, room_id, room_slug, case_id, case_name, client_name, stage, progress, next_step, access_code, share_url,
         agency_id, branch_id, province_id, agent_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        room_id = EXCLUDED.room_id,
        room_slug = EXCLUDED.room_slug,
        case_id = EXCLUDED.case_id,
        case_name = EXCLUDED.case_name,
        client_name = EXCLUDED.client_name,
        stage = EXCLUDED.stage,
        progress = EXCLUDED.progress,
        next_step = EXCLUDED.next_step,
        access_code = EXCLUDED.access_code,
        share_url = EXCLUDED.share_url,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id || record.roomId),
      asText(record.roomId),
      asText(record.roomSlug),
      asText(record.caseId),
      asText(record.caseName),
      asText(record.clientName),
      asText(record.stage),
      asNumber(record.progress),
      asText(record.nextStep),
      asText(record.accessCode),
      asText(record.shareUrl),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertCommunication(client, kind, record) {
  const id = asText(record.id || `${kind}-${record.threadId || record.caseId || Date.now()}`);
  await client.query(
    `
      INSERT INTO axiom_communications
        (id, kind, case_id, thread_id, channel, status, to_name, category, scheduled_for, delivered_at,
         agency_id, branch_id, province_id, agent_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        kind = EXCLUDED.kind,
        case_id = EXCLUDED.case_id,
        thread_id = EXCLUDED.thread_id,
        channel = EXCLUDED.channel,
        status = EXCLUDED.status,
        to_name = EXCLUDED.to_name,
        category = EXCLUDED.category,
        scheduled_for = EXCLUDED.scheduled_for,
        delivered_at = EXCLUDED.delivered_at,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        agent_id = EXCLUDED.agent_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      id,
      kind,
      asText(record.caseId),
      asText(record.threadId || record.id),
      asText(record.channel || "whatsapp"),
      asText(record.status || record.state),
      asText(record.toName || record.clientName || record.respondentName),
      asText(record.category || record.type),
      asDate(record.scheduledFor),
      asDate(record.deliveredAt),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.agentId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertServicePulse(client, record) {
  await client.query(
    `
      INSERT INTO axiom_service_pulse
        (id, case_id, case_name, agent_id, agent_name, respondent_role, respondent_name, touchpoint, score, sentiment,
         used_for_matching, agency_id, branch_id, province_id, assigned_agent_id, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        case_id = EXCLUDED.case_id,
        case_name = EXCLUDED.case_name,
        agent_id = EXCLUDED.agent_id,
        agent_name = EXCLUDED.agent_name,
        respondent_role = EXCLUDED.respondent_role,
        respondent_name = EXCLUDED.respondent_name,
        touchpoint = EXCLUDED.touchpoint,
        score = EXCLUDED.score,
        sentiment = EXCLUDED.sentiment,
        used_for_matching = EXCLUDED.used_for_matching,
        agency_id = EXCLUDED.agency_id,
        branch_id = EXCLUDED.branch_id,
        province_id = EXCLUDED.province_id,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.caseId),
      asText(record.caseName),
      asText(record.agentId),
      asText(record.agentName),
      asText(record.respondentRole),
      asText(record.respondentName),
      asText(record.touchpoint),
      asNumber(record.score),
      asText(record.sentiment),
      Boolean(record.usedForMatching),
      asText(record.agencyId),
      asText(record.branchId),
      asText(record.provinceId),
      asText(record.assignedAgentId),
      jsonParam(record)
    ]
  );
}

async function upsertAgentNetworkRecord(client, record) {
  const contact = record.contact && typeof record.contact === "object" ? record.contact : {};
  await client.query(
    `
      INSERT INTO axiom_agent_network_records
        (id, agent_name, agency_name, branch_name, role_category, province_id, province, towns,
         contact_email, contact_mobile, contact_whatsapp, source_name, verification_status, outreach_status, pilot_status, payload, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        agent_name = EXCLUDED.agent_name,
        agency_name = EXCLUDED.agency_name,
        branch_name = EXCLUDED.branch_name,
        role_category = EXCLUDED.role_category,
        province_id = EXCLUDED.province_id,
        province = EXCLUDED.province,
        towns = EXCLUDED.towns,
        contact_email = EXCLUDED.contact_email,
        contact_mobile = EXCLUDED.contact_mobile,
        contact_whatsapp = EXCLUDED.contact_whatsapp,
        source_name = EXCLUDED.source_name,
        verification_status = EXCLUDED.verification_status,
        outreach_status = EXCLUDED.outreach_status,
        pilot_status = EXCLUDED.pilot_status,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [
      asText(record.id),
      asText(record.agentName),
      asText(record.agencyName),
      asText(record.branchName),
      asText(record.roleCategory),
      asText(record.provinceId),
      asText(record.province),
      asArray(record.towns),
      asText(contact.email),
      asText(contact.mobile),
      asText(contact.whatsapp),
      asText(record.source?.name),
      asText(record.verification?.status),
      asText(record.outreach?.status),
      asText(record.outreach?.pilotStatus),
      jsonParam(record)
    ]
  );
}

async function upsertAuditEvent(client, record) {
  await client.query(
    `
      INSERT INTO axiom_audit_events (id, event, details, created_at, payload)
      VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET
        event = EXCLUDED.event,
        details = EXCLUDED.details,
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload
    `,
    [
      asText(record.id),
      asText(record.event),
      jsonParam(record.details || {}),
      recordDate(record),
      jsonParam(record)
    ]
  );
}

export async function syncPostgresReportingTables(pool, snapshot, options = {}) {
  const includeBlobs = options.includeBlobs !== false;
  const state = {
    leads: Array.isArray(snapshot?.leads) ? snapshot.leads : [],
    sessions: Array.isArray(snapshot?.sessions) ? snapshot.sessions : [],
    auditLog: Array.isArray(snapshot?.auditLog) ? snapshot.auditLog : [],
    otpChallenges: Array.isArray(snapshot?.otpChallenges) ? snapshot.otpChallenges : [],
    operations: snapshot?.operations && typeof snapshot.operations === "object" ? snapshot.operations : {}
  };
  const operations = state.operations || {};
  const client = await pool.connect();
  const counts = {};

  try {
    await client.query("BEGIN");

    if (includeBlobs) {
      await upsertStateBlob(client, "leads", state.leads);
      await upsertStateBlob(client, "sessions", state.sessions);
      await upsertStateBlob(client, "auditLog", state.auditLog);
      await upsertStateBlob(client, "otpChallenges", state.otpChallenges);
      await upsertStateBlob(client, "operations", operations);
    }

    for (const record of operations.organisations || []) await upsertOrganisation(client, record);
    counts.organisations = (operations.organisations || []).length;

    for (const record of operations.branches || []) await upsertBranch(client, record);
    counts.branches = (operations.branches || []).length;

    for (const record of [...(operations.teamMembers || []), ...(operations.partyUsers || [])]) await upsertUser(client, record);
    counts.users = (operations.teamMembers || []).length + (operations.partyUsers || []).length;

    for (const record of state.leads || []) await upsertLead(client, record);
    counts.leads = (state.leads || []).length;

    const caseSources = [
      ...(operations.dealRooms || []),
      ...(operations.tasks || []),
      ...(operations.reminders || []),
      ...(operations.escalations || []),
      ...(operations.commissionTimeline || []),
      ...(operations.servicePulse || [])
    ];
    const seenCases = new Set();
    for (const record of caseSources) {
      const id = asText(record.caseId || record.id || record.roomId);
      if (!id || seenCases.has(id)) continue;
      seenCases.add(id);
      await upsertCase(client, record);
    }
    counts.cases = seenCases.size;

    for (const record of operations.tasks || []) await upsertTask(client, record);
    counts.tasks = (operations.tasks || []).length;

    for (const record of operations.reminders || []) await upsertReminder(client, record);
    counts.reminders = (operations.reminders || []).length;

    for (const record of operations.escalations || []) await upsertEscalation(client, record);
    counts.escalations = (operations.escalations || []).length;

    for (const record of operations.commissionTimeline || []) await upsertCommission(client, record);
    counts.commissionProtection = (operations.commissionTimeline || []).length;

    for (const record of operations.dealRooms || []) await upsertDealRoom(client, record);
    counts.dealRooms = (operations.dealRooms || []).length;

    const whatsapp = operations.whatsapp || {};
    for (const record of whatsapp.queue || []) await upsertCommunication(client, "whatsapp_queue", record);
    for (const record of whatsapp.threads || []) await upsertCommunication(client, "whatsapp_thread", record);
    for (const record of whatsapp.feedbackLog || []) await upsertCommunication(client, "feedback_log", record);
    for (const record of whatsapp.contactShareLog || []) await upsertCommunication(client, "contact_share", record);
    counts.communications =
      (whatsapp.queue || []).length +
      (whatsapp.threads || []).length +
      (whatsapp.feedbackLog || []).length +
      (whatsapp.contactShareLog || []).length;

    for (const record of operations.servicePulse || []) await upsertServicePulse(client, record);
    counts.servicePulse = (operations.servicePulse || []).length;

    for (const record of operations.agentNetwork?.directory || []) await upsertAgentNetworkRecord(client, record);
    counts.agentNetworkRecords = (operations.agentNetwork?.directory || []).length;

    for (const record of state.auditLog || []) await upsertAuditEvent(client, record);
    counts.auditEvents = (state.auditLog || []).length;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return counts;
}

export async function migrateJsonToPostgres() {
  const state = await loadState();
  const pool = await connect();
  let counts = {};

  try {
    await applySchema(pool);
    counts = await syncPostgresReportingTables(pool, state, { includeBlobs: true });
  } finally {
    await pool.end();
  }

  console.log("Axiom JSON to Postgres migration completed.");
  console.log(JSON.stringify(counts, null, 2));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  migrateJsonToPostgres().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
