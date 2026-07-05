import { promises as fs } from "node:fs";
import path from "node:path";

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

  try {
    await pool.query(bootstrapSql);
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
    },
    async diagnostics() {
      const ping = await pool.query("SELECT NOW() AS now");
      return {
        mode: "postgres",
        connected: true,
        fallbackActive: false,
        tableName,
        connectedAt: ping.rows[0]?.now || null,
        detail: "Using Postgres-backed blob persistence as the migration bridge."
      };
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
