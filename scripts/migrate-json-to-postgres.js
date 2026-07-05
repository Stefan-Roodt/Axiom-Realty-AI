import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const schemaPath = path.join(rootDir, "database", "schema.sql");

async function readJson(fileName, fallback) {
  try {
    const raw = await fs.readFile(path.join(dataDir, fileName), "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
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

async function loadSnapshot() {
  return {
    leads: await readJson("leads.json", []),
    sessions: await readJson("auth-sessions.json", []),
    auditLog: await readJson("audit-log.json", []),
    otpChallenges: await readJson("auth-otp.json", []),
    operations: await readJson("operations-state.json", {})
  };
}

async function upsertBlob(client, key, payload) {
  await client.query(
    `
      INSERT INTO axiom_state_blobs (state_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (state_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [key, JSON.stringify(payload ?? null)]
  );
}

async function migrate() {
  const schema = await fs.readFile(schemaPath, "utf8");
  const snapshot = await loadSnapshot();
  const pool = await connect();
  const client = await pool.connect();

  try {
    await client.query(schema);
    await client.query("BEGIN");
    for (const [key, payload] of Object.entries(snapshot)) {
      await upsertBlob(client, key, payload);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("Axiom JSON state copied into Postgres.");
  console.log(
    JSON.stringify(
      {
        leads: snapshot.leads.length,
        sessions: snapshot.sessions.length,
        auditLog: snapshot.auditLog.length,
        otpChallenges: snapshot.otpChallenges.length,
        operationsReady: Boolean(snapshot.operations && Object.keys(snapshot.operations).length)
      },
      null,
      2
    )
  );
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
