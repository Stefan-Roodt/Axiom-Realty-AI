import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import dotenv from "dotenv";
import { writeJsonFile } from "./server/json-store.js";
import {
  assertProductionSafety,
  buildStartupDiagnostics,
  logStartupDiagnostics,
  publicStatusFromDiagnostics
} from "./server/diagnostics.js";

dotenv.config({ override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const SLA_MINUTES = Number(process.env.SLA_MINUTES || 10);
const LEAD_ACK_ESCALATION_MINUTES = Number(process.env.LEAD_ACK_ESCALATION_MINUTES || 10);
const LEAD_NO_CLIENT_CONTACT_ESCALATION_HOURS = Number(process.env.LEAD_NO_CLIENT_CONTACT_ESCALATION_HOURS || 2);
const LEAD_REFERRED_CONTACT_ESCALATION_HOURS = Number(process.env.LEAD_REFERRED_CONTACT_ESCALATION_HOURS || 24);
const LEAD_COMMISSION_RISK_ESCALATION_HOURS = Number(process.env.LEAD_COMMISSION_RISK_ESCALATION_HOURS || 48);
const LEAD_NO_UPDATE_ESCALATION_HOURS = Number(process.env.LEAD_NO_UPDATE_ESCALATION_HOURS || 48);
const LEAD_MISSING_DOCS_ESCALATION_HOURS = Number(process.env.LEAD_MISSING_DOCS_ESCALATION_HOURS || 24);
const LEAD_DELAYED_TRANSFER_ESCALATION_DAYS = Number(process.env.LEAD_DELAYED_TRANSFER_ESCALATION_DAYS || 7);
const AUTO_LEAD_AUTOMATION_ENABLED = String(process.env.AUTO_LEAD_AUTOMATION_ENABLED || "true").toLowerCase() === "true";
const LEAD_AUTOMATION_INTERVAL_MS = Number(process.env.LEAD_AUTOMATION_INTERVAL_MS || 60000);
const LEAD_PROACTIVE_ACK_DAYS = Number(process.env.LEAD_PROACTIVE_ACK_DAYS || 0);
const LEAD_PROACTIVE_MISSING_DOCS_DAYS = Number(process.env.LEAD_PROACTIVE_MISSING_DOCS_DAYS || 1);
const LEAD_PROACTIVE_STATUS_CHECK_DAYS = Number(process.env.LEAD_PROACTIVE_STATUS_CHECK_DAYS || 3);
const LEAD_PROACTIVE_REACTIVATION_DAYS = Number(process.env.LEAD_PROACTIVE_REACTIVATION_DAYS || 7);
const LEAD_PROACTIVE_COOLDOWN_HOURS = Number(process.env.LEAD_PROACTIVE_COOLDOWN_HOURS || 6);
const LEAD_PROACTIVE_QUIET_START_HOUR = Number(process.env.LEAD_PROACTIVE_QUIET_START_HOUR || 8);
const LEAD_PROACTIVE_QUIET_END_HOUR = Number(process.env.LEAD_PROACTIVE_QUIET_END_HOUR || 19);
const AUTO_CONCIERGE_DIGEST_ENABLED = String(process.env.AUTO_CONCIERGE_DIGEST_ENABLED || "true").toLowerCase() === "true";
const AUTO_CONCIERGE_DIGEST_HOUR = Number(process.env.AUTO_CONCIERGE_DIGEST_HOUR || 8);
const AUTO_CONCIERGE_DIGEST_MINUTE = Number(process.env.AUTO_CONCIERGE_DIGEST_MINUTE || 0);
const LEAD_DEADLINE_CHASE_CASE_WINDOW_DAYS = Number(process.env.LEAD_DEADLINE_CHASE_CASE_WINDOW_DAYS || 1);
const LEAD_DEADLINE_CHASE_CHECKIN_WINDOW_DAYS = Number(process.env.LEAD_DEADLINE_CHASE_CHECKIN_WINDOW_DAYS || 1);
const LEAD_DEADLINE_CHASE_COMMISSION_WINDOW_DAYS = Number(process.env.LEAD_DEADLINE_CHASE_COMMISSION_WINDOW_DAYS || 7);
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "AxiomAdmin2026!").trim();
const APP_VERSION = (process.env.APP_VERSION || "local-dev").trim();
const APP_COMMIT = (process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.GIT_COMMIT || "").trim();
const APP_BUILD_LABEL = APP_COMMIT ? APP_COMMIT.slice(0, 7) : APP_VERSION;
const LM_STUDIO_ENABLED = String(process.env.LM_STUDIO_ENABLED || (process.env.RENDER ? "false" : "true")).toLowerCase() === "true";
const LM_STUDIO_BASE_URL = (process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/+$/, "");
const LM_STUDIO_MODEL = (process.env.LM_STUDIO_MODEL || "").trim();
const LM_STUDIO_API_KEY = (process.env.LM_STUDIO_API_KEY || "lm-studio").trim();
const LM_STUDIO_TIMEOUT_MS = Number(process.env.LM_STUDIO_TIMEOUT_MS || 1800);
const WHATSAPP_VOICE_TRANSCRIBE_URL = (process.env.WHATSAPP_VOICE_TRANSCRIBE_URL || "").trim();
const WHATSAPP_VOICE_TRANSCRIBE_API_KEY = (process.env.WHATSAPP_VOICE_TRANSCRIBE_API_KEY || "").trim();
const WHATSAPP_VOICE_TRANSCRIBE_MODEL = (process.env.WHATSAPP_VOICE_TRANSCRIBE_MODEL || "whisper-1").trim();
const WHATSAPP_VOICE_TRANSCRIBE_TIMEOUT_MS = Number(process.env.WHATSAPP_VOICE_TRANSCRIBE_TIMEOUT_MS || 30000);
const WHATSAPP_VOICE_TRANSCRIBE_REQUIRED = String(process.env.WHATSAPP_VOICE_TRANSCRIBE_REQUIRED || "false").toLowerCase() === "true";
const WHATSAPP_VOICE_TRANSCRIBE_MAX_BYTES = Number(process.env.WHATSAPP_VOICE_TRANSCRIBE_MAX_BYTES || 16 * 1024 * 1024);
const ENFORCE_PRODUCTION_ENV = String(process.env.ENFORCE_PRODUCTION_ENV || (process.env.RENDER ? "true" : "false")).toLowerCase() === "true";
let lmStudioModelCache = null;
let lmStudioLastStatus = { enabled: LM_STUDIO_ENABLED, connected: false, model: null, checkedAt: null };
const dataDir = path.join(__dirname, "data");
const sessionsFile = path.join(dataDir, "lead-sessions.json");
const agentApplicationsFile = path.join(dataDir, "agent-applications.json");
const operationsFile = path.join(dataDir, "operations-store.json");
const dataBackupsDir = path.join(dataDir, "backups");
const secureDocumentsDir = path.join(dataDir, "secure-documents");
const leadVaultDir = path.join(secureDocumentsDir, "lead-vault");
const whatsappWebAuthDir = path.join(dataDir, "whatsapp-web-auth");
const requestBuckets = new Map();
const operationsSessions = new Map();
const OPERATIONS_SESSION_HOURS = 8;
const OPERATIONS_ACCESS_LINK_HOURS = Number(process.env.OPERATIONS_ACCESS_LINK_HOURS || 168);
const OPERATIONS_OTP_MINUTES = Number(process.env.OPERATIONS_OTP_MINUTES || 10);
const OPERATIONS_OTP_MAX_ATTEMPTS = Number(process.env.OPERATIONS_OTP_MAX_ATTEMPTS || 5);
const OPERATIONS_ESCALATION_SLA_MINUTES = Number(process.env.OPERATIONS_ESCALATION_SLA_MINUTES || 120);
const OPERATIONS_SWEEP_INTERVAL_MS = Number(process.env.OPERATIONS_SWEEP_INTERVAL_MS || 5 * 60 * 1000);
const OPERATIONS_DELIVERY_INTERVAL_MS = Number(process.env.OPERATIONS_DELIVERY_INTERVAL_MS || 60 * 1000);
const OPERATIONS_DEMO_MODE = String(process.env.OPERATIONS_DEMO_MODE || "true").toLowerCase() === "true";
const OPERATIONS_DEMO_CELLPHONE = (process.env.OPERATIONS_DEMO_CELLPHONE || "+27832803176").trim();
const OPERATIONS_DEMO_PIN = String(process.env.OPERATIONS_DEMO_PIN || "1234");
const AGENT_LINK_TTL_DAYS = Number(process.env.AGENT_LINK_TTL_DAYS || 30);
const STAKEHOLDER_LINK_TTL_DAYS = Number(process.env.STAKEHOLDER_LINK_TTL_DAYS || 30);
const LEAD_DEDUPE_WINDOW_DAYS = Number(process.env.LEAD_DEDUPE_WINDOW_DAYS || 45);
const REFERRAL_ACKNOWLEDGEMENT_TEXT =
  "I acknowledge that this opportunity was introduced by Axiom Realty AI. I agree that a 12,5% referral commission becomes payable to Axiom Realty AI only if a successful property sale is concluded as a result of this introduction, subject to the agreed referral/commission-sharing arrangement.";
const dealStatusOptions = [
  "Active",
  "Viewing/valuation booked",
  "Offer pending",
  "Under contract",
  "Closed won",
  "Cold",
  "Lost",
  "Disputed"
];
const commissionAgreementOptions = ["Not discussed", "Verbal", "Written", "Confirmed", "Disputed"];
const leadCaseModeOptions = ["undecided", "referral_only", "managed_transaction", "archived"];
const leadCommercialStatusOptions = [
  "new",
  "handed_off",
  "accepted_by_agent",
  "client_contacted",
  "referral_fee_due",
  "referral_fee_paid",
  "under_management",
  "transaction_closed",
  "archived"
];
const leadCaseModeLabels = {
  undecided: "Undecided",
  referral_only: "Referral-only",
  managed_transaction: "Managed transaction",
  archived: "Archived"
};
const leadCommercialStatusLabels = {
  new: "New",
  handed_off: "Handed off",
  accepted_by_agent: "Accepted by agent",
  client_contacted: "Client contacted",
  referral_fee_due: "Referral fee due",
  referral_fee_paid: "Referral fee paid",
  under_management: "Under management",
  transaction_closed: "Transaction closed",
  archived: "Archived"
};
const contactMediumOptions = ["WhatsApp", "Phone call", "Email", "SMS", "In person", "Other", "Not specified"];
const referralAcceptanceViaOptions = ["Signed form", "Portal acknowledgement", ...contactMediumOptions.filter((item) => item !== "Not specified")];
const dealMilestoneDefinitions = [
  { code: "referral-accepted", label: "Referral accepted" },
  { code: "agent-contacted", label: "Agent contacted client" },
  { code: "viewing-booked", label: "Viewing/valuation booked" },
  { code: "offer-received", label: "Offer received" },
  { code: "otp-signed", label: "Offer to purchase signed" },
  { code: "sale-pending", label: "Sale pending" },
  { code: "suspensive-conditions", label: "Suspensive conditions tracked" },
  { code: "bond-approval", label: "Bond approval confirmed" },
  { code: "guarantees-issued", label: "Guarantees issued" },
  { code: "transfer-instruction", label: "Transfer instruction sent" },
  { code: "fica-complete", label: "FICA complete" },
  { code: "compliance-certificates", label: "Compliance certificates ready" },
  { code: "rates-clearance", label: "Rates clearance issued" },
  { code: "transfer-documents-signed", label: "Transfer documents signed" },
  { code: "bond-documents-signed", label: "Bond documents signed" },
  { code: "lodged", label: "Lodged at Deeds Office" },
  { code: "registered", label: "Registered" },
  { code: "sale-concluded", label: "Sale concluded" },
  { code: "handover-complete", label: "Handover complete" },
  { code: "deal-lost", label: "Deal lost/closed" }
];
const dealMilestoneCodes = dealMilestoneDefinitions.map((item) => item.code);
const transactionTimelineDefinitions = [
  { code: "offer-received", label: "Offer received", owner: "Agent", phase: "Offer" },
  { code: "otp-signed", label: "OTP signed", owner: "Buyer/Seller", phase: "Offer" },
  { code: "sale-pending", label: "Sale pending", owner: "Agent", phase: "Offer" },
  { code: "suspensive-conditions", label: "Suspensive conditions", owner: "Agent", phase: "Conditions" },
  { code: "bond-approval", label: "Bond approval", owner: "Finance", phase: "Finance" },
  { code: "guarantees-issued", label: "Guarantees issued", owner: "Finance", phase: "Finance" },
  { code: "transfer-instruction", label: "Transfer instruction", owner: "Attorney", phase: "Transfer" },
  { code: "fica-complete", label: "FICA complete", owner: "Buyer/Seller", phase: "Compliance" },
  { code: "compliance-certificates", label: "Compliance certificates", owner: "Seller", phase: "Compliance" },
  { code: "rates-clearance", label: "Rates clearance", owner: "Attorney", phase: "Compliance" },
  { code: "transfer-documents-signed", label: "Transfer docs signed", owner: "Buyer/Seller", phase: "Signing" },
  { code: "bond-documents-signed", label: "Bond docs signed", owner: "Buyer/Finance", phase: "Signing" },
  { code: "lodged", label: "Lodged", owner: "Attorney", phase: "Deeds Office" },
  { code: "registered", label: "Registered", owner: "Attorney", phase: "Registration" },
  { code: "handover-complete", label: "Handover complete", owner: "Agent", phase: "Closure" }
];
const commissionPayoutStatusOptions = ["Not due", "Due", "Invoiced", "Paid", "Disputed", "Waived"];
const DEFAULT_REFERRAL_PERCENT = Number(process.env.DEFAULT_REFERRAL_PERCENT || 12.5);
const LEAD_DOCUMENT_MAX_BYTES = Number(process.env.LEAD_DOCUMENT_MAX_BYTES || 8 * 1024 * 1024);
const leadDocumentCategoryOptions = [
  "FICA",
  "Offer to Purchase (OTP)",
  "Certificates",
  "Proof of payment",
  "Compliance documents",
  "Transfer documents",
  "Bond documents",
  "Rates clearance",
  "Referral acceptance proof",
  "Agent introduction proof",
  "Milestone evidence",
  "Commission invoice",
  "Commission payment proof",
  "Communication log",
  "Other"
];
const leadDocumentCategoryAliases = {
  "FICA": ["fica", "identity", "proof of address"],
  "Offer to Purchase (OTP)": ["offer to purchase", "otp", "signed offer", "sale agreement", "Milestone evidence"],
  "Certificates": ["certificate", "coc", "clearance", "Milestone evidence"],
  "Proof of payment": ["proof of payment", "payment proof", "pop", "Commission payment proof"],
  "Compliance documents": ["compliance", "certificate", "coc", "Milestone evidence"],
  "Transfer documents": ["transfer document", "transfer docs", "signed transfer", "Milestone evidence"],
  "Bond documents": ["bond document", "bond approval", "guarantee", "bank", "Milestone evidence"],
  "Rates clearance": ["rates clearance", "municipal clearance", "clearance certificate", "Milestone evidence"]
};
const leadDocumentCoreFolders = [
  "FICA",
  "Offer to Purchase (OTP)",
  "Certificates",
  "Proof of payment",
  "Compliance documents",
  "Transfer documents",
  "Bond documents",
  "Rates clearance",
  "Referral acceptance proof",
  "Communication log"
];
const leadDocumentMimeAllowList = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);
const stakeholderRoleOptions = ["buyer", "seller", "agent", "attorney", "bond-originator", "finance", "concierge"];
const stakeholderRoleLabels = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
  attorney: "Attorney",
  "bond-originator": "Bond Originator",
  finance: "Bond Originator",
  concierge: "Concierge"
};
const leadLifecycleStages = [
  { code: "new-unacknowledged", label: "New / Unacknowledged", rank: 10 },
  { code: "acknowledged", label: "Acknowledged", rank: 20 },
  { code: "referred", label: "Referred", rank: 30 },
  { code: "contact-confirmed", label: "Contact confirmed", rank: 40 },
  { code: "with-agent", label: "With agent", rank: 50 },
  { code: "with-agent-1-week", label: "With agent 1 week", rank: 60 },
  { code: "with-agent-2-weeks", label: "With agent 2 weeks", rank: 70 },
  { code: "with-agent-1-month", label: "With agent 1 month", rank: 80 },
  { code: "with-agent-1-month-plus", label: "With agent 1 month+", rank: 90 },
  { code: "sale-pending", label: "Sale pending", rank: 100 },
  { code: "sale-concluded", label: "Sale concluded", rank: 110 },
  { code: "closed", label: "Closed", rank: 120 }
];
const leadLifecycleStageCodes = leadLifecycleStages.map((stage) => stage.code);
const manualLifecycleStageCodes = [
  "acknowledged",
  "with-agent",
  "sale-pending",
  "sale-concluded",
  "closed"
];
const caseFileStages = [
  { code: "intake-received", label: "Intake received", rank: 10, owner: "Concierge" },
  { code: "brief-qualified", label: "Brief qualified", rank: 20, owner: "Concierge" },
  { code: "specialist-assigned", label: "Specialist assigned", rank: 30, owner: "Concierge" },
  { code: "client-contacted", label: "Client contacted", rank: 40, owner: "Agent" },
  { code: "active-follow-up", label: "Active follow-up", rank: 50, owner: "Agent" },
  { code: "offer-in-progress", label: "Offer in progress", rank: 60, owner: "Agent" },
  { code: "sale-concluded", label: "Sale concluded", rank: 70, owner: "Attorney" },
  { code: "closed-lost", label: "Closed lost", rank: 80, owner: "Concierge" },
  { code: "archived", label: "Archived", rank: 90, owner: "Concierge" }
];
const whatsappWebBridge = {
  client: null,
  status: "disabled",
  qr: null,
  qrDataUrl: null,
  lastError: null,
  lastReadyAt: null,
  lastSentAt: null,
  initializing: null
};

app.use(cors({ origin: allowedOrigin === "*" ? true : allowedOrigin }));
app.use(express.json({ limit: "12mb" }));
app.use((req, res, next) => {
  const requestedPath = decodeURIComponent(req.path).toLowerCase();
  const blocked =
    requestedPath.startsWith("/.") ||
    requestedPath.startsWith("/data/") ||
    requestedPath.endsWith(".log") ||
    requestedPath.endsWith(".csv") ||
    requestedPath === "/server.js" ||
    requestedPath === "/package-lock.json";

  if (blocked) return res.status(404).send("Not found");
  if (
    requestedPath === "/script.js" ||
    requestedPath === "/styles.css" ||
    requestedPath === "/index.html" ||
    requestedPath === "/operations.js" ||
    requestedPath === "/operations.css" ||
    requestedPath === "/operations.html"
  ) {
    res.set("Cache-Control", "no-store");
  }
  return next();
});
app.use(express.static(__dirname, { dotfiles: "deny" }));

const leadSessions = new Map();
const agentApplications = [];
let operationsStore = createDefaultOperationsStore();
let startupDiagnostics = null;
const operationsUsers = createOperationsUsers();

function rateLimit({ windowMs = 60000, max = 30 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path}`;
    const now = Date.now();
    const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    requestBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });
    }
    return next();
  };
}

function requireAdmin(req, res, next) {
  const provided = (req.get("x-admin-password") || "").trim();
  if (!ADMIN_PASSWORD || provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Admin access required" });
  }
  return next();
}

const canonicalProvinceMap = {
  "eastern cape": "Eastern Cape",
  "free state": "Free State",
  gauteng: "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal",
  "kwazulu natal": "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  "north west": "North West",
  "northern cape": "Northern Cape",
  "western cape": "Western Cape"
};
const provinceNames = Object.keys(canonicalProvinceMap);
const townDirectory = buildTownDirectory();
const townToProvince = townDirectory.provinceByTown;
const knownTownByKey = townDirectory.townsByKey;
const knownTownEntries = townDirectory.entries;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataBackupsDir)) fs.mkdirSync(dataBackupsDir, { recursive: true });
  if (!fs.existsSync(secureDocumentsDir)) fs.mkdirSync(secureDocumentsDir, { recursive: true });
  if (!fs.existsSync(leadVaultDir)) fs.mkdirSync(leadVaultDir, { recursive: true });
}

function loadPersistedSessions() {
  try {
    ensureDataDir();
    if (!fs.existsSync(sessionsFile)) return;
    const raw = fs.readFileSync(sessionsFile, "utf8");
    if (!raw.trim()) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    for (const session of list) {
      if (session?.id) leadSessions.set(session.id, session);
    }
  } catch {
    // Ignore load errors and continue with in-memory store.
  }
}

function persistSessions() {
  try {
    ensureDataDir();
    const list = Array.from(leadSessions.values());
    writeJsonFile(sessionsFile, list, { backupDir: dataBackupsDir });
  } catch {
    // Ignore persistence errors for now to avoid API hard-failure.
  }
}

function loadAgentApplications() {
  try {
    ensureDataDir();
    if (!fs.existsSync(agentApplicationsFile)) return;
    const raw = fs.readFileSync(agentApplicationsFile, "utf8");
    if (!raw.trim()) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    agentApplications.splice(0, agentApplications.length, ...list.filter((item) => item?.id));
  } catch {
    // Ignore load errors and continue with in-memory store.
  }
}

function persistAgentApplications() {
  try {
    ensureDataDir();
    writeJsonFile(agentApplicationsFile, agentApplications, { backupDir: dataBackupsDir });
  } catch {
    // Ignore persistence errors for now to avoid API hard-failure.
  }
}

function createDefaultOperationsPlaybooks() {
  return [
    {
      id: "seller-standard",
      journey: "seller",
      name: "Seller launch playbook",
      description: "From simple registration to a market-ready listing and active buyer management.",
      reminderLadder: "7, 5, 3, 2 and 1 days before due date",
      milestones: [
        {
          id: "seller-profile",
          title: "Profile and FICA",
          description: "Complete the seller and property brief, then collect the first compliance pack.",
          owner: "seller",
          due: "Within 2 days",
          progress: 18,
          next: "Complete seller profile and upload FICA pack",
          documents: [
            { name: "Certified identity document", owner: "seller", due: "Within 2 days" },
            { name: "Proof of address", owner: "seller", due: "Within 2 days" }
          ]
        },
        {
          id: "seller-valuation",
          title: "Valuation and pricing review",
          description: "Prepare the comparable evidence and route the proposed pricing range for human review.",
          owner: "agent",
          due: "Within 3 days",
          progress: 34,
          next: "Book valuation and approve pricing discussion",
          documents: []
        },
        {
          id: "seller-mandate",
          title: "Mandate and market pack",
          description: "Confirm appointment terms, collect the signed mandate and assemble the launch pack.",
          owner: "agent",
          due: "Within 3 days",
          progress: 56,
          next: "Sign mandate and complete market launch pack",
          documents: [
            { name: "Signed mandate agreement", owner: "agent", due: "Within 3 days" }
          ]
        },
        {
          id: "seller-launch",
          title: "Listing launch",
          description: "Publish the approved listing, confirm channels and keep the seller informed.",
          owner: "agent",
          due: "Within 1 day",
          progress: 70,
          next: "Publish listing and confirm launch",
          documents: []
        },
        {
          id: "seller-offer",
          title: "Offer readiness",
          description: "Prepare the seller for viewings, feedback and a compliant offer decision process.",
          owner: "agent",
          due: "Within 5 days",
          progress: 82,
          next: "Review viewing feedback and prepare for offers",
          documents: []
        }
      ]
    },
    {
      id: "buyer-standard",
      journey: "buyer",
      name: "Buyer purchase playbook",
      description: "From buying brief and finance readiness to offer, bond approval and transfer.",
      reminderLadder: "7, 5, 3, 2 and 1 days before due date",
      milestones: [
        {
          id: "buyer-brief",
          title: "Buying brief and FICA",
          description: "Capture the property brief and prepare the buyer identity pack.",
          owner: "buyer",
          due: "Within 2 days",
          progress: 16,
          next: "Complete buying brief and upload FICA pack",
          documents: [
            { name: "Certified identity document", owner: "buyer", due: "Within 2 days" },
            { name: "Proof of address", owner: "buyer", due: "Within 2 days" }
          ]
        },
        {
          id: "buyer-finance",
          title: "Finance readiness",
          description: "Collect affordability evidence and route the pack to the chosen finance partner.",
          owner: "buyer",
          due: "Within 3 days",
          progress: 32,
          next: "Complete bond pre-check",
          documents: [
            { name: "Latest payslip", owner: "buyer", due: "Within 3 days" },
            { name: "Latest bank statements", owner: "buyer", due: "Within 3 days" }
          ]
        },
        {
          id: "buyer-viewings",
          title: "Matching and viewings",
          description: "Curate listings, schedule viewings and collect structured feedback.",
          owner: "agent",
          due: "Within 5 days",
          progress: 48,
          next: "Review shortlist and confirm viewings",
          documents: []
        },
        {
          id: "buyer-offer",
          title: "Offer to purchase",
          description: "Prepare signatures and ensure the buyer understands suspensive conditions.",
          owner: "buyer",
          due: "Within 2 days",
          progress: 64,
          next: "Review and sign offer to purchase",
          documents: [
            { name: "Signed offer to purchase", owner: "buyer", due: "Within 2 days" }
          ]
        },
        {
          id: "buyer-bond",
          title: "Bond approval and conditions",
          description: "Track approval, conditions and guarantees before the transfer handover.",
          owner: "finance",
          due: "Within 5 days",
          progress: 78,
          next: "Confirm bond approval conditions",
          documents: [
            { name: "Bond approval letter", owner: "finance", due: "Within 5 days" }
          ]
        }
      ]
    },
    {
      id: "transfer-standard",
      journey: "transfer",
      name: "Transfer and registration playbook",
      description: "A proactive conveyancing checklist from instruction through registration and handover.",
      reminderLadder: "7, 5, 3, 2 and 1 days before due date",
      milestones: [
        {
          id: "transfer-instruction",
          title: "Instruction and legal FICA",
          description: "Confirm instruction, responsible parties and the attorney compliance pack.",
          owner: "attorney",
          due: "Within 3 days",
          progress: 20,
          next: "Complete attorney instruction and FICA checks",
          documents: [
            { name: "Attorney FICA pack", owner: "attorney", due: "Within 3 days" }
          ]
        },
        {
          id: "transfer-finance",
          title: "Finance and guarantees",
          description: "Track bond approval, guarantees and any linked settlement requirements.",
          owner: "finance",
          due: "Within 5 days",
          progress: 44,
          next: "Confirm guarantees and finance conditions",
          documents: [
            { name: "Bond approval letter", owner: "finance", due: "Within 5 days" },
            { name: "Guarantee confirmation", owner: "finance", due: "Within 5 days" }
          ]
        },
        {
          id: "transfer-clearance",
          title: "Rates and compliance clearance",
          description: "Anticipate municipal and compliance requirements before they delay lodgement.",
          owner: "attorney",
          due: "Within 5 days",
          progress: 68,
          next: "Secure rates and compliance certificates",
          documents: [
            { name: "Rates clearance certificate", owner: "attorney", due: "Within 5 days" },
            { name: "Electrical compliance certificate", owner: "seller", due: "Within 5 days" }
          ]
        },
        {
          id: "transfer-signing",
          title: "Signing and lodgement",
          description: "Coordinate signatures, confirm readiness and publish the lodgement milestone.",
          owner: "attorney",
          due: "Within 3 days",
          progress: 84,
          next: "Sign transfer documents and confirm lodgement",
          documents: [
            { name: "Transfer documents", owner: "buyer", due: "Within 3 days" }
          ]
        },
        {
          id: "transfer-registration",
          title: "Registration and handover",
          description: "Confirm registration, notify all parties and close the auditable journey.",
          owner: "attorney",
          due: "Within 2 days",
          progress: 100,
          next: "Confirm registration and handover",
          documents: []
        }
      ]
    }
  ];
}

function createDefaultOperationsStore() {
  return {
    version: 4,
    cases: [
      { id: "AX-1048", client: "Johan & Mia Botha", journey: "seller", area: "Parys", property: "3-bedroom family home", value: "R1.75m - R1.95m", stage: "Market preparation", next: "Upload certified ID", owner: "Seller", due: "Today", status: "At risk", progress: 58, agent: "Elize van Zyl", concierge: "Stefan Roodt", attorney: "Moyo Attorneys", finance: "ABSA Home Loans", birthdays: { seller: "05-12", buyer: null } },
      { id: "AX-1053", client: "Naledi Mokoena", journey: "buyer", area: "Sandton", property: "2-bedroom sectional title", value: "Budget R2.4m", stage: "Bond pre-approval", next: "Upload latest payslip", owner: "Buyer", due: "Tomorrow", status: "In progress", progress: 32, agent: "Thabo Nkosi", concierge: "Lerato Maseko", attorney: "To appoint", finance: "ooba Bond Originators", birthdays: { seller: null, buyer: "09-03" } },
      { id: "AX-1042", client: "Sarah Jacobs", journey: "transfer", area: "Stellenbosch", property: "4-bedroom freehold house", value: "Sale R5.85m", stage: "Rates clearance", next: "Municipal clearance certificate", owner: "Attorney", due: "3 Jun", status: "Waiting", progress: 78, agent: "Anja Smit", concierge: "Lerato Maseko", attorney: "Van der Merwe Inc.", finance: "FNB Home Loans", birthdays: { seller: null, buyer: null } },
      { id: "AX-1058", client: "Kabelo Dlamini", journey: "seller", area: "Midrand", property: "3-bedroom townhouse", value: "Expected R1.65m", stage: "Agent matching", next: "Agent accepts lead", owner: "Agent", due: "2h overdue", status: "At risk", progress: 18, agent: "Peter Jacobs", concierge: "Stefan Roodt", attorney: "To appoint", finance: "To appoint", birthdays: { seller: null, buyer: null } },
      { id: "AX-1039", client: "Ayesha Khan", journey: "transfer", area: "Umhlanga", property: "2-bedroom apartment", value: "Sale R3.15m", stage: "Lodgement preparation", next: "Sign transfer documents", owner: "Buyer", due: "4 Jun", status: "In progress", progress: 86, agent: "Nandi Naidoo", concierge: "Lerato Maseko", attorney: "Naidoo Legal", finance: "Standard Bank", birthdays: { seller: null, buyer: "11-21" } },
      { id: "AX-1061", client: "Michael Smith", journey: "buyer", area: "Fourways", property: "Family home", value: "Budget R3.8m", stage: "Property matching", next: "Review curated shortlist", owner: "Buyer", due: "Today", status: "In progress", progress: 24, agent: "Thabo Nkosi", concierge: "Stefan Roodt", attorney: "To appoint", finance: "Bond pre-check pending", birthdays: { seller: null, buyer: null } }
    ],
    documents: [
      { id: "DOC-1048-ID", name: "Certified identity document", caseId: "AX-1048", owner: "Johan Botha - Seller", due: "Today", reminder: "WhatsApp - 2h ago", status: "Overdue" },
      { id: "DOC-1053-PAY", name: "Latest payslip", caseId: "AX-1053", owner: "Naledi Mokoena - Buyer", due: "Tomorrow", reminder: "WhatsApp - Today", status: "Requested" },
      { id: "DOC-1042-RATES", name: "Rates clearance certificate", caseId: "AX-1042", owner: "Van der Merwe Inc. - Attorney", due: "3 Jun", reminder: "Email - Today", status: "Requested" },
      { id: "DOC-1048-POA", name: "Proof of address", caseId: "AX-1048", owner: "Mia Botha - Seller", due: "30 May", reminder: "Approved by AI", status: "Approved" },
      { id: "DOC-1048-MANDATE", name: "Signed mandate agreement", caseId: "AX-1048", owner: "Elize van Zyl - Agent", due: "28 May", reminder: "Approved by concierge", status: "Approved" },
      { id: "DOC-1039-BOND", name: "Bond approval letter", caseId: "AX-1039", owner: "Standard Bank - Finance", due: "29 May", reminder: "Uploaded - 1h ago", status: "Uploaded" },
      { id: "DOC-1039-TRANSFER", name: "Transfer documents", caseId: "AX-1039", owner: "Ayesha Khan - Buyer", due: "4 Jun", reminder: "WhatsApp - Scheduled", status: "Requested" },
      { id: "DOC-1042-COC", name: "Electrical compliance certificate", caseId: "AX-1042", owner: "Sarah Jacobs - Seller", due: "7 Jun", reminder: "Not sent yet", status: "Upcoming" }
    ],
    timeline: {
      "AX-1048": [
        ["30 May - 16:45", "AI reminder sent via WhatsApp", "Johan was reminded to upload his certified ID. Concierge escalation created because the item is due today."],
        ["30 May - 10:10", "Seller uploaded proof of address", "AI document check passed. Approved automatically and added to the FICA pack."],
        ["29 May - 14:30", "Mandate signed", "Elize van Zyl uploaded the signed sole mandate. Concierge approved the document."],
        ["29 May - 09:15", "Area specialist assigned", "Elize van Zyl accepted the seller lead within the 2-hour service level."],
        ["28 May - 16:20", "CMA-lite reviewed", "Concierge approved a preliminary market range of R1.75m - R1.95m."],
        ["28 May - 08:45", "Seller profile completed", "Johan completed the property brief using the WhatsApp route."],
        ["27 May - 19:02", "Account created", "Seller registered through the Axiom Realty AI lead engine."]
      ]
    },
    activities: [
      ["DOC", "Proof of address approved", "AX-1048 - Seller FICA pack - AI verified", "6 min ago"],
      ["AI", "Client question answered", "AX-1053 - Bond pre-approval process explained", "18 min ago"],
      ["MSG", "Attorney reminder delivered", "AX-1042 - Rates clearance certificate", "32 min ago"],
      ["AGT", "Agent accepted new lead", "AX-1060 - Response time 47 minutes", "1h ago"],
      ["UP", "Bond approval uploaded", "AX-1039 - Awaiting concierge review", "1h ago"]
    ],
    notifications: [],
    escalations: [],
    resolvedItems: [],
    automation: {
      lastSweepAt: null,
      lastDeliveryRunAt: null,
      lastSweepSummary: null,
      lastPhase2RunAt: null,
      lastPhase2Summary: null,
      lastLeadAutomationRunAt: null,
      lastLeadAutomationSummary: null,
      lastLeadProactiveAutomationRunAt: null,
      lastLeadProactiveAutomationSummary: null,
      lastLeadDeadlineAutomationRunAt: null,
      lastLeadDeadlineAutomationSummary: null,
      lastConciergeDigestDay: null,
      lastConciergeDigestAt: null,
      lastConciergeDigestStatus: null,
      lastConciergeDigestReason: null
    },
    playbooks: createDefaultOperationsPlaybooks(),
    workflowRuns: {},
    priorities: [
      { level: "high", caseId: "AX-1048", client: "Johan Botha", issue: "Certified ID overdue", detail: "AI sent 2 reminders - Concierge WhatsApp follow-up recommended", due: "Today" },
      { level: "high", caseId: "AX-1058", client: "Kabelo Dlamini", issue: "Agent has not accepted lead", detail: "Peter Jacobs assigned 4 hours ago - SLA missed by 2 hours", due: "2h overdue" },
      { level: "medium", caseId: "AX-1042", client: "Sarah Jacobs", issue: "Rates clearance follow-up", detail: "Attorney requested municipal certificate - Check expected date", due: "3 Jun" },
      { level: "medium", caseId: "AX-1039", client: "Ayesha Khan", issue: "Bond approval ready for review", detail: "Standard Bank uploaded approval letter - Confirm conditions", due: "Today" }
    ],
    humanTakeover: {},
    identities: [],
    otpChallenges: [],
    appointments: [],
    accessLinks: [],
    caseNotes: [],
    whatsappInbox: [],
    auditLog: []
  };
}

function dedupeOperationsNotifications(notifications) {
  const seen = new Set();
  return notifications.filter((item) => {
    if (!item.dedupeKey) return true;
    if (seen.has(item.dedupeKey)) return false;
    seen.add(item.dedupeKey);
    return true;
  });
}

function normalizeOperationsWhatsappInbox(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const source = sanitizeShortText(entry.source || "", 80);
    const senderRole = sanitizeShortText(entry.senderRole || "", 40).toLowerCase();
    const hasRecipientPhone = Boolean(cleanPhoneNumber(entry.recipientPhone || ""));
    const hasSenderPhone = Boolean(cleanPhoneNumber(entry.senderPhone || entry.senderCellphone || ""));
    const looksLikeLegacyOutbound =
      entry.direction === "inbound" &&
      senderRole === "concierge" &&
      hasRecipientPhone &&
      !hasSenderPhone &&
      (source === "admin-reply" || source.startsWith("inbound-command:"));
    if (!looksLikeLegacyOutbound) return entry;
    return {
      ...entry,
      direction: "outbound",
      status: entry.status || "queued",
      readAt: entry.readAt || entry.createdAt || new Date().toISOString()
    };
  });
}

function normalizeOperationsCaseNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((entry) => entry && typeof entry === "object" && entry.caseId)
    .map((entry) => ({
      id: entry.id || randomUUID(),
      createdAt: entry.createdAt || new Date().toISOString(),
      caseId: entry.caseId,
      category: sanitizeShortText(entry.category || "General", 80) || "General",
      title: sanitizeShortText(entry.title || "Case note", 180) || "Case note",
      note: sanitizeShortText(entry.note || "", 4000),
      source: sanitizeShortText(entry.source || "system", 80) || "system",
      createdBy: sanitizeShortText(entry.createdBy || "System", 120) || "System",
      transcript: sanitizeShortText(entry.transcript || "", 8000),
      summary: sanitizeShortText(entry.summary || "", 1200),
      media: entry.media && typeof entry.media === "object"
        ? {
            storageName: entry.media.storageName || null,
            originalName: sanitizeShortText(entry.media.originalName || "", 180) || "voice-note",
            mimeType: sanitizeShortText(entry.media.mimeType || "", 120).toLowerCase() || "application/octet-stream",
            size: Number(entry.media.size || 0) || 0,
            durationSeconds: Number(entry.media.durationSeconds || 0) || null
          }
        : null
    }));
}

function loadPersistedOperations() {
  try {
    ensureDataDir();
    if (!fs.existsSync(operationsFile)) {
      persistOperations();
      return;
    }
    const raw = fs.readFileSync(operationsFile, "utf8");
    if (!raw.trim()) return;
    const stored = JSON.parse(raw);
    if (!stored || !Array.isArray(stored.cases) || !Array.isArray(stored.documents)) return;
    operationsStore = {
      ...createDefaultOperationsStore(),
      ...stored,
      timeline: stored.timeline || {},
      activities: stored.activities || [],
      notifications: dedupeOperationsNotifications((stored.notifications || []).map((item) => ({
        attempts: 0,
        lastAttemptAt: null,
        deliveredAt: null,
        nextRetryAt: null,
        lastError: null,
        providerStatus: null,
        ...item,
        recipientPhone: item.recipientPhone || resolveOperationsRecipientPhone(item.recipient, item.caseId),
        recipientEmail: item.recipientEmail || resolveOperationsRecipientEmail(item.recipient, item.caseId, item.stakeholderCode || "")
      }))),
      escalations: stored.escalations || [],
      resolvedItems: stored.resolvedItems || [],
      automation: { ...createDefaultOperationsStore().automation, ...(stored.automation || {}) },
      playbooks: Array.isArray(stored.playbooks) && stored.playbooks.length ? stored.playbooks : createDefaultOperationsPlaybooks(),
      workflowRuns: stored.workflowRuns || {},
      priorities: stored.priorities || createDefaultOperationsStore().priorities,
      identities: Array.isArray(stored.identities) ? stored.identities : [],
      otpChallenges: Array.isArray(stored.otpChallenges) ? stored.otpChallenges : [],
      appointments: Array.isArray(stored.appointments) ? stored.appointments.map((entry) => normalizeOperationsAppointment(entry)) : [],
      accessLinks: Array.isArray(stored.accessLinks) ? stored.accessLinks : [],
      caseNotes: normalizeOperationsCaseNotes(stored.caseNotes),
      whatsappInbox: normalizeOperationsWhatsappInbox(stored.whatsappInbox),
      auditLog: stored.auditLog || []
    };
    for (const item of operationsStore.cases || []) {
      normalizeCaseBirthdays(item);
      normalizeCaseMovingServices(item);
      normalizeCaseComplianceSupport(item);
      normalizeCaseFinanceSupport(item);
      normalizeCaseHumanTakeover(item);
      normalizeCaseStakeholders(item);
      normalizeCaseStakeholderEmails(item);
    }
    reconcileOperationsPriorities();
    persistOperations();
  } catch {
    // Continue with the seeded demo store if the local file cannot be read.
  }
}

function persistOperations() {
  try {
    ensureDataDir();
    writeJsonFile(operationsFile, operationsStore, { backupDir: dataBackupsDir });
  } catch {
    // Keep the local prototype responsive if a write fails.
  }
}

function ensureOperationsWhatsappInbox() {
  operationsStore.whatsappInbox = Array.isArray(operationsStore.whatsappInbox) ? operationsStore.whatsappInbox : [];
  return operationsStore.whatsappInbox;
}

function ensureOperationsCaseNotes() {
  operationsStore.caseNotes = Array.isArray(operationsStore.caseNotes) ? operationsStore.caseNotes : [];
  return operationsStore.caseNotes;
}

const operationsAppointmentStatuses = new Set([
  "proposed",
  "pending-confirmation",
  "confirmed",
  "reschedule-requested",
  "completed",
  "missed",
  "cancelled"
]);

function normalizeOperationsAppointment(entry = {}) {
  const scheduledFor = entry?.scheduledFor && !Number.isNaN(new Date(entry.scheduledFor).getTime()) ? new Date(entry.scheduledFor).toISOString() : null;
  const participantRole = sanitizeShortText(entry?.participantRole || "", 40).toLowerCase();
  const participantPhone = cleanPhoneNumber(entry?.participantPhone || "") || "";
  const requestedStatus = sanitizeShortText(entry?.status || "", 60).toLowerCase();
  const status = operationsAppointmentStatuses.has(requestedStatus) ? requestedStatus : participantPhone ? "pending-confirmation" : "proposed";
  return {
    id: entry?.id || randomUUID(),
    caseId: sanitizeShortText(entry?.caseId || "", 40),
    kind: sanitizeShortText(entry?.kind || "appointment", 60) || "appointment",
    title: sanitizeShortText(entry?.title || "", 160) || "",
    participantName: sanitizeShortText(entry?.participantName || "", 160) || "",
    participantPhone,
    participantRole: isValidOperationsParticipantRole(participantRole) ? participantRole : "",
    scheduledFor,
    location: sanitizeShortText(entry?.location || "", 200) || "",
    notes: sanitizeShortText(entry?.notes || "", 500) || "",
    status,
    confirmationRequired: Boolean(entry?.confirmationRequired !== false && participantPhone),
    createdAt: entry?.createdAt && !Number.isNaN(new Date(entry.createdAt).getTime()) ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: entry?.updatedAt && !Number.isNaN(new Date(entry.updatedAt).getTime()) ? new Date(entry.updatedAt).toISOString() : new Date().toISOString(),
    createdBy: sanitizeShortText(entry?.createdBy || "System", 160) || "System",
    confirmedAt: entry?.confirmedAt && !Number.isNaN(new Date(entry.confirmedAt).getTime()) ? new Date(entry.confirmedAt).toISOString() : null,
    completedAt: entry?.completedAt && !Number.isNaN(new Date(entry.completedAt).getTime()) ? new Date(entry.completedAt).toISOString() : null,
    cancelledAt: entry?.cancelledAt && !Number.isNaN(new Date(entry.cancelledAt).getTime()) ? new Date(entry.cancelledAt).toISOString() : null,
    cancelledBy: sanitizeShortText(entry?.cancelledBy || "", 160) || "",
    missedAt: entry?.missedAt && !Number.isNaN(new Date(entry.missedAt).getTime()) ? new Date(entry.missedAt).toISOString() : null,
    rescheduleRequestedAt: entry?.rescheduleRequestedAt && !Number.isNaN(new Date(entry.rescheduleRequestedAt).getTime()) ? new Date(entry.rescheduleRequestedAt).toISOString() : null,
    lastReminderAt: entry?.lastReminderAt && !Number.isNaN(new Date(entry.lastReminderAt).getTime()) ? new Date(entry.lastReminderAt).toISOString() : null,
    lastNotificationId: entry?.lastNotificationId || null
  };
}

function ensureOperationsAppointments() {
  operationsStore.appointments = Array.isArray(operationsStore.appointments) ? operationsStore.appointments.map((entry) => normalizeOperationsAppointment(entry)) : [];
  return operationsStore.appointments;
}

function listCaseAppointments(caseId) {
  return ensureOperationsAppointments()
    .filter((entry) => entry.caseId === caseId)
    .sort((a, b) => {
      const aTime = new Date(a.scheduledFor || a.createdAt || 0).getTime();
      const bTime = new Date(b.scheduledFor || b.createdAt || 0).getTime();
      return aTime - bTime;
    });
}

function getCaseUpcomingAppointment(caseId, { role = "", phone = "" } = {}) {
  const cleanPhone = cleanPhoneNumber(phone || "") || "";
  return listCaseAppointments(caseId).find((entry) => {
    if (["completed", "cancelled", "missed"].includes(entry.status)) return false;
    if (role && entry.participantRole && entry.participantRole !== role) return false;
    if (cleanPhone && entry.participantPhone && entry.participantPhone !== cleanPhone) return false;
    return true;
  }) || null;
}

function findOperationsAppointment(appointmentId) {
  return ensureOperationsAppointments().find((entry) => entry.id === appointmentId) || null;
}

function formatOperationsAppointmentKind(kind = "") {
  const normalized = String(kind || "").trim().toLowerCase();
  return (
    {
      viewing: "Viewing",
      valuation: "Valuation",
      signing: "Signing",
      callback: "Callback",
      inspection: "Inspection"
    }[normalized] || humanizeLabel(normalized || "appointment")
  );
}

function formatOperationsAppointmentTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "time to be confirmed";
  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildAppointmentWhatsappMessage(item, appointment, { mode = "scheduled" } = {}) {
  const label = appointment?.title || formatOperationsAppointmentKind(appointment?.kind || "appointment");
  const whenText = formatOperationsAppointmentTime(appointment?.scheduledFor);
  const locationText = appointment?.location ? ` at ${appointment.location}` : "";
  if (mode === "scheduled") {
    return `${item.id}: ${label} has been booked for ${whenText}${locationText}. Reply CONFIRM to lock it in, RESCHEDULE if you need a different time, or MISSED if this slot falls away.`;
  }
  if (mode === "confirm-reminder") {
    return `${item.id}: friendly reminder to confirm your ${label.toLowerCase()} for ${whenText}${locationText}. Reply CONFIRM to lock it in or RESCHEDULE if you need a different time.`;
  }
  if (mode === "day-of") {
    return `${item.id}: your ${label.toLowerCase()} is today at ${whenText}${locationText}. Reply CALL ME if you need help or MISSED if this slot can no longer happen.`;
  }
  if (mode === "reschedule-ack") {
    return `${item.id}: thank you, we have flagged your ${label.toLowerCase()} for rescheduling. A concierge will send a new time shortly.`;
  }
  if (mode === "missed-ack") {
    return `${item.id}: thank you, we have marked the ${label.toLowerCase()} as missed and reopened scheduling follow-up. A concierge will contact you with the next slot.`;
  }
  if (mode === "confirmed-ack") {
    return `${item.id}: thank you, your ${label.toLowerCase()} for ${whenText}${locationText} is confirmed.`;
  }
  if (mode === "cancelled") {
    return `${item.id}: your ${label.toLowerCase()} scheduled for ${whenText}${locationText} has been cancelled. We will follow up with the next step if needed.`;
  }
  return `${item.id}: ${label} update recorded for ${whenText}${locationText}.`;
}

function getCaseWhatsappMessages(caseId) {
  return ensureOperationsWhatsappInbox()
    .filter((item) => item.caseId === caseId)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

function getOperationsCaseNotes(caseId) {
  return ensureOperationsCaseNotes()
    .filter((item) => item.caseId === caseId)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function findOperationsCaseByParticipantPhone(cellphone = "") {
  const clean = cleanPhoneNumber(cellphone);
  if (!clean) return null;
  const matches = [];
  for (const item of operationsStore.cases || []) {
    const candidatePhones = [
      resolveCaseParticipantPhone(item, "seller"),
      resolveCaseParticipantPhone(item, "buyer"),
      cleanPhoneNumber(item.agentPhone || ""),
      cleanPhoneNumber(item.attorneyPhone || ""),
      cleanPhoneNumber(item.financePhone || "")
    ].filter(Boolean);
    if (candidatePhones.includes(clean)) matches.push(item);
  }
  return matches.length === 1 ? matches[0] : null;
}

function appendOperationsWhatsappMessage(entry = {}) {
  const inbox = ensureOperationsWhatsappInbox();
  const direction = sanitizeShortText(entry.direction || "inbound", 20).toLowerCase() === "outbound" ? "outbound" : "inbound";
  const status = sanitizeShortText(entry.status || "", 120) || (direction === "outbound" ? "queued" : "captured");
  const message = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status,
    direction,
    transport: "whatsapp",
    readAt: null,
    caseId: entry.caseId || "",
    senderName: sanitizeShortText(entry.senderName || entry.sender || "Participant", 160),
    senderPhone: cleanPhoneNumber(entry.senderPhone || entry.senderCellphone || "") || "",
    senderRole: sanitizeShortText(entry.senderRole || "", 40).toLowerCase() || null,
    recipientName: sanitizeShortText(entry.recipientName || "", 160) || "",
    recipientPhone: cleanPhoneNumber(entry.recipientPhone || "") || "",
    recipientRole: sanitizeShortText(entry.recipientRole || "", 40).toLowerCase() || null,
    text: sanitizeShortText(entry.text || "", 2000),
    source: sanitizeShortText(entry.source || "whatsapp-webhook", 80),
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
    providerStatus: sanitizeShortText(entry.providerStatus || "", 120) || null,
    notificationId: entry.notificationId || null,
    linkedDocumentIds: Array.isArray(entry.linkedDocumentIds) ? entry.linkedDocumentIds : []
  };
  if (message.direction === "outbound") {
    message.readAt = message.createdAt;
  }
  inbox.unshift(message);
  operationsStore.whatsappInbox = inbox.slice(0, 2000);
  return message;
}

function markOperationsWhatsappMessagesRead(caseId, actor = "Concierge") {
  const now = new Date().toISOString();
  let updated = 0;
  for (const item of ensureOperationsWhatsappInbox()) {
    if (item.caseId !== caseId || item.direction !== "inbound" || item.readAt) continue;
    item.readAt = now;
    item.readBy = sanitizeShortText(actor, 120) || "Concierge";
    updated += 1;
  }
  return updated;
}

function isAllowedInboundDocumentType(mimeType = "", filename = "") {
  const normalizedMime = String(mimeType || "").toLowerCase();
  const lowerName = String(filename || "").toLowerCase();
  const allowedMime = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
  ]);
  if (allowedMime.has(normalizedMime)) return true;
  return [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".txt"].some((ext) => lowerName.endsWith(ext));
}

function parseInboundWhatsAppAttachments(body = {}) {
  const raw = [];
  if (Array.isArray(body.attachments)) raw.push(...body.attachments);
  if (Array.isArray(body.media)) raw.push(...body.media);
  if (body.attachment && typeof body.attachment === "object") raw.push(body.attachment);
  if (!raw.length && (body.base64 || body.dataBase64 || body.mediaBase64 || body.mediaDataBase64 || body.mediaUrl || body.url)) {
    raw.push({
      filename: body.filename || body.name || "whatsapp-upload",
      mimeType: body.mimeType || body.mediaMimeType || "",
      base64: body.base64 || body.dataBase64 || body.mediaBase64 || body.mediaDataBase64 || "",
      url: body.mediaUrl || body.url || "",
      caption: body.caption || "",
      documentName: body.documentName || body.category || ""
    });
  }
  return raw
    .map((item) => ({
      filename: safeBaseFilename(sanitizeShortText(item?.filename || item?.name || "whatsapp-upload", 180)),
      mimeType: sanitizeShortText(item?.mimeType || item?.type || "", 120).toLowerCase(),
      base64: String(item?.base64 || item?.dataBase64 || item?.mediaBase64 || item?.mediaDataBase64 || "").trim(),
      url: sanitizeShortText(item?.url || "", 1200),
      caption: sanitizeShortText(item?.caption || "", 500),
      documentName: sanitizeShortText(item?.documentName || item?.category || "", 180),
      transcript: sanitizeShortText(item?.transcript || item?.voiceTranscript || item?.textTranscript || item?.speechToText || "", 8000),
      durationSeconds: Number(item?.durationSeconds || item?.duration || 0) || null
    }))
    .filter((item) => item.filename || item.base64 || item.url);
}

function decodeInboundAttachmentBytes(attachment) {
  const raw = String(attachment?.base64 || "").trim();
  if (!raw) return null;
  const clean = raw.includes(",") ? raw.split(",").pop() : raw;
  try {
    const bytes = Buffer.from(clean || "", "base64");
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchInboundAttachmentBytes(url) {
  const mediaUrl = String(url || "").trim();
  if (!mediaUrl) return null;
  if (!/^https?:\/\//i.test(mediaUrl)) return null;
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 0 && length > WHATSAPP_VOICE_TRANSCRIBE_MAX_BYTES) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return null;
    if (bytes.length > WHATSAPP_VOICE_TRANSCRIBE_MAX_BYTES) return null;
    return {
      bytes,
      mimeType: sanitizeShortText(response.headers.get("content-type") || "", 120).toLowerCase()
    };
  } catch {
    return null;
  }
}

function inferVoiceTranscriptResult(raw, source) {
  if (!raw) return "";
  if (typeof raw === "string") return sanitizeShortText(raw, 8000);
  if (typeof raw.text === "string") return sanitizeShortText(raw.text, 8000);
  if (typeof raw.transcript === "string") return sanitizeShortText(raw.transcript, 8000);
  if (typeof raw.data === "string") return sanitizeShortText(raw.data, 8000);
  if (Array.isArray(raw.segments)) {
    const combined = raw.segments
      .map((segment) => String(segment?.text || segment?.transcript || ""))
      .filter(Boolean)
      .join(" ");
    if (combined) return sanitizeShortText(combined, 8000);
  }
  return "";
}

async function transcribeInboundVoiceNote(bytes, { model = "", originalName = "", mimeType = "audio/ogg", source = "inbound" } = {}) {
  if (!WHATSAPP_VOICE_TRANSCRIBE_URL) {
    return { ok: false, reason: "transcription-not-configured", source: sanitizeShortText(source, 120) };
  }
  const voiceBuffer = bytes;
  if (!voiceBuffer?.length) {
    return { ok: false, reason: "no-audio-bytes", source: sanitizeShortText(source, 120) };
  }
  if (voiceBuffer.length > WHATSAPP_VOICE_TRANSCRIBE_MAX_BYTES) {
    return { ok: false, reason: "audio-too-large", source: sanitizeShortText(source, 120) };
  }
  const normalizedModel = model || WHATSAPP_VOICE_TRANSCRIBE_MODEL || "whisper-1";
  const fileName = safeBaseFilename(originalName || `voice-note-${Date.now()}.ogg`);
  const headers = WHATSAPP_VOICE_TRANSCRIBE_API_KEY ? { Authorization: `Bearer ${WHATSAPP_VOICE_TRANSCRIBE_API_KEY}` } : {};
  const body = new FormData();
  body.append("file", new Blob([voiceBuffer], { type: mimeType || "audio/ogg" }), fileName);
  body.append("model", normalizedModel);
  body.append("response_format", "json");

  const timeout = Number.isFinite(WHATSAPP_VOICE_TRANSCRIBE_TIMEOUT_MS) && WHATSAPP_VOICE_TRANSCRIBE_TIMEOUT_MS > 0
    ? WHATSAPP_VOICE_TRANSCRIBE_TIMEOUT_MS
    : 30000;
  const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(timeout)
    : null;

  try {
    const response = await fetch(WHATSAPP_VOICE_TRANSCRIBE_URL, {
      method: "POST",
      headers,
      body,
      ...(signal ? { signal } : {})
    });
    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: `transcription-request-failed`,
        source: sanitizeShortText(source, 120),
        status: response.status || null,
        error: sanitizeShortText(parsed?.error?.message || parsed?.detail || raw || "", 200)
      };
    }

    const transcript = inferVoiceTranscriptResult(parsed || {}, source);
    if (transcript) {
      return {
        ok: true,
        transcript,
        source: "stt",
        raw
      };
    }
    return {
      ok: false,
      reason: "transcription-empty",
      source: sanitizeShortText(source, 120),
      error: sanitizeShortText(parsed?.error?.message || raw || "", 200)
    };
  } catch (error) {
    if (error?.name === "TimeoutError") {
      return { ok: false, reason: "transcription-timeout", source: sanitizeShortText(source, 120), error: error?.message || "transcription request timed out" };
    }
    return {
      ok: false,
      reason: "transcription-error",
      source: sanitizeShortText(source, 120),
      error: sanitizeShortText(error?.message || "", 200)
    };
  }
}

function isInboundVoiceNoteAttachment(attachment = {}) {
  const mime = String(attachment?.mimeType || "").toLowerCase();
  const filename = String(attachment?.filename || "").toLowerCase();
  if (mime.startsWith("audio/")) return true;
  return [".ogg", ".opus", ".mp3", ".m4a", ".aac", ".wav", ".webm"].some((ext) => filename.endsWith(ext));
}

function extractInboundVoiceTranscript(attachment = {}, messageText = "") {
  return sanitizeShortText(
    attachment.transcript ||
      attachment.voiceTranscript ||
      attachment.textTranscript ||
      attachment.speechToText ||
      attachment.text ||
      messageText ||
      "",
    8000
  );
}

function summarizeInboundVoiceTranscript(transcript = "") {
  const clean = sanitizeShortText(String(transcript || "").replace(/\s+/g, " ").trim(), 4000);
  if (!clean) return "";
  if (clean.length <= 280) return clean;
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = "";
  for (const sentence of sentences) {
    const next = summary ? `${summary} ${sentence}` : sentence;
    if (next.length > 280) break;
    summary = next;
  }
  return summary || `${clean.slice(0, 277)}...`;
}

function storeInboundSecureMedia(bytes, { originalName = "upload.bin", mimeType = "application/octet-stream" } = {}) {
  ensureDataDir();
  if (!fs.existsSync(secureDocumentsDir)) fs.mkdirSync(secureDocumentsDir, { recursive: true });
  const storageName = `${randomUUID()}.bin`;
  fs.writeFileSync(path.join(secureDocumentsDir, storageName), bytes);
  return {
    storageName,
    originalName: safeBaseFilename(originalName),
    mimeType: sanitizeShortText(mimeType, 120).toLowerCase() || "application/octet-stream",
    size: bytes.length
  };
}

function normalizeLooseText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inboundTextHasAny(normalizedValue = "", phrases = []) {
  const normalized = normalizeLooseText(normalizedValue);
  if (!normalized) return false;
  return phrases.some((phrase) => normalized.includes(normalizeLooseText(phrase)));
}

function inferInboundDocumentNames(attachment = {}, messageText = "") {
  const combined = normalizeLooseText([
    attachment.documentName,
    attachment.caption,
    attachment.filename,
    messageText
  ]
    .filter(Boolean)
    .join(" "));
  if (!combined) return [];
  const names = new Set();
  if (inboundTextHasAny(combined, ["fica", "id", "identity document", "identity copy", "certified id", "passport"])) {
    names.add("Certified identity document");
  }
  if (inboundTextHasAny(combined, ["fica", "proof of address", "utility bill", "municipal account", "rates account"])) {
    names.add("Proof of address");
  }
  if (inboundTextHasAny(combined, ["payslip", "pay slip", "salary slip", "salary advice"])) {
    names.add("Latest payslip");
  }
  if (inboundTextHasAny(combined, ["bank statement", "bank statements"])) {
    names.add("Latest bank statements");
  }
  if (inboundTextHasAny(combined, ["otp", "offer to purchase", "signed offer", "sale agreement"])) {
    names.add("Signed offer to purchase");
  }
  if (inboundTextHasAny(combined, ["mandate", "listing mandate"])) {
    names.add("Signed mandate agreement");
  }
  if (inboundTextHasAny(combined, ["property condition disclosure", "disclosure form", "condition disclosure"])) {
    names.add("Property condition disclosure form");
  }
  if (inboundTextHasAny(combined, ["bond approval", "approval letter"])) {
    names.add("Bond approval letter");
  }
  if (inboundTextHasAny(combined, ["guarantee confirmation", "guarantee letter", "guarantees"])) {
    names.add("Guarantee confirmation");
  }
  if (inboundTextHasAny(combined, ["attorney fica", "legal fica"])) {
    names.add("Attorney FICA pack");
  }
  if (inboundTextHasAny(combined, ["rates clearance", "clearance certificate"])) {
    names.add("Rates clearance certificate");
  }
  if (inboundTextHasAny(combined, ["electrical coc", "electrical compliance", "certificate of compliance"])) {
    names.add("Electrical compliance certificate");
  }
  if (inboundTextHasAny(combined, ["transfer docs", "transfer documents", "signed transfer"])) {
    names.add("Transfer documents");
  }
  return [...names];
}

function isOperationsDocumentRoleMatch(doc, role = "") {
  if (!role) return true;
  const owner = normalizeLooseText(doc?.owner || "");
  if (!owner) return true;
  if (role === "seller") return owner.includes("seller") || owner.includes("participant");
  if (role === "buyer") return owner.includes("buyer") || owner.includes("participant");
  if (role === "agent") return owner.includes("agent");
  if (role === "attorney") return owner.includes("attorney") || owner.includes("convey");
  if (role === "finance") return owner.includes("finance") || owner.includes("bond") || owner.includes("bank") || owner.includes("originator");
  return true;
}

function findBestInboundDocumentMatch(candidates = [], desiredName = "", usedIds = new Set()) {
  const desired = normalizeLooseText(desiredName);
  if (!desired) return null;
  const exact = candidates.find((doc) => !usedIds.has(doc.id) && normalizeLooseText(doc.name) === desired);
  if (exact) return exact;
  const fuzzy = candidates.find((doc) => {
    if (usedIds.has(doc.id)) return false;
    const docName = normalizeLooseText(doc.name);
    return docName.includes(desired) || desired.includes(docName);
  });
  return fuzzy || null;
}

function inferInboundDocumentMatches(item, role, attachment, messageText = "") {
  const fallbackName = attachment.documentName || attachment.caption || attachment.filename || "WhatsApp upload";
  const desiredNames = inferInboundDocumentNames(attachment, messageText);
  const roleCandidates = (operationsStore.documents || []).filter((doc) => doc.caseId === item.id && isOperationsDocumentRoleMatch(doc, role));
  const openCandidates = roleCandidates.filter((doc) => !["Approved", "Uploaded"].includes(doc.status) || !doc.file?.storageName);
  const candidates = openCandidates.length ? openCandidates : roleCandidates.filter((doc) => !doc.file?.storageName);
  const matches = [];
  const usedIds = new Set();

  for (const desiredName of desiredNames) {
    const match = findBestInboundDocumentMatch(candidates, desiredName, usedIds);
    if (!match) continue;
    usedIds.add(match.id);
    matches.push(match);
  }

  if (!matches.length) {
    const directMatch = findBestInboundDocumentMatch(candidates, fallbackName, usedIds);
    if (directMatch) matches.push(directMatch);
  }

  if (!matches.length && candidates.length === 1) matches.push(candidates[0]);
  return {
    fallbackName,
    desiredNames,
    roleCandidates,
    matches
  };
}

function upsertOperationsDocumentFromWhatsapp(item, { sender = "", senderRole = "", attachment = {}, messageText = "" } = {}) {
  const bytes = decodeInboundAttachmentBytes(attachment);
  const fileBacked = Boolean(bytes);
  const safeMime = attachment.mimeType || "application/octet-stream";
  const safeNameBase = attachment.filename || `whatsapp-${senderRole || "upload"}${extFromMime(safeMime)}`;
  const originalName = safeBaseFilename(safeNameBase);
  const note = attachment.caption || attachment.documentName || "";
  const inferred = inferInboundDocumentMatches(item, senderRole, attachment, messageText);
  const ownerRoleLabel = senderRole ? getOperationsRoleLabel(senderRole) : "Participant";
  const desiredNames = inferred.desiredNames.length ? inferred.desiredNames : [attachment.documentName || inferred.fallbackName || originalName];
  const targets = inferred.matches.map((document) => ({ document, created: false }));
  for (const desiredName of desiredNames) {
    const alreadyMatched = targets.some((target) => normalizeLooseText(target.document?.name || target.name || "") === normalizeLooseText(desiredName));
    if (alreadyMatched) continue;
    const satisfied = findBestInboundDocumentMatch(inferred.roleCandidates || [], desiredName, new Set());
    if (satisfied && ["Approved", "Uploaded"].includes(satisfied.status) && satisfied.file?.storageName) continue;
    targets.push({ document: null, created: true, name: desiredName });
  }
  if (!targets.length) {
    targets.push({ document: null, created: true, name: attachment.documentName || inferred.fallbackName || originalName });
  }

  return targets.map((target) => {
    let document = target.document;
    if (!document) {
      document = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        name: target.name || inferred.fallbackName || originalName,
        caseId: item.id,
        owner: `${sender || item.client} - ${ownerRoleLabel}`,
        due: item.due || "Today",
        reminder: "WhatsApp inbound",
        status: fileBacked || attachment.url ? "Uploaded" : "Requested"
      };
      operationsStore.documents.unshift(document);
    }

    let ingestStatus = "metadata-only";
    if (fileBacked && isAllowedInboundDocumentType(safeMime, originalName) && bytes.length <= LEAD_DOCUMENT_MAX_BYTES) {
      ensureDataDir();
      if (!fs.existsSync(secureDocumentsDir)) fs.mkdirSync(secureDocumentsDir, { recursive: true });
      if (document.file?.storageName) {
        const previous = path.join(secureDocumentsDir, path.basename(document.file.storageName));
        if (fs.existsSync(previous)) fs.unlinkSync(previous);
      }
      const storageName = `${randomUUID()}.bin`;
      fs.writeFileSync(path.join(secureDocumentsDir, storageName), bytes);
      document.file = {
        storageName,
        originalName,
        mimeType: safeMime,
        size: bytes.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: `${sanitizeShortText(sender || "Participant", 120)} via WhatsApp`
      };
      document.status = "Uploaded";
      document.reminder = "Received via WhatsApp - Awaiting review";
      ingestStatus = "uploaded";
      addOperationsTimeline(item.id, `${document.name} received via WhatsApp`, `${sender || "Participant"} sent ${originalName} on WhatsApp. The file is protected and awaiting review.`);
      addOperationsActivity("UP", "WhatsApp document intake", `${item.id} - ${document.name}`);
      addOperationsAudit("whatsapp-document-uploaded", item.id, `${document.name}: ${originalName}`);
    } else if (attachment.url) {
      document.externalUrl = attachment.url;
      document.status = "Uploaded";
      document.reminder = "WhatsApp media received - Awaiting review";
      ingestStatus = "linked";
      addOperationsTimeline(item.id, `${document.name} received via WhatsApp`, `${sender || "Participant"} sent a WhatsApp media reference for ${document.name}.`);
      addOperationsActivity("UP", "WhatsApp media linked", `${item.id} - ${document.name}`);
      addOperationsAudit("whatsapp-document-linked", item.id, `${document.name}: ${attachment.url}`);
    } else if (fileBacked) {
      document.reminder = "WhatsApp inbound - Review required";
      ingestStatus = "unsupported";
    } else {
      document.reminder = "WhatsApp attachment noted";
    }

    return {
      documentId: document.id,
      documentName: document.name,
      ingestStatus,
      originalName,
      mimeType: safeMime,
      size: bytes?.length || null,
      hasDownload: Boolean(document.file?.storageName),
      note,
      externalUrl: attachment.url || ""
    };
  });
}

async function captureInboundVoiceNoteFromWhatsapp(item, { sender = "", senderRole = "", attachment = {}, messageText = "" } = {}) {
  const originalName = safeBaseFilename(attachment.filename || `voice-note${extFromMime(attachment.mimeType) || ".ogg"}`);
  let transcript = extractInboundVoiceTranscript(attachment, messageText);
  let transcriptSource = transcript ? "payload" : "";
  let bytes = decodeInboundAttachmentBytes(attachment);
  const resolvedMime = attachment.mimeType || "audio/ogg";

  if (!bytes && attachment.url) {
    const fetched = await fetchInboundAttachmentBytes(attachment.url);
    if (fetched?.bytes?.length) {
      bytes = fetched.bytes;
    }
  }

  const media = bytes?.length
    ? {
        ...storeInboundSecureMedia(bytes, { originalName, mimeType: resolvedMime || "application/octet-stream" }),
        durationSeconds: attachment.durationSeconds || null
      }
    : null;

  let transcriptionError = "";
  if (!transcript && bytes) {
    const transcribeResult = await transcribeInboundVoiceNote(bytes, {
      model: WHATSAPP_VOICE_TRANSCRIBE_MODEL,
      originalName,
      mimeType: resolvedMime,
      source: "whatsapp-voice"
    });
    if (transcribeResult?.ok) {
      transcript = transcribeResult.transcript;
      transcriptSource = "stt";
    } else {
      transcriptionError = transcribeResult?.reason || "transcription-failed";
    }
  }

  if (!transcript && WHATSAPP_VOICE_TRANSCRIBE_REQUIRED && (transcriptionError || attachment.url || bytes?.length)) {
    return {
      kind: "voice-note",
      caseNoteId: null,
      documentId: null,
      documentName: "Voice note",
      ingestStatus: "failed",
      originalName,
      mimeType: resolvedMime || "audio/ogg",
      size: bytes?.length || null,
      hasDownload: Boolean(media?.storageName),
      downloadPath: "",
      note: attachment.caption || "",
      transcript: "",
      summary: "",
      sentiment: null,
      externalUrl: attachment.url || "",
      error: "Voice transcription is required but unavailable."
    };
  }

  const summary = summarizeInboundVoiceTranscript(transcript);
  const sentiment = analyzeWhatsappHumanTakeover({ voiceTranscript: transcript, voiceSummary: summary });
  const transcriptState = transcript ? "transcribed" : media ? "pending-transcript" : "noted";
  const body = transcript
    ? `Transcript (${transcriptSource || "transcribed"}): ${transcript}${summary && summary !== transcript ? `\n\nSummary: ${summary}` : ""}${sentiment ? `\n\nSentiment risk: ${sentiment.severity} (${sentiment.score})${sentiment.reasonLabels?.length ? `\nSignals: ${sentiment.reasonLabels.join(", ")}` : ""}` : ""}`
    : `Voice note received${transcriptionError ? ` but transcription is unavailable (${transcriptionError})` : ""}. Audio saved and a case note created while transcription remains pending.`;
  const caseNote = addOperationsCaseNote({
    caseId: item.id,
    category: "Voice note",
    title: `WhatsApp voice note from ${sender || "Participant"}`,
    note: body,
    source: "whatsapp-voice-note",
    createdBy: sender || "Participant",
    transcript,
    summary,
    media
  });
  addOperationsTimeline(
    item.id,
    "WhatsApp voice note received",
    transcript
      ? `${sender || "Participant"} sent a voice note. Transcript saved to case notes${summary ? ` and summarised as: ${summary}` : "."}${sentiment ? ` Sentiment risk scored ${sentiment.severity} (${sentiment.score}).` : ""}`
      : `${sender || "Participant"} sent a voice note. Audio saved and a case note created while transcription remains pending.`
  );
  addOperationsActivity("VN", "WhatsApp voice note captured", `${item.id} - ${sender || "Participant"}`);
  addOperationsAudit("whatsapp-voice-note", item.id, `${sender || "Participant"}: ${summary || transcript || "Transcript pending"}${sentiment ? ` | sentiment ${sentiment.severity} (${sentiment.score})` : ""}`);
  return {
    kind: "voice-note",
    caseNoteId: caseNote?.id || null,
    documentId: null,
    documentName: "Voice note",
    ingestStatus: transcriptState,
    originalName,
    mimeType: resolvedMime || "application/octet-stream",
    size: bytes?.length || null,
    hasDownload: Boolean(media?.storageName),
    downloadPath: caseNote?.id ? `/api/whatsapp/inbox/media/${encodeURIComponent(caseNote.id)}/download` : "",
    note: attachment.caption || "",
    transcript,
    summary,
    sentiment,
    externalUrl: attachment.url || ""
  };
}

function buildWhatsappInboxParticipants(item, messages = []) {
  const roleMap = { SELL: "seller", BUY: "buyer", AGENT: "agent", TRANS: "attorney", ORIG: "finance", CONC: "concierge" };
  const map = new Map();
  for (const code of ["SELL", "BUY", "AGENT", "TRANS", "ORIG"]) {
    const recipient = resolveGateOwnerRecipient(item, code);
    if (!recipient?.name || /^to appoint$/i.test(recipient.name) || !recipient.phone) continue;
    map.set(recipient.phone, {
      name: recipient.name,
      phone: recipient.phone,
      role: roleMap[code] || code.toLowerCase(),
      stakeholderCode: code
    });
  }
  for (const message of messages) {
    const phone = cleanPhoneNumber(message.senderPhone || message.recipientPhone || "");
    if (!phone) continue;
    if (!map.has(phone)) {
      const resolvedRole = sanitizeShortText(message.direction === "inbound" ? message.senderRole || "" : message.recipientRole || "", 40).toLowerCase() || null;
      const resolvedOwnerText = message.direction === "inbound" ? message.senderRole || message.senderName || "" : message.recipientRole || message.recipientName || "";
      map.set(phone, {
        name: message.direction === "inbound" ? message.senderName : message.recipientName || "Participant",
        phone,
        role: resolvedRole,
        stakeholderCode: mapOwnerTextToStakeholderCode(resolvedOwnerText)
      });
    }
  }
  return [...map.values()];
}

function buildAdminWhatsappInboxSummary() {
  const cases = [];
  for (const item of operationsStore.cases || []) {
    const messages = getCaseWhatsappMessages(item.id);
    if (!messages.length) continue;
    const latest = messages[messages.length - 1];
    const latestVoiceNote = (latest?.attachments || []).find((attachment) => attachment.kind === "voice-note");
    const unreadCount = messages.filter((entry) => entry.direction === "inbound" && !entry.readAt).length;
    cases.push({
      caseId: item.id,
      client: item.client,
      stage: item.stage,
      next: item.next,
      owner: item.owner,
      humanTakeover: getCaseHumanTakeoverState(item),
      unreadCount,
      lastMessageAt: latest?.createdAt || null,
      lastMessagePreview:
        latest?.text ||
        latestVoiceNote?.summary ||
        latestVoiceNote?.transcript ||
        (latest?.attachments?.length ? "Attachment received" : "No message body"),
      participants: buildWhatsappInboxParticipants(item, messages),
      caseNotes: getOperationsCaseNotes(item.id).slice(0, 6),
      documents: (operationsStore.documents || [])
        .filter((doc) => doc.caseId === item.id)
        .map((doc) => ({
          id: doc.id,
          name: doc.name,
          owner: doc.owner,
          status: doc.status,
          hasFile: Boolean(doc.file?.storageName),
          uploadedAt: doc.file?.uploadedAt || null
        })),
      appointments: listCaseAppointments(item.id).map((appointment) => ({
        ...appointment,
        kindLabel: formatOperationsAppointmentKind(appointment.kind)
      })),
      messages: messages.map((message) => ({
        ...message,
        attachments: Array.isArray(message.attachments) ? message.attachments : []
      }))
    });
  }
  return cases.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
}

async function sendManualWhatsappInboxReply({
  item,
  message = "",
  recipientName = "",
  recipientPhone = "",
  recipientRole = "",
  source = "admin-reply",
  actor = "Concierge"
} = {}) {
  const cleanMessage = sanitizeShortText(message, 1600);
  const cleanPhone = cleanPhoneNumber(recipientPhone);
  if (!item?.id || !cleanPhone || !cleanMessage) {
    return { ok: false, error: "Recipient phone and message are required" };
  }
  const notification = queueOperationsNotification({
    caseId: item.id,
    channel: "whatsapp",
    preferredChannel: "whatsapp",
    stakeholderCode: mapOwnerTextToStakeholderCode(recipientRole || recipientName),
    recipient: recipientName || cleanPhone,
    recipientPhone: cleanPhone,
    template: "manual-reply",
    message: cleanMessage,
    dedupeKey: null,
    bypassPause: true
  });
  const delivered = await deliverOperationsNotification(notification);
  const threadMessage = appendOperationsWhatsappMessage({
    caseId: item.id,
    direction: "outbound",
    senderName: actor,
    senderRole: "concierge",
    recipientName: recipientName || cleanPhone,
    recipientPhone: cleanPhone,
    recipientRole,
    text: cleanMessage,
    source,
    status: delivered.status || "queued",
    providerStatus: delivered.providerStatus || delivered.status || null,
    notificationId: delivered.id
  });
  addOperationsTimeline(item.id, "WhatsApp reply sent", `${actor} replied to ${recipientName || cleanPhone} on WhatsApp.`);
  addOperationsActivity("WA", "WhatsApp reply sent", `${item.id} - ${recipientName || cleanPhone}`);
  addOperationsAudit("whatsapp-reply-sent", item.id, `${recipientName || cleanPhone}: ${cleanMessage}`);
  persistOperations();
  return { ok: true, delivered: delivered.status === "delivered", notification: delivered, threadMessage };
}

function createPinHash(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) return false;
  const supplied = scryptSync(String(pin || ""), salt, 64);
  const expected = Buffer.from(hash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function createOperationsUsers() {
  const demoCredentials = (cellphone, pin) => ({
    cellphone: OPERATIONS_DEMO_MODE ? OPERATIONS_DEMO_CELLPHONE : cellphone,
    pinHash: createPinHash(OPERATIONS_DEMO_MODE ? OPERATIONS_DEMO_PIN : pin)
  });
  return [
    { id: "USR-CONCIERGE", name: "Stefan Roodt", role: "concierge", ...demoCredentials("+27820000001", "2468"), caseIds: ["*"] },
    { id: "USR-SELLER", name: "Johan Botha", role: "seller", ...demoCredentials("+27820000002", "1357"), caseIds: ["AX-1048"] },
    { id: "USR-BUYER", name: "Naledi Mokoena", role: "buyer", ...demoCredentials("+27820000003", "1357"), caseIds: ["AX-1053"] },
    { id: "USR-AGENT", name: "Elize van Zyl", role: "agent", ...demoCredentials("+27820000004", "2468"), caseIds: ["AX-1048", "AX-1058"] },
    { id: "USR-ATTORNEY", name: "Van der Merwe Inc.", role: "attorney", ...demoCredentials("+27820000005", "2468"), caseIds: ["AX-1042", "AX-1039"] },
    { id: "USR-FINANCE", name: "ooba Bond Originators", role: "finance", ...demoCredentials("+27820000006", "2468"), caseIds: ["AX-1053", "AX-1039"] }
  ];
}

const operationsParticipantRoles = ["seller", "buyer", "agent", "attorney", "finance"];
const operationsRoleLabels = {
  concierge: "Concierge",
  seller: "Seller",
  buyer: "Buyer",
  agent: "Agent",
  attorney: "Transferring attorney",
  finance: "Finance partner"
};

function getOperationsRoleLabel(role) {
  return operationsRoleLabels[role] || "Participant";
}

function isValidOperationsParticipantRole(role) {
  return operationsParticipantRoles.includes(String(role || "").toLowerCase());
}

function getParticipantNameFromCase(item, role) {
  if (!item) return "";
  if (role === "seller" || role === "buyer") return item.client || "";
  if (role === "agent") return item.agent || "";
  if (role === "attorney") return item.attorney || "";
  if (role === "finance") return item.finance || "";
  return "";
}

function normalizeCaseStakeholderEmails(item) {
  if (!item) return;
  const existing = item.stakeholderEmails && typeof item.stakeholderEmails === "object" ? item.stakeholderEmails : {};
  item.stakeholderEmails = {
    ...existing,
    SELL: cleanEmailAddress(existing.SELL || item.sellerEmail || item.email || "") || null,
    BUY: cleanEmailAddress(existing.BUY || item.buyerEmail || item.email || "") || null,
    AGENT: cleanEmailAddress(existing.AGENT || item.agentEmail || "") || null,
    TRANS: cleanEmailAddress(existing.TRANS || item.attorneyEmail || "") || null,
    ORIG: cleanEmailAddress(existing.ORIG || item.financeEmail || "") || null,
    CONC: cleanEmailAddress(existing.CONC || process.env.CONCIERGE_EMAIL || "") || null,
    BBANK: cleanEmailAddress(existing.BBANK || "") || null,
    BONDATT: cleanEmailAddress(existing.BONDATT || "") || null,
    CANCEL: cleanEmailAddress(existing.CANCEL || "") || null,
    SBANK: cleanEmailAddress(existing.SBANK || "") || null,
    MUNI: cleanEmailAddress(existing.MUNI || "") || null,
    SARS: cleanEmailAddress(existing.SARS || "") || null,
    HOA: cleanEmailAddress(existing.HOA || "") || null,
    INSP: cleanEmailAddress(existing.INSP || "") || null,
    DEEDS: cleanEmailAddress(existing.DEEDS || "") || null
  };
}

const formalStakeholderCodes = new Set(["TRANS", "ORIG", "BBANK", "BONDATT", "CANCEL", "SBANK", "MUNI", "SARS", "HOA", "INSP", "DEEDS"]);

function preferredChannelForStakeholder(stakeholderCode = "") {
  const code = String(stakeholderCode || "").toUpperCase();
  return formalStakeholderCodes.has(code) ? "email" : "whatsapp";
}

function isOperationsAccessLinkActive(link) {
  if (!link?.token || link.revokedAt) return false;
  if (link.singleUse && link.usedAt) return false;
  if (!link.expiresAt) return true;
  return new Date(link.expiresAt).getTime() > Date.now();
}

function buildOperationsAccessUrl(req, token) {
  return `${buildBaseUrl(req)}/operations.html?access=${encodeURIComponent(token)}`;
}

function issueOperationsAccessLink(item, req, options = {}) {
  const role = String(options.role || "").toLowerCase();
  if (!isValidOperationsParticipantRole(role)) return null;
  const seededName = sanitizeShortText(options.name || getParticipantNameFromCase(item, role), 160);
  const name = seededName && !/^to appoint$/i.test(seededName) ? seededName : `${item.client} ${getOperationsRoleLabel(role)}`;
  const cellphone = cleanPhoneNumber(options.cellphone) || "";
  const createdAt = new Date().toISOString();
  const expiresHours = Number.isFinite(Number(options.expiresHours))
    ? Math.max(1, Math.min(Number(options.expiresHours), 24 * 30))
    : Math.max(1, OPERATIONS_ACCESS_LINK_HOURS);
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();
  const link = {
    id: randomUUID(),
    token: randomUUID(),
    caseId: item.id,
    role,
    name,
    cellphone,
    createdAt,
    expiresAt,
    singleUse: options.singleUse !== false,
    usedAt: null,
    revokedAt: null,
    createdBy: sanitizeShortText(options.createdBy || "Concierge", 120)
  };
  operationsStore.accessLinks = Array.isArray(operationsStore.accessLinks) ? operationsStore.accessLinks : [];
  operationsStore.accessLinks.unshift(link);
  operationsStore.accessLinks = operationsStore.accessLinks.slice(0, 600);
  return link;
}

function findOperationsAccessLinkByToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return null;
  return (operationsStore.accessLinks || []).find((item) => item.token === cleanToken) || null;
}

function resolveOperationsAccessUser(accessLink) {
  return {
    id: `ACCESS-${accessLink.id.slice(0, 8)}`,
    name: accessLink.name || `${getOperationsRoleLabel(accessLink.role)} participant`,
    cellphone: accessLink.cellphone || "",
    role: accessLink.role,
    caseIds: [accessLink.caseId],
    accessLinkId: accessLink.id
  };
}

function getOperationsIdentities() {
  operationsStore.identities = Array.isArray(operationsStore.identities) ? operationsStore.identities : [];
  return operationsStore.identities;
}

function getOperationUsersForLogin() {
  const staticUsers = operationsUsers.map((user) => ({
    id: user.id,
    name: user.name,
    cellphone: user.cellphone,
    role: user.role,
    caseIds: Array.isArray(user.caseIds) ? user.caseIds : [],
    pinHash: user.pinHash || ""
  }));
  const identityUsers = getOperationsIdentities().map((item) => ({
    id: item.id,
    name: item.name,
    cellphone: item.cellphone,
    role: item.role,
    caseIds: Array.isArray(item.caseIds) ? item.caseIds : [],
    pinHash: item.pinHash || ""
  }));
  return [...identityUsers, ...staticUsers];
}

function upsertOperationsIdentity({ name, cellphone, email = "", role, caseId, invitedBy = "", pin }) {
  const cleanCellphone = cleanPhoneNumber(cellphone);
  const cleanEmail = cleanEmailAddress(email);
  if (!cleanCellphone && !cleanEmail) return null;
  const cleanRole = String(role || "").toLowerCase();
  if (!isValidOperationsParticipantRole(cleanRole) && cleanRole !== "concierge") return null;

  const identities = getOperationsIdentities();
  let identity = identities.find((entry) =>
    (cleanCellphone && cleanPhoneNumber(entry.cellphone) === cleanCellphone) ||
    (cleanEmail && cleanEmailAddress(entry.email || "") === cleanEmail)
  );
  const now = new Date().toISOString();
  if (!identity) {
    identity = {
      id: `ID-${randomUUID()}`,
      createdAt: now,
      invitedBy: sanitizeShortText(invitedBy || "Concierge", 120),
      name: sanitizeShortText(name || "Participant", 160),
      cellphone: cleanCellphone || "",
      email: cleanEmail || "",
      role: cleanRole,
      caseIds: [],
      pinHash: "",
      status: "active"
    };
    identities.unshift(identity);
  } else {
    identity.name = sanitizeShortText(name || identity.name || "Participant", 160);
    identity.role = cleanRole || identity.role;
    if (cleanCellphone) identity.cellphone = cleanCellphone;
    if (cleanEmail) identity.email = cleanEmail;
    if (invitedBy) identity.invitedBy = sanitizeShortText(invitedBy, 120);
    identity.updatedAt = now;
  }
  if (caseId && !identity.caseIds.includes(caseId)) identity.caseIds.push(caseId);
  if (pin) identity.pinHash = createPinHash(pin);
  identity.status = "active";
  identity.updatedAt = now;
  operationsStore.identities = identities.slice(0, 1200);
  return identity;
}

function pruneOperationsOtpChallenges() {
  const now = Date.now();
  operationsStore.otpChallenges = (Array.isArray(operationsStore.otpChallenges) ? operationsStore.otpChallenges : [])
    .filter((item) => {
      if (!item) return false;
      if (item.usedAt) return new Date(item.usedAt).getTime() > now - 24 * 60 * 60 * 1000;
      const expires = new Date(item.expiresAt || 0).getTime();
      return Number.isFinite(expires) && expires > now - 60 * 60 * 1000;
    })
    .slice(0, 1000);
}

function createOperationsOtpChallenge(user) {
  pruneOperationsOtpChallenges();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, OPERATIONS_OTP_MINUTES) * 60 * 1000).toISOString();
  const challenge = {
    id: `OTP-${randomUUID()}`,
    createdAt: now.toISOString(),
    expiresAt,
    attempts: 0,
    maxAttempts: Math.max(1, OPERATIONS_OTP_MAX_ATTEMPTS),
    usedAt: null,
    codeHash: createPinHash(code),
    user: {
      id: user.id,
      name: user.name,
      cellphone: user.cellphone,
      role: user.role,
      caseIds: Array.isArray(user.caseIds) ? user.caseIds : []
    }
  };
  operationsStore.otpChallenges = Array.isArray(operationsStore.otpChallenges) ? operationsStore.otpChallenges : [];
  operationsStore.otpChallenges.unshift(challenge);
  operationsStore.otpChallenges = operationsStore.otpChallenges.slice(0, 1000);
  return { challenge, code };
}

function getOperationsOtpChallenge(challengeId) {
  const id = String(challengeId || "").trim();
  if (!id) return null;
  return (operationsStore.otpChallenges || []).find((item) => item.id === id) || null;
}

function getPublicOperationsUser(user) {
  return { id: user.id, name: user.name, cellphone: user.cellphone, role: user.role, roleLabel: getOperationsRoleLabel(user.role) };
}

function getOperationsSession(req) {
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const session = operationsSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    operationsSessions.delete(token);
    return null;
  }
  return session;
}

function requireOperationsSession(req, res, next) {
  const session = getOperationsSession(req);
  if (!session) return res.status(401).json({ ok: false, error: "Please sign in to continue" });
  req.operationsSession = session;
  return next();
}

function requireOperationsRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.operationsSession?.user?.role)) {
      return res.status(403).json({ ok: false, error: "This workspace role is not authorised for that action" });
    }
    return next();
  };
}

function canAccessOperationsCase(user, caseId) {
  return Boolean(user && (user.caseIds.includes("*") || user.caseIds.includes(caseId)));
}

function requireOperationsCaseAccess(req, res, next) {
  const caseId = req.params.id || req.params.caseId || req.body?.caseId;
  if (!canAccessOperationsCase(req.operationsSession?.user, caseId)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this case" });
  }
  return next();
}

function getVisibleOperationsStore(user) {
  refreshEscalationSlaStates();
  const allowedCases = operationsStore.cases.filter((item) => canAccessOperationsCase(user, item.id));
  for (const item of allowedCases) {
    normalizeCaseBirthdays(item);
    normalizeCaseMovingServices(item);
    normalizeCaseComplianceSupport(item);
    normalizeCaseFinanceSupport(item);
    normalizeCaseStakeholders(item);
    normalizeCaseStakeholderEmails(item);
  }
  const allowedIds = new Set(allowedCases.map((item) => item.id));
  const caseRulePacks = new Map(allowedCases.map((item) => [item.id, evaluateCaseRulePack(item)]));
  const caseDelayIntelligence = new Map(
    allowedCases.map((item) => [item.id, buildCaseDelayIntelligence(item, { rulePack: caseRulePacks.get(item.id) })])
  );
  const visibleDocuments = operationsStore.documents
    .filter((item) => allowedIds.has(item.caseId))
    .map((item) => ({
      ...item,
      file: item.file
        ? {
            originalName: item.file.originalName,
            mimeType: item.file.mimeType,
            size: item.file.size,
            uploadedAt: item.file.uploadedAt,
            uploadedBy: item.file.uploadedBy
          }
        : null
    }));
  const visibleTimeline = Object.fromEntries(
    Object.entries(operationsStore.timeline).filter(([caseId]) => allowedIds.has(caseId))
  );
  const visibleWorkflowRuns = Object.fromEntries(
    Object.entries(operationsStore.workflowRuns || {}).filter(([caseId]) => allowedIds.has(caseId))
  );
  const activities = operationsStore.activities.filter((entry) =>
    user.role === "concierge" || allowedCases.some((item) => String(entry[2] || "").includes(item.id))
  );
  const visibleAccessLinks = (operationsStore.accessLinks || [])
    .filter((item) => allowedIds.has(item.caseId))
    .map((item) => ({
      id: item.id,
      caseId: item.caseId,
      role: item.role,
      roleLabel: getOperationsRoleLabel(item.role),
      name: item.name || "",
      cellphone: user.role === "concierge" ? item.cellphone || "" : "",
      createdAt: item.createdAt || null,
      expiresAt: item.expiresAt || null,
      usedAt: item.usedAt || null,
      revokedAt: item.revokedAt || null,
      active: isOperationsAccessLinkActive(item),
      singleUse: item.singleUse !== false,
      createdBy: item.createdBy || null,
      accessToken: user.role === "concierge" ? item.token : null
    }));
  const visibleIdentities = getOperationsIdentities()
    .filter((entry) => (entry.caseIds || []).includes("*") || (entry.caseIds || []).some((caseId) => allowedIds.has(caseId)))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      cellphone: user.role === "concierge" ? entry.cellphone : "",
      email: user.role === "concierge" ? entry.email || "" : "",
      role: entry.role,
      roleLabel: getOperationsRoleLabel(entry.role),
      caseIds: entry.caseIds || [],
      invitedBy: entry.invitedBy || null,
      status: entry.status || "active",
      createdAt: entry.createdAt || null,
      updatedAt: entry.updatedAt || null
    }));
  const dynamicPriorities = buildRulePackPriorities(allowedCases);
  const delayPriorities = buildDelayRiskPriorities(allowedCases, caseDelayIntelligence);
  const storedPriorities = operationsStore.priorities.filter((item) => allowedIds.has(item.caseId));
  const mergedPriorities = [...storedPriorities];
  for (const priority of dynamicPriorities) {
    if (!mergedPriorities.some((entry) => entry.caseId === priority.caseId && entry.issue === priority.issue)) {
      mergedPriorities.push(priority);
    }
  }
  for (const priority of delayPriorities) {
    if (!mergedPriorities.some((entry) => entry.caseId === priority.caseId && entry.issue === priority.issue)) {
      mergedPriorities.push(priority);
    }
  }
  return {
    version: operationsStore.version,
    cases: allowedCases.map((item) => {
      const rulePack = caseRulePacks.get(item.id);
      const delayIntel = caseDelayIntelligence.get(item.id);
      const enriched = {
        ...item,
        rulePack,
        gateStatus: rulePack?.overallStatus || "in-progress",
        activeGate: rulePack?.activeGateLabel || null,
        delayIntelligence: delayIntel || null,
        delayRiskScore: delayIntel?.score ?? null,
        delayRiskBand: delayIntel?.band || "low"
      };
      return user.role === "concierge" ? enriched : { ...enriched, cellphone: undefined };
    }),
    documents: visibleDocuments,
    timeline: visibleTimeline,
    activities,
    notifications: operationsStore.notifications.filter((item) => allowedIds.has(item.caseId)),
    escalations: operationsStore.escalations.filter((item) => allowedIds.has(item.caseId)),
    resolvedItems: operationsStore.resolvedItems.filter((item) => allowedIds.has(String(item).split(":")[0])),
    priorities: mergedPriorities,
    automation: operationsStore.automation,
    playbooks: operationsStore.playbooks || [],
    workflowRuns: visibleWorkflowRuns,
    identities: visibleIdentities,
    appointments: ensureOperationsAppointments()
      .filter((item) => allowedIds.has(item.caseId))
      .map((item) => (user.role === "concierge" || item.participantRole === user.role ? item : { ...item, participantPhone: "" })),
    accessLinks: visibleAccessLinks,
    auditLog: user.role === "concierge" ? operationsStore.auditLog : []
  };
}

function sendVisibleOperationsStore(res, session, extra = {}) {
  return res.json({ ok: true, ...extra, store: getVisibleOperationsStore(session.user) });
}

function formatOperationsTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("day")} ${pick("month")} - ${pick("hour")}:${pick("minute")}`;
}

function getEscalationSlaDueAt(createdAt) {
  const createdTs = new Date(createdAt || Date.now()).getTime();
  const safeCreatedTs = Number.isFinite(createdTs) ? createdTs : Date.now();
  return new Date(safeCreatedTs + OPERATIONS_ESCALATION_SLA_MINUTES * 60 * 1000).toISOString();
}

function createOperationsEscalation({
  item,
  question = "",
  owner = "",
  dedupeKey = null
}) {
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(),
    createdAt,
    caseId: item.id,
    client: item.client,
    question,
    owner: owner || item.concierge || "Concierge queue",
    status: "open",
    slaDueAt: getEscalationSlaDueAt(createdAt),
    slaState: "on-track",
    slaBreachedAt: null,
    dedupeKey
  };
}

function refreshEscalationSlaStates(now = new Date()) {
  const nowTs = now.getTime();
  let breached = 0;
  for (const escalation of operationsStore.escalations || []) {
    if ((escalation.status || "open") !== "open") continue;
    const dueAt = escalation.slaDueAt || getEscalationSlaDueAt(escalation.createdAt);
    escalation.slaDueAt = dueAt;
    const dueTs = new Date(dueAt).getTime();
    const isBreached = Number.isFinite(dueTs) && dueTs <= nowTs;
    if (isBreached) {
      if (escalation.slaState !== "breached") {
        escalation.slaState = "breached";
        escalation.slaBreachedAt = escalation.slaBreachedAt || now.toISOString();
        breached += 1;
      }
    } else if (!escalation.slaState) {
      escalation.slaState = "on-track";
    }
  }
  return { breached };
}

function findOperationsCase(caseId) {
  return operationsStore.cases.find((item) => item.id === caseId);
}

function normalizeCaseBirthdays(item) {
  if (!item) return;
  const existing = item.birthdays && typeof item.birthdays === "object" ? item.birthdays : {};
  item.birthdays = {
    seller: existing.seller || null,
    buyer: existing.buyer || null
  };
}

function normalizeCaseHumanTakeover(item) {
  if (!item) return;
  const existing = item.humanTakeover && typeof item.humanTakeover === "object" ? item.humanTakeover : {};
  item.humanTakeover = {
    active: Boolean(existing.active),
    pauseAutomation: existing.pauseAutomation !== false,
    flaggedAt: existing.flaggedAt || null,
    flaggedBy: sanitizeShortText(existing.flaggedBy || "", 160) || null,
    source: sanitizeShortText(existing.source || "", 80) || null,
    reasonCodes: Array.isArray(existing.reasonCodes) ? existing.reasonCodes.map((code) => sanitizeShortText(code, 80)).filter(Boolean) : [],
    reasonLabels: Array.isArray(existing.reasonLabels) ? existing.reasonLabels.map((label) => sanitizeShortText(label, 120)).filter(Boolean) : [],
    triggerMessage: sanitizeShortText(existing.triggerMessage || "", 1200) || "",
    triggerMessageId: existing.triggerMessageId || null,
    lastInboundAt: existing.lastInboundAt || null,
    resumedAt: existing.resumedAt || null,
    resumedBy: sanitizeShortText(existing.resumedBy || "", 160) || null,
    resumeNote: sanitizeShortText(existing.resumeNote || "", 500) || ""
  };
}

function getCaseHumanTakeoverState(item) {
  normalizeCaseHumanTakeover(item);
  return item?.humanTakeover || null;
}

function isCaseAutomationPaused(item) {
  const takeover = getCaseHumanTakeoverState(item);
  return Boolean(takeover?.active && takeover?.pauseAutomation !== false);
}

function normalizeCaseMovingServices(item) {
  if (!item) return;
  const existing = item.movingServices && typeof item.movingServices === "object" ? item.movingServices : {};
  const normalizeRole = (role) => {
    const raw = existing[role] && typeof existing[role] === "object" ? existing[role] : {};
    return {
      offeredAt: raw.offeredAt || null,
      response: ["yes", "no"].includes(String(raw.response || "").toLowerCase()) ? String(raw.response || "").toLowerCase() : null,
      responseAt: raw.responseAt || null,
      responder: raw.responder || null,
      lastNotificationId: raw.lastNotificationId || null
    };
  };
  item.movingServices = {
    seller: normalizeRole("seller"),
    buyer: normalizeRole("buyer")
  };
}

function normalizeCaseComplianceSupport(item) {
  if (!item) return;
  const existing = item.complianceSupport && typeof item.complianceSupport === "object" ? item.complianceSupport : {};
  const electrical = existing.electricalCoC && typeof existing.electricalCoC === "object" ? existing.electricalCoC : {};
  const gas = existing.gasCoC && typeof existing.gasCoC === "object" ? existing.gasCoC : {};
  item.complianceSupport = {
    electricalCoC: {
      offeredAt: electrical.offeredAt || null,
      response: ["yes", "no"].includes(String(electrical.response || "").toLowerCase()) ? String(electrical.response || "").toLowerCase() : null,
      responseAt: electrical.responseAt || null,
      responder: electrical.responder || null,
      lastNotificationId: electrical.lastNotificationId || null
    },
    gasCoC: {
      offeredAt: gas.offeredAt || null,
      response: ["yes", "no"].includes(String(gas.response || "").toLowerCase()) ? String(gas.response || "").toLowerCase() : null,
      responseAt: gas.responseAt || null,
      responder: gas.responder || null,
      lastNotificationId: gas.lastNotificationId || null
    }
  };
}

function normalizeCaseFinanceSupport(item) {
  if (!item) return;
  const existing = item.financeSupport && typeof item.financeSupport === "object" ? item.financeSupport : {};
  const bondOriginator = existing.bondOriginator && typeof existing.bondOriginator === "object" ? existing.bondOriginator : {};
  const lifeCover = existing.lifeCover && typeof existing.lifeCover === "object" ? existing.lifeCover : {};
  item.financeSupport = {
    bondOriginator: {
      offeredAt: bondOriginator.offeredAt || null,
      response: ["yes", "no"].includes(String(bondOriginator.response || "").toLowerCase()) ? String(bondOriginator.response || "").toLowerCase() : null,
      responseAt: bondOriginator.responseAt || null,
      responder: bondOriginator.responder || null,
      lastNotificationId: bondOriginator.lastNotificationId || null
    },
    lifeCover: {
      offeredAt: lifeCover.offeredAt || null,
      response: ["yes", "no"].includes(String(lifeCover.response || "").toLowerCase()) ? String(lifeCover.response || "").toLowerCase() : null,
      responseAt: lifeCover.responseAt || null,
      responder: lifeCover.responder || null,
      lastNotificationId: lifeCover.lastNotificationId || null
    }
  };
}

const operationsControlGates = [
  { id: "mandate-live", label: "Mandate live", owner: "AGENT", escalateAfter: "2 business days", evidence: ["signed mandate", "listing pack"] },
  { id: "offer-binding", label: "Offer binding", owner: "AGENT/CONC", escalateAfter: "1 business day", evidence: ["signed otp", "milestone diary"] },
  { id: "finance-fulfilled", label: "Finance fulfilled", owner: "BUY/ORIG", escalateAfter: "3 business days before deadline", evidence: ["bond grant", "cash proof"] },
  { id: "clearance-ready", label: "Clearance ready", owner: "TRANS", escalateAfter: "5 business days", evidence: ["clearance checklist"] },
  { id: "signing-complete", label: "Signing complete", owner: "TRANS", escalateAfter: "3 business days", evidence: ["signed docs", "payment proofs", "guarantees"] },
  { id: "ready-to-lodge", label: "Ready to lodge", owner: "TRANS", escalateAfter: "2 business days", evidence: ["lodgement readiness checklist"] },
  { id: "on-prep", label: "On prep", owner: "TRANS/CONC", escalateAfter: "same day", evidence: ["prep notification", "final account"] },
  { id: "registered", label: "Registered", owner: "TRANS/AGENT", escalateAfter: "2 business days", evidence: ["registration note", "handover checklist"] }
];

function normalizeCaseStakeholders(item) {
  if (!item) return;
  const existing = item.stakeholders && typeof item.stakeholders === "object" ? item.stakeholders : {};
  item.stakeholders = {
    SELL: existing.SELL || (item.journey === "seller" ? item.client : "To appoint"),
    BUY: existing.BUY || (item.journey === "buyer" ? item.client : "To appoint"),
    AGENT: existing.AGENT || item.agent || "To appoint",
    TRANS: existing.TRANS || item.attorney || "To appoint",
    ORIG: existing.ORIG || ((item.finance || "").toLowerCase().includes("ooba") ? item.finance : "To appoint"),
    BBANK: existing.BBANK || "To appoint",
    BONDATT: existing.BONDATT || "To appoint",
    CANCEL: existing.CANCEL || "To appoint",
    SBANK: existing.SBANK || "To appoint",
    MUNI: existing.MUNI || "To appoint",
    SARS: existing.SARS || "SARS",
    HOA: existing.HOA || "To appoint",
    INSP: existing.INSP || "To appoint",
    DEEDS: existing.DEEDS || "Deeds Office",
    CONC: existing.CONC || item.concierge || "To appoint"
  };
}

function hasOverdueDocument(caseId) {
  return operationsStore.documents.some((doc) => doc.caseId === caseId && String(doc.status || "").toLowerCase() === "overdue");
}

function evaluateCaseGateEvidence(item) {
  const docs = listCaseDocuments(item.id);
  const docNames = docs.map((doc) => String(doc.name || "").toLowerCase());
  const approvedDocNames = docs
    .filter((doc) => String(doc.status || "").toLowerCase() === "approved")
    .map((doc) => String(doc.name || "").toLowerCase());
  const timelineText = (operationsStore.timeline?.[item.id] || [])
    .map((entry) => `${entry[1] || ""} ${entry[2] || ""}`.toLowerCase())
    .join(" ");
  const stageText = `${item.stage || ""} ${item.next || ""} ${item.status || ""}`.toLowerCase();
  const textIncludes = (text, keywords) => keywords.some((keyword) => text.includes(keyword));
  const hasDoc = (keywords, approvedOnly = false) => {
    const source = approvedOnly ? approvedDocNames : docNames;
    return source.some((name) => textIncludes(name, keywords));
  };

  return {
    mandateLive: hasDoc(["mandate"], true),
    offerBinding: textIncludes(timelineText, ["otp becomes binding", "fully signed otp", "signed otp"]) || hasDoc(["otp", "offer to purchase"]),
    financeFulfilled: hasDoc(["bond approval", "grant", "cash proof"], false) || textIncludes(timelineText, ["bond approval obtained"]),
    clearanceReady: hasDoc(["rates clearance"], false) && hasDoc(["compliance", "clearance certificate"], false),
    signingComplete: hasDoc(["transfer documents"], false) && textIncludes(timelineText, ["signed", "signing"]),
    readyToLodge: textIncludes(stageText, ["lodge", "lodgement"]) || textIncludes(timelineText, ["ready to lodge"]),
    registered:
      (textIncludes(stageText, ["registration", "registered"]) &&
        (Number(item.progress || 0) >= 100 || textIncludes(stageText, ["complete"]))) ||
      textIncludes(timelineText, ["registration confirmed"])
  };
}

function evaluateCaseRulePack(item) {
  normalizeCaseBirthdays(item);
  normalizeCaseStakeholders(item);
  const evidence = evaluateCaseGateEvidence(item);
  const gateResults = operationsControlGates.map((gate) => {
    let completed = false;
    if (gate.id === "mandate-live") completed = evidence.mandateLive;
    if (gate.id === "offer-binding") completed = evidence.offerBinding;
    if (gate.id === "finance-fulfilled") completed = evidence.financeFulfilled;
    if (gate.id === "clearance-ready") completed = evidence.clearanceReady;
    if (gate.id === "signing-complete") completed = evidence.signingComplete;
    if (gate.id === "ready-to-lodge") completed = evidence.readyToLodge;
    if (gate.id === "on-prep") completed = evidence.readyToLodge;
    if (gate.id === "registered") completed = evidence.registered;
    return {
      id: gate.id,
      label: gate.label,
      owner: gate.owner,
      escalateAfter: gate.escalateAfter,
      completed,
      missingEvidence: completed ? [] : gate.evidence
    };
  });

  let activeGateId = null;
  for (const gate of gateResults) {
    if (!gate.completed) {
      activeGateId = gate.id;
      break;
    }
  }
  const activeGate = gateResults.find((gate) => gate.id === activeGateId) || gateResults[gateResults.length - 1];
  const overdue = hasOverdueDocument(item.id);
  const riskByStatus = ["at risk", "overdue", "waiting"].some((flag) => String(item.status || "").toLowerCase().includes(flag));
  let overallStatus = "ready";
  if (activeGate && !activeGate.completed) overallStatus = overdue ? "blocked" : riskByStatus ? "at-risk" : "in-progress";
  if (gateResults.every((gate) => gate.completed)) overallStatus = "ready";

  return {
    version: "Rule Pack v1",
    activeGateId: activeGate?.id || null,
    activeGateLabel: activeGate?.label || null,
    overallStatus,
    gates: gateResults,
    stakeholders: item.stakeholders
  };
}

function getOperationsDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function normalizeGateOwnerCode(value) {
  const code = String(value || "").toUpperCase();
  if (!code) return null;
  if (["SELL", "SELLER", "VENDOR"].includes(code)) return "SELL";
  if (["BUY", "BUYER", "PURCHASER"].includes(code)) return "BUY";
  if (["AGENT", "EA"].includes(code)) return "AGENT";
  if (["TRANS", "ATTORNEY", "TRANSFER", "CONVEYANCER"].includes(code)) return "TRANS";
  if (["ORIG", "ORIGINATOR", "FINANCE", "BONDORIG"].includes(code)) return "ORIG";
  if (["CONC", "CONCIERGE"].includes(code)) return "CONC";
  if (["BBANK", "BONDATT", "CANCEL", "SBANK", "MUNI", "SARS", "HOA", "INSP", "DEEDS"].includes(code)) return code;
  return null;
}

function parseGateOwnerCodes(owner) {
  const raw = String(owner || "").trim().toUpperCase();
  if (!raw) return ["CONC"];
  const tokens = raw.split(/[\/,\s]+/).map((part) => normalizeGateOwnerCode(part)).filter(Boolean);
  const unique = [...new Set(tokens)];
  return unique.length ? unique : ["CONC"];
}

function resolveGateOwnerRecipient(item, stakeholderCode) {
  normalizeCaseStakeholders(item);
  normalizeCaseStakeholderEmails(item);
  const name = sanitizeShortText(item.stakeholders?.[stakeholderCode] || "", 160) || "To appoint";
  let phone = "";
  let email = cleanEmailAddress(item.stakeholderEmails?.[stakeholderCode] || "") || "";
  if (stakeholderCode === "SELL") phone = resolveCaseParticipantPhone(item, "seller");
  if (stakeholderCode === "BUY") phone = resolveCaseParticipantPhone(item, "buyer");
  if (stakeholderCode === "AGENT") {
    phone = cleanPhoneNumber(item.agentPhone || "") || resolveOperationsRecipientPhone(name || `${item.agent} - Agent`, item.id);
    email = email || cleanEmailAddress(item.agentEmail || "") || "";
  }
  if (stakeholderCode === "TRANS") {
    phone = resolveOperationsRecipientPhone(name || item.attorney, item.id);
    email = email || cleanEmailAddress(item.attorneyEmail || "") || "";
  }
  if (stakeholderCode === "ORIG") {
    phone = resolveOperationsRecipientPhone(name || item.finance, item.id);
    email = email || cleanEmailAddress(item.financeEmail || "") || "";
  }
  if (stakeholderCode === "CONC") {
    phone =
      resolveOperationsRecipientPhone(name || item.concierge, item.id) ||
      cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    email = email || cleanEmailAddress(process.env.CONCIERGE_EMAIL || "") || "";
  }
  email = email || resolveOperationsRecipientEmail(name, item.id, stakeholderCode);
  if (!phone) phone = cleanPhoneNumber(name) || resolveOperationsRecipientPhone(name, item.id);
  return {
    stakeholderCode,
    name,
    phone: cleanPhoneNumber(phone) || "",
    email: cleanEmailAddress(email || "") || "",
    preferredChannel: preferredChannelForStakeholder(stakeholderCode)
  };
}

function shouldNudgeGateAtRisk(item, now = new Date()) {
  const statusText = String(item.status || "").toLowerCase();
  if (statusText.includes("overdue") || statusText.includes("at risk") || statusText.includes("waiting")) return true;
  const due = parseOperationsDueDate(item.due, now);
  if (!due) return false;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((due.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 1;
}

function sweepOperationsGateNudges(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const summary = { evaluated: 0, queued: 0, blocked: 0, atRisk: 0, fallbackQueued: 0 };
  const conciergePhone = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");

  for (const item of operationsStore.cases || []) {
    const rulePack = evaluateCaseRulePack(item);
    summary.evaluated += 1;
    if (!rulePack.activeGateId || !["blocked", "at-risk"].includes(rulePack.overallStatus)) continue;
    if (rulePack.overallStatus === "at-risk" && !shouldNudgeGateAtRisk(item, now)) continue;

    const activeGate = rulePack.gates.find((gate) => gate.id === rulePack.activeGateId);
    if (!activeGate) continue;
    const ownerCodes = parseGateOwnerCodes(activeGate.owner);
    for (const ownerCode of ownerCodes) {
      const recipient = resolveGateOwnerRecipient(item, ownerCode);
      const dedupeKey = `gate-nudge:${item.id}:${activeGate.id}:${rulePack.overallStatus}:${ownerCode}:${dateKey}`;
      const alreadyQueued = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
      if (alreadyQueued) continue;

      const missingEvidence = (activeGate.missingEvidence || []).join(", ") || "review required evidence";
      const urgency =
        rulePack.overallStatus === "blocked"
          ? `is blocked and needs action now.`
          : `is nearing escalation (${activeGate.escalateAfter || "policy window"}).`;
      const message = `Control gate ${item.id} - ${activeGate.label} ${urgency} Missing evidence: ${missingEvidence}. Reply in your portal or ask AI concierge for clarity.`;

      if (recipient.phone || recipient.email) {
        queueOperationsNotification({
          caseId: item.id,
          channel: "auto",
          preferredChannel: recipient.preferredChannel,
          stakeholderCode: ownerCode,
          recipient: recipient.name || recipient.phone || recipient.email,
          recipientPhone: recipient.phone,
          recipientEmail: recipient.email,
          template: "gate-nudge",
          message,
          dedupeKey
        });
        summary.queued += 1;
        if (rulePack.overallStatus === "blocked") summary.blocked += 1;
        else summary.atRisk += 1;
        addOperationsAudit("gate-nudge", item.id, `${activeGate.id} -> ${ownerCode}`);
      } else if (conciergePhone) {
        const fallbackKey = `${dedupeKey}:fallback`;
        const fallbackQueued = operationsStore.notifications.some((note) => note.dedupeKey === fallbackKey && note.status !== "cancelled");
        if (fallbackQueued) continue;
        queueOperationsNotification({
          caseId: item.id,
          channel: "whatsapp",
          recipient: conciergePhone,
          template: "gate-nudge",
          message: `Routing gap on ${item.id} - ${activeGate.label}: ${ownerCode} has no ${recipient.preferredChannel || "required"} contact on file. Please update stakeholder details and follow up manually.`,
          dedupeKey: fallbackKey
        });
        summary.fallbackQueued += 1;
        addOperationsAudit("gate-routing-gap", item.id, `${activeGate.id} -> ${ownerCode}`);
      }
    }
  }

  if (summary.queued || summary.fallbackQueued) {
    addOperationsActivity("GATE", "Gate nudges queued", `${summary.queued} direct and ${summary.fallbackQueued} fallback nudges queued.`);
  }
  return summary;
}

function buildRulePackPriorities(cases) {
  const priorities = [];
  for (const item of cases) {
    const rulePack = evaluateCaseRulePack(item);
    if (rulePack.overallStatus === "blocked") {
      priorities.push({
        level: "high",
        caseId: item.id,
        client: item.client,
        issue: `Control gate blocked: ${rulePack.activeGateLabel || "Unknown"}`,
        detail: `Missing evidence: ${(rulePack.gates.find((gate) => gate.id === rulePack.activeGateId)?.missingEvidence || []).join(", ") || "Review case context"}`,
        due: item.due
      });
    } else if (rulePack.overallStatus === "at-risk") {
      priorities.push({
        level: "medium",
        caseId: item.id,
        client: item.client,
        issue: `Control gate at risk: ${rulePack.activeGateLabel || "Unknown"}`,
        detail: `Action owner: ${rulePack.gates.find((gate) => gate.id === rulePack.activeGateId)?.owner || "Assigned owner"}`,
        due: item.due
      });
    }
  }
  return priorities;
}

function mapOwnerTextToStakeholderCode(ownerText = "") {
  const text = String(ownerText || "").toLowerCase();
  if (!text) return "CONC";
  if (text.includes("seller")) return "SELL";
  if (text.includes("buyer")) return "BUY";
  if (text.includes("agent")) return "AGENT";
  if (text.includes("attorney") || text.includes("convey")) return "TRANS";
  if (text.includes("finance") || text.includes("bond") || text.includes("bank") || text.includes("originator")) return "ORIG";
  if (text.includes("concierge")) return "CONC";
  return "CONC";
}

function getStakeholderLabel(code) {
  const labels = {
    SELL: "Seller",
    BUY: "Buyer",
    AGENT: "Agent",
    TRANS: "Transferring attorney",
    ORIG: "Finance partner",
    CONC: "Concierge",
    BBANK: "Bond bank",
    BONDATT: "Bond attorney",
    CANCEL: "Cancellation attorney",
    SBANK: "Seller bank",
    MUNI: "Municipality",
    SARS: "SARS",
    HOA: "HOA / Body corporate",
    INSP: "Inspector",
    DEEDS: "Deeds office"
  };
  return labels[code] || code;
}

function getCaseOpenEscalationCount(caseId) {
  return operationsStore.escalations.filter((entry) => entry.caseId === caseId && entry.status === "open").length;
}

function getCaseNotificationFriction(caseId) {
  const notifications = operationsStore.notifications.filter((entry) => entry.caseId === caseId);
  const waiting = notifications.filter((entry) => entry.status === "waiting-channel").length;
  const failed = notifications.filter((entry) => entry.status === "failed").length;
  return { waiting, failed };
}

function getMissingPrimaryStakeholders(item) {
  normalizeCaseStakeholders(item);
  return ["SELL", "BUY", "AGENT", "TRANS", "ORIG", "CONC"].filter((code) => {
    const value = String(item.stakeholders?.[code] || "").trim().toLowerCase();
    return !value || value === "to appoint";
  });
}

function buildCaseDelayIntelligence(item, { rulePack = null, now = new Date() } = {}) {
  const liveRulePack = rulePack || evaluateCaseRulePack(item);
  const documents = listCaseDocuments(item.id);
  const overdueDocuments = documents.filter((doc) => String(doc.status || "").toLowerCase() === "overdue");
  const outstandingDocuments = documents.filter((doc) => !["approved", "uploaded"].includes(String(doc.status || "").toLowerCase()));
  const dueDate = parseOperationsDueDate(item.due, now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysToDue = dueDate ? Math.ceil((dueDate.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)) : null;
  const status = String(item.status || "").toLowerCase();
  const openEscalations = getCaseOpenEscalationCount(item.id);
  const channelFriction = getCaseNotificationFriction(item.id);
  const missingStakeholders = getMissingPrimaryStakeholders(item);
  const signals = [];
  let score = 8;

  if (liveRulePack?.overallStatus === "blocked") {
    score += 24;
    signals.push({ key: "gate-blocked", impact: 24, label: `Control gate blocked: ${liveRulePack.activeGateLabel || "Unknown"}` });
  } else if (liveRulePack?.overallStatus === "at-risk") {
    score += 14;
    signals.push({ key: "gate-at-risk", impact: 14, label: `Control gate at risk: ${liveRulePack.activeGateLabel || "Unknown"}` });
  }

  if (overdueDocuments.length) {
    const impact = Math.min(30, 14 + overdueDocuments.length * 6);
    score += impact;
    signals.push({
      key: "overdue-docs",
      impact,
      label: `${overdueDocuments.length} overdue document${overdueDocuments.length === 1 ? "" : "s"}`
    });
  }

  if (outstandingDocuments.length >= 3) {
    score += 8;
    signals.push({ key: "document-load", impact: 8, label: `${outstandingDocuments.length} outstanding document obligations` });
  }

  if (daysToDue !== null && daysToDue <= 1) {
    const impact = daysToDue < 0 ? 18 : 11;
    score += impact;
    signals.push({ key: "near-due", impact, label: daysToDue < 0 ? "Case due date already passed" : "Case due within 24 hours" });
  } else if (status.includes("overdue") || String(item.due || "").toLowerCase().includes("overdue")) {
    score += 14;
    signals.push({ key: "overdue-label", impact: 14, label: "Case already marked overdue" });
  }

  if (openEscalations > 0) {
    const impact = Math.min(16, 8 + openEscalations * 2);
    score += impact;
    signals.push({ key: "open-escalations", impact, label: `${openEscalations} open escalation${openEscalations === 1 ? "" : "s"}` });
  }

  if (channelFriction.waiting || channelFriction.failed) {
    const impact = Math.min(10, channelFriction.waiting * 2 + channelFriction.failed * 3);
    score += impact;
    signals.push({ key: "delivery-friction", impact, label: "Notification delivery friction detected" });
  }

  if (missingStakeholders.length) {
    const impact = Math.min(12, missingStakeholders.length * 2);
    score += impact;
    signals.push({ key: "stakeholder-gaps", impact, label: `Stakeholder assignment gaps: ${missingStakeholders.join(", ")}` });
  }

  if (Number(item.progress || 0) < 35 && daysToDue !== null && daysToDue <= 3) {
    score += 10;
    signals.push({ key: "progress-lag", impact: 10, label: "Progress is low relative to upcoming due date" });
  }

  score = Math.max(0, Math.min(100, score));
  const band = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";
  const sortedSignals = signals.sort((a, b) => b.impact - a.impact);
  const delayDays = band === "critical" ? Math.max(5, overdueDocuments.length + 4) : band === "high" ? Math.max(3, overdueDocuments.length + 2) : band === "medium" ? 1 : 0;
  const confidence = Math.max(45, Math.min(95, 45 + sortedSignals.length * 9));

  return {
    generatedAt: new Date().toISOString(),
    score,
    band,
    predictedDelayDays: delayDays,
    confidence,
    activeGate: liveRulePack?.activeGateLabel || null,
    nextBestOwner: parseGateOwnerCodes(liveRulePack?.gates?.find((gate) => gate.id === liveRulePack.activeGateId)?.owner || "CONC")[0] || "CONC",
    signals: sortedSignals.slice(0, 5).map((signal) => ({ label: signal.label, impact: signal.impact })),
    facts: {
      overdueDocuments: overdueDocuments.length,
      outstandingDocuments: outstandingDocuments.length,
      openEscalations,
      missingStakeholders: missingStakeholders.length
    }
  };
}

function parseRecoveryDueHours(label) {
  const value = String(label || "").toLowerCase().trim();
  if (!value) return 36;
  if (value.includes("today")) return 8;
  if (value.includes("within 4 hours")) return 4;
  if (value.includes("within 24 hours")) return 24;
  const withinHours = /within\s+(\d+)\s+hour/.exec(value);
  if (withinHours) return Number(withinHours[1]);
  const withinDays = /within\s+(\d+)\s+day/.exec(value);
  if (withinDays) return Number(withinDays[1]) * 24;
  if (value.includes("tomorrow")) return 24;
  return 48;
}

function getRecoveryPriorityWeight(priority) {
  if (priority === "Critical") return 400;
  if (priority === "High") return 300;
  if (priority === "Medium") return 200;
  return 100;
}

function getRecoveryCategoryWeight(category) {
  if (category === "routing") return 120;
  if (category === "document") return 110;
  if (category === "gate") return 100;
  if (category === "client-comms") return 80;
  return 60;
}

function sequenceRecoveryActions(rawActions, riskBand = "medium") {
  const actions = rawActions.map((action) => ({ ...action, dependsOn: [], sequenceRank: 0, sequenceReason: "", slaWindowHours: parseRecoveryDueHours(action.due) }));
  const routingAction = actions.find((action) => action.category === "routing") || null;
  const documentActions = actions.filter((action) => action.category === "document");

  for (const action of actions) {
    if (!action.contactReady && routingAction && routingAction.id !== action.id) action.dependsOn.push(routingAction.id);
    if (action.category === "gate" && documentActions.length) {
      action.dependsOn.push(documentActions[0].id);
    }
  }

  for (const action of actions) {
    const urgency = Math.max(0, 72 - action.slaWindowHours);
    const riskBoost = riskBand === "critical" ? 30 : riskBand === "high" ? 18 : riskBand === "medium" ? 8 : 0;
    action.sequenceScore = getRecoveryPriorityWeight(action.priority) + getRecoveryCategoryWeight(action.category) + urgency + riskBoost;
  }

  const pending = new Map(actions.map((action) => [action.id, action]));
  const done = new Set();
  const ordered = [];

  while (pending.size) {
    const ready = [...pending.values()].filter((action) => action.dependsOn.every((id) => done.has(id) || !pending.has(id)));
    const pool = ready.length ? ready : [...pending.values()];
    pool.sort((a, b) => b.sequenceScore - a.sequenceScore || a.slaWindowHours - b.slaWindowHours);
    const next = pool[0];
    pending.delete(next.id);
    done.add(next.id);
    ordered.push(next);
  }

  return ordered.map((action, index) => ({
    ...action,
    sequenceRank: index + 1,
    sequenceReason: action.dependsOn.length
      ? `Runs after ${action.dependsOn.join(", ")}`
      : `Prioritized for urgency (${action.priority}) and SLA window`,
    orchestrateEligible: ["Critical", "High"].includes(action.priority) || (riskBand === "critical" && action.priority === "Medium")
  }));
}

function buildOwnerNextBestActions(actions) {
  const byOwner = new Map();
  for (const action of actions) {
    if (!action.orchestrateEligible) continue;
    if (!byOwner.has(action.ownerCode)) byOwner.set(action.ownerCode, action);
  }
  return [...byOwner.values()].sort((a, b) => a.sequenceRank - b.sequenceRank);
}

function buildNextBestActionMessage(item, action, plan) {
  const lead = `Next-best action for ${item.id}: ${action.title}.`;
  const dependency = action.dependsOn.length ? ` Complete dependency: ${action.dependsOn.join(", ")} first.` : "";
  const eta = plan?.risk?.predictedDelayDays ? ` Predicted delay without action: ${plan.risk.predictedDelayDays} day${plan.risk.predictedDelayDays === 1 ? "" : "s"}.` : "";
  return `${lead} ${action.detail} Due ${action.due}.${dependency}${eta} Reply in your portal or ask AI concierge for clarity.`;
}

function buildCaseRecoveryPlan(item, { delayIntel = null, rulePack = null } = {}) {
  const risk = delayIntel || buildCaseDelayIntelligence(item, { rulePack });
  const liveRulePack = rulePack || evaluateCaseRulePack(item);
  const highRisk = ["critical", "high"].includes(risk.band);
  const activeGate = liveRulePack?.gates?.find((gate) => gate.id === liveRulePack.activeGateId) || null;
  const actions = [];
  const usedKeys = new Set();
  const addAction = ({
    ownerCode,
    title,
    detail,
    due = "Within 24 hours",
    priority = "High",
    category = "general",
    message = ""
  }) => {
    const key = `${ownerCode}:${title}`.toLowerCase();
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    const recipient = resolveGateOwnerRecipient(item, ownerCode);
    const preferredChannel = recipient.preferredChannel || preferredChannelForStakeholder(ownerCode);
    const contactReady = preferredChannel === "email" ? Boolean(recipient.email) : Boolean(recipient.phone);
    actions.push({
      id: `act-${ownerCode}-${actions.length + 1}`,
      ownerCode,
      ownerLabel: getStakeholderLabel(ownerCode),
      ownerName: recipient.name || getStakeholderLabel(ownerCode),
      recipientPhone: recipient.phone || "",
      recipientEmail: recipient.email || "",
      preferredChannel,
      contactReady,
      title,
      detail,
      due,
      priority,
      category,
      message:
        message ||
        `Recovery action for ${item.id}: ${title}. ${detail}. Due ${due}. Reply in your portal or ask AI concierge for help.`
    });
  };

  if (activeGate && risk.band !== "low") {
    const ownerCodes = parseGateOwnerCodes(activeGate.owner).slice(0, 2);
    const missingEvidence = (activeGate.missingEvidence || []).join(", ") || "required evidence";
    for (const ownerCode of ownerCodes) {
      addAction({
        ownerCode,
        title: `Unblock ${activeGate.label}`,
        detail: `Provide or confirm: ${missingEvidence}`,
        due: risk.band === "critical" ? "Today" : "Within 24 hours",
        priority: risk.band === "critical" ? "Critical" : "High",
        category: "gate"
      });
    }
  }

  const overdueDocs = listCaseDocuments(item.id).filter((doc) => String(doc.status || "").toLowerCase() === "overdue").slice(0, 2);
  for (const doc of overdueDocs) {
    addAction({
      ownerCode: mapOwnerTextToStakeholderCode(doc.owner),
      title: `Close overdue document: ${doc.name}`,
      detail: `Current status is overdue. Upload or approve immediately to prevent delay.`,
      due: "Today",
      priority: "Critical",
      category: "document",
      message: `Urgent recovery action for ${item.id}: ${doc.name} is overdue. Please complete this today so the transaction can stay on track.`
    });
  }

  const missingStakeholders = getMissingPrimaryStakeholders(item);
  if (missingStakeholders.length) {
    addAction({
      ownerCode: "CONC",
      title: "Fix stakeholder routing gaps",
      detail: `Assign contacts for: ${missingStakeholders.join(", ")}`,
      due: highRisk ? "Today" : "Within 48 hours",
      priority: highRisk ? "High" : "Medium",
      category: "routing",
      message: `Routing action for ${item.id}: stakeholder assignments are missing (${missingStakeholders.join(", ")}). Please update contacts and continue follow-up.`
    });
  }

  if (getCaseOpenEscalationCount(item.id) > 0) {
    addAction({
      ownerCode: "CONC",
      title: "Send client reassurance update",
      detail: "Client-facing update required while recovery actions are underway.",
      due: "Within 4 hours",
      priority: "High",
      category: "client-comms"
    });
  }

  const sequencedActions = sequenceRecoveryActions(actions, risk.band).slice(0, 8);
  const nextBestActions = buildOwnerNextBestActions(sequencedActions)
    .map((action) => ({ ...action, nextBestMessage: buildNextBestActionMessage(item, action, { risk }) }))
    .slice(0, 6);
  const urgentActions = sequencedActions.filter((action) => ["Critical", "High"].includes(action.priority)).length;

  const enrichedRisk = {
    ...risk,
    nextBestOwner: nextBestActions[0]?.ownerCode || risk.nextBestOwner
  };

  return {
    generatedAt: new Date().toISOString(),
    caseId: item.id,
    risk: enrichedRisk,
    activeGate: activeGate ? { id: activeGate.id, label: activeGate.label, owner: activeGate.owner } : null,
    headline:
      risk.band === "critical"
        ? `Critical delay risk detected. Predicted slip: ${enrichedRisk.predictedDelayDays} days unless recovery actions are completed immediately.`
        : risk.band === "high"
          ? `High delay risk detected. Predicted slip: ${enrichedRisk.predictedDelayDays} days without intervention.`
          : risk.band === "medium"
            ? "Moderate delay risk detected. Preventive action is recommended in the next 24 hours."
            : "Delay risk is currently low.",
    actions: sequencedActions,
    nextBestActions,
    summary: {
      totalActions: sequencedActions.length,
      urgentActions,
      contactGaps: sequencedActions.filter((action) => !action.contactReady).length,
      ownersTargeted: new Set(nextBestActions.map((action) => action.ownerCode)).size
    }
  };
}

function buildDelayRiskPriorities(cases, existingIntelMap = null) {
  const priorities = [];
  const intelMap = existingIntelMap || new Map(cases.map((item) => [item.id, buildCaseDelayIntelligence(item)]));
  for (const item of cases) {
    const intel = intelMap.get(item.id);
    if (!intel || !["critical", "high", "medium"].includes(intel.band)) continue;
    const level = intel.band === "critical" || intel.band === "high" ? "high" : "medium";
    priorities.push({
      level,
      caseId: item.id,
      client: item.client,
      issue: `Predicted delay risk: ${intel.band.toUpperCase()} (${intel.score}/100)`,
      detail: `${intel.signals[0]?.label || "Multiple risk signals detected"}${intel.predictedDelayDays ? ` · Predicted slip ${intel.predictedDelayDays} day${intel.predictedDelayDays === 1 ? "" : "s"}` : ""}`,
      due: item.due
    });
  }
  return priorities;
}

function queueRecoveryPlanNotifications(item, plan, { source = "automation", now = new Date() } = {}) {
  const dateKey = getOperationsDateKey(now);
  const conciergePhone = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
  const summary = { queued: 0, fallbackQueued: 0, skipped: 0, ownersTargeted: 0 };
  const nextBest = Array.isArray(plan.nextBestActions) && plan.nextBestActions.length
    ? plan.nextBestActions
    : buildOwnerNextBestActions(plan.actions || []);
  for (const action of nextBest) {
    const dedupeKey = `next-best-action:${item.id}:${action.ownerCode}:${dateKey}`;
    const alreadyQueued = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (alreadyQueued) {
      summary.skipped += 1;
      continue;
    }
    if (action.recipientPhone || action.recipientEmail) {
      const hasPreferredContact =
        action.preferredChannel === "email"
          ? Boolean(cleanEmailAddress(action.recipientEmail || ""))
          : Boolean(cleanPhoneNumber(action.recipientPhone || ""));
      if (!hasPreferredContact && !action.recipientPhone && !action.recipientEmail && !conciergePhone) {
        summary.skipped += 1;
        continue;
      }
      queueOperationsNotification({
        caseId: item.id,
        channel: "auto",
        preferredChannel: action.preferredChannel,
        stakeholderCode: action.ownerCode,
        recipient: action.ownerName || action.recipientPhone || action.recipientEmail,
        recipientPhone: action.recipientPhone,
        recipientEmail: action.recipientEmail,
        template: "next-best-action",
        message: action.nextBestMessage || action.message,
        dedupeKey
      });
      summary.queued += 1;
      summary.ownersTargeted += 1;
      addOperationsAudit("next-best-action", item.id, `${source}: ${action.title} -> ${action.ownerCode}`);
    } else if (conciergePhone) {
      const fallbackKey = `${dedupeKey}:fallback`;
      const fallbackExists = operationsStore.notifications.some((note) => note.dedupeKey === fallbackKey && note.status !== "cancelled");
      if (fallbackExists) {
        summary.skipped += 1;
        continue;
      }
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        recipient: conciergePhone,
        template: "next-best-action",
        message: `Routing gap for ${item.id}: next-best owner ${action.ownerCode} has no contact details. Action: ${action.title}. Please route manually.`,
        dedupeKey: fallbackKey
      });
      summary.fallbackQueued += 1;
      summary.ownersTargeted += 1;
      addOperationsAudit("recovery-routing-gap", item.id, `${source}: ${action.title} -> ${action.ownerCode}`);
    } else {
      summary.skipped += 1;
    }
  }
  if (summary.queued || summary.fallbackQueued) {
    addOperationsTimeline(
      item.id,
      "Next-best actions orchestrated",
      `${summary.ownersTargeted} owner action${summary.ownersTargeted === 1 ? "" : "s"} orchestrated (${summary.queued} direct, ${summary.fallbackQueued} fallback).`
    );
  }
  return summary;
}

function sweepOperationsRecoveryPlans(now = new Date()) {
  const summary = { evaluated: 0, highRiskCases: 0, queued: 0, fallbackQueued: 0, ownersTargeted: 0 };
  for (const item of operationsStore.cases || []) {
    const rulePack = evaluateCaseRulePack(item);
    const intel = buildCaseDelayIntelligence(item, { rulePack, now });
    summary.evaluated += 1;
    if (!["critical", "high", "medium"].includes(intel.band)) continue;
    summary.highRiskCases += 1;
    const plan = buildCaseRecoveryPlan(item, { delayIntel: intel, rulePack });
    const queued = queueRecoveryPlanNotifications(item, plan, { source: "automation", now });
    summary.queued += queued.queued;
    summary.fallbackQueued += queued.fallbackQueued;
    summary.ownersTargeted += queued.ownersTargeted || 0;
  }
  if (summary.queued || summary.fallbackQueued) {
    addOperationsActivity("PLAN", "Self-healing orchestration queued", `${summary.ownersTargeted} owner actions orchestrated (${summary.queued} direct, ${summary.fallbackQueued} fallback).`);
  }
  return summary;
}

function addOperationsTimeline(caseId, title, description) {
  if (!operationsStore.timeline[caseId]) operationsStore.timeline[caseId] = [];
  operationsStore.timeline[caseId].unshift([formatOperationsTime(), title, description]);
}

function addOperationsActivity(icon, title, description) {
  operationsStore.activities.unshift([icon, title, description, "Just now"]);
  operationsStore.activities = operationsStore.activities.slice(0, 12);
}

function addOperationsAudit(type, caseId, detail) {
  operationsStore.auditLog.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    caseId,
    detail
  });
  operationsStore.auditLog = operationsStore.auditLog.slice(0, 250);
}

function addOperationsCaseNote({
  caseId,
  category = "General",
  title = "Case note",
  note = "",
  source = "system",
  createdBy = "System",
  transcript = "",
  summary = "",
  media = null
} = {}) {
  if (!caseId) return null;
  const entry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    caseId,
    category: sanitizeShortText(category, 80) || "General",
    title: sanitizeShortText(title, 180) || "Case note",
    note: sanitizeShortText(note, 4000),
    source: sanitizeShortText(source, 80) || "system",
    createdBy: sanitizeShortText(createdBy, 120) || "System",
    transcript: sanitizeShortText(transcript, 8000),
    summary: sanitizeShortText(summary, 1200),
    media: media && typeof media === "object" ? media : null
  };
  const notes = ensureOperationsCaseNotes();
  notes.unshift(entry);
  operationsStore.caseNotes = notes.slice(0, 2000);
  return entry;
}

function buildOperationsCaseSummary(item) {
  if (!item) return "";
  const appointment = getCaseUpcomingAppointment(item.id);
  const appointmentText = appointment
    ? ` Next appointment: ${appointment.title || formatOperationsAppointmentKind(appointment.kind)} on ${formatOperationsAppointmentTime(appointment.scheduledFor)} (${appointment.status}).`
    : "";
  return `${item.id} is ${item.progress}% complete. Current stage: ${item.stage}. Next action: ${item.next}. Responsible party: ${item.owner}. Due: ${item.due}.${appointmentText}`;
}

function listCaseDocuments(caseId) {
  return operationsStore.documents.filter((entry) => entry.caseId === caseId);
}

function listOutstandingCaseDocuments(caseId) {
  return listCaseDocuments(caseId).filter((entry) => !["Approved"].includes(entry.status));
}

function isOperationsDocumentAwaitingParticipant(doc) {
  const status = String(doc?.status || "").toLowerCase();
  return !["approved", "uploaded"].includes(status);
}

function getOperationsDocumentRole(doc) {
  const owner = normalizeLooseText(doc?.owner || "");
  if (owner.includes("seller")) return "seller";
  if (owner.includes("buyer")) return "buyer";
  if (owner.includes("agent")) return "agent";
  if (owner.includes("attorney") || owner.includes("convey")) return "attorney";
  if (owner.includes("finance") || owner.includes("bond") || owner.includes("bank") || owner.includes("originator")) return "finance";
  return "";
}

function getRoleGuidedOutstandingDocuments(caseId, role = "") {
  const docs = listCaseDocuments(caseId)
    .filter((entry) => isOperationsDocumentRoleMatch(entry, role) && isOperationsDocumentAwaitingParticipant(entry));
  return docs.sort((a, b) => {
    const aDue = parseOperationsDueDate(a?.due, new Date())?.getTime() || Number.MAX_SAFE_INTEGER;
    const bDue = parseOperationsDueDate(b?.due, new Date())?.getTime() || Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    const aCreated = new Date(a?.createdAt || 0).getTime() || 0;
    const bCreated = new Date(b?.createdAt || 0).getTime() || 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return new Date(a?.file?.uploadedAt || 0).getTime() - new Date(b?.file?.uploadedAt || 0).getTime();
  });
}

function getCaseNextGuidedDocument(item, role = "") {
  if (!item?.id) return null;
  return getRoleGuidedOutstandingDocuments(item.id, role)[0] || null;
}

function inferDocumentUploadHint(documentName = "") {
  const name = String(documentName || "").toLowerCase();
  if (name.includes("id")) return "Please send a clear PDF or photo of the ID document.";
  if (name.includes("proof of address")) return "Please send the latest proof of address PDF or photo.";
  if (name.includes("payslip")) return "Please send the latest payslip as PDF or clear photo.";
  if (name.includes("bank statement")) return "Please send the latest stamped bank statement PDF.";
  if (name.includes("offer to purchase") || /\botp\b/.test(name)) return "Please send the signed OTP PDF or photo of every signed page.";
  if (name.includes("mandate")) return "Please send the signed mandate as PDF or clear photo.";
  if (name.includes("bond")) return "Please send the bond document PDF or letter.";
  if (name.includes("guarantee")) return "Please send the guarantee letter PDF.";
  return "Please send a PDF, JPG or PNG of the requested document.";
}

function buildGuidedDocumentRequestMessage(item, document, { includeQueueContext = true } = {}) {
  if (!item?.id || !document?.name) return "";
  const remaining = getRoleGuidedOutstandingDocuments(item.id, getOperationsDocumentRole(document));
  const remainingCount = remaining.length;
  const queueLine = includeQueueContext && remainingCount > 1
    ? ` We are collecting these one at a time. After this, ${remainingCount - 1} more document${remainingCount - 1 === 1 ? "" : "s"} will remain.`
    : "";
  return `${item.id}: next required document is ${document.name}.${document.due ? ` Due: ${document.due}.` : ""} ${inferDocumentUploadHint(document.name)} Reply DOCS for the current checklist or CALL ME if you need help.${queueLine}`;
}

function listRecentCaseTimelineEvents(caseId, limit = 3) {
  const events = operationsStore.timeline?.[caseId] || [];
  return events.slice(0, Math.max(1, limit));
}

function needsHumanOperationsEscalation(question) {
  const q = String(question || "").toLowerCase();
  return /\b(person|human|legal|lawyer|attorney|complain|dispute|commission|negotiat|fraud|urgent manager)\b/.test(q);
}

function buildOperationsAiAnswer(item, question) {
  const q = String(question || "").toLowerCase();
  const outstanding = listOutstandingCaseDocuments(item.id);
  const recentEvents = listRecentCaseTimelineEvents(item.id, 2);
  const docLine =
    outstanding.length > 0
      ? `Outstanding documents: ${outstanding.slice(0, 3).map((doc) => `${doc.name} (${doc.status}, due ${doc.due})`).join("; ")}.`
      : "There are no outstanding documents right now.";
  const recentLine =
    recentEvents.length > 0
      ? `Latest updates: ${recentEvents.map((event) => `${event[0]} ${event[1]}`).join(" | ")}.`
      : "No recent timeline updates are recorded yet.";

  if (q.includes("document") || q.includes("upload") || q.includes("outstanding")) {
    return `${buildOperationsCaseSummary(item)} ${docLine}`;
  }
  if (q.includes("next") || q.includes("happen") || q.includes("status") || q.includes("progress")) {
    return `${buildOperationsCaseSummary(item)} ${recentLine}`;
  }
  if (q.includes("remind") || q.includes("follow up") || q.includes("follow-up")) {
    return `${buildOperationsCaseSummary(item)} I can queue a reminder from this workspace so the responsible party is nudged before the deadline.`;
  }
  return `${buildOperationsCaseSummary(item)} ${docLine} ${recentLine}`;
}

function findOperationsPlaybook(journey) {
  return (operationsStore.playbooks || []).find((item) => item.journey === journey);
}

function ensureOperationsWorkflowRun(item) {
  if (!item) return null;
  const playbook = findOperationsPlaybook(item.journey);
  if (!playbook) return null;
  if (!operationsStore.workflowRuns) operationsStore.workflowRuns = {};
  if (!operationsStore.workflowRuns[item.id]) {
    operationsStore.workflowRuns[item.id] = {
      caseId: item.id,
      playbookId: playbook.id,
      journey: item.journey,
      currentIndex: 0,
      currentMilestoneId: playbook.milestones[0]?.id || null,
      preparedMilestoneIds: [],
      lastPreparedAt: null,
      status: "active"
    };
  }
  return operationsStore.workflowRuns[item.id];
}

function resolveOperationsMilestoneOwner(item, role) {
  const owners = {
    seller: `${item.client} - Seller`,
    buyer: `${item.client} - Buyer`,
    client: `${item.client} - Client`,
    agent: `${item.agent} - Agent`,
    attorney: `${item.attorney} - Attorney`,
    finance: `${item.finance} - Finance`,
    concierge: `${item.concierge} - Concierge`
  };
  return owners[role] || `${item.client} - Client`;
}

function prepareOperationsMilestone(item, { milestoneId = "", advance = false } = {}) {
  const playbook = findOperationsPlaybook(item?.journey);
  const run = ensureOperationsWorkflowRun(item);
  if (!item || !playbook || !run) return null;
  let index = Number(run.currentIndex || 0);
  if (milestoneId) {
    const requestedIndex = playbook.milestones.findIndex((milestone) => milestone.id === milestoneId);
    if (requestedIndex >= 0) index = requestedIndex;
  }
  if (advance) index = Math.min(index + 1, playbook.milestones.length - 1);
  const milestone = playbook.milestones[index];
  if (!milestone) return null;

  const createdDocuments = [];
  const queuedNotifications = [];
  for (const required of milestone.documents || []) {
    const playbookKey = `${item.id}:${milestone.id}:${required.name.toLowerCase()}`;
    let document = operationsStore.documents.find((entry) =>
      entry.caseId === item.id && (entry.playbookKey === playbookKey || entry.name.toLowerCase() === required.name.toLowerCase())
    );
    if (!document) {
      document = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        name: required.name,
        caseId: item.id,
        owner: resolveOperationsMilestoneOwner(item, required.owner),
        due: required.due || milestone.due,
        reminder: "WhatsApp - Queued",
        status: "Requested",
        playbookKey
      };
      operationsStore.documents.unshift(document);
      createdDocuments.push(document);
      const role = getOperationsDocumentRole(document);
      const activeGuidedDoc = getCaseNextGuidedDocument(item, role);
      if (activeGuidedDoc?.id === document.id) {
        const notification = queueOperationsNotification({
          caseId: item.id,
          channel: "auto",
          stakeholderCode: mapOwnerTextToStakeholderCode(document.owner),
          recipient: document.owner,
          template: "document-request",
          message: buildGuidedDocumentRequestMessage(item, document),
          dedupeKey: `playbook-document-request:${playbookKey}`
        });
        queuedNotifications.push(notification);
      }
    } else if (!document.playbookKey) {
      document.playbookKey = playbookKey;
    }
  }

  const wasPrepared = run.preparedMilestoneIds.includes(milestone.id);
  run.currentIndex = index;
  run.currentMilestoneId = milestone.id;
  run.lastPreparedAt = new Date().toISOString();
  if (!wasPrepared) run.preparedMilestoneIds.push(milestone.id);
  item.stage = milestone.title;
  item.next = milestone.next;
  item.owner = milestone.owner.charAt(0).toUpperCase() + milestone.owner.slice(1);
  item.due = milestone.due;
  item.progress = Math.max(Number(item.progress || 0), Number(milestone.progress || 0));
  item.status = item.progress >= 100 ? "Complete" : "In progress";

  if (!wasPrepared || createdDocuments.length) {
    addOperationsTimeline(item.id, `${milestone.title} prepared automatically`, `${playbook.name} prepared ${createdDocuments.length} new document request${createdDocuments.length === 1 ? "" : "s"} and assigned the next action to ${item.owner}.`);
    addOperationsActivity("FLOW", "Milestone prepared", `${item.id} - ${milestone.title} - ${createdDocuments.length} document request${createdDocuments.length === 1 ? "" : "s"}`);
  }
  addOperationsAudit("milestone-prepared", item.id, `${milestone.id}: ${createdDocuments.length} documents created`);
  return { playbook, run, milestone, createdDocuments, queuedNotifications, wasPrepared };
}

function resolveOperationsRecipientPhone(recipient, caseId) {
  const explicit = cleanPhoneNumber(recipient);
  if (explicit) return explicit;
  const ownerText = String(recipient || "").toLowerCase();
  const matchingUser = getOperationUsersForLogin().find((item) => ownerText.includes(String(item.name || "").toLowerCase()));
  if (matchingUser) return matchingUser.cellphone;
  const item = findOperationsCase(caseId);
  if (item?.cellphone) return cleanPhoneNumber(item.cellphone);
  const participant = getOperationUsersForLogin().find((user) => user.caseIds.includes(caseId) && ["seller", "buyer"].includes(user.role));
  return participant?.cellphone || "";
}

function resolveOperationsRecipientEmail(recipient, caseId, stakeholderCode = "") {
  const explicit = cleanEmailAddress(recipient);
  if (explicit) return explicit;
  const ownerText = String(recipient || "").toLowerCase();
  const caseItem = findOperationsCase(caseId);
  if (caseItem) {
    normalizeCaseStakeholderEmails(caseItem);
    const fromStakeholder = cleanEmailAddress(caseItem.stakeholderEmails?.[stakeholderCode] || "");
    if (fromStakeholder) return fromStakeholder;
    if (stakeholderCode === "TRANS") return cleanEmailAddress(caseItem.attorneyEmail || "") || "";
    if (stakeholderCode === "ORIG") return cleanEmailAddress(caseItem.financeEmail || "") || "";
    if (stakeholderCode === "AGENT") return cleanEmailAddress(caseItem.agentEmail || "") || "";
    if (["SELL", "BUY"].includes(stakeholderCode)) return cleanEmailAddress(caseItem.email || "") || "";
  }
  const matchingIdentity = getOperationsIdentities().find((entry) =>
    cleanEmailAddress(entry.email || "") &&
    Array.isArray(entry.caseIds) &&
    entry.caseIds.includes(caseId) &&
    (ownerText.includes(String(entry.name || "").toLowerCase()) || !ownerText)
  );
  if (matchingIdentity) return cleanEmailAddress(matchingIdentity.email || "") || "";
  const anyCaseIdentity = getOperationsIdentities().find((entry) =>
    cleanEmailAddress(entry.email || "") &&
    Array.isArray(entry.caseIds) &&
    entry.caseIds.includes(caseId)
  );
  if (anyCaseIdentity) return cleanEmailAddress(anyCaseIdentity.email || "") || "";
  return "";
}

function buildOperationsNotificationMessage(notification) {
  const item = findOperationsCase(notification.caseId);
  const caseLabel = item ? `${item.id} - ${item.client}` : notification.caseId;
  const messages = {
    "journey-welcome": `Welcome to Axiom Realty AI. Your property journey ${caseLabel} is active. Sign in to see the next step and outstanding information.`,
    "smart-reminder": `Axiom Realty AI reminder for ${caseLabel}: ${notification.message || item?.next || "Please review your next action."}`,
    "manual-reply": `${notification.message || `Axiom Realty AI update for ${caseLabel}.`}`,
    "document-request": `Axiom Realty AI document request for ${caseLabel}: please provide ${notification.message || "the requested document"}. Your secure portal shows the due date and upload route.`,
    "document-reminder": `Axiom Realty AI reminder for ${caseLabel}: ${notification.message || "A requested document is still outstanding."}`,
    "gate-nudge": `Axiom Realty AI control-gate alert for ${caseLabel}: ${notification.message || "A control gate needs owner action."}`,
    "recovery-nudge": `Axiom Realty AI recovery action for ${caseLabel}: ${notification.message || "A recovery action needs owner attention."}`,
    "next-best-action": `Axiom Realty AI next-best action for ${caseLabel}: ${notification.message || "Your next best recovery action is ready."}`,
    "moving-services-offer": `${notification.message || "Would you like help with trusted moving partner quotations? Reply Y or N."}`,
    "moving-services-followup": `${notification.message || "Thanks for your response. We have updated your preference."}`,
    "bond-originator-offer": `${notification.message || "Would you like our bond originator to negotiate competing finance quotes for you? Reply Y or N."}`,
    "bond-originator-followup": `${notification.message || "Thanks for your bond-originator preference. We have updated your case."}`,
    "life-cover-offer": `${notification.message || "Would you like us to compare life cover options for your property loan requirements? Reply Y or N."}`,
    "life-cover-followup": `${notification.message || "Thanks for your life-cover preference. We have updated your case."}`,
    "electrical-coc-offer": `${notification.message || "Would you like help arranging a trusted electrician for the Electrical Compliance Certificate? Reply Y or N."}`,
    "electrical-coc-followup": `${notification.message || "Thanks for your Electrical Compliance Certificate preference. We have updated your case."}`,
    "gas-coc-offer": `${notification.message || "Do you need help arranging a trusted partner for your Gas Certificate of Compliance? Reply Y or N."}`,
    "gas-coc-followup": `${notification.message || "Thanks for your Gas Certificate of Compliance preference. We have updated your case."}`,
    "birthday-client": `${notification.message || `Happy birthday from Axiom Realty AI. Wishing you a fantastic year ahead.`}`,
    "birthday-agent": `${notification.message || `Birthday note for ${caseLabel}: your client has a birthday today. A quick personal message is recommended.`}`,
    "next-step-brief": `${notification.message || `Axiom Realty AI next-step brief for ${caseLabel}: check your next required action in the portal now.`}`,
    "silence-watchdog": `${notification.message || `Axiom Realty AI update for ${caseLabel}: we are actively monitoring your journey and preparing the next update.`}`,
    "partner-readiness": `${notification.message || `Axiom Realty AI readiness check for ${caseLabel}: please confirm you are ready for the upcoming control gate.`}`,
    "decision-countdown": `${notification.message || `Axiom Realty AI countdown for ${caseLabel}: a decision window is approaching. Please action your next step.`}`,
    "red-flag-alert": `${notification.message || `Axiom Realty AI red-flag alert: one or more journeys need concierge intervention.`}`
  };
  return messages[notification.template] || `Axiom Realty AI update for ${caseLabel}: ${notification.message || "Please review your portal."}`;
}

function selectNotificationChannel({ preferredChannel = "", stakeholderCode = "", explicitChannel = "auto", hasPhone = false, hasEmail = false }) {
  const explicit = String(explicitChannel || "auto").toLowerCase();
  if (["whatsapp", "email"].includes(explicit)) return explicit;
  const preferred = (preferredChannel || preferredChannelForStakeholder(stakeholderCode || "") || "whatsapp").toLowerCase();
  if (preferred === "email") return hasEmail ? "email" : hasPhone ? "whatsapp" : "email";
  if (preferred === "whatsapp") return hasPhone ? "whatsapp" : hasEmail ? "email" : "whatsapp";
  return hasPhone ? "whatsapp" : "email";
}

function queueOperationsNotification({
  caseId,
  channel = "auto",
  preferredChannel = "",
  stakeholderCode = "",
  recipient,
  recipientPhone = "",
  recipientEmail = "",
  template,
  message = "",
  dedupeKey = null,
  bypassPause = false
}) {
  if (dedupeKey) {
    const existing = operationsStore.notifications.find((item) => item.dedupeKey === dedupeKey && item.status !== "cancelled");
    if (existing) return existing;
  }
  const item = caseId ? findOperationsCase(caseId) : null;
  if (!bypassPause && item && isCaseAutomationPaused(item)) {
    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      caseId,
      channel: (channel || "auto").toLowerCase(),
      preferredChannel: (preferredChannel || preferredChannelForStakeholder(stakeholderCode || "") || channel || "auto").toLowerCase(),
      stakeholderCode: stakeholderCode || null,
      recipient,
      recipientPhone: cleanPhoneNumber(recipientPhone) || "",
      recipientEmail: cleanEmailAddress(recipientEmail) || "",
      template,
      message,
      dedupeKey,
      status: "paused-human-takeover",
      attempts: 0,
      lastAttemptAt: null,
      deliveredAt: null,
      nextRetryAt: null,
      lastError: "Automation paused for human takeover",
      providerStatus: "paused-human-takeover"
    };
  }
  const phone = cleanPhoneNumber(recipientPhone) || resolveOperationsRecipientPhone(recipient, caseId);
  const email = cleanEmailAddress(recipientEmail) || resolveOperationsRecipientEmail(recipient, caseId, stakeholderCode);
  const selectedChannel = selectNotificationChannel({
    preferredChannel,
    stakeholderCode,
    explicitChannel: channel,
    hasPhone: Boolean(phone),
    hasEmail: Boolean(email)
  });
  const notification = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caseId,
    channel: selectedChannel,
    preferredChannel: (preferredChannel || preferredChannelForStakeholder(stakeholderCode || "") || selectedChannel).toLowerCase(),
    stakeholderCode: stakeholderCode || null,
    recipient,
    recipientPhone: phone || "",
    recipientEmail: email || "",
    template,
    message,
    dedupeKey,
    status: "queued",
    attempts: 0,
    lastAttemptAt: null,
    deliveredAt: null,
    nextRetryAt: null,
    lastError: null,
    providerStatus: null
  };
  operationsStore.notifications.unshift(notification);
  return notification;
}

async function sendOperationsWebhook(notification, text) {
  const endpoint = (process.env.OPERATIONS_NOTIFICATION_WEBHOOK_URL || "").trim();
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPERATIONS_WEBHOOK_SECRET ? { "x-axiom-webhook-secret": process.env.OPERATIONS_WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify({
        notificationId: notification.id,
        caseId: notification.caseId,
        channel: notification.channel,
        recipient: notification.recipient,
        recipientPhone: notification.recipientPhone,
        recipientEmail: notification.recipientEmail || "",
        template: notification.template,
        message: text
      })
    });
    if (!response.ok) return { delivered: false, status: `webhook-${response.status}`, reason: await response.text() };
    return { delivered: true, status: "webhook-accepted" };
  } catch (error) {
    return { delivered: false, status: "webhook-error", reason: error.message };
  }
}

async function sendOperationsEmail(notification, text) {
  const endpoint = (process.env.OPERATIONS_EMAIL_WEBHOOK_URL || "").trim();
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OPERATIONS_WEBHOOK_SECRET ? { "x-axiom-webhook-secret": process.env.OPERATIONS_WEBHOOK_SECRET } : {})
        },
        body: JSON.stringify({
          notificationId: notification.id,
          caseId: notification.caseId,
          channel: "email",
          recipient: notification.recipient,
          to: notification.recipientEmail,
          template: notification.template,
          subject: `Axiom Realty OS update - ${notification.caseId}`,
          message: text
        })
      });
      if (!response.ok) return { delivered: false, status: `email-webhook-${response.status}`, reason: await response.text() };
      return { delivered: true, status: "email-webhook-accepted" };
    } catch (error) {
      return { delivered: false, status: "email-webhook-error", reason: error.message };
    }
  }
  return { delivered: false, status: "email-channel-missing", reason: "Email delivery webhook is not configured" };
}

async function deliverOperationsNotification(notification) {
  notification.attempts = Number(notification.attempts || 0) + 1;
  notification.lastAttemptAt = new Date().toISOString();
  notification.updatedAt = notification.lastAttemptAt;
  const text = buildOperationsNotificationMessage(notification);
  let result = null;
  if (notification.channel === "email") {
    if (!cleanEmailAddress(notification.recipientEmail || "")) {
      result = { delivered: false, status: "missing-email", reason: "Recipient email is missing" };
    } else {
      result = await sendOperationsEmail(notification, text);
      if (!result.delivered && (process.env.OPERATIONS_NOTIFICATION_WEBHOOK_URL || "").trim()) {
        const webhookFallback = await sendOperationsWebhook(notification, text);
        if (webhookFallback?.delivered) result = webhookFallback;
      }
    }
  } else {
    const webhookResult = await sendOperationsWebhook(notification, text);
    result = webhookResult || await sendWhatsAppText(text, { to: notification.recipientPhone });
  }
  notification.providerStatus = result.status || null;
  if (result.delivered) {
    notification.status = "delivered";
    notification.deliveredAt = new Date().toISOString();
    notification.nextRetryAt = null;
    notification.lastError = null;
    addOperationsActivity("MSG", "Notification delivered", `${notification.caseId} - ${notification.recipient} - ${notification.template}`);
    addOperationsAudit("notification-delivered", notification.caseId, `${notification.template}: ${notification.recipient}`);
  } else {
    notification.status = notification.attempts >= 3 ? "failed" : "waiting-channel";
    notification.lastError = sanitizeShortText(result.reason || "Delivery channel unavailable", 500);
    notification.nextRetryAt = notification.status === "failed" ? null : new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
  return notification;
}

async function processOperationsNotifications({ limit = 20, forceRetry = false } = {}) {
  const now = Date.now();
  const candidates = operationsStore.notifications
    .filter((item) =>
      item.status === "queued" ||
      (forceRetry && ["waiting-channel", "failed"].includes(item.status)) ||
      (item.status === "waiting-channel" && (!item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now))
    )
    .slice(0, limit);
  for (const notification of candidates) {
    await deliverOperationsNotification(notification);
  }
  operationsStore.automation.lastDeliveryRunAt = new Date().toISOString();
  persistOperations();
  return {
    processed: candidates.length,
    delivered: candidates.filter((item) => item.status === "delivered").length,
    waiting: candidates.filter((item) => item.status === "waiting-channel").length,
    failed: candidates.filter((item) => item.status === "failed").length
  };
}

function parseOperationsDueDate(value, now = new Date()) {
  const label = String(value || "").trim().toLowerCase();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (label === "today") return dayStart;
  if (label === "tomorrow") return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const within = /^within\s+(\d+)\s+day/.exec(label);
  if (within) return new Date(dayStart.getTime() + Number(within[1]) * 24 * 60 * 60 * 1000);
  const monthMatch = /^(\d{1,2})\s+([a-z]{3})$/.exec(label);
  if (!monthMatch) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(monthMatch[2]);
  if (month < 0) return null;
  return new Date(now.getFullYear(), month, Number(monthMatch[1]));
}

function parseBirthdayMonthDay(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[2]}-${iso[3]}`;
  const md = /^(\d{2})-(\d{2})$/.exec(raw);
  if (md) return `${md[1]}-${md[2]}`;
  return null;
}

function resolveCaseParticipantPhone(item, role) {
  if (!item) return "";
  if (role === "seller" && item.journey === "seller" && item.cellphone) return cleanPhoneNumber(item.cellphone) || "";
  if (role === "buyer" && item.journey === "buyer" && item.cellphone) return cleanPhoneNumber(item.cellphone) || "";
  const identity = getOperationsIdentities().find((entry) =>
    entry.role === role &&
    Array.isArray(entry.caseIds) &&
    entry.caseIds.includes(item.id) &&
    cleanPhoneNumber(entry.cellphone)
  );
  if (identity) return cleanPhoneNumber(identity.cellphone) || "";
  const mappedUser = getOperationUsersForLogin().find((entry) =>
    entry.role === role &&
    Array.isArray(entry.caseIds) &&
    entry.caseIds.includes(item.id) &&
    cleanPhoneNumber(entry.cellphone)
  );
  return mappedUser ? cleanPhoneNumber(mappedUser.cellphone) || "" : "";
}

function sweepOperationsBirthdays(now = new Date()) {
  const todayMd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const summary = { checked: 0, queued: 0, agentAlerts: 0 };

  for (const item of operationsStore.cases || []) {
    normalizeCaseBirthdays(item);
    for (const role of ["seller", "buyer"]) {
      const birthdayMd = parseBirthdayMonthDay(item.birthdays?.[role] || "");
      if (!birthdayMd) continue;
      summary.checked += 1;
      if (birthdayMd !== todayMd) continue;

      const clientName = role === "seller" ? `${item.client} (Seller)` : `${item.client} (Buyer)`;
      const birthdayKey = `birthday-client:${item.id}:${role}:${currentYear}`;
      const existingClient = operationsStore.notifications.some((note) => note.dedupeKey === birthdayKey && note.status !== "cancelled");
      const recipientPhone = resolveCaseParticipantPhone(item, role);
      if (!existingClient && recipientPhone) {
        queueOperationsNotification({
          caseId: item.id,
          recipient: recipientPhone,
          template: "birthday-client",
          message: `Happy birthday ${item.client.split(/\s+/)[0] || ""}! Wishing you a wonderful day from the Axiom Realty team.`,
          dedupeKey: birthdayKey
        });
        summary.queued += 1;
      }

      const agentPhone = cleanPhoneNumber(item.agentPhone || "") || resolveOperationsRecipientPhone(`${item.agent} - Agent`, item.id);
      const agentKey = `birthday-agent:${item.id}:${role}:${currentYear}`;
      const existingAgent = operationsStore.notifications.some((note) => note.dedupeKey === agentKey && note.status !== "cancelled");
      if (!existingAgent && agentPhone) {
        queueOperationsNotification({
          caseId: item.id,
          recipient: agentPhone,
          template: "birthday-agent",
          message: `Client birthday alert for ${item.id}: ${clientName} has a birthday today. Please send a short personal congratulatory message.`,
          dedupeKey: agentKey
        });
        summary.agentAlerts += 1;
      }

      if (!existingClient || !existingAgent) {
        addOperationsTimeline(
          item.id,
          "Birthday automation triggered",
          `${clientName} birthday greeting${recipientPhone ? " queued" : " pending phone capture"} and agent follow-up alert queued.`
        );
        addOperationsActivity("BDAY", "Birthday outreach queued", `${item.id} - ${clientName}`);
        addOperationsAudit("birthday-automation", item.id, `${role} birthday outreach`);
      }
    }
  }

  return summary;
}

function isCaseTransactionApproved(item) {
  if (!item) return false;
  const rulePack = evaluateCaseRulePack(item);
  if (rulePack.overallStatus === "ready") return true;
  const stageText = `${item.stage || ""} ${item.status || ""}`.toLowerCase();
  if (stageText.includes("registration") && (stageText.includes("complete") || Number(item.progress || 0) >= 100)) return true;
  return false;
}

function sweepOperationsMovingServicesOffer(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const offerText =
    "Have you secured a property removal company to take care of your moving needs? Would you like us to ask our highly reputed partners to contact you with discounted quotations to compare? Reply Y or N.";

  for (const item of operationsStore.cases || []) {
    if (!isCaseTransactionApproved(item)) continue;
    normalizeCaseMovingServices(item);
    for (const role of ["seller", "buyer"]) {
      const roleState = item.movingServices?.[role];
      if (!roleState) continue;
      summary.checked += 1;
      if (roleState.response) continue;
      const recipientPhone = resolveCaseParticipantPhone(item, role);
      if (!recipientPhone) continue;
      const dedupeKey = `moving-services-offer:${item.id}:${role}`;
      const existing = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
      if (existing) continue;
      const notification = queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: role === "seller" ? "SELL" : "BUY",
        recipient: recipientPhone,
        recipientPhone,
        template: "moving-services-offer",
        message: offerText,
        dedupeKey
      });
      roleState.offeredAt = roleState.offeredAt || new Date().toISOString();
      roleState.lastNotificationId = notification.id;
      addOperationsTimeline(
        item.id,
        "Moving services offer sent",
        `${role === "seller" ? "Seller" : "Buyer"} received an opt-in message for discounted moving quotations (reply Y/N).`
      );
      addOperationsActivity("MOVE", "Moving services offer queued", `${item.id} - ${role}`);
      addOperationsAudit("moving-services-offer", item.id, `${role} offer sent`);
      summary.queued += 1;
    }
  }
  return summary;
}

function caseNeedsElectricalCoCSupport(item) {
  const docs = listCaseDocuments(item.id);
  return docs.some((doc) => {
    const name = String(doc.name || "").toLowerCase();
    const status = String(doc.status || "").toLowerCase();
    const isElectricalCoC =
      name.includes("electrical compliance certificate") ||
      name.includes("certificate of electrical compliance") ||
      (name.includes("electrical") && /\bcoc\b/.test(name)) ||
      name.includes("electrical coc");
    return isElectricalCoC && !["approved", "uploaded"].includes(status);
  });
}

function caseNeedsGasCoCSupport(item) {
  const docs = listCaseDocuments(item.id);
  return docs.some((doc) => {
    const name = String(doc.name || "").toLowerCase();
    const status = String(doc.status || "").toLowerCase();
    const isGasCoC =
      name.includes("gas compliance certificate") ||
      name.includes("certificate of gas compliance") ||
      (name.includes("gas") && /\bcoc\b/.test(name)) ||
      name.includes("gas coc") ||
      name.includes("liquid gas certificate") ||
      name.includes("lpg compliance certificate");
    return isGasCoC && !["approved", "uploaded"].includes(status);
  });
}

function sweepOperationsElectricalCoCOffer(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const offerText =
    "Do you have a qualified electrician to provide you with a Certificate of Electrical Compliance, or would you like us to arrange a trusted partner to contact you to obtain the certificate? Reply Y or N.";

  for (const item of operationsStore.cases || []) {
    if (!caseNeedsElectricalCoCSupport(item)) continue;
    normalizeCaseComplianceSupport(item);
    const electrical = item.complianceSupport?.electricalCoC;
    if (!electrical) continue;
    summary.checked += 1;
    if (electrical.response) continue;
    const recipientPhone = resolveCaseParticipantPhone(item, "seller");
    if (!recipientPhone) continue;
    const dedupeKey = `electrical-coc-offer:${item.id}:seller`;
    const existing = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (existing) continue;
    const notification = queueOperationsNotification({
      caseId: item.id,
      channel: "whatsapp",
      stakeholderCode: "SELL",
      recipient: recipientPhone,
      recipientPhone,
      template: "electrical-coc-offer",
      message: offerText,
      dedupeKey
    });
    electrical.offeredAt = electrical.offeredAt || new Date().toISOString();
    electrical.lastNotificationId = notification.id;
    addOperationsTimeline(
      item.id,
      "Electrical COC support offer sent",
      "Seller received an opt-in message for trusted electrician support (reply Y/N)."
    );
    addOperationsActivity("COC", "Electrical COC support queued", `${item.id} - seller`);
    addOperationsAudit("electrical-coc-offer", item.id, "seller offer sent");
    summary.queued += 1;
  }
  return summary;
}

function sweepOperationsGasCoCOffer(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const offerText =
    "Should you be selling a property with any liquid gas installation (e.g., stoves, geysers, heaters), the seller must obtain a Gas Certificate of Compliance at their own expense prior to transfer. Would you like one of our trusted partners to contact you in this regard? Reply Y or N.";

  for (const item of operationsStore.cases || []) {
    if (!caseNeedsGasCoCSupport(item)) continue;
    normalizeCaseComplianceSupport(item);
    const gas = item.complianceSupport?.gasCoC;
    if (!gas) continue;
    summary.checked += 1;
    if (gas.response) continue;
    const recipientPhone = resolveCaseParticipantPhone(item, "seller");
    if (!recipientPhone) continue;
    const dedupeKey = `gas-coc-offer:${item.id}:seller`;
    const existing = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (existing) continue;
    const notification = queueOperationsNotification({
      caseId: item.id,
      channel: "whatsapp",
      stakeholderCode: "SELL",
      recipient: recipientPhone,
      recipientPhone,
      template: "gas-coc-offer",
      message: offerText,
      dedupeKey
    });
    gas.offeredAt = gas.offeredAt || new Date(now).toISOString();
    gas.lastNotificationId = notification.id;
    addOperationsTimeline(
      item.id,
      "Gas COC support offer sent",
      "Seller received an opt-in message for trusted gas compliance support (reply Y/N)."
    );
    addOperationsActivity("GAS", "Gas COC support queued", `${item.id} - seller`);
    addOperationsAudit("gas-coc-offer", item.id, "seller offer sent");
    summary.queued += 1;
  }
  return summary;
}

function caseNeedsBondOriginatorSupport(item) {
  if (!item) return false;
  if (!["buyer", "transfer"].includes(String(item.journey || "").toLowerCase())) return false;
  const docs = listCaseDocuments(item.id);
  return docs.some((doc) => {
    const name = String(doc.name || "").toLowerCase();
    const status = String(doc.status || "").toLowerCase();
    const owner = String(doc.owner || "").toLowerCase();
    const financeRelated =
      name.includes("bond") ||
      name.includes("pre-approval") ||
      name.includes("pre approval") ||
      name.includes("payslip") ||
      name.includes("bank statement") ||
      name.includes("proof of income") ||
      name.includes("mortgage") ||
      name.includes("finance");
    const buyerOrFinanceOwner = owner.includes("buyer") || owner.includes("finance") || owner.includes("originator") || owner.includes("bank");
    return financeRelated && buyerOrFinanceOwner && !["approved", "uploaded"].includes(status);
  });
}

function sweepOperationsBondOriginatorOffer(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const offerText =
    "Are you comfortable that you already have a financial partner who will secure your best possible offer, or would you like our bond originator to negotiate the best deal by obtaining competing quotes from multiple financial institutions for you? Reply Y or N.";

  for (const item of operationsStore.cases || []) {
    if (!caseNeedsBondOriginatorSupport(item)) continue;
    normalizeCaseFinanceSupport(item);
    const finance = item.financeSupport?.bondOriginator;
    if (!finance) continue;
    summary.checked += 1;
    if (finance.response) continue;
    const recipientPhone = resolveCaseParticipantPhone(item, "buyer");
    if (!recipientPhone) continue;
    const dedupeKey = `bond-originator-offer:${item.id}:buyer`;
    const existing = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (existing) continue;
    const notification = queueOperationsNotification({
      caseId: item.id,
      channel: "whatsapp",
      stakeholderCode: "BUY",
      recipient: recipientPhone,
      recipientPhone,
      template: "bond-originator-offer",
      message: offerText,
      dedupeKey
    });
    finance.offeredAt = finance.offeredAt || notification.createdAt || new Date(now).toISOString();
    finance.lastNotificationId = notification.id;
    addOperationsTimeline(
      item.id,
      "Bond originator support offer sent",
      "Buyer received an opt-in message for bond originator support (reply Y/N)."
    );
    addOperationsActivity("BOND", "Bond originator support queued", `${item.id} - buyer`);
    addOperationsAudit("bond-originator-offer", item.id, "buyer offer sent");
    summary.queued += 1;
  }
  return summary;
}

function sweepOperationsLifeCoverOffer(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const offerText =
    "While banks require life cover as security for a property loan (or mortgage), you are not forced to buy the life cover policy directly from the bank issuing your loan. Would you like us to search, compare and find you the best possible offer? Reply Y or N.";

  for (const item of operationsStore.cases || []) {
    if (!caseNeedsBondOriginatorSupport(item)) continue;
    normalizeCaseFinanceSupport(item);
    const finance = item.financeSupport?.lifeCover;
    if (!finance) continue;
    summary.checked += 1;
    if (finance.response) continue;
    const recipientPhone = resolveCaseParticipantPhone(item, "buyer");
    if (!recipientPhone) continue;
    const dedupeKey = `life-cover-offer:${item.id}:buyer`;
    const existing = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (existing) continue;
    const notification = queueOperationsNotification({
      caseId: item.id,
      channel: "whatsapp",
      stakeholderCode: "BUY",
      recipient: recipientPhone,
      recipientPhone,
      template: "life-cover-offer",
      message: offerText,
      dedupeKey
    });
    finance.offeredAt = finance.offeredAt || notification.createdAt || new Date(now).toISOString();
    finance.lastNotificationId = notification.id;
    addOperationsTimeline(
      item.id,
      "Life cover support offer sent",
      "Buyer received an opt-in message to compare life cover options (reply Y/N)."
    );
    addOperationsActivity("LIFE", "Life cover support queued", `${item.id} - buyer`);
    addOperationsAudit("life-cover-offer", item.id, "buyer offer sent");
    summary.queued += 1;
  }
  return summary;
}

function sweepOperationsAppointmentLoops(now = new Date()) {
  const summary = { checked: 0, queued: 0, alreadyQueued: 0, escalated: 0 };
  for (const appointment of ensureOperationsAppointments()) {
    if (!appointment.caseId || !appointment.scheduledFor) continue;
    if (["completed", "cancelled", "missed"].includes(appointment.status)) continue;
    summary.checked += 1;
    const item = findOperationsCase(appointment.caseId);
    if (!item) continue;
    const scheduledAt = new Date(appointment.scheduledFor);
    if (Number.isNaN(scheduledAt.getTime())) continue;
    const diffMs = scheduledAt.getTime() - now.getTime();
    const hoursUntil = diffMs / (60 * 60 * 1000);
    const hoursPast = (now.getTime() - scheduledAt.getTime()) / (60 * 60 * 1000);

    if (appointment.participantPhone && ["pending-confirmation", "proposed", "reschedule-requested"].includes(appointment.status) && hoursUntil <= 30 && hoursUntil >= 3) {
      const dedupeKey = `appointment-confirm:${appointment.id}:${getOperationsDateKey(now)}`;
      const exists = operationsStore.notifications.some((entry) => entry.dedupeKey === dedupeKey && entry.status !== "cancelled");
      if (exists) {
        summary.alreadyQueued += 1;
      } else {
        const notification = queueOperationsNotification({
          caseId: item.id,
          channel: "auto",
          preferredChannel: "whatsapp",
          stakeholderCode: mapOwnerTextToStakeholderCode(appointment.participantRole || appointment.participantName),
          recipient: appointment.participantName || appointment.participantPhone,
          recipientPhone: appointment.participantPhone,
          template: "appointment-confirmation",
          message: buildAppointmentWhatsappMessage(item, appointment, { mode: "confirm-reminder" }),
          dedupeKey
        });
        if (notification.status === "queued") {
          appointment.lastReminderAt = new Date().toISOString();
          appointment.lastNotificationId = notification.id;
          appointment.updatedAt = new Date().toISOString();
          summary.queued += 1;
          addOperationsTimeline(item.id, "Appointment confirmation reminder queued", `${appointment.title || formatOperationsAppointmentKind(appointment.kind)} reminder queued for ${appointment.participantName || appointment.participantPhone}.`);
          addOperationsActivity("BOOK", "Appointment reminder queued", `${item.id} - ${appointment.title || formatOperationsAppointmentKind(appointment.kind)}`);
          addOperationsAudit("appointment-confirmation-reminder", item.id, appointment.id);
        }
      }
    }

    if (appointment.participantPhone && appointment.status === "confirmed" && hoursUntil <= 4 && hoursUntil >= 0) {
      const dedupeKey = `appointment-dayof:${appointment.id}:${getOperationsDateKey(now)}`;
      const exists = operationsStore.notifications.some((entry) => entry.dedupeKey === dedupeKey && entry.status !== "cancelled");
      if (exists) {
        summary.alreadyQueued += 1;
      } else {
        const notification = queueOperationsNotification({
          caseId: item.id,
          channel: "auto",
          preferredChannel: "whatsapp",
          stakeholderCode: mapOwnerTextToStakeholderCode(appointment.participantRole || appointment.participantName),
          recipient: appointment.participantName || appointment.participantPhone,
          recipientPhone: appointment.participantPhone,
          template: "appointment-day-of",
          message: buildAppointmentWhatsappMessage(item, appointment, { mode: "day-of" }),
          dedupeKey
        });
        if (notification.status === "queued") {
          appointment.lastReminderAt = new Date().toISOString();
          appointment.lastNotificationId = notification.id;
          appointment.updatedAt = new Date().toISOString();
          summary.queued += 1;
          addOperationsTimeline(item.id, "Appointment day-of reminder queued", `${appointment.title || formatOperationsAppointmentKind(appointment.kind)} day-of reminder queued for ${appointment.participantName || appointment.participantPhone}.`);
          addOperationsActivity("BOOK", "Appointment day-of reminder", `${item.id} - ${appointment.title || formatOperationsAppointmentKind(appointment.kind)}`);
          addOperationsAudit("appointment-dayof-reminder", item.id, appointment.id);
        }
      }
    }

    if (hoursPast >= 2 && ["pending-confirmation", "confirmed", "reschedule-requested", "proposed"].includes(appointment.status)) {
      const escalationKey = `appointment-overdue:${appointment.id}:${getOperationsDateKey(now)}`;
      if (!operationsStore.escalations.some((entry) => entry.dedupeKey === escalationKey)) {
        operationsStore.escalations.unshift(createOperationsEscalation({
          item,
          question: `${appointment.title || formatOperationsAppointmentKind(appointment.kind)} appears unattended after ${formatOperationsAppointmentTime(appointment.scheduledFor)}. Confirm outcome, reschedule if needed, and record the next dated move.`,
          owner: item.concierge || "Concierge queue",
          dedupeKey: escalationKey
        }));
        summary.escalated += 1;
      }
    }
  }
  return summary;
}

function sweepOperationsReminders({ fullAutomation = true } = {}) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const summary = { inspected: 0, queued: 0, alreadyQueued: 0, escalated: 0 };
  for (const document of operationsStore.documents) {
    if (["Approved", "Uploaded"].includes(document.status)) continue;
    const due = parseOperationsDueDate(document.due, now);
    if (!due) continue;
    summary.inspected += 1;
    const days = Math.ceil((due.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (days > 7) continue;
    const stage = days < 0 ? "overdue" : days === 0 ? "due-today" : `due-${days}d`;
    const dedupeKey = `document-reminder:${document.id}:${stage}`;
    const alreadyQueued = operationsStore.notifications.some((item) => item.dedupeKey === dedupeKey && item.status !== "cancelled");
    if (alreadyQueued) summary.alreadyQueued += 1;
    const role = getOperationsDocumentRole(document);
    const guidedDocs = getRoleGuidedOutstandingDocuments(document.caseId, role);
    const activeDoc = guidedDocs[0];
    if (activeDoc?.id !== document.id) continue;
    const notification = queueOperationsNotification({
      caseId: document.caseId,
      channel: "auto",
      preferredChannel: "whatsapp",
      stakeholderCode: mapOwnerTextToStakeholderCode(document.owner),
      recipient: document.owner,
      template: "document-reminder",
      message: buildGuidedDocumentRequestMessage(findOperationsCase(document.caseId) || { id: document.caseId }, {
        ...document,
        due: days < 0 ? `${document.due} (overdue)` : document.due
      }),
      dedupeKey
    });
    if (!alreadyQueued && notification.status === "queued" && notification.attempts === 0) {
      summary.queued += 1;
      document.reminder = `Automation - ${stage}`;
      addOperationsTimeline(document.caseId, "Automated document reminder queued", `${document.owner} will receive a reminder because ${document.name} is ${stage.replace("-", " ")}.`);
      addOperationsActivity("AUTO", "Automated reminder queued", `${document.caseId} - ${document.name} - ${stage}`);
    }
    if (days <= 2) {
      const escalationKey = `document-escalation:${document.id}:${stage}`;
      if (!operationsStore.escalations.some((item) => item.dedupeKey === escalationKey)) {
        const escalationCase = findOperationsCase(document.caseId) || { id: document.caseId, client: document.owner, concierge: "Concierge queue" };
        operationsStore.escalations.unshift(createOperationsEscalation({
          item: escalationCase,
          question: `${document.name} is ${stage.replace("-", " ")}. Concierge follow-up is recommended.`,
          owner: "Concierge queue",
          dedupeKey: escalationKey
        }));
        summary.escalated += 1;
      }
    }
  }
  const smartReminderSummary = queueSmartWhatsappReminderFlows(now);
  const appointmentSummary = fullAutomation ? sweepOperationsAppointmentLoops(now) : { checked: 0, queued: 0, alreadyQueued: 0, escalated: 0, skipped: true };
  const birthdaySummary = fullAutomation ? sweepOperationsBirthdays(now) : { checked: 0, queued: 0, skipped: true };
  const movingSummary = fullAutomation ? sweepOperationsMovingServicesOffer(now) : { checked: 0, queued: 0, skipped: true };
  const bondOriginatorSummary = fullAutomation ? sweepOperationsBondOriginatorOffer(now) : { checked: 0, queued: 0, skipped: true };
  const lifeCoverSummary = fullAutomation ? sweepOperationsLifeCoverOffer(now) : { checked: 0, queued: 0, skipped: true };
  const electricalSummary = fullAutomation ? sweepOperationsElectricalCoCOffer(now) : { checked: 0, queued: 0, skipped: true };
  const gasSummary = fullAutomation ? sweepOperationsGasCoCOffer(now) : { checked: 0, queued: 0, skipped: true };
  const gateSummary = fullAutomation ? sweepOperationsGateNudges(now) : { evaluated: 0, queued: 0, skipped: true };
  const recoverySummary = fullAutomation ? sweepOperationsRecoveryPlans(now) : { evaluated: 0, queued: 0, skipped: true };
  const phase2Summary = fullAutomation ? runOperationsPhase2Automation(now) : { skipped: true };
  operationsStore.automation.lastSweepAt = new Date().toISOString();
  operationsStore.automation.lastSweepSummary = {
    ...summary,
    smartReminders: smartReminderSummary,
    appointments: appointmentSummary,
    birthdays: birthdaySummary,
    movingServices: movingSummary,
    bondOriginator: bondOriginatorSummary,
    lifeCover: lifeCoverSummary,
    electricalCoC: electricalSummary,
    gasCoC: gasSummary,
    gates: gateSummary,
    recovery: recoverySummary,
    phase2: phase2Summary
  };
  persistOperations();
  return {
    ...summary,
    smartReminders: smartReminderSummary,
    appointments: appointmentSummary,
    birthdays: birthdaySummary,
    movingServices: movingSummary,
    bondOriginator: bondOriginatorSummary,
    lifeCover: lifeCoverSummary,
    electricalCoC: electricalSummary,
    gasCoC: gasSummary,
    gates: gateSummary,
    recovery: recoverySummary,
    phase2: phase2Summary
  };
}

function getCaseDueInDays(item, now = new Date()) {
  const due = parseOperationsDueDate(item?.due, now);
  if (!due) return null;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((due.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000));
}

function queueProactiveRoleBriefs(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const summary = { checked: 0, queued: 0 };
  for (const item of operationsStore.cases || []) {
    if (!item.next) continue;
    for (const stakeholderCode of ["SELL", "BUY", "AGENT", "TRANS", "ORIG"]) {
      summary.checked += 1;
      const recipient = resolveGateOwnerRecipient(item, stakeholderCode);
      if (!recipient?.name || /^to appoint$/i.test(recipient.name)) continue;
      if (!recipient.phone && !recipient.email) continue;
      const nextKey = String(item.next || "next-step").toLowerCase().replace(/[^\w]+/g, "-").slice(0, 40);
      const dedupeKey = `phase2-next-step:${item.id}:${stakeholderCode}:${dateKey}:${nextKey}`;
      const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
      if (exists) continue;
      queueOperationsNotification({
        caseId: item.id,
        channel: "auto",
        preferredChannel: recipient.preferredChannel,
        stakeholderCode,
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        recipientEmail: recipient.email,
        template: "next-step-brief",
        message: buildRoleTrackMessage(item, {
          stakeholderCode,
          dueSignal: getOperationsDueSignal(item.due, now),
          context: "next-step"
        }),
        dedupeKey
      });
      summary.queued += 1;
    }
  }
  if (summary.queued) addOperationsActivity("COMMS", "Role briefs queued", `${summary.queued} proactive next-step brief${summary.queued === 1 ? "" : "s"} queued.`);
  return summary;
}

function getCaseLastTouchAt(caseId) {
  const timestamps = [];
  for (const item of operationsStore.notifications || []) {
    if (item.caseId !== caseId) continue;
    if (item.updatedAt) timestamps.push(new Date(item.updatedAt).getTime());
    if (item.deliveredAt) timestamps.push(new Date(item.deliveredAt).getTime());
    if (item.createdAt) timestamps.push(new Date(item.createdAt).getTime());
  }
  for (const item of operationsStore.escalations || []) {
    if (item.caseId !== caseId) continue;
    if (item.createdAt) timestamps.push(new Date(item.createdAt).getTime());
  }
  for (const doc of operationsStore.documents || []) {
    if (doc.caseId !== caseId) continue;
    if (doc.file?.uploadedAt) timestamps.push(new Date(doc.file.uploadedAt).getTime());
  }
  const valid = timestamps.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return null;
  return new Date(Math.max(...valid));
}

function queueSilenceWatchdogUpdates(now = new Date()) {
  const summary = { checked: 0, queued: 0 };
  const bucket = Math.floor(now.getTime() / (48 * 60 * 60 * 1000));
  for (const item of operationsStore.cases || []) {
    summary.checked += 1;
    const lastTouch = getCaseLastTouchAt(item.id);
    const staleHours = lastTouch ? (now.getTime() - lastTouch.getTime()) / (60 * 60 * 1000) : 999;
    if (staleHours < 48) continue;
    const ownerCode = mapOwnerTextToStakeholderCode(item.owner) || "CONC";
    const recipient = resolveGateOwnerRecipient(item, ownerCode);
    if (!recipient?.name || (!recipient.phone && !recipient.email)) continue;
    const dedupeKey = `phase2-silence:${item.id}:${bucket}:${ownerCode}`;
    const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (exists) continue;
    queueOperationsNotification({
      caseId: item.id,
      channel: "auto",
      preferredChannel: recipient.preferredChannel,
      stakeholderCode: ownerCode,
      recipient: recipient.name,
      recipientPhone: recipient.phone,
      recipientEmail: recipient.email,
      template: "silence-watchdog",
      message: `${item.id} has had no visible update for ${Math.floor(staleHours)} hours. Your next milestone is ${item.next}.`,
      dedupeKey
    });
    summary.queued += 1;
  }
  if (summary.queued) addOperationsActivity("WATCH", "Silence watchdog triggered", `${summary.queued} reassurance update${summary.queued === 1 ? "" : "s"} queued.`);
  return summary;
}

function queuePartnerReadinessPrompts(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const summary = { checked: 0, queued: 0 };
  for (const item of operationsStore.cases || []) {
    const dueInDays = getCaseDueInDays(item, now);
    if (dueInDays === null || dueInDays > 5) continue;
    for (const stakeholderCode of ["TRANS", "ORIG"]) {
      summary.checked += 1;
      const recipient = resolveGateOwnerRecipient(item, stakeholderCode);
      if (!recipient?.name || /^to appoint$/i.test(recipient.name)) continue;
      if (!recipient.phone && !recipient.email) continue;
      const dedupeKey = `phase2-readiness:${item.id}:${stakeholderCode}:${dateKey}`;
      const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
      if (exists) continue;
      queueOperationsNotification({
        caseId: item.id,
        channel: "auto",
        preferredChannel: recipient.preferredChannel,
        stakeholderCode,
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        recipientEmail: recipient.email,
        template: "partner-readiness",
        message: buildRoleTrackMessage(item, {
          stakeholderCode,
          dueSignal: getOperationsDueSignal(item.due, now),
          context: "readiness"
        }),
        dedupeKey
      });
      summary.queued += 1;
    }
  }
  if (summary.queued) addOperationsActivity("READY", "Partner readiness queued", `${summary.queued} readiness confirmation${summary.queued === 1 ? "" : "s"} queued.`);
  return summary;
}

function queueDecisionCountdownReminders(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const summary = { checked: 0, queued: 0 };
  const decisionPattern = /(offer|otp|guarantee|decision|bond|sign|lodg|registration|clearance)/i;
  for (const item of operationsStore.cases || []) {
    const dueInDays = getCaseDueInDays(item, now);
    if (dueInDays === null || dueInDays > 2) continue;
    if (!decisionPattern.test(`${item.stage || ""} ${item.next || ""}`)) continue;
    for (const stakeholderCode of ["SELL", "BUY", "AGENT"]) {
      summary.checked += 1;
      const recipient = resolveGateOwnerRecipient(item, stakeholderCode);
      if (!recipient?.name || /^to appoint$/i.test(recipient.name)) continue;
      if (!recipient.phone && !recipient.email) continue;
      const dedupeKey = `phase2-decision:${item.id}:${stakeholderCode}:${dateKey}:${String(item.next || "").toLowerCase().slice(0, 24)}`;
      const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
      if (exists) continue;
      queueOperationsNotification({
        caseId: item.id,
        channel: "auto",
        preferredChannel: recipient.preferredChannel,
        stakeholderCode,
        recipient: recipient.name,
        recipientPhone: recipient.phone,
        recipientEmail: recipient.email,
        template: "decision-countdown",
        message: buildRoleTrackMessage(item, {
          stakeholderCode,
          dueSignal: getOperationsDueSignal(item.due, now),
          context: "decision"
        }),
        dedupeKey
      });
      summary.queued += 1;
    }
  }
  if (summary.queued) addOperationsActivity("COUNT", "Decision countdown queued", `${summary.queued} decision-window reminder${summary.queued === 1 ? "" : "s"} queued.`);
  return summary;
}

function getOperationsDueSignal(value, now = new Date()) {
  const label = String(value || "").trim();
  const normalized = label.toLowerCase();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = parseOperationsDueDate(label, now);
  if (due) {
    const dueInDays = Math.ceil((due.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000));
    return {
      label,
      due,
      dueInDays,
      isOverdue: dueInDays < 0,
      isDueSoon: dueInDays <= 2,
      stage: dueInDays < 0 ? "overdue" : dueInDays === 0 ? "due-today" : `due-${dueInDays}d`
    };
  }
  const overdueHours = /(\d+)\s*(h|hr|hrs|hour|hours)\s+overdue/.exec(normalized);
  if (overdueHours) {
    return { label, due: null, dueInDays: -1, isOverdue: true, isDueSoon: true, stage: "overdue" };
  }
  const overdueDays = /(\d+)\s*(d|day|days)\s+overdue/.exec(normalized);
  if (overdueDays) {
    return { label, due: null, dueInDays: -Math.max(1, Number(overdueDays[1])), isOverdue: true, isDueSoon: true, stage: "overdue" };
  }
  const dueHours = /(?:within|in)\s+(\d+)\s*(h|hr|hrs|hour|hours)/.exec(normalized);
  if (dueHours) {
    const hours = Number(dueHours[1]);
    return { label, due: null, dueInDays: hours <= 24 ? 0 : Math.ceil(hours / 24), isOverdue: false, isDueSoon: hours <= 48, stage: hours <= 24 ? "due-today" : "due-soon" };
  }
  if (normalized.includes("overdue")) return { label, due: null, dueInDays: -1, isOverdue: true, isDueSoon: true, stage: "overdue" };
  if (normalized.includes("today") || normalized.includes("now")) return { label, due: null, dueInDays: 0, isOverdue: false, isDueSoon: true, stage: "due-today" };
  return { label, due: null, dueInDays: null, isOverdue: false, isDueSoon: false, stage: "unscheduled" };
}

function formatOperationsDueSignal(signal, fallback = "") {
  if (!signal) return fallback ? `Due: ${fallback}` : "No due date captured";
  if (signal.isOverdue) return `Overdue${signal.label ? `: ${signal.label}` : ""}`;
  if (signal.dueInDays === 0) return "Due today";
  if (signal.dueInDays === 1) return "Due tomorrow";
  if (Number.isFinite(signal.dueInDays)) return `Due in ${signal.dueInDays} days`;
  return signal.label ? `Due: ${signal.label}` : "No due date captured";
}

function getStakeholderCommandText(stakeholderCode = "", flowId = "") {
  if (stakeholderCode === "AGENT" && flowId === "agent-handoff") {
    return "Reply YES accept referral once accepted, STATUS for the file position, or CALL ME if blocked.";
  }
  if (["SELL", "BUY"].includes(stakeholderCode)) {
    return "Reply DOCS for the checklist, STATUS for the file position, or CALL ME if you need help.";
  }
  return "Reply STATUS for the latest file position or CALL ME if concierge support is needed.";
}

function buildRoleTrackHeadline(item, stakeholderCode = "") {
  const next = item?.next || "Please review the next action";
  if (stakeholderCode === "SELL") {
    return `${item.id}: seller track active. Your next property-side step is "${next}".`;
  }
  if (stakeholderCode === "BUY") {
    return `${item.id}: buyer track active. Your next purchasing step is "${next}".`;
  }
  if (stakeholderCode === "AGENT") {
    return `${item.id}: agent track active. Your next client-delivery step is "${next}".`;
  }
  if (stakeholderCode === "TRANS") {
    return `${item.id}: transfer track active. Your next legal transfer step is "${next}".`;
  }
  if (stakeholderCode === "ORIG") {
    return `${item.id}: finance track active. Your next finance step is "${next}".`;
  }
  return `${item.id}: next action is "${next}".`;
}

function buildRoleTrackFocus(item, stakeholderCode = "") {
  const stage = String(item?.stage || "").toLowerCase();
  const next = item?.next || "Please review the next action";
  if (stakeholderCode === "SELL") {
    if (/(compliance|coc|clearance|disclosure)/i.test(stage + " " + next)) return "Please keep seller documents and compliance items moving so the transaction does not stall.";
    return "Please keep seller-side documents, disclosures, and signing items moving.";
  }
  if (stakeholderCode === "BUY") {
    if (/(bond|approval|guarantee|payslip|bank)/i.test(stage + " " + next)) return "Please keep buyer finance documents and approvals moving so the file can advance cleanly.";
    return "Please keep buyer-side finance, signing, and proof items moving.";
  }
  if (stakeholderCode === "AGENT") {
    if (/(contact|handoff|referral|viewing|offer)/i.test(stage + " " + next)) return "Please confirm acceptance, client contact, and the next dated sales step.";
    return "Please keep client contact, feedback, and offer momentum visible on the file.";
  }
  if (stakeholderCode === "TRANS") {
    return "Please keep transfer milestones, signatures, clearance, lodgement, and registration dates visible.";
  }
  if (stakeholderCode === "ORIG") {
    return "Please keep approval status, conditions, guarantees, and missing finance documents visible.";
  }
  return "Please keep the next case step moving and visible.";
}

function buildRoleTrackMessage(item, {
  stakeholderCode = "",
  flowId = "",
  dueSignal = null,
  staleHours = 0,
  context = "next-step"
} = {}) {
  const dueText = formatOperationsDueSignal(dueSignal, item?.due || "");
  const headline = buildRoleTrackHeadline(item, stakeholderCode);
  const focus = buildRoleTrackFocus(item, stakeholderCode);
  const staleText = staleHours >= 24 ? ` No visible update for ${Math.floor(staleHours)} hours.` : "";
  const commandText = getStakeholderCommandText(stakeholderCode, flowId);
  if (context === "readiness") {
    return `${headline} Readiness check: ${focus} ${dueText}.${staleText} ${commandText}`;
  }
  if (context === "decision") {
    return `${headline} Decision window approaching. ${focus} ${dueText}.${staleText} ${commandText}`;
  }
  if (context === "smart-reminder") {
    return `${headline} ${focus} ${dueText}.${staleText} ${commandText}`;
  }
  return `${headline} ${focus} ${dueText}. ${commandText}`;
}

function classifySmartReminderFlow(item, dueSignal, staleHours = 0) {
  const text = `${item?.journey || ""} ${item?.stage || ""} ${item?.next || ""} ${item?.owner || ""} ${item?.status || ""}`.toLowerCase();
  const ownerCode = mapOwnerTextToStakeholderCode(item?.owner || "");
  if (ownerCode === "TRANS" && (staleHours >= 24 || text.includes("waiting"))) {
    return { id: "attorney-silence", label: "Attorney silence", stakeholderCode: "TRANS" };
  }
  if (/(agent|handoff|referral|accept.*lead|lead.*accept|client contact|contact.*client)/i.test(text)) {
    return { id: "agent-handoff", label: "Agent introduction", stakeholderCode: "AGENT" };
  }
  if (/(payslip|bond|finance|guarantee|pre-approval|preapproval|approval|originator|bank)/i.test(text)) {
    return { id: "finance-delay", label: "Finance delay", stakeholderCode: ownerCode === "BUY" ? "BUY" : "ORIG" };
  }
  if (/(gas|electrical|coc|compliance certificate|certificate of compliance)/i.test(text)) {
    return { id: "compliance-coc", label: "COC compliance", stakeholderCode: "SELL" };
  }
  if (/(rates|municipal|clearance|transfer|lodg|registration|handover|attorney|convey|sign)/i.test(text)) {
    return { id: "transfer-update", label: "Transfer update", stakeholderCode: ownerCode || "TRANS" };
  }
  if (dueSignal?.isOverdue || dueSignal?.isDueSoon) {
    return { id: "deadline-chase", label: "Deadline chase", stakeholderCode: ownerCode || "CONC" };
  }
  return { id: "next-action", label: "Next action", stakeholderCode: ownerCode || "CONC" };
}

function shouldQueueSmartReminderFlow(item, flow, dueSignal, staleHours = 0) {
  const status = String(item?.status || "").toLowerCase();
  if (dueSignal?.isOverdue || dueSignal?.isDueSoon) return true;
  if (/(at risk|overdue|waiting|blocked|stuck)/i.test(status)) return true;
  if (flow?.id === "attorney-silence" && staleHours >= 24) return true;
  return flow?.id !== "next-action" && Number.isFinite(dueSignal?.dueInDays) && dueSignal.dueInDays <= 5;
}

function buildSmartReminderFlowMessage(item, flow, dueSignal, staleHours = 0) {
  const dueText = formatOperationsDueSignal(dueSignal, item?.due || "");
  const next = item?.next || "Please update the next action";
  const commandText = "Reply DONE when complete, STATUS for the latest file position, or CALL ME if blocked.";
  const staleText = staleHours >= 24 ? ` No visible update for ${Math.floor(staleHours)} hours.` : "";
  if (["SELL", "BUY", "AGENT", "TRANS", "ORIG"].includes(flow.stakeholderCode || "")) {
    if (flow.id === "agent-handoff") {
      return buildRoleTrackMessage(item, {
        stakeholderCode: flow.stakeholderCode,
        flowId: flow.id,
        dueSignal,
        staleHours,
        context: "smart-reminder"
      });
    }
    if (["finance-delay", "compliance-coc", "transfer-update", "attorney-silence", "deadline-chase", "next-action"].includes(flow.id)) {
      return buildRoleTrackMessage(item, {
        stakeholderCode: flow.stakeholderCode,
        flowId: flow.id,
        dueSignal,
        staleHours,
        context: "smart-reminder"
      });
    }
  }
  const messages = {
    "agent-handoff": `${item.id}: please confirm lead acceptance and first client contact. Next action: ${next}. ${dueText}. ${commandText}`,
    "finance-delay": `${item.id}: finance follow-up needed. Please confirm approval, guarantees, missing docs, or blocker. ${dueText}. ${commandText}`,
    "compliance-coc": `${item.id}: compliance certificate follow-up needed. Please confirm COC/gas status, appointment date, or blocker. ${dueText}. ${commandText}`,
    "transfer-update": `${item.id}: transfer milestone follow-up needed. Please confirm signing, lodgement, clearance, registration, or blocker. ${dueText}.${staleText} ${commandText}`,
    "attorney-silence": `${item.id}: attorney update needed. Please confirm the current transfer step, blocker, and next expected date.${staleText} ${commandText}`,
    "deadline-chase": `${item.id}: deadline chase for "${next}". ${dueText}. ${commandText}`,
    "next-action": `${item.id}: next action reminder: ${next}. ${dueText}. ${commandText}`
  };
  return messages[flow.id] || messages["next-action"];
}

function queueSmartWhatsappReminderFlows(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const summary = { checked: 0, queued: 0, alreadyQueued: 0, escalated: 0, skippedNoRecipient: 0, flows: {} };
  for (const item of operationsStore.cases || []) {
    if (!item?.id) continue;
    summary.checked += 1;
    const dueSignal = getOperationsDueSignal(item.due, now);
    const lastTouch = getCaseLastTouchAt(item.id);
    const staleHours = lastTouch ? (now.getTime() - lastTouch.getTime()) / (60 * 60 * 1000) : 999;
    const flow = classifySmartReminderFlow(item, dueSignal, staleHours);
    if (!shouldQueueSmartReminderFlow(item, flow, dueSignal, staleHours)) continue;

    const recipient = resolveGateOwnerRecipient(item, flow.stakeholderCode);
    if (!recipient?.name || /^to appoint$/i.test(recipient.name) || (!recipient.phone && !recipient.email)) {
      summary.skippedNoRecipient += 1;
      continue;
    }

    const nextKey = String(item.next || flow.id).toLowerCase().replace(/[^\w]+/g, "-").slice(0, 40);
    const dedupeKey = `smart-whatsapp:${item.id}:${flow.id}:${flow.stakeholderCode}:${dateKey}:${nextKey}`;
    const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
    if (exists) summary.alreadyQueued += 1;
    const notification = queueOperationsNotification({
      caseId: item.id,
      channel: "auto",
      preferredChannel: "whatsapp",
      stakeholderCode: flow.stakeholderCode,
      recipient: recipient.name,
      recipientPhone: recipient.phone,
      recipientEmail: recipient.email,
      template: "smart-reminder",
      message: buildSmartReminderFlowMessage(item, flow, dueSignal, staleHours),
      dedupeKey
    });

    if (!exists && notification.status === "queued" && notification.attempts === 0) {
      summary.queued += 1;
      summary.flows[flow.id] = (summary.flows[flow.id] || 0) + 1;
      addOperationsTimeline(item.id, "Smart WhatsApp reminder queued", `${flow.label} reminder queued for ${recipient.name}.`);
      addOperationsActivity("WA", "Smart reminder queued", `${item.id} - ${flow.label} - ${recipient.name}`);
      addOperationsAudit("smart-whatsapp-reminder", item.id, `${flow.id}: ${recipient.name}`);
    }

    const hotStatus = /(at risk|overdue|waiting|blocked|stuck)/i.test(String(item.status || ""));
    if ((dueSignal.isOverdue || hotStatus) && !exists) {
      const escalationKey = `smart-whatsapp-escalation:${item.id}:${flow.id}:${dateKey}`;
      if (!operationsStore.escalations.some((entry) => entry.dedupeKey === escalationKey)) {
        operationsStore.escalations.unshift(createOperationsEscalation({
          item,
          question: `${flow.label} reminder queued, but concierge oversight is needed because the case is ${dueSignal.isOverdue ? "overdue" : item.status}.`,
          owner: item.concierge || "Concierge queue",
          dedupeKey: escalationKey
        }));
        summary.escalated += 1;
      }
    }
  }
  if (summary.queued) addOperationsActivity("WA", "Smart WhatsApp flow queued", `${summary.queued} reminder${summary.queued === 1 ? "" : "s"} queued across ${Object.keys(summary.flows).length} flow${Object.keys(summary.flows).length === 1 ? "" : "s"}.`);
  return summary;
}

function queueRedFlagConciergeAlert(now = new Date()) {
  const dateKey = getOperationsDateKey(now);
  const atRiskCases = (operationsStore.cases || []).filter((item) => ["at risk", "waiting", "overdue"].some((flag) => String(item.status || "").toLowerCase().includes(flag)));
  const waitingNotifications = (operationsStore.notifications || []).filter((item) => ["waiting-channel", "failed"].includes(item.status)).length;
  const overdueDocs = (operationsStore.documents || []).filter((doc) => {
    if (["Approved", "Uploaded"].includes(doc.status)) return false;
    const due = parseOperationsDueDate(doc.due, now);
    return due ? due.getTime() <= now.getTime() : false;
  }).length;
  const breachedEscalations = (operationsStore.escalations || []).filter((item) => item.status === "open" && item.slaState === "breached").length;
  const totalFlags = atRiskCases.length + waitingNotifications + overdueDocs + breachedEscalations;
  if (!totalFlags) return { queued: 0, totalFlags: 0, atRiskCases: 0, waitingNotifications: 0, overdueDocs: 0, breachedEscalations: 0 };

  const conciergeCase = (operationsStore.cases || [])[0] || null;
  if (!conciergeCase) return { queued: 0, totalFlags, atRiskCases: atRiskCases.length, waitingNotifications, overdueDocs, breachedEscalations };
  const concierge = resolveGateOwnerRecipient(conciergeCase, "CONC");
  if (!concierge.phone && !concierge.email) {
    return { queued: 0, totalFlags, atRiskCases: atRiskCases.length, waitingNotifications, overdueDocs, breachedEscalations };
  }
  const dedupeKey = `phase2-red-flags:${dateKey}:${atRiskCases.length}:${overdueDocs}:${waitingNotifications}:${breachedEscalations}`;
  const exists = operationsStore.notifications.some((note) => note.dedupeKey === dedupeKey && note.status !== "cancelled");
  if (!exists) {
    queueOperationsNotification({
      caseId: conciergeCase.id,
      channel: "auto",
      preferredChannel: concierge.preferredChannel,
      stakeholderCode: "CONC",
      recipient: concierge.name || "Concierge",
      recipientPhone: concierge.phone,
      recipientEmail: concierge.email,
      template: "red-flag-alert",
      message: `Red flags: ${atRiskCases.length} risk cases, ${overdueDocs} overdue docs, ${waitingNotifications} delivery issues, ${breachedEscalations} SLA breaches.`,
      dedupeKey
    });
  }
  return {
    queued: exists ? 0 : 1,
    totalFlags,
    atRiskCases: atRiskCases.length,
    waitingNotifications,
    overdueDocs,
    breachedEscalations
  };
}

function runOperationsPhase2Automation(now = new Date()) {
  const sla = refreshEscalationSlaStates(now);
  const roleBriefs = queueProactiveRoleBriefs(now);
  const silenceWatchdog = queueSilenceWatchdogUpdates(now);
  const partnerReadiness = queuePartnerReadinessPrompts(now);
  const decisionCountdown = queueDecisionCountdownReminders(now);
  const redFlags = queueRedFlagConciergeAlert(now);
  if (sla.breached) {
    addOperationsActivity("SLA", "Escalation SLA breach detected", `${sla.breached} escalation${sla.breached === 1 ? "" : "s"} crossed SLA.`);
  }
  return {
    generatedAt: now.toISOString(),
    roleBriefs,
    silenceWatchdog,
    partnerReadiness,
    decisionCountdown,
    redFlags,
    escalationSlaBreaches: sla.breached
  };
}

function buildOperationsManagementWeeklySummary(now = new Date()) {
  const lookbackMs = 7 * 24 * 60 * 60 * 1000;
  const fromTs = now.getTime() - lookbackMs;
  const notifications = (operationsStore.notifications || []).filter((item) => {
    const created = new Date(item.createdAt || 0).getTime();
    return Number.isFinite(created) && created >= fromTs;
  });
  const delivered = notifications.filter((item) => item.status === "delivered").length;
  const queued = notifications.filter((item) => item.status === "queued").length;
  const failed = notifications.filter((item) => ["failed", "waiting-channel"].includes(item.status)).length;
  const escalations = (operationsStore.escalations || []).filter((item) => {
    const created = new Date(item.createdAt || 0).getTime();
    return Number.isFinite(created) && created >= fromTs;
  });
  const openEscalations = escalations.filter((item) => item.status === "open").length;
  const breachedEscalations = escalations.filter((item) => item.status === "open" && item.slaState === "breached").length;
  const atRiskCases = (operationsStore.cases || []).filter((item) =>
    ["at risk", "waiting", "overdue"].some((flag) => String(item.status || "").toLowerCase().includes(flag))
  );
  const topCases = atRiskCases.slice(0, 5).map((item) => `${item.id} - ${item.client}: ${item.next} (${item.due})`);

  const lines = [
    `Axiom Realty OS Weekly Management Summary`,
    `Generated: ${now.toISOString()}`,
    ``,
    `1) Communication performance`,
    `- Notifications created (7d): ${notifications.length}`,
    `- Delivered: ${delivered}`,
    `- Queued: ${queued}`,
    `- Delivery issues: ${failed}`,
    ``,
    `2) Escalation control`,
    `- Escalations created (7d): ${escalations.length}`,
    `- Open escalations: ${openEscalations}`,
    `- SLA breaches: ${breachedEscalations}`,
    ``,
    `3) Operational risk`,
    `- Cases at risk/waiting/overdue: ${atRiskCases.length}`,
    `- Top cases to review:`
  ];
  if (topCases.length) {
    for (const line of topCases) lines.push(`  - ${line}`);
  } else {
    lines.push(`  - No critical risk cases identified this week.`);
  }
  lines.push("", "4) Recommended action this week", "- Run phase 2 automation sweep daily and clear SLA-breached escalations first.");

  return {
    generatedAt: now.toISOString(),
    lookbackDays: 7,
    metrics: {
      notificationsCreated: notifications.length,
      notificationsDelivered: delivered,
      notificationsQueued: queued,
      notificationsDeliveryIssues: failed,
      escalationsCreated: escalations.length,
      openEscalations,
      breachedEscalations,
      atRiskCases: atRiskCases.length
    },
    topCases,
    text: lines.join("\n")
  };
}

function reconcileOperationsPriorities() {
  const terms = {
    "Certified identity document": "certified id",
    "Bond approval letter": "bond approval"
  };
  for (const document of operationsStore.documents.filter((item) => item.status === "Approved")) {
    const term = terms[document.name] || document.name.toLowerCase();
    for (const priority of operationsStore.priorities || []) {
      if (priority.caseId === document.caseId && priority.issue.toLowerCase().includes(term)) {
        const key = `${priority.caseId}:${priority.issue}`;
        if (!operationsStore.resolvedItems.includes(key)) operationsStore.resolvedItems.push(key);
      }
    }
  }
  const sellerCase = findOperationsCase("AX-1048");
  const certifiedId = operationsStore.documents.find((item) => item.id === "DOC-1048-ID");
  if (sellerCase && certifiedId?.status === "Approved" && sellerCase.next === "Upload certified ID") {
    sellerCase.stage = "Market launch";
    sellerCase.next = "Publish listing and confirm launch";
    sellerCase.owner = "Agent";
    sellerCase.due = "Within 1 day";
    sellerCase.status = "In progress";
    sellerCase.progress = Math.max(Number(sellerCase.progress || 0), 64);
  }
}

function nextOperationsCaseId() {
  const highest = operationsStore.cases.reduce((max, item) => {
    const match = /^AX-(\d+)$/.exec(item.id || "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  return `AX-${highest + 1}`;
}

function normalizeAreaKey(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTownDirectory() {
  const provinceByTown = new Map();
  const townsByKey = new Map();
  const entries = [];
  try {
    const csvPath = path.join(__dirname, "SouthAfricanCities.csv");
    if (!fs.existsSync(csvPath)) {
      return { provinceByTown, townsByKey, entries };
    }

    const rows = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).slice(1);
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split(",");
      const city = cols[1]?.trim();
      const provinceRaw = cols[2]?.trim();
      if (!city || !provinceRaw) continue;

      const key = normalizeAreaKey(city);
      const province = canonicalProvinceMap[provinceRaw.toLowerCase()] || provinceRaw;
      if (!key || !province) continue;
      if (!provinceByTown.has(key)) provinceByTown.set(key, province);
      if (!townsByKey.has(key)) {
        const entry = { key, town: city, province };
        townsByKey.set(key, entry);
        entries.push(entry);
      }
    }
  } catch {
    return { provinceByTown, townsByKey, entries };
  }
  return { provinceByTown, townsByKey, entries };
}

function toTitleCase(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function escapeRegex(text) {
  return (text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseAmount(value) {
  const digits = (value || "").toString().replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeReferralPercent(value) {
  const n = asNumber(value, DEFAULT_REFERRAL_PERCENT);
  return n > 0 && n <= 100 ? n : DEFAULT_REFERRAL_PERCENT;
}

function calculateExpectedReferralCommission(saleValue, referralPercent = DEFAULT_REFERRAL_PERCENT) {
  const amount = Math.max(0, asNumber(saleValue, 0));
  const percent = normalizeReferralPercent(referralPercent);
  return Math.round(amount * (percent / 100) * 100) / 100;
}

function getMilestoneLabel(code) {
  return dealMilestoneDefinitions.find((item) => item.code === code)?.label || code;
}

function ensureDealProofState(session) {
  const existing = session.dealProof && typeof session.dealProof === "object" ? session.dealProof : {};
  const commission = existing.commission && typeof existing.commission === "object" ? existing.commission : {};
  const slots = getSessionSlots(session);
  const inferredSaleValue = parseAmount(slots.priceDisplay || slots.price || "");
  const saleValueRaw = asNumber(commission.saleValue, inferredSaleValue || 0);
  const referralPercent = normalizeReferralPercent(commission.referralPercent);
  const saleValue = saleValueRaw > 0 ? saleValueRaw : null;
  const milestones = Array.isArray(existing.milestones)
    ? existing.milestones
        .filter((item) => item && dealMilestoneCodes.includes(item.code))
        .map((item) => ({
          code: item.code,
          label: getMilestoneLabel(item.code),
          completedAt: item.completedAt || null,
          actor: sanitizeShortText(item.actor || "", 120),
          via: sanitizeShortText(item.via || "", 40),
          note: sanitizeShortText(item.note || "", 500),
          proofRef: sanitizeShortText(item.proofRef || "", 500)
        }))
    : [];
  milestones.sort((a, b) => {
    const aIdx = dealMilestoneCodes.indexOf(a.code);
    const bIdx = dealMilestoneCodes.indexOf(b.code);
    return aIdx - bIdx;
  });

  const referralAcceptance = existing.referralAcceptance && typeof existing.referralAcceptance === "object"
    ? {
        acceptedAt: existing.referralAcceptance.acceptedAt || null,
        acceptedBy: sanitizeShortText(existing.referralAcceptance.acceptedBy || "", 120),
        via: sanitizeShortText(existing.referralAcceptance.via || "", 40),
        note: sanitizeShortText(existing.referralAcceptance.note || "", 500)
      }
    : null;

  session.dealProof = {
    referralAcceptance,
    milestones,
    commission: {
      saleValue,
      referralPercent,
      expectedCommission: saleValue ? calculateExpectedReferralCommission(saleValue, referralPercent) : null,
      payoutStatus: commissionPayoutStatusOptions.includes(commission.payoutStatus) ? commission.payoutStatus : "Not due",
      payoutDueDate: commission.payoutDueDate || null,
      payoutReference: sanitizeShortText(commission.payoutReference || "", 160),
      note: sanitizeShortText(commission.note || "", 500),
      updatedAt: commission.updatedAt || null
    }
  };
  return session.dealProof;
}

function buildCommissionProtectionSummary(session) {
  const proof = ensureDealProofState(session);
  const commission = proof.commission || {};
  const deal = session.dealProtection || {};
  const saleValue = asNumber(commission.saleValue, 0);
  const referralPercent = normalizeReferralPercent(commission.referralPercent);
  const expectedCommission = saleValue > 0 ? calculateExpectedReferralCommission(saleValue, referralPercent) : null;
  const payoutStatus = commissionPayoutStatusOptions.includes(commission.payoutStatus) ? commission.payoutStatus : "Not due";
  const dueAt = commission.payoutDueDate || null;
  const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
  const now = Date.now();
  const daysUntilDue = Number.isFinite(dueMs) ? Math.ceil((dueMs - now) / 86400000) : null;
  const acceptanceProtected = Boolean(proof.referralAcceptance?.acceptedAt || session.agentAccess?.acknowledgedAt);
  const termsProtected = acceptanceProtected && ["Written", "Confirmed"].includes(deal.commissionAgreement || "");
  const paid = payoutStatus === "Paid";
  const waived = payoutStatus === "Waived";
  const overdue = !paid && !waived && Number.isFinite(dueMs) && dueMs < now;
  const dueSoon = !paid && !waived && Number.isFinite(dueMs) && dueMs >= now && daysUntilDue <= 7;

  let dueState = "not-scheduled";
  if (paid) dueState = "paid";
  else if (waived) dueState = "waived";
  else if (overdue) dueState = "overdue";
  else if (dueSoon) dueState = "due-soon";
  else if (dueAt) dueState = "scheduled";

  let priority = "Low";
  let nextAction = "Keep commission evidence updated as the deal progresses.";
  if (!acceptanceProtected) {
    priority = "High";
    nextAction = "Get agent referral acceptance before relying on this opportunity.";
  } else if (!termsProtected) {
    priority = "High";
    nextAction = "Move referral terms from verbal/not discussed to written or confirmed.";
  } else if (!expectedCommission) {
    priority = "Medium";
    nextAction = "Capture sale value and referral percentage to calculate the expected fee.";
  } else if (payoutStatus === "Due") {
    priority = "High";
    nextAction = "Issue the referral invoice and record the invoice/reference number.";
  } else if (payoutStatus === "Invoiced" && overdue) {
    priority = "High";
    nextAction = "Chase overdue referral payment and record the payment outcome.";
  } else if (payoutStatus === "Invoiced") {
    priority = dueSoon ? "Medium" : "Low";
    nextAction = "Monitor invoice payment against the due date.";
  } else if (paid) {
    priority = "Low";
    nextAction = "Referral fee paid. Keep proof and close/archive if Axiom responsibility ends.";
  }

  return {
    saleValue: saleValue > 0 ? saleValue : null,
    referralPercent,
    expectedCommission,
    payoutStatus,
    invoicePaymentStatus: payoutStatus,
    payoutDueDate: dueAt,
    payoutReference: commission.payoutReference || "",
    note: commission.note || "",
    acceptanceProtected,
    termsProtected,
    protected: termsProtected && Boolean(expectedCommission),
    dueState,
    daysUntilDue,
    overdue,
    priority,
    nextAction,
    updatedAt: commission.updatedAt || null
  };
}

function buildTransactionTimelineSummary(session) {
  const proof = ensureDealProofState(session);
  const completedMap = new Map(
    (proof.milestones || [])
      .filter((item) => item?.code)
      .map((item) => [item.code, item])
  );
  const milestones = transactionTimelineDefinitions.map((definition, index) => {
    const completed = completedMap.get(definition.code) || null;
    return {
      ...definition,
      order: index + 1,
      complete: Boolean(completed?.completedAt),
      completedAt: completed?.completedAt || null,
      actor: completed?.actor || "",
      via: completed?.via || "",
      note: completed?.note || "",
      proofRef: completed?.proofRef || ""
    };
  });
  const completedCount = milestones.filter((item) => item.complete).length;
  const current = [...milestones].reverse().find((item) => item.complete) || null;
  const next = milestones.find((item) => !item.complete) || null;
  const progress = Math.round((completedCount / milestones.length) * 100);
  let state = "not-started";
  if (completedCount > 0) state = "in-progress";
  if (next?.code === "registered" || next?.code === "handover-complete") state = "near-registration";
  if (!next) state = "complete";

  return {
    state,
    progress,
    completedCount,
    totalCount: milestones.length,
    currentMilestone: current,
    nextMilestone: next,
    milestones
  };
}

function upsertDealMilestone(session, milestone) {
  const proof = ensureDealProofState(session);
  const index = proof.milestones.findIndex((item) => item.code === milestone.code);
  if (index >= 0) proof.milestones[index] = milestone;
  else proof.milestones.push(milestone);
  proof.milestones.sort((a, b) => dealMilestoneCodes.indexOf(a.code) - dealMilestoneCodes.indexOf(b.code));
  session.dealProof = proof;
}

function syncSessionFromMilestone(session, code, updatedAt) {
  if (code === "agent-contacted") {
    session.firstContactAt = session.firstContactAt || updatedAt;
    session.agentContact = {
      medium: session.agentContact?.medium || "Not specified",
      note: session.agentContact?.note || "",
      contactedAt: session.agentContact?.contactedAt || updatedAt
    };
  }
  if (code === "viewing-booked") {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Viewing/valuation booked",
      updatedAt
    };
  }
  if (["offer-received", "otp-signed", "sale-pending", "suspensive-conditions"].includes(code)) {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Offer pending",
      updatedAt
    };
    session.lifecycleStage = { code: "sale-pending", note: session.lifecycleStage?.note || "", updatedAt, source: "deal-proof" };
  }
  if (
    [
      "bond-approval",
      "guarantees-issued",
      "transfer-instruction",
      "fica-complete",
      "compliance-certificates",
      "rates-clearance",
      "transfer-documents-signed",
      "bond-documents-signed",
      "lodged"
    ].includes(code)
  ) {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Under contract",
      updatedAt
    };
    session.lifecycleStage = { code: "sale-pending", note: session.lifecycleStage?.note || "", updatedAt, source: "deal-proof" };
  }
  if (["registered", "sale-concluded", "handover-complete"].includes(code)) {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Closed won",
      updatedAt
    };
    session.lifecycleStage = { code: "sale-concluded", note: session.lifecycleStage?.note || "", updatedAt, source: "deal-proof" };
  }
  if (code === "deal-lost") {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Lost",
      updatedAt
    };
    session.lifecycleStage = { code: "closed", note: session.lifecycleStage?.note || "", updatedAt, source: "deal-proof" };
  }
}

function getAnswerMap(payload) {
  const map = {};
  const nameMap = {};
  for (const answer of payload.answers || []) {
    const key = (answer.label || "").toLowerCase().trim();
    map[key] = (answer.value || "").toString().trim();
    const nameKey = (answer.name || "").toLowerCase().trim();
    if (nameKey) nameMap[nameKey] = (answer.value || "").toString().trim();
  }
  return { map, nameMap };
}

function withAnswerMaps(payload) {
  const { map, nameMap } = getAnswerMap(payload);
  return {
    map,
    nameMap,
    get(labelKeys = [], nameKeys = []) {
      return pickAnswer(map, labelKeys) || pickAnswer(nameMap, nameKeys);
    }
  };
}

function pickAnswer(map, keys) {
  for (const key of keys) {
    const value = map[key];
    if (value) return value;
  }
  return "";
}

function extractIntent(text) {
  const lowerRaw = text.toLowerCase();
  const lower = lowerRaw
    .replace(/\bi want to guy\b/g, "i want to buy")
    .replace(/\bwant to guy\b/g, "want to buy")
    .replace(/\bby a\b/g, "buy a");
  const buyHits = (lower.match(/\bbuy|purchase|looking for|house hunt|find a home\b/g) || []).length;
  const sellHits = (lower.match(/\bsell|selling|listing|market my|put on the market\b/g) || []).length;
  if (buyHits && !sellHits) return { value: "buy", confidence: 0.95 };
  if (sellHits && !buyHits) return { value: "sell", confidence: 0.95 };
  if (buyHits && sellHits) return { value: "unknown", confidence: 0.3 };
  return { value: "unknown", confidence: 0.1 };
}

function extractPrice(text) {
  const lower = text.toLowerCase();

  const compact = lower.match(/(?:r\s*)?(\d+(?:\.\d+)?)\s*(k|m|mil|million)\b/);
  if (compact) {
    const base = Number(compact[1]);
    const factor = compact[2] === "k" ? 1_000 : 1_000_000;
    const n = base * factor;
    return { min: n, max: n, display: `R${Math.round(n).toLocaleString("en-ZA")}`, confidence: 0.9 };
  }

  const rangeMatch = lower.match(/(?:between|from)\s*(?:r\s*)?([\d,]+)\s*(?:and|-|to)\s*(?:r\s*)?([\d,]+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1].replace(/,/g, ""));
    const max = Number(rangeMatch[2].replace(/,/g, ""));
    if (min > 0 && max > 0) {
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
        display: `R${Math.min(min, max).toLocaleString("en-ZA")} - R${Math.max(min, max).toLocaleString("en-ZA")}`,
        confidence: 0.88
      };
    }
  }

  const underMatch = lower.match(/(?:under|below|max(?:imum)?|up to)\s*(?:r\s*)?([\d,]+)/);
  if (underMatch) {
    const max = Number(underMatch[1].replace(/,/g, ""));
    if (max > 0) {
      return { min: null, max, display: `Under R${max.toLocaleString("en-ZA")}`, confidence: 0.82 };
    }
  }

  const plainAmount = lower.match(/(?:r\s*)?(\d{5,})\b/);
  if (plainAmount) {
    const rawDigits = plainAmount[1].replace(/,/g, "");
    const hasPriceContext = /\b(price|budget|range|offer|selling|sell|worth|value|under|below|up to|max|million|mil)\b|r\s*\d/i.test(lower);
    if (rawDigits.length >= 9 && !hasPriceContext) {
      return { min: null, max: null, display: null, confidence: 0 };
    }
    const n = Number(rawDigits);
    if (n > 0) {
      return { min: n, max: n, display: `R${n.toLocaleString("en-ZA")}`, confidence: 0.72 };
    }
  }

  return { min: null, max: null, display: null, confidence: 0 };
}

function extractRooms(text) {
  const lower = text.toLowerCase();
  const bedMatch = lower.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms|br)\b/);
  const bathMatch = lower.match(/(\d+)\s*(?:bath|baths|bathroom|bathrooms)\b/);
  return {
    bedrooms: bedMatch ? Number(bedMatch[1]) : null,
    bathrooms: bathMatch ? Number(bathMatch[1]) : null,
    confidence: bedMatch || bathMatch ? 0.85 : 0
  };
}

function extractPropertyType(text) {
  const lower = (text || "")
    .toLowerCase()
    .replace(/4x/g, "x");
  const types = [
    ["land", "Land"],
    ["duplex", "Duplex"],
    ["simple4x", "Simplex"],
    ["simplex", "Simplex"],
    ["fla", "Flat"],
    ["flat", "Flat"],
    ["apartment", "Flat"],
    ["house", "House"],
    ["farm", "Farm"]
  ];
  const match = types.find(([key]) => new RegExp(`\\b${key}\\b`, "i").test(lower));
  return { value: match ? match[1] : null, confidence: match ? 0.85 : 0 };
}

function detectNonPropertySaleSubject(text) {
  const lower = (text || "")
    .toLowerCase()
    .replace(/4x/g, "x");
  if (extractIntent(lower).value !== "sell") return null;

  const match = lower.match(/\b(?:sell|selling|list|listing|market)\s+(?:my|our|the|a|an)?\s*([a-z][a-z'-]{1,24})\b/);
  if (!match) return null;

  const subject = match[1].trim();
  const allowed = new Set([
    "property",
    "home",
    "house",
    "flat",
    "apartment",
    "unit",
    "townhouse",
    "duplex",
    "simplex",
    "farm",
    "land",
    "plot",
    "smallholding",
    "estate",
    "place"
  ]);
  const ignored = new Set(["in", "at", "near", "around"]);
  if (allowed.has(subject) || ignored.has(subject)) return null;
  if (extractPropertyType(subject).value) return null;
  return subject;
}

function separateFusedLocationPrepositions(text) {
  return (text || "").replace(/\b(in|at|near|around)([a-z][a-z'-]{3,})\b/gi, (match, prep, possibleTown) => {
    return resolveKnownTown(possibleTown) ? `${prep} ${possibleTown}` : match;
  });
}

function extractArea(text) {
  const lower = separateFusedLocationPrepositions(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
  );
  const provinceRaw = provinceNames.find((p) => lower.includes(p)) || null;
  const province = provinceRaw ? canonicalProvinceMap[provinceRaw] : null;

  const locationPhrase = lower.match(/\b(?:in|at|around|near)\s+(?:the\s+)?(?:a\s+|an\s+)?([a-z][a-z\s'-]{2,60})/i);
  let area = locationPhrase ? locationPhrase[1].split(/[,.;!?]/)[0].trim() : null;
  if (area) {
    area = area.replace(/(\b[a-z]\b)\s+([a-z]{3,})/g, "$1$2");
    area = area
      .replace(/\b(?:maybe|possibly|or|and|around|up to|upto|under|below|within|immediately|asap|urgent|now|for|with|budget|price|about|approximately|flat|apartment|house|home|property|place|bedroom|bedrooms)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (provinceRaw) {
      area = area.replace(new RegExp(`\\b${escapeRegex(provinceRaw)}\\b`, "i"), "").replace(/\s+/g, " ").trim();
    }
    area = area ? toTitleCase(area) : null;
  }

  if (!area && province) return { area: null, province, confidence: 0.6 };

  if (area) {
    const knownTown = resolveKnownTown(area, province);
    if (knownTown) {
      return {
        area: knownTown.town,
        province: knownTown.province,
        confidence: knownTown.confidence
      };
    }
  }

  if (area && !province) {
    const inferred = townToProvince.get(normalizeAreaKey(area)) || null;
    if (inferred) return { area, province: inferred, confidence: 0.9 };
    return { area: null, province: null, confidence: 0 };
  }

  if (area && province) return { area: null, province, confidence: 0.6 };

  return { area: null, province: null, confidence: 0 };
}

function applyAreaAnswer(slots, text) {
  const cleaned = (text || "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return;

  const knownTown = resolveKnownTown(cleaned, slots.province || null);
  if (knownTown) {
    slots.area = knownTown.town;
    slots.province = knownTown.province || slots.province || null;
    return;
  }

  const extracted = extractArea(cleaned);
  const area = extracted.area;
  if (!area) {
    slots.validationMessage = slots.province
      ? `I could not match that town in ${slots.province}. Which town or suburb should I use?`
      : "I could not match that town or suburb. Which area should I use?";
    return;
  }
  slots.area = area;
  slots.province = extracted.province || townToProvince.get(normalizeAreaKey(area)) || slots.province || null;
}

function extractLeadSignals(message) {
  const intent = extractIntent(message);
  const area = extractArea(message);
  const price = extractPrice(message);
  const rooms = extractRooms(message);
  const propertyType = extractPropertyType(message);
  const contact = extractContactSignals(message);
  const timeline = extractTimeline(message);

  const missingFields = [];
  if (intent.value === "unknown") missingFields.push("intent");
  if (!area.area) missingFields.push("area");
  if (!price.display) missingFields.push("price");
  if (!timeline.display) missingFields.push("timeline");

  const confidence = Math.round(((intent.confidence + area.confidence + price.confidence + rooms.confidence) / 4) * 100);

  return {
    intent: intent.value,
    area: area.area,
    province: area.province,
    price,
    rooms,
    propertyType,
    contact,
    timeline,
    confidence,
    missingFields
  };
}

async function getLmStudioModelId() {
  if (!LM_STUDIO_ENABLED) {
    lmStudioLastStatus = { enabled: false, connected: false, model: null, checkedAt: new Date().toISOString() };
    return null;
  }
  if (LM_STUDIO_MODEL) {
    lmStudioLastStatus = { ...lmStudioLastStatus, enabled: true, model: LM_STUDIO_MODEL, checkedAt: new Date().toISOString() };
    return LM_STUDIO_MODEL;
  }
  if (lmStudioModelCache) return lmStudioModelCache;

  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(LM_STUDIO_API_KEY ? { Authorization: `Bearer ${LM_STUDIO_API_KEY}` } : {})
      },
      signal: AbortSignal.timeout(LM_STUDIO_TIMEOUT_MS)
    });
    if (!response.ok) {
      lmStudioLastStatus = { enabled: true, connected: false, model: null, checkedAt: new Date().toISOString() };
      return null;
    }
    const data = await response.json();
    const firstModel = Array.isArray(data?.data) ? data.data.find((item) => item?.id)?.id : null;
    lmStudioModelCache = firstModel || null;
    lmStudioLastStatus = {
      enabled: true,
      connected: Boolean(lmStudioModelCache),
      model: lmStudioModelCache,
      checkedAt: new Date().toISOString()
    };
    return lmStudioModelCache;
  } catch {
    lmStudioLastStatus = { enabled: true, connected: false, model: null, checkedAt: new Date().toISOString() };
    return null;
  }
}

function parseJsonObjectLoose(text) {
  const raw = (text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeLmStudioLeadSignals(result) {
  if (!result || typeof result !== "object") return null;

  const intent = ["buy", "sell"].includes(String(result.intent || "").toLowerCase())
    ? String(result.intent).toLowerCase()
    : "unknown";
  const provinceRaw = String(result.province || "").trim().toLowerCase();
  let province = canonicalProvinceMap[provinceRaw] || null;
  const areaRaw = String(result.area || "").trim();
  const knownTown = areaRaw ? resolveKnownTown(areaRaw, province) : null;
  const area = knownTown?.town || null;
  province = knownTown?.province || province || (area ? townToProvince.get(normalizeAreaKey(area)) || null : null);

  const priceText = String(result.budgetOrPrice || result.price || "").trim();
  const price = extractPrice(priceText);
  if (!price.display && priceText && /\d/.test(priceText)) {
    price.display = priceText;
    price.confidence = 0.55;
  }

  const timelineText = String(result.timeline || "").trim();
  const timeline = extractTimeline(timelineText);
  if (!timeline.display && timelineText) {
    timeline.display = timelineText;
    timeline.urgency = "Unknown";
    timeline.confidence = 0.55;
  }

  const contactPhone = cleanPhoneNumber(String(result.phone || "").trim());
  const fullName = parseLeadNameAnswer(String(result.fullName || "").trim());
  const propertyType = extractPropertyType(String(result.propertyType || "").trim());

  return {
    intent,
    area,
    province,
    price,
    rooms: {
      bedrooms: Number.isFinite(Number(result.bedrooms)) && Number(result.bedrooms) > 0 ? Number(result.bedrooms) : null,
      bathrooms: Number.isFinite(Number(result.bathrooms)) && Number(result.bathrooms) > 0 ? Number(result.bathrooms) : null,
      confidence: result.bedrooms || result.bathrooms ? 0.75 : 0
    },
    propertyType,
    contact: {
      fullName,
      phone: contactPhone,
      email: cleanEmailAddress(String(result.email || "").trim())
    },
    timeline,
    confidence: Number.isFinite(Number(result.confidence)) ? Math.max(0, Math.min(100, Number(result.confidence))) : 0,
    missingFields: []
  };
}

function mergeLeadSignalResults(ruleSignals, lmSignals) {
  if (!lmSignals) return ruleSignals;
  const merged = { ...ruleSignals };

  if ((!merged.intent || merged.intent === "unknown") && lmSignals.intent && lmSignals.intent !== "unknown") merged.intent = lmSignals.intent;
  if (!merged.area && lmSignals.area) merged.area = lmSignals.area;
  if (!merged.province && lmSignals.province) merged.province = lmSignals.province;
  if (!merged.price?.display && lmSignals.price?.display) merged.price = lmSignals.price;
  if (!merged.propertyType?.value && lmSignals.propertyType?.value) merged.propertyType = lmSignals.propertyType;
  if (!merged.rooms?.bedrooms && lmSignals.rooms?.bedrooms) merged.rooms.bedrooms = lmSignals.rooms.bedrooms;
  if (!merged.rooms?.bathrooms && lmSignals.rooms?.bathrooms) merged.rooms.bathrooms = lmSignals.rooms.bathrooms;
  if (!merged.contact?.fullName && lmSignals.contact?.fullName) merged.contact.fullName = lmSignals.contact.fullName;
  if (!merged.contact?.phone && lmSignals.contact?.phone) merged.contact.phone = lmSignals.contact.phone;
  if (!merged.contact?.email && lmSignals.contact?.email) merged.contact.email = lmSignals.contact.email;
  if (!merged.timeline?.display && lmSignals.timeline?.display) merged.timeline = lmSignals.timeline;
  merged.confidence = Math.max(merged.confidence || 0, lmSignals.confidence || 0);
  merged.missingFields = [];
  if (!merged.intent || merged.intent === "unknown") merged.missingFields.push("intent");
  if (!merged.area) merged.missingFields.push("area");
  if (!merged.price?.display) merged.missingFields.push("price");
  if (!merged.timeline?.display) merged.missingFields.push("timeline");
  return merged;
}

async function extractLeadSignalsWithLmStudio(message, slots) {
  const ruleSignals = extractLeadSignals(message);
  const model = await getLmStudioModelId();
  if (!model) return ruleSignals;

  const currentSlots = {
    intent: slots?.intent || null,
    area: slots?.area || null,
    province: slots?.province || null,
    price: slots?.priceDisplay || null,
    propertyType: slots?.propertyType || null,
    timeline: slots?.timeline || null,
    fullName: slots?.fullName || null,
    phone: slots?.phone || null
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: ["buy", "sell", "unknown"] },
      area: { type: "string" },
      province: { type: "string" },
      propertyType: { type: "string" },
      budgetOrPrice: { type: "string" },
      timeline: { type: "string" },
      fullName: { type: "string" },
      phone: { type: "string" },
      email: { type: "string" },
      bedrooms: { type: "number" },
      bathrooms: { type: "number" },
      confidence: { type: "number" }
    },
    required: [
      "intent",
      "area",
      "province",
      "propertyType",
      "budgetOrPrice",
      "timeline",
      "fullName",
      "phone",
      "email",
      "bedrooms",
      "bathrooms",
      "confidence"
    ]
  };

  const messages = [
    {
      role: "system",
      content:
        "Extract South African property lead details from short, messy customer text. Correct obvious typos only when confident. Return only JSON with these keys: intent, area, province, propertyType, budgetOrPrice, timeline, fullName, phone, email, bedrooms, bathrooms, confidence. Use empty strings and 0 for unknown fields. Do not invent phone numbers, prices, names, towns, or timelines."
    },
    {
      role: "user",
      content: JSON.stringify({
        message,
        currentSlots,
        allowedIntents: ["buy", "sell", "unknown"],
        knownProvinces: Object.values(canonicalProvinceMap)
      })
    }
  ];

  const baseBody = {
    model,
    stream: false,
    temperature: 0.1,
    max_tokens: 320,
    messages
  };
  const requestBodies = [
    {
      ...baseBody,
      response_format: {
          type: "json_schema",
          json_schema: {
            name: "axiom_property_lead",
            strict: true,
            schema
          }
        }
    },
    baseBody
  ];

  for (const body of requestBodies) {
    try {
      const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(LM_STUDIO_API_KEY ? { Authorization: `Bearer ${LM_STUDIO_API_KEY}` } : {})
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LM_STUDIO_TIMEOUT_MS)
      });
      if (!response.ok) continue;
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      const parsed = parseJsonObjectLoose(content);
      if (parsed) {
        lmStudioLastStatus = {
          enabled: true,
          connected: true,
          model,
          checkedAt: new Date().toISOString()
        };
        return mergeLeadSignalResults(ruleSignals, normalizeLmStudioLeadSignals(parsed));
      }
    } catch {
      continue;
    }
  }

  return ruleSignals;
}

function extractTimeline(message) {
  const lower = (message || "").toLowerCase();
  if (/\b(immediately|urgent|asap|now|today|this week)\b/.test(lower)) {
    return { display: "Immediately", urgency: "High", confidence: 0.95 };
  }
  if (/\b(1 month|one month|30 days|this month|within a month)\b/.test(lower)) {
    return { display: "Within 1 month", urgency: "High", confidence: 0.9 };
  }
  if (/\b(3 months|three months|quarter|within 3)\b/.test(lower)) {
    return { display: "Within 3 months", urgency: "Medium", confidence: 0.85 };
  }
  if (/\b(next few months|few months|couple of months)\b/.test(lower)) {
    return { display: "Within 3 months", urgency: "Medium", confidence: 0.78 };
  }
  if (/\b(6 months|six months|within 6)\b/.test(lower)) {
    return { display: "Within 6 months", urgency: "Low", confidence: 0.82 };
  }
  if (/\b(later|not urgent|just browsing|browsing|researching|no rush)\b/.test(lower)) {
    return { display: "Just browsing / no rush", urgency: "Low", confidence: 0.8 };
  }
  return { display: null, urgency: null, confidence: 0 };
}

function extractContactSignals(message) {
  const text = (message || "").trim();
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?27|0)\s?\d{2}\s?\d{3}\s?\d{4}\b|(?:\+?27|0)\d{9}\b/);
  const nameMatch = text.match(/\b(?:my name is|i am|i'm|this is)\s+([a-z][a-z\s'-]{1,48})/i);
  const rawName = nameMatch ? nameMatch[1].trim() : "";
  const falseName = /^(looking|interested|buying|selling|searching|trying|wanting|planning)\b/i.test(rawName);

  return {
    fullName: rawName && !falseName ? toTitleCase(rawName) : null,
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null,
    email: emailMatch ? cleanEmailAddress(emailMatch[0]) : null
  };
}

function cleanPhoneNumber(text) {
  const raw = (text || "").trim();
  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  if (digits.startsWith("27") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (hasLeadingPlus && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function cleanEmailAddress(text) {
  const raw = (text || "").trim().replace(/[<>()[\],;:"\s]+$/g, "");
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return null;
  const email = match[0].toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (domain.includes("..")) return null;
  if (!/^[a-z0-9._%+-]+$/i.test(local)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
  return email;
}

function createEmptySlots() {
  return {
    intent: null,
    area: null,
    province: null,
    priceDisplay: null,
    priceMin: null,
    priceMax: null,
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
    timeline: null,
    urgency: null,
    fullName: null,
    phone: null,
    email: null,
    additionalConsiderations: null,
    validationMessage: null,
    finalPromptAsked: false,
    closed: false,
    lastAskedField: null
  };
}

function createSlotsFromLeadPayload(payload) {
  const answers = withAnswerMaps(payload);
  return {
    intent: payload.intent || null,
    area: answers.get(["preferred area", "property location"], ["area", "location"]),
    province: answers.get(["province"], ["province"]),
    priceDisplay: answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"]),
    priceMin:
      parseAmount(
        answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])
      ) || null,
    priceMax:
      parseAmount(
        answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])
      ) || null,
    propertyType: answers.get(["property type"], ["propertytype"]),
    bedrooms: answers.get(["number of bedrooms"], ["bedrooms", "bed"]),
    bathrooms: answers.get(["number of bathrooms"], ["bathrooms", "bath"]),
    timeline: answers.get(["timeline to buy", "timeline to sell"], ["timeline"]),
    urgency: null,
    fullName: answers.get(["full name"], ["fullname", "name"]),
    phone: answers.get(["contact / whatsapp number", "contact number", "whatsapp number"], ["contact", "phone"]),
    email: answers.get(["email address"], ["email"])
  };
}

function mergeSlots(existing, extracted) {
  const merged = { ...(existing || createEmptySlots()) };
  if (extracted.intent && extracted.intent !== "unknown") merged.intent = extracted.intent;
  if (extracted.area) merged.area = extracted.area;
  if (extracted.province) merged.province = extracted.province;
  if (extracted.price.display) merged.priceDisplay = extracted.price.display;
  if (extracted.price.min !== null && extracted.price.min !== undefined) merged.priceMin = extracted.price.min;
  if (extracted.price.max !== null && extracted.price.max !== undefined) merged.priceMax = extracted.price.max;
  if (extracted.propertyType?.value) merged.propertyType = extracted.propertyType.value;
  if (extracted.rooms?.bedrooms) merged.bedrooms = extracted.rooms.bedrooms;
  if (extracted.rooms?.bathrooms) merged.bathrooms = extracted.rooms.bathrooms;
  if (extracted.timeline?.display) merged.timeline = extracted.timeline.display;
  if (extracted.timeline?.urgency) merged.urgency = extracted.timeline.urgency;
  if (extracted.contact?.fullName) merged.fullName = extracted.contact.fullName;
  if (extracted.contact?.phone) {
    const phone = cleanPhoneNumber(extracted.contact.phone);
    if (phone) merged.phone = phone;
  }
  if (extracted.contact?.email) {
    const email = cleanEmailAddress(extracted.contact.email);
    if (email) merged.email = email;
  }
  return merged;
}

function levenshteinDistance(a, b) {
  const left = a || "";
  const right = b || "";
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const prev = Array.from({ length: right.length + 1 }, (_item, index) => index);
  const next = new Array(right.length + 1).fill(0);

  for (let i = 0; i < left.length; i += 1) {
    next[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const cost = left[i] === right[j] ? 0 : 1;
      next[j + 1] = Math.min(
        next[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost
      );
    }
    for (let j = 0; j < prev.length; j += 1) prev[j] = next[j];
  }

  return prev[right.length];
}

function jaroWinklerSimilarity(a, b) {
  const left = a || "";
  const right = b || "";
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;

  const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0);
  const leftMatches = new Array(left.length).fill(false);
  const rightMatches = new Array(right.length).fill(false);
  let matches = 0;

  for (let i = 0; i < left.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, right.length);
    for (let j = start; j < end; j += 1) {
      if (rightMatches[j] || left[i] !== right[j]) continue;
      leftMatches[i] = true;
      rightMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (!matches) return 0;

  const leftMatched = [];
  const rightMatched = [];
  for (let i = 0; i < left.length; i += 1) {
    if (leftMatches[i]) leftMatched.push(left[i]);
  }
  for (let i = 0; i < right.length; i += 1) {
    if (rightMatches[i]) rightMatched.push(right[i]);
  }

  let transpositions = 0;
  for (let i = 0; i < leftMatched.length; i += 1) {
    if (leftMatched[i] !== rightMatched[i]) transpositions += 1;
  }
  transpositions /= 2;

  const jaro = (
    matches / left.length +
    matches / right.length +
    (matches - transpositions) / matches
  ) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, left.length, right.length); i += 1) {
    if (left[i] !== right[i]) break;
    prefix += 1;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function resolveKnownTown(area, provinceHint = null) {
  const key = normalizeAreaKey(
    (area || "")
      .replace(/^(?:the|a|an)\s+/i, "")
      .trim()
  );
  if (!key) return null;

  const exact = knownTownByKey.get(key);
  if (exact && (!provinceHint || exact.province === provinceHint)) {
    return { ...exact, confidence: 0.99, exact: true };
  }

  const pool = provinceHint
    ? knownTownEntries.filter((entry) => entry.province === provinceHint)
    : knownTownEntries;
  let best = null;
  let secondBest = null;

  for (const entry of pool) {
    if (Math.abs(entry.key.length - key.length) > 3) continue;
    if (entry.key[0] !== key[0]) continue;

    const distance = levenshteinDistance(key, entry.key);
    const maxDistance = key.length <= 5 ? 1 : key.length <= 8 ? 3 : 3;
    const winkler = jaroWinklerSimilarity(key, entry.key);
    if (distance > maxDistance && winkler < 0.88) continue;

    let score = Math.max(1 - distance / Math.max(key.length, entry.key.length), winkler);
    if (entry.key.startsWith(key) || key.startsWith(entry.key)) score += 0.08;
    if (entry.key[0] === key[0]) score += 0.03;
    if (provinceHint && entry.province === provinceHint) score += 0.04;

    const candidate = { entry, score };
    if (!best || score > best.score) {
      secondBest = best;
      best = candidate;
    } else if (!secondBest || score > secondBest.score) {
      secondBest = candidate;
    }
  }

  if (!best) return null;
  if (best.score < 0.86) return null;
  if (secondBest && best.score - secondBest.score < 0.08) return null;

  return {
    ...best.entry,
    confidence: Math.min(best.score, 0.95),
    exact: false
  };
}

function parseLeadNameAnswer(message) {
  const trimmed = (message || "").trim();
  if (!trimmed) return null;

  const explicit = extractContactSignals(trimmed).fullName;
  if (explicit) return explicit;

  if (extractPrice(trimmed).display) return null;
  if (extractTimeline(trimmed).display) return null;
  if (extractIntent(trimmed).value !== "unknown") return null;
  if (extractArea(trimmed).area) return null;

  const candidate = toTitleCase(
    trimmed
      .replace(/^(my name is|i am|i'm|this is)\s+/i, "")
      .replace(/[^a-z\s'-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  if (!candidate) return null;

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;

  const blockedWords = new Set([
    "buy",
    "buyer",
    "sell",
    "seller",
    "property",
    "budget",
    "price",
    "range",
    "timeline",
    "urgent",
    "immediately",
    "today",
    "tomorrow",
    "week",
    "month",
    "browsing",
    "researching",
    "looking",
    "searching",
    "interested"
  ]);
  if (words.some((word) => blockedWords.has(word.toLowerCase()))) return null;
  if (!words.every((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word))) return null;

  return candidate;
}

function normalizeConciergeText(text = "") {
  return String(text || "")
    .replace(/\blet\s*;\s*is\b/gi, "let's")
    .replace(/\blet\s+is\b/gi, "let's")
    .replace(/\bll\s+llm\b/gi, "LLM");
}

function applyPendingFieldAnswer(slots, message) {
  const pending = slots?.lastAskedField;
  if (!pending) return slots;
  const trimmed = (message || "").trim();
  if (!trimmed) return slots;
  slots.validationMessage = null;

  if (pending === "bedrooms") {
    const n = Number(trimmed.replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0) slots.bedrooms = n;
  }
  if (pending === "bathrooms") {
    const n = Number(trimmed.replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0) slots.bathrooms = n;
  }
  if (pending === "price") {
    const p = extractPrice(trimmed);
    if (p.display) {
      slots.priceDisplay = p.display;
      slots.priceMin = p.min;
      slots.priceMax = p.max;
    } else {
      slots.validationMessage =
        slots.intent === "sell"
          ? "Please send the expected selling price range you want us to use, for example R1.8m to R2.2m."
          : "Please send the budget range you want us to use, for example R1.5m to R2m.";
    }
  }
  if (pending === "intent") {
    const i = extractIntent(trimmed);
    if (i.value !== "unknown") slots.intent = i.value;
    else slots.validationMessage = "Are you looking to buy or sell?";
  }
  if (pending === "propertyType") {
    const propertyType = extractPropertyType(trimmed);
    if (propertyType.value) {
      slots.propertyType = propertyType.value;
    } else {
      slots.validationMessage = "What type of property is it, for example house, flat, apartment, land, or farm?";
    }
  }
  if (pending === "area") {
    applyAreaAnswer(slots, trimmed);
  }
  if (pending === "timeline") {
    const t = extractTimeline(trimmed);
    if (t.display) {
      slots.timeline = t.display;
      slots.urgency = t.urgency || "Unknown";
    } else {
      slots.validationMessage =
        slots.intent === "sell"
          ? "How soon would you like to start the selling process?"
          : "How soon would you like to start the buying process?";
    }
  }
  if (pending === "fullName") {
    const name = parseLeadNameAnswer(trimmed);
    if (name) {
      slots.fullName = name;
    } else {
      slots.validationMessage = "I did not catch your name. What should we call you?";
    }
  }
  if (pending === "phone") {
    const contact = extractContactSignals(trimmed);
    const phone = cleanPhoneNumber(contact.phone || trimmed);
    if (phone) {
      slots.phone = phone;
    } else {
      const digitCount = (trimmed.match(/\d/g) || []).length;
      slots.validationMessage =
        digitCount === 0
          ? "I did not catch a number there. What number should we reach out to you on?"
          : "That number looks a bit short. Please send the full number, for example 083 123 4567 or +27 83 123 4567.";
    }
  }
  if (pending === "email") {
    const contact = extractContactSignals(trimmed);
    const email = cleanEmailAddress(contact.email || trimmed);
    if (email) {
      slots.email = email;
    } else {
      slots.validationMessage =
        "That email address looks incomplete. Please send it in this format: name@example.com.";
    }
  }

  return slots;
}

function getMissingFromSlots(slots) {
  const missing = [];
  if (!slots.fullName) missing.push("fullName");
  if (!slots.phone) missing.push("phone");
  if (!slots.intent) missing.push("intent");
  if (!slots.area) missing.push("area");
  if (!slots.priceDisplay) missing.push("price");
  if (!slots.timeline) missing.push("timeline");
  return missing;
}

function getMissingFieldLabel(field) {
  const labels = {
    fullName: "full name",
    phone: "WhatsApp number",
    email: "email address",
    intent: "buy or sell intent",
    area: "area/suburb",
    price: "budget or price range",
    timeline: "timeline"
  };
  return labels[field] || field;
}

function formatMissingChecklist(missingFields) {
  return missingFields.map((field) => getMissingFieldLabel(field)).join(", ");
}

function buildClarifyingQuestion(missingKey, slots) {
  if (missingKey === "intent") return "Are you looking to buy, or to sell?";
  if (missingKey === "area") {
    if (slots.province) return `Which town or suburb in ${slots.province} should I use?`;
    return "Which town or suburb should I use for your request?";
  }
  if (missingKey === "price") {
    return slots.intent === "sell"
      ? "What expected selling price range should I use?"
      : "What budget range should we use?";
  }
  if (missingKey === "bedrooms") {
    return slots.intent === "sell"
      ? "How many bedrooms does your property offer?"
      : "How many bedrooms would you like?";
  }
  if (missingKey === "bathrooms") {
    return slots.intent === "sell"
      ? "How many bathrooms does your property offer?"
      : "How many bathrooms would you like?";
  }
  if (missingKey === "timeline") {
    return slots.intent === "sell"
      ? "How soon would you like to start selling?"
      : "How soon would you like to start your search?";
  }
  if (missingKey === "propertyType") return "What property type should I use, for example house, flat, apartment, land, or farm?";
  if (missingKey === "fullName") return "What should we call you when we follow up?";
  if (missingKey === "phone") return "What WhatsApp number can we use to reach you?";
  if (missingKey === "email") return "What email address should we use for this request?";
  return "Could you share a little more detail?";
}

function buildInitialIntentLine(slots, extracted) {
  if (!slots.intent || !extracted?.area) return "";
  const verb = slots.intent === "sell" ? "sell" : "buy";
  const propertyType = slots.propertyType ? slots.propertyType.toLowerCase() : "";
  const propertyDescriptor = propertyType
    ? `${getIndefiniteArticle(propertyType)} ${propertyType} in`
    : "";
  return `Excellent — I can help you ${verb} ${propertyDescriptor} ${extracted.area}.`;
}

function getIndefiniteArticle(value) {
  const word = String(value || "").trim().toLowerCase();
  if (!word) return "a";
  const firstChar = word[0];
  const startsWithVowel = ["a", "e", "i", "o", "u"].includes(firstChar);
  return startsWithVowel ? "an" : "a";
}

function buildAnswerAcknowledgement(slots) {
  const pending = slots?.lastAskedField;
  if (pending === "area") {
    return slots.province ? `Great, noted: ${slots.area} in ${slots.province}.` : `Great, noted: ${slots.area}.`;
  }
  if (pending === "price") return `Great, I will use ${slots.priceDisplay}.`;
  if (pending === "bedrooms") {
    return `Great, ${slots.bedrooms} bedrooms noted.`;
  }
  if (pending === "bathrooms") return `Great, ${slots.bathrooms} bathrooms noted.`;
  if (pending === "timeline") return `Great, timeline noted as ${slots.timeline}.`;
  if (pending === "propertyType" && slots.propertyType) return `Great, noted: ${slots.propertyType.toLowerCase()}.`;
  if (pending === "fullName" && slots.fullName) return `Great, thank you, ${slots.fullName}.`;
  if (pending === "phone" && slots.phone) return "Great, I have the WhatsApp number.";
  if (pending === "email" && slots.email) return "Great, I have the email address.";
  return "";
}

function buildConciergeReply(slots, missingFields, extracted, urgent, hasPriorAssistantReply) {
  const lines = [];
  if (!hasPriorAssistantReply) {
    const opening = buildInitialIntentLine(slots, extracted);
    if (opening) {
      lines.push(opening);
    } else if (slots.intent === "buy") {
      lines.push("Excellent — I can help you buy.");
    } else if (slots.intent === "sell") {
      lines.push("Excellent — I can help you sell.");
    } else {
      lines.push("I can help with buying or selling.");
    }
    if (extracted.area) lines.push(`Area captured: ${extracted.area}.`);
    if (slots.province) lines.push(`Province: ${slots.province}.`);
    if (slots.priceDisplay) lines.push(`Budget signal: ${slots.priceDisplay}.`);
    if (urgent) lines.push("Urgency captured: immediate timeline.");
  } else {
    const acknowledgement = buildAnswerAcknowledgement(slots);
    if (acknowledgement) lines.push(acknowledgement);
  }

  if (slots.validationMessage) {
    lines.push(slots.validationMessage);
    return lines.join(" ");
  }

  if (missingFields.length > 0) {
    const nextField = missingFields[0];
    lines.push(buildClarifyingQuestion(nextField, slots));
    slots.lastAskedField = nextField;
  } else if (!slots.finalPromptAsked) {
    slots.lastAskedField = "additionalConsiderations";
    slots.finalPromptAsked = true;
    lines.push(
      "Any other preferences you'd like the concierge to include before I pass this to a specialist?"
    );
  } else {
    slots.lastAskedField = null;
    lines.push(
      "Excellent — your request is complete. I’ve built your concierge brief and routed it to the right specialist."
    );
  }

  return lines.join(" ");
}

function isNegativeResponse(text) {
  const lower = (text || "").toLowerCase().trim();
  return /^(no|none|nothing|nope|nah|n\/a|no thanks|thats all|that's all)$/i.test(lower);
}

function buildConciergeHandoffMessage(session, sessionId, followUpUrl) {
  const s = session.slots || createEmptySlots();
  const lines = [
    "New Concierge Introduction",
    "",
    `- Intent: ${(s.intent || "unknown").toUpperCase()}`,
    `- Area: ${s.area || "Not provided"}`,
    `- Province: ${s.province || "Not provided"}`,
    `- Price: ${s.priceDisplay || "Not provided"}`,
    `- Property type: ${s.propertyType || "Not provided"}`,
    `- Bedrooms: ${s.bedrooms || "Not provided"}`,
    `- Bathrooms: ${s.bathrooms || "Not provided"}`,
    `- Timeline: ${s.timeline || "Not provided"}`,
    `- Urgency: ${s.urgency || "Unknown"}`,
    `- Name: ${s.fullName || "Not provided"}`,
    `- WhatsApp/contact: ${s.phone || "Not provided"}`,
    `- Email: ${s.email || "Not provided"}`,
    `- Additional considerations: ${s.additionalConsiderations || "None"}`,
    "",
    "Concierge instruction:",
    "- Respond immediately while intent is fresh",
    "- Review the lead and identify the most appropriate agent conversation",
    "- Use the context above; do not ask the client to repeat basics",
    "",
    `- Session ID: ${sessionId}`
  ];
  return lines.join("\n");
}

function buildSessionSnapshot(session) {
  const s = session?.slots || createEmptySlots();
  const intentLabel = s.intent === "sell" ? "Seller" : s.intent === "buy" ? "Buyer" : "Property";
  const parts = [
    `${intentLabel} lead`,
    s.province || "Unknown province",
    s.area || "Unknown area",
    `value ${s.priceDisplay || "not provided"}`,
    `timeline ${(s.timeline || "not provided").toString().toLowerCase()}`
  ];
  if (s.propertyType) parts.push(`type ${s.propertyType.toLowerCase()}`);
  if (s.bedrooms) parts.push(`${s.bedrooms} bed`);
  if (s.bathrooms) parts.push(`${s.bathrooms} bath`);
  return parts.join(" | ");
}

function getSessionCopilot(session) {
  if (session?.copilot) return session.copilot;
  return {
    snapshot: buildSessionSnapshot(session),
    firstReply: "Thanks for your request. I have your property brief and can help route it properly. Is a quick call in the next 10 minutes okay?",
    nextAction: "Open the WhatsApp introduction and contact the lead while the request is still fresh.",
    unknowns: []
  };
}

function getLeadLifecycleStage(code) {
  return leadLifecycleStages.find((stage) => stage.code === code) || leadLifecycleStages[0];
}

function markConciergeAcknowledged(session, source = "operations") {
  if (!session.conciergeAcknowledgedAt) {
    session.conciergeAcknowledgedAt = new Date().toISOString();
    session.conciergeAcknowledgedSource = source;
  }
}

function ensureLeadAuditTrail(session) {
  session.auditTrail = Array.isArray(session.auditTrail) ? session.auditTrail : [];
  return session.auditTrail;
}

function appendLeadAuditEvent(session, event = {}) {
  if (!session?.id) return null;
  const trail = ensureLeadAuditTrail(session);
  const previousHash = trail.length ? trail[trail.length - 1].hash || "" : "";
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    type: sanitizeShortText(event.type || "lead-update", 80) || "lead-update",
    actor: sanitizeShortText(event.actor || "System", 120) || "System",
    source: sanitizeShortText(event.source || "system", 80) || "system",
    summary: sanitizeShortText(event.summary || "Lead updated", 240) || "Lead updated",
    details: sanitizeShortText(event.details || "", 500) || "",
    previousHash
  };
  const digest = createHash("sha256")
    .update(
      [
        entry.id,
        entry.at,
        entry.type,
        entry.actor,
        entry.source,
        entry.summary,
        entry.details,
        entry.previousHash
      ].join("|")
    )
    .digest("hex");
  entry.hash = digest;
  trail.push(entry);
  session.auditTrail = trail.slice(-500);
  return entry;
}

function ensureLeadAutomationState(session) {
  session.automationState = session.automationState && typeof session.automationState === "object" ? session.automationState : {};
  session.automationState.openEscalations =
    session.automationState.openEscalations && typeof session.automationState.openEscalations === "object"
      ? session.automationState.openEscalations
      : {};
  session.automationState.documentReminders =
    session.automationState.documentReminders && typeof session.automationState.documentReminders === "object"
      ? session.automationState.documentReminders
      : {};
  session.automationState.deadlineChase =
    session.automationState.deadlineChase && typeof session.automationState.deadlineChase === "object"
      ? session.automationState.deadlineChase
      : {};
  session.automationState.wowTouches =
    session.automationState.wowTouches && typeof session.automationState.wowTouches === "object"
      ? session.automationState.wowTouches
      : {};
  session.automationState.proactiveTouches =
    session.automationState.proactiveTouches && typeof session.automationState.proactiveTouches === "object"
      ? session.automationState.proactiveTouches
      : { steps: {} };
  session.automationState.proactiveTouches.steps =
    session.automationState.proactiveTouches.steps && typeof session.automationState.proactiveTouches.steps === "object"
      ? session.automationState.proactiveTouches.steps
      : {};
  return session.automationState;
}

function getLeadLifecycle(session) {
  const manualCode = session.lifecycleStage?.code;
  const manualStage = leadLifecycleStageCodes.includes(manualCode) ? session.lifecycleStage : null;
  const manualTerminal = ["sale-pending", "sale-concluded", "closed"].includes(manualStage?.code);
  if (manualTerminal) {
    return {
      ...getLeadLifecycleStage(manualStage.code),
      source: "manual",
      updatedAt: manualStage.updatedAt || null,
      note: manualStage.note || "",
      ageDays: null
    };
  }

  if (manualStage?.code === "with-agent") {
    const anchor = session.agentEngagedAt || session.agentContact?.contactedAt || session.assignedAgent?.assignedAt || manualStage.updatedAt;
    const days = anchor ? Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 86400000)) : 0;
    let code = "with-agent";
    if (days >= 31) code = "with-agent-1-month-plus";
    else if (days >= 28) code = "with-agent-1-month";
    else if (days >= 14) code = "with-agent-2-weeks";
    else if (days >= 7) code = "with-agent-1-week";
    return {
      ...getLeadLifecycleStage(code),
      source: "manual-with-age",
      updatedAt: manualStage.updatedAt || null,
      note: manualStage.note || "",
      ageDays: days
    };
  }

  if (session.agentContact?.contactedAt) {
    return {
      ...getLeadLifecycleStage("contact-confirmed"),
      source: "auto",
      updatedAt: session.agentContact.contactedAt,
      note: "",
      ageDays: null
    };
  }
  if (isSessionReferred(session)) {
    return {
      ...getLeadLifecycleStage("referred"),
      source: "auto",
      updatedAt: session.assignedAgent?.assignedAt || session.agentAccess?.createdAt || null,
      note: "",
      ageDays: null
    };
  }
  if (session.conciergeAcknowledgedAt || manualStage?.code === "acknowledged") {
    return {
      ...getLeadLifecycleStage("acknowledged"),
      source: session.conciergeAcknowledgedAt ? "auto" : "manual",
      updatedAt: session.conciergeAcknowledgedAt || manualStage?.updatedAt || null,
      note: manualStage?.note || "",
      ageDays: null
    };
  }
  return {
    ...getLeadLifecycleStage("new-unacknowledged"),
    source: "auto",
    updatedAt: session.createdAt || null,
    note: "",
    ageDays: null
  };
}

function getCaseFileStage(code) {
  return caseFileStages.find((stage) => stage.code === code) || caseFileStages[0];
}

function getCaseFileNextMilestone(stageCode) {
  const index = caseFileStages.findIndex((stage) => stage.code === stageCode);
  if (index < 0 || index >= caseFileStages.length - 1) return null;
  return caseFileStages[index + 1].label;
}

function mapLifecycleToCaseFileStage(session, lifecycle) {
  const dealStatus = (session.dealProtection?.status || "").toLowerCase();
  if (["sale-concluded"].includes(lifecycle.code) || dealStatus === "closed won") return "sale-concluded";
  if (lifecycle.code === "closed" || ["lost", "cold"].includes(dealStatus)) return "closed-lost";
  if (lifecycle.code === "sale-pending" || ["offer pending", "under contract"].includes(dealStatus)) return "offer-in-progress";
  if (["with-agent", "with-agent-1-week", "with-agent-2-weeks", "with-agent-1-month", "with-agent-1-month-plus"].includes(lifecycle.code)) {
    return "active-follow-up";
  }
  if (lifecycle.code === "contact-confirmed") return "client-contacted";
  if (lifecycle.code === "referred") return "specialist-assigned";
  if (lifecycle.code === "acknowledged") return "brief-qualified";
  return "intake-received";
}

function createLeadCaseFile(session) {
  const lifecycle = getLeadLifecycle(session);
  const stageCode = mapLifecycleToCaseFileStage(session, lifecycle);
  const stage = getCaseFileStage(stageCode);
  const now = new Date().toISOString();
  const nextMilestone = getCaseFileNextMilestone(stageCode);
  return {
    id: `CASE-${session.id}`,
    leadId: session.id,
    createdAt: session.createdAt || now,
    updatedAt: now,
    stage: stage.code,
    stageLabel: stage.label,
    owner: stage.owner,
    dueAt: null,
    nextMilestone,
    latestNote: "",
    history: [
      {
        at: now,
        from: null,
        to: stage.code,
        source: "system",
        actor: "System",
        note: "Case file created from lead intake"
      }
    ]
  };
}

function ensureLeadCaseFile(session) {
  if (!session.caseFile) {
    session.caseFile = createLeadCaseFile(session);
    return session.caseFile;
  }
  session.caseFile.history = Array.isArray(session.caseFile.history) ? session.caseFile.history : [];
  session.caseFile.stage = session.caseFile.stage || "intake-received";
  const stage = getCaseFileStage(session.caseFile.stage);
  session.caseFile.stageLabel = stage.label;
  session.caseFile.owner = session.caseFile.owner || stage.owner;
  session.caseFile.nextMilestone = session.caseFile.nextMilestone || getCaseFileNextMilestone(stage.code);
  return session.caseFile;
}

function updateLeadCaseStage(session, code, options = {}) {
  if (!caseFileStages.some((stage) => stage.code === code)) return null;
  const caseFile = ensureLeadCaseFile(session);
  const nextStage = getCaseFileStage(code);
  const currentStage = getCaseFileStage(caseFile.stage);
  const allowBackward = Boolean(options.allowBackward);
  if (!allowBackward && nextStage.rank < currentStage.rank) {
    return { changed: false, rejected: true, reason: "backward-transition" };
  }

  const now = new Date().toISOString();
  const changed = caseFile.stage !== nextStage.code;
  if (changed) {
    caseFile.history.push({
      at: now,
      from: caseFile.stage,
      to: nextStage.code,
      source: options.source || "system",
      actor: options.actor || "System",
      note: options.note || ""
    });
    caseFile.stage = nextStage.code;
    caseFile.stageLabel = nextStage.label;
  }
  caseFile.owner = options.owner || caseFile.owner || nextStage.owner;
  if (Object.prototype.hasOwnProperty.call(options, "dueAt")) caseFile.dueAt = options.dueAt || null;
  if (options.note) caseFile.latestNote = options.note;
  caseFile.nextMilestone = getCaseFileNextMilestone(caseFile.stage);
  caseFile.updatedAt = now;
  session.caseFile = caseFile;
  return { changed, rejected: false, caseFile };
}

function syncLeadCaseFile(session, options = {}) {
  const lifecycle = getLeadLifecycle(session);
  const stageCode = mapLifecycleToCaseFileStage(session, lifecycle);
  const note = options.note || lifecycle.note || "";
  return updateLeadCaseStage(session, stageCode, {
    source: options.source || "lifecycle-sync",
    actor: options.actor || "System",
    note,
    allowBackward: Boolean(options.allowBackward)
  });
}

function getLeadCaseFileSummary(session) {
  const caseFile = ensureLeadCaseFile(session);
  const workflow = getLeadOutcomeWorkflow(session);
  return {
    id: caseFile.id,
    leadId: caseFile.leadId,
    stage: caseFile.stage,
    stageLabel: caseFile.stageLabel,
    owner: workflow.activeTrack !== "undecided" ? workflow.primaryOwner : caseFile.owner,
    dueAt: caseFile.dueAt || getOutcomeWorkflowDueAt(session, workflow) || null,
    updatedAt: caseFile.updatedAt || null,
    nextMilestone: caseFile.nextMilestone || null,
    latestNote: caseFile.latestNote || "",
    historyCount: Array.isArray(caseFile.history) ? caseFile.history.length : 0
  };
}

function buildUserClosingPromise(slots) {
  const s = slots || createEmptySlots();
  const firstName = s.fullName ? s.fullName.split(/\s+/)[0] : "";
  const promiseIntro = firstName ? `${firstName}, here is our promise to you:` : "Here is our promise to you:";
  const intent = s.intent === "sell" ? "selling" : s.intent === "buy" ? "buying" : "property";
  const urgencyLine =
    s.urgency === "High"
      ? " Because your timing is urgent, your request will be treated as a priority."
      : "";

  return `${promiseIntro} you will not have to repeat the basics. Your ${intent} brief is captured clearly, and the concierge will use it to connect you with a specialist who can take care of the next step.${urgencyLine}`;
}

function scoreLead(payload) {
  const answers = withAnswerMaps(payload);
  const reasons = [];
  let score = 0;

  const timeline = (answers.get(["timeline to buy", "timeline to sell"], ["timeline"]) || "").toLowerCase();
  const phone = answers.get(["contact / whatsapp number", "contact number", "whatsapp number"], ["contact", "phone"]);
  if (timeline.includes("immediately")) {
    score += 35;
    reasons.push("Immediate timeline");
  } else if (timeline.includes("within 1 month")) {
    score += 25;
    reasons.push("Short timeline (1 month)");
  } else if (timeline.includes("within 3 months")) {
    score += 15;
    reasons.push("Medium timeline (3 months)");
  } else if (timeline.includes("within 6 months")) {
    score += 8;
    reasons.push("Longer timeline (6 months)");
  }

  const budget = parseAmount(
    answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])
  );
  if (budget > 0) {
    score += 10;
    reasons.push("Budget/price provided");
    if (budget >= 2000000) {
      score += 10;
      reasons.push("Higher value range");
    }
  }

  const deposit = (answers.get(["estimated cash deposit available"], ["deposit", "cashdeposit"]) || "").toLowerCase();
  if (deposit.includes("above r700k")) {
    score += 20;
    reasons.push("Strong deposit readiness");
  } else if (deposit.includes("r300k - r700k")) {
    score += 14;
    reasons.push("Good deposit readiness");
  } else if (deposit.includes("r100k - r300k")) {
    score += 8;
    reasons.push("Moderate deposit readiness");
  } else if (deposit.includes("under r100k")) {
    score += 4;
    reasons.push("Early deposit readiness");
  }

  if ((answers.get(["email address"], ["email"]) || "").includes("@")) {
    score += 5;
    reasons.push("Valid email captured");
  }
  if (phone.length >= 8) {
    score += 5;
    reasons.push("WhatsApp/contact number captured");
  }

  if ((payload.additionalInfo || "").trim()) {
    score += 5;
    reasons.push("Additional context provided");
  }

  if (answers.get(["property type"], ["propertytype"])) {
    score += 5;
    reasons.push("Property type specified");
  }
  if (payload.intent === "buy" && answers.get(["preferred area", "property location"], ["area", "location"])) {
    score += 5;
    reasons.push("Preferred area specified");
  }

  const unknowns = [];
  if (phone.length < 8) unknowns.push("phone");
  if (!answers.get(["province"], ["province"])) unknowns.push("province");
  if (!answers.get(["preferred area", "property location"], ["area", "location"])) unknowns.push("area");
  if (!answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"]))
    unknowns.push("price");
  if (!answers.get(["timeline to buy", "timeline to sell"], ["timeline"])) unknowns.push("timeline");

  score = Math.min(score, 100);
  const band = score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";
  const urgency =
    timeline.includes("immediately") || timeline.includes("within 1 month")
      ? "High"
      : timeline.includes("within 3 months")
        ? "Medium"
        : "Low";
  const closeLikelihood = score >= 80 ? "Very High" : score >= 65 ? "High" : score >= 45 ? "Moderate" : "Early Stage";

  return {
    score,
    band,
    urgency,
    closeLikelihood,
    dataCompleteness: Math.max(0, 100 - unknowns.length * 12),
    missingSignals: unknowns,
    reasons: reasons.length ? reasons : ["Basic details captured"]
  };
}

function getLeadIntakeFieldSignals(payloadOrSession = {}) {
  const payload = payloadOrSession.answers
    ? payloadOrSession
    : {
        intent: payloadOrSession.intent,
        answers: payloadOrSession.answers || [],
        additionalInfo: payloadOrSession.additionalInfo || ""
      };
  const answers = withAnswerMaps(payload);
  const slots = payloadOrSession.slots ? getSessionSlots(payloadOrSession) : createSlotsFromLeadPayload(payload);
  const phone = cleanPhoneNumber(
    slots.phone || answers.get(["contact / whatsapp number", "contact number", "whatsapp number"], ["contact", "phone"])
  );
  const email = cleanEmailAddress(slots.email || answers.get(["email address"], ["email"]));
  const price =
    slots.priceDisplay ||
    answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"]) ||
    "";
  const timeline = slots.timeline || answers.get(["timeline to buy", "timeline to sell"], ["timeline"]);

  return {
    intent: slots.intent || payload.intent || "",
    fullName: slots.fullName || answers.get(["full name"], ["fullname", "name"]) || "",
    phone,
    email,
    province: slots.province || answers.get(["province"], ["province"]) || "",
    area:
      slots.area || answers.get(["preferred area", "property location"], ["area", "location"]) || "",
    price,
    timeline,
    propertyType: slots.propertyType || answers.get(["property type"], ["propertytype"]) || "",
    bedrooms: slots.bedrooms || answers.get(["number of bedrooms"], ["bedrooms", "bed"]) || "",
    bathrooms: slots.bathrooms || answers.get(["number of bathrooms"], ["bathrooms", "bath"]) || "",
    deposit: answers.get(["estimated cash deposit available"], ["deposit", "cashdeposit"]) || "",
    additionalInfo: payload.additionalInfo || payloadOrSession.additionalInfo || ""
  };
}

function buildLeadIntakeIntelligence(payloadOrSession = {}, scoringOverride = null) {
  const signals = getLeadIntakeFieldSignals(payloadOrSession);
  const scoring = scoringOverride || payloadOrSession.scoring || scoreLead(payloadOrSession);
  const criticalFields = [
    ["fullName", "Full name"],
    ["phone", "WhatsApp/contact number"],
    ["intent", "Buy/sell intent"],
    ["province", "Province"],
    ["area", "Area/suburb"],
    ["price", "Budget or selling price"],
    ["timeline", "Timeline"]
  ];
  const enrichmentFields = [
    ["propertyType", "Property type"],
    ["bedrooms", "Bedrooms"],
    ["bathrooms", "Bathrooms"],
    ["additionalInfo", "Extra context"]
  ];

  if ((signals.intent || payloadOrSession.intent) === "buy") {
    enrichmentFields.splice(3, 0, ["deposit", "Deposit readiness"]);
  }

  const missingCritical = criticalFields.filter(([key]) => !signals[key]).map(([, label]) => label);
  const missingEnrichment = enrichmentFields.filter(([key]) => !signals[key]).map(([, label]) => label);
  const criticalComplete = criticalFields.length - missingCritical.length;
  const enrichmentComplete = enrichmentFields.length - missingEnrichment.length;
  const captureScore = Math.round(
    ((criticalComplete / criticalFields.length) * 72 + (enrichmentComplete / enrichmentFields.length) * 28) || 0
  );

  const urgency = scoring.urgency || "Low";
  const quality =
    captureScore >= 90 ? "Excellent" : captureScore >= 75 ? "Good" : captureScore >= 55 ? "Needs enrichment" : "Incomplete";
  const routeReadiness =
    missingCritical.length > 0
      ? "Needs intake completion"
      : Number(scoring.score || 0) >= 70
        ? "Ready for priority routing"
        : "Ready for standard routing";
  const priority =
    routeReadiness === "Ready for priority routing" || urgency === "High"
      ? "High"
      : routeReadiness === "Needs intake completion"
        ? "Medium"
        : "Low";

  const actions = [];
  if (missingCritical.length) {
    actions.push({
      label: "Complete missing intake fields",
      priority: "High",
      detail: `Capture: ${missingCritical.join(", ")}.`
    });
  }
  if (!missingCritical.length && missingEnrichment.length) {
    actions.push({
      label: "Enrich before introduction if time allows",
      priority: priority === "High" ? "Medium" : "Low",
      detail: `Optional but useful: ${missingEnrichment.join(", ")}.`
    });
  }
  if (!missingCritical.length) {
    actions.push({
      label: urgency === "High" ? "Route while intent is fresh" : "Route to best-fit specialist",
      priority,
      detail:
        urgency === "High"
          ? "Contact now and assign the strongest available area specialist."
          : "Use the agent match recommendation, then record the next dated step."
    });
  }

  return {
    captureScore,
    quality,
    priority,
    routeReadiness,
    missingCritical,
    missingEnrichment,
    capturedSignals: criticalComplete + enrichmentComplete,
    totalSignals: criticalFields.length + enrichmentFields.length,
    summary:
      missingCritical.length > 0
        ? `Intake needs ${missingCritical.length} critical field${missingCritical.length === 1 ? "" : "s"} before routing.`
        : `${quality} intake. ${routeReadiness}.`,
    actions
  };
}

function buildAgentCopilotSummary(payload, scoring) {
  const answers = withAnswerMaps(payload);
  const intentLabel = payload.intent === "buy" ? "Buyer" : "Seller";
  const province = answers.get(["province"], ["province"]) || "Unknown province";
  const place =
    answers.get(["preferred area", "property location"], ["area", "location"]) || "Unknown area";
  const value =
    answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])
    || "Value not provided";
  const timeline = answers.get(["timeline to buy", "timeline to sell"], ["timeline"]) || "Timeline not provided";
  const deposit = answers.get(["estimated cash deposit available"], ["deposit", "cashdeposit"]) || "";
  const propertyType = answers.get(["property type"], ["propertytype"]) || "";
  const phone = answers.get(["contact / whatsapp number", "contact number", "whatsapp number"], ["contact", "phone"]);

  const snapshotParts = [
    `${intentLabel} lead`,
    `${province}`,
    `${place}`,
    `value ${value}`,
    `timeline ${timeline.toLowerCase()}`
  ];
  if (deposit) snapshotParts.push(`deposit ${deposit.toLowerCase()}`);
  if (propertyType) snapshotParts.push(`type ${propertyType.toLowerCase()}`);

  let nextAction = "Central concierge should send WhatsApp follow-up and schedule a short qualification call.";
  if (scoring.band === "Hot") nextAction = "Central concierge should call within 10 minutes and decide the next agent introduction.";
  if (payload.intent === "sell") nextAction += " Prepare valuation guidance or identify the best listing agent.";
  if (payload.intent === "buy") nextAction += " Prepare buyer requirements and identify a suitable agent conversation.";

  const firstReply =
    payload.intent === "buy"
      ? "Thanks for your request. I have your buyer brief and can help route it properly. Is a quick call in the next 10 minutes okay?"
      : "Thanks for your request. I have your seller brief and can help route it properly. Is a quick call in the next 10 minutes okay?";

  const unknowns = [];
  if (!phone) unknowns.push("WhatsApp/contact number");
  if (!answers.get(["province"], ["province"])) unknowns.push("Province");
  if (!answers.get(["preferred area", "property location"], ["area", "location"])) unknowns.push("Exact area");
  if (!answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])) unknowns.push("Budget/price");
  if (!answers.get(["timeline to buy", "timeline to sell"], ["timeline"])) unknowns.push("Timeline");
  if (!unknowns.length) unknowns.push("None");

  return {
    snapshot: snapshotParts.join(" | "),
    firstReply,
    nextAction,
    unknowns
  };
}

function buildFollowUpPlaybook(payload, scoring) {
  const answers = withAnswerMaps(payload);
  const name = answers.get(["full name"], ["fullname", "name"]) || "there";
  const timeline = (answers.get(["timeline to buy", "timeline to sell"], ["timeline"]) || "your timeline").toLowerCase();
  const area =
    answers.get(["preferred area", "property location"], ["area", "location"]) || "your preferred area";
  const value =
    answers.get(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"])
    || "your price range";

  const intro =
    payload.intent === "buy"
      ? `Hi ${name}, thanks for your property request. I have your buyer brief for ${area} around ${value} and can route it properly.`
      : `Hi ${name}, thanks for your seller request. I have your seller brief for ${area} around ${value} and can route it properly.`;

  const urgencyLine =
    scoring.urgency === "High"
      ? "Because your timeline is soon, I recommend a quick 10-minute call today."
      : `Based on your timeline (${timeline}), we can structure this step-by-step without pressure.`;

  return [
    {
      trigger: "10 minutes",
      message: `${intro} ${urgencyLine} Are you available for a quick call?`
    },
    {
      trigger: "2 hours",
      message:
        payload.intent === "buy"
          ? `Checking in, ${name}. I can confirm the brief and identify the right next agent conversation so you avoid wasted viewings.`
          : `Checking in, ${name}. I can confirm the brief and identify the right next agent conversation for pricing and demand.`
    },
    {
      trigger: "24 hours",
      message:
        payload.intent === "buy"
          ? `Final follow-up for now, ${name}. If you'd like, I can keep your buyer brief active and route it when the right fit appears.`
          : `Final follow-up for now, ${name}. If you'd like, I can keep your seller brief active and route it when the right agent conversation is ready.`
    }
  ];
}

function buildObjectionPlaybook(payload) {
  if (payload.intent === "buy") {
    return [
      {
        objection: "Rates are too high right now",
        response:
          "That is fair. We can target better-priced pockets and negotiate harder while you keep optionality. Want me to show lower-risk options first?"
      },
      {
        objection: "I am still browsing",
        response:
          "Great. I can narrow this to a shortlist that fits your budget and area so browsing becomes decision-ready."
      }
    ];
  }
  return [
    {
      objection: "I want to wait before listing",
      response:
        "Understood. We can prepare now, track local demand weekly, and launch when timing and price alignment are strongest."
    },
    {
      objection: "I am worried my price is too high",
      response:
        "Good concern. We can position with a confidence range and test buyer response early to avoid losing momentum."
    }
  ];
}

function buildBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function buildAgentUpdateUrl(req, token) {
  return `${buildBaseUrl(req)}/agent-update.html?token=${encodeURIComponent(token)}`;
}

function buildStakeholderUpdateUrl(req, token) {
  return `${buildBaseUrl(req)}/stakeholder-update.html?token=${encodeURIComponent(token)}`;
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function isAgentAccessActive(agentAccess) {
  if (!agentAccess?.token || agentAccess.revokedAt) return false;
  if (!agentAccess.expiresAt) return true;
  return new Date(agentAccess.expiresAt).getTime() > Date.now();
}

function findSessionByAgentToken(token) {
  const cleanToken = (token || "").toString().trim();
  if (!cleanToken) return null;
  for (const session of leadSessions.values()) {
    if (session.agentAccess?.token === cleanToken) return session;
  }
  return null;
}

function normalizeStakeholderRole(role) {
  const clean = (role || "").toString().trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (["finance", "originator", "bond-originator", "bondoriginator"].includes(clean)) return "bond-originator";
  return clean;
}

function isStakeholderRole(role) {
  return stakeholderRoleOptions.includes(normalizeStakeholderRole(role));
}

function ensureStakeholderAccess(session) {
  session.stakeholderAccess =
    session.stakeholderAccess && typeof session.stakeholderAccess === "object" ? session.stakeholderAccess : {};
  if (session.stakeholderAccess.finance && !session.stakeholderAccess["bond-originator"]) {
    session.stakeholderAccess["bond-originator"] = {
      ...session.stakeholderAccess.finance,
      role: "bond-originator"
    };
    delete session.stakeholderAccess.finance;
  }
  return session.stakeholderAccess;
}

function isStakeholderAccessActive(access) {
  if (!access?.token || access.revokedAt) return false;
  if (!access.expiresAt) return true;
  return new Date(access.expiresAt).getTime() > Date.now();
}

function findSessionByStakeholderToken(token) {
  const cleanToken = (token || "").toString().trim();
  if (!cleanToken) return null;
  for (const session of leadSessions.values()) {
    const accessMap = session?.stakeholderAccess || {};
    for (const role of Object.keys(accessMap)) {
      if (accessMap[role]?.token === cleanToken) {
        return { session, role: normalizeStakeholderRole(role), access: accessMap[role] };
      }
    }
  }
  return null;
}

function getSessionSlots(session) {
  const payloadSlots = createSlotsFromLeadPayload({
    intent: session?.intent,
    answers: session?.answers || [],
    additionalInfo: session?.additionalInfo || ""
  });
  const hasUsefulSlots =
    session?.slots &&
    Object.values(session.slots).some((v) => v !== null && v !== undefined && v !== "");
  if (!hasUsefulSlots) return payloadSlots;
  return {
    ...payloadSlots,
    ...Object.fromEntries(
      Object.entries(session.slots).filter(([, value]) => value !== null && value !== undefined && value !== "")
    )
  };
}

function getSessionDataClass(session) {
  const explicit = (session?.dataClass || "").toString().trim().toLowerCase();
  if (["live", "test", "draft"].includes(explicit)) return explicit;

  const slots = getSessionSlots(session);
  const testText = [
    slots.fullName,
    slots.email,
    session?.additionalInfo,
    session?.label
  ]
    .filter(Boolean)
    .join(" ");
  const obviousTest =
    /\b(test|demo|sample|persist(?:ence)?(?:\s+check)?|john\s+doe)\b/i.test(testText) ||
    /@(example|test)\.com$/i.test((slots.email || "").trim());
  if (obviousTest) return "test";

  const isConciergeDraft =
    session?.label === "Concierge Session" &&
    !session?.delivery?.attemptedAt &&
    !session?.assignedAgent?.name;
  return isConciergeDraft ? "draft" : "live";
}

function isLiveLeadSession(session) {
  return getSessionDataClass(session) === "live";
}

function getLeadDataClassSummary(sessions = Array.from(leadSessions.values())) {
  return sessions.reduce(
    (summary, session) => {
      const dataClass = getSessionDataClass(session);
      summary[dataClass] = (summary[dataClass] || 0) + 1;
      summary.total += 1;
      return summary;
    },
    { live: 0, test: 0, draft: 0, total: 0 }
  );
}

function maskLeadContact(value, kind = "text") {
  const raw = (value || "").toString().trim();
  if (!raw) return null;
  if (kind === "phone") {
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 4) return `***${digits}`;
    return `${"*".repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
  }
  if (kind === "email") {
    const parts = raw.toLowerCase().split("@");
    if (parts.length !== 2) return raw;
    const local = parts[0];
    const domain = parts[1];
    const keep = local.length <= 2 ? local[0] || "*" : local.slice(0, 2);
    return `${keep}${"*".repeat(Math.max(2, local.length - keep.length))}@${domain}`;
  }
  return raw;
}

function getSessionLeadIdentity(session) {
  const slots = getSessionSlots(session);
  const phone = cleanPhoneNumber(slots.phone || "");
  const email = cleanEmailAddress(slots.email || "");
  return {
    id: session.id || null,
    createdAt: session.createdAt || new Date().toISOString(),
    intent: slots.intent || session.intent || "unknown",
    fullName: normaliseMatchText(slots.fullName || ""),
    phone: phone || "",
    email: email || "",
    area: normaliseMatchText(slots.area || ""),
    province: normaliseMatchText(slots.province || "")
  };
}

function getLeadDedupeSignals(session, excludeSessionId = "") {
  const candidate = getSessionLeadIdentity(session);
  const now = Date.now();
  const maxAgeMs = Math.max(1, LEAD_DEDUPE_WINDOW_DAYS) * 24 * 60 * 60 * 1000;
  const matches = [];

  for (const existing of leadSessions.values()) {
    if (!existing?.id || existing.id === excludeSessionId || existing.id === candidate.id) continue;
    if (getSessionDataClass(existing) !== getSessionDataClass(session)) continue;
    const existingIdentity = getSessionLeadIdentity(existing);
    const existingCreatedMs = new Date(existingIdentity.createdAt).getTime();
    const samePhone = Boolean(candidate.phone && existingIdentity.phone && candidate.phone === existingIdentity.phone);
    const sameEmail = Boolean(candidate.email && existingIdentity.email && candidate.email === existingIdentity.email);
    const sameName = Boolean(candidate.fullName && existingIdentity.fullName && candidate.fullName === existingIdentity.fullName);
    const sameIntent = Boolean(candidate.intent && existingIdentity.intent && candidate.intent === existingIdentity.intent);
    const sameArea =
      Boolean(candidate.area && existingIdentity.area && (candidate.area.includes(existingIdentity.area) || existingIdentity.area.includes(candidate.area))) ||
      Boolean(candidate.province && existingIdentity.province && candidate.province === existingIdentity.province);

    let score = 0;
    const reasons = [];
    if (samePhone) {
      score += 70;
      reasons.push("Same WhatsApp/contact number");
    }
    if (sameEmail) {
      score += 65;
      reasons.push("Same email address");
    }
    if (sameName && sameIntent) {
      score += 20;
      reasons.push("Same client name and intent");
    } else if (sameName) {
      score += 10;
      reasons.push("Same client name");
    }
    if (sameArea && sameIntent) {
      score += 15;
      reasons.push("Same area/province and intent");
    } else if (sameArea) {
      score += 8;
      reasons.push("Same area/province");
    }
    const ageMs = Number.isFinite(existingCreatedMs) ? Math.max(0, now - existingCreatedMs) : Number.POSITIVE_INFINITY;
    if (ageMs <= maxAgeMs) {
      score += 8;
      reasons.push(`Existing lead within ${LEAD_DEDUPE_WINDOW_DAYS} days`);
    }

    if (score >= 55) {
      const slots = getSessionSlots(existing);
      matches.push({
        id: existing.id,
        score: Math.min(score, 100),
        reasons,
        createdAt: existing.createdAt || null,
        intent: slots.intent || existing.intent || "unknown",
        fullName: slots.fullName || "Not provided",
        area: [slots.area, slots.province].filter(Boolean).join(", ") || "Area not provided",
        phoneMasked: maskLeadContact(slots.phone, "phone"),
        emailMasked: maskLeadContact(slots.email, "email")
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const top = matches[0] || null;
  const confidence = top?.score || 0;
  const isDuplicate = confidence >= 65;
  const level = confidence >= 85 ? "high" : confidence >= 65 ? "medium" : "low";
  const recommendation =
    confidence >= 85
      ? "Strong duplicate signal. Consolidate follow-up before new outreach."
      : confidence >= 65
        ? "Possible duplicate. Confirm before assigning another specialist."
        : "No strong duplicate signal.";

  return {
    checkedAt: new Date().toISOString(),
    isDuplicate,
    level,
    confidence,
    recommendation,
    matchedLeadIds: matches.slice(0, 5).map((item) => item.id),
    matches: matches.slice(0, 5)
  };
}

function refreshSessionDedupeSignals(session) {
  const signals = getLeadDedupeSignals(session);
  session.duplicateSignals = signals;
  return signals;
}

function getAgentAccessSummary(session, req) {
  const access = session.agentAccess;
  if (!access) return null;
  const active = isAgentAccessActive(access);
  return {
    agentName: access.agentName || session.assignedAgent?.name || null,
    agentPhone: access.agentPhone || session.assignedAgent?.phone || null,
    agentAgency: access.agentAgency || session.assignedAgent?.agency || null,
    createdAt: access.createdAt || null,
    expiresAt: access.expiresAt || null,
    acknowledgedAt: access.acknowledgedAt || null,
    lastViewedAt: access.lastViewedAt || null,
    lastSentAt: access.lastSentAt || null,
    lastDeliveryStatus: access.lastDeliveryStatus || null,
    lastDeliveryReason: access.lastDeliveryReason || null,
    lastDeliveryRecipient: access.lastDeliveryRecipient || null,
    revokedAt: access.revokedAt || null,
    active,
    agentUrl: active && req ? buildAgentUpdateUrl(req, access.token) : null
  };
}

function buildAgentHandoffSummary(session, req = null) {
  const access = getAgentAccessSummary(session, req);
  const assignedAgent = session.assignedAgent || {};
  const deal = session.dealProtection || {};
  const proof = ensureDealProofState(session);
  const hasAssignedAgent = Boolean(assignedAgent.name || access?.agentName);
  const hasActiveLink = Boolean(access?.active);
  const hasViewed = Boolean(access?.lastViewedAt);
  const acceptedAt = access?.acknowledgedAt || proof.referralAcceptance?.acceptedAt || null;
  const contactedAt = session.agentContact?.contactedAt || null;
  const termsProtected = Boolean(
    acceptedAt &&
      (
        proof.referralAcceptance?.acceptedAt ||
        deal.referralAcknowledgement?.acknowledgedAt ||
        ["Written", "Confirmed"].includes(deal.commissionAgreement || "")
      )
  );

  const gates = [
    {
      code: "agent-acceptance",
      label: "Agent acceptance",
      complete: Boolean(acceptedAt),
      completedAt: acceptedAt,
      detail: acceptedAt ? "Agent accepted the secure introduction and referral arrangement." : "Waiting for agent acknowledgement."
    },
    {
      code: "contact-confirmation",
      label: "Contact confirmation",
      complete: Boolean(contactedAt),
      completedAt: contactedAt,
      detail: contactedAt
        ? `Client contact confirmed via ${session.agentContact?.medium || "agent update"}.`
        : "Waiting for agent to confirm first client contact."
    },
    {
      code: "referral-terms",
      label: "Referral terms",
      complete: termsProtected,
      completedAt: proof.referralAcceptance?.acceptedAt || deal.referralAcknowledgement?.acknowledgedAt || acceptedAt,
      detail: termsProtected
        ? `Terms protected${deal.commissionAgreement ? ` (${deal.commissionAgreement})` : ""}.`
        : "Referral terms still need written/confirmed protection."
    }
  ];

  let status = "not_started";
  let label = "Not introduced";
  let nextAction = "Assign an agent and create the secure introduction link.";
  if (hasAssignedAgent || hasActiveLink) {
    status = "sent";
    label = "Introduction sent";
    nextAction = "Wait for the agent to open the secure link and accept the referral arrangement.";
  }
  if (hasViewed && !acceptedAt) {
    status = "viewed";
    label = "Viewed, not accepted";
    nextAction = "Follow up with the agent to accept the referral arrangement before client work continues.";
  }
  if (acceptedAt && !contactedAt) {
    status = "accepted";
    label = "Accepted, contact pending";
    nextAction = "Ask agent to confirm first client contact and next step.";
  }
  if (acceptedAt && contactedAt && !termsProtected) {
    status = "contacted";
    label = "Contacted, terms need protection";
    nextAction = "Confirm written referral terms or upload proof before deal momentum continues.";
  }
  if (acceptedAt && contactedAt && termsProtected) {
    status = "complete";
    label = "Introduction complete";
    nextAction = "Track deal progress, commission status, and next dated check-in.";
  }
  if (access && !access.active && !acceptedAt) {
    status = "expired";
    label = "Link expired";
    nextAction = "Refresh the secure agent introduction link.";
  }

  return {
    status,
    label,
    nextAction,
    agentName: access?.agentName || assignedAgent.name || "",
    agentPhone: access?.agentPhone || assignedAgent.phone || "",
    agentAgency: access?.agentAgency || assignedAgent.agency || "",
    createdAt: access?.createdAt || assignedAgent.assignedAt || null,
    lastViewedAt: access?.lastViewedAt || null,
    acceptedAt,
    contactedAt,
    termsProtected,
    complete: gates.every((gate) => gate.complete),
    gates
  };
}

function buildCommissionLockSummary(session) {
  const handoff = buildAgentHandoffSummary(session);
  const commission = buildCommissionProtectionSummary(session);
  const coreSteps = [
    { code: "agent-acceptance", label: "Agent accepted introduction", complete: Boolean(handoff.gates?.[0]?.complete) },
    { code: "contact-confirmation", label: "Client contact confirmed", complete: Boolean(handoff.gates?.[1]?.complete) },
    { code: "referral-terms", label: "Referral terms protected", complete: Boolean(handoff.gates?.[2]?.complete) }
  ];
  const financeSteps = [
    { code: "expected-fee", label: "Expected fee captured", complete: Boolean(commission.expectedCommission) },
    {
      code: "invoice-tracked",
      label: "Invoice / payment tracked",
      complete: ["Invoiced", "Paid", "Waived"].includes(commission.payoutStatus || "")
    }
  ];
  const steps = [...coreSteps, ...financeSteps];
  const completeCore = coreSteps.filter((item) => item.complete).length;
  const completeAll = steps.filter((item) => item.complete).length;
  const locked = completeCore === coreSteps.length;
  return {
    locked,
    label: locked ? "Commission lock in place" : `${coreSteps.length - completeCore} protection gap${coreSteps.length - completeCore === 1 ? "" : "s"}`,
    completedCoreSteps: completeCore,
    coreStepCount: coreSteps.length,
    completedSteps: completeAll,
    totalSteps: steps.length,
    nextAction: locked ? commission.nextAction : handoff.nextAction || commission.nextAction,
    steps
  };
}

function getStakeholderAccessSummary(session, req) {
  const accessMap = ensureStakeholderAccess(session);
  const summary = {};
  for (const role of Object.keys(accessMap)) {
    const normalizedRole = normalizeStakeholderRole(role);
    const access = accessMap[role];
    const active = isStakeholderAccessActive(access);
    summary[normalizedRole] = {
      role: normalizedRole,
      roleLabel: stakeholderRoleLabels[normalizedRole] || normalizedRole,
      name: access?.name || "",
      phone: access?.phone || "",
      email: access?.email || "",
      createdAt: access?.createdAt || null,
      expiresAt: access?.expiresAt || null,
      lastViewedAt: access?.lastViewedAt || null,
      revokedAt: access?.revokedAt || null,
      active,
      url: active && req ? buildStakeholderUpdateUrl(req, access.token) : null
    };
  }
  return summary;
}

function normaliseMatchText(value) {
  return (value || "").toString().toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function splitMatchTerms(value) {
  return normaliseMatchText(value)
    .split(/[,;/|]+|\band\b/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeMatchTerms(current, additions) {
  const existing = new Set(splitMatchTerms(current));
  for (const item of additions) {
    const term = (item || "").toString().trim();
    const normalised = normaliseMatchText(term);
    if (term && normalised && !existing.has(normalised)) existing.add(term);
  }
  return Array.from(existing).join(", ");
}

function buildKnownAgentPool() {
  const agents = new Map();
  for (const application of agentApplications) {
    const key = `${normaliseMatchText(application.email)}:${normaliseMatchText(application.mobile)}`;
    agents.set(key, {
      source: "partner-application",
      name: application.name,
      agency: application.agency,
      phone: application.mobile,
      email: application.email,
      areas: application.areasCovered || "",
      propertyTypes: application.propertyTypes || "",
      complianceStatus: application.complianceStatus || "",
      referralPartnership: application.referralPartnership || "",
      notes: application.notes || "",
      priorAssignments: 0,
      acknowledgedCount: 0,
      buyerAssignments: 0,
      sellerAssignments: 0,
      hotLeadAssignments: 0,
      priceSampleCount: 0,
      totalLeadPrice: 0,
      minLeadPrice: null,
      maxLeadPrice: null,
      responseSampleCount: 0,
      totalResponseMinutes: 0
    });
  }

  for (const session of leadSessions.values()) {
    if (!isLiveLeadSession(session)) continue;
    const assigned = session.assignedAgent;
    if (!assigned?.name) continue;
    const slots = getSessionSlots(session);
    const key = `${normaliseMatchText(assigned.name)}:${normaliseMatchText(assigned.agency)}:${normaliseMatchText(assigned.phone)}`;
    const existing = agents.get(key) || {
      source: "handoff-history",
      name: assigned.name,
      agency: assigned.agency || "",
      phone: assigned.phone || "",
      email: "",
      areas: "",
      propertyTypes: "",
      complianceStatus: "",
      referralPartnership: session.agentAccess?.acknowledgedAt ? "Yes" : "Unknown",
      notes: "",
      priorAssignments: 0,
      acknowledgedCount: 0,
      buyerAssignments: 0,
      sellerAssignments: 0,
      hotLeadAssignments: 0,
      priceSampleCount: 0,
      totalLeadPrice: 0,
      minLeadPrice: null,
      maxLeadPrice: null,
      responseSampleCount: 0,
      totalResponseMinutes: 0
    };
    existing.priorAssignments += 1;
    if (session.agentAccess?.acknowledgedAt) existing.acknowledgedCount += 1;
    if (slots.intent === "buy") existing.buyerAssignments += 1;
    if (slots.intent === "sell") existing.sellerAssignments += 1;
    if ((session.scoring?.band || "") === "Hot") existing.hotLeadAssignments += 1;
    const leadPrice = Number(slots.priceMin || parseAmount(slots.priceDisplay || ""));
    if (Number.isFinite(leadPrice) && leadPrice > 0) {
      existing.priceSampleCount += 1;
      existing.totalLeadPrice += leadPrice;
      existing.minLeadPrice = existing.minLeadPrice === null ? leadPrice : Math.min(existing.minLeadPrice, leadPrice);
      existing.maxLeadPrice = existing.maxLeadPrice === null ? leadPrice : Math.max(existing.maxLeadPrice, leadPrice);
    }
    const assignedAt = new Date(assigned.assignedAt || session.createdAt || Date.now()).getTime();
    const contactedAt = new Date(session.agentContact?.contactedAt || "").getTime();
    if (Number.isFinite(assignedAt) && Number.isFinite(contactedAt) && contactedAt >= assignedAt) {
      const responseMinutes = Math.floor((contactedAt - assignedAt) / 60000);
      existing.responseSampleCount += 1;
      existing.totalResponseMinutes += responseMinutes;
    }
    existing.areas = mergeMatchTerms(existing.areas, [slots.area, slots.province]);
    existing.propertyTypes = mergeMatchTerms(existing.propertyTypes, [slots.propertyType]);
    agents.set(key, existing);
  }
  return Array.from(agents.values());
}

function scoreAgentMatch(agent, slots) {
  const reasons = [];
  const cautions = [];
  let score = 20;
  const areaTerms = splitMatchTerms(agent.areas);
  const typeTerms = splitMatchTerms(agent.propertyTypes);
  const leadArea = normaliseMatchText(slots.area);
  const leadProvince = normaliseMatchText(slots.province);
  const leadType = normaliseMatchText(slots.propertyType);

  if (leadArea && areaTerms.some((term) => term.includes(leadArea) || leadArea.includes(term))) {
    score += 35;
    reasons.push(`Area match: ${slots.area}`);
  } else if (leadProvince && areaTerms.some((term) => term.includes(leadProvince) || leadProvince.includes(term))) {
    score += 20;
    reasons.push(`Province/region match: ${slots.province}`);
  } else if (agent.source === "handoff-history" && agent.priorAssignments > 0) {
    score += 8;
    reasons.push("Known from previous introduction history");
  } else {
    cautions.push("No exact area match captured");
  }

  if (leadType && typeTerms.some((term) => term.includes(leadType) || leadType.includes(term))) {
    score += 18;
    reasons.push(`Property type match: ${slots.propertyType}`);
  } else if (!leadType) {
    cautions.push("Property type not captured");
  }

  if (slots.intent === "buy" && agent.buyerAssignments > 0) {
    const bonus = Math.min(10, agent.buyerAssignments * 2);
    score += bonus;
    reasons.push(`Buyer journey experience (${agent.buyerAssignments})`);
  }
  if (slots.intent === "sell" && agent.sellerAssignments > 0) {
    const bonus = Math.min(10, agent.sellerAssignments * 2);
    score += bonus;
    reasons.push(`Seller journey experience (${agent.sellerAssignments})`);
  }

  const leadPrice = Number(slots.priceMin || parseAmount(slots.priceDisplay || ""));
  if (Number.isFinite(leadPrice) && leadPrice > 0 && agent.priceSampleCount > 0) {
    const min = Number(agent.minLeadPrice || 0);
    const max = Number(agent.maxLeadPrice || 0);
    const avg = Number(agent.totalLeadPrice || 0) / agent.priceSampleCount;
    const withinLearnedBand = min > 0 && max > 0 && leadPrice >= min * 0.8 && leadPrice <= max * 1.2;
    const variance = avg > 0 ? Math.abs(leadPrice - avg) / avg : 1;
    if (withinLearnedBand) {
      score += 12;
      reasons.push("Lead price aligns with this specialist's historical range");
    } else if (variance <= 0.35) {
      score += 7;
      reasons.push("Lead price is close to this specialist's average introduction range");
    } else {
      cautions.push("Lead price is outside this specialist's typical historical range");
    }
  }

  if (/yes|open to discuss/i.test(agent.referralPartnership || "")) {
    score += 16;
    reasons.push("Open to referral partnership");
  } else {
    cautions.push("Referral partnership not confirmed");
  }

  if (/ffc|current|valid|compliant/i.test(agent.complianceStatus || "")) {
    score += 8;
    reasons.push("Compliance/FFC noted");
  } else {
    cautions.push("Compliance status needs confirmation");
  }

  if (agent.acknowledgedCount > 0) {
    score += 8;
    reasons.push("Has previously acknowledged referral terms");
  }
  if (agent.priorAssignments > 0) {
    const acknowledgementRate = agent.acknowledgedCount / agent.priorAssignments;
    if (acknowledgementRate >= 0.8) {
      score += 7;
      reasons.push("Strong referral acknowledgement reliability");
    } else if (acknowledgementRate < 0.5) {
      cautions.push("Referral acknowledgement reliability is inconsistent");
    }
  }
  if (agent.priorAssignments > 0) {
    score += Math.min(agent.priorAssignments * 2, 8);
    reasons.push(`${agent.priorAssignments} previous introduction${agent.priorAssignments === 1 ? "" : "s"}`);
  }
  if (agent.hotLeadAssignments > 0) {
    score += Math.min(agent.hotLeadAssignments, 5);
    reasons.push(`Handled ${agent.hotLeadAssignments} hot lead${agent.hotLeadAssignments === 1 ? "" : "s"}`);
  }
  if (agent.responseSampleCount > 0) {
    const avgResponseMinutes = agent.totalResponseMinutes / agent.responseSampleCount;
    if (avgResponseMinutes <= 30) {
      score += 6;
      reasons.push("Fast historical contact confirmation");
    } else if (avgResponseMinutes <= 90) {
      score += 3;
      reasons.push("Consistent historical contact confirmation");
    } else if (avgResponseMinutes > 180) {
      cautions.push("Historical contact confirmations tend to be slow");
    }
  }

  return {
    ...agent,
    score: Math.min(score, 100),
    reasons: reasons.length ? reasons : ["No strong match signals yet"],
    cautions
  };
}

function buildAgentMatchRecommendation(session) {
  const slots = getSessionSlots(session);
  const pool = buildKnownAgentPool();
  if (!pool.length) {
    return {
      available: false,
      confidence: 0,
      recommendation: "No partner experts captured yet",
      nextAction: "Ask suitable agents to apply as property experts, then use this matching engine for routing.",
      reasons: ["No agent/expert database records available"],
      cautions: ["Add partner applications to improve routing intelligence"],
      agent: null
    };
  }

  const ranked = pool
    .map((agent) => scoreAgentMatch(agent, slots))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const matchLabel = best.score >= 75 ? "Strong match" : best.score >= 50 ? "Possible match" : "Weak match";
  return {
    available: true,
    confidence: best.score,
    recommendation: `${matchLabel}: ${best.name}${best.agency ? `, ${best.agency}` : ""}`,
    nextAction:
      best.score >= 50
        ? "Review the reasons, confirm availability, then create the agent introduction."
        : "Use this as a lead, but confirm area, property type, and referral terms before introduction.",
    reasons: best.reasons,
    cautions: best.cautions,
    agent: {
      name: best.name,
      agency: best.agency,
      phone: best.phone,
      email: best.email,
      source: best.source,
      referralPartnership: best.referralPartnership,
      complianceStatus: best.complianceStatus,
      metrics: {
        priorAssignments: best.priorAssignments || 0,
        buyerAssignments: best.buyerAssignments || 0,
        sellerAssignments: best.sellerAssignments || 0,
        hotLeadAssignments: best.hotLeadAssignments || 0,
        averageResponseMinutes:
          best.responseSampleCount > 0 ? Math.round(best.totalResponseMinutes / best.responseSampleCount) : null
      }
    },
    alternatives: ranked.slice(1, 4).map((agent) => ({
      name: agent.name,
      agency: agent.agency,
      confidence: agent.score
    }))
  };
}

function minutesSince(value) {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 60000));
}

function isDateDue(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(23, 59, 59, 999);
  return due.getTime() <= Date.now();
}

function buildFollowUpIntelligence(session) {
  const lifecycle = getLeadLifecycle(session);
  const scoring = session.scoring || {};
  const deal = session.dealProtection || {};
  const assigned = session.assignedAgent || {};
  const workflow = getLeadOutcomeWorkflow(session);
  const timeline = buildTransactionTimelineSummary(session);
  const escalations = getLeadEscalationFlags(session);
  const duplicateSignals = refreshSessionDedupeSignals(session);
  const intakeIntelligence = buildLeadIntakeIntelligence(session, scoring);
  const commissionProtection = buildCommissionProtectionSummary(session);
  const createdMinutesAgo = minutesSince(session.createdAt) ?? 0;
  const assignedMinutesAgo = minutesSince(assigned.assignedAt);
  const dealUpdatedMinutesAgo = minutesSince(deal.updatedAt);
  const isClosed = ["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session);
  const isHighIntent = scoring.band === "Hot" || scoring.urgency === "High" || Number(scoring.score || 0) >= 70;
  const commissionUnprotected =
    isSessionReferred(session) &&
    !["Confirmed"].includes(deal.commissionAgreement || "") &&
    !["Closed won", "Lost"].includes(deal.status || "");
  const commissionDue =
    commissionUnprotected &&
    (isDateDue(deal.nextCheckIn) ||
      ["sale-pending", "with-agent", "with-agent-1-week", "with-agent-2-weeks", "with-agent-1-month", "with-agent-1-month-plus"].includes(lifecycle.code) ||
      ["Offer pending", "Under contract", "Disputed"].includes(deal.status || ""));

  const suggestions = [];
  const add = (label, priority, reason, detail = "", extras = {}) => {
    if (!suggestions.some((item) => item.label === label)) {
      suggestions.push({ label, priority, reason, detail, ...extras });
    }
  };

  if (isClosed) {
    return {
      primary: "No follow-up needed",
      priority: "Low",
      reason: "This lead is closed or concluded.",
      suggestions: [
        {
          label: "Archive / audit only",
          priority: "Low",
          reason: "Keep the record for commission and performance tracking.",
          detail: ""
        }
      ]
    };
  }

  if (escalations.length) {
    const topEscalation = escalations[0];
    add(
      `Resolve ${topEscalation.category} escalation`,
      topEscalation.escalationTier === "critical" ? "High" : topEscalation.priority || "High",
      topEscalation.reason || "Automatic escalation policy triggered.",
      `${topEscalation.ownerRole} owns this next move. ${topEscalation.nextAction || topEscalation.automationLabel}`,
      {
        owner: topEscalation.ownerRole,
        lane: topEscalation.workflowLane,
        actionType: topEscalation.actionType
      }
    );
  }

  if (duplicateSignals?.isDuplicate) {
    add(
      "Resolve duplicate lead",
      duplicateSignals.confidence >= 85 ? "High" : "Medium",
      duplicateSignals.recommendation || "This lead appears to duplicate an existing enquiry.",
      duplicateSignals.matchedLeadIds?.length
        ? `Possible existing lead IDs: ${duplicateSignals.matchedLeadIds.join(", ")}`
        : "Review potential duplicates before assigning another specialist.",
      {
        owner: "Concierge",
        lane: "qualification",
        actionType: "dedupe-review"
      }
    );
  }

  if (intakeIntelligence.missingCritical?.length) {
    add(
      "Complete intake before routing",
      "High",
      intakeIntelligence.summary || "Critical intake details are missing.",
      `Missing: ${intakeIntelligence.missingCritical.join(", ")}.`,
      {
        owner: "Concierge",
        lane: "qualification",
        actionType: "complete-intake"
      }
    );
  }

  if (workflow.activeTrack === "managed-transaction" && timeline.nextMilestone) {
    add(
      `Advance ${timeline.nextMilestone.label}`,
      escalations.some((item) => item.code === "delayed-transfer-escalation") ? "High" : "Medium",
      `Managed transaction lane is active. The next controlled step is ${timeline.nextMilestone.label}.`,
      `Owner: ${mapWorkflowOwnerLabel(timeline.nextMilestone.owner || workflow.primaryOwner)}.`,
      {
        owner: mapWorkflowOwnerLabel(timeline.nextMilestone.owner || workflow.primaryOwner),
        lane: workflow.queueLane,
        actionType: "advance-milestone"
      }
    );
  }

  if (workflow.activeTrack === "referral-protection" && !commissionProtection.acceptanceProtected) {
    add(
      "Lock referral proof today",
      "High",
      "Referral-only mode is active, but the proof chain for the introduction is not secure yet.",
      "Capture acceptance proof, communication evidence, and the first dated introduction update before the deal moves further.",
      {
        owner: "Concierge",
        lane: workflow.queueLane,
        actionType: "protect-referral"
      }
    );
  }

  if (commissionDue) {
    add(
      "Commission risk follow-up due",
      "High",
      deal.nextCheckIn && isDateDue(deal.nextCheckIn)
        ? "The deal-protection check-in date is due."
        : "The lead is active with an agent but referral commission protection is not confirmed.",
      "Confirm referral terms, current deal status, and whether the client is still engaged.",
      {
        owner: "Concierge",
        lane: workflow.activeTrack === "managed-transaction" ? "commission-protection" : workflow.queueLane,
        actionType: "commission-protection"
      }
    );
  }

  if (commissionProtection.overdue) {
    add(
      "Chase overdue referral payment",
      "High",
      `Referral payment is overdue${commissionProtection.daysUntilDue !== null ? ` by ${Math.abs(commissionProtection.daysUntilDue)} day${Math.abs(commissionProtection.daysUntilDue) === 1 ? "" : "s"}` : ""}.`,
      commissionProtection.payoutReference
        ? `Reference on file: ${commissionProtection.payoutReference}`
        : "Add invoice/payment reference once confirmed.",
      {
        owner: "Concierge",
        lane: "commission-protection",
        actionType: "chase-payment"
      }
    );
  } else if (commissionProtection.expectedCommission && commissionProtection.payoutStatus === "Due") {
    add(
      "Issue referral invoice",
      "High",
      `Expected referral fee is ${commissionProtection.expectedCommission}.`,
      "Move invoice/payment status to Invoiced and record the reference.",
      {
        owner: "Concierge",
        lane: "commission-protection",
        actionType: "issue-invoice"
      }
    );
  } else if (isSessionReferred(session) && !commissionProtection.expectedCommission) {
    add(
      "Calculate expected referral fee",
      "Medium",
      "Referral percentage or final sale value is not fully captured.",
      "Capture sale value, referral %, due date, and invoice/payment status.",
      {
        owner: "Concierge",
        lane: "commission-protection",
        actionType: "calculate-commission"
      }
    );
  }

  if (lifecycle.code === "new-unacknowledged" && !session.conciergeAcknowledgedAt) {
    if (isHighIntent || createdMinutesAgo > SLA_MINUTES) {
      add(
        "Call now",
        "High",
        isHighIntent ? "This lead has high intent or urgency." : `This lead has been waiting more than ${SLA_MINUTES} minutes.`,
        "Call the client or central concierge immediately before momentum drops.",
        {
          owner: "Concierge",
          lane: "rapid-response",
          actionType: "call-now"
        }
      );
    } else {
      add(
        "WhatsApp within 10 minutes",
        "High",
        "New lead has not yet been acknowledged.",
        "Send the first reassuring WhatsApp while the enquiry is still fresh.",
        {
          owner: "Concierge",
          lane: "rapid-response",
          actionType: "first-whatsapp"
        }
      );
    }
  }

  if (session.conciergeAcknowledgedAt && !isSessionReferred(session) && !session.agentContact?.contactedAt) {
    add(
      isHighIntent ? "Call now" : "WhatsApp within 10 minutes",
      isHighIntent ? "High" : "Medium",
      "The lead is acknowledged but not yet routed to a specialist.",
      "Confirm availability and choose the most suitable property specialist.",
      {
        owner: "Concierge",
        lane: "qualification",
        actionType: "route-to-specialist"
      }
    );
  }

  if (isSessionReferred(session) && !session.agentContact?.contactedAt) {
    add(
      "Ask agent to confirm contact",
      assignedMinutesAgo !== null && assignedMinutesAgo > SLA_MINUTES ? "High" : "Medium",
      assignedMinutesAgo !== null
        ? `Agent introduction happened ${assignedMinutesAgo} minute${assignedMinutesAgo === 1 ? "" : "s"} ago.`
        : "Agent introduction exists but client contact has not been confirmed.",
      "Ask the agent to confirm client contact method and time.",
      {
        owner: "Agent",
        lane: workflow.activeTrack === "managed-transaction" ? "managed-transaction" : "referral-protection",
        actionType: "confirm-client-contact"
      }
    );
  }

  if (
    session.agentContact?.contactedAt &&
    !["sale-pending", "sale-concluded", "closed"].includes(lifecycle.code) &&
    !deal.updatedAt
  ) {
    add(
      "Record outcome and next appointment",
      isHighIntent ? "High" : "Medium",
      "Client contact is confirmed, but the next commercial step is still fuzzy.",
      "Record the outcome and choose one dated next move: valuation, viewing, finance check, offer discussion, or follow-up call.",
      {
        owner: workflow.activeTrack === "managed-transaction" ? workflow.primaryOwner : "Agent",
        lane: workflow.queueLane,
        actionType: "record-outcome"
      }
    );
  }

  if (
    session.agentContact?.contactedAt &&
    !["sale-pending", "sale-concluded", "closed"].includes(lifecycle.code) &&
    deal.updatedAt &&
    !deal.nextCheckIn &&
    !["Cold", "Lost", "Closed won"].includes(deal.status || "")
  ) {
    add(
      "Set a dated next check-in",
      "Medium",
      "The lead has an active status but no dated next action.",
      "Choose the next decision point and record when the agent or concierge must act.",
      {
        owner: workflow.primaryOwner,
        lane: workflow.queueLane,
        actionType: "set-check-in"
      }
    );
  }

  if (
    session.agentContact?.contactedAt &&
    !["sale-pending", "sale-concluded", "closed"].includes(lifecycle.code) &&
    deal.updatedAt &&
    dealUpdatedMinutesAgo !== null &&
    dealUpdatedMinutesAgo >= 1440
  ) {
    add(
      "Move the next decision forward today",
      isHighIntent ? "High" : "Medium",
      "The last deal update is more than 24 hours old.",
      "Confirm the next dated step, the owner, and the blocker. Do not leave the lead in an undated active state.",
      {
        owner: workflow.primaryOwner,
        lane: workflow.queueLane,
        actionType: "move-decision-forward"
      }
    );
  }

  if (!suggestions.length) {
    add(
      "Check back in 24 hours",
      "Low",
      "No urgent issue is currently flagged.",
      "Keep a light touch so the lead does not quietly drift.",
      {
        owner: workflow.primaryOwner,
        lane: workflow.queueLane,
        actionType: "check-back"
      }
    );
  }

  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  suggestions.sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0));
  const primary = suggestions[0];

  return {
    primary: primary.label,
    priority: primary.priority,
    reason: primary.reason,
    lane: workflow.queueLane,
    suggestions
  };
}

function buildNextBestAction(session) {
  const lifecycle = getLeadLifecycle(session);
  const workflow = getLeadOutcomeWorkflow(session);
  const escalations = getLeadEscalationFlags(session);
  const duplicateSignals = refreshSessionDedupeSignals(session);
  const followUp = buildFollowUpIntelligence(session);
  const match = buildAgentMatchRecommendation(session);
  const intakeIntelligence = buildLeadIntakeIntelligence(session, session.scoring || null);
  const topSuggestion = (followUp.suggestions || [])[0] || null;
  const referred = isSessionReferred(session);

  if (workflow.activeTrack === "closed" || ["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) {
    return {
      title: "Archive and monitor",
      priority: "Low",
      owner: "Concierge",
      reason: "This lead is closed. Keep only audit and commission-tracking updates.",
      actionType: "archive",
      lane: "closure"
    };
  }

  if (escalations.length) {
    const topEscalation = escalations[0];
    return {
      title: topEscalation.nextAction || `Resolve ${topEscalation.category} escalation`,
      priority: topEscalation.escalationTier === "critical" ? "High" : topEscalation.priority || "High",
      owner: topEscalation.ownerRole || workflow.primaryOwner,
      reason: topEscalation.reason || "Automatic escalation policy triggered.",
      actionType: topEscalation.actionType || "escalation-response",
      lane: topEscalation.workflowLane || workflow.queueLane,
      escalationCode: topEscalation.code
    };
  }

  if (duplicateSignals?.isDuplicate) {
    return {
      title: "Review duplicate before new outreach",
      priority: duplicateSignals.confidence >= 85 ? "High" : "Medium",
      owner: "Concierge",
      reason: duplicateSignals.recommendation || "Potential duplicate lead detected.",
      actionType: "dedupe-review",
      lane: "qualification",
      relatedLeadIds: duplicateSignals.matchedLeadIds || []
    };
  }

  if (intakeIntelligence.missingCritical?.length) {
    return {
      title: "Complete intake before routing",
      priority: "High",
      owner: "Concierge",
      reason: intakeIntelligence.summary || "Critical intake fields are missing.",
      actionType: "complete-intake",
      lane: "qualification",
      missingCritical: intakeIntelligence.missingCritical
    };
  }

  if (
    lifecycle.code !== "new-unacknowledged" &&
    !referred &&
    match?.available &&
    match.confidence >= 60 &&
    match.agent?.name
  ) {
    return {
      title: `Assign ${match.agent.name}`,
      priority: topSuggestion?.priority || "Medium",
      owner: "Concierge",
      reason: `Routing confidence is ${match.confidence}% with matching area/type signals.`,
      actionType: "assign-recommended-agent",
      lane: workflow.queueLane,
      agent: {
        name: match.agent.name,
        agency: match.agent.agency || "",
        phone: match.agent.phone || ""
      }
    };
  }

  return {
    title: topSuggestion?.label || "Check back in 24 hours",
    priority: topSuggestion?.priority || "Low",
    owner: topSuggestion?.owner || (referred ? "Agent" : workflow.primaryOwner || "Concierge"),
    reason: topSuggestion?.reason || followUp.reason || "No urgent issue is currently flagged.",
    actionType: topSuggestion?.actionType || "follow-up",
    lane: topSuggestion?.lane || workflow.queueLane
  };
}

function addMinutesIso(value, minutes) {
  const time = value ? new Date(value).getTime() : Date.now();
  const base = Number.isFinite(time) ? time : Date.now();
  return new Date(base + minutes * 60000).toISOString();
}

function normaliseClockHour(value, fallback = 8) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.max(0, Math.min(23, Math.floor(parsed)));
  return Number.isFinite(clamped) ? clamped : fallback;
}

function canSendProactiveNow(now = new Date()) {
  const startHour = normaliseClockHour(LEAD_PROACTIVE_QUIET_START_HOUR, 8);
  const endHour = normaliseClockHour(LEAD_PROACTIVE_QUIET_END_HOUR, 19);
  if (startHour >= endHour) return true;
  const hour = now.getHours();
  return hour >= startHour && hour < endHour;
}

function getNextAllowedProactiveWindow(now = new Date()) {
  const startHour = normaliseClockHour(LEAD_PROACTIVE_QUIET_START_HOUR, 8);
  const endHour = normaliseClockHour(LEAD_PROACTIVE_QUIET_END_HOUR, 19);
  const window = new Date(now.getTime());
  if (startHour >= endHour) return window;

  if (window.getHours() < startHour) {
    window.setHours(startHour, 0, 0, 0);
    return window;
  }

  window.setHours(endHour, 0, 0, 0);
  if (window <= now) {
    window.setDate(window.getDate() + 1);
    window.setHours(startHour, 0, 0, 0);
  }
  return window;
}

function getLeadProactiveFollowupState(session) {
  const state = ensureLeadAutomationState(session);
  const proactive = state.proactiveTouches && typeof state.proactiveTouches === "object" ? state.proactiveTouches : {};
  if (!proactive.steps || typeof proactive.steps !== "object") proactive.steps = {};
  return proactive;
}

function getProactiveQuietWindowSchedule(at = new Date()) {
  const due = at instanceof Date ? at : new Date(at);
  const base = Number.isFinite(due.getTime()) ? new Date(due.getTime()) : new Date();
  if (canSendProactiveNow(base)) return base.toISOString();
  return getNextAllowedProactiveWindow(base).toISOString();
}

function getLeadProactiveLastTouchAt(proactiveState) {
  const values = [
    proactiveState.lastSentAt,
    proactiveState.lastAttemptAt,
    proactiveState.lastTouchAt
  ];
  for (const value of values) {
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

function isLeadProactiveInCooldown(proactiveState, now = new Date()) {
  const cooldownMs = Math.max(0, LEAD_PROACTIVE_COOLDOWN_HOURS) * 60 * 60 * 1000;
  if (!cooldownMs) return false;
  const lastTouchMs = getLeadProactiveLastTouchAt(proactiveState);
  if (!Number.isFinite(lastTouchMs)) return false;
  return now.getTime() - lastTouchMs < cooldownMs;
}

function getLeadProactiveCooldownReleaseIso(proactiveState) {
  const cooldownMs = Math.max(0, LEAD_PROACTIVE_COOLDOWN_HOURS) * 60 * 60 * 1000;
  if (!cooldownMs) return null;
  const lastTouchMs = getLeadProactiveLastTouchAt(proactiveState);
  if (!Number.isFinite(lastTouchMs)) return null;
  return new Date(lastTouchMs + cooldownMs).toISOString();
}

function buildLeadProactiveFollowUpTask(session, step, stepState = {}) {
  const dueAt = stepState.nextSendAt || step.dueAt;
  return {
    id: `${session.id}:proactive-${(step.code || "step").replace(/[^a-z0-9-]/gi, "-")}`,
    leadId: session.id,
    leadLabel: session.label || "Property Lead",
    leadName: getSessionSlots(session).fullName || "Name not captured",
    intent: getSessionSlots(session).intent || session.intent || "unknown",
    area: [getSessionSlots(session).area, getSessionSlots(session).province].filter(Boolean).join(", ") || "Area not captured",
    title: step.label || "Proactive follow-up",
    priority: step.priority || "Low",
    reason: step.reason || "",
    detail: step.detail || "",
    owner: step.owner || "Concierge",
    lane: step.lane || "qualification",
    actionType: step.code || "lead-proactive",
    dueAt,
    cadence: step.cadence || "Proactive follow-up",
    status: getTaskStatus(dueAt),
    createdAt: session.createdAt || null,
    proactive: true,
    proactiveState: stepState || {}
  };
}

function getLeadProactiveFollowUpTasks(session) {
  const slots = getSessionSlots(session);
  if (!session?.id) return [];
  const state = getLeadProactiveFollowupState(session);
  const plan = getLeadProactiveFollowUpPlan(session);
  return plan
    .map((step) => {
      const stepState = state.steps[step.code] || {};
      if (stepState.sentAt) return null;
      return buildLeadProactiveFollowUpTask(session, step, stepState);
    })
    .filter(Boolean);
}

function isLeadHot(session) {
  const scoring = session?.scoring || {};
  const score = Number(scoring.score);
  const urgency = (scoring.urgency || "").toString().toLowerCase();
  return scoring.band === "Hot" || urgency === "high" || (Number.isFinite(score) && score >= 78);
}

function getLeadProactiveFollowUpRecipients(session) {
  const slots = getSessionSlots(session);
  const recipients = [];
  const role = getLeadPrimaryClientRole(session);
  const cleanedPhone = cleanPhoneNumber(slots.phone || "");
  if (cleanedPhone) {
    recipients.push({
      role,
      name: sanitizeShortText(slots.fullName || stakeholderRoleLabels[role] || "Client", 120),
      phone: cleanedPhone
    });
  }
  return recipients;
}

function buildLeadProactiveFollowUpMessage(session, step) {
  const slots = getSessionSlots(session);
  const firstName = slots.fullName ? slots.fullName.split(/\s+/)[0] : "there";
  const intent = slots.intent === "sell" ? "selling" : slots.intent === "buy" ? "buying" : "property";
  const area = [slots.area, slots.province].filter(Boolean).join(", ");
  const site = area ? ` in ${area}` : "";
  const missingDocs = getMissingLeadDocumentLabels(session);

  if (step.code === "lead-proactive-ack") {
    return [
      `Hi ${firstName}, thanks for contacting Axiom Realty AI.`,
      `We have received your ${intent} request${site} and it is now logged as a live lead.`,
      "Your request is active and we are preparing the right specialist brief.",
      "Reply anytime and we can move this to your dedicated concierge."
    ].join(" ");
  }

  if (step.code === "lead-proactive-missing-docs") {
    return [
      `Hi ${firstName}, a quick follow-up on your ${intent} request${site}.`,
      missingDocs.length
        ? `To keep momentum, please share these now: ${missingDocs.slice(0, 4).join(", ")}${missingDocs.length > 4 ? " and a few other supporting docs if available" : ""}.`
        : "Please reply if you have any supporting documents from earlier you want us to review.",
      "If you need help, reply with a quick note and our concierge will guide you."
    ].join(" ");
  }

  if (step.code === "lead-proactive-status-check") {
    return [
      `Hi ${firstName}, quick update request on your ${intent} journey${site}.`,
      "Are you still actively looking for this property? We can pause here or continue to source the next best options for you.",
      "Reply with a timeframe and your preferred channel so we can keep your lead fresh."
    ].join(" ");
  }

  if (step.code === "lead-proactive-reactivation") {
    return [
      `Hi ${firstName}, we have not seen new movement on your ${intent} request${site} in a little while.`,
      "If this remains a priority, reply `KEEP ME ACTIVE` and we will reopen the lead with a fresh specialist pass.",
      "If not, just reply `NOT YET` and we can hold it and re-check later."
    ].join(" ");
  }

  return [
    `Hi ${firstName}, Axiom Realty AI follow-up for your ${intent} request${site}.`,
    "Please reply with your preference or any question and we will assist."
  ].join(" ");
}

function getLeadProactiveFollowUpPlan(session, now = new Date()) {
  if (isSessionClosed(session)) return [];
  const steps = [];
  const createdAt = session.createdAt || now.toISOString();
  const missingDocs = getMissingLeadDocumentLabels(session);

  steps.push({
    code: "lead-proactive-ack",
    label: "T+0 acknowledgement",
    actionType: "acknowledgement",
    owner: "Concierge",
    lane: "rapid-response",
    priority: "High",
    reason: "Initial acknowledgement keeps the lead warm and prevents drop-off.",
    detail: "Client confirmation and reassurance message.",
    dueAt: addMinutesIso(createdAt, Math.max(0, LEAD_PROACTIVE_ACK_DAYS) * 24 * 60),
    cadence: "T+0",
    shouldSend: true
  });

  if (missingDocs.length) {
    steps.push({
      code: "lead-proactive-missing-docs",
      label: "T+1 missing-docs nudge",
      actionType: "missing-docs",
      owner: "Concierge",
      lane: "qualification",
      priority: "Medium",
      reason: "Lead appears active but required information is still pending.",
      detail: `Missing: ${missingDocs.join(", ")}`,
      dueAt: addMinutesIso(createdAt, Math.max(0, LEAD_PROACTIVE_MISSING_DOCS_DAYS) * 24 * 60),
      cadence: "T+1",
      shouldSend: true
    });
  }

  steps.push({
    code: "lead-proactive-status-check",
    label: "T+3 status check",
    actionType: "status-check",
    owner: "Concierge",
    lane: "qualification",
    priority: "Low",
    reason: "Quick check keeps intent clear and prevents abandoned enquiries.",
    detail: "Ask for a short update and preferred next step.",
    dueAt: addMinutesIso(createdAt, Math.max(0, LEAD_PROACTIVE_STATUS_CHECK_DAYS) * 24 * 60),
    cadence: "T+3",
    shouldSend: true
  });

  if (isLeadHot(session)) {
    steps.push({
      code: "lead-proactive-reactivation",
      label: "T+7 hot lead reactivation",
      actionType: "reactivation",
      owner: "Concierge",
      lane: "qualification",
      priority: "Medium",
      reason: "High-intent leads need one extra reactivation touch at the first milestone checkpoint.",
      detail: "Capture whether lead intent is still active and continue routing with urgency.",
      dueAt: addMinutesIso(createdAt, Math.max(0, LEAD_PROACTIVE_REACTIVATION_DAYS) * 24 * 60),
      cadence: "T+7",
      shouldSend: true
    });
  }

  return steps.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

function getTaskTiming(session, label) {
  const assignedAt = session.assignedAgent?.assignedAt || session.agentAccess?.createdAt || session.updatedAt || session.createdAt;
  if (label === "Call now") return { dueAt: new Date().toISOString(), cadence: "Immediate" };
  if (label === "WhatsApp within 10 minutes") return { dueAt: addMinutesIso(session.createdAt, SLA_MINUTES), cadence: "Within 10 minutes" };
  if (label === "Ask agent to confirm contact") return { dueAt: addMinutesIso(assignedAt, SLA_MINUTES), cadence: "10 minutes after introduction" };
  if (label.startsWith("Resolve ") && label.endsWith(" escalation")) {
    return { dueAt: new Date().toISOString(), cadence: "Escalation response" };
  }
  if (label === "Check back in 24 hours") {
    const anchor = session.agentContact?.contactedAt || session.dealProtection?.updatedAt || session.updatedAt || session.createdAt;
    return { dueAt: addMinutesIso(anchor, 1440), cadence: "24-hour check-back" };
  }
  if (label.startsWith("Advance ")) {
    return { dueAt: addMinutesIso(getLatestLeadActivityAt(session) || session.updatedAt || session.createdAt, 6 * 60), cadence: "Advance next milestone" };
  }
  if (label === "Lock referral proof today") {
    return { dueAt: new Date().toISOString(), cadence: "Referral protection" };
  }
  if (label === "Record outcome and next appointment") {
    return { dueAt: addMinutesIso(session.agentContact?.contactedAt || session.updatedAt || session.createdAt, 60), cadence: "Within 1 hour of contact" };
  }
  if (label === "Set a dated next check-in") {
    return { dueAt: new Date().toISOString(), cadence: "Set before leaving lead" };
  }
  if (label === "Move the next decision forward today") {
    return { dueAt: new Date().toISOString(), cadence: "Daily conversion review" };
  }
  if (label === "Commission risk follow-up due") {
    return { dueAt: session.dealProtection?.nextCheckIn || new Date().toISOString(), cadence: "Deal-protection check" };
  }
  return { dueAt: addMinutesIso(session.updatedAt || session.createdAt, 1440), cadence: "Follow-up" };
}

function getTaskStatus(dueAt) {
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return "upcoming";
  const minutes = Math.floor((due - Date.now()) / 60000);
  if (minutes < 0) return "overdue";
  if (minutes <= 60) return "due-soon";
  return "upcoming";
}

function hasUnresolvedCommissionRisk(session) {
  if (!isSessionReferred(session)) return false;
  const terms = (session.dealProtection?.commissionAgreement || "").toLowerCase();
  return !terms || terms === "not discussed" || terms === "verbal" || terms === "disputed";
}

function latestIso(...values) {
  let best = null;
  let bestMs = -Infinity;
  for (const value of values.flat().filter(Boolean)) {
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}

function getLatestLeadActivityAt(session) {
  const proof = ensureDealProofState(session);
  const stakeholderUpdates = Array.isArray(session.stakeholderUpdates) ? session.stakeholderUpdates.map((item) => item.at) : [];
  const milestones = Array.isArray(proof.milestones) ? proof.milestones.map((item) => item.completedAt) : [];
  const documents = getLeadDocumentSummary(session).map((item) => item.uploadedAt);
  return latestIso(
    session.agentContact?.contactedAt,
    session.dealProtection?.updatedAt,
    session.lifecycleStage?.updatedAt,
    session.outcome?.updatedAt,
    proof.referralAcceptance?.acceptedAt,
    proof.commission?.updatedAt,
    stakeholderUpdates,
    milestones,
    documents,
    session.createdAt
  );
}

function getRequiredLeadDocumentLabels(session) {
  const slots = getSessionSlots(session);
  const timeline = buildTransactionTimelineSummary(session);
  const workflow = getLeadOutcomeWorkflow(session);
  const codesComplete = new Set((timeline.milestones || []).filter((item) => item.complete).map((item) => item.code));
  const status = (session.dealProtection?.status || "").toLowerCase();
  const commission = ensureDealProofState(session).commission || {};
  const required = new Set();

  if (workflow.activeTrack === "referral-protection") {
    if (isSessionReferred(session)) required.add("Referral acceptance proof");
    if (isSessionReferred(session) || session.agentContact?.contactedAt) required.add("Communication log");
    if (
      codesComplete.has("offer-received") ||
      codesComplete.has("otp-signed") ||
      status.includes("offer") ||
      status.includes("contract") ||
      ["referral_fee_due", "referral_fee_paid"].includes(workflow.commercialStatus)
    ) {
      required.add("Offer to Purchase (OTP)");
    }
    if (["Invoiced", "Paid"].includes(commission.payoutStatus || "")) required.add("Commission invoice");
    if (commission.payoutStatus === "Paid") required.add("Proof of payment");
    return Array.from(required);
  }

  if (isSessionReferred(session)) required.add("Referral acceptance proof");
  if (session.agentContact?.contactedAt || status.includes("offer") || status.includes("contract")) required.add("Communication log");
  if (codesComplete.has("offer-received") || codesComplete.has("otp-signed") || status.includes("offer") || status.includes("contract")) {
    required.add("Offer to Purchase (OTP)");
  }
  if (codesComplete.has("fica-complete")) required.add("FICA");
  if (codesComplete.has("compliance-certificates")) required.add("Certificates");
  if (codesComplete.has("compliance-certificates") || status.includes("contract")) required.add("Compliance documents");
  if (codesComplete.has("rates-clearance")) required.add("Rates clearance");
  if (codesComplete.has("transfer-documents-signed")) required.add("Transfer documents");
  if (codesComplete.has("bond-approval") || codesComplete.has("guarantees-issued") || codesComplete.has("bond-documents-signed")) {
    required.add("Bond documents");
  }
  if (
    codesComplete.has("transfer-instruction") ||
    codesComplete.has("fica-complete") ||
    codesComplete.has("compliance-certificates") ||
    codesComplete.has("rates-clearance") ||
    status.includes("contract")
  ) {
    required.add("Communication log");
  }
  if ((slots.intent || session.intent) === "sell" && (status.includes("offer") || status.includes("contract"))) {
    required.add("Compliance documents");
  }
  if (["Invoiced", "Paid"].includes(commission.payoutStatus || "")) required.add("Commission invoice");
  if (commission.payoutStatus === "Paid") {
    required.add("Proof of payment");
  }
  return Array.from(required);
}

function getMissingLeadDocumentLabels(session) {
  const required = getRequiredLeadDocumentLabels(session);
  if (!required.length) return [];
  return required.filter((label) => getLeadDocumentMatchCount(session, label) === 0);
}

function getLeadDocumentAliases(label) {
  const normalise = (value) => (value || "").toString().trim().toLowerCase();
  return [label, ...(leadDocumentCategoryAliases[label] || [])].map(normalise);
}

function leadDocumentMatchesLabel(doc, label) {
  const normalise = (value) => (value || "").toString().trim().toLowerCase();
  const haystack = [doc.category, doc.originalName, doc.note].map(normalise).join(" ");
  return getLeadDocumentAliases(label).some((alias) => alias && haystack.includes(alias));
}

function getLeadDocumentMatchCount(session, label) {
  const documents = getLeadDocumentSummary(session);
  return documents.filter((doc) => leadDocumentMatchesLabel(doc, label)).length;
}

function buildLeadDocumentVaultSummary(session) {
  const documents = getLeadDocumentSummary(session);
  const required = getRequiredLeadDocumentLabels(session);
  const missing = getMissingLeadDocumentLabels(session);
  const requiredSet = new Set(required);
  const missingSet = new Set(missing);
  const folders = leadDocumentCoreFolders.map((label) => {
    const storedCount = getLeadDocumentMatchCount(session, label);
    return {
      label,
      required: requiredSet.has(label),
      stored: storedCount > 0,
      missing: missingSet.has(label),
      count: storedCount
    };
  });
  const requiredCount = required.length;
  const missingCount = missing.length;
  const readinessPercent = requiredCount > 0 ? Math.round(((requiredCount - missingCount) / requiredCount) * 100) : documents.length ? 100 : 0;
  return {
    readinessPercent,
    requiredCount,
    missingCount,
    uploadedCount: documents.length,
    lastUploadedAt: latestIso(documents.map((item) => item.uploadedAt)),
    folders
  };
}

function ensureLeadDocumentReminderLog(session) {
  session.documentReminderLog = Array.isArray(session.documentReminderLog)
    ? session.documentReminderLog.filter((item) => item && typeof item === "object").slice(0, 50)
    : [];
  return session.documentReminderLog;
}

function buildLeadMissingDocumentMessage(session, missingDocs = []) {
  const slots = getSessionSlots(session);
  const firstName = slots.fullName ? slots.fullName.split(/\s+/)[0] : "there";
  const area = [slots.area, slots.province].filter(Boolean).join(", ");
  const timeline = buildTransactionTimelineSummary(session);
  const nextLine = timeline.nextMilestone
    ? `Next stage waiting on progress: ${timeline.nextMilestone.label}.`
    : "Your matter is active and Axiom is monitoring the next step.";
  return [
    `Hi ${firstName}, Axiom Realty AI is still waiting for these documents${area ? ` for ${area}` : ""}:`,
    missingDocs.join(", "),
    nextLine,
    "Please upload or send them so the journey can keep moving without delay."
  ].join(" ");
}

function getLeadDocumentReminderRecipients(session) {
  return getLeadStageUpdateRecipients(session, { includeAgent: true });
}

async function sendLeadRecipientMessage(recipients, message) {
  const deliveries = [];
  for (const recipient of recipients) {
    const result = await sendWhatsAppText(message, { force: true, to: recipient.phone });
    deliveries.push({
      role: recipient.role,
      name: recipient.name,
      phone: recipient.phone,
      delivered: Boolean(result?.delivered),
      status: result?.status || null,
      reason: result?.reason || null
    });
  }
  const delivered = deliveries.filter((item) => item.delivered).length;
  return {
    attempted: deliveries.length,
    delivered,
    failed: Math.max(0, deliveries.length - delivered),
    message,
    deliveries
  };
}

function summariseLeadDeliveryLog(log = [], limit = 6, mapExtra = () => ({})) {
  return log.slice(0, Math.max(1, limit)).map((item) => ({
    id: item.id,
    at: item.at || null,
    source: item.source || "",
    attempted: Number(item.attempted || 0),
    delivered: Number(item.delivered || 0),
    failed: Math.max(0, Number(item.attempted || 0) - Number(item.delivered || 0)),
    deliveries: Array.isArray(item.deliveries) ? item.deliveries.slice(0, 8) : [],
    ...mapExtra(item)
  }));
}

async function deliverMissingDocumentReminder(session, missingDocs = [], source = "document-reminder-automation") {
  const docs = Array.from(new Set((missingDocs || []).filter(Boolean)));
  if (!docs.length) {
    return { attempted: 0, delivered: 0, failed: 0, message: "", deliveries: [] };
  }

  const recipients = getLeadDocumentReminderRecipients(session);
  const message = buildLeadMissingDocumentMessage(session, docs);
  const delivery = await sendLeadRecipientMessage(recipients, message);
  const log = ensureLeadDocumentReminderLog(session);
  log.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    missingDocs: docs,
    ...delivery
  });
  session.documentReminderLog = log.slice(0, 20);

  return {
    ...delivery,
    missingDocs: docs,
  };
}

function getLeadDocumentReminderSummary(session, limit = 6) {
  const log = ensureLeadDocumentReminderLog(session);
  return summariseLeadDeliveryLog(log, limit, (item) => ({
    source: item.source || "document-reminder",
    missingDocs: Array.isArray(item.missingDocs) ? item.missingDocs.slice(0, 12) : []
  }));
}

function getTransferDelayAnchor(session) {
  const proof = ensureDealProofState(session);
  const milestones = Array.isArray(proof.milestones) ? proof.milestones : [];
  const anchorCodes = ["otp-signed", "sale-pending", "suspensive-conditions", "bond-approval", "guarantees-issued", "transfer-instruction"];
  const dates = milestones.filter((item) => anchorCodes.includes(item.code)).map((item) => item.completedAt);
  const status = (session.dealProtection?.status || "").toLowerCase();
  if (status.includes("offer") || status.includes("contract")) dates.push(session.dealProtection?.updatedAt);
  if (getLeadLifecycle(session).code === "sale-pending") dates.push(session.lifecycleStage?.updatedAt);
  return latestIso(dates);
}

function getEscalationDocumentOwner(session, missingDocuments = [], workflow = getLeadOutcomeWorkflow(session)) {
  if (!Array.isArray(missingDocuments) || !missingDocuments.length) return workflow.primaryOwner || "Concierge";
  const joined = missingDocuments.join(" ").toLowerCase();
  if (workflow.activeTrack === "referral-protection") return "Concierge";
  if (joined.includes("bond")) return "Bond originator";
  if (joined.includes("rates clearance") || joined.includes("transfer")) return "Attorney";
  if (joined.includes("compliance") || joined.includes("certificate")) return (getSessionSlots(session).intent || session.intent) === "sell" ? "Seller" : "Attorney";
  if (joined.includes("fica")) return (getSessionSlots(session).intent || session.intent) === "sell" ? "Seller" : "Buyer";
  if (joined.includes("offer to purchase") || joined.includes("otp")) return "Agent";
  return workflow.primaryOwner || "Concierge";
}

function getLeadEscalationOwnerProfile(session, flag, workflow = getLeadOutcomeWorkflow(session)) {
  const timeline = buildTransactionTimelineSummary(session);
  const defaultProfile = {
    ownerRole: workflow.primaryOwner || "Concierge",
    workflowLane: workflow.queueLane || workflow.activeTrack || "qualification",
    automationLabel: "Create a priority follow-up task and keep it in the admin queue until it is cleared.",
    responseWindow: "Immediate review",
    actionType: flag.code || "escalation-response"
  };

  switch (flag.code) {
    case "new-unacknowledged-escalation":
      return {
        ...defaultProfile,
        ownerRole: "Concierge",
        workflowLane: "rapid-response",
        automationLabel: "Pin the lead to the rapid-response queue and force first outreach logging.",
        responseWindow: `${LEAD_ACK_ESCALATION_MINUTES} minute rapid-response SLA`
      };
    case "acknowledged-no-contact-escalation":
      return {
        ...defaultProfile,
        ownerRole: "Concierge",
        workflowLane: "first-contact",
        automationLabel: "Raise the first-contact chase task until the client contact method is recorded.",
        responseWindow: `${LEAD_NO_CLIENT_CONTACT_ESCALATION_HOURS} hour contact window`
      };
    case "referred-no-contact-escalation":
      return {
        ...defaultProfile,
        ownerRole: "Agent",
        workflowLane: workflow.activeTrack === "managed-transaction" ? "managed-transaction" : "referral-protection",
        automationLabel: "Chase the receiving agent for proof of contact and next appointment.",
        responseWindow: `${LEAD_REFERRED_CONTACT_ESCALATION_HOURS} hour post-introduction window`
      };
    case "no-update-escalation":
      return {
        ...defaultProfile,
        ownerRole:
          workflow.activeTrack === "managed-transaction"
            ? mapWorkflowOwnerLabel(timeline.nextMilestone?.owner || workflow.primaryOwner)
            : isSessionReferred(session)
              ? "Agent"
              : "Concierge",
        workflowLane: workflow.activeTrack === "managed-transaction" ? "managed-transaction" : "referral-protection",
        automationLabel:
          workflow.activeTrack === "managed-transaction"
            ? "Create a dated progress-update task tied to the current transaction owner."
            : "Request a dated progress update from the receiving agent and hold the referral in view.",
        responseWindow: `${LEAD_NO_UPDATE_ESCALATION_HOURS} hour update window`
      };
    case "missing-docs-escalation":
      return {
        ...defaultProfile,
        ownerRole: getEscalationDocumentOwner(session, flag.missingDocuments, workflow),
        workflowLane: workflow.activeTrack === "managed-transaction" ? "managed-transaction" : "referral-protection",
        automationLabel:
          workflow.activeTrack === "managed-transaction"
            ? "Trigger document chase tasks for the missing evidence and keep the vault blocked until satisfied."
            : "Request only the referral-proof documents needed to protect the introduction and payout.",
        responseWindow: `${LEAD_MISSING_DOCS_ESCALATION_HOURS} hour document window`
      };
    case "delayed-transfer-escalation":
      return {
        ...defaultProfile,
        ownerRole: mapWorkflowOwnerLabel(timeline.nextMilestone?.owner || workflow.primaryOwner),
        workflowLane: "managed-transaction",
        automationLabel: "Escalate the delayed transfer milestone to the current owner and keep concierge oversight active.",
        responseWindow: `${LEAD_DELAYED_TRANSFER_ESCALATION_DAYS} day transfer window`
      };
    case "commission-risk-escalation":
      return {
        ...defaultProfile,
        ownerRole: "Concierge",
        workflowLane: workflow.activeTrack === "managed-transaction" ? "commission-protection" : "referral-protection",
        automationLabel: "Open a commission-protection chase task and hold closure until proof is on file.",
        responseWindow: `${LEAD_COMMISSION_RISK_ESCALATION_HOURS} hour commission window`
      };
    default:
      return defaultProfile;
  }
}

function getLeadEscalationTier(flag, workflow = getLeadOutcomeWorkflow(flag?.session || {})) {
  if (!flag) return "low";
  if (flag.status === "overdue" && ["delayed-transfer-escalation", "missing-docs-escalation", "commission-risk-escalation"].includes(flag.code)) {
    return workflow.activeTrack === "managed-transaction" ? "critical" : "high";
  }
  if (flag.status === "overdue") return "high";
  if (flag.status === "due-soon") return "medium";
  const priority = String(flag.priority || "High").toLowerCase();
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

function enrichLeadEscalationFlag(session, flag) {
  const workflow = getLeadOutcomeWorkflow(session);
  const ownerProfile = getLeadEscalationOwnerProfile(session, flag, workflow);
  const escalationTier = getLeadEscalationTier(flag, workflow);
  return {
    ...flag,
    ownerRole: ownerProfile.ownerRole,
    workflowLane: ownerProfile.workflowLane,
    automationLabel: ownerProfile.automationLabel,
    responseWindow: ownerProfile.responseWindow,
    actionType: ownerProfile.actionType,
    escalationTier
  };
}

function getLeadEscalationFlags(session) {
  const flags = [];
  const createdMs = new Date(session.createdAt || 0).getTime();
  const nowMs = Date.now();
  const minutesSinceCreated = Number.isFinite(createdMs) ? Math.floor((nowMs - createdMs) / 60000) : 0;
  const lifecycle = getLeadLifecycle(session);
  const isClosed = ["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session);
  const workflow = getLeadOutcomeWorkflow(session);

  if (lifecycle.code === "new-unacknowledged" && !session.conciergeAcknowledgedAt && minutesSinceCreated > LEAD_ACK_ESCALATION_MINUTES) {
    const dueAt = addMinutesIso(session.createdAt, LEAD_ACK_ESCALATION_MINUTES);
    flags.push({
      code: "new-unacknowledged-escalation",
      category: "No contact",
      title: `New / unacknowledged for more than ${LEAD_ACK_ESCALATION_MINUTES} minutes`,
      priority: "High",
      reason: "Concierge has not acknowledged this lead inside the rapid-response window.",
      nextAction: "Contact the lead immediately and record the first response attempt.",
      dueAt,
      status: getTaskStatus(dueAt)
    });
  }

  if (!isClosed && session.conciergeAcknowledgedAt && !session.agentContact?.contactedAt && !isSessionReferred(session)) {
    const dueAt = addMinutesIso(session.conciergeAcknowledgedAt, LEAD_NO_CLIENT_CONTACT_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (Number.isFinite(dueMs) && nowMs > dueMs) {
      flags.push({
        code: "acknowledged-no-contact-escalation",
        category: "No contact",
        title: `Acknowledged but no client contact for more than ${LEAD_NO_CLIENT_CONTACT_ESCALATION_HOURS} hours`,
        priority: "High",
        reason: "The concierge acknowledged the lead, but no client contact method/time has been recorded.",
        nextAction: "Contact the client or assign the responsible agent, then save the first contact note.",
        dueAt,
        status: getTaskStatus(dueAt)
      });
    }
  }

  if (isSessionReferred(session) && !session.agentContact?.contactedAt) {
    const referralAt = getSessionReferralAt(session);
    const dueAt = addMinutesIso(referralAt || session.updatedAt || session.createdAt, LEAD_REFERRED_CONTACT_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (Number.isFinite(dueMs) && nowMs > dueMs) {
      flags.push({
        code: "referred-no-contact-escalation",
        category: "No contact",
        title: `Referred with no client contact for more than ${LEAD_REFERRED_CONTACT_ESCALATION_HOURS} hours`,
        priority: "High",
        reason: "Specialist introduction exists, but no confirmed client contact has been captured.",
        nextAction: "Ask the receiving agent to confirm contact method, time, and next appointment.",
        dueAt,
        status: getTaskStatus(dueAt)
      });
    }
  }

  if (!isClosed && (isSessionReferred(session) || session.agentContact?.contactedAt)) {
    const latestActivityAt = getLatestLeadActivityAt(session);
    const dueAt = addMinutesIso(latestActivityAt || session.updatedAt || session.createdAt, LEAD_NO_UPDATE_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (Number.isFinite(dueMs) && nowMs > dueMs) {
      flags.push({
        code: "no-update-escalation",
        category: "No update",
        title: `No case update for more than ${LEAD_NO_UPDATE_ESCALATION_HOURS} hours`,
        priority: "High",
        reason: "The lead is active, but no agent/stakeholder/deal/document update has been captured inside the update window.",
        nextAction: "Ask the current owner for a dated progress update and record the blocker or next milestone.",
        dueAt,
        status: getTaskStatus(dueAt)
      });
    }
  }

  const missingDocs = getMissingLeadDocumentLabels(session);
  if (!isClosed && missingDocs.length) {
    const anchor = getTransferDelayAnchor(session) || getSessionReferralAt(session) || session.agentContact?.contactedAt || session.updatedAt || session.createdAt;
    const dueAt = addMinutesIso(anchor, LEAD_MISSING_DOCS_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (Number.isFinite(dueMs) && nowMs > dueMs) {
      flags.push({
        code: "missing-docs-escalation",
        category: "Missing docs",
        title: `Missing document evidence: ${missingDocs.join(", ")}`,
        priority: "High",
        reason: "Required proof or transaction documentation is missing for the current stage.",
        nextAction: "Request/upload the missing proof in the document vault and record who owns it.",
        dueAt,
        status: getTaskStatus(dueAt),
        missingDocuments: missingDocs
      });
    }
  }

  const timeline = buildTransactionTimelineSummary(session);
  const transferAnchor = getTransferDelayAnchor(session);
  const transferAnchorMs = transferAnchor ? new Date(transferAnchor).getTime() : NaN;
  const delayedTransfer =
    workflow.activeTrack === "managed-transaction" &&
    !isClosed &&
    transferAnchor &&
    timeline.nextMilestone &&
    !["registered", "handover-complete"].includes(timeline.currentMilestone?.code || "") &&
    Number.isFinite(transferAnchorMs) &&
    nowMs - transferAnchorMs > LEAD_DELAYED_TRANSFER_ESCALATION_DAYS * 86400000;
  if (delayedTransfer) {
    const dueAt = addMinutesIso(transferAnchor, LEAD_DELAYED_TRANSFER_ESCALATION_DAYS * 24 * 60);
    flags.push({
      code: "delayed-transfer-escalation",
      category: "Delayed transfer",
      title: `Transfer milestone delayed for more than ${LEAD_DELAYED_TRANSFER_ESCALATION_DAYS} days`,
      priority: "High",
      reason: `Current next milestone is ${timeline.nextMilestone.label}. The transaction has not moved quickly enough after the transfer/offer anchor.`,
      nextAction: `Escalate to ${timeline.nextMilestone.owner || "responsible party"} and request a dated commitment for ${timeline.nextMilestone.label}.`,
      dueAt,
      status: getTaskStatus(dueAt),
      currentMilestone: timeline.currentMilestone,
      nextMilestone: timeline.nextMilestone
    });
  }

  if (hasUnresolvedCommissionRisk(session)) {
    const anchor = getSessionReferralAt(session) || session.dealProtection?.updatedAt || session.updatedAt || session.createdAt;
    const dueAt = addMinutesIso(anchor, LEAD_COMMISSION_RISK_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (Number.isFinite(dueMs) && nowMs > dueMs) {
      flags.push({
        code: "commission-risk-escalation",
        category: "Commission protection",
        title: `Commission risk unresolved for more than ${LEAD_COMMISSION_RISK_ESCALATION_HOURS} hours`,
        priority: "High",
        reason: "Referral terms are not confirmed yet, while the lead remains commercially active.",
        nextAction: "Confirm referral terms and attach proof before the transaction advances.",
        dueAt,
        status: getTaskStatus(dueAt)
      });
    }
  }

  const tierWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  return flags
    .map((flag) => enrichLeadEscalationFlag(session, flag))
    .sort((a, b) => {
      const tierDelta = (tierWeight[b.escalationTier] || 0) - (tierWeight[a.escalationTier] || 0);
      if (tierDelta) return tierDelta;
      const dueDelta = new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime();
      if (dueDelta) return dueDelta;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
}

function buildLeadEscalationSummary(session) {
  const flags = getLeadEscalationFlags(session);
  const byCategory = {};
  const byTier = {};
  const byOwner = {};
  let oldestDueAt = null;
  let overdue = 0;
  let dueSoon = 0;
  for (const flag of flags) {
    const category = flag.category || "Escalation";
    byCategory[category] = (byCategory[category] || 0) + 1;
    const tier = flag.escalationTier || "high";
    byTier[tier] = (byTier[tier] || 0) + 1;
    const owner = flag.ownerRole || "Concierge";
    byOwner[owner] = (byOwner[owner] || 0) + 1;
    if (flag.status === "overdue") overdue += 1;
    if (flag.status === "due-soon") dueSoon += 1;
    if (flag.dueAt) {
      const dueMs = new Date(flag.dueAt).getTime();
      const oldestMs = oldestDueAt ? new Date(oldestDueAt).getTime() : Infinity;
      if (Number.isFinite(dueMs) && dueMs < oldestMs) oldestDueAt = flag.dueAt;
    }
  }
  return {
    total: flags.length,
    overdue,
    dueSoon,
    byCategory,
    byTier,
    byOwner,
    oldestDueAt,
    primaryTitle: flags[0]?.title || "",
    primaryAction: flags[0]?.nextAction || "",
    primaryOwner: flags[0]?.ownerRole || "",
    primaryAutomation: flags[0]?.automationLabel || "",
    highestTier: flags[0]?.escalationTier || "",
    categories: Object.keys(byCategory),
    owners: Object.keys(byOwner)
  };
}

function buildFollowUpTasksForSession(session) {
  const intelligence = buildFollowUpIntelligence(session);
  const workflow = getLeadOutcomeWorkflow(session);
  const slots = getSessionSlots(session);
  const deadlineTasks = buildLeadDeadlineTasks(session);
  const proactiveTasks = getLeadProactiveFollowUpTasks(session);
  const baseTasks = (intelligence.suggestions || []).map((suggestion, index) => {
    const timing = getTaskTiming(session, suggestion.label);
    return {
      id: `${session.id}:${normaliseMatchText(suggestion.label).replace(/\s+/g, "-") || index}`,
      leadId: session.id,
      leadLabel: session.label || "Property Lead",
      leadName: slots.fullName || "Name not captured",
      intent: slots.intent || session.intent || "unknown",
      area: [slots.area, slots.province].filter(Boolean).join(", ") || "Area not captured",
      title: suggestion.label,
      priority: suggestion.priority || "Low",
      reason: suggestion.reason || "",
      detail: suggestion.detail || "",
      owner: suggestion.owner || workflow.primaryOwner || (isSessionReferred(session) ? "Agent" : "Concierge"),
      lane: suggestion.lane || workflow.queueLane,
      actionType: suggestion.actionType || "follow-up",
      dueAt: timing.dueAt,
      cadence: timing.cadence,
      status: getTaskStatus(timing.dueAt),
      createdAt: session.createdAt || null
    };
  });
  const escalationTasks = getLeadEscalationFlags(session).map((flag) => ({
    id: `${session.id}:${flag.code}`,
    leadId: session.id,
    leadLabel: session.label || "Property Lead",
    leadName: slots.fullName || "Name not captured",
    intent: slots.intent || session.intent || "unknown",
    area: [slots.area, slots.province].filter(Boolean).join(", ") || "Area not captured",
    title: `Escalation: ${flag.title}`,
    priority: flag.priority || "High",
    reason: flag.reason || "",
    detail: `${flag.nextAction || "Automatic escalation policy triggered."}${flag.automationLabel ? ` ${flag.automationLabel}` : ""}`,
    owner: flag.ownerRole || workflow.primaryOwner || "Concierge",
    lane: flag.workflowLane || workflow.queueLane,
    actionType: flag.actionType || flag.code,
    dueAt: flag.dueAt,
    cadence: flag.responseWindow || "Escalation policy",
      status: flag.status || getTaskStatus(flag.dueAt),
      createdAt: session.createdAt || null
  }));
  return [...deadlineTasks, ...escalationTasks, ...baseTasks, ...proactiveTasks];
}

function getAutomatedFollowUpTasks() {
  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  const statusRank = { overdue: 3, "due-soon": 2, upcoming: 1 };
  return Array.from(leadSessions.values())
    .filter(isLiveLeadSession)
    .flatMap((session) => buildFollowUpTasksForSession(session))
    .sort((a, b) => {
      const statusDelta = (statusRank[b.status] || 0) - (statusRank[a.status] || 0);
      if (statusDelta) return statusDelta;
      const priorityDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (priorityDelta) return priorityDelta;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
}

function addDaysToIso(value, days) {
  const time = value ? new Date(value).getTime() : Date.now();
  const base = Number.isFinite(time) ? time : Date.now();
  return new Date(base + days * 86400000).toISOString();
}

function parseLeadDeadlineAt(value, { endOfDay = false } = {}) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map((item) => Number(item));
    const date = endOfDay
      ? new Date(year, month - 1, day, 17, 59, 59, 999)
      : new Date(year, month - 1, day, 9, 0, 0, 0);
    const time = date.getTime();
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function getDaysUntilIso(value) {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86400000);
}

function getLeadDeadlineState(deadlineAt) {
  const daysUntilDue = getDaysUntilIso(deadlineAt);
  if (daysUntilDue === null) return "unscheduled";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due-today";
  if (daysUntilDue <= 3) return "due-soon";
  return "scheduled";
}

function getLeadDeadlineReminderPhase(signal) {
  const daysUntilDue = signal?.daysUntilDue;
  if (daysUntilDue === null || daysUntilDue === undefined) return null;
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due-today";
  if (daysUntilDue === 1) return "1-day";
  if (daysUntilDue <= 3) return "3-day";
  if (daysUntilDue <= 7) return "7-day";
  return null;
}

function getLeadDeadlineSignals(session, { activeOnly = false } = {}) {
  const lifecycle = getLeadLifecycle(session);
  const workflow = getLeadOutcomeWorkflow(session);
  if (workflow.activeTrack === "closed" || ["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) return [];

  const caseFile = getLeadCaseFileSummary(session);
  const deal = session.dealProtection || {};
  const timeline = buildTransactionTimelineSummary(session);
  const commission = buildCommissionProtectionSummary(session);
  const signals = [];

  const addSignal = ({
    code,
    label,
    deadlineAt,
    owner,
    lane,
    priority = "Medium",
    windowDays = 1,
    cadence = "Deadline chase",
    reason = "",
    detail = "",
    includeAgent = true,
    audience = "case-team"
  }) => {
    const normalizedDeadlineAt = parseLeadDeadlineAt(deadlineAt, { endOfDay: typeof deadlineAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadlineAt.trim()) });
    if (!normalizedDeadlineAt) return;
    const daysUntilDue = getDaysUntilIso(normalizedDeadlineAt);
    const deadlineState = getLeadDeadlineState(normalizedDeadlineAt);
    const chaseStartAt = addDaysToIso(normalizedDeadlineAt, -Math.max(0, Number(windowDays || 0)));
    const active = daysUntilDue !== null && (daysUntilDue <= windowDays || daysUntilDue < 0);
    if (activeOnly && !active) return;
    signals.push({
      code,
      label,
      deadlineAt: normalizedDeadlineAt,
      chaseStartAt,
      owner: owner || workflow.primaryOwner || "Concierge",
      lane: lane || workflow.queueLane,
      priority,
      cadence,
      reason,
      detail,
      includeAgent,
      audience,
      windowDays,
      daysUntilDue,
      deadlineState,
      active,
      queueStatus: getTaskStatus(chaseStartAt)
    });
  };

  if (caseFile?.dueAt) {
    addSignal({
      code: "case-control",
      label: caseFile.nextMilestone ? `Keep ${caseFile.nextMilestone} on track` : `Keep ${caseFile.stageLabel || "case progress"} on track`,
      deadlineAt: caseFile.dueAt,
      owner: caseFile.owner || workflow.primaryOwner || "Concierge",
      lane: workflow.queueLane,
      priority: "High",
      windowDays: LEAD_DEADLINE_CHASE_CASE_WINDOW_DAYS,
      cadence: "Case control date",
      reason: "The case file already carries a dated control point.",
      detail: "Check the blocker, confirm the owner, and move the next dated step if the file has drifted."
    });
  } else if (workflow.activeTrack === "managed-transaction" && timeline.nextMilestone) {
    addSignal({
      code: "milestone-control",
      label: `Protect ${timeline.nextMilestone.label}`,
      deadlineAt: getOutcomeWorkflowDueAt(session, workflow),
      owner: mapWorkflowOwnerLabel(timeline.nextMilestone.owner || workflow.primaryOwner),
      lane: workflow.queueLane,
      priority: "High",
      windowDays: LEAD_DEADLINE_CHASE_CASE_WINDOW_DAYS,
      cadence: "Managed transaction control",
      reason: "The next transaction milestone needs a dated chase window before the file stalls.",
      detail: `Current transaction owner: ${mapWorkflowOwnerLabel(timeline.nextMilestone.owner || workflow.primaryOwner)}.`
    });
  }

  if (deal.nextCheckIn && !["Closed won", "Lost", "Cold"].includes(deal.status || "")) {
    addSignal({
      code: "deal-check-in",
      label: "Run the next deal check-in",
      deadlineAt: deal.nextCheckIn,
      owner: workflow.primaryOwner || "Concierge",
      lane: workflow.queueLane,
      priority: "High",
      windowDays: LEAD_DEADLINE_CHASE_CHECKIN_WINDOW_DAYS,
      cadence: "Deal follow-up diary",
      reason: "An agreed next check-in date exists and should be chased before it quietly slips.",
      detail: "Confirm the current deal status, next appointment, or blocker and update the case immediately."
    });
  }

  if (commission.payoutDueDate && !["Paid", "Waived"].includes(commission.payoutStatus || "")) {
    addSignal({
      code: "commission-payout",
      label: "Protect the referral payout date",
      deadlineAt: commission.payoutDueDate,
      owner: "Concierge",
      lane: "commission-protection",
      priority: commission.overdue ? "High" : commission.dueState === "due-soon" ? "High" : "Medium",
      windowDays: LEAD_DEADLINE_CHASE_COMMISSION_WINDOW_DAYS,
      cadence: "Commission collection window",
      reason: "Referral fee timing is now dated and should be chased before cashflow or proof goes stale.",
      detail: commission.expectedCommission
        ? `Expected fee: ${commission.expectedCommission}. Invoice/payment status: ${commission.payoutStatus || "Not due"}.`
        : `Invoice/payment status: ${commission.payoutStatus || "Not due"}.`,
      includeAgent: true,
      audience: "agent-only"
    });
  }

  return signals.sort((a, b) => {
    const aActive = a.active ? 1 : 0;
    const bActive = b.active ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
  });
}

function buildLeadDeadlineTasks(session) {
  const slots = getSessionSlots(session);
  return getLeadDeadlineSignals(session, { activeOnly: true }).map((signal) => ({
    id: `${session.id}:deadline:${signal.code}`,
    leadId: session.id,
    leadLabel: session.label || "Property Lead",
    leadName: slots.fullName || "Name not captured",
    intent: slots.intent || session.intent || "unknown",
    area: [slots.area, slots.province].filter(Boolean).join(", ") || "Area not captured",
    title: `Deadline chase: ${signal.label}`,
    priority: signal.priority || "Medium",
    reason: signal.reason || "A dated control point is active.",
    detail: `${signal.detail || "Keep the file moving before the deadline slips."} Deadline: ${new Date(signal.deadlineAt).toLocaleString()}. Concierge can override or move the date without freezing the file.`,
    owner: signal.owner,
    lane: signal.lane,
    actionType: "deadline-chase",
    dueAt: signal.chaseStartAt,
    deadlineAt: signal.deadlineAt,
    deadlineState: signal.deadlineState,
    cadence: signal.cadence || "Deadline chase",
    status: signal.queueStatus || getTaskStatus(signal.chaseStartAt),
    createdAt: session.createdAt || null
  }));
}

function ensureLeadDeadlineReminderLog(session) {
  session.deadlineReminderLog = Array.isArray(session.deadlineReminderLog)
    ? session.deadlineReminderLog.filter((item) => item && typeof item === "object").slice(0, 50)
    : [];
  return session.deadlineReminderLog;
}

function getLeadDeadlineReminderRecipients(session, signal) {
  const recipients = getLeadStageUpdateRecipients(session, { includeAgent: Boolean(signal?.includeAgent) });
  if ((signal?.audience || "") === "agent-only") return recipients.filter((item) => item.role === "agent");
  return recipients;
}

function buildLeadDeadlineReminderMessage(session, signal) {
  const slots = getSessionSlots(session);
  const timeline = buildTransactionTimelineSummary(session);
  const contactName = slots.fullName || stakeholderRoleLabels[getLeadPrimaryClientRole(session)] || "Client";
  const area = [slots.area, slots.province].filter(Boolean).join(", ");
  const nextStep = timeline.nextMilestone
    ? `${timeline.nextMilestone.label}${timeline.nextMilestone.owner ? ` (${timeline.nextMilestone.owner})` : ""}`
    : "registration and handover";
  const dueText = signal?.deadlineAt ? new Date(signal.deadlineAt).toLocaleString() : "soon";
  return [
    `Axiom Realty AI reminder for ${contactName}${area ? ` | ${area}` : ""}:`,
    `${signal?.label || "A dated step"} is due by ${dueText}.`,
    signal?.detail || "Please confirm the next step or blocker so the file stays active.",
    `Current owner: ${signal?.owner || "Concierge"}. Next step on file: ${nextStep}.`,
    "Axiom Concierge can still keep the case moving, adjust the date, or override the workflow while waiting for your reply."
  ]
    .filter(Boolean)
    .join(" ");
}

async function deliverLeadDeadlineReminder(session, signal, { source = "deadline-chase-automation" } = {}) {
  const recipients = getLeadDeadlineReminderRecipients(session, signal);
  const message = buildLeadDeadlineReminderMessage(session, signal);
  const delivery = await sendLeadRecipientMessage(recipients, message);
  const log = ensureLeadDeadlineReminderLog(session);
  log.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    code: signal.code || "",
    label: signal.label || "",
    note: signal.detail || "",
    deadlineAt: signal.deadlineAt || null,
    deadlineState: signal.deadlineState || "",
    phase: getLeadDeadlineReminderPhase(signal) || "",
    ...delivery
  });
  session.deadlineReminderLog = log.slice(0, 20);
  return delivery;
}

function getLeadDeadlineReminderSummary(session, limit = 6) {
  const log = ensureLeadDeadlineReminderLog(session);
  return summariseLeadDeliveryLog(log, limit, (item) => ({
    source: item.source || "deadline-chase",
    code: item.code || "",
    label: item.label || "",
    note: item.note || "",
    deadlineAt: item.deadlineAt || null,
    deadlineState: item.deadlineState || "",
    phase: item.phase || ""
  }));
}

function buildLeadDeadlineChaseSummary(session) {
  const signals = getLeadDeadlineSignals(session);
  const activeSignals = signals.filter((item) => item.active);
  const log = ensureLeadDeadlineReminderLog(session);
  const nextDueAt = signals[0]?.deadlineAt || null;
  return {
    trackedCount: signals.length,
    activeCount: activeSignals.length,
    overdueCount: activeSignals.filter((item) => item.deadlineState === "overdue").length,
    dueSoonCount: activeSignals.filter((item) => ["due-today", "due-soon"].includes(item.deadlineState)).length,
    nextDueAt,
    totalSent: log.length,
    lastSentAt: log[0]?.at || null,
    items: activeSignals.slice(0, 6)
  };
}

function buildAgentLeadSummary(session) {
  const slots = getSessionSlots(session);
  const contact = {
    name: slots.fullName || "Not provided",
    whatsapp: slots.phone || "Not provided",
    email: slots.email || "Not provided"
  };
  return {
    id: session.id,
    label: session.label || "Property Lead",
    intent: slots.intent || session.intent || "unknown",
    createdAt: session.createdAt,
    snapshot: getSessionCopilot(session).snapshot || buildSessionSnapshot(session),
    lead: {
      area: slots.area || "Not provided",
      province: slots.province || "Not provided",
      price: slots.priceDisplay || "Not provided",
      propertyType: slots.propertyType || "Not provided",
      bedrooms: slots.bedrooms || "Not provided",
      bathrooms: slots.bathrooms || "Not provided",
      timeline: slots.timeline || "Not provided",
      additionalConsiderations:
        slots.additionalConsiderations || session.additionalInfo || "None"
    },
    contact,
    assignedAgent: session.assignedAgent || null,
    agentContact: session.agentContact || null,
    agentHandoff: buildAgentHandoffSummary(session),
    dealProtection: session.dealProtection || null,
    dealProof: ensureDealProofState(session),
    leadDocuments: getLeadDocumentSummary(session),
    caseFile: getLeadCaseFileSummary(session),
    agentAccess: {
      agentName: session.agentAccess?.agentName || session.assignedAgent?.name || null,
      agentPhone: session.agentAccess?.agentPhone || session.assignedAgent?.phone || null,
      agentAgency: session.agentAccess?.agentAgency || session.assignedAgent?.agency || null,
      acknowledgedAt: session.agentAccess?.acknowledgedAt || null,
      expiresAt: session.agentAccess?.expiresAt || null
    }
  };
}

function buildStakeholderLeadSummary(session, role = "stakeholder") {
  const normalizedRole = normalizeStakeholderRole(role);
  const slots = getSessionSlots(session);
  const lifecycle = getLeadLifecycle(session);
  const transactionTimeline = buildTransactionTimelineSummary(session);
  return {
    id: session.id,
    label: session.label || "Property Lead",
    role: normalizedRole,
    roleLabel: stakeholderRoleLabels[normalizedRole] || normalizedRole,
    portalBrief: buildStakeholderPortalBrief(session, normalizedRole, transactionTimeline),
    portalPolicy: {
      advisoryOnly: true,
      conciergeOverride: true,
      note: "Updates from this portal help the file, but they never block progress. Axiom Concierge can continue, correct, or override any portal entry."
    },
    intent: slots.intent || session.intent || "unknown",
    createdAt: session.createdAt,
    snapshot: getSessionCopilot(session).snapshot || buildSessionSnapshot(session),
    lead: {
      fullName: slots.fullName || "Not provided",
      whatsapp: slots.phone || "Not provided",
      email: slots.email || "Not provided",
      area: slots.area || "Not provided",
      province: slots.province || "Not provided",
      price: slots.priceDisplay || "Not provided",
      propertyType: slots.propertyType || "Not provided",
      bedrooms: slots.bedrooms || "Not provided",
      bathrooms: slots.bathrooms || "Not provided",
      timeline: slots.timeline || "Not provided",
      additionalConsiderations:
        slots.additionalConsiderations || session.additionalInfo || "None"
    },
    lifecycle,
    caseFile: getLeadCaseFileSummary(session),
    transactionTimeline,
    assignedAgent: session.assignedAgent || null,
    agentContact: session.agentContact || null,
    dealProtection: session.dealProtection || null,
    dealProof: ensureDealProofState(session),
    leadDocuments: getLeadDocumentSummary(session),
    requiredLeadDocuments: getRequiredLeadDocumentLabels(session),
    missingLeadDocuments: getMissingLeadDocumentLabels(session),
    documentReminderLog: getLeadDocumentReminderSummary(session),
    stageUpdateNotifications: getLeadStageUpdateSummary(session),
    proofTrail: ensureLeadAuditTrail(session).slice(-20),
    stakeholderUpdates: Array.isArray(session.stakeholderUpdates) ? session.stakeholderUpdates.slice(-20) : []
  };
}

function buildStakeholderPortalBrief(session, role, transactionTimeline = null) {
  const timeline = transactionTimeline || buildTransactionTimelineSummary(session);
  const next = timeline.nextMilestone || null;
  const current = timeline.currentMilestone || null;
  const assignedAgent = session.assignedAgent || {};
  const deal = session.dealProtection || {};
  const baseNextAction = next
    ? `Next transaction step: ${next.label} (${next.owner}).`
    : "Registration and handover are complete.";
  const briefs = {
    buyer: {
      title: "Buyer Portal",
      focus: "Purchase progress, finance readiness, signing dates, and transfer visibility.",
      responsibilities: [
        "Confirm buyer details and contactability.",
        "Track bond approval, guarantees, and buyer signing requirements.",
        "Record any blockers that could delay registration."
      ],
      nextAction: baseNextAction
    },
    seller: {
      title: "Seller Portal",
      focus: "Sale progress, compliance certificates, transfer requirements, and handover readiness.",
      responsibilities: [
        "Track seller FICA, compliance certificates, and property handover requirements.",
        "Keep the seller informed about offer, transfer, and registration status.",
        "Record any seller-side risks or documents still outstanding."
      ],
      nextAction: baseNextAction
    },
    agent: {
      title: "Agent Portal",
      focus: "Client contact, offer progress, referral acceptance, and deal movement.",
      responsibilities: [
        "Confirm client contact and next appointment.",
        "Update offer/deal status so the admin system stays current.",
        "Protect the referral trail with clear milestone evidence."
      ],
      nextAction: assignedAgent.name ? `Assigned agent: ${assignedAgent.name}. ${baseNextAction}` : baseNextAction
    },
    attorney: {
      title: "Attorney Portal",
      focus: "Transfer instruction, FICA, compliance pack, lodgement, and registration.",
      responsibilities: [
        "Confirm transfer instruction and party document requirements.",
        "Update clearance, signing, lodgement, and registration milestones.",
        "Flag any legal or transfer blocker early."
      ],
      nextAction: baseNextAction
    },
    "bond-originator": {
      title: "Bond Originator Portal",
      focus: "Bond application status, approval conditions, guarantees, and finance blockers.",
      responsibilities: [
        "Update bond application and approval status.",
        "Confirm guarantee issue progress and outstanding finance conditions.",
        "Flag any buyer finance risk that could affect transfer timing."
      ],
      nextAction: deal.status === "Closed won" ? "Finance completed. Keep final proof available." : baseNextAction
    },
    concierge: {
      title: "Concierge Portal",
      focus: "Admin coordination, evidence, reminders, and escalation control.",
      responsibilities: [
        "Keep every party aligned on the current stage.",
        "Record proof, dates, and risks as the deal moves.",
        "Escalate stalled milestones before they become lost revenue."
      ],
      nextAction: baseNextAction
    }
  };
  const brief = briefs[role] || {
    title: "Stakeholder Portal",
    focus: "Shared transaction visibility and updates.",
    responsibilities: ["View the case status.", "Save clear updates.", "Keep communication auditable."],
    nextAction: baseNextAction
  };
  return {
    ...brief,
    currentMilestone: current,
    nextMilestone: next,
    progress: timeline.progress,
    status: deal.status || "Active"
  };
}

function buildAgentShareText(session, req) {
  const slots = getSessionSlots(session);
  const agentName = session.agentAccess?.agentName || session.assignedAgent?.name || "there";
  const intent = (slots.intent || session.intent || "property").toString().toUpperCase();
  const summary = [
    intent,
    slots.province || "Province not provided",
    slots.area || "Area not provided",
    slots.priceDisplay || "Price not provided",
    slots.timeline || "Timeline not provided"
  ].join(" | ");

  return [
    `Hi ${agentName}, Axiom Realty AI has a lead introduction for you.`,
    session.assignedAgent?.phone || session.agentAccess?.agentPhone ? `Agent cellphone on record: ${session.assignedAgent?.phone || session.agentAccess?.agentPhone}` : "",
    session.assignedAgent?.agency || session.agentAccess?.agentAgency ? `Agency on record: ${session.assignedAgent?.agency || session.agentAccess?.agentAgency}` : "",
    "",
    `Brief: ${summary}`,
    "",
    REFERRAL_ACKNOWLEDGEMENT_TEXT,
    "",
    "Please open this secure acknowledgement link before working the lead or contacting the client.",
    "Once accepted, the introduction is recorded and you can confirm first contact and deal progress in the same link:",
    buildAgentUpdateUrl(req, session.agentAccess.token)
  ].filter((line) => line !== "").join("\n");
}

function buildStakeholderShareText(session, req, role, access) {
  const slots = getSessionSlots(session);
  const normalizedRole = normalizeStakeholderRole(role);
  const roleLabel = stakeholderRoleLabels[normalizedRole] || "Stakeholder";
  const intent = (slots.intent || session.intent || "property").toString().toUpperCase();
  const summary = [
    intent,
    slots.province || "Province not provided",
    slots.area || "Area not provided",
    slots.priceDisplay || "Price not provided",
    slots.timeline || "Timeline not provided"
  ].join(" | ");
  return [
    `Hi ${access?.name || roleLabel},`,
    `You now have secure access to this Axiom Realty AI ${roleLabel.toLowerCase()} portal.`,
    "",
    `Lead brief: ${summary}`,
    "Use this role-specific link to view live status, transaction timeline, and progress updates:",
    buildStakeholderUpdateUrl(req, access.token)
  ].join("\n");
}

function buildDefaultStakeholderSeed(session, role) {
  const normalizedRole = normalizeStakeholderRole(role);
  const slots = getSessionSlots(session);
  if (normalizedRole === "buyer" && slots.intent === "buy") {
    return { name: slots.fullName || "Buyer", phone: cleanPhoneNumber(slots.phone || ""), email: cleanEmailAddress(slots.email || "") };
  }
  if (normalizedRole === "seller" && slots.intent === "sell") {
    return { name: slots.fullName || "Seller", phone: cleanPhoneNumber(slots.phone || ""), email: cleanEmailAddress(slots.email || "") };
  }
  if (normalizedRole === "agent") {
    return {
      name: session.assignedAgent?.name || "Agent",
      phone: cleanPhoneNumber(session.assignedAgent?.phone || ""),
      email: ""
    };
  }
  return { name: stakeholderRoleLabels[normalizedRole] || "Stakeholder", phone: "", email: "" };
}

function buildStakeholderSharePack(session, req, accessMap) {
  const roles = ["buyer", "seller", "agent", "attorney", "bond-originator"];
  const lines = [
    `Axiom Realty AI | Shared Stakeholder Portal Pack`,
    `Lead: ${session.label || "Property Lead"} (${(session.intent || "unknown").toUpperCase()})`,
    ""
  ];
  for (const role of roles) {
    const entry = accessMap[role];
    if (!entry) continue;
    const roleLabel = stakeholderRoleLabels[role] || role;
    lines.push(`${roleLabel}: ${buildStakeholderUpdateUrl(req, entry.token)}`);
  }
  lines.push("", "Please keep these links private. Each link is role-specific and auditable.");
  return lines.join("\n");
}

function getAnalyticsSummary() {
  const allSessions = Array.from(leadSessions.values());
  const sessions = allSessions.filter(isLiveLeadSession);
  const totalLeads = sessions.length;
  const intentCounts = { buy: 0, sell: 0, unknown: 0 };
  const scoreBands = { Hot: 0, Warm: 0, Cold: 0 };
  let totalScore = 0;
  let scoredLeads = 0;
  let completedSlots = 0;
  let conciergeInteractions = 0;
  let activeFollowUps = 0;
  let atRiskLeads = 0;
  let overdueLeads = 0;
  let failedDeliveries = 0;
  let protectedDeals = 0;
  let commissionAtRisk = 0;
  let escalatedLeads = 0;
  let agentAcknowledgements = 0;
  let unacknowledgedAgentLinks = 0;

  const missingFieldCounts = { intent: 0, area: 0, price: 0, timeline: 0, fullName: 0, phone: 0 };

  for (const session of sessions) {
    const intent = session.intent || "unknown";
    if (intentCounts[intent] !== undefined) intentCounts[intent] += 1;
    else intentCounts.unknown += 1;

    if (session.scoring?.band && scoreBands[session.scoring.band] !== undefined) {
      scoreBands[session.scoring.band] += 1;
    }
    if (typeof session.scoring?.score === "number") {
      scoredLeads += 1;
      totalScore += session.scoring.score;
    }

    const hasUsefulSlots =
      session.slots &&
      Object.values(session.slots).some((v) => v !== null && v !== undefined && v !== "");
    const slots = hasUsefulSlots
      ? session.slots
      : createSlotsFromLeadPayload({
          intent: session.intent,
          answers: session.answers || [],
          additionalInfo: session.additionalInfo || ""
        });
    const missing = [];
    if (!slots.intent) missing.push("intent");
    if (!slots.area) missing.push("area");
    if (!slots.priceDisplay) missing.push("price");
    if (!slots.timeline) missing.push("timeline");
    if (!slots.fullName) missing.push("fullName");
    if (!slots.phone) missing.push("phone");
    if (missing.length === 0) completedSlots += 1;
    for (const key of missing) {
      if (missingFieldCounts[key] !== undefined) missingFieldCounts[key] += 1;
    }

    const history = Array.isArray(session.chatHistory) ? session.chatHistory : [];
    conciergeInteractions += history.filter((x) => x.role === "user").length;
    if (history.length > 0) activeFollowUps += 1;

    const sla = getLeadSlaState(session);
    if (sla.state === "at-risk") atRiskLeads += 1;
    if (sla.state === "overdue") overdueLeads += 1;
    if (session.delivery && session.delivery.delivered === false) failedDeliveries += 1;
    if (session.dealProtection) {
      protectedDeals += 1;
      if (session.dealProtection.commissionAgreement !== "Confirmed") commissionAtRisk += 1;
    }
    if (getLeadEscalationFlags(session).length > 0) escalatedLeads += 1;
    if (session.agentAccess?.acknowledgedAt) agentAcknowledgements += 1;
    if (session.agentAccess && !session.agentAccess.acknowledgedAt && isAgentAccessActive(session.agentAccess)) {
      unacknowledgedAgentLinks += 1;
    }
  }

  const avgScore = scoredLeads ? Math.round((totalScore / scoredLeads) * 10) / 10 : 0;
  const completionRate = totalLeads ? Math.round((completedSlots / totalLeads) * 100) : 0;

  return {
    totalLeads,
    intentCounts,
    scoreBands,
    avgScore,
    completionRate,
    completedSlots,
    activeFollowUps,
    atRiskLeads,
    overdueLeads,
    failedDeliveries,
    protectedDeals,
    commissionAtRisk,
    escalatedLeads,
    agentAcknowledgements,
    unacknowledgedAgentLinks,
    conciergeInteractions,
    missingFieldCounts,
    conversionSprint: buildConversionSprintSummary(sessions),
    dataClasses: getLeadDataClassSummary(allSessions),
    lastUpdated: new Date().toISOString()
  };
}

function getSessionReferralAt(session) {
  return session.assignedAgent?.assignedAt || session.agentAccess?.createdAt || session.agentAccess?.acknowledgedAt || null;
}

function getSessionClosedWonAt(session) {
  const dealStatus = (session.dealProtection?.status || "").toLowerCase();
  if (dealStatus === "closed won") return session.dealProtection?.updatedAt || session.updatedAt || null;
  if (getLeadLifecycle(session).code === "sale-concluded") {
    return session.lifecycleStage?.updatedAt || session.updatedAt || null;
  }
  return null;
}

function getAcquisitionSourceLabel(session) {
  const source = sanitizeShortText(session.acquisition?.source, 100);
  if (source) return source;
  const referrer = sanitizeShortText(session.acquisition?.referrer, 500);
  if (referrer) {
    try {
      return new URL(referrer).hostname.replace(/^www\./i, "") || "Referral";
    } catch {
      return "Referral";
    }
  }
  return "Direct / unknown";
}

function buildConversionSprintSummary(sessions = Array.from(leadSessions.values())) {
  const days = 7;
  const since = Date.now() - days * 86400000;
  const isRecent = (value) => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) && time >= since;
  };
  const recentLeads = sessions.filter((session) => isRecent(session.createdAt));
  const referredSessions = sessions.filter((session) => isRecent(getSessionReferralAt(session)));
  const closedSessions = sessions.filter((session) => isRecent(getSessionClosedWonAt(session)));
  const contactedSessions = sessions.filter((session) => isRecent(session.agentContact?.contactedAt));
  const unreferredRecent = recentLeads.filter((session) => !isSessionReferred(session));
  const referredWithoutContact = referredSessions.filter((session) => !session.agentContact?.contactedAt);
  const sourceMap = new Map();
  recentLeads.forEach((session) => {
    const label = getAcquisitionSourceLabel(session);
    sourceMap.set(label, (sourceMap.get(label) || 0) + 1);
  });
  const sources = Array.from(sourceMap.entries())
    .map(([source, leads]) => ({ source, leads }))
    .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source))
    .slice(0, 6);

  let recommendedFocus = "Keep every active referral attached to one dated decision and one accountable owner.";
  if (!recentLeads.length) {
    recommendedFocus = "Launch one trackable campaign link today. The first decision is not prediction; it is creating a measurable stream of real enquiries.";
  } else if (unreferredRecent.length) {
    recommendedFocus = `Package and refer ${unreferredRecent.length} unassigned lead${unreferredRecent.length === 1 ? "" : "s"} today. Contact while intent is fresh, then choose the best-fit specialist.`;
  } else if (referredWithoutContact.length) {
    recommendedFocus = `Chase contact confirmation on ${referredWithoutContact.length} referred lead${referredWithoutContact.length === 1 ? "" : "s"}. A referral is not complete until the specialist records client contact.`;
  } else if (closedSessions.length < 2) {
    recommendedFocus = "Review active referred leads and replace vague status labels with a dated next decision: valuation, viewing, finance check, offer discussion, or follow-up call.";
  } else if (referredSessions.length < 6) {
    recommendedFocus = `The closure target is moving. Attract and refer ${6 - referredSessions.length} more qualified lead${6 - referredSessions.length === 1 ? "" : "s"} to complete the sprint.`;
  } else {
    recommendedFocus = "Sprint target achieved. Review which sources and actions created the two wins, then repeat the strongest pattern.";
  }

  return {
    days,
    targets: { referrals: 6, closures: 2 },
    newLeads: recentLeads.length,
    referred: referredSessions.length,
    closedWon: closedSessions.length,
    contacted: contactedSessions.length,
    unreferred: unreferredRecent.length,
    referredWithoutContact: referredWithoutContact.length,
    sources,
    recommendedFocus,
    startedAt: new Date(since).toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getLocalDayWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
    localDateLabel: start.toLocaleDateString()
  };
}

function isIsoInRange(value, startMs, endMs) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) && time >= startMs && time < endMs;
}

function getLeadFirstActionAt(session) {
  const points = [
    session.conciergeAcknowledgedAt,
    session.firstContactAt,
    getSessionReferralAt(session),
    session.autoAcknowledgement?.recordedAt
  ]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  return points.length ? new Date(points[0]).toISOString() : null;
}

function csvCell(value) {
  const text = (value === null || value === undefined ? "" : String(value)).replace(/"/g, "\"\"");
  return `"${text}"`;
}

function buildConciergeDailyReport() {
  const windows = getLocalDayWindow();
  const sessions = Array.from(leadSessions.values()).filter(isLiveLeadSession);
  const todaysLeads = sessions.filter((session) => isIsoInRange(session.createdAt, windows.startMs, windows.endMs));

  let slaMetToday = 0;
  for (const session of todaysLeads) {
    const createdMs = new Date(session.createdAt || 0).getTime();
    const firstAction = getLeadFirstActionAt(session);
    const firstActionMs = firstAction ? new Date(firstAction).getTime() : NaN;
    if (Number.isFinite(createdMs) && Number.isFinite(firstActionMs) && firstActionMs - createdMs <= SLA_MINUTES * 60000) {
      slaMetToday += 1;
    }
  }

  const referredToday = sessions.filter((session) => isIsoInRange(getSessionReferralAt(session), windows.startMs, windows.endMs)).length;
  const contactedToday = sessions.filter((session) => isIsoInRange(session.agentContact?.contactedAt, windows.startMs, windows.endMs)).length;
  const closedWonToday = sessions.filter((session) => isIsoInRange(getSessionClosedWonAt(session), windows.startMs, windows.endMs)).length;
  const escalationLeadsOpen = sessions.filter((session) => getLeadEscalationFlags(session).length > 0).length;
  const commissionRiskOpen = sessions.filter((session) => !isSessionClosed(session) && hasUnresolvedCommissionRisk(session)).length;

  const rows = sessions.map((session) => {
    const slots = getSessionSlots(session);
    const lifecycle = getLeadLifecycle(session);
    const escalationFlags = getLeadEscalationFlags(session);
    return {
      leadId: session.id,
      createdAt: session.createdAt || "",
      intent: (slots.intent || session.intent || "unknown").toUpperCase(),
      leadName: slots.fullName || "",
      area: [slots.area, slots.province].filter(Boolean).join(", "),
      stage: lifecycle.label || "",
      referred: isSessionReferred(session) ? "Yes" : "No",
      contactConfirmed: session.agentContact?.contactedAt ? "Yes" : "No",
      commissionAgreement: session.dealProtection?.commissionAgreement || "Not discussed",
      commissionRisk: !isSessionClosed(session) && hasUnresolvedCommissionRisk(session) ? "Yes" : "No",
      escalationCount: escalationFlags.length,
      nextBestAction: buildNextBestAction(session)?.title || ""
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    newLeadsToday: todaysLeads.length,
    slaMetToday,
    escalationLeadsOpen,
    commissionRiskOpen,
    referredToday,
    contactedToday,
    closedWonToday,
    activeLiveLeads: sessions.length
  };

  return { windows, summary, rows };
}

function buildConciergeDailyReportCsv(report) {
  const headers = [
    "lead_id",
    "created_at",
    "intent",
    "lead_name",
    "area",
    "stage",
    "referred",
    "contact_confirmed",
    "commission_agreement",
    "commission_risk",
    "escalation_count",
    "next_best_action"
  ];
  const lines = [];
  lines.push(["report_date", report.windows.localDateLabel].map(csvCell).join(","));
  lines.push(["generated_at", report.summary.generatedAt].map(csvCell).join(","));
  lines.push(["new_leads_today", report.summary.newLeadsToday].map(csvCell).join(","));
  lines.push(["sla_met_today", report.summary.slaMetToday].map(csvCell).join(","));
  lines.push(["escalation_leads_open", report.summary.escalationLeadsOpen].map(csvCell).join(","));
  lines.push(["commission_risk_open", report.summary.commissionRiskOpen].map(csvCell).join(","));
  lines.push(["referred_today", report.summary.referredToday].map(csvCell).join(","));
  lines.push(["contacted_today", report.summary.contactedToday].map(csvCell).join(","));
  lines.push(["closed_won_today", report.summary.closedWonToday].map(csvCell).join(","));
  lines.push(["active_live_leads", report.summary.activeLiveLeads].map(csvCell).join(","));
  lines.push("");
  lines.push(headers.map(csvCell).join(","));
  for (const row of report.rows) {
    lines.push(
      [
        row.leadId,
        row.createdAt,
        row.intent,
        row.leadName,
        row.area,
        row.stage,
        row.referred,
        row.contactConfirmed,
        row.commissionAgreement,
        row.commissionRisk,
        row.escalationCount,
        row.nextBestAction
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}

function getLocalDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildConciergeDailyDigestMessage(report) {
  const summary = report.summary || {};
  const windows = report.windows || {};
  return [
    `Axiom Concierge Daily Digest (${windows.localDateLabel || getLocalDayKey()})`,
    "",
    "Control snapshot:",
    `- New leads today: ${summary.newLeadsToday || 0}`,
    `- SLA met today: ${summary.slaMetToday || 0}/${summary.newLeadsToday || 0}`,
    `- Escalations open: ${summary.escalationLeadsOpen || 0}`,
    `- Commission risk open: ${summary.commissionRiskOpen || 0}`,
    `- Referred today: ${summary.referredToday || 0}`,
    `- Contacted today: ${summary.contactedToday || 0}`,
    `- Closed won today: ${summary.closedWonToday || 0}`,
    `- Active live leads: ${summary.activeLiveLeads || 0}`,
    "",
    "Action now:",
    "- Clear escalations first",
    "- Lock commission terms on active referred leads",
    "- Ensure every active lead has one dated next step"
  ].join("\n");
}

async function runLeadProactiveFollowUpAutomation() {
  if (!AUTO_LEAD_AUTOMATION_ENABLED) {
    return {
      inspected: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      skippedNoRecipient: 0,
      cooldownBlocks: 0,
      quietDeferrals: 0,
      changed: false
    };
  }

  let inspected = 0;
  let queued = 0;
  let sent = 0;
  let delivered = 0;
  let failed = 0;
  let skippedNoRecipient = 0;
  let cooldownBlocks = 0;
  let quietDeferrals = 0;
  let changed = false;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const session of Array.from(leadSessions.values()).filter(isLiveLeadSession)) {
    inspected += 1;
    const lifecycle = getLeadLifecycle(session);
    if (["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) continue;

    const recipients = getLeadProactiveFollowUpRecipients(session);
    const plan = getLeadProactiveFollowUpPlan(session, now);
    const proactive = getLeadProactiveFollowupState(session);
    const stepStateMap = proactive.steps || {};
    const availablePlanCodes = new Set(plan.map((step) => step.code));
    let sessionChanged = false;

    if (!plan.length) {
      if (Object.keys(stepStateMap).length) {
        proactive.steps = {};
        sessionChanged = true;
        leadSessions.set(session.id, session);
        changed = true;
      }
      continue;
    }

    for (const existingCode of Object.keys(stepStateMap)) {
      if (!availablePlanCodes.has(existingCode)) {
        delete stepStateMap[existingCode];
        sessionChanged = true;
      }
    }

    for (const step of plan) {
      const code = String(step.code || "");
      if (!code) continue;
      const prior = stepStateMap[code] || {};
      if (prior.sentAt) continue;

      const plannedDueAt = new Date(step.dueAt);
      if (!Number.isFinite(plannedDueAt.getTime())) continue;

      const nextSendAt = getProactiveQuietWindowSchedule(plannedDueAt);
      const nextSendMs = new Date(nextSendAt).getTime();
      prior.plannedDueAt = step.dueAt;
      prior.actionType = step.code;
      prior.priority = step.priority || "Low";
      prior.cadence = step.cadence || "Proactive follow-up";
      prior.label = step.label || "Proactive follow-up";

      if (nextSendMs > now.getTime()) {
        prior.nextSendAt = nextSendAt;
        prior.deferredReason = "quiet-window";
        quietDeferrals += 1;
        stepStateMap[code] = prior;
        sessionChanged = true;
        continue;
      }

      if (!recipients.length) {
        prior.nextSendAt = nextSendAt;
        prior.deferredReason = "missing-recipient";
        skippedNoRecipient += 1;
        stepStateMap[code] = prior;
        sessionChanged = true;
        continue;
      }

      const inCooldown = isLeadProactiveInCooldown(proactive, now);
      const releaseAt = inCooldown ? getLeadProactiveCooldownReleaseIso(proactive) : null;
      if (inCooldown) {
        prior.nextSendAt = releaseAt || nowIso;
        prior.deferredReason = "cooldown";
        cooldownBlocks += 1;
        stepStateMap[code] = prior;
        sessionChanged = true;
        continue;
      }

      const message = buildLeadProactiveFollowUpMessage(session, step);
      const delivery = await sendLeadRecipientMessage(recipients, message);
      prior.attemptedAt = nowIso;
      prior.sentAt = nowIso;
      prior.nextSendAt = null;
      prior.deferredReason = null;
      prior.delivered = delivery.delivered;
      prior.failed = delivery.failed;
      prior.message = message;
      prior.attempts = (Number(prior.attempts) || 0) + 1;
      stepStateMap[code] = prior;
      proactive.lastAttemptAt = nowIso;
      proactive.lastSentAt = nowIso;
      proactive.lastTouchAt = nowIso;
      const attemptCount = Number(delivery.attempted || 0);
      const deliveredCount = Number(delivery.delivered || 0);
      const failedCount = Number(delivery.failed || 0);
      queued += 1;
      sent += 1;
      delivered += deliveredCount;
      failed += failedCount;
      if (attemptCount) {
        sessionChanged = true;
      }
      appendLeadAuditEvent(session, {
        type: "proactive-followup",
        actor: "System",
        source: "automation",
        summary: step.label || "Proactive follow-up touch",
        details: `${deliveredCount}/${attemptCount} delivered to ${recipients.length} recipient(s)`
      });
      session.updatedAt = nowIso;
    }

    proactive.steps = stepStateMap;
    if (sessionChanged) {
      leadSessions.set(session.id, session);
      changed = true;
    }
  }

  if (changed) persistSessions();
  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastLeadProactiveAutomationRunAt: nowIso,
    lastLeadProactiveAutomationSummary: {
      inspected,
      queued,
      sent,
      delivered,
      failed,
      skippedNoRecipient,
      cooldownBlocks,
      quietDeferrals
    }
  };
  persistOperations();
  return {
    inspected,
    queued,
    sent,
    delivered,
    failed,
    skippedNoRecipient,
    cooldownBlocks,
    quietDeferrals,
    changed
  };
}

function runLeadEscalationAutomationSweep() {
  if (!AUTO_LEAD_AUTOMATION_ENABLED) return { inspected: 0, opened: 0, cleared: 0, active: 0, changed: false };
  let inspected = 0;
  let opened = 0;
  let cleared = 0;
  let active = 0;
  let changed = false;
  const nowIso = new Date().toISOString();

  for (const session of Array.from(leadSessions.values()).filter(isLiveLeadSession)) {
    inspected += 1;
    let sessionChanged = false;
    const flags = getLeadEscalationFlags(session);
    const state = ensureLeadAutomationState(session);
    const openEscalations = state.openEscalations || {};
    const currentCodes = new Set(flags.map((flag) => flag.code));
    if (flags.length > 0) active += 1;

    for (const flag of flags) {
      if (!openEscalations[flag.code]) {
        openEscalations[flag.code] = {
          openedAt: nowIso,
          category: flag.category || "Escalation",
          title: flag.title,
          dueAt: flag.dueAt || null,
          nextAction: flag.nextAction || ""
        };
        appendLeadAuditEvent(session, {
          type: "escalation-opened",
          actor: "System",
          source: "automation",
          summary: flag.title || "Escalation opened",
          details: flag.reason || "Automatic escalation rule triggered."
        });
        opened += 1;
        changed = true;
        sessionChanged = true;
      }
    }

    for (const code of Object.keys(openEscalations)) {
      if (!currentCodes.has(code)) {
        const prior = openEscalations[code];
        appendLeadAuditEvent(session, {
          type: "escalation-cleared",
          actor: "System",
          source: "automation",
          summary: prior?.title || "Escalation cleared",
          details: "Automatic rule no longer triggered."
        });
        delete openEscalations[code];
        cleared += 1;
        changed = true;
        sessionChanged = true;
      }
    }

    state.openEscalations = openEscalations;
    if (sessionChanged) {
      session.updatedAt = nowIso;
      leadSessions.set(session.id, session);
    }
  }

  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastLeadAutomationRunAt: nowIso,
    lastLeadAutomationSummary: { inspected, opened, cleared, active }
  };
  persistOperations();
  if (changed) persistSessions();
  return { inspected, opened, cleared, active, changed };
}

async function runLeadMissingDocumentAutomation() {
  if (!AUTO_LEAD_AUTOMATION_ENABLED) {
    return { inspected: 0, queued: 0, delivered: 0, failed: 0, changed: false };
  }

  let inspected = 0;
  let queued = 0;
  let delivered = 0;
  let failed = 0;
  let changed = false;
  const nowIso = new Date().toISOString();
  const todayKey = getLocalDayKey();

  for (const session of Array.from(leadSessions.values()).filter(isLiveLeadSession)) {
    inspected += 1;
    const lifecycle = getLeadLifecycle(session);
    if (["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) continue;

    const missingDocs = getMissingLeadDocumentLabels(session);
    const state = ensureLeadAutomationState(session);
    const reminderState = state.documentReminders || {};
    const signature = missingDocs.slice().sort().join("|");
    const reminderKey = `missing-docs:${signature}`;

    if (!missingDocs.length) {
      if (Object.keys(reminderState).length) {
        state.documentReminders = {};
        session.updatedAt = nowIso;
        leadSessions.set(session.id, session);
        changed = true;
      }
      continue;
    }

    const anchor = getTransferDelayAnchor(session) || getSessionReferralAt(session) || session.agentContact?.contactedAt || session.updatedAt || session.createdAt;
    const dueAt = addMinutesIso(anchor, LEAD_MISSING_DOCS_ESCALATION_HOURS * 60);
    const dueMs = new Date(dueAt).getTime();
    if (!Number.isFinite(dueMs) || Date.now() < dueMs) continue;

    const prior = reminderState[reminderKey];
    if (prior?.dayKey === todayKey) continue;

    const result = await deliverMissingDocumentReminder(session, missingDocs);
    reminderState[reminderKey] = {
      dayKey: todayKey,
      missingDocs,
      attemptedAt: nowIso,
      delivered: result.delivered,
      failed: result.failed
    };
    state.documentReminders = reminderState;
    appendLeadAuditEvent(session, {
      type: "missing-docs-reminder",
      actor: "System",
      source: "automation",
      summary: `Missing document reminder sent for ${missingDocs.join(", ")}`,
      details: `${result.delivered}/${result.attempted} delivered`
    });
    session.updatedAt = nowIso;
    leadSessions.set(session.id, session);
    queued += 1;
    delivered += Number(result.delivered || 0);
    failed += Number(result.failed || 0);
    changed = true;
  }

  if (changed) persistSessions();
  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastLeadDocumentReminderRunAt: nowIso,
    lastLeadDocumentReminderSummary: { inspected, queued, delivered, failed }
  };
  persistOperations();
  return { inspected, queued, delivered, failed, changed };
}

async function runLeadDeadlineAutomation() {
  if (!AUTO_LEAD_AUTOMATION_ENABLED) {
    return { inspected: 0, active: 0, queued: 0, delivered: 0, failed: 0, changed: false };
  }

  let inspected = 0;
  let active = 0;
  let queued = 0;
  let delivered = 0;
  let failed = 0;
  let changed = false;
  const nowIso = new Date().toISOString();
  const todayKey = getLocalDayKey();

  for (const session of Array.from(leadSessions.values()).filter(isLiveLeadSession)) {
    inspected += 1;
    const lifecycle = getLeadLifecycle(session);
    if (["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) continue;

    const state = ensureLeadAutomationState(session);
    const chaseState = state.deadlineChase || {};
    const signals = getLeadDeadlineSignals(session);
    const activeSignals = signals.filter((item) => item.active);
    const activeBases = new Set(signals.map((item) => `${item.code}|${item.deadlineAt}`));
    let sessionChanged = false;

    for (const key of Object.keys(chaseState)) {
      const [code = "", deadlineAt = ""] = key.split("|");
      if (!activeBases.has(`${code}|${deadlineAt}`)) {
        delete chaseState[key];
        sessionChanged = true;
        changed = true;
      }
    }

    active += activeSignals.length;
    for (const signal of activeSignals) {
      const phase = getLeadDeadlineReminderPhase(signal);
      if (!phase) continue;

      const stateKey = `${signal.code}|${signal.deadlineAt}|${phase}`;
      const prior = chaseState[stateKey];
      if (prior?.dayKey === todayKey) continue;

      const result = await deliverLeadDeadlineReminder(session, signal);
      chaseState[stateKey] = {
        dayKey: todayKey,
        phase,
        attemptedAt: nowIso,
        delivered: result.delivered,
        failed: result.failed,
        deadlineAt: signal.deadlineAt
      };
      appendLeadAuditEvent(session, {
        type: "deadline-chase-reminder",
        actor: "System",
        source: "automation",
        summary: `Deadline chase reminder: ${signal.label}`,
        details: `${result.delivered}/${result.attempted} delivered | Due ${signal.deadlineAt}`
      });
      queued += 1;
      delivered += Number(result.delivered || 0);
      failed += Number(result.failed || 0);
      sessionChanged = true;
      changed = true;
    }

    state.deadlineChase = chaseState;
    if (sessionChanged) {
      session.updatedAt = nowIso;
      leadSessions.set(session.id, session);
    }
  }

  if (changed) persistSessions();
  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastLeadDeadlineAutomationRunAt: nowIso,
    lastLeadDeadlineAutomationSummary: { inspected, active, queued, delivered, failed }
  };
  persistOperations();
  return { inspected, active, queued, delivered, failed, changed };
}

async function runLeadWowAutomation() {
  if (!AUTO_LEAD_AUTOMATION_ENABLED) {
    return { inspected: 0, queued: 0, delivered: 0, failed: 0, changed: false };
  }

  let inspected = 0;
  let queued = 0;
  let delivered = 0;
  let failed = 0;
  let changed = false;
  const now = new Date();
  const nowIso = now.toISOString();
  const todayKey = getLocalDayKey(now);

  for (const session of Array.from(leadSessions.values()).filter(isLiveLeadSession)) {
    inspected += 1;
    const lifecycle = getLeadLifecycle(session);
    if (["sale-concluded", "closed"].includes(lifecycle.code) || isSessionClosed(session)) continue;

    const timeline = buildTransactionTimelineSummary(session);
    const latestActivityAt = getLatestLeadActivityAt(session) || session.updatedAt || session.createdAt;
    const latestActivityMs = new Date(latestActivityAt).getTime();
    const hoursSinceActivity = Number.isFinite(latestActivityMs) ? (Date.now() - latestActivityMs) / 3600000 : 0;
    const missingDocs = getMissingLeadDocumentLabels(session);
    const state = ensureLeadAutomationState(session);
    const wowState = state.wowTouches || {};
    let candidate = null;

    if (
      missingDocs.length &&
      hoursSinceActivity < LEAD_MISSING_DOCS_ESCALATION_HOURS &&
      !wowState[`document-readiness:${todayKey}:${missingDocs.slice().sort().join("|")}`]
    ) {
      candidate = {
        key: `document-readiness:${todayKey}:${missingDocs.slice().sort().join("|")}`,
        type: "document-readiness",
        note: `Current missing items: ${missingDocs.join(", ")}`,
        includeAgent: true
      };
    } else if (
      hoursSinceActivity >= Math.max(12, Math.floor(LEAD_NO_UPDATE_ESCALATION_HOURS / 2)) &&
      hoursSinceActivity < LEAD_NO_UPDATE_ESCALATION_HOURS &&
      !wowState[`silence-watchdog:${todayKey}`]
    ) {
      candidate = {
        key: `silence-watchdog:${todayKey}`,
        type: "silence-watchdog",
        note: `Last visible update was ${Math.floor(hoursSinceActivity)} hours ago.`,
        includeAgent: false
      };
    } else if (
      timeline.nextMilestone &&
      /finance|attorney|transfer|registration/i.test(`${timeline.nextMilestone.owner || ""} ${timeline.nextMilestone.phase || ""}`) &&
      !wowState[`partner-readiness:${todayKey}:${timeline.nextMilestone.code}`]
    ) {
      candidate = {
        key: `partner-readiness:${todayKey}:${timeline.nextMilestone.code}`,
        type: "partner-readiness",
        note: `Next milestone owner: ${timeline.nextMilestone.owner || "Assigned partner"}.`,
        includeAgent: true
      };
    } else if (
      timeline.nextMilestone &&
      (isSessionReferred(session) || session.agentContact?.contactedAt || timeline.completedCount > 0) &&
      !wowState[`next-step-brief:${todayKey}:${timeline.nextMilestone.code}`]
    ) {
      candidate = {
        key: `next-step-brief:${todayKey}:${timeline.nextMilestone.code}`,
        type: "next-step-brief",
        note: "",
        includeAgent: false
      };
    }

    if (!candidate) continue;

    const result = await deliverLeadWowAutomationTouch(session, candidate);
    wowState[candidate.key] = {
      dayKey: todayKey,
      type: candidate.type,
      attemptedAt: nowIso,
      delivered: result.delivered,
      failed: result.failed
    };
    state.wowTouches = wowState;
    appendLeadAuditEvent(session, {
      type: "wow-automation-touch",
      actor: "System",
      source: "automation",
      summary: `${getLeadWowAutomationLabel(candidate.type)} sent`,
      details: `${result.delivered}/${result.attempted} delivered`
    });
    session.updatedAt = nowIso;
    leadSessions.set(session.id, session);
    queued += 1;
    delivered += Number(result.delivered || 0);
    failed += Number(result.failed || 0);
    changed = true;
  }

  if (changed) persistSessions();
  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastLeadWowAutomationRunAt: nowIso,
    lastLeadWowAutomationSummary: { inspected, queued, delivered, failed }
  };
  persistOperations();
  return { inspected, queued, delivered, failed, changed };
}

async function runConciergeDailyDigestAutomation() {
  if (!AUTO_CONCIERGE_DIGEST_ENABLED) return { skipped: "disabled" };
  const now = new Date();
  const dayKey = getLocalDayKey(now);
  const hour = now.getHours();
  const minute = now.getMinutes();
  const alreadySent = operationsStore.automation?.lastConciergeDigestDay === dayKey;
  const timeReached =
    hour > AUTO_CONCIERGE_DIGEST_HOUR ||
    (hour === AUTO_CONCIERGE_DIGEST_HOUR && minute >= AUTO_CONCIERGE_DIGEST_MINUTE);

  if (alreadySent || !timeReached) return { skipped: alreadySent ? "already-sent" : "time-not-reached" };

  const report = buildConciergeDailyReport();
  const message = buildConciergeDailyDigestMessage(report);
  const result = await sendWhatsAppText(message, { force: true });

  operationsStore.automation = {
    ...(operationsStore.automation || {}),
    lastConciergeDigestDay: dayKey,
    lastConciergeDigestAt: new Date().toISOString(),
    lastConciergeDigestStatus: result.delivered ? "sent" : "failed",
    lastConciergeDigestReason: result.reason || result.status || null
  };
  persistOperations();
  return { delivered: result.delivered, reason: result.reason || null, status: result.status || null };
}

async function runLeadAutomationCycle() {
  const proactive = await runLeadProactiveFollowUpAutomation();
  const sweep = runLeadEscalationAutomationSweep();
  const documents = await runLeadMissingDocumentAutomation();
  const deadlines = await runLeadDeadlineAutomation();
  const wow = await runLeadWowAutomation();
  const digest = await runConciergeDailyDigestAutomation();
  return { proactive, sweep, documents, deadlines, wow, digest };
}

function getLeadSlaState(session) {
  if (session.firstContactAt) {
    return { state: "contacted", elapsedMinutes: 0 };
  }
  const created = new Date(session.createdAt).getTime();
  const now = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((now - created) / 60000));
  const atRiskThreshold = Math.max(1, SLA_MINUTES - 3);
  if (elapsedMinutes >= SLA_MINUTES) return { state: "overdue", elapsedMinutes };
  if (elapsedMinutes >= atRiskThreshold) return { state: "at-risk", elapsedMinutes };
  return { state: "on-time", elapsedMinutes };
}

function buildLeadMessage(payload, followUpUrl) {
  const scoring = scoreLead(payload);
  const copilot = buildAgentCopilotSummary(payload, scoring);
  const followUps = buildFollowUpPlaybook(payload, scoring);
  const objections = buildObjectionPlaybook(payload);
  const lines = [
    `New ${payload.label}`,
    "",
    "AI Lead Score:",
    `- Priority: ${scoring.band}`,
    `- Score: ${scoring.score}/100`,
    `- Urgency: ${scoring.urgency}`,
    `- Close likelihood: ${scoring.closeLikelihood}`,
    `- Data completeness: ${scoring.dataCompleteness}%`,
    `- Reasons: ${scoring.reasons.join("; ")}`,
    "",
    "Central Concierge Copilot:",
    `- Snapshot: ${copilot.snapshot}`,
    `- Suggested first reply: ${copilot.firstReply}`,
    `- Next action: ${copilot.nextAction}`,
    `- Unknowns to confirm: ${copilot.unknowns.join("; ")}`,
    `- Session ID: ${followUpUrl.split("session=")[1] || "Not available"}`,
    "",
    "Follow-up AI Drafts:",
    ...followUps.map((f) => `- ${f.trigger}: ${f.message}`),
    "",
    "Objection Playbook:",
    ...objections.map((o) => `- ${o.objection}: ${o.response}`),
    "",
    "Path:",
    `- ${payload.intent.toUpperCase()}`,
    "",
    "Answers:"
  ];

  for (const answer of payload.answers || []) {
    lines.push(`- ${answer.label}: ${answer.value}`);
  }

  lines.push("", "Additional info for concierge:", payload.additionalInfo || "None");
  return lines.join("\n");
}

function buildSessionDeliveryMessage(session, req) {
  const followUpUrl = `${buildBaseUrl(req)}/?session=${encodeURIComponent(session.id)}`;
  if (session.label === "Concierge Session" || !Array.isArray(session.answers) || session.answers.length === 0) {
    return buildConciergeHandoffMessage(session, session.id, followUpUrl);
  }
  return buildLeadMessage(
    {
      intent: session.intent,
      label: session.label,
      answers: session.answers || [],
      additionalInfo: session.additionalInfo || ""
    },
    followUpUrl
  );
}

function buildWhatsAppFallbackUrl(message) {
  const recipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
  if (!recipient) return null;
  return `https://wa.me/${recipient.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function buildDirectWhatsAppUrl(message, recipientPhone = "") {
  const recipient = cleanPhoneNumber(recipientPhone || "");
  if (!recipient) return null;
  return `https://wa.me/${recipient.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function buildClientConfirmationMessage(session) {
  const slots = getSessionSlots(session);
  const firstName = slots.fullName ? slots.fullName.split(/\s+/)[0] : "there";
  const intent = slots.intent === "sell" ? "selling" : slots.intent === "buy" ? "buying" : "property";
  const area = slots.area ? ` in ${slots.area}` : "";
  const timing =
    slots.urgency === "High" || /immediate|urgent|asap|today/i.test(slots.timeline || "")
      ? " Because your timing looks urgent, we will treat this as a priority."
      : "";

  return [
    `Hi ${firstName}, thanks for contacting Axiom Realty AI.`,
    `We have received your ${intent} request${area}.`,
    "Your brief is being reviewed so we can connect you with a suitable property specialist for the next step.",
    `You will not have to repeat the basics.${timing}`,
    "",
    "Axiom Realty AI"
  ].join("\n");
}

async function recordAutomaticLeadAcknowledgement(session) {
  if (session.autoAcknowledgement?.recordedAt) return session.autoAcknowledgement;

  const recordedAt = new Date().toISOString();
  const slots = getSessionSlots(session);
  const phone = slots.phone || "";
  let result = {
    delivered: false,
    status: "recorded-only",
    reason: "Lead receipt recorded. Client WhatsApp confirmation will be sent when the WhatsApp test bridge is ready."
  };

  if (!phone) {
    result = {
      delivered: false,
      status: "missing-recipient",
      reason: "Lead receipt recorded. Client WhatsApp confirmation could not send because no WhatsApp number was captured."
    };
  } else if (isWhatsAppWebTestModeEnabled() && whatsappWebBridge.status === "ready" && whatsappWebBridge.client) {
    result = await sendWhatsAppWebText(buildClientConfirmationMessage(session), { to: phone });
  } else if (isWhatsAppWebTestModeEnabled()) {
    result = {
      delivered: false,
      status: "web-not-ready",
      reason: "Lead receipt recorded. Client WhatsApp confirmation is waiting because the WhatsApp test bridge is not connected."
    };
  }

  session.autoAcknowledgement = {
    recordedAt,
    channel: "system-receipt",
    clientConfirmationAttemptedAt: new Date().toISOString(),
    clientConfirmationDelivered: result.delivered,
    clientConfirmationStatus: result.status || null,
    clientConfirmationReason: result.reason || null,
    recipient: phone || null
  };
  session.clientConfirmationDelivery = {
    channel: result.delivered ? "whatsapp-web-test-auto" : "system-receipt",
    attemptedAt: session.autoAcknowledgement.clientConfirmationAttemptedAt,
    delivered: result.delivered,
    reason: result.reason || null,
    status: result.status || null,
    recipient: phone || null,
    automatic: true
  };
  session.updatedAt = new Date().toISOString();
  appendLeadAuditEvent(session, {
    type: "auto-acknowledgement",
    actor: "System",
    source: "auto-ack",
    summary: "Automatic lead receipt recorded",
    details: result.delivered
      ? "Client confirmation sent through WhatsApp test bridge."
      : result.reason || "Client confirmation not sent."
  });
  leadSessions.set(session.id, session);
  persistSessions();
  return session.autoAcknowledgement;
}

async function deliverSessionToWhatsApp(session, req) {
  const message = buildSessionDeliveryMessage(session, req);
  const result = await sendWhatsAppText(message);
  const fallbackUrl = buildWhatsAppFallbackUrl(message);
  session.delivery = {
    channel: "whatsapp",
    attemptedAt: new Date().toISOString(),
    delivered: result.delivered,
    reason: result.reason || null,
    status: result.status || null,
    manualFallbackAvailable: Boolean(fallbackUrl)
  };
  session.updatedAt = new Date().toISOString();
  appendLeadAuditEvent(session, {
    type: "whatsapp-delivery",
    actor: "System",
    source: "whatsapp-delivery",
    summary: result.delivered ? "Lead delivered to central WhatsApp" : "Lead delivery to WhatsApp failed",
    details: result.reason || result.status || "No additional delivery details."
  });
  leadSessions.set(session.id, session);
  persistSessions();
  return {
    result,
    fallbackUrl
  };
}

function validateLeadPayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing payload";
  if (!payload.intent || !["buy", "sell"].includes(payload.intent)) return "Invalid intent";
  if (!payload.label || typeof payload.label !== "string") return "Invalid label";
  if (!Array.isArray(payload.answers) || payload.answers.length < 1) return "Answers are required";
  if (payload.consent !== true) return "Consent is required before we can share details with a suitable property professional";

  for (const item of payload.answers) {
    if (!item?.label || typeof item.label !== "string") return "Invalid answer label";
    if (typeof item.value !== "string") return "Invalid answer value";
  }

  if (payload.additionalInfo && typeof payload.additionalInfo !== "string") return "Invalid additional info";
  const { map, nameMap } = getAnswerMap(payload);
  const pickValue = (labelKeys, nameKeys = []) => {
    const labeled = pickAnswer(map, labelKeys);
    if (labeled) return labeled;
    return pickAnswer(nameMap, nameKeys);
  };

  const phone = cleanPhoneNumber(pickValue(["contact / whatsapp number", "contact number", "whatsapp number"], ["contact", "phone"]));
  const province = pickValue(["province"], ["province"]);
  const area = pickValue(["preferred area", "property location"], ["area", "location"]);
  const price = pickValue(["budget range (zar)", "expected selling price (zar)"], ["budget", "expectedprice", "expected price", "price"]);
  const timeline = pickValue(["timeline to buy", "timeline to sell"], ["timeline"]);

  if (!province) return "Province is required";
  if (!area) return "Area is required";
  if (!price || !parseAmount(price)) return "Budget or price is required";
  if (!timeline) return "Timeline is required";
  if (!pickValue(["full name"], ["full name", "fullname", "name"])) return "Full name is required";
  if (!phone) return "Valid WhatsApp/contact number is required";
  return null;
}

function sanitizeShortText(value, max = 240) {
  return (value || "").toString().trim().slice(0, max);
}

function safeBaseFilename(name = "document") {
  const cleaned = path
    .basename((name || "document").toString())
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 120);
  return cleaned || "document";
}

function extFromMime(mimeType = "") {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "application/msword") return ".doc";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mime === "text/plain") return ".txt";
  return "";
}

function ensureLeadDocumentStore(session) {
  if (!Array.isArray(session.leadDocuments)) session.leadDocuments = [];
  return session.leadDocuments;
}

function getLeadDocumentSummary(session) {
  return ensureLeadDocumentStore(session).map((item) => ({
    id: item.id,
    originalName: item.originalName,
    mimeType: item.mimeType,
    size: item.size,
    category: item.category,
    note: item.note || "",
    uploadedAt: item.uploadedAt,
    uploadedBy: item.uploadedBy || "Concierge"
  }));
}

function sanitizeLeadAcquisition(value) {
  const acquisition = value && typeof value === "object" ? value : {};
  return {
    source: sanitizeShortText(acquisition.source, 100),
    medium: sanitizeShortText(acquisition.medium, 100),
    campaign: sanitizeShortText(acquisition.campaign, 160),
    content: sanitizeShortText(acquisition.content, 160),
    referrer: sanitizeShortText(acquisition.referrer, 500),
    landingPage: sanitizeShortText(acquisition.landingPage, 500),
    dataMode: sanitizeShortText(acquisition.dataMode, 20).toLowerCase()
  };
}

function getIncomingDataClass(value, fallback = "live") {
  const mode = sanitizeShortText(value, 20).toLowerCase();
  return mode === "test" ? "test" : fallback;
}

function validateAgentApplication(payload) {
  if (!payload || typeof payload !== "object") return "Missing application";
  const required = [
    "name",
    "agency",
    "mobile",
    "email",
    "areasCovered",
    "propertyTypes",
    "complianceStatus",
    "referralPartnership"
  ];
  for (const field of required) {
    if (!(payload[field] || "").toString().trim()) return `${field} is required`;
  }
  if (!cleanPhoneNumber(payload.mobile)) return "Valid mobile number is required";
  if (!cleanEmailAddress(payload.email)) return "Valid email address is required";
  if (!["Yes", "No"].includes(payload.complianceStatus)) {
    return "Compliance status must be Yes or No";
  }
  if (!["Yes", "No", "Open to discuss"].includes(payload.referralPartnership)) {
    return "Referral partnership selection is invalid";
  }
  return null;
}

function isWhatsAppAutoSendEnabled() {
  return (process.env.WHATSAPP_AUTO_SEND || "false").toLowerCase() === "true";
}

function isWhatsAppWebTestModeEnabled() {
  return (process.env.WHATSAPP_WEB_TEST_MODE || "false").toLowerCase() === "true";
}

function getWhatsAppRecipientChatId() {
  const to = (process.env.WHATSAPP_TO_NUMBER || "").replace(/\D/g, "");
  return to ? `${to}@c.us` : "";
}

function getWhatsAppChatIdForNumber(phone) {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return "";
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `27${digits.slice(1)}@c.us`;
  if (digits.startsWith("27") && digits.length === 11) return `${digits}@c.us`;
  return digits.length >= 10 && digits.length <= 15 ? `${digits}@c.us` : "";
}

function getBrowserExecutablePath() {
  const configured = (process.env.CHROME_EXECUTABLE_PATH || "").trim();
  const candidates = [
    configured,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function updateWhatsAppWebQrDataUrl(qr) {
  try {
    const QRCode = require("qrcode");
    whatsappWebBridge.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
  } catch (error) {
    whatsappWebBridge.lastError = `Could not render WhatsApp Web QR: ${error.message}`;
  }
}

async function ensureWhatsAppWebClient() {
  if (!isWhatsAppWebTestModeEnabled()) {
    whatsappWebBridge.status = "disabled";
    return whatsappWebBridge;
  }
  if (whatsappWebBridge.client) return whatsappWebBridge;
  if (whatsappWebBridge.initializing) return whatsappWebBridge.initializing;

  whatsappWebBridge.status = "initializing";
  whatsappWebBridge.lastError = null;
  whatsappWebBridge.initializing = (async () => {
    try {
      ensureDataDir();
      const { Client, LocalAuth } = require("whatsapp-web.js");
      const executablePath = getBrowserExecutablePath();
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: "axiom-realty-ai-test",
          dataPath: whatsappWebAuthDir
        }),
        puppeteer: {
          headless: true,
          executablePath: executablePath || undefined,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        }
      });

      client.on("qr", async (qr) => {
        whatsappWebBridge.status = "qr";
        whatsappWebBridge.qr = qr;
        whatsappWebBridge.lastError = null;
        await updateWhatsAppWebQrDataUrl(qr);
      });

      client.on("authenticated", () => {
        whatsappWebBridge.status = "authenticated";
        whatsappWebBridge.lastError = null;
      });

      client.on("ready", () => {
        whatsappWebBridge.status = "ready";
        whatsappWebBridge.qr = null;
        whatsappWebBridge.qrDataUrl = null;
        whatsappWebBridge.lastReadyAt = new Date().toISOString();
        whatsappWebBridge.lastError = null;
      });

      client.on("disconnected", (reason) => {
        whatsappWebBridge.status = "disconnected";
        whatsappWebBridge.lastError = reason || "WhatsApp Web disconnected";
        whatsappWebBridge.client = null;
      });

      client.on("auth_failure", (message) => {
        whatsappWebBridge.status = "auth-failure";
        whatsappWebBridge.lastError = message || "WhatsApp Web authentication failed";
      });

      whatsappWebBridge.client = client;
      await client.initialize();
    } catch (error) {
      whatsappWebBridge.status = "error";
      whatsappWebBridge.lastError = error.message || "WhatsApp Web bridge failed to start";
      whatsappWebBridge.client = null;
    } finally {
      whatsappWebBridge.initializing = null;
    }
    return whatsappWebBridge;
  })();

  return whatsappWebBridge.initializing;
}

function getWhatsAppWebStatus() {
  const enabled = isWhatsAppWebTestModeEnabled();
  return {
    enabled,
    status: enabled ? whatsappWebBridge.status : "disabled",
    ready: enabled && whatsappWebBridge.status === "ready",
    hasQr: Boolean(enabled && whatsappWebBridge.qrDataUrl),
    qrDataUrl: enabled ? whatsappWebBridge.qrDataUrl : null,
    lastError: whatsappWebBridge.lastError,
    lastReadyAt: whatsappWebBridge.lastReadyAt,
    lastSentAt: whatsappWebBridge.lastSentAt
  };
}

async function sendWhatsAppWebText(text, { to = "", initialize = false } = {}) {
  if (!isWhatsAppWebTestModeEnabled()) {
    return { delivered: false, reason: "WhatsApp Web test bridge is disabled", status: "web-disabled" };
  }
  if (initialize) await ensureWhatsAppWebClient();
  if (whatsappWebBridge.status !== "ready" || !whatsappWebBridge.client) {
    return {
      delivered: false,
      reason: "WhatsApp Web test bridge is not ready. Start it in Operations and scan the QR code.",
      status: whatsappWebBridge.status || "not-ready"
    };
  }

  const chatId = to ? getWhatsAppChatIdForNumber(to) : getWhatsAppRecipientChatId();
  if (!chatId) return { delivered: false, reason: "Missing WhatsApp recipient number", status: "missing-recipient" };

  try {
    await whatsappWebBridge.client.sendMessage(chatId, text);
    whatsappWebBridge.lastSentAt = new Date().toISOString();
    return { delivered: true, status: "web-test-sent" };
  } catch (error) {
    const reason = error?.message || "WhatsApp Web test bridge could not send the message";
    whatsappWebBridge.lastError = reason;
    return { delivered: false, reason, status: "web-send-failed" };
  }
}

async function sendWhatsAppText(text, { force = false, to: recipientOverride = "" } = {}) {
  if (!force && !isWhatsAppAutoSendEnabled()) {
    if (isWhatsAppWebTestModeEnabled()) return sendWhatsAppWebText(text, { to: recipientOverride });
    return {
      delivered: false,
      reason: "Automatic WhatsApp delivery is disabled; use the manual Operations introduction.",
      status: "manual-handoff"
    };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = cleanPhoneNumber(recipientOverride) || process.env.WHATSAPP_TO_NUMBER;

  if (!token || !phoneNumberId || !to) {
    if (isWhatsAppWebTestModeEnabled()) return sendWhatsAppWebText(text, { to: recipientOverride });
    return { delivered: false, reason: "Missing WhatsApp API credentials" };
  }

  try {
    const endpoint = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return { delivered: false, reason: details || "WhatsApp API request failed", status: response.status };
    }
  } catch (error) {
    return {
      delivered: false,
      reason: error?.message || "WhatsApp API request failed",
      status: "cloud-send-failed"
    };
  }

  return { delivered: true };
}

function ensureLeadStageUpdateLog(session) {
  session.stageUpdateNotifications = Array.isArray(session.stageUpdateNotifications)
    ? session.stageUpdateNotifications.filter((item) => item && typeof item === "object").slice(0, 50)
    : [];
  return session.stageUpdateNotifications;
}

function getLeadPrimaryClientRole(session) {
  const intent = getSessionSlots(session).intent || session.intent || "buy";
  return intent === "sell" ? "seller" : "buyer";
}

function pushLeadStageUpdateRecipient(recipientMap, role, name, phone) {
  const cleanedPhone = cleanPhoneNumber(phone || "");
  if (!cleanedPhone) return;
  const key = cleanedPhone.replace(/^\+/, "");
  if (recipientMap.has(key)) return;
  recipientMap.set(key, {
    role,
    name: sanitizeShortText(name || stakeholderRoleLabels[role] || "Client", 120) || stakeholderRoleLabels[role] || "Client",
    phone: cleanedPhone
  });
}

function getLeadStageUpdateRecipients(session, { includeAgent = false } = {}) {
  const slots = getSessionSlots(session);
  const recipientMap = new Map();
  const primaryRole = getLeadPrimaryClientRole(session);
  pushLeadStageUpdateRecipient(recipientMap, primaryRole, slots.fullName || stakeholderRoleLabels[primaryRole], slots.phone || "");

  const accessMap = ensureStakeholderAccess(session);
  for (const role of ["buyer", "seller"]) {
    const access = accessMap[role];
    if (access && isStakeholderAccessActive(access)) {
      pushLeadStageUpdateRecipient(recipientMap, role, access.name || stakeholderRoleLabels[role], access.phone || "");
    }
  }

  if (includeAgent) {
    pushLeadStageUpdateRecipient(recipientMap, "agent", session.assignedAgent?.name || "Agent", session.assignedAgent?.phone || "");
    const agentAccess = accessMap.agent;
    if (agentAccess && isStakeholderAccessActive(agentAccess)) {
      pushLeadStageUpdateRecipient(recipientMap, "agent", agentAccess.name || "Agent", agentAccess.phone || "");
    }
  }

  return Array.from(recipientMap.values());
}

function buildLeadStageUpdateHeadline(session, code, label = "") {
  const agentName = session.assignedAgent?.name || "your assigned specialist";
  const agency = session.assignedAgent?.agency ? ` from ${session.assignedAgent.agency}` : "";
  const contactMedium = session.agentContact?.medium ? ` via ${session.agentContact.medium}` : "";

  const headlines = {
    "agent-assigned": `We have assigned ${agentName}${agency} to your property request.`,
    "referral-accepted": "Your receiving agent has accepted the referral terms and the introduction is protected.",
    "agent-contacted": `Your specialist has confirmed first contact${contactMedium}.`,
    "viewing-booked": "A viewing or valuation has been booked.",
    "offer-received": "An offer has been received on the property journey.",
    "otp-signed": "The offer to purchase has been signed.",
    "sale-pending": "The sale is now marked as pending progression.",
    "suspensive-conditions": "Suspensive conditions are now being tracked.",
    "bond-approval": "Bond approval has been confirmed.",
    "guarantees-issued": "Guarantees have been issued.",
    "transfer-instruction": "The transfer instruction has been sent.",
    "fica-complete": "FICA is complete.",
    "compliance-certificates": "Compliance certificates are now in place.",
    "rates-clearance": "Rates clearance has been issued.",
    "transfer-documents-signed": "Transfer documents have been signed.",
    "bond-documents-signed": "Bond documents have been signed.",
    lodged: "The matter has been lodged at the Deeds Office.",
    registered: "Registration has been completed.",
    "sale-concluded": "The sale has been concluded successfully.",
    "handover-complete": "Handover has been completed.",
    "deal-lost": "This matter has been marked as lost or closed."
  };

  return headlines[code] || `Progress update recorded: ${label || getMilestoneLabel(code)}.`;
}

function buildLeadStageUpdateMessage(session, { code = "", label = "", note = "" } = {}) {
  const slots = getSessionSlots(session);
  const timeline = buildTransactionTimelineSummary(session);
  const contactName = slots.fullName || stakeholderRoleLabels[getLeadPrimaryClientRole(session)] || "Client";
  const area = [slots.area, slots.province].filter(Boolean).join(", ");
  const headline = buildLeadStageUpdateHeadline(session, code, label);
  const nextLine = timeline.nextMilestone
    ? `Next step: ${timeline.nextMilestone.label}${timeline.nextMilestone.owner ? ` (${timeline.nextMilestone.owner})` : ""}.`
    : "Next step: registration and handover are complete.";
  const noteLine = note ? `Note: ${note}.` : "";

  return [
    `Axiom Realty AI update for ${contactName}${area ? ` | ${area}` : ""}:`,
    headline,
    nextLine,
    noteLine,
    "Reply to your concierge if you need help or clarity."
  ]
    .filter(Boolean)
    .join(" ");
}

async function deliverLeadStageUpdate(session, { code = "", label = "", note = "", includeAgent = false, source = "stage-update" } = {}) {
  const recipients = getLeadStageUpdateRecipients(session, { includeAgent });
  const message = buildLeadStageUpdateMessage(session, { code, label, note });
  const delivery = await sendLeadRecipientMessage(recipients, message);
  const log = ensureLeadStageUpdateLog(session);
  log.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    code,
    label: label || getMilestoneLabel(code),
    note: note || "",
    ...delivery
  });
  session.stageUpdateNotifications = log.slice(0, 20);

  return delivery;
}

function getLeadStageUpdateSummary(session, limit = 6) {
  const log = ensureLeadStageUpdateLog(session);
  return summariseLeadDeliveryLog(log, limit, (item) => ({
    source: item.source || "stage-update",
    code: item.code || "",
    label: item.label || "",
    note: item.note || ""
  }));
}

function ensureLeadWowAutomationLog(session) {
  session.wowAutomationLog = Array.isArray(session.wowAutomationLog)
    ? session.wowAutomationLog.filter((item) => item && typeof item === "object").slice(0, 50)
    : [];
  return session.wowAutomationLog;
}

function getLeadWowAutomationLabel(type) {
  return (
    {
      "next-step-brief": "Next-step brief",
      "silence-watchdog": "Silence watchdog reassurance",
      "partner-readiness": "Partner readiness prompt",
      "document-readiness": "Document readiness nudge"
    }[type] || "Proactive touch"
  );
}

function buildLeadWowAutomationMessage(session, { type = "", note = "" } = {}) {
  const slots = getSessionSlots(session);
  const timeline = buildTransactionTimelineSummary(session);
  const vault = buildLeadDocumentVaultSummary(session);
  const firstName = slots.fullName ? slots.fullName.split(/\s+/)[0] : "there";
  const nextMilestone = timeline.nextMilestone;
  const nextText = nextMilestone
    ? `${nextMilestone.label}${nextMilestone.owner ? ` (${nextMilestone.owner})` : ""}`
    : "registration and handover";
  const missingDocs = getMissingLeadDocumentLabels(session);
  const noteText = note ? ` ${note}` : "";

  if (type === "document-readiness") {
    return [
      `Hi ${firstName}, Axiom Realty AI is preparing your next step: ${nextText}.`,
      missingDocs.length ? `Please keep these ready now: ${missingDocs.join(", ")}.` : "Please keep your required documents ready.",
      `Vault readiness is ${vault.readinessPercent}% right now.${noteText}`,
      "Reply to your concierge if you want help with any document."
    ].join(" ");
  }

  if (type === "silence-watchdog") {
    return [
      `Hi ${firstName}, this is a quick reassurance from Axiom Realty AI.`,
      `Your matter is still being actively monitored and the current focus is ${nextText}.`,
      noteText,
      "You do not need to chase blindly; reply if you want a human update."
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "partner-readiness") {
    return [
      `Hi ${firstName}, Axiom Realty AI is preparing the next partner step around ${nextText}.`,
      missingDocs.length ? `To keep that step smooth, please make sure these items are ready: ${missingDocs.join(", ")}.` : "Please keep any outstanding details ready so the next specialist can move quickly.",
      noteText,
      "Reply to your concierge if you want us to confirm the exact requirement."
    ].join(" ");
  }

  return [
    `Hi ${firstName}, Axiom Realty AI next-step brief: ${nextText}.`,
    noteText || "We are keeping the journey moving and will keep you updated before the next milestone slips.",
    "Reply to your concierge if you need clarity."
  ]
    .filter(Boolean)
    .join(" ");
}

async function deliverLeadWowAutomationTouch(session, { type = "", note = "", includeAgent = false, source = "wow-automation" } = {}) {
  const recipients = getLeadStageUpdateRecipients(session, { includeAgent });
  const message = buildLeadWowAutomationMessage(session, { type, note });
  const delivery = await sendLeadRecipientMessage(recipients, message);
  const log = ensureLeadWowAutomationLog(session);
  log.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    type,
    label: getLeadWowAutomationLabel(type),
    note: note || "",
    ...delivery
  });
  session.wowAutomationLog = log.slice(0, 20);
  return delivery;
}

function getLeadWowAutomationSummary(session, limit = 6) {
  const log = ensureLeadWowAutomationLog(session);
  const items = summariseLeadDeliveryLog(log, limit, (item) => ({
    source: item.source || "wow-automation",
    type: item.type || "",
    label: item.label || getLeadWowAutomationLabel(item.type || ""),
    note: item.note || ""
  }));
  return {
    totalSent: log.length,
    lastSentAt: log[0]?.at || null,
    activeTypes: Array.from(new Set(log.map((item) => getLeadWowAutomationLabel(item.type || "")).filter(Boolean))).slice(0, 6),
    items
  };
}

function getLaunchReadiness() {
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").trim();
  const allowedOriginValue = (process.env.ALLOWED_ORIGIN || "").trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const status = getWhatsAppConfigStatus();
  const rulePackCases = (operationsStore.cases || []).slice(0, 20);
  const rulePackReady = rulePackCases.every((item) => {
    normalizeCaseStakeholders(item);
    const pack = evaluateCaseRulePack(item);
    return Boolean(pack && Array.isArray(pack.gates) && pack.gates.length === operationsControlGates.length);
  });
  const isLocalBaseUrl = !publicBaseUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(publicBaseUrl);
  const checks = [
    {
      id: "concierge-recipient",
      ready: Boolean(cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "")),
      label: "Central concierge WhatsApp number is configured"
    },
    {
      id: "cloud-auto-send",
      ready: Boolean(status.cloudConfigured && status.autoSendEnabled),
      label: "WhatsApp Cloud API automatic delivery is enabled"
    },
    {
      id: "public-base-url",
      ready: Boolean(publicBaseUrl && !isLocalBaseUrl && /^https:\/\//i.test(publicBaseUrl)),
      label: "Public HTTPS base URL is configured for follow-up links"
    },
    {
      id: "allowed-origin",
      ready: Boolean(allowedOriginValue && allowedOriginValue !== "*" && !/localhost|127\.0\.0\.1/i.test(allowedOriginValue)),
      label: "Production browser origin is restricted"
    },
    {
      id: "admin-password",
      ready: Boolean(adminPassword && !["axiom-admin", "change-this-before-launch", "axiomadmin2026!"].includes(adminPassword.toLowerCase())),
      label: "Admin password has been changed from the starter value"
    },
    {
      id: "web-test-disabled",
      ready: !status.webTest.enabled,
      label: "Pre-launch WhatsApp Web test bridge is disabled"
    },
    {
      id: "rule-pack-active",
      ready: rulePackReady,
      label: "Rule Pack control gates are active on operations cases"
    }
  ];

  return {
    readyForProduction: checks.every((check) => check.ready),
    manualFallbackAvailable: Boolean(cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "")),
    checks
  };
}

function getWhatsAppConfigStatus() {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const to = (process.env.WHATSAPP_TO_NUMBER || "").trim();
  const cloudConfigured = Boolean(token && phoneNumberId && to);
  const webStatus = getWhatsAppWebStatus();
  const transcribeConfigured = Boolean(WHATSAPP_VOICE_TRANSCRIBE_URL);
  return {
    configured: cloudConfigured || webStatus.enabled,
    cloudConfigured,
    hasAccessToken: Boolean(token),
    hasPhoneNumberId: Boolean(phoneNumberId),
    hasRecipient: Boolean(to),
    transcribeConfigured,
    transcribeModel: WHATSAPP_VOICE_TRANSCRIBE_MODEL || null,
    transcribeRequired: Boolean(WHATSAPP_VOICE_TRANSCRIBE_REQUIRED),
    recipient: to || null,
    autoSendEnabled: isWhatsAppAutoSendEnabled(),
    webTest: webStatus
  };
}

function getStorageSummary() {
  return {
    leadCount: leadSessions.size,
    operationsCaseCount: Array.isArray(operationsStore.cases) ? operationsStore.cases.length : 0,
    operationsDocumentCount: Array.isArray(operationsStore.documents) ? operationsStore.documents.length : 0,
    whatsappThreadCount: Array.isArray(operationsStore.whatsappInbox) ? operationsStore.whatsappInbox.length : 0,
    agentApplicationCount: agentApplications.length,
    auditEventCount: Array.isArray(operationsStore.auditLog) ? operationsStore.auditLog.length : 0
  };
}

function refreshStartupDiagnostics() {
  startupDiagnostics = buildStartupDiagnostics({
    env: process.env,
    config: {
      port,
      host,
      version: APP_VERSION,
      build: APP_BUILD_LABEL
    },
    paths: {
      dataDir,
      sessionsFile,
      operationsFile,
      agentApplicationsFile,
      indexHtml: path.join(__dirname, "index.html"),
      scriptJs: path.join(__dirname, "script.js"),
      packageJson: path.join(__dirname, "package.json"),
      publicUiModule: path.join(__dirname, "modules", "public-ui.js"),
      adminControlModule: path.join(__dirname, "modules", "admin-control.js"),
      apiClientModule: path.join(__dirname, "modules", "api-client.js"),
      communicationsModule: path.join(__dirname, "modules", "communications.js"),
      dataWorkflowsModule: path.join(__dirname, "modules", "data-workflows.js")
    },
    storage: getStorageSummary(),
    whatsapp: getWhatsAppConfigStatus(),
    launch: getLaunchReadiness(),
    lmStudio: {
      enabled: LM_STUDIO_ENABLED,
      baseUrl: LM_STUDIO_ENABLED ? LM_STUDIO_BASE_URL : null,
      model: LM_STUDIO_MODEL || lmStudioModelCache || null,
      connected: Boolean(lmStudioLastStatus.connected)
    }
  });
  return startupDiagnostics;
}

function getSystemExportBundle() {
  return {
    exportedAt: new Date().toISOString(),
    app: {
      service: "axiom-realty-ai",
      version: APP_VERSION,
      build: APP_BUILD_LABEL,
      environment: process.env.RENDER ? "render" : "local"
    },
    diagnostics: refreshStartupDiagnostics(),
    launch: getLaunchReadiness(),
    leadSessions: Array.from(leadSessions.values()),
    agentApplications,
    operationsStore,
    auditLog: operationsStore.auditLog || []
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lead-api" });
});

app.get("/api/whatsapp/status", requireAdmin, (_req, res) => {
  res.json({ ok: true, whatsapp: getWhatsAppConfigStatus() });
});

app.get("/api/launch-readiness", requireAdmin, (_req, res) => {
  res.json({ ok: true, launch: getLaunchReadiness() });
});

app.post("/api/whatsapp-web/start", requireAdmin, async (_req, res) => {
  await ensureWhatsAppWebClient();
  return res.json({ ok: true, whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/whatsapp-web/logout", requireAdmin, async (_req, res) => {
  try {
    if (whatsappWebBridge.client) {
      await whatsappWebBridge.client.logout();
      await whatsappWebBridge.client.destroy();
    }
  } catch {
    // Best-effort cleanup; the local auth folder is the source of truth.
  }
  whatsappWebBridge.client = null;
  whatsappWebBridge.status = isWhatsAppWebTestModeEnabled() ? "logged-out" : "disabled";
  whatsappWebBridge.qr = null;
  whatsappWebBridge.qrDataUrl = null;
  whatsappWebBridge.lastReadyAt = null;
  persistSessions();
  return res.json({ ok: true, whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/whatsapp/test", requireAdmin, async (req, res) => {
  const status = getWhatsAppConfigStatus();
  if (!status.configured) {
    return res.status(400).json({ ok: false, error: "WhatsApp is not fully configured", whatsapp: status });
  }
  const text =
    (req.body?.text || "").toString().trim() ||
    `Axiom Realty AI test message (${new Date().toISOString()})`;
  const result = await sendWhatsAppText(text, { force: true });
  return res.status(result.delivered ? 200 : 502).json({ ok: result.delivered, result, whatsapp: status });
});

app.get("/api/whatsapp/inbox", requireAdmin, (_req, res) => {
  return res.json({
    ok: true,
    inbox: buildAdminWhatsappInboxSummary(),
    whatsapp: getWhatsAppConfigStatus()
  });
});

app.post("/api/whatsapp/inbox/:caseId/read", requireAdmin, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const updated = markOperationsWhatsappMessagesRead(item.id, "Concierge");
  persistOperations();
  return res.json({ ok: true, updated });
});

app.post("/api/whatsapp/inbox/:caseId/human-takeover", requireAdmin, rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const item = findOperationsCase(req.params.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const action = sanitizeShortText(req.body?.action || "resume", 40).toLowerCase();
  const note = sanitizeShortText(req.body?.note || "", 500);
  if (action === "resume") {
    const humanTakeover = resumeCaseHumanTakeover(item, { actor: "Concierge", note });
    persistOperations();
    return res.json({ ok: true, action, humanTakeover, inbox: buildAdminWhatsappInboxSummary() });
  }
  if (action === "pause") {
    const reasons = detectWhatsappHumanTakeover(note) || { reasonCodes: ["manual-human-takeover"], reasonLabels: ["Manual concierge takeover"] };
    const humanTakeover = activateCaseHumanTakeover(item, {
      reasons,
      sender: "Concierge",
      source: "admin-manual-human-takeover",
      triggerMessage: note
    });
    persistOperations();
    return res.json({ ok: true, action, humanTakeover, inbox: buildAdminWhatsappInboxSummary() });
  }
  return res.status(400).json({ ok: false, error: "Unsupported human takeover action" });
});

app.post("/api/whatsapp/inbox/:caseId/reply", requireAdmin, rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const item = findOperationsCase(req.params.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const message = sanitizeShortText(req.body?.message, 1600);
  const recipientPhone = sanitizeShortText(req.body?.recipientPhone || "", 40);
  const recipientName = sanitizeShortText(req.body?.recipientName || "", 160);
  const recipientRole = sanitizeShortText(req.body?.recipientRole || "", 40);
  if (!message) return res.status(400).json({ ok: false, error: "Reply message is required" });
  if (!cleanPhoneNumber(recipientPhone)) return res.status(400).json({ ok: false, error: "Recipient phone is required" });
  const result = await sendManualWhatsappInboxReply({
    item,
    message,
    recipientName,
    recipientPhone,
    recipientRole,
    source: "admin-reply",
    actor: "Concierge"
  });
  return res.json({ ok: result.ok, result, inbox: buildAdminWhatsappInboxSummary(), whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/whatsapp/inbox/:caseId/appointments", requireAdmin, rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const item = findOperationsCase(req.params.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const kind = sanitizeShortText(req.body?.kind || "appointment", 60).toLowerCase();
  const title = sanitizeShortText(req.body?.title || "", 160) || formatOperationsAppointmentKind(kind);
  const participantName = sanitizeShortText(req.body?.participantName || "", 160);
  const participantPhone = cleanPhoneNumber(req.body?.participantPhone || "");
  const participantRole = sanitizeShortText(req.body?.participantRole || "", 40).toLowerCase();
  const location = sanitizeShortText(req.body?.location || "", 200);
  const notes = sanitizeShortText(req.body?.notes || "", 500);
  const scheduledForInput = sanitizeShortText(req.body?.scheduledFor || "", 80);
  const scheduledFor = scheduledForInput && !Number.isNaN(new Date(scheduledForInput).getTime()) ? new Date(scheduledForInput).toISOString() : null;
  if (!scheduledFor) return res.status(400).json({ ok: false, error: "A valid appointment date and time is required" });
  if (!participantName) return res.status(400).json({ ok: false, error: "Choose the participant for this appointment" });
  if (!participantPhone) return res.status(400).json({ ok: false, error: "The participant needs a valid WhatsApp number" });

  const appointment = normalizeOperationsAppointment({
    caseId: item.id,
    kind,
    title,
    participantName,
    participantPhone,
    participantRole,
    scheduledFor,
    location,
    notes,
    status: "pending-confirmation",
    confirmationRequired: true,
    createdBy: "Concierge"
  });
  ensureOperationsAppointments().push(appointment);
  addOperationsTimeline(item.id, "Appointment booked", `${appointment.title} booked for ${participantName} on ${formatOperationsAppointmentTime(scheduledFor)}${location ? ` at ${location}` : ""}.`);
  addOperationsActivity("BOOK", "Appointment booked", `${item.id} - ${appointment.title}`);
  addOperationsAudit("appointment-booked", item.id, `${appointment.id}: ${participantName}`);

  const result = await sendManualWhatsappInboxReply({
    item,
    message: buildAppointmentWhatsappMessage(item, appointment, { mode: "scheduled" }),
    recipientName: participantName,
    recipientPhone: participantPhone,
    recipientRole: participantRole,
    source: "appointment-booked",
    actor: "Concierge"
  });
  appointment.lastNotificationId = result?.notification?.id || null;
  appointment.updatedAt = new Date().toISOString();
  persistOperations();
  return res.json({ ok: true, appointment, result, inbox: buildAdminWhatsappInboxSummary(), whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/whatsapp/inbox/appointments/:id/action", requireAdmin, rateLimit({ windowMs: 60000, max: 40 }), async (req, res) => {
  const appointment = findOperationsAppointment(req.params.id);
  if (!appointment) return res.status(404).json({ ok: false, error: "Appointment not found" });
  const item = findOperationsCase(appointment.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const action = sanitizeShortText(req.body?.action || "", 40).toLowerCase();
  const note = sanitizeShortText(req.body?.note || "", 500);
  const notifyParticipant = req.body?.notifyParticipant === true;
  const label = appointment.title || formatOperationsAppointmentKind(appointment.kind);
  const now = new Date().toISOString();
  let outboundMessage = "";

  if (action === "confirm") {
    appointment.status = "confirmed";
    appointment.confirmedAt = now;
    outboundMessage = buildAppointmentWhatsappMessage(item, appointment, { mode: "confirmed-ack" });
    addOperationsTimeline(item.id, "Appointment confirmed", `${label} was confirmed from the admin workspace.`);
    addOperationsActivity("BOOK", "Appointment confirmed", `${item.id} - ${label}`);
    addOperationsAudit("appointment-confirmed-admin", item.id, appointment.id);
  } else if (action === "complete") {
    appointment.status = "completed";
    appointment.completedAt = now;
    addOperationsTimeline(item.id, "Appointment completed", `${label} was marked complete.${note ? ` ${note}` : ""}`);
    addOperationsActivity("BOOK", "Appointment completed", `${item.id} - ${label}`);
    addOperationsAudit("appointment-completed-admin", item.id, appointment.id);
  } else if (action === "missed") {
    appointment.status = "missed";
    appointment.missedAt = now;
    outboundMessage = buildAppointmentWhatsappMessage(item, appointment, { mode: "missed-ack" });
    addOperationsTimeline(item.id, "Appointment missed", `${label} was marked missed from the admin workspace.${note ? ` ${note}` : ""}`);
    addOperationsActivity("BOOK", "Appointment missed", `${item.id} - ${label}`);
    addOperationsAudit("appointment-missed-admin", item.id, appointment.id);
  } else if (action === "cancel") {
    appointment.status = "cancelled";
    appointment.cancelledAt = now;
    appointment.cancelledBy = "Concierge";
    outboundMessage = buildAppointmentWhatsappMessage(item, appointment, { mode: "cancelled" });
    addOperationsTimeline(item.id, "Appointment cancelled", `${label} was cancelled from the admin workspace.${note ? ` ${note}` : ""}`);
    addOperationsActivity("BOOK", "Appointment cancelled", `${item.id} - ${label}`);
    addOperationsAudit("appointment-cancelled-admin", item.id, appointment.id);
  } else if (action === "reopen") {
    appointment.status = "pending-confirmation";
    appointment.cancelledAt = null;
    appointment.cancelledBy = "";
    appointment.missedAt = null;
    appointment.completedAt = null;
    appointment.rescheduleRequestedAt = null;
    outboundMessage = buildAppointmentWhatsappMessage(item, appointment, { mode: "scheduled" });
    addOperationsTimeline(item.id, "Appointment reopened", `${label} was reopened for confirmation from the admin workspace.`);
    addOperationsActivity("BOOK", "Appointment reopened", `${item.id} - ${label}`);
    addOperationsAudit("appointment-reopened-admin", item.id, appointment.id);
  } else {
    return res.status(400).json({ ok: false, error: "Unsupported appointment action" });
  }

  appointment.updatedAt = now;
  let result = null;
  if (notifyParticipant && appointment.participantPhone && outboundMessage) {
    result = await sendManualWhatsappInboxReply({
      item,
      message: outboundMessage,
      recipientName: appointment.participantName,
      recipientPhone: appointment.participantPhone,
      recipientRole: appointment.participantRole,
      source: `appointment-action:${action}`,
      actor: "Concierge"
    });
    appointment.lastNotificationId = result?.notification?.id || appointment.lastNotificationId || null;
  }
  persistOperations();
  return res.json({ ok: true, appointment, result, inbox: buildAdminWhatsappInboxSummary(), whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/whatsapp/inbox/simulate", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const result = await processInboundWhatsappPayload(req.body, {
    source: "admin-simulated-inbound",
    autoReplyActor: "Axiom Concierge"
  });
  return res.status(result.ok ? 200 : result.status || 400).json({
    ...result,
    inbox: buildAdminWhatsappInboxSummary(),
    whatsapp: getWhatsAppConfigStatus()
  });
});

app.get("/api/whatsapp/inbox/documents/:id/download", requireAdmin, (req, res) => {
  const document = operationsStore.documents.find((item) => item.id === req.params.id);
  if (!document?.file?.storageName) return res.status(404).json({ ok: false, error: "Uploaded file not found" });
  const filePath = path.join(secureDocumentsDir, path.basename(document.file.storageName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Uploaded file not found" });
  res.set("Content-Type", document.file.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${document.file.originalName.replace(/[\r\n"]/g, "")}"`);
  return res.sendFile(filePath);
});

app.get("/api/whatsapp/inbox/media/:id/download", requireAdmin, (req, res) => {
  const note = ensureOperationsCaseNotes().find((item) => item.id === req.params.id);
  if (!note?.media?.storageName) return res.status(404).json({ ok: false, error: "Voice note file not found" });
  const filePath = path.join(secureDocumentsDir, path.basename(note.media.storageName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Voice note file not found" });
  res.set("Content-Type", note.media.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${String(note.media.originalName || "voice-note").replace(/[\r\n"]/g, "")}"`);
  return res.sendFile(filePath);
});

app.post("/api/whatsapp/smart-reminders/run", requireAdmin, rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  const summary = sweepOperationsReminders({ fullAutomation: false });
  if (req.body?.processQueue !== false) {
    summary.delivery = await processOperationsNotifications({
      limit: 50,
      forceRetry: Boolean(req.body?.forceRetry)
    });
  }
  return res.json({
    ok: true,
    summary,
    whatsapp: getWhatsAppConfigStatus()
  });
});

app.post("/api/whatsapp/queue/process", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const summary = await processOperationsNotifications({
    limit: 50,
    forceRetry: Boolean(req.body?.forceRetry)
  });
  return res.json({
    ok: true,
    summary,
    whatsapp: getWhatsAppConfigStatus()
  });
});

app.get("/api/analytics", requireAdmin, (_req, res) => {
  res.json({ ok: true, analytics: getAnalyticsSummary() });
});

app.get("/api/followup-risk", requireAdmin, (_req, res) => {
  const sessions = Array.from(leadSessions.values())
    .filter(isLiveLeadSession)
    .map((session) => {
      const sla = getLeadSlaState(session);
      const escalations = getLeadEscalationFlags(session);
      return {
        id: session.id,
        label: session.label,
        intent: session.intent,
        createdAt: session.createdAt,
        firstContactAt: session.firstContactAt || null,
        state: sla.state,
        elapsedMinutes: sla.elapsedMinutes,
        escalated: escalations.length > 0,
        escalationCount: escalations.length,
        scoreBand: session.scoring?.band || "Unknown",
        score: session.scoring?.score ?? null,
        snapshot: getSessionCopilot(session).snapshot || ""
      };
    })
    .filter((x) => x.state === "at-risk" || x.state === "overdue" || x.escalated)
    .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);
  res.json({ ok: true, slaMinutes: SLA_MINUTES, leads: sessions });
});

app.get("/api/followup-tasks", requireAdmin, (req, res) => {
  const limitRaw = Number(req.query?.limit || 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
  const allTasks = getAutomatedFollowUpTasks();
  const tasks = allTasks.slice(0, limit);
  const summary = allTasks.reduce(
    (acc, task) => {
      acc.total += 1;
      acc.byStatus[task.status] = (acc.byStatus[task.status] || 0) + 1;
      acc.byPriority[task.priority] = (acc.byPriority[task.priority] || 0) + 1;
      return acc;
    },
    { total: 0, shown: tasks.length, byStatus: {}, byPriority: {} }
  );
  res.json({ ok: true, tasks, summary });
});

app.get("/api/concierge-daily-report", requireAdmin, (req, res) => {
  const report = buildConciergeDailyReport();
  const format = (req.query?.format || "json").toString().trim().toLowerCase();
  if (format === "csv") {
    const csv = buildConciergeDailyReportCsv(report);
    const datePart = report.windows?.localDateLabel
      ? report.windows.localDateLabel.replace(/[^\d]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
      : new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"axiom-concierge-daily-report-${datePart || "today"}.csv\"`);
    return res.status(200).send(csv);
  }
  return res.json({ ok: true, ...report });
});

app.get("/api/lead-automation/status", requireAdmin, (_req, res) => {
  const automation = operationsStore.automation || {};
  return res.json({
    ok: true,
    status: {
      enabled: AUTO_LEAD_AUTOMATION_ENABLED,
      intervalMs: LEAD_AUTOMATION_INTERVAL_MS,
      digestEnabled: AUTO_CONCIERGE_DIGEST_ENABLED,
      digestTimeLocal: `${String(AUTO_CONCIERGE_DIGEST_HOUR).padStart(2, "0")}:${String(AUTO_CONCIERGE_DIGEST_MINUTE).padStart(2, "0")}`,
      lastLeadAutomationRunAt: automation.lastLeadAutomationRunAt || null,
      lastLeadAutomationSummary: automation.lastLeadAutomationSummary || null,
      lastLeadDocumentReminderRunAt: automation.lastLeadDocumentReminderRunAt || null,
      lastLeadDocumentReminderSummary: automation.lastLeadDocumentReminderSummary || null,
      lastLeadDeadlineAutomationRunAt: automation.lastLeadDeadlineAutomationRunAt || null,
      lastLeadDeadlineAutomationSummary: automation.lastLeadDeadlineAutomationSummary || null,
      lastLeadWowAutomationRunAt: automation.lastLeadWowAutomationRunAt || null,
      lastLeadWowAutomationSummary: automation.lastLeadWowAutomationSummary || null,
      lastLeadProactiveAutomationRunAt: automation.lastLeadProactiveAutomationRunAt || null,
      lastLeadProactiveAutomationSummary: automation.lastLeadProactiveAutomationSummary || null,
      proactiveCadence: {
        ackDays: LEAD_PROACTIVE_ACK_DAYS,
        missingDocsDays: LEAD_PROACTIVE_MISSING_DOCS_DAYS,
        statusCheckDays: LEAD_PROACTIVE_STATUS_CHECK_DAYS,
        reactivationDays: LEAD_PROACTIVE_REACTIVATION_DAYS,
        cooldownHours: LEAD_PROACTIVE_COOLDOWN_HOURS,
        quietStartHour: LEAD_PROACTIVE_QUIET_START_HOUR,
        quietEndHour: LEAD_PROACTIVE_QUIET_END_HOUR
      },
      lastConciergeDigestDay: automation.lastConciergeDigestDay || null,
      lastConciergeDigestAt: automation.lastConciergeDigestAt || null,
      lastConciergeDigestStatus: automation.lastConciergeDigestStatus || null,
      lastConciergeDigestReason: automation.lastConciergeDigestReason || null
    }
  });
});

app.post("/api/lead-automation/run-now", requireAdmin, rateLimit({ windowMs: 60000, max: 6 }), async (_req, res) => {
  const result = await runLeadAutomationCycle();
  return res.json({ ok: true, result });
});

function getLeadCreatedRange(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (period === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  return null;
}

function isSessionReferred(session) {
  return Boolean(session.assignedAgent?.name || session.agentAccess?.createdAt || session.agentAccess?.acknowledgedAt);
}

function hasReferralAcceptanceRecorded(session) {
  const proof = session?.dealProof || null;
  return Boolean(
    session?.agentAccess?.acknowledgedAt ||
      proof?.referralAcceptance?.acceptedAt
  );
}

function requireReferralAcceptanceForAgentWork(req, res, next) {
  const id = req.params.id;
  const session = id ? leadSessions.get(id) : null;
  if (!session) {
    return res.status(404).json({ ok: false, error: "Lead not found" });
  }
  if (!isSessionReferred(session)) return next();
  if (hasReferralAcceptanceRecorded(session)) return next();

  const agentAccess = session.agentAccess || {};
  const hasActiveLink = isAgentAccessActive(agentAccess);
  const agentAckUrl = hasActiveLink && agentAccess.token
    ? buildAgentUpdateUrl(req, agentAccess.token)
    : null;

  return res.status(409).json({
    ok: false,
    error: "Referral acceptance is required before this lead can be worked.",
    code: "referral-acceptance-required",
    leadId: id,
    requiresAgentAck: true,
    agentAckUrl,
    hasActiveAgentLink: hasActiveLink
  });
}

function isSessionClosed(session) {
  const lifecycle = getLeadLifecycle(session);
  const outcome = session?.outcome || {};
  if (outcome.commercialStatus === "archived" || outcome.caseMode === "archived") return true;
  if (["sale-concluded", "closed"].includes(lifecycle.code)) return true;
  const status = (session.dealProtection?.status || "").toLowerCase();
  return ["closed won", "cold", "lost"].includes(status);
}

function inferLeadCommercialStatus(session) {
  const outcome = session?.outcome || {};
  if (outcome.commercialStatus && leadCommercialStatusOptions.includes(outcome.commercialStatus)) {
    return outcome.commercialStatus;
  }
  const payoutStatus = session?.dealProof?.commission?.payoutStatus || "";
  const dealStatus = session?.dealProtection?.status || "";
  if (payoutStatus === "Paid") return "referral_fee_paid";
  if (["Due", "Invoiced"].includes(payoutStatus)) return "referral_fee_due";
  if (dealStatus === "Closed won") return "transaction_closed";
  if (session?.agentContact?.contactedAt) return "client_contacted";
  if (session?.agentAccess?.acknowledgedAt) return "accepted_by_agent";
  if (isSessionReferred(session)) return "handed_off";
  return "new";
}

function inferLeadCaseMode(session) {
  const outcome = session?.outcome || {};
  if (outcome.caseMode && leadCaseModeOptions.includes(outcome.caseMode)) return outcome.caseMode;
  const commercialStatus = inferLeadCommercialStatus(session);
  if (["referral_fee_paid", "archived"].includes(commercialStatus)) return "referral_only";
  if (["under_management", "transaction_closed"].includes(commercialStatus)) return "managed_transaction";
  return "undecided";
}

function getLeadOutcomeSummary(session) {
  const outcome = session?.outcome || {};
  const caseMode = inferLeadCaseMode(session);
  const commercialStatus = inferLeadCommercialStatus(session);
  const responsibilityEnds =
    caseMode === "referral_only" && ["referral_fee_paid", "archived"].includes(commercialStatus);
  return {
    caseMode,
    caseModeLabel: leadCaseModeLabels[caseMode] || caseMode,
    commercialStatus,
    commercialStatusLabel: leadCommercialStatusLabels[commercialStatus] || commercialStatus,
    responsibilityEnds,
    note: outcome.note || "",
    updatedAt: outcome.updatedAt || null,
    updatedBy: outcome.updatedBy || null
  };
}

function toDateInputValue(value) {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return "";
  return new Date(time).toISOString().slice(0, 10);
}

function getLifecycleRank(code) {
  return leadLifecycleStages.find((stage) => stage.code === code)?.rank || 0;
}

function maybeAdvanceLeadLifecycle(session, code, options = {}) {
  if (!leadLifecycleStageCodes.includes(code)) return false;
  const current = getLeadLifecycle(session);
  if (getLifecycleRank(code) <= getLifecycleRank(current.code)) return false;
  session.lifecycleStage = {
    code,
    note: options.note || current.note || "",
    updatedAt: options.updatedAt || new Date().toISOString(),
    source: options.source || "outcome-behavior"
  };
  return true;
}

function mapWorkflowOwnerLabel(owner = "") {
  const value = normaliseMatchText(owner || "");
  if (!value) return "Concierge";
  if (value.includes("bond") || value.includes("finance")) return "Bond originator";
  if (value.includes("attorney")) return "Attorney";
  if (value.includes("seller")) return "Seller";
  if (value.includes("buyer")) return "Buyer";
  if (value.includes("agent")) return "Agent";
  if (value.includes("concierge")) return "Concierge";
  return "Concierge";
}

function getLeadOutcomeWorkflow(session) {
  const outcome = getLeadOutcomeSummary(session);
  const timeline = buildTransactionTimelineSummary(session);
  const commission = buildCommissionProtectionSummary(session);
  const lifecycle = getLeadLifecycle(session);
  const referred = isSessionReferred(session);
  const responsibilityEnds = outcome.responsibilityEnds || isSessionClosed(session);
  const nextMilestoneOwner = mapWorkflowOwnerLabel(timeline.nextMilestone?.owner || "");

  let activeTrack = "undecided";
  let queueLane = "qualification";
  let trackingScope = "Lead qualification, routing, and first response.";
  let automationFocus = "Capture intake cleanly, route fast, and confirm first response.";
  let responsibilityBoundary = "Choose referral-only or managed transaction to lock the operating model.";
  let primaryOwner = referred ? "Agent" : "Concierge";
  let nextControl = referred ? "Confirm the operating model and the first dated update." : "Assign or confirm the receiving specialist.";
  let documentScope = "intake-and-routing";

  if (responsibilityEnds) {
    activeTrack = "closed";
    queueLane = "closure";
    trackingScope = "Audit trail, payment proof, and closure evidence only.";
    automationFocus = "Keep proof intact, suppress unnecessary chase work, and prepare archive.";
    responsibilityBoundary = "Axiom responsibility has ended unless the case is reopened manually.";
    primaryOwner = "Concierge";
    nextControl =
      outcome.commercialStatus === "referral_fee_paid"
        ? "Store proof of payment and archive the referral."
        : "Confirm closure evidence and archive the case.";
    documentScope = "closure-proof";
  } else if (outcome.caseMode === "managed_transaction") {
    activeTrack = "managed-transaction";
    queueLane = "managed-transaction";
    trackingScope = "Full transaction tracking from introduction through registration and handover.";
    automationFocus = "Milestones, stakeholder nudges, document readiness, and transfer recovery.";
    responsibilityBoundary = "Axiom stays active until the transaction is closed or archived.";
    primaryOwner = nextMilestoneOwner || mapWorkflowOwnerLabel(session.caseFile?.owner || "Agent");
    nextControl = timeline.nextMilestone
      ? `Advance ${timeline.nextMilestone.label} with ${nextMilestoneOwner || "the current owner"}.`
      : "Keep the transaction moving and record the next dated milestone.";
    documentScope = "full-transaction";
  } else if (outcome.caseMode === "referral_only") {
    activeTrack = "referral-protection";
    queueLane = "referral-protection";
    trackingScope = "Referral proof, agent accountability, and commission outcome only.";
    automationFocus = "Introduction proof, contact confirmation, payout readiness, and fee chase.";
    responsibilityBoundary = "Axiom tracks the referral until the fee is paid, waived, or archived.";
    primaryOwner =
      ["referral_fee_due", "referral_fee_paid"].includes(outcome.commercialStatus) || commission.payoutStatus === "Invoiced"
        ? "Concierge"
        : session.agentContact?.contactedAt
          ? "Agent"
          : referred
            ? "Concierge"
            : "Concierge";
    nextControl =
      outcome.commercialStatus === "referral_fee_due"
        ? commission.nextAction || "Issue or chase the referral invoice."
        : referred
          ? "Protect the referral proof and get the next dated update from the receiving agent."
          : "Complete the introduction and lock referral proof before the deal moves.";
    documentScope = "referral-proof";
  }

  return {
    ...outcome,
    activeTrack,
    queueLane,
    trackingScope,
    automationFocus,
    responsibilityBoundary,
    primaryOwner,
    nextControl,
    documentScope,
    nextMilestoneOwner,
    lifecycleLabel: lifecycle.label
  };
}

function getOutcomeWorkflowDueAt(session, workflow) {
  if (!workflow || workflow.activeTrack === "closed") return null;
  if (workflow.activeTrack === "managed-transaction") {
    return addMinutesIso(getLatestLeadActivityAt(session) || session.updatedAt || session.createdAt, 24 * 60);
  }
  if (workflow.activeTrack === "referral-protection") {
    const commission = buildCommissionProtectionSummary(session);
    return commission.payoutDueDate ? new Date(commission.payoutDueDate).toISOString() : addMinutesIso(getLatestLeadActivityAt(session) || session.updatedAt || session.createdAt, 48 * 60);
  }
  return addMinutesIso(session.updatedAt || session.createdAt, 4 * 60);
}

function applyOutcomeWorkflowBehavior(session, options = {}) {
  const now = options.updatedAt || new Date().toISOString();
  const workflow = getLeadOutcomeWorkflow(session);
  const note = options.note || workflow.nextControl;
  let targetStage = "intake-received";

  if (workflow.activeTrack === "closed") {
    targetStage = workflow.caseMode === "archived" || workflow.commercialStatus === "archived" ? "archived" : "sale-concluded";
    session.lifecycleStage = {
      code: "closed",
      note,
      updatedAt: now,
      source: options.source || "outcome-behavior"
    };
  } else if (workflow.activeTrack === "managed-transaction") {
    targetStage =
      workflow.commercialStatus === "transaction_closed"
        ? "sale-concluded"
        : session.agentContact?.contactedAt || workflow.commercialStatus === "under_management"
          ? "active-follow-up"
          : isSessionReferred(session)
            ? "specialist-assigned"
            : "brief-qualified";
    if (workflow.commercialStatus === "transaction_closed") {
      maybeAdvanceLeadLifecycle(session, "sale-concluded", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    } else if (session.agentContact?.contactedAt) {
      maybeAdvanceLeadLifecycle(session, "with-agent", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    } else if (isSessionReferred(session)) {
      maybeAdvanceLeadLifecycle(session, "referred", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    }
  } else if (workflow.activeTrack === "referral-protection") {
    targetStage =
      ["referral_fee_due", "referral_fee_paid"].includes(workflow.commercialStatus)
        ? "sale-concluded"
        : workflow.commercialStatus === "client_contacted"
          ? "active-follow-up"
          : isSessionReferred(session) || ["accepted_by_agent", "handed_off"].includes(workflow.commercialStatus)
            ? "specialist-assigned"
            : "brief-qualified";
    if (workflow.commercialStatus === "client_contacted") {
      maybeAdvanceLeadLifecycle(session, "contact-confirmed", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    }
    if (["referral_fee_due", "referral_fee_paid"].includes(workflow.commercialStatus)) {
      maybeAdvanceLeadLifecycle(session, "sale-concluded", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    } else if (isSessionReferred(session)) {
      maybeAdvanceLeadLifecycle(session, "referred", { note, updatedAt: now, source: options.source || "outcome-behavior" });
    }
  } else {
    targetStage = isSessionReferred(session) ? "specialist-assigned" : session.conciergeAcknowledgedAt ? "brief-qualified" : "intake-received";
  }

  updateLeadCaseStage(session, targetStage, {
    source: options.source || "outcome-behavior",
    actor: options.actor || "System",
    note,
    owner: workflow.primaryOwner,
    dueAt: getOutcomeWorkflowDueAt(session, workflow),
    allowBackward: workflow.activeTrack === "closed"
  });

  if (workflow.activeTrack !== "closed") {
    const currentDeal = session.dealProtection || {};
    session.dealProtection = {
      status: currentDeal.status || "Active",
      commissionAgreement: currentDeal.commissionAgreement || "Not discussed",
      nextCheckIn: currentDeal.nextCheckIn || toDateInputValue(getOutcomeWorkflowDueAt(session, workflow)),
      note: currentDeal.note || "",
      updatedAt: currentDeal.updatedAt || now
    };
  }

  return getLeadOutcomeWorkflow(session);
}

function updateLeadOutcome(session, patch = {}, actor = "Concierge", source = "lead-outcome") {
  const previous = getLeadOutcomeSummary(session);
  const caseMode = leadCaseModeOptions.includes(patch.caseMode) ? patch.caseMode : previous.caseMode;
  const commercialStatus = leadCommercialStatusOptions.includes(patch.commercialStatus)
    ? patch.commercialStatus
    : previous.commercialStatus;
  const note = sanitizeShortText(patch.note ?? previous.note ?? "", 500);
  const now = new Date().toISOString();

  session.outcome = {
    caseMode,
    commercialStatus,
    note,
    updatedAt: now,
    updatedBy: actor
  };

  if (caseMode === "managed_transaction" && commercialStatus === "new") {
    session.outcome.commercialStatus = "under_management";
  }
  if (caseMode === "archived") {
    session.outcome.commercialStatus = "archived";
    session.lifecycleStage = { code: "closed", note: note || "Archived from outcome mode", updatedAt: now, source };
  }
  if (caseMode === "referral_only" && commercialStatus === "referral_fee_paid") {
    session.lifecycleStage = { code: "closed", note: note || "Referral fee paid. Axiom responsibility ended.", updatedAt: now, source };
  }
  if (caseMode === "managed_transaction" && commercialStatus === "under_management") {
    updateLeadCaseStage(session, "active-follow-up", {
      source,
      actor,
      note: note || "Lead moved into managed transaction mode"
    });
  }
  applyOutcomeWorkflowBehavior(session, {
    actor,
    source,
    note: note || `Operating mode: ${leadCaseModeLabels[session.outcome.caseMode]} / ${leadCommercialStatusLabels[session.outcome.commercialStatus]}`,
    updatedAt: now
  });

  appendLeadAuditEvent(session, {
    type: "outcome-updated",
    actor,
    source,
    summary: `Outcome set to ${leadCaseModeLabels[session.outcome.caseMode]} / ${leadCommercialStatusLabels[session.outcome.commercialStatus]}`,
    details: note || "No outcome note"
  });
  return getLeadOutcomeSummary(session);
}

function getSessionSearchText(session) {
  const slots = getSessionSlots(session);
  const duplicateSignals = refreshSessionDedupeSignals(session);
  const outcome = getLeadOutcomeSummary(session);
  return [
    session.label,
    session.intent,
    session.id,
    slots.fullName,
    slots.phone,
    slots.email,
    slots.area,
    slots.province,
    slots.priceDisplay,
    slots.propertyType,
    slots.timeline,
    session.assignedAgent?.name,
    session.assignedAgent?.phone,
    session.assignedAgent?.agency,
    session.agentContact?.medium,
    session.agentContact?.note,
    session.dealProtection?.status,
    session.dealProtection?.commissionAgreement,
    session.dealProtection?.note,
    session.dealProof?.commission?.payoutStatus,
    session.dealProof?.commission?.payoutReference,
    buildCommissionProtectionSummary(session).nextAction,
    buildCommissionProtectionSummary(session).dueState,
    buildTransactionTimelineSummary(session).currentMilestone?.label,
    buildTransactionTimelineSummary(session).nextMilestone?.label,
    outcome.caseModeLabel,
    outcome.commercialStatusLabel,
    outcome.note,
    session.dealProof?.referralAcceptance?.acceptedBy,
    ...(Array.isArray(session.dealProof?.milestones) ? session.dealProof.milestones.map((item) => `${item.label} ${item.note || ""} ${item.proofRef || ""}`) : []),
    session.acquisition?.source,
    session.acquisition?.medium,
    session.acquisition?.campaign,
    duplicateSignals?.recommendation,
    ...(duplicateSignals?.matchedLeadIds || []),
    getLeadLifecycle(session).label,
    getSessionCopilot(session).snapshot
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

app.get("/api/leads/recent", requireAdmin, (req, res) => {
  const limitRaw = Number(req.query?.limit || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const period = (req.query?.period || "all").toString().trim().toLowerCase();
  const sort = (req.query?.sort || "latest").toString().trim().toLowerCase();
  const referral = (req.query?.referral || "all").toString().trim().toLowerCase();
  const status = (req.query?.status || "all").toString().trim().toLowerCase();
  const dataset = (req.query?.dataset || "live").toString().trim().toLowerCase();
  const search = (req.query?.search || "").toString().trim().toLowerCase();
  const startTime = getLeadCreatedRange(period);
  const filteredSessions = Array.from(leadSessions.values())
    .filter((session) => {
      const dataClass = getSessionDataClass(session);
      if (dataset !== "all" && dataClass !== dataset) return false;
      const created = new Date(session.createdAt).getTime();
      if (startTime && created < startTime) return false;
      const referred = isSessionReferred(session);
      if (referral === "referred" && !referred) return false;
      if (referral === "unreferred" && referred) return false;
      const closed = isSessionClosed(session);
      if (status === "open" && closed) return false;
      if (status === "closed" && !closed) return false;
      if (status === "in-progress") {
        const code = getLeadLifecycle(session).code;
        return ["acknowledged", "referred", "contact-confirmed"].includes(code);
      }
      if (status === "with-agent") {
        const code = getLeadLifecycle(session).code;
        return [
          "with-agent",
          "with-agent-1-week",
          "with-agent-2-weeks",
          "with-agent-1-month",
          "with-agent-1-month-plus"
        ].includes(code);
      }
      if (leadLifecycleStageCodes.includes(status) && getLeadLifecycle(session).code !== status) return false;
      if (search && !getSessionSearchText(session).includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  const sessions = filteredSessions
    .slice(0, limit)
    .map((session) => {
      const duplicateSignals = refreshSessionDedupeSignals(session);
      const agentMatch = buildAgentMatchRecommendation(session);
      const followUpIntelligence = buildFollowUpIntelligence(session);
      const intakeIntelligence = buildLeadIntakeIntelligence(session, session.scoring || null);
      const outcomeWorkflow = getLeadOutcomeWorkflow(session);
      return {
        id: session.id,
        label: session.label,
        intent: session.intent,
        createdAt: session.createdAt,
        slots: getSessionSlots(session),
        conciergeAcknowledgedAt: session.conciergeAcknowledgedAt || null,
        referred: isSessionReferred(session),
        queueStatus: isSessionClosed(session) ? "closed" : "open",
        outcome: getLeadOutcomeSummary(session),
        outcomeWorkflow,
        lifecycle: getLeadLifecycle(session),
        dataClass: getSessionDataClass(session),
        scoring: session.scoring || null,
        intakeIntelligence,
        acquisition: session.acquisition || null,
        copilot: getSessionCopilot(session),
        followUpPlaybook: session.followUpPlaybook || [],
        objectionPlaybook: session.objectionPlaybook || [],
        autoAcknowledgement: session.autoAcknowledgement || null,
        delivery: session.delivery || null,
        clientConfirmationDelivery: session.clientConfirmationDelivery || null,
        assignedAgent: session.assignedAgent || null,
        agentContact: session.agentContact || null,
        agentHandoff: buildAgentHandoffSummary(session, req),
        dealProtection: session.dealProtection || null,
        dealProof: ensureDealProofState(session),
        commissionProtection: buildCommissionProtectionSummary(session),
        commissionLock: buildCommissionLockSummary(session),
        deadlineChase: buildLeadDeadlineChaseSummary(session),
        transactionTimeline: buildTransactionTimelineSummary(session),
        leadDocuments: getLeadDocumentSummary(session).slice(0, 12),
        missingLeadDocuments: getMissingLeadDocumentLabels(session),
        requiredLeadDocuments: getRequiredLeadDocumentLabels(session),
        documentVaultSummary: buildLeadDocumentVaultSummary(session),
        documentReminderLog: getLeadDocumentReminderSummary(session),
        deadlineReminderLog: getLeadDeadlineReminderSummary(session),
        caseFile: getLeadCaseFileSummary(session),
        escalationFlags: getLeadEscalationFlags(session),
        escalationSummary: buildLeadEscalationSummary(session),
        proofTrail: ensureLeadAuditTrail(session).slice(-12),
        duplicateSignals,
        nextBestAction: buildNextBestAction(session),
        agentAccess: getAgentAccessSummary(session, req),
        stakeholderAccess: getStakeholderAccessSummary(session, req),
        agentMatch,
        followUpIntelligence,
        agentUpdates: Array.isArray(session.agentUpdates) ? session.agentUpdates.slice(-5) : [],
        stakeholderUpdates: Array.isArray(session.stakeholderUpdates) ? session.stakeholderUpdates.slice(-10) : [],
        stageUpdateNotifications: getLeadStageUpdateSummary(session),
        wowAutomation: getLeadWowAutomationSummary(session)
      };
    });
  res.json({
    ok: true,
    leads: sessions,
    filters: { period, sort, referral, status, dataset, search, limit },
    totalMatches: filteredSessions.length,
    dataClasses: getLeadDataClassSummary()
  });
});

app.post("/api/leads/:id/contacted", requireAdmin, requireReferralAcceptanceForAgentWork, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const medium = (req.body?.medium || "Not specified").toString().trim();
  const note = (req.body?.note || "").toString().trim();
  if (!contactMediumOptions.includes(medium)) return res.status(400).json({ ok: false, error: "Invalid contact medium" });
  if (note.length > 240) return res.status(400).json({ ok: false, error: "Contact note is too long" });

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "contact-confirmed");
  const contactedAt = new Date().toISOString();
  session.firstContactAt = contactedAt;
  session.agentContact = {
    medium,
    note,
    contactedAt
  };
  updateLeadOutcome(
    session,
    {
      caseMode: inferLeadCaseMode(session),
      commercialStatus: "client_contacted",
      note: note || "Client contact confirmed"
    },
    "Concierge",
    "contact-confirmed"
  );
  appendLeadAuditEvent(session, {
    type: "contact-confirmed",
    actor: "Concierge",
    source: "operations",
    summary: `Client contact confirmed via ${medium}`,
    details: note || "No additional note"
  });
  syncLeadCaseFile(session, { source: "contact-confirmed", actor: "Concierge", note });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    firstContactAt: session.firstContactAt,
    agentContact: session.agentContact,
    caseFile: getLeadCaseFileSummary(session)
  });
});

app.post("/api/leads/:id/assign-agent", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const agentName = (req.body?.agentName || "").toString().trim();
  const agentPhone = cleanPhoneNumber((req.body?.agentPhone || "").toString().trim());
  const agentAgency = (req.body?.agentAgency || "").toString().trim();
  if (!agentName) return res.status(400).json({ ok: false, error: "Agent name is required" });
  if (agentName.length > 120) return res.status(400).json({ ok: false, error: "Agent name is too long" });
  if (req.body?.agentPhone && !agentPhone) return res.status(400).json({ ok: false, error: "Invalid agent cellphone number" });
  if (!agentAgency) return res.status(400).json({ ok: false, error: "Agency is required" });
  if (agentAgency.length > 160) return res.status(400).json({ ok: false, error: "Agency name is too long" });

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "agent-assigned");
  session.assignedAgent = {
    name: agentName,
    phone: agentPhone || "",
    agency: agentAgency,
    assignedAt: new Date().toISOString()
  };
  updateLeadOutcome(
    session,
    {
      caseMode: inferLeadCaseMode(session),
      commercialStatus: "handed_off",
      note: `Assigned to ${agentName}${agentAgency ? ` at ${agentAgency}` : ""}`
    },
    "Concierge",
    "agent-assigned"
  );
  appendLeadAuditEvent(session, {
    type: "agent-assigned",
    actor: "Concierge",
    source: "operations",
    summary: `Lead assigned to ${agentName}`,
    details: [agentAgency, agentPhone].filter(Boolean).join(" | ") || "No extra assignment details"
  });
  syncLeadCaseFile(session, { source: "agent-assigned", actor: "Concierge", note: `Assigned ${agentName}` });
  const stageUpdateDelivery = await deliverLeadStageUpdate(session, {
    code: "agent-assigned",
    label: "Agent assigned",
    note: `Assigned to ${agentName}${agentAgency ? ` at ${agentAgency}` : ""}`,
    includeAgent: false,
    source: "agent-assigned"
  });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    assignedAgent: session.assignedAgent,
    caseFile: getLeadCaseFileSummary(session),
    stageUpdateDelivery
  });
});

app.post("/api/leads/:id/deal-protection", requireAdmin, requireReferralAcceptanceForAgentWork, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });

  const status = (req.body?.status || "").toString().trim();
  const commissionAgreement = (req.body?.commissionAgreement || "").toString().trim();
  const nextCheckIn = (req.body?.nextCheckIn || "").toString().trim();
  const note = (req.body?.note || "").toString().trim();

  if (!dealStatusOptions.includes(status)) return res.status(400).json({ ok: false, error: "Invalid deal status" });
  if (!commissionAgreementOptions.includes(commissionAgreement)) {
    return res.status(400).json({ ok: false, error: "Invalid commission agreement status" });
  }
  if (nextCheckIn && Number.isNaN(new Date(nextCheckIn).getTime())) {
    return res.status(400).json({ ok: false, error: "Invalid next check-in date" });
  }
  if (note.length > 500) return res.status(400).json({ ok: false, error: "Deal note is too long" });

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "deal-protection");
  session.dealProtection = {
    status,
    commissionAgreement,
    nextCheckIn: nextCheckIn || null,
    note,
    updatedAt: new Date().toISOString()
  };
  appendLeadAuditEvent(session, {
    type: "deal-protection-updated",
    actor: "Concierge",
    source: "operations",
    summary: `Deal status updated to ${status}`,
    details: `Commission: ${commissionAgreement}${nextCheckIn ? ` | Next check-in: ${nextCheckIn}` : ""}${note ? ` | ${note}` : ""}`
  });
  syncLeadCaseFile(session, { source: "deal-protection", actor: "Concierge", note });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();
  return res.json({ ok: true, id, dealProtection: session.dealProtection, caseFile: getLeadCaseFileSummary(session) });
});

app.post("/api/leads/:id/outcome", requireAdmin, requireReferralAcceptanceForAgentWork, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });

  const caseMode = sanitizeShortText(req.body?.caseMode || "", 40);
  const commercialStatus = sanitizeShortText(req.body?.commercialStatus || "", 40);
  const note = sanitizeShortText(req.body?.note || "", 500);

  if (!leadCaseModeOptions.includes(caseMode)) return res.status(400).json({ ok: false, error: "Invalid case mode" });
  if (!leadCommercialStatusOptions.includes(commercialStatus)) {
    return res.status(400).json({ ok: false, error: "Invalid commercial status" });
  }
  if (caseMode === "referral_only" && commercialStatus === "under_management") {
    return res.status(400).json({ ok: false, error: "Referral-only leads cannot be under managed transaction" });
  }
  if (caseMode === "managed_transaction" && ["referral_fee_paid", "archived"].includes(commercialStatus)) {
    return res.status(400).json({ ok: false, error: "Choose transaction closed or under management for managed transaction cases" });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "lead-outcome");
  const outcome = updateLeadOutcome(session, { caseMode, commercialStatus, note }, "Concierge", "lead-outcome");
  syncLeadCaseFile(session, { source: "lead-outcome", actor: "Concierge", note: note || outcome.commercialStatusLabel });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();

  return res.json({
    ok: true,
    id,
    outcome,
    lifecycle: getLeadLifecycle(session),
    caseFile: getLeadCaseFileSummary(session),
    dealProtection: session.dealProtection || null
  });
});

app.post("/api/leads/:id/deal-proof/acceptance", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const acceptedBy = sanitizeShortText(req.body?.acceptedBy || "", 120);
  const via = sanitizeShortText(req.body?.via || "", 40);
  const note = sanitizeShortText(req.body?.note || "", 500);
  if (!acceptedBy) return res.status(400).json({ ok: false, error: "Accepted by is required" });
  if (!referralAcceptanceViaOptions.includes(via)) {
    return res.status(400).json({ ok: false, error: "Invalid acceptance channel" });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "deal-proof-acceptance");
  const updatedAt = new Date().toISOString();
  const dealProof = ensureDealProofState(session);
  dealProof.referralAcceptance = {
    acceptedAt: updatedAt,
    acceptedBy,
    via,
    note
  };
  upsertDealMilestone(session, {
    code: "referral-accepted",
    label: getMilestoneLabel("referral-accepted"),
    completedAt: updatedAt,
    actor: acceptedBy,
    via,
    note,
    proofRef: ""
  });
  updateLeadOutcome(
    session,
    {
      caseMode: inferLeadCaseMode(session),
      commercialStatus: "accepted_by_agent",
      note: note || `Referral terms accepted by ${acceptedBy}`
    },
    "Concierge",
    "deal-proof-acceptance"
  );
  appendLeadAuditEvent(session, {
    type: "referral-accepted",
    actor: "Concierge",
    source: "operations",
    summary: `Referral terms accepted by ${acceptedBy}`,
    details: `${via}${note ? ` | ${note}` : ""}`
  });
  syncLeadCaseFile(session, { source: "deal-proof-acceptance", actor: "Concierge", note: `${acceptedBy} accepted referral terms` });
  const stageUpdateDelivery = await deliverLeadStageUpdate(session, {
    code: "referral-accepted",
    label: getMilestoneLabel("referral-accepted"),
    note: note || `${acceptedBy} accepted the referral terms via ${via}`,
    includeAgent: false,
    source: "deal-proof-acceptance"
  });
  session.updatedAt = updatedAt;
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    dealProof: ensureDealProofState(session),
    commissionProtection: buildCommissionProtectionSummary(session),
    caseFile: getLeadCaseFileSummary(session),
    stageUpdateDelivery
  });
});

app.post("/api/leads/:id/deal-proof/milestone", requireAdmin, requireReferralAcceptanceForAgentWork, async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const code = sanitizeShortText(req.body?.code || "", 40);
  const actor = sanitizeShortText(req.body?.actor || "Concierge", 120);
  const via = sanitizeShortText(req.body?.via || "System note", 40);
  const note = sanitizeShortText(req.body?.note || "", 500);
  const proofRef = sanitizeShortText(req.body?.proofRef || "", 500);
  if (!dealMilestoneCodes.includes(code)) return res.status(400).json({ ok: false, error: "Invalid milestone" });
  if (via && !referralAcceptanceViaOptions.includes(via) && via !== "System note") {
    return res.status(400).json({ ok: false, error: "Invalid milestone channel" });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "deal-proof-milestone");
  const updatedAt = new Date().toISOString();
  const milestone = {
    code,
    label: getMilestoneLabel(code),
    completedAt: updatedAt,
    actor,
    via,
    note,
    proofRef
  };
  upsertDealMilestone(session, milestone);
  syncSessionFromMilestone(session, code, updatedAt);
  appendLeadAuditEvent(session, {
    type: "deal-milestone",
    actor: "Concierge",
    source: "operations",
    summary: `Milestone completed: ${milestone.label}`,
    details: [actor ? `By ${actor}` : "", via ? `Via ${via}` : "", note, proofRef].filter(Boolean).join(" | ")
  });
  syncLeadCaseFile(session, { source: "deal-proof-milestone", actor: "Concierge", note: `${milestone.label}${note ? ` - ${note}` : ""}` });
  const stageUpdateDelivery = await deliverLeadStageUpdate(session, {
    code,
    label: milestone.label,
    note,
    includeAgent: true,
    source: "deal-proof-milestone"
  });
  session.updatedAt = updatedAt;
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    dealProof: ensureDealProofState(session),
    lifecycle: getLeadLifecycle(session),
    dealProtection: session.dealProtection || null,
    transactionTimeline: buildTransactionTimelineSummary(session),
    caseFile: getLeadCaseFileSummary(session),
    stageUpdateDelivery
  });
});

app.post("/api/leads/:id/deal-proof/commission", requireAdmin, requireReferralAcceptanceForAgentWork, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const saleValue = asNumber(req.body?.saleValue, 0);
  const referralPercent = normalizeReferralPercent(req.body?.referralPercent);
  const payoutStatus = sanitizeShortText(req.body?.payoutStatus || "Not due", 40);
  const payoutDueDate = sanitizeShortText(req.body?.payoutDueDate || "", 40);
  const payoutReference = sanitizeShortText(req.body?.payoutReference || "", 160);
  const note = sanitizeShortText(req.body?.note || "", 500);
  if (saleValue < 0) return res.status(400).json({ ok: false, error: "Sale value cannot be negative" });
  if (!commissionPayoutStatusOptions.includes(payoutStatus)) {
    return res.status(400).json({ ok: false, error: "Invalid payout status" });
  }
  if (payoutDueDate && Number.isNaN(new Date(payoutDueDate).getTime())) {
    return res.status(400).json({ ok: false, error: "Invalid payout due date" });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "deal-proof-commission");
  const updatedAt = new Date().toISOString();
  const dealProof = ensureDealProofState(session);
  dealProof.commission = {
    saleValue: saleValue > 0 ? saleValue : null,
    referralPercent,
    expectedCommission: saleValue > 0 ? calculateExpectedReferralCommission(saleValue, referralPercent) : null,
    payoutStatus,
    payoutDueDate: payoutDueDate || null,
    payoutReference,
    note,
    updatedAt
  };
  updateLeadOutcome(
    session,
    {
      caseMode: payoutStatus === "Paid" ? "referral_only" : inferLeadCaseMode(session),
      commercialStatus: payoutStatus === "Paid" ? "referral_fee_paid" : ["Due", "Invoiced"].includes(payoutStatus) ? "referral_fee_due" : inferLeadCommercialStatus(session),
      note: note || `Commission tracker updated: ${payoutStatus}`
    },
    "Concierge",
    "deal-proof-commission"
  );
  appendLeadAuditEvent(session, {
    type: "commission-tracker-updated",
    actor: "Concierge",
    source: "operations",
    summary: `Commission tracker updated (${payoutStatus})`,
    details: `Sale value: ${saleValue > 0 ? saleValue : "Not set"} | Referral %: ${referralPercent}${payoutReference ? ` | Ref: ${payoutReference}` : ""}${note ? ` | ${note}` : ""}`
  });
  syncLeadCaseFile(session, { source: "deal-proof-commission", actor: "Concierge", note: note || `Payout status: ${payoutStatus}` });
  session.updatedAt = updatedAt;
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    dealProof: ensureDealProofState(session),
    caseFile: getLeadCaseFileSummary(session)
  });
});

app.get("/api/leads/:id/documents", requireAdmin, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  return res.json({
    ok: true,
    id,
    documents: getLeadDocumentSummary(session),
    categories: leadDocumentCategoryOptions
  });
});

app.post("/api/leads/:id/documents/upload", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const category = sanitizeShortText(req.body?.category, 80);
  const note = sanitizeShortText(req.body?.note, 500);
  const mimeType = sanitizeShortText(req.body?.mimeType, 160).toLowerCase();
  const originalName = safeBaseFilename(sanitizeShortText(req.body?.filename, 180) || "lead-document");
  const base64 = (req.body?.base64 || "").toString().trim();
  if (!leadDocumentCategoryOptions.includes(category)) {
    return res.status(400).json({ ok: false, error: "Invalid document category" });
  }
  if (!leadDocumentMimeAllowList.has(mimeType)) {
    return res.status(400).json({ ok: false, error: "Please upload PDF, JPG, PNG, DOC, DOCX or TXT files" });
  }
  if (!base64.includes(",")) return res.status(400).json({ ok: false, error: "Document upload could not be decoded" });
  const payload = base64.split(",")[1] || "";
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length) return res.status(400).json({ ok: false, error: "Document upload could not be decoded" });
  if (buffer.length > LEAD_DOCUMENT_MAX_BYTES) {
    return res.status(400).json({ ok: false, error: `Document exceeds ${Math.round(LEAD_DOCUMENT_MAX_BYTES / (1024 * 1024))}MB upload limit` });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "lead-document-upload");
  ensureDataDir();
  const ext = extFromMime(mimeType) || path.extname(originalName) || ".bin";
  const storageName = `${id}-${Date.now()}-${randomUUID()}${ext}`;
  const storagePath = path.join(leadVaultDir, storageName);
  fs.writeFileSync(storagePath, buffer);
  const entry = {
    id: randomUUID(),
    category,
    note,
    originalName,
    mimeType,
    size: buffer.length,
    storageName,
    uploadedAt: new Date().toISOString(),
    uploadedBy: "Concierge"
  };
  const docs = ensureLeadDocumentStore(session);
  docs.unshift(entry);
  appendLeadAuditEvent(session, {
    type: "lead-document-uploaded",
    actor: "Concierge",
    source: "operations",
    summary: `Document uploaded: ${category}`,
    details: `${originalName} (${Math.ceil(buffer.length / 1024)} KB)${note ? ` | ${note}` : ""}`
  });
  syncLeadCaseFile(session, { source: "lead-document-upload", actor: "Concierge", note: `${category}: ${originalName}` });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();

  return res.json({
    ok: true,
    id,
    document: {
      id: entry.id,
      category: entry.category,
      note: entry.note,
      originalName: entry.originalName,
      mimeType: entry.mimeType,
      size: entry.size,
      uploadedAt: entry.uploadedAt,
      uploadedBy: entry.uploadedBy
    },
    documents: getLeadDocumentSummary(session)
  });
});

app.get("/api/leads/:id/documents/:docId/download", requireAdmin, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  const docs = ensureLeadDocumentStore(session);
  const doc = docs.find((item) => item.id === req.params.docId);
  if (!doc?.storageName) return res.status(404).json({ ok: false, error: "Document not found" });
  const filePath = path.join(leadVaultDir, path.basename(doc.storageName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Document file missing" });
  res.set("Content-Type", doc.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${String(doc.originalName || "document").replace(/[\r\n"]/g, "")}"`);
  return res.sendFile(filePath);
});

app.post("/api/leads/:id/acknowledge", requireAdmin, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "lead-queue");
  appendLeadAuditEvent(session, {
    type: "lead-acknowledged",
    actor: "Concierge",
    source: "operations",
    summary: "Lead acknowledged by concierge",
    details: "Acknowledged from lead queue."
  });
  syncLeadCaseFile(session, { source: "lead-acknowledged", actor: "Concierge", note: "Lead acknowledged in queue" });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    conciergeAcknowledgedAt: session.conciergeAcknowledgedAt,
    lifecycle: getLeadLifecycle(session),
    caseFile: getLeadCaseFileSummary(session)
  });
});

app.post("/api/leads/:id/lifecycle", requireAdmin, requireReferralAcceptanceForAgentWork, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const code = (req.body?.stage || req.body?.code || "").toString().trim();
  const note = (req.body?.note || "").toString().trim();
  if (!manualLifecycleStageCodes.includes(code)) {
    return res.status(400).json({ ok: false, error: "Invalid manual pipeline stage" });
  }
  if (note.length > 500) return res.status(400).json({ ok: false, error: "Pipeline note is too long" });

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "pipeline-stage");
  const updatedAt = new Date().toISOString();
  session.lifecycleStage = { code, note, updatedAt, source: "operations" };
  if (code === "with-agent" && !session.agentEngagedAt) session.agentEngagedAt = updatedAt;
  if (code === "sale-pending") {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Offer pending",
      updatedAt,
      source: "pipeline"
    };
  }
  if (code === "sale-concluded") {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: "Closed won",
      updatedAt,
      source: "pipeline"
    };
  }
  if (code === "closed") {
    session.dealProtection = {
      ...(session.dealProtection || {}),
      status: session.dealProtection?.status || "Lost",
      updatedAt,
      source: "pipeline"
    };
  }
  appendLeadAuditEvent(session, {
    type: "lifecycle-updated",
    actor: "Concierge",
    source: "operations",
    summary: `Pipeline stage moved to ${code}`,
    details: note || "No pipeline note"
  });
  syncLeadCaseFile(session, { source: "pipeline-stage", actor: "Concierge", note, allowBackward: true });
  session.updatedAt = updatedAt;
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    lifecycle: getLeadLifecycle(session),
    dealProtection: session.dealProtection || null,
    caseFile: getLeadCaseFileSummary(session)
  });
});

function prepareAgentHandoff(session, req, options = {}) {
  const requestedName = (options.agentName || "").toString().trim();
  const requestedPhone = cleanPhoneNumber((options.agentPhone || "").toString().trim());
  const requestedAgency = (options.agentAgency || "").toString().trim();
  const refresh = Boolean(options.refresh);

  if (requestedName.length > 120) return { ok: false, status: 400, error: "Agent name is too long" };
  if (options.agentPhone && !requestedPhone) return { ok: false, status: 400, error: "Invalid agent cellphone number" };
  if (requestedAgency.length > 160) return { ok: false, status: 400, error: "Agency name is too long" };

  markConciergeAcknowledged(session, "agent-link");
  const agentName = requestedName || session.assignedAgent?.name || session.agentAccess?.agentName || "Receiving agent";
  const agentPhone = requestedPhone || session.assignedAgent?.phone || session.agentAccess?.agentPhone || "";
  const agentAgency = requestedAgency || session.assignedAgent?.agency || session.agentAccess?.agentAgency || "";
  const now = new Date().toISOString();
  const existingActive = isAgentAccessActive(session.agentAccess);

  if (!existingActive || refresh) {
    session.agentAccess = {
      token: randomUUID(),
      agentName,
      agentPhone,
      agentAgency,
      createdAt: now,
      expiresAt: addDaysIso(Number.isFinite(AGENT_LINK_TTL_DAYS) ? AGENT_LINK_TTL_DAYS : 30),
      acknowledgedAt: null,
      acknowledgementText: REFERRAL_ACKNOWLEDGEMENT_TEXT,
      lastViewedAt: null,
      revokedAt: null
    };
  } else {
    session.agentAccess.agentName = agentName;
    session.agentAccess.agentPhone = agentPhone;
    session.agentAccess.agentAgency = agentAgency;
    session.agentAccess.acknowledgementText = REFERRAL_ACKNOWLEDGEMENT_TEXT;
  }
  appendLeadAuditEvent(session, {
    type: "agent-link",
    actor: "Concierge",
    source: "operations",
    summary: refresh ? "Secure agent link refreshed" : "Secure agent link created",
    details: `Prepared for ${agentName}`
  });

  if (requestedName || requestedPhone || requestedAgency) {
    session.assignedAgent = {
      name: requestedName || session.assignedAgent?.name || agentName,
      phone: requestedPhone || session.assignedAgent?.phone || "",
      agency: requestedAgency || session.assignedAgent?.agency || "",
      assignedAt: session.assignedAgent?.assignedAt || now
    };
  }
  updateLeadOutcome(
    session,
    {
      caseMode: inferLeadCaseMode(session),
      commercialStatus: "handed_off",
      note: `Secure agent introduction prepared for ${agentName}`
    },
    "Concierge",
    "agent-link"
  );
  syncLeadCaseFile(session, {
    source: "agent-link-generated",
    actor: "Concierge",
    note: `Agent link prepared for ${agentName}`
  });

  session.updatedAt = now;
  return {
    ok: true,
    refresh,
    agentName,
    agentPhone,
    agentAgency,
    now,
    agentUrl: buildAgentUpdateUrl(req, session.agentAccess.token),
    agentShareText: buildAgentShareText(session, req),
    agentAccess: getAgentAccessSummary(session, req),
    caseFile: getLeadCaseFileSummary(session),
    acknowledgementText: REFERRAL_ACKNOWLEDGEMENT_TEXT
  };
}

app.post("/api/leads/:id/agent-link", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  const result = prepareAgentHandoff(session, req, req.body || {});
  if (!result.ok) return res.status(result.status || 400).json(result);
  leadSessions.set(id, session);
  persistSessions();
  return res.json({
    ok: true,
    id,
    agentUrl: result.agentUrl,
    agentShareText: result.agentShareText,
    agentAccess: result.agentAccess,
    caseFile: result.caseFile,
    acknowledgementText: result.acknowledgementText
  });
});

app.post("/api/leads/:id/agent-handoff-whatsapp", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });

  const session = leadSessions.get(id);
  const requestedName = (req.body?.agentName || "").toString().trim();
  const requestedPhone = cleanPhoneNumber((req.body?.agentPhone || "").toString().trim());
  const requestedAgency = (req.body?.agentAgency || "").toString().trim();
  const seededName = requestedName || session.assignedAgent?.name || session.agentAccess?.agentName || "";
  const seededPhone = requestedPhone || session.assignedAgent?.phone || session.agentAccess?.agentPhone || "";
  const seededAgency = requestedAgency || session.assignedAgent?.agency || session.agentAccess?.agentAgency || "";

  if (!seededName) return res.status(400).json({ ok: false, error: "Agent name is required before sending the introduction" });
  if (!seededPhone) return res.status(400).json({ ok: false, error: "Agent cellphone is required before sending the introduction" });
  const handoffResult = prepareAgentHandoff(session, req, {
    ...(req.body || {}),
    agentName: seededName,
    agentPhone: seededPhone,
    agentAgency: seededAgency
  });
  if (!handoffResult.ok) return res.status(handoffResult.status || 400).json(handoffResult);

  const message = handoffResult.agentShareText || buildAgentShareText(session, req);
  const recipientPhone = cleanPhoneNumber(handoffResult.agentAccess?.agentPhone || seededPhone);
  const delivery = await sendWhatsAppText(message, { force: true, to: recipientPhone });
  const fallbackUrl = buildDirectWhatsAppUrl(message, recipientPhone);
  const now = new Date().toISOString();

  session.agentAccess = session.agentAccess || {};
  session.agentAccess.lastSentAt = now;
  session.agentAccess.lastDeliveryStatus = delivery.status || null;
  session.agentAccess.lastDeliveryReason = delivery.reason || null;
  session.agentAccess.lastDeliveryRecipient = recipientPhone || null;
  session.updatedAt = now;
  appendLeadAuditEvent(session, {
    type: "agent-handoff-whatsapp",
    actor: "Concierge",
    source: "operations",
    summary: delivery.delivered ? "Agent introduction sent by WhatsApp" : "Agent introduction WhatsApp send failed",
    details: recipientPhone ? `${recipientPhone} | ${delivery.reason || delivery.status || "No additional details"}` : (delivery.reason || delivery.status || "No recipient captured")
  });
  leadSessions.set(id, session);
  persistSessions();

  return res.status(delivery.delivered ? 200 : 502).json({
    ok: delivery.delivered,
    id,
    delivery,
    fallbackUrl,
    agentUrl: handoffResult.agentUrl,
    agentShareText: message,
    agentAccess: getAgentAccessSummary(session, req),
    handoff: buildAgentHandoffSummary(session, req),
    caseFile: getLeadCaseFileSummary(session),
    error: delivery.delivered ? null : delivery.reason || "WhatsApp introduction could not be delivered"
  });
});

app.post("/api/leads/:id/stakeholder-link", requireAdmin, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const role = normalizeStakeholderRole(req.body?.role || "");
  const requestedName = sanitizeShortText(req.body?.name || "", 120);
  const requestedPhone = cleanPhoneNumber((req.body?.phone || "").toString().trim());
  const requestedEmail = cleanEmailAddress((req.body?.email || "").toString().trim());
  const refresh = Boolean(req.body?.refresh);
  if (!isStakeholderRole(role)) return res.status(400).json({ ok: false, error: "Invalid stakeholder role" });
  if ((req.body?.phone || "").toString().trim() && !requestedPhone) return res.status(400).json({ ok: false, error: "Invalid stakeholder cellphone number" });
  if ((req.body?.email || "").toString().trim() && !requestedEmail) return res.status(400).json({ ok: false, error: "Invalid stakeholder email address" });

  const session = leadSessions.get(id);
  const seed = buildDefaultStakeholderSeed(session, role);
  const name = requestedName || seed.name || stakeholderRoleLabels[role] || "";
  const phone = requestedPhone || seed.phone || "";
  const email = requestedEmail || seed.email || "";
  markConciergeAcknowledged(session, "stakeholder-link");
  const accessMap = ensureStakeholderAccess(session);
  const existing = accessMap[role];
  const activeExisting = isStakeholderAccessActive(existing);
  const now = new Date().toISOString();

  if (!activeExisting || refresh) {
    accessMap[role] = {
      token: randomUUID(),
      role,
      name: name || stakeholderRoleLabels[role],
      phone: phone || "",
      email: email || "",
      createdAt: now,
      expiresAt: addDaysIso(Number.isFinite(STAKEHOLDER_LINK_TTL_DAYS) ? STAKEHOLDER_LINK_TTL_DAYS : 30),
      lastViewedAt: null,
      revokedAt: null
    };
  } else {
    accessMap[role].name = name || accessMap[role].name || stakeholderRoleLabels[role];
    accessMap[role].phone = phone || accessMap[role].phone || "";
    accessMap[role].email = email || accessMap[role].email || "";
  }

  appendLeadAuditEvent(session, {
    type: "stakeholder-link",
    actor: "Concierge",
    source: "operations",
    summary: `${stakeholderRoleLabels[role]} portal link ${refresh ? "refreshed" : "created"}`,
    details: accessMap[role].name || stakeholderRoleLabels[role]
  });

  session.stakeholderAccess = accessMap;
  session.updatedAt = now;
  leadSessions.set(id, session);
  persistSessions();

  return res.json({
    ok: true,
    id,
    role,
    roleLabel: stakeholderRoleLabels[role],
    stakeholderUrl: buildStakeholderUpdateUrl(req, accessMap[role].token),
    stakeholderShareText: buildStakeholderShareText(session, req, role, accessMap[role]),
    stakeholderAccess: getStakeholderAccessSummary(session, req)
  });
});

app.post("/api/leads/:id/stakeholder-links/bulk", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const refresh = Boolean(req.body?.refresh);
  const roles = ["buyer", "seller", "agent", "attorney", "bond-originator"];
  const now = new Date().toISOString();
  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "stakeholder-link-bulk");
  const accessMap = ensureStakeholderAccess(session);
  const result = [];

  for (const role of roles) {
    const seed = buildDefaultStakeholderSeed(session, role);
    const existing = accessMap[role];
    const activeExisting = isStakeholderAccessActive(existing);
    if (!activeExisting || refresh) {
      accessMap[role] = {
        token: randomUUID(),
        role,
        name: seed.name || stakeholderRoleLabels[role],
        phone: seed.phone || "",
        email: seed.email || "",
        createdAt: now,
        expiresAt: addDaysIso(Number.isFinite(STAKEHOLDER_LINK_TTL_DAYS) ? STAKEHOLDER_LINK_TTL_DAYS : 30),
        lastViewedAt: null,
        revokedAt: null
      };
    } else {
      accessMap[role].name = accessMap[role].name || seed.name || stakeholderRoleLabels[role];
      accessMap[role].phone = accessMap[role].phone || seed.phone || "";
      accessMap[role].email = accessMap[role].email || seed.email || "";
    }
    result.push({
      role,
      roleLabel: stakeholderRoleLabels[role] || role,
      url: buildStakeholderUpdateUrl(req, accessMap[role].token),
      active: isStakeholderAccessActive(accessMap[role]),
      expiresAt: accessMap[role].expiresAt || null
    });
  }

  appendLeadAuditEvent(session, {
    type: "stakeholder-link-bulk",
    actor: "Concierge",
    source: "operations",
    summary: `Bulk stakeholder portal pack ${refresh ? "refreshed" : "created"}`,
    details: roles.join(", ")
  });
  session.stakeholderAccess = accessMap;
  session.updatedAt = now;
  leadSessions.set(id, session);
  persistSessions();

  return res.json({
    ok: true,
    id,
    links: result,
    stakeholderAccess: getStakeholderAccessSummary(session, req),
    sharePackText: buildStakeholderSharePack(session, req, accessMap)
  });
});

app.get("/api/stakeholder-lead/:token", rateLimit({ windowMs: 60000, max: 80 }), (req, res) => {
  const hit = findSessionByStakeholderToken(req.params.token);
  if (!hit?.session || !hit?.access) return res.status(404).json({ ok: false, error: "Stakeholder link not found" });
  if (!isStakeholderAccessActive(hit.access)) {
    return res.status(410).json({ ok: false, error: "This stakeholder link has expired. Please request a fresh link from the concierge." });
  }
  hit.access.lastViewedAt = new Date().toISOString();
  hit.session.updatedAt = new Date().toISOString();
  appendLeadAuditEvent(hit.session, {
    type: "stakeholder-view",
    actor: stakeholderRoleLabels[hit.role] || "Stakeholder",
    source: "stakeholder-portal",
    summary: `${stakeholderRoleLabels[hit.role] || "Stakeholder"} viewed shared portal`,
    details: hit.access.name || ""
  });
  leadSessions.set(hit.session.id, hit.session);
  persistSessions();
  return res.json({
    ok: true,
    lead: buildStakeholderLeadSummary(hit.session, hit.role),
    access: {
      role: hit.role,
      roleLabel: stakeholderRoleLabels[hit.role] || hit.role,
      name: hit.access.name || "",
      phone: hit.access.phone || "",
      email: hit.access.email || "",
      createdAt: hit.access.createdAt || null,
      expiresAt: hit.access.expiresAt || null
    },
    options: {
      dealStatuses: dealStatusOptions,
      contactMedia: contactMediumOptions.filter((option) => option !== "Not specified")
    }
  });
});

app.post("/api/stakeholder-lead/:token/update", rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const hit = findSessionByStakeholderToken(req.params.token);
  if (!hit?.session || !hit?.access) return res.status(404).json({ ok: false, error: "Stakeholder link not found" });
  if (!isStakeholderAccessActive(hit.access)) {
    return res.status(410).json({ ok: false, error: "This stakeholder link has expired. Please request a fresh link from the concierge." });
  }

  const status = (req.body?.status || "").toString().trim();
  const medium = (req.body?.medium || "").toString().trim();
  const note = (req.body?.note || "").toString().trim();
  const nextCheckIn = (req.body?.nextCheckIn || "").toString().trim();
  if (!note || note.length < 3) return res.status(400).json({ ok: false, error: "Please add a short update note" });
  if (note.length > 500) return res.status(400).json({ ok: false, error: "Update note is too long" });
  if (status && !dealStatusOptions.includes(status)) return res.status(400).json({ ok: false, error: "Invalid deal status" });
  if (medium && !contactMediumOptions.includes(medium)) return res.status(400).json({ ok: false, error: "Invalid contact medium" });
  if (nextCheckIn && Number.isNaN(new Date(nextCheckIn).getTime())) return res.status(400).json({ ok: false, error: "Invalid next check-in date" });

  const session = hit.session;
  const role = hit.role;
  const roleLabel = stakeholderRoleLabels[role] || "Stakeholder";
  const actorName = hit.access.name || roleLabel;
  const now = new Date().toISOString();
  session.stakeholderUpdates = Array.isArray(session.stakeholderUpdates) ? session.stakeholderUpdates : [];

  const updateEntry = {
    id: randomUUID(),
    at: now,
    role,
    roleLabel,
    actorName,
    advisoryOnly: true,
    reviewState: "pending-concierge-review",
    status: status || null,
    medium: medium || null,
    nextCheckIn: nextCheckIn || null,
    note
  };
  session.stakeholderUpdates.push(updateEntry);

  appendLeadAuditEvent(session, {
    type: "stakeholder-update",
    actor: actorName,
    source: "stakeholder-portal",
    summary: `${roleLabel} shared an advisory progress update`,
    details: [status ? `Suggested status: ${status}` : "", medium ? `Suggested contact: ${medium}` : "", nextCheckIn ? `Suggested next check-in: ${nextCheckIn}` : "", note, "Concierge review still available"].filter(Boolean).join(" | ")
  });
  syncLeadCaseFile(session, {
    source: "stakeholder-update",
    actor: actorName,
    note,
    allowBackward: true
  });
  session.updatedAt = now;
  leadSessions.set(session.id, session);
  persistSessions();

  return res.json({
    ok: true,
    update: updateEntry,
    updateReview: "pending-concierge-review",
    lead: buildStakeholderLeadSummary(session, role)
  });
});

app.post("/api/leads/:id/stakeholder-updates/:updateId/review", requireAdmin, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const session = leadSessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false, error: "Lead not found" });
  session.stakeholderUpdates = Array.isArray(session.stakeholderUpdates) ? session.stakeholderUpdates : [];
  const update = session.stakeholderUpdates.find((item) => item.id === req.params.updateId);
  if (!update) return res.status(404).json({ ok: false, error: "Stakeholder update not found" });

  const action = (req.body?.action || "").toString().trim().toLowerCase();
  const reviewStateMap = {
    working: "in-concierge-workflow",
    reference: "reference-only",
    dismiss: "dismissed",
    reopen: "pending-concierge-review"
  };
  if (!reviewStateMap[action]) {
    return res.status(400).json({ ok: false, error: "Invalid review action" });
  }

  const now = new Date().toISOString();
  update.reviewState = reviewStateMap[action];
  update.reviewedAt = now;
  update.reviewedBy = "Concierge";
  update.reviewAction = action;

  const actionLabelMap = {
    working: "moved the advisory update into concierge workflow",
    reference: "kept the advisory update as reference only",
    dismiss: "dismissed the advisory update from the active queue",
    reopen: "re-opened the advisory update for concierge review"
  };

  appendLeadAuditEvent(session, {
    type: "stakeholder-update-review",
    actor: "Concierge",
    source: "mission-control",
    summary: `Concierge ${actionLabelMap[action] || "reviewed a stakeholder update"}`,
    details: [update.roleLabel || update.role || "Stakeholder", update.note || ""].filter(Boolean).join(" | ")
  });

  session.updatedAt = now;
  leadSessions.set(session.id, session);
  persistSessions();

  return res.json({
    ok: true,
    reviewState: update.reviewState,
    update,
    lead: buildRecentLeadSummary(session, req)
  });
});

app.get("/api/agent-lead/:token", rateLimit({ windowMs: 60000, max: 60 }), (req, res) => {
  const session = findSessionByAgentToken(req.params.token);
  if (!session || !session.agentAccess) return res.status(404).json({ ok: false, error: "Agent lead link not found" });
  if (!isAgentAccessActive(session.agentAccess)) {
    return res.status(410).json({ ok: false, error: "This agent lead link has expired. Please request a fresh link from the concierge." });
  }

  session.agentAccess.lastViewedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  leadSessions.set(session.id, session);
  persistSessions();

  return res.json({
    ok: true,
    lead: buildAgentLeadSummary(session),
    acknowledgementText: REFERRAL_ACKNOWLEDGEMENT_TEXT,
    options: {
      dealStatuses: dealStatusOptions,
      commissionAgreements: commissionAgreementOptions,
      contactMedia: contactMediumOptions.filter((option) => option !== "Not specified")
    }
  });
});

app.post("/api/agent-lead/:token/update", rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const session = findSessionByAgentToken(req.params.token);
  if (!session || !session.agentAccess) return res.status(404).json({ ok: false, error: "Agent lead link not found" });
  if (!isAgentAccessActive(session.agentAccess)) {
    return res.status(410).json({ ok: false, error: "This agent lead link has expired. Please request a fresh link from the concierge." });
  }

  const acknowledgeReferral = Boolean(req.body?.acknowledgeReferral);
  if (!session.agentAccess.acknowledgedAt && !acknowledgeReferral) {
    return res.status(400).json({
      ok: false,
      error: "Please acknowledge the Axiom Realty AI referral arrangement before updating this lead."
    });
  }

  const medium = (req.body?.medium || "").toString().trim();
  const contactNote = (req.body?.contactNote || "").toString().trim();
  const status = (req.body?.status || "").toString().trim();
  const commissionAgreement = (req.body?.commissionAgreement || "").toString().trim();
  const nextCheckIn = (req.body?.nextCheckIn || "").toString().trim();
  const dealNote = (req.body?.dealNote || "").toString().trim();

  if (medium && !contactMediumOptions.includes(medium)) return res.status(400).json({ ok: false, error: "Invalid contact medium" });
  if (contactNote.length > 240) return res.status(400).json({ ok: false, error: "Contact note is too long" });
  if (status && !dealStatusOptions.includes(status)) return res.status(400).json({ ok: false, error: "Invalid deal status" });
  if (commissionAgreement && !commissionAgreementOptions.includes(commissionAgreement)) {
    return res.status(400).json({ ok: false, error: "Invalid commission agreement status" });
  }
  if (nextCheckIn && Number.isNaN(new Date(nextCheckIn).getTime())) {
    return res.status(400).json({ ok: false, error: "Invalid next check-in date" });
  }
  if (dealNote.length > 500) return res.status(400).json({ ok: false, error: "Deal note is too long" });

  const now = new Date().toISOString();
  const firstAcceptance = !session.agentAccess.acknowledgedAt;
  if (!session.agentAccess.acknowledgedAt) {
    session.agentAccess.acknowledgedAt = now;
    session.agentAccess.acknowledgementText = REFERRAL_ACKNOWLEDGEMENT_TEXT;
    const proof = ensureDealProofState(session);
    if (!proof.referralAcceptance?.acceptedAt) {
      proof.referralAcceptance = {
        acceptedAt: now,
        acceptedBy: session.agentAccess.agentName || session.assignedAgent?.name || "Agent",
        via: "Portal acknowledgement",
        note: "Agent accepted referral arrangement through secure introduction link"
      };
      session.dealProof = proof;
    }
    upsertDealMilestone(session, {
      code: "referral-accepted",
      label: getMilestoneLabel("referral-accepted"),
      completedAt: now,
      actor: session.agentAccess.agentName || session.assignedAgent?.name || "Agent",
      via: "Portal acknowledgement",
      note: "Agent accepted referral arrangement through secure introduction link",
      proofRef: ""
    });
  }

  if (medium) {
    session.firstContactAt = session.firstContactAt || now;
    session.agentContact = {
      medium,
      note: contactNote,
      contactedAt: now,
      source: "agent-link",
      agentName: session.agentAccess.agentName || session.assignedAgent?.name || null
    };
  }

  if (status || commissionAgreement || nextCheckIn || dealNote) {
    const previous = session.dealProtection || {};
    session.dealProtection = {
      status: status || previous.status || "Active",
      commissionAgreement: commissionAgreement || previous.commissionAgreement || "Not discussed",
      nextCheckIn: nextCheckIn || previous.nextCheckIn || null,
      note: dealNote || previous.note || "",
      updatedAt: now,
      source: "agent-link",
      referralAcknowledgement: {
        text: REFERRAL_ACKNOWLEDGEMENT_TEXT,
        acknowledgedAt: session.agentAccess.acknowledgedAt,
        agentName: session.agentAccess.agentName || session.assignedAgent?.name || null
      }
    };
    if (["Offer pending", "Under contract"].includes(status)) {
      session.lifecycleStage = {
        code: "sale-pending",
        note: dealNote || previous.note || "",
        updatedAt: now,
        source: "agent-link"
      };
    }
    if (status === "Closed won") {
      session.lifecycleStage = {
        code: "sale-concluded",
        note: dealNote || previous.note || "",
        updatedAt: now,
        source: "agent-link"
      };
    }
    if (["Cold", "Lost", "Disputed"].includes(status)) {
      session.lifecycleStage = {
        code: "closed",
        note: dealNote || previous.note || "",
        updatedAt: now,
        source: "agent-link"
      };
    }
  }

  updateLeadOutcome(
    session,
    {
      caseMode: inferLeadCaseMode(session),
      commercialStatus: medium ? "client_contacted" : "accepted_by_agent",
      note: medium ? contactNote || "Agent confirmed client contact" : "Agent accepted referral introduction"
    },
    session.agentAccess.agentName || session.assignedAgent?.name || "Agent",
    "agent-link"
  );

  const updateEntry = {
    at: now,
    source: "agent-link",
    agentName: session.agentAccess.agentName || session.assignedAgent?.name || null,
    medium: medium || null,
    status: status || null,
    commissionAgreement: commissionAgreement || null,
    note: dealNote || contactNote || ""
  };
  session.agentUpdates = Array.isArray(session.agentUpdates) ? session.agentUpdates : [];
  session.agentUpdates.push(updateEntry);
  appendLeadAuditEvent(session, {
    type: firstAcceptance ? "agent-accepted-handoff" : "agent-update",
    actor: session.agentAccess.agentName || session.assignedAgent?.name || "Agent",
    source: "agent-link",
    summary: status ? `Agent updated deal status to ${status}` : "Agent submitted lead progress update",
    details: [medium ? `Contact via ${medium}` : "", commissionAgreement ? `Commission ${commissionAgreement}` : "", dealNote || contactNote || ""]
      .filter(Boolean)
      .join(" | ") || "No additional details"
  });
  syncLeadCaseFile(session, {
    source: "agent-link-update",
    actor: session.agentAccess.agentName || "Agent",
    note: dealNote || contactNote || "Agent shared a lead update",
    allowBackward: true
  });
  session.updatedAt = now;
  leadSessions.set(session.id, session);
  persistSessions();

  return res.json({
    ok: true,
    lead: buildAgentLeadSummary(session),
    agentAccess: getAgentAccessSummary(session, req),
    update: updateEntry
  });
});

app.post("/api/leads/:id/retry-delivery", requireAdmin, rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "retry-delivery");
  const delivery = await deliverSessionToWhatsApp(session, req);
  appendLeadAuditEvent(session, {
    type: "delivery-retry",
    actor: "Concierge",
    source: "operations",
    summary: delivery.result.delivered ? "Lead delivery retry succeeded" : "Lead delivery retry failed",
    details: delivery.result.reason || delivery.result.status || "No additional details"
  });
  leadSessions.set(id, session);
  persistSessions();
  return res.status(delivery.result.delivered ? 200 : 502).json({
    ok: delivery.result.delivered,
    delivery: session.delivery,
    reason: delivery.result.reason || null,
    fallbackUrl: delivery.fallbackUrl
  });
});

app.post("/api/leads/:id/client-confirmation", requireAdmin, rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  if (!isWhatsAppWebTestModeEnabled()) {
    return res.status(400).json({ ok: false, error: "WhatsApp Web test mode is disabled" });
  }

  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "client-confirmation");
  const slots = getSessionSlots(session);
  const phone = slots.phone || "";
  const message = buildClientConfirmationMessage(session);
  const result = await sendWhatsAppWebText(message, { to: phone });
  session.clientConfirmationDelivery = {
    channel: "whatsapp-web-test",
    attemptedAt: new Date().toISOString(),
    delivered: result.delivered,
    reason: result.reason || null,
    status: result.status || null,
    recipient: phone || null
  };
  session.updatedAt = new Date().toISOString();
  appendLeadAuditEvent(session, {
    type: "client-confirmation",
    actor: "Concierge",
    source: "operations",
    summary: result.delivered ? "Client confirmation sent" : "Client confirmation failed",
    details: result.reason || result.status || "No additional details"
  });
  leadSessions.set(id, session);
  persistSessions();

  return res.status(result.delivered ? 200 : 502).json({
    ok: result.delivered,
    id,
    clientConfirmationDelivery: session.clientConfirmationDelivery,
    reason: result.reason || null,
    whatsapp: getWhatsAppConfigStatus()
  });
});

app.get("/api/leads/:id/handoff", requireAdmin, (req, res) => {
  const id = req.params.id;
  if (!leadSessions.has(id)) return res.status(404).json({ ok: false, error: "Lead not found" });
  const session = leadSessions.get(id);
  markConciergeAcknowledged(session, "whatsapp-handoff");
  appendLeadAuditEvent(session, {
    type: "handoff-opened",
    actor: "Concierge",
    source: "operations",
    summary: "WhatsApp introduction opened",
    details: "Concierge opened manual/assisted WhatsApp introduction."
  });
  session.updatedAt = new Date().toISOString();
  leadSessions.set(id, session);
  persistSessions();
  const message = buildSessionDeliveryMessage(session, req);
  const whatsappUrl = buildWhatsAppFallbackUrl(message);
  if (!whatsappUrl) {
    return res.status(503).json({ ok: false, error: "Central concierge WhatsApp number is not configured" });
  }
  return res.json({
    ok: true,
    id,
    message,
    whatsappUrl
  });
});

app.get("/api/sessions/:id", requireAdmin, (req, res) => {
  const session = leadSessions.get(req.params.id);
  if (!session) return res.status(404).json({ ok: false, error: "Session not found" });
  return res.json({ ok: true, session });
});

app.post("/api/concierge", rateLimit({ windowMs: 60000, max: 40 }), async (req, res) => {
  const message = normalizeConciergeText((req.body?.message || "").toString().trim());
  let sessionId = (req.body?.sessionId || "").toString().trim();
  if (!message) return res.status(400).json({ ok: false, error: "Message is required" });

  const urgent = /\bimmediate|asap|urgent|now\b/.test(message.toLowerCase());

  if (!sessionId || !leadSessions.has(sessionId)) {
    sessionId = randomUUID();
    const newSession = {
      id: sessionId,
      intent: "unknown",
      label: "Concierge Session",
      dataClass: getIncomingDataClass(req.body?.dataMode, "draft"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstContactAt: null,
      answers: [],
      additionalInfo: "",
      scoring: null,
      copilot: null,
      slots: createEmptySlots(),
      chatHistory: []
    };
    ensureLeadCaseFile(newSession);
    leadSessions.set(sessionId, newSession);
    persistSessions();
  }

  let slots = createEmptySlots();
  if (leadSessions.has(sessionId)) {
    const existing = leadSessions.get(sessionId);
    slots = existing.slots || createEmptySlots();
  }

  const hadPendingField = Boolean(slots.lastAskedField);

  if (slots.finalPromptAsked && !slots.closed) {
    slots.additionalConsiderations = isNegativeResponse(message) ? "None" : message;
    slots.closed = true;
  }

  slots = applyPendingFieldAnswer(slots, message);
  const extracted = hadPendingField ? extractLeadSignals(message) : await extractLeadSignalsWithLmStudio(message, slots);
  if (!slots.closed && !hadPendingField) {
    slots = mergeSlots(slots, extracted);
  }
  const nonPropertySubject = !hadPendingField ? detectNonPropertySaleSubject(message) : null;
  if (nonPropertySubject && slots.intent === "sell") {
    slots.validationMessage =
      "What type of property are you selling, for example house, flat, apartment, land, or farm?";
    slots.lastAskedField = "propertyType";
  }
  const hasPriorAssistantReply =
    leadSessions.has(sessionId) &&
    (leadSessions.get(sessionId)?.chatHistory || []).some((x) => x.role === "assistant");
  const missingFields = getMissingFromSlots(slots);
  const extractedForReply = slots.closed
    ? { ...extracted, area: null, province: slots.province, price: { ...extracted.price, display: slots.priceDisplay } }
    : extracted;
  const reply = buildConciergeReply(
    slots,
    missingFields,
    extractedForReply,
    slots.closed ? false : urgent,
    hasPriorAssistantReply
  );

  if (leadSessions.has(sessionId)) {
    const session = leadSessions.get(sessionId);
    session.slots = slots;
    session.intent = slots.intent || session.intent || "unknown";
    refreshSessionDedupeSignals(session);
    session.updatedAt = new Date().toISOString();
    session.chatHistory.push({ role: "user", text: message, at: new Date().toISOString() });
    session.chatHistory.push({ role: "assistant", text: reply, at: new Date().toISOString() });
    leadSessions.set(sessionId, session);
    persistSessions();
  }

  let handoff = null;
  if (slots.closed && leadSessions.has(sessionId)) {
    const session = leadSessions.get(sessionId);
    if (session.dataClass === "draft") session.dataClass = "live";
    appendLeadAuditEvent(session, {
      type: "concierge-brief-complete",
      actor: "Concierge",
      source: "concierge-chat",
      summary: "Concierge chat completed and lead brief packaged",
      details: `Intent: ${(slots.intent || session.intent || "unknown").toUpperCase()}`
    });
    updateLeadCaseStage(session, "brief-qualified", {
      source: "concierge-brief-complete",
      actor: "Concierge",
      note: "Concierge captured full brief"
    });
    await recordAutomaticLeadAcknowledgement(session);
    const delivery = session.delivery?.attemptedAt
      ? {
          result: {
            delivered: session.delivery.delivered,
            reason: session.delivery.reason || null,
            status: session.delivery.status || null
          },
          fallbackUrl: buildWhatsAppFallbackUrl(buildSessionDeliveryMessage(session, req))
        }
      : await deliverSessionToWhatsApp(session, req);
    handoff = {
      delivered: delivery.result.delivered,
      reason: delivery.result.reason || null,
      manualHandoffUrl: delivery.result.delivered ? null : delivery.fallbackUrl
    };
  }

  return res.json({
    ok: true,
    sessionId,
    intent: slots.intent || "unknown",
    extracted: { ...extracted, missingFields },
    slots,
    reply: slots.closed
      ? `${reply} ${buildUserClosingPromise(slots)}`
      : reply,
    closed: Boolean(slots.closed),
    handoff,
    caseFile: leadSessions.has(sessionId) ? getLeadCaseFileSummary(leadSessions.get(sessionId)) : null,
    localAi: {
      enabled: lmStudioLastStatus.enabled,
      connected: lmStudioLastStatus.connected,
      model: lmStudioLastStatus.model,
      checkedAt: lmStudioLastStatus.checkedAt
    },
    handoffRecommendation:
      missingFields.length > 0
        ? `Collect missing fields: ${missingFields.join(", ")}.`
        : "Lead brief is ready for Operations introduction."
  });
});

app.get("/api/agent-applications", requireAdmin, (req, res) => {
  const limitRaw = Number(req.query?.limit || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const applications = agentApplications
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  res.json({ ok: true, applications, total: agentApplications.length });
});

app.post("/api/agent-applications", rateLimit({ windowMs: 60000, max: 10 }), (req, res) => {
  const error = validateAgentApplication(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const application = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    name: sanitizeShortText(req.body.name, 120),
    agency: sanitizeShortText(req.body.agency, 160),
    mobile: cleanPhoneNumber(req.body.mobile),
    email: cleanEmailAddress(req.body.email),
    areasCovered: sanitizeShortText(req.body.areasCovered, 300),
    propertyTypes: sanitizeShortText(req.body.propertyTypes, 240),
    complianceStatus: sanitizeShortText(req.body.complianceStatus, 180),
    referralPartnership: sanitizeShortText(req.body.referralPartnership, 40),
    notes: sanitizeShortText(req.body.notes, 800),
    status: "new"
  };
  agentApplications.push(application);
  persistAgentApplications();
  res.json({ ok: true, id: application.id });
});

function getOperationsPriorityFromCase(item, dueDate) {
  const status = String(item?.status || "").toLowerCase();
  const dueLabel = String(item?.due || "").toLowerCase();
  if (status.includes("overdue") || status.includes("at risk") || dueLabel.includes("overdue")) return "High";
  if (dueLabel === "today") return "High";
  if (dueLabel === "tomorrow") return "Medium";
  if (dueDate && dueDate.getTime() <= Date.now() + 2 * 24 * 60 * 60 * 1000) return "Medium";
  return "Low";
}

function buildOperationsQuickMessage(item, actionTitle) {
  return `Hi, quick update for ${item.id}: ${actionTitle}. Next action is "${item.next}" and it is currently due ${item.due}.`;
}

function buildClientJourneyPulse(item, user) {
  if (!item || !["seller", "buyer"].includes(user?.role)) return null;
  const delayIntel = buildCaseDelayIntelligence(item);
  const role = user.role;
  const roleLabel = getOperationsRoleLabel(role);
  const userName = String(user.name || "").toLowerCase();
  const clientName = String(item.client || "").toLowerCase();
  const outstandingDocuments = operationsStore.documents
    .filter((doc) => doc.caseId === item.id && doc.status !== "Approved")
    .filter((doc) => {
      const owner = String(doc.owner || "").toLowerCase();
      return owner.includes(role) || owner.includes(userName) || owner.includes(clientName);
    })
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      due: doc.due,
      status: doc.status
    }))
    .slice(0, 5);
  const recentConfirmations = (operationsStore.timeline[item.id] || [])
    .slice(0, 3)
    .map(([time, title, description]) => ({ time, title, description }));
  const attentionActive = ["critical", "high"].includes(delayIntel.band);
  const journeyLabel = role === "seller" ? "sale" : "purchase";
  const handledForYou = role === "seller"
    ? [
        `${item.agent || "Your agent"} is connected to the market launch and buyer-feedback steps.`,
        `${item.concierge || "Your concierge"} is monitoring document timing and partner steps.`,
        "The shared timeline will confirm each completed step automatically."
      ]
    : [
        `${item.agent || "Your agent"} is connected to property matching and viewing coordination.`,
        `${item.finance || "Your finance partner"} is connected to finance-readiness requirements.`,
        `${item.concierge || "Your concierge"} is monitoring timing and partner steps.`
      ];
  return {
    generatedAt: new Date().toISOString(),
    caseId: item.id,
    role,
    roleLabel,
    journeyLabel,
    stage: item.stage,
    progress: Number(item.progress || 0),
    nextAction: item.next,
    nextOwner: item.owner,
    due: item.due,
    status: attentionActive ? "Concierge attention active" : delayIntel.band === "medium" ? "Closely monitored" : "On track",
    tone: attentionActive ? "attention" : delayIntel.band === "medium" ? "watch" : "calm",
    message: attentionActive
      ? `Your ${journeyLabel} has an item that could affect timing. A human concierge can see the context and the next action is already prioritised.`
      : `Your ${journeyLabel} is moving through ${item.stage}. The next action is visible now, and Axiom will keep the right people informed before the next milestone.`,
    outstandingDocuments,
    handledForYou,
    recentConfirmations,
    humanContacts: {
      concierge: item.concierge || "Axiom concierge",
      specialist: item.agent || "To appoint",
      attorney: item.attorney || "To appoint",
      finance: item.finance || "To appoint"
    }
  };
}

function buildOperationsDailyBrief(user) {
  const allowedCases = operationsStore.cases.filter((item) => canAccessOperationsCase(user, item.id));
  const actions = [];
  const roleLabel = getOperationsRoleLabel(user.role).toLowerCase();
  const userName = String(user.name || "").toLowerCase();

  for (const item of allowedCases) {
    const caseDueDate = parseOperationsDueDate(item.due, new Date());
    const casePriority = getOperationsPriorityFromCase(item, caseDueDate);
    const delayIntel = buildCaseDelayIntelligence(item);
    const ownerLower = String(item.owner || "").toLowerCase();
    const ownerMatchesUser =
      user.role === "concierge" ||
      ownerLower.includes(userName) ||
      ownerLower.includes(roleLabel) ||
      (user.role === "seller" && ownerLower.includes("seller")) ||
      (user.role === "buyer" && ownerLower.includes("buyer")) ||
      (user.role === "agent" && ownerLower.includes("agent")) ||
      (user.role === "attorney" && ownerLower.includes("attorney")) ||
      (user.role === "finance" && ownerLower.includes("finance"));

    if (ownerMatchesUser) {
      actions.push({
        id: `case-${item.id}`,
        caseId: item.id,
        title: item.next,
        detail: `${item.stage} · Responsible: ${item.owner}`,
        due: item.due,
        dueAt: caseDueDate ? caseDueDate.toISOString() : null,
        priority: casePriority,
        quickMessage: buildOperationsQuickMessage(item, item.next)
      });
    }

    if (user.role === "concierge" && ["critical", "high"].includes(delayIntel.band)) {
      actions.push({
        id: `recovery-${item.id}`,
        caseId: item.id,
        title: `Run recovery plan (${delayIntel.band.toUpperCase()} risk ${delayIntel.score}/100)`,
        detail: `Predicted delay: ${delayIntel.predictedDelayDays} day${delayIntel.predictedDelayDays === 1 ? "" : "s"} · ${delayIntel.signals[0]?.label || "Multiple risk signals detected"}`,
        due: "Today",
        dueAt: new Date().toISOString(),
        priority: delayIntel.band === "critical" ? "High" : "Medium",
        quickMessage: `Update for ${item.id}: we identified delay risk (${delayIntel.score}/100) and launched a recovery plan to keep your transaction on track.`
      });
    }

    const documents = operationsStore.documents.filter((doc) => doc.caseId === item.id && doc.status !== "Approved");
    for (const doc of documents) {
      const docOwner = String(doc.owner || "").toLowerCase();
      const docMatchesUser =
        user.role === "concierge" ||
        docOwner.includes(userName) ||
        docOwner.includes(roleLabel) ||
        docOwner.includes(String(item.client || "").toLowerCase());
      if (!docMatchesUser) continue;
      const docDueDate = parseOperationsDueDate(doc.due, new Date());
      const docPriority = getOperationsPriorityFromCase(
        { status: doc.status, due: doc.due },
        docDueDate
      );
      actions.push({
        id: `doc-${doc.id}`,
        caseId: item.id,
        title: `Document: ${doc.name}`,
        detail: `${doc.status} · Owner: ${doc.owner}`,
        due: doc.due,
        dueAt: docDueDate ? docDueDate.toISOString() : null,
        priority: docPriority,
        quickMessage: `Reminder for ${item.id}: please action "${doc.name}" by ${doc.due}.`
      });
    }
  }

  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  actions.sort((a, b) => {
    const p = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    if (p) return p;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  const summary = {
    totalCases: allowedCases.length,
    totalActions: actions.length,
    highPriority: actions.filter((item) => item.priority === "High").length,
    mediumPriority: actions.filter((item) => item.priority === "Medium").length
  };

  return {
    generatedAt: new Date().toISOString(),
    role: user.role,
    roleLabel: getOperationsRoleLabel(user.role),
    journeyPulse: buildClientJourneyPulse(allowedCases[0], user),
    headline:
      actions.length > 0
        ? `You have ${actions.length} tracked action${actions.length === 1 ? "" : "s"} across ${allowedCases.length} case${allowedCases.length === 1 ? "" : "s"}.`
        : "No urgent actions are currently assigned to you.",
    summary,
    actions: actions.slice(0, 20)
  };
}

app.post("/api/os/login", rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const cellphone = cleanPhoneNumber(req.body?.cellphone);
  const pin = String(req.body?.pin || "");
  const profileId = sanitizeShortText(req.body?.profileId, 80);
  const users = getOperationUsersForLogin();
  const user = profileId
    ? users.find((item) => item.id === profileId && cleanPhoneNumber(item.cellphone) === cellphone)
    : users.find((item) => cleanPhoneNumber(item.cellphone) === cellphone);
  if (!user || !verifyPin(pin, user.pinHash)) {
    return res.status(401).json({ ok: false, error: "Cellphone number or PIN is incorrect" });
  }
  const token = randomBytes(32).toString("hex");
  const session = { token, user, createdAt: Date.now(), expiresAt: Date.now() + OPERATIONS_SESSION_HOURS * 60 * 60 * 1000 };
  operationsSessions.set(token, session);
  return res.json({ ok: true, token, user: getPublicOperationsUser(user), store: getVisibleOperationsStore(user) });
});

app.post("/api/os/login-access", rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const accessToken = String(req.body?.accessToken || "").trim();
  if (!accessToken) return res.status(400).json({ ok: false, error: "Access link token is required" });

  const accessLink = findOperationsAccessLinkByToken(accessToken);
  if (!accessLink) {
    return res.status(404).json({ ok: false, error: "This secure access link was not found. Please request a new one." });
  }
  if (!isOperationsAccessLinkActive(accessLink)) {
    return res.status(410).json({ ok: false, error: "This secure access link has expired or has already been used. Please request a new one." });
  }
  const item = findOperationsCase(accessLink.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "The linked case is no longer available" });

  accessLink.usedAt = new Date().toISOString();
  const user = resolveOperationsAccessUser(accessLink);
  const token = randomBytes(32).toString("hex");
  const session = { token, user, createdAt: Date.now(), expiresAt: Date.now() + OPERATIONS_SESSION_HOURS * 60 * 60 * 1000 };
  operationsSessions.set(token, session);
  addOperationsTimeline(item.id, "Secure access session opened", `${user.name} signed in as ${getOperationsRoleLabel(user.role)} using a secure access link.`);
  addOperationsActivity("OS", "Secure participant sign-in", `${item.id} - ${user.name} (${getOperationsRoleLabel(user.role)})`);
  addOperationsAudit("access-link-login", item.id, `${user.name} (${user.role})`);
  persistOperations();
  return res.json({ ok: true, token, user: getPublicOperationsUser(user), store: getVisibleOperationsStore(user) });
});

app.post("/api/os/auth/request-otp", rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const cellphone = cleanPhoneNumber(req.body?.cellphone);
  if (!cellphone) return res.status(400).json({ ok: false, error: "A valid cellphone number is required" });
  const profileId = sanitizeShortText(req.body?.profileId, 80);
  const users = getOperationUsersForLogin();
  const user = profileId
    ? users.find((entry) => entry.id === profileId && cleanPhoneNumber(entry.cellphone) === cellphone)
    : users.find((entry) => cleanPhoneNumber(entry.cellphone) === cellphone);
  if (!user) return res.status(404).json({ ok: false, error: "No workspace profile was found for this cellphone number" });

  const { challenge, code } = createOperationsOtpChallenge(user);
  const caseId = user.caseIds.includes("*") ? operationsStore.cases[0]?.id : user.caseIds[0];
  if (caseId) {
    queueOperationsNotification({
      caseId,
      recipient: cellphone,
      template: "smart-reminder",
      message: `Axiom Realty OS sign-in code: ${code}. This code expires in ${Math.max(1, OPERATIONS_OTP_MINUTES)} minutes.`
    });
    addOperationsAudit("otp-requested", caseId, `${user.name} (${user.role})`);
  }
  persistOperations();
  return res.json({
    ok: true,
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    delivery: "queued",
    ...(process.env.NODE_ENV === "production" ? {} : { debugCode: code })
  });
});

app.post("/api/os/auth/verify-otp", rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const challengeId = sanitizeShortText(req.body?.challengeId, 80);
  const code = sanitizeShortText(req.body?.code, 20).replace(/[^\d]/g, "");
  if (!challengeId || !code) return res.status(400).json({ ok: false, error: "Challenge ID and code are required" });

  pruneOperationsOtpChallenges();
  const challenge = getOperationsOtpChallenge(challengeId);
  if (!challenge) return res.status(404).json({ ok: false, error: "Sign-in code challenge not found or expired" });
  if (challenge.usedAt) return res.status(410).json({ ok: false, error: "This sign-in code has already been used" });
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ ok: false, error: "This sign-in code has expired. Please request a new one." });
  }
  if (Number(challenge.attempts || 0) >= Number(challenge.maxAttempts || Math.max(1, OPERATIONS_OTP_MAX_ATTEMPTS))) {
    return res.status(429).json({ ok: false, error: "Too many incorrect attempts. Please request a new code." });
  }

  challenge.attempts = Number(challenge.attempts || 0) + 1;
  if (!verifyPin(code, challenge.codeHash)) {
    persistOperations();
    return res.status(401).json({ ok: false, error: "The sign-in code is incorrect" });
  }

  challenge.usedAt = new Date().toISOString();
  const user = {
    id: challenge.user.id,
    name: challenge.user.name,
    cellphone: challenge.user.cellphone,
    role: challenge.user.role,
    caseIds: Array.isArray(challenge.user.caseIds) ? challenge.user.caseIds : []
  };
  const token = randomBytes(32).toString("hex");
  const session = { token, user, createdAt: Date.now(), expiresAt: Date.now() + OPERATIONS_SESSION_HOURS * 60 * 60 * 1000 };
  operationsSessions.set(token, session);
  const auditCaseId = user.caseIds.includes("*") ? operationsStore.cases[0]?.id : user.caseIds[0];
  if (auditCaseId) addOperationsAudit("otp-verified", auditCaseId, `${user.name} (${user.role})`);
  persistOperations();
  return res.json({ ok: true, token, user: getPublicOperationsUser(user), store: getVisibleOperationsStore(user) });
});

app.get("/api/os/session", requireOperationsSession, (req, res) => {
  return res.json({ ok: true, user: getPublicOperationsUser(req.operationsSession.user) });
});

app.post("/api/os/logout", requireOperationsSession, (req, res) => {
  operationsSessions.delete(req.operationsSession.token);
  return res.json({ ok: true });
});

app.get("/api/os/state", requireOperationsSession, (req, res) => {
  return sendVisibleOperationsStore(res, req.operationsSession);
});

app.get("/api/os/my-day", requireOperationsSession, (req, res) => {
  const brief = buildOperationsDailyBrief(req.operationsSession.user);
  return res.json({ ok: true, brief });
});

app.post("/api/os/cases", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const firstName = sanitizeShortText(req.body?.firstName, 80);
  const surname = sanitizeShortText(req.body?.surname, 80);
  const cellphone = cleanPhoneNumber(req.body?.cellphone);
  const journey = sanitizeShortText(req.body?.journeyType, 30).toLowerCase();
  if (!firstName || !surname || !cellphone) {
    return res.status(400).json({ ok: false, error: "Name, surname and a valid cellphone number are required" });
  }
  if (!["seller", "buyer", "agent"].includes(journey)) {
    return res.status(400).json({ ok: false, error: "Journey type is invalid" });
  }

  const id = nextOperationsCaseId();
  const client = `${firstName} ${surname}`;
  const isSeller = journey === "seller";
  const isBuyer = journey === "buyer";
  const item = {
    id,
    client,
    cellphone,
    journey,
    area: "Profile not completed",
    property: isSeller ? "Property profile pending" : isBuyer ? "Buying brief pending" : "Agent application pending",
    value: "To be confirmed",
    stage: "Profile incomplete",
    next: isSeller ? "Complete property profile" : isBuyer ? "Complete buying brief" : "Complete agent profile",
    owner: journey === "agent" ? "Agent" : "Client",
    due: "Today",
    status: "Waiting",
    progress: 8,
    agent: journey === "agent" ? client : "To appoint",
    concierge: "Unassigned",
    attorney: "To appoint",
    finance: "To appoint",
    stakeholders: {
      SELL: journey === "seller" ? client : "To appoint",
      BUY: journey === "buyer" ? client : "To appoint",
      AGENT: journey === "agent" ? client : "To appoint",
      TRANS: "To appoint",
      ORIG: "To appoint",
      BBANK: "To appoint",
      BONDATT: "To appoint",
      CANCEL: "To appoint",
      SBANK: "To appoint",
      MUNI: "To appoint",
      SARS: "SARS",
      HOA: "To appoint",
      INSP: "To appoint",
      DEEDS: "Deeds Office",
      CONC: "Unassigned"
    },
    stakeholderEmails: {
      SELL: null,
      BUY: null,
      AGENT: null,
      TRANS: null,
      ORIG: null,
      BBANK: null,
      BONDATT: null,
      CANCEL: null,
      SBANK: null,
      MUNI: null,
      SARS: null,
      HOA: null,
      INSP: null,
      DEEDS: null,
      CONC: cleanEmailAddress(process.env.CONCIERGE_EMAIL || "") || null
    },
    movingServices: {
      seller: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null },
      buyer: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null }
    },
    financeSupport: {
      bondOriginator: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null },
      lifeCover: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null }
    },
    complianceSupport: {
      electricalCoC: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null },
      gasCoC: { offeredAt: null, response: null, responseAt: null, responder: null, lastNotificationId: null }
    },
    birthdays: {
      seller: journey === "seller" ? parseBirthdayMonthDay(req.body?.birthday || "") : null,
      buyer: journey === "buyer" ? parseBirthdayMonthDay(req.body?.birthday || "") : null
    }
  };
  operationsStore.cases.unshift(item);
  ensureOperationsWorkflowRun(item);
  addOperationsTimeline(id, "Account created", `${client} registered a ${journey} journey. A secure portal route and WhatsApp welcome message were queued.`);
  addOperationsActivity("NEW", `${journey} journey registered`, `${id} - ${client} - WhatsApp welcome queued`);
  queueOperationsNotification({ caseId: id, recipient: cellphone || client, template: "journey-welcome" });
  addOperationsAudit("case-created", id, `${journey} journey registered for ${client}`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { item });
});

app.post("/api/os/cases/:id/birthday", requireOperationsSession, requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });

  const role = sanitizeShortText(req.body?.role, 20).toLowerCase();
  if (!["seller", "buyer"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Birthday role must be seller or buyer" });
  }
  const actorRole = req.operationsSession.user.role;
  const allowed =
    actorRole === "concierge" ||
    actorRole === "agent" ||
    (actorRole === "seller" && role === "seller") ||
    (actorRole === "buyer" && role === "buyer");
  if (!allowed) return res.status(403).json({ ok: false, error: "You are not authorised to update this birthday" });

  const birthday = parseBirthdayMonthDay(req.body?.birthday);
  if (!birthday) {
    return res.status(400).json({ ok: false, error: "Birthday must be in YYYY-MM-DD or MM-DD format" });
  }
  normalizeCaseBirthdays(item);
  item.birthdays[role] = birthday;
  addOperationsTimeline(item.id, "Birthday details updated", `${getOperationsRoleLabel(role)} birthday was saved for automated outreach.`);
  addOperationsActivity("BDAY", "Birthday captured", `${item.id} - ${role}`);
  addOperationsAudit("birthday-updated", item.id, `${role}: ${birthday}`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { caseId: item.id, birthdays: item.birthdays });
});

app.get("/api/os/cases/:id/rule-pack", requireOperationsSession, requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 50 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const rulePack = evaluateCaseRulePack(item);
  return res.json({ ok: true, caseId: item.id, rulePack });
});

app.get("/api/os/cases/:id/recovery-plan", requireOperationsSession, requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 50 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const rulePack = evaluateCaseRulePack(item);
  const delayIntel = buildCaseDelayIntelligence(item, { rulePack });
  const recoveryPlan = buildCaseRecoveryPlan(item, { delayIntel, rulePack });
  return res.json({ ok: true, caseId: item.id, recoveryPlan });
});

app.post(
  "/api/os/cases/:id/recovery/queue",
  requireOperationsSession,
  requireOperationsRoles("concierge"),
  requireOperationsCaseAccess,
  rateLimit({ windowMs: 60000, max: 30 }),
  (req, res) => {
    const item = findOperationsCase(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
    const rulePack = evaluateCaseRulePack(item);
    const delayIntel = buildCaseDelayIntelligence(item, { rulePack });
    const recoveryPlan = buildCaseRecoveryPlan(item, { delayIntel, rulePack });
    const summary = queueRecoveryPlanNotifications(item, recoveryPlan, { source: "manual" });
    if (summary.queued || summary.fallbackQueued) {
      addOperationsActivity("PLAN", "Recovery plan triggered", `${item.id} - ${summary.queued} queued · ${summary.fallbackQueued} fallback`);
    }
    persistOperations();
    return sendVisibleOperationsStore(res, req.operationsSession, {
      caseId: item.id,
      recoveryPlan,
      recoveryQueueSummary: summary
    });
  }
);

app.post("/api/os/cases/:id/invite-party", requireOperationsSession, requireOperationsRoles("concierge"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });

  const role = sanitizeShortText(req.body?.role, 40).toLowerCase();
  if (!isValidOperationsParticipantRole(role)) {
    return res.status(400).json({ ok: false, error: "Participant role is invalid" });
  }
  const name = sanitizeShortText(req.body?.name || getParticipantNameFromCase(item, role), 160);
  if (!name || /^to appoint$/i.test(name)) {
    return res.status(400).json({ ok: false, error: "Participant name is required" });
  }
  const cellphone = cleanPhoneNumber(req.body?.cellphone);
  const email = cleanEmailAddress(req.body?.email);
  const roleNeedsWhatsApp = ["seller", "buyer", "agent"].includes(role);
  if (roleNeedsWhatsApp && !cellphone) {
    return res.status(400).json({ ok: false, error: "Cellphone number is required for seller, buyer and agent invitations" });
  }
  if (!cellphone && !email) {
    return res.status(400).json({ ok: false, error: "Provide at least one contact channel: cellphone or email" });
  }
  const birthdayInput = sanitizeShortText(req.body?.birthday, 20);
  const birthday = birthdayInput ? parseBirthdayMonthDay(birthdayInput) : null;
  if (birthdayInput && !birthday) {
    return res.status(400).json({ ok: false, error: "Birthday must be YYYY-MM-DD or MM-DD" });
  }

  const identity = upsertOperationsIdentity({
    name,
    cellphone,
    email,
    role,
    caseId: item.id,
    invitedBy: req.operationsSession.user.name,
    pin: req.body?.pin
  });
  if (!identity) return res.status(400).json({ ok: false, error: "Participant identity could not be created" });

  const accessLink = issueOperationsAccessLink(item, req, {
    role,
    name,
    cellphone: cellphone || "",
    createdBy: req.operationsSession.user.name,
    singleUse: false,
    expiresHours: req.body?.expiresHours
  });
  const accessUrl = accessLink ? buildOperationsAccessUrl(req, accessLink.token) : null;
  const stakeholderByRole = { seller: "SELL", buyer: "BUY", agent: "AGENT", attorney: "TRANS", finance: "ORIG" };
  const stakeholderKey = stakeholderByRole[role];
  if (accessUrl) {
    queueOperationsNotification({
      caseId: item.id,
      channel: "auto",
      stakeholderCode: stakeholderKey || "",
      recipient: name,
      recipientPhone: cellphone || "",
      recipientEmail: email || "",
      template: "smart-reminder",
      message: `You have been invited to Axiom Realty OS for ${item.id}. Open your secure link: ${accessUrl}`
    });
  }
  normalizeCaseStakeholders(item);
  normalizeCaseStakeholderEmails(item);
  if (stakeholderKey) item.stakeholders[stakeholderKey] = name;
  if (stakeholderKey && email) item.stakeholderEmails[stakeholderKey] = email;
  if (role === "agent") {
    item.agent = name;
    item.agentPhone = cellphone || item.agentPhone || "";
    if (email) item.agentEmail = email;
  }
  if (role === "attorney") {
    item.attorney = name;
    if (email) item.attorneyEmail = email;
  }
  if (role === "finance") {
    item.finance = name;
    if (email) item.financeEmail = email;
  }
  if (birthday && ["seller", "buyer"].includes(role)) {
    normalizeCaseBirthdays(item);
    item.birthdays[role] = birthday;
  }
  addOperationsTimeline(item.id, "Participant invited to workspace", `${name} (${getOperationsRoleLabel(role)}) was invited and can now access this case securely.`);
  addOperationsActivity("INV", "Participant invited", `${item.id} - ${name} (${getOperationsRoleLabel(role)})`);
  addOperationsAudit("participant-invited", item.id, `${name} (${role})`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, {
    invite: {
      identity: {
        id: identity.id,
        name: identity.name,
        cellphone: identity.cellphone || "",
        email: identity.email || "",
        role: identity.role,
        caseIds: identity.caseIds
      },
      birthdays: item.birthdays || { seller: null, buyer: null },
      accessLinkId: accessLink?.id || null,
      accessUrl
    }
  });
});

app.get("/api/os/cases/:id/access-links", requireOperationsSession, requireOperationsRoles("concierge"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const links = (operationsStore.accessLinks || [])
    .filter((entry) => entry.caseId === item.id)
    .map((entry) => ({
      id: entry.id,
      caseId: entry.caseId,
      role: entry.role,
      roleLabel: getOperationsRoleLabel(entry.role),
      name: entry.name || "",
      cellphone: entry.cellphone || "",
      createdAt: entry.createdAt || null,
      expiresAt: entry.expiresAt || null,
      usedAt: entry.usedAt || null,
      revokedAt: entry.revokedAt || null,
      active: isOperationsAccessLinkActive(entry),
      singleUse: entry.singleUse !== false,
      accessUrl: buildOperationsAccessUrl(req, entry.token)
    }));
  return res.json({ ok: true, caseId: item.id, links });
});

app.post("/api/os/cases/:id/access-links", requireOperationsSession, requireOperationsRoles("concierge"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const role = sanitizeShortText(req.body?.role, 40).toLowerCase();
  if (!isValidOperationsParticipantRole(role)) {
    return res.status(400).json({ ok: false, error: "Role is invalid for secure link access" });
  }

  const participantName = sanitizeShortText(req.body?.name, 160) || getParticipantNameFromCase(item, role);
  if (!participantName || /^to appoint$/i.test(participantName)) {
    return res.status(400).json({ ok: false, error: "Participant name is required for secure link access" });
  }
  const cellphoneRaw = sanitizeShortText(req.body?.cellphone, 40);
  const cellphone = cellphoneRaw ? cleanPhoneNumber(cellphoneRaw) : "";
  if (cellphoneRaw && !cellphone) {
    return res.status(400).json({ ok: false, error: "Cellphone number is invalid" });
  }
  const email = cleanEmailAddress(req.body?.email);
  if (!cellphone && !email) {
    return res.status(400).json({ ok: false, error: "Provide cellphone or email to issue a delivery notification" });
  }

  const accessLink = issueOperationsAccessLink(item, req, {
    role,
    name: participantName,
    cellphone,
    createdBy: req.operationsSession.user.name,
    expiresHours: req.body?.expiresHours
  });
  if (!accessLink) return res.status(400).json({ ok: false, error: "Secure access link could not be created" });

  const accessUrl = buildOperationsAccessUrl(req, accessLink.token);
  if (cellphone || email) {
    const stakeholderByRole = { seller: "SELL", buyer: "BUY", agent: "AGENT", attorney: "TRANS", finance: "ORIG" };
    queueOperationsNotification({
      caseId: item.id,
      channel: "auto",
      stakeholderCode: stakeholderByRole[role] || "",
      recipient: participantName,
      recipientPhone: cellphone || "",
      recipientEmail: email || "",
      template: "smart-reminder",
      message: `Secure Axiom Realty OS access: ${accessUrl}`
    });
  }
  addOperationsTimeline(item.id, "Secure participant access link issued", `${participantName} (${getOperationsRoleLabel(role)}) received a secure portal link${cellphone || email ? " via automation queue" : ""}.`);
  addOperationsActivity("LINK", "Secure access link created", `${item.id} - ${participantName} (${getOperationsRoleLabel(role)})`);
  addOperationsAudit("access-link-issued", item.id, `${participantName} (${role})`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, {
    accessLink: {
      id: accessLink.id,
      role: accessLink.role,
      roleLabel: getOperationsRoleLabel(accessLink.role),
      name: accessLink.name,
      cellphone: accessLink.cellphone,
      createdAt: accessLink.createdAt,
      expiresAt: accessLink.expiresAt,
      usedAt: accessLink.usedAt,
      revokedAt: accessLink.revokedAt,
      active: isOperationsAccessLinkActive(accessLink),
      accessUrl
    }
  });
});

app.post("/api/os/access-links/:id/revoke", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const link = (operationsStore.accessLinks || []).find((entry) => entry.id === req.params.id);
  if (!link) return res.status(404).json({ ok: false, error: "Secure access link not found" });
  const item = findOperationsCase(link.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  if (!canAccessOperationsCase(req.operationsSession.user, item.id)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this case" });
  }
  if (!link.revokedAt) {
    link.revokedAt = new Date().toISOString();
    addOperationsTimeline(item.id, "Secure access link revoked", `${link.name || "Participant"} (${getOperationsRoleLabel(link.role)}) access link was revoked.`);
    addOperationsActivity("LOCK", "Access link revoked", `${item.id} - ${link.name || getOperationsRoleLabel(link.role)}`);
    addOperationsAudit("access-link-revoked", item.id, `${link.name || "participant"} (${link.role})`);
    persistOperations();
  }
  return sendVisibleOperationsStore(res, req.operationsSession, { revoked: true, id: link.id });
});

app.get("/api/os/access-links/:id/qr", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 40 }), async (req, res) => {
  const link = (operationsStore.accessLinks || []).find((entry) => entry.id === req.params.id);
  if (!link) return res.status(404).json({ ok: false, error: "Secure access link not found" });
  const item = findOperationsCase(link.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  if (!canAccessOperationsCase(req.operationsSession.user, item.id)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this case" });
  }
  const accessUrl = buildOperationsAccessUrl(req, link.token);
  try {
    const QRCode = require("qrcode");
    const qrDataUrl = await QRCode.toDataURL(accessUrl, { margin: 1, width: 260 });
    return res.json({ ok: true, id: link.id, caseId: item.id, accessUrl, qrDataUrl });
  } catch {
    return res.status(503).json({ ok: false, error: "QR generation is currently unavailable" });
  }
});

app.post("/api/os/cases/:id/playbook/prepare", requireOperationsSession, requireOperationsRoles("concierge"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const milestoneId = sanitizeShortText(req.body?.milestoneId, 120);
  const result = prepareOperationsMilestone(item, { milestoneId, advance: Boolean(req.body?.advance) });
  if (!result) return res.status(400).json({ ok: false, error: "This case does not have a transaction playbook" });
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, {
    result: {
      playbookId: result.playbook.id,
      milestone: result.milestone,
      createdDocuments: result.createdDocuments.length,
      queuedNotifications: result.queuedNotifications.length,
      wasPrepared: result.wasPrepared
    }
  });
});

app.post("/api/os/cases/:id/reminders", requireOperationsSession, requireOperationsRoles("concierge", "agent", "attorney", "finance"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const recipient = sanitizeShortText(req.body?.recipient || item.client, 160);
  queueOperationsNotification({
    caseId: item.id,
    channel: "auto",
    stakeholderCode: mapOwnerTextToStakeholderCode(recipient),
    recipient,
    template: "smart-reminder",
    message: item.next
  });
  addOperationsTimeline(item.id, "Smart reminder queued", `${recipient} will receive a reminder about: ${item.next}. The action is recorded against the shared case.`);
  addOperationsActivity("MSG", "Reminder queued", `${item.id} - ${recipient} - ${item.next}`);
  addOperationsAudit("reminder-queued", item.id, `${recipient}: ${item.next}`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession);
});

app.post("/api/os/cases/:id/resolve", requireOperationsSession, requireOperationsRoles("concierge"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const issue = sanitizeShortText(req.body?.issue || item.next, 240);
  item.status = "In progress";
  const resolutionKey = `${item.id}:${issue}`;
  if (!operationsStore.resolvedItems.includes(resolutionKey)) operationsStore.resolvedItems.push(resolutionKey);
  addOperationsTimeline(item.id, "Concierge intervention resolved", `${issue} was marked as resolved. The change is visible in the shared case record.`);
  addOperationsActivity("OK", "Concierge item resolved", `${item.id} - ${item.client} - ${issue}`);
  addOperationsAudit("intervention-resolved", item.id, issue);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { item });
});

app.post("/api/os/documents/action", requireOperationsSession, requireOperationsRoles("concierge", "agent", "attorney", "finance"), rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const documentName = sanitizeShortText(req.body?.name, 180);
  const action = sanitizeShortText(req.body?.action, 30).toLowerCase();
  const document = operationsStore.documents.find((item) => item.name === documentName);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (!canAccessOperationsCase(req.operationsSession.user, document.caseId)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this document" });
  }
  if (!["approve", "remind"].includes(action)) {
    return res.status(400).json({ ok: false, error: "Document action is invalid" });
  }
  if (action === "approve" && !["concierge", "attorney"].includes(req.operationsSession.user.role)) {
    return res.status(403).json({ ok: false, error: "Only a concierge or attorney may approve a document" });
  }

  if (action === "approve") {
    document.status = "Approved";
    document.reminder = "Approved by concierge - Just now";
    reconcileOperationsPriorities();
    addOperationsTimeline(document.caseId, `${document.name} approved`, "The uploaded document passed concierge review and the shared checklist was updated.");
    addOperationsActivity("DOC", "Document approved", `${document.caseId} - ${document.name}`);
  } else {
    document.reminder = "WhatsApp - Just now";
    const caseItem = findOperationsCase(document.caseId) || { id: document.caseId };
    queueOperationsNotification({
      caseId: document.caseId,
      channel: "auto",
      stakeholderCode: mapOwnerTextToStakeholderCode(document.owner),
      recipient: document.owner,
      template: "document-reminder",
      message: buildGuidedDocumentRequestMessage(caseItem, document)
    });
    addOperationsTimeline(document.caseId, "Document reminder queued", `${document.owner} will receive a reminder for: ${document.name}.`);
    addOperationsActivity("MSG", "Document reminder queued", `${document.caseId} - ${document.name}`);
  }
  addOperationsAudit(`document-${action}`, document.caseId, document.name);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { document });
});

app.post("/api/os/documents", requireOperationsSession, requireOperationsRoles("concierge", "agent", "attorney"), requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const item = findOperationsCase(req.body?.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const name = sanitizeShortText(req.body?.name, 180);
  if (!name) return res.status(400).json({ ok: false, error: "Document name is required" });
  const document = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    name,
    caseId: item.id,
    owner: sanitizeShortText(req.body?.owner || `${item.client} - ${item.owner}`, 180),
    due: sanitizeShortText(req.body?.due || "Within 3 days", 80),
    reminder: "WhatsApp - Queued",
    status: "Requested"
  };
  operationsStore.documents.unshift(document);
  addOperationsTimeline(item.id, "Document requested", `${document.name} was requested from ${document.owner}. Delivery automation and portal reminders were queued.`);
  addOperationsActivity("DOC", "Document request created", `${item.id} - ${document.name}`);
  queueOperationsNotification({
    caseId: item.id,
    channel: "auto",
    stakeholderCode: mapOwnerTextToStakeholderCode(document.owner),
    recipient: document.owner,
    template: "document-request",
    message: buildGuidedDocumentRequestMessage(item, document)
  });
  addOperationsAudit("document-requested", item.id, document.name);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { document });
});

app.post("/api/os/documents/:id/upload", requireOperationsSession, rateLimit({ windowMs: 60000, max: 15 }), (req, res) => {
  const document = operationsStore.documents.find((item) => item.id === req.params.id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (!canAccessOperationsCase(req.operationsSession.user, document.caseId)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this document" });
  }
  const originalName = path.basename(sanitizeShortText(req.body?.filename, 180) || "uploaded-document");
  const mimeType = sanitizeShortText(req.body?.mimeType, 100).toLowerCase();
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowedTypes.includes(mimeType)) {
    return res.status(400).json({ ok: false, error: "Upload a PDF, JPG or PNG document" });
  }
  let bytes;
  try {
    bytes = Buffer.from(String(req.body?.base64 || ""), "base64");
  } catch {
    return res.status(400).json({ ok: false, error: "Document upload could not be decoded" });
  }
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: "Document must be smaller than 2 MB" });
  }
  ensureDataDir();
  if (!fs.existsSync(secureDocumentsDir)) fs.mkdirSync(secureDocumentsDir, { recursive: true });
  if (document.file?.storageName) {
    const previous = path.join(secureDocumentsDir, path.basename(document.file.storageName));
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  const storageName = `${randomUUID()}.bin`;
  fs.writeFileSync(path.join(secureDocumentsDir, storageName), bytes);
  document.file = {
    storageName,
    originalName,
    mimeType,
    size: bytes.length,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.operationsSession.user.name
  };
  document.status = "Uploaded";
  document.reminder = `Uploaded by ${req.operationsSession.user.name} - Awaiting review`;
  addOperationsTimeline(document.caseId, `${document.name} uploaded securely`, `${req.operationsSession.user.name} uploaded ${originalName}. The document is protected and awaiting review.`);
  addOperationsActivity("UP", "Secure document uploaded", `${document.caseId} - ${document.name}`);
  addOperationsAudit("document-uploaded", document.caseId, `${document.name}: ${originalName}`);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { document });
});

app.get("/api/os/documents/:id/download", requireOperationsSession, (req, res) => {
  const document = operationsStore.documents.find((item) => item.id === req.params.id);
  if (!document?.file?.storageName) return res.status(404).json({ ok: false, error: "Uploaded file not found" });
  if (!canAccessOperationsCase(req.operationsSession.user, document.caseId)) {
    return res.status(403).json({ ok: false, error: "You do not have access to this document" });
  }
  const filePath = path.join(secureDocumentsDir, path.basename(document.file.storageName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Uploaded file not found" });
  res.set("Content-Type", document.file.mimeType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${document.file.originalName.replace(/[\r\n"]/g, "")}"`);
  return res.sendFile(filePath);
});

app.post("/api/os/escalations", requireOperationsSession, requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 40 }), (req, res) => {
  const item = findOperationsCase(req.body?.caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const question = sanitizeShortText(req.body?.question, 800);
  if (!question) return res.status(400).json({ ok: false, error: "Question is required" });
  const escalation = createOperationsEscalation({ item, question, owner: item.concierge });
  operationsStore.escalations.unshift(escalation);
  addOperationsTimeline(item.id, "AI escalated question to concierge", `A sensitive or human-attention question was routed to ${item.concierge}.`);
  addOperationsActivity("AI", "Question escalated to concierge", `${item.id} - ${item.client}`);
  addOperationsAudit("ai-escalation", item.id, question);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { escalation });
});

app.post("/api/os/ai/ask", requireOperationsSession, requireOperationsCaseAccess, rateLimit({ windowMs: 60000, max: 60 }), (req, res) => {
  const caseId = sanitizeShortText(req.body?.caseId || "", 40);
  const question = sanitizeShortText(req.body?.question, 800);
  if (!question) return res.status(400).json({ ok: false, error: "Question is required" });
  const item = findOperationsCase(caseId);
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });

  const escalate = needsHumanOperationsEscalation(question);
  const answer = buildOperationsAiAnswer(item, question);
  let escalation = null;
  if (escalate) {
    escalation = createOperationsEscalation({ item, question, owner: item.concierge });
    operationsStore.escalations.unshift(escalation);
    addOperationsTimeline(item.id, "AI escalated question to concierge", `A sensitive or human-attention question was routed to ${item.concierge}.`);
    addOperationsActivity("AI", "Question escalated to concierge", `${item.id} - ${item.client}`);
    addOperationsAudit("ai-escalation", item.id, question);
  } else {
    addOperationsAudit("ai-question", item.id, question);
  }
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, {
    ai: {
      caseId: item.id,
      role: req.operationsSession.user.role,
      answer: escalate
        ? `${answer} This has also been escalated to ${item.concierge} for personal follow-up.`
        : answer,
      escalated: escalate,
      escalationId: escalation?.id || null
    }
  });
});

app.post("/api/os/simulate", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  const item = findOperationsCase(req.body?.caseId || "AX-1048") || operationsStore.cases[0];
  if (!item) return res.status(404).json({ ok: false, error: "Case not found" });
  const result = prepareOperationsMilestone(item, { advance: true });
  if (!result) return res.status(400).json({ ok: false, error: "This case does not have a transaction playbook" });
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, {
    item,
    result: {
      milestone: result.milestone,
      createdDocuments: result.createdDocuments.length,
      queuedNotifications: result.queuedNotifications.length
    }
  });
});

app.get("/api/os/automation/status", requireOperationsSession, requireOperationsRoles("concierge"), (_req, res) => {
  const counts = operationsStore.notifications.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  return res.json({
    ok: true,
    automation: operationsStore.automation,
    queue: counts,
    channels: {
      webhookConfigured: Boolean((process.env.OPERATIONS_NOTIFICATION_WEBHOOK_URL || "").trim()),
      emailWebhookConfigured: Boolean((process.env.OPERATIONS_EMAIL_WEBHOOK_URL || "").trim()),
      whatsapp: getWhatsAppConfigStatus()
    }
  });
});

app.post("/api/os/automation/sweep", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 12 }), (_req, res) => {
  const summary = sweepOperationsReminders();
  return sendVisibleOperationsStore(res, _req.operationsSession, { summary });
});

app.post("/api/os/automation/phase2", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 12 }), async (req, res) => {
  const summary = runOperationsPhase2Automation(new Date());
  if (Boolean(req.body?.processQueue)) {
    summary.delivery = await processOperationsNotifications({ limit: 30, forceRetry: false });
  }
  operationsStore.automation.lastPhase2RunAt = new Date().toISOString();
  operationsStore.automation.lastPhase2Summary = summary;
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { summary });
});

app.post("/api/os/automation/process", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 12 }), async (req, res) => {
  const summary = await processOperationsNotifications({ limit: 30, forceRetry: Boolean(req.body?.forceRetry) });
  return sendVisibleOperationsStore(res, req.operationsSession, { summary });
});

app.get("/api/os/management/weekly-summary", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 20 }), (req, res) => {
  refreshEscalationSlaStates();
  const summary = buildOperationsManagementWeeklySummary(new Date());
  const format = String(req.query?.format || "json").toLowerCase();
  if (format === "txt" || format === "text") {
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="axiom-weekly-summary-${getOperationsDateKey(new Date())}.txt"`);
    return res.send(summary.text);
  }
  return res.json({ ok: true, summary });
});

app.post("/api/os/automation/whatsapp-web/start", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 6 }), async (_req, res) => {
  await ensureWhatsAppWebClient();
  return res.json({ ok: true, whatsapp: getWhatsAppConfigStatus() });
});

app.post("/api/os/notifications/:id/retry", requireOperationsSession, requireOperationsRoles("concierge"), rateLimit({ windowMs: 60000, max: 30 }), async (req, res) => {
  const notification = operationsStore.notifications.find((item) => item.id === req.params.id);
  if (!notification) return res.status(404).json({ ok: false, error: "Notification not found" });
  notification.status = "queued";
  notification.nextRetryAt = null;
  const delivered = await deliverOperationsNotification(notification);
  persistOperations();
  return sendVisibleOperationsStore(res, req.operationsSession, { notification: delivered });
});

app.post("/api/webhooks/notifications/status", rateLimit({ windowMs: 60000, max: 120 }), (req, res) => {
  const secret = (process.env.OPERATIONS_WEBHOOK_SECRET || "").trim();
  if (!secret) return res.status(503).json({ ok: false, error: "Webhook status updates are not configured" });
  if ((req.get("x-axiom-webhook-secret") || "").trim() !== secret) {
    return res.status(401).json({ ok: false, error: "Webhook authentication failed" });
  }
  const notification = operationsStore.notifications.find((item) => item.id === req.body?.notificationId);
  if (!notification) return res.status(404).json({ ok: false, error: "Notification not found" });
  const status = sanitizeShortText(req.body?.status, 40).toLowerCase();
  if (!["delivered", "failed", "sent", "read"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Webhook status is invalid" });
  }
  notification.status = status;
  notification.updatedAt = new Date().toISOString();
  notification.providerStatus = sanitizeShortText(req.body?.providerStatus || status, 120);
  if (status === "delivered" || status === "read") notification.deliveredAt = new Date().toISOString();
  if (status === "failed") notification.lastError = sanitizeShortText(req.body?.reason || "Provider reported failure", 500);
  persistOperations();
  return res.json({ ok: true });
});

function parseYesNoReply(message = "") {
  const value = String(message || "").trim().toLowerCase();
  if (!value) return null;
  if (/^(y|yes|yep|yeah|sure|ok|okay)\b/.test(value)) return "yes";
  if (/^(n|no|nope|not now)\b/.test(value)) return "no";
  return null;
}

function resolveInboundParticipantRole(item, sender = "", senderCellphone = "") {
  const cleanSenderPhone = cleanPhoneNumber(senderCellphone);
  if (cleanSenderPhone) {
    const sellerPhone = resolveCaseParticipantPhone(item, "seller");
    const buyerPhone = resolveCaseParticipantPhone(item, "buyer");
    const agentPhone = resolveGateOwnerRecipient(item, "AGENT").phone;
    const attorneyPhone = resolveGateOwnerRecipient(item, "TRANS").phone;
    const financePhone = resolveGateOwnerRecipient(item, "ORIG").phone;
    if (sellerPhone && cleanSenderPhone === sellerPhone) return "seller";
    if (buyerPhone && cleanSenderPhone === buyerPhone) return "buyer";
    if (agentPhone && cleanSenderPhone === agentPhone) return "agent";
    if (attorneyPhone && cleanSenderPhone === attorneyPhone) return "attorney";
    if (financePhone && cleanSenderPhone === financePhone) return "finance";
  }
  const senderText = String(sender || "").toLowerCase();
  if (senderText.includes("seller")) return "seller";
  if (senderText.includes("buyer")) return "buyer";
  if (senderText.includes("agent")) return "agent";
  if (senderText.includes("attorney") || senderText.includes("convey")) return "attorney";
  if (senderText.includes("finance") || senderText.includes("bond") || senderText.includes("originator")) return "finance";
  return null;
}

function getPendingSellerOfferKind(item) {
  normalizeCaseMovingServices(item);
  normalizeCaseComplianceSupport(item);
  const movingAt =
    item.movingServices?.seller?.offeredAt && !item.movingServices?.seller?.response
      ? new Date(item.movingServices.seller.offeredAt).getTime()
      : 0;
  const electricalAt =
    item.complianceSupport?.electricalCoC?.offeredAt && !item.complianceSupport?.electricalCoC?.response
      ? new Date(item.complianceSupport.electricalCoC.offeredAt).getTime()
      : 0;
  const gasAt =
    item.complianceSupport?.gasCoC?.offeredAt && !item.complianceSupport?.gasCoC?.response
      ? new Date(item.complianceSupport.gasCoC.offeredAt).getTime()
      : 0;
  if (!movingAt && !electricalAt && !gasAt) return null;
  const latestAt = Math.max(movingAt, electricalAt, gasAt);
  if (latestAt === gasAt) return "gas-coc";
  if (latestAt === electricalAt) return "electrical-coc";
  return "moving-services";
}

function getPendingBuyerOfferKind(item) {
  normalizeCaseMovingServices(item);
  normalizeCaseFinanceSupport(item);
  const movingAt =
    item.movingServices?.buyer?.offeredAt && !item.movingServices?.buyer?.response
      ? new Date(item.movingServices.buyer.offeredAt).getTime()
      : 0;
  const bondAt =
    item.financeSupport?.bondOriginator?.offeredAt && !item.financeSupport?.bondOriginator?.response
      ? new Date(item.financeSupport.bondOriginator.offeredAt).getTime()
      : 0;
  const lifeAt =
    item.financeSupport?.lifeCover?.offeredAt && !item.financeSupport?.lifeCover?.response
      ? new Date(item.financeSupport.lifeCover.offeredAt).getTime()
      : 0;
  if (!movingAt && !bondAt && !lifeAt) return null;
  const latestAt = Math.max(movingAt, bondAt, lifeAt);
  if (latestAt === lifeAt) return "life-cover";
  if (latestAt === bondAt) return "bond-originator";
  return "moving-services";
}

function applyMovingServicesInboundReply(item, { sender = "", senderCellphone = "", message = "" }) {
  normalizeCaseMovingServices(item);
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  if (!role || !item.movingServices?.[role]?.offeredAt || item.movingServices?.[role]?.response) return false;
  const reply = parseYesNoReply(message);
  if (!reply) return false;
  item.movingServices[role].response = reply;
  item.movingServices[role].responseAt = new Date().toISOString();
  item.movingServices[role].responder = sanitizeShortText(sender || role, 160);

  if (reply === "yes") {
    const conciergeRecipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    if (conciergeRecipient) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "CONC",
        recipient: conciergeRecipient,
        recipientPhone: conciergeRecipient,
        template: "moving-services-followup",
        message: `${item.id}: ${role} opted in for moving quotations. Please arrange partner introductions and share discounted options.`
      });
    }
    const participantPhone = resolveCaseParticipantPhone(item, role);
    if (participantPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: role === "seller" ? "SELL" : "BUY",
        recipient: participantPhone,
        recipientPhone: participantPhone,
        template: "moving-services-followup",
        message: "Great, thank you. We will arrange reputable moving partners to contact you with discounted quotations shortly."
      });
    }
    addOperationsTimeline(item.id, "Moving services opt-in received", `${role === "seller" ? "Seller" : "Buyer"} replied YES to moving partner quotations.`);
    addOperationsActivity("MOVE", "Moving services opt-in", `${item.id} - ${role}`);
    addOperationsAudit("moving-services-optin", item.id, role);
  } else {
    const participantPhone = resolveCaseParticipantPhone(item, role);
    if (participantPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: role === "seller" ? "SELL" : "BUY",
        recipient: participantPhone,
        recipientPhone: participantPhone,
        template: "moving-services-followup",
        message: "Thank you, noted. We will not arrange moving partner quotations unless you ask us later."
      });
    }
    addOperationsTimeline(item.id, "Moving services declined", `${role === "seller" ? "Seller" : "Buyer"} replied NO to moving partner quotations.`);
    addOperationsActivity("MOVE", "Moving services declined", `${item.id} - ${role}`);
    addOperationsAudit("moving-services-declined", item.id, role);
  }
  return true;
}

function applyBondOriginatorInboundReply(item, { sender = "", senderCellphone = "", message = "" }) {
  normalizeCaseFinanceSupport(item);
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  if (role !== "buyer") return false;
  const offer = item.financeSupport?.bondOriginator;
  if (!offer?.offeredAt || offer.response) return false;
  const reply = parseYesNoReply(message);
  if (!reply) return false;
  offer.response = reply;
  offer.responseAt = new Date().toISOString();
  offer.responder = sanitizeShortText(sender || role, 160);

  if (reply === "yes") {
    const conciergeRecipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    if (conciergeRecipient) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "CONC",
        recipient: conciergeRecipient,
        recipientPhone: conciergeRecipient,
        template: "bond-originator-followup",
        message: `${item.id}: Buyer requested bond originator support to secure competing finance quotes. Please arrange introduction and follow-up.`
      });
    }
    const buyerPhone = resolveCaseParticipantPhone(item, "buyer");
    if (buyerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "BUY",
        recipient: buyerPhone,
        recipientPhone: buyerPhone,
        template: "bond-originator-followup",
        message: "Great, thank you. Our bond originator will negotiate competing quotes from multiple financial institutions and share your best options."
      });
    }
    addOperationsTimeline(item.id, "Bond originator support accepted", "Buyer replied YES to bond originator support.");
    addOperationsActivity("BOND", "Bond originator support accepted", `${item.id} - buyer`);
    addOperationsAudit("bond-originator-optin", item.id, "buyer");
  } else {
    const buyerPhone = resolveCaseParticipantPhone(item, "buyer");
    if (buyerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "BUY",
        recipient: buyerPhone,
        recipientPhone: buyerPhone,
        template: "bond-originator-followup",
        message: "Thank you, noted. We will not arrange bond originator support unless you ask us later."
      });
    }
    addOperationsTimeline(item.id, "Bond originator support declined", "Buyer replied NO to bond originator support.");
    addOperationsActivity("BOND", "Bond originator support declined", `${item.id} - buyer`);
    addOperationsAudit("bond-originator-declined", item.id, "buyer");
  }
  return true;
}

function applyLifeCoverInboundReply(item, { sender = "", senderCellphone = "", message = "" }) {
  normalizeCaseFinanceSupport(item);
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  if (role !== "buyer") return false;
  const offer = item.financeSupport?.lifeCover;
  if (!offer?.offeredAt || offer.response) return false;
  const reply = parseYesNoReply(message);
  if (!reply) return false;
  offer.response = reply;
  offer.responseAt = new Date().toISOString();
  offer.responder = sanitizeShortText(sender || role, 160);

  if (reply === "yes") {
    const conciergeRecipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    if (conciergeRecipient) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "CONC",
        recipient: conciergeRecipient,
        recipientPhone: conciergeRecipient,
        template: "life-cover-followup",
        message: `${item.id}: Buyer requested life cover comparison support. Please arrange partner outreach and provide best-option comparison.`
      });
    }
    const buyerPhone = resolveCaseParticipantPhone(item, "buyer");
    if (buyerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "BUY",
        recipient: buyerPhone,
        recipientPhone: buyerPhone,
        template: "life-cover-followup",
        message: "Great, thank you. We will compare life cover options and share the best available offer with you."
      });
    }
    addOperationsTimeline(item.id, "Life cover support accepted", "Buyer replied YES to life cover comparison support.");
    addOperationsActivity("LIFE", "Life cover support accepted", `${item.id} - buyer`);
    addOperationsAudit("life-cover-optin", item.id, "buyer");
  } else {
    const buyerPhone = resolveCaseParticipantPhone(item, "buyer");
    if (buyerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "BUY",
        recipient: buyerPhone,
        recipientPhone: buyerPhone,
        template: "life-cover-followup",
        message: "Thank you, noted. We will not arrange life cover comparison support unless you ask us later."
      });
    }
    addOperationsTimeline(item.id, "Life cover support declined", "Buyer replied NO to life cover comparison support.");
    addOperationsActivity("LIFE", "Life cover support declined", `${item.id} - buyer`);
    addOperationsAudit("life-cover-declined", item.id, "buyer");
  }
  return true;
}

function applyElectricalCoCInboundReply(item, { sender = "", senderCellphone = "", message = "" }) {
  normalizeCaseComplianceSupport(item);
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  if (role !== "seller") return false;
  const offer = item.complianceSupport?.electricalCoC;
  if (!offer?.offeredAt || offer.response) return false;
  const reply = parseYesNoReply(message);
  if (!reply) return false;
  offer.response = reply;
  offer.responseAt = new Date().toISOString();
  offer.responder = sanitizeShortText(sender || role, 160);

  if (reply === "yes") {
    const conciergeRecipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    if (conciergeRecipient) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "CONC",
        recipient: conciergeRecipient,
        recipientPhone: conciergeRecipient,
        template: "electrical-coc-followup",
        message: `${item.id}: Seller requested trusted electrician support for the Electrical Compliance Certificate. Please arrange partner contact.`
      });
    }
    const sellerPhone = resolveCaseParticipantPhone(item, "seller");
    if (sellerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "SELL",
        recipient: sellerPhone,
        recipientPhone: sellerPhone,
        template: "electrical-coc-followup",
        message: "Great, thank you. We will arrange a trusted electrician partner to contact you for your Electrical Compliance Certificate."
      });
    }
    addOperationsTimeline(item.id, "Electrical COC support accepted", "Seller replied YES to trusted electrician support.");
    addOperationsActivity("COC", "Electrical COC support accepted", `${item.id} - seller`);
    addOperationsAudit("electrical-coc-optin", item.id, "seller");
  } else {
    const sellerPhone = resolveCaseParticipantPhone(item, "seller");
    if (sellerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "SELL",
        recipient: sellerPhone,
        recipientPhone: sellerPhone,
        template: "electrical-coc-followup",
        message: "Thank you, noted. We will not arrange electrician partner support unless you ask us later."
      });
    }
    addOperationsTimeline(item.id, "Electrical COC support declined", "Seller replied NO to trusted electrician support.");
    addOperationsActivity("COC", "Electrical COC support declined", `${item.id} - seller`);
    addOperationsAudit("electrical-coc-declined", item.id, "seller");
  }
  return true;
}

function applyGasCoCInboundReply(item, { sender = "", senderCellphone = "", message = "" }) {
  normalizeCaseComplianceSupport(item);
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  if (role !== "seller") return false;
  const offer = item.complianceSupport?.gasCoC;
  if (!offer?.offeredAt || offer.response) return false;
  const reply = parseYesNoReply(message);
  if (!reply) return false;
  offer.response = reply;
  offer.responseAt = new Date().toISOString();
  offer.responder = sanitizeShortText(sender || role, 160);

  if (reply === "yes") {
    const conciergeRecipient = cleanPhoneNumber(process.env.WHATSAPP_TO_NUMBER || "");
    if (conciergeRecipient) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "CONC",
        recipient: conciergeRecipient,
        recipientPhone: conciergeRecipient,
        template: "gas-coc-followup",
        message: `${item.id}: Seller requested trusted partner support for Gas Certificate of Compliance. Please arrange partner contact.`
      });
    }
    const sellerPhone = resolveCaseParticipantPhone(item, "seller");
    if (sellerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "SELL",
        recipient: sellerPhone,
        recipientPhone: sellerPhone,
        template: "gas-coc-followup",
        message: "Great, thank you. We will arrange a trusted partner to contact you regarding your Gas Certificate of Compliance."
      });
    }
    addOperationsTimeline(item.id, "Gas COC support accepted", "Seller replied YES to trusted gas compliance support.");
    addOperationsActivity("GAS", "Gas COC support accepted", `${item.id} - seller`);
    addOperationsAudit("gas-coc-optin", item.id, "seller");
  } else {
    const sellerPhone = resolveCaseParticipantPhone(item, "seller");
    if (sellerPhone) {
      queueOperationsNotification({
        caseId: item.id,
        channel: "whatsapp",
        stakeholderCode: "SELL",
        recipient: sellerPhone,
        recipientPhone: sellerPhone,
        template: "gas-coc-followup",
        message: "Thank you, noted. We will not arrange Gas Certificate of Compliance partner support unless you ask us later."
      });
    }
    addOperationsTimeline(item.id, "Gas COC support declined", "Seller replied NO to trusted gas compliance support.");
    addOperationsActivity("GAS", "Gas COC support declined", `${item.id} - seller`);
    addOperationsAudit("gas-coc-declined", item.id, "seller");
  }
  return true;
}

const whatsappHumanTakeoverRules = [
  { code: "anger", label: "Anger or frustration", weight: 3, critical: false, pattern: /\b(angry|upset|frustrated|frustrating|furious|ridiculous|unacceptable|terrible service|useless|complain|complaint|fed up|disappointed|annoyed)\b/i },
  { code: "confusion", label: "Confusion or lack of clarity", weight: 2, critical: false, pattern: /\b(confused|confusing|don't understand|do not understand|not sure|unclear|what does this mean|please explain|make no sense|lost here)\b/i },
  { code: "legal-risk", label: "Legal or compliance risk", weight: 5, critical: true, pattern: /\b(legal|lawyer|attorney|sue|court|fraud|misrepresent|breach|breached|compliance issue|fica issue|regulator|ombud|illegal|unlawful)\b/i },
  { code: "commission-dispute", label: "Commission dispute", weight: 5, critical: true, pattern: /\b(commission dispute|commission issue|referral fee dispute|referral dispute|dispute commission|dispute the fee|not paying commission|won't pay commission|commission is wrong|fee dispute)\b/i },
  { code: "human-request", label: "Explicit request for a person", weight: 5, critical: true, pattern: /\b(i want to speak to someone|let me speak to someone|speak to a person|speak to someone|human please|real person|call me now|manager please|agent please|need a human|need a person)\b/i }
];

function getWhatsappNegativeToneBoost(text = "", sourceType = "message") {
  const combined = String(text || "").trim();
  if (!combined) return 0;
  let boost = 0;
  if ((combined.match(/!/g) || []).length >= 2) boost += 1;
  if (/\b(really|very|extremely|seriously|immediately|right now)\b/i.test(combined)) boost += 1;
  if (sourceType === "voice-transcript" && /\b(tone|shouting|angry|upset|crying)\b/i.test(combined)) boost += 1;
  return boost;
}

function analyzeWhatsappHumanTakeover({ message = "", voiceTranscript = "", voiceSummary = "" } = {}) {
  const sources = [
    { type: "message", text: message, multiplier: 1 },
    { type: "voice-transcript", text: voiceTranscript, multiplier: 1.5 },
    { type: "voice-summary", text: voiceSummary, multiplier: 1.2 }
  ].filter((entry) => String(entry.text || "").trim());
  if (!sources.length) return null;

  const matched = new Map();
  let totalScore = 0;
  let critical = false;
  for (const source of sources) {
    for (const rule of whatsappHumanTakeoverRules) {
      if (!rule.pattern.test(source.text)) continue;
      const weightedScore = Math.max(1, Math.round((rule.weight || 1) * source.multiplier));
      const existing = matched.get(rule.code);
      if (!existing || weightedScore > existing.score) {
        matched.set(rule.code, {
          code: rule.code,
          label: rule.label,
          score: weightedScore,
          source: source.type,
          critical: Boolean(rule.critical)
        });
      }
      if (rule.critical) critical = true;
    }
    totalScore += getWhatsappNegativeToneBoost(source.text, source.type);
  }
  for (const entry of matched.values()) totalScore += entry.score;
  if (!matched.size) return null;

  const severity =
    critical || totalScore >= 8 ? "critical"
      : totalScore >= 6 ? "high"
      : totalScore >= 4 ? "medium"
      : "low";
  const shouldTakeOver = critical || totalScore >= 4;
  if (!shouldTakeOver) return null;
  const matches = [...matched.values()].sort((a, b) => b.score - a.score);
  return {
    reasonCodes: matches.map((rule) => rule.code),
    reasonLabels: matches.map((rule) => rule.label),
    score: totalScore,
    severity,
    matchedSignals: matches
  };
}

function detectWhatsappHumanTakeover(text = "") {
  return analyzeWhatsappHumanTakeover({ message: text });
}

function activateCaseHumanTakeover(item, {
  reasons = null,
  sender = "",
  source = "whatsapp-inbound",
  triggerMessage = "",
  triggerMessageId = null
} = {}) {
  const takeover = getCaseHumanTakeoverState(item);
  const now = new Date().toISOString();
  const reasonCodes = Array.isArray(reasons?.reasonCodes) ? reasons.reasonCodes : [];
  const reasonLabels = Array.isArray(reasons?.reasonLabels) ? reasons.reasonLabels : [];
  takeover.active = true;
  takeover.pauseAutomation = true;
  takeover.flaggedAt = takeover.flaggedAt || now;
  takeover.flaggedBy = sanitizeShortText(sender || "WhatsApp participant", 160) || "WhatsApp participant";
  takeover.source = sanitizeShortText(source, 80) || "whatsapp-inbound";
  takeover.reasonCodes = [...new Set([...takeover.reasonCodes, ...reasonCodes])];
  takeover.reasonLabels = [...new Set([...takeover.reasonLabels, ...reasonLabels])];
  takeover.triggerMessage = sanitizeShortText(triggerMessage || takeover.triggerMessage || "", 1200) || "";
  takeover.triggerMessageId = triggerMessageId || takeover.triggerMessageId || null;
  takeover.lastInboundAt = now;
  takeover.resumedAt = null;
  takeover.resumedBy = null;
  takeover.resumeNote = "";

  const reasonText = takeover.reasonLabels.join(", ") || "Human takeover required";
  const dedupeKey = `human-takeover:${item.id}:${takeover.reasonCodes.sort().join("|") || "manual"}`;
  if (!operationsStore.escalations.some((entry) => entry.dedupeKey === dedupeKey && entry.status === "open")) {
    operationsStore.escalations.unshift(createOperationsEscalation({
      item,
      question: `Human takeover triggered from WhatsApp. Reason: ${reasonText}. Automation is paused until concierge resumes the case.`,
      owner: item.concierge || "Concierge queue",
      dedupeKey
    }));
  }
  addOperationsTimeline(item.id, "Human takeover triggered", `${takeover.flaggedBy} triggered a human takeover. Reasons: ${reasonText}. Automation is now paused.`);
  addOperationsActivity("HUMAN", "Human takeover triggered", `${item.id} - ${reasonText}`);
  addOperationsAudit("whatsapp-human-takeover", item.id, `${takeover.flaggedBy}: ${reasonText}`);
  return takeover;
}

function resumeCaseHumanTakeover(item, { actor = "Concierge", note = "" } = {}) {
  const takeover = getCaseHumanTakeoverState(item);
  const wasActive = Boolean(takeover.active);
  takeover.active = false;
  takeover.pauseAutomation = false;
  takeover.resumedAt = new Date().toISOString();
  takeover.resumedBy = sanitizeShortText(actor, 160) || "Concierge";
  takeover.resumeNote = sanitizeShortText(note || "", 500) || "";
  if (wasActive) {
    addOperationsTimeline(item.id, "Human takeover resumed to automation", `${takeover.resumedBy} resumed automation${takeover.resumeNote ? `: ${takeover.resumeNote}` : "."}`);
    addOperationsActivity("HUMAN", "Human takeover cleared", `${item.id} - ${takeover.resumedBy}`);
    addOperationsAudit("whatsapp-human-takeover-resumed", item.id, `${takeover.resumedBy}${takeover.resumeNote ? `: ${takeover.resumeNote}` : ""}`);
  }
  return takeover;
}

function detectInboundWhatsappCommand(message = "") {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return null;
  if (/^(yes\b.*accept (the )?(referral|lead)|accept (the )?(referral|lead)\b)/.test(normalized)) return "accept-referral";
  if (/^status\b/.test(normalized)) return "status";
  if (/^docs?\b/.test(normalized) || normalized.includes("outstanding doc")) return "docs";
  if (/^done\b/.test(normalized) || /^uploaded\b/.test(normalized)) return "done";
  if (normalized.includes("call me") || normalized.includes("please call")) return "call-me";
  return null;
}

function detectInboundWhatsappAppointmentCommand(message = "") {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return null;
  if (/^(confirm|confirmed|i confirm|will be there|see you then|ok confirm|okay confirm)\b/.test(normalized)) return "confirm";
  if (/^(reschedule|reschedule please|need to reschedule|another time|can't make it|cannot make it)\b/.test(normalized)) return "reschedule";
  if (/^(missed|we missed it|i missed it|didn't make it|did not make it|no show)\b/.test(normalized)) return "missed";
  return null;
}

function getInboundRoleOutstandingDocuments(item, role = "") {
  const docs = listOutstandingCaseDocuments(item.id);
  if (!role) return docs;
  return docs.filter((doc) => isOperationsDocumentRoleMatch(doc, role));
}

function markInboundDoneForCase(item, { sender = "", role = "", linkedDocumentIds = [] } = {}) {
  const explicitDocs = listOutstandingCaseDocuments(item.id).filter((doc) => linkedDocumentIds.includes(doc.id));
  const roleDocs = getInboundRoleOutstandingDocuments(item, role);
  const target = explicitDocs[0] || roleDocs[0] || null;
  if (!target) {
    return { changed: false, reply: `${item.id}: thank you, your update has been captured. Concierge will review the file shortly.` };
  }
  if (!target.file?.uploadedAt) {
    target.file = {
      storageName: null,
      originalName: "",
      mimeType: "",
      size: 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: `${sanitizeShortText(sender || "Participant", 120)} via WhatsApp confirmation`
    };
  }
  target.status = "Uploaded";
  target.reminder = "Marked DONE via WhatsApp - Awaiting concierge review";
  addOperationsTimeline(item.id, `${target.name} marked done via WhatsApp`, `${sender || "Participant"} confirmed completion by replying DONE. Concierge review is now queued.`);
  addOperationsActivity("DONE", "WhatsApp task marked done", `${item.id} - ${target.name}`);
  addOperationsAudit("whatsapp-done", item.id, `${sender || "Participant"} marked ${target.name} done`);
  return {
    changed: true,
    reply: `${item.id}: thank you, ${target.name} has been marked received and queued for concierge review.`
  };
}

function acceptReferralFromInbound(item, { sender = "", role = "" } = {}) {
  if (role && role !== "agent") {
    return { changed: false, reply: `${item.id}: referral acceptance is only available to the receiving agent on this case.` };
  }
  item.status = "In progress";
  item.owner = "Agent";
  item.next = "Confirm first client contact";
  item.progress = Math.max(Number(item.progress || 0), 28);
  addOperationsTimeline(item.id, "Referral accepted by WhatsApp", `${sender || item.agent || "Receiving agent"} accepted the referral/lead by WhatsApp quick reply.`);
  addOperationsActivity("AGT", "Referral accepted", `${item.id} - ${sender || item.agent || "Receiving agent"}`);
  addOperationsAudit("whatsapp-referral-accepted", item.id, sender || item.agent || "Receiving agent");
  return {
    changed: true,
    reply: `${item.id}: referral accepted. The file has been moved forward and the next step is to confirm first client contact.`
  };
}

function applyInboundAppointmentCommand(item, command, { sender = "", senderCellphone = "", role = "" } = {}) {
  const appointment = getCaseUpcomingAppointment(item.id, { role, phone: senderCellphone });
  if (!appointment) {
    return { changed: false, reply: `${item.id}: there is no active appointment linked to this chat right now.` };
  }
  const label = appointment.title || formatOperationsAppointmentKind(appointment.kind);
  if (command === "confirm") {
    appointment.status = "confirmed";
    appointment.confirmedAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    addOperationsTimeline(item.id, "Appointment confirmed by WhatsApp", `${sender || appointment.participantName || "Participant"} confirmed ${label} for ${formatOperationsAppointmentTime(appointment.scheduledFor)}.`);
    addOperationsActivity("BOOK", "Appointment confirmed", `${item.id} - ${label}`);
    addOperationsAudit("appointment-confirmed", item.id, `${appointment.id}: ${sender || appointment.participantName || "participant"}`);
    return { changed: true, reply: buildAppointmentWhatsappMessage(item, appointment, { mode: "confirmed-ack" }) };
  }
  if (command === "reschedule") {
    appointment.status = "reschedule-requested";
    appointment.rescheduleRequestedAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    const escalationKey = `appointment-reschedule:${appointment.id}`;
    if (!operationsStore.escalations.some((entry) => entry.dedupeKey === escalationKey)) {
      operationsStore.escalations.unshift(createOperationsEscalation({
        item,
        question: `${label} needs a new time. ${sender || appointment.participantName || "Participant"} requested a reschedule by WhatsApp.`,
        owner: item.concierge || "Concierge queue",
        dedupeKey: escalationKey
      }));
    }
    addOperationsTimeline(item.id, "Appointment reschedule requested", `${sender || appointment.participantName || "Participant"} asked to reschedule ${label}.`);
    addOperationsActivity("BOOK", "Appointment reschedule requested", `${item.id} - ${label}`);
    addOperationsAudit("appointment-reschedule-requested", item.id, `${appointment.id}: ${sender || appointment.participantName || "participant"}`);
    return { changed: true, reply: buildAppointmentWhatsappMessage(item, appointment, { mode: "reschedule-ack" }) };
  }
  if (command === "missed") {
    appointment.status = "missed";
    appointment.missedAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    const escalationKey = `appointment-missed:${appointment.id}`;
    if (!operationsStore.escalations.some((entry) => entry.dedupeKey === escalationKey)) {
      operationsStore.escalations.unshift(createOperationsEscalation({
        item,
        question: `${label} was marked missed by ${sender || appointment.participantName || "participant"}. Re-open the booking loop and record a dated next move.`,
        owner: item.concierge || "Concierge queue",
        dedupeKey: escalationKey
      }));
    }
    addOperationsTimeline(item.id, "Appointment marked missed", `${sender || appointment.participantName || "Participant"} marked ${label} as missed by WhatsApp.`);
    addOperationsActivity("BOOK", "Appointment missed", `${item.id} - ${label}`);
    addOperationsAudit("appointment-missed", item.id, `${appointment.id}: ${sender || appointment.participantName || "participant"}`);
    return { changed: true, reply: buildAppointmentWhatsappMessage(item, appointment, { mode: "missed-ack" }) };
  }
  return { changed: false, reply: "" };
}

function runInboundWhatsappCommand(item, command, { sender = "", senderCellphone = "", role = "", linkedDocumentIds = [] } = {}) {
  if (command === "status") {
    return { changed: false, reply: buildOperationsCaseSummary(item) };
  }
  if (command === "docs") {
    const docs = role ? getRoleGuidedOutstandingDocuments(item.id, role).slice(0, 6) : listCaseDocuments(item.id).slice(0, 6);
    if (!docs.length) return { changed: false, reply: `${item.id}: there are no case documents on file right now.` };
    const nextDoc = role ? getCaseNextGuidedDocument(item, role) : null;
    return {
      changed: false,
      reply: `${item.id}: ${nextDoc ? `the next required document is ${nextDoc.name}. ` : ""}Current documents are ${docs.map((doc) => `${doc.name} (${doc.status}${doc.due ? `, due ${doc.due}` : ""})`).join("; ")}.`
    };
  }
  if (command === "done") {
    return markInboundDoneForCase(item, { sender, role, linkedDocumentIds });
  }
  if (command === "call-me") {
    return { changed: true, reply: `${item.id}: thank you, a concierge call-back request has been logged for follow-up.` };
  }
  if (command === "accept-referral") {
    return acceptReferralFromInbound(item, { sender, role });
  }
  return { changed: false, reply: "" };
}

function buildInboundWhatsappCommandReply(item, command, context = {}) {
  return runInboundWhatsappCommand(item, command, context).reply;
}

async function processInboundWhatsappPayload(payload = {}, { source = "whatsapp-webhook", autoReplyActor = "Axiom Concierge" } = {}) {
  const requestedCaseId = sanitizeShortText(payload?.caseId, 40);
  const sender = sanitizeShortText(payload?.sender || "WhatsApp participant", 160);
  const senderCellphone = sanitizeShortText(payload?.senderCellphone || payload?.from || "", 40);
  const attachments = parseInboundWhatsAppAttachments(payload);
  const item = findOperationsCase(requestedCaseId) || findOperationsCaseByParticipantPhone(senderCellphone);
  if (!item) return { ok: false, status: 404, error: "Case not found" };
  const message = sanitizeShortText(payload?.message, 800);
  if (!message && !attachments.length) return { ok: false, status: 400, error: "Message or attachment is required" };
  const caseId = item.id;
  const role = resolveInboundParticipantRole(item, sender, senderCellphone);
  const guidedDocBeforeUpload = role ? getCaseNextGuidedDocument(item, role) : null;
  const yesNo = parseYesNoReply(message);
  const command = detectInboundWhatsappCommand(message);
  const appointmentCommand = detectInboundWhatsappAppointmentCommand(message);
  let handledMovingReply = false;
  let handledBondReply = false;
  let handledLifeCoverReply = false;
  let handledElectricalReply = false;
  let handledGasReply = false;
  const attachmentEntries = await Promise.all(
    attachments.map(async (attachment) => {
      if (isInboundVoiceNoteAttachment(attachment)) {
        return captureInboundVoiceNoteFromWhatsapp(item, { sender, senderRole: role, attachment, messageText: message });
      }
      return upsertOperationsDocumentFromWhatsapp(item, {
        sender,
        senderRole: role,
        attachment,
        messageText: message
      });
    })
  );
  const ingestedAttachments = attachmentEntries.flatMap((entry) => (Array.isArray(entry) ? entry : [entry])).filter(Boolean);
  const linkedDocumentIds = ingestedAttachments.map((entry) => entry.documentId).filter(Boolean);
  const voiceNotesCaptured = ingestedAttachments.filter((entry) => entry.kind === "voice-note");
  const uploadedDocumentEntries = ingestedAttachments.filter((entry) => entry.documentId && ["uploaded", "linked"].includes(entry.ingestStatus));
  const voiceSentimentSignals = voiceNotesCaptured
    .map((entry) => entry.sentiment)
    .filter((entry) => entry && Array.isArray(entry.reasonCodes));
  const strongestVoiceSentiment = voiceSentimentSignals.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
  const humanTakeoverReasons = analyzeWhatsappHumanTakeover({
    message,
    voiceTranscript: voiceNotesCaptured.map((entry) => entry.transcript || "").filter(Boolean).join(" \n "),
    voiceSummary: voiceNotesCaptured.map((entry) => entry.summary || "").filter(Boolean).join(" \n ")
  });
  const takeoverSignalText = [
    message,
    ...voiceNotesCaptured.map((entry) => entry.transcript || ""),
    ...voiceNotesCaptured.map((entry) => entry.summary || ""),
    strongestVoiceSentiment ? `Voice sentiment risk: ${strongestVoiceSentiment.severity} (${strongestVoiceSentiment.score})` : ""
  ].filter(Boolean).join(" \n ");
  const commandOutcome = command
    ? runInboundWhatsappCommand(item, command, {
        sender,
        senderCellphone,
        role,
        linkedDocumentIds
      })
    : null;
  const appointmentOutcome = appointmentCommand
    ? applyInboundAppointmentCommand(item, appointmentCommand, {
        sender,
        senderCellphone,
        role
      })
    : null;
  if (!humanTakeoverReasons && yesNo && role === "seller") {
    const hintedElectrical = /\b(coc|electrical|electrician|certificate)\b/i.test(message);
    const hintedGas = /\b(gas|lpg|geyser|stove|heater)\b/i.test(message);
    const hintedMoving = /\b(move|moving|removal)\b/i.test(message);
    if (hintedGas) handledGasReply = applyGasCoCInboundReply(item, { sender, senderCellphone, message });
    else if (hintedElectrical) handledElectricalReply = applyElectricalCoCInboundReply(item, { sender, senderCellphone, message });
    else if (hintedMoving) handledMovingReply = applyMovingServicesInboundReply(item, { sender, senderCellphone, message });
    else {
      const pendingKind = getPendingSellerOfferKind(item);
      if (pendingKind === "gas-coc") handledGasReply = applyGasCoCInboundReply(item, { sender, senderCellphone, message });
      else if (pendingKind === "electrical-coc") handledElectricalReply = applyElectricalCoCInboundReply(item, { sender, senderCellphone, message });
      else if (pendingKind === "moving-services") handledMovingReply = applyMovingServicesInboundReply(item, { sender, senderCellphone, message });
    }
  } else if (!humanTakeoverReasons && yesNo && role === "buyer") {
    const hintedBond = /\b(bond|originator|finance|bank|loan|mortgage|quote|quotes|pre-approval)\b/i.test(message);
    const hintedLifeCover = /\b(life cover|lifecover|insurance|assurance|policy)\b/i.test(message);
    const hintedMoving = /\b(move|moving|removal)\b/i.test(message);
    if (hintedLifeCover) handledLifeCoverReply = applyLifeCoverInboundReply(item, { sender, senderCellphone, message });
    else if (hintedBond) handledBondReply = applyBondOriginatorInboundReply(item, { sender, senderCellphone, message });
    else if (hintedMoving) handledMovingReply = applyMovingServicesInboundReply(item, { sender, senderCellphone, message });
    else {
      const pendingKind = getPendingBuyerOfferKind(item);
      if (pendingKind === "life-cover") handledLifeCoverReply = applyLifeCoverInboundReply(item, { sender, senderCellphone, message });
      else if (pendingKind === "bond-originator") handledBondReply = applyBondOriginatorInboundReply(item, { sender, senderCellphone, message });
      else if (pendingKind === "moving-services") handledMovingReply = applyMovingServicesInboundReply(item, { sender, senderCellphone, message });
    }
  } else if (!humanTakeoverReasons) {
    handledMovingReply = applyMovingServicesInboundReply(item, { sender, senderCellphone, message });
    if (!handledMovingReply) handledBondReply = applyBondOriginatorInboundReply(item, { sender, senderCellphone, message });
    if (!handledMovingReply && !handledBondReply) handledLifeCoverReply = applyLifeCoverInboundReply(item, { sender, senderCellphone, message });
    if (!handledMovingReply && !handledBondReply && !handledLifeCoverReply) handledGasReply = applyGasCoCInboundReply(item, { sender, senderCellphone, message });
    if (!handledMovingReply && !handledBondReply && !handledLifeCoverReply && !handledGasReply) handledElectricalReply = applyElectricalCoCInboundReply(item, { sender, senderCellphone, message });
  }
  const threadMessage = appendOperationsWhatsappMessage({
    caseId,
    direction: "inbound",
    senderName: sender,
    senderPhone: senderCellphone,
    senderRole: role,
    text: message || (voiceNotesCaptured.length ? "Voice note received" : attachments.length ? "Attachment received" : ""),
    source,
    attachments: ingestedAttachments,
    linkedDocumentIds
  });
  addOperationsTimeline(
    caseId,
    "Inbound WhatsApp message received",
    `${sender}: ${message || (voiceNotesCaptured.length ? "Voice note received" : "Attachment received")}${ingestedAttachments.length ? ` (${ingestedAttachments.length} attachment${ingestedAttachments.length === 1 ? "" : "s"})` : ""}`
  );
  addOperationsActivity("WA", "Inbound WhatsApp synced", `${caseId} - ${sender}`);
  const capturedSuffix = handledLifeCoverReply
    ? " (life cover preference captured)"
    : handledBondReply
    ? " (bond originator preference captured)"
    : handledGasReply
    ? " (gas COC preference captured)"
    : handledElectricalReply
    ? " (electrical COC preference captured)"
    : handledMovingReply
      ? " (moving services preference captured)"
      : "";
  addOperationsAudit("whatsapp-inbound", caseId, `${sender}: ${message || "Attachment received"}${capturedSuffix}`);
  let autoReply = null;
  if (humanTakeoverReasons) {
    activateCaseHumanTakeover(item, {
      reasons: humanTakeoverReasons,
      sender,
      source,
      triggerMessage: takeoverSignalText,
      triggerMessageId: threadMessage.id
    });
    if (senderCellphone) {
      autoReply = await sendManualWhatsappInboxReply({
        item,
        message: `${item.id}: thank you, a concierge has been flagged to take over this conversation and automation has been paused for now.`,
        recipientName: sender,
        recipientPhone: senderCellphone,
        recipientRole: role,
        source: "human-takeover-auto-ack",
        actor: autoReplyActor
      });
    }
  } else if (appointmentCommand && senderCellphone) {
    autoReply = await sendManualWhatsappInboxReply({
      item,
      message: appointmentOutcome?.reply || `${item.id}: your appointment update has been captured.`,
      recipientName: sender,
      recipientPhone: senderCellphone,
      recipientRole: role,
      source: `inbound-appointment:${appointmentCommand}`,
      actor: autoReplyActor
    });
  } else if (command && senderCellphone) {
    if (command === "call-me") {
      const escalation = createOperationsEscalation({
        item,
        question: `WhatsApp call-back requested by ${sender}.`,
        owner: item.concierge || "Concierge queue"
      });
      operationsStore.escalations.unshift(escalation);
      addOperationsActivity("CALL", "WhatsApp call-back requested", `${caseId} - ${sender}`);
      addOperationsAudit("whatsapp-call-request", caseId, sender);
    }
    autoReply = await sendManualWhatsappInboxReply({
      item,
      message: commandOutcome?.reply || buildInboundWhatsappCommandReply(item, command, {
        sender,
        senderCellphone,
        role,
        linkedDocumentIds
      }),
      recipientName: sender,
      recipientPhone: senderCellphone,
      recipientRole: role,
      source: `inbound-command:${command}`,
      actor: autoReplyActor
    });
  } else if (senderCellphone && uploadedDocumentEntries.length && role) {
    const uploadedNames = uploadedDocumentEntries.map((entry) => entry.documentName || entry.originalName || "document");
    const guidedDocAfterUpload = getCaseNextGuidedDocument(item, role);
    const matchedRequestedDoc = guidedDocBeforeUpload && uploadedDocumentEntries.some((entry) => entry.documentId === guidedDocBeforeUpload.id || normalizeLooseText(entry.documentName || "") === normalizeLooseText(guidedDocBeforeUpload.name || ""));
    let followUpMessage = "";
    if (guidedDocBeforeUpload && !matchedRequestedDoc && guidedDocAfterUpload?.id === guidedDocBeforeUpload.id) {
      followUpMessage = `${item.id}: thank you, we received ${uploadedNames.join(", ")}. The next document we still need from you is ${guidedDocBeforeUpload.name}.${guidedDocBeforeUpload.due ? ` Due: ${guidedDocBeforeUpload.due}.` : ""} ${inferDocumentUploadHint(guidedDocBeforeUpload.name)}`;
    } else if (guidedDocAfterUpload) {
      followUpMessage = `${item.id}: thank you, we received ${uploadedNames.join(", ")}. ${buildGuidedDocumentRequestMessage(item, guidedDocAfterUpload, { includeQueueContext: true })}`;
    } else {
      followUpMessage = `${item.id}: thank you, we received ${uploadedNames.join(", ")}. There are no more required documents waiting from you right now.`;
    }
    autoReply = await sendManualWhatsappInboxReply({
      item,
      message: followUpMessage,
      recipientName: sender,
      recipientPhone: senderCellphone,
      recipientRole: role,
      source: "guided-document-followup",
      actor: autoReplyActor
    });
  }
  persistOperations();
  return {
    ok: true,
    caseId,
    messageId: threadMessage.id,
    senderRole: role,
    handledMovingReply,
    handledBondReply,
    handledLifeCoverReply,
    handledElectricalReply,
    handledGasReply,
    appointmentCommand,
    command,
    autoReply,
    ingestedAttachments
  };
}

app.post("/api/webhooks/whatsapp/inbound", rateLimit({ windowMs: 60000, max: 120 }), async (req, res) => {
  const secret = (process.env.OPERATIONS_WEBHOOK_SECRET || "").trim();
  if (!secret) return res.status(503).json({ ok: false, error: "Inbound WhatsApp webhook is not configured" });
  if ((req.get("x-axiom-webhook-secret") || "").trim() !== secret) {
    return res.status(401).json({ ok: false, error: "Webhook authentication failed" });
  }
  const result = await processInboundWhatsappPayload(req.body, { source: "whatsapp-webhook", autoReplyActor: "Axiom Concierge" });
  return res.status(result.ok ? 200 : result.status || 400).json(result);
});

app.post("/api/leads", rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  const error = validateLeadPayload(req.body);
  if (error) {
    return res.status(400).json({ ok: false, error });
  }

  const scoring = scoreLead(req.body);
  const intakeIntelligence = buildLeadIntakeIntelligence(req.body, scoring);
  const copilot = buildAgentCopilotSummary(req.body, scoring);
  const followUpPlaybook = buildFollowUpPlaybook(req.body, scoring);
  const objectionPlaybook = buildObjectionPlaybook(req.body);
  const sessionId = randomUUID();
  const followUpUrl = `${buildBaseUrl(req)}/?session=${encodeURIComponent(sessionId)}`;

  const session = {
    id: sessionId,
    intent: req.body.intent,
    label: req.body.label,
    dataClass: getIncomingDataClass(req.body?.acquisition?.dataMode, "live"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    firstContactAt: null,
    answers: req.body.answers || [],
    additionalInfo: req.body.additionalInfo || "",
    acquisition: sanitizeLeadAcquisition(req.body.acquisition),
    scoring,
    intakeIntelligence,
    outcome: {
      caseMode: "undecided",
      commercialStatus: "new",
      note: "",
      updatedAt: new Date().toISOString(),
      updatedBy: "System"
    },
    copilot,
    followUpPlaybook,
    objectionPlaybook,
    slots: createSlotsFromLeadPayload(req.body),
    chatHistory: []
  };
  refreshSessionDedupeSignals(session);
  ensureLeadCaseFile(session);
  updateLeadCaseStage(session, "brief-qualified", {
    source: "lead-created",
    actor: "System",
    note: "Lead intake captured and qualified"
  });
  appendLeadAuditEvent(session, {
    type: "lead-created",
    actor: "System",
    source: "intake",
    summary: "Lead captured from website intake",
    details: `Intent: ${(session.intent || "unknown").toUpperCase()} | Intake: ${intakeIntelligence.quality} (${intakeIntelligence.captureScore}/100) | Source: ${session.acquisition?.source || "Direct"}`
  });
  leadSessions.set(sessionId, session);
  persistSessions();

  const autoAcknowledgement = await recordAutomaticLeadAcknowledgement(session);
  const delivery = await deliverSessionToWhatsApp(session, req);

  return res.json({
    ok: true,
    sessionId,
    followUpUrl,
    scoring,
    intakeIntelligence,
    copilot,
    followUpPlaybook,
    objectionPlaybook,
    autoAcknowledgement,
    duplicateSignals: session.duplicateSignals || null,
    nextBestAction: buildNextBestAction(session),
    outcome: getLeadOutcomeSummary(session),
    caseFile: getLeadCaseFileSummary(session),
    delivered: delivery.result.delivered,
    reason: delivery.result.reason || null,
    queuedForManualHandoff: !delivery.result.delivered,
    manualHandoffUrl: delivery.result.delivered ? null : delivery.fallbackUrl
  });
});

app.get("/healthz", (_req, res) => {
  const diagnostics = refreshStartupDiagnostics();
  res.json({
    ok: true,
    service: "axiom-realty-ai",
    status: "up",
    version: APP_VERSION,
    build: APP_BUILD_LABEL,
    diagnostics: {
      ok: diagnostics.ok,
      warnings: diagnostics.warnings.length,
      failures: diagnostics.failures.length
    },
    checkedAt: new Date().toISOString()
  });
});

app.get("/api/app-status", (_req, res) => {
  const diagnostics = publicStatusFromDiagnostics(refreshStartupDiagnostics());
  res.json({
    ok: true,
    service: "axiom-realty-ai",
    version: APP_VERSION,
    build: APP_BUILD_LABEL,
    environment: process.env.RENDER ? "render" : "local",
    diagnostics,
    checkedAt: new Date().toISOString()
  });
});

app.get("/api/system-status", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    diagnostics: refreshStartupDiagnostics(),
    launch: getLaunchReadiness(),
    whatsapp: getWhatsAppConfigStatus(),
    storage: getStorageSummary()
  });
});

app.get("/api/admin/audit-log", requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  res.json({
    ok: true,
    auditLog: (operationsStore.auditLog || []).slice(0, limit)
  });
});

app.get("/api/admin/export", requireAdmin, (_req, res) => {
  const bundle = getSystemExportBundle();
  const filename = `axiom-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(bundle, null, 2));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

loadPersistedSessions();
loadAgentApplications();
loadPersistedOperations();

const startupReport = refreshStartupDiagnostics();
assertProductionSafety(startupReport, { enforce: ENFORCE_PRODUCTION_ENV });
logStartupDiagnostics(startupReport);

app.listen(port, host, () => {
  const publicBase = (process.env.PUBLIC_BASE_URL || "").trim();
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const listenUrl = `http://${displayHost}:${port}`;
  console.log(`Server listening on ${listenUrl}`);
  if (publicBase && publicBase !== listenUrl) console.log(`Public base URL: ${publicBase}`);
});

const operationsSweepTimer = setInterval(() => {
  try {
    sweepOperationsReminders();
  } catch {
    // The next scheduled sweep or manual concierge action can recover.
  }
}, OPERATIONS_SWEEP_INTERVAL_MS);
operationsSweepTimer.unref();

const operationsDeliveryTimer = setInterval(() => {
  processOperationsNotifications().catch(() => {
    // Keep queued messages retryable if a configured channel is temporarily unavailable.
  });
}, OPERATIONS_DELIVERY_INTERVAL_MS);
operationsDeliveryTimer.unref();

if (AUTO_LEAD_AUTOMATION_ENABLED) {
  const leadAutomationTimer = setInterval(() => {
    runLeadAutomationCycle().catch(() => {
      // Keep automation resilient; next cycle can recover automatically.
    });
  }, Math.max(15000, LEAD_AUTOMATION_INTERVAL_MS));
  leadAutomationTimer.unref();
  runLeadAutomationCycle().catch(() => {
    // Non-blocking best-effort startup cycle.
  });
}
