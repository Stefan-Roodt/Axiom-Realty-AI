import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAccessConfig } from "./modules/access-config.js";
import { createStorage } from "./modules/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.env.NODE_ENV || "local";
const {
  isRenderRuntime,
  accessConfig,
  permissionCatalog,
  workspaceTabDefinitions,
  accessProfiles,
  normalizeRole,
  getRoleKey,
  getRoleProfile,
  getRolePermissions,
  getWorkspaceTabs,
  getRoleSigninContact,
  hasPermission,
  hasAnyPermission,
  getPermissionLabels
} = createAccessConfig(process.env, { environment });

const config = {
  port: Number(process.env.PORT || (isRenderRuntime ? 8080 : 8098)),
  host: process.env.HOST || (isRenderRuntime ? "0.0.0.0" : "127.0.0.1"),
  appVersion: process.env.APP_VERSION || "local-dev",
  environment,
  isRenderRuntime,
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").trim(),
  ...accessConfig,
  whatsappMode: String(process.env.WHATSAPP_MODE || "managed-simulation").trim(),
  whatsappProvider: String(process.env.WHATSAPP_PROVIDER || process.env.WHATSAPP_MODE || "managed-simulation").trim(),
  whatsappPhoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
  whatsappAccessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
  whatsappBusinessAccountId: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim(),
  whatsappApiBaseUrl: String(process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com").trim().replace(/\/+$/, ""),
  whatsappApiVersion: String(process.env.WHATSAPP_API_VERSION || "v20.0").trim(),
  whatsappFromNumber: String(process.env.WHATSAPP_FROM_NUMBER || "").trim(),
  twilioAccountSid: String(process.env.TWILIO_ACCOUNT_SID || "").trim(),
  twilioAuthToken: String(process.env.TWILIO_AUTH_TOKEN || "").trim(),
  twilioWhatsappFromNumber: String(process.env.TWILIO_WHATSAPP_FROM_NUMBER || process.env.WHATSAPP_FROM_NUMBER || "").trim(),
  twilioApiBaseUrl: String(process.env.TWILIO_API_BASE_URL || "https://api.twilio.com").trim().replace(/\/+$/, ""),
  twilioStatusCallbackUrl: String(process.env.TWILIO_STATUS_CALLBACK_URL || "").trim(),
  twilioValidateSignature: String(process.env.TWILIO_VALIDATE_SIGNATURE || "false").trim().toLowerCase() === "true",
  otpProvider: String(process.env.OTP_PROVIDER || "preview").trim(),
  emailProvider: String(process.env.EMAIL_PROVIDER || "none").trim(),
  emailFrom: String(process.env.EMAIL_FROM || "").trim(),
  llmProvider: String(
    process.env.LLM_PROVIDER ||
      (process.env.NVIDIA_API_KEY ? "nvidia" : process.env.OPENAI_API_KEY ? "openai" : "none")
  )
    .trim()
    .toLowerCase(),
  nvidiaApiKey: String(process.env.NVIDIA_API_KEY || "").trim(),
  nvidiaBaseUrl: String(process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").trim().replace(/\/+$/, ""),
  nvidiaModel: String(process.env.NVIDIA_MODEL || "z-ai/glm-5.2").trim(),
  nvidiaFallbackModel: String(process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3-ultra-550b-a55b").trim(),
  openaiApiKey: String(process.env.OPENAI_API_KEY || "").trim(),
  openaiBaseUrl: String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, ""),
  openaiModel: String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim()
};

function getPortSequence(preferredPort) {
  const requested = Number(preferredPort) || 8080;
  if (requested !== 8080) {
    return [requested];
  }

  return [8080, 8098, 8099, 3000, 3001];
}

function buildListenErrorLabel(port, host, error) {
  return `Failed to bind ${host}:${port} (${error?.code || "unknown"})`;
}

function listenOnPort(server, port, host) {
  return new Promise((resolve, reject) => {
    const onListen = () => {
      cleanup();
      resolve(port);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      server.removeListener("error", onError);
      server.removeListener("listening", onListen);
    };

    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, host);
  });
}

async function startWithFallback(server, preferredPort, host) {
  const errors = [];
  for (const candidate of getPortSequence(preferredPort)) {
    try {
      const boundPort = await listenOnPort(server, candidate, host);
      if (candidate !== preferredPort) {
        console.log(`Port ${preferredPort} unavailable; using fallback port ${candidate}`);
      }
      return boundPort;
    } catch (error) {
      errors.push(buildListenErrorLabel(candidate, host, error));
      if (!["EACCES", "EADDRINUSE"].includes(error?.code)) {
        throw error;
      }
    }
  }
  throw new Error(`Unable to start server on configured and fallback ports. ${errors.join(" | ")}`);
}

const dataDir = path.join(__dirname, "data");
const missionControlCookie = "axiom_mc_session";
let storage = null;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const state = {
  leads: [],
  sessions: [],
  auditLog: [],
  otpChallenges: [],
  operations: null
};

function hashSecret(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeAccessKey(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function safeAccessKeyEquals(left, right) {
  const normalizedLeft = normalizeAccessKey(left);
  const normalizedRight = normalizeAccessKey(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return safeEquals(normalizedLeft, normalizedRight);
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeSigninContact(contact) {
  return String(contact || "").trim().toLowerCase();
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function unique(values) {
  return [...new Set(ensureArray(values))];
}

function defaultScopeForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "principal") {
    return { allAccess: true, agencyIds: ["agency-axiom"], branchIds: ["branch-cape", "branch-kzn"], provinceIds: ["western-cape", "kwazulu-natal"], agentIds: [], caseIds: [] };
  }
  if (normalizedRole === "office_admin") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape", "branch-kzn"], provinceIds: ["western-cape", "kwazulu-natal"], agentIds: ["agent-aisha", "agent-lebo"], caseIds: [] };
  }
  if (normalizedRole === "agent") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "buyer") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "seller") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "attorney") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "bond_originator") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-kzn"], provinceIds: ["kwazulu-natal"], agentIds: ["agent-lebo"], caseIds: ["case-durban"] };
  }
  return { allAccess: false, agencyIds: [], branchIds: [], provinceIds: [], agentIds: [], caseIds: [] };
}

function normalizeScope(scope, role) {
  const fallback = defaultScopeForRole(role);
  const source = scope && typeof scope === "object" ? scope : {};
  return {
    allAccess: Boolean(source.allAccess || fallback.allAccess),
    agencyIds: unique(source.agencyIds?.length ? source.agencyIds : fallback.agencyIds),
    branchIds: unique(source.branchIds?.length ? source.branchIds : fallback.branchIds),
    provinceIds: unique(source.provinceIds?.length ? source.provinceIds : fallback.provinceIds),
    agentIds: unique(source.agentIds?.length ? source.agentIds : fallback.agentIds),
    caseIds: unique(source.caseIds?.length ? source.caseIds : fallback.caseIds)
  };
}

function scopeFromRecord(record, role) {
  return normalizeScope(
    {
      allAccess: record?.scope?.allAccess,
      agencyIds: record?.scope?.agencyIds || record?.agencyIds || record?.agencyId,
      branchIds: record?.scope?.branchIds || record?.branchIds || record?.branchId,
      provinceIds: record?.scope?.provinceIds || record?.provinceIds || record?.provinceId,
      agentIds: record?.scope?.agentIds || record?.agentIds || record?.agentId || (normalizeRole(role) === "agent" ? record?.id : []),
      caseIds: record?.scope?.caseIds || record?.caseIds
    },
    role
  );
}

function normalizeSessionIdentity(role, identity = {}, contact = "") {
  const normalizedRole = normalizeRole(role);
  const scope = scopeFromRecord(identity, normalizedRole);
  return {
    userId: String(identity.id || `${normalizedRole}-${hashSecret(contact || normalizedRole).slice(0, 8)}`).trim(),
    name: String(identity.name || getRoleProfile(normalizedRole).label).trim(),
    contact: normalizeSigninContact(identity.contact || contact || getRoleSigninContact(normalizedRole)),
    agencyId: String(identity.agencyId || scope.agencyIds[0] || "agency-axiom").trim(),
    branchId: String(identity.branchId || scope.branchIds[0] || "").trim(),
    provinceId: String(identity.provinceId || scope.provinceIds[0] || "").trim(),
    scope
  };
}

function getSessionScope(sessionOrRole) {
  if (typeof sessionOrRole === "object" && sessionOrRole) {
    return normalizeScope(sessionOrRole.scope, sessionOrRole.role);
  }
  return defaultScopeForRole(sessionOrRole);
}

function valuesOverlap(left = [], right = []) {
  const rightSet = new Set(ensureArray(right));
  return ensureArray(left).some((value) => rightSet.has(value));
}

function contactMatches(record, contact) {
  return normalizeSigninContact(record?.contact) === normalizeSigninContact(contact);
}

function findIdentityForSignin(role, contact) {
  const normalizedRole = normalizeRole(role);
  const operations = getOperationsState();
  const teamMatch = operations.teamMembers.find((member) => {
    return normalizeRole(member.role) === normalizedRole && contactMatches(member, contact);
  });
  if (teamMatch) return normalizeSessionIdentity(normalizedRole, teamMatch, contact);

  const partyMatch = operations.partyUsers.find((party) => {
    return normalizeRole(party.role || party.partyType) === normalizedRole && contactMatches(party, contact);
  });
  if (partyMatch) return normalizeSessionIdentity(normalizedRole, partyMatch, contact);

  const configuredContact = normalizeSigninContact(getRoleSigninContact(normalizedRole));
  if (configuredContact && configuredContact === normalizeSigninContact(contact)) {
    return normalizeSessionIdentity(normalizedRole, {}, contact);
  }

  return null;
}

function normalizeSessionRecord(session) {
  const role = normalizeRole(session?.role);
  const identity = normalizeSessionIdentity(role, session || {}, session?.contact || getRoleSigninContact(role));
  return {
    ...session,
    role,
    userId: session?.userId || identity.userId,
    name: session?.name || identity.name,
    contact: session?.contact || identity.contact,
    agencyId: session?.agencyId || identity.agencyId,
    branchId: session?.branchId || identity.branchId,
    provinceId: session?.provinceId || identity.provinceId,
    scope: normalizeScope(session?.scope || identity.scope, role)
  };
}

function recordVisibleToScope(record, sessionOrRole) {
  const viewerRole = normalizeRole(typeof sessionOrRole === "object" ? sessionOrRole.role : sessionOrRole);
  const scope = getSessionScope(sessionOrRole);
  if (scope.allAccess) return true;
  const caseScopedRoles = new Set(["agent", "buyer", "seller", "attorney", "bond_originator"]);
  if (caseScopedRoles.has(viewerRole)) {
    if (valuesOverlap(ensureArray(record?.caseId), scope.caseIds)) return true;
    if (valuesOverlap(ensureArray(record?.caseIds), scope.caseIds)) return true;
    if (valuesOverlap(ensureArray(record?.agentId), scope.agentIds)) return true;
    if (valuesOverlap(ensureArray(record?.assignedAgentId), scope.agentIds)) return true;
    if (valuesOverlap(ensureArray(record?.ownerId), scope.agentIds)) return true;
    if (normalizeRole(record?.role) === "agent" && record?.id && valuesOverlap([record.id], scope.agentIds)) return true;
    return false;
  }
  if (record?.id && valuesOverlap([record.id], scope.agencyIds)) return true;
  if (record?.id && valuesOverlap([record.id], scope.branchIds)) return true;
  if (valuesOverlap(record?.branchIds, scope.branchIds)) return true;
  if (valuesOverlap(record?.provinceIds, scope.provinceIds)) return true;
  const normalizedRecord = withScopeDefaults(record || {});
  if (normalizedRecord.caseId && valuesOverlap([normalizedRecord.caseId], scope.caseIds)) return true;
  if (valuesOverlap(ensureArray(record?.caseIds), scope.caseIds)) return true;
  if (normalizedRecord.agentId && valuesOverlap([normalizedRecord.agentId], scope.agentIds)) return true;
  if (record?.id && valuesOverlap([record.id], scope.agentIds)) return true;
  if (normalizedRecord.branchId && valuesOverlap([normalizedRecord.branchId], scope.branchIds)) return true;
  if (normalizedRecord.provinceId && valuesOverlap([normalizedRecord.provinceId], scope.provinceIds)) return true;
  if (normalizedRecord.agencyId && valuesOverlap([normalizedRecord.agencyId], scope.agencyIds)) return true;
  return false;
}

function filterVisible(records, sessionOrRole) {
  const list = Array.isArray(records) ? records : [];
  return list.filter((record) => recordVisibleToScope(record, sessionOrRole));
}

function nowIso() {
  return new Date().toISOString();
}

function createOpsId(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

function formatOpsTimestamp(value) {
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferAreaFromCaseName(caseName) {
  const value = String(caseName || "").trim();
  if (!value) return "Area to confirm";
  return value.split("-")[0].trim();
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
  return normalized || "western-cape";
}

function formatProvinceLabel(value) {
  const provinceId = normalizeProvinceId(value);
  const labels = {
    "western-cape": "Western Cape",
    "kwazulu-natal": "KwaZulu-Natal",
    gauteng: "Gauteng",
    "eastern-cape": "Eastern Cape",
    "free-state": "Free State",
    limpopo: "Limpopo",
    mpumalanga: "Mpumalanga",
    "north-west": "North West",
    "northern-cape": "Northern Cape"
  };
  return labels[provinceId] || String(value || "Province to confirm").trim();
}

function branchForProvinceId(provinceId) {
  const normalized = normalizeProvinceId(provinceId);
  if (normalized === "kwazulu-natal") return "branch-kzn";
  if (normalized === "gauteng") return "branch-gauteng-north";
  return "branch-cape";
}

function normalizeConsentStatus(value, fallback = "not_contacted") {
  const normalized = slugify(value || "").replace(/-/g, "_");
  if (["opted_in", "consented", "yes", "subscribed"].includes(normalized)) return "opted_in";
  if (["opted_out", "unsubscribed", "do_not_contact", "no"].includes(normalized)) return "opted_out";
  if (["business_context", "legitimate_interest", "relationship"].includes(normalized)) return "business_context";
  if (["not_contacted", "unknown", "pending", "none"].includes(normalized)) return normalized === "none" ? fallback : normalized;
  return fallback;
}

function normalizeVerificationStatus(value, fallback = "source_found") {
  const normalized = slugify(value || "").replace(/-/g, "_");
  if (["verified", "reviewed", "manually_verified"].includes(normalized)) return "verified";
  if (["invalid", "bad_record", "stale"].includes(normalized)) return "invalid";
  if (["needs_review", "pending_review", "unverified"].includes(normalized)) return "needs_review";
  if (["source_found", "public_source", "public"].includes(normalized)) return "source_found";
  return fallback;
}

function daysSinceIso(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function normalizeAgentNetworkRecord(record = {}) {
  const capturedAt = record.createdAt || record.source?.capturedAt || nowIso();
  const provinceId = normalizeProvinceId(record.provinceId || record.province || record.location?.province || "western-cape");
  const branchId = String(record.branchId || branchForProvinceId(provinceId)).trim();
  const source = record.source && typeof record.source === "object" ? record.source : {};
  const contact = record.contact && typeof record.contact === "object" ? record.contact : {};
  const email = normalizeEmail(record.email || record.contactEmail || contact.email);
  const mobile = normalizeContactNumber(record.mobile || record.cellphone || record.phone || contact.mobile || contact.cellphone || contact.phone);
  const whatsapp = normalizeContactNumber(record.whatsapp || contact.whatsapp || mobile);
  const consent = record.consent && typeof record.consent === "object" ? record.consent : {};
  const verification = record.verification && typeof record.verification === "object" ? record.verification : {};
  const outreach = record.outreach && typeof record.outreach === "object" ? record.outreach : {};

  return {
    id: String(record.id || createOpsId("network-agent")).trim(),
    agentName: String(record.agentName || record.name || "Agent name to confirm").trim(),
    agencyName: String(record.agencyName || record.agency || "Agency to confirm").trim(),
    branchName: String(record.branchName || record.branch || "").trim(),
    roleCategory: String(record.roleCategory || record.role || "estate_agent").trim(),
    provinceId,
    province: formatProvinceLabel(provinceId),
    provinceIds: unique(record.provinceIds || [provinceId]),
    agencyId: String(record.agencyId || "agency-network").trim(),
    branchId,
    branchIds: unique(record.branchIds || [branchId]),
    towns: unique(record.towns || record.areas || record.location?.towns || record.suburbs),
    suburbs: unique(record.suburbs || record.areas || record.location?.suburbs),
    specialties: unique(record.specialties || record.focusAreas || record.propertyTypes),
    languages: unique(record.languages),
    independentStatus: String(record.independentStatus || record.agencyModel || "to_confirm").trim(),
    ppraStatus: String(record.ppraStatus || record.ffcStatus || "to_confirm").trim(),
    contact: {
      email,
      mobile,
      whatsapp,
      phone: normalizeContactNumber(record.phone || contact.phone || mobile),
      website: String(record.website || contact.website || "").trim()
    },
    source: {
      type: String(source.type || record.sourceType || "public_domain").trim(),
      name: String(source.name || record.sourceName || "Public source").trim(),
      url: String(source.url || record.sourceUrl || "").trim(),
      note: String(source.note || record.sourceNote || "Publicly available business/contact information; verify before outreach.").trim(),
      capturedAt: source.capturedAt || record.sourceCapturedAt || capturedAt,
      capturedBy: String(source.capturedBy || record.sourceCapturedBy || "Axiom").trim()
    },
    consent: {
      emailStatus: normalizeConsentStatus(consent.emailStatus || record.emailConsentStatus),
      whatsappStatus: normalizeConsentStatus(consent.whatsappStatus || record.whatsappConsentStatus),
      doNotContact: Boolean(consent.doNotContact || record.doNotContact),
      lawfulUseNote: String(
        consent.lawfulUseNote ||
          record.lawfulUseNote ||
          "Public-domain contact data may be used internally for matching and carefully controlled business outreach with opt-out respected."
      ).trim(),
      optOutAt: consent.optOutAt || record.optOutAt || "",
      optOutReason: String(consent.optOutReason || record.optOutReason || "").trim()
    },
    verification: {
      status: normalizeVerificationStatus(verification.status || record.verificationStatus),
      lastVerifiedAt: verification.lastVerifiedAt || record.lastVerifiedAt || "",
      verifiedBy: String(verification.verifiedBy || record.verifiedBy || "").trim(),
      reviewNote: String(verification.reviewNote || record.reviewNote || "").trim()
    },
    outreach: {
      status: String(outreach.status || record.outreachStatus || "not_contacted").trim(),
      count: Number(outreach.count || record.outreachCount || 0),
      lastContactedAt: outreach.lastContactedAt || record.lastContactedAt || "",
      lastChannel: String(outreach.lastChannel || record.lastChannel || "").trim(),
      nextFollowUpAt: outreach.nextFollowUpAt || record.nextFollowUpAt || "",
      pilotStatus: String(outreach.pilotStatus || record.pilotStatus || "not_invited").trim()
    },
    matchingSignals: {
      sellerFit: Number(record.matchingSignals?.sellerFit ?? record.sellerFit ?? 60),
      buyerFit: Number(record.matchingSignals?.buyerFit ?? record.buyerFit ?? 55),
      referralFit: Number(record.matchingSignals?.referralFit ?? record.referralFit ?? 60),
      servicePulseAvg: Number(record.matchingSignals?.servicePulseAvg ?? record.servicePulseAvg ?? 0),
      responseReliability: Number(record.matchingSignals?.responseReliability ?? record.responseReliability ?? 50),
      capacity: String(record.matchingSignals?.capacity || record.capacity || "to_confirm").trim()
    },
    notes: String(record.notes || "").trim(),
    createdAt: capturedAt,
    updatedAt: record.updatedAt || capturedAt
  };
}

function inferScopeDefaults(item = {}) {
  const caseId = String(item.caseId || item.id || "").toLowerCase();
  const caseName = String(item.caseName || item.label || "").toLowerCase();
  if (caseId.includes("durban") || caseName.includes("durban") || caseName.includes("umhlanga")) {
    return {
      agencyId: "agency-axiom",
      branchId: "branch-kzn",
      provinceId: "kwazulu-natal",
      agentId: "agent-lebo"
    };
  }
  return {
    agencyId: "agency-axiom",
    branchId: "branch-cape",
    provinceId: "western-cape",
    agentId: "agent-aisha"
  };
}

function withScopeDefaults(item = {}) {
  const defaults = inferScopeDefaults(item);
  return {
    ...item,
    agencyId: item.agencyId || defaults.agencyId,
    branchId: item.branchId || defaults.branchId,
    provinceId: normalizeProvinceId(item.provinceId || item.province || defaults.provinceId),
    agentId: item.agentId || item.assignedAgentId || item.ownerId || defaults.agentId,
    assignedAgentId: item.assignedAgentId || item.agentId || defaults.agentId,
    caseId: item.caseId || item.id || createOpsId("case")
  };
}

function normalizeOperationsShape(operations) {
  if (!operations || typeof operations !== "object" || Array.isArray(operations)) {
    return defaultOperationsState();
  }

  operations.organisations = Array.isArray(operations.organisations) ? operations.organisations : [];
  operations.branches = Array.isArray(operations.branches) ? operations.branches : [];
  operations.partyUsers = Array.isArray(operations.partyUsers) ? operations.partyUsers : [];
  operations.teamMembers = Array.isArray(operations.teamMembers) ? operations.teamMembers : [];
  operations.tasks = Array.isArray(operations.tasks) ? operations.tasks : [];
  operations.reminders = Array.isArray(operations.reminders) ? operations.reminders : [];
  operations.escalations = Array.isArray(operations.escalations) ? operations.escalations : [];
  operations.commissionTimeline = Array.isArray(operations.commissionTimeline) ? operations.commissionTimeline : [];
  operations.dealRooms = Array.isArray(operations.dealRooms) ? operations.dealRooms : [];
  operations.servicePulse = Array.isArray(operations.servicePulse) ? operations.servicePulse : [];
  operations.pilotControl = operations.pilotControl && typeof operations.pilotControl === "object" ? operations.pilotControl : {};
  operations.pilotControl.agents = Array.isArray(operations.pilotControl.agents) ? operations.pilotControl.agents : [];
  operations.pilotControl.scenarios = Array.isArray(operations.pilotControl.scenarios) ? operations.pilotControl.scenarios : [];
  operations.pilotControl.messageLog = Array.isArray(operations.pilotControl.messageLog) ? operations.pilotControl.messageLog : [];
  operations.pilotControl.issueLog = Array.isArray(operations.pilotControl.issueLog) ? operations.pilotControl.issueLog : [];
  operations.agentNetwork = operations.agentNetwork && typeof operations.agentNetwork === "object" ? operations.agentNetwork : {};
  operations.agentNetwork.directory = Array.isArray(operations.agentNetwork.directory) ? operations.agentNetwork.directory : [];
  operations.agentNetwork.outreachLog = Array.isArray(operations.agentNetwork.outreachLog) ? operations.agentNetwork.outreachLog : [];
  operations.agentNetwork.importBatches = Array.isArray(operations.agentNetwork.importBatches) ? operations.agentNetwork.importBatches : [];
  operations.financeControl =
    operations.financeControl && typeof operations.financeControl === "object"
      ? operations.financeControl
      : defaultFinanceControlConfig();
  operations.whatsapp = operations.whatsapp && typeof operations.whatsapp === "object" ? operations.whatsapp : {};
  operations.whatsapp.bridge =
    operations.whatsapp.bridge && typeof operations.whatsapp.bridge === "object"
      ? operations.whatsapp.bridge
      : {
          mode: config.whatsappMode,
          connected: getWhatsappRuntime().liveDeliveryConnected,
          provider: getWhatsappRuntime().provider,
          status: getWhatsappRuntime().status,
          lastHeartbeatAt: nowIso(),
          lastProcessedAt: nowIso()
        };
  operations.whatsapp.bridge.mode = operations.whatsapp.bridge.mode || config.whatsappMode;
  operations.whatsapp.bridge.provider = operations.whatsapp.bridge.provider || getWhatsappRuntime().provider;
  operations.whatsapp.bridge.connected = getWhatsappRuntime().liveDeliveryConnected;
  operations.whatsapp.bridge.status = getWhatsappRuntime().status;
  operations.whatsapp.queue = Array.isArray(operations.whatsapp.queue) ? operations.whatsapp.queue : [];
  operations.whatsapp.threads = Array.isArray(operations.whatsapp.threads) ? operations.whatsapp.threads : [];
  operations.whatsapp.feedbackLog = Array.isArray(operations.whatsapp.feedbackLog) ? operations.whatsapp.feedbackLog : [];
  operations.whatsapp.contactShareLog = Array.isArray(operations.whatsapp.contactShareLog)
    ? operations.whatsapp.contactShareLog
    : [];

  const defaults = defaultOperationsState();
  if (!operations.organisations.length) operations.organisations = defaults.organisations;
  if (!operations.branches.length) operations.branches = defaults.branches;
  if (!operations.partyUsers.length) operations.partyUsers = defaults.partyUsers;
  if (!operations.teamMembers.length) operations.teamMembers = defaults.teamMembers;
  if (!operations.tasks.length) operations.tasks = defaults.tasks;
  if (!operations.reminders.length) operations.reminders = defaults.reminders;
  if (!operations.escalations.length) operations.escalations = defaults.escalations;
  if (!operations.commissionTimeline.length) operations.commissionTimeline = defaults.commissionTimeline;
  if (!operations.dealRooms.length) operations.dealRooms = defaults.dealRooms;
  if (!operations.servicePulse.length) operations.servicePulse = defaults.servicePulse;
  if (!operations.pilotControl.agents.length) operations.pilotControl.agents = defaults.pilotControl.agents;
  if (!operations.pilotControl.scenarios.length) operations.pilotControl.scenarios = defaults.pilotControl.scenarios;
  if (!operations.agentNetwork.directory.length) operations.agentNetwork.directory = defaults.agentNetwork.directory;
  if (!operations.agentNetwork.importBatches.length) operations.agentNetwork.importBatches = defaults.agentNetwork.importBatches;
  if (!operations.whatsapp.queue.length) operations.whatsapp.queue = defaults.whatsapp.queue;
  if (!operations.whatsapp.threads.length) operations.whatsapp.threads = defaults.whatsapp.threads;

  operations.teamMembers = operations.teamMembers.map((member) => {
    const role = normalizeRole(member.role);
    const defaults = inferScopeDefaults(member);
    const scoped = {
      ...member,
      agencyId: member.agencyId || defaults.agencyId,
      branchId: member.branchId || defaults.branchId,
      provinceId: normalizeProvinceId(member.provinceId || member.province || defaults.provinceId),
      agentId: member.agentId || (role === "agent" ? member.id : undefined),
      assignedAgentId: member.assignedAgentId || member.agentId || (role === "agent" ? member.id : undefined)
    };
    return {
      ...scoped,
      role,
      scope: scopeFromRecord(scoped, role)
    };
  });
  operations.partyUsers = operations.partyUsers.map((party) => {
    const role = normalizeRole(party.role || party.partyType);
    const scoped = withScopeDefaults(party);
    return {
      ...scoped,
      role,
      partyType: role,
      scope: scopeFromRecord(scoped, role)
    };
  });
  operations.tasks = operations.tasks.map(withScopeDefaults);
  operations.reminders = operations.reminders.map(withScopeDefaults);
  operations.escalations = operations.escalations.map(withScopeDefaults);
  operations.commissionTimeline = operations.commissionTimeline.map(withScopeDefaults);
  operations.dealRooms = operations.dealRooms.map(withScopeDefaults);
  operations.servicePulse = operations.servicePulse.map(withScopeDefaults);
  operations.pilotControl.agents = operations.pilotControl.agents.map(withScopeDefaults);
  operations.pilotControl.scenarios = operations.pilotControl.scenarios.map(withScopeDefaults);
  operations.pilotControl.messageLog = operations.pilotControl.messageLog.map(withScopeDefaults);
  operations.pilotControl.issueLog = operations.pilotControl.issueLog.map(withScopeDefaults);
  operations.agentNetwork.directory = operations.agentNetwork.directory.map(normalizeAgentNetworkRecord);
  operations.agentNetwork.outreachLog = operations.agentNetwork.outreachLog.map(withScopeDefaults);
  operations.agentNetwork.importBatches = operations.agentNetwork.importBatches.map(withScopeDefaults);
  operations.financeControl = {
    ...defaultFinanceControlConfig(),
    ...operations.financeControl,
    budgetLines:
      Array.isArray(operations.financeControl.budgetLines) && operations.financeControl.budgetLines.length
        ? operations.financeControl.budgetLines
        : defaultFinanceControlConfig().budgetLines
  };
  operations.whatsapp.queue = operations.whatsapp.queue.map(withScopeDefaults);
  operations.whatsapp.threads = operations.whatsapp.threads.map(withScopeDefaults);
  operations.whatsapp.feedbackLog = operations.whatsapp.feedbackLog.map(withScopeDefaults);
  operations.whatsapp.contactShareLog = operations.whatsapp.contactShareLog.map(withScopeDefaults);

  return operations;
}

function createCommissionTimelineEntry(payload) {
  const createdAt = nowIso();
  const paymentStatus = String(payload.paymentStatus || "Protected / Awaiting invoice").trim();
  const evidence = String(payload.evidence || "Evidence logged").trim();
  return {
    id: createOpsId("protect"),
    caseId: String(payload.caseId || slugify(payload.caseName) || createOpsId("case")).trim(),
    caseName: String(payload.caseName || "Protected deal").trim(),
    area: String(payload.area || inferAreaFromCaseName(payload.caseName)).trim(),
    agent: String(payload.agent || "Assigned agent").trim(),
    split: String(payload.split || "Split to confirm").trim(),
    fee: String(payload.fee || "Fee to confirm").trim(),
    dueDate: String(payload.dueDate || "TBC").trim(),
    evidence,
    proofItem: String(payload.proofItem || evidence).trim(),
    paymentStatus,
    referralStatus: String(payload.referralStatus || "Protected").trim(),
    milestone: String(payload.milestone || "Commission protection logged").trim(),
    checkpoint: String(payload.checkpoint || payload.dueDate || "Next payment check to confirm").trim(),
    updated: formatOpsTimestamp(createdAt),
    updatedAt: createdAt,
    riskTag: String(payload.riskTag || paymentStatus).trim()
  };
}

function defaultFinanceControlConfig() {
  return {
    currency: "ZAR",
    seatPricePerAgent: 125,
    averageReferralFee: 20000,
    budgetLines: [
      { key: "concierge", label: "Concierge + admin desk", amount: 8500 },
      { key: "ai_stack", label: "AI, WhatsApp and tooling", amount: 2800 },
      { key: "marketing", label: "Lead generation and outreach", amount: 6000 },
      { key: "pilot", label: "Pilot testing and QA", amount: 2200 },
      { key: "buffer", label: "Operating buffer", amount: 2500 }
    ],
    note: "Working monthly planning view. Tune the budget lines later as live costs settle."
  };
}

function formatMoneyAmount(value, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function monthLabelFor(date = new Date()) {
  return new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(date);
}

function buildFinanceControlSnapshot(sessionOrRole, visible = {}, leadActionCentre = null, agentSuccessDesk = null) {
  const operations = getOperationsState();
  const finance = {
    ...defaultFinanceControlConfig(),
    ...(operations.financeControl || {})
  };
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTeam = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const successDesk = agentSuccessDesk || buildAgentSuccessDesk(sessionOrRole, visible, actionCentre);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthFees = visibleCommission.filter((item) => String(item.dueDate || "").startsWith(currentMonthKey));
  const allFeeValues = visibleCommission.map((item) => parseMoneyAmount(item.fee)).filter((amount) => amount > 0);
  const averageReferralFee = allFeeValues.length
    ? Math.round(allFeeValues.reduce((total, amount) => total + amount, 0) / allFeeValues.length)
    : Number(finance.averageReferralFee || 20000);
  const paidThisMonth = monthFees
    .filter((item) => /paid/i.test(String(item.paymentStatus || "")))
    .reduce((total, item) => total + parseMoneyAmount(item.fee), 0);
  const protectedPipeline = monthFees
    .filter((item) => !/paid/i.test(String(item.paymentStatus || "")))
    .reduce((total, item) => total + parseMoneyAmount(item.fee), 0);
  const seatCount = Math.max(Number(successDesk.summary?.agents || 0), visibleTeam.length);
  const seatRevenue = seatCount * Number(finance.seatPricePerAgent || 125);
  const budgetLines = Array.isArray(finance.budgetLines) ? finance.budgetLines : [];
  const monthlyBudget = budgetLines.reduce((total, line) => total + Number(line.amount || 0), 0);
  const hotLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "hot").length;
  const warmLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "warm").length;
  const nurtureLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "nurture").length;
  const criticalActions = Number(actionCentre.summary?.critical || 0);
  const aiUpside = Math.round(
    averageReferralFee * ((hotLeads * 0.35) + (warmLeads * 0.18) + (nurtureLeads * 0.08))
  );
  const projectedForecast = seatRevenue + protectedPipeline + paidThisMonth;
  const aiProjection = projectedForecast + aiUpside;
  const forecastVariance = projectedForecast - monthlyBudget;
  const aiVariance = aiProjection - monthlyBudget;
  const forecastStatus =
    projectedForecast >= monthlyBudget * 1.05
      ? "Ahead of plan"
      : projectedForecast >= monthlyBudget * 0.9
        ? "Close to plan"
        : "Below plan";
  const aiConfidence = hotLeads + warmLeads >= 4 ? "Medium" : hotLeads >= 2 ? "Medium" : "Low";
  const primaryDriver =
    protectedPipeline >= seatRevenue
      ? "Protected commission pipeline is carrying the current forecast."
      : "Recurring seat revenue is the steadier base layer right now.";
  const riskNote = criticalActions
    ? `${criticalActions} critical action card${criticalActions === 1 ? "" : "s"} could delay conversion if they sit too long.`
    : "No critical action pile-up is distorting the projection right now.";

  return {
    monthLabel: monthLabelFor(now),
    note: finance.note || defaultFinanceControlConfig().note,
    budget: {
      total: monthlyBudget,
      formattedTotal: formatMoneyAmount(monthlyBudget, finance.currency),
      lines: budgetLines.map((line) => ({
        ...line,
        formattedAmount: formatMoneyAmount(line.amount, finance.currency)
      }))
    },
    forecast: {
      total: projectedForecast,
      formattedTotal: formatMoneyAmount(projectedForecast, finance.currency),
      variance: forecastVariance,
      varianceLabel: forecastVariance >= 0
        ? `${formatMoneyAmount(Math.abs(forecastVariance), finance.currency)} above budget`
        : `${formatMoneyAmount(Math.abs(forecastVariance), finance.currency)} below budget`,
      status: forecastStatus,
      components: [
        {
          label: "Agent subscriptions",
          value: formatMoneyAmount(seatRevenue, finance.currency),
          note: `${seatCount} active agent seat${seatCount === 1 ? "" : "s"} at ${formatMoneyAmount(finance.seatPricePerAgent, finance.currency)} each.`
        },
        {
          label: "Protected commission due",
          value: formatMoneyAmount(protectedPipeline, finance.currency),
          note: `${monthFees.filter((item) => !/paid/i.test(String(item.paymentStatus || ""))).length} protected matter${monthFees.filter((item) => !/paid/i.test(String(item.paymentStatus || ""))).length === 1 ? "" : "s"} due this month.`
        },
        {
          label: "Paid this month",
          value: formatMoneyAmount(paidThisMonth, finance.currency),
          note: "Already converted inside the visible July protection timeline."
        }
      ],
      primaryDriver
    },
    aiProjection: {
      total: aiProjection,
      formattedTotal: formatMoneyAmount(aiProjection, finance.currency),
      upside: aiUpside,
      upsideLabel: formatMoneyAmount(aiUpside, finance.currency),
      variance: aiVariance,
      varianceLabel: aiVariance >= 0
        ? `${formatMoneyAmount(Math.abs(aiVariance), finance.currency)} above budget`
        : `${formatMoneyAmount(Math.abs(aiVariance), finance.currency)} below budget`,
      confidence: aiConfidence,
      note: "AI projection uses live lead quality, current protected commission pipeline, and recurring agent-seat revenue. It is directional, not booked revenue.",
      riskNote,
      signals: [
        {
          label: "Hot leads",
          value: `${hotLeads}`,
          note: "Best immediate conversion candidates in the current workspace."
        },
        {
          label: "Warm leads",
          value: `${warmLeads}`,
          note: "Likely to convert once the next missing step or client nudge is cleared."
        },
        {
          label: "Avg protected fee",
          value: formatMoneyAmount(averageReferralFee, finance.currency),
          note: "Average expected fee across the visible protection desk."
        },
        {
          label: "Critical action risk",
          value: `${criticalActions}`,
          note: riskNote
        }
      ]
    }
  };
}

function createDealRoomRecord(payload, request) {
  const createdAt = nowIso();
  const roomId = String(payload.roomId || payload.room || "").trim().toUpperCase() || `AX-${randomBytes(3).toString("hex").toUpperCase()}`;
  const roomSlug = slugify(payload.caseName || roomId) || roomId.toLowerCase();
  const shareUrl = `${getRequestOrigin(request)}/client-progress.html?room=${encodeURIComponent(roomId)}&slug=${encodeURIComponent(roomSlug)}`;

  return {
    id: createOpsId("room"),
    roomId,
    roomSlug,
    caseId: String(payload.caseId || slugify(payload.caseName) || createOpsId("case")).trim(),
    caseName: String(payload.caseName || "Client matter").trim(),
    clientName: String(payload.clientName || "Client").trim(),
    stage: String(payload.stage || "Stage to confirm").trim(),
    progress: Math.max(5, Math.min(Number(payload.progress || 0), 100)),
    nextStep: String(payload.nextStep || "Next step to confirm").trim(),
    accessCode: String(payload.accessCode || "").trim(),
    shareMessage: String(payload.shareMessage || "").trim(),
    shareUrl,
    createdAt,
    updatedAt: createdAt
  };
}

function defaultOperationsState() {
  const createdAt = nowIso();

  return {
    organisations: [
      {
        id: "agency-axiom",
        name: "Axiom Realty AI Demo Agency",
        provinceIds: ["western-cape", "kwazulu-natal"],
        branchIds: ["branch-cape", "branch-kzn"],
        status: "active"
      },
      {
        id: "agency-2",
        name: "Estate Agency 2",
        provinceIds: ["gauteng"],
        branchIds: ["branch-gauteng-north"],
        status: "ready"
      }
    ],
    branches: [
      {
        id: "branch-cape",
        agencyId: "agency-axiom",
        name: "Western Cape Branch",
        provinceId: "western-cape",
        adminIds: ["admin-nadine"],
        agentIds: ["agent-aisha"]
      },
      {
        id: "branch-kzn",
        agencyId: "agency-axiom",
        name: "KwaZulu-Natal Branch",
        provinceId: "kwazulu-natal",
        adminIds: ["admin-nadine"],
        agentIds: ["agent-lebo"]
      },
      {
        id: "branch-gauteng-north",
        agencyId: "agency-2",
        name: "Gauteng North Branch",
        provinceId: "gauteng",
        adminIds: [],
        agentIds: []
      }
    ],
    teamMembers: [
      {
        id: "principal-stefan",
        name: "Stefan Roodt",
        role: "principal",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        scope: defaultScopeForRole("principal"),
        lane: "Office command",
        contact: getRoleSigninContact("principal"),
        status: "online",
        responsibilities: [
          "Final escalation decisions",
          "Commission exposure oversight",
          "Office performance review"
        ]
      },
      {
        id: "admin-nadine",
        name: "Nadine Smit",
        role: "office_admin",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        scope: defaultScopeForRole("office_admin"),
        lane: "Control desk",
        contact: getRoleSigninContact("office_admin"),
        status: "online",
        responsibilities: [
          "Lead routing and assignment",
          "Document chase and updates",
          "Friday seller packs and approvals"
        ]
      },
      {
        id: "agent-aisha",
        name: "Aisha Khan",
        role: "agent",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        scope: { ...defaultScopeForRole("agent"), agentIds: ["agent-aisha"], caseIds: ["case-claremont"] },
        lane: "Claremont / sellers",
        contact: "aisha@axiomrealty.co.za",
        status: "busy",
        responsibilities: [
          "Seller brief follow-through",
          "Viewing confirmations",
          "Client WhatsApp updates"
        ]
      },
      {
        id: "agent-lebo",
        name: "Lebo Naidoo",
        role: "agent",
        agencyId: "agency-axiom",
        branchId: "branch-kzn",
        provinceId: "kwazulu-natal",
        agentId: "agent-lebo",
        scope: {
          allAccess: false,
          agencyIds: ["agency-axiom"],
          branchIds: ["branch-kzn"],
          provinceIds: ["kwazulu-natal"],
          agentIds: ["agent-lebo"],
          caseIds: ["case-durban"]
        },
        lane: "Durban North / referrals",
        contact: "lebo@axiomrealty.co.za",
        status: "online",
        responsibilities: [
          "Referral acceptance",
          "Buyer progression",
          "Commission proof capture"
        ]
      }
    ],
    partyUsers: [
      {
        id: "buyer-naledi",
        name: "Naledi Mokoena",
        role: "buyer",
        partyType: "buyer",
        contact: getRoleSigninContact("buyer"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("buyer"), caseIds: ["case-claremont"] }
      },
      {
        id: "seller-dylan",
        name: "Dylan Peters",
        role: "seller",
        partyType: "seller",
        contact: getRoleSigninContact("seller"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("seller"), caseIds: ["case-claremont"] }
      },
      {
        id: "attorney-transfer",
        name: "Transfer Attorney",
        role: "attorney",
        partyType: "attorney",
        contact: getRoleSigninContact("attorney"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("attorney"), caseIds: ["case-claremont"] }
      },
      {
        id: "bond-originator",
        name: "Bond Originator",
        role: "bond_originator",
        partyType: "bond_originator",
        contact: getRoleSigninContact("bond_originator"),
        agencyId: "agency-axiom",
        branchId: "branch-kzn",
        provinceId: "kwazulu-natal",
        agentId: "agent-lebo",
        caseIds: ["case-durban"],
        scope: { ...defaultScopeForRole("bond_originator"), caseIds: ["case-durban"] }
      }
    ],
    tasks: [
      {
        id: "task-claremont-viewing",
        title: "Schedule Claremont viewing",
        caseName: "Claremont family home",
        caseId: "case-claremont",
        ownerId: "agent-aisha",
        ownerName: "Aisha Khan",
        role: "agent",
        category: "Viewing",
        priority: "high",
        dueLabel: "Today by 15:00",
        status: "open",
        nextAction: "Confirm buyer and seller time, then mark done.",
        source: "Viewing coordinator"
      },
      {
        id: "task-durban-terms",
        title: "Resolve Durban referral terms",
        caseName: "Durban North referral",
        caseId: "case-durban",
        ownerId: "principal-stefan",
        ownerName: "Stefan Roodt",
        role: "principal",
        category: "Commission",
        priority: "high",
        dueLabel: "Today by 17:00",
        status: "open",
        nextAction: "Confirm the 25% successful-sale-only structure and release the lead.",
        source: "Protection desk"
      },
      {
        id: "task-seller-pack",
        title: "Approve Friday seller pack",
        caseName: "Claremont family home",
        caseId: "case-claremont",
        ownerId: "admin-nadine",
        ownerName: "Nadine Smit",
        role: "office_admin",
        category: "Seller update",
        priority: "medium",
        dueLabel: "Friday 15:30",
        status: "open",
        nextAction: "Send approval ask to Aisha before the seller pack releases.",
        source: "Seller concierge"
      },
      {
        id: "task-finance-note",
        title: "Prompt buyer for finance documents",
        caseName: "Durban North referral",
        caseId: "case-durban",
        ownerId: "agent-lebo",
        ownerName: "Lebo Naidoo",
        role: "agent",
        category: "Finance",
        priority: "medium",
        dueLabel: "Tomorrow 10:00",
        status: "open",
        nextAction: "Send the finance-readiness note and store the reply.",
        source: "Buyer progression"
      }
    ],
    reminders: [
      {
        id: "reminder-claremont-viewing",
        caseId: "case-claremont",
        caseName: "Claremont family home",
        client: "Naledi Mokoena",
        ownerName: "Aisha Khan",
        dueLabel: "Today by 15:00",
        status: "pending",
        note: "Seller is ready. Agent needs to lock the viewing time with the buyer."
      },
      {
        id: "reminder-durban-feedback",
        caseId: "case-durban",
        caseName: "Durban North referral",
        client: "Jason Pillay",
        ownerName: "Lebo Naidoo",
        dueLabel: "Tomorrow by 10:00",
        status: "pending",
        note: "Ask for post-viewing feedback with a light opt-out."
      }
    ],
    escalations: [
      {
        id: "esc-durban",
        caseName: "Durban North referral",
        severity: "high",
        ownerName: "Stefan Roodt",
        reason: "Referral terms still not accepted",
        nextAction: "Principal to confirm the route before the lead drifts."
      },
      {
        id: "esc-umhlanga",
        caseName: "Umhlanga introduction",
        severity: "medium",
        ownerName: "Nadine Smit",
        reason: "Commission proof still missing",
        nextAction: "Office admin to chase signed split confirmation."
      }
    ],
    commissionTimeline: [
      {
        id: "protect-claremont",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        area: "Claremont",
        agent: "Aisha Khan",
        split: "25% referral split",
        fee: "R18,000",
        dueDate: "2026-07-12",
        evidence: "Signed split agreement attached",
        proofItem: "Signed split agreement + intro thread",
        paymentStatus: "Awaiting invoice",
        referralStatus: "Protected",
        milestone: "Offer accepted",
        checkpoint: "Invoice to receiving agency",
        updated: "2 Jul 2026, 10:40",
        updatedAt: createdAt,
        riskTag: "Commission Risk"
      },
      {
        id: "protect-durban",
        caseId: "case-durban",
        caseName: "Durban North referral",
        area: "Durban North",
        agent: "Lebo Naidoo",
        split: "25% referral split",
        fee: "R22,500",
        dueDate: "2026-07-18",
        evidence: "WhatsApp proof trail saved",
        proofItem: "WhatsApp acceptance + mandate note",
        paymentStatus: "Awaiting payment",
        referralStatus: "Sale pending",
        milestone: "Mandate live",
        checkpoint: "Check invoice and seller feedback",
        updated: "1 Jul 2026, 16:25",
        updatedAt: createdAt,
        riskTag: "Awaiting Payment"
      }
    ],
    dealRooms: [
      {
        id: "room-claremont",
        roomId: "CLAREMONT-4821",
        roomSlug: "claremont-sale-r3-85m",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        clientName: "Naledi Mokoena",
        stage: "Conveyancing in progress",
        progress: 60,
        nextStep: "Attorney to confirm draft transfer pack and next signature window.",
        accessCode: "AX-4821",
        shareMessage:
          "Here is your private Deal Room link and access code. Use it any time to see the current stage, what has been completed, what is still outstanding, and what happens next.",
        shareUrl: "http://127.0.0.1:8080/client-progress.html?room=CLAREMONT-4821&slug=claremont-sale-r3-85m",
        createdAt,
        updatedAt: createdAt
      }
    ],
    servicePulse: [
      {
        id: "pulse-claremont-seller",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        agentId: "agent-aisha",
        agentName: "Aisha Khan",
        respondentRole: "seller",
        respondentName: "Dylan Peters",
        touchpoint: "weekly_seller_update",
        touchpointLabel: "Weekly seller update",
        score: 9,
        sentiment: "delighted",
        tags: ["clear update", "felt looked after"],
        comment: "The Friday update was clear and helped me understand the next step without chasing.",
        source: "whatsapp",
        usedForMatching: true,
        visibility: "internal_scorecard",
        quarter: quarterKey(createdAt),
        learningSignals: {
          triggerPoint: "friday_1530_seller_update",
          recoveryNeeded: false,
          matchingWeight: 90
        },
        createdAt,
        updatedAt: createdAt
      }
    ],
    pilotControl: {
      agents: [
        {
          id: "pilot-aisha",
          caseId: "pilot-agent-aisha",
          agentId: "agent-aisha",
          assignedAgentId: "agent-aisha",
          agentName: "Aisha Khan",
          agencyName: "Axiom Realty AI Demo Agency",
          branchId: "branch-cape",
          provinceId: "western-cape",
          whatsappNumber: "+27 82 000 0001",
          status: "active",
          readiness: "opted_in",
          scenariosPassed: ["scenario-morning-brief"],
          currentScenarioId: "scenario-deal-room-share",
          nextTest: "Deal Room link and access-code flow",
          issueCount: 0,
          lastScenarioAt: createdAt,
          notes: "Internal pilot agent for WhatsApp workflow checks."
        },
        {
          id: "pilot-lebo",
          caseId: "pilot-agent-lebo",
          agentId: "agent-lebo",
          assignedAgentId: "agent-lebo",
          agentName: "Lebo Naidoo",
          agencyName: "Axiom Realty AI Demo Agency",
          branchId: "branch-kzn",
          provinceId: "kwazulu-natal",
          whatsappNumber: "+27 83 000 0002",
          status: "invited",
          readiness: "awaiting_opt_in",
          scenariosPassed: [],
          currentScenarioId: "scenario-import-lead",
          nextTest: "Imported buyer lead to protected commission route",
          issueCount: 0,
          lastScenarioAt: "",
          notes: "Waiting for WhatsApp opt-in before live testing."
        }
      ],
      scenarios: [
        {
          id: "scenario-seller-lead",
          caseId: "pilot-scenario-seller-lead",
          title: "New seller lead",
          triggerPoint: "Seller submits lead or is imported by agent",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives a clean seller brief, next action and commission-protection reminder.",
          body:
            "Pilot scenario: new seller lead. Axiom should send you a concise seller brief, missing questions, next best action, and commission-protection reminder. Reply PASS if this feels useful or ISSUE with what broke.",
          passCriteria: ["Brief is clear", "Next action is obvious", "No sensitive data leaks"]
        },
        {
          id: "scenario-buyer-lead",
          caseId: "pilot-scenario-buyer-lead",
          title: "New buyer lead",
          triggerPoint: "Buyer is captured through the site, WhatsApp or agent import",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives finance readiness, area intent, timing and next follow-up.",
          body:
            "Pilot scenario: new buyer lead. Axiom should summarise finance readiness, area intent, timing, and your next follow-up. Reply PASS if usable or ISSUE with what needs fixing.",
          passCriteria: ["Finance position visible", "Intent is clear", "Follow-up feels natural"]
        },
        {
          id: "scenario-viewing-reminder",
          caseId: "pilot-scenario-viewing-reminder",
          title: "Viewing reminder",
          triggerPoint: "Viewing needs scheduling or confirmation",
          channel: "WhatsApp",
          expectedOutcome: "Agent gets a reminder to schedule, plus a Done action after they confirm.",
          body:
            "Pilot scenario: viewing reminder. Axiom should remind you to schedule the viewing, then let you mark it done once confirmed. Reply PASS if this reduces admin or ISSUE if it nags at the wrong moment.",
          passCriteria: ["Reminder is useful", "Agent stays in control", "No over-automation"]
        },
        {
          id: "scenario-seller-update",
          caseId: "pilot-scenario-seller-update",
          title: "Friday seller update",
          triggerPoint: "Friday 15:30 seller update approval",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives a concise seller update draft and chooses whether to send.",
          body:
            "Pilot scenario: Friday seller update. Axiom should ask permission before sending the seller update and keep the wording concise. Reply PASS if the control feels right or ISSUE if the wording is off.",
          passCriteria: ["Agent approval required", "Seller wording is calm", "No duplicate feature confusion"]
        },
        {
          id: "scenario-deal-room-share",
          caseId: "pilot-scenario-deal-room-share",
          title: "Deal Room share",
          triggerPoint: "Client needs progress visibility",
          channel: "WhatsApp",
          expectedOutcome: "Agent can send one private progress link with access code and clear next step.",
          body:
            "Pilot scenario: Deal Room share. Axiom should prepare one private progress link and access code for the client. Reply PASS if it reduces update chasing or ISSUE if anything is unclear.",
          passCriteria: ["Link purpose is clear", "Access code is included", "Progress view is client-safe"]
        },
        {
          id: "scenario-service-pulse",
          caseId: "pilot-scenario-service-pulse",
          title: "Service Pulse",
          triggerPoint: "After a completed service moment",
          channel: "WhatsApp",
          expectedOutcome: "Client feedback is requested gently, optional, stored, and visible internally.",
          body:
            "Pilot scenario: Service Pulse. Axiom should ask for feedback gently after a useful service moment and store it internally. Reply PASS if it feels respectful or ISSUE if it feels like a public rating.",
          passCriteria: ["Feedback is optional", "No public shaming", "Stored against case"]
        }
      ],
      messageLog: [
        {
          id: "pilot-msg-aisha",
          caseId: "pilot-agent-aisha",
          agentId: "agent-aisha",
          agentName: "Aisha Khan",
          scenarioId: "scenario-morning-brief",
          scenarioTitle: "Daily Morning Brief",
          status: "passed",
          channel: "WhatsApp",
          body: "Morning Brief test passed during internal pilot setup.",
          queuedAt: createdAt,
          updatedAt: createdAt
        }
      ],
      issueLog: []
    },
    agentNetwork: {
      directory: [
        {
          id: "network-aisha-khan",
          agentName: "Aisha Khan",
          agencyName: "Axiom Realty AI Demo Agency",
          branchName: "Western Cape Branch",
          provinceId: "western-cape",
          towns: ["Claremont", "Rondebosch", "Newlands"],
          suburbs: ["Claremont", "Rondebosch", "Newlands"],
          specialties: ["seller mandates", "family homes", "progress updates"],
          languages: ["English"],
          independentStatus: "agency_agent",
          ppraStatus: "to_confirm",
          contact: {
            email: "aisha@axiomrealty.co.za",
            mobile: "+27 82 000 0001",
            whatsapp: "+27 82 000 0001",
            website: "https://www.axiomrealty.co.za"
          },
          source: {
            type: "internal_demo",
            name: "Axiom internal pilot",
            url: "https://www.axiomrealty.co.za",
            note: "Seed record for pilot matching and WhatsApp testing.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "business_context",
            whatsappStatus: "opted_in",
            doNotContact: false,
            lawfulUseNote: "Internal pilot agent; WhatsApp testing permitted."
          },
          verification: {
            status: "verified",
            lastVerifiedAt: createdAt,
            verifiedBy: "Axiom",
            reviewNote: "Internal pilot record."
          },
          outreach: {
            status: "pilot_active",
            count: 1,
            lastContactedAt: createdAt,
            lastChannel: "WhatsApp",
            pilotStatus: "active"
          },
          matchingSignals: {
            sellerFit: 86,
            buyerFit: 62,
            referralFit: 82,
            servicePulseAvg: 9,
            responseReliability: 82,
            capacity: "medium"
          }
        },
        {
          id: "network-lebo-naidoo",
          agentName: "Lebo Naidoo",
          agencyName: "Axiom Realty AI Demo Agency",
          branchName: "KwaZulu-Natal Branch",
          provinceId: "kwazulu-natal",
          towns: ["Durban North", "Umhlanga", "Ballito"],
          suburbs: ["Durban North", "Umhlanga"],
          specialties: ["buyer progression", "referrals", "commission proof"],
          languages: ["English"],
          independentStatus: "agency_agent",
          ppraStatus: "to_confirm",
          contact: {
            email: "lebo@axiomrealty.co.za",
            mobile: "+27 83 000 0002",
            whatsapp: "+27 83 000 0002",
            website: "https://www.axiomrealty.co.za"
          },
          source: {
            type: "internal_demo",
            name: "Axiom internal pilot",
            url: "https://www.axiomrealty.co.za",
            note: "Seed record for KZN referral coverage.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "business_context",
            whatsappStatus: "not_contacted",
            doNotContact: false,
            lawfulUseNote: "Internal pilot agent; verify WhatsApp opt-in before live tests."
          },
          verification: {
            status: "verified",
            lastVerifiedAt: createdAt,
            verifiedBy: "Axiom",
            reviewNote: "Internal pilot record."
          },
          outreach: {
            status: "invited",
            count: 0,
            lastContactedAt: "",
            lastChannel: "",
            pilotStatus: "awaiting_opt_in"
          },
          matchingSignals: {
            sellerFit: 65,
            buyerFit: 78,
            referralFit: 84,
            servicePulseAvg: 0,
            responseReliability: 70,
            capacity: "to_confirm"
          }
        },
        {
          id: "network-public-cape-specialist",
          agentName: "Public Cape Specialist",
          agencyName: "Public Domain Realty",
          branchName: "Cape Town",
          provinceId: "western-cape",
          towns: ["Cape Town", "Claremont", "Sea Point"],
          suburbs: ["Claremont", "Sea Point"],
          specialties: ["seller mandates", "sectional title", "premium listings"],
          languages: ["English", "Afrikaans"],
          independentStatus: "franchise_or_agency",
          ppraStatus: "to_confirm",
          contact: {
            email: "cape.specialist@example.co.za",
            mobile: "+27 82 111 2233",
            whatsapp: "+27 82 111 2233",
            website: "https://example.co.za/agents/cape-specialist"
          },
          source: {
            type: "public_domain",
            name: "Public agency profile",
            url: "https://example.co.za/agents/cape-specialist",
            note: "Public business profile captured for internal coverage mapping. Verify before outreach.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "not_contacted",
            whatsappStatus: "not_contacted",
            doNotContact: false,
            lawfulUseNote: "Use for internal matching and one-to-one business invitation only after manual review."
          },
          verification: {
            status: "source_found",
            lastVerifiedAt: "",
            verifiedBy: "",
            reviewNote: "Needs human source check before first outreach."
          },
          outreach: {
            status: "not_contacted",
            count: 0,
            lastContactedAt: "",
            lastChannel: "",
            pilotStatus: "candidate"
          },
          matchingSignals: {
            sellerFit: 80,
            buyerFit: 58,
            referralFit: 76,
            servicePulseAvg: 0,
            responseReliability: 50,
            capacity: "unknown"
          }
        }
      ],
      outreachLog: [],
      importBatches: [
        {
          id: "network-batch-seed",
          caseId: "agent-network-seed",
          name: "Seed agent network records",
          sourceType: "manual_seed",
          recordCount: 3,
          acceptedCount: 3,
          rejectedCount: 0,
          createdAt,
          agencyId: "agency-axiom",
          branchId: "branch-cape",
          provinceId: "western-cape"
        }
      ]
    },
    whatsapp: {
      bridge: {
        mode: config.whatsappMode,
        connected: getWhatsappRuntime().liveDeliveryConnected,
        provider: getWhatsappRuntime().provider,
        status: getWhatsappRuntime().status,
        lastHeartbeatAt: createdAt,
        lastProcessedAt: createdAt
      },
      queue: [
        {
          id: "msg-queued-claremont",
          caseId: "case-claremont",
          caseName: "Claremont family home",
          threadId: "thread-claremont",
          category: "seller-update-approval",
          toName: "Aisha Khan",
          toRole: "agent",
          ownerName: "Nadine Smit",
          body: "Seller update ready for Dylan Peters. Reply SEND if you want me to send the concise Friday update to the seller.",
          status: "queued",
          createdAt,
          scheduledFor: createdAt,
          approvalRequired: false
        }
      ],
      threads: [
        {
          id: "thread-claremont",
          caseId: "case-claremont",
          caseName: "Claremont family home",
          participants: ["Aisha Khan", "Dylan Peters", "Nadine Smit"],
          lastAt: createdAt,
          unreadCount: 1,
          messages: [
            {
              id: createOpsId("wa"),
              direction: "inbound",
              author: "Dylan Peters",
              body: "Please keep me posted on the next viewing slot.",
              at: createdAt,
              status: "received"
            }
          ]
        },
        {
          id: "thread-durban",
          caseId: "case-durban",
          caseName: "Durban North referral",
          participants: ["Lebo Naidoo", "Jason Pillay", "Stefan Roodt"],
          lastAt: createdAt,
          unreadCount: 0,
          messages: [
            {
              id: createOpsId("wa"),
              direction: "outbound",
              author: "Axiom",
              body: "Hi Jason. Before we line up the next viewing, I just want to help make the finance side feel cleaner.",
              at: createdAt,
              status: "delivered"
            }
          ]
        }
      ],
      feedbackLog: [
        {
          id: "feedback-claremont",
          property: "Claremont family home",
          buyer: "Naledi Mokoena",
          agent: "Aisha Khan",
          state: "Request queued",
          source: "Axiom",
          note: "A gentle feedback request was queued after the viewing, with a clear no-feedback option.",
          copiedToAgent: true,
          optional: true,
          at: formatOpsTimestamp(createdAt),
          timeMs: Date.parse(createdAt)
        }
      ],
      contactShareLog: [
        {
          id: "contact-durban",
          property: "Durban North referral",
          agentName: "Lebo Naidoo",
          target: "seller",
          targetName: "Megan Reddy",
          at: formatOpsTimestamp(createdAt),
          timeMs: Date.parse(createdAt),
          message:
            "Hi Megan. Your Axiom agent is Lebo Naidoo. Mobile: 083 612 9004. Email: lebo@axiomrealty.co.za. Reach out directly whenever you need clarity."
        }
      ]
    }
  };
}

async function ensureStorage() {
  if (storage) return storage;
  storage = await createStorage(process.env, { dataDir });
  return storage;
}

async function loadState() {
  const store = await ensureStorage();
  const snapshot = await store.loadAll();
  state.leads = Array.isArray(snapshot.leads) ? snapshot.leads : [];
  state.sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  state.auditLog = Array.isArray(snapshot.auditLog) ? snapshot.auditLog : [];
  state.otpChallenges = Array.isArray(snapshot.otpChallenges) ? snapshot.otpChallenges : [];
  const loadedOperations = snapshot.operations;
  const shouldRepairOperations =
    !loadedOperations ||
    typeof loadedOperations !== "object" ||
    Array.isArray(loadedOperations) ||
    !Array.isArray(loadedOperations.organisations) ||
    !Array.isArray(loadedOperations.branches) ||
    !Array.isArray(loadedOperations.partyUsers) ||
    !Array.isArray(loadedOperations.teamMembers) ||
    !Array.isArray(loadedOperations.tasks) ||
    !Array.isArray(loadedOperations.reminders) ||
    !Array.isArray(loadedOperations.escalations) ||
    !Array.isArray(loadedOperations.commissionTimeline) ||
    !Array.isArray(loadedOperations.dealRooms) ||
    !Array.isArray(loadedOperations.servicePulse) ||
    !Array.isArray(loadedOperations.pilotControl?.agents) ||
    !Array.isArray(loadedOperations.pilotControl?.scenarios) ||
    !Array.isArray(loadedOperations.agentNetwork?.directory) ||
    !Array.isArray(loadedOperations.agentNetwork?.importBatches) ||
    !Array.isArray(loadedOperations.whatsapp?.queue) ||
    !Array.isArray(loadedOperations.whatsapp?.threads);
  state.operations = normalizeOperationsShape(loadedOperations);
  pruneExpiredSessions();
  pruneExpiredOtpChallenges();
  if (shouldRepairOperations) {
    await store.saveAll({
      leads: state.leads,
      sessions: state.sessions,
      auditLog: state.auditLog,
      otpChallenges: state.otpChallenges,
      operations: state.operations
    });
  }
}

async function persistState() {
  const store = await ensureStorage();
  await store.saveAll({
    leads: state.leads,
    sessions: state.sessions,
    auditLog: state.auditLog,
    otpChallenges: state.otpChallenges,
    operations: state.operations
  });
}

function pruneExpiredSessions() {
  const now = Date.now();
  state.sessions = state.sessions.filter((session) => {
    const expiresAt = new Date(session.expiresAt || 0).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function pruneExpiredOtpChallenges() {
  const now = Date.now();
  state.otpChallenges = state.otpChallenges.filter((challenge) => {
    const expiresAt = new Date(challenge.expiresAt || 0).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function audit(event, details = {}) {
  state.auditLog.unshift({
    id: randomBytes(8).toString("hex"),
    event,
    details,
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(0, 500);
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header.split(";").reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getSessionFromRequest(request) {
  pruneExpiredSessions();
  const cookies = parseCookies(request);
  const token = cookies[missionControlCookie];
  if (!token) return null;
  const tokenHash = hashSecret(token);
  const session = state.sessions.find((entry) => safeEquals(entry.tokenHash, tokenHash));
  return session ? normalizeSessionRecord(session) : null;
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  response.end(text);
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getLlmRuntime() {
  const provider = ["nvidia", "openai"].includes(config.llmProvider) ? config.llmProvider : "none";
  const providerConfig =
    provider === "nvidia"
      ? {
          provider,
          apiKey: config.nvidiaApiKey,
          baseUrl: config.nvidiaBaseUrl,
          model: config.nvidiaModel,
          fallbackModel: config.nvidiaFallbackModel
        }
      : provider === "openai"
        ? {
            provider,
            apiKey: config.openaiApiKey,
            baseUrl: config.openaiBaseUrl,
            model: config.openaiModel,
            fallbackModel: ""
          }
        : {
            provider: "none",
            apiKey: "",
            baseUrl: "",
            model: "",
            fallbackModel: ""
          };

  let endpointHost = "";
  try {
    endpointHost = providerConfig.baseUrl ? new URL(providerConfig.baseUrl).host : "";
  } catch {
    endpointHost = "invalid-url";
  }

  return {
    ...providerConfig,
    endpointHost,
    ready: Boolean(providerConfig.apiKey && providerConfig.baseUrl && providerConfig.model)
  };
}

function getLlmStatus() {
  const runtime = getLlmRuntime();
  return {
    provider: runtime.provider,
    model: runtime.model || null,
    fallbackModel: runtime.fallbackModel || null,
    endpointHost: runtime.endpointHost || null,
    ready: runtime.ready,
    status: runtime.ready ? "ready_for_live_llm" : `workflow_ready_needs_${runtime.provider === "none" ? "provider" : `${runtime.provider}_key`}`
  };
}

function truncateForPrompt(value, maxLength = 5000) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n...[truncated]`;
}

async function callLiveLlm(messages, options = {}) {
  const runtime = getLlmRuntime();
  if (!runtime.ready) {
    const error = new Error("Live LLM is not configured.");
    error.statusCode = 503;
    throw error;
  }
  if (typeof fetch !== "function") {
    const error = new Error("This Node runtime does not expose fetch for LLM calls.");
    error.statusCode = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, Number(options.timeoutMs || 20000)));
  const basePayload = {
    messages,
    temperature: Number(options.temperature ?? 0.3),
    top_p: Number(options.topP ?? 0.9),
    max_tokens: Math.max(64, Math.min(4096, Number(options.maxTokens || 700))),
    stream: false
  };

  try {
    async function requestModel(model) {
      const payload = { ...basePayload, model };
      if (runtime.provider === "nvidia" && options.enableThinking && model.includes("nemotron")) {
        payload.extra_body = {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: Math.max(256, Math.min(4096, Number(options.reasoningBudget || 1024)))
        };
      }

      const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const raw = await response.text();
      const parsed = safeJsonParse(raw, {});
      if (!response.ok) {
        const error = new Error(parsed?.error?.message || parsed?.message || `LLM request failed with ${response.status}.`);
        error.statusCode = response.status;
        error.model = model;
        throw error;
      }
      return parsed;
    }

    let parsed;
    try {
      parsed = await requestModel(runtime.model);
    } catch (error) {
      const canFallback =
        runtime.provider === "nvidia" &&
        runtime.fallbackModel &&
        runtime.fallbackModel !== runtime.model &&
        [400, 404, 422, 429, 500, 502, 503, 504].includes(Number(error?.statusCode));
      if (!canFallback) throw error;
      parsed = await requestModel(runtime.fallbackModel);
    }

    const content = parsed?.choices?.[0]?.message?.content || parsed?.choices?.[0]?.delta?.content || "";
    return String(content || "").trim();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("LLM request timed out.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildConciergeSystemPrompt() {
  return [
    "You are Axiom Realty AI's South African estate-agent concierge.",
    "Draft concise, useful WhatsApp or admin messages for real estate leads and live transactions.",
    "Keep the tone calm, premium, direct and human.",
    "Do not overpromise, give legal advice, or claim a formal valuation.",
    "Protect POPIA: use only the supplied context and keep personal data minimal.",
    "When a message affects a client or agent relationship, assume a human approves it before send.",
    "Return only the message text. No markdown heading, no explanation."
  ].join(" ");
}

async function generateConciergeDraft({ purpose, audience, context, fallback, maxTokens = 450 }) {
  const safeFallback = String(fallback || "").trim();
  if (!getLlmRuntime().ready) {
    return {
      text: safeFallback,
      usedLiveLlm: false,
      status: getLlmStatus()
    };
  }

  try {
    const text = await callLiveLlm(
      [
        { role: "system", content: buildConciergeSystemPrompt() },
        {
          role: "user",
          content: [
            `Purpose: ${purpose || "Draft a concierge message."}`,
            `Audience: ${audience || "Axiom internal user or property client."}`,
            "Context:",
            truncateForPrompt(context || {}, 4500),
            "Draft the best next message."
          ].join("\n")
        }
      ],
      { maxTokens, temperature: 0.25, timeoutMs: 18000 }
    );
    return {
      text: text || safeFallback,
      usedLiveLlm: Boolean(text),
      status: getLlmStatus()
    };
  } catch (error) {
    return {
      text: safeFallback,
      usedLiveLlm: false,
      status: getLlmStatus(),
      error: error instanceof Error ? error.message : "LLM draft failed"
    };
  }
}

async function readBody(request, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const body = {};
    for (const [key, value] of params.entries()) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        body[key] = Array.isArray(body[key]) ? [...body[key], value] : [body[key], value];
      } else {
        body[key] = value;
      }
    }
    return body;
  }

  if (contentType.includes("application/json") || contentType === "") {
    return JSON.parse(raw);
  }

  return { raw };
}

function getAnalytics() {
  return getScopedAnalytics();
}

function getScopedAnalytics(sessionOrRole) {
  const visibleLeads = sessionOrRole ? filterVisible(state.leads.map(withScopeDefaults), sessionOrRole) : state.leads;
  const totalLeads = visibleLeads.length;
  const sellerLeads = visibleLeads.filter((lead) => lead.intent === "sell").length;
  const buyerLeads = visibleLeads.filter((lead) => lead.intent === "buy").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = visibleLeads.filter((lead) => new Date(lead.createdAt).getTime() >= todayStart.getTime()).length;

  return {
    totalLeads,
    sellerLeads,
    buyerLeads,
    newToday: todayCount,
    lastLeadAt: visibleLeads[0]?.createdAt || null
  };
}

function summarizeLead(payload) {
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const summary = {};
  for (const answer of answers) {
    if (!answer || !answer.label) continue;
    summary[answer.label] = answer.value || "";
  }
  return summary;
}

function findSummaryValue(summary, labels = []) {
  const entries = Object.entries(summary || {});
  for (const label of labels) {
    const normalizedLabel = String(label).toLowerCase();
    const exact = entries.find(([key]) => String(key).toLowerCase() === normalizedLabel);
    if (exact?.[1]) return String(exact[1]).trim();
    const partial = entries.find(([key]) => String(key).toLowerCase().includes(normalizedLabel));
    if (partial?.[1]) return String(partial[1]).trim();
  }
  return "";
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeContactNumber(value) {
  return String(value || "").trim();
}

function extractLeadContact(payload, summary = summarizeLead(payload)) {
  const rawEmail =
    payload.email ||
    payload.contact?.email ||
    payload.acquisition?.email ||
    findSummaryValue(summary, ["Email", "E-mail", "Client email", "Buyer email", "Seller email"]);
  const rawMobile =
    payload.mobile ||
    payload.phone ||
    payload.whatsapp ||
    payload.contact?.mobile ||
    payload.contact?.phone ||
    payload.contact?.whatsapp ||
    payload.acquisition?.mobile ||
    payload.acquisition?.phone ||
    payload.acquisition?.whatsapp ||
    findSummaryValue(summary, ["Mobile", "Phone", "WhatsApp", "Contact number", "Cell"]);
  const email = normalizeEmail(rawEmail);
  const mobile = normalizeContactNumber(rawMobile);
  const preferred = String(payload.contactPreference || payload.contact?.preferred || payload.acquisition?.preferredContact || "").trim();
  return {
    email,
    mobile,
    whatsapp: mobile,
    preferred: preferred || (mobile ? "WhatsApp" : email ? "Email" : "To confirm"),
    hasEmail: Boolean(email),
    hasMobile: Boolean(mobile),
    bestContact: mobile || email || ""
  };
}

function textContainsAny(value, terms = []) {
  const text = String(value || "").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function hasMoneySignal(value) {
  return /(?:\br\s*)?\d[\d\s,.]*(?:m|mil|million|k|000)?\b/i.test(String(value || ""));
}

function scoreLeadQuality(payload, leadMeta = {}) {
  const answerSummary = summarizeLead(payload);
  const intent = payload.intent === "sell" ? "sell" : "buy";
  const acquisition = payload.acquisition && typeof payload.acquisition === "object" ? payload.acquisition : {};
  const contextText = [
    payload.label,
    payload.additionalInfo,
    acquisition.sourceLabel,
    acquisition.signal,
    acquisition.area,
    ...Object.values(answerSummary)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const clientName = findSummaryValue(answerSummary, ["Client name", "Name", "Buyer name", "Seller name"]);
  const area = findSummaryValue(answerSummary, ["Area", "Suburb", "Location"]) || acquisition.area || "";
  const source = findSummaryValue(answerSummary, ["Source"]) || acquisition.sourceLabel || acquisition.mode || "";
  const urgency = findSummaryValue(answerSummary, ["Urgency signal", "Timeline", "When", "Timeframe"]) || acquisition.signal || "";
  const propertyType = findSummaryValue(answerSummary, ["Property type", "Type", "Unit type"]);
  const budget = findSummaryValue(answerSummary, ["Budget", "Price", "Value", "Price range", "Listing price"]);
  const finance = findSummaryValue(answerSummary, ["Finance", "Bond", "Pre-approval", "Cash", "Deposit"]);
  const contactDetails = extractLeadContact(payload, answerSummary);
  const contact = contactDetails.bestContact || findSummaryValue(answerSummary, ["Email", "Mobile", "Phone", "WhatsApp", "Contact"]);
  const motivation = findSummaryValue(answerSummary, ["Reason", "Motivation", "Why", "Need"]);
  const nonNegotiables = findSummaryValue(answerSummary, ["Non-negotiables", "Requirements", "Must have", "Notes"]);

  const factors = [];
  const missingItems = [];
  let score = 0;

  const addFactor = (name, points, note) => {
    score += points;
    factors.push({ name, points, note });
  };
  const miss = (item) => missingItems.push(item);

  if (clientName) addFactor("Client identified", 8, clientName);
  else miss("Client name");

  if (area) addFactor("Area/suburb known", 14, area);
  else miss(intent === "sell" ? "Property suburb/address" : "Preferred suburb or area");

  if (textContainsAny(urgency || contextText, ["urgent", "asap", "today", "this week", "ready", "immediately", "hot"])) {
    addFactor("Urgency is clear", 18, urgency || "Urgency detected from lead context");
  } else if (urgency || textContainsAny(contextText, ["month", "soon", "viewing", "valuation", "offer"])) {
    addFactor("Timing has a signal", 10, urgency || "Some timing signal detected");
  } else {
    miss(intent === "sell" ? "Selling timeline" : "Buying timeline");
  }

  if (intent === "buy") {
    if (budget || hasMoneySignal(contextText)) addFactor("Budget signal", 16, budget || "Budget/price signal detected");
    else miss("Budget range");

    if (finance || textContainsAny(contextText, ["cash", "bond", "pre-approved", "preapproved", "deposit", "finance", "bank"])) {
      addFactor("Finance readiness", 18, finance || "Finance readiness signal detected");
    } else {
      miss("Finance readiness");
    }

    if (propertyType || textContainsAny(contextText, ["house", "apartment", "flat", "townhouse", "villa", "sectional"])) {
      addFactor("Property need is shaped", 10, propertyType || "Property type detected");
    } else {
      miss("Property type");
    }

    if (nonNegotiables || textContainsAny(contextText, ["bed", "bath", "garage", "school", "security", "pet"])) {
      addFactor("Buyer brief has preference detail", 8, nonNegotiables || "Preference signal detected");
    } else {
      miss("Non-negotiables");
    }
  } else {
    if (budget || hasMoneySignal(contextText)) addFactor("Price/value expectation", 16, budget || "Price/value signal detected");
    else miss("Expected price or valuation need");

    if (propertyType || textContainsAny(contextText, ["house", "apartment", "flat", "townhouse", "villa", "sectional"])) {
      addFactor("Property facts started", 12, propertyType || "Property type detected");
    } else {
      miss("Property type and basic facts");
    }

    if (motivation || textContainsAny(contextText, ["sell", "relocat", "downsize", "upgrade", "valuation", "mandate"])) {
      addFactor("Seller motivation/timing signal", 12, motivation || "Seller motivation detected");
    } else {
      miss("Reason for selling");
    }

    if (textContainsAny(contextText, ["photos", "address", "erf", "stand", "bed", "bath", "condition", "renovated"])) {
      addFactor("Property detail depth", 8, "Extra property detail detected");
    } else {
      miss("Bedrooms, bathrooms, condition and key features");
    }
  }

  if (source) {
    const sourcePoints = textContainsAny(source, ["referral", "whatsapp", "website", "property24", "private property"]) ? 8 : 5;
    addFactor("Source known", sourcePoints, source);
  } else {
    miss("Lead source");
  }

  if (contactDetails.hasMobile || textContainsAny(contextText, ["+27", "whatsapp", "call", "mobile", "phone"])) {
    addFactor("WhatsApp/mobile path exists", 6, contactDetails.mobile || "Mobile signal detected");
  } else if (contactDetails.hasEmail || textContainsAny(contextText, ["@"])) {
    addFactor("Email path exists", 3, contactDetails.email || "Email signal detected");
    miss("Mobile/WhatsApp number");
  } else {
    miss("Mobile/WhatsApp number");
  }

  if (contactDetails.hasEmail) {
    addFactor("Email available for formal updates", 3, contactDetails.email);
  }

  if (contact || textContainsAny(contextText, ["@", "+27", "whatsapp", "call"])) {
    addFactor("Contact path exists", 3, contact || "Contact signal detected");
  } else {
    miss("Contact detail");
  }

  if (score > 100) score = 100;
  const uniqueMissing = unique(missingItems).slice(0, 8);
  let band = "weak";
  if (score >= 80 && uniqueMissing.length <= 2) band = "hot";
  else if (score >= 62) band = "warm";
  else if (score >= 38) band = "nurture";

  const conciergeQuestions = uniqueMissing.slice(0, 5).map((item) => {
    if (item.toLowerCase().includes("finance")) return "Before I pass this to the agent, are you buying cash, pre-approved, or still arranging finance?";
    if (item.toLowerCase().includes("budget")) return "What price range should we keep the search or valuation discussion inside?";
    if (item.toLowerCase().includes("timeline")) return "When would you ideally like to move, sell, view, or make a decision?";
    if (item.toLowerCase().includes("source")) return "Where did this enquiry come from so we can track the source properly?";
    if (item.toLowerCase().includes("contact")) return "What is the best WhatsApp number or email for quick follow-up?";
    if (item.toLowerCase().includes("suburb") || item.toLowerCase().includes("address")) return "Which suburb or property address should the agent focus on?";
    return `Please confirm: ${item}.`;
  });

  const handoffReady = (band === "hot" || band === "warm") && uniqueMissing.length <= 3;
  const briefCard = {
    title: `${intent === "sell" ? "Seller" : "Buyer"} brief card`,
    leadId: leadMeta.id || null,
    clientName: clientName || "Client to confirm",
    intent,
    area: area || "Area to confirm",
    source: source || "Source to confirm",
    urgency: urgency || "Timeline to confirm",
    score,
    band,
    handoffStage: handoffReady ? "Ready for agent handoff" : "Concierge follow-up needed",
    headline: handoffReady
      ? "Concierge has enough context for a focused first agent conversation."
      : "Keep this with the concierge until the missing brief items are closed.",
    knownFacts: factors.map((factor) => `${factor.name}: ${factor.note}`).slice(0, 7),
    missingItems: uniqueMissing,
    conciergeQuestions,
    agentHandoffSummary:
      `${intent === "sell" ? "Seller" : "Buyer"} lead for ${clientName || "client"} in ${area || "area to confirm"}. ` +
      `Quality band: ${band}. ${handoffReady ? "Pass to agent with current brief." : "Concierge should complete missing items before handoff."}`,
    riskNotes: uniqueMissing.length
      ? [`Missing ${uniqueMissing.slice(0, 3).join(", ")} before the first agent call is fully clean.`]
      : ["No major brief gaps detected."]
  };

  return {
    score,
    band,
    handoffReady,
    factors,
    missingItems: uniqueMissing,
    conciergeQuestions,
    conciergeAction: handoffReady
      ? "Send the brief card to the assigned agent and keep concierge follow-up available."
      : `Ask ${Math.min(uniqueMissing.length, 5)} concierge follow-up question${uniqueMissing.length === 1 ? "" : "s"} before handoff.`,
    briefCard
  };
}

function createLeadRecord(payload) {
  const leadId = `AX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const leadQuality = scoreLeadQuality(payload, { id: leadId });
  const answerSummary = summarizeLead(payload);
  const contact = extractLeadContact(payload, answerSummary);
  const scoped = withScopeDefaults({
    id: leadId,
    caseId: leadId,
    caseName: String(payload.label || "").trim() || "Property enquiry",
    agencyId: payload.agencyId || payload.acquisition?.agencyId,
    branchId: payload.branchId || payload.acquisition?.branchId,
    provinceId: payload.provinceId || payload.acquisition?.provinceId || payload.acquisition?.province,
    agentId: payload.agentId || payload.acquisition?.agentId,
    assignedAgentId: payload.assignedAgentId || payload.agentId || payload.acquisition?.agentId
  });
  return {
    ...scoped,
    id: leadId,
    caseId: leadId,
    intent: payload.intent === "sell" ? "sell" : "buy",
    label: String(payload.label || "").trim() || "Property enquiry",
    createdAt: now,
    updatedAt: now,
    additionalInfo: String(payload.additionalInfo || "").trim(),
    answers: Array.isArray(payload.answers) ? payload.answers : [],
    answerSummary,
    contact,
    leadQuality,
    briefCard: leadQuality.briefCard,
    acquisition: payload.acquisition && typeof payload.acquisition === "object" ? payload.acquisition : {},
    status: "new"
  };
}

function buildPublicIntakeOutcome(lead) {
  const quality = lead.leadQuality || {};
  const briefCard = lead.briefCard || {};
  const contact = lead.contact || {};
  const clientName = briefCard.clientName || lead.answerSummary?.["Client name"] || "there";
  const area = briefCard.area || lead.acquisition?.area || lead.answerSummary?.Area || "your area";
  const isSeller = lead.intent === "sell";
  const hasWhatsapp = Boolean(contact.hasMobile || contact.mobile);
  const hasEmail = Boolean(contact.hasEmail || contact.email);
  const preferredRoute = hasWhatsapp ? "WhatsApp first" : hasEmail ? "Email follow-up" : "Direct follow-up";
  const followUpWindow = quality.handoffReady
    ? "A specialist can now step in with a cleaner brief. Target follow-up: within 3 working hours."
    : "The concierge will first close the missing brief items so the first specialist conversation starts properly.";

  return {
    title: isSeller ? `Seller brief received for ${clientName}.` : `Buyer brief received for ${clientName}.`,
    summary: quality.handoffReady
      ? `Axiom has enough context to move this ${isSeller ? "sale" : "search"} forward with a cleaner first handover.`
      : `Axiom has the request and may ask one or two quick follow-up questions before the handover is made.`,
    reference: lead.id,
    routeLabel: preferredRoute,
    followUpWindow,
    nextStep: quality.conciergeAction || "Concierge follow-up in progress.",
    band: quality.band || "unscored",
    score: quality.score || 0,
    handoffReady: Boolean(quality.handoffReady),
    clientName,
    area,
    intent: lead.intent,
    missingItems: Array.isArray(quality.missingItems) ? quality.missingItems.slice(0, 3) : [],
    knownFacts: Array.isArray(briefCard.knownFacts) ? briefCard.knownFacts.slice(0, 4) : [],
  };
}

function buildWhatsappClickLink(mobile, body) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`;
}

function normalizeWhatsappProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "managed-simulation";
  if (["meta", "meta-cloud", "cloud", "cloud-api", "whatsapp-cloud"].includes(normalized)) return "meta-cloud";
  if (["twilio", "twilio-whatsapp", "twilio-sandbox"].includes(normalized)) return "twilio";
  if (["test", "preview", "manual", "simulation", "managed-simulation"].includes(normalized)) return "managed-simulation";
  return normalized;
}

function normalizeWhatsappRecipient(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
}

function formatWhatsappE164(value) {
  const normalized = normalizeWhatsappRecipient(value);
  return normalized ? `+${normalized}` : "";
}

function formatTwilioWhatsappAddress(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase().startsWith("whatsapp:")) return normalized;
  const e164 = formatWhatsappE164(normalized);
  return e164 ? `whatsapp:${e164}` : "";
}

function getTwilioWebhookUrl() {
  const configured = String(config.twilioStatusCallbackUrl || "").trim();
  if (configured) return configured;
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/api/webhooks/twilio/whatsapp`;
  }
  return "";
}

function getWhatsappRuntime() {
  const provider = normalizeWhatsappProvider(config.whatsappProvider || config.whatsappMode);
  const missing = [];

  if (provider === "meta-cloud") {
    if (!config.whatsappPhoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!config.whatsappAccessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  }

  if (provider === "twilio") {
    if (!config.twilioAccountSid) missing.push("TWILIO_ACCOUNT_SID");
    if (!config.twilioAuthToken) missing.push("TWILIO_AUTH_TOKEN");
    if (!config.twilioWhatsappFromNumber) missing.push("TWILIO_WHATSAPP_FROM_NUMBER");
  }

  const liveDeliveryConnected = ["meta-cloud", "twilio"].includes(provider) && missing.length === 0;
  const manualTestReady = !liveDeliveryConnected;

  return {
    mode: config.whatsappMode,
    provider,
    liveDeliveryConnected,
    realDeliveryConnected: liveDeliveryConnected,
    manualTestReady,
    missing,
    canGenerateClickLinks: true,
    fromNumber:
      provider === "twilio"
        ? config.twilioWhatsappFromNumber || config.whatsappFromNumber || null
        : config.whatsappFromNumber || null,
    status: liveDeliveryConnected
      ? provider === "twilio"
        ? "Twilio WhatsApp delivery is connected."
        : "Real WhatsApp Cloud API delivery is connected."
      : provider === "meta-cloud"
        ? `Meta Cloud API is selected but still missing ${missing.join(", ")}.`
        : provider === "twilio"
          ? `Twilio WhatsApp is selected but still missing ${missing.join(", ")}.`
        : "Managed simulation is active. Messages are queued, stored, and available as WhatsApp click links for testing."
  };
}

function getOtpRuntime(whatsappRuntime = getWhatsappRuntime()) {
  const provider = String(config.otpProvider || "preview").trim().toLowerCase();
  const liveDeliveryConnected = provider === "whatsapp" && whatsappRuntime.liveDeliveryConnected;
  const previewEnabled = Boolean(config.otpPreviewEnabled);
  const missing =
    provider === "whatsapp" && !whatsappRuntime.liveDeliveryConnected
      ? whatsappRuntime.missing.length
        ? whatsappRuntime.missing
        : ["Set WHATSAPP_PROVIDER=meta-cloud for OTP delivery"]
      : [];

  return {
    provider,
    previewEnabled,
    liveDeliveryConnected,
    missing,
    status: liveDeliveryConnected
      ? "OTP can be delivered through WhatsApp."
      : previewEnabled
        ? "OTP preview is active for controlled testing."
        : "OTP delivery is not connected yet; access-key fallback remains available."
  };
}

function getEmailRuntime() {
  const provider = String(config.emailProvider || "none").trim().toLowerCase();
  return {
    provider,
    from: config.emailFrom || null,
    liveDeliveryConnected: false,
    status:
      provider === "none"
        ? "Email delivery is not connected yet."
        : "Email provider setting is present, but live email sending has not been wired into this build yet."
  };
}

function getOperationalReadiness(storageDiagnostics = null) {
  const whatsapp = getWhatsappRuntime();
  const otp = getOtpRuntime(whatsapp);
  const email = getEmailRuntime();
  const storageMode = storageDiagnostics?.mode || "unknown";
  const storageReady = Boolean(storageDiagnostics?.connected);
  const llm = getLlmStatus();

  return {
    generatedAt: new Date().toISOString(),
    publicIntake: {
      status: "ready",
      detail: "Buyer and seller intake can create leads, score them, build brief cards, and queue acknowledgements."
    },
    storage: {
      status: storageReady ? (storageMode === "postgres" ? "database_ready" : "file_storage_ready") : "check_required",
      mode: storageMode,
      detail: storageDiagnostics?.detail || "Storage diagnostics not loaded for this request."
    },
    whatsapp: {
      status: whatsapp.liveDeliveryConnected ? "live_delivery_connected" : "manual_test_ready",
      provider: whatsapp.provider,
      missing: whatsapp.missing,
      detail: whatsapp.status
    },
    otp: {
      status: otp.liveDeliveryConnected ? "live_delivery_connected" : otp.previewEnabled ? "preview_ready" : "fallback_only",
      provider: otp.provider,
      missing: otp.missing,
      detail: otp.status
    },
    email: {
      status: email.liveDeliveryConnected ? "live_delivery_connected" : "not_connected",
      provider: email.provider,
      detail: email.status
    },
    llm: {
      status: llm.ready ? "ready" : "needs_key_or_provider",
      provider: llm.provider,
      model: llm.model
    },
    nextProductionBlocks: [
      !whatsapp.liveDeliveryConnected && "Connect a live WhatsApp provider such as Twilio or Meta Cloud API for automatic WhatsApp delivery.",
      !otp.liveDeliveryConnected && "Decide whether OTP must be sent by WhatsApp before production sign-ons.",
      storageMode !== "postgres" && "Keep Postgres active on Render for durable multi-user operations.",
      !email.liveDeliveryConnected && "Add email delivery before formal PDF/report packs are emailed automatically."
    ].filter(Boolean)
  };
}

async function sendMetaWhatsappText(item) {
  const to = normalizeWhatsappRecipient(item.toContact || item.toNumber || "");
  if (!to) {
    return {
      ok: false,
      status: "send_failed",
      error: "No WhatsApp/mobile number is stored on this queue item."
    };
  }
  if (typeof fetch !== "function") {
    return {
      ok: false,
      status: "send_failed",
      error: "This Node runtime cannot make outbound fetch requests."
    };
  }

  const url = `${config.whatsappApiBaseUrl}/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: item.body
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: "send_failed",
      providerStatus: response.status,
      error: payload?.error?.message || `Meta WhatsApp API returned ${response.status}.`
    };
  }
  return {
    ok: true,
    status: "delivered",
    providerMessageId: payload?.messages?.[0]?.id || null,
    providerStatus: response.status
  };
}

async function sendTwilioWhatsappText(item) {
  const to = formatTwilioWhatsappAddress(item.toContact || item.toNumber || "");
  if (!to) {
    return {
      ok: false,
      status: "send_failed",
      error: "No WhatsApp/mobile number is stored on this queue item."
    };
  }
  if (typeof fetch !== "function") {
    return {
      ok: false,
      status: "send_failed",
      error: "This Node runtime cannot make outbound fetch requests."
    };
  }

  const from = formatTwilioWhatsappAddress(config.twilioWhatsappFromNumber || config.whatsappFromNumber);
  if (!from) {
    return {
      ok: false,
      status: "send_failed",
      error: "TWILIO_WHATSAPP_FROM_NUMBER is not configured."
    };
  }

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("From", from);
  params.set("Body", item.body);
  const statusCallback = getTwilioWebhookUrl();
  if (statusCallback) {
    params.set("StatusCallback", statusCallback);
  }

  const credentials = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const url = `${config.twilioApiBaseUrl}/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: "send_failed",
      providerStatus: response.status,
      error: payload?.message || payload?.detail || `Twilio API returned ${response.status}.`
    };
  }

  const providerStatus = String(payload?.status || "").toLowerCase();
  return {
    ok: true,
    status: ["queued", "accepted", "scheduled", "sending"].includes(providerStatus) ? "queued" : "delivered",
    providerMessageId: payload?.sid || null,
    providerStatus: payload?.status || response.status,
    note: payload?.error_message || ""
  };
}

async function deliverWhatsappQueueItem(item, runtime = getWhatsappRuntime()) {
  if (!runtime.liveDeliveryConnected) {
    const manualLink = buildWhatsappClickLink(item.toContact, item.body);
    return {
      ok: true,
      status: "manual_test_ready",
      deliveryMode: "manual_test",
      manualLink,
      note: runtime.status
    };
  }

  if (runtime.provider === "meta-cloud") {
    const result = await sendMetaWhatsappText(item);
    return {
      ...result,
      deliveryMode: "meta-cloud"
    };
  }

  if (runtime.provider === "twilio") {
    const result = await sendTwilioWhatsappText(item);
    return {
      ...result,
      deliveryMode: "twilio"
    };
  }

  return {
    ok: false,
    status: "send_failed",
    deliveryMode: runtime.provider,
    error: `Unsupported WhatsApp provider: ${runtime.provider}.`
  };
}

async function processWhatsappQueueItem(item, runtime = getWhatsappRuntime()) {
  const deliveredAt = nowIso();
  const result = await deliverWhatsappQueueItem(item, runtime);
  item.status = result.status;
  item.deliveryMode = result.deliveryMode;
  item.deliveryNote = result.note || result.error || "";
  item.manualLink = result.manualLink || item.manualLink || "";
  item.providerStatus = result.providerStatus || null;
  item.providerMessageId = result.providerMessageId || null;
  item.processedAt = deliveredAt;
  if (result.status === "delivered") {
    item.deliveredAt = deliveredAt;
  }

  const thread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: result.status === "delivered" ? "outbound" : "system",
    author: item.ownerName || "Axiom",
    body:
      result.status === "manual_test_ready"
        ? `${item.category} is ready for manual WhatsApp testing.${result.manualLink ? ` Link: ${result.manualLink}` : " Add a mobile number before sending."}`
        : result.status === "delivered"
          ? item.body
          : `${item.category} could not be sent: ${result.error || "delivery failed"}`,
    at: deliveredAt,
    status: result.status,
    deliveryMode: result.deliveryMode
  });

  return {
    id: item.id,
    caseId: item.caseId,
    toName: item.toName,
    status: item.status,
    deliveryMode: item.deliveryMode,
    manualLink: item.manualLink || "",
    error: result.error || ""
  };
}

function authPayloadForRole(role, sessionOrIdentity = {}) {
  const normalizedRole = normalizeRole(typeof role === "object" ? role.role : role);
  const profile = getRoleProfile(normalizedRole);
  const identity = normalizeSessionIdentity(normalizedRole, sessionOrIdentity, sessionOrIdentity?.contact);
  return {
    authenticated: true,
    role: normalizedRole,
    roleLabel: profile.label,
    allowedViews: profile.allowedViews,
    workspaceTabs: profile.workspaceTabs,
    permissions: profile.permissions,
    permissionLabels: getPermissionLabels(profile.permissions),
    accessNote: profile.accessNote,
    identity: {
      userId: identity.userId,
      name: identity.name,
      contact: identity.contact,
      agencyId: identity.agencyId,
      branchId: identity.branchId,
      provinceId: identity.provinceId
    },
    scope: identity.scope
  };
}

async function createAuthenticatedSession(response, role, authEvent, authDetails = {}) {
  const normalizedRole = normalizeRole(role);
  const identity = normalizeSessionIdentity(normalizedRole, authDetails.identity || {}, authDetails.contact);
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000).toISOString();

  state.sessions = state.sessions.filter((session) => {
    return !(session.role === normalizedRole && session.userId === identity.userId);
  });
  state.sessions.push({
    id: randomBytes(8).toString("hex"),
    role: normalizedRole,
    userId: identity.userId,
    name: identity.name,
    contact: identity.contact,
    agencyId: identity.agencyId,
    branchId: identity.branchId,
    provinceId: identity.provinceId,
    scope: identity.scope,
    tokenHash: hashSecret(token),
    createdAt: new Date().toISOString(),
    expiresAt
  });
  audit(authEvent, { role: normalizedRole, userId: identity.userId, agencyId: identity.agencyId, branchId: identity.branchId, provinceId: identity.provinceId, ...authDetails });
  await persistState();

  sendJson(
    response,
    200,
    {
      ok: true,
      expiresAt,
      ...authPayloadForRole(normalizedRole, identity)
    },
    {
      "Set-Cookie": buildCookie(missionControlCookie, token, {
        maxAge: config.sessionHours * 60 * 60,
        secure: config.cookieSecure
      })
    }
  );
}

async function handleLogin(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact || getRoleSigninContact(role));
  const identity = findIdentityForSignin(role, contact);
  const submittedKey = String(body.key || "").trim();
  const expectedKey = getRoleKey(role);

  if (!identity) {
    audit("mission-control-login-failed", { role, contact, reason: "identity-missing" });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} route.`
    });
    return;
  }

  if (!submittedKey || !expectedKey || !safeAccessKeyEquals(submittedKey, expectedKey)) {
    audit("mission-control-login-failed", { role });
    sendJson(response, 401, {
      ok: false,
      error:
        role === "agent"
          ? "Agent workspace fallback key not recognised on this build."
          : role === "office_admin"
            ? "Office admin fallback key not recognised on this build."
            : "Principal fallback key not recognised on this build."
    });
    return;
  }

  await createAuthenticatedSession(response, role, "mission-control-login", { method: "legacy-key", contact, identity });
}

async function handleRequestOtp(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact);
  const identity = findIdentityForSignin(role, contact);

  if (!contact) {
    sendJson(response, 400, { ok: false, error: "Enter the mobile number or email linked to this role." });
    return;
  }

  if (!identity) {
    audit("mission-control-otp-request-failed", { role, contact });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} sign-in route on this build.`
    });
    return;
  }

  const code = createOtpCode();
  const expiresAt = new Date(Date.now() + config.otpMinutes * 60 * 1000).toISOString();
  const challengeId = randomBytes(8).toString("hex");

  pruneExpiredOtpChallenges();
  state.otpChallenges = state.otpChallenges.filter((challenge) => {
    return !(challenge.role === role && challenge.contact === contact);
  });
  state.otpChallenges.push({
    id: challengeId,
    role,
    contact,
    userId: identity.userId,
    codeHash: hashSecret(code),
    createdAt: new Date().toISOString(),
    expiresAt
  });
  audit("mission-control-otp-requested", { role, contact });
  await persistState();

  sendJson(response, 200, {
    ok: true,
    challengeId,
    role,
    contact,
    expiresAt,
    deliveryTarget: contact,
    otpLength: 6,
    devCodePreview: config.otpPreviewEnabled ? code : undefined,
    message:
      config.otpPreviewEnabled
        ? "A one-time code has been generated for this test build."
        : "A one-time code has been generated. Use the configured access key fallback until an OTP sender is connected."
  });
}

async function handleVerifyOtp(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact);
  const code = String(body.code || "").trim();
  const identity = findIdentityForSignin(role, contact);

  pruneExpiredOtpChallenges();

  if (!contact || !code) {
    sendJson(response, 400, { ok: false, error: "Enter both the contact detail and the one-time code." });
    return;
  }

  if (!identity) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "identity-missing" });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} route.`
    });
    return;
  }

  const expectedKey = getRoleKey(role);
  if (expectedKey && safeAccessKeyEquals(code, expectedKey)) {
    state.otpChallenges = state.otpChallenges.filter((entry) => !(entry.role === role && entry.contact === contact));
    await createAuthenticatedSession(response, role, "mission-control-login", {
      method: "access-key-fallback",
      contact,
      identity
    });
    return;
  }

  const challenge = state.otpChallenges.find((entry) => entry.role === role && entry.contact === contact && entry.userId === identity.userId);
  if (!challenge) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "challenge-missing" });
    sendJson(response, 401, { ok: false, error: "That sign-in code has expired or was not requested yet." });
    return;
  }

  if (!safeEquals(challenge.codeHash, hashSecret(code))) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "code-mismatch" });
    sendJson(response, 401, { ok: false, error: "That one-time code is not correct." });
    return;
  }

  state.otpChallenges = state.otpChallenges.filter((entry) => entry.id !== challenge.id);
  await createAuthenticatedSession(response, role, "mission-control-login", {
    method: "otp",
    contact,
    identity
  });
}

function handleSession(request, response) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendJson(response, 200, { ok: true, authenticated: false });
    return;
  }
  sendJson(response, 200, {
    ok: true,
    expiresAt: session.expiresAt,
    ...authPayloadForRole(session.role, session)
  });
}

async function handleLogout(request, response) {
  const session = getSessionFromRequest(request);
  if (session) {
    state.sessions = state.sessions.filter((item) => item.id !== session.id);
    audit("mission-control-logout", { role: session.role });
    await persistState();
  }
  sendJson(
    response,
    200,
    { ok: true },
    { "Set-Cookie": buildCookie(missionControlCookie, "", { maxAge: 0, secure: config.cookieSecure }) }
  );
}

function requireSession(request, response, roles = Object.keys(accessProfiles)) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendJson(response, 401, { ok: false, error: "Mission Control sign-in required" });
    return null;
  }

  const normalizedRoles = roles.map(normalizeRole);
  if (!normalizedRoles.includes(session.role)) {
    sendJson(response, 403, { ok: false, error: "You do not have permission for this action." });
    return null;
  }
  return session;
}

function requirePermission(request, response, permissions, roles) {
  const session = requireSession(request, response, roles);
  if (!session) return null;

  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  if (!hasAnyPermission(session.role, requiredPermissions)) {
    sendJson(response, 403, { ok: false, error: "You do not have permission for this action." });
    return null;
  }

  return session;
}

function getOperationsState() {
  state.operations = normalizeOperationsShape(state.operations);
  return state.operations;
}

function getRequestOrigin(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").trim();
  const proto = forwardedProto || "http";
  const host = String(request.headers.host || `${config.host}:${config.port}`).trim();
  return `${proto}://${host}`;
}

function findTeamMemberByName(name) {
  const operations = getOperationsState();
  return operations.teamMembers.find((member) => member.name === name) || null;
}

function ensureThread(caseId, caseName, participants = []) {
  const operations = getOperationsState();
  let thread = operations.whatsapp.threads.find((entry) => entry.caseId === caseId);
  if (!thread) {
    thread = {
      id: `thread-${caseId}`,
      caseId,
      caseName,
      participants,
      lastAt: nowIso(),
      unreadCount: 0,
      messages: []
    };
    operations.whatsapp.threads.unshift(thread);
  }
  return thread;
}

function addThreadMessage(thread, message) {
  thread.messages.push(message);
  thread.lastAt = message.at;
  if (message.direction === "inbound") {
    thread.unreadCount += 1;
  }
}

function queueWhatsappMessage(payload) {
  const operations = getOperationsState();
  const createdAt = nowIso();
  const item = {
    id: createOpsId("msg"),
    caseId: payload.caseId || "general",
    caseName: payload.caseName || "Office update",
    threadId: payload.threadId || `thread-${payload.caseId || "general"}`,
    category: payload.category || "general",
    toName: payload.toName || "Unknown",
    toRole: payload.toRole || "contact",
    toContact: payload.toContact || payload.toNumber || "",
    ownerName: payload.ownerName || "Axiom",
    body: String(payload.body || "").trim(),
    status: payload.approvalRequired ? "awaiting_approval" : "queued",
    deliveryMode: "pending",
    createdAt,
    scheduledFor: payload.scheduledFor || createdAt,
    approvalRequired: Boolean(payload.approvalRequired),
    agencyId: payload.agencyId,
    branchId: payload.branchId,
    provinceId: payload.provinceId,
    agentId: payload.agentId,
    assignedAgentId: payload.assignedAgentId || payload.agentId
  };
  operations.whatsapp.queue.unshift(item);
  audit("whatsapp-queued", {
    caseName: item.caseName,
    toName: item.toName,
    category: item.category
  });
  return item;
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || "unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildScopedRollups(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleServicePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleLeads = filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);

  return {
    agencies: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "agencyId"),
    branches: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "branchId"),
    provinces: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "provinceId"),
    agents: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "agentId"),
    totals: {
      leads: visibleLeads.length,
      tasks: visibleTasks.length,
      protectedDeals: visibleCommission.length,
      dealRooms: visibleDealRooms.length,
      servicePulse: visibleServicePulse.length
    }
  };
}

function normalizeLeadSource(lead = {}) {
  const sourceText = [
    lead.acquisition?.sourceLabel,
    lead.acquisition?.mode,
    lead.answerSummary?.Source,
    lead.source,
    lead.additionalInfo
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("google") || sourceText.includes("gclid") || sourceText.includes("paid")) return "google_ads";
  if (sourceText.includes("whatsapp")) return "whatsapp";
  if (sourceText.includes("property24") || sourceText.includes("private property") || sourceText.includes("portal")) return "portal";
  if (sourceText.includes("referral") || sourceText.includes("referred")) return "referral";
  if (sourceText.includes("csv") || sourceText.includes("list")) return "lead_list";
  if (sourceText.includes("email") || sourceText.includes("forward")) return "forwarded_email";
  if (sourceText.includes("agent") || sourceText.includes("import")) return "agent_import";
  if (sourceText.includes("website") || sourceText.includes("form")) return "website";
  return "other";
}

function sourceLabelForKey(sourceKey) {
  return {
    google_ads: "Google Ads",
    whatsapp: "WhatsApp",
    portal: "Property portal",
    referral: "Referral",
    lead_list: "Lead list",
    forwarded_email: "Forwarded email",
    agent_import: "Agent import",
    website: "Website",
    other: "Other"
  }[sourceKey] || sourceKey;
}

function buildSourceToSaleTracker(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const stages = ["registered", "qualified", "viewing", "offer", "sale", "commissionProtected"];

  const leadRows = visibleLeads.map((lead) => {
    const sourceKey = normalizeLeadSource(lead);
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const relatedCommission = visibleCommission.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const relatedDealRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const relatedThreads = visibleThreads.filter((thread) => thread.caseId === lead.caseId || thread.caseId === lead.id || thread.caseName === lead.label);
    const score = Number(lead.leadQuality?.score || 0);
    const qualified = Boolean(lead.leadQuality?.handoffReady || score >= 62 || relatedTasks.some((task) => /qualif|brief|assign/i.test(task.title || task.category || "")));
    const viewing = relatedTasks.some((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source}`)) ||
      relatedThreads.some((thread) => /viewing/i.test(JSON.stringify(thread.messages || [])));
    const offer = relatedCommission.some((item) => /offer/i.test(`${item.milestone} ${item.referralStatus} ${item.paymentStatus}`));
    const sale = relatedCommission.some((item) => /sale|sold|registered|paid|transfer/i.test(`${item.milestone} ${item.referralStatus} ${item.paymentStatus}`));
    const commissionProtected = relatedCommission.length > 0 || relatedTasks.some((task) => /commission|protect/i.test(`${task.title} ${task.category}`));

    return {
      leadId: lead.id,
      caseId: lead.caseId,
      label: lead.label,
      intent: lead.intent,
      sourceKey,
      sourceLabel: sourceLabelForKey(sourceKey),
      score,
      band: lead.leadQuality?.band || "unscored",
      stages: {
        registered: true,
        qualified,
        viewing,
        offer,
        sale,
        commissionProtected
      },
      nextAction: lead.leadQuality?.conciergeAction || "Concierge to confirm missing brief items.",
      handoffReady: Boolean(lead.leadQuality?.handoffReady),
      missingItems: lead.leadQuality?.missingItems || []
    };
  }).map((row) => {
    const currentStage = stages.reduce((latest, stage) => (row.stages[stage] ? stage : latest), "registered");
    return { ...row, currentStage };
  });

  const bySource = {};
  for (const row of leadRows) {
    bySource[row.sourceKey] ||= {
      sourceKey: row.sourceKey,
      sourceLabel: row.sourceLabel,
      leads: 0,
      registered: 0,
      qualified: 0,
      viewing: 0,
      offer: 0,
      sale: 0,
      commissionProtected: 0,
      totalScore: 0,
      avgScore: 0
    };
    const bucket = bySource[row.sourceKey];
    bucket.leads += 1;
    bucket.totalScore += row.score;
    for (const stage of stages) {
      if (row.stages[stage]) bucket[stage] += 1;
    }
    bucket.avgScore = Math.round(bucket.totalScore / bucket.leads);
  }

  return {
    stages,
    rows: leadRows,
    bySource: Object.values(bySource).map(({ totalScore, ...bucket }) => bucket),
    summary: {
      totalLeads: leadRows.length,
      qualified: leadRows.filter((row) => row.stages.qualified).length,
      viewing: leadRows.filter((row) => row.stages.viewing).length,
      offer: leadRows.filter((row) => row.stages.offer).length,
      sale: leadRows.filter((row) => row.stages.sale).length,
      commissionProtected: leadRows.filter((row) => row.stages.commissionProtected).length
    }
  };
}

function buildSellerDemandSnapshots(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const sellerLeads = visibleLeads.filter((lead) => lead.intent === "sell");
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const visibleFeedback = visible.feedbackLog || filterVisible(operations.whatsapp.feedbackLog, sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);

  return sellerLeads.map((lead) => {
    const area = lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm";
    const contextText = [
      lead.additionalInfo,
      lead.acquisition?.signal,
      lead.acquisition?.sourceLabel,
      JSON.stringify(lead.answerSummary || {})
    ].join(" ").toLowerCase();
    const relatedThreads = visibleThreads.filter((thread) => thread.caseId === lead.caseId || thread.caseId === lead.id || thread.caseName === lead.label);
    const relatedFeedback = visibleFeedback.filter((item) => {
      return item.caseId === lead.caseId || item.caseId === lead.id || String(item.property || "").toLowerCase().includes(area.toLowerCase());
    });
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const relatedRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const enquiryCount = Math.max(1, relatedThreads.length + relatedTasks.filter((task) => /lead|enquir|buyer|view/i.test(`${task.title} ${task.category}`)).length);
    const viewingCount = relatedTasks.filter((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source}`)).length;
    const feedbackNotes = relatedFeedback.map((item) => item.note || item.state).filter(Boolean);
    const buyerType = textContainsAny(contextText, ["cash"]) ? "Cash buyer interest" :
      textContainsAny(contextText, ["bond", "finance", "pre-approved", "preapproved"]) ? "Bond buyer interest" :
        textContainsAny(contextText, ["investor"]) ? "Investor interest" : "Buyer type still being qualified";
    const priceSensitivity = textContainsAny(contextText, ["price", "expensive", "sensitive", "offer", "negotiate", "below"]) ?
      "Price sensitivity detected" :
      lead.leadQuality?.missingItems?.some((item) => /price|value|valuation/i.test(item)) ? "Price expectation still needs confirmation" : "No strong price objection logged yet";
    const suburbDemand = enquiryCount >= 3 || textContainsAny(contextText, ["urgent", "hot", "demand", "ready"]) ?
      `${area} demand looks active from current enquiry signals.` :
      `${area} demand is still being built from early signals.`;
    const recommendedNextMove = lead.leadQuality?.handoffReady
      ? "Send the seller a concise demand update and move the agent into the next live conversation."
      : "Let the concierge close the missing seller brief items before sending a confident seller update.";
    const sellerName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "there";
    const sellerMessageDraft =
      `Hi ${sellerName}. A quick, careful update from Axiom: we are still shaping the demand picture for ${area}. ` +
      `Current signal: ${buyerType.toLowerCase()}; ${priceSensitivity.toLowerCase()}. ` +
      `${feedbackNotes.length ? `The latest feedback note is: ${feedbackNotes[0]}. ` : "No viewing feedback has been captured yet. "}` +
      `The sensible next move is: ${recommendedNextMove} We will keep this measured and agent-reviewed before anything formal is sent.`;

    return {
      leadId: lead.id,
      caseId: lead.caseId,
      sellerName: lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "Seller to confirm",
      property: lead.label,
      area,
      enquiryCount,
      buyerType,
      suburbDemand,
      viewingFeedback: feedbackNotes.length ? feedbackNotes.slice(0, 3) : ["No viewing feedback captured yet."],
      viewingCount,
      priceSensitivity,
      recommendedNextMove,
      confidence: lead.leadQuality?.band === "hot" || lead.leadQuality?.band === "warm" ? "Medium" : "Low until concierge fills the missing brief items",
      sourceToSaleStage: "registered",
      dealRoomVisible: relatedRooms.length > 0,
      sellerMessageDraft,
      learningSignals: {
        leadScore: lead.leadQuality?.score || 0,
        leadBand: lead.leadQuality?.band || "unscored",
        buyerType,
        priceSensitivity,
        missingItems: lead.leadQuality?.missingItems || [],
        sourceKey: normalizeLeadSource(lead),
        sourceLabel: sourceLabelForKey(normalizeLeadSource(lead))
      },
      communicationStorage: {
        storedWithCase: true,
        threadCategory: "seller-demand-snapshot",
        approvalRequired: true,
        copiedToAgent: true
      }
    };
  });
}

function quarterKey(value = nowIso()) {
  const date = new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return `${safeDate.getFullYear()}-Q${Math.floor(safeDate.getMonth() / 3) + 1}`;
}

function normalizeServicePulseScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function normalizeServicePulseRole(value) {
  const role = normalizeRole(value);
  return role === "seller" ? "seller" : "buyer";
}

function normalizeServicePulseTouchpoint(value) {
  const key = slugify(value || "");
  if (key.includes("view")) return "post_viewing";
  if (key.includes("seller") || key.includes("weekly") || key.includes("friday")) return "weekly_seller_update";
  if (key.includes("deal") || key.includes("room") || key.includes("progress")) return "deal_room_checkin";
  if (key.includes("close") || key.includes("register") || key.includes("transfer")) return "closing_registration";
  if (key.includes("first") || key.includes("contact")) return "first_contact";
  return "service_checkin";
}

function servicePulseTouchpointLabel(touchpoint) {
  return {
    first_contact: "First contact",
    post_viewing: "Post-viewing check-in",
    weekly_seller_update: "Weekly seller update",
    deal_room_checkin: "Deal Room check-in",
    closing_registration: "Closing / registration",
    service_checkin: "Service check-in"
  }[touchpoint] || "Service check-in";
}

function servicePulseSentiment(score) {
  if (score >= 9) return "delighted";
  if (score >= 7) return "positive";
  if (score >= 5) return "neutral";
  return "recovery";
}

function normalizeServicePulseTags(tags) {
  return unique(ensureArray(tags))
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function findAgentForPulse(payload = {}, room = {}) {
  const operations = getOperationsState();
  const agentId = String(payload.agentId || room.agentId || room.assignedAgentId || "").trim();
  const agentName = String(payload.agentName || room.agentName || "").trim().toLowerCase();
  const scopedRoom = withScopeDefaults(room || {});
  return (
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.id === agentId) ||
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.name.toLowerCase() === agentName) ||
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.id === scopedRoom.agentId) ||
    null
  );
}

function createServicePulseRecord(payload = {}, room = {}) {
  const createdAt = nowIso();
  const score = normalizeServicePulseScore(payload.score);
  const touchpoint = normalizeServicePulseTouchpoint(payload.touchpoint || payload.triggerPoint);
  const agent = findAgentForPulse(payload, room);
  const scopedRoom = withScopeDefaults(room || {});
  const caseName = String(payload.caseName || room.caseName || "Client matter").trim();
  const base = withScopeDefaults({
    caseId: String(payload.caseId || room.caseId || scopedRoom.caseId || slugify(caseName) || createOpsId("case")).trim(),
    caseName,
    agentId: agent?.id || String(payload.agentId || scopedRoom.agentId || "").trim(),
    assignedAgentId: agent?.id || String(payload.agentId || scopedRoom.assignedAgentId || "").trim(),
    agencyId: agent?.agencyId || payload.agencyId || scopedRoom.agencyId,
    branchId: agent?.branchId || payload.branchId || scopedRoom.branchId,
    provinceId: agent?.provinceId || payload.provinceId || scopedRoom.provinceId
  });

  return {
    id: createOpsId("pulse"),
    ...base,
    caseName,
    roomId: String(payload.roomId || room.roomId || "").trim().toUpperCase(),
    agentName: agent?.name || String(payload.agentName || "Assigned agent").trim(),
    respondentRole: normalizeServicePulseRole(payload.respondentRole || payload.role),
    respondentName: String(payload.respondentName || payload.clientName || room.clientName || "Client").trim(),
    touchpoint,
    touchpointLabel: servicePulseTouchpointLabel(touchpoint),
    score,
    sentiment: servicePulseSentiment(score),
    tags: normalizeServicePulseTags(payload.tags),
    comment: String(payload.comment || payload.note || "").trim(),
    source: String(payload.source || "deal_room").trim(),
    usedForMatching: payload.usedForMatching !== false,
    visibility: "internal_scorecard",
    quarter: quarterKey(createdAt),
    learningSignals: {
      triggerPoint: touchpoint,
      recoveryNeeded: score <= 6,
      matchingWeight: score * 10,
      source: String(payload.source || "deal_room").trim()
    },
    createdAt,
    updatedAt: createdAt
  };
}

function storeServicePulseCommunication(record) {
  const operations = getOperationsState();
  const thread = ensureThread(record.caseId, record.caseName, [record.respondentName, record.agentName, "Axiom"]);
  const tagText = record.tags.length ? ` Tags: ${record.tags.join(", ")}.` : "";
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "inbound",
    author: record.respondentName,
    category: "client-service-pulse",
    body: `Service Pulse captured: ${record.score}/10 after ${record.touchpointLabel}. ${record.comment || "No written comment supplied."}${tagText}`,
    at: record.createdAt,
    status: "stored"
  });

  operations.whatsapp.feedbackLog.unshift(
    withScopeDefaults({
      id: createOpsId("feedback"),
      caseId: record.caseId,
      caseName: record.caseName,
      property: record.caseName,
      buyer: record.respondentRole === "buyer" ? record.respondentName : "Buyer not involved",
      seller: record.respondentRole === "seller" ? record.respondentName : "Seller not involved",
      agent: record.agentName,
      agentId: record.agentId,
      state: `${record.score}/10 ${record.sentiment}`,
      source: `Service Pulse - ${record.touchpointLabel}`,
      note: record.comment || `Client gave ${record.score}/10 after ${record.touchpointLabel}.`,
      copiedToAgent: true,
      optional: true,
      category: "client-service-pulse",
      at: formatOpsTimestamp(record.createdAt),
      timeMs: Date.parse(record.createdAt),
      agencyId: record.agencyId,
      branchId: record.branchId,
      provinceId: record.provinceId
    })
  );
}

function averageScore(records) {
  if (!records.length) return 0;
  return Math.round((records.reduce((total, record) => total + Number(record.score || 0), 0) / records.length) * 10) / 10;
}

function topTags(records) {
  const counts = {};
  for (const record of records) {
    for (const tag of record.tags || []) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

function groupServicePulse(records, key) {
  const groups = {};
  for (const record of records) {
    const groupKey = record[key] || "unassigned";
    groups[groupKey] ||= [];
    groups[groupKey].push(record);
  }
  return Object.entries(groups).map(([id, items]) => ({
    id,
    count: items.length,
    avgScore: averageScore(items),
    promoters: items.filter((item) => item.score >= 9).length,
    needsRecovery: items.filter((item) => item.score <= 6).length,
    topTags: topTags(items),
    latestAt: items.map((item) => item.createdAt).sort().at(-1)
  }));
}

function buildServicePulseRollups(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const servicePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const currentQuarter = quarterKey();
  const currentQuarterPulse = servicePulse.filter((record) => record.quarter === currentQuarter);
  const byAgent = groupServicePulse(servicePulse, "agentId").map((group) => {
    const agent = operations.teamMembers.find((member) => member.id === group.id);
    return {
      ...group,
      agentName: agent?.name || servicePulse.find((record) => record.agentId === group.id)?.agentName || "Assigned agent"
    };
  });
  const prizeCandidates = groupServicePulse(currentQuarterPulse, "agentId")
    .map((group) => {
      const agent = operations.teamMembers.find((member) => member.id === group.id);
      return {
        ...group,
        agentName: agent?.name || currentQuarterPulse.find((record) => record.agentId === group.id)?.agentName || "Assigned agent",
        prizeScore: Math.round(group.avgScore * 10 + Math.min(group.count, 10) * 2 - group.needsRecovery * 5)
      };
    })
    .sort((left, right) => right.prizeScore - left.prizeScore || right.avgScore - left.avgScore)
    .slice(0, 5)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    summary: {
      total: servicePulse.length,
      avgScore: averageScore(servicePulse),
      promoters: servicePulse.filter((record) => record.score >= 9).length,
      needsRecovery: servicePulse.filter((record) => record.score <= 6).length,
      currentQuarter,
      currentQuarterCount: currentQuarterPulse.length
    },
    byAgent: byAgent.sort((left, right) => right.avgScore - left.avgScore || right.count - left.count),
    byBranch: groupServicePulse(servicePulse, "branchId"),
    byProvince: groupServicePulse(servicePulse, "provinceId"),
    triggerPoints: groupServicePulse(servicePulse, "touchpoint"),
    recoveryQueue: servicePulse
      .filter((record) => record.score <= 6)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 10),
    quarterlyPrizeCandidates: prizeCandidates
  };
}

function buildAgentMatchingSignals(sessionOrRole, visible = {}, servicePulseRollups = null) {
  const operations = getOperationsState();
  const rollups = servicePulseRollups || buildServicePulseRollups(sessionOrRole, visible);
  const visibleAgents = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);

  const agents = visibleAgents.map((agent) => {
    const pulse = rollups.byAgent.find((item) => item.id === agent.id);
    const agentLeads = visibleLeads.filter((lead) => lead.agentId === agent.id || lead.assignedAgentId === agent.id);
    const scored = agentLeads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
    const avgLeadScore = scored.length ? Math.round(scored.reduce((total, lead) => total + Number(lead.leadQuality.score || 0), 0) / scored.length) : 65;
    const pulseComponent = pulse ? pulse.avgScore * 10 : 72;
    const loadComponent = Math.max(45, 100 - agentLeads.length * 8);
    const matchScore = Math.round(pulseComponent * 0.55 + avgLeadScore * 0.25 + loadComponent * 0.2);
    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      matchScore,
      serviceAvg: pulse?.avgScore || 0,
      serviceCount: pulse?.count || 0,
      needsRecovery: pulse?.needsRecovery || 0,
      activeLeadLoad: agentLeads.length,
      bestFor: pulse?.topTags?.length ? pulse.topTags : ["Needs more service data"],
      guidance: pulse
        ? "Use service pulse history with lead fit, area, load and response pattern before assigning."
        : "Do not over-rank yet. Capture more buyer/seller service pulses first."
    };
  });

  return {
    agents: agents.sort((left, right) => right.matchScore - left.matchScore),
    matchingInputs: ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
    internalOnly: true
  };
}

function buildLeadWhatsappDraft(lead, context = {}) {
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "there";
  const agentName = context.ownerName || "the agent";
  const missingItems = context.missingItems || [];
  if (missingItems.length) {
    return `Hi ${clientName}. I am tightening the brief before ${agentName} follows up properly. Please confirm ${missingItems.slice(0, 2).join(" and ")} when you have a moment.`;
  }
  if (!context.commissionProtected) {
    return `Hi ${agentName}. This lead is ready to move, but please accept the 25% successful-sale-only referral terms before active handover.`;
  }
  if (context.dealRoomNeeded) {
    return `Hi ${clientName}. I can prepare one clean progress view for this matter so updates, next steps and outstanding items sit in one place.`;
  }
  if (context.serviceRecoveryNeeded) {
    return `Hi ${clientName}. I want to make sure the next step is clear and that you feel properly looked after. What would help most right now?`;
  }
  return `Hi ${clientName}. Quick update from Axiom: the brief is clear, the next action is ${context.nextBestAction || "being handled"}, and we will keep the process moving.`;
}

function buildClientIntakeAcknowledgement(lead) {
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "there";
  const area = lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "your area";
  const isSeller = lead.intent === "sell";
  const route = isSeller ? "seller brief" : "buyer brief";
  const nextStep = isSeller
    ? "Axiom will tighten anything missing and route this to the right property specialist. Target follow-up is within 3 working hours."
    : "Axiom will tighten anything missing and route this to the right buying specialist. Target follow-up is within 3 working hours.";
  return `Hi ${clientName}. Thanks, your ${route} for ${area} has been received by Axiom. Reference ${lead.id}. ${nextStep}`;
}

function priorityWeight(priority) {
  return { critical: 4, high: 3, medium: 2, normal: 1, low: 0 }[priority] || 0;
}

function buildLeadActionCentre(sessionOrRole, visible = {}, sourceToSale = null) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visiblePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleTeam = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const tracker = sourceToSale || buildSourceToSaleTracker(sessionOrRole, visible);

  const leadRows = visibleLeads.map((lead) => {
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const commissionItems = visibleCommission.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const dealRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const pulseItems = visiblePulse.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const ownerId = lead.agentId || lead.assignedAgentId || relatedTasks[0]?.ownerId || relatedTasks[0]?.agentId;
    const owner = visibleTeam.find((member) => member.id === ownerId || member.agentId === ownerId) || {};
    const quality = lead.leadQuality || {};
    const missingItems = quality.missingItems || [];
    const score = Number(quality.score || 0);
    const commissionProtected = commissionItems.length > 0;
    const dealRoomNeeded = Boolean(quality.handoffReady && !dealRooms.length);
    const serviceRecoveryNeeded = pulseItems.some((item) => Number(item.score || 0) <= 6);
    const sourceRow = tracker.rows?.find((row) => row.leadId === lead.id);
    const actionReason = missingItems.length
      ? "Brief incomplete"
      : !commissionProtected
        ? "Commission protection missing"
        : dealRoomNeeded
          ? "Deal Room not shared"
          : serviceRecoveryNeeded
            ? "Service recovery needed"
            : "Ready for next follow-up";
    const nextBestAction = missingItems.length
      ? quality.conciergeAction || "Concierge to close missing brief items."
      : !commissionProtected
        ? "Get referral terms accepted and protect commission before active handover."
        : dealRoomNeeded
          ? "Generate a client Deal Room link so progress is visible from day one."
          : serviceRecoveryNeeded
            ? "Concierge to recover gently and log the outcome."
            : quality.handoffReady
              ? "Agent to make the next call and record the outcome."
              : "Keep qualifying before handoff.";
    const priority = serviceRecoveryNeeded || (!commissionProtected && score >= 65)
      ? "critical"
      : score >= 75 || missingItems.length >= 3
        ? "high"
        : score >= 50 || dealRoomNeeded
          ? "medium"
          : "normal";
    const mustAct = missingItems.length
      ? "concierge"
      : !commissionProtected || dealRoomNeeded
        ? "agent"
        : serviceRecoveryNeeded
          ? "concierge"
          : "agent";

    return {
      id: `lead-action-${lead.id}`,
      leadId: lead.id,
      caseId: lead.caseId || lead.id,
      caseName: lead.label,
      leadLabel: lead.label,
      clientName: lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label,
      intent: lead.intent,
      area: lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm",
      sourceLabel: sourceLabelForKey(normalizeLeadSource(lead)),
      ownerId: owner.id || ownerId || lead.agentId,
      ownerName: owner.name || relatedTasks[0]?.ownerName || "Assigned agent",
      agentId: owner.id || lead.agentId || lead.assignedAgentId,
      assignedAgentId: owner.id || lead.assignedAgentId || lead.agentId,
      agencyId: lead.agencyId,
      branchId: lead.branchId,
      provinceId: lead.provinceId,
      qualityScore: score,
      band: quality.band || "unscored",
      missingItems,
      actionReason,
      nextBestAction,
      mustAct,
      priority,
      handoffReady: Boolean(quality.handoffReady),
      commissionStatus: commissionProtected ? "Protected" : "Protect before handover",
      dealRoomStatus: dealRooms.length ? "Shared" : dealRoomNeeded ? "Needed" : "Not needed yet",
      sourceToSaleStage: sourceRow?.currentStage || "registered",
      openTaskCount: relatedTasks.filter((task) => task.status !== "done").length,
      servicePulseScore: pulseItems.length ? averageScore(pulseItems) : 0,
      whatsappDraft: buildLeadWhatsappDraft(lead, {
        ownerName: owner.name || relatedTasks[0]?.ownerName || "the agent",
        missingItems,
        commissionProtected,
        dealRoomNeeded,
        serviceRecoveryNeeded,
        nextBestAction
      })
    };
  });

  const leadCaseIds = new Set(leadRows.flatMap((row) => [row.caseId, row.leadId, row.leadLabel]).filter(Boolean));
  const taskRows = visibleTasks
    .filter((task) => !leadCaseIds.has(task.caseId) && !leadCaseIds.has(task.caseName))
    .map((task) => ({
      id: `task-action-${task.id}`,
      leadId: "",
      caseId: task.caseId,
      caseName: task.caseName,
      leadLabel: task.caseName,
      clientName: task.client || task.caseName,
      intent: "case",
      area: inferAreaFromCaseName(task.caseName),
      sourceLabel: task.source || "Task queue",
      ownerId: task.ownerId,
      ownerName: task.ownerName,
      agentId: task.agentId || task.ownerId,
      assignedAgentId: task.assignedAgentId || task.agentId || task.ownerId,
      agencyId: task.agencyId,
      branchId: task.branchId,
      provinceId: task.provinceId,
      qualityScore: 0,
      band: task.priority || "task",
      missingItems: [],
      actionReason: task.category || "Open task",
      nextBestAction: task.nextAction || "Move the task forward.",
      mustAct: task.role || "agent",
      priority: task.priority === "high" ? "high" : "medium",
      handoffReady: false,
      commissionStatus: /commission|protect/i.test(`${task.title} ${task.category}`) ? "Check protection" : "Not linked",
      dealRoomStatus: "Not linked",
      sourceToSaleStage: "task",
      openTaskCount: task.status === "done" ? 0 : 1,
      servicePulseScore: 0,
      whatsappDraft: `Hi ${task.ownerName}. Axiom action: ${task.nextAction || task.title}. Please update the case once done.`
    }));

  const rows = [...leadRows, ...taskRows]
    .sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority) || right.qualityScore - left.qualityScore);

  return {
    rows,
    summary: {
      total: rows.length,
      critical: rows.filter((row) => row.priority === "critical").length,
      high: rows.filter((row) => row.priority === "high").length,
      concierge: rows.filter((row) => row.mustAct === "concierge").length,
      agent: rows.filter((row) => row.mustAct === "agent").length,
      dealRoomsNeeded: rows.filter((row) => row.dealRoomStatus === "Needed").length,
      commissionGaps: rows.filter((row) => /protect/i.test(row.commissionStatus)).length
    }
  };
}

function isSameCase(record = {}, lead = {}) {
  const leadKeys = [lead.id, lead.caseId, lead.label, lead.caseName].filter(Boolean).map(String);
  const recordKeys = [record.id, record.leadId, record.caseId, record.caseName, record.label, record.property].filter(Boolean).map(String);
  return recordKeys.some((key) => leadKeys.includes(key));
}

function latestCaseMessages(threads = []) {
  return threads
    .flatMap((thread) =>
      ensureArray(thread.messages).map((message) => ({
        threadId: thread.id,
        author: message.author || "Axiom",
        direction: message.direction || "system",
        body: String(message.body || "").trim(),
        at: message.at || thread.updatedAt || thread.createdAt || ""
      }))
    )
    .filter((message) => message.body)
    .sort((left, right) => Date.parse(right.at || 0) - Date.parse(left.at || 0))
    .slice(0, 6);
}

function parseMoneyAmount(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  const match = text.match(/(?:r)?(\d+(?:\.\d+)?)(m|mil|million|k|000)?/i);
  if (!match) return null;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2] || "";
  if (["m", "mil", "million"].includes(suffix)) amount *= 1000000;
  else if (suffix === "k") amount *= 1000;
  else if (suffix === "000" && amount < 10000) amount *= 1000;
  else if (amount < 10000 && text.includes("r")) amount *= 1000;
  return Math.round(amount);
}

function formatRandCompact(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "value to confirm";
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `R${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(2).replace(/0$/, "")}m`;
  }
  return `R${Math.round(amount).toLocaleString("en-ZA")}`;
}

function buildSellerValuationFlow(lead, sellerSnapshot = null) {
  if (lead.intent !== "sell") {
    return {
      status: "not_applicable",
      label: "Buyer case",
      enabled: false
    };
  }

  const summary = lead.answerSummary || {};
  const sellerName = lead.briefCard?.clientName || summary["Client name"] || summary["Seller name"] || "there";
  const area = lead.briefCard?.area || lead.acquisition?.area || summary.Area || summary.Suburb || "your area";
  const propertyType = findSummaryValue(summary, ["Property type", "Type", "Unit type"]) || "property";
  const bedrooms = findSummaryValue(summary, ["Bedrooms", "Beds"]);
  const bathrooms = findSummaryValue(summary, ["Bathrooms", "Baths"]);
  const size = findSummaryValue(summary, ["Size", "m2", "m²", "Floor size"]);
  const condition = findSummaryValue(summary, ["Condition", "Features", "Notes"]) || lead.additionalInfo || "";
  const priceSignal =
    findSummaryValue(summary, ["Expected price", "Listing price", "Price", "Value", "Valuation"]) ||
    lead.acquisition?.signal ||
    lead.additionalInfo;
  const expectedPrice = parseMoneyAmount(priceSignal);
  const hasPropertyFacts = Boolean(propertyType !== "property" || bedrooms || bathrooms || size || condition);
  const hasArea = area && area !== "Area to confirm";
  const offerReady = Boolean(hasArea && hasPropertyFacts);
  const low = expectedPrice ? Math.round(expectedPrice * 0.92 / 5000) * 5000 : null;
  const high = expectedPrice ? Math.round(expectedPrice * 1.08 / 5000) * 5000 : null;
  const recommended = expectedPrice ? Math.round(expectedPrice / 5000) * 5000 : null;

  const permissionPrompt =
    `Thanks ${sellerName}. I have sent this to the concierge so a person can follow up properly. ` +
    `While you wait for the call, would you like me to send a short AI-assisted comparative guide for ${area}? ` +
    `Reply YES GUIDE and I will send it shortly, or NO THANKS and we will leave it for the call.`;

  const valuationDraft = expectedPrice
    ? `Hi ${sellerName}, here is a careful AI-assisted starting point for ${area}: based on the details shared, a rough discussion range is ${formatRandCompact(low)} to ${formatRandCompact(high)}, with ${formatRandCompact(recommended)} as a sensible starting listing conversation. This is not a formal valuation. A local specialist should still review the property, condition, recent comparable sales and listing strategy before any pricing decision.`
    : `Hi ${sellerName}, I can prepare a useful AI-assisted comparative guide for ${area}, but I need one or two extra details first: property type, bedrooms/bathrooms, approximate size, condition, and any price expectation. This will be a discussion guide only, not a formal valuation.`;

  return {
    status: offerReady ? "permission_ready" : "needs_property_facts",
    label: offerReady ? "Valuation guide can be offered" : "Needs property facts first",
    enabled: true,
    trigger: "5 to 15 minutes after seller intake, once enough property data is captured.",
    channel: "WhatsApp first, email optional.",
    permissionPrompt,
    yesReply: "Great, I will send a short guide in about 5 minutes. It is only a starting point for the call, not a formal valuation.",
    noReply: "No problem. The concierge will leave the valuation guide for the call.",
    delayMinutesAfterYes: 5,
    valuationDraft,
    estimatedRange: expectedPrice
      ? {
          low,
          high,
          recommended,
          confidence: hasPropertyFacts && expectedPrice ? "Medium" : "Low"
        }
      : null,
    factsUsed: {
      area,
      propertyType,
      bedrooms: bedrooms || "",
      bathrooms: bathrooms || "",
      size: size || "",
      condition: condition || "",
      sellerDemandConfidence: sellerSnapshot?.confidence || "Not yet available"
    },
    disclaimer: "AI-assisted discussion guide only. Not a formal valuation and not a substitute for a registered valuer or local specialist review.",
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "seller-valuation-guide",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildFridaySellerUpdatePack(lead, sellerSnapshot = null, relatedFeedback = []) {
  if (lead.intent !== "sell") {
    return {
      status: "not_applicable",
      enabled: false
    };
  }
  const sellerName = sellerSnapshot?.sellerName || lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "Seller";
  const property = sellerSnapshot?.property || lead.label;
  const enquiries = sellerSnapshot?.enquiryCount || 0;
  const viewings = sellerSnapshot?.viewingCount || 0;
  const feedback = sellerSnapshot?.viewingFeedback?.[0] || relatedFeedback[0]?.note || "No viewing feedback captured yet.";
  const recommendation = sellerSnapshot?.recommendedNextMove || lead.leadQuality?.conciergeAction || "Keep the next step clear and agent-reviewed.";
  const agentPermissionPrompt =
    `Seller update ready for ${sellerName} on ${property}. ` +
    `Enquiries: ${enquiries}. Viewings: ${viewings}. Feedback: ${feedback} ` +
    `Recommendation: ${recommendation} Reply SEND to release it to the seller, EDIT to adjust, or HOLD to leave it for now.`;
  const sellerMessageDraft =
    sellerSnapshot?.sellerMessageDraft ||
    `Hi ${sellerName}. A quick update from Axiom: enquiries ${enquiries}, viewings ${viewings}, current feedback: ${feedback}. Recommended next move: ${recommendation}`;

  return {
    enabled: true,
    status: "agent_permission_required",
    label: "Friday seller update",
    schedule: {
      day: "Friday",
      time: "15:30",
      timezone: "Africa/Windhoek"
    },
    agentPermissionPrompt,
    sellerMessageDraft,
    source: "Seller demand snapshot + viewing feedback + case memory",
    avoidsDuplicateFeature: true,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "friday-seller-update-pack",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildPostViewingFeedbackFlow(lead, relatedTasks = [], relatedFeedback = []) {
  const viewingTasks = relatedTasks.filter((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source} ${task.nextAction}`));
  const hasFeedback = relatedFeedback.length > 0;
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "there";
  const property = lead.label || "the property";
  const agentName = "the agent";
  const buyerMessage =
    `Hi ${clientName}, thank you again for taking the time to view ${property}. ` +
    `If you would like to, you can share a quick impression here. Even one short note helps. ` +
    `You can mention what felt right, anything that gave you pause, or whether you would like to take a next step. ` +
    `If you would rather not send feedback, that is completely fine. Just reply NO FEEDBACK and I will close the follow-up politely.`;
  const agentMessage =
    `Hi ${agentName}, when you have a quiet moment, please add a short viewing note for ${property}: buyer mood, main concern if any, price feel, and next step. ` +
    `If there is nothing useful to add right now, reply NO FEEDBACK and Axiom will leave it there.`;

  return {
    enabled: true,
    status: hasFeedback ? "stored" : viewingTasks.length ? "request_ready" : "waiting_for_viewing",
    label: hasFeedback ? "Feedback stored" : viewingTasks.length ? "Feedback request ready" : "Waiting for a viewing",
    trigger: "After each viewing, while the memory is fresh.",
    optional: true,
    buyerMessage,
    agentMessage,
    noFeedbackCommand: "NO FEEDBACK",
    storedFeedbackCount: relatedFeedback.length,
    viewingTaskCount: viewingTasks.length,
    copiedToAgent: true,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "post-viewing-feedback",
      approvalRequired: true,
      copiedToAgent: true,
      noFeedbackIsValid: true
    }
  };
}

function buildDealRoomSummaryFlow(lead, relatedDealRooms = [], sourceRow = null, actionRow = null) {
  const room = relatedDealRooms[0] || {};
  const stageProgress = {
    registered: 12,
    qualified: 25,
    viewing: 38,
    offer: 52,
    conveyancing: 70,
    transfer: 86,
    registration: 100,
    sold: 100
  };
  const currentStage = room.stage || room.currentStage || sourceRow?.currentStage || (lead.leadQuality?.handoffReady ? "qualified" : "registered");
  const rawProgress = Number(room.progress ?? room.progressPercent);
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : stageProgress[String(currentStage || "").toLowerCase()] || (lead.leadQuality?.handoffReady ? 30 : 12);
  const completedSteps = ensureArray(room.completedSteps || room.completed || room.timeline)
    .map((item) => item.label || item.title || item.stage || item)
    .filter(Boolean)
    .slice(0, 4);
  const outstandingItems = ensureArray(room.outstandingItems || room.nextSteps || lead.leadQuality?.missingItems)
    .map((item) => item.label || item.title || item)
    .filter(Boolean)
    .slice(0, 4);
  const nextStep = room.nextStep || actionRow?.nextBestAction || lead.leadQuality?.conciergeAction || "Confirm the next action and keep the client updated.";
  const shareReady = Boolean(relatedDealRooms.length || lead.leadQuality?.handoffReady);
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "Client";

  return {
    enabled: true,
    status: room.shareUrl ? "shared" : shareReady ? "share_ready" : "waiting_for_brief",
    label: room.shareUrl ? "Client Deal Room already shared" : shareReady ? "Deal Room share link ready" : "Waiting for a cleaner brief",
    currentStage,
    progress,
    completedSteps,
    outstandingItems,
    nextStep,
    shareUrl: room.shareUrl || "",
    passwordProtected: true,
    visibility: {
      buyer: true,
      seller: true,
      agent: true,
      attorney: true,
      bondOriginator: true,
      readOnlyForClients: true,
      roleFiltered: true
    },
    sharePrompt:
      `Send ${clientName} a clean Deal Room link: current stage, completed steps, outstanding items and the next action in one place.`,
    clientSummary:
      `Your Deal Room shows the matter at ${currentStage}, about ${progress}% through the tracked process, with the next step: ${nextStep}`,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "deal-room-share-link",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildCommissionProtectionFlow(lead, relatedCommission = [], actionRow = null) {
  const item = relatedCommission[0] || {};
  const handoffReady = Boolean(lead.leadQuality?.handoffReady || actionRow?.handoffReady);
  const proofItems = ensureArray(item.proofItems || item.proof || item.evidence);
  const accepted = Boolean(relatedCommission.length && !/missing|pending|draft/i.test(`${item.status || ""} ${item.paymentStatus || ""}`));
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "this lead";

  return {
    enabled: true,
    status: accepted ? "protected" : handoffReady ? "acceptance_required" : "waiting_for_handoff",
    label: accepted ? "25% successful-sale referral protected" : handoffReady ? "25% terms must be accepted" : "Protect once handoff is ready",
    referralPercent: 25,
    payableOnlyOnSuccessfulSale: true,
    noSaleNoCommission: true,
    expectedFee: item.expectedFee || item.expectedCommission || "",
    dueDate: item.dueDate || item.paymentDueDate || "Only when a successful sale closes",
    invoiceStatus: item.invoiceStatus || "Not invoiced",
    paymentStatus: item.paymentStatus || item.status || "Not accepted",
    proofStatus: proofItems.length ? `${proofItems.length} proof item${proofItems.length === 1 ? "" : "s"} logged` : "No proof logged yet",
    agentAcceptancePrompt:
      `Before accepting ${clientName}, please confirm the Axiom referral terms: 25% of the agency commission is payable only if this lead results in a successful sale. If no sale closes, no referral commission is due.`,
    nextAction: accepted ? "Keep proof, invoice status and payment status updated." : "Get the agent acceptance timestamp before active handover.",
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "commission-protection-acceptance",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildPrincipalIntelligenceFlow(lead, context = {}) {
  const quality = lead.leadQuality || {};
  const riskFlags = [];
  const opportunityFlags = [];
  const missingItems = ensureArray(quality.missingItems);
  if (quality.handoffReady && !context.relatedCommission?.length) riskFlags.push("25% referral acceptance not logged");
  if (quality.handoffReady && !context.relatedDealRooms?.length) riskFlags.push("Client Deal Room not shared");
  if (context.relatedEscalations?.length) riskFlags.push(`${context.relatedEscalations.length} escalation${context.relatedEscalations.length === 1 ? "" : "s"} open`);
  if (context.relatedPulse?.some((item) => Number(item.score || 0) <= 6)) riskFlags.push("Service recovery signal");
  if (missingItems.length >= 3) riskFlags.push(`${missingItems.length} brief gaps still open`);
  if (lead.intent === "sell") opportunityFlags.push("Seller update and valuation guide can create a stronger follow-up");
  if (quality.score >= 75) opportunityFlags.push("High-value lead should receive quick human attention");
  if (context.sourceRow?.currentStage) opportunityFlags.push(`Track conversion from ${context.sourceRow.currentStage}`);

  return {
    enabled: true,
    status: riskFlags.length ? "attention" : opportunityFlags.length ? "opportunity" : "clear",
    label: riskFlags.length ? "Principal/admin attention needed" : "Principal/admin intelligence clean",
    executiveSummary: riskFlags.length
      ? `This matter needs oversight: ${riskFlags.slice(0, 2).join("; ")}.`
      : `This matter is clean enough for normal follow-up and roll-up reporting.`,
    riskFlags,
    opportunityFlags,
    rollupDimensions: ["province", "agency", "branch", "agent", "lead source", "intent", "stage", "service pulse", "commission exposure"],
    recommendedAdminAction: riskFlags[0] || context.actionRow?.nextBestAction || quality.conciergeAction || "Monitor and keep the next action current.",
    internalOnly: true
  };
}

function buildAgentMatchingFlow(lead, visibleTeam = [], agentMatchingSignals = null, actionRow = null) {
  const signals = ensureArray(agentMatchingSignals?.agents);
  const assignedAgentId = lead.agentId || lead.assignedAgentId || actionRow?.agentId || actionRow?.assignedAgentId || actionRow?.ownerId;
  const assignedSignal = signals.find((agent) => agent.agentId === assignedAgentId);
  const scopedSignals = signals.filter((agent) =>
    (lead.branchId && agent.branchId === lead.branchId) ||
    (lead.provinceId && agent.provinceId === lead.provinceId) ||
    (!lead.branchId && !lead.provinceId)
  );
  const bestSignal = assignedSignal || scopedSignals[0] || signals[0];
  const assignedTeamMember = visibleTeam.find((member) => member.id === assignedAgentId || member.agentId === assignedAgentId);

  if (!bestSignal && !assignedTeamMember) {
    return {
      enabled: true,
      status: "needs_more_data",
      label: "Agent match needs more data",
      internalOnly: true,
      useForRouting: true,
      matchingInputs: agentMatchingSignals?.matchingInputs || ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
      why: ["No scoped agent signal is available yet."]
    };
  }

  const agentName = bestSignal?.agentName || assignedTeamMember?.name || actionRow?.ownerName || "Assigned agent";
  const matchScore = Number(bestSignal?.matchScore || 0);
  const why = [
    bestSignal ? `${matchScore}/100 internal match signal` : "Assigned by the office",
    bestSignal?.serviceAvg ? `${bestSignal.serviceAvg}/10 service pulse average` : "Service pulse still building",
    `${bestSignal?.activeLeadLoad || 0} active lead${bestSignal?.activeLeadLoad === 1 ? "" : "s"} in current load`,
    lead.intent ? `${lead.intent} intent` : "Intent to confirm"
  ];

  return {
    enabled: true,
    status: assignedSignal || assignedTeamMember ? "assigned" : "suggested",
    label: assignedSignal || assignedTeamMember ? `Matched to ${agentName}` : `Suggested: ${agentName}`,
    bestAgentId: bestSignal?.agentId || assignedTeamMember?.id || assignedAgentId || "",
    bestAgentName: agentName,
    matchScore,
    why,
    matchingInputs: agentMatchingSignals?.matchingInputs || ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
    internalOnly: true,
    useForRouting: true
  };
}

function buildCaseBrainHub(sessionOrRole, visible = {}, support = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleEscalations = visible.escalations || filterVisible(operations.escalations, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visiblePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const visibleQueue = visible.queue || filterVisible(operations.whatsapp.queue, sessionOrRole);
  const visibleFeedback = visible.feedbackLog || filterVisible(operations.whatsapp.feedbackLog, sessionOrRole);
  const visibleTeam = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const sourceToSale = support.sourceToSale || buildSourceToSaleTracker(sessionOrRole, visible);
  const sellerDemandSnapshots = support.sellerDemandSnapshots || buildSellerDemandSnapshots(sessionOrRole, visible);
  const leadActionCentre = support.leadActionCentre || buildLeadActionCentre(sessionOrRole, visible, sourceToSale);
  const agentMatchingSignals = support.agentMatchingSignals || buildAgentMatchingSignals(sessionOrRole, visible, support.servicePulseRollups);

  const cases = visibleLeads.map((lead) => {
    const quality = lead.leadQuality || {};
    const brief = lead.briefCard || {};
    const relatedTasks = visibleTasks.filter((task) => isSameCase(task, lead));
    const relatedEscalations = visibleEscalations.filter((item) => isSameCase(item, lead));
    const relatedCommission = visibleCommission.filter((item) => isSameCase(item, lead));
    const relatedDealRooms = visibleDealRooms.filter((room) => isSameCase(room, lead));
    const relatedPulse = visiblePulse.filter((item) => isSameCase(item, lead));
    const relatedThreads = visibleThreads.filter((thread) => isSameCase(thread, lead));
    const relatedQueue = visibleQueue.filter((item) => isSameCase(item, lead));
    const relatedFeedback = visibleFeedback.filter((item) => isSameCase(item, lead));
    const sourceRow = sourceToSale.rows?.find((row) => row.leadId === lead.id || row.caseId === lead.caseId);
    const actionRow = leadActionCentre.rows?.find((row) => row.leadId === lead.id || row.caseId === lead.caseId);
    const sellerSnapshot = sellerDemandSnapshots.find((item) => item.leadId === lead.id || item.caseId === lead.caseId);
    const ownerId = lead.agentId || lead.assignedAgentId || actionRow?.agentId || actionRow?.ownerId;
    const owner = visibleTeam.find((member) => member.id === ownerId || member.agentId === ownerId);
    const missingItems = ensureArray(quality.missingItems);
    const score = Number(quality.score || 0);
    const approvalQueue = relatedQueue.filter((item) => item.approvalRequired || item.status === "awaiting_approval");
    const recoveryNeeded = relatedPulse.some((item) => Number(item.score || 0) <= 6);
    const commissionProtected = relatedCommission.length > 0;
    const dealRoomShared = relatedDealRooms.length > 0;
    const serviceAvg = relatedPulse.length ? averageScore(relatedPulse) : 0;
    const latestMessages = latestCaseMessages(relatedThreads);
    const sellerValuationFlow = buildSellerValuationFlow(lead, sellerSnapshot);
    const fridaySellerUpdate = buildFridaySellerUpdatePack(lead, sellerSnapshot, relatedFeedback);
    const postViewingFeedback = buildPostViewingFeedbackFlow(lead, relatedTasks, relatedFeedback);
    const dealRoomSummaryFlow = buildDealRoomSummaryFlow(lead, relatedDealRooms, sourceRow, actionRow);
    const commissionProtectionFlow = buildCommissionProtectionFlow(lead, relatedCommission, actionRow);
    const principalIntelligenceFlow = buildPrincipalIntelligenceFlow(lead, {
      sourceRow,
      actionRow,
      sellerSnapshot,
      relatedEscalations,
      relatedPulse,
      relatedCommission,
      relatedDealRooms
    });
    const agentMatchingFlow = buildAgentMatchingFlow(lead, visibleTeam, agentMatchingSignals, actionRow);

    let riskScore = 0;
    if (relatedEscalations.length) riskScore += 35;
    if (!commissionProtected && (quality.handoffReady || score >= 62)) riskScore += 25;
    if (missingItems.length >= 3) riskScore += 18;
    if (!dealRoomShared && quality.handoffReady) riskScore += 12;
    if (approvalQueue.length) riskScore += 10;
    if (recoveryNeeded) riskScore += 25;
    if (score >= 80 && !commissionProtected) riskScore += 10;
    if (sellerValuationFlow.status === "permission_ready") riskScore += 4;
    if (fridaySellerUpdate.status === "agent_permission_required") riskScore += 4;
    if (postViewingFeedback.status === "request_ready") riskScore += 6;
    if (commissionProtectionFlow.status === "acceptance_required") riskScore += 8;
    if (dealRoomSummaryFlow.status === "share_ready") riskScore += 5;
    if (principalIntelligenceFlow.status === "attention") riskScore += 7;

    const riskLevel = riskScore >= 55 ? "critical" : riskScore >= 34 ? "high" : riskScore >= 16 ? "medium" : "low";
    const humanOverrideNeeded = riskLevel === "critical" || recoveryNeeded || relatedEscalations.length > 0;
    const currentStage = sourceRow?.currentStage || (quality.handoffReady ? "qualified" : "registered");
    const nextBestAction =
      actionRow?.nextBestAction ||
      quality.conciergeAction ||
      (quality.handoffReady ? "Pass the brief to the agent with human approval available." : "Concierge to close the missing brief items.");
    const whatsappDraft = actionRow?.whatsappDraft || buildLeadWhatsappDraft(lead, {
      ownerName: owner?.name || actionRow?.ownerName || "the agent",
      missingItems,
      commissionProtected,
      dealRoomNeeded: quality.handoffReady && !dealRoomShared,
      serviceRecoveryNeeded: recoveryNeeded,
      nextBestAction
    });

    return {
      caseId: lead.caseId || lead.id,
      leadId: lead.id,
      caseName: lead.label,
      intent: lead.intent,
      clientName: brief.clientName || lead.answerSummary?.["Client name"] || lead.label,
      area: brief.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm",
      assignedAgent: owner?.name || actionRow?.ownerName || "Assigned agent to confirm",
      currentStage,
      source: sourceRow?.sourceLabel || sourceLabelForKey(normalizeLeadSource(lead)),
      brainState: humanOverrideNeeded ? "human_override" : approvalQueue.length ? "approval_needed" : quality.handoffReady ? "ready" : "learning",
      brainStateLabel: humanOverrideNeeded ? "Human override" : approvalQueue.length ? "Approval needed" : quality.handoffReady ? "Ready for handoff" : "Still learning",
      riskLevel,
      score,
      band: quality.band || "unscored",
      handoffReady: Boolean(quality.handoffReady),
      missingItems,
      nextBestAction,
      whatsappDraft,
      sellerValuationFlow,
      fridaySellerUpdate,
      postViewingFeedback,
      dealRoomSummaryFlow,
      commissionProtectionFlow,
      principalIntelligenceFlow,
      agentMatchingFlow,
      learningMemory: {
        knownFacts: ensureArray(brief.knownFacts).slice(0, 6),
        latestMessages,
        messageCount: relatedThreads.reduce((total, thread) => total + ensureArray(thread.messages).length, 0),
        feedbackCount: relatedFeedback.length,
        servicePulseCount: relatedPulse.length,
        serviceAvg,
        sellerSnapshotReady: Boolean(sellerSnapshot)
      },
      controls: {
        commissionProtected,
        commissionItems: relatedCommission.length,
        dealRoomShared,
        dealRoomCount: relatedDealRooms.length,
        approvalQueue: approvalQueue.length,
        openTasks: relatedTasks.filter((task) => task.status !== "done").length,
        escalations: relatedEscalations.length,
        humanOverrideNeeded
      },
      stakeholderView: {
        buyer: lead.intent === "buy" || relatedDealRooms.some((room) => /buyer/i.test(JSON.stringify(room))),
        seller: lead.intent === "sell" || Boolean(sellerSnapshot),
        agent: Boolean(owner || actionRow),
        attorney: relatedDealRooms.some((room) => /attorney|convey/i.test(JSON.stringify(room))),
        bondOriginator: relatedDealRooms.some((room) => /bond|finance/i.test(JSON.stringify(room)))
      },
      aiUseCases: [
        "WhatsApp concierge draft",
        "Lead quality explanation",
        lead.intent === "sell" ? "Seller demand snapshot" : "Buyer readiness summary",
        lead.intent === "sell" ? "Seller valuation guide consent" : "Buyer readiness summary",
        lead.intent === "sell" ? "Friday seller update pack" : "Buyer progress update",
        "Post-viewing feedback capture",
        "Client Deal Room summary",
        "25% successful-sale commission protection",
        "Principal/admin risk intelligence",
        "Internal agent matching signal",
        "Next best action",
        "Deal Room progress wording",
        "Commission protection check"
      ],
      flow: [
        {
          key: "lead",
          label: "Lead captured",
          status: "done",
          detail: `${sourceRow?.sourceLabel || sourceLabelForKey(normalizeLeadSource(lead))}`
        },
        {
          key: "brief",
          label: "Brief brain",
          status: quality.handoffReady ? "ready" : "gap",
          detail: missingItems.length ? `${missingItems.length} gap${missingItems.length === 1 ? "" : "s"}` : "Clean enough"
        },
        {
          key: "comms",
          label: "Comms memory",
          status: latestMessages.length ? "active" : "waiting",
          detail: `${latestMessages.length} recent`
        },
        {
          key: "protect",
          label: "Protection",
          status: commissionProtectionFlow.status === "protected" ? "protected" : commissionProtectionFlow.status === "acceptance_required" ? "needed" : "later",
          detail: commissionProtectionFlow.label
        },
        {
          key: "share",
          label: "Deal Room",
          status: dealRoomSummaryFlow.status === "shared" ? "shared" : dealRoomSummaryFlow.status === "share_ready" ? "needed" : "later",
          detail: dealRoomSummaryFlow.label
        },
        {
          key: "next",
          label: "Next action",
          status: humanOverrideNeeded ? "human" : "ai",
          detail: humanOverrideNeeded ? "Concierge steps in" : "AI draft ready"
        },
        {
          key: "valuation",
          label: "Valuation",
          status: sellerValuationFlow.status === "permission_ready" ? "ready" : sellerValuationFlow.status === "needs_property_facts" ? "gap" : "later",
          detail: sellerValuationFlow.enabled ? sellerValuationFlow.label : "Not seller"
        },
        {
          key: "sellerUpdate",
          label: "Seller update",
          status: fridaySellerUpdate.status === "agent_permission_required" ? "approval" : "later",
          detail: fridaySellerUpdate.enabled ? "Fri 15:30" : "Not seller"
        },
        {
          key: "feedback",
          label: "Feedback",
          status: postViewingFeedback.status === "request_ready" ? "ready" : postViewingFeedback.status === "stored" ? "stored" : "waiting",
          detail: postViewingFeedback.label
        },
        {
          key: "intel",
          label: "Office intel",
          status: principalIntelligenceFlow.status === "attention" ? "human" : "ai",
          detail: principalIntelligenceFlow.label
        },
        {
          key: "match",
          label: "Agent match",
          status: agentMatchingFlow.status === "assigned" || agentMatchingFlow.status === "suggested" ? "ready" : "gap",
          detail: agentMatchingFlow.label
        }
      ]
    };
  });

  const sortedCases = cases.sort((left, right) => {
    const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return (riskOrder[right.riskLevel] || 0) - (riskOrder[left.riskLevel] || 0) || right.score - left.score;
  });

  return {
    summary: {
      totalCases: sortedCases.length,
      readyForHandoff: sortedCases.filter((item) => item.handoffReady).length,
      humanOverride: sortedCases.filter((item) => item.controls.humanOverrideNeeded).length,
      approvalNeeded: sortedCases.filter((item) => item.controls.approvalQueue > 0).length,
      protectionNeeded: sortedCases.filter((item) => !item.controls.commissionProtected && item.handoffReady).length,
      dealRoomsNeeded: sortedCases.filter((item) => !item.controls.dealRoomShared && item.handoffReady).length,
      valuationOffersReady: sortedCases.filter((item) => item.sellerValuationFlow?.status === "permission_ready").length,
      sellerUpdatesReady: sortedCases.filter((item) => item.fridaySellerUpdate?.status === "agent_permission_required").length,
      feedbackRequestsReady: sortedCases.filter((item) => item.postViewingFeedback?.status === "request_ready").length,
      dealRoomSummariesReady: sortedCases.filter((item) => item.dealRoomSummaryFlow?.status === "share_ready" || item.dealRoomSummaryFlow?.status === "shared").length,
      commissionProtectionsNeeded: sortedCases.filter((item) => item.commissionProtectionFlow?.status === "acceptance_required").length,
      principalAlerts: sortedCases.filter((item) => item.principalIntelligenceFlow?.status === "attention").length,
      agentMatchesReady: sortedCases.filter((item) => ["assigned", "suggested"].includes(item.agentMatchingFlow?.status)).length,
      learning: sortedCases.filter((item) => item.brainState === "learning").length
    },
    cases: sortedCases,
    model: {
      name: "Axiom Case Brain",
      purpose: "One shared case file for lead quality, concierge messages, valuation consent, Deal Room summaries, seller updates, post-viewing feedback, 25% successful-sale commission protection, principal intelligence, agent matching, service pulse and next actions.",
      humanApprovalRule: "AI may draft and summarise; client-facing or relationship-sensitive sends stay approval-first.",
      channels: ["Mission Control", "WhatsApp", "Deal Room", "Seller valuation guide", "Friday seller update", "Post-viewing feedback", "Commission Protection", "Agent Matching", "09:30 agent digest"]
    }
  };
}

function buildAgentSuccessDesk(sessionOrRole, visible = {}, leadActionCentre = null, servicePulseRollups = null) {
  const operations = getOperationsState();
  const visibleTeam = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const pulseRollups = servicePulseRollups || buildServicePulseRollups(sessionOrRole, visible);

  const agents = visibleTeam.map((agent) => {
    const agentActions = actionCentre.rows.filter((row) => row.agentId === agent.id || row.assignedAgentId === agent.id || row.ownerId === agent.id);
    const agentLeads = visibleLeads.filter((lead) => lead.agentId === agent.id || lead.assignedAgentId === agent.id);
    const scoredLeads = agentLeads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
    const pulse = pulseRollups.byAgent.find((item) => item.id === agent.id);
    const protectedDeals = visibleCommission.filter((item) => item.agentId === agent.id || item.assignedAgentId === agent.id || item.agent === agent.name).length;
    const dealRooms = visibleDealRooms.filter((room) => room.agentId === agent.id || room.assignedAgentId === agent.id).length;
    const topAction = agentActions[0];
    const avgLeadScore = scoredLeads.length
      ? Math.round(scoredLeads.reduce((total, lead) => total + Number(lead.leadQuality?.score || 0), 0) / scoredLeads.length)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      status: agent.status,
      lane: agent.lane,
      activeLeads: agentLeads.length,
      openActions: agentActions.length,
      hotLeads: agentLeads.filter((lead) => lead.leadQuality?.band === "hot").length,
      weakLeads: agentLeads.filter((lead) => lead.leadQuality?.band === "weak").length,
      avgLeadScore,
      protectedDeals,
      dealRooms,
      serviceAvg: pulse?.avgScore || 0,
      serviceCount: pulse?.count || 0,
      recoveryItems: pulse?.needsRecovery || 0,
      topAction: topAction?.nextBestAction || "No urgent lead action in this view.",
      nextClient: topAction?.clientName || "No priority client",
      assistantBrief: `${agent.name}: ${agentActions.length} open action${agentActions.length === 1 ? "" : "s"}, ${protectedDeals} protected deal${protectedDeals === 1 ? "" : "s"}, ${pulse?.avgScore || 0}/10 service pulse.`,
      checklist: [
        topAction?.nextBestAction || "Check for the next new lead.",
        protectedDeals ? "Keep commission evidence updated." : "Protect commission on the next accepted referral.",
        dealRooms ? "Keep Deal Room progress clean." : "Share Deal Room where the client needs progress visibility."
      ]
    };
  });

  const fallbackAgentIds = unique(actionCentre.rows.map((row) => row.agentId).filter(Boolean))
    .filter((agentId) => !agents.some((agent) => agent.agentId === agentId));
  for (const agentId of fallbackAgentIds) {
    const rows = actionCentre.rows.filter((row) => row.agentId === agentId);
    agents.push({
      agentId,
      agentName: rows[0]?.ownerName || "Assigned agent",
      branchId: rows[0]?.branchId || "",
      provinceId: rows[0]?.provinceId || "",
      status: "active",
      lane: "Lead handling",
      activeLeads: rows.length,
      openActions: rows.length,
      hotLeads: rows.filter((row) => row.band === "hot").length,
      weakLeads: rows.filter((row) => row.band === "weak").length,
      avgLeadScore: rows.length ? Math.round(rows.reduce((total, row) => total + Number(row.qualityScore || 0), 0) / rows.length) : 0,
      protectedDeals: 0,
      dealRooms: 0,
      serviceAvg: 0,
      serviceCount: 0,
      recoveryItems: 0,
      topAction: rows[0]?.nextBestAction || "No urgent lead action in this view.",
      nextClient: rows[0]?.clientName || "No priority client",
      assistantBrief: `${rows[0]?.ownerName || "Assigned agent"}: ${rows.length} open action${rows.length === 1 ? "" : "s"} to work.`,
      checklist: rows.slice(0, 3).map((row) => row.nextBestAction)
    });
  }

  const sortedAgents = agents.sort((left, right) => right.openActions - left.openActions || right.hotLeads - left.hotLeads);
  return {
    agents: sortedAgents,
    summary: {
      agents: sortedAgents.length,
      openActions: sortedAgents.reduce((total, agent) => total + agent.openActions, 0),
      hotLeads: sortedAgents.reduce((total, agent) => total + agent.hotLeads, 0),
      recoveryItems: sortedAgents.reduce((total, agent) => total + agent.recoveryItems, 0),
      protectedDeals: sortedAgents.reduce((total, agent) => total + agent.protectedDeals, 0)
    }
  };
}

function buildAgentActionDigests(sessionOrRole, visible = {}, agentSuccessDesk = null, leadActionCentre = null, caseBrain = null) {
  const operations = getOperationsState();
  const successDesk = agentSuccessDesk || buildAgentSuccessDesk(sessionOrRole, visible);
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const brain = caseBrain || buildCaseBrainHub(sessionOrRole, visible, { leadActionCentre: actionCentre });
  const team = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const weekdayTime = "09:30";

  const digests = successDesk.agents.map((agent) => {
    const member = team.find((item) => item.id === agent.agentId || item.agentId === agent.agentId) || {};
    const email = normalizeEmail(member.email || member.contact);
    const actions = actionCentre.rows
      .filter((row) => row.agentId === agent.agentId || row.assignedAgentId === agent.agentId || row.ownerId === agent.agentId)
      .slice(0, 5);
    const topActions = actions.slice(0, 3).map((row) => {
      const brainCase = brain.cases.find((item) => item.caseId === row.caseId || item.leadId === row.leadId || item.caseName === row.caseName) || null;
      return {
        clientName: row.clientName,
        priority: row.priority,
        reason: row.actionReason,
        nextBestAction: row.nextBestAction,
        whatsappDraft: row.whatsappDraft,
        caseBrainSignal: brainCase
          ? {
              score: brainCase.score,
              band: brainCase.band,
              state: brainCase.brainStateLabel,
              risk: brainCase.riskLevel
            }
          : null
      };
    });
    const caseBrainHighlights = topActions
      .filter((action) => action.caseBrainSignal)
      .map((action) => ({
        clientName: action.clientName,
        score: action.caseBrainSignal.score,
        band: action.caseBrainSignal.band,
        state: action.caseBrainSignal.state,
        risk: action.caseBrainSignal.risk,
        nextBestAction: action.nextBestAction
      }));
    const protectionGaps = actions.filter((row) => /protect/i.test(row.commissionStatus)).length;
    const dealRoomGaps = actions.filter((row) => row.dealRoomStatus === "Needed").length;
    const subject = `Axiom 09:30 action digest - ${agent.agentName}`;
    const bodyLines = [
      `Good morning ${agent.agentName}.`,
      `You have ${actions.length} priority action${actions.length === 1 ? "" : "s"} in Axiom today.`,
      ...topActions.map((action, index) => {
        const brainLine = action.caseBrainSignal
          ? ` (${action.caseBrainSignal.band} ${action.caseBrainSignal.score}/100, ${action.caseBrainSignal.risk} risk)`
          : "";
        return `${index + 1}. ${action.clientName}: ${action.nextBestAction}${brainLine}`;
      }),
      protectionGaps ? `${protectionGaps} commission protection gap${protectionGaps === 1 ? "" : "s"} need attention.` : "No urgent commission protection gap in this view.",
      dealRoomGaps ? `${dealRoomGaps} client Deal Room${dealRoomGaps === 1 ? "" : "s"} should be shared.` : "No urgent Deal Room gap in this view."
    ];

    return {
      agentId: agent.agentId,
      agentName: agent.agentName,
      email,
      emailStatus: email ? "ready" : "email_missing",
      schedule: "Weekdays 09:30",
      channel: "email",
      subject,
      bodyPreview: bodyLines.join("\n"),
      topActions,
      caseBrainHighlights,
      actionCount: actions.length,
      protectionGaps,
      dealRoomGaps,
      serviceAvg: agent.serviceAvg,
      recoveryItems: agent.recoveryItems
    };
  });

  return {
    schedule: {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      time: weekdayTime,
      timezone: "Africa/Windhoek"
    },
    digests,
    summary: {
      total: digests.length,
      ready: digests.filter((digest) => digest.emailStatus === "ready").length,
      missingEmail: digests.filter((digest) => digest.emailStatus === "email_missing").length,
      totalActions: digests.reduce((total, digest) => total + digest.actionCount, 0)
    }
  };
}

function normalizePilotStatus(value) {
  const status = slugify(value || "").replace(/-/g, "_");
  const allowed = new Set(["not_invited", "invited", "opted_in", "active", "issue", "paused", "passed"]);
  return allowed.has(status) ? status : "invited";
}

function pilotStatusLabel(status) {
  return {
    not_invited: "Not invited",
    invited: "Invited",
    opted_in: "Opted in",
    active: "Active",
    issue: "Issue",
    paused: "Paused",
    passed: "Passed"
  }[normalizePilotStatus(status)] || "Invited";
}

function getPilotControlState() {
  const operations = getOperationsState();
  operations.pilotControl ||= { agents: [], scenarios: [], messageLog: [], issueLog: [] };
  operations.pilotControl.agents ||= [];
  operations.pilotControl.scenarios ||= [];
  operations.pilotControl.messageLog ||= [];
  operations.pilotControl.issueLog ||= [];
  return operations.pilotControl;
}

function findPilotAgent(control, agentId) {
  const id = String(agentId || "").trim();
  return control.agents.find((agent) => agent.id === id || agent.agentId === id || agent.agentName === id) || null;
}

function findPilotScenario(control, scenarioId) {
  const id = String(scenarioId || "").trim();
  return control.scenarios.find((scenario) => scenario.id === id || scenario.title === id) || null;
}

function buildPilotMessageBody(agent, scenario) {
  return String(scenario.body || "")
    .replace(/\[Agent Name\]/g, agent.agentName || "Agent")
    .replace(/\[agent name\]/g, agent.agentName || "Agent");
}

function buildPilotControlSnapshot(sessionOrRole, visible = {}) {
  const control = getPilotControlState();
  const agents = visible.pilotAgents || filterVisible(control.agents, sessionOrRole);
  const scenarios = visible.pilotScenarios || filterVisible(control.scenarios, sessionOrRole);
  const messageLog = visible.pilotMessageLog || filterVisible(control.messageLog, sessionOrRole);
  const issueLog = visible.pilotIssueLog || filterVisible(control.issueLog, sessionOrRole);
  const openIssues = issueLog.filter((issue) => issue.status !== "closed");

  const agentsWithProgress = agents.map((agent) => {
    const passed = ensureArray(agent.scenariosPassed);
    const agentIssues = openIssues.filter((issue) => issue.agentId === agent.agentId || issue.agentId === agent.id);
    const lastMessage = messageLog
      .filter((message) => message.agentId === agent.agentId || message.agentId === agent.id)
      .sort((left, right) => Date.parse(right.queuedAt || right.updatedAt || 0) - Date.parse(left.queuedAt || left.updatedAt || 0))[0];
    return {
      ...agent,
      status: normalizePilotStatus(agent.status),
      statusLabel: pilotStatusLabel(agent.status),
      scenariosPassed: passed,
      passedCount: passed.length,
      issueCount: agentIssues.length,
      lastMessageAt: lastMessage?.queuedAt || agent.lastScenarioAt || "",
      currentScenarioTitle: scenarios.find((scenario) => scenario.id === agent.currentScenarioId)?.title || agent.nextTest || "Next test to assign"
    };
  });

  const scenarioRows = scenarios.map((scenario) => {
    const sent = messageLog.filter((message) => message.scenarioId === scenario.id);
    const passedCount = agentsWithProgress.filter((agent) => ensureArray(agent.scenariosPassed).includes(scenario.id)).length;
    const issueCount = openIssues.filter((issue) => issue.scenarioId === scenario.id).length;
    return {
      ...scenario,
      sentCount: sent.length,
      passedCount,
      issueCount,
      passRate: agentsWithProgress.length ? Math.round((passedCount / agentsWithProgress.length) * 100) : 0
    };
  });

  return {
    agents: agentsWithProgress,
    scenarios: scenarioRows,
    messageLog: messageLog
      .slice()
      .sort((left, right) => Date.parse(right.queuedAt || right.updatedAt || 0) - Date.parse(left.queuedAt || left.updatedAt || 0))
      .slice(0, 20),
    issueLog: issueLog
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || right.updatedAt || 0) - Date.parse(left.createdAt || left.updatedAt || 0))
      .slice(0, 20),
    metrics: {
      totalAgents: agentsWithProgress.length,
      invited: agentsWithProgress.filter((agent) => agent.status === "invited").length,
      optedIn: agentsWithProgress.filter((agent) => agent.status === "opted_in" || agent.status === "active" || agent.status === "passed").length,
      active: agentsWithProgress.filter((agent) => agent.status === "active").length,
      issues: openIssues.length,
      passedAgents: agentsWithProgress.filter((agent) => agent.status === "passed").length,
      scenarios: scenarioRows.length,
      messagesQueued: messageLog.length
    },
    nextBestStep: openIssues.length
      ? "Resolve open pilot issues before inviting more agents."
      : agentsWithProgress.some((agent) => agent.status === "invited")
        ? "Confirm WhatsApp opt-in for invited agents, then queue the first scenario."
        : "Queue the next scenario and watch replies in Concierge Comms."
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function computeAgentNetworkRecord(record) {
  const normalized = normalizeAgentNetworkRecord(record);
  const hasEmail = Boolean(normalized.contact.email);
  const hasWhatsapp = Boolean(normalized.contact.whatsapp);
  const hasSource = Boolean(normalized.source.url || normalized.source.note);
  const sourceAgeDays = daysSinceIso(normalized.source.capturedAt);
  const verifiedAgeDays = daysSinceIso(normalized.verification.lastVerifiedAt);
  const doNotContact =
    normalized.consent.doNotContact ||
    normalized.consent.emailStatus === "opted_out" ||
    normalized.consent.whatsappStatus === "opted_out" ||
    normalized.verification.status === "invalid";
  const verificationWeight =
    normalized.verification.status === "verified"
      ? 24
      : normalized.verification.status === "source_found"
        ? 13
        : normalized.verification.status === "needs_review"
          ? 7
          : -20;
  const contactWeight = (hasWhatsapp ? 18 : 0) + (hasEmail ? 10 : 0);
  const sourceWeight = hasSource ? 12 : -12;
  const complianceWeight = doNotContact
    ? -50
    : normalized.consent.whatsappStatus === "opted_in"
      ? 16
      : normalized.consent.emailStatus === "business_context" || normalized.consent.whatsappStatus === "business_context"
        ? 9
        : 3;
  const marketWeight = Math.min(18, ensureArray(normalized.towns).length * 3 + ensureArray(normalized.specialties).length * 3);
  const fitWeight = Math.round(
    (Number(normalized.matchingSignals.sellerFit || 0) +
      Number(normalized.matchingSignals.buyerFit || 0) +
      Number(normalized.matchingSignals.referralFit || 0) +
      Number(normalized.matchingSignals.responseReliability || 0)) /
      20
  );
  const pulseWeight = Math.min(10, Math.round(Number(normalized.matchingSignals.servicePulseAvg || 0)));
  const stalePenalty = verifiedAgeDays !== null && verifiedAgeDays > 120 ? 12 : sourceAgeDays !== null && sourceAgeDays > 180 ? 8 : 0;
  const networkScore = clampScore(22 + verificationWeight + contactWeight + sourceWeight + complianceWeight + marketWeight + fitWeight + pulseWeight - stalePenalty);

  let complianceStatus = "usable_controlled_outreach";
  let nextAction = "Use for matching and controlled one-to-one outreach.";
  if (doNotContact) {
    complianceStatus = "do_not_contact";
    nextAction = "Do not contact. Keep only for suppression and audit history.";
  } else if (!hasSource) {
    complianceStatus = "source_needed";
    nextAction = "Add a public source URL or source note before use.";
  } else if (normalized.verification.status !== "verified") {
    complianceStatus = "verify_before_outreach";
    nextAction = "Verify the public source and contact details before first outreach.";
  } else if (!hasEmail && !hasWhatsapp) {
    complianceStatus = "contact_missing";
    nextAction = "Use for coverage mapping only until contact details are confirmed.";
  }

  return {
    ...normalized,
    hasEmail,
    hasWhatsapp,
    hasSource,
    sourceAgeDays,
    verifiedAgeDays,
    doNotContact,
    networkScore,
    matchBand: networkScore >= 80 ? "priority" : networkScore >= 65 ? "strong" : networkScore >= 45 ? "developing" : "hold",
    complianceStatus,
    outreachAllowed: complianceStatus === "usable_controlled_outreach",
    pilotInviteReady: complianceStatus === "usable_controlled_outreach" && hasWhatsapp && networkScore >= 65,
    contactability: hasWhatsapp ? "WhatsApp ready" : hasEmail ? "Email only" : "No usable contact",
    nextAction,
    recommendedUse: doNotContact
      ? "suppression_only"
      : complianceStatus === "usable_controlled_outreach"
        ? "match_invite_or_pilot"
        : "internal_mapping_until_checked"
  };
}

function buildProvinceAgentNetworkRollups(records = []) {
  const groups = new Map();
  records.forEach((record) => {
    const key = record.provinceId || "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        provinceId: key,
        province: record.province || formatProvinceLabel(key),
        records: [],
        towns: new Set(),
        specialties: new Set()
      });
    }
    const group = groups.get(key);
    group.records.push(record);
    ensureArray(record.towns).forEach((town) => group.towns.add(town));
    ensureArray(record.specialties).forEach((specialty) => group.specialties.add(specialty));
  });

  return [...groups.values()]
    .map((group) => {
      const records = group.records;
      const avgScore = records.length
        ? Math.round(records.reduce((total, item) => total + Number(item.networkScore || 0), 0) / records.length)
        : 0;
      return {
        provinceId: group.provinceId,
        province: group.province,
        total: records.length,
        verified: records.filter((item) => item.verification.status === "verified").length,
        inviteReady: records.filter((item) => item.pilotInviteReady).length,
        doNotContact: records.filter((item) => item.doNotContact).length,
        avgScore,
        towns: [...group.towns].slice(0, 8),
        specialties: [...group.specialties].slice(0, 8)
      };
    })
    .sort((left, right) => right.total - left.total || left.province.localeCompare(right.province));
}

function buildAgentNetworkDirectorySnapshot(sessionOrRole, visible = {}) {
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  if (!hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])) {
    return {
      authorized: false,
      summary: { total: 0, visible: 0 },
      records: [],
      provinceRollups: [],
      pilotCandidates: [],
      verificationQueue: [],
      outreachLog: [],
      importBatches: []
    };
  }

  const operations = getOperationsState();
  const directory = visible.agentNetworkDirectory || filterVisible(operations.agentNetwork.directory, session);
  const outreachLog = visible.agentNetworkOutreachLog || filterVisible(operations.agentNetwork.outreachLog, session);
  const importBatches = visible.agentNetworkImportBatches || filterVisible(operations.agentNetwork.importBatches, session);
  const records = directory.map(computeAgentNetworkRecord).sort((left, right) => right.networkScore - left.networkScore);
  const verificationQueue = records
    .filter((record) => ["source_needed", "verify_before_outreach", "contact_missing"].includes(record.complianceStatus))
    .sort((left, right) => right.networkScore - left.networkScore);
  const pilotCandidates = records.filter((record) => record.pilotInviteReady).slice(0, 25);
  const doNotContact = records.filter((record) => record.doNotContact);

  return {
    authorized: true,
    guardrails: {
      modulePurpose: "Internal agent coverage, matching, pilot selection and controlled business outreach.",
      publicDomainRule: "Public-domain data is still treated as personal information. Keep source proof, verify before outreach, and respect opt-out immediately.",
      noBulkSpam: true,
      outreachMode: "One-to-one invitation or relationship message only; WhatsApp sends remain queued for human control.",
      retentionNote: "Keep records accurate, source-backed and removable when no longer needed."
    },
    summary: {
      total: records.length,
      verified: records.filter((record) => record.verification.status === "verified").length,
      needsVerification: verificationQueue.length,
      inviteReady: pilotCandidates.length,
      doNotContact: doNotContact.length,
      hasWhatsapp: records.filter((record) => record.hasWhatsapp).length,
      hasEmail: records.filter((record) => record.hasEmail).length,
      avgScore: records.length ? Math.round(records.reduce((total, record) => total + record.networkScore, 0) / records.length) : 0,
      provincesCovered: new Set(records.map((record) => record.provinceId)).size,
      publicSourceRecords: records.filter((record) => record.source.type.includes("public")).length
    },
    records: records.slice(0, 100),
    provinceRollups: buildProvinceAgentNetworkRollups(records),
    pilotCandidates,
    verificationQueue: verificationQueue.slice(0, 25),
    doNotContact,
    outreachLog: outreachLog
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
      .slice(0, 50),
    importBatches: importBatches
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
      .slice(0, 20)
  };
}

function buildAiValueOpportunities(sessionOrRole, snapshot) {
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  const role = session.role;
  const metrics = snapshot.metrics || {};
  const rollups = snapshot.rollups || {};
  const roleLabel = getRoleProfile(role).label;

  const base = {
    role,
    roleLabel,
    mode: config.whatsappMode,
    llmStatus: getLlmStatus().status,
    llmProvider: getLlmStatus(),
    principle: "AI drafts, summarises, detects risk and recommends next action. Humans approve, override or take over where judgement matters.",
    opportunities: []
  };

  const add = (item) => base.opportunities.push({
    priority: item.priority || "medium",
    title: item.title,
    value: item.value,
    trigger: item.trigger,
    suggestedAction: item.suggestedAction,
    humanControl: item.humanControl || "Human can approve, edit, delay or override before anything sensitive is sent.",
    channel: item.channel || "Mission Control + WhatsApp",
    llmJob: item.llmJob
  });

  if (role === "principal") {
    add({
      priority: "high",
      title: "Branch and province performance intelligence",
      value: "Shows where leads, delays, protected deals and agent load are building up across provinces or branches.",
      trigger: "Daily and weekly rollup, or whenever the principal opens Mission Control.",
      suggestedAction: "Ask the LLM for the three biggest business risks and three highest-value opportunities from current rollups.",
      llmJob: "Compare branch, province and agent rollups; explain leakage, momentum and focus areas."
    });
    add({
      priority: "high",
      title: "Commission exposure watch",
      value: "Surfaces referral splits, missing proof, due dates and unpaid commission before money leaks out.",
      trigger: `${metrics.protectedDeals || snapshot.commissionTimeline.length} protected deal records visible.`,
      suggestedAction: "Generate a concise exposure brief and queue follow-ups for the responsible admin or agent.",
      llmJob: "Summarise protected deals by risk, due date, proof strength and next chase."
    });
    add({
      priority: "high",
      title: "Agent Network Directory intelligence",
      value: "Turns public-source agent data into province coverage, pilot candidates, matching pools and safe one-to-one outreach queues.",
      trigger: `${metrics.agentNetworkRecords || 0} directory record(s), ${metrics.agentNetworkNeedsVerification || 0} needing verification.`,
      suggestedAction: "Shortlist coverage gaps, verify public-source records and promote only outreach-ready agents into pilot invitations.",
      llmJob: "Score agents by source quality, contactability, area fit, service signals, province coverage and compliance status."
    });
    add({
      priority: "high",
      title: "Source-to-sale performance tracker",
      value: "Shows which sources produce qualified leads, viewings, offers, sales and protected commission instead of only counting enquiries.",
      trigger: `${snapshot.sourceToSale?.summary?.totalLeads || 0} visible leads across ${snapshot.sourceToSale?.bySource?.length || 0} source bucket(s).`,
      suggestedAction: "Ask the LLM which sources deserve more attention and which are creating admin noise.",
      llmJob: "Compare source-to-sale conversion by website, WhatsApp, referral, portal, agent import and future Google Ads."
    });
    add({
      priority: "high",
      title: "Agent Success Desk and Lead Action Centre",
      value: "Turns every lead into an action card: missing info, WhatsApp draft, protection status, Deal Room need and responsible person.",
      trigger: `${metrics.leadActions || 0} lead action card(s), ${metrics.criticalLeadActions || 0} critical.`,
      suggestedAction: "Work the critical actions first, then use the agent success summary to coach or reassign load.",
      llmJob: "Convert lead quality, tasks, comms, protection and Deal Room state into a ranked action list."
    });
    add({
      priority: "high",
      title: "Axiom Case Brain",
      value: "Connects lead score, comms memory, valuation consent, Deal Room summaries, Friday seller updates, post-viewing feedback, service pulse, 25% commission protection, principal intelligence, agent matching and next action into one case file.",
      trigger: `${metrics.caseBrainTotal || 0} case brain(s), ${metrics.caseBrainHumanOverride || 0} needing human override, ${metrics.caseBrainValuationOffers || 0} valuation offer(s), ${metrics.caseBrainSellerUpdates || 0} Friday update(s), ${metrics.caseBrainFeedbackRequests || 0} feedback request(s), ${metrics.caseBrainCommissionProtections || 0} commission protection item(s), ${metrics.caseBrainAgentMatches || 0} agent match(es).`,
      suggestedAction: "Use the Case Brain before every client-facing WhatsApp, valuation guide, agent brief, seller update, feedback request, Deal Room share, commission chase or agent assignment.",
      llmJob: "Read one case file, explain the current state, draft the right next message, and flag where human judgement or approval is needed."
    });
    add({
      priority: "high",
      title: "Client Service Pulse and quarterly recognition",
      value: "Uses buyer and seller feedback to spot service risk, reward strong agents and improve future lead matching.",
      trigger: `${metrics.servicePulseCount || 0} service pulse records, ${metrics.servicePulseRecovery || 0} needing recovery.`,
      suggestedAction: "Review recovery items first, then use the quarterly candidate table for internal recognition.",
      llmJob: "Summarise feedback patterns by agent, branch, province and trigger point."
    });
    add({
      priority: "high",
      title: "WhatsApp pilot readiness",
      value: "Keeps real-agent WhatsApp testing controlled before the product is exposed to a wider group.",
      trigger: `${metrics.pilotAgents || 0} pilot agent(s), ${metrics.pilotIssues || 0} open pilot issue(s).`,
      suggestedAction: "Clear open issues, then send the next pilot scenario to opted-in agents.",
      llmJob: "Summarise pilot readiness, failed scenarios, wording issues and rollout risk."
    });
  }

  if (role === "office_admin") {
    add({
      priority: "high",
      title: "Axiom Case Brain",
      value: "Gives the concierge one case truth before drafting WhatsApp replies, asking missing questions, offering the valuation guide, preparing Friday seller updates, requesting viewing feedback, protecting commission, sharing Deal Rooms or escalating to a human.",
      trigger: `${metrics.caseBrainTotal || 0} case brain(s), ${metrics.caseBrainHumanOverride || 0} human override item(s), ${metrics.caseBrainValuationOffers || 0} valuation offer(s), ${metrics.caseBrainSellerUpdates || 0} Friday update(s), ${metrics.caseBrainFeedbackRequests || 0} feedback request(s), ${metrics.caseBrainDealRoomSummaries || 0} Deal Room summary item(s), ${metrics.caseBrainPrincipalAlerts || 0} admin alert(s).`,
      suggestedAction: "Open the highest-risk Case Brain first, then clear missing fields, request approval, send the next WhatsApp draft, share the Deal Room, protect commission, or route to the best-fit agent.",
      llmJob: "Summarise case memory, lead quality, valuation readiness, seller update readiness, feedback status, Deal Room readiness, protection risk, agent match and the next safest concierge action."
    });
    add({
      priority: "high",
      title: "Concierge morning control brief",
      value: "One admin can see which agents, sellers, buyers and transfer parties need action today.",
      trigger: `${metrics.openTasks || 0} open tasks and ${metrics.pendingReminders || 0} pending reminders in scope.`,
      suggestedAction: "Draft a morning WhatsApp brief for each agent and an admin chase list for the concierge.",
      llmJob: "Turn tasks, reminders, comms and escalations into a ranked admin action list."
    });
    add({
      priority: "medium",
      title: "Seller update pack approval",
      value: "The seller gets looked after without the agent manually writing updates from memory.",
      trigger: "Friday 15:30, or whenever enough viewing/enquiry/feedback data exists.",
      suggestedAction: "Draft the concise seller update and ask the agent/admin for permission before sending.",
      llmJob: "Summarise enquiries, viewings, feedback and recommendation in a careful seller-friendly tone."
    });
    add({
      priority: "high",
      title: "Brief completeness desk",
      value: "Keeps weak or incomplete leads with the concierge until the missing questions are answered.",
      trigger: `${metrics.weakLeads || 0} weak and ${metrics.nurtureLeads || 0} nurture leads in scope.`,
      suggestedAction: "Generate missing-question WhatsApp prompts and only hand over well-briefed buy/sell cards.",
      llmJob: "Turn lead gaps into concise concierge questions and a clean handover card for the assigned agent."
    });
    add({
      priority: "high",
      title: "Lead Action Centre",
      value: "Stops leads from drifting by showing who must act, why, and what message should go next.",
      trigger: `${metrics.agentSuccessOpenActions || 0} open agent/concierge lead action(s).`,
      suggestedAction: "Queue the prepared WhatsApp draft, protect commission, or generate the Deal Room where needed.",
      llmJob: "Rank lead actions by urgency, handoff readiness, missing data and commercial risk."
    });
    add({
      priority: "medium",
      title: "Agent directory verification desk",
      value: "Keeps public-source agent records accurate before Axiom uses them for matching, pilots or business invitations.",
      trigger: `${metrics.agentNetworkNeedsVerification || 0} directory record(s) need verification in scope.`,
      suggestedAction: "Check source proof, mark verified, log outreach, or suppress the record if contact should not happen.",
      llmJob: "Summarise each sourced profile and recommend whether it is matching-only, outreach-ready or no-contact."
    });
    add({
      priority: "high",
      title: "Service recovery queue",
      value: "Catches buyer or seller frustration early so the concierge can step in before the relationship weakens.",
      trigger: `${metrics.servicePulseRecovery || 0} low service pulse record(s) in scope.`,
      suggestedAction: "Prepare a calm recovery note for the agent/admin to approve and log the outcome in comms.",
      llmJob: "Classify feedback, identify the likely friction point and draft a human-safe recovery action."
    });
    add({
      priority: "high",
      title: "Pilot Control Room",
      value: "Lets the concierge test WhatsApp flows with selected agents, log issues and pause the rollout when something is off.",
      trigger: `${metrics.pilotActive || 0} active WhatsApp pilot agent(s) in scope.`,
      suggestedAction: "Queue one scenario at a time and only mark it passed once the agent confirms the flow works.",
      llmJob: "Turn pilot replies and issues into a short fix list before the next test round."
    });
  }

  if (role === "agent") {
    add({
      priority: "high",
      title: "Personal AI Assistant bot for the agent",
      value: "Keeps the agent focused on selling while Axiom handles reminders, drafts, qualification and follow-up.",
      trigger: "Every new lead, missed update, viewing reminder, feedback gap or document request.",
      suggestedAction: "Generate the agent's next three actions and prepare WhatsApp drafts for approval.",
      llmJob: "Summarise assigned cases, identify stale items and draft short WhatsApp messages."
    });
    add({
      priority: "high",
      title: "Protect commission at the right moment",
      value: "Turns referral protection into a habit, not an afterthought.",
      trigger: "Lead accepted, viewing booked, offer stage reached, or referral terms missing.",
      suggestedAction: "Prompt the agent to protect commission and capture split proof before the deal moves too far.",
      llmJob: "Explain what evidence is missing and draft the acceptance/chase message."
    });
    add({
      priority: "high",
      title: "Well-briefed buy/sell card",
      value: "The agent receives the client context, quality band, missing risks and next action before the first call.",
      trigger: "When concierge marks a lead warm/hot or closes the missing brief items.",
      suggestedAction: "Show the brief card first, not raw form answers.",
      llmJob: "Compress the intake, concierge answers and source context into a focused agent handover card."
    });
    add({
      priority: "high",
      title: "Agent Success Desk",
      value: "Gives the agent one place to see priority clients, next actions, WhatsApp drafts, Deal Room gaps and protection status.",
      trigger: `${metrics.agentSuccessOpenActions || 0} open action(s) in the agent success view.`,
      suggestedAction: "Work the top action, queue the prepared draft, then log the outcome.",
      llmJob: "Explain what to do next for each assigned client and why it matters."
    });
    add({
      priority: "medium",
      title: "Seller demand snapshot",
      value: "Gives the agent a seller-ready view of enquiry level, buyer type, suburb demand, feedback, price sensitivity and next move.",
      trigger: `${snapshot.sellerDemandSnapshots?.length || 0} seller demand snapshot(s) in this workspace.`,
      suggestedAction: "Use the snapshot before the seller update so the message feels specific and commercially useful.",
      llmJob: "Turn enquiries, viewing feedback and lead signals into a concise seller demand update."
    });
    add({
      priority: "medium",
      title: "Personal service score coaching",
      value: "Shows where buyers and sellers feel well served, and where Axiom should help the agent recover or communicate better.",
      trigger: `${metrics.avgServicePulse || 0}/10 average service pulse in this workspace.`,
      suggestedAction: "Use the patterns in the weekly agent scorecard, not as public ratings.",
      llmJob: "Turn feedback into three coaching actions and one client recovery suggestion where needed."
    });
  }

  if (role === "seller") {
    add({
      priority: "high",
      title: "Seller confidence concierge",
      value: "Reduces anxiety by explaining what happened, what is outstanding and what happens next.",
      trigger: "After a viewing, weekly update, valuation request or status change.",
      suggestedAction: "Draft a calm progress note and ask whether the seller wants a specialist review.",
      llmJob: "Translate case activity into a reassuring seller update with one clear next step."
    });
    add({
      priority: "high",
      title: "Seller demand snapshot",
      value: "Shows the seller enquiry level, buyer type, suburb demand, viewing feedback, price sensitivity and the recommended next move.",
      trigger: "After intake, viewing activity, buyer feedback, or Friday seller update preparation.",
      suggestedAction: "Send a concise snapshot only when the agent/admin approves the wording.",
      llmJob: "Explain demand and feedback in plain seller-friendly language without overpromising."
    });
  }

  if (role === "buyer") {
    add({
      priority: "high",
      title: "Buyer readiness concierge",
      value: "Helps the buyer move faster by cleaning up finance, timing and property-fit uncertainty.",
      trigger: "Buyer intake, viewing booked, finance gap, or offer readiness check.",
      suggestedAction: "Ask only for the missing item and explain why it helps the buyer move with confidence.",
      llmJob: "Summarise buyer readiness, missing finance docs and next best property step."
    });
  }

  if (role === "attorney") {
    add({
      priority: "medium",
      title: "Transfer milestone summariser",
      value: "Keeps transfer updates understandable to non-lawyers without exposing unrelated office data.",
      trigger: "Missing transfer document, delayed certificate, signature window or registration milestone.",
      suggestedAction: "Draft a plain-language milestone update for the parties and the assigned agent.",
      llmJob: "Convert transfer status into clear, non-legalese next steps."
    });
  }

  if (role === "bond_originator") {
    add({
      priority: "medium",
      title: "Bond readiness summariser",
      value: "Keeps finance blockers visible before they slow the sale.",
      trigger: "Missing proof of income, pre-approval status change, valuation request or bond condition.",
      suggestedAction: "Draft a finance-readiness update and list exactly what remains outstanding.",
      llmJob: "Summarise bond status, missing documents and impact on the transaction timeline."
    });
  }

  base.rollupFocus = {
    provinces: rollups.provinces || {},
    branches: rollups.branches || {},
    agents: rollups.agents || {}
  };
  return base;
}

function buildOperationsSnapshot(sessionOrRole) {
  const operations = getOperationsState();
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  const visible = {
    organisations: filterVisible(operations.organisations, session),
    branches: filterVisible(operations.branches, session),
    partyUsers: filterVisible(operations.partyUsers, session),
    teamMembers: filterVisible(operations.teamMembers, session),
    tasks: filterVisible(operations.tasks, session),
    reminders: filterVisible(operations.reminders, session),
    escalations: filterVisible(operations.escalations, session),
    commissionTimeline: filterVisible(operations.commissionTimeline, session),
    dealRooms: filterVisible(operations.dealRooms, session),
    servicePulse: filterVisible(operations.servicePulse, session),
    pilotAgents: filterVisible(operations.pilotControl.agents, session),
    pilotScenarios: filterVisible(operations.pilotControl.scenarios, session),
    pilotMessageLog: filterVisible(operations.pilotControl.messageLog, session),
    pilotIssueLog: filterVisible(operations.pilotControl.issueLog, session),
    agentNetworkDirectory: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.directory, session)
      : [],
    agentNetworkOutreachLog: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.outreachLog, session)
      : [],
    agentNetworkImportBatches: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.importBatches, session)
      : [],
    queue: filterVisible(operations.whatsapp.queue, session),
    threads: filterVisible(operations.whatsapp.threads, session),
    feedbackLog: filterVisible(operations.whatsapp.feedbackLog, session),
    contactShareLog: filterVisible(operations.whatsapp.contactShareLog, session)
  };
  visible.leads = filterVisible(state.leads.map(withScopeDefaults), session);
  const queue = operations.whatsapp.queue || [];
  const visibleQueue = visible.queue || [];
  const deliveredToday = visibleQueue.filter((item) => item.status === "delivered").length;
  const queuedCount = visibleQueue.filter((item) => item.status === "queued").length;
  const awaitingApproval = visibleQueue.filter((item) => item.status === "awaiting_approval").length;
  const manualReady = visibleQueue.filter((item) => item.status === "manual_test_ready").length;
  const sendFailed = visibleQueue.filter((item) => item.status === "send_failed").length;
  const openTasks = visible.tasks.filter((task) => task.status === "open");
  const openEscalations = visible.escalations.length;
  const pendingReminders = visible.reminders.filter((item) => item.status !== "done").length;
  const rollups = buildScopedRollups(session, visible);
  const sourceToSale = buildSourceToSaleTracker(session, visible);
  const sellerDemandSnapshots = buildSellerDemandSnapshots(session, visible);
  const servicePulseRollups = buildServicePulseRollups(session, visible);
  const agentMatchingSignals = buildAgentMatchingSignals(session, visible, servicePulseRollups);
  const leadActionCentre = buildLeadActionCentre(session, visible, sourceToSale);
  const caseBrain = buildCaseBrainHub(session, visible, {
    sourceToSale,
    sellerDemandSnapshots,
    leadActionCentre,
    servicePulseRollups,
    agentMatchingSignals
  });
  const agentSuccessDesk = buildAgentSuccessDesk(session, visible, leadActionCentre, servicePulseRollups);
  const agentActionDigests = buildAgentActionDigests(session, visible, agentSuccessDesk, leadActionCentre, caseBrain);
  const financeControl = buildFinanceControlSnapshot(session, visible, leadActionCentre, agentSuccessDesk);
  const pilotControl = buildPilotControlSnapshot(session, visible);
  const agentNetworkDirectory = buildAgentNetworkDirectorySnapshot(session, visible);
  const scoredLeads = visible.leads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
  const avgLeadScore = scoredLeads.length
    ? Math.round(scoredLeads.reduce((total, lead) => total + Number(lead.leadQuality?.score || 0), 0) / scoredLeads.length)
    : 0;
  const snapshot = {
    organisations: visible.organisations,
    branches: visible.branches,
    partyUsers: visible.partyUsers,
    leads: visible.leads,
    teamMembers: visible.teamMembers,
    tasks: visible.tasks,
    reminders: visible.reminders,
    escalations: visible.escalations,
    commissionTimeline: visible.commissionTimeline,
    dealRooms: visible.dealRooms,
    servicePulse: visible.servicePulse,
    rollups,
    sourceToSale,
    sellerDemandSnapshots,
    caseBrain,
    servicePulseRollups,
    agentMatchingSignals,
    leadActionCentre,
    agentSuccessDesk,
    agentActionDigests,
    financeControl,
    pilotControl,
    agentNetworkDirectory,
    accessScope: getSessionScope(session),
    identity: {
      role: session.role,
      userId: session.userId,
      name: session.name,
      agencyId: session.agencyId,
      branchId: session.branchId,
      provinceId: session.provinceId
    },
    whatsapp: {
      bridge: operations.whatsapp.bridge,
      queue: visible.queue,
      threads: visible.threads,
      feedbackLog: visible.feedbackLog,
      contactShareLog: visible.contactShareLog,
      metrics: {
        deliveredToday,
        queuedCount,
        awaitingApproval,
        manualReady,
        sendFailed,
        totalOutbox: visibleQueue.length
      }
    },
    metrics: {
      openTasks: openTasks.length,
      openEscalations,
      pendingReminders,
      totalLeads: getScopedAnalytics(session).totalLeads,
      avgLeadScore,
      hotLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "hot").length,
      warmLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "warm").length,
      nurtureLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "nurture").length,
      weakLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "weak").length,
      sellerDemandSnapshots: sellerDemandSnapshots.length,
      caseBrainTotal: caseBrain.summary.totalCases,
      caseBrainHumanOverride: caseBrain.summary.humanOverride,
      caseBrainApprovals: caseBrain.summary.approvalNeeded,
      caseBrainValuationOffers: caseBrain.summary.valuationOffersReady,
      caseBrainSellerUpdates: caseBrain.summary.sellerUpdatesReady,
      caseBrainFeedbackRequests: caseBrain.summary.feedbackRequestsReady,
      caseBrainDealRoomSummaries: caseBrain.summary.dealRoomSummariesReady,
      caseBrainCommissionProtections: caseBrain.summary.commissionProtectionsNeeded,
      caseBrainPrincipalAlerts: caseBrain.summary.principalAlerts,
      caseBrainAgentMatches: caseBrain.summary.agentMatchesReady,
      servicePulseCount: servicePulseRollups.summary.total,
      avgServicePulse: servicePulseRollups.summary.avgScore,
      servicePulseRecovery: servicePulseRollups.summary.needsRecovery,
      quarterlyPrizeCandidates: servicePulseRollups.quarterlyPrizeCandidates.length,
      leadActions: leadActionCentre.summary.total,
      criticalLeadActions: leadActionCentre.summary.critical,
      agentSuccessOpenActions: agentSuccessDesk.summary.openActions,
      agentActionDigests: agentActionDigests.summary.total,
      agentDigestEmailMissing: agentActionDigests.summary.missingEmail,
      pilotAgents: pilotControl.metrics.totalAgents,
      pilotIssues: pilotControl.metrics.issues,
      pilotActive: pilotControl.metrics.active,
      agentNetworkRecords: agentNetworkDirectory.summary.total || 0,
      agentNetworkInviteReady: agentNetworkDirectory.summary.inviteReady || 0,
      agentNetworkNeedsVerification: agentNetworkDirectory.summary.needsVerification || 0,
      protectedDeals: visible.commissionTimeline.length,
      dealRooms: visible.dealRooms.length,
      budgetVsForecastGap: financeControl.forecast.variance,
      aiBudgetGap: financeControl.aiProjection.variance,
      sessionRole: session.role
    }
  };

  snapshot.aiValue = buildAiValueOpportunities(session, snapshot);
  return snapshot;
}

async function handleLeadCreate(request, response) {
  const body = await readBody(request, 2 * 1024 * 1024);
  const lead = createLeadRecord(body);
  state.leads.unshift(lead);
  const operations = getOperationsState();
  const ownerName = String(body?.acquisition?.owner || "").trim() || "Nadine Smit";
  const owner = findTeamMemberByName(ownerName);
  operations.tasks.unshift({
    id: createOpsId("task"),
    title: `${lead.leadQuality.handoffReady ? "Handoff" : "Qualify"} ${lead.label}`,
    caseName: lead.label,
    caseId: lead.id,
    ownerId: owner?.id || "admin-nadine",
    ownerName,
    role: owner?.role || "office_admin",
    category: "Lead intake",
    priority: "high",
    dueLabel: "Today",
    status: "open",
    nextAction: lead.leadQuality.conciergeAction,
    source: "Lead import"
  });
  const thread = ensureThread(lead.id, lead.label, [ownerName, lead.answerSummary["Client name"] || "Client"]);
  const clientAckBody = buildClientIntakeAcknowledgement(lead);
  const clientAckQueue =
    lead.contact?.mobile
      ? queueWhatsappMessage({
          caseId: lead.id,
          caseName: lead.label,
          threadId: thread.id,
          category: "public-intake-acknowledgement",
          toName: lead.briefCard?.clientName || lead.answerSummary["Client name"] || "Client",
          toRole: lead.intent === "sell" ? "seller" : "buyer",
          toContact: lead.contact.mobile,
          ownerName: "Axiom Concierge",
          body: clientAckBody,
          approvalRequired: false,
          agencyId: lead.agencyId,
          branchId: lead.branchId,
          provinceId: lead.provinceId,
          agentId: lead.agentId,
          assignedAgentId: lead.assignedAgentId
        })
      : null;
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    category: "public-intake-acknowledgement",
    body: clientAckQueue
      ? `Client acknowledgement queued for WhatsApp: ${clientAckBody}`
      : `Client acknowledgement prepared but no WhatsApp/mobile number was supplied: ${clientAckBody}`,
    at: nowIso(),
    status: clientAckQueue ? "queued" : "draft_stored"
  });
  const whatsappRuntime = getWhatsappRuntime();
  const clientAckDelivery = clientAckQueue ? await processWhatsappQueueItem(clientAckQueue, whatsappRuntime) : null;
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `${lead.label} was registered and assigned to ${ownerName}. Lead quality: ${lead.leadQuality.band} (${lead.leadQuality.score}/100). ${lead.briefCard.agentHandoffSummary}`,
    at: nowIso(),
    status: "logged"
  });
  if (lead.intent === "sell") {
    const sellerSnapshot = buildSellerDemandSnapshots("principal", { leads: [lead], tasks: [], dealRooms: [], threads: [], feedbackLog: [] })[0];
    if (sellerSnapshot) {
      addThreadMessage(thread, {
        id: createOpsId("wa"),
        direction: "system",
        author: "Axiom",
        category: "seller-demand-snapshot",
        body: `Gentle seller demand snapshot prepared and stored. ${sellerSnapshot.sellerMessageDraft}`,
        at: nowIso(),
        status: "draft_stored",
        learningSignals: sellerSnapshot.learningSignals,
        approvalRequired: true
      });
    }
  }
  const conciergeDraft = await generateConciergeDraft({
    purpose: lead.leadQuality.handoffReady
      ? "Draft the first concise WhatsApp handover note to the assigned estate agent."
      : "Draft the next concise concierge WhatsApp question to complete the missing lead brief.",
    audience: lead.leadQuality.handoffReady ? "assigned estate agent" : "property client",
    fallback: buildLeadWhatsappDraft(lead, {
      ownerName,
      missingItems: lead.leadQuality.missingItems || [],
      commissionProtected: false,
      dealRoomNeeded: false,
      serviceRecoveryNeeded: false,
      nextBestAction: lead.leadQuality.conciergeAction
    }),
    context: {
      leadId: lead.id,
      caseName: lead.label,
      intent: lead.intent,
      leadQuality: lead.leadQuality,
      briefCard: lead.briefCard,
      answerSummary: lead.answerSummary,
      humanApprovalRequired: true
    }
  });
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: conciergeDraft.usedLiveLlm ? "Axiom AI" : "Axiom",
    category: "ai-concierge-draft",
    body: conciergeDraft.text,
    at: nowIso(),
    status: "draft_stored",
    approvalRequired: true,
    llm: conciergeDraft.status
  });
  audit("lead-created", { leadId: lead.id, intent: lead.intent, label: lead.label, leadQuality: lead.leadQuality.band, source: normalizeLeadSource(lead) });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    sessionId: lead.id,
    leadId: lead.id,
    caseId: lead.id,
    delivered: false,
    queuedForManualHandoff: true,
    reason: "Lead stored, assigned, and moved into the admin action queue.",
    whatsapp: {
      mode: config.whatsappMode,
      provider: whatsappRuntime.provider,
      realDeliveryConnected: whatsappRuntime.liveDeliveryConnected,
      acknowledgementQueued: Boolean(clientAckQueue),
      acknowledgementStatus: clientAckDelivery?.status || clientAckQueue?.status || "draft_stored",
      acknowledgementDeliveryMode: clientAckDelivery?.deliveryMode || clientAckQueue?.deliveryMode || "not_available",
      acknowledgementText: clientAckBody,
      manualTestLink: clientAckDelivery?.manualLink || clientAckQueue?.manualLink || buildWhatsappClickLink(lead.contact?.mobile, clientAckBody),
      note:
        clientAckDelivery?.status === "delivered"
          ? "WhatsApp acknowledgement was delivered through the connected provider."
          : clientAckDelivery?.status === "manual_test_ready"
            ? "WhatsApp is in managed simulation. The message is stored and ready as a manual test link."
            : clientAckDelivery?.error || whatsappRuntime.status
    },
    leadQuality: lead.leadQuality,
    briefCard: lead.briefCard,
    publicOutcome: buildPublicIntakeOutcome(lead),
    sourceToSale: {
      sourceKey: normalizeLeadSource(lead),
      sourceLabel: sourceLabelForKey(normalizeLeadSource(lead)),
      currentStage: "registered"
    },
    analytics: getAnalytics()
  });
}

async function handleProtectCommission(request, response) {
  const session = requirePermission(request, response, ["commission.protect", "commission.view_all", "commission.view_assigned"]);
  if (!session) return;

  const body = await readBody(request);
  const caseName = String(body.caseName || "").trim();
  const split = String(body.split || "").trim();
  const agent = String(body.agent || "").trim();

  if (!caseName || !split || !agent) {
    sendJson(response, 400, { ok: false, error: "Case name, agent, and split are required." });
    return;
  }

  const operations = getOperationsState();
  const entry = createCommissionTimelineEntry(body);
  operations.commissionTimeline.unshift(entry);
  const thread = ensureThread(entry.caseId, entry.caseName, [agent, "Axiom"]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `Commission protection logged for ${entry.caseName}. ${entry.split}, due ${entry.dueDate}.`,
    at: nowIso(),
    status: "logged"
  });
  audit("commission-protected", {
    caseId: entry.caseId,
    caseName: entry.caseName,
    agent: entry.agent,
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, item: entry, snapshot: buildOperationsSnapshot(session) });
}

async function handleDealRoomShare(request, response) {
  const session = requirePermission(request, response, "dealroom.share");
  if (!session) return;

  const body = await readBody(request);
  const caseName = String(body.caseName || "").trim();
  const clientName = String(body.clientName || "").trim();
  const accessCode = String(body.accessCode || "").trim();
  const roomId = String(body.roomId || body.room || "").trim();

  if (!caseName || !clientName || !accessCode || !roomId) {
    sendJson(response, 400, { ok: false, error: "Case name, client name, room ID, and access code are required." });
    return;
  }

  const operations = getOperationsState();
  const record = createDealRoomRecord(body, request);
  operations.dealRooms = operations.dealRooms.filter((entry) => entry.roomId !== record.roomId);
  operations.dealRooms.unshift(record);
  const thread = ensureThread(record.caseId, record.caseName, [clientName, "Axiom"]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `Deal Room ${record.roomId} prepared for ${clientName}.`,
    at: nowIso(),
    status: "logged"
  });
  audit("deal-room-shared", {
    roomId: record.roomId,
    caseId: record.caseId,
    caseName: record.caseName,
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, room: record, snapshot: buildOperationsSnapshot(session) });
}

async function handlePublicDealRoomAccess(request, response) {
  const body = await readBody(request);
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const accessCode = String(body.accessCode || "").trim();

  if (!roomId || !accessCode) {
    sendJson(response, 400, { ok: false, error: "Room ID and access code are required." });
    return;
  }

  const operations = getOperationsState();
  const room = operations.dealRooms.find((entry) => entry.roomId === roomId);
  if (!room || !safeEquals(room.accessCode, accessCode)) {
    audit("deal-room-access-failed", { roomId });
    sendJson(response, 401, { ok: false, error: "That access code does not match this Deal Room." });
    return;
  }

  audit("deal-room-accessed", { roomId, caseId: room.caseId });
  sendJson(response, 200, {
    ok: true,
    room: {
      roomId: room.roomId,
      caseName: room.caseName,
      clientName: room.clientName,
      stage: room.stage,
      progress: room.progress,
      nextStep: room.nextStep,
      shareMessage: room.shareMessage,
      updatedAt: room.updatedAt
    }
  });
}

async function handlePublicServicePulse(request, response) {
  const body = await readBody(request);
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const accessCode = String(body.accessCode || "").trim();
  const score = normalizeServicePulseScore(body.score);

  if (!roomId || !accessCode) {
    sendJson(response, 400, { ok: false, error: "Room ID and access code are required." });
    return;
  }
  if (!score) {
    sendJson(response, 400, { ok: false, error: "Please provide a score from 1 to 10." });
    return;
  }

  const operations = getOperationsState();
  const room = operations.dealRooms.find((entry) => entry.roomId === roomId);
  if (!room || !safeEquals(room.accessCode, accessCode)) {
    audit("service-pulse-access-failed", { roomId });
    sendJson(response, 401, { ok: false, error: "That access code does not match this Deal Room." });
    return;
  }

  const record = createServicePulseRecord(
    {
      ...body,
      score,
      roomId,
      caseId: room.caseId,
      caseName: room.caseName,
      clientName: body.respondentName || room.clientName,
      source: body.source || "deal_room"
    },
    room
  );
  operations.servicePulse.unshift(record);
  storeServicePulseCommunication(record);
  audit("service-pulse-captured", {
    caseId: record.caseId,
    roomId,
    score: record.score,
    sentiment: record.sentiment,
    respondentRole: record.respondentRole
  });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    servicePulse: {
      id: record.id,
      caseName: record.caseName,
      touchpoint: record.touchpointLabel,
      score: record.score,
      sentiment: record.sentiment,
      stored: true
    }
  });
}

async function handleServicePulseCapture(request, response) {
  const session = requirePermission(request, response, [
    "service_pulse.capture",
    "service_pulse.view_all",
    "service_pulse.view_assigned",
    "scorecards.view_all",
    "scorecards.view_self"
  ]);
  if (!session) return;

  const body = await readBody(request);
  const score = normalizeServicePulseScore(body.score);
  if (!score) {
    sendJson(response, 400, { ok: false, error: "Please provide a score from 1 to 10." });
    return;
  }

  const operations = getOperationsState();
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const room = roomId ? operations.dealRooms.find((entry) => entry.roomId === roomId) : null;
  const record = createServicePulseRecord({ ...body, score, roomId }, room || {});
  if (!recordVisibleToScope(record, session)) {
    sendJson(response, 403, { ok: false, error: "This service pulse is outside your assigned scope." });
    return;
  }

  operations.servicePulse.unshift(record);
  storeServicePulseCommunication(record);
  audit("service-pulse-captured", {
    caseId: record.caseId,
    score: record.score,
    sentiment: record.sentiment,
    role: session.role,
    capturedBy: session.name
  });
  await persistState();
  sendJson(response, 200, { ok: true, item: record, snapshot: buildOperationsSnapshot(session) });
}

async function handlePilotControlAction(request, response) {
  const session = requirePermission(request, response, ["pilot.manage", "pilot.view_all"]);
  if (!session) return;

  const body = await readBody(request);
  const action = slugify(body.action || "").replace(/-/g, "_");
  const operations = getOperationsState();
  const control = getPilotControlState();
  const agent = findPilotAgent(control, body.agentId);
  const scenario = findPilotScenario(control, body.scenarioId);
  const createdAt = nowIso();

  if (!agent) {
    sendJson(response, 400, { ok: false, error: "Pilot agent is required." });
    return;
  }
  if (!recordVisibleToScope(agent, session)) {
    sendJson(response, 403, { ok: false, error: "This pilot agent is outside your assigned scope." });
    return;
  }

  let result = null;

  if (action === "queue_scenario") {
    if (!scenario) {
      sendJson(response, 400, { ok: false, error: "Pilot scenario is required." });
      return;
    }
    const bodyText = buildPilotMessageBody(agent, scenario);
    const queued = queueWhatsappMessage({
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      caseName: `Pilot test - ${agent.agentName}`,
      category: "pilot-scenario",
      toName: agent.agentName,
      toRole: "agent",
      toContact: agent.whatsappNumber || agent.mobile || "",
      ownerName: session.name || "Axiom",
      body: bodyText,
      scheduledFor: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      agentId: agent.agentId,
      assignedAgentId: agent.assignedAgentId || agent.agentId
    });
    agent.status = agent.status === "paused" ? "paused" : "active";
    agent.readiness = agent.readiness || "opted_in";
    agent.currentScenarioId = scenario.id;
    agent.nextTest = scenario.title;
    agent.lastScenarioAt = createdAt;
    const logItem = withScopeDefaults({
      id: createOpsId("pilot-msg"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      messageId: queued.id,
      status: "queued",
      channel: scenario.channel || "WhatsApp",
      body: bodyText,
      queuedAt: createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.messageLog.unshift(logItem);
    result = { queued, logItem };
  } else if (action === "mark_passed") {
    if (!scenario) {
      sendJson(response, 400, { ok: false, error: "Pilot scenario is required." });
      return;
    }
    const passed = unique([...(agent.scenariosPassed || []), scenario.id]);
    agent.scenariosPassed = passed;
    agent.currentScenarioId = scenario.id;
    agent.status = passed.length >= control.scenarios.length ? "passed" : "active";
    agent.readiness = "validated";
    agent.lastScenarioAt = createdAt;
    const logItem = withScopeDefaults({
      id: createOpsId("pilot-pass"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      status: "passed",
      channel: scenario.channel || "WhatsApp",
      body: `${agent.agentName} passed pilot scenario: ${scenario.title}.`,
      queuedAt: createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.messageLog.unshift(logItem);
    result = { logItem };
  } else if (action === "update_status") {
    agent.status = normalizePilotStatus(body.status);
    agent.readiness = String(body.readiness || agent.readiness || agent.status).trim();
    agent.updatedAt = createdAt;
    result = { agent };
  } else if (action === "log_issue") {
    const issueSummary = String(body.summary || body.issue || "").trim();
    if (!issueSummary) {
      sendJson(response, 400, { ok: false, error: "Issue summary is required." });
      return;
    }
    const issue = withScopeDefaults({
      id: createOpsId("pilot-issue"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario?.id || agent.currentScenarioId || "",
      scenarioTitle: scenario?.title || agent.nextTest || "Pilot scenario",
      severity: String(body.severity || "medium").trim(),
      summary: issueSummary,
      status: "open",
      ownerName: session.name || "Axiom",
      createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.issueLog.unshift(issue);
    agent.status = "issue";
    agent.issueCount = Number(agent.issueCount || 0) + 1;
    agent.updatedAt = createdAt;
    const thread = ensureThread(issue.caseId, `Pilot test - ${agent.agentName}`, [agent.agentName, session.name || "Axiom"]);
    addThreadMessage(thread, {
      id: createOpsId("wa"),
      direction: "system",
      author: "Axiom",
      category: "pilot-issue",
      body: `Pilot issue logged for ${agent.agentName}: ${issue.summary}`,
      at: createdAt,
      status: "logged"
    });
    result = { issue };
  } else {
    sendJson(response, 400, { ok: false, error: "Unknown pilot action." });
    return;
  }

  operations.whatsapp.bridge.lastHeartbeatAt = createdAt;
  audit("pilot-control-action", {
    action,
    agentId: agent.agentId,
    scenarioId: scenario?.id || "",
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, result, snapshot: buildOperationsSnapshot(session) });
}

function findAgentNetworkRecord(directory, recordId) {
  const id = String(recordId || "").trim();
  return directory.find((record) => {
    return (
      record.id === id ||
      record.contact?.email === normalizeEmail(id) ||
      record.contact?.whatsapp === id ||
      record.contact?.mobile === id ||
      record.agentName === id
    );
  }) || null;
}

function findAgentNetworkDuplicate(directory, candidate) {
  const email = candidate.contact?.email;
  const whatsapp = candidate.contact?.whatsapp;
  const sourceUrl = candidate.source?.url;
  return directory.find((record) => {
    if (email && record.contact?.email === email) return true;
    if (whatsapp && record.contact?.whatsapp === whatsapp) return true;
    if (sourceUrl && record.source?.url === sourceUrl) return true;
    return false;
  }) || null;
}

function mergeAgentNetworkRecord(existing, candidate) {
  const merged = normalizeAgentNetworkRecord({
    ...existing,
    ...candidate,
    contact: { ...(existing.contact || {}), ...(candidate.contact || {}) },
    source: { ...(existing.source || {}), ...(candidate.source || {}) },
    consent: { ...(existing.consent || {}), ...(candidate.consent || {}) },
    verification: { ...(existing.verification || {}), ...(candidate.verification || {}) },
    outreach: { ...(existing.outreach || {}), ...(candidate.outreach || {}) },
    matchingSignals: { ...(existing.matchingSignals || {}), ...(candidate.matchingSignals || {}) },
    towns: unique([...(existing.towns || []), ...(candidate.towns || [])]),
    suburbs: unique([...(existing.suburbs || []), ...(candidate.suburbs || [])]),
    specialties: unique([...(existing.specialties || []), ...(candidate.specialties || [])]),
    languages: unique([...(existing.languages || []), ...(candidate.languages || [])]),
    updatedAt: nowIso()
  });
  Object.keys(existing).forEach((key) => delete existing[key]);
  Object.assign(existing, merged);
  return existing;
}

function upsertAgentNetworkRecord(directory, payload, session) {
  const candidate = normalizeAgentNetworkRecord({
    ...payload,
    source: {
      ...(payload.source || {}),
      capturedBy: payload.source?.capturedBy || session.name || "Axiom"
    }
  });
  const duplicate = findAgentNetworkDuplicate(directory, candidate);
  if (duplicate) {
    return { record: mergeAgentNetworkRecord(duplicate, candidate), created: false };
  }
  directory.unshift(candidate);
  return { record: candidate, created: true };
}

function agentNetworkActionAllowed(session, permissions = []) {
  return hasAnyPermission(session.role, permissions);
}

async function handleAgentNetworkSnapshot(request, response) {
  const session = requirePermission(request, response, ["agent_directory.view_all", "agent_directory.view_assigned"]);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    agentNetworkDirectory: buildAgentNetworkDirectorySnapshot(session)
  });
}

async function handleAgentNetworkAction(request, response) {
  const session = requirePermission(request, response, ["agent_directory.manage", "agent_directory.outreach"]);
  if (!session) return;

  const body = await readBody(request, 2 * 1024 * 1024);
  const action = String(body.action || "").trim().toLowerCase();
  const operations = getOperationsState();
  const directory = operations.agentNetwork.directory;
  const createdAt = nowIso();
  let result = {};

  if (action === "add_record") {
    if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
      sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
      return;
    }
    const payload = body.record && typeof body.record === "object" ? body.record : body;
    const upsert = upsertAgentNetworkRecord(directory, payload, session);
    result = { record: computeAgentNetworkRecord(upsert.record), created: upsert.created };
    audit("agent-network-record-upserted", { id: upsert.record.id, created: upsert.created, role: session.role });
  } else if (action === "import_batch") {
    if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
      sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
      return;
    }
    const records = Array.isArray(body.records) ? body.records.slice(0, 200) : [];
    if (!records.length) {
      sendJson(response, 400, { ok: false, error: "Import batch requires at least one record." });
      return;
    }
    let createdCount = 0;
    let updatedCount = 0;
    records.forEach((record) => {
      const upsert = upsertAgentNetworkRecord(directory, {
        ...record,
        source: {
          ...(record.source || {}),
          type: record.source?.type || body.sourceType || "public_domain",
          name: record.source?.name || body.sourceName || "Public source",
          capturedAt: createdAt
        }
      }, session);
      if (upsert.created) createdCount += 1;
      else updatedCount += 1;
    });
    const batch = withScopeDefaults({
      id: createOpsId("network-batch"),
      caseId: `agent-network-${slugify(body.name || "batch") || randomBytes(2).toString("hex")}`,
      name: String(body.name || "Agent network import").trim(),
      sourceType: String(body.sourceType || "public_domain").trim(),
      recordCount: records.length,
      acceptedCount: records.length,
      rejectedCount: 0,
      createdCount,
      updatedCount,
      createdAt,
      ownerName: session.name,
      agencyId: session.agencyId,
      branchId: session.branchId,
      provinceId: session.provinceId
    });
    operations.agentNetwork.importBatches.unshift(batch);
    result = { batch, createdCount, updatedCount };
    audit("agent-network-batch-imported", { count: records.length, createdCount, updatedCount, role: session.role });
  } else {
    const record = findAgentNetworkRecord(directory, body.recordId);
    if (!record) {
      sendJson(response, 404, { ok: false, error: "Agent network record not found." });
      return;
    }

    if (action === "mark_verified") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
        return;
      }
      record.verification = {
        ...(record.verification || {}),
        status: normalizeVerificationStatus(body.status || "verified", "verified"),
        lastVerifiedAt: createdAt,
        verifiedBy: session.name || session.role,
        reviewNote: String(body.reviewNote || "Source and contact details reviewed.").trim()
      };
      record.updatedAt = createdAt;
      result = { record: computeAgentNetworkRecord(record) };
      audit("agent-network-record-verified", { id: record.id, status: record.verification.status, role: session.role });
    } else if (action === "update_consent" || action === "set_no_contact") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
        return;
      }
      const doNotContact = action === "set_no_contact" ? true : Boolean(body.doNotContact ?? record.consent?.doNotContact);
      record.consent = {
        ...(record.consent || {}),
        emailStatus: normalizeConsentStatus(body.emailStatus || record.consent?.emailStatus),
        whatsappStatus: normalizeConsentStatus(body.whatsappStatus || record.consent?.whatsappStatus),
        doNotContact,
        optOutAt: doNotContact ? createdAt : body.optOutAt || record.consent?.optOutAt || "",
        optOutReason: String(body.reason || body.optOutReason || record.consent?.optOutReason || "").trim(),
        lawfulUseNote: String(body.lawfulUseNote || record.consent?.lawfulUseNote || "").trim()
      };
      record.updatedAt = createdAt;
      result = { record: computeAgentNetworkRecord(record) };
      audit("agent-network-consent-updated", { id: record.id, doNotContact, role: session.role });
    } else if (action === "log_outreach") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.outreach"])) {
        sendJson(response, 403, { ok: false, error: "Directory outreach permission is required." });
        return;
      }
      const view = computeAgentNetworkRecord(record);
      const queueMessage = Boolean(body.queueMessage);
      if (queueMessage && !view.outreachAllowed) {
        sendJson(response, 409, { ok: false, error: `This record is ${view.complianceStatus}. Verify or update consent before queuing outreach.` });
        return;
      }
      const channel = String(body.channel || (view.hasWhatsapp ? "WhatsApp" : view.hasEmail ? "Email" : "Manual")).trim();
      const entry = withScopeDefaults({
        id: createOpsId("network-outreach"),
        caseId: `agent-network-${record.id}`,
        recordId: record.id,
        agentName: record.agentName,
        agencyName: record.agencyName,
        channel,
        purpose: String(body.purpose || "pilot_invitation").trim(),
        status: queueMessage ? "queued_for_approval" : String(body.status || "logged").trim(),
        note: String(body.note || body.message || "").trim(),
        ownerName: session.name || session.role,
        createdAt,
        agencyId: record.agencyId,
        branchId: record.branchId,
        provinceId: record.provinceId
      });
      operations.agentNetwork.outreachLog.unshift(entry);
      record.outreach = {
        ...(record.outreach || {}),
        status: entry.status,
        count: Number(record.outreach?.count || 0) + 1,
        lastContactedAt: createdAt,
        lastChannel: channel
      };
      record.updatedAt = createdAt;
      let queued = null;
      if (queueMessage) {
        queued = queueWhatsappMessage({
          caseId: entry.caseId,
          caseName: `Agent Network - ${record.agentName}`,
          category: "agent-network-invite",
          toName: record.agentName,
          toRole: "external_agent",
          toContact: record.contact?.whatsapp || record.contact?.mobile || record.mobile || "",
          ownerName: session.name || "Axiom",
          body: String(body.message || `Hi ${record.agentName}. Axiom is building a controlled estate-agent pilot in ${record.province}. Would you be open to a short WhatsApp introduction? Reply STOP if you prefer not to be contacted.`).trim(),
          approvalRequired: true,
          agencyId: record.agencyId,
          branchId: record.branchId,
          provinceId: record.provinceId
        });
      }
      result = { entry, queued, record: computeAgentNetworkRecord(record) };
      audit("agent-network-outreach-logged", { id: record.id, channel, queued: Boolean(queued), role: session.role });
    } else if (action === "promote_to_pilot") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.outreach", "pilot.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory outreach permission is required." });
        return;
      }
      const view = computeAgentNetworkRecord(record);
      if (!view.pilotInviteReady && !body.override) {
        sendJson(response, 409, { ok: false, error: `Pilot invite is not ready yet: ${view.nextAction}` });
        return;
      }
      const control = getPilotControlState();
      const pilotAgentId = `pilot-${slugify(record.agentName) || randomBytes(2).toString("hex")}`;
      let pilot = control.agents.find((agent) => agent.sourceRecordId === record.id || agent.agentName === record.agentName);
      if (!pilot) {
        pilot = withScopeDefaults({
          id: pilotAgentId,
          caseId: `pilot-${record.id}`,
          sourceRecordId: record.id,
          agentId: record.id,
          assignedAgentId: record.id,
          agentName: record.agentName,
          agencyName: record.agencyName,
          branchId: record.branchId,
          provinceId: record.provinceId,
          whatsappNumber: record.contact?.whatsapp || record.contact?.mobile || "",
          status: "invited",
          readiness: "awaiting_opt_in",
          scenariosPassed: [],
          currentScenarioId: "scenario-seller-lead",
          nextTest: "Confirm opt-in, then run a controlled seller-lead scenario.",
          issueCount: 0,
          lastScenarioAt: "",
          notes: "Promoted from Agent Network Directory."
        });
        control.agents.unshift(pilot);
      }
      record.outreach = {
        ...(record.outreach || {}),
        pilotStatus: "invited",
        status: "pilot_invited"
      };
      record.updatedAt = createdAt;
      result = { pilot, record: computeAgentNetworkRecord(record) };
      audit("agent-network-promoted-to-pilot", { id: record.id, pilotId: pilot.id, role: session.role });
    } else {
      sendJson(response, 400, { ok: false, error: "Unknown agent network action." });
      return;
    }
  }

  await persistState();
  sendJson(response, 200, {
    ok: true,
    result,
    agentNetworkDirectory: buildAgentNetworkDirectorySnapshot(session),
    snapshot: buildOperationsSnapshot(session)
  });
}

function handleAnalytics(request, response) {
  const session = requirePermission(request, response, ["analytics.view_all", "analytics.view_self"]);
  if (!session) return;
  sendJson(response, 200, { ok: true, analytics: getScopedAnalytics(session), role: session.role });
}

function handleAppStatus(_request, response) {
  const whatsapp = getWhatsappRuntime();
  const otp = getOtpRuntime(whatsapp);
  const email = getEmailRuntime();
  sendJson(response, 200, {
    ok: true,
    service: "axiom-realty-ai-backend",
    version: config.appVersion,
    environment: config.environment,
    runtime: config.isRenderRuntime ? "render" : "local",
    whatsappMode: whatsapp.mode,
    whatsappProvider: whatsapp.provider,
    whatsappRealDeliveryConnected: whatsapp.liveDeliveryConnected,
    whatsappManualTestReady: whatsapp.manualTestReady,
    whatsappMissing: whatsapp.missing,
    whatsappStatus: whatsapp.status,
    otpProvider: otp.provider,
    otpPreviewEnabled: otp.previewEnabled,
    otpLiveDeliveryConnected: otp.liveDeliveryConnected,
    otpStatus: otp.status,
    emailProvider: email.provider,
    emailLiveDeliveryConnected: email.liveDeliveryConnected,
    emailStatus: email.status,
    operationalReadiness: getOperationalReadiness(),
    checkedAt: new Date().toISOString()
  });
}

function handleSystemStatus(request, response) {
  const session = requirePermission(request, response, "system.view");
  if (!session) return;
  Promise.resolve()
    .then(async () => {
      const store = await ensureStorage();
      const storageDiagnostics = await store.diagnostics();
      const whatsapp = getWhatsappRuntime();
      const otp = getOtpRuntime(whatsapp);
      sendJson(response, 200, {
        ok: true,
        role: session.role,
        diagnostics: {
          uptimeSeconds: Math.round(process.uptime()),
          leadsStored: state.leads.length,
          activeSessions: state.sessions.length,
          deployment: {
            runtime: config.isRenderRuntime ? "render" : "local",
            hostBinding: config.host,
            port: config.port,
            publicBaseUrl: config.publicBaseUrl || null,
            cookieSecure: config.cookieSecure,
            otpPreviewEnabled: config.otpPreviewEnabled,
            accessKeyFallbackEnabled: true,
            accessKeySources: config.accessKeySources
          },
          storage: storageDiagnostics,
          whatsapp: {
            mode: getOperationsState().whatsapp.bridge.mode,
            provider: whatsapp.provider,
            connected: whatsapp.liveDeliveryConnected,
            manualTestReady: whatsapp.manualTestReady,
            missing: whatsapp.missing,
            status: whatsapp.status,
            queued: getOperationsState().whatsapp.queue.filter((item) => item.status === "queued").length,
            awaitingApproval: getOperationsState().whatsapp.queue.filter((item) => item.status === "awaiting_approval").length,
            manualTestReadyCount: getOperationsState().whatsapp.queue.filter((item) => item.status === "manual_test_ready").length,
            failed: getOperationsState().whatsapp.queue.filter((item) => item.status === "send_failed").length
          },
          otp: {
            provider: otp.provider,
            previewEnabled: otp.previewEnabled,
            liveDeliveryConnected: otp.liveDeliveryConnected,
            missing: otp.missing,
            status: otp.status
          },
          agentNetwork: {
            directoryRecords: getOperationsState().agentNetwork.directory.length,
            outreachLog: getOperationsState().agentNetwork.outreachLog.length,
            importBatches: getOperationsState().agentNetwork.importBatches.length
          },
          llm: getLlmStatus(),
          readiness: getOperationalReadiness(storageDiagnostics)
        }
      });
    })
    .catch((error) => {
      sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Storage diagnostics failed." });
    });
}

function buildStateReportingSnapshot(session) {
  const snapshot = buildOperationsSnapshot(session);
  const metrics = snapshot.metrics || {};
  const sourceToSale = snapshot.sourceToSale || {};
  const servicePulse = snapshot.servicePulseRollups || { summary: {}, byAgent: [] };

  return {
    mode: "state",
    available: true,
    source: "scoped operations snapshot",
    generatedAt: new Date().toISOString(),
    scope: getSessionScope(session),
    totals: {
      leads: metrics.totalLeads || snapshot.leads?.length || 0,
      cases: metrics.caseBrainTotal || snapshot.dealRooms?.length || 0,
      tasks: metrics.openTasks || 0,
      reminders: metrics.pendingReminders || 0,
      escalations: metrics.openEscalations || 0,
      commissionItems: metrics.protectedDeals || 0,
      dealRooms: metrics.dealRooms || 0,
      communications: snapshot.whatsapp?.queue?.length || 0,
      servicePulse: metrics.servicePulseCount || 0,
      agentNetworkRecords: metrics.agentNetworkRecords || 0
    },
    momentum: {
      leads7d: sourceToSale.summary?.newLeads7d || 0
    },
    rollups: {
      national: {
        label: "Current scope",
        leads: metrics.totalLeads || 0,
        cases: metrics.caseBrainTotal || 0,
        openTasks: metrics.openTasks || 0,
        protectedDeals: metrics.protectedDeals || 0,
        avgServiceScore: servicePulse.summary?.avgScore || 0,
        recoveryItems: servicePulse.summary?.needsRecovery || 0
      },
      agencies: Object.entries(snapshot.rollups?.agencies || {}).map(([label, count]) => ({ label, leads: count })),
      branches: Object.entries(snapshot.rollups?.branches || {}).map(([label, count]) => ({ label, leads: count })),
      provinces: Object.entries(snapshot.rollups?.provinces || {}).map(([label, count]) => ({ label, leads: count })),
      agents: (servicePulse.byAgent || []).map((agent) => ({
        id: agent.agentId || agent.agentName,
        label: agent.agentName,
        leads: 0,
        cases: 0,
        avgServiceScore: agent.avgScore,
        recoveryItems: agent.needsRecovery
      }))
    },
    pipeline: {
      sourceToSale: sourceToSale.bySource || []
    },
    protection: {
      total: metrics.protectedDeals || 0,
      attention: metrics.caseBrainCommissionProtections || 0
    },
    communications: {
      total: snapshot.whatsapp?.queue?.length || 0,
      queued: snapshot.whatsapp?.metrics?.queuedCount || 0,
      awaitingApproval: snapshot.whatsapp?.metrics?.awaitingApproval || 0,
      delivered: snapshot.whatsapp?.metrics?.deliveredToday || 0
    },
    servicePulse: {
      total: servicePulse.summary?.total || 0,
      avgScore: servicePulse.summary?.avgScore || 0,
      recovery: servicePulse.summary?.needsRecovery || 0,
      byAgent: servicePulse.byAgent || []
    }
  };
}

function handleReportingSnapshot(request, response) {
  const session = requirePermission(request, response, ["rollups.view_all", "rollups.view_assigned", "analytics.view_all"]);
  if (!session) return;

  Promise.resolve()
    .then(async () => {
      const store = await ensureStorage();
      const reporting = typeof store.reportingSnapshot === "function"
        ? await store.reportingSnapshot({ session, scope: getSessionScope(session) })
        : buildStateReportingSnapshot(session);

      sendJson(response, 200, {
        ok: true,
        role: session.role,
        identity: {
          role: session.role,
          userId: session.userId,
          name: session.name,
          agencyId: session.agencyId,
          branchId: session.branchId,
          provinceId: session.provinceId
        },
        scope: getSessionScope(session),
        reporting: reporting?.available === false ? buildStateReportingSnapshot(session) : reporting
      });
    })
    .catch((error) => {
      sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Reporting snapshot failed." });
    });
}

function createPrincipalOnboardingRecord(payload = {}, session = {}) {
  const createdAt = nowIso();
  const agencyName = String(payload.agencyName || payload.agency || "Agency to confirm").trim();
  const branchName = String(payload.branchName || payload.branch || payload.town || "Main branch").trim();
  const provinceId = normalizeProvinceId(payload.province || payload.provinceId || "north-west");
  const province = formatProvinceLabel(provinceId);
  const town = String(payload.town || branchName).trim();
  const principalName = String(payload.principalName || payload.name || "Principal to confirm").trim();
  const principalEmail = normalizeEmail(payload.principalEmail || payload.email);
  const principalMobile = normalizeContactNumber(payload.principalMobile || payload.mobile || payload.whatsapp);
  const principalContact = normalizeSigninContact(principalEmail || principalMobile);
  const agencyId = String(payload.agencyId || `agency-${slugify(agencyName)}`).trim();
  const branchId = String(payload.branchId || `branch-${slugify(agencyName)}-${slugify(branchName)}`).trim();
  const principalId = String(payload.principalId || `principal-${slugify(principalName)}-${slugify(agencyName)}`).trim();
  const agentSeats = Math.max(0, Number(payload.agentSeats || payload.agentCount || 0));
  const adminSeats = Math.max(0, Number(payload.adminSeats || payload.adminCount || 0));
  const packageLabel = String(payload.packageLabel || payload.package || "Axiom agent operating system").trim();
  const scope = {
    allAccess: false,
    agencyIds: [agencyId],
    branchIds: [branchId],
    provinceIds: [provinceId],
    agentIds: [],
    caseIds: []
  };

  if (!principalContact) {
    throw new Error("Principal email or mobile is required before access can be created.");
  }

  return {
    createdAt,
    agency: {
      id: agencyId,
      name: agencyName,
      provinceIds: [provinceId],
      branchIds: [branchId],
      status: "onboarding",
      onboarding: {
        signedUpAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        createdBy: session.name || session.userId || "Axiom"
      }
    },
    branch: {
      id: branchId,
      agencyId,
      name: branchName,
      town,
      provinceId,
      province,
      adminIds: [],
      agentIds: [],
      status: "onboarding"
    },
    principal: {
      id: principalId,
      name: principalName,
      role: "principal",
      agencyId,
      branchId,
      provinceId,
      scope,
      lane: `${branchName} / principal`,
      contact: principalContact,
      email: principalEmail,
      mobile: principalMobile,
      whatsapp: principalMobile,
      status: "invited",
      onboarding: {
        invitedAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        firstLogin: "OTP required",
        nextStep: "Principal signs in, confirms branch setup, then adds admins and agents."
      },
      responsibilities: [
        "Approve branch setup",
        "Invite office admin and agents",
        "Review agency, branch, province and agent rollups"
      ]
    }
  };
}

function isPartyRole(role) {
  return ["buyer", "seller", "attorney", "bond_originator"].includes(normalizeRole(role));
}

function roleOnboardingName(payload = {}, role = "principal") {
  return String(
    payload.personName ||
      payload.principalName ||
      payload.agentName ||
      payload.adminName ||
      payload.clientName ||
      payload.name ||
      `${getRoleProfile(role).label} to confirm`
  ).trim();
}

function roleOnboardingContact(payload = {}) {
  const email = normalizeEmail(
    payload.email ||
      payload.principalEmail ||
      payload.agentEmail ||
      payload.adminEmail ||
      payload.clientEmail
  );
  const mobile = normalizeContactNumber(
    payload.mobile ||
      payload.whatsapp ||
      payload.phone ||
      payload.principalMobile ||
      payload.agentMobile ||
      payload.adminMobile ||
      payload.clientMobile
  );
  return {
    email,
    mobile,
    contact: normalizeSigninContact(email || mobile)
  };
}

function truthyConsent(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return value === true || ["1", "true", "yes", "y", "on", "consent", "agreed"].includes(normalized);
}

function createProfileImageRecord(payload = {}, createdAt = nowIso()) {
  const url = String(payload.profileImageUrl || payload.selfieUrl || payload.photoUrl || "").trim();
  const consentGiven = truthyConsent(payload.profileImageConsent || payload.selfieConsent || payload.photoConsent);
  const status = url && consentGiven ? "active" : url ? "pending_consent" : "requested";

  return {
    status,
    url,
    source: url ? "operator_supplied" : "whatsapp_selfie_request",
    consentGiven,
    requestedAt: createdAt,
    consentText:
      "I consent to Axiom storing this selfie/profile image so the correct people can recognise each other in this property matter or office workspace.",
    purpose: "Profile recognition and correct-party context only. Not facial recognition or biometric identity scoring."
  };
}

function buildRoleScope({ role, agencyId, branchId, provinceId, agentId, caseId, extraAgentIds = [], extraCaseIds = [] }) {
  const normalizedRole = normalizeRole(role);
  const agencyIds = unique(agencyId);
  const branchIds = unique(branchId);
  const provinceIds = unique(provinceId);
  const agentIds = normalizedRole === "agent" ? unique([agentId]) : unique([agentId, ...extraAgentIds]);
  const caseIds = isPartyRole(normalizedRole) ? unique([caseId, ...extraCaseIds]) : unique(extraCaseIds);

  return {
    allAccess: false,
    agencyIds,
    branchIds,
    provinceIds,
    agentIds,
    caseIds
  };
}

function createRoleOnboardingRecord(payload = {}, session = {}) {
  const createdAt = nowIso();
  const role = normalizeRole(payload.role || payload.accessRole || "principal");
  const profile = getRoleProfile(role);
  const agencyName = String(payload.agencyName || payload.agency || "Agency to confirm").trim();
  const branchName = String(payload.branchName || payload.branch || payload.town || "Main branch").trim();
  const provinceId = normalizeProvinceId(payload.province || payload.provinceId || session.provinceId || "north-west");
  const province = formatProvinceLabel(provinceId);
  const town = String(payload.town || branchName).trim();
  const personName = roleOnboardingName(payload, role);
  const { email, mobile, contact } = roleOnboardingContact(payload);
  const agencyId = String(payload.agencyId || `agency-${slugify(agencyName)}`).trim();
  const branchId = String(payload.branchId || `branch-${slugify(agencyName)}-${slugify(branchName)}`).trim();
  const agentId = String(
    payload.agentId ||
      payload.assignedAgentId ||
      (role === "agent" ? `agent-${slugify(personName)}-${slugify(agencyName)}` : "")
  ).trim();
  const caseId = String(payload.caseId || payload.leadId || payload.dealRoomId || "").trim();
  const userId = String(
    payload.userId ||
      payload.personId ||
      `${role}-${slugify(personName)}-${slugify(isPartyRole(role) ? caseId || agencyName : agencyName)}`
  ).trim();
  const packageLabel = String(payload.packageLabel || payload.package || "Axiom Mission Control").trim();
  const agentSeats = Math.max(0, Number(payload.agentSeats || payload.agentCount || 0));
  const adminSeats = Math.max(0, Number(payload.adminSeats || payload.adminCount || 0));
  const extraAgentIds = ensureArray(payload.agentIds);
  const extraCaseIds = ensureArray(payload.caseIds);
  const scope = buildRoleScope({
    role,
    agencyId,
    branchId,
    provinceId,
    agentId,
    caseId,
    extraAgentIds,
    extraCaseIds
  });

  if (!contact) {
    throw new Error(`${profile.label} email or mobile is required before access can be created.`);
  }

  if (isPartyRole(role) && !scope.caseIds.length) {
    throw new Error(`${profile.label} access needs a linked case or Deal Room before it can be created.`);
  }

  if (role === "agent" && !scope.agentIds.length) {
    throw new Error("Agent access needs an agent record before it can be created.");
  }

  const baseRecord = {
    id: userId,
    name: personName,
    role,
    agencyId,
    branchId,
    provinceId,
    contact,
    email,
    mobile,
    whatsapp: mobile,
    profileImage: createProfileImageRecord(payload, createdAt),
    status: "invited",
    verificationStatus: "operator_verified",
    verifiedBy: session.userId || session.name || "axiom",
    verifiedAt: createdAt,
    scope,
    onboarding: {
      invitedAt: createdAt,
      packageLabel,
      firstLogin: "OTP required",
      verificationOwner: role === "principal" ? "Axiom concierge or existing principal" : "Principal, concierge, or assigned admin",
      nextStep: "Send OTP invite, confirm first login, then complete role-specific setup."
    }
  };

  const teamResponsibilities = {
    principal: [
      "Approve branch setup",
      "Invite office admin and agents",
      "Review agency, branch, province and agent rollups"
    ],
    office_admin: [
      "Verify incoming people and case access",
      "Route leads and monitor follow-ups",
      "Keep WhatsApp approvals and seller updates moving"
    ],
    agent: [
      "Accept qualified leads",
      "Work assigned buyer and seller matters",
      "Use WhatsApp drafts, reminders and protection tools"
    ]
  };

  const partyResponsibilities = {
    buyer: ["View own buying progress", "Respond to next-step requests", "Keep the message trail in one place"],
    seller: ["View own sale progress", "Receive approved seller updates", "Keep the message trail in one place"],
    attorney: ["Update assigned transfer progress", "Flag missing documents", "Keep transfer comms attached to the case"],
    bond_originator: ["Update assigned finance progress", "Flag missing finance items", "Keep bond comms attached to the case"]
  };

  const record = isPartyRole(role)
    ? {
        ...baseRecord,
        partyType: role,
        agentId,
        assignedAgentId: agentId,
        caseIds: scope.caseIds,
        responsibilities: partyResponsibilities[role] || []
      }
    : {
        ...baseRecord,
        lane: `${branchName} / ${profile.label}`,
        agentId: role === "agent" ? scope.agentIds[0] : undefined,
        assignedAgentId: role === "agent" ? scope.agentIds[0] : undefined,
        responsibilities: teamResponsibilities[role] || []
      };

  return {
    createdAt,
    role,
    roleLabel: profile.label,
    recordType: isPartyRole(role) ? "partyUser" : "teamMember",
    agency: {
      id: agencyId,
      name: agencyName,
      provinceIds: [provinceId],
      branchIds: [branchId],
      status: "onboarding",
      onboarding: {
        signedUpAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        createdBy: session.name || session.userId || "Axiom"
      }
    },
    branch: {
      id: branchId,
      agencyId,
      name: branchName,
      town,
      provinceId,
      province,
      adminIds: role === "office_admin" ? [userId] : [],
      agentIds: role === "agent" ? [record.agentId || userId] : [],
      status: "onboarding"
    },
    accessRecord: record,
    signIn: {
      role,
      roleLabel: profile.label,
      contact,
      method: "OTP",
      accessScope: scope
    },
    verification: {
      status: "operator_verified",
      verifiedBy: session.name || session.userId || "Axiom",
      note:
        role === "principal"
          ? "Axiom/concierge verifies the principal and agency before the OTP invite is useful."
          : isPartyRole(role)
            ? "The linked case controls what this party can see."
            : "The principal or concierge verifies this person before office access is issued."
    }
  };
}

function upsertById(list, record) {
  const index = list.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...record };
    return "updated";
  }
  list.unshift(record);
  return "created";
}

function applyRoleOnboarding(operations, onboarding, session = {}) {
  const { agency, branch, accessRecord, recordType, role, createdAt } = onboarding;
  const agencyStatus = upsertById(operations.organisations, agency);
  const branchStatus = upsertById(operations.branches, branch);
  const targetList = recordType === "partyUser" ? operations.partyUsers : operations.teamMembers;
  const accessStatus = upsertById(targetList, accessRecord);
  const storedBranch = operations.branches.find((item) => item.id === branch.id);

  if (storedBranch) {
    if (role === "office_admin") storedBranch.adminIds = unique([...(storedBranch.adminIds || []), accessRecord.id]);
    if (role === "agent") storedBranch.agentIds = unique([...(storedBranch.agentIds || []), accessRecord.agentId || accessRecord.id]);
  }

  operations.tasks.unshift({
    id: createOpsId("task"),
    caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
    title: `Activate ${onboarding.roleLabel}: ${accessRecord.name}`,
    category: "access-onboarding",
    priority: role === "principal" ? "high" : "medium",
    status: "open",
    ownerId: session.userId,
    ownerName: session.name || "Axiom",
    dueLabel: role === "principal" ? "Before first branch import" : "Before first live handover",
    nextAction: `${onboarding.verification.note} Send the OTP invite once the contact route is confirmed.`,
    agencyId: agency.id,
    branchId: branch.id,
    provinceId: branch.provinceId,
    agentId: accessRecord.agentId || "",
    assignedAgentId: accessRecord.assignedAgentId || "",
    createdAt
  });

  operations.whatsapp.queue.unshift({
    id: createOpsId("wa"),
    caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
    caseName: isPartyRole(role) ? `${accessRecord.name} access` : `${agency.name} onboarding`,
    category: `${role}-onboarding`,
    toName: accessRecord.name,
    toRole: role,
    toContact: accessRecord.contact || accessRecord.mobile || accessRecord.whatsapp || accessRecord.email || "",
    ownerName: session.name || "Axiom",
    channel: "whatsapp",
    status: "awaiting_approval",
    body: `Hi ${accessRecord.name}. Axiom has prepared your ${onboarding.roleLabel} access. You will sign in with your linked email/mobile and a one-time code. Your view is limited to the correct ${isPartyRole(role) ? "case" : "agency, branch and role"} scope.`,
    agencyId: agency.id,
    branchId: branch.id,
    provinceId: branch.provinceId,
    agentId: accessRecord.agentId || "",
    assignedAgentId: accessRecord.assignedAgentId || "",
    createdAt
  });

  if (accessRecord.profileImage?.status !== "active") {
    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
      title: `Get profile selfie: ${accessRecord.name}`,
      category: "profile-image",
      priority: "low",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first live interaction",
      nextAction: "Request a clear selfie/profile photo with consent so the right people are recognisable in the workspace.",
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: accessRecord.agentId || "",
      assignedAgentId: accessRecord.assignedAgentId || "",
      createdAt
    });

    operations.whatsapp.queue.unshift({
      id: createOpsId("wa"),
      caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
      caseName: isPartyRole(role) ? `${accessRecord.name} profile` : `${agency.name} profile setup`,
      category: "profile-selfie-request",
      toName: accessRecord.name,
      toRole: role,
      toContact: accessRecord.contact || accessRecord.mobile || accessRecord.whatsapp || accessRecord.email || "",
      ownerName: session.name || "Axiom",
      channel: "whatsapp",
      status: "awaiting_approval",
      body: `Hi ${accessRecord.name}. To help everyone recognise the correct person in Axiom, please send a clear selfie/profile photo if you are comfortable with that. By sending it, you consent to Axiom storing it as your profile image for this property matter or office workspace. It will not be used for facial recognition or biometric scoring.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: accessRecord.agentId || "",
      assignedAgentId: accessRecord.assignedAgentId || "",
      createdAt
    });
  }

  return { agencyStatus, branchStatus, accessStatus };
}

function parseRolloutPeople(value, fallbackRole) {
  const list = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return list
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "object") {
        return {
          role: normalizeRole(entry.role || fallbackRole),
          personName: String(entry.personName || entry.name || "").trim(),
          email: normalizeEmail(entry.email),
          mobile: normalizeContactNumber(entry.mobile || entry.whatsapp || entry.phone)
        };
      }

      const parts = String(entry)
        .split(/[|,;]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        role: normalizeRole(fallbackRole),
        personName: parts[0] || "",
        email: normalizeEmail(parts.find((part) => part.includes("@")) || ""),
        mobile: normalizeContactNumber(parts.find((part) => !part.includes("@") && /[0-9+]/.test(part) && part !== parts[0]) || "")
      };
    })
    .filter((entry) => entry?.personName && (entry.email || entry.mobile));
}

function createTeamRolloutRecords(payload = {}, session = {}) {
  const base = {
    agencyName: payload.agencyName || payload.agency,
    agencyId: payload.agencyId,
    branchName: payload.branchName || payload.branch || payload.town,
    branchId: payload.branchId,
    town: payload.town || payload.branchName || payload.branch,
    province: payload.province || payload.provinceId,
    packageLabel: payload.packageLabel || "Axiom Mission Control"
  };
  const admins = parseRolloutPeople(payload.admins || payload.officeAdmins || payload.concierges, "office_admin");
  const agents = parseRolloutPeople(payload.agents, "agent");
  const people = [...admins, ...agents];

  if (!people.length) {
    throw new Error("Add at least one concierge/admin or agent before creating a branch rollout.");
  }

  const onboarding = people.map((person) =>
    createRoleOnboardingRecord(
      {
        ...base,
        role: person.role,
        personName: person.personName,
        email: person.email,
        mobile: person.mobile
      },
      session
    )
  );

  return {
    agencyName: String(base.agencyName || "Agency to confirm").trim(),
    branchName: String(base.branchName || base.town || "Branch to confirm").trim(),
    provinceId: normalizeProvinceId(base.province || session.provinceId || "north-west"),
    counts: {
      admins: onboarding.filter((item) => item.role === "office_admin").length,
      agents: onboarding.filter((item) => item.role === "agent").length,
      total: onboarding.length
    },
    onboarding
  };
}

async function handleTeamRollout(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 128 * 1024);
    const operations = getOperationsState();
    const rollout = createTeamRolloutRecords(body, session);
    const mutations = rollout.onboarding.map((onboarding) => applyRoleOnboarding(operations, onboarding, session));

    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: rollout.onboarding[0]?.agency?.id || "agency-rollout",
      title: `Complete ${rollout.branchName} team rollout`,
      category: "branch-rollout",
      priority: "high",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first branch lead import",
      nextAction: `Confirm ${rollout.counts.admins} admin and ${rollout.counts.agents} agent invite${rollout.counts.total === 1 ? "" : "s"} were accepted, then import their active leads.`,
      agencyId: rollout.onboarding[0]?.agency?.id || "",
      branchId: rollout.onboarding[0]?.branch?.id || "",
      provinceId: rollout.provinceId,
      createdAt: nowIso()
    });

    audit("branch-team-rollout-created", {
      agencyName: rollout.agencyName,
      branchName: rollout.branchName,
      provinceId: rollout.provinceId,
      admins: rollout.counts.admins,
      agents: rollout.counts.agents,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      rollout: {
        agencyName: rollout.agencyName,
        branchName: rollout.branchName,
        provinceId: rollout.provinceId,
        counts: rollout.counts,
        created: rollout.onboarding.map((item, index) => ({
          role: item.role,
          roleLabel: item.roleLabel,
          name: item.accessRecord.name,
          contact: item.signIn.contact,
          scope: item.signIn.accessScope,
          mutation: mutations[index]
        })),
        inviteQueue: "WhatsApp invites queued for human approval"
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Branch team rollout failed." });
  }
}

async function handleRoleOnboarding(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 64 * 1024);
    const operations = getOperationsState();
    const onboarding = createRoleOnboardingRecord(body, session);
    const mutation = applyRoleOnboarding(operations, onboarding, session);

    audit("role-onboarded", {
      role: onboarding.role,
      recordType: onboarding.recordType,
      recordId: onboarding.accessRecord.id,
      agencyId: onboarding.agency.id,
      branchId: onboarding.branch.id,
      provinceId: onboarding.branch.provinceId,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      onboarding: {
        ...onboarding,
        mutation
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Role onboarding failed." });
  }
}

async function handlePrincipalOnboarding(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 64 * 1024);
    const operations = getOperationsState();
    const onboarding = createPrincipalOnboardingRecord(body, session);
    const { agency, branch, principal, createdAt } = onboarding;

    const existingAgencyIndex = operations.organisations.findIndex((item) => item.id === agency.id);
    if (existingAgencyIndex >= 0) {
      operations.organisations[existingAgencyIndex] = {
        ...operations.organisations[existingAgencyIndex],
        ...agency,
        provinceIds: unique([...(operations.organisations[existingAgencyIndex].provinceIds || []), ...agency.provinceIds]),
        branchIds: unique([...(operations.organisations[existingAgencyIndex].branchIds || []), ...agency.branchIds])
      };
    } else {
      operations.organisations.unshift(agency);
    }

    const existingBranchIndex = operations.branches.findIndex((item) => item.id === branch.id);
    if (existingBranchIndex >= 0) {
      operations.branches[existingBranchIndex] = {
        ...operations.branches[existingBranchIndex],
        ...branch
      };
    } else {
      operations.branches.unshift(branch);
    }

    const existingPrincipalIndex = operations.teamMembers.findIndex((item) => item.id === principal.id);
    if (existingPrincipalIndex >= 0) {
      operations.teamMembers[existingPrincipalIndex] = {
        ...operations.teamMembers[existingPrincipalIndex],
        ...principal
      };
    } else {
      operations.teamMembers.unshift(principal);
    }

    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: agency.id,
      title: `Activate ${agency.name}`,
      category: "agency-onboarding",
      priority: "high",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first agent import",
      nextAction: `Confirm ${principal.name}'s contact, then invite admins and agents for ${branch.name}.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: "",
      assignedAgentId: "",
      createdAt
    });

    operations.whatsapp.queue.unshift({
      id: createOpsId("wa"),
      caseId: agency.id,
      caseName: `${agency.name} onboarding`,
      category: "principal-onboarding",
      toName: principal.name,
      toRole: "principal",
      toContact: principal.contact || principal.mobile || principal.whatsapp || principal.email || "",
      ownerName: session.name || "Axiom",
      channel: "whatsapp",
      status: "awaiting_approval",
      body: `Hi ${principal.name}. Axiom has prepared your ${agency.name} Mission Control access for ${branch.name}. You will sign in with your linked email/mobile and a one-time code. Once inside, you can see branch, agent, province and agency rollups for your own office.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      createdAt
    });

    audit("principal-onboarded", {
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      principalId: principal.id,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      onboarding: {
        agency,
        branch,
        principal,
        signIn: {
          role: "principal",
          contact: principal.contact,
          method: "OTP",
          accessScope: principal.scope
        },
        inviteQueued: true
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Principal onboarding failed." });
  }
}

function handleAuditLog(request, response) {
  const session = requirePermission(request, response, "audit.view", ["principal"]);
  if (!session) return;
  sendJson(response, 200, { ok: true, auditLog: state.auditLog });
}

function handleExport(request, response) {
  const session = requirePermission(request, response, "export.download", ["principal"]);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    export: {
      leads: state.leads,
      auditLog: state.auditLog,
      exportedAt: new Date().toISOString()
    }
  });
}

function handleAccessModel(_request, response) {
  const operations = getOperationsState();
  const roles = Object.entries(accessProfiles).map(([role, profile]) => ({
    role,
    label: profile.label,
    gateLabel: profile.gateLabel,
    allowedViews: profile.allowedViews,
    defaultView: profile.defaultView,
    workspaceTabs: getWorkspaceTabs(role),
    accessNote: profile.accessNote,
    permissionLabels: getPermissionLabels(profile.permissions)
  }));

  sendJson(response, 200, {
    ok: true,
    roles,
    workspaceTabDefinitions,
    permissionCatalog,
    hierarchyModel: {
      organisations: operations.organisations.map((item) => ({
        id: item.id,
        name: item.name,
        provinceIds: item.provinceIds,
        branchIds: item.branchIds,
        status: item.status
      })),
      branches: operations.branches.map((item) => ({
        id: item.id,
        agencyId: item.agencyId,
        name: item.name,
        provinceId: item.provinceId,
        adminCount: ensureArray(item.adminIds).length,
        agentCount: ensureArray(item.agentIds).length
      })),
      supportedPartyRoles: ["buyer", "seller", "attorney", "bond_originator"]
    },
    agentNetworkModel: {
      purpose: "Internal agent coverage, matching, verification, pilot selection and controlled business outreach.",
      coreFields: [
        "agentName",
        "agencyName",
        "province",
        "towns",
        "specialties",
        "email",
        "mobile",
        "whatsapp",
        "sourceUrl",
        "sourceCapturedAt",
        "verificationStatus",
        "consentStatus",
        "doNotContact",
        "outreachHistory"
      ],
      complianceGuardrails: [
        "source recorded",
        "manual verification before outreach",
        "opt-out/no-contact suppression",
        "no uncontrolled bulk messaging",
        "WhatsApp outreach queued for human control"
      ]
    },
    aiValueModel: {
      llmStatus: getLlmStatus().status,
      llmProvider: getLlmStatus(),
      valuePattern: "AI drafts, summarises, detects risk, recommends next action and queues WhatsApp work for human approval.",
      rollupDimensions: ["agency", "branch", "province", "agent", "case", "role"]
    },
    onboardingModel: {
      route: "/api/admin/onboard-role",
      branchRolloutRoute: "/api/admin/onboard-team",
      signInMethod: "OTP to verified email or mobile",
      verificationRule: "Access is created only after an existing principal, concierge/admin, or Axiom operator confirms the person and scope.",
      scopePattern: "Every new user is linked to agency, branch, province, role and, where relevant, agent or case.",
      rolloutPattern: "After the principal is verified, a branch admin and agent group can be loaded together under the same agency, branch and province.",
      internalRoles: [
        {
          role: "principal",
          verifiedBy: "Axiom concierge or existing principal",
          sees: "Assigned agency, branch, province, admin, agent and roll-up view"
        },
        {
          role: "office_admin",
          label: "Concierge / admin",
          verifiedBy: "Principal or Axiom concierge",
          sees: "Assigned branches, agents, leads, reminders, comms and protection work"
        },
        {
          role: "agent",
          verifiedBy: "Principal or concierge/admin",
          sees: "Own leads, assigned cases, client comms, protection and action queue"
        }
      ],
      caseRoles: [
        {
          role: "seller",
          verifiedBy: "Linked seller case contact",
          sees: "Own seller progress, next steps, approved updates and comms"
        },
        {
          role: "buyer",
          verifiedBy: "Linked buyer case contact",
          sees: "Own buyer progress, next steps and comms"
        },
        {
          role: "attorney",
          verifiedBy: "Linked transfer case contact",
          sees: "Assigned transfer progress and outstanding items"
        },
        {
          role: "bond_originator",
          verifiedBy: "Linked finance case contact",
          sees: "Assigned finance progress and outstanding items"
        }
      ]
    }
  });
}

function handleOperationsSnapshot(request, response) {
  const session = requireSession(request, response);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    snapshot: buildOperationsSnapshot(session)
  });
}

function handleAiValueOpportunities(request, response) {
  const session = requireSession(request, response);
  if (!session) return;
  const snapshot = buildOperationsSnapshot(session);
  sendJson(response, 200, {
    ok: true,
    role: session.role,
    identity: snapshot.identity,
    rollups: snapshot.rollups,
    aiValue: snapshot.aiValue
  });
}

function handleCaseBrain(request, response) {
  const session = requirePermission(request, response, [
    "leads.view_all",
    "leads.view_assigned",
    "comms.view_all",
    "comms.view_assigned",
    "progress.view_all",
    "progress.view_assigned"
  ]);
  if (!session) return;
  const snapshot = buildOperationsSnapshot(session);
  sendJson(response, 200, {
    ok: true,
    role: session.role,
    identity: snapshot.identity,
    caseBrain: snapshot.caseBrain
  });
}

async function handleLlmTest(request, response) {
  const session = requirePermission(request, response, "system.view");
  if (!session) return;

  const body = await readBody(request, 32 * 1024).catch(() => ({}));
  const prompt = String(body.prompt || "Reply with one short sentence confirming Axiom's NVIDIA AI engine is ready.").trim();

  try {
    const output = await callLiveLlm(
      [
        { role: "system", content: "You are a concise backend readiness checker for Axiom Realty AI." },
        { role: "user", content: prompt.slice(0, 2000) }
      ],
      { maxTokens: 180, temperature: 0.1, timeoutMs: 15000 }
    );
    sendJson(response, 200, {
      ok: true,
      llm: getLlmStatus(),
      output
    });
  } catch (error) {
    sendJson(response, Number(error?.statusCode || 502), {
      ok: false,
      llm: getLlmStatus(),
      error: error instanceof Error ? error.message : "LLM test failed."
    });
  }
}

async function handleAiConciergeDraft(request, response) {
  const session = requirePermission(request, response, [
    "comms.view_all",
    "comms.view_assigned",
    "leads.view_all",
    "leads.view_assigned",
    "seller_updates.approve",
    "market_updates.send"
  ]);
  if (!session) return;

  const body = await readBody(request, 128 * 1024);
  const operations = getOperationsState();
  const thread = body.threadId ? operations.whatsapp.threads.find((entry) => entry.id === body.threadId) : null;
  const lead = body.leadId ? state.leads.find((entry) => entry.id === body.leadId || entry.caseId === body.leadId) : null;
  const caseBrain = buildCaseBrainHub(session).cases.find((item) =>
    [body.caseId, thread?.caseId, lead?.caseId, lead?.id, body.caseName, thread?.caseName, lead?.label]
      .filter(Boolean)
      .map(String)
      .some((key) => key === item.caseId || key === item.leadId || key === item.caseName)
  );
  const fallback = String(body.fallback || body.body || "").trim() || "Hi. Axiom has reviewed the matter and will keep the next step clear.";
  const draft = await generateConciergeDraft({
    purpose: body.purpose || body.category || "Draft a concise Axiom concierge WhatsApp message.",
    audience: body.audience || body.toRole || "property client or estate agent",
    fallback,
    context: {
      requestedBy: session.role,
      caseId: body.caseId || thread?.caseId || lead?.caseId || lead?.id || "",
      caseName: body.caseName || thread?.caseName || lead?.label || "",
      recipient: {
        name: body.toName || "",
        role: body.toRole || ""
      },
      leadQuality: lead?.leadQuality || null,
      briefCard: lead?.briefCard || null,
      caseBrain: caseBrain || null,
      latestThreadMessages: thread?.messages?.slice(-8) || [],
      instructions: body.instructions || body.prompt || "",
      currentDraft: fallback
    },
    maxTokens: Math.max(180, Math.min(900, Number(body.maxTokens || 450)))
  });

  if (body.queue === true) {
    const item = queueWhatsappMessage({
      caseId: body.caseId || thread?.caseId || lead?.caseId || lead?.id || "general",
      caseName: body.caseName || thread?.caseName || lead?.label || "Axiom concierge draft",
      category: body.category || "ai-concierge-draft",
      toName: body.toName || "Recipient",
      toRole: body.toRole || "contact",
      ownerName: body.ownerName || session.role,
      body: draft.text,
      approvalRequired: true
    });
    const targetThread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
    addThreadMessage(targetThread, {
      id: createOpsId("wa"),
      direction: "system",
      author: "Axiom AI",
      category: "ai-concierge-draft",
      body: `AI draft queued for approval: ${draft.text}`,
      at: nowIso(),
      status: "draft_stored",
      approvalRequired: true,
      llm: draft.status
    });
    await persistState();
    sendJson(response, 200, { ok: true, draft, item, snapshot: buildOperationsSnapshot(session) });
    return;
  }

  sendJson(response, 200, { ok: true, draft });
}

async function handleTaskAction(request, response) {
  const session = requirePermission(request, response, ["reminders.view_all", "reminders.view_assigned", "leads.assign"]);
  if (!session) return;

  const body = await readBody(request);
  const operations = getOperationsState();
  const task = operations.tasks.find((entry) => entry.id === body.taskId);
  if (!task) {
    sendJson(response, 404, { ok: false, error: "Task not found." });
    return;
  }

  const action = String(body.action || "done").trim().toLowerCase();
  task.status = action === "reopen" ? "open" : "done";
  task.completedAt = task.status === "done" ? nowIso() : null;
  task.nextAction = task.status === "done" ? "Completed and stored in the office trail." : task.nextAction;

  const reminder = operations.reminders.find((entry) => entry.caseId === task.caseId);
  if (reminder && action !== "reopen") {
    reminder.status = "done";
    reminder.dueLabel = "Completed";
    reminder.note = `Marked done by ${session.role}.`;
  }

  audit("task-updated", { taskId: task.id, action, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, snapshot: buildOperationsSnapshot(session) });
}

function mapTwilioQueueStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["queued", "accepted", "scheduled", "sending", "sent"].includes(normalized)) return "queued";
  if (["delivered", "read"].includes(normalized)) return "delivered";
  if (["failed", "undelivered", "canceled"].includes(normalized)) return "send_failed";
  return "";
}

function findWhatsappQueueItemByContact(contact) {
  const normalized = normalizeWhatsappRecipient(contact);
  if (!normalized) return null;
  const operations = getOperationsState();
  return operations.whatsapp.queue.find((item) => normalizeWhatsappRecipient(item.toContact || item.toNumber || "") === normalized) || null;
}

function verifyTwilioSignature(request, body) {
  if (!config.twilioValidateSignature) return true;
  if (!config.twilioAuthToken || !config.publicBaseUrl) return false;

  const provided = String(request.headers["x-twilio-signature"] || "").trim();
  if (!provided) return false;

  const targetUrl = `${config.publicBaseUrl.replace(/\/+$/, "")}/api/webhooks/twilio/whatsapp`;
  const payload = Object.keys(body || {})
    .sort()
    .reduce((acc, key) => `${acc}${key}${Array.isArray(body[key]) ? body[key].join("") : body[key]}`, targetUrl);
  const expected = createHmac("sha1", config.twilioAuthToken).update(payload, "utf8").digest("base64");
  return safeEquals(expected, provided);
}

async function handleTwilioWhatsappWebhook(request, response) {
  const body = await readBody(request);
  if (!verifyTwilioSignature(request, body)) {
    sendText(response, 403, "Invalid Twilio signature.");
    return;
  }

  const operations = getOperationsState();
  const now = nowIso();
  const messageSid = String(body.MessageSid || body.SmsSid || "").trim();
  const providerStatus = String(body.MessageStatus || body.SmsStatus || "").trim();
  const queueStatus = mapTwilioQueueStatus(providerStatus);

  if (messageSid && queueStatus) {
    const item = operations.whatsapp.queue.find((entry) => entry.providerMessageId === messageSid);
    if (item) {
      item.providerStatus = providerStatus || item.providerStatus || null;
      item.status = queueStatus;
      item.processedAt = now;
      if (queueStatus === "delivered") {
        item.deliveredAt = item.deliveredAt || now;
      }
      if (queueStatus === "send_failed") {
        item.deliveryNote = String(body.ErrorMessage || body.ChannelStatusMessage || "Twilio delivery failed.").trim();
      }
    }
  }

  const inboundBody = String(body.Body || "").trim();
  const fromContact = String(body.WaId || body.From || "").trim();
  if (inboundBody && fromContact) {
    const matchedItem = findWhatsappQueueItemByContact(fromContact);
    const displayName = String(body.ProfileName || matchedItem?.toName || fromContact.replace(/^whatsapp:/i, "") || "WhatsApp contact").trim();
    const caseId = matchedItem?.caseId || "general";
    const caseName = matchedItem?.caseName || "WhatsApp conversation";
    const ownerName = matchedItem?.ownerName || "Axiom Concierge";
    const thread = ensureThread(caseId, caseName, [displayName, ownerName]);
    addThreadMessage(thread, {
      id: createOpsId("wa"),
      direction: "inbound",
      author: displayName,
      body: inboundBody,
      at: now,
      status: "received",
      providerMessageId: messageSid || null,
      deliveryMode: "twilio"
    });
    audit("whatsapp-inbound", {
      provider: "twilio",
      caseId,
      caseName,
      fromContact: fromContact.replace(/^whatsapp:/i, "")
    });
  }

  operations.whatsapp.bridge.lastHeartbeatAt = now;
  operations.whatsapp.bridge.provider = "twilio";
  operations.whatsapp.bridge.connected = true;
  operations.whatsapp.bridge.status = providerStatus ? `Twilio webhook received: ${providerStatus}.` : "Twilio inbound message received.";
  await persistState();
  sendText(response, 200, "<Response></Response>", { "Content-Type": "text/xml; charset=utf-8" });
}

async function handleWhatsappQueue(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned", "seller_updates.approve", "market_updates.send", "dealroom.share"]);
  if (!session) return;

  const body = await readBody(request);
  let messageBody = String(body.body || "").trim();
  if (!messageBody && !body.aiAssist) {
    sendJson(response, 400, { ok: false, error: "Message body is required." });
    return;
  }
  let aiDraft = null;
  if (body.aiAssist || body.aiInstruction || body.prompt) {
    const caseBrain = buildCaseBrainHub(session).cases.find((item) =>
      [body.caseId, body.caseName]
        .filter(Boolean)
        .map(String)
        .some((key) => key === item.caseId || key === item.leadId || key === item.caseName)
    );
    aiDraft = await generateConciergeDraft({
      purpose: body.aiInstruction || body.prompt || `Draft a ${body.category || "WhatsApp"} message for approval.`,
      audience: body.toRole || "property client or estate agent",
      fallback: messageBody || "Hi. Axiom will keep this moving and confirm the next step shortly.",
      context: {
        caseId: body.caseId,
        caseName: body.caseName,
        category: body.category,
        toName: body.toName,
        toRole: body.toRole,
        ownerName: body.ownerName || session.role,
        caseBrain: caseBrain || null,
        currentDraft: messageBody
      }
    });
    messageBody = aiDraft.text;
  }

  const operations = getOperationsState();
  const item = queueWhatsappMessage({
    caseId: body.caseId,
    caseName: body.caseName,
    category: body.category,
    toName: body.toName,
    toRole: body.toRole,
    toContact: body.toContact || body.toNumber || body.mobile || body.whatsapp || "",
    ownerName: body.ownerName || session.role,
    body: messageBody,
    scheduledFor: body.scheduledFor,
    approvalRequired: body.approvalRequired ?? Boolean(aiDraft?.usedLiveLlm)
  });
  const thread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `${item.category} queued for ${item.toName}.`,
    at: item.createdAt,
    status: item.status,
    llm: aiDraft?.status || null
  });
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  await persistState();
  sendJson(response, 200, { ok: true, item, aiDraft, snapshot: buildOperationsSnapshot(session) });
}

async function handleWhatsappProcess(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const body = await readBody(request).catch(() => ({}));
  const limit = Math.max(1, Number(body.limit || 10));
  const operations = getOperationsState();
  const processable = operations.whatsapp.queue.filter((item) => item.status === "queued").slice(0, limit);
  const runtime = getWhatsappRuntime();
  const results = [];

  for (const item of processable) {
    results.push(await processWhatsappQueueItem(item, runtime));
  }

  operations.whatsapp.bridge.lastProcessedAt = nowIso();
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  operations.whatsapp.bridge.mode = runtime.mode;
  operations.whatsapp.bridge.provider = runtime.provider;
  operations.whatsapp.bridge.connected = runtime.liveDeliveryConnected;
  operations.whatsapp.bridge.status = runtime.status;
  audit("whatsapp-processed", {
    count: processable.length,
    role: session.role,
    provider: runtime.provider,
    liveDeliveryConnected: runtime.liveDeliveryConnected
  });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    processed: processable.length,
    deliveryMode: runtime.liveDeliveryConnected ? runtime.provider : "manual_test",
    whatsapp: runtime,
    results,
    snapshot: buildOperationsSnapshot(session)
  });
}

async function handleWhatsappReply(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const body = await readBody(request);
  const operations = getOperationsState();
  const thread = operations.whatsapp.threads.find((entry) => entry.id === body.threadId);
  if (!thread) {
    sendJson(response, 404, { ok: false, error: "Thread not found." });
    return;
  }

  let messageBody = String(body.body || "").trim();
  if (!messageBody) {
    sendJson(response, 400, { ok: false, error: "Reply cannot be empty." });
    return;
  }
  let aiDraft = null;
  if (body.aiAssist || body.aiInstruction || body.prompt) {
    aiDraft = await generateConciergeDraft({
      purpose: body.aiInstruction || body.prompt || "Refine this WhatsApp reply for Axiom concierge tone.",
      audience: body.recipient || body.toRole || "WhatsApp recipient",
      fallback: messageBody,
      context: {
        thread: {
          id: thread.id,
          caseName: thread.caseName,
          participants: thread.participants,
          latestMessages: thread.messages.slice(-8)
        },
        currentDraft: messageBody
      }
    });
    messageBody = aiDraft.text;
  }

  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "outbound",
    author: String(body.author || "Axiom"),
    body: messageBody,
    at: nowIso(),
    status: "delivered",
    llm: aiDraft?.status || null
  });
  thread.unreadCount = 0;
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  audit("whatsapp-reply-sent", { threadId: thread.id, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, aiDraft, snapshot: buildOperationsSnapshot(session) });
}

async function handleRunSmartReminders(request, response) {
  const session = requirePermission(request, response, ["reminders.view_all", "reminders.view_assigned", "comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const operations = getOperationsState();
  const queuedIds = new Set(
    operations.whatsapp.queue
      .filter((item) => ["queued", "delivered", "manual_test_ready", "send_failed"].includes(item.status))
      .map((item) => `${item.category}:${item.caseId}`)
  );

  const newItems = [];
  operations.reminders
    .filter((reminder) => reminder.status === "pending")
    .forEach((reminder) => {
      const key = `smart-reminder:${reminder.caseId}`;
      if (queuedIds.has(key)) return;
      newItems.push(
        queueWhatsappMessage({
          caseId: reminder.caseId,
          caseName: reminder.caseName,
          category: "smart-reminder",
          toName: reminder.ownerName,
          toRole: "agent",
          ownerName: "Axiom",
          body: `Reminder: ${reminder.caseName} still needs attention. ${reminder.note}`,
          approvalRequired: false
        })
      );
    });

  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  audit("smart-reminders-queued", { count: newItems.length, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, queued: newItems.length, snapshot: buildOperationsSnapshot(session) });
}

async function serveStaticFile(requestPath, response) {
  const sanitized = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.join(__dirname, sanitized);
  const resolvedPath = path.resolve(targetPath);
  if (!resolvedPath.startsWith(__dirname)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      await serveStaticFile(path.join(sanitized, "index.html"), response);
      return;
    }
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const fileBuffer = await fs.readFile(resolvedPath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" || extension === ".js" || extension === ".css" ? "no-store" : "public, max-age=300"
    });
    response.end(fileBuffer);
  } catch {
    if (!path.extname(sanitized) || sanitized.endsWith(".html")) {
      const fallback = await fs.readFile(path.join(__dirname, "index.html"));
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(fallback);
      return;
    }
    sendText(response, 404, "Not found");
  }
}

async function handleRequest(request, response) {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      response.end();
      return;
    }

    if (pathname === "/healthz" && request.method === "GET") {
      sendJson(response, 200, { ok: true, status: "up" });
      return;
    }
    if (pathname === "/api/app-status" && request.method === "GET") {
      handleAppStatus(request, response);
      return;
    }
    if (pathname === "/api/auth/session" && request.method === "GET") {
      handleSession(request, response);
      return;
    }
    if (pathname === "/api/auth/request-otp" && request.method === "POST") {
      await handleRequestOtp(request, response);
      return;
    }
    if (pathname === "/api/auth/verify-otp" && request.method === "POST") {
      await handleVerifyOtp(request, response);
      return;
    }
    if (pathname === "/api/auth/access-model" && request.method === "GET") {
      handleAccessModel(request, response);
      return;
    }
    if (pathname === "/api/auth/login" && request.method === "POST") {
      await handleLogin(request, response);
      return;
    }
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      await handleLogout(request, response);
      return;
    }
    if (pathname === "/api/admin/operations" && request.method === "GET") {
      handleOperationsSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/reporting" && request.method === "GET") {
      handleReportingSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-role" && request.method === "POST") {
      await handleRoleOnboarding(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-team" && request.method === "POST") {
      await handleTeamRollout(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-principal" && request.method === "POST") {
      await handlePrincipalOnboarding(request, response);
      return;
    }
    if (pathname === "/api/admin/case-brain" && request.method === "GET") {
      handleCaseBrain(request, response);
      return;
    }
    if (pathname === "/api/ai/value-opportunities" && request.method === "GET") {
      handleAiValueOpportunities(request, response);
      return;
    }
    if (pathname === "/api/ai/test" && request.method === "POST") {
      await handleLlmTest(request, response);
      return;
    }
    if (pathname === "/api/ai/concierge-draft" && request.method === "POST") {
      await handleAiConciergeDraft(request, response);
      return;
    }
    if (pathname === "/api/admin/tasks/action" && request.method === "POST") {
      await handleTaskAction(request, response);
      return;
    }
    if (pathname === "/api/admin/protection" && request.method === "POST") {
      await handleProtectCommission(request, response);
      return;
    }
    if (pathname === "/api/admin/dealroom/share" && request.method === "POST") {
      await handleDealRoomShare(request, response);
      return;
    }
    if (pathname === "/api/admin/service-pulse" && request.method === "POST") {
      await handleServicePulseCapture(request, response);
      return;
    }
    if (pathname === "/api/admin/pilot/action" && request.method === "POST") {
      await handlePilotControlAction(request, response);
      return;
    }
    if (pathname === "/api/admin/agent-network" && request.method === "GET") {
      await handleAgentNetworkSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/agent-network/action" && request.method === "POST") {
      await handleAgentNetworkAction(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/queue" && request.method === "POST") {
      await handleWhatsappQueue(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/process" && request.method === "POST") {
      await handleWhatsappProcess(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/reply" && request.method === "POST") {
      await handleWhatsappReply(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/run-reminders" && request.method === "POST") {
      await handleRunSmartReminders(request, response);
      return;
    }
    if (pathname === "/api/webhooks/twilio/whatsapp" && request.method === "POST") {
      await handleTwilioWhatsappWebhook(request, response);
      return;
    }
    if (pathname === "/api/system-status" && request.method === "GET") {
      handleSystemStatus(request, response);
      return;
    }
    if (pathname === "/api/analytics" && request.method === "GET") {
      handleAnalytics(request, response);
      return;
    }
    if (pathname === "/api/admin/audit-log" && request.method === "GET") {
      handleAuditLog(request, response);
      return;
    }
    if (pathname === "/api/admin/export" && request.method === "GET") {
      handleExport(request, response);
      return;
    }
    if (pathname === "/api/leads" && request.method === "POST") {
      await handleLeadCreate(request, response);
      return;
    }
    if (pathname === "/api/public/deal-room/access" && request.method === "POST") {
      await handlePublicDealRoomAccess(request, response);
      return;
    }
    if (pathname === "/api/public/service-pulse" && request.method === "POST") {
      await handlePublicServicePulse(request, response);
      return;
    }

    await serveStaticFile(pathname, response);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    sendJson(response, statusCode, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
}

export async function createAxiomServer() {
  await loadState();
  return createServer(handleRequest);
}

export async function startServer(overrides = {}) {
  const server = await createAxiomServer();
  const port = Number(overrides.port ?? config.port);
  const host = overrides.host ?? config.host;

  const boundPort = await startWithFallback(server, port, host);

  return {
    server,
    port: boundPort,
    host
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  try {
    const { host, port } = await startServer();
    console.log(`Axiom backend listening on http://${host}:${port}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAccessConfig } from "./modules/access-config.js";
import { createStorage } from "./modules/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.env.NODE_ENV || "local";
const {
  isRenderRuntime,
  accessConfig,
  permissionCatalog,
  workspaceTabDefinitions,
  accessProfiles,
  normalizeRole,
  getRoleKey,
  getRoleProfile,
  getRolePermissions,
  getWorkspaceTabs,
  getRoleSigninContact,
  hasPermission,
  hasAnyPermission,
  getPermissionLabels
} = createAccessConfig(process.env, { environment });

const config = {
  port: Number(process.env.PORT || (isRenderRuntime ? 8080 : 8098)),
  host: process.env.HOST || (isRenderRuntime ? "0.0.0.0" : "127.0.0.1"),
  appVersion: process.env.APP_VERSION || "local-dev",
  environment,
  isRenderRuntime,
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").trim(),
  ...accessConfig,
  whatsappMode: String(process.env.WHATSAPP_MODE || "managed-simulation").trim(),
  whatsappProvider: String(process.env.WHATSAPP_PROVIDER || process.env.WHATSAPP_MODE || "managed-simulation").trim(),
  whatsappPhoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
  whatsappAccessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
  whatsappBusinessAccountId: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim(),
  whatsappApiBaseUrl: String(process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com").trim().replace(/\/+$/, ""),
  whatsappApiVersion: String(process.env.WHATSAPP_API_VERSION || "v20.0").trim(),
  whatsappFromNumber: String(process.env.WHATSAPP_FROM_NUMBER || "").trim(),
  otpProvider: String(process.env.OTP_PROVIDER || "preview").trim(),
  emailProvider: String(process.env.EMAIL_PROVIDER || "none").trim(),
  emailFrom: String(process.env.EMAIL_FROM || "").trim(),
  llmProvider: String(
    process.env.LLM_PROVIDER ||
      (process.env.NVIDIA_API_KEY ? "nvidia" : process.env.OPENAI_API_KEY ? "openai" : "none")
  )
    .trim()
    .toLowerCase(),
  nvidiaApiKey: String(process.env.NVIDIA_API_KEY || "").trim(),
  nvidiaBaseUrl: String(process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").trim().replace(/\/+$/, ""),
  nvidiaModel: String(process.env.NVIDIA_MODEL || "z-ai/glm-5.2").trim(),
  nvidiaFallbackModel: String(process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3-ultra-550b-a55b").trim(),
  openaiApiKey: String(process.env.OPENAI_API_KEY || "").trim(),
  openaiBaseUrl: String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, ""),
  openaiModel: String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim()
};

function getPortSequence(preferredPort) {
  const requested = Number(preferredPort) || 8080;
  if (requested !== 8080) {
    return [requested];
  }

  return [8080, 8098, 8099, 3000, 3001];
}

function buildListenErrorLabel(port, host, error) {
  return `Failed to bind ${host}:${port} (${error?.code || "unknown"})`;
}

function listenOnPort(server, port, host) {
  return new Promise((resolve, reject) => {
    const onListen = () => {
      cleanup();
      resolve(port);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      server.removeListener("error", onError);
      server.removeListener("listening", onListen);
    };

    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, host);
  });
}

async function startWithFallback(server, preferredPort, host) {
  const errors = [];
  for (const candidate of getPortSequence(preferredPort)) {
    try {
      const boundPort = await listenOnPort(server, candidate, host);
      if (candidate !== preferredPort) {
        console.log(`Port ${preferredPort} unavailable; using fallback port ${candidate}`);
      }
      return boundPort;
    } catch (error) {
      errors.push(buildListenErrorLabel(candidate, host, error));
      if (!["EACCES", "EADDRINUSE"].includes(error?.code)) {
        throw error;
      }
    }
  }
  throw new Error(`Unable to start server on configured and fallback ports. ${errors.join(" | ")}`);
}

const dataDir = path.join(__dirname, "data");
const missionControlCookie = "axiom_mc_session";
let storage = null;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const state = {
  leads: [],
  sessions: [],
  auditLog: [],
  otpChallenges: [],
  operations: null
};

function hashSecret(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeAccessKey(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function safeAccessKeyEquals(left, right) {
  const normalizedLeft = normalizeAccessKey(left);
  const normalizedRight = normalizeAccessKey(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return safeEquals(normalizedLeft, normalizedRight);
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeSigninContact(contact) {
  return String(contact || "").trim().toLowerCase();
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function unique(values) {
  return [...new Set(ensureArray(values))];
}

function defaultScopeForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "principal") {
    return { allAccess: true, agencyIds: ["agency-axiom"], branchIds: ["branch-cape", "branch-kzn"], provinceIds: ["western-cape", "kwazulu-natal"], agentIds: [], caseIds: [] };
  }
  if (normalizedRole === "office_admin") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape", "branch-kzn"], provinceIds: ["western-cape", "kwazulu-natal"], agentIds: ["agent-aisha", "agent-lebo"], caseIds: [] };
  }
  if (normalizedRole === "agent") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "buyer") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "seller") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "attorney") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-cape"], provinceIds: ["western-cape"], agentIds: ["agent-aisha"], caseIds: ["case-claremont"] };
  }
  if (normalizedRole === "bond_originator") {
    return { allAccess: false, agencyIds: ["agency-axiom"], branchIds: ["branch-kzn"], provinceIds: ["kwazulu-natal"], agentIds: ["agent-lebo"], caseIds: ["case-durban"] };
  }
  return { allAccess: false, agencyIds: [], branchIds: [], provinceIds: [], agentIds: [], caseIds: [] };
}

function normalizeScope(scope, role) {
  const fallback = defaultScopeForRole(role);
  const source = scope && typeof scope === "object" ? scope : {};
  return {
    allAccess: Boolean(source.allAccess || fallback.allAccess),
    agencyIds: unique(source.agencyIds?.length ? source.agencyIds : fallback.agencyIds),
    branchIds: unique(source.branchIds?.length ? source.branchIds : fallback.branchIds),
    provinceIds: unique(source.provinceIds?.length ? source.provinceIds : fallback.provinceIds),
    agentIds: unique(source.agentIds?.length ? source.agentIds : fallback.agentIds),
    caseIds: unique(source.caseIds?.length ? source.caseIds : fallback.caseIds)
  };
}

function scopeFromRecord(record, role) {
  return normalizeScope(
    {
      allAccess: record?.scope?.allAccess,
      agencyIds: record?.scope?.agencyIds || record?.agencyIds || record?.agencyId,
      branchIds: record?.scope?.branchIds || record?.branchIds || record?.branchId,
      provinceIds: record?.scope?.provinceIds || record?.provinceIds || record?.provinceId,
      agentIds: record?.scope?.agentIds || record?.agentIds || record?.agentId || (normalizeRole(role) === "agent" ? record?.id : []),
      caseIds: record?.scope?.caseIds || record?.caseIds
    },
    role
  );
}

function normalizeSessionIdentity(role, identity = {}, contact = "") {
  const normalizedRole = normalizeRole(role);
  const scope = scopeFromRecord(identity, normalizedRole);
  return {
    userId: String(identity.id || `${normalizedRole}-${hashSecret(contact || normalizedRole).slice(0, 8)}`).trim(),
    name: String(identity.name || getRoleProfile(normalizedRole).label).trim(),
    contact: normalizeSigninContact(identity.contact || contact || getRoleSigninContact(normalizedRole)),
    agencyId: String(identity.agencyId || scope.agencyIds[0] || "agency-axiom").trim(),
    branchId: String(identity.branchId || scope.branchIds[0] || "").trim(),
    provinceId: String(identity.provinceId || scope.provinceIds[0] || "").trim(),
    scope
  };
}

function getSessionScope(sessionOrRole) {
  if (typeof sessionOrRole === "object" && sessionOrRole) {
    return normalizeScope(sessionOrRole.scope, sessionOrRole.role);
  }
  return defaultScopeForRole(sessionOrRole);
}

function valuesOverlap(left = [], right = []) {
  const rightSet = new Set(ensureArray(right));
  return ensureArray(left).some((value) => rightSet.has(value));
}

function contactMatches(record, contact) {
  return normalizeSigninContact(record?.contact) === normalizeSigninContact(contact);
}

function findIdentityForSignin(role, contact) {
  const normalizedRole = normalizeRole(role);
  const operations = getOperationsState();
  const teamMatch = operations.teamMembers.find((member) => {
    return normalizeRole(member.role) === normalizedRole && contactMatches(member, contact);
  });
  if (teamMatch) return normalizeSessionIdentity(normalizedRole, teamMatch, contact);

  const partyMatch = operations.partyUsers.find((party) => {
    return normalizeRole(party.role || party.partyType) === normalizedRole && contactMatches(party, contact);
  });
  if (partyMatch) return normalizeSessionIdentity(normalizedRole, partyMatch, contact);

  const configuredContact = normalizeSigninContact(getRoleSigninContact(normalizedRole));
  if (configuredContact && configuredContact === normalizeSigninContact(contact)) {
    return normalizeSessionIdentity(normalizedRole, {}, contact);
  }

  return null;
}

function normalizeSessionRecord(session) {
  const role = normalizeRole(session?.role);
  const identity = normalizeSessionIdentity(role, session || {}, session?.contact || getRoleSigninContact(role));
  return {
    ...session,
    role,
    userId: session?.userId || identity.userId,
    name: session?.name || identity.name,
    contact: session?.contact || identity.contact,
    agencyId: session?.agencyId || identity.agencyId,
    branchId: session?.branchId || identity.branchId,
    provinceId: session?.provinceId || identity.provinceId,
    scope: normalizeScope(session?.scope || identity.scope, role)
  };
}

function recordVisibleToScope(record, sessionOrRole) {
  const viewerRole = normalizeRole(typeof sessionOrRole === "object" ? sessionOrRole.role : sessionOrRole);
  const scope = getSessionScope(sessionOrRole);
  if (scope.allAccess) return true;
  const caseScopedRoles = new Set(["agent", "buyer", "seller", "attorney", "bond_originator"]);
  if (caseScopedRoles.has(viewerRole)) {
    if (valuesOverlap(ensureArray(record?.caseId), scope.caseIds)) return true;
    if (valuesOverlap(ensureArray(record?.caseIds), scope.caseIds)) return true;
    if (valuesOverlap(ensureArray(record?.agentId), scope.agentIds)) return true;
    if (valuesOverlap(ensureArray(record?.assignedAgentId), scope.agentIds)) return true;
    if (valuesOverlap(ensureArray(record?.ownerId), scope.agentIds)) return true;
    if (normalizeRole(record?.role) === "agent" && record?.id && valuesOverlap([record.id], scope.agentIds)) return true;
    return false;
  }
  if (record?.id && valuesOverlap([record.id], scope.agencyIds)) return true;
  if (record?.id && valuesOverlap([record.id], scope.branchIds)) return true;
  if (valuesOverlap(record?.branchIds, scope.branchIds)) return true;
  if (valuesOverlap(record?.provinceIds, scope.provinceIds)) return true;
  const normalizedRecord = withScopeDefaults(record || {});
  if (normalizedRecord.caseId && valuesOverlap([normalizedRecord.caseId], scope.caseIds)) return true;
  if (valuesOverlap(ensureArray(record?.caseIds), scope.caseIds)) return true;
  if (normalizedRecord.agentId && valuesOverlap([normalizedRecord.agentId], scope.agentIds)) return true;
  if (record?.id && valuesOverlap([record.id], scope.agentIds)) return true;
  if (normalizedRecord.branchId && valuesOverlap([normalizedRecord.branchId], scope.branchIds)) return true;
  if (normalizedRecord.provinceId && valuesOverlap([normalizedRecord.provinceId], scope.provinceIds)) return true;
  if (normalizedRecord.agencyId && valuesOverlap([normalizedRecord.agencyId], scope.agencyIds)) return true;
  return false;
}

function filterVisible(records, sessionOrRole) {
  const list = Array.isArray(records) ? records : [];
  return list.filter((record) => recordVisibleToScope(record, sessionOrRole));
}

function nowIso() {
  return new Date().toISOString();
}

function createOpsId(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

function formatOpsTimestamp(value) {
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferAreaFromCaseName(caseName) {
  const value = String(caseName || "").trim();
  if (!value) return "Area to confirm";
  return value.split("-")[0].trim();
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
  return normalized || "western-cape";
}

function formatProvinceLabel(value) {
  const provinceId = normalizeProvinceId(value);
  const labels = {
    "western-cape": "Western Cape",
    "kwazulu-natal": "KwaZulu-Natal",
    gauteng: "Gauteng",
    "eastern-cape": "Eastern Cape",
    "free-state": "Free State",
    limpopo: "Limpopo",
    mpumalanga: "Mpumalanga",
    "north-west": "North West",
    "northern-cape": "Northern Cape"
  };
  return labels[provinceId] || String(value || "Province to confirm").trim();
}

function branchForProvinceId(provinceId) {
  const normalized = normalizeProvinceId(provinceId);
  if (normalized === "kwazulu-natal") return "branch-kzn";
  if (normalized === "gauteng") return "branch-gauteng-north";
  return "branch-cape";
}

function normalizeConsentStatus(value, fallback = "not_contacted") {
  const normalized = slugify(value || "").replace(/-/g, "_");
  if (["opted_in", "consented", "yes", "subscribed"].includes(normalized)) return "opted_in";
  if (["opted_out", "unsubscribed", "do_not_contact", "no"].includes(normalized)) return "opted_out";
  if (["business_context", "legitimate_interest", "relationship"].includes(normalized)) return "business_context";
  if (["not_contacted", "unknown", "pending", "none"].includes(normalized)) return normalized === "none" ? fallback : normalized;
  return fallback;
}

function normalizeVerificationStatus(value, fallback = "source_found") {
  const normalized = slugify(value || "").replace(/-/g, "_");
  if (["verified", "reviewed", "manually_verified"].includes(normalized)) return "verified";
  if (["invalid", "bad_record", "stale"].includes(normalized)) return "invalid";
  if (["needs_review", "pending_review", "unverified"].includes(normalized)) return "needs_review";
  if (["source_found", "public_source", "public"].includes(normalized)) return "source_found";
  return fallback;
}

function daysSinceIso(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function normalizeAgentNetworkRecord(record = {}) {
  const capturedAt = record.createdAt || record.source?.capturedAt || nowIso();
  const provinceId = normalizeProvinceId(record.provinceId || record.province || record.location?.province || "western-cape");
  const branchId = String(record.branchId || branchForProvinceId(provinceId)).trim();
  const source = record.source && typeof record.source === "object" ? record.source : {};
  const contact = record.contact && typeof record.contact === "object" ? record.contact : {};
  const email = normalizeEmail(record.email || record.contactEmail || contact.email);
  const mobile = normalizeContactNumber(record.mobile || record.cellphone || record.phone || contact.mobile || contact.cellphone || contact.phone);
  const whatsapp = normalizeContactNumber(record.whatsapp || contact.whatsapp || mobile);
  const consent = record.consent && typeof record.consent === "object" ? record.consent : {};
  const verification = record.verification && typeof record.verification === "object" ? record.verification : {};
  const outreach = record.outreach && typeof record.outreach === "object" ? record.outreach : {};

  return {
    id: String(record.id || createOpsId("network-agent")).trim(),
    agentName: String(record.agentName || record.name || "Agent name to confirm").trim(),
    agencyName: String(record.agencyName || record.agency || "Agency to confirm").trim(),
    branchName: String(record.branchName || record.branch || "").trim(),
    roleCategory: String(record.roleCategory || record.role || "estate_agent").trim(),
    provinceId,
    province: formatProvinceLabel(provinceId),
    provinceIds: unique(record.provinceIds || [provinceId]),
    agencyId: String(record.agencyId || "agency-network").trim(),
    branchId,
    branchIds: unique(record.branchIds || [branchId]),
    towns: unique(record.towns || record.areas || record.location?.towns || record.suburbs),
    suburbs: unique(record.suburbs || record.areas || record.location?.suburbs),
    specialties: unique(record.specialties || record.focusAreas || record.propertyTypes),
    languages: unique(record.languages),
    independentStatus: String(record.independentStatus || record.agencyModel || "to_confirm").trim(),
    ppraStatus: String(record.ppraStatus || record.ffcStatus || "to_confirm").trim(),
    contact: {
      email,
      mobile,
      whatsapp,
      phone: normalizeContactNumber(record.phone || contact.phone || mobile),
      website: String(record.website || contact.website || "").trim()
    },
    source: {
      type: String(source.type || record.sourceType || "public_domain").trim(),
      name: String(source.name || record.sourceName || "Public source").trim(),
      url: String(source.url || record.sourceUrl || "").trim(),
      note: String(source.note || record.sourceNote || "Publicly available business/contact information; verify before outreach.").trim(),
      capturedAt: source.capturedAt || record.sourceCapturedAt || capturedAt,
      capturedBy: String(source.capturedBy || record.sourceCapturedBy || "Axiom").trim()
    },
    consent: {
      emailStatus: normalizeConsentStatus(consent.emailStatus || record.emailConsentStatus),
      whatsappStatus: normalizeConsentStatus(consent.whatsappStatus || record.whatsappConsentStatus),
      doNotContact: Boolean(consent.doNotContact || record.doNotContact),
      lawfulUseNote: String(
        consent.lawfulUseNote ||
          record.lawfulUseNote ||
          "Public-domain contact data may be used internally for matching and carefully controlled business outreach with opt-out respected."
      ).trim(),
      optOutAt: consent.optOutAt || record.optOutAt || "",
      optOutReason: String(consent.optOutReason || record.optOutReason || "").trim()
    },
    verification: {
      status: normalizeVerificationStatus(verification.status || record.verificationStatus),
      lastVerifiedAt: verification.lastVerifiedAt || record.lastVerifiedAt || "",
      verifiedBy: String(verification.verifiedBy || record.verifiedBy || "").trim(),
      reviewNote: String(verification.reviewNote || record.reviewNote || "").trim()
    },
    outreach: {
      status: String(outreach.status || record.outreachStatus || "not_contacted").trim(),
      count: Number(outreach.count || record.outreachCount || 0),
      lastContactedAt: outreach.lastContactedAt || record.lastContactedAt || "",
      lastChannel: String(outreach.lastChannel || record.lastChannel || "").trim(),
      nextFollowUpAt: outreach.nextFollowUpAt || record.nextFollowUpAt || "",
      pilotStatus: String(outreach.pilotStatus || record.pilotStatus || "not_invited").trim()
    },
    matchingSignals: {
      sellerFit: Number(record.matchingSignals?.sellerFit ?? record.sellerFit ?? 60),
      buyerFit: Number(record.matchingSignals?.buyerFit ?? record.buyerFit ?? 55),
      referralFit: Number(record.matchingSignals?.referralFit ?? record.referralFit ?? 60),
      servicePulseAvg: Number(record.matchingSignals?.servicePulseAvg ?? record.servicePulseAvg ?? 0),
      responseReliability: Number(record.matchingSignals?.responseReliability ?? record.responseReliability ?? 50),
      capacity: String(record.matchingSignals?.capacity || record.capacity || "to_confirm").trim()
    },
    notes: String(record.notes || "").trim(),
    createdAt: capturedAt,
    updatedAt: record.updatedAt || capturedAt
  };
}

function inferScopeDefaults(item = {}) {
  const caseId = String(item.caseId || item.id || "").toLowerCase();
  const caseName = String(item.caseName || item.label || "").toLowerCase();
  if (caseId.includes("durban") || caseName.includes("durban") || caseName.includes("umhlanga")) {
    return {
      agencyId: "agency-axiom",
      branchId: "branch-kzn",
      provinceId: "kwazulu-natal",
      agentId: "agent-lebo"
    };
  }
  return {
    agencyId: "agency-axiom",
    branchId: "branch-cape",
    provinceId: "western-cape",
    agentId: "agent-aisha"
  };
}

function withScopeDefaults(item = {}) {
  const defaults = inferScopeDefaults(item);
  return {
    ...item,
    agencyId: item.agencyId || defaults.agencyId,
    branchId: item.branchId || defaults.branchId,
    provinceId: normalizeProvinceId(item.provinceId || item.province || defaults.provinceId),
    agentId: item.agentId || item.assignedAgentId || item.ownerId || defaults.agentId,
    assignedAgentId: item.assignedAgentId || item.agentId || defaults.agentId,
    caseId: item.caseId || item.id || createOpsId("case")
  };
}

function normalizeOperationsShape(operations) {
  if (!operations || typeof operations !== "object" || Array.isArray(operations)) {
    return defaultOperationsState();
  }

  operations.organisations = Array.isArray(operations.organisations) ? operations.organisations : [];
  operations.branches = Array.isArray(operations.branches) ? operations.branches : [];
  operations.partyUsers = Array.isArray(operations.partyUsers) ? operations.partyUsers : [];
  operations.teamMembers = Array.isArray(operations.teamMembers) ? operations.teamMembers : [];
  operations.tasks = Array.isArray(operations.tasks) ? operations.tasks : [];
  operations.reminders = Array.isArray(operations.reminders) ? operations.reminders : [];
  operations.escalations = Array.isArray(operations.escalations) ? operations.escalations : [];
  operations.commissionTimeline = Array.isArray(operations.commissionTimeline) ? operations.commissionTimeline : [];
  operations.dealRooms = Array.isArray(operations.dealRooms) ? operations.dealRooms : [];
  operations.servicePulse = Array.isArray(operations.servicePulse) ? operations.servicePulse : [];
  operations.pilotControl = operations.pilotControl && typeof operations.pilotControl === "object" ? operations.pilotControl : {};
  operations.pilotControl.agents = Array.isArray(operations.pilotControl.agents) ? operations.pilotControl.agents : [];
  operations.pilotControl.scenarios = Array.isArray(operations.pilotControl.scenarios) ? operations.pilotControl.scenarios : [];
  operations.pilotControl.messageLog = Array.isArray(operations.pilotControl.messageLog) ? operations.pilotControl.messageLog : [];
  operations.pilotControl.issueLog = Array.isArray(operations.pilotControl.issueLog) ? operations.pilotControl.issueLog : [];
  operations.agentNetwork = operations.agentNetwork && typeof operations.agentNetwork === "object" ? operations.agentNetwork : {};
  operations.agentNetwork.directory = Array.isArray(operations.agentNetwork.directory) ? operations.agentNetwork.directory : [];
  operations.agentNetwork.outreachLog = Array.isArray(operations.agentNetwork.outreachLog) ? operations.agentNetwork.outreachLog : [];
  operations.agentNetwork.importBatches = Array.isArray(operations.agentNetwork.importBatches) ? operations.agentNetwork.importBatches : [];
  operations.financeControl =
    operations.financeControl && typeof operations.financeControl === "object"
      ? operations.financeControl
      : defaultFinanceControlConfig();
  operations.whatsapp = operations.whatsapp && typeof operations.whatsapp === "object" ? operations.whatsapp : {};
  operations.whatsapp.bridge =
    operations.whatsapp.bridge && typeof operations.whatsapp.bridge === "object"
      ? operations.whatsapp.bridge
      : {
          mode: config.whatsappMode,
          connected: getWhatsappRuntime().liveDeliveryConnected,
          provider: getWhatsappRuntime().provider,
          status: getWhatsappRuntime().status,
          lastHeartbeatAt: nowIso(),
          lastProcessedAt: nowIso()
        };
  operations.whatsapp.bridge.mode = operations.whatsapp.bridge.mode || config.whatsappMode;
  operations.whatsapp.bridge.provider = operations.whatsapp.bridge.provider || getWhatsappRuntime().provider;
  operations.whatsapp.bridge.connected = getWhatsappRuntime().liveDeliveryConnected;
  operations.whatsapp.bridge.status = getWhatsappRuntime().status;
  operations.whatsapp.queue = Array.isArray(operations.whatsapp.queue) ? operations.whatsapp.queue : [];
  operations.whatsapp.threads = Array.isArray(operations.whatsapp.threads) ? operations.whatsapp.threads : [];
  operations.whatsapp.feedbackLog = Array.isArray(operations.whatsapp.feedbackLog) ? operations.whatsapp.feedbackLog : [];
  operations.whatsapp.contactShareLog = Array.isArray(operations.whatsapp.contactShareLog)
    ? operations.whatsapp.contactShareLog
    : [];

  const defaults = defaultOperationsState();
  if (!operations.organisations.length) operations.organisations = defaults.organisations;
  if (!operations.branches.length) operations.branches = defaults.branches;
  if (!operations.partyUsers.length) operations.partyUsers = defaults.partyUsers;
  if (!operations.teamMembers.length) operations.teamMembers = defaults.teamMembers;
  if (!operations.tasks.length) operations.tasks = defaults.tasks;
  if (!operations.reminders.length) operations.reminders = defaults.reminders;
  if (!operations.escalations.length) operations.escalations = defaults.escalations;
  if (!operations.commissionTimeline.length) operations.commissionTimeline = defaults.commissionTimeline;
  if (!operations.dealRooms.length) operations.dealRooms = defaults.dealRooms;
  if (!operations.servicePulse.length) operations.servicePulse = defaults.servicePulse;
  if (!operations.pilotControl.agents.length) operations.pilotControl.agents = defaults.pilotControl.agents;
  if (!operations.pilotControl.scenarios.length) operations.pilotControl.scenarios = defaults.pilotControl.scenarios;
  if (!operations.agentNetwork.directory.length) operations.agentNetwork.directory = defaults.agentNetwork.directory;
  if (!operations.agentNetwork.importBatches.length) operations.agentNetwork.importBatches = defaults.agentNetwork.importBatches;
  if (!operations.whatsapp.queue.length) operations.whatsapp.queue = defaults.whatsapp.queue;
  if (!operations.whatsapp.threads.length) operations.whatsapp.threads = defaults.whatsapp.threads;

  operations.teamMembers = operations.teamMembers.map((member) => {
    const role = normalizeRole(member.role);
    const defaults = inferScopeDefaults(member);
    const scoped = {
      ...member,
      agencyId: member.agencyId || defaults.agencyId,
      branchId: member.branchId || defaults.branchId,
      provinceId: normalizeProvinceId(member.provinceId || member.province || defaults.provinceId),
      agentId: member.agentId || (role === "agent" ? member.id : undefined),
      assignedAgentId: member.assignedAgentId || member.agentId || (role === "agent" ? member.id : undefined)
    };
    return {
      ...scoped,
      role,
      scope: scopeFromRecord(scoped, role)
    };
  });
  operations.partyUsers = operations.partyUsers.map((party) => {
    const role = normalizeRole(party.role || party.partyType);
    const scoped = withScopeDefaults(party);
    return {
      ...scoped,
      role,
      partyType: role,
      scope: scopeFromRecord(scoped, role)
    };
  });
  operations.tasks = operations.tasks.map(withScopeDefaults);
  operations.reminders = operations.reminders.map(withScopeDefaults);
  operations.escalations = operations.escalations.map(withScopeDefaults);
  operations.commissionTimeline = operations.commissionTimeline.map(withScopeDefaults);
  operations.dealRooms = operations.dealRooms.map(withScopeDefaults);
  operations.servicePulse = operations.servicePulse.map(withScopeDefaults);
  operations.pilotControl.agents = operations.pilotControl.agents.map(withScopeDefaults);
  operations.pilotControl.scenarios = operations.pilotControl.scenarios.map(withScopeDefaults);
  operations.pilotControl.messageLog = operations.pilotControl.messageLog.map(withScopeDefaults);
  operations.pilotControl.issueLog = operations.pilotControl.issueLog.map(withScopeDefaults);
  operations.agentNetwork.directory = operations.agentNetwork.directory.map(normalizeAgentNetworkRecord);
  operations.agentNetwork.outreachLog = operations.agentNetwork.outreachLog.map(withScopeDefaults);
  operations.agentNetwork.importBatches = operations.agentNetwork.importBatches.map(withScopeDefaults);
  operations.financeControl = {
    ...defaultFinanceControlConfig(),
    ...operations.financeControl,
    budgetLines:
      Array.isArray(operations.financeControl.budgetLines) && operations.financeControl.budgetLines.length
        ? operations.financeControl.budgetLines
        : defaultFinanceControlConfig().budgetLines
  };
  operations.whatsapp.queue = operations.whatsapp.queue.map(withScopeDefaults);
  operations.whatsapp.threads = operations.whatsapp.threads.map(withScopeDefaults);
  operations.whatsapp.feedbackLog = operations.whatsapp.feedbackLog.map(withScopeDefaults);
  operations.whatsapp.contactShareLog = operations.whatsapp.contactShareLog.map(withScopeDefaults);

  return operations;
}

function createCommissionTimelineEntry(payload) {
  const createdAt = nowIso();
  const paymentStatus = String(payload.paymentStatus || "Protected / Awaiting invoice").trim();
  const evidence = String(payload.evidence || "Evidence logged").trim();
  return {
    id: createOpsId("protect"),
    caseId: String(payload.caseId || slugify(payload.caseName) || createOpsId("case")).trim(),
    caseName: String(payload.caseName || "Protected deal").trim(),
    area: String(payload.area || inferAreaFromCaseName(payload.caseName)).trim(),
    agent: String(payload.agent || "Assigned agent").trim(),
    split: String(payload.split || "Split to confirm").trim(),
    fee: String(payload.fee || "Fee to confirm").trim(),
    dueDate: String(payload.dueDate || "TBC").trim(),
    evidence,
    proofItem: String(payload.proofItem || evidence).trim(),
    paymentStatus,
    referralStatus: String(payload.referralStatus || "Protected").trim(),
    milestone: String(payload.milestone || "Commission protection logged").trim(),
    checkpoint: String(payload.checkpoint || payload.dueDate || "Next payment check to confirm").trim(),
    updated: formatOpsTimestamp(createdAt),
    updatedAt: createdAt,
    riskTag: String(payload.riskTag || paymentStatus).trim()
  };
}

function defaultFinanceControlConfig() {
  return {
    currency: "ZAR",
    seatPricePerAgent: 125,
    averageReferralFee: 20000,
    budgetLines: [
      { key: "concierge", label: "Concierge + admin desk", amount: 8500 },
      { key: "ai_stack", label: "AI, WhatsApp and tooling", amount: 2800 },
      { key: "marketing", label: "Lead generation and outreach", amount: 6000 },
      { key: "pilot", label: "Pilot testing and QA", amount: 2200 },
      { key: "buffer", label: "Operating buffer", amount: 2500 }
    ],
    note: "Working monthly planning view. Tune the budget lines later as live costs settle."
  };
}

function formatMoneyAmount(value, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function monthLabelFor(date = new Date()) {
  return new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(date);
}

function buildFinanceControlSnapshot(sessionOrRole, visible = {}, leadActionCentre = null, agentSuccessDesk = null) {
  const operations = getOperationsState();
  const finance = {
    ...defaultFinanceControlConfig(),
    ...(operations.financeControl || {})
  };
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTeam = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const successDesk = agentSuccessDesk || buildAgentSuccessDesk(sessionOrRole, visible, actionCentre);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthFees = visibleCommission.filter((item) => String(item.dueDate || "").startsWith(currentMonthKey));
  const allFeeValues = visibleCommission.map((item) => parseMoneyAmount(item.fee)).filter((amount) => amount > 0);
  const averageReferralFee = allFeeValues.length
    ? Math.round(allFeeValues.reduce((total, amount) => total + amount, 0) / allFeeValues.length)
    : Number(finance.averageReferralFee || 20000);
  const paidThisMonth = monthFees
    .filter((item) => /paid/i.test(String(item.paymentStatus || "")))
    .reduce((total, item) => total + parseMoneyAmount(item.fee), 0);
  const protectedPipeline = monthFees
    .filter((item) => !/paid/i.test(String(item.paymentStatus || "")))
    .reduce((total, item) => total + parseMoneyAmount(item.fee), 0);
  const seatCount = Math.max(Number(successDesk.summary?.agents || 0), visibleTeam.length);
  const seatRevenue = seatCount * Number(finance.seatPricePerAgent || 125);
  const budgetLines = Array.isArray(finance.budgetLines) ? finance.budgetLines : [];
  const monthlyBudget = budgetLines.reduce((total, line) => total + Number(line.amount || 0), 0);
  const hotLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "hot").length;
  const warmLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "warm").length;
  const nurtureLeads = visibleLeads.filter((lead) => lead.leadQuality?.band === "nurture").length;
  const criticalActions = Number(actionCentre.summary?.critical || 0);
  const aiUpside = Math.round(
    averageReferralFee * ((hotLeads * 0.35) + (warmLeads * 0.18) + (nurtureLeads * 0.08))
  );
  const projectedForecast = seatRevenue + protectedPipeline + paidThisMonth;
  const aiProjection = projectedForecast + aiUpside;
  const forecastVariance = projectedForecast - monthlyBudget;
  const aiVariance = aiProjection - monthlyBudget;
  const forecastStatus =
    projectedForecast >= monthlyBudget * 1.05
      ? "Ahead of plan"
      : projectedForecast >= monthlyBudget * 0.9
        ? "Close to plan"
        : "Below plan";
  const aiConfidence = hotLeads + warmLeads >= 4 ? "Medium" : hotLeads >= 2 ? "Medium" : "Low";
  const primaryDriver =
    protectedPipeline >= seatRevenue
      ? "Protected commission pipeline is carrying the current forecast."
      : "Recurring seat revenue is the steadier base layer right now.";
  const riskNote = criticalActions
    ? `${criticalActions} critical action card${criticalActions === 1 ? "" : "s"} could delay conversion if they sit too long.`
    : "No critical action pile-up is distorting the projection right now.";

  return {
    monthLabel: monthLabelFor(now),
    note: finance.note || defaultFinanceControlConfig().note,
    budget: {
      total: monthlyBudget,
      formattedTotal: formatMoneyAmount(monthlyBudget, finance.currency),
      lines: budgetLines.map((line) => ({
        ...line,
        formattedAmount: formatMoneyAmount(line.amount, finance.currency)
      }))
    },
    forecast: {
      total: projectedForecast,
      formattedTotal: formatMoneyAmount(projectedForecast, finance.currency),
      variance: forecastVariance,
      varianceLabel: forecastVariance >= 0
        ? `${formatMoneyAmount(Math.abs(forecastVariance), finance.currency)} above budget`
        : `${formatMoneyAmount(Math.abs(forecastVariance), finance.currency)} below budget`,
      status: forecastStatus,
      components: [
        {
          label: "Agent subscriptions",
          value: formatMoneyAmount(seatRevenue, finance.currency),
          note: `${seatCount} active agent seat${seatCount === 1 ? "" : "s"} at ${formatMoneyAmount(finance.seatPricePerAgent, finance.currency)} each.`
        },
        {
          label: "Protected commission due",
          value: formatMoneyAmount(protectedPipeline, finance.currency),
          note: `${monthFees.filter((item) => !/paid/i.test(String(item.paymentStatus || ""))).length} protected matter${monthFees.filter((item) => !/paid/i.test(String(item.paymentStatus || ""))).length === 1 ? "" : "s"} due this month.`
        },
        {
          label: "Paid this month",
          value: formatMoneyAmount(paidThisMonth, finance.currency),
          note: "Already converted inside the visible July protection timeline."
        }
      ],
      primaryDriver
    },
    aiProjection: {
      total: aiProjection,
      formattedTotal: formatMoneyAmount(aiProjection, finance.currency),
      upside: aiUpside,
      upsideLabel: formatMoneyAmount(aiUpside, finance.currency),
      variance: aiVariance,
      varianceLabel: aiVariance >= 0
        ? `${formatMoneyAmount(Math.abs(aiVariance), finance.currency)} above budget`
        : `${formatMoneyAmount(Math.abs(aiVariance), finance.currency)} below budget`,
      confidence: aiConfidence,
      note: "AI projection uses live lead quality, current protected commission pipeline, and recurring agent-seat revenue. It is directional, not booked revenue.",
      riskNote,
      signals: [
        {
          label: "Hot leads",
          value: `${hotLeads}`,
          note: "Best immediate conversion candidates in the current workspace."
        },
        {
          label: "Warm leads",
          value: `${warmLeads}`,
          note: "Likely to convert once the next missing step or client nudge is cleared."
        },
        {
          label: "Avg protected fee",
          value: formatMoneyAmount(averageReferralFee, finance.currency),
          note: "Average expected fee across the visible protection desk."
        },
        {
          label: "Critical action risk",
          value: `${criticalActions}`,
          note: riskNote
        }
      ]
    }
  };
}

function createDealRoomRecord(payload, request) {
  const createdAt = nowIso();
  const roomId = String(payload.roomId || payload.room || "").trim().toUpperCase() || `AX-${randomBytes(3).toString("hex").toUpperCase()}`;
  const roomSlug = slugify(payload.caseName || roomId) || roomId.toLowerCase();
  const shareUrl = `${getRequestOrigin(request)}/client-progress.html?room=${encodeURIComponent(roomId)}&slug=${encodeURIComponent(roomSlug)}`;

  return {
    id: createOpsId("room"),
    roomId,
    roomSlug,
    caseId: String(payload.caseId || slugify(payload.caseName) || createOpsId("case")).trim(),
    caseName: String(payload.caseName || "Client matter").trim(),
    clientName: String(payload.clientName || "Client").trim(),
    stage: String(payload.stage || "Stage to confirm").trim(),
    progress: Math.max(5, Math.min(Number(payload.progress || 0), 100)),
    nextStep: String(payload.nextStep || "Next step to confirm").trim(),
    accessCode: String(payload.accessCode || "").trim(),
    shareMessage: String(payload.shareMessage || "").trim(),
    shareUrl,
    createdAt,
    updatedAt: createdAt
  };
}

function defaultOperationsState() {
  const createdAt = nowIso();

  return {
    organisations: [
      {
        id: "agency-axiom",
        name: "Axiom Realty AI Demo Agency",
        provinceIds: ["western-cape", "kwazulu-natal"],
        branchIds: ["branch-cape", "branch-kzn"],
        status: "active"
      },
      {
        id: "agency-2",
        name: "Estate Agency 2",
        provinceIds: ["gauteng"],
        branchIds: ["branch-gauteng-north"],
        status: "ready"
      }
    ],
    branches: [
      {
        id: "branch-cape",
        agencyId: "agency-axiom",
        name: "Western Cape Branch",
        provinceId: "western-cape",
        adminIds: ["admin-nadine"],
        agentIds: ["agent-aisha"]
      },
      {
        id: "branch-kzn",
        agencyId: "agency-axiom",
        name: "KwaZulu-Natal Branch",
        provinceId: "kwazulu-natal",
        adminIds: ["admin-nadine"],
        agentIds: ["agent-lebo"]
      },
      {
        id: "branch-gauteng-north",
        agencyId: "agency-2",
        name: "Gauteng North Branch",
        provinceId: "gauteng",
        adminIds: [],
        agentIds: []
      }
    ],
    teamMembers: [
      {
        id: "principal-stefan",
        name: "Stefan Roodt",
        role: "principal",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        scope: defaultScopeForRole("principal"),
        lane: "Office command",
        contact: getRoleSigninContact("principal"),
        status: "online",
        responsibilities: [
          "Final escalation decisions",
          "Commission exposure oversight",
          "Office performance review"
        ]
      },
      {
        id: "admin-nadine",
        name: "Nadine Smit",
        role: "office_admin",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        scope: defaultScopeForRole("office_admin"),
        lane: "Control desk",
        contact: getRoleSigninContact("office_admin"),
        status: "online",
        responsibilities: [
          "Lead routing and assignment",
          "Document chase and updates",
          "Friday seller packs and approvals"
        ]
      },
      {
        id: "agent-aisha",
        name: "Aisha Khan",
        role: "agent",
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        scope: { ...defaultScopeForRole("agent"), agentIds: ["agent-aisha"], caseIds: ["case-claremont"] },
        lane: "Claremont / sellers",
        contact: "aisha@axiomrealty.co.za",
        status: "busy",
        responsibilities: [
          "Seller brief follow-through",
          "Viewing confirmations",
          "Client WhatsApp updates"
        ]
      },
      {
        id: "agent-lebo",
        name: "Lebo Naidoo",
        role: "agent",
        agencyId: "agency-axiom",
        branchId: "branch-kzn",
        provinceId: "kwazulu-natal",
        agentId: "agent-lebo",
        scope: {
          allAccess: false,
          agencyIds: ["agency-axiom"],
          branchIds: ["branch-kzn"],
          provinceIds: ["kwazulu-natal"],
          agentIds: ["agent-lebo"],
          caseIds: ["case-durban"]
        },
        lane: "Durban North / referrals",
        contact: "lebo@axiomrealty.co.za",
        status: "online",
        responsibilities: [
          "Referral acceptance",
          "Buyer progression",
          "Commission proof capture"
        ]
      }
    ],
    partyUsers: [
      {
        id: "buyer-naledi",
        name: "Naledi Mokoena",
        role: "buyer",
        partyType: "buyer",
        contact: getRoleSigninContact("buyer"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("buyer"), caseIds: ["case-claremont"] }
      },
      {
        id: "seller-dylan",
        name: "Dylan Peters",
        role: "seller",
        partyType: "seller",
        contact: getRoleSigninContact("seller"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("seller"), caseIds: ["case-claremont"] }
      },
      {
        id: "attorney-transfer",
        name: "Transfer Attorney",
        role: "attorney",
        partyType: "attorney",
        contact: getRoleSigninContact("attorney"),
        agencyId: "agency-axiom",
        branchId: "branch-cape",
        provinceId: "western-cape",
        agentId: "agent-aisha",
        caseIds: ["case-claremont"],
        scope: { ...defaultScopeForRole("attorney"), caseIds: ["case-claremont"] }
      },
      {
        id: "bond-originator",
        name: "Bond Originator",
        role: "bond_originator",
        partyType: "bond_originator",
        contact: getRoleSigninContact("bond_originator"),
        agencyId: "agency-axiom",
        branchId: "branch-kzn",
        provinceId: "kwazulu-natal",
        agentId: "agent-lebo",
        caseIds: ["case-durban"],
        scope: { ...defaultScopeForRole("bond_originator"), caseIds: ["case-durban"] }
      }
    ],
    tasks: [
      {
        id: "task-claremont-viewing",
        title: "Schedule Claremont viewing",
        caseName: "Claremont family home",
        caseId: "case-claremont",
        ownerId: "agent-aisha",
        ownerName: "Aisha Khan",
        role: "agent",
        category: "Viewing",
        priority: "high",
        dueLabel: "Today by 15:00",
        status: "open",
        nextAction: "Confirm buyer and seller time, then mark done.",
        source: "Viewing coordinator"
      },
      {
        id: "task-durban-terms",
        title: "Resolve Durban referral terms",
        caseName: "Durban North referral",
        caseId: "case-durban",
        ownerId: "principal-stefan",
        ownerName: "Stefan Roodt",
        role: "principal",
        category: "Commission",
        priority: "high",
        dueLabel: "Today by 17:00",
        status: "open",
        nextAction: "Confirm the 25% successful-sale-only structure and release the lead.",
        source: "Protection desk"
      },
      {
        id: "task-seller-pack",
        title: "Approve Friday seller pack",
        caseName: "Claremont family home",
        caseId: "case-claremont",
        ownerId: "admin-nadine",
        ownerName: "Nadine Smit",
        role: "office_admin",
        category: "Seller update",
        priority: "medium",
        dueLabel: "Friday 15:30",
        status: "open",
        nextAction: "Send approval ask to Aisha before the seller pack releases.",
        source: "Seller concierge"
      },
      {
        id: "task-finance-note",
        title: "Prompt buyer for finance documents",
        caseName: "Durban North referral",
        caseId: "case-durban",
        ownerId: "agent-lebo",
        ownerName: "Lebo Naidoo",
        role: "agent",
        category: "Finance",
        priority: "medium",
        dueLabel: "Tomorrow 10:00",
        status: "open",
        nextAction: "Send the finance-readiness note and store the reply.",
        source: "Buyer progression"
      }
    ],
    reminders: [
      {
        id: "reminder-claremont-viewing",
        caseId: "case-claremont",
        caseName: "Claremont family home",
        client: "Naledi Mokoena",
        ownerName: "Aisha Khan",
        dueLabel: "Today by 15:00",
        status: "pending",
        note: "Seller is ready. Agent needs to lock the viewing time with the buyer."
      },
      {
        id: "reminder-durban-feedback",
        caseId: "case-durban",
        caseName: "Durban North referral",
        client: "Jason Pillay",
        ownerName: "Lebo Naidoo",
        dueLabel: "Tomorrow by 10:00",
        status: "pending",
        note: "Ask for post-viewing feedback with a light opt-out."
      }
    ],
    escalations: [
      {
        id: "esc-durban",
        caseName: "Durban North referral",
        severity: "high",
        ownerName: "Stefan Roodt",
        reason: "Referral terms still not accepted",
        nextAction: "Principal to confirm the route before the lead drifts."
      },
      {
        id: "esc-umhlanga",
        caseName: "Umhlanga introduction",
        severity: "medium",
        ownerName: "Nadine Smit",
        reason: "Commission proof still missing",
        nextAction: "Office admin to chase signed split confirmation."
      }
    ],
    commissionTimeline: [
      {
        id: "protect-claremont",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        area: "Claremont",
        agent: "Aisha Khan",
        split: "25% referral split",
        fee: "R18,000",
        dueDate: "2026-07-12",
        evidence: "Signed split agreement attached",
        proofItem: "Signed split agreement + intro thread",
        paymentStatus: "Awaiting invoice",
        referralStatus: "Protected",
        milestone: "Offer accepted",
        checkpoint: "Invoice to receiving agency",
        updated: "2 Jul 2026, 10:40",
        updatedAt: createdAt,
        riskTag: "Commission Risk"
      },
      {
        id: "protect-durban",
        caseId: "case-durban",
        caseName: "Durban North referral",
        area: "Durban North",
        agent: "Lebo Naidoo",
        split: "25% referral split",
        fee: "R22,500",
        dueDate: "2026-07-18",
        evidence: "WhatsApp proof trail saved",
        proofItem: "WhatsApp acceptance + mandate note",
        paymentStatus: "Awaiting payment",
        referralStatus: "Sale pending",
        milestone: "Mandate live",
        checkpoint: "Check invoice and seller feedback",
        updated: "1 Jul 2026, 16:25",
        updatedAt: createdAt,
        riskTag: "Awaiting Payment"
      }
    ],
    dealRooms: [
      {
        id: "room-claremont",
        roomId: "CLAREMONT-4821",
        roomSlug: "claremont-sale-r3-85m",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        clientName: "Naledi Mokoena",
        stage: "Conveyancing in progress",
        progress: 60,
        nextStep: "Attorney to confirm draft transfer pack and next signature window.",
        accessCode: "AX-4821",
        shareMessage:
          "Here is your private Deal Room link and access code. Use it any time to see the current stage, what has been completed, what is still outstanding, and what happens next.",
        shareUrl: "http://127.0.0.1:8080/client-progress.html?room=CLAREMONT-4821&slug=claremont-sale-r3-85m",
        createdAt,
        updatedAt: createdAt
      }
    ],
    servicePulse: [
      {
        id: "pulse-claremont-seller",
        caseId: "case-claremont",
        caseName: "Claremont sale - R3.85m",
        agentId: "agent-aisha",
        agentName: "Aisha Khan",
        respondentRole: "seller",
        respondentName: "Dylan Peters",
        touchpoint: "weekly_seller_update",
        touchpointLabel: "Weekly seller update",
        score: 9,
        sentiment: "delighted",
        tags: ["clear update", "felt looked after"],
        comment: "The Friday update was clear and helped me understand the next step without chasing.",
        source: "whatsapp",
        usedForMatching: true,
        visibility: "internal_scorecard",
        quarter: quarterKey(createdAt),
        learningSignals: {
          triggerPoint: "friday_1530_seller_update",
          recoveryNeeded: false,
          matchingWeight: 90
        },
        createdAt,
        updatedAt: createdAt
      }
    ],
    pilotControl: {
      agents: [
        {
          id: "pilot-aisha",
          caseId: "pilot-agent-aisha",
          agentId: "agent-aisha",
          assignedAgentId: "agent-aisha",
          agentName: "Aisha Khan",
          agencyName: "Axiom Realty AI Demo Agency",
          branchId: "branch-cape",
          provinceId: "western-cape",
          whatsappNumber: "+27 82 000 0001",
          status: "active",
          readiness: "opted_in",
          scenariosPassed: ["scenario-morning-brief"],
          currentScenarioId: "scenario-deal-room-share",
          nextTest: "Deal Room link and access-code flow",
          issueCount: 0,
          lastScenarioAt: createdAt,
          notes: "Internal pilot agent for WhatsApp workflow checks."
        },
        {
          id: "pilot-lebo",
          caseId: "pilot-agent-lebo",
          agentId: "agent-lebo",
          assignedAgentId: "agent-lebo",
          agentName: "Lebo Naidoo",
          agencyName: "Axiom Realty AI Demo Agency",
          branchId: "branch-kzn",
          provinceId: "kwazulu-natal",
          whatsappNumber: "+27 83 000 0002",
          status: "invited",
          readiness: "awaiting_opt_in",
          scenariosPassed: [],
          currentScenarioId: "scenario-import-lead",
          nextTest: "Imported buyer lead to protected commission route",
          issueCount: 0,
          lastScenarioAt: "",
          notes: "Waiting for WhatsApp opt-in before live testing."
        }
      ],
      scenarios: [
        {
          id: "scenario-seller-lead",
          caseId: "pilot-scenario-seller-lead",
          title: "New seller lead",
          triggerPoint: "Seller submits lead or is imported by agent",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives a clean seller brief, next action and commission-protection reminder.",
          body:
            "Pilot scenario: new seller lead. Axiom should send you a concise seller brief, missing questions, next best action, and commission-protection reminder. Reply PASS if this feels useful or ISSUE with what broke.",
          passCriteria: ["Brief is clear", "Next action is obvious", "No sensitive data leaks"]
        },
        {
          id: "scenario-buyer-lead",
          caseId: "pilot-scenario-buyer-lead",
          title: "New buyer lead",
          triggerPoint: "Buyer is captured through the site, WhatsApp or agent import",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives finance readiness, area intent, timing and next follow-up.",
          body:
            "Pilot scenario: new buyer lead. Axiom should summarise finance readiness, area intent, timing, and your next follow-up. Reply PASS if usable or ISSUE with what needs fixing.",
          passCriteria: ["Finance position visible", "Intent is clear", "Follow-up feels natural"]
        },
        {
          id: "scenario-viewing-reminder",
          caseId: "pilot-scenario-viewing-reminder",
          title: "Viewing reminder",
          triggerPoint: "Viewing needs scheduling or confirmation",
          channel: "WhatsApp",
          expectedOutcome: "Agent gets a reminder to schedule, plus a Done action after they confirm.",
          body:
            "Pilot scenario: viewing reminder. Axiom should remind you to schedule the viewing, then let you mark it done once confirmed. Reply PASS if this reduces admin or ISSUE if it nags at the wrong moment.",
          passCriteria: ["Reminder is useful", "Agent stays in control", "No over-automation"]
        },
        {
          id: "scenario-seller-update",
          caseId: "pilot-scenario-seller-update",
          title: "Friday seller update",
          triggerPoint: "Friday 15:30 seller update approval",
          channel: "WhatsApp",
          expectedOutcome: "Agent receives a concise seller update draft and chooses whether to send.",
          body:
            "Pilot scenario: Friday seller update. Axiom should ask permission before sending the seller update and keep the wording concise. Reply PASS if the control feels right or ISSUE if the wording is off.",
          passCriteria: ["Agent approval required", "Seller wording is calm", "No duplicate feature confusion"]
        },
        {
          id: "scenario-deal-room-share",
          caseId: "pilot-scenario-deal-room-share",
          title: "Deal Room share",
          triggerPoint: "Client needs progress visibility",
          channel: "WhatsApp",
          expectedOutcome: "Agent can send one private progress link with access code and clear next step.",
          body:
            "Pilot scenario: Deal Room share. Axiom should prepare one private progress link and access code for the client. Reply PASS if it reduces update chasing or ISSUE if anything is unclear.",
          passCriteria: ["Link purpose is clear", "Access code is included", "Progress view is client-safe"]
        },
        {
          id: "scenario-service-pulse",
          caseId: "pilot-scenario-service-pulse",
          title: "Service Pulse",
          triggerPoint: "After a completed service moment",
          channel: "WhatsApp",
          expectedOutcome: "Client feedback is requested gently, optional, stored, and visible internally.",
          body:
            "Pilot scenario: Service Pulse. Axiom should ask for feedback gently after a useful service moment and store it internally. Reply PASS if it feels respectful or ISSUE if it feels like a public rating.",
          passCriteria: ["Feedback is optional", "No public shaming", "Stored against case"]
        }
      ],
      messageLog: [
        {
          id: "pilot-msg-aisha",
          caseId: "pilot-agent-aisha",
          agentId: "agent-aisha",
          agentName: "Aisha Khan",
          scenarioId: "scenario-morning-brief",
          scenarioTitle: "Daily Morning Brief",
          status: "passed",
          channel: "WhatsApp",
          body: "Morning Brief test passed during internal pilot setup.",
          queuedAt: createdAt,
          updatedAt: createdAt
        }
      ],
      issueLog: []
    },
    agentNetwork: {
      directory: [
        {
          id: "network-aisha-khan",
          agentName: "Aisha Khan",
          agencyName: "Axiom Realty AI Demo Agency",
          branchName: "Western Cape Branch",
          provinceId: "western-cape",
          towns: ["Claremont", "Rondebosch", "Newlands"],
          suburbs: ["Claremont", "Rondebosch", "Newlands"],
          specialties: ["seller mandates", "family homes", "progress updates"],
          languages: ["English"],
          independentStatus: "agency_agent",
          ppraStatus: "to_confirm",
          contact: {
            email: "aisha@axiomrealty.co.za",
            mobile: "+27 82 000 0001",
            whatsapp: "+27 82 000 0001",
            website: "https://www.axiomrealty.co.za"
          },
          source: {
            type: "internal_demo",
            name: "Axiom internal pilot",
            url: "https://www.axiomrealty.co.za",
            note: "Seed record for pilot matching and WhatsApp testing.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "business_context",
            whatsappStatus: "opted_in",
            doNotContact: false,
            lawfulUseNote: "Internal pilot agent; WhatsApp testing permitted."
          },
          verification: {
            status: "verified",
            lastVerifiedAt: createdAt,
            verifiedBy: "Axiom",
            reviewNote: "Internal pilot record."
          },
          outreach: {
            status: "pilot_active",
            count: 1,
            lastContactedAt: createdAt,
            lastChannel: "WhatsApp",
            pilotStatus: "active"
          },
          matchingSignals: {
            sellerFit: 86,
            buyerFit: 62,
            referralFit: 82,
            servicePulseAvg: 9,
            responseReliability: 82,
            capacity: "medium"
          }
        },
        {
          id: "network-lebo-naidoo",
          agentName: "Lebo Naidoo",
          agencyName: "Axiom Realty AI Demo Agency",
          branchName: "KwaZulu-Natal Branch",
          provinceId: "kwazulu-natal",
          towns: ["Durban North", "Umhlanga", "Ballito"],
          suburbs: ["Durban North", "Umhlanga"],
          specialties: ["buyer progression", "referrals", "commission proof"],
          languages: ["English"],
          independentStatus: "agency_agent",
          ppraStatus: "to_confirm",
          contact: {
            email: "lebo@axiomrealty.co.za",
            mobile: "+27 83 000 0002",
            whatsapp: "+27 83 000 0002",
            website: "https://www.axiomrealty.co.za"
          },
          source: {
            type: "internal_demo",
            name: "Axiom internal pilot",
            url: "https://www.axiomrealty.co.za",
            note: "Seed record for KZN referral coverage.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "business_context",
            whatsappStatus: "not_contacted",
            doNotContact: false,
            lawfulUseNote: "Internal pilot agent; verify WhatsApp opt-in before live tests."
          },
          verification: {
            status: "verified",
            lastVerifiedAt: createdAt,
            verifiedBy: "Axiom",
            reviewNote: "Internal pilot record."
          },
          outreach: {
            status: "invited",
            count: 0,
            lastContactedAt: "",
            lastChannel: "",
            pilotStatus: "awaiting_opt_in"
          },
          matchingSignals: {
            sellerFit: 65,
            buyerFit: 78,
            referralFit: 84,
            servicePulseAvg: 0,
            responseReliability: 70,
            capacity: "to_confirm"
          }
        },
        {
          id: "network-public-cape-specialist",
          agentName: "Public Cape Specialist",
          agencyName: "Public Domain Realty",
          branchName: "Cape Town",
          provinceId: "western-cape",
          towns: ["Cape Town", "Claremont", "Sea Point"],
          suburbs: ["Claremont", "Sea Point"],
          specialties: ["seller mandates", "sectional title", "premium listings"],
          languages: ["English", "Afrikaans"],
          independentStatus: "franchise_or_agency",
          ppraStatus: "to_confirm",
          contact: {
            email: "cape.specialist@example.co.za",
            mobile: "+27 82 111 2233",
            whatsapp: "+27 82 111 2233",
            website: "https://example.co.za/agents/cape-specialist"
          },
          source: {
            type: "public_domain",
            name: "Public agency profile",
            url: "https://example.co.za/agents/cape-specialist",
            note: "Public business profile captured for internal coverage mapping. Verify before outreach.",
            capturedAt: createdAt,
            capturedBy: "Axiom"
          },
          consent: {
            emailStatus: "not_contacted",
            whatsappStatus: "not_contacted",
            doNotContact: false,
            lawfulUseNote: "Use for internal matching and one-to-one business invitation only after manual review."
          },
          verification: {
            status: "source_found",
            lastVerifiedAt: "",
            verifiedBy: "",
            reviewNote: "Needs human source check before first outreach."
          },
          outreach: {
            status: "not_contacted",
            count: 0,
            lastContactedAt: "",
            lastChannel: "",
            pilotStatus: "candidate"
          },
          matchingSignals: {
            sellerFit: 80,
            buyerFit: 58,
            referralFit: 76,
            servicePulseAvg: 0,
            responseReliability: 50,
            capacity: "unknown"
          }
        }
      ],
      outreachLog: [],
      importBatches: [
        {
          id: "network-batch-seed",
          caseId: "agent-network-seed",
          name: "Seed agent network records",
          sourceType: "manual_seed",
          recordCount: 3,
          acceptedCount: 3,
          rejectedCount: 0,
          createdAt,
          agencyId: "agency-axiom",
          branchId: "branch-cape",
          provinceId: "western-cape"
        }
      ]
    },
    whatsapp: {
      bridge: {
        mode: config.whatsappMode,
        connected: getWhatsappRuntime().liveDeliveryConnected,
        provider: getWhatsappRuntime().provider,
        status: getWhatsappRuntime().status,
        lastHeartbeatAt: createdAt,
        lastProcessedAt: createdAt
      },
      queue: [
        {
          id: "msg-queued-claremont",
          caseId: "case-claremont",
          caseName: "Claremont family home",
          threadId: "thread-claremont",
          category: "seller-update-approval",
          toName: "Aisha Khan",
          toRole: "agent",
          ownerName: "Nadine Smit",
          body: "Seller update ready for Dylan Peters. Reply SEND if you want me to send the concise Friday update to the seller.",
          status: "queued",
          createdAt,
          scheduledFor: createdAt,
          approvalRequired: false
        }
      ],
      threads: [
        {
          id: "thread-claremont",
          caseId: "case-claremont",
          caseName: "Claremont family home",
          participants: ["Aisha Khan", "Dylan Peters", "Nadine Smit"],
          lastAt: createdAt,
          unreadCount: 1,
          messages: [
            {
              id: createOpsId("wa"),
              direction: "inbound",
              author: "Dylan Peters",
              body: "Please keep me posted on the next viewing slot.",
              at: createdAt,
              status: "received"
            }
          ]
        },
        {
          id: "thread-durban",
          caseId: "case-durban",
          caseName: "Durban North referral",
          participants: ["Lebo Naidoo", "Jason Pillay", "Stefan Roodt"],
          lastAt: createdAt,
          unreadCount: 0,
          messages: [
            {
              id: createOpsId("wa"),
              direction: "outbound",
              author: "Axiom",
              body: "Hi Jason. Before we line up the next viewing, I just want to help make the finance side feel cleaner.",
              at: createdAt,
              status: "delivered"
            }
          ]
        }
      ],
      feedbackLog: [
        {
          id: "feedback-claremont",
          property: "Claremont family home",
          buyer: "Naledi Mokoena",
          agent: "Aisha Khan",
          state: "Request queued",
          source: "Axiom",
          note: "A gentle feedback request was queued after the viewing, with a clear no-feedback option.",
          copiedToAgent: true,
          optional: true,
          at: formatOpsTimestamp(createdAt),
          timeMs: Date.parse(createdAt)
        }
      ],
      contactShareLog: [
        {
          id: "contact-durban",
          property: "Durban North referral",
          agentName: "Lebo Naidoo",
          target: "seller",
          targetName: "Megan Reddy",
          at: formatOpsTimestamp(createdAt),
          timeMs: Date.parse(createdAt),
          message:
            "Hi Megan. Your Axiom agent is Lebo Naidoo. Mobile: 083 612 9004. Email: lebo@axiomrealty.co.za. Reach out directly whenever you need clarity."
        }
      ]
    }
  };
}

async function ensureStorage() {
  if (storage) return storage;
  storage = await createStorage(process.env, { dataDir });
  return storage;
}

async function loadState() {
  const store = await ensureStorage();
  const snapshot = await store.loadAll();
  state.leads = Array.isArray(snapshot.leads) ? snapshot.leads : [];
  state.sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  state.auditLog = Array.isArray(snapshot.auditLog) ? snapshot.auditLog : [];
  state.otpChallenges = Array.isArray(snapshot.otpChallenges) ? snapshot.otpChallenges : [];
  const loadedOperations = snapshot.operations;
  const shouldRepairOperations =
    !loadedOperations ||
    typeof loadedOperations !== "object" ||
    Array.isArray(loadedOperations) ||
    !Array.isArray(loadedOperations.organisations) ||
    !Array.isArray(loadedOperations.branches) ||
    !Array.isArray(loadedOperations.partyUsers) ||
    !Array.isArray(loadedOperations.teamMembers) ||
    !Array.isArray(loadedOperations.tasks) ||
    !Array.isArray(loadedOperations.reminders) ||
    !Array.isArray(loadedOperations.escalations) ||
    !Array.isArray(loadedOperations.commissionTimeline) ||
    !Array.isArray(loadedOperations.dealRooms) ||
    !Array.isArray(loadedOperations.servicePulse) ||
    !Array.isArray(loadedOperations.pilotControl?.agents) ||
    !Array.isArray(loadedOperations.pilotControl?.scenarios) ||
    !Array.isArray(loadedOperations.agentNetwork?.directory) ||
    !Array.isArray(loadedOperations.agentNetwork?.importBatches) ||
    !Array.isArray(loadedOperations.whatsapp?.queue) ||
    !Array.isArray(loadedOperations.whatsapp?.threads);
  state.operations = normalizeOperationsShape(loadedOperations);
  pruneExpiredSessions();
  pruneExpiredOtpChallenges();
  if (shouldRepairOperations) {
    await store.saveAll({
      leads: state.leads,
      sessions: state.sessions,
      auditLog: state.auditLog,
      otpChallenges: state.otpChallenges,
      operations: state.operations
    });
  }
}

async function persistState() {
  const store = await ensureStorage();
  await store.saveAll({
    leads: state.leads,
    sessions: state.sessions,
    auditLog: state.auditLog,
    otpChallenges: state.otpChallenges,
    operations: state.operations
  });
}

function pruneExpiredSessions() {
  const now = Date.now();
  state.sessions = state.sessions.filter((session) => {
    const expiresAt = new Date(session.expiresAt || 0).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function pruneExpiredOtpChallenges() {
  const now = Date.now();
  state.otpChallenges = state.otpChallenges.filter((challenge) => {
    const expiresAt = new Date(challenge.expiresAt || 0).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function audit(event, details = {}) {
  state.auditLog.unshift({
    id: randomBytes(8).toString("hex"),
    event,
    details,
    createdAt: new Date().toISOString()
  });
  state.auditLog = state.auditLog.slice(0, 500);
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header.split(";").reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getSessionFromRequest(request) {
  pruneExpiredSessions();
  const cookies = parseCookies(request);
  const token = cookies[missionControlCookie];
  if (!token) return null;
  const tokenHash = hashSecret(token);
  const session = state.sessions.find((entry) => safeEquals(entry.tokenHash, tokenHash));
  return session ? normalizeSessionRecord(session) : null;
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  response.end(text);
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getLlmRuntime() {
  const provider = ["nvidia", "openai"].includes(config.llmProvider) ? config.llmProvider : "none";
  const providerConfig =
    provider === "nvidia"
      ? {
          provider,
          apiKey: config.nvidiaApiKey,
          baseUrl: config.nvidiaBaseUrl,
          model: config.nvidiaModel,
          fallbackModel: config.nvidiaFallbackModel
        }
      : provider === "openai"
        ? {
            provider,
            apiKey: config.openaiApiKey,
            baseUrl: config.openaiBaseUrl,
            model: config.openaiModel,
            fallbackModel: ""
          }
        : {
            provider: "none",
            apiKey: "",
            baseUrl: "",
            model: "",
            fallbackModel: ""
          };

  let endpointHost = "";
  try {
    endpointHost = providerConfig.baseUrl ? new URL(providerConfig.baseUrl).host : "";
  } catch {
    endpointHost = "invalid-url";
  }

  return {
    ...providerConfig,
    endpointHost,
    ready: Boolean(providerConfig.apiKey && providerConfig.baseUrl && providerConfig.model)
  };
}

function getLlmStatus() {
  const runtime = getLlmRuntime();
  return {
    provider: runtime.provider,
    model: runtime.model || null,
    fallbackModel: runtime.fallbackModel || null,
    endpointHost: runtime.endpointHost || null,
    ready: runtime.ready,
    status: runtime.ready ? "ready_for_live_llm" : `workflow_ready_needs_${runtime.provider === "none" ? "provider" : `${runtime.provider}_key`}`
  };
}

function truncateForPrompt(value, maxLength = 5000) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n...[truncated]`;
}

async function callLiveLlm(messages, options = {}) {
  const runtime = getLlmRuntime();
  if (!runtime.ready) {
    const error = new Error("Live LLM is not configured.");
    error.statusCode = 503;
    throw error;
  }
  if (typeof fetch !== "function") {
    const error = new Error("This Node runtime does not expose fetch for LLM calls.");
    error.statusCode = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, Number(options.timeoutMs || 20000)));
  const basePayload = {
    messages,
    temperature: Number(options.temperature ?? 0.3),
    top_p: Number(options.topP ?? 0.9),
    max_tokens: Math.max(64, Math.min(4096, Number(options.maxTokens || 700))),
    stream: false
  };

  try {
    async function requestModel(model) {
      const payload = { ...basePayload, model };
      if (runtime.provider === "nvidia" && options.enableThinking && model.includes("nemotron")) {
        payload.extra_body = {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: Math.max(256, Math.min(4096, Number(options.reasoningBudget || 1024)))
        };
      }

      const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const raw = await response.text();
      const parsed = safeJsonParse(raw, {});
      if (!response.ok) {
        const error = new Error(parsed?.error?.message || parsed?.message || `LLM request failed with ${response.status}.`);
        error.statusCode = response.status;
        error.model = model;
        throw error;
      }
      return parsed;
    }

    let parsed;
    try {
      parsed = await requestModel(runtime.model);
    } catch (error) {
      const canFallback =
        runtime.provider === "nvidia" &&
        runtime.fallbackModel &&
        runtime.fallbackModel !== runtime.model &&
        [400, 404, 422, 429, 500, 502, 503, 504].includes(Number(error?.statusCode));
      if (!canFallback) throw error;
      parsed = await requestModel(runtime.fallbackModel);
    }

    const content = parsed?.choices?.[0]?.message?.content || parsed?.choices?.[0]?.delta?.content || "";
    return String(content || "").trim();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("LLM request timed out.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildConciergeSystemPrompt() {
  return [
    "You are Axiom Realty AI's South African estate-agent concierge.",
    "Draft concise, useful WhatsApp or admin messages for real estate leads and live transactions.",
    "Keep the tone calm, premium, direct and human.",
    "Do not overpromise, give legal advice, or claim a formal valuation.",
    "Protect POPIA: use only the supplied context and keep personal data minimal.",
    "When a message affects a client or agent relationship, assume a human approves it before send.",
    "Return only the message text. No markdown heading, no explanation."
  ].join(" ");
}

async function generateConciergeDraft({ purpose, audience, context, fallback, maxTokens = 450 }) {
  const safeFallback = String(fallback || "").trim();
  if (!getLlmRuntime().ready) {
    return {
      text: safeFallback,
      usedLiveLlm: false,
      status: getLlmStatus()
    };
  }

  try {
    const text = await callLiveLlm(
      [
        { role: "system", content: buildConciergeSystemPrompt() },
        {
          role: "user",
          content: [
            `Purpose: ${purpose || "Draft a concierge message."}`,
            `Audience: ${audience || "Axiom internal user or property client."}`,
            "Context:",
            truncateForPrompt(context || {}, 4500),
            "Draft the best next message."
          ].join("\n")
        }
      ],
      { maxTokens, temperature: 0.25, timeoutMs: 18000 }
    );
    return {
      text: text || safeFallback,
      usedLiveLlm: Boolean(text),
      status: getLlmStatus()
    };
  } catch (error) {
    return {
      text: safeFallback,
      usedLiveLlm: false,
      status: getLlmStatus(),
      error: error instanceof Error ? error.message : "LLM draft failed"
    };
  }
}

async function readBody(request, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getAnalytics() {
  return getScopedAnalytics();
}

function getScopedAnalytics(sessionOrRole) {
  const visibleLeads = sessionOrRole ? filterVisible(state.leads.map(withScopeDefaults), sessionOrRole) : state.leads;
  const totalLeads = visibleLeads.length;
  const sellerLeads = visibleLeads.filter((lead) => lead.intent === "sell").length;
  const buyerLeads = visibleLeads.filter((lead) => lead.intent === "buy").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = visibleLeads.filter((lead) => new Date(lead.createdAt).getTime() >= todayStart.getTime()).length;

  return {
    totalLeads,
    sellerLeads,
    buyerLeads,
    newToday: todayCount,
    lastLeadAt: visibleLeads[0]?.createdAt || null
  };
}

function summarizeLead(payload) {
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const summary = {};
  for (const answer of answers) {
    if (!answer || !answer.label) continue;
    summary[answer.label] = answer.value || "";
  }
  return summary;
}

function findSummaryValue(summary, labels = []) {
  const entries = Object.entries(summary || {});
  for (const label of labels) {
    const normalizedLabel = String(label).toLowerCase();
    const exact = entries.find(([key]) => String(key).toLowerCase() === normalizedLabel);
    if (exact?.[1]) return String(exact[1]).trim();
    const partial = entries.find(([key]) => String(key).toLowerCase().includes(normalizedLabel));
    if (partial?.[1]) return String(partial[1]).trim();
  }
  return "";
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeContactNumber(value) {
  return String(value || "").trim();
}

function extractLeadContact(payload, summary = summarizeLead(payload)) {
  const rawEmail =
    payload.email ||
    payload.contact?.email ||
    payload.acquisition?.email ||
    findSummaryValue(summary, ["Email", "E-mail", "Client email", "Buyer email", "Seller email"]);
  const rawMobile =
    payload.mobile ||
    payload.phone ||
    payload.whatsapp ||
    payload.contact?.mobile ||
    payload.contact?.phone ||
    payload.contact?.whatsapp ||
    payload.acquisition?.mobile ||
    payload.acquisition?.phone ||
    payload.acquisition?.whatsapp ||
    findSummaryValue(summary, ["Mobile", "Phone", "WhatsApp", "Contact number", "Cell"]);
  const email = normalizeEmail(rawEmail);
  const mobile = normalizeContactNumber(rawMobile);
  const preferred = String(payload.contactPreference || payload.contact?.preferred || payload.acquisition?.preferredContact || "").trim();
  return {
    email,
    mobile,
    whatsapp: mobile,
    preferred: preferred || (mobile ? "WhatsApp" : email ? "Email" : "To confirm"),
    hasEmail: Boolean(email),
    hasMobile: Boolean(mobile),
    bestContact: mobile || email || ""
  };
}

function textContainsAny(value, terms = []) {
  const text = String(value || "").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function hasMoneySignal(value) {
  return /(?:\br\s*)?\d[\d\s,.]*(?:m|mil|million|k|000)?\b/i.test(String(value || ""));
}

function scoreLeadQuality(payload, leadMeta = {}) {
  const answerSummary = summarizeLead(payload);
  const intent = payload.intent === "sell" ? "sell" : "buy";
  const acquisition = payload.acquisition && typeof payload.acquisition === "object" ? payload.acquisition : {};
  const contextText = [
    payload.label,
    payload.additionalInfo,
    acquisition.sourceLabel,
    acquisition.signal,
    acquisition.area,
    ...Object.values(answerSummary)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const clientName = findSummaryValue(answerSummary, ["Client name", "Name", "Buyer name", "Seller name"]);
  const area = findSummaryValue(answerSummary, ["Area", "Suburb", "Location"]) || acquisition.area || "";
  const source = findSummaryValue(answerSummary, ["Source"]) || acquisition.sourceLabel || acquisition.mode || "";
  const urgency = findSummaryValue(answerSummary, ["Urgency signal", "Timeline", "When", "Timeframe"]) || acquisition.signal || "";
  const propertyType = findSummaryValue(answerSummary, ["Property type", "Type", "Unit type"]);
  const budget = findSummaryValue(answerSummary, ["Budget", "Price", "Value", "Price range", "Listing price"]);
  const finance = findSummaryValue(answerSummary, ["Finance", "Bond", "Pre-approval", "Cash", "Deposit"]);
  const contactDetails = extractLeadContact(payload, answerSummary);
  const contact = contactDetails.bestContact || findSummaryValue(answerSummary, ["Email", "Mobile", "Phone", "WhatsApp", "Contact"]);
  const motivation = findSummaryValue(answerSummary, ["Reason", "Motivation", "Why", "Need"]);
  const nonNegotiables = findSummaryValue(answerSummary, ["Non-negotiables", "Requirements", "Must have", "Notes"]);

  const factors = [];
  const missingItems = [];
  let score = 0;

  const addFactor = (name, points, note) => {
    score += points;
    factors.push({ name, points, note });
  };
  const miss = (item) => missingItems.push(item);

  if (clientName) addFactor("Client identified", 8, clientName);
  else miss("Client name");

  if (area) addFactor("Area/suburb known", 14, area);
  else miss(intent === "sell" ? "Property suburb/address" : "Preferred suburb or area");

  if (textContainsAny(urgency || contextText, ["urgent", "asap", "today", "this week", "ready", "immediately", "hot"])) {
    addFactor("Urgency is clear", 18, urgency || "Urgency detected from lead context");
  } else if (urgency || textContainsAny(contextText, ["month", "soon", "viewing", "valuation", "offer"])) {
    addFactor("Timing has a signal", 10, urgency || "Some timing signal detected");
  } else {
    miss(intent === "sell" ? "Selling timeline" : "Buying timeline");
  }

  if (intent === "buy") {
    if (budget || hasMoneySignal(contextText)) addFactor("Budget signal", 16, budget || "Budget/price signal detected");
    else miss("Budget range");

    if (finance || textContainsAny(contextText, ["cash", "bond", "pre-approved", "preapproved", "deposit", "finance", "bank"])) {
      addFactor("Finance readiness", 18, finance || "Finance readiness signal detected");
    } else {
      miss("Finance readiness");
    }

    if (propertyType || textContainsAny(contextText, ["house", "apartment", "flat", "townhouse", "villa", "sectional"])) {
      addFactor("Property need is shaped", 10, propertyType || "Property type detected");
    } else {
      miss("Property type");
    }

    if (nonNegotiables || textContainsAny(contextText, ["bed", "bath", "garage", "school", "security", "pet"])) {
      addFactor("Buyer brief has preference detail", 8, nonNegotiables || "Preference signal detected");
    } else {
      miss("Non-negotiables");
    }
  } else {
    if (budget || hasMoneySignal(contextText)) addFactor("Price/value expectation", 16, budget || "Price/value signal detected");
    else miss("Expected price or valuation need");

    if (propertyType || textContainsAny(contextText, ["house", "apartment", "flat", "townhouse", "villa", "sectional"])) {
      addFactor("Property facts started", 12, propertyType || "Property type detected");
    } else {
      miss("Property type and basic facts");
    }

    if (motivation || textContainsAny(contextText, ["sell", "relocat", "downsize", "upgrade", "valuation", "mandate"])) {
      addFactor("Seller motivation/timing signal", 12, motivation || "Seller motivation detected");
    } else {
      miss("Reason for selling");
    }

    if (textContainsAny(contextText, ["photos", "address", "erf", "stand", "bed", "bath", "condition", "renovated"])) {
      addFactor("Property detail depth", 8, "Extra property detail detected");
    } else {
      miss("Bedrooms, bathrooms, condition and key features");
    }
  }

  if (source) {
    const sourcePoints = textContainsAny(source, ["referral", "whatsapp", "website", "property24", "private property"]) ? 8 : 5;
    addFactor("Source known", sourcePoints, source);
  } else {
    miss("Lead source");
  }

  if (contactDetails.hasMobile || textContainsAny(contextText, ["+27", "whatsapp", "call", "mobile", "phone"])) {
    addFactor("WhatsApp/mobile path exists", 6, contactDetails.mobile || "Mobile signal detected");
  } else if (contactDetails.hasEmail || textContainsAny(contextText, ["@"])) {
    addFactor("Email path exists", 3, contactDetails.email || "Email signal detected");
    miss("Mobile/WhatsApp number");
  } else {
    miss("Mobile/WhatsApp number");
  }

  if (contactDetails.hasEmail) {
    addFactor("Email available for formal updates", 3, contactDetails.email);
  }

  if (contact || textContainsAny(contextText, ["@", "+27", "whatsapp", "call"])) {
    addFactor("Contact path exists", 3, contact || "Contact signal detected");
  } else {
    miss("Contact detail");
  }

  if (score > 100) score = 100;
  const uniqueMissing = unique(missingItems).slice(0, 8);
  let band = "weak";
  if (score >= 80 && uniqueMissing.length <= 2) band = "hot";
  else if (score >= 62) band = "warm";
  else if (score >= 38) band = "nurture";

  const conciergeQuestions = uniqueMissing.slice(0, 5).map((item) => {
    if (item.toLowerCase().includes("finance")) return "Before I pass this to the agent, are you buying cash, pre-approved, or still arranging finance?";
    if (item.toLowerCase().includes("budget")) return "What price range should we keep the search or valuation discussion inside?";
    if (item.toLowerCase().includes("timeline")) return "When would you ideally like to move, sell, view, or make a decision?";
    if (item.toLowerCase().includes("source")) return "Where did this enquiry come from so we can track the source properly?";
    if (item.toLowerCase().includes("contact")) return "What is the best WhatsApp number or email for quick follow-up?";
    if (item.toLowerCase().includes("suburb") || item.toLowerCase().includes("address")) return "Which suburb or property address should the agent focus on?";
    return `Please confirm: ${item}.`;
  });

  const handoffReady = (band === "hot" || band === "warm") && uniqueMissing.length <= 3;
  const briefCard = {
    title: `${intent === "sell" ? "Seller" : "Buyer"} brief card`,
    leadId: leadMeta.id || null,
    clientName: clientName || "Client to confirm",
    intent,
    area: area || "Area to confirm",
    source: source || "Source to confirm",
    urgency: urgency || "Timeline to confirm",
    score,
    band,
    handoffStage: handoffReady ? "Ready for agent handoff" : "Concierge follow-up needed",
    headline: handoffReady
      ? "Concierge has enough context for a focused first agent conversation."
      : "Keep this with the concierge until the missing brief items are closed.",
    knownFacts: factors.map((factor) => `${factor.name}: ${factor.note}`).slice(0, 7),
    missingItems: uniqueMissing,
    conciergeQuestions,
    agentHandoffSummary:
      `${intent === "sell" ? "Seller" : "Buyer"} lead for ${clientName || "client"} in ${area || "area to confirm"}. ` +
      `Quality band: ${band}. ${handoffReady ? "Pass to agent with current brief." : "Concierge should complete missing items before handoff."}`,
    riskNotes: uniqueMissing.length
      ? [`Missing ${uniqueMissing.slice(0, 3).join(", ")} before the first agent call is fully clean.`]
      : ["No major brief gaps detected."]
  };

  return {
    score,
    band,
    handoffReady,
    factors,
    missingItems: uniqueMissing,
    conciergeQuestions,
    conciergeAction: handoffReady
      ? "Send the brief card to the assigned agent and keep concierge follow-up available."
      : `Ask ${Math.min(uniqueMissing.length, 5)} concierge follow-up question${uniqueMissing.length === 1 ? "" : "s"} before handoff.`,
    briefCard
  };
}

function createLeadRecord(payload) {
  const leadId = `AX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const leadQuality = scoreLeadQuality(payload, { id: leadId });
  const answerSummary = summarizeLead(payload);
  const contact = extractLeadContact(payload, answerSummary);
  const scoped = withScopeDefaults({
    id: leadId,
    caseId: leadId,
    caseName: String(payload.label || "").trim() || "Property enquiry",
    agencyId: payload.agencyId || payload.acquisition?.agencyId,
    branchId: payload.branchId || payload.acquisition?.branchId,
    provinceId: payload.provinceId || payload.acquisition?.provinceId || payload.acquisition?.province,
    agentId: payload.agentId || payload.acquisition?.agentId,
    assignedAgentId: payload.assignedAgentId || payload.agentId || payload.acquisition?.agentId
  });
  return {
    ...scoped,
    id: leadId,
    caseId: leadId,
    intent: payload.intent === "sell" ? "sell" : "buy",
    label: String(payload.label || "").trim() || "Property enquiry",
    createdAt: now,
    updatedAt: now,
    additionalInfo: String(payload.additionalInfo || "").trim(),
    answers: Array.isArray(payload.answers) ? payload.answers : [],
    answerSummary,
    contact,
    leadQuality,
    briefCard: leadQuality.briefCard,
    acquisition: payload.acquisition && typeof payload.acquisition === "object" ? payload.acquisition : {},
    status: "new"
  };
}

function buildPublicIntakeOutcome(lead) {
  const quality = lead.leadQuality || {};
  const briefCard = lead.briefCard || {};
  const contact = lead.contact || {};
  const clientName = briefCard.clientName || lead.answerSummary?.["Client name"] || "there";
  const area = briefCard.area || lead.acquisition?.area || lead.answerSummary?.Area || "your area";
  const isSeller = lead.intent === "sell";
  const hasWhatsapp = Boolean(contact.hasMobile || contact.mobile);
  const hasEmail = Boolean(contact.hasEmail || contact.email);
  const preferredRoute = hasWhatsapp ? "WhatsApp first" : hasEmail ? "Email follow-up" : "Direct follow-up";
  const followUpWindow = quality.handoffReady
    ? "A specialist can now step in with a cleaner brief. Target follow-up: within 3 working hours."
    : "The concierge will first close the missing brief items so the first specialist conversation starts properly.";

  return {
    title: isSeller ? `Seller brief received for ${clientName}.` : `Buyer brief received for ${clientName}.`,
    summary: quality.handoffReady
      ? `Axiom has enough context to move this ${isSeller ? "sale" : "search"} forward with a cleaner first handover.`
      : `Axiom has the request and may ask one or two quick follow-up questions before the handover is made.`,
    reference: lead.id,
    routeLabel: preferredRoute,
    followUpWindow,
    nextStep: quality.conciergeAction || "Concierge follow-up in progress.",
    band: quality.band || "unscored",
    score: quality.score || 0,
    handoffReady: Boolean(quality.handoffReady),
    clientName,
    area,
    intent: lead.intent,
    missingItems: Array.isArray(quality.missingItems) ? quality.missingItems.slice(0, 3) : [],
    knownFacts: Array.isArray(briefCard.knownFacts) ? briefCard.knownFacts.slice(0, 4) : [],
  };
}

function buildWhatsappClickLink(mobile, body) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`;
}

function normalizeWhatsappProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "managed-simulation";
  if (["meta", "meta-cloud", "cloud", "cloud-api", "whatsapp-cloud"].includes(normalized)) return "meta-cloud";
  if (["test", "preview", "manual", "simulation", "managed-simulation"].includes(normalized)) return "managed-simulation";
  return normalized;
}

function normalizeWhatsappRecipient(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
}

function getWhatsappRuntime() {
  const provider = normalizeWhatsappProvider(config.whatsappProvider || config.whatsappMode);
  const missing = [];

  if (provider === "meta-cloud") {
    if (!config.whatsappPhoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!config.whatsappAccessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  }

  const liveDeliveryConnected = provider === "meta-cloud" && missing.length === 0;
  const manualTestReady = !liveDeliveryConnected;

  return {
    mode: config.whatsappMode,
    provider,
    liveDeliveryConnected,
    realDeliveryConnected: liveDeliveryConnected,
    manualTestReady,
    missing,
    canGenerateClickLinks: true,
    fromNumber: config.whatsappFromNumber || null,
    status: liveDeliveryConnected
      ? "Real WhatsApp Cloud API delivery is connected."
      : provider === "meta-cloud"
        ? `Meta Cloud API is selected but still missing ${missing.join(", ")}.`
        : "Managed simulation is active. Messages are queued, stored, and available as WhatsApp click links for testing."
  };
}

function getOtpRuntime(whatsappRuntime = getWhatsappRuntime()) {
  const provider = String(config.otpProvider || "preview").trim().toLowerCase();
  const liveDeliveryConnected = provider === "whatsapp" && whatsappRuntime.liveDeliveryConnected;
  const previewEnabled = Boolean(config.otpPreviewEnabled);
  const missing =
    provider === "whatsapp" && !whatsappRuntime.liveDeliveryConnected
      ? whatsappRuntime.missing.length
        ? whatsappRuntime.missing
        : ["Set WHATSAPP_PROVIDER=meta-cloud for OTP delivery"]
      : [];

  return {
    provider,
    previewEnabled,
    liveDeliveryConnected,
    missing,
    status: liveDeliveryConnected
      ? "OTP can be delivered through WhatsApp."
      : previewEnabled
        ? "OTP preview is active for controlled testing."
        : "OTP delivery is not connected yet; access-key fallback remains available."
  };
}

function getEmailRuntime() {
  const provider = String(config.emailProvider || "none").trim().toLowerCase();
  return {
    provider,
    from: config.emailFrom || null,
    liveDeliveryConnected: false,
    status:
      provider === "none"
        ? "Email delivery is not connected yet."
        : "Email provider setting is present, but live email sending has not been wired into this build yet."
  };
}

function getOperationalReadiness(storageDiagnostics = null) {
  const whatsapp = getWhatsappRuntime();
  const otp = getOtpRuntime(whatsapp);
  const email = getEmailRuntime();
  const storageMode = storageDiagnostics?.mode || "unknown";
  const storageReady = Boolean(storageDiagnostics?.connected);
  const llm = getLlmStatus();

  return {
    generatedAt: new Date().toISOString(),
    publicIntake: {
      status: "ready",
      detail: "Buyer and seller intake can create leads, score them, build brief cards, and queue acknowledgements."
    },
    storage: {
      status: storageReady ? (storageMode === "postgres" ? "database_ready" : "file_storage_ready") : "check_required",
      mode: storageMode,
      detail: storageDiagnostics?.detail || "Storage diagnostics not loaded for this request."
    },
    whatsapp: {
      status: whatsapp.liveDeliveryConnected ? "live_delivery_connected" : "manual_test_ready",
      provider: whatsapp.provider,
      missing: whatsapp.missing,
      detail: whatsapp.status
    },
    otp: {
      status: otp.liveDeliveryConnected ? "live_delivery_connected" : otp.previewEnabled ? "preview_ready" : "fallback_only",
      provider: otp.provider,
      missing: otp.missing,
      detail: otp.status
    },
    email: {
      status: email.liveDeliveryConnected ? "live_delivery_connected" : "not_connected",
      provider: email.provider,
      detail: email.status
    },
    llm: {
      status: llm.ready ? "ready" : "needs_key_or_provider",
      provider: llm.provider,
      model: llm.model
    },
    nextProductionBlocks: [
      !whatsapp.liveDeliveryConnected && "Connect Meta WhatsApp Cloud API credentials for automatic WhatsApp delivery.",
      !otp.liveDeliveryConnected && "Decide whether OTP must be sent by WhatsApp before production sign-ons.",
      storageMode !== "postgres" && "Keep Postgres active on Render for durable multi-user operations.",
      !email.liveDeliveryConnected && "Add email delivery before formal PDF/report packs are emailed automatically."
    ].filter(Boolean)
  };
}

async function sendMetaWhatsappText(item) {
  const to = normalizeWhatsappRecipient(item.toContact || item.toNumber || "");
  if (!to) {
    return {
      ok: false,
      status: "send_failed",
      error: "No WhatsApp/mobile number is stored on this queue item."
    };
  }
  if (typeof fetch !== "function") {
    return {
      ok: false,
      status: "send_failed",
      error: "This Node runtime cannot make outbound fetch requests."
    };
  }

  const url = `${config.whatsappApiBaseUrl}/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: item.body
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: "send_failed",
      providerStatus: response.status,
      error: payload?.error?.message || `Meta WhatsApp API returned ${response.status}.`
    };
  }
  return {
    ok: true,
    status: "delivered",
    providerMessageId: payload?.messages?.[0]?.id || null,
    providerStatus: response.status
  };
}

async function deliverWhatsappQueueItem(item, runtime = getWhatsappRuntime()) {
  if (!runtime.liveDeliveryConnected) {
    const manualLink = buildWhatsappClickLink(item.toContact, item.body);
    return {
      ok: true,
      status: "manual_test_ready",
      deliveryMode: "manual_test",
      manualLink,
      note: runtime.status
    };
  }

  if (runtime.provider === "meta-cloud") {
    const result = await sendMetaWhatsappText(item);
    return {
      ...result,
      deliveryMode: "meta-cloud"
    };
  }

  return {
    ok: false,
    status: "send_failed",
    deliveryMode: runtime.provider,
    error: `Unsupported WhatsApp provider: ${runtime.provider}.`
  };
}

async function processWhatsappQueueItem(item, runtime = getWhatsappRuntime()) {
  const deliveredAt = nowIso();
  const result = await deliverWhatsappQueueItem(item, runtime);
  item.status = result.status;
  item.deliveryMode = result.deliveryMode;
  item.deliveryNote = result.note || result.error || "";
  item.manualLink = result.manualLink || item.manualLink || "";
  item.providerStatus = result.providerStatus || null;
  item.providerMessageId = result.providerMessageId || null;
  item.processedAt = deliveredAt;
  if (result.status === "delivered") {
    item.deliveredAt = deliveredAt;
  }

  const thread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: result.status === "delivered" ? "outbound" : "system",
    author: item.ownerName || "Axiom",
    body:
      result.status === "manual_test_ready"
        ? `${item.category} is ready for manual WhatsApp testing.${result.manualLink ? ` Link: ${result.manualLink}` : " Add a mobile number before sending."}`
        : result.status === "delivered"
          ? item.body
          : `${item.category} could not be sent: ${result.error || "delivery failed"}`,
    at: deliveredAt,
    status: result.status,
    deliveryMode: result.deliveryMode
  });

  return {
    id: item.id,
    caseId: item.caseId,
    toName: item.toName,
    status: item.status,
    deliveryMode: item.deliveryMode,
    manualLink: item.manualLink || "",
    error: result.error || ""
  };
}

function authPayloadForRole(role, sessionOrIdentity = {}) {
  const normalizedRole = normalizeRole(typeof role === "object" ? role.role : role);
  const profile = getRoleProfile(normalizedRole);
  const identity = normalizeSessionIdentity(normalizedRole, sessionOrIdentity, sessionOrIdentity?.contact);
  return {
    authenticated: true,
    role: normalizedRole,
    roleLabel: profile.label,
    allowedViews: profile.allowedViews,
    workspaceTabs: profile.workspaceTabs,
    permissions: profile.permissions,
    permissionLabels: getPermissionLabels(profile.permissions),
    accessNote: profile.accessNote,
    identity: {
      userId: identity.userId,
      name: identity.name,
      contact: identity.contact,
      agencyId: identity.agencyId,
      branchId: identity.branchId,
      provinceId: identity.provinceId
    },
    scope: identity.scope
  };
}

async function createAuthenticatedSession(response, role, authEvent, authDetails = {}) {
  const normalizedRole = normalizeRole(role);
  const identity = normalizeSessionIdentity(normalizedRole, authDetails.identity || {}, authDetails.contact);
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000).toISOString();

  state.sessions = state.sessions.filter((session) => {
    return !(session.role === normalizedRole && session.userId === identity.userId);
  });
  state.sessions.push({
    id: randomBytes(8).toString("hex"),
    role: normalizedRole,
    userId: identity.userId,
    name: identity.name,
    contact: identity.contact,
    agencyId: identity.agencyId,
    branchId: identity.branchId,
    provinceId: identity.provinceId,
    scope: identity.scope,
    tokenHash: hashSecret(token),
    createdAt: new Date().toISOString(),
    expiresAt
  });
  audit(authEvent, { role: normalizedRole, userId: identity.userId, agencyId: identity.agencyId, branchId: identity.branchId, provinceId: identity.provinceId, ...authDetails });
  await persistState();

  sendJson(
    response,
    200,
    {
      ok: true,
      expiresAt,
      ...authPayloadForRole(normalizedRole, identity)
    },
    {
      "Set-Cookie": buildCookie(missionControlCookie, token, {
        maxAge: config.sessionHours * 60 * 60,
        secure: config.cookieSecure
      })
    }
  );
}

async function handleLogin(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact || getRoleSigninContact(role));
  const identity = findIdentityForSignin(role, contact);
  const submittedKey = String(body.key || "").trim();
  const expectedKey = getRoleKey(role);

  if (!identity) {
    audit("mission-control-login-failed", { role, contact, reason: "identity-missing" });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} route.`
    });
    return;
  }

  if (!submittedKey || !expectedKey || !safeAccessKeyEquals(submittedKey, expectedKey)) {
    audit("mission-control-login-failed", { role });
    sendJson(response, 401, {
      ok: false,
      error:
        role === "agent"
          ? "Agent workspace fallback key not recognised on this build."
          : role === "office_admin"
            ? "Office admin fallback key not recognised on this build."
            : "Principal fallback key not recognised on this build."
    });
    return;
  }

  await createAuthenticatedSession(response, role, "mission-control-login", { method: "legacy-key", contact, identity });
}

async function handleRequestOtp(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact);
  const identity = findIdentityForSignin(role, contact);

  if (!contact) {
    sendJson(response, 400, { ok: false, error: "Enter the mobile number or email linked to this role." });
    return;
  }

  if (!identity) {
    audit("mission-control-otp-request-failed", { role, contact });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} sign-in route on this build.`
    });
    return;
  }

  const code = createOtpCode();
  const expiresAt = new Date(Date.now() + config.otpMinutes * 60 * 1000).toISOString();
  const challengeId = randomBytes(8).toString("hex");

  pruneExpiredOtpChallenges();
  state.otpChallenges = state.otpChallenges.filter((challenge) => {
    return !(challenge.role === role && challenge.contact === contact);
  });
  state.otpChallenges.push({
    id: challengeId,
    role,
    contact,
    userId: identity.userId,
    codeHash: hashSecret(code),
    createdAt: new Date().toISOString(),
    expiresAt
  });
  audit("mission-control-otp-requested", { role, contact });
  await persistState();

  sendJson(response, 200, {
    ok: true,
    challengeId,
    role,
    contact,
    expiresAt,
    deliveryTarget: contact,
    otpLength: 6,
    devCodePreview: config.otpPreviewEnabled ? code : undefined,
    message:
      config.otpPreviewEnabled
        ? "A one-time code has been generated for this test build."
        : "A one-time code has been generated. Use the configured access key fallback until an OTP sender is connected."
  });
}

async function handleVerifyOtp(request, response) {
  const body = await readBody(request);
  const role = normalizeRole(body.role);
  const contact = normalizeSigninContact(body.contact);
  const code = String(body.code || "").trim();
  const identity = findIdentityForSignin(role, contact);

  pruneExpiredOtpChallenges();

  if (!contact || !code) {
    sendJson(response, 400, { ok: false, error: "Enter both the contact detail and the one-time code." });
    return;
  }

  if (!identity) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "identity-missing" });
    sendJson(response, 401, {
      ok: false,
      error: `That contact detail is not linked to the ${getRoleProfile(role).label.toLowerCase()} route.`
    });
    return;
  }

  const expectedKey = getRoleKey(role);
  if (expectedKey && safeAccessKeyEquals(code, expectedKey)) {
    state.otpChallenges = state.otpChallenges.filter((entry) => !(entry.role === role && entry.contact === contact));
    await createAuthenticatedSession(response, role, "mission-control-login", {
      method: "access-key-fallback",
      contact,
      identity
    });
    return;
  }

  const challenge = state.otpChallenges.find((entry) => entry.role === role && entry.contact === contact && entry.userId === identity.userId);
  if (!challenge) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "challenge-missing" });
    sendJson(response, 401, { ok: false, error: "That sign-in code has expired or was not requested yet." });
    return;
  }

  if (!safeEquals(challenge.codeHash, hashSecret(code))) {
    audit("mission-control-otp-verify-failed", { role, contact, reason: "code-mismatch" });
    sendJson(response, 401, { ok: false, error: "That one-time code is not correct." });
    return;
  }

  state.otpChallenges = state.otpChallenges.filter((entry) => entry.id !== challenge.id);
  await createAuthenticatedSession(response, role, "mission-control-login", {
    method: "otp",
    contact,
    identity
  });
}

function handleSession(request, response) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendJson(response, 200, { ok: true, authenticated: false });
    return;
  }
  sendJson(response, 200, {
    ok: true,
    expiresAt: session.expiresAt,
    ...authPayloadForRole(session.role, session)
  });
}

async function handleLogout(request, response) {
  const session = getSessionFromRequest(request);
  if (session) {
    state.sessions = state.sessions.filter((item) => item.id !== session.id);
    audit("mission-control-logout", { role: session.role });
    await persistState();
  }
  sendJson(
    response,
    200,
    { ok: true },
    { "Set-Cookie": buildCookie(missionControlCookie, "", { maxAge: 0, secure: config.cookieSecure }) }
  );
}

function requireSession(request, response, roles = Object.keys(accessProfiles)) {
  const session = getSessionFromRequest(request);
  if (!session) {
    sendJson(response, 401, { ok: false, error: "Mission Control sign-in required" });
    return null;
  }

  const normalizedRoles = roles.map(normalizeRole);
  if (!normalizedRoles.includes(session.role)) {
    sendJson(response, 403, { ok: false, error: "You do not have permission for this action." });
    return null;
  }
  return session;
}

function requirePermission(request, response, permissions, roles) {
  const session = requireSession(request, response, roles);
  if (!session) return null;

  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  if (!hasAnyPermission(session.role, requiredPermissions)) {
    sendJson(response, 403, { ok: false, error: "You do not have permission for this action." });
    return null;
  }

  return session;
}

function getOperationsState() {
  state.operations = normalizeOperationsShape(state.operations);
  return state.operations;
}

function getRequestOrigin(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").trim();
  const proto = forwardedProto || "http";
  const host = String(request.headers.host || `${config.host}:${config.port}`).trim();
  return `${proto}://${host}`;
}

function findTeamMemberByName(name) {
  const operations = getOperationsState();
  return operations.teamMembers.find((member) => member.name === name) || null;
}

function ensureThread(caseId, caseName, participants = []) {
  const operations = getOperationsState();
  let thread = operations.whatsapp.threads.find((entry) => entry.caseId === caseId);
  if (!thread) {
    thread = {
      id: `thread-${caseId}`,
      caseId,
      caseName,
      participants,
      lastAt: nowIso(),
      unreadCount: 0,
      messages: []
    };
    operations.whatsapp.threads.unshift(thread);
  }
  return thread;
}

function addThreadMessage(thread, message) {
  thread.messages.push(message);
  thread.lastAt = message.at;
  if (message.direction === "inbound") {
    thread.unreadCount += 1;
  }
}

function queueWhatsappMessage(payload) {
  const operations = getOperationsState();
  const createdAt = nowIso();
  const item = {
    id: createOpsId("msg"),
    caseId: payload.caseId || "general",
    caseName: payload.caseName || "Office update",
    threadId: payload.threadId || `thread-${payload.caseId || "general"}`,
    category: payload.category || "general",
    toName: payload.toName || "Unknown",
    toRole: payload.toRole || "contact",
    toContact: payload.toContact || payload.toNumber || "",
    ownerName: payload.ownerName || "Axiom",
    body: String(payload.body || "").trim(),
    status: payload.approvalRequired ? "awaiting_approval" : "queued",
    deliveryMode: "pending",
    createdAt,
    scheduledFor: payload.scheduledFor || createdAt,
    approvalRequired: Boolean(payload.approvalRequired),
    agencyId: payload.agencyId,
    branchId: payload.branchId,
    provinceId: payload.provinceId,
    agentId: payload.agentId,
    assignedAgentId: payload.assignedAgentId || payload.agentId
  };
  operations.whatsapp.queue.unshift(item);
  audit("whatsapp-queued", {
    caseName: item.caseName,
    toName: item.toName,
    category: item.category
  });
  return item;
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || "unassigned";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildScopedRollups(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleServicePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleLeads = filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);

  return {
    agencies: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "agencyId"),
    branches: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "branchId"),
    provinces: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "provinceId"),
    agents: countBy([...visibleTasks, ...visibleCommission, ...visibleDealRooms, ...visibleServicePulse, ...visibleLeads], "agentId"),
    totals: {
      leads: visibleLeads.length,
      tasks: visibleTasks.length,
      protectedDeals: visibleCommission.length,
      dealRooms: visibleDealRooms.length,
      servicePulse: visibleServicePulse.length
    }
  };
}

function normalizeLeadSource(lead = {}) {
  const sourceText = [
    lead.acquisition?.sourceLabel,
    lead.acquisition?.mode,
    lead.answerSummary?.Source,
    lead.source,
    lead.additionalInfo
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("google") || sourceText.includes("gclid") || sourceText.includes("paid")) return "google_ads";
  if (sourceText.includes("whatsapp")) return "whatsapp";
  if (sourceText.includes("property24") || sourceText.includes("private property") || sourceText.includes("portal")) return "portal";
  if (sourceText.includes("referral") || sourceText.includes("referred")) return "referral";
  if (sourceText.includes("csv") || sourceText.includes("list")) return "lead_list";
  if (sourceText.includes("email") || sourceText.includes("forward")) return "forwarded_email";
  if (sourceText.includes("agent") || sourceText.includes("import")) return "agent_import";
  if (sourceText.includes("website") || sourceText.includes("form")) return "website";
  return "other";
}

function sourceLabelForKey(sourceKey) {
  return {
    google_ads: "Google Ads",
    whatsapp: "WhatsApp",
    portal: "Property portal",
    referral: "Referral",
    lead_list: "Lead list",
    forwarded_email: "Forwarded email",
    agent_import: "Agent import",
    website: "Website",
    other: "Other"
  }[sourceKey] || sourceKey;
}

function buildSourceToSaleTracker(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const stages = ["registered", "qualified", "viewing", "offer", "sale", "commissionProtected"];

  const leadRows = visibleLeads.map((lead) => {
    const sourceKey = normalizeLeadSource(lead);
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const relatedCommission = visibleCommission.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const relatedDealRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const relatedThreads = visibleThreads.filter((thread) => thread.caseId === lead.caseId || thread.caseId === lead.id || thread.caseName === lead.label);
    const score = Number(lead.leadQuality?.score || 0);
    const qualified = Boolean(lead.leadQuality?.handoffReady || score >= 62 || relatedTasks.some((task) => /qualif|brief|assign/i.test(task.title || task.category || "")));
    const viewing = relatedTasks.some((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source}`)) ||
      relatedThreads.some((thread) => /viewing/i.test(JSON.stringify(thread.messages || [])));
    const offer = relatedCommission.some((item) => /offer/i.test(`${item.milestone} ${item.referralStatus} ${item.paymentStatus}`));
    const sale = relatedCommission.some((item) => /sale|sold|registered|paid|transfer/i.test(`${item.milestone} ${item.referralStatus} ${item.paymentStatus}`));
    const commissionProtected = relatedCommission.length > 0 || relatedTasks.some((task) => /commission|protect/i.test(`${task.title} ${task.category}`));

    return {
      leadId: lead.id,
      caseId: lead.caseId,
      label: lead.label,
      intent: lead.intent,
      sourceKey,
      sourceLabel: sourceLabelForKey(sourceKey),
      score,
      band: lead.leadQuality?.band || "unscored",
      stages: {
        registered: true,
        qualified,
        viewing,
        offer,
        sale,
        commissionProtected
      },
      nextAction: lead.leadQuality?.conciergeAction || "Concierge to confirm missing brief items.",
      handoffReady: Boolean(lead.leadQuality?.handoffReady),
      missingItems: lead.leadQuality?.missingItems || []
    };
  }).map((row) => {
    const currentStage = stages.reduce((latest, stage) => (row.stages[stage] ? stage : latest), "registered");
    return { ...row, currentStage };
  });

  const bySource = {};
  for (const row of leadRows) {
    bySource[row.sourceKey] ||= {
      sourceKey: row.sourceKey,
      sourceLabel: row.sourceLabel,
      leads: 0,
      registered: 0,
      qualified: 0,
      viewing: 0,
      offer: 0,
      sale: 0,
      commissionProtected: 0,
      totalScore: 0,
      avgScore: 0
    };
    const bucket = bySource[row.sourceKey];
    bucket.leads += 1;
    bucket.totalScore += row.score;
    for (const stage of stages) {
      if (row.stages[stage]) bucket[stage] += 1;
    }
    bucket.avgScore = Math.round(bucket.totalScore / bucket.leads);
  }

  return {
    stages,
    rows: leadRows,
    bySource: Object.values(bySource).map(({ totalScore, ...bucket }) => bucket),
    summary: {
      totalLeads: leadRows.length,
      qualified: leadRows.filter((row) => row.stages.qualified).length,
      viewing: leadRows.filter((row) => row.stages.viewing).length,
      offer: leadRows.filter((row) => row.stages.offer).length,
      sale: leadRows.filter((row) => row.stages.sale).length,
      commissionProtected: leadRows.filter((row) => row.stages.commissionProtected).length
    }
  };
}

function buildSellerDemandSnapshots(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const sellerLeads = visibleLeads.filter((lead) => lead.intent === "sell");
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const visibleFeedback = visible.feedbackLog || filterVisible(operations.whatsapp.feedbackLog, sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);

  return sellerLeads.map((lead) => {
    const area = lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm";
    const contextText = [
      lead.additionalInfo,
      lead.acquisition?.signal,
      lead.acquisition?.sourceLabel,
      JSON.stringify(lead.answerSummary || {})
    ].join(" ").toLowerCase();
    const relatedThreads = visibleThreads.filter((thread) => thread.caseId === lead.caseId || thread.caseId === lead.id || thread.caseName === lead.label);
    const relatedFeedback = visibleFeedback.filter((item) => {
      return item.caseId === lead.caseId || item.caseId === lead.id || String(item.property || "").toLowerCase().includes(area.toLowerCase());
    });
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const relatedRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const enquiryCount = Math.max(1, relatedThreads.length + relatedTasks.filter((task) => /lead|enquir|buyer|view/i.test(`${task.title} ${task.category}`)).length);
    const viewingCount = relatedTasks.filter((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source}`)).length;
    const feedbackNotes = relatedFeedback.map((item) => item.note || item.state).filter(Boolean);
    const buyerType = textContainsAny(contextText, ["cash"]) ? "Cash buyer interest" :
      textContainsAny(contextText, ["bond", "finance", "pre-approved", "preapproved"]) ? "Bond buyer interest" :
        textContainsAny(contextText, ["investor"]) ? "Investor interest" : "Buyer type still being qualified";
    const priceSensitivity = textContainsAny(contextText, ["price", "expensive", "sensitive", "offer", "negotiate", "below"]) ?
      "Price sensitivity detected" :
      lead.leadQuality?.missingItems?.some((item) => /price|value|valuation/i.test(item)) ? "Price expectation still needs confirmation" : "No strong price objection logged yet";
    const suburbDemand = enquiryCount >= 3 || textContainsAny(contextText, ["urgent", "hot", "demand", "ready"]) ?
      `${area} demand looks active from current enquiry signals.` :
      `${area} demand is still being built from early signals.`;
    const recommendedNextMove = lead.leadQuality?.handoffReady
      ? "Send the seller a concise demand update and move the agent into the next live conversation."
      : "Let the concierge close the missing seller brief items before sending a confident seller update.";
    const sellerName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "there";
    const sellerMessageDraft =
      `Hi ${sellerName}. A quick, careful update from Axiom: we are still shaping the demand picture for ${area}. ` +
      `Current signal: ${buyerType.toLowerCase()}; ${priceSensitivity.toLowerCase()}. ` +
      `${feedbackNotes.length ? `The latest feedback note is: ${feedbackNotes[0]}. ` : "No viewing feedback has been captured yet. "}` +
      `The sensible next move is: ${recommendedNextMove} We will keep this measured and agent-reviewed before anything formal is sent.`;

    return {
      leadId: lead.id,
      caseId: lead.caseId,
      sellerName: lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "Seller to confirm",
      property: lead.label,
      area,
      enquiryCount,
      buyerType,
      suburbDemand,
      viewingFeedback: feedbackNotes.length ? feedbackNotes.slice(0, 3) : ["No viewing feedback captured yet."],
      viewingCount,
      priceSensitivity,
      recommendedNextMove,
      confidence: lead.leadQuality?.band === "hot" || lead.leadQuality?.band === "warm" ? "Medium" : "Low until concierge fills the missing brief items",
      sourceToSaleStage: "registered",
      dealRoomVisible: relatedRooms.length > 0,
      sellerMessageDraft,
      learningSignals: {
        leadScore: lead.leadQuality?.score || 0,
        leadBand: lead.leadQuality?.band || "unscored",
        buyerType,
        priceSensitivity,
        missingItems: lead.leadQuality?.missingItems || [],
        sourceKey: normalizeLeadSource(lead),
        sourceLabel: sourceLabelForKey(normalizeLeadSource(lead))
      },
      communicationStorage: {
        storedWithCase: true,
        threadCategory: "seller-demand-snapshot",
        approvalRequired: true,
        copiedToAgent: true
      }
    };
  });
}

function quarterKey(value = nowIso()) {
  const date = new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return `${safeDate.getFullYear()}-Q${Math.floor(safeDate.getMonth() / 3) + 1}`;
}

function normalizeServicePulseScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function normalizeServicePulseRole(value) {
  const role = normalizeRole(value);
  return role === "seller" ? "seller" : "buyer";
}

function normalizeServicePulseTouchpoint(value) {
  const key = slugify(value || "");
  if (key.includes("view")) return "post_viewing";
  if (key.includes("seller") || key.includes("weekly") || key.includes("friday")) return "weekly_seller_update";
  if (key.includes("deal") || key.includes("room") || key.includes("progress")) return "deal_room_checkin";
  if (key.includes("close") || key.includes("register") || key.includes("transfer")) return "closing_registration";
  if (key.includes("first") || key.includes("contact")) return "first_contact";
  return "service_checkin";
}

function servicePulseTouchpointLabel(touchpoint) {
  return {
    first_contact: "First contact",
    post_viewing: "Post-viewing check-in",
    weekly_seller_update: "Weekly seller update",
    deal_room_checkin: "Deal Room check-in",
    closing_registration: "Closing / registration",
    service_checkin: "Service check-in"
  }[touchpoint] || "Service check-in";
}

function servicePulseSentiment(score) {
  if (score >= 9) return "delighted";
  if (score >= 7) return "positive";
  if (score >= 5) return "neutral";
  return "recovery";
}

function normalizeServicePulseTags(tags) {
  return unique(ensureArray(tags))
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function findAgentForPulse(payload = {}, room = {}) {
  const operations = getOperationsState();
  const agentId = String(payload.agentId || room.agentId || room.assignedAgentId || "").trim();
  const agentName = String(payload.agentName || room.agentName || "").trim().toLowerCase();
  const scopedRoom = withScopeDefaults(room || {});
  return (
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.id === agentId) ||
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.name.toLowerCase() === agentName) ||
    operations.teamMembers.find((member) => normalizeRole(member.role) === "agent" && member.id === scopedRoom.agentId) ||
    null
  );
}

function createServicePulseRecord(payload = {}, room = {}) {
  const createdAt = nowIso();
  const score = normalizeServicePulseScore(payload.score);
  const touchpoint = normalizeServicePulseTouchpoint(payload.touchpoint || payload.triggerPoint);
  const agent = findAgentForPulse(payload, room);
  const scopedRoom = withScopeDefaults(room || {});
  const caseName = String(payload.caseName || room.caseName || "Client matter").trim();
  const base = withScopeDefaults({
    caseId: String(payload.caseId || room.caseId || scopedRoom.caseId || slugify(caseName) || createOpsId("case")).trim(),
    caseName,
    agentId: agent?.id || String(payload.agentId || scopedRoom.agentId || "").trim(),
    assignedAgentId: agent?.id || String(payload.agentId || scopedRoom.assignedAgentId || "").trim(),
    agencyId: agent?.agencyId || payload.agencyId || scopedRoom.agencyId,
    branchId: agent?.branchId || payload.branchId || scopedRoom.branchId,
    provinceId: agent?.provinceId || payload.provinceId || scopedRoom.provinceId
  });

  return {
    id: createOpsId("pulse"),
    ...base,
    caseName,
    roomId: String(payload.roomId || room.roomId || "").trim().toUpperCase(),
    agentName: agent?.name || String(payload.agentName || "Assigned agent").trim(),
    respondentRole: normalizeServicePulseRole(payload.respondentRole || payload.role),
    respondentName: String(payload.respondentName || payload.clientName || room.clientName || "Client").trim(),
    touchpoint,
    touchpointLabel: servicePulseTouchpointLabel(touchpoint),
    score,
    sentiment: servicePulseSentiment(score),
    tags: normalizeServicePulseTags(payload.tags),
    comment: String(payload.comment || payload.note || "").trim(),
    source: String(payload.source || "deal_room").trim(),
    usedForMatching: payload.usedForMatching !== false,
    visibility: "internal_scorecard",
    quarter: quarterKey(createdAt),
    learningSignals: {
      triggerPoint: touchpoint,
      recoveryNeeded: score <= 6,
      matchingWeight: score * 10,
      source: String(payload.source || "deal_room").trim()
    },
    createdAt,
    updatedAt: createdAt
  };
}

function storeServicePulseCommunication(record) {
  const operations = getOperationsState();
  const thread = ensureThread(record.caseId, record.caseName, [record.respondentName, record.agentName, "Axiom"]);
  const tagText = record.tags.length ? ` Tags: ${record.tags.join(", ")}.` : "";
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "inbound",
    author: record.respondentName,
    category: "client-service-pulse",
    body: `Service Pulse captured: ${record.score}/10 after ${record.touchpointLabel}. ${record.comment || "No written comment supplied."}${tagText}`,
    at: record.createdAt,
    status: "stored"
  });

  operations.whatsapp.feedbackLog.unshift(
    withScopeDefaults({
      id: createOpsId("feedback"),
      caseId: record.caseId,
      caseName: record.caseName,
      property: record.caseName,
      buyer: record.respondentRole === "buyer" ? record.respondentName : "Buyer not involved",
      seller: record.respondentRole === "seller" ? record.respondentName : "Seller not involved",
      agent: record.agentName,
      agentId: record.agentId,
      state: `${record.score}/10 ${record.sentiment}`,
      source: `Service Pulse - ${record.touchpointLabel}`,
      note: record.comment || `Client gave ${record.score}/10 after ${record.touchpointLabel}.`,
      copiedToAgent: true,
      optional: true,
      category: "client-service-pulse",
      at: formatOpsTimestamp(record.createdAt),
      timeMs: Date.parse(record.createdAt),
      agencyId: record.agencyId,
      branchId: record.branchId,
      provinceId: record.provinceId
    })
  );
}

function averageScore(records) {
  if (!records.length) return 0;
  return Math.round((records.reduce((total, record) => total + Number(record.score || 0), 0) / records.length) * 10) / 10;
}

function topTags(records) {
  const counts = {};
  for (const record of records) {
    for (const tag of record.tags || []) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

function groupServicePulse(records, key) {
  const groups = {};
  for (const record of records) {
    const groupKey = record[key] || "unassigned";
    groups[groupKey] ||= [];
    groups[groupKey].push(record);
  }
  return Object.entries(groups).map(([id, items]) => ({
    id,
    count: items.length,
    avgScore: averageScore(items),
    promoters: items.filter((item) => item.score >= 9).length,
    needsRecovery: items.filter((item) => item.score <= 6).length,
    topTags: topTags(items),
    latestAt: items.map((item) => item.createdAt).sort().at(-1)
  }));
}

function buildServicePulseRollups(sessionOrRole, visible = {}) {
  const operations = getOperationsState();
  const servicePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const currentQuarter = quarterKey();
  const currentQuarterPulse = servicePulse.filter((record) => record.quarter === currentQuarter);
  const byAgent = groupServicePulse(servicePulse, "agentId").map((group) => {
    const agent = operations.teamMembers.find((member) => member.id === group.id);
    return {
      ...group,
      agentName: agent?.name || servicePulse.find((record) => record.agentId === group.id)?.agentName || "Assigned agent"
    };
  });
  const prizeCandidates = groupServicePulse(currentQuarterPulse, "agentId")
    .map((group) => {
      const agent = operations.teamMembers.find((member) => member.id === group.id);
      return {
        ...group,
        agentName: agent?.name || currentQuarterPulse.find((record) => record.agentId === group.id)?.agentName || "Assigned agent",
        prizeScore: Math.round(group.avgScore * 10 + Math.min(group.count, 10) * 2 - group.needsRecovery * 5)
      };
    })
    .sort((left, right) => right.prizeScore - left.prizeScore || right.avgScore - left.avgScore)
    .slice(0, 5)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    summary: {
      total: servicePulse.length,
      avgScore: averageScore(servicePulse),
      promoters: servicePulse.filter((record) => record.score >= 9).length,
      needsRecovery: servicePulse.filter((record) => record.score <= 6).length,
      currentQuarter,
      currentQuarterCount: currentQuarterPulse.length
    },
    byAgent: byAgent.sort((left, right) => right.avgScore - left.avgScore || right.count - left.count),
    byBranch: groupServicePulse(servicePulse, "branchId"),
    byProvince: groupServicePulse(servicePulse, "provinceId"),
    triggerPoints: groupServicePulse(servicePulse, "touchpoint"),
    recoveryQueue: servicePulse
      .filter((record) => record.score <= 6)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 10),
    quarterlyPrizeCandidates: prizeCandidates
  };
}

function buildAgentMatchingSignals(sessionOrRole, visible = {}, servicePulseRollups = null) {
  const operations = getOperationsState();
  const rollups = servicePulseRollups || buildServicePulseRollups(sessionOrRole, visible);
  const visibleAgents = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);

  const agents = visibleAgents.map((agent) => {
    const pulse = rollups.byAgent.find((item) => item.id === agent.id);
    const agentLeads = visibleLeads.filter((lead) => lead.agentId === agent.id || lead.assignedAgentId === agent.id);
    const scored = agentLeads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
    const avgLeadScore = scored.length ? Math.round(scored.reduce((total, lead) => total + Number(lead.leadQuality.score || 0), 0) / scored.length) : 65;
    const pulseComponent = pulse ? pulse.avgScore * 10 : 72;
    const loadComponent = Math.max(45, 100 - agentLeads.length * 8);
    const matchScore = Math.round(pulseComponent * 0.55 + avgLeadScore * 0.25 + loadComponent * 0.2);
    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      matchScore,
      serviceAvg: pulse?.avgScore || 0,
      serviceCount: pulse?.count || 0,
      needsRecovery: pulse?.needsRecovery || 0,
      activeLeadLoad: agentLeads.length,
      bestFor: pulse?.topTags?.length ? pulse.topTags : ["Needs more service data"],
      guidance: pulse
        ? "Use service pulse history with lead fit, area, load and response pattern before assigning."
        : "Do not over-rank yet. Capture more buyer/seller service pulses first."
    };
  });

  return {
    agents: agents.sort((left, right) => right.matchScore - left.matchScore),
    matchingInputs: ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
    internalOnly: true
  };
}

function buildLeadWhatsappDraft(lead, context = {}) {
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "there";
  const agentName = context.ownerName || "the agent";
  const missingItems = context.missingItems || [];
  if (missingItems.length) {
    return `Hi ${clientName}. I am tightening the brief before ${agentName} follows up properly. Please confirm ${missingItems.slice(0, 2).join(" and ")} when you have a moment.`;
  }
  if (!context.commissionProtected) {
    return `Hi ${agentName}. This lead is ready to move, but please accept the 25% successful-sale-only referral terms before active handover.`;
  }
  if (context.dealRoomNeeded) {
    return `Hi ${clientName}. I can prepare one clean progress view for this matter so updates, next steps and outstanding items sit in one place.`;
  }
  if (context.serviceRecoveryNeeded) {
    return `Hi ${clientName}. I want to make sure the next step is clear and that you feel properly looked after. What would help most right now?`;
  }
  return `Hi ${clientName}. Quick update from Axiom: the brief is clear, the next action is ${context.nextBestAction || "being handled"}, and we will keep the process moving.`;
}

function buildClientIntakeAcknowledgement(lead) {
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "there";
  const area = lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "your area";
  const isSeller = lead.intent === "sell";
  const route = isSeller ? "seller brief" : "buyer brief";
  const nextStep = isSeller
    ? "Axiom will tighten anything missing and route this to the right property specialist. Target follow-up is within 3 working hours."
    : "Axiom will tighten anything missing and route this to the right buying specialist. Target follow-up is within 3 working hours.";
  return `Hi ${clientName}. Thanks, your ${route} for ${area} has been received by Axiom. Reference ${lead.id}. ${nextStep}`;
}

function priorityWeight(priority) {
  return { critical: 4, high: 3, medium: 2, normal: 1, low: 0 }[priority] || 0;
}

function buildLeadActionCentre(sessionOrRole, visible = {}, sourceToSale = null) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visiblePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleTeam = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const tracker = sourceToSale || buildSourceToSaleTracker(sessionOrRole, visible);

  const leadRows = visibleLeads.map((lead) => {
    const relatedTasks = visibleTasks.filter((task) => task.caseId === lead.caseId || task.caseId === lead.id || task.caseName === lead.label);
    const commissionItems = visibleCommission.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const dealRooms = visibleDealRooms.filter((room) => room.caseId === lead.caseId || room.caseId === lead.id || room.caseName === lead.label);
    const pulseItems = visiblePulse.filter((item) => item.caseId === lead.caseId || item.caseId === lead.id || item.caseName === lead.label);
    const ownerId = lead.agentId || lead.assignedAgentId || relatedTasks[0]?.ownerId || relatedTasks[0]?.agentId;
    const owner = visibleTeam.find((member) => member.id === ownerId || member.agentId === ownerId) || {};
    const quality = lead.leadQuality || {};
    const missingItems = quality.missingItems || [];
    const score = Number(quality.score || 0);
    const commissionProtected = commissionItems.length > 0;
    const dealRoomNeeded = Boolean(quality.handoffReady && !dealRooms.length);
    const serviceRecoveryNeeded = pulseItems.some((item) => Number(item.score || 0) <= 6);
    const sourceRow = tracker.rows?.find((row) => row.leadId === lead.id);
    const actionReason = missingItems.length
      ? "Brief incomplete"
      : !commissionProtected
        ? "Commission protection missing"
        : dealRoomNeeded
          ? "Deal Room not shared"
          : serviceRecoveryNeeded
            ? "Service recovery needed"
            : "Ready for next follow-up";
    const nextBestAction = missingItems.length
      ? quality.conciergeAction || "Concierge to close missing brief items."
      : !commissionProtected
        ? "Get referral terms accepted and protect commission before active handover."
        : dealRoomNeeded
          ? "Generate a client Deal Room link so progress is visible from day one."
          : serviceRecoveryNeeded
            ? "Concierge to recover gently and log the outcome."
            : quality.handoffReady
              ? "Agent to make the next call and record the outcome."
              : "Keep qualifying before handoff.";
    const priority = serviceRecoveryNeeded || (!commissionProtected && score >= 65)
      ? "critical"
      : score >= 75 || missingItems.length >= 3
        ? "high"
        : score >= 50 || dealRoomNeeded
          ? "medium"
          : "normal";
    const mustAct = missingItems.length
      ? "concierge"
      : !commissionProtected || dealRoomNeeded
        ? "agent"
        : serviceRecoveryNeeded
          ? "concierge"
          : "agent";

    return {
      id: `lead-action-${lead.id}`,
      leadId: lead.id,
      caseId: lead.caseId || lead.id,
      caseName: lead.label,
      leadLabel: lead.label,
      clientName: lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label,
      intent: lead.intent,
      area: lead.briefCard?.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm",
      sourceLabel: sourceLabelForKey(normalizeLeadSource(lead)),
      ownerId: owner.id || ownerId || lead.agentId,
      ownerName: owner.name || relatedTasks[0]?.ownerName || "Assigned agent",
      agentId: owner.id || lead.agentId || lead.assignedAgentId,
      assignedAgentId: owner.id || lead.assignedAgentId || lead.agentId,
      agencyId: lead.agencyId,
      branchId: lead.branchId,
      provinceId: lead.provinceId,
      qualityScore: score,
      band: quality.band || "unscored",
      missingItems,
      actionReason,
      nextBestAction,
      mustAct,
      priority,
      handoffReady: Boolean(quality.handoffReady),
      commissionStatus: commissionProtected ? "Protected" : "Protect before handover",
      dealRoomStatus: dealRooms.length ? "Shared" : dealRoomNeeded ? "Needed" : "Not needed yet",
      sourceToSaleStage: sourceRow?.currentStage || "registered",
      openTaskCount: relatedTasks.filter((task) => task.status !== "done").length,
      servicePulseScore: pulseItems.length ? averageScore(pulseItems) : 0,
      whatsappDraft: buildLeadWhatsappDraft(lead, {
        ownerName: owner.name || relatedTasks[0]?.ownerName || "the agent",
        missingItems,
        commissionProtected,
        dealRoomNeeded,
        serviceRecoveryNeeded,
        nextBestAction
      })
    };
  });

  const leadCaseIds = new Set(leadRows.flatMap((row) => [row.caseId, row.leadId, row.leadLabel]).filter(Boolean));
  const taskRows = visibleTasks
    .filter((task) => !leadCaseIds.has(task.caseId) && !leadCaseIds.has(task.caseName))
    .map((task) => ({
      id: `task-action-${task.id}`,
      leadId: "",
      caseId: task.caseId,
      caseName: task.caseName,
      leadLabel: task.caseName,
      clientName: task.client || task.caseName,
      intent: "case",
      area: inferAreaFromCaseName(task.caseName),
      sourceLabel: task.source || "Task queue",
      ownerId: task.ownerId,
      ownerName: task.ownerName,
      agentId: task.agentId || task.ownerId,
      assignedAgentId: task.assignedAgentId || task.agentId || task.ownerId,
      agencyId: task.agencyId,
      branchId: task.branchId,
      provinceId: task.provinceId,
      qualityScore: 0,
      band: task.priority || "task",
      missingItems: [],
      actionReason: task.category || "Open task",
      nextBestAction: task.nextAction || "Move the task forward.",
      mustAct: task.role || "agent",
      priority: task.priority === "high" ? "high" : "medium",
      handoffReady: false,
      commissionStatus: /commission|protect/i.test(`${task.title} ${task.category}`) ? "Check protection" : "Not linked",
      dealRoomStatus: "Not linked",
      sourceToSaleStage: "task",
      openTaskCount: task.status === "done" ? 0 : 1,
      servicePulseScore: 0,
      whatsappDraft: `Hi ${task.ownerName}. Axiom action: ${task.nextAction || task.title}. Please update the case once done.`
    }));

  const rows = [...leadRows, ...taskRows]
    .sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority) || right.qualityScore - left.qualityScore);

  return {
    rows,
    summary: {
      total: rows.length,
      critical: rows.filter((row) => row.priority === "critical").length,
      high: rows.filter((row) => row.priority === "high").length,
      concierge: rows.filter((row) => row.mustAct === "concierge").length,
      agent: rows.filter((row) => row.mustAct === "agent").length,
      dealRoomsNeeded: rows.filter((row) => row.dealRoomStatus === "Needed").length,
      commissionGaps: rows.filter((row) => /protect/i.test(row.commissionStatus)).length
    }
  };
}

function isSameCase(record = {}, lead = {}) {
  const leadKeys = [lead.id, lead.caseId, lead.label, lead.caseName].filter(Boolean).map(String);
  const recordKeys = [record.id, record.leadId, record.caseId, record.caseName, record.label, record.property].filter(Boolean).map(String);
  return recordKeys.some((key) => leadKeys.includes(key));
}

function latestCaseMessages(threads = []) {
  return threads
    .flatMap((thread) =>
      ensureArray(thread.messages).map((message) => ({
        threadId: thread.id,
        author: message.author || "Axiom",
        direction: message.direction || "system",
        body: String(message.body || "").trim(),
        at: message.at || thread.updatedAt || thread.createdAt || ""
      }))
    )
    .filter((message) => message.body)
    .sort((left, right) => Date.parse(right.at || 0) - Date.parse(left.at || 0))
    .slice(0, 6);
}

function parseMoneyAmount(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  const match = text.match(/(?:r)?(\d+(?:\.\d+)?)(m|mil|million|k|000)?/i);
  if (!match) return null;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2] || "";
  if (["m", "mil", "million"].includes(suffix)) amount *= 1000000;
  else if (suffix === "k") amount *= 1000;
  else if (suffix === "000" && amount < 10000) amount *= 1000;
  else if (amount < 10000 && text.includes("r")) amount *= 1000;
  return Math.round(amount);
}

function formatRandCompact(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "value to confirm";
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `R${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(2).replace(/0$/, "")}m`;
  }
  return `R${Math.round(amount).toLocaleString("en-ZA")}`;
}

function buildSellerValuationFlow(lead, sellerSnapshot = null) {
  if (lead.intent !== "sell") {
    return {
      status: "not_applicable",
      label: "Buyer case",
      enabled: false
    };
  }

  const summary = lead.answerSummary || {};
  const sellerName = lead.briefCard?.clientName || summary["Client name"] || summary["Seller name"] || "there";
  const area = lead.briefCard?.area || lead.acquisition?.area || summary.Area || summary.Suburb || "your area";
  const propertyType = findSummaryValue(summary, ["Property type", "Type", "Unit type"]) || "property";
  const bedrooms = findSummaryValue(summary, ["Bedrooms", "Beds"]);
  const bathrooms = findSummaryValue(summary, ["Bathrooms", "Baths"]);
  const size = findSummaryValue(summary, ["Size", "m2", "m²", "Floor size"]);
  const condition = findSummaryValue(summary, ["Condition", "Features", "Notes"]) || lead.additionalInfo || "";
  const priceSignal =
    findSummaryValue(summary, ["Expected price", "Listing price", "Price", "Value", "Valuation"]) ||
    lead.acquisition?.signal ||
    lead.additionalInfo;
  const expectedPrice = parseMoneyAmount(priceSignal);
  const hasPropertyFacts = Boolean(propertyType !== "property" || bedrooms || bathrooms || size || condition);
  const hasArea = area && area !== "Area to confirm";
  const offerReady = Boolean(hasArea && hasPropertyFacts);
  const low = expectedPrice ? Math.round(expectedPrice * 0.92 / 5000) * 5000 : null;
  const high = expectedPrice ? Math.round(expectedPrice * 1.08 / 5000) * 5000 : null;
  const recommended = expectedPrice ? Math.round(expectedPrice / 5000) * 5000 : null;

  const permissionPrompt =
    `Thanks ${sellerName}. I have sent this to the concierge so a person can follow up properly. ` +
    `While you wait for the call, would you like me to send a short AI-assisted comparative guide for ${area}? ` +
    `Reply YES GUIDE and I will send it shortly, or NO THANKS and we will leave it for the call.`;

  const valuationDraft = expectedPrice
    ? `Hi ${sellerName}, here is a careful AI-assisted starting point for ${area}: based on the details shared, a rough discussion range is ${formatRandCompact(low)} to ${formatRandCompact(high)}, with ${formatRandCompact(recommended)} as a sensible starting listing conversation. This is not a formal valuation. A local specialist should still review the property, condition, recent comparable sales and listing strategy before any pricing decision.`
    : `Hi ${sellerName}, I can prepare a useful AI-assisted comparative guide for ${area}, but I need one or two extra details first: property type, bedrooms/bathrooms, approximate size, condition, and any price expectation. This will be a discussion guide only, not a formal valuation.`;

  return {
    status: offerReady ? "permission_ready" : "needs_property_facts",
    label: offerReady ? "Valuation guide can be offered" : "Needs property facts first",
    enabled: true,
    trigger: "5 to 15 minutes after seller intake, once enough property data is captured.",
    channel: "WhatsApp first, email optional.",
    permissionPrompt,
    yesReply: "Great, I will send a short guide in about 5 minutes. It is only a starting point for the call, not a formal valuation.",
    noReply: "No problem. The concierge will leave the valuation guide for the call.",
    delayMinutesAfterYes: 5,
    valuationDraft,
    estimatedRange: expectedPrice
      ? {
          low,
          high,
          recommended,
          confidence: hasPropertyFacts && expectedPrice ? "Medium" : "Low"
        }
      : null,
    factsUsed: {
      area,
      propertyType,
      bedrooms: bedrooms || "",
      bathrooms: bathrooms || "",
      size: size || "",
      condition: condition || "",
      sellerDemandConfidence: sellerSnapshot?.confidence || "Not yet available"
    },
    disclaimer: "AI-assisted discussion guide only. Not a formal valuation and not a substitute for a registered valuer or local specialist review.",
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "seller-valuation-guide",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildFridaySellerUpdatePack(lead, sellerSnapshot = null, relatedFeedback = []) {
  if (lead.intent !== "sell") {
    return {
      status: "not_applicable",
      enabled: false
    };
  }
  const sellerName = sellerSnapshot?.sellerName || lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || "Seller";
  const property = sellerSnapshot?.property || lead.label;
  const enquiries = sellerSnapshot?.enquiryCount || 0;
  const viewings = sellerSnapshot?.viewingCount || 0;
  const feedback = sellerSnapshot?.viewingFeedback?.[0] || relatedFeedback[0]?.note || "No viewing feedback captured yet.";
  const recommendation = sellerSnapshot?.recommendedNextMove || lead.leadQuality?.conciergeAction || "Keep the next step clear and agent-reviewed.";
  const agentPermissionPrompt =
    `Seller update ready for ${sellerName} on ${property}. ` +
    `Enquiries: ${enquiries}. Viewings: ${viewings}. Feedback: ${feedback} ` +
    `Recommendation: ${recommendation} Reply SEND to release it to the seller, EDIT to adjust, or HOLD to leave it for now.`;
  const sellerMessageDraft =
    sellerSnapshot?.sellerMessageDraft ||
    `Hi ${sellerName}. A quick update from Axiom: enquiries ${enquiries}, viewings ${viewings}, current feedback: ${feedback}. Recommended next move: ${recommendation}`;

  return {
    enabled: true,
    status: "agent_permission_required",
    label: "Friday seller update",
    schedule: {
      day: "Friday",
      time: "15:30",
      timezone: "Africa/Windhoek"
    },
    agentPermissionPrompt,
    sellerMessageDraft,
    source: "Seller demand snapshot + viewing feedback + case memory",
    avoidsDuplicateFeature: true,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "friday-seller-update-pack",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildPostViewingFeedbackFlow(lead, relatedTasks = [], relatedFeedback = []) {
  const viewingTasks = relatedTasks.filter((task) => /viewing/i.test(`${task.title} ${task.category} ${task.source} ${task.nextAction}`));
  const hasFeedback = relatedFeedback.length > 0;
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "there";
  const property = lead.label || "the property";
  const agentName = "the agent";
  const buyerMessage =
    `Hi ${clientName}, thank you again for taking the time to view ${property}. ` +
    `If you would like to, you can share a quick impression here. Even one short note helps. ` +
    `You can mention what felt right, anything that gave you pause, or whether you would like to take a next step. ` +
    `If you would rather not send feedback, that is completely fine. Just reply NO FEEDBACK and I will close the follow-up politely.`;
  const agentMessage =
    `Hi ${agentName}, when you have a quiet moment, please add a short viewing note for ${property}: buyer mood, main concern if any, price feel, and next step. ` +
    `If there is nothing useful to add right now, reply NO FEEDBACK and Axiom will leave it there.`;

  return {
    enabled: true,
    status: hasFeedback ? "stored" : viewingTasks.length ? "request_ready" : "waiting_for_viewing",
    label: hasFeedback ? "Feedback stored" : viewingTasks.length ? "Feedback request ready" : "Waiting for a viewing",
    trigger: "After each viewing, while the memory is fresh.",
    optional: true,
    buyerMessage,
    agentMessage,
    noFeedbackCommand: "NO FEEDBACK",
    storedFeedbackCount: relatedFeedback.length,
    viewingTaskCount: viewingTasks.length,
    copiedToAgent: true,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "post-viewing-feedback",
      approvalRequired: true,
      copiedToAgent: true,
      noFeedbackIsValid: true
    }
  };
}

function buildDealRoomSummaryFlow(lead, relatedDealRooms = [], sourceRow = null, actionRow = null) {
  const room = relatedDealRooms[0] || {};
  const stageProgress = {
    registered: 12,
    qualified: 25,
    viewing: 38,
    offer: 52,
    conveyancing: 70,
    transfer: 86,
    registration: 100,
    sold: 100
  };
  const currentStage = room.stage || room.currentStage || sourceRow?.currentStage || (lead.leadQuality?.handoffReady ? "qualified" : "registered");
  const rawProgress = Number(room.progress ?? room.progressPercent);
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, Math.round(rawProgress)))
    : stageProgress[String(currentStage || "").toLowerCase()] || (lead.leadQuality?.handoffReady ? 30 : 12);
  const completedSteps = ensureArray(room.completedSteps || room.completed || room.timeline)
    .map((item) => item.label || item.title || item.stage || item)
    .filter(Boolean)
    .slice(0, 4);
  const outstandingItems = ensureArray(room.outstandingItems || room.nextSteps || lead.leadQuality?.missingItems)
    .map((item) => item.label || item.title || item)
    .filter(Boolean)
    .slice(0, 4);
  const nextStep = room.nextStep || actionRow?.nextBestAction || lead.leadQuality?.conciergeAction || "Confirm the next action and keep the client updated.";
  const shareReady = Boolean(relatedDealRooms.length || lead.leadQuality?.handoffReady);
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "Client";

  return {
    enabled: true,
    status: room.shareUrl ? "shared" : shareReady ? "share_ready" : "waiting_for_brief",
    label: room.shareUrl ? "Client Deal Room already shared" : shareReady ? "Deal Room share link ready" : "Waiting for a cleaner brief",
    currentStage,
    progress,
    completedSteps,
    outstandingItems,
    nextStep,
    shareUrl: room.shareUrl || "",
    passwordProtected: true,
    visibility: {
      buyer: true,
      seller: true,
      agent: true,
      attorney: true,
      bondOriginator: true,
      readOnlyForClients: true,
      roleFiltered: true
    },
    sharePrompt:
      `Send ${clientName} a clean Deal Room link: current stage, completed steps, outstanding items and the next action in one place.`,
    clientSummary:
      `Your Deal Room shows the matter at ${currentStage}, about ${progress}% through the tracked process, with the next step: ${nextStep}`,
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "deal-room-share-link",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildCommissionProtectionFlow(lead, relatedCommission = [], actionRow = null) {
  const item = relatedCommission[0] || {};
  const handoffReady = Boolean(lead.leadQuality?.handoffReady || actionRow?.handoffReady);
  const proofItems = ensureArray(item.proofItems || item.proof || item.evidence);
  const accepted = Boolean(relatedCommission.length && !/missing|pending|draft/i.test(`${item.status || ""} ${item.paymentStatus || ""}`));
  const clientName = lead.briefCard?.clientName || lead.answerSummary?.["Client name"] || lead.label || "this lead";

  return {
    enabled: true,
    status: accepted ? "protected" : handoffReady ? "acceptance_required" : "waiting_for_handoff",
    label: accepted ? "25% successful-sale referral protected" : handoffReady ? "25% terms must be accepted" : "Protect once handoff is ready",
    referralPercent: 25,
    payableOnlyOnSuccessfulSale: true,
    noSaleNoCommission: true,
    expectedFee: item.expectedFee || item.expectedCommission || "",
    dueDate: item.dueDate || item.paymentDueDate || "Only when a successful sale closes",
    invoiceStatus: item.invoiceStatus || "Not invoiced",
    paymentStatus: item.paymentStatus || item.status || "Not accepted",
    proofStatus: proofItems.length ? `${proofItems.length} proof item${proofItems.length === 1 ? "" : "s"} logged` : "No proof logged yet",
    agentAcceptancePrompt:
      `Before accepting ${clientName}, please confirm the Axiom referral terms: 25% of the agency commission is payable only if this lead results in a successful sale. If no sale closes, no referral commission is due.`,
    nextAction: accepted ? "Keep proof, invoice status and payment status updated." : "Get the agent acceptance timestamp before active handover.",
    communicationStorage: {
      storedWithCase: true,
      threadCategory: "commission-protection-acceptance",
      approvalRequired: true,
      copiedToAgent: true
    }
  };
}

function buildPrincipalIntelligenceFlow(lead, context = {}) {
  const quality = lead.leadQuality || {};
  const riskFlags = [];
  const opportunityFlags = [];
  const missingItems = ensureArray(quality.missingItems);
  if (quality.handoffReady && !context.relatedCommission?.length) riskFlags.push("25% referral acceptance not logged");
  if (quality.handoffReady && !context.relatedDealRooms?.length) riskFlags.push("Client Deal Room not shared");
  if (context.relatedEscalations?.length) riskFlags.push(`${context.relatedEscalations.length} escalation${context.relatedEscalations.length === 1 ? "" : "s"} open`);
  if (context.relatedPulse?.some((item) => Number(item.score || 0) <= 6)) riskFlags.push("Service recovery signal");
  if (missingItems.length >= 3) riskFlags.push(`${missingItems.length} brief gaps still open`);
  if (lead.intent === "sell") opportunityFlags.push("Seller update and valuation guide can create a stronger follow-up");
  if (quality.score >= 75) opportunityFlags.push("High-value lead should receive quick human attention");
  if (context.sourceRow?.currentStage) opportunityFlags.push(`Track conversion from ${context.sourceRow.currentStage}`);

  return {
    enabled: true,
    status: riskFlags.length ? "attention" : opportunityFlags.length ? "opportunity" : "clear",
    label: riskFlags.length ? "Principal/admin attention needed" : "Principal/admin intelligence clean",
    executiveSummary: riskFlags.length
      ? `This matter needs oversight: ${riskFlags.slice(0, 2).join("; ")}.`
      : `This matter is clean enough for normal follow-up and roll-up reporting.`,
    riskFlags,
    opportunityFlags,
    rollupDimensions: ["province", "agency", "branch", "agent", "lead source", "intent", "stage", "service pulse", "commission exposure"],
    recommendedAdminAction: riskFlags[0] || context.actionRow?.nextBestAction || quality.conciergeAction || "Monitor and keep the next action current.",
    internalOnly: true
  };
}

function buildAgentMatchingFlow(lead, visibleTeam = [], agentMatchingSignals = null, actionRow = null) {
  const signals = ensureArray(agentMatchingSignals?.agents);
  const assignedAgentId = lead.agentId || lead.assignedAgentId || actionRow?.agentId || actionRow?.assignedAgentId || actionRow?.ownerId;
  const assignedSignal = signals.find((agent) => agent.agentId === assignedAgentId);
  const scopedSignals = signals.filter((agent) =>
    (lead.branchId && agent.branchId === lead.branchId) ||
    (lead.provinceId && agent.provinceId === lead.provinceId) ||
    (!lead.branchId && !lead.provinceId)
  );
  const bestSignal = assignedSignal || scopedSignals[0] || signals[0];
  const assignedTeamMember = visibleTeam.find((member) => member.id === assignedAgentId || member.agentId === assignedAgentId);

  if (!bestSignal && !assignedTeamMember) {
    return {
      enabled: true,
      status: "needs_more_data",
      label: "Agent match needs more data",
      internalOnly: true,
      useForRouting: true,
      matchingInputs: agentMatchingSignals?.matchingInputs || ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
      why: ["No scoped agent signal is available yet."]
    };
  }

  const agentName = bestSignal?.agentName || assignedTeamMember?.name || actionRow?.ownerName || "Assigned agent";
  const matchScore = Number(bestSignal?.matchScore || 0);
  const why = [
    bestSignal ? `${matchScore}/100 internal match signal` : "Assigned by the office",
    bestSignal?.serviceAvg ? `${bestSignal.serviceAvg}/10 service pulse average` : "Service pulse still building",
    `${bestSignal?.activeLeadLoad || 0} active lead${bestSignal?.activeLeadLoad === 1 ? "" : "s"} in current load`,
    lead.intent ? `${lead.intent} intent` : "Intent to confirm"
  ];

  return {
    enabled: true,
    status: assignedSignal || assignedTeamMember ? "assigned" : "suggested",
    label: assignedSignal || assignedTeamMember ? `Matched to ${agentName}` : `Suggested: ${agentName}`,
    bestAgentId: bestSignal?.agentId || assignedTeamMember?.id || assignedAgentId || "",
    bestAgentName: agentName,
    matchScore,
    why,
    matchingInputs: agentMatchingSignals?.matchingInputs || ["lead quality", "service pulse", "active load", "branch/province scope", "client intent"],
    internalOnly: true,
    useForRouting: true
  };
}

function buildCaseBrainHub(sessionOrRole, visible = {}, support = {}) {
  const operations = getOperationsState();
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const visibleTasks = visible.tasks || filterVisible(operations.tasks, sessionOrRole);
  const visibleEscalations = visible.escalations || filterVisible(operations.escalations, sessionOrRole);
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visiblePulse = visible.servicePulse || filterVisible(operations.servicePulse, sessionOrRole);
  const visibleThreads = visible.threads || filterVisible(operations.whatsapp.threads, sessionOrRole);
  const visibleQueue = visible.queue || filterVisible(operations.whatsapp.queue, sessionOrRole);
  const visibleFeedback = visible.feedbackLog || filterVisible(operations.whatsapp.feedbackLog, sessionOrRole);
  const visibleTeam = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const sourceToSale = support.sourceToSale || buildSourceToSaleTracker(sessionOrRole, visible);
  const sellerDemandSnapshots = support.sellerDemandSnapshots || buildSellerDemandSnapshots(sessionOrRole, visible);
  const leadActionCentre = support.leadActionCentre || buildLeadActionCentre(sessionOrRole, visible, sourceToSale);
  const agentMatchingSignals = support.agentMatchingSignals || buildAgentMatchingSignals(sessionOrRole, visible, support.servicePulseRollups);

  const cases = visibleLeads.map((lead) => {
    const quality = lead.leadQuality || {};
    const brief = lead.briefCard || {};
    const relatedTasks = visibleTasks.filter((task) => isSameCase(task, lead));
    const relatedEscalations = visibleEscalations.filter((item) => isSameCase(item, lead));
    const relatedCommission = visibleCommission.filter((item) => isSameCase(item, lead));
    const relatedDealRooms = visibleDealRooms.filter((room) => isSameCase(room, lead));
    const relatedPulse = visiblePulse.filter((item) => isSameCase(item, lead));
    const relatedThreads = visibleThreads.filter((thread) => isSameCase(thread, lead));
    const relatedQueue = visibleQueue.filter((item) => isSameCase(item, lead));
    const relatedFeedback = visibleFeedback.filter((item) => isSameCase(item, lead));
    const sourceRow = sourceToSale.rows?.find((row) => row.leadId === lead.id || row.caseId === lead.caseId);
    const actionRow = leadActionCentre.rows?.find((row) => row.leadId === lead.id || row.caseId === lead.caseId);
    const sellerSnapshot = sellerDemandSnapshots.find((item) => item.leadId === lead.id || item.caseId === lead.caseId);
    const ownerId = lead.agentId || lead.assignedAgentId || actionRow?.agentId || actionRow?.ownerId;
    const owner = visibleTeam.find((member) => member.id === ownerId || member.agentId === ownerId);
    const missingItems = ensureArray(quality.missingItems);
    const score = Number(quality.score || 0);
    const approvalQueue = relatedQueue.filter((item) => item.approvalRequired || item.status === "awaiting_approval");
    const recoveryNeeded = relatedPulse.some((item) => Number(item.score || 0) <= 6);
    const commissionProtected = relatedCommission.length > 0;
    const dealRoomShared = relatedDealRooms.length > 0;
    const serviceAvg = relatedPulse.length ? averageScore(relatedPulse) : 0;
    const latestMessages = latestCaseMessages(relatedThreads);
    const sellerValuationFlow = buildSellerValuationFlow(lead, sellerSnapshot);
    const fridaySellerUpdate = buildFridaySellerUpdatePack(lead, sellerSnapshot, relatedFeedback);
    const postViewingFeedback = buildPostViewingFeedbackFlow(lead, relatedTasks, relatedFeedback);
    const dealRoomSummaryFlow = buildDealRoomSummaryFlow(lead, relatedDealRooms, sourceRow, actionRow);
    const commissionProtectionFlow = buildCommissionProtectionFlow(lead, relatedCommission, actionRow);
    const principalIntelligenceFlow = buildPrincipalIntelligenceFlow(lead, {
      sourceRow,
      actionRow,
      sellerSnapshot,
      relatedEscalations,
      relatedPulse,
      relatedCommission,
      relatedDealRooms
    });
    const agentMatchingFlow = buildAgentMatchingFlow(lead, visibleTeam, agentMatchingSignals, actionRow);

    let riskScore = 0;
    if (relatedEscalations.length) riskScore += 35;
    if (!commissionProtected && (quality.handoffReady || score >= 62)) riskScore += 25;
    if (missingItems.length >= 3) riskScore += 18;
    if (!dealRoomShared && quality.handoffReady) riskScore += 12;
    if (approvalQueue.length) riskScore += 10;
    if (recoveryNeeded) riskScore += 25;
    if (score >= 80 && !commissionProtected) riskScore += 10;
    if (sellerValuationFlow.status === "permission_ready") riskScore += 4;
    if (fridaySellerUpdate.status === "agent_permission_required") riskScore += 4;
    if (postViewingFeedback.status === "request_ready") riskScore += 6;
    if (commissionProtectionFlow.status === "acceptance_required") riskScore += 8;
    if (dealRoomSummaryFlow.status === "share_ready") riskScore += 5;
    if (principalIntelligenceFlow.status === "attention") riskScore += 7;

    const riskLevel = riskScore >= 55 ? "critical" : riskScore >= 34 ? "high" : riskScore >= 16 ? "medium" : "low";
    const humanOverrideNeeded = riskLevel === "critical" || recoveryNeeded || relatedEscalations.length > 0;
    const currentStage = sourceRow?.currentStage || (quality.handoffReady ? "qualified" : "registered");
    const nextBestAction =
      actionRow?.nextBestAction ||
      quality.conciergeAction ||
      (quality.handoffReady ? "Pass the brief to the agent with human approval available." : "Concierge to close the missing brief items.");
    const whatsappDraft = actionRow?.whatsappDraft || buildLeadWhatsappDraft(lead, {
      ownerName: owner?.name || actionRow?.ownerName || "the agent",
      missingItems,
      commissionProtected,
      dealRoomNeeded: quality.handoffReady && !dealRoomShared,
      serviceRecoveryNeeded: recoveryNeeded,
      nextBestAction
    });

    return {
      caseId: lead.caseId || lead.id,
      leadId: lead.id,
      caseName: lead.label,
      intent: lead.intent,
      clientName: brief.clientName || lead.answerSummary?.["Client name"] || lead.label,
      area: brief.area || lead.acquisition?.area || lead.answerSummary?.Area || "Area to confirm",
      assignedAgent: owner?.name || actionRow?.ownerName || "Assigned agent to confirm",
      currentStage,
      source: sourceRow?.sourceLabel || sourceLabelForKey(normalizeLeadSource(lead)),
      brainState: humanOverrideNeeded ? "human_override" : approvalQueue.length ? "approval_needed" : quality.handoffReady ? "ready" : "learning",
      brainStateLabel: humanOverrideNeeded ? "Human override" : approvalQueue.length ? "Approval needed" : quality.handoffReady ? "Ready for handoff" : "Still learning",
      riskLevel,
      score,
      band: quality.band || "unscored",
      handoffReady: Boolean(quality.handoffReady),
      missingItems,
      nextBestAction,
      whatsappDraft,
      sellerValuationFlow,
      fridaySellerUpdate,
      postViewingFeedback,
      dealRoomSummaryFlow,
      commissionProtectionFlow,
      principalIntelligenceFlow,
      agentMatchingFlow,
      learningMemory: {
        knownFacts: ensureArray(brief.knownFacts).slice(0, 6),
        latestMessages,
        messageCount: relatedThreads.reduce((total, thread) => total + ensureArray(thread.messages).length, 0),
        feedbackCount: relatedFeedback.length,
        servicePulseCount: relatedPulse.length,
        serviceAvg,
        sellerSnapshotReady: Boolean(sellerSnapshot)
      },
      controls: {
        commissionProtected,
        commissionItems: relatedCommission.length,
        dealRoomShared,
        dealRoomCount: relatedDealRooms.length,
        approvalQueue: approvalQueue.length,
        openTasks: relatedTasks.filter((task) => task.status !== "done").length,
        escalations: relatedEscalations.length,
        humanOverrideNeeded
      },
      stakeholderView: {
        buyer: lead.intent === "buy" || relatedDealRooms.some((room) => /buyer/i.test(JSON.stringify(room))),
        seller: lead.intent === "sell" || Boolean(sellerSnapshot),
        agent: Boolean(owner || actionRow),
        attorney: relatedDealRooms.some((room) => /attorney|convey/i.test(JSON.stringify(room))),
        bondOriginator: relatedDealRooms.some((room) => /bond|finance/i.test(JSON.stringify(room)))
      },
      aiUseCases: [
        "WhatsApp concierge draft",
        "Lead quality explanation",
        lead.intent === "sell" ? "Seller demand snapshot" : "Buyer readiness summary",
        lead.intent === "sell" ? "Seller valuation guide consent" : "Buyer readiness summary",
        lead.intent === "sell" ? "Friday seller update pack" : "Buyer progress update",
        "Post-viewing feedback capture",
        "Client Deal Room summary",
        "25% successful-sale commission protection",
        "Principal/admin risk intelligence",
        "Internal agent matching signal",
        "Next best action",
        "Deal Room progress wording",
        "Commission protection check"
      ],
      flow: [
        {
          key: "lead",
          label: "Lead captured",
          status: "done",
          detail: `${sourceRow?.sourceLabel || sourceLabelForKey(normalizeLeadSource(lead))}`
        },
        {
          key: "brief",
          label: "Brief brain",
          status: quality.handoffReady ? "ready" : "gap",
          detail: missingItems.length ? `${missingItems.length} gap${missingItems.length === 1 ? "" : "s"}` : "Clean enough"
        },
        {
          key: "comms",
          label: "Comms memory",
          status: latestMessages.length ? "active" : "waiting",
          detail: `${latestMessages.length} recent`
        },
        {
          key: "protect",
          label: "Protection",
          status: commissionProtectionFlow.status === "protected" ? "protected" : commissionProtectionFlow.status === "acceptance_required" ? "needed" : "later",
          detail: commissionProtectionFlow.label
        },
        {
          key: "share",
          label: "Deal Room",
          status: dealRoomSummaryFlow.status === "shared" ? "shared" : dealRoomSummaryFlow.status === "share_ready" ? "needed" : "later",
          detail: dealRoomSummaryFlow.label
        },
        {
          key: "next",
          label: "Next action",
          status: humanOverrideNeeded ? "human" : "ai",
          detail: humanOverrideNeeded ? "Concierge steps in" : "AI draft ready"
        },
        {
          key: "valuation",
          label: "Valuation",
          status: sellerValuationFlow.status === "permission_ready" ? "ready" : sellerValuationFlow.status === "needs_property_facts" ? "gap" : "later",
          detail: sellerValuationFlow.enabled ? sellerValuationFlow.label : "Not seller"
        },
        {
          key: "sellerUpdate",
          label: "Seller update",
          status: fridaySellerUpdate.status === "agent_permission_required" ? "approval" : "later",
          detail: fridaySellerUpdate.enabled ? "Fri 15:30" : "Not seller"
        },
        {
          key: "feedback",
          label: "Feedback",
          status: postViewingFeedback.status === "request_ready" ? "ready" : postViewingFeedback.status === "stored" ? "stored" : "waiting",
          detail: postViewingFeedback.label
        },
        {
          key: "intel",
          label: "Office intel",
          status: principalIntelligenceFlow.status === "attention" ? "human" : "ai",
          detail: principalIntelligenceFlow.label
        },
        {
          key: "match",
          label: "Agent match",
          status: agentMatchingFlow.status === "assigned" || agentMatchingFlow.status === "suggested" ? "ready" : "gap",
          detail: agentMatchingFlow.label
        }
      ]
    };
  });

  const sortedCases = cases.sort((left, right) => {
    const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return (riskOrder[right.riskLevel] || 0) - (riskOrder[left.riskLevel] || 0) || right.score - left.score;
  });

  return {
    summary: {
      totalCases: sortedCases.length,
      readyForHandoff: sortedCases.filter((item) => item.handoffReady).length,
      humanOverride: sortedCases.filter((item) => item.controls.humanOverrideNeeded).length,
      approvalNeeded: sortedCases.filter((item) => item.controls.approvalQueue > 0).length,
      protectionNeeded: sortedCases.filter((item) => !item.controls.commissionProtected && item.handoffReady).length,
      dealRoomsNeeded: sortedCases.filter((item) => !item.controls.dealRoomShared && item.handoffReady).length,
      valuationOffersReady: sortedCases.filter((item) => item.sellerValuationFlow?.status === "permission_ready").length,
      sellerUpdatesReady: sortedCases.filter((item) => item.fridaySellerUpdate?.status === "agent_permission_required").length,
      feedbackRequestsReady: sortedCases.filter((item) => item.postViewingFeedback?.status === "request_ready").length,
      dealRoomSummariesReady: sortedCases.filter((item) => item.dealRoomSummaryFlow?.status === "share_ready" || item.dealRoomSummaryFlow?.status === "shared").length,
      commissionProtectionsNeeded: sortedCases.filter((item) => item.commissionProtectionFlow?.status === "acceptance_required").length,
      principalAlerts: sortedCases.filter((item) => item.principalIntelligenceFlow?.status === "attention").length,
      agentMatchesReady: sortedCases.filter((item) => ["assigned", "suggested"].includes(item.agentMatchingFlow?.status)).length,
      learning: sortedCases.filter((item) => item.brainState === "learning").length
    },
    cases: sortedCases,
    model: {
      name: "Axiom Case Brain",
      purpose: "One shared case file for lead quality, concierge messages, valuation consent, Deal Room summaries, seller updates, post-viewing feedback, 25% successful-sale commission protection, principal intelligence, agent matching, service pulse and next actions.",
      humanApprovalRule: "AI may draft and summarise; client-facing or relationship-sensitive sends stay approval-first.",
      channels: ["Mission Control", "WhatsApp", "Deal Room", "Seller valuation guide", "Friday seller update", "Post-viewing feedback", "Commission Protection", "Agent Matching", "09:30 agent digest"]
    }
  };
}

function buildAgentSuccessDesk(sessionOrRole, visible = {}, leadActionCentre = null, servicePulseRollups = null) {
  const operations = getOperationsState();
  const visibleTeam = (visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole))
    .filter((member) => normalizeRole(member.role) === "agent");
  const visibleCommission = visible.commissionTimeline || filterVisible(operations.commissionTimeline, sessionOrRole);
  const visibleDealRooms = visible.dealRooms || filterVisible(operations.dealRooms, sessionOrRole);
  const visibleLeads = visible.leads || filterVisible(state.leads.map(withScopeDefaults), sessionOrRole);
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const pulseRollups = servicePulseRollups || buildServicePulseRollups(sessionOrRole, visible);

  const agents = visibleTeam.map((agent) => {
    const agentActions = actionCentre.rows.filter((row) => row.agentId === agent.id || row.assignedAgentId === agent.id || row.ownerId === agent.id);
    const agentLeads = visibleLeads.filter((lead) => lead.agentId === agent.id || lead.assignedAgentId === agent.id);
    const scoredLeads = agentLeads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
    const pulse = pulseRollups.byAgent.find((item) => item.id === agent.id);
    const protectedDeals = visibleCommission.filter((item) => item.agentId === agent.id || item.assignedAgentId === agent.id || item.agent === agent.name).length;
    const dealRooms = visibleDealRooms.filter((room) => room.agentId === agent.id || room.assignedAgentId === agent.id).length;
    const topAction = agentActions[0];
    const avgLeadScore = scoredLeads.length
      ? Math.round(scoredLeads.reduce((total, lead) => total + Number(lead.leadQuality?.score || 0), 0) / scoredLeads.length)
      : 0;

    return {
      agentId: agent.id,
      agentName: agent.name,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      status: agent.status,
      lane: agent.lane,
      activeLeads: agentLeads.length,
      openActions: agentActions.length,
      hotLeads: agentLeads.filter((lead) => lead.leadQuality?.band === "hot").length,
      weakLeads: agentLeads.filter((lead) => lead.leadQuality?.band === "weak").length,
      avgLeadScore,
      protectedDeals,
      dealRooms,
      serviceAvg: pulse?.avgScore || 0,
      serviceCount: pulse?.count || 0,
      recoveryItems: pulse?.needsRecovery || 0,
      topAction: topAction?.nextBestAction || "No urgent lead action in this view.",
      nextClient: topAction?.clientName || "No priority client",
      assistantBrief: `${agent.name}: ${agentActions.length} open action${agentActions.length === 1 ? "" : "s"}, ${protectedDeals} protected deal${protectedDeals === 1 ? "" : "s"}, ${pulse?.avgScore || 0}/10 service pulse.`,
      checklist: [
        topAction?.nextBestAction || "Check for the next new lead.",
        protectedDeals ? "Keep commission evidence updated." : "Protect commission on the next accepted referral.",
        dealRooms ? "Keep Deal Room progress clean." : "Share Deal Room where the client needs progress visibility."
      ]
    };
  });

  const fallbackAgentIds = unique(actionCentre.rows.map((row) => row.agentId).filter(Boolean))
    .filter((agentId) => !agents.some((agent) => agent.agentId === agentId));
  for (const agentId of fallbackAgentIds) {
    const rows = actionCentre.rows.filter((row) => row.agentId === agentId);
    agents.push({
      agentId,
      agentName: rows[0]?.ownerName || "Assigned agent",
      branchId: rows[0]?.branchId || "",
      provinceId: rows[0]?.provinceId || "",
      status: "active",
      lane: "Lead handling",
      activeLeads: rows.length,
      openActions: rows.length,
      hotLeads: rows.filter((row) => row.band === "hot").length,
      weakLeads: rows.filter((row) => row.band === "weak").length,
      avgLeadScore: rows.length ? Math.round(rows.reduce((total, row) => total + Number(row.qualityScore || 0), 0) / rows.length) : 0,
      protectedDeals: 0,
      dealRooms: 0,
      serviceAvg: 0,
      serviceCount: 0,
      recoveryItems: 0,
      topAction: rows[0]?.nextBestAction || "No urgent lead action in this view.",
      nextClient: rows[0]?.clientName || "No priority client",
      assistantBrief: `${rows[0]?.ownerName || "Assigned agent"}: ${rows.length} open action${rows.length === 1 ? "" : "s"} to work.`,
      checklist: rows.slice(0, 3).map((row) => row.nextBestAction)
    });
  }

  const sortedAgents = agents.sort((left, right) => right.openActions - left.openActions || right.hotLeads - left.hotLeads);
  return {
    agents: sortedAgents,
    summary: {
      agents: sortedAgents.length,
      openActions: sortedAgents.reduce((total, agent) => total + agent.openActions, 0),
      hotLeads: sortedAgents.reduce((total, agent) => total + agent.hotLeads, 0),
      recoveryItems: sortedAgents.reduce((total, agent) => total + agent.recoveryItems, 0),
      protectedDeals: sortedAgents.reduce((total, agent) => total + agent.protectedDeals, 0)
    }
  };
}

function buildAgentActionDigests(sessionOrRole, visible = {}, agentSuccessDesk = null, leadActionCentre = null, caseBrain = null) {
  const operations = getOperationsState();
  const successDesk = agentSuccessDesk || buildAgentSuccessDesk(sessionOrRole, visible);
  const actionCentre = leadActionCentre || buildLeadActionCentre(sessionOrRole, visible);
  const brain = caseBrain || buildCaseBrainHub(sessionOrRole, visible, { leadActionCentre: actionCentre });
  const team = visible.teamMembers || filterVisible(operations.teamMembers, sessionOrRole);
  const weekdayTime = "09:30";

  const digests = successDesk.agents.map((agent) => {
    const member = team.find((item) => item.id === agent.agentId || item.agentId === agent.agentId) || {};
    const email = normalizeEmail(member.email || member.contact);
    const actions = actionCentre.rows
      .filter((row) => row.agentId === agent.agentId || row.assignedAgentId === agent.agentId || row.ownerId === agent.agentId)
      .slice(0, 5);
    const topActions = actions.slice(0, 3).map((row) => {
      const brainCase = brain.cases.find((item) => item.caseId === row.caseId || item.leadId === row.leadId || item.caseName === row.caseName) || null;
      return {
        clientName: row.clientName,
        priority: row.priority,
        reason: row.actionReason,
        nextBestAction: row.nextBestAction,
        whatsappDraft: row.whatsappDraft,
        caseBrainSignal: brainCase
          ? {
              score: brainCase.score,
              band: brainCase.band,
              state: brainCase.brainStateLabel,
              risk: brainCase.riskLevel
            }
          : null
      };
    });
    const caseBrainHighlights = topActions
      .filter((action) => action.caseBrainSignal)
      .map((action) => ({
        clientName: action.clientName,
        score: action.caseBrainSignal.score,
        band: action.caseBrainSignal.band,
        state: action.caseBrainSignal.state,
        risk: action.caseBrainSignal.risk,
        nextBestAction: action.nextBestAction
      }));
    const protectionGaps = actions.filter((row) => /protect/i.test(row.commissionStatus)).length;
    const dealRoomGaps = actions.filter((row) => row.dealRoomStatus === "Needed").length;
    const subject = `Axiom 09:30 action digest - ${agent.agentName}`;
    const bodyLines = [
      `Good morning ${agent.agentName}.`,
      `You have ${actions.length} priority action${actions.length === 1 ? "" : "s"} in Axiom today.`,
      ...topActions.map((action, index) => {
        const brainLine = action.caseBrainSignal
          ? ` (${action.caseBrainSignal.band} ${action.caseBrainSignal.score}/100, ${action.caseBrainSignal.risk} risk)`
          : "";
        return `${index + 1}. ${action.clientName}: ${action.nextBestAction}${brainLine}`;
      }),
      protectionGaps ? `${protectionGaps} commission protection gap${protectionGaps === 1 ? "" : "s"} need attention.` : "No urgent commission protection gap in this view.",
      dealRoomGaps ? `${dealRoomGaps} client Deal Room${dealRoomGaps === 1 ? "" : "s"} should be shared.` : "No urgent Deal Room gap in this view."
    ];

    return {
      agentId: agent.agentId,
      agentName: agent.agentName,
      email,
      emailStatus: email ? "ready" : "email_missing",
      schedule: "Weekdays 09:30",
      channel: "email",
      subject,
      bodyPreview: bodyLines.join("\n"),
      topActions,
      caseBrainHighlights,
      actionCount: actions.length,
      protectionGaps,
      dealRoomGaps,
      serviceAvg: agent.serviceAvg,
      recoveryItems: agent.recoveryItems
    };
  });

  return {
    schedule: {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      time: weekdayTime,
      timezone: "Africa/Windhoek"
    },
    digests,
    summary: {
      total: digests.length,
      ready: digests.filter((digest) => digest.emailStatus === "ready").length,
      missingEmail: digests.filter((digest) => digest.emailStatus === "email_missing").length,
      totalActions: digests.reduce((total, digest) => total + digest.actionCount, 0)
    }
  };
}

function normalizePilotStatus(value) {
  const status = slugify(value || "").replace(/-/g, "_");
  const allowed = new Set(["not_invited", "invited", "opted_in", "active", "issue", "paused", "passed"]);
  return allowed.has(status) ? status : "invited";
}

function pilotStatusLabel(status) {
  return {
    not_invited: "Not invited",
    invited: "Invited",
    opted_in: "Opted in",
    active: "Active",
    issue: "Issue",
    paused: "Paused",
    passed: "Passed"
  }[normalizePilotStatus(status)] || "Invited";
}

function getPilotControlState() {
  const operations = getOperationsState();
  operations.pilotControl ||= { agents: [], scenarios: [], messageLog: [], issueLog: [] };
  operations.pilotControl.agents ||= [];
  operations.pilotControl.scenarios ||= [];
  operations.pilotControl.messageLog ||= [];
  operations.pilotControl.issueLog ||= [];
  return operations.pilotControl;
}

function findPilotAgent(control, agentId) {
  const id = String(agentId || "").trim();
  return control.agents.find((agent) => agent.id === id || agent.agentId === id || agent.agentName === id) || null;
}

function findPilotScenario(control, scenarioId) {
  const id = String(scenarioId || "").trim();
  return control.scenarios.find((scenario) => scenario.id === id || scenario.title === id) || null;
}

function buildPilotMessageBody(agent, scenario) {
  return String(scenario.body || "")
    .replace(/\[Agent Name\]/g, agent.agentName || "Agent")
    .replace(/\[agent name\]/g, agent.agentName || "Agent");
}

function buildPilotControlSnapshot(sessionOrRole, visible = {}) {
  const control = getPilotControlState();
  const agents = visible.pilotAgents || filterVisible(control.agents, sessionOrRole);
  const scenarios = visible.pilotScenarios || filterVisible(control.scenarios, sessionOrRole);
  const messageLog = visible.pilotMessageLog || filterVisible(control.messageLog, sessionOrRole);
  const issueLog = visible.pilotIssueLog || filterVisible(control.issueLog, sessionOrRole);
  const openIssues = issueLog.filter((issue) => issue.status !== "closed");

  const agentsWithProgress = agents.map((agent) => {
    const passed = ensureArray(agent.scenariosPassed);
    const agentIssues = openIssues.filter((issue) => issue.agentId === agent.agentId || issue.agentId === agent.id);
    const lastMessage = messageLog
      .filter((message) => message.agentId === agent.agentId || message.agentId === agent.id)
      .sort((left, right) => Date.parse(right.queuedAt || right.updatedAt || 0) - Date.parse(left.queuedAt || left.updatedAt || 0))[0];
    return {
      ...agent,
      status: normalizePilotStatus(agent.status),
      statusLabel: pilotStatusLabel(agent.status),
      scenariosPassed: passed,
      passedCount: passed.length,
      issueCount: agentIssues.length,
      lastMessageAt: lastMessage?.queuedAt || agent.lastScenarioAt || "",
      currentScenarioTitle: scenarios.find((scenario) => scenario.id === agent.currentScenarioId)?.title || agent.nextTest || "Next test to assign"
    };
  });

  const scenarioRows = scenarios.map((scenario) => {
    const sent = messageLog.filter((message) => message.scenarioId === scenario.id);
    const passedCount = agentsWithProgress.filter((agent) => ensureArray(agent.scenariosPassed).includes(scenario.id)).length;
    const issueCount = openIssues.filter((issue) => issue.scenarioId === scenario.id).length;
    return {
      ...scenario,
      sentCount: sent.length,
      passedCount,
      issueCount,
      passRate: agentsWithProgress.length ? Math.round((passedCount / agentsWithProgress.length) * 100) : 0
    };
  });

  return {
    agents: agentsWithProgress,
    scenarios: scenarioRows,
    messageLog: messageLog
      .slice()
      .sort((left, right) => Date.parse(right.queuedAt || right.updatedAt || 0) - Date.parse(left.queuedAt || left.updatedAt || 0))
      .slice(0, 20),
    issueLog: issueLog
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || right.updatedAt || 0) - Date.parse(left.createdAt || left.updatedAt || 0))
      .slice(0, 20),
    metrics: {
      totalAgents: agentsWithProgress.length,
      invited: agentsWithProgress.filter((agent) => agent.status === "invited").length,
      optedIn: agentsWithProgress.filter((agent) => agent.status === "opted_in" || agent.status === "active" || agent.status === "passed").length,
      active: agentsWithProgress.filter((agent) => agent.status === "active").length,
      issues: openIssues.length,
      passedAgents: agentsWithProgress.filter((agent) => agent.status === "passed").length,
      scenarios: scenarioRows.length,
      messagesQueued: messageLog.length
    },
    nextBestStep: openIssues.length
      ? "Resolve open pilot issues before inviting more agents."
      : agentsWithProgress.some((agent) => agent.status === "invited")
        ? "Confirm WhatsApp opt-in for invited agents, then queue the first scenario."
        : "Queue the next scenario and watch replies in Concierge Comms."
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function computeAgentNetworkRecord(record) {
  const normalized = normalizeAgentNetworkRecord(record);
  const hasEmail = Boolean(normalized.contact.email);
  const hasWhatsapp = Boolean(normalized.contact.whatsapp);
  const hasSource = Boolean(normalized.source.url || normalized.source.note);
  const sourceAgeDays = daysSinceIso(normalized.source.capturedAt);
  const verifiedAgeDays = daysSinceIso(normalized.verification.lastVerifiedAt);
  const doNotContact =
    normalized.consent.doNotContact ||
    normalized.consent.emailStatus === "opted_out" ||
    normalized.consent.whatsappStatus === "opted_out" ||
    normalized.verification.status === "invalid";
  const verificationWeight =
    normalized.verification.status === "verified"
      ? 24
      : normalized.verification.status === "source_found"
        ? 13
        : normalized.verification.status === "needs_review"
          ? 7
          : -20;
  const contactWeight = (hasWhatsapp ? 18 : 0) + (hasEmail ? 10 : 0);
  const sourceWeight = hasSource ? 12 : -12;
  const complianceWeight = doNotContact
    ? -50
    : normalized.consent.whatsappStatus === "opted_in"
      ? 16
      : normalized.consent.emailStatus === "business_context" || normalized.consent.whatsappStatus === "business_context"
        ? 9
        : 3;
  const marketWeight = Math.min(18, ensureArray(normalized.towns).length * 3 + ensureArray(normalized.specialties).length * 3);
  const fitWeight = Math.round(
    (Number(normalized.matchingSignals.sellerFit || 0) +
      Number(normalized.matchingSignals.buyerFit || 0) +
      Number(normalized.matchingSignals.referralFit || 0) +
      Number(normalized.matchingSignals.responseReliability || 0)) /
      20
  );
  const pulseWeight = Math.min(10, Math.round(Number(normalized.matchingSignals.servicePulseAvg || 0)));
  const stalePenalty = verifiedAgeDays !== null && verifiedAgeDays > 120 ? 12 : sourceAgeDays !== null && sourceAgeDays > 180 ? 8 : 0;
  const networkScore = clampScore(22 + verificationWeight + contactWeight + sourceWeight + complianceWeight + marketWeight + fitWeight + pulseWeight - stalePenalty);

  let complianceStatus = "usable_controlled_outreach";
  let nextAction = "Use for matching and controlled one-to-one outreach.";
  if (doNotContact) {
    complianceStatus = "do_not_contact";
    nextAction = "Do not contact. Keep only for suppression and audit history.";
  } else if (!hasSource) {
    complianceStatus = "source_needed";
    nextAction = "Add a public source URL or source note before use.";
  } else if (normalized.verification.status !== "verified") {
    complianceStatus = "verify_before_outreach";
    nextAction = "Verify the public source and contact details before first outreach.";
  } else if (!hasEmail && !hasWhatsapp) {
    complianceStatus = "contact_missing";
    nextAction = "Use for coverage mapping only until contact details are confirmed.";
  }

  return {
    ...normalized,
    hasEmail,
    hasWhatsapp,
    hasSource,
    sourceAgeDays,
    verifiedAgeDays,
    doNotContact,
    networkScore,
    matchBand: networkScore >= 80 ? "priority" : networkScore >= 65 ? "strong" : networkScore >= 45 ? "developing" : "hold",
    complianceStatus,
    outreachAllowed: complianceStatus === "usable_controlled_outreach",
    pilotInviteReady: complianceStatus === "usable_controlled_outreach" && hasWhatsapp && networkScore >= 65,
    contactability: hasWhatsapp ? "WhatsApp ready" : hasEmail ? "Email only" : "No usable contact",
    nextAction,
    recommendedUse: doNotContact
      ? "suppression_only"
      : complianceStatus === "usable_controlled_outreach"
        ? "match_invite_or_pilot"
        : "internal_mapping_until_checked"
  };
}

function buildProvinceAgentNetworkRollups(records = []) {
  const groups = new Map();
  records.forEach((record) => {
    const key = record.provinceId || "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        provinceId: key,
        province: record.province || formatProvinceLabel(key),
        records: [],
        towns: new Set(),
        specialties: new Set()
      });
    }
    const group = groups.get(key);
    group.records.push(record);
    ensureArray(record.towns).forEach((town) => group.towns.add(town));
    ensureArray(record.specialties).forEach((specialty) => group.specialties.add(specialty));
  });

  return [...groups.values()]
    .map((group) => {
      const records = group.records;
      const avgScore = records.length
        ? Math.round(records.reduce((total, item) => total + Number(item.networkScore || 0), 0) / records.length)
        : 0;
      return {
        provinceId: group.provinceId,
        province: group.province,
        total: records.length,
        verified: records.filter((item) => item.verification.status === "verified").length,
        inviteReady: records.filter((item) => item.pilotInviteReady).length,
        doNotContact: records.filter((item) => item.doNotContact).length,
        avgScore,
        towns: [...group.towns].slice(0, 8),
        specialties: [...group.specialties].slice(0, 8)
      };
    })
    .sort((left, right) => right.total - left.total || left.province.localeCompare(right.province));
}

function buildAgentNetworkDirectorySnapshot(sessionOrRole, visible = {}) {
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  if (!hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])) {
    return {
      authorized: false,
      summary: { total: 0, visible: 0 },
      records: [],
      provinceRollups: [],
      pilotCandidates: [],
      verificationQueue: [],
      outreachLog: [],
      importBatches: []
    };
  }

  const operations = getOperationsState();
  const directory = visible.agentNetworkDirectory || filterVisible(operations.agentNetwork.directory, session);
  const outreachLog = visible.agentNetworkOutreachLog || filterVisible(operations.agentNetwork.outreachLog, session);
  const importBatches = visible.agentNetworkImportBatches || filterVisible(operations.agentNetwork.importBatches, session);
  const records = directory.map(computeAgentNetworkRecord).sort((left, right) => right.networkScore - left.networkScore);
  const verificationQueue = records
    .filter((record) => ["source_needed", "verify_before_outreach", "contact_missing"].includes(record.complianceStatus))
    .sort((left, right) => right.networkScore - left.networkScore);
  const pilotCandidates = records.filter((record) => record.pilotInviteReady).slice(0, 25);
  const doNotContact = records.filter((record) => record.doNotContact);

  return {
    authorized: true,
    guardrails: {
      modulePurpose: "Internal agent coverage, matching, pilot selection and controlled business outreach.",
      publicDomainRule: "Public-domain data is still treated as personal information. Keep source proof, verify before outreach, and respect opt-out immediately.",
      noBulkSpam: true,
      outreachMode: "One-to-one invitation or relationship message only; WhatsApp sends remain queued for human control.",
      retentionNote: "Keep records accurate, source-backed and removable when no longer needed."
    },
    summary: {
      total: records.length,
      verified: records.filter((record) => record.verification.status === "verified").length,
      needsVerification: verificationQueue.length,
      inviteReady: pilotCandidates.length,
      doNotContact: doNotContact.length,
      hasWhatsapp: records.filter((record) => record.hasWhatsapp).length,
      hasEmail: records.filter((record) => record.hasEmail).length,
      avgScore: records.length ? Math.round(records.reduce((total, record) => total + record.networkScore, 0) / records.length) : 0,
      provincesCovered: new Set(records.map((record) => record.provinceId)).size,
      publicSourceRecords: records.filter((record) => record.source.type.includes("public")).length
    },
    records: records.slice(0, 100),
    provinceRollups: buildProvinceAgentNetworkRollups(records),
    pilotCandidates,
    verificationQueue: verificationQueue.slice(0, 25),
    doNotContact,
    outreachLog: outreachLog
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
      .slice(0, 50),
    importBatches: importBatches
      .slice()
      .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
      .slice(0, 20)
  };
}

function buildAiValueOpportunities(sessionOrRole, snapshot) {
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  const role = session.role;
  const metrics = snapshot.metrics || {};
  const rollups = snapshot.rollups || {};
  const roleLabel = getRoleProfile(role).label;

  const base = {
    role,
    roleLabel,
    mode: config.whatsappMode,
    llmStatus: getLlmStatus().status,
    llmProvider: getLlmStatus(),
    principle: "AI drafts, summarises, detects risk and recommends next action. Humans approve, override or take over where judgement matters.",
    opportunities: []
  };

  const add = (item) => base.opportunities.push({
    priority: item.priority || "medium",
    title: item.title,
    value: item.value,
    trigger: item.trigger,
    suggestedAction: item.suggestedAction,
    humanControl: item.humanControl || "Human can approve, edit, delay or override before anything sensitive is sent.",
    channel: item.channel || "Mission Control + WhatsApp",
    llmJob: item.llmJob
  });

  if (role === "principal") {
    add({
      priority: "high",
      title: "Branch and province performance intelligence",
      value: "Shows where leads, delays, protected deals and agent load are building up across provinces or branches.",
      trigger: "Daily and weekly rollup, or whenever the principal opens Mission Control.",
      suggestedAction: "Ask the LLM for the three biggest business risks and three highest-value opportunities from current rollups.",
      llmJob: "Compare branch, province and agent rollups; explain leakage, momentum and focus areas."
    });
    add({
      priority: "high",
      title: "Commission exposure watch",
      value: "Surfaces referral splits, missing proof, due dates and unpaid commission before money leaks out.",
      trigger: `${metrics.protectedDeals || snapshot.commissionTimeline.length} protected deal records visible.`,
      suggestedAction: "Generate a concise exposure brief and queue follow-ups for the responsible admin or agent.",
      llmJob: "Summarise protected deals by risk, due date, proof strength and next chase."
    });
    add({
      priority: "high",
      title: "Agent Network Directory intelligence",
      value: "Turns public-source agent data into province coverage, pilot candidates, matching pools and safe one-to-one outreach queues.",
      trigger: `${metrics.agentNetworkRecords || 0} directory record(s), ${metrics.agentNetworkNeedsVerification || 0} needing verification.`,
      suggestedAction: "Shortlist coverage gaps, verify public-source records and promote only outreach-ready agents into pilot invitations.",
      llmJob: "Score agents by source quality, contactability, area fit, service signals, province coverage and compliance status."
    });
    add({
      priority: "high",
      title: "Source-to-sale performance tracker",
      value: "Shows which sources produce qualified leads, viewings, offers, sales and protected commission instead of only counting enquiries.",
      trigger: `${snapshot.sourceToSale?.summary?.totalLeads || 0} visible leads across ${snapshot.sourceToSale?.bySource?.length || 0} source bucket(s).`,
      suggestedAction: "Ask the LLM which sources deserve more attention and which are creating admin noise.",
      llmJob: "Compare source-to-sale conversion by website, WhatsApp, referral, portal, agent import and future Google Ads."
    });
    add({
      priority: "high",
      title: "Agent Success Desk and Lead Action Centre",
      value: "Turns every lead into an action card: missing info, WhatsApp draft, protection status, Deal Room need and responsible person.",
      trigger: `${metrics.leadActions || 0} lead action card(s), ${metrics.criticalLeadActions || 0} critical.`,
      suggestedAction: "Work the critical actions first, then use the agent success summary to coach or reassign load.",
      llmJob: "Convert lead quality, tasks, comms, protection and Deal Room state into a ranked action list."
    });
    add({
      priority: "high",
      title: "Axiom Case Brain",
      value: "Connects lead score, comms memory, valuation consent, Deal Room summaries, Friday seller updates, post-viewing feedback, service pulse, 25% commission protection, principal intelligence, agent matching and next action into one case file.",
      trigger: `${metrics.caseBrainTotal || 0} case brain(s), ${metrics.caseBrainHumanOverride || 0} needing human override, ${metrics.caseBrainValuationOffers || 0} valuation offer(s), ${metrics.caseBrainSellerUpdates || 0} Friday update(s), ${metrics.caseBrainFeedbackRequests || 0} feedback request(s), ${metrics.caseBrainCommissionProtections || 0} commission protection item(s), ${metrics.caseBrainAgentMatches || 0} agent match(es).`,
      suggestedAction: "Use the Case Brain before every client-facing WhatsApp, valuation guide, agent brief, seller update, feedback request, Deal Room share, commission chase or agent assignment.",
      llmJob: "Read one case file, explain the current state, draft the right next message, and flag where human judgement or approval is needed."
    });
    add({
      priority: "high",
      title: "Client Service Pulse and quarterly recognition",
      value: "Uses buyer and seller feedback to spot service risk, reward strong agents and improve future lead matching.",
      trigger: `${metrics.servicePulseCount || 0} service pulse records, ${metrics.servicePulseRecovery || 0} needing recovery.`,
      suggestedAction: "Review recovery items first, then use the quarterly candidate table for internal recognition.",
      llmJob: "Summarise feedback patterns by agent, branch, province and trigger point."
    });
    add({
      priority: "high",
      title: "WhatsApp pilot readiness",
      value: "Keeps real-agent WhatsApp testing controlled before the product is exposed to a wider group.",
      trigger: `${metrics.pilotAgents || 0} pilot agent(s), ${metrics.pilotIssues || 0} open pilot issue(s).`,
      suggestedAction: "Clear open issues, then send the next pilot scenario to opted-in agents.",
      llmJob: "Summarise pilot readiness, failed scenarios, wording issues and rollout risk."
    });
  }

  if (role === "office_admin") {
    add({
      priority: "high",
      title: "Axiom Case Brain",
      value: "Gives the concierge one case truth before drafting WhatsApp replies, asking missing questions, offering the valuation guide, preparing Friday seller updates, requesting viewing feedback, protecting commission, sharing Deal Rooms or escalating to a human.",
      trigger: `${metrics.caseBrainTotal || 0} case brain(s), ${metrics.caseBrainHumanOverride || 0} human override item(s), ${metrics.caseBrainValuationOffers || 0} valuation offer(s), ${metrics.caseBrainSellerUpdates || 0} Friday update(s), ${metrics.caseBrainFeedbackRequests || 0} feedback request(s), ${metrics.caseBrainDealRoomSummaries || 0} Deal Room summary item(s), ${metrics.caseBrainPrincipalAlerts || 0} admin alert(s).`,
      suggestedAction: "Open the highest-risk Case Brain first, then clear missing fields, request approval, send the next WhatsApp draft, share the Deal Room, protect commission, or route to the best-fit agent.",
      llmJob: "Summarise case memory, lead quality, valuation readiness, seller update readiness, feedback status, Deal Room readiness, protection risk, agent match and the next safest concierge action."
    });
    add({
      priority: "high",
      title: "Concierge morning control brief",
      value: "One admin can see which agents, sellers, buyers and transfer parties need action today.",
      trigger: `${metrics.openTasks || 0} open tasks and ${metrics.pendingReminders || 0} pending reminders in scope.`,
      suggestedAction: "Draft a morning WhatsApp brief for each agent and an admin chase list for the concierge.",
      llmJob: "Turn tasks, reminders, comms and escalations into a ranked admin action list."
    });
    add({
      priority: "medium",
      title: "Seller update pack approval",
      value: "The seller gets looked after without the agent manually writing updates from memory.",
      trigger: "Friday 15:30, or whenever enough viewing/enquiry/feedback data exists.",
      suggestedAction: "Draft the concise seller update and ask the agent/admin for permission before sending.",
      llmJob: "Summarise enquiries, viewings, feedback and recommendation in a careful seller-friendly tone."
    });
    add({
      priority: "high",
      title: "Brief completeness desk",
      value: "Keeps weak or incomplete leads with the concierge until the missing questions are answered.",
      trigger: `${metrics.weakLeads || 0} weak and ${metrics.nurtureLeads || 0} nurture leads in scope.`,
      suggestedAction: "Generate missing-question WhatsApp prompts and only hand over well-briefed buy/sell cards.",
      llmJob: "Turn lead gaps into concise concierge questions and a clean handover card for the assigned agent."
    });
    add({
      priority: "high",
      title: "Lead Action Centre",
      value: "Stops leads from drifting by showing who must act, why, and what message should go next.",
      trigger: `${metrics.agentSuccessOpenActions || 0} open agent/concierge lead action(s).`,
      suggestedAction: "Queue the prepared WhatsApp draft, protect commission, or generate the Deal Room where needed.",
      llmJob: "Rank lead actions by urgency, handoff readiness, missing data and commercial risk."
    });
    add({
      priority: "medium",
      title: "Agent directory verification desk",
      value: "Keeps public-source agent records accurate before Axiom uses them for matching, pilots or business invitations.",
      trigger: `${metrics.agentNetworkNeedsVerification || 0} directory record(s) need verification in scope.`,
      suggestedAction: "Check source proof, mark verified, log outreach, or suppress the record if contact should not happen.",
      llmJob: "Summarise each sourced profile and recommend whether it is matching-only, outreach-ready or no-contact."
    });
    add({
      priority: "high",
      title: "Service recovery queue",
      value: "Catches buyer or seller frustration early so the concierge can step in before the relationship weakens.",
      trigger: `${metrics.servicePulseRecovery || 0} low service pulse record(s) in scope.`,
      suggestedAction: "Prepare a calm recovery note for the agent/admin to approve and log the outcome in comms.",
      llmJob: "Classify feedback, identify the likely friction point and draft a human-safe recovery action."
    });
    add({
      priority: "high",
      title: "Pilot Control Room",
      value: "Lets the concierge test WhatsApp flows with selected agents, log issues and pause the rollout when something is off.",
      trigger: `${metrics.pilotActive || 0} active WhatsApp pilot agent(s) in scope.`,
      suggestedAction: "Queue one scenario at a time and only mark it passed once the agent confirms the flow works.",
      llmJob: "Turn pilot replies and issues into a short fix list before the next test round."
    });
  }

  if (role === "agent") {
    add({
      priority: "high",
      title: "Personal AI Assistant bot for the agent",
      value: "Keeps the agent focused on selling while Axiom handles reminders, drafts, qualification and follow-up.",
      trigger: "Every new lead, missed update, viewing reminder, feedback gap or document request.",
      suggestedAction: "Generate the agent's next three actions and prepare WhatsApp drafts for approval.",
      llmJob: "Summarise assigned cases, identify stale items and draft short WhatsApp messages."
    });
    add({
      priority: "high",
      title: "Protect commission at the right moment",
      value: "Turns referral protection into a habit, not an afterthought.",
      trigger: "Lead accepted, viewing booked, offer stage reached, or referral terms missing.",
      suggestedAction: "Prompt the agent to protect commission and capture split proof before the deal moves too far.",
      llmJob: "Explain what evidence is missing and draft the acceptance/chase message."
    });
    add({
      priority: "high",
      title: "Well-briefed buy/sell card",
      value: "The agent receives the client context, quality band, missing risks and next action before the first call.",
      trigger: "When concierge marks a lead warm/hot or closes the missing brief items.",
      suggestedAction: "Show the brief card first, not raw form answers.",
      llmJob: "Compress the intake, concierge answers and source context into a focused agent handover card."
    });
    add({
      priority: "high",
      title: "Agent Success Desk",
      value: "Gives the agent one place to see priority clients, next actions, WhatsApp drafts, Deal Room gaps and protection status.",
      trigger: `${metrics.agentSuccessOpenActions || 0} open action(s) in the agent success view.`,
      suggestedAction: "Work the top action, queue the prepared draft, then log the outcome.",
      llmJob: "Explain what to do next for each assigned client and why it matters."
    });
    add({
      priority: "medium",
      title: "Seller demand snapshot",
      value: "Gives the agent a seller-ready view of enquiry level, buyer type, suburb demand, feedback, price sensitivity and next move.",
      trigger: `${snapshot.sellerDemandSnapshots?.length || 0} seller demand snapshot(s) in this workspace.`,
      suggestedAction: "Use the snapshot before the seller update so the message feels specific and commercially useful.",
      llmJob: "Turn enquiries, viewing feedback and lead signals into a concise seller demand update."
    });
    add({
      priority: "medium",
      title: "Personal service score coaching",
      value: "Shows where buyers and sellers feel well served, and where Axiom should help the agent recover or communicate better.",
      trigger: `${metrics.avgServicePulse || 0}/10 average service pulse in this workspace.`,
      suggestedAction: "Use the patterns in the weekly agent scorecard, not as public ratings.",
      llmJob: "Turn feedback into three coaching actions and one client recovery suggestion where needed."
    });
  }

  if (role === "seller") {
    add({
      priority: "high",
      title: "Seller confidence concierge",
      value: "Reduces anxiety by explaining what happened, what is outstanding and what happens next.",
      trigger: "After a viewing, weekly update, valuation request or status change.",
      suggestedAction: "Draft a calm progress note and ask whether the seller wants a specialist review.",
      llmJob: "Translate case activity into a reassuring seller update with one clear next step."
    });
    add({
      priority: "high",
      title: "Seller demand snapshot",
      value: "Shows the seller enquiry level, buyer type, suburb demand, viewing feedback, price sensitivity and the recommended next move.",
      trigger: "After intake, viewing activity, buyer feedback, or Friday seller update preparation.",
      suggestedAction: "Send a concise snapshot only when the agent/admin approves the wording.",
      llmJob: "Explain demand and feedback in plain seller-friendly language without overpromising."
    });
  }

  if (role === "buyer") {
    add({
      priority: "high",
      title: "Buyer readiness concierge",
      value: "Helps the buyer move faster by cleaning up finance, timing and property-fit uncertainty.",
      trigger: "Buyer intake, viewing booked, finance gap, or offer readiness check.",
      suggestedAction: "Ask only for the missing item and explain why it helps the buyer move with confidence.",
      llmJob: "Summarise buyer readiness, missing finance docs and next best property step."
    });
  }

  if (role === "attorney") {
    add({
      priority: "medium",
      title: "Transfer milestone summariser",
      value: "Keeps transfer updates understandable to non-lawyers without exposing unrelated office data.",
      trigger: "Missing transfer document, delayed certificate, signature window or registration milestone.",
      suggestedAction: "Draft a plain-language milestone update for the parties and the assigned agent.",
      llmJob: "Convert transfer status into clear, non-legalese next steps."
    });
  }

  if (role === "bond_originator") {
    add({
      priority: "medium",
      title: "Bond readiness summariser",
      value: "Keeps finance blockers visible before they slow the sale.",
      trigger: "Missing proof of income, pre-approval status change, valuation request or bond condition.",
      suggestedAction: "Draft a finance-readiness update and list exactly what remains outstanding.",
      llmJob: "Summarise bond status, missing documents and impact on the transaction timeline."
    });
  }

  base.rollupFocus = {
    provinces: rollups.provinces || {},
    branches: rollups.branches || {},
    agents: rollups.agents || {}
  };
  return base;
}

function buildOperationsSnapshot(sessionOrRole) {
  const operations = getOperationsState();
  const session = typeof sessionOrRole === "object" ? normalizeSessionRecord(sessionOrRole) : normalizeSessionRecord({ role: sessionOrRole });
  const visible = {
    organisations: filterVisible(operations.organisations, session),
    branches: filterVisible(operations.branches, session),
    partyUsers: filterVisible(operations.partyUsers, session),
    teamMembers: filterVisible(operations.teamMembers, session),
    tasks: filterVisible(operations.tasks, session),
    reminders: filterVisible(operations.reminders, session),
    escalations: filterVisible(operations.escalations, session),
    commissionTimeline: filterVisible(operations.commissionTimeline, session),
    dealRooms: filterVisible(operations.dealRooms, session),
    servicePulse: filterVisible(operations.servicePulse, session),
    pilotAgents: filterVisible(operations.pilotControl.agents, session),
    pilotScenarios: filterVisible(operations.pilotControl.scenarios, session),
    pilotMessageLog: filterVisible(operations.pilotControl.messageLog, session),
    pilotIssueLog: filterVisible(operations.pilotControl.issueLog, session),
    agentNetworkDirectory: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.directory, session)
      : [],
    agentNetworkOutreachLog: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.outreachLog, session)
      : [],
    agentNetworkImportBatches: hasAnyPermission(session.role, ["agent_directory.view_all", "agent_directory.view_assigned"])
      ? filterVisible(operations.agentNetwork.importBatches, session)
      : [],
    queue: filterVisible(operations.whatsapp.queue, session),
    threads: filterVisible(operations.whatsapp.threads, session),
    feedbackLog: filterVisible(operations.whatsapp.feedbackLog, session),
    contactShareLog: filterVisible(operations.whatsapp.contactShareLog, session)
  };
  visible.leads = filterVisible(state.leads.map(withScopeDefaults), session);
  const queue = operations.whatsapp.queue || [];
  const visibleQueue = visible.queue || [];
  const deliveredToday = visibleQueue.filter((item) => item.status === "delivered").length;
  const queuedCount = visibleQueue.filter((item) => item.status === "queued").length;
  const awaitingApproval = visibleQueue.filter((item) => item.status === "awaiting_approval").length;
  const manualReady = visibleQueue.filter((item) => item.status === "manual_test_ready").length;
  const sendFailed = visibleQueue.filter((item) => item.status === "send_failed").length;
  const openTasks = visible.tasks.filter((task) => task.status === "open");
  const openEscalations = visible.escalations.length;
  const pendingReminders = visible.reminders.filter((item) => item.status !== "done").length;
  const rollups = buildScopedRollups(session, visible);
  const sourceToSale = buildSourceToSaleTracker(session, visible);
  const sellerDemandSnapshots = buildSellerDemandSnapshots(session, visible);
  const servicePulseRollups = buildServicePulseRollups(session, visible);
  const agentMatchingSignals = buildAgentMatchingSignals(session, visible, servicePulseRollups);
  const leadActionCentre = buildLeadActionCentre(session, visible, sourceToSale);
  const caseBrain = buildCaseBrainHub(session, visible, {
    sourceToSale,
    sellerDemandSnapshots,
    leadActionCentre,
    servicePulseRollups,
    agentMatchingSignals
  });
  const agentSuccessDesk = buildAgentSuccessDesk(session, visible, leadActionCentre, servicePulseRollups);
  const agentActionDigests = buildAgentActionDigests(session, visible, agentSuccessDesk, leadActionCentre, caseBrain);
  const financeControl = buildFinanceControlSnapshot(session, visible, leadActionCentre, agentSuccessDesk);
  const pilotControl = buildPilotControlSnapshot(session, visible);
  const agentNetworkDirectory = buildAgentNetworkDirectorySnapshot(session, visible);
  const scoredLeads = visible.leads.filter((lead) => Number.isFinite(Number(lead.leadQuality?.score)));
  const avgLeadScore = scoredLeads.length
    ? Math.round(scoredLeads.reduce((total, lead) => total + Number(lead.leadQuality?.score || 0), 0) / scoredLeads.length)
    : 0;
  const snapshot = {
    organisations: visible.organisations,
    branches: visible.branches,
    partyUsers: visible.partyUsers,
    leads: visible.leads,
    teamMembers: visible.teamMembers,
    tasks: visible.tasks,
    reminders: visible.reminders,
    escalations: visible.escalations,
    commissionTimeline: visible.commissionTimeline,
    dealRooms: visible.dealRooms,
    servicePulse: visible.servicePulse,
    rollups,
    sourceToSale,
    sellerDemandSnapshots,
    caseBrain,
    servicePulseRollups,
    agentMatchingSignals,
    leadActionCentre,
    agentSuccessDesk,
    agentActionDigests,
    financeControl,
    pilotControl,
    agentNetworkDirectory,
    accessScope: getSessionScope(session),
    identity: {
      role: session.role,
      userId: session.userId,
      name: session.name,
      agencyId: session.agencyId,
      branchId: session.branchId,
      provinceId: session.provinceId
    },
    whatsapp: {
      bridge: operations.whatsapp.bridge,
      queue: visible.queue,
      threads: visible.threads,
      feedbackLog: visible.feedbackLog,
      contactShareLog: visible.contactShareLog,
      metrics: {
        deliveredToday,
        queuedCount,
        awaitingApproval,
        manualReady,
        sendFailed,
        totalOutbox: visibleQueue.length
      }
    },
    metrics: {
      openTasks: openTasks.length,
      openEscalations,
      pendingReminders,
      totalLeads: getScopedAnalytics(session).totalLeads,
      avgLeadScore,
      hotLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "hot").length,
      warmLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "warm").length,
      nurtureLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "nurture").length,
      weakLeads: visible.leads.filter((lead) => lead.leadQuality?.band === "weak").length,
      sellerDemandSnapshots: sellerDemandSnapshots.length,
      caseBrainTotal: caseBrain.summary.totalCases,
      caseBrainHumanOverride: caseBrain.summary.humanOverride,
      caseBrainApprovals: caseBrain.summary.approvalNeeded,
      caseBrainValuationOffers: caseBrain.summary.valuationOffersReady,
      caseBrainSellerUpdates: caseBrain.summary.sellerUpdatesReady,
      caseBrainFeedbackRequests: caseBrain.summary.feedbackRequestsReady,
      caseBrainDealRoomSummaries: caseBrain.summary.dealRoomSummariesReady,
      caseBrainCommissionProtections: caseBrain.summary.commissionProtectionsNeeded,
      caseBrainPrincipalAlerts: caseBrain.summary.principalAlerts,
      caseBrainAgentMatches: caseBrain.summary.agentMatchesReady,
      servicePulseCount: servicePulseRollups.summary.total,
      avgServicePulse: servicePulseRollups.summary.avgScore,
      servicePulseRecovery: servicePulseRollups.summary.needsRecovery,
      quarterlyPrizeCandidates: servicePulseRollups.quarterlyPrizeCandidates.length,
      leadActions: leadActionCentre.summary.total,
      criticalLeadActions: leadActionCentre.summary.critical,
      agentSuccessOpenActions: agentSuccessDesk.summary.openActions,
      agentActionDigests: agentActionDigests.summary.total,
      agentDigestEmailMissing: agentActionDigests.summary.missingEmail,
      pilotAgents: pilotControl.metrics.totalAgents,
      pilotIssues: pilotControl.metrics.issues,
      pilotActive: pilotControl.metrics.active,
      agentNetworkRecords: agentNetworkDirectory.summary.total || 0,
      agentNetworkInviteReady: agentNetworkDirectory.summary.inviteReady || 0,
      agentNetworkNeedsVerification: agentNetworkDirectory.summary.needsVerification || 0,
      protectedDeals: visible.commissionTimeline.length,
      dealRooms: visible.dealRooms.length,
      budgetVsForecastGap: financeControl.forecast.variance,
      aiBudgetGap: financeControl.aiProjection.variance,
      sessionRole: session.role
    }
  };

  snapshot.aiValue = buildAiValueOpportunities(session, snapshot);
  return snapshot;
}

async function handleLeadCreate(request, response) {
  const body = await readBody(request, 2 * 1024 * 1024);
  const lead = createLeadRecord(body);
  state.leads.unshift(lead);
  const operations = getOperationsState();
  const ownerName = String(body?.acquisition?.owner || "").trim() || "Nadine Smit";
  const owner = findTeamMemberByName(ownerName);
  operations.tasks.unshift({
    id: createOpsId("task"),
    title: `${lead.leadQuality.handoffReady ? "Handoff" : "Qualify"} ${lead.label}`,
    caseName: lead.label,
    caseId: lead.id,
    ownerId: owner?.id || "admin-nadine",
    ownerName,
    role: owner?.role || "office_admin",
    category: "Lead intake",
    priority: "high",
    dueLabel: "Today",
    status: "open",
    nextAction: lead.leadQuality.conciergeAction,
    source: "Lead import"
  });
  const thread = ensureThread(lead.id, lead.label, [ownerName, lead.answerSummary["Client name"] || "Client"]);
  const clientAckBody = buildClientIntakeAcknowledgement(lead);
  const clientAckQueue =
    lead.contact?.mobile
      ? queueWhatsappMessage({
          caseId: lead.id,
          caseName: lead.label,
          threadId: thread.id,
          category: "public-intake-acknowledgement",
          toName: lead.briefCard?.clientName || lead.answerSummary["Client name"] || "Client",
          toRole: lead.intent === "sell" ? "seller" : "buyer",
          toContact: lead.contact.mobile,
          ownerName: "Axiom Concierge",
          body: clientAckBody,
          approvalRequired: false,
          agencyId: lead.agencyId,
          branchId: lead.branchId,
          provinceId: lead.provinceId,
          agentId: lead.agentId,
          assignedAgentId: lead.assignedAgentId
        })
      : null;
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    category: "public-intake-acknowledgement",
    body: clientAckQueue
      ? `Client acknowledgement queued for WhatsApp: ${clientAckBody}`
      : `Client acknowledgement prepared but no WhatsApp/mobile number was supplied: ${clientAckBody}`,
    at: nowIso(),
    status: clientAckQueue ? "queued" : "draft_stored"
  });
  const whatsappRuntime = getWhatsappRuntime();
  const clientAckDelivery = clientAckQueue ? await processWhatsappQueueItem(clientAckQueue, whatsappRuntime) : null;
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `${lead.label} was registered and assigned to ${ownerName}. Lead quality: ${lead.leadQuality.band} (${lead.leadQuality.score}/100). ${lead.briefCard.agentHandoffSummary}`,
    at: nowIso(),
    status: "logged"
  });
  if (lead.intent === "sell") {
    const sellerSnapshot = buildSellerDemandSnapshots("principal", { leads: [lead], tasks: [], dealRooms: [], threads: [], feedbackLog: [] })[0];
    if (sellerSnapshot) {
      addThreadMessage(thread, {
        id: createOpsId("wa"),
        direction: "system",
        author: "Axiom",
        category: "seller-demand-snapshot",
        body: `Gentle seller demand snapshot prepared and stored. ${sellerSnapshot.sellerMessageDraft}`,
        at: nowIso(),
        status: "draft_stored",
        learningSignals: sellerSnapshot.learningSignals,
        approvalRequired: true
      });
    }
  }
  const conciergeDraft = await generateConciergeDraft({
    purpose: lead.leadQuality.handoffReady
      ? "Draft the first concise WhatsApp handover note to the assigned estate agent."
      : "Draft the next concise concierge WhatsApp question to complete the missing lead brief.",
    audience: lead.leadQuality.handoffReady ? "assigned estate agent" : "property client",
    fallback: buildLeadWhatsappDraft(lead, {
      ownerName,
      missingItems: lead.leadQuality.missingItems || [],
      commissionProtected: false,
      dealRoomNeeded: false,
      serviceRecoveryNeeded: false,
      nextBestAction: lead.leadQuality.conciergeAction
    }),
    context: {
      leadId: lead.id,
      caseName: lead.label,
      intent: lead.intent,
      leadQuality: lead.leadQuality,
      briefCard: lead.briefCard,
      answerSummary: lead.answerSummary,
      humanApprovalRequired: true
    }
  });
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: conciergeDraft.usedLiveLlm ? "Axiom AI" : "Axiom",
    category: "ai-concierge-draft",
    body: conciergeDraft.text,
    at: nowIso(),
    status: "draft_stored",
    approvalRequired: true,
    llm: conciergeDraft.status
  });
  audit("lead-created", { leadId: lead.id, intent: lead.intent, label: lead.label, leadQuality: lead.leadQuality.band, source: normalizeLeadSource(lead) });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    sessionId: lead.id,
    leadId: lead.id,
    caseId: lead.id,
    delivered: false,
    queuedForManualHandoff: true,
    reason: "Lead stored, assigned, and moved into the admin action queue.",
    whatsapp: {
      mode: config.whatsappMode,
      provider: whatsappRuntime.provider,
      realDeliveryConnected: whatsappRuntime.liveDeliveryConnected,
      acknowledgementQueued: Boolean(clientAckQueue),
      acknowledgementStatus: clientAckDelivery?.status || clientAckQueue?.status || "draft_stored",
      acknowledgementDeliveryMode: clientAckDelivery?.deliveryMode || clientAckQueue?.deliveryMode || "not_available",
      acknowledgementText: clientAckBody,
      manualTestLink: clientAckDelivery?.manualLink || clientAckQueue?.manualLink || buildWhatsappClickLink(lead.contact?.mobile, clientAckBody),
      note:
        clientAckDelivery?.status === "delivered"
          ? "WhatsApp acknowledgement was delivered through the connected provider."
          : clientAckDelivery?.status === "manual_test_ready"
            ? "WhatsApp is in managed simulation. The message is stored and ready as a manual test link."
            : clientAckDelivery?.error || whatsappRuntime.status
    },
    leadQuality: lead.leadQuality,
    briefCard: lead.briefCard,
    publicOutcome: buildPublicIntakeOutcome(lead),
    sourceToSale: {
      sourceKey: normalizeLeadSource(lead),
      sourceLabel: sourceLabelForKey(normalizeLeadSource(lead)),
      currentStage: "registered"
    },
    analytics: getAnalytics()
  });
}

async function handleProtectCommission(request, response) {
  const session = requirePermission(request, response, ["commission.protect", "commission.view_all", "commission.view_assigned"]);
  if (!session) return;

  const body = await readBody(request);
  const caseName = String(body.caseName || "").trim();
  const split = String(body.split || "").trim();
  const agent = String(body.agent || "").trim();

  if (!caseName || !split || !agent) {
    sendJson(response, 400, { ok: false, error: "Case name, agent, and split are required." });
    return;
  }

  const operations = getOperationsState();
  const entry = createCommissionTimelineEntry(body);
  operations.commissionTimeline.unshift(entry);
  const thread = ensureThread(entry.caseId, entry.caseName, [agent, "Axiom"]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `Commission protection logged for ${entry.caseName}. ${entry.split}, due ${entry.dueDate}.`,
    at: nowIso(),
    status: "logged"
  });
  audit("commission-protected", {
    caseId: entry.caseId,
    caseName: entry.caseName,
    agent: entry.agent,
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, item: entry, snapshot: buildOperationsSnapshot(session) });
}

async function handleDealRoomShare(request, response) {
  const session = requirePermission(request, response, "dealroom.share");
  if (!session) return;

  const body = await readBody(request);
  const caseName = String(body.caseName || "").trim();
  const clientName = String(body.clientName || "").trim();
  const accessCode = String(body.accessCode || "").trim();
  const roomId = String(body.roomId || body.room || "").trim();

  if (!caseName || !clientName || !accessCode || !roomId) {
    sendJson(response, 400, { ok: false, error: "Case name, client name, room ID, and access code are required." });
    return;
  }

  const operations = getOperationsState();
  const record = createDealRoomRecord(body, request);
  operations.dealRooms = operations.dealRooms.filter((entry) => entry.roomId !== record.roomId);
  operations.dealRooms.unshift(record);
  const thread = ensureThread(record.caseId, record.caseName, [clientName, "Axiom"]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `Deal Room ${record.roomId} prepared for ${clientName}.`,
    at: nowIso(),
    status: "logged"
  });
  audit("deal-room-shared", {
    roomId: record.roomId,
    caseId: record.caseId,
    caseName: record.caseName,
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, room: record, snapshot: buildOperationsSnapshot(session) });
}

async function handlePublicDealRoomAccess(request, response) {
  const body = await readBody(request);
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const accessCode = String(body.accessCode || "").trim();

  if (!roomId || !accessCode) {
    sendJson(response, 400, { ok: false, error: "Room ID and access code are required." });
    return;
  }

  const operations = getOperationsState();
  const room = operations.dealRooms.find((entry) => entry.roomId === roomId);
  if (!room || !safeEquals(room.accessCode, accessCode)) {
    audit("deal-room-access-failed", { roomId });
    sendJson(response, 401, { ok: false, error: "That access code does not match this Deal Room." });
    return;
  }

  audit("deal-room-accessed", { roomId, caseId: room.caseId });
  sendJson(response, 200, {
    ok: true,
    room: {
      roomId: room.roomId,
      caseName: room.caseName,
      clientName: room.clientName,
      stage: room.stage,
      progress: room.progress,
      nextStep: room.nextStep,
      shareMessage: room.shareMessage,
      updatedAt: room.updatedAt
    }
  });
}

async function handlePublicServicePulse(request, response) {
  const body = await readBody(request);
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const accessCode = String(body.accessCode || "").trim();
  const score = normalizeServicePulseScore(body.score);

  if (!roomId || !accessCode) {
    sendJson(response, 400, { ok: false, error: "Room ID and access code are required." });
    return;
  }
  if (!score) {
    sendJson(response, 400, { ok: false, error: "Please provide a score from 1 to 10." });
    return;
  }

  const operations = getOperationsState();
  const room = operations.dealRooms.find((entry) => entry.roomId === roomId);
  if (!room || !safeEquals(room.accessCode, accessCode)) {
    audit("service-pulse-access-failed", { roomId });
    sendJson(response, 401, { ok: false, error: "That access code does not match this Deal Room." });
    return;
  }

  const record = createServicePulseRecord(
    {
      ...body,
      score,
      roomId,
      caseId: room.caseId,
      caseName: room.caseName,
      clientName: body.respondentName || room.clientName,
      source: body.source || "deal_room"
    },
    room
  );
  operations.servicePulse.unshift(record);
  storeServicePulseCommunication(record);
  audit("service-pulse-captured", {
    caseId: record.caseId,
    roomId,
    score: record.score,
    sentiment: record.sentiment,
    respondentRole: record.respondentRole
  });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    servicePulse: {
      id: record.id,
      caseName: record.caseName,
      touchpoint: record.touchpointLabel,
      score: record.score,
      sentiment: record.sentiment,
      stored: true
    }
  });
}

async function handleServicePulseCapture(request, response) {
  const session = requirePermission(request, response, [
    "service_pulse.capture",
    "service_pulse.view_all",
    "service_pulse.view_assigned",
    "scorecards.view_all",
    "scorecards.view_self"
  ]);
  if (!session) return;

  const body = await readBody(request);
  const score = normalizeServicePulseScore(body.score);
  if (!score) {
    sendJson(response, 400, { ok: false, error: "Please provide a score from 1 to 10." });
    return;
  }

  const operations = getOperationsState();
  const roomId = String(body.roomId || body.room || "").trim().toUpperCase();
  const room = roomId ? operations.dealRooms.find((entry) => entry.roomId === roomId) : null;
  const record = createServicePulseRecord({ ...body, score, roomId }, room || {});
  if (!recordVisibleToScope(record, session)) {
    sendJson(response, 403, { ok: false, error: "This service pulse is outside your assigned scope." });
    return;
  }

  operations.servicePulse.unshift(record);
  storeServicePulseCommunication(record);
  audit("service-pulse-captured", {
    caseId: record.caseId,
    score: record.score,
    sentiment: record.sentiment,
    role: session.role,
    capturedBy: session.name
  });
  await persistState();
  sendJson(response, 200, { ok: true, item: record, snapshot: buildOperationsSnapshot(session) });
}

async function handlePilotControlAction(request, response) {
  const session = requirePermission(request, response, ["pilot.manage", "pilot.view_all"]);
  if (!session) return;

  const body = await readBody(request);
  const action = slugify(body.action || "").replace(/-/g, "_");
  const operations = getOperationsState();
  const control = getPilotControlState();
  const agent = findPilotAgent(control, body.agentId);
  const scenario = findPilotScenario(control, body.scenarioId);
  const createdAt = nowIso();

  if (!agent) {
    sendJson(response, 400, { ok: false, error: "Pilot agent is required." });
    return;
  }
  if (!recordVisibleToScope(agent, session)) {
    sendJson(response, 403, { ok: false, error: "This pilot agent is outside your assigned scope." });
    return;
  }

  let result = null;

  if (action === "queue_scenario") {
    if (!scenario) {
      sendJson(response, 400, { ok: false, error: "Pilot scenario is required." });
      return;
    }
    const bodyText = buildPilotMessageBody(agent, scenario);
    const queued = queueWhatsappMessage({
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      caseName: `Pilot test - ${agent.agentName}`,
      category: "pilot-scenario",
      toName: agent.agentName,
      toRole: "agent",
      toContact: agent.whatsappNumber || agent.mobile || "",
      ownerName: session.name || "Axiom",
      body: bodyText,
      scheduledFor: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId,
      agentId: agent.agentId,
      assignedAgentId: agent.assignedAgentId || agent.agentId
    });
    agent.status = agent.status === "paused" ? "paused" : "active";
    agent.readiness = agent.readiness || "opted_in";
    agent.currentScenarioId = scenario.id;
    agent.nextTest = scenario.title;
    agent.lastScenarioAt = createdAt;
    const logItem = withScopeDefaults({
      id: createOpsId("pilot-msg"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      messageId: queued.id,
      status: "queued",
      channel: scenario.channel || "WhatsApp",
      body: bodyText,
      queuedAt: createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.messageLog.unshift(logItem);
    result = { queued, logItem };
  } else if (action === "mark_passed") {
    if (!scenario) {
      sendJson(response, 400, { ok: false, error: "Pilot scenario is required." });
      return;
    }
    const passed = unique([...(agent.scenariosPassed || []), scenario.id]);
    agent.scenariosPassed = passed;
    agent.currentScenarioId = scenario.id;
    agent.status = passed.length >= control.scenarios.length ? "passed" : "active";
    agent.readiness = "validated";
    agent.lastScenarioAt = createdAt;
    const logItem = withScopeDefaults({
      id: createOpsId("pilot-pass"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      status: "passed",
      channel: scenario.channel || "WhatsApp",
      body: `${agent.agentName} passed pilot scenario: ${scenario.title}.`,
      queuedAt: createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.messageLog.unshift(logItem);
    result = { logItem };
  } else if (action === "update_status") {
    agent.status = normalizePilotStatus(body.status);
    agent.readiness = String(body.readiness || agent.readiness || agent.status).trim();
    agent.updatedAt = createdAt;
    result = { agent };
  } else if (action === "log_issue") {
    const issueSummary = String(body.summary || body.issue || "").trim();
    if (!issueSummary) {
      sendJson(response, 400, { ok: false, error: "Issue summary is required." });
      return;
    }
    const issue = withScopeDefaults({
      id: createOpsId("pilot-issue"),
      caseId: agent.caseId || `pilot-agent-${agent.agentId}`,
      agentId: agent.agentId,
      assignedAgentId: agent.agentId,
      agentName: agent.agentName,
      scenarioId: scenario?.id || agent.currentScenarioId || "",
      scenarioTitle: scenario?.title || agent.nextTest || "Pilot scenario",
      severity: String(body.severity || "medium").trim(),
      summary: issueSummary,
      status: "open",
      ownerName: session.name || "Axiom",
      createdAt,
      updatedAt: createdAt,
      agencyId: agent.agencyId,
      branchId: agent.branchId,
      provinceId: agent.provinceId
    });
    control.issueLog.unshift(issue);
    agent.status = "issue";
    agent.issueCount = Number(agent.issueCount || 0) + 1;
    agent.updatedAt = createdAt;
    const thread = ensureThread(issue.caseId, `Pilot test - ${agent.agentName}`, [agent.agentName, session.name || "Axiom"]);
    addThreadMessage(thread, {
      id: createOpsId("wa"),
      direction: "system",
      author: "Axiom",
      category: "pilot-issue",
      body: `Pilot issue logged for ${agent.agentName}: ${issue.summary}`,
      at: createdAt,
      status: "logged"
    });
    result = { issue };
  } else {
    sendJson(response, 400, { ok: false, error: "Unknown pilot action." });
    return;
  }

  operations.whatsapp.bridge.lastHeartbeatAt = createdAt;
  audit("pilot-control-action", {
    action,
    agentId: agent.agentId,
    scenarioId: scenario?.id || "",
    role: session.role
  });
  await persistState();
  sendJson(response, 200, { ok: true, result, snapshot: buildOperationsSnapshot(session) });
}

function findAgentNetworkRecord(directory, recordId) {
  const id = String(recordId || "").trim();
  return directory.find((record) => {
    return (
      record.id === id ||
      record.contact?.email === normalizeEmail(id) ||
      record.contact?.whatsapp === id ||
      record.contact?.mobile === id ||
      record.agentName === id
    );
  }) || null;
}

function findAgentNetworkDuplicate(directory, candidate) {
  const email = candidate.contact?.email;
  const whatsapp = candidate.contact?.whatsapp;
  const sourceUrl = candidate.source?.url;
  return directory.find((record) => {
    if (email && record.contact?.email === email) return true;
    if (whatsapp && record.contact?.whatsapp === whatsapp) return true;
    if (sourceUrl && record.source?.url === sourceUrl) return true;
    return false;
  }) || null;
}

function mergeAgentNetworkRecord(existing, candidate) {
  const merged = normalizeAgentNetworkRecord({
    ...existing,
    ...candidate,
    contact: { ...(existing.contact || {}), ...(candidate.contact || {}) },
    source: { ...(existing.source || {}), ...(candidate.source || {}) },
    consent: { ...(existing.consent || {}), ...(candidate.consent || {}) },
    verification: { ...(existing.verification || {}), ...(candidate.verification || {}) },
    outreach: { ...(existing.outreach || {}), ...(candidate.outreach || {}) },
    matchingSignals: { ...(existing.matchingSignals || {}), ...(candidate.matchingSignals || {}) },
    towns: unique([...(existing.towns || []), ...(candidate.towns || [])]),
    suburbs: unique([...(existing.suburbs || []), ...(candidate.suburbs || [])]),
    specialties: unique([...(existing.specialties || []), ...(candidate.specialties || [])]),
    languages: unique([...(existing.languages || []), ...(candidate.languages || [])]),
    updatedAt: nowIso()
  });
  Object.keys(existing).forEach((key) => delete existing[key]);
  Object.assign(existing, merged);
  return existing;
}

function upsertAgentNetworkRecord(directory, payload, session) {
  const candidate = normalizeAgentNetworkRecord({
    ...payload,
    source: {
      ...(payload.source || {}),
      capturedBy: payload.source?.capturedBy || session.name || "Axiom"
    }
  });
  const duplicate = findAgentNetworkDuplicate(directory, candidate);
  if (duplicate) {
    return { record: mergeAgentNetworkRecord(duplicate, candidate), created: false };
  }
  directory.unshift(candidate);
  return { record: candidate, created: true };
}

function agentNetworkActionAllowed(session, permissions = []) {
  return hasAnyPermission(session.role, permissions);
}

async function handleAgentNetworkSnapshot(request, response) {
  const session = requirePermission(request, response, ["agent_directory.view_all", "agent_directory.view_assigned"]);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    agentNetworkDirectory: buildAgentNetworkDirectorySnapshot(session)
  });
}

async function handleAgentNetworkAction(request, response) {
  const session = requirePermission(request, response, ["agent_directory.manage", "agent_directory.outreach"]);
  if (!session) return;

  const body = await readBody(request, 2 * 1024 * 1024);
  const action = String(body.action || "").trim().toLowerCase();
  const operations = getOperationsState();
  const directory = operations.agentNetwork.directory;
  const createdAt = nowIso();
  let result = {};

  if (action === "add_record") {
    if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
      sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
      return;
    }
    const payload = body.record && typeof body.record === "object" ? body.record : body;
    const upsert = upsertAgentNetworkRecord(directory, payload, session);
    result = { record: computeAgentNetworkRecord(upsert.record), created: upsert.created };
    audit("agent-network-record-upserted", { id: upsert.record.id, created: upsert.created, role: session.role });
  } else if (action === "import_batch") {
    if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
      sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
      return;
    }
    const records = Array.isArray(body.records) ? body.records.slice(0, 200) : [];
    if (!records.length) {
      sendJson(response, 400, { ok: false, error: "Import batch requires at least one record." });
      return;
    }
    let createdCount = 0;
    let updatedCount = 0;
    records.forEach((record) => {
      const upsert = upsertAgentNetworkRecord(directory, {
        ...record,
        source: {
          ...(record.source || {}),
          type: record.source?.type || body.sourceType || "public_domain",
          name: record.source?.name || body.sourceName || "Public source",
          capturedAt: createdAt
        }
      }, session);
      if (upsert.created) createdCount += 1;
      else updatedCount += 1;
    });
    const batch = withScopeDefaults({
      id: createOpsId("network-batch"),
      caseId: `agent-network-${slugify(body.name || "batch") || randomBytes(2).toString("hex")}`,
      name: String(body.name || "Agent network import").trim(),
      sourceType: String(body.sourceType || "public_domain").trim(),
      recordCount: records.length,
      acceptedCount: records.length,
      rejectedCount: 0,
      createdCount,
      updatedCount,
      createdAt,
      ownerName: session.name,
      agencyId: session.agencyId,
      branchId: session.branchId,
      provinceId: session.provinceId
    });
    operations.agentNetwork.importBatches.unshift(batch);
    result = { batch, createdCount, updatedCount };
    audit("agent-network-batch-imported", { count: records.length, createdCount, updatedCount, role: session.role });
  } else {
    const record = findAgentNetworkRecord(directory, body.recordId);
    if (!record) {
      sendJson(response, 404, { ok: false, error: "Agent network record not found." });
      return;
    }

    if (action === "mark_verified") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
        return;
      }
      record.verification = {
        ...(record.verification || {}),
        status: normalizeVerificationStatus(body.status || "verified", "verified"),
        lastVerifiedAt: createdAt,
        verifiedBy: session.name || session.role,
        reviewNote: String(body.reviewNote || "Source and contact details reviewed.").trim()
      };
      record.updatedAt = createdAt;
      result = { record: computeAgentNetworkRecord(record) };
      audit("agent-network-record-verified", { id: record.id, status: record.verification.status, role: session.role });
    } else if (action === "update_consent" || action === "set_no_contact") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory manage permission is required." });
        return;
      }
      const doNotContact = action === "set_no_contact" ? true : Boolean(body.doNotContact ?? record.consent?.doNotContact);
      record.consent = {
        ...(record.consent || {}),
        emailStatus: normalizeConsentStatus(body.emailStatus || record.consent?.emailStatus),
        whatsappStatus: normalizeConsentStatus(body.whatsappStatus || record.consent?.whatsappStatus),
        doNotContact,
        optOutAt: doNotContact ? createdAt : body.optOutAt || record.consent?.optOutAt || "",
        optOutReason: String(body.reason || body.optOutReason || record.consent?.optOutReason || "").trim(),
        lawfulUseNote: String(body.lawfulUseNote || record.consent?.lawfulUseNote || "").trim()
      };
      record.updatedAt = createdAt;
      result = { record: computeAgentNetworkRecord(record) };
      audit("agent-network-consent-updated", { id: record.id, doNotContact, role: session.role });
    } else if (action === "log_outreach") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.outreach"])) {
        sendJson(response, 403, { ok: false, error: "Directory outreach permission is required." });
        return;
      }
      const view = computeAgentNetworkRecord(record);
      const queueMessage = Boolean(body.queueMessage);
      if (queueMessage && !view.outreachAllowed) {
        sendJson(response, 409, { ok: false, error: `This record is ${view.complianceStatus}. Verify or update consent before queuing outreach.` });
        return;
      }
      const channel = String(body.channel || (view.hasWhatsapp ? "WhatsApp" : view.hasEmail ? "Email" : "Manual")).trim();
      const entry = withScopeDefaults({
        id: createOpsId("network-outreach"),
        caseId: `agent-network-${record.id}`,
        recordId: record.id,
        agentName: record.agentName,
        agencyName: record.agencyName,
        channel,
        purpose: String(body.purpose || "pilot_invitation").trim(),
        status: queueMessage ? "queued_for_approval" : String(body.status || "logged").trim(),
        note: String(body.note || body.message || "").trim(),
        ownerName: session.name || session.role,
        createdAt,
        agencyId: record.agencyId,
        branchId: record.branchId,
        provinceId: record.provinceId
      });
      operations.agentNetwork.outreachLog.unshift(entry);
      record.outreach = {
        ...(record.outreach || {}),
        status: entry.status,
        count: Number(record.outreach?.count || 0) + 1,
        lastContactedAt: createdAt,
        lastChannel: channel
      };
      record.updatedAt = createdAt;
      let queued = null;
      if (queueMessage) {
        queued = queueWhatsappMessage({
          caseId: entry.caseId,
          caseName: `Agent Network - ${record.agentName}`,
          category: "agent-network-invite",
          toName: record.agentName,
          toRole: "external_agent",
          toContact: record.contact?.whatsapp || record.contact?.mobile || record.mobile || "",
          ownerName: session.name || "Axiom",
          body: String(body.message || `Hi ${record.agentName}. Axiom is building a controlled estate-agent pilot in ${record.province}. Would you be open to a short WhatsApp introduction? Reply STOP if you prefer not to be contacted.`).trim(),
          approvalRequired: true,
          agencyId: record.agencyId,
          branchId: record.branchId,
          provinceId: record.provinceId
        });
      }
      result = { entry, queued, record: computeAgentNetworkRecord(record) };
      audit("agent-network-outreach-logged", { id: record.id, channel, queued: Boolean(queued), role: session.role });
    } else if (action === "promote_to_pilot") {
      if (!agentNetworkActionAllowed(session, ["agent_directory.outreach", "pilot.manage"])) {
        sendJson(response, 403, { ok: false, error: "Directory outreach permission is required." });
        return;
      }
      const view = computeAgentNetworkRecord(record);
      if (!view.pilotInviteReady && !body.override) {
        sendJson(response, 409, { ok: false, error: `Pilot invite is not ready yet: ${view.nextAction}` });
        return;
      }
      const control = getPilotControlState();
      const pilotAgentId = `pilot-${slugify(record.agentName) || randomBytes(2).toString("hex")}`;
      let pilot = control.agents.find((agent) => agent.sourceRecordId === record.id || agent.agentName === record.agentName);
      if (!pilot) {
        pilot = withScopeDefaults({
          id: pilotAgentId,
          caseId: `pilot-${record.id}`,
          sourceRecordId: record.id,
          agentId: record.id,
          assignedAgentId: record.id,
          agentName: record.agentName,
          agencyName: record.agencyName,
          branchId: record.branchId,
          provinceId: record.provinceId,
          whatsappNumber: record.contact?.whatsapp || record.contact?.mobile || "",
          status: "invited",
          readiness: "awaiting_opt_in",
          scenariosPassed: [],
          currentScenarioId: "scenario-seller-lead",
          nextTest: "Confirm opt-in, then run a controlled seller-lead scenario.",
          issueCount: 0,
          lastScenarioAt: "",
          notes: "Promoted from Agent Network Directory."
        });
        control.agents.unshift(pilot);
      }
      record.outreach = {
        ...(record.outreach || {}),
        pilotStatus: "invited",
        status: "pilot_invited"
      };
      record.updatedAt = createdAt;
      result = { pilot, record: computeAgentNetworkRecord(record) };
      audit("agent-network-promoted-to-pilot", { id: record.id, pilotId: pilot.id, role: session.role });
    } else {
      sendJson(response, 400, { ok: false, error: "Unknown agent network action." });
      return;
    }
  }

  await persistState();
  sendJson(response, 200, {
    ok: true,
    result,
    agentNetworkDirectory: buildAgentNetworkDirectorySnapshot(session),
    snapshot: buildOperationsSnapshot(session)
  });
}

function handleAnalytics(request, response) {
  const session = requirePermission(request, response, ["analytics.view_all", "analytics.view_self"]);
  if (!session) return;
  sendJson(response, 200, { ok: true, analytics: getScopedAnalytics(session), role: session.role });
}

function handleAppStatus(_request, response) {
  const whatsapp = getWhatsappRuntime();
  const otp = getOtpRuntime(whatsapp);
  const email = getEmailRuntime();
  sendJson(response, 200, {
    ok: true,
    service: "axiom-realty-ai-backend",
    version: config.appVersion,
    environment: config.environment,
    runtime: config.isRenderRuntime ? "render" : "local",
    whatsappMode: whatsapp.mode,
    whatsappProvider: whatsapp.provider,
    whatsappRealDeliveryConnected: whatsapp.liveDeliveryConnected,
    whatsappManualTestReady: whatsapp.manualTestReady,
    whatsappMissing: whatsapp.missing,
    whatsappStatus: whatsapp.status,
    otpProvider: otp.provider,
    otpPreviewEnabled: otp.previewEnabled,
    otpLiveDeliveryConnected: otp.liveDeliveryConnected,
    otpStatus: otp.status,
    emailProvider: email.provider,
    emailLiveDeliveryConnected: email.liveDeliveryConnected,
    emailStatus: email.status,
    operationalReadiness: getOperationalReadiness(),
    checkedAt: new Date().toISOString()
  });
}

function handleSystemStatus(request, response) {
  const session = requirePermission(request, response, "system.view");
  if (!session) return;
  Promise.resolve()
    .then(async () => {
      const store = await ensureStorage();
      const storageDiagnostics = await store.diagnostics();
      const whatsapp = getWhatsappRuntime();
      const otp = getOtpRuntime(whatsapp);
      sendJson(response, 200, {
        ok: true,
        role: session.role,
        diagnostics: {
          uptimeSeconds: Math.round(process.uptime()),
          leadsStored: state.leads.length,
          activeSessions: state.sessions.length,
          deployment: {
            runtime: config.isRenderRuntime ? "render" : "local",
            hostBinding: config.host,
            port: config.port,
            publicBaseUrl: config.publicBaseUrl || null,
            cookieSecure: config.cookieSecure,
            otpPreviewEnabled: config.otpPreviewEnabled,
            accessKeyFallbackEnabled: true,
            accessKeySources: config.accessKeySources
          },
          storage: storageDiagnostics,
          whatsapp: {
            mode: getOperationsState().whatsapp.bridge.mode,
            provider: whatsapp.provider,
            connected: whatsapp.liveDeliveryConnected,
            manualTestReady: whatsapp.manualTestReady,
            missing: whatsapp.missing,
            status: whatsapp.status,
            queued: getOperationsState().whatsapp.queue.filter((item) => item.status === "queued").length,
            awaitingApproval: getOperationsState().whatsapp.queue.filter((item) => item.status === "awaiting_approval").length,
            manualTestReadyCount: getOperationsState().whatsapp.queue.filter((item) => item.status === "manual_test_ready").length,
            failed: getOperationsState().whatsapp.queue.filter((item) => item.status === "send_failed").length
          },
          otp: {
            provider: otp.provider,
            previewEnabled: otp.previewEnabled,
            liveDeliveryConnected: otp.liveDeliveryConnected,
            missing: otp.missing,
            status: otp.status
          },
          agentNetwork: {
            directoryRecords: getOperationsState().agentNetwork.directory.length,
            outreachLog: getOperationsState().agentNetwork.outreachLog.length,
            importBatches: getOperationsState().agentNetwork.importBatches.length
          },
          llm: getLlmStatus(),
          readiness: getOperationalReadiness(storageDiagnostics)
        }
      });
    })
    .catch((error) => {
      sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Storage diagnostics failed." });
    });
}

function buildStateReportingSnapshot(session) {
  const snapshot = buildOperationsSnapshot(session);
  const metrics = snapshot.metrics || {};
  const sourceToSale = snapshot.sourceToSale || {};
  const servicePulse = snapshot.servicePulseRollups || { summary: {}, byAgent: [] };

  return {
    mode: "state",
    available: true,
    source: "scoped operations snapshot",
    generatedAt: new Date().toISOString(),
    scope: getSessionScope(session),
    totals: {
      leads: metrics.totalLeads || snapshot.leads?.length || 0,
      cases: metrics.caseBrainTotal || snapshot.dealRooms?.length || 0,
      tasks: metrics.openTasks || 0,
      reminders: metrics.pendingReminders || 0,
      escalations: metrics.openEscalations || 0,
      commissionItems: metrics.protectedDeals || 0,
      dealRooms: metrics.dealRooms || 0,
      communications: snapshot.whatsapp?.queue?.length || 0,
      servicePulse: metrics.servicePulseCount || 0,
      agentNetworkRecords: metrics.agentNetworkRecords || 0
    },
    momentum: {
      leads7d: sourceToSale.summary?.newLeads7d || 0
    },
    rollups: {
      national: {
        label: "Current scope",
        leads: metrics.totalLeads || 0,
        cases: metrics.caseBrainTotal || 0,
        openTasks: metrics.openTasks || 0,
        protectedDeals: metrics.protectedDeals || 0,
        avgServiceScore: servicePulse.summary?.avgScore || 0,
        recoveryItems: servicePulse.summary?.needsRecovery || 0
      },
      agencies: Object.entries(snapshot.rollups?.agencies || {}).map(([label, count]) => ({ label, leads: count })),
      branches: Object.entries(snapshot.rollups?.branches || {}).map(([label, count]) => ({ label, leads: count })),
      provinces: Object.entries(snapshot.rollups?.provinces || {}).map(([label, count]) => ({ label, leads: count })),
      agents: (servicePulse.byAgent || []).map((agent) => ({
        id: agent.agentId || agent.agentName,
        label: agent.agentName,
        leads: 0,
        cases: 0,
        avgServiceScore: agent.avgScore,
        recoveryItems: agent.needsRecovery
      }))
    },
    pipeline: {
      sourceToSale: sourceToSale.bySource || []
    },
    protection: {
      total: metrics.protectedDeals || 0,
      attention: metrics.caseBrainCommissionProtections || 0
    },
    communications: {
      total: snapshot.whatsapp?.queue?.length || 0,
      queued: snapshot.whatsapp?.metrics?.queuedCount || 0,
      awaitingApproval: snapshot.whatsapp?.metrics?.awaitingApproval || 0,
      delivered: snapshot.whatsapp?.metrics?.deliveredToday || 0
    },
    servicePulse: {
      total: servicePulse.summary?.total || 0,
      avgScore: servicePulse.summary?.avgScore || 0,
      recovery: servicePulse.summary?.needsRecovery || 0,
      byAgent: servicePulse.byAgent || []
    }
  };
}

function handleReportingSnapshot(request, response) {
  const session = requirePermission(request, response, ["rollups.view_all", "rollups.view_assigned", "analytics.view_all"]);
  if (!session) return;

  Promise.resolve()
    .then(async () => {
      const store = await ensureStorage();
      const reporting = typeof store.reportingSnapshot === "function"
        ? await store.reportingSnapshot({ session, scope: getSessionScope(session) })
        : buildStateReportingSnapshot(session);

      sendJson(response, 200, {
        ok: true,
        role: session.role,
        identity: {
          role: session.role,
          userId: session.userId,
          name: session.name,
          agencyId: session.agencyId,
          branchId: session.branchId,
          provinceId: session.provinceId
        },
        scope: getSessionScope(session),
        reporting: reporting?.available === false ? buildStateReportingSnapshot(session) : reporting
      });
    })
    .catch((error) => {
      sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Reporting snapshot failed." });
    });
}

function createPrincipalOnboardingRecord(payload = {}, session = {}) {
  const createdAt = nowIso();
  const agencyName = String(payload.agencyName || payload.agency || "Agency to confirm").trim();
  const branchName = String(payload.branchName || payload.branch || payload.town || "Main branch").trim();
  const provinceId = normalizeProvinceId(payload.province || payload.provinceId || "north-west");
  const province = formatProvinceLabel(provinceId);
  const town = String(payload.town || branchName).trim();
  const principalName = String(payload.principalName || payload.name || "Principal to confirm").trim();
  const principalEmail = normalizeEmail(payload.principalEmail || payload.email);
  const principalMobile = normalizeContactNumber(payload.principalMobile || payload.mobile || payload.whatsapp);
  const principalContact = normalizeSigninContact(principalEmail || principalMobile);
  const agencyId = String(payload.agencyId || `agency-${slugify(agencyName)}`).trim();
  const branchId = String(payload.branchId || `branch-${slugify(agencyName)}-${slugify(branchName)}`).trim();
  const principalId = String(payload.principalId || `principal-${slugify(principalName)}-${slugify(agencyName)}`).trim();
  const agentSeats = Math.max(0, Number(payload.agentSeats || payload.agentCount || 0));
  const adminSeats = Math.max(0, Number(payload.adminSeats || payload.adminCount || 0));
  const packageLabel = String(payload.packageLabel || payload.package || "Axiom agent operating system").trim();
  const scope = {
    allAccess: false,
    agencyIds: [agencyId],
    branchIds: [branchId],
    provinceIds: [provinceId],
    agentIds: [],
    caseIds: []
  };

  if (!principalContact) {
    throw new Error("Principal email or mobile is required before access can be created.");
  }

  return {
    createdAt,
    agency: {
      id: agencyId,
      name: agencyName,
      provinceIds: [provinceId],
      branchIds: [branchId],
      status: "onboarding",
      onboarding: {
        signedUpAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        createdBy: session.name || session.userId || "Axiom"
      }
    },
    branch: {
      id: branchId,
      agencyId,
      name: branchName,
      town,
      provinceId,
      province,
      adminIds: [],
      agentIds: [],
      status: "onboarding"
    },
    principal: {
      id: principalId,
      name: principalName,
      role: "principal",
      agencyId,
      branchId,
      provinceId,
      scope,
      lane: `${branchName} / principal`,
      contact: principalContact,
      email: principalEmail,
      mobile: principalMobile,
      whatsapp: principalMobile,
      status: "invited",
      onboarding: {
        invitedAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        firstLogin: "OTP required",
        nextStep: "Principal signs in, confirms branch setup, then adds admins and agents."
      },
      responsibilities: [
        "Approve branch setup",
        "Invite office admin and agents",
        "Review agency, branch, province and agent rollups"
      ]
    }
  };
}

function isPartyRole(role) {
  return ["buyer", "seller", "attorney", "bond_originator"].includes(normalizeRole(role));
}

function roleOnboardingName(payload = {}, role = "principal") {
  return String(
    payload.personName ||
      payload.principalName ||
      payload.agentName ||
      payload.adminName ||
      payload.clientName ||
      payload.name ||
      `${getRoleProfile(role).label} to confirm`
  ).trim();
}

function roleOnboardingContact(payload = {}) {
  const email = normalizeEmail(
    payload.email ||
      payload.principalEmail ||
      payload.agentEmail ||
      payload.adminEmail ||
      payload.clientEmail
  );
  const mobile = normalizeContactNumber(
    payload.mobile ||
      payload.whatsapp ||
      payload.phone ||
      payload.principalMobile ||
      payload.agentMobile ||
      payload.adminMobile ||
      payload.clientMobile
  );
  return {
    email,
    mobile,
    contact: normalizeSigninContact(email || mobile)
  };
}

function truthyConsent(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return value === true || ["1", "true", "yes", "y", "on", "consent", "agreed"].includes(normalized);
}

function createProfileImageRecord(payload = {}, createdAt = nowIso()) {
  const url = String(payload.profileImageUrl || payload.selfieUrl || payload.photoUrl || "").trim();
  const consentGiven = truthyConsent(payload.profileImageConsent || payload.selfieConsent || payload.photoConsent);
  const status = url && consentGiven ? "active" : url ? "pending_consent" : "requested";

  return {
    status,
    url,
    source: url ? "operator_supplied" : "whatsapp_selfie_request",
    consentGiven,
    requestedAt: createdAt,
    consentText:
      "I consent to Axiom storing this selfie/profile image so the correct people can recognise each other in this property matter or office workspace.",
    purpose: "Profile recognition and correct-party context only. Not facial recognition or biometric identity scoring."
  };
}

function buildRoleScope({ role, agencyId, branchId, provinceId, agentId, caseId, extraAgentIds = [], extraCaseIds = [] }) {
  const normalizedRole = normalizeRole(role);
  const agencyIds = unique(agencyId);
  const branchIds = unique(branchId);
  const provinceIds = unique(provinceId);
  const agentIds = normalizedRole === "agent" ? unique([agentId]) : unique([agentId, ...extraAgentIds]);
  const caseIds = isPartyRole(normalizedRole) ? unique([caseId, ...extraCaseIds]) : unique(extraCaseIds);

  return {
    allAccess: false,
    agencyIds,
    branchIds,
    provinceIds,
    agentIds,
    caseIds
  };
}

function createRoleOnboardingRecord(payload = {}, session = {}) {
  const createdAt = nowIso();
  const role = normalizeRole(payload.role || payload.accessRole || "principal");
  const profile = getRoleProfile(role);
  const agencyName = String(payload.agencyName || payload.agency || "Agency to confirm").trim();
  const branchName = String(payload.branchName || payload.branch || payload.town || "Main branch").trim();
  const provinceId = normalizeProvinceId(payload.province || payload.provinceId || session.provinceId || "north-west");
  const province = formatProvinceLabel(provinceId);
  const town = String(payload.town || branchName).trim();
  const personName = roleOnboardingName(payload, role);
  const { email, mobile, contact } = roleOnboardingContact(payload);
  const agencyId = String(payload.agencyId || `agency-${slugify(agencyName)}`).trim();
  const branchId = String(payload.branchId || `branch-${slugify(agencyName)}-${slugify(branchName)}`).trim();
  const agentId = String(
    payload.agentId ||
      payload.assignedAgentId ||
      (role === "agent" ? `agent-${slugify(personName)}-${slugify(agencyName)}` : "")
  ).trim();
  const caseId = String(payload.caseId || payload.leadId || payload.dealRoomId || "").trim();
  const userId = String(
    payload.userId ||
      payload.personId ||
      `${role}-${slugify(personName)}-${slugify(isPartyRole(role) ? caseId || agencyName : agencyName)}`
  ).trim();
  const packageLabel = String(payload.packageLabel || payload.package || "Axiom Mission Control").trim();
  const agentSeats = Math.max(0, Number(payload.agentSeats || payload.agentCount || 0));
  const adminSeats = Math.max(0, Number(payload.adminSeats || payload.adminCount || 0));
  const extraAgentIds = ensureArray(payload.agentIds);
  const extraCaseIds = ensureArray(payload.caseIds);
  const scope = buildRoleScope({
    role,
    agencyId,
    branchId,
    provinceId,
    agentId,
    caseId,
    extraAgentIds,
    extraCaseIds
  });

  if (!contact) {
    throw new Error(`${profile.label} email or mobile is required before access can be created.`);
  }

  if (isPartyRole(role) && !scope.caseIds.length) {
    throw new Error(`${profile.label} access needs a linked case or Deal Room before it can be created.`);
  }

  if (role === "agent" && !scope.agentIds.length) {
    throw new Error("Agent access needs an agent record before it can be created.");
  }

  const baseRecord = {
    id: userId,
    name: personName,
    role,
    agencyId,
    branchId,
    provinceId,
    contact,
    email,
    mobile,
    whatsapp: mobile,
    profileImage: createProfileImageRecord(payload, createdAt),
    status: "invited",
    verificationStatus: "operator_verified",
    verifiedBy: session.userId || session.name || "axiom",
    verifiedAt: createdAt,
    scope,
    onboarding: {
      invitedAt: createdAt,
      packageLabel,
      firstLogin: "OTP required",
      verificationOwner: role === "principal" ? "Axiom concierge or existing principal" : "Principal, concierge, or assigned admin",
      nextStep: "Send OTP invite, confirm first login, then complete role-specific setup."
    }
  };

  const teamResponsibilities = {
    principal: [
      "Approve branch setup",
      "Invite office admin and agents",
      "Review agency, branch, province and agent rollups"
    ],
    office_admin: [
      "Verify incoming people and case access",
      "Route leads and monitor follow-ups",
      "Keep WhatsApp approvals and seller updates moving"
    ],
    agent: [
      "Accept qualified leads",
      "Work assigned buyer and seller matters",
      "Use WhatsApp drafts, reminders and protection tools"
    ]
  };

  const partyResponsibilities = {
    buyer: ["View own buying progress", "Respond to next-step requests", "Keep the message trail in one place"],
    seller: ["View own sale progress", "Receive approved seller updates", "Keep the message trail in one place"],
    attorney: ["Update assigned transfer progress", "Flag missing documents", "Keep transfer comms attached to the case"],
    bond_originator: ["Update assigned finance progress", "Flag missing finance items", "Keep bond comms attached to the case"]
  };

  const record = isPartyRole(role)
    ? {
        ...baseRecord,
        partyType: role,
        agentId,
        assignedAgentId: agentId,
        caseIds: scope.caseIds,
        responsibilities: partyResponsibilities[role] || []
      }
    : {
        ...baseRecord,
        lane: `${branchName} / ${profile.label}`,
        agentId: role === "agent" ? scope.agentIds[0] : undefined,
        assignedAgentId: role === "agent" ? scope.agentIds[0] : undefined,
        responsibilities: teamResponsibilities[role] || []
      };

  return {
    createdAt,
    role,
    roleLabel: profile.label,
    recordType: isPartyRole(role) ? "partyUser" : "teamMember",
    agency: {
      id: agencyId,
      name: agencyName,
      provinceIds: [provinceId],
      branchIds: [branchId],
      status: "onboarding",
      onboarding: {
        signedUpAt: createdAt,
        packageLabel,
        agentSeats,
        adminSeats,
        createdBy: session.name || session.userId || "Axiom"
      }
    },
    branch: {
      id: branchId,
      agencyId,
      name: branchName,
      town,
      provinceId,
      province,
      adminIds: role === "office_admin" ? [userId] : [],
      agentIds: role === "agent" ? [record.agentId || userId] : [],
      status: "onboarding"
    },
    accessRecord: record,
    signIn: {
      role,
      roleLabel: profile.label,
      contact,
      method: "OTP",
      accessScope: scope
    },
    verification: {
      status: "operator_verified",
      verifiedBy: session.name || session.userId || "Axiom",
      note:
        role === "principal"
          ? "Axiom/concierge verifies the principal and agency before the OTP invite is useful."
          : isPartyRole(role)
            ? "The linked case controls what this party can see."
            : "The principal or concierge verifies this person before office access is issued."
    }
  };
}

function upsertById(list, record) {
  const index = list.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...record };
    return "updated";
  }
  list.unshift(record);
  return "created";
}

function applyRoleOnboarding(operations, onboarding, session = {}) {
  const { agency, branch, accessRecord, recordType, role, createdAt } = onboarding;
  const agencyStatus = upsertById(operations.organisations, agency);
  const branchStatus = upsertById(operations.branches, branch);
  const targetList = recordType === "partyUser" ? operations.partyUsers : operations.teamMembers;
  const accessStatus = upsertById(targetList, accessRecord);
  const storedBranch = operations.branches.find((item) => item.id === branch.id);

  if (storedBranch) {
    if (role === "office_admin") storedBranch.adminIds = unique([...(storedBranch.adminIds || []), accessRecord.id]);
    if (role === "agent") storedBranch.agentIds = unique([...(storedBranch.agentIds || []), accessRecord.agentId || accessRecord.id]);
  }

  operations.tasks.unshift({
    id: createOpsId("task"),
    caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
    title: `Activate ${onboarding.roleLabel}: ${accessRecord.name}`,
    category: "access-onboarding",
    priority: role === "principal" ? "high" : "medium",
    status: "open",
    ownerId: session.userId,
    ownerName: session.name || "Axiom",
    dueLabel: role === "principal" ? "Before first branch import" : "Before first live handover",
    nextAction: `${onboarding.verification.note} Send the OTP invite once the contact route is confirmed.`,
    agencyId: agency.id,
    branchId: branch.id,
    provinceId: branch.provinceId,
    agentId: accessRecord.agentId || "",
    assignedAgentId: accessRecord.assignedAgentId || "",
    createdAt
  });

  operations.whatsapp.queue.unshift({
    id: createOpsId("wa"),
    caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
    caseName: isPartyRole(role) ? `${accessRecord.name} access` : `${agency.name} onboarding`,
    category: `${role}-onboarding`,
    toName: accessRecord.name,
    toRole: role,
    toContact: accessRecord.contact || accessRecord.mobile || accessRecord.whatsapp || accessRecord.email || "",
    ownerName: session.name || "Axiom",
    channel: "whatsapp",
    status: "awaiting_approval",
    body: `Hi ${accessRecord.name}. Axiom has prepared your ${onboarding.roleLabel} access. You will sign in with your linked email/mobile and a one-time code. Your view is limited to the correct ${isPartyRole(role) ? "case" : "agency, branch and role"} scope.`,
    agencyId: agency.id,
    branchId: branch.id,
    provinceId: branch.provinceId,
    agentId: accessRecord.agentId || "",
    assignedAgentId: accessRecord.assignedAgentId || "",
    createdAt
  });

  if (accessRecord.profileImage?.status !== "active") {
    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
      title: `Get profile selfie: ${accessRecord.name}`,
      category: "profile-image",
      priority: "low",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first live interaction",
      nextAction: "Request a clear selfie/profile photo with consent so the right people are recognisable in the workspace.",
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: accessRecord.agentId || "",
      assignedAgentId: accessRecord.assignedAgentId || "",
      createdAt
    });

    operations.whatsapp.queue.unshift({
      id: createOpsId("wa"),
      caseId: isPartyRole(role) ? onboarding.signIn.accessScope.caseIds[0] : agency.id,
      caseName: isPartyRole(role) ? `${accessRecord.name} profile` : `${agency.name} profile setup`,
      category: "profile-selfie-request",
      toName: accessRecord.name,
      toRole: role,
      toContact: accessRecord.contact || accessRecord.mobile || accessRecord.whatsapp || accessRecord.email || "",
      ownerName: session.name || "Axiom",
      channel: "whatsapp",
      status: "awaiting_approval",
      body: `Hi ${accessRecord.name}. To help everyone recognise the correct person in Axiom, please send a clear selfie/profile photo if you are comfortable with that. By sending it, you consent to Axiom storing it as your profile image for this property matter or office workspace. It will not be used for facial recognition or biometric scoring.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: accessRecord.agentId || "",
      assignedAgentId: accessRecord.assignedAgentId || "",
      createdAt
    });
  }

  return { agencyStatus, branchStatus, accessStatus };
}

function parseRolloutPeople(value, fallbackRole) {
  const list = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return list
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "object") {
        return {
          role: normalizeRole(entry.role || fallbackRole),
          personName: String(entry.personName || entry.name || "").trim(),
          email: normalizeEmail(entry.email),
          mobile: normalizeContactNumber(entry.mobile || entry.whatsapp || entry.phone)
        };
      }

      const parts = String(entry)
        .split(/[|,;]/)
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        role: normalizeRole(fallbackRole),
        personName: parts[0] || "",
        email: normalizeEmail(parts.find((part) => part.includes("@")) || ""),
        mobile: normalizeContactNumber(parts.find((part) => !part.includes("@") && /[0-9+]/.test(part) && part !== parts[0]) || "")
      };
    })
    .filter((entry) => entry?.personName && (entry.email || entry.mobile));
}

function createTeamRolloutRecords(payload = {}, session = {}) {
  const base = {
    agencyName: payload.agencyName || payload.agency,
    agencyId: payload.agencyId,
    branchName: payload.branchName || payload.branch || payload.town,
    branchId: payload.branchId,
    town: payload.town || payload.branchName || payload.branch,
    province: payload.province || payload.provinceId,
    packageLabel: payload.packageLabel || "Axiom Mission Control"
  };
  const admins = parseRolloutPeople(payload.admins || payload.officeAdmins || payload.concierges, "office_admin");
  const agents = parseRolloutPeople(payload.agents, "agent");
  const people = [...admins, ...agents];

  if (!people.length) {
    throw new Error("Add at least one concierge/admin or agent before creating a branch rollout.");
  }

  const onboarding = people.map((person) =>
    createRoleOnboardingRecord(
      {
        ...base,
        role: person.role,
        personName: person.personName,
        email: person.email,
        mobile: person.mobile
      },
      session
    )
  );

  return {
    agencyName: String(base.agencyName || "Agency to confirm").trim(),
    branchName: String(base.branchName || base.town || "Branch to confirm").trim(),
    provinceId: normalizeProvinceId(base.province || session.provinceId || "north-west"),
    counts: {
      admins: onboarding.filter((item) => item.role === "office_admin").length,
      agents: onboarding.filter((item) => item.role === "agent").length,
      total: onboarding.length
    },
    onboarding
  };
}

async function handleTeamRollout(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 128 * 1024);
    const operations = getOperationsState();
    const rollout = createTeamRolloutRecords(body, session);
    const mutations = rollout.onboarding.map((onboarding) => applyRoleOnboarding(operations, onboarding, session));

    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: rollout.onboarding[0]?.agency?.id || "agency-rollout",
      title: `Complete ${rollout.branchName} team rollout`,
      category: "branch-rollout",
      priority: "high",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first branch lead import",
      nextAction: `Confirm ${rollout.counts.admins} admin and ${rollout.counts.agents} agent invite${rollout.counts.total === 1 ? "" : "s"} were accepted, then import their active leads.`,
      agencyId: rollout.onboarding[0]?.agency?.id || "",
      branchId: rollout.onboarding[0]?.branch?.id || "",
      provinceId: rollout.provinceId,
      createdAt: nowIso()
    });

    audit("branch-team-rollout-created", {
      agencyName: rollout.agencyName,
      branchName: rollout.branchName,
      provinceId: rollout.provinceId,
      admins: rollout.counts.admins,
      agents: rollout.counts.agents,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      rollout: {
        agencyName: rollout.agencyName,
        branchName: rollout.branchName,
        provinceId: rollout.provinceId,
        counts: rollout.counts,
        created: rollout.onboarding.map((item, index) => ({
          role: item.role,
          roleLabel: item.roleLabel,
          name: item.accessRecord.name,
          contact: item.signIn.contact,
          scope: item.signIn.accessScope,
          mutation: mutations[index]
        })),
        inviteQueue: "WhatsApp invites queued for human approval"
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Branch team rollout failed." });
  }
}

async function handleRoleOnboarding(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 64 * 1024);
    const operations = getOperationsState();
    const onboarding = createRoleOnboardingRecord(body, session);
    const mutation = applyRoleOnboarding(operations, onboarding, session);

    audit("role-onboarded", {
      role: onboarding.role,
      recordType: onboarding.recordType,
      recordId: onboarding.accessRecord.id,
      agencyId: onboarding.agency.id,
      branchId: onboarding.branch.id,
      provinceId: onboarding.branch.provinceId,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      onboarding: {
        ...onboarding,
        mutation
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Role onboarding failed." });
  }
}

async function handlePrincipalOnboarding(request, response) {
  const session = requirePermission(request, response, ["org.manage_assigned", "rollups.view_all"], ["principal", "office_admin"]);
  if (!session) return;

  try {
    const body = await readBody(request, 64 * 1024);
    const operations = getOperationsState();
    const onboarding = createPrincipalOnboardingRecord(body, session);
    const { agency, branch, principal, createdAt } = onboarding;

    const existingAgencyIndex = operations.organisations.findIndex((item) => item.id === agency.id);
    if (existingAgencyIndex >= 0) {
      operations.organisations[existingAgencyIndex] = {
        ...operations.organisations[existingAgencyIndex],
        ...agency,
        provinceIds: unique([...(operations.organisations[existingAgencyIndex].provinceIds || []), ...agency.provinceIds]),
        branchIds: unique([...(operations.organisations[existingAgencyIndex].branchIds || []), ...agency.branchIds])
      };
    } else {
      operations.organisations.unshift(agency);
    }

    const existingBranchIndex = operations.branches.findIndex((item) => item.id === branch.id);
    if (existingBranchIndex >= 0) {
      operations.branches[existingBranchIndex] = {
        ...operations.branches[existingBranchIndex],
        ...branch
      };
    } else {
      operations.branches.unshift(branch);
    }

    const existingPrincipalIndex = operations.teamMembers.findIndex((item) => item.id === principal.id);
    if (existingPrincipalIndex >= 0) {
      operations.teamMembers[existingPrincipalIndex] = {
        ...operations.teamMembers[existingPrincipalIndex],
        ...principal
      };
    } else {
      operations.teamMembers.unshift(principal);
    }

    operations.tasks.unshift({
      id: createOpsId("task"),
      caseId: agency.id,
      title: `Activate ${agency.name}`,
      category: "agency-onboarding",
      priority: "high",
      status: "open",
      ownerId: session.userId,
      ownerName: session.name || "Axiom",
      dueLabel: "Before first agent import",
      nextAction: `Confirm ${principal.name}'s contact, then invite admins and agents for ${branch.name}.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      agentId: "",
      assignedAgentId: "",
      createdAt
    });

    operations.whatsapp.queue.unshift({
      id: createOpsId("wa"),
      caseId: agency.id,
      caseName: `${agency.name} onboarding`,
      category: "principal-onboarding",
      toName: principal.name,
      toRole: "principal",
      toContact: principal.contact || principal.mobile || principal.whatsapp || principal.email || "",
      ownerName: session.name || "Axiom",
      channel: "whatsapp",
      status: "awaiting_approval",
      body: `Hi ${principal.name}. Axiom has prepared your ${agency.name} Mission Control access for ${branch.name}. You will sign in with your linked email/mobile and a one-time code. Once inside, you can see branch, agent, province and agency rollups for your own office.`,
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      createdAt
    });

    audit("principal-onboarded", {
      agencyId: agency.id,
      branchId: branch.id,
      provinceId: branch.provinceId,
      principalId: principal.id,
      createdBy: session.userId
    });
    await persistState();

    sendJson(response, 200, {
      ok: true,
      onboarding: {
        agency,
        branch,
        principal,
        signIn: {
          role: "principal",
          contact: principal.contact,
          method: "OTP",
          accessScope: principal.scope
        },
        inviteQueued: true
      },
      snapshot: buildOperationsSnapshot(session)
    });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "Principal onboarding failed." });
  }
}

function handleAuditLog(request, response) {
  const session = requirePermission(request, response, "audit.view", ["principal"]);
  if (!session) return;
  sendJson(response, 200, { ok: true, auditLog: state.auditLog });
}

function handleExport(request, response) {
  const session = requirePermission(request, response, "export.download", ["principal"]);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    export: {
      leads: state.leads,
      auditLog: state.auditLog,
      exportedAt: new Date().toISOString()
    }
  });
}

function handleAccessModel(_request, response) {
  const operations = getOperationsState();
  const roles = Object.entries(accessProfiles).map(([role, profile]) => ({
    role,
    label: profile.label,
    gateLabel: profile.gateLabel,
    allowedViews: profile.allowedViews,
    defaultView: profile.defaultView,
    workspaceTabs: getWorkspaceTabs(role),
    accessNote: profile.accessNote,
    permissionLabels: getPermissionLabels(profile.permissions)
  }));

  sendJson(response, 200, {
    ok: true,
    roles,
    workspaceTabDefinitions,
    permissionCatalog,
    hierarchyModel: {
      organisations: operations.organisations.map((item) => ({
        id: item.id,
        name: item.name,
        provinceIds: item.provinceIds,
        branchIds: item.branchIds,
        status: item.status
      })),
      branches: operations.branches.map((item) => ({
        id: item.id,
        agencyId: item.agencyId,
        name: item.name,
        provinceId: item.provinceId,
        adminCount: ensureArray(item.adminIds).length,
        agentCount: ensureArray(item.agentIds).length
      })),
      supportedPartyRoles: ["buyer", "seller", "attorney", "bond_originator"]
    },
    agentNetworkModel: {
      purpose: "Internal agent coverage, matching, verification, pilot selection and controlled business outreach.",
      coreFields: [
        "agentName",
        "agencyName",
        "province",
        "towns",
        "specialties",
        "email",
        "mobile",
        "whatsapp",
        "sourceUrl",
        "sourceCapturedAt",
        "verificationStatus",
        "consentStatus",
        "doNotContact",
        "outreachHistory"
      ],
      complianceGuardrails: [
        "source recorded",
        "manual verification before outreach",
        "opt-out/no-contact suppression",
        "no uncontrolled bulk messaging",
        "WhatsApp outreach queued for human control"
      ]
    },
    aiValueModel: {
      llmStatus: getLlmStatus().status,
      llmProvider: getLlmStatus(),
      valuePattern: "AI drafts, summarises, detects risk, recommends next action and queues WhatsApp work for human approval.",
      rollupDimensions: ["agency", "branch", "province", "agent", "case", "role"]
    },
    onboardingModel: {
      route: "/api/admin/onboard-role",
      branchRolloutRoute: "/api/admin/onboard-team",
      signInMethod: "OTP to verified email or mobile",
      verificationRule: "Access is created only after an existing principal, concierge/admin, or Axiom operator confirms the person and scope.",
      scopePattern: "Every new user is linked to agency, branch, province, role and, where relevant, agent or case.",
      rolloutPattern: "After the principal is verified, a branch admin and agent group can be loaded together under the same agency, branch and province.",
      internalRoles: [
        {
          role: "principal",
          verifiedBy: "Axiom concierge or existing principal",
          sees: "Assigned agency, branch, province, admin, agent and roll-up view"
        },
        {
          role: "office_admin",
          label: "Concierge / admin",
          verifiedBy: "Principal or Axiom concierge",
          sees: "Assigned branches, agents, leads, reminders, comms and protection work"
        },
        {
          role: "agent",
          verifiedBy: "Principal or concierge/admin",
          sees: "Own leads, assigned cases, client comms, protection and action queue"
        }
      ],
      caseRoles: [
        {
          role: "seller",
          verifiedBy: "Linked seller case contact",
          sees: "Own seller progress, next steps, approved updates and comms"
        },
        {
          role: "buyer",
          verifiedBy: "Linked buyer case contact",
          sees: "Own buyer progress, next steps and comms"
        },
        {
          role: "attorney",
          verifiedBy: "Linked transfer case contact",
          sees: "Assigned transfer progress and outstanding items"
        },
        {
          role: "bond_originator",
          verifiedBy: "Linked finance case contact",
          sees: "Assigned finance progress and outstanding items"
        }
      ]
    }
  });
}

function handleOperationsSnapshot(request, response) {
  const session = requireSession(request, response);
  if (!session) return;
  sendJson(response, 200, {
    ok: true,
    snapshot: buildOperationsSnapshot(session)
  });
}

function handleAiValueOpportunities(request, response) {
  const session = requireSession(request, response);
  if (!session) return;
  const snapshot = buildOperationsSnapshot(session);
  sendJson(response, 200, {
    ok: true,
    role: session.role,
    identity: snapshot.identity,
    rollups: snapshot.rollups,
    aiValue: snapshot.aiValue
  });
}

function handleCaseBrain(request, response) {
  const session = requirePermission(request, response, [
    "leads.view_all",
    "leads.view_assigned",
    "comms.view_all",
    "comms.view_assigned",
    "progress.view_all",
    "progress.view_assigned"
  ]);
  if (!session) return;
  const snapshot = buildOperationsSnapshot(session);
  sendJson(response, 200, {
    ok: true,
    role: session.role,
    identity: snapshot.identity,
    caseBrain: snapshot.caseBrain
  });
}

async function handleLlmTest(request, response) {
  const session = requirePermission(request, response, "system.view");
  if (!session) return;

  const body = await readBody(request, 32 * 1024).catch(() => ({}));
  const prompt = String(body.prompt || "Reply with one short sentence confirming Axiom's NVIDIA AI engine is ready.").trim();

  try {
    const output = await callLiveLlm(
      [
        { role: "system", content: "You are a concise backend readiness checker for Axiom Realty AI." },
        { role: "user", content: prompt.slice(0, 2000) }
      ],
      { maxTokens: 180, temperature: 0.1, timeoutMs: 15000 }
    );
    sendJson(response, 200, {
      ok: true,
      llm: getLlmStatus(),
      output
    });
  } catch (error) {
    sendJson(response, Number(error?.statusCode || 502), {
      ok: false,
      llm: getLlmStatus(),
      error: error instanceof Error ? error.message : "LLM test failed."
    });
  }
}

async function handleAiConciergeDraft(request, response) {
  const session = requirePermission(request, response, [
    "comms.view_all",
    "comms.view_assigned",
    "leads.view_all",
    "leads.view_assigned",
    "seller_updates.approve",
    "market_updates.send"
  ]);
  if (!session) return;

  const body = await readBody(request, 128 * 1024);
  const operations = getOperationsState();
  const thread = body.threadId ? operations.whatsapp.threads.find((entry) => entry.id === body.threadId) : null;
  const lead = body.leadId ? state.leads.find((entry) => entry.id === body.leadId || entry.caseId === body.leadId) : null;
  const caseBrain = buildCaseBrainHub(session).cases.find((item) =>
    [body.caseId, thread?.caseId, lead?.caseId, lead?.id, body.caseName, thread?.caseName, lead?.label]
      .filter(Boolean)
      .map(String)
      .some((key) => key === item.caseId || key === item.leadId || key === item.caseName)
  );
  const fallback = String(body.fallback || body.body || "").trim() || "Hi. Axiom has reviewed the matter and will keep the next step clear.";
  const draft = await generateConciergeDraft({
    purpose: body.purpose || body.category || "Draft a concise Axiom concierge WhatsApp message.",
    audience: body.audience || body.toRole || "property client or estate agent",
    fallback,
    context: {
      requestedBy: session.role,
      caseId: body.caseId || thread?.caseId || lead?.caseId || lead?.id || "",
      caseName: body.caseName || thread?.caseName || lead?.label || "",
      recipient: {
        name: body.toName || "",
        role: body.toRole || ""
      },
      leadQuality: lead?.leadQuality || null,
      briefCard: lead?.briefCard || null,
      caseBrain: caseBrain || null,
      latestThreadMessages: thread?.messages?.slice(-8) || [],
      instructions: body.instructions || body.prompt || "",
      currentDraft: fallback
    },
    maxTokens: Math.max(180, Math.min(900, Number(body.maxTokens || 450)))
  });

  if (body.queue === true) {
    const item = queueWhatsappMessage({
      caseId: body.caseId || thread?.caseId || lead?.caseId || lead?.id || "general",
      caseName: body.caseName || thread?.caseName || lead?.label || "Axiom concierge draft",
      category: body.category || "ai-concierge-draft",
      toName: body.toName || "Recipient",
      toRole: body.toRole || "contact",
      ownerName: body.ownerName || session.role,
      body: draft.text,
      approvalRequired: true
    });
    const targetThread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
    addThreadMessage(targetThread, {
      id: createOpsId("wa"),
      direction: "system",
      author: "Axiom AI",
      category: "ai-concierge-draft",
      body: `AI draft queued for approval: ${draft.text}`,
      at: nowIso(),
      status: "draft_stored",
      approvalRequired: true,
      llm: draft.status
    });
    await persistState();
    sendJson(response, 200, { ok: true, draft, item, snapshot: buildOperationsSnapshot(session) });
    return;
  }

  sendJson(response, 200, { ok: true, draft });
}

async function handleTaskAction(request, response) {
  const session = requirePermission(request, response, ["reminders.view_all", "reminders.view_assigned", "leads.assign"]);
  if (!session) return;

  const body = await readBody(request);
  const operations = getOperationsState();
  const task = operations.tasks.find((entry) => entry.id === body.taskId);
  if (!task) {
    sendJson(response, 404, { ok: false, error: "Task not found." });
    return;
  }

  const action = String(body.action || "done").trim().toLowerCase();
  task.status = action === "reopen" ? "open" : "done";
  task.completedAt = task.status === "done" ? nowIso() : null;
  task.nextAction = task.status === "done" ? "Completed and stored in the office trail." : task.nextAction;

  const reminder = operations.reminders.find((entry) => entry.caseId === task.caseId);
  if (reminder && action !== "reopen") {
    reminder.status = "done";
    reminder.dueLabel = "Completed";
    reminder.note = `Marked done by ${session.role}.`;
  }

  audit("task-updated", { taskId: task.id, action, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, snapshot: buildOperationsSnapshot(session) });
}

async function handleWhatsappQueue(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned", "seller_updates.approve", "market_updates.send", "dealroom.share"]);
  if (!session) return;

  const body = await readBody(request);
  let messageBody = String(body.body || "").trim();
  if (!messageBody && !body.aiAssist) {
    sendJson(response, 400, { ok: false, error: "Message body is required." });
    return;
  }
  let aiDraft = null;
  if (body.aiAssist || body.aiInstruction || body.prompt) {
    const caseBrain = buildCaseBrainHub(session).cases.find((item) =>
      [body.caseId, body.caseName]
        .filter(Boolean)
        .map(String)
        .some((key) => key === item.caseId || key === item.leadId || key === item.caseName)
    );
    aiDraft = await generateConciergeDraft({
      purpose: body.aiInstruction || body.prompt || `Draft a ${body.category || "WhatsApp"} message for approval.`,
      audience: body.toRole || "property client or estate agent",
      fallback: messageBody || "Hi. Axiom will keep this moving and confirm the next step shortly.",
      context: {
        caseId: body.caseId,
        caseName: body.caseName,
        category: body.category,
        toName: body.toName,
        toRole: body.toRole,
        ownerName: body.ownerName || session.role,
        caseBrain: caseBrain || null,
        currentDraft: messageBody
      }
    });
    messageBody = aiDraft.text;
  }

  const operations = getOperationsState();
  const item = queueWhatsappMessage({
    caseId: body.caseId,
    caseName: body.caseName,
    category: body.category,
    toName: body.toName,
    toRole: body.toRole,
    toContact: body.toContact || body.toNumber || body.mobile || body.whatsapp || "",
    ownerName: body.ownerName || session.role,
    body: messageBody,
    scheduledFor: body.scheduledFor,
    approvalRequired: body.approvalRequired ?? Boolean(aiDraft?.usedLiveLlm)
  });
  const thread = ensureThread(item.caseId, item.caseName, [item.toName, item.ownerName]);
  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "system",
    author: "Axiom",
    body: `${item.category} queued for ${item.toName}.`,
    at: item.createdAt,
    status: item.status,
    llm: aiDraft?.status || null
  });
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  await persistState();
  sendJson(response, 200, { ok: true, item, aiDraft, snapshot: buildOperationsSnapshot(session) });
}

async function handleWhatsappProcess(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const body = await readBody(request).catch(() => ({}));
  const limit = Math.max(1, Number(body.limit || 10));
  const operations = getOperationsState();
  const processable = operations.whatsapp.queue.filter((item) => item.status === "queued").slice(0, limit);
  const runtime = getWhatsappRuntime();
  const results = [];

  for (const item of processable) {
    results.push(await processWhatsappQueueItem(item, runtime));
  }

  operations.whatsapp.bridge.lastProcessedAt = nowIso();
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  operations.whatsapp.bridge.mode = runtime.mode;
  operations.whatsapp.bridge.provider = runtime.provider;
  operations.whatsapp.bridge.connected = runtime.liveDeliveryConnected;
  operations.whatsapp.bridge.status = runtime.status;
  audit("whatsapp-processed", {
    count: processable.length,
    role: session.role,
    provider: runtime.provider,
    liveDeliveryConnected: runtime.liveDeliveryConnected
  });
  await persistState();
  sendJson(response, 200, {
    ok: true,
    processed: processable.length,
    deliveryMode: runtime.liveDeliveryConnected ? runtime.provider : "manual_test",
    whatsapp: runtime,
    results,
    snapshot: buildOperationsSnapshot(session)
  });
}

async function handleWhatsappReply(request, response) {
  const session = requirePermission(request, response, ["comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const body = await readBody(request);
  const operations = getOperationsState();
  const thread = operations.whatsapp.threads.find((entry) => entry.id === body.threadId);
  if (!thread) {
    sendJson(response, 404, { ok: false, error: "Thread not found." });
    return;
  }

  let messageBody = String(body.body || "").trim();
  if (!messageBody) {
    sendJson(response, 400, { ok: false, error: "Reply cannot be empty." });
    return;
  }
  let aiDraft = null;
  if (body.aiAssist || body.aiInstruction || body.prompt) {
    aiDraft = await generateConciergeDraft({
      purpose: body.aiInstruction || body.prompt || "Refine this WhatsApp reply for Axiom concierge tone.",
      audience: body.recipient || body.toRole || "WhatsApp recipient",
      fallback: messageBody,
      context: {
        thread: {
          id: thread.id,
          caseName: thread.caseName,
          participants: thread.participants,
          latestMessages: thread.messages.slice(-8)
        },
        currentDraft: messageBody
      }
    });
    messageBody = aiDraft.text;
  }

  addThreadMessage(thread, {
    id: createOpsId("wa"),
    direction: "outbound",
    author: String(body.author || "Axiom"),
    body: messageBody,
    at: nowIso(),
    status: "delivered",
    llm: aiDraft?.status || null
  });
  thread.unreadCount = 0;
  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  audit("whatsapp-reply-sent", { threadId: thread.id, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, aiDraft, snapshot: buildOperationsSnapshot(session) });
}

async function handleRunSmartReminders(request, response) {
  const session = requirePermission(request, response, ["reminders.view_all", "reminders.view_assigned", "comms.view_all", "comms.view_assigned"]);
  if (!session) return;

  const operations = getOperationsState();
  const queuedIds = new Set(
    operations.whatsapp.queue
      .filter((item) => ["queued", "delivered", "manual_test_ready", "send_failed"].includes(item.status))
      .map((item) => `${item.category}:${item.caseId}`)
  );

  const newItems = [];
  operations.reminders
    .filter((reminder) => reminder.status === "pending")
    .forEach((reminder) => {
      const key = `smart-reminder:${reminder.caseId}`;
      if (queuedIds.has(key)) return;
      newItems.push(
        queueWhatsappMessage({
          caseId: reminder.caseId,
          caseName: reminder.caseName,
          category: "smart-reminder",
          toName: reminder.ownerName,
          toRole: "agent",
          ownerName: "Axiom",
          body: `Reminder: ${reminder.caseName} still needs attention. ${reminder.note}`,
          approvalRequired: false
        })
      );
    });

  operations.whatsapp.bridge.lastHeartbeatAt = nowIso();
  audit("smart-reminders-queued", { count: newItems.length, role: session.role });
  await persistState();
  sendJson(response, 200, { ok: true, queued: newItems.length, snapshot: buildOperationsSnapshot(session) });
}

async function serveStaticFile(requestPath, response) {
  const sanitized = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.join(__dirname, sanitized);
  const resolvedPath = path.resolve(targetPath);
  if (!resolvedPath.startsWith(__dirname)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      await serveStaticFile(path.join(sanitized, "index.html"), response);
      return;
    }
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const fileBuffer = await fs.readFile(resolvedPath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" || extension === ".js" || extension === ".css" ? "no-store" : "public, max-age=300"
    });
    response.end(fileBuffer);
  } catch {
    if (!path.extname(sanitized) || sanitized.endsWith(".html")) {
      const fallback = await fs.readFile(path.join(__dirname, "index.html"));
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(fallback);
      return;
    }
    sendText(response, 404, "Not found");
  }
}

async function handleRequest(request, response) {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      response.end();
      return;
    }

    if (pathname === "/healthz" && request.method === "GET") {
      sendJson(response, 200, { ok: true, status: "up" });
      return;
    }
    if (pathname === "/api/app-status" && request.method === "GET") {
      handleAppStatus(request, response);
      return;
    }
    if (pathname === "/api/auth/session" && request.method === "GET") {
      handleSession(request, response);
      return;
    }
    if (pathname === "/api/auth/request-otp" && request.method === "POST") {
      await handleRequestOtp(request, response);
      return;
    }
    if (pathname === "/api/auth/verify-otp" && request.method === "POST") {
      await handleVerifyOtp(request, response);
      return;
    }
    if (pathname === "/api/auth/access-model" && request.method === "GET") {
      handleAccessModel(request, response);
      return;
    }
    if (pathname === "/api/auth/login" && request.method === "POST") {
      await handleLogin(request, response);
      return;
    }
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      await handleLogout(request, response);
      return;
    }
    if (pathname === "/api/admin/operations" && request.method === "GET") {
      handleOperationsSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/reporting" && request.method === "GET") {
      handleReportingSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-role" && request.method === "POST") {
      await handleRoleOnboarding(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-team" && request.method === "POST") {
      await handleTeamRollout(request, response);
      return;
    }
    if (pathname === "/api/admin/onboard-principal" && request.method === "POST") {
      await handlePrincipalOnboarding(request, response);
      return;
    }
    if (pathname === "/api/admin/case-brain" && request.method === "GET") {
      handleCaseBrain(request, response);
      return;
    }
    if (pathname === "/api/ai/value-opportunities" && request.method === "GET") {
      handleAiValueOpportunities(request, response);
      return;
    }
    if (pathname === "/api/ai/test" && request.method === "POST") {
      await handleLlmTest(request, response);
      return;
    }
    if (pathname === "/api/ai/concierge-draft" && request.method === "POST") {
      await handleAiConciergeDraft(request, response);
      return;
    }
    if (pathname === "/api/admin/tasks/action" && request.method === "POST") {
      await handleTaskAction(request, response);
      return;
    }
    if (pathname === "/api/admin/protection" && request.method === "POST") {
      await handleProtectCommission(request, response);
      return;
    }
    if (pathname === "/api/admin/dealroom/share" && request.method === "POST") {
      await handleDealRoomShare(request, response);
      return;
    }
    if (pathname === "/api/admin/service-pulse" && request.method === "POST") {
      await handleServicePulseCapture(request, response);
      return;
    }
    if (pathname === "/api/admin/pilot/action" && request.method === "POST") {
      await handlePilotControlAction(request, response);
      return;
    }
    if (pathname === "/api/admin/agent-network" && request.method === "GET") {
      await handleAgentNetworkSnapshot(request, response);
      return;
    }
    if (pathname === "/api/admin/agent-network/action" && request.method === "POST") {
      await handleAgentNetworkAction(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/queue" && request.method === "POST") {
      await handleWhatsappQueue(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/process" && request.method === "POST") {
      await handleWhatsappProcess(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/reply" && request.method === "POST") {
      await handleWhatsappReply(request, response);
      return;
    }
    if (pathname === "/api/admin/whatsapp/run-reminders" && request.method === "POST") {
      await handleRunSmartReminders(request, response);
      return;
    }
    if (pathname === "/api/system-status" && request.method === "GET") {
      handleSystemStatus(request, response);
      return;
    }
    if (pathname === "/api/analytics" && request.method === "GET") {
      handleAnalytics(request, response);
      return;
    }
    if (pathname === "/api/admin/audit-log" && request.method === "GET") {
      handleAuditLog(request, response);
      return;
    }
    if (pathname === "/api/admin/export" && request.method === "GET") {
      handleExport(request, response);
      return;
    }
    if (pathname === "/api/leads" && request.method === "POST") {
      await handleLeadCreate(request, response);
      return;
    }
    if (pathname === "/api/public/deal-room/access" && request.method === "POST") {
      await handlePublicDealRoomAccess(request, response);
      return;
    }
    if (pathname === "/api/public/service-pulse" && request.method === "POST") {
      await handlePublicServicePulse(request, response);
      return;
    }

    await serveStaticFile(pathname, response);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    sendJson(response, statusCode, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected server error"
    });
  }
}

export async function createAxiomServer() {
  await loadState();
  return createServer(handleRequest);
}

export async function startServer(overrides = {}) {
  const server = await createAxiomServer();
  const port = Number(overrides.port ?? config.port);
  const host = overrides.host ?? config.host;

  const boundPort = await startWithFallback(server, port, host);

  return {
    server,
    port: boundPort,
    host
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  try {
    const { host, port } = await startServer();
    console.log(`Axiom backend listening on http://${host}:${port}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
