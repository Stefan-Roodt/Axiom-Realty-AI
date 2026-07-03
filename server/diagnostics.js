import fs from "fs";
import { canWriteDirectory } from "./json-store.js";

const starterPasswords = new Set(["", "axiom-admin", "change-this-before-launch", "axiomadmin2026!"]);

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function sizeOf(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function check(id, label, ready, severity = "warning", detail = "") {
  return { id, label, ready: Boolean(ready), severity, detail };
}

export function buildStartupDiagnostics({ env, config, paths, storage, whatsapp, launch, lmStudio }) {
  const environment = env.RENDER ? "render" : env.NODE_ENV || "local";
  const productionLike = Boolean(env.RENDER || env.NODE_ENV === "production");
  const adminPassword = String(env.ADMIN_PASSWORD || "");
  const publicBaseUrl = String(env.PUBLIC_BASE_URL || "");
  const allowedOrigin = String(env.ALLOWED_ORIGIN || "");

  const checks = [
    check("admin-password", "Admin password is explicitly configured", Boolean(adminPassword), "fatal"),
    check("admin-password-safe", "Admin password is not a starter/default value", !starterPasswords.has(adminPassword.trim().toLowerCase()), "warning"),
    check("port", "Port is valid", Number.isFinite(config.port) && config.port > 0, "fatal", `PORT=${config.port}`),
    check("data-dir", "Data folder is writable", canWriteDirectory(paths.dataDir), "fatal", paths.dataDir),
    check("index", "index.html exists", exists(paths.indexHtml), "fatal", paths.indexHtml),
    check("script", "script.js exists", exists(paths.scriptJs), "fatal", paths.scriptJs),
    check("package", "package.json exists", exists(paths.packageJson), "fatal", paths.packageJson),
    check("module-public-ui", "Public UI module exists", exists(paths.publicUiModule), "fatal", paths.publicUiModule),
    check("module-admin-control", "Admin control module exists", exists(paths.adminControlModule), "fatal", paths.adminControlModule),
    check("module-api-client", "API client module exists", exists(paths.apiClientModule), "fatal", paths.apiClientModule),
    check("module-communications", "Communications module exists", exists(paths.communicationsModule), "fatal", paths.communicationsModule),
    check("module-data-workflows", "Data workflow module exists", exists(paths.dataWorkflowsModule), "fatal", paths.dataWorkflowsModule),
    check("public-base-url", "Public base URL is configured", Boolean(publicBaseUrl), productionLike ? "warning" : "info"),
    check("allowed-origin", "Browser origin is restricted", Boolean(allowedOrigin && allowedOrigin !== "*"), productionLike ? "warning" : "info"),
    check("whatsapp-config", "WhatsApp delivery or test bridge is configured", Boolean(whatsapp?.configured), "info"),
    check("whatsapp-web-prod", "WhatsApp Web test bridge is off in production", !(productionLike && whatsapp?.webTest?.enabled), "fatal"),
    check("lm-studio-prod", "LM Studio local helper is off in production", !(productionLike && lmStudio?.enabled), "fatal"),
    check("launch-readiness", "Launch readiness checks are passing", Boolean(launch?.readyForProduction), productionLike ? "warning" : "info")
  ];

  const failures = checks.filter((item) => !item.ready && item.severity === "fatal");
  const warnings = checks.filter((item) => !item.ready && item.severity === "warning");

  return {
    ok: failures.length === 0,
    environment,
    productionLike,
    checkedAt: new Date().toISOString(),
    app: {
      version: config.version,
      build: config.build,
      port: config.port,
      host: config.host
    },
    storage: {
      ...storage,
      dataDir: paths.dataDir,
      sessionsBytes: sizeOf(paths.sessionsFile),
      operationsBytes: sizeOf(paths.operationsFile),
      agentApplicationsBytes: sizeOf(paths.agentApplicationsFile)
    },
    services: {
      whatsapp,
      lmStudio,
      launchReady: Boolean(launch?.readyForProduction)
    },
    checks,
    failures,
    warnings
  };
}

export function publicStatusFromDiagnostics(report) {
  return {
    ok: report.ok,
    environment: report.environment,
    checkedAt: report.checkedAt,
    app: report.app,
    storage: {
      leadCount: report.storage.leadCount,
      operationsCaseCount: report.storage.operationsCaseCount,
      agentApplicationCount: report.storage.agentApplicationCount
    },
    checks: report.checks.map((item) => ({
      id: item.id,
      label: item.label,
      ready: item.ready,
      severity: item.severity
    })),
    warnings: report.warnings.length,
    failures: report.failures.length
  };
}

export function assertProductionSafety(report, { enforce = false } = {}) {
  if (!enforce || report.ok) return;
  const details = report.failures.map((item) => `${item.id}: ${item.label}`).join("; ");
  throw new Error(`Unsafe production configuration: ${details}`);
}

export function logStartupDiagnostics(report) {
  const prefix = `[startup:${report.environment}]`;
  console.log(`${prefix} build=${report.app.build} port=${report.app.port} ok=${report.ok}`);
  for (const item of report.failures) console.error(`${prefix} FAIL ${item.id}: ${item.label}`);
  for (const item of report.warnings) console.warn(`${prefix} WARN ${item.id}: ${item.label}`);
}
