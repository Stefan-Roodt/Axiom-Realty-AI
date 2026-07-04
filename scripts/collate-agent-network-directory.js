import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const opsPath = path.join(projectRoot, "data", "operations-state.json");
const outputDir = path.join(projectRoot, "outputs");
const reportPath = path.join(outputDir, "agent-network-directory-collated.md");
const jsonPath = path.join(outputDir, "agent-network-directory-collated.json");

const provinceLabels = {
  "eastern-cape": "Eastern Cape",
  "free-state": "Free State",
  gauteng: "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  national: "National / multi-province",
  "north-west": "North West",
  "northern-cape": "Northern Cape",
  unknown: "Unknown",
  "western-cape": "Western Cape"
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function valueOrDash(value) {
  const clean = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "").trim();
  return clean || "-";
}

function tableCell(value) {
  return valueOrDash(value).replace(/\|/g, "/");
}

function sourceUrl(record) {
  return record.source?.url || record.sourceUrl || "";
}

function listingText(record) {
  const sale = record.listingSummary?.forSale;
  const rentals = record.listingSummary?.rentals;
  if (Number.isFinite(Number(sale)) || Number.isFinite(Number(rentals))) {
    return `${Number(sale || 0)} sale / ${Number(rentals || 0)} rental`;
  }
  return "-";
}

function sortRecords(records) {
  return [...records].sort((a, b) => {
    const provinceA = provinceLabels[a.provinceId] || a.provinceId || "Unknown";
    const provinceB = provinceLabels[b.provinceId] || b.provinceId || "Unknown";
    return (
      provinceA.localeCompare(provinceB) ||
      String(a.agencyName || a.agentName || "").localeCompare(String(b.agencyName || b.agentName || "")) ||
      String(a.agentName || "").localeCompare(String(b.agentName || ""))
    );
  });
}

function groupBy(records, getKey) {
  const groups = new Map();
  for (const record of records) {
    const key = getKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function run() {
  const operations = await readJson(opsPath, {});
  const directory = Array.isArray(operations.agentNetwork?.directory) ? operations.agentNetwork.directory : [];
  const batches = Array.isArray(operations.agentNetwork?.importBatches) ? operations.agentNetwork.importBatches : [];
  const sortedRecords = sortRecords(directory).map((record, index) => ({
    row: index + 1,
    id: record.id,
    provinceId: record.provinceId || "unknown",
    province: provinceLabels[record.provinceId] || record.provinceId || "Unknown",
    agencyName: record.agencyName || "",
    agentName: record.agentName || "",
    branchName: record.branchName || "",
    towns: Array.isArray(record.towns) ? record.towns : [],
    suburbs: Array.isArray(record.suburbs) ? record.suburbs : [],
    specialties: Array.isArray(record.specialties) ? record.specialties : [],
    independentStatus: record.independentStatus || "",
    ppraStatus: record.ppraStatus || "",
    verificationStatus: record.verification?.status || "",
    contactEmail: record.contact?.email || "",
    contactMobile: record.contact?.mobile || "",
    contactWhatsapp: record.contact?.whatsapp || "",
    sourceName: record.source?.name || "",
    sourceUrl: sourceUrl(record),
    listingSummary: record.listingSummary || null
  }));

  const byProvince = [...groupBy(sortedRecords, (record) => record.province).entries()]
    .map(([province, records]) => ({ province, count: records.length }))
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province));

  const bySource = [...groupBy(directory, (record) => record.source?.name || "Unknown source").entries()]
    .map(([source, records]) => ({ source, count: records.length }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  const duplicateCandidates = [...groupBy(sortedRecords, (record) => slugify(record.agencyName || record.agentName)).entries()]
    .filter(([key, records]) => key && records.length > 1)
    .map(([key, records]) => ({
      key,
      count: records.length,
      names: [...new Set(records.map((record) => record.agencyName || record.agentName).filter(Boolean))],
      provinces: [...new Set(records.map((record) => record.province).filter(Boolean))],
      ids: records.map((record) => record.id)
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const missingContactCount = sortedRecords.filter(
    (record) => !record.contactEmail && !record.contactMobile && !record.contactWhatsapp
  ).length;
  const needsVerificationCount = sortedRecords.filter((record) => record.verificationStatus !== "verified").length;

  const lines = [];
  lines.push("# Axiom Agent Network Directory - Collated");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total records: ${sortedRecords.length}`);
  lines.push(`- Import batches: ${batches.length}`);
  lines.push(`- Records needing verification: ${needsVerificationCount}`);
  lines.push(`- Records with no visible contact details captured: ${missingContactCount}`);
  lines.push("- Outreach rule: verify first; no uncontrolled bulk messaging.");
  lines.push("");
  lines.push("## Province Rollup");
  lines.push("");
  lines.push("| Province | Records |");
  lines.push("| --- | ---: |");
  for (const item of byProvince) lines.push(`| ${tableCell(item.province)} | ${item.count} |`);
  lines.push("");
  lines.push("## Source Rollup");
  lines.push("");
  lines.push("| Source | Records |");
  lines.push("| --- | ---: |");
  for (const item of bySource) lines.push(`| ${tableCell(item.source)} | ${item.count} |`);
  lines.push("");
  lines.push("## Duplicate-Looking Names To Review");
  lines.push("");
  lines.push("| Name key | Count | Names | Provinces |");
  lines.push("| --- | ---: | --- | --- |");
  for (const item of duplicateCandidates.slice(0, 50)) {
    lines.push(
      `| ${tableCell(item.key)} | ${item.count} | ${tableCell(item.names.join(", "))} | ${tableCell(item.provinces.join(", "))} |`
    );
  }
  if (!duplicateCandidates.length) lines.push("| - | 0 | - | - |");
  lines.push("");
  lines.push("## Directory By Province");
  for (const [province, records] of groupBy(sortedRecords, (record) => record.province).entries()) {
    lines.push("");
    lines.push(`### ${province} (${records.length})`);
    lines.push("");
    lines.push("| Agency / team | Person / branch | Towns | Focus | Listings | Verification | Source |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const record of records) {
      const personBranch = [record.agentName, record.branchName].filter(Boolean).join(" / ");
      lines.push(
        `| ${tableCell(record.agencyName || record.agentName)} | ${tableCell(personBranch)} | ${tableCell(record.towns)} | ${tableCell(record.specialties)} | ${tableCell(listingText(record))} | ${tableCell(record.verificationStatus)} | ${tableCell(record.sourceUrl)} |`
      );
    }
  }
  lines.push("");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: sortedRecords.length,
          importBatches: batches.length,
          needsVerification: needsVerificationCount,
          missingVisibleContact: missingContactCount
        },
        byProvince,
        bySource,
        duplicateCandidates,
        records: sortedRecords
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Collated ${sortedRecords.length} records into ${path.relative(projectRoot, reportPath)}`);
  console.log(`Structured export written to ${path.relative(projectRoot, jsonPath)}`);
}

await run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
