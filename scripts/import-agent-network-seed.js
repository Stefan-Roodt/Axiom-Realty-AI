import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const opsPath = path.join(projectRoot, "data", "operations-state.json");
const defaultSeedPath = path.join(projectRoot, "data", "agent-network-collected", "property24-seed-2026-07-03.json");

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProvinceId(value) {
  const normalized = slugify(value || "");
  if (normalized.includes("kwazulu") || normalized === "kzn") return "kwazulu-natal";
  if (normalized.includes("western") || normalized.includes("cape")) return "western-cape";
  if (normalized.includes("gauteng")) return "gauteng";
  if (normalized.includes("eastern")) return "eastern-cape";
  if (normalized.includes("free")) return "free-state";
  if (normalized.includes("limpopo")) return "limpopo";
  if (normalized.includes("mpumalanga")) return "mpumalanga";
  if (normalized.includes("north-west") || normalized.includes("northwest")) return "north-west";
  if (normalized.includes("northern")) return "northern-cape";
  if (normalized === "national" || normalized === "south-africa") return "national";
  return normalized || "unknown";
}

function branchForProvinceId(provinceId) {
  if (provinceId === "kwazulu-natal") return "branch-kzn";
  if (provinceId === "gauteng") return "branch-gauteng-north";
  if (provinceId === "national") return "branch-national-network";
  return "branch-cape";
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRecord(rawRecord, batch) {
  const recordDefaults = isPlainObject(batch.recordDefaults) ? batch.recordDefaults : {};
  const record = {
    ...recordDefaults,
    ...rawRecord,
    source: {
      ...(isPlainObject(recordDefaults.source) ? recordDefaults.source : {}),
      ...(isPlainObject(rawRecord.source) ? rawRecord.source : {})
    },
    verification: {
      ...(isPlainObject(recordDefaults.verification) ? recordDefaults.verification : {}),
      ...(isPlainObject(rawRecord.verification) ? rawRecord.verification : {})
    },
    consent: {
      ...(isPlainObject(recordDefaults.consent) ? recordDefaults.consent : {}),
      ...(isPlainObject(rawRecord.consent) ? rawRecord.consent : {})
    }
  };
  const provinceId = normalizeProvinceId(record.provinceId || record.province);
  const branchId = record.branchId || branchForProvinceId(provinceId);
  const source = record.source || {};
  return {
    ...record,
    id: record.id || `network-${slugify(record.agentName || record.agencyName)}`,
    caseId: record.caseId || `agent-network-${slugify(record.agentName || record.agencyName)}`,
    agencyId: record.agencyId || "agency-network",
    branchId,
    provinceId,
    provinceIds: [provinceId],
    branchIds: [branchId],
    agentId: record.agentId || record.id || `network-${slugify(record.agentName || record.agencyName)}`,
    assignedAgentId: record.assignedAgentId || record.agentId || record.id || `network-${slugify(record.agentName || record.agencyName)}`,
    towns: ensureArray(record.towns),
    suburbs: ensureArray(record.suburbs),
    specialties: ensureArray(record.specialties),
    languages: ensureArray(record.languages),
    source: {
      type: source.type || batch.sourceType || "public_domain",
      name: source.name || batch.sourceName || "Public source",
      url: source.url || "",
      note: source.note || "Public source collected for internal Axiom Agent Network Directory.",
      capturedAt: source.capturedAt || batch.createdAt || new Date().toISOString(),
      capturedBy: source.capturedBy || "Axiom"
    },
    verification: {
      status: record.verification?.status || "source_found",
      reviewNote: record.verification?.reviewNote || "Imported from public-source seed batch."
    },
    consent: {
      emailStatus: record.consent?.emailStatus || "not_contacted",
      whatsappStatus: record.consent?.whatsappStatus || "not_contacted",
      doNotContact: Boolean(record.consent?.doNotContact),
      lawfulUseNote:
        record.consent?.lawfulUseNote ||
        "Public-domain business profile stored for internal matching, coverage mapping and verification before outreach."
    },
    createdAt: record.createdAt || batch.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function run() {
  const seedPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSeedPath;
  const batch = await readJson(seedPath, null);
  if (!batch || !Array.isArray(batch.records)) {
    throw new Error(`Seed file does not contain a records array: ${seedPath}`);
  }

  const operations = await readJson(opsPath, {});
  const ops = operations && typeof operations === "object" && !Array.isArray(operations) ? operations : {};
  ops.agentNetwork = ops.agentNetwork && typeof ops.agentNetwork === "object" ? ops.agentNetwork : {};
  ops.agentNetwork.directory = Array.isArray(ops.agentNetwork.directory) ? ops.agentNetwork.directory : [];
  ops.agentNetwork.outreachLog = Array.isArray(ops.agentNetwork.outreachLog) ? ops.agentNetwork.outreachLog : [];
  ops.agentNetwork.importBatches = Array.isArray(ops.agentNetwork.importBatches) ? ops.agentNetwork.importBatches : [];

  let created = 0;
  let updated = 0;
  for (const rawRecord of batch.records) {
    const record = normalizeRecord(rawRecord, batch);
    const existing = ops.agentNetwork.directory.find((item) => item.id === record.id);
    if (existing) {
      Object.assign(existing, { ...existing, ...record, updatedAt: new Date().toISOString() });
      updated += 1;
    } else {
      ops.agentNetwork.directory.unshift(record);
      created += 1;
    }
  }

  const importBatch = {
    id: batch.batchId,
    caseId: `agent-network-${batch.batchId}`,
    name: batch.sourceName || batch.batchId,
    sourceType: batch.sourceType || "public_domain",
    recordCount: batch.records.length,
    acceptedCount: batch.records.length,
    rejectedCount: 0,
    createdCount: created,
    updatedCount: updated,
    createdAt: new Date().toISOString(),
    agencyId: "agency-network",
    branchId: "branch-national-network",
    provinceId: "national"
  };
  const existingBatchIndex = ops.agentNetwork.importBatches.findIndex((item) => item.id === importBatch.id);
  if (existingBatchIndex >= 0) {
    ops.agentNetwork.importBatches[existingBatchIndex] = {
      ...ops.agentNetwork.importBatches[existingBatchIndex],
      ...importBatch
    };
  } else {
    ops.agentNetwork.importBatches.unshift(importBatch);
  }

  await fs.mkdir(path.dirname(opsPath), { recursive: true });
  await fs.writeFile(opsPath, JSON.stringify(ops, null, 2), "utf8");

  console.log(`Imported ${batch.records.length} Agent Network records from ${path.relative(projectRoot, seedPath)}.`);
  console.log(`Created: ${created}. Updated: ${updated}.`);
}

await run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
