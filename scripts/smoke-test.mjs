const baseUrl = (process.env.SMOKE_BASE_URL || process.env.PUBLIC_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const adminPassword = (process.env.ADMIN_PASSWORD || process.env.SMOKE_ADMIN_PASSWORD || "").trim();

const checks = [
  { name: "homepage", path: "/", expect: 200 },
  { name: "health", path: "/healthz", expect: 200, json: true },
  { name: "app status", path: "/api/app-status", expect: 200, json: true },
  { name: "public ui module", path: "/modules/public-ui.js", expect: 200 },
  { name: "admin control module", path: "/modules/admin-control.js", expect: 200 },
  { name: "api client module", path: "/modules/api-client.js", expect: 200 },
  { name: "communications module", path: "/modules/communications.js", expect: 200 },
  { name: "data workflows module", path: "/modules/data-workflows.js", expect: 200 }
];

if (adminPassword) {
  checks.push(
    { name: "admin analytics", path: "/api/analytics", expect: 200, json: true, admin: true },
    { name: "system status", path: "/api/system-status", expect: 200, json: true, admin: true },
    { name: "launch readiness", path: "/api/launch-readiness", expect: 200, json: true, admin: true }
  );
}

async function runCheck(check) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: check.admin ? { "x-admin-password": adminPassword } : {}
  });
  if (response.status !== check.expect) {
    throw new Error(`${check.name} returned ${response.status}, expected ${check.expect}`);
  }
  if (check.json) {
    const data = await response.json();
    if (!data || data.ok === false) throw new Error(`${check.name} returned an unhealthy JSON payload`);
  }
  return `${check.name}: ok`;
}

const results = [];
for (const check of checks) {
  try {
    results.push(await runCheck(check));
  } catch (error) {
    console.error(`FAIL ${check.name}: ${error.message}`);
    process.exitCode = 1;
  }
}

for (const result of results) console.log(result);
if (!adminPassword) console.warn("Admin smoke checks skipped because ADMIN_PASSWORD/SMOKE_ADMIN_PASSWORD was not set.");
