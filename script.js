const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape"
];

const fallbackTownsByProvince = {
  "Eastern Cape": ["Butterworth", "Dikeni", "East London", "Gqeberha", "Graaff-Reinet", "Kariega", "Komani", "Makhanda", "Mthatha", "Qonce", "Zwelitsha"],
  "Free State": ["Bethlehem", "Bloemfontein", "Jagersfontein", "Kroonstad", "Odendaalsrus", "Parys", "Phuthaditjhaba", "Sasolburg", "Virginia", "Welkom"],
  Gauteng: ["Benoni", "Boksburg", "Brakpan", "Carletonville", "Germiston", "Johannesburg", "Krugersdorp", "Pretoria", "Randburg", "Randfontein", "Roodepoort", "Soweto", "Springs", "Vanderbijlpark", "Vereeniging"],
  "KwaZulu-Natal": ["Durban", "Empangeni", "Newcastle", "Pietermaritzburg", "Pinetown", "Ulundi", "Umlazi", "uMnambithi"],
  Limpopo: ["Giyani", "Lebowakgomo", "Musina", "Phalaborwa", "Polokwane", "Seshego", "Sibasa", "Thabazimbi"],
  Mpumalanga: ["Emalahleni", "Mbombela", "Secunda"],
  "North West": ["Klerksdorp", "Mahikeng", "Mmabatho", "Potchefstroom", "Rustenburg"],
  "Northern Cape": ["Kimberley", "Kuruman", "Port Nolloth"],
  "Western Cape": ["Bellville", "Cape Town", "Constantia", "George", "Hopefield", "Oudtshoorn", "Paarl", "Simon's Town", "Stellenbosch", "Swellendam", "Worcester"]
};
const townsByProvince = window.townsByProvinceData || fallbackTownsByProvince;
const propertyTypeOptions = ["Land", "Duplex", "Simplex", "Flat", "House", "Farm"];
const estateAgencyOptions = [
  "3%.Com Properties",
  "@Realty",
  "Acutts",
  "AIDA",
  "Apple Property",
  "Better Homes",
  "Century 21",
  "Chas Everitt",
  "Dormehl Phalane Property Group",
  "Engel & Volkers",
  "eXp South Africa",
  "Fine & Country",
  "Greeff Christie's International Real Estate",
  "Harcourts",
  "Huizemark",
  "Jawitz Properties",
  "Just Property",
  "Keller Williams",
  "Leapfrog",
  "Lew Geffen Sotheby's International Realty",
  "Meridian Realty",
  "Only Realty",
  "Other / Independent",
  "Pam Golding Properties",
  "Property.CoZa",
  "Rawson Properties",
  "RealNet",
  "RE/MAX",
  "Seeff",
  "Sotheby's International Realty",
  "Tyson Properties",
  "Urban Link",
  "Wakefields"
];
const manualLifecycleStageOptions = [
  { value: "acknowledged", label: "Acknowledged" },
  { value: "with-agent", label: "With agent" },
  { value: "sale-pending", label: "Sale pending" },
  { value: "sale-concluded", label: "Sale concluded" },
  { value: "closed", label: "Closed" }
];
const referralAcceptanceViaOptions = ["Signed form", "Portal acknowledgement", "WhatsApp", "Phone call", "Email", "SMS", "In person", "Other"];
const dealMilestoneOptions = [
  { value: "referral-accepted", label: "Referral accepted" },
  { value: "agent-contacted", label: "Agent contacted client" },
  { value: "viewing-booked", label: "Viewing/valuation booked" },
  { value: "offer-received", label: "Offer received" },
  { value: "otp-signed", label: "Offer to purchase signed" },
  { value: "sale-pending", label: "Sale pending" },
  { value: "suspensive-conditions", label: "Suspensive conditions tracked" },
  { value: "bond-approval", label: "Bond approval confirmed" },
  { value: "guarantees-issued", label: "Guarantees issued" },
  { value: "transfer-instruction", label: "Transfer instruction sent" },
  { value: "fica-complete", label: "FICA complete" },
  { value: "compliance-certificates", label: "Compliance certificates ready" },
  { value: "rates-clearance", label: "Rates clearance issued" },
  { value: "transfer-documents-signed", label: "Transfer documents signed" },
  { value: "bond-documents-signed", label: "Bond documents signed" },
  { value: "lodged", label: "Lodged at Deeds Office" },
  { value: "registered", label: "Registered" },
  { value: "sale-concluded", label: "Sale concluded" },
  { value: "handover-complete", label: "Handover complete" },
  { value: "deal-lost", label: "Deal lost/closed" }
];
const commissionPayoutStatusOptions = ["Not due", "Due", "Invoiced", "Paid", "Disputed", "Waived"];
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
const leadCaseModeOptions = [
  { value: "undecided", label: "Undecided" },
  { value: "referral_only", label: "Referral-only" },
  { value: "managed_transaction", label: "Managed transaction" },
  { value: "archived", label: "Archived" }
];
const leadCommercialStatusOptions = [
  { value: "new", label: "New" },
  { value: "handed_off", label: "Handed off" },
  { value: "accepted_by_agent", label: "Accepted by agent" },
  { value: "client_contacted", label: "Client contacted" },
  { value: "referral_fee_due", label: "Referral fee due" },
  { value: "referral_fee_paid", label: "Referral fee paid" },
  { value: "under_management", label: "Under management" },
  { value: "transaction_closed", label: "Transaction closed" },
  { value: "archived", label: "Archived" }
];
const leadStageTabOptions = [
  { value: "all", label: "All" },
  { value: "new-unacknowledged", label: "New" },
  { value: "in-progress", label: "In progress" },
  { value: "with-agent", label: "With agent" },
  { value: "sale-pending", label: "Sale pending" },
  { value: "closed", label: "Closed" }
];

const paths = {
  buy: {
    label: "Buyer Brief",
    intro: "Quick buyer request",
    submitText: "Find me a property expert",
    responseText:
      "Thank you. We’ve received your request and will match you with a suitable property expert.",
    questions: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
      {
        name: "province",
        label: "Province",
        type: "select",
        required: true,
        options: southAfricanProvinces
      },
      {
        name: "area",
        label: "Preferred area",
        type: "text",
        required: true,
        townLookupByProvince: true,
        provinceField: "province",
        placeholder: "Start typing town name"
      },
      { name: "budget", label: "Budget range (ZAR)", type: "text", required: true },
      {
        name: "timeline",
        label: "Timeline to buy",
        type: "select",
        required: true,
        options: ["Immediately", "Within 1 month", "Within 3 months", "Within 6 months", "6+ months"]
      }
    ]
  },
  sell: {
    label: "Seller Brief",
    intro: "Quick seller request",
    submitText: "Sell my property",
    responseText:
      "Thank you. We’ve received your request and will match you with a suitable property expert.",
    questions: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
      {
        name: "province",
        label: "Province",
        type: "select",
        required: true,
        options: southAfricanProvinces
      },
      {
        name: "location",
        label: "Property location",
        type: "text",
        required: true,
        townLookupByProvince: true,
        provinceField: "province",
        placeholder: "Start typing town name"
      },
      {
        name: "expectedPrice",
        label: "Expected selling price (ZAR)",
        type: "text",
        required: true
      },
      {
        name: "timeline",
        label: "Timeline to sell",
        type: "select",
        required: true,
        options: ["Immediately", "Within 1 month", "Within 3 months", "Within 6 months", "6+ months"]
      }
    ]
  }
};

const intakeOverlay = document.getElementById("intakeOverlay");
const intakeForm = document.getElementById("intakeForm");
const dynamicFields = document.getElementById("dynamicFields");
const intakeTitle = document.getElementById("intakeTitle");
const intakeEyebrow = document.getElementById("intakeEyebrow");
const closeModal = document.getElementById("closeModal");
const progressNote = document.getElementById("progressNote");
const additionalInfoLabel = document.getElementById("additionalInfoLabel");
const additionalInfoInput = document.getElementById("additionalInfo");
const submitLeadBtn = document.getElementById("submitLeadBtn");
const nextStepMessage = document.getElementById("nextStepMessage");
const conciergeToggle = document.getElementById("conciergeToggle");
const conciergePanel = document.getElementById("conciergePanel");
const conciergeClose = document.getElementById("conciergeClose");
const conciergeMessages = document.getElementById("conciergeMessages");
const conciergeForm = document.getElementById("conciergeForm");
const conciergeInput = document.getElementById("conciergeInput");
const mTotalLeads = document.getElementById("mTotalLeads");
const mAvgScore = document.getElementById("mAvgScore");
const mCompletion = document.getElementById("mCompletion");
const mHotLeads = document.getElementById("mHotLeads");
const mFollowUps = document.getElementById("mFollowUps");
const mMessages = document.getElementById("mMessages");
const mAtRisk = document.getElementById("mAtRisk");
const mOverdue = document.getElementById("mOverdue");
const mDeliveryFailed = document.getElementById("mDeliveryFailed");
const mProtectedDeals = document.getElementById("mProtectedDeals");
const mCommissionRisk = document.getElementById("mCommissionRisk");
const mAgentAcks = document.getElementById("mAgentAcks");
const mUnackedLinks = document.getElementById("mUnackedLinks");
const sprintStatus = document.getElementById("sprintStatus");
const sprintReferrals = document.getElementById("sprintReferrals");
const sprintClosures = document.getElementById("sprintClosures");
const sprintLeads = document.getElementById("sprintLeads");
const sprintContacted = document.getElementById("sprintContacted");
const sprintFocus = document.getElementById("sprintFocus");
const sprintSources = document.getElementById("sprintSources");
const inboxFocus = document.getElementById("inboxFocus");
const inboxBoundary = document.getElementById("inboxBoundary");
const inboxMission = document.getElementById("inboxMission");
const inboxCommandSummary = document.getElementById("inboxCommandSummary");
const inboxCommandDeck = document.getElementById("inboxCommandDeck");
const analyticsSection = document.getElementById("analytics");
const riskLeadList = document.getElementById("riskLeadList");
const riskCommandSummary = document.getElementById("riskCommandSummary");
const riskCommandDeck = document.getElementById("riskCommandDeck");
const taskQueueList = document.getElementById("taskQueueList");
const dailyControlDate = document.getElementById("dailyControlDate");
const dailyControlSla = document.getElementById("dailyControlSla");
const dailyControlEscalations = document.getElementById("dailyControlEscalations");
const dailyControlCommissionRisk = document.getElementById("dailyControlCommissionRisk");
const dailyControlReferred = document.getElementById("dailyControlReferred");
const dailyControlContacted = document.getElementById("dailyControlContacted");
const dailyControlClosures = document.getElementById("dailyControlClosures");
const taskCommandSummary = document.getElementById("taskCommandSummary");
const taskCommandDeck = document.getElementById("taskCommandDeck");
const downloadDailyReport = document.getElementById("downloadDailyReport");
const followupControlGrid = document.getElementById("followupControlGrid");
const agentAssistList = document.getElementById("agentAssistList");
const leadFilterForm = document.getElementById("leadFilterForm");
const leadPeriod = document.getElementById("leadPeriod");
const leadSort = document.getElementById("leadSort");
const leadReferral = document.getElementById("leadReferral");
const leadDataset = document.getElementById("leadDataset");
const leadStatus = document.getElementById("leadStatus");
const leadSearch = document.getElementById("leadSearch");
const clearLeadFilters = document.getElementById("clearLeadFilters");
const leadQueueCount = document.getElementById("leadQueueCount");
const taskQueueCount = document.getElementById("taskQueueCount");
const leadStageTabs = document.getElementById("leadStageTabs");
const operationsTabs = [...document.querySelectorAll("[data-operations-tab]")];
const operationsTabPanels = [...document.querySelectorAll("[data-operations-panel]")];
const adminGate = document.getElementById("adminGate");
const adminPassword = document.getElementById("adminPassword");
const adminMessage = document.getElementById("adminMessage");
const operationsPanel = document.getElementById("operationsPanel");
const whatsappBridgeBadge = document.getElementById("whatsappBridgeBadge");
const whatsappBridgeStatus = document.getElementById("whatsappBridgeStatus");
const whatsappQrWrap = document.getElementById("whatsappQrWrap");
const whatsappQrImage = document.getElementById("whatsappQrImage");
const startWhatsappBridge = document.getElementById("startWhatsappBridge");
const sendWhatsappBridgeTest = document.getElementById("sendWhatsappBridgeTest");
const runSmartReminders = document.getElementById("runSmartReminders");
const processWhatsappQueue = document.getElementById("processWhatsappQueue");
const smartReminderStatus = document.getElementById("smartReminderStatus");
const refreshWhatsappInbox = document.getElementById("refreshWhatsappInbox");
const whatsappCaseList = document.getElementById("whatsappCaseList");
const whatsappThreadTitle = document.getElementById("whatsappThreadTitle");
const whatsappThreadMeta = document.getElementById("whatsappThreadMeta");
const whatsappThreadMessages = document.getElementById("whatsappThreadMessages");
const whatsappReplyForm = document.getElementById("whatsappReplyForm");
const whatsappReplyRecipient = document.getElementById("whatsappReplyRecipient");
const whatsappReplyInput = document.getElementById("whatsappReplyInput");
const logoutWhatsappBridge = document.getElementById("logoutWhatsappBridge");
const registerSnapshotCount = document.getElementById("registerSnapshotCount");
const registerFilterChips = document.getElementById("registerFilterChips");
const registerCommandSummary = document.getElementById("registerCommandSummary");
const registerCommandDeck = document.getElementById("registerCommandDeck");
const referralRegisterBody = document.getElementById("referralRegisterBody");
const commissionRegisterBody = document.getElementById("commissionRegisterBody");
const transferRegisterBody = document.getElementById("transferRegisterBody");
const expertApplicationForm = document.getElementById("expertApplicationForm");
const expertApplicationMessage = document.getElementById("expertApplicationMessage");

let activeIntent = "buy";
let activeSessionId = "";
const openedManualHandoffSessions = new Set();
let adminToken = sessionStorage.getItem("axiomAdminPassword") || "";
const expandedLeadIds = new Set();
let leadColumnSort = { field: "received", direction: "desc" };
let activeLeadStage = "all";
let activeRegisterFilter = "all";
let leadAssistRequestId = 0;
let latestLeadQueueSnapshot = [];
let whatsappInboxState = { cases: [], selectedCaseId: "" };
const urlParams = new URLSearchParams(window.location.search);
const staticMode = window.location.protocol === "file:" || urlParams.get("static") === "1";
if (staticMode && !adminToken) {
  adminToken = "static-mode";
  sessionStorage.setItem("axiomAdminPassword", adminToken);
}
const adminMode =
  urlParams.get("admin") === "1" ||
  window.location.hash.toLowerCase() === "#admin" ||
  Boolean(adminToken);

const staticNow = Date.now();
const staticLeads = [
  {
    id: "AX-STATIC-001",
    label: "Demo seller lead",
    intent: "sell",
    createdAt: new Date(staticNow - 55 * 60000).toISOString(),
    updatedAt: new Date(staticNow - 12 * 60000).toISOString(),
    referred: true,
    queueStatus: "open",
    conciergeAcknowledgedAt: new Date(staticNow - 48 * 60000).toISOString(),
    slots: {
      fullName: "Naledi Mokoena",
      phone: "+27 82 555 0188",
      email: "naledi@example.com",
      province: "Gauteng",
      area: "Sandton",
      propertyType: "House",
      expectedPrice: "R3,450,000",
      priceDisplay: "R3,450,000",
      timeline: "Within 1 month"
    },
    scoring: { score: 91, urgency: "High", closeLikelihood: "Strong" },
    copilot: { snapshot: "Seller wants a fast valuation and agent contact today. Strong referral opportunity." },
    acquisition: { source: "website", medium: "direct", campaign: "local-static" },
    assignedAgent: {
      name: "Thabo Dlamini",
      phone: "+27 82 555 0123",
      agency: "RE/MAX",
      assignedAt: new Date(staticNow - 42 * 60000).toISOString()
    },
    lifecycle: {
      code: "sale-pending",
      label: "Sale pending",
      updatedAt: new Date(staticNow - 30 * 60000).toISOString(),
      note: "Agent confirmed client contact and valuation appointment.",
      ageDays: 1
    },
    agentContact: {
      medium: "WhatsApp",
      contactedAt: new Date(staticNow - 38 * 60000).toISOString(),
      note: "Client confirmed availability."
    },
    delivery: { delivered: true, attemptedAt: new Date(staticNow - 50 * 60000).toISOString() },
    autoAcknowledgement: { recordedAt: new Date(staticNow - 50 * 60000).toISOString(), clientConfirmationDelivered: true },
    clientConfirmationDelivery: { delivered: true, attemptedAt: new Date(staticNow - 49 * 60000).toISOString() },
    outcome: {
      caseMode: "managed_transaction",
      caseModeLabel: "Managed transaction",
      commercialStatus: "under_management",
      commercialStatusLabel: "Under management",
      responsibilityEnds: false,
      updatedAt: new Date(staticNow - 25 * 60000).toISOString(),
      note: "Track through transfer because commission and client updates matter."
    },
    agentAccess: {
      active: true,
      createdAt: new Date(staticNow - 41 * 60000).toISOString(),
      expiresAt: new Date(staticNow + 14 * 86400000).toISOString(),
      lastViewedAt: new Date(staticNow - 35 * 60000).toISOString(),
      acknowledgedAt: new Date(staticNow - 33 * 60000).toISOString()
    },
    agentHandoff: {
      status: "accepted",
      label: "Accepted",
      nextAction: "Monitor offer movement and commission evidence.",
      gates: [
        { label: "Agent accepted referral", complete: true, detail: "Terms accepted", completedAt: new Date(staticNow - 33 * 60000).toISOString() },
        { label: "Client contact confirmed", complete: true, detail: "WhatsApp contact made", completedAt: new Date(staticNow - 38 * 60000).toISOString() },
        { label: "Referral terms protected", complete: true, detail: "12.5% referral fee", completedAt: new Date(staticNow - 33 * 60000).toISOString() }
      ]
    },
    stakeholderAccess: {
      seller: { active: true, expiresAt: new Date(staticNow + 14 * 86400000).toISOString() },
      agent: { active: true, expiresAt: new Date(staticNow + 14 * 86400000).toISOString() },
      attorney: { active: true, expiresAt: new Date(staticNow + 14 * 86400000).toISOString() }
    },
    agentUpdates: [
      { at: new Date(staticNow - 25 * 60000).toISOString(), agentName: "Thabo Dlamini", status: "Offer pending", commissionAgreement: "Confirmed", note: "Client reviewing valuation range." }
    ],
    stakeholderUpdates: [
      { at: new Date(staticNow - 20 * 60000).toISOString(), roleLabel: "Attorney", note: "Transfer checklist opened." }
    ],
    dealProtection: {
      status: "Offer pending",
      commissionAgreement: "Confirmed",
      updatedAt: new Date(staticNow - 24 * 60000).toISOString(),
      nextCheckIn: new Date(staticNow + 86400000).toISOString().slice(0, 10),
      note: "Referral terms accepted before agent work continued."
    },
    commissionProtection: {
      protected: true,
      termsProtected: true,
      referralPercent: 12.5,
      saleValue: 3450000,
      expectedCommission: 431250,
      payoutDueDate: new Date(staticNow + 21 * 86400000).toISOString().slice(0, 10),
      invoicePaymentStatus: "Due",
      payoutStatus: "Due",
      dueState: "due",
      priority: "High",
      nextAction: "Prepare invoice once OTP is unconditional.",
      payoutReference: "AX-REF-001",
      note: "Protect fee until registration and payment."
    },
    dealProof: {
      referralAcceptance: {
        acceptedBy: "Thabo Dlamini",
        via: "Portal acknowledgement",
        acceptedAt: new Date(staticNow - 33 * 60000).toISOString(),
        note: "Referral terms accepted."
      },
      milestones: [
        { code: "referral-accepted", label: "Referral accepted", completedAt: new Date(staticNow - 33 * 60000).toISOString(), actor: "Agent", note: "Accepted in portal", proofRef: "AX-REF-001" },
        { code: "agent-contacted", label: "Agent contacted client", completedAt: new Date(staticNow - 30 * 60000).toISOString(), actor: "Agent", note: "WhatsApp contact confirmed" },
        { code: "offer-received", label: "Offer received", completedAt: new Date(staticNow - 10 * 60000).toISOString(), actor: "Concierge", note: "Awaiting OTP upload" }
      ],
      commission: {
        saleValue: 3450000,
        referralPercent: 12.5,
        expectedCommission: 431250,
        payoutStatus: "Due",
        payoutDueDate: new Date(staticNow + 21 * 86400000).toISOString().slice(0, 10),
        payoutReference: "AX-REF-001"
      }
    },
    transactionTimeline: {
      state: "active",
      progress: 42,
      currentMilestone: { label: "Offer received", completedAt: new Date(staticNow - 10 * 60000).toISOString() },
      nextMilestone: { label: "OTP signed", owner: "Agent" },
      milestones: [
        { order: 1, label: "Referral accepted", phase: "Referral", owner: "Agent", complete: true, completedAt: new Date(staticNow - 33 * 60000).toISOString(), actor: "Agent", note: "Terms accepted" },
        { order: 2, label: "Agent contacted client", phase: "Contact", owner: "Agent", complete: true, completedAt: new Date(staticNow - 30 * 60000).toISOString(), actor: "Agent", note: "WhatsApp contact" },
        { order: 3, label: "Offer received", phase: "Offer", owner: "Agent", complete: true, completedAt: new Date(staticNow - 10 * 60000).toISOString(), actor: "Concierge", note: "Offer pending review" },
        { order: 4, label: "OTP signed", phase: "Offer", owner: "Agent", complete: false },
        { order: 5, label: "Bond approval", phase: "Finance", owner: "Bond originator", complete: false },
        { order: 6, label: "Transfer lodged", phase: "Transfer", owner: "Attorney", complete: false },
        { order: 7, label: "Registered", phase: "Registration", owner: "Attorney", complete: false }
      ]
    },
    leadDocuments: [
      { id: "doc-1", category: "FICA", originalName: "seller-id-proof.pdf", size: 184000, uploadedAt: new Date(staticNow - 18 * 60000).toISOString(), note: "ID and proof of address." },
      { id: "doc-2", category: "Offer to Purchase (OTP)", originalName: "draft-otp.pdf", size: 312000, uploadedAt: new Date(staticNow - 8 * 60000).toISOString(), note: "Draft pending signature." }
    ],
    escalationFlags: [
      { category: "Missing docs", title: "Signed OTP not uploaded", reason: "Offer exists but signed OTP is not in vault.", nextAction: "Request signed OTP from agent.", priority: "High", missingDocuments: ["Signed OTP"], dueAt: new Date(staticNow + 3 * 3600000).toISOString() }
    ],
    followUpIntelligence: {
      primary: "Request signed OTP",
      priority: "High",
      reason: "Offer milestone is active and document vault needs signed proof.",
      suggestions: [
        { label: "Ask agent for OTP", reason: "Protect commission and transfer timeline.", detail: "Send WhatsApp follow-up now.", priority: "High" },
        { label: "Check attorney readiness", reason: "Prepare transfer instruction.", priority: "Medium" }
      ]
    },
    nextBestAction: { title: "Request signed OTP", reason: "Milestone evidence is missing.", priority: "High" },
    intakeIntelligence: {
      summary: "High-quality seller intake with clear area, price and timeline.",
      captureScore: 92,
      routeReadiness: "Ready for managed transaction",
      quality: "Strong",
      capturedSignals: 8,
      totalSignals: 9,
      priority: "High",
      missingCritical: [],
      missingEnrichment: ["Municipal rates statement"],
      actions: [{ label: "Confirm mandate status", detail: "Ask whether another agent has an active mandate.", priority: "Medium" }]
    },
    agentMatch: {
      available: true,
      recommendation: "Best available Sandton seller specialist.",
      confidence: 88,
      nextAction: "Use the recommended specialist or confirm another agent.",
      agent: { name: "Thabo Dlamini", phone: "+27 82 555 0123", agency: "RE/MAX", email: "thabo@example.com", metrics: { priorAssignments: 7, hotLeadAssignments: 3, averageResponseMinutes: 18 } },
      reasons: ["Works seller leads in Sandton", "Fast contact history", "Prior high-value sale handling"],
      cautions: ["Confirm no mandate conflict"],
      alternatives: [{ name: "Lerato Jacobs", agency: "Pam Golding Properties", confidence: 76 }]
    },
    duplicateSignals: { isDuplicate: false },
    followUpPlaybook: [
      { trigger: "Agent update", message: "Hi Thabo, please confirm whether the OTP is signed and upload proof for the file." },
      { trigger: "Seller update", message: "Hi Naledi, your sale is being tracked and we are waiting for the signed offer document." }
    ],
    objectionPlaybook: [
      { objection: "Why share documents now?", response: "The vault keeps transfer and commission evidence in one place so delays are visible early." }
    ],
    proofTrail: [
      { at: new Date(staticNow - 50 * 60000).toISOString(), actor: "System", summary: "Lead registered", hash: "static001a" },
      { at: new Date(staticNow - 33 * 60000).toISOString(), actor: "Agent", summary: "Referral terms accepted", hash: "static001b" },
      { at: new Date(staticNow - 8 * 60000).toISOString(), actor: "Concierge", summary: "Draft OTP stored", hash: "static001c" }
    ]
  },
  {
    id: "AX-STATIC-002",
    label: "Demo buyer lead",
    intent: "buy",
    createdAt: new Date(staticNow - 2 * 3600000).toISOString(),
    updatedAt: new Date(staticNow - 90 * 60000).toISOString(),
    referred: false,
    queueStatus: "open",
    slots: {
      fullName: "Michael Naidoo",
      phone: "+27 83 555 0199",
      email: "michael@example.com",
      province: "Western Cape",
      area: "Cape Town",
      propertyType: "Flat",
      budget: "R1,850,000",
      priceDisplay: "R1,850,000",
      timeline: "Immediately"
    },
    scoring: { score: 78, urgency: "Medium", closeLikelihood: "Good" },
    copilot: { snapshot: "Buyer is ready to view apartments in Cape Town and needs agent matching." },
    acquisition: { source: "website", medium: "direct", campaign: "local-static" },
    lifecycle: { code: "new-unacknowledged", label: "New / Unacknowledged", updatedAt: new Date(staticNow - 2 * 3600000).toISOString(), note: "" },
    delivery: { delivered: false, attemptedAt: new Date(staticNow - 110 * 60000).toISOString() },
    outcome: { caseMode: "undecided", caseModeLabel: "Undecided", commercialStatus: "new", commercialStatusLabel: "New" },
    agentHandoff: { status: "not_started", label: "Not introduced", nextAction: "Assign a Cape Town buyer specialist and create the introduction link." },
    dealProtection: { status: "Active", commissionAgreement: "Not discussed" },
    commissionProtection: { protected: false, referralPercent: 12.5, payoutStatus: "Not due", priority: "Medium", nextAction: "Confirm referral terms when assigning agent." },
    intakeIntelligence: {
      summary: "Good buyer intake but finance readiness still needs confirmation.",
      captureScore: 76,
      routeReadiness: "Ready for agent matching",
      quality: "Good",
      capturedSignals: 6,
      totalSignals: 9,
      priority: "Medium",
      missingCritical: ["Finance readiness"],
      missingEnrichment: ["Preferred suburbs"],
      actions: [{ label: "Ask finance status", detail: "Cash, pre-approved bond, or still applying?", priority: "High" }]
    },
    followUpIntelligence: {
      primary: "Assign agent",
      priority: "Medium",
      reason: "Lead is fresh and still unacknowledged.",
      suggestions: [{ label: "Acknowledge lead", reason: "Keep SLA intact.", priority: "High" }]
    },
    nextBestAction: { title: "Assign Cape Town agent", reason: "No receiving agent yet.", priority: "High" },
    escalationFlags: [
      { category: "No contact", title: "Lead not acknowledged", reason: "No admin or agent contact recorded.", nextAction: "Acknowledge and assign agent.", priority: "High", dueAt: new Date(staticNow + 30 * 60000).toISOString() }
    ],
    agentMatch: {
      available: true,
      recommendation: "Buyer specialist available for Cape Town flats.",
      confidence: 81,
      nextAction: "Load the recommended specialist into the introduction fields.",
      agent: { name: "Mia Petersen", phone: "+27 84 555 0144", agency: "Seeff", email: "mia@example.com", metrics: { priorAssignments: 4, averageResponseMinutes: 22 } },
      reasons: ["Cape Town buyer focus", "Apartment experience"],
      cautions: ["Confirm bond readiness"],
      alternatives: [{ name: "Andre Jacobs", agency: "Rawson Properties", confidence: 69 }]
    },
    duplicateSignals: { isDuplicate: false },
    followUpPlaybook: [
      { trigger: "Buyer finance", message: "Hi Michael, are you pre-approved, paying cash, or still applying for finance?" }
    ],
    objectionPlaybook: [
      { objection: "I am just looking", response: "No problem. We can still match you with one useful local expert and keep the pressure low." }
    ],
    leadDocuments: [],
    proofTrail: [{ at: new Date(staticNow - 2 * 3600000).toISOString(), actor: "System", summary: "Lead registered", hash: "static002a" }]
  }
];

const staticAnalytics = {
  totalLeads: staticLeads.length,
  avgScore: 85,
  completionRate: 84,
  scoreBands: { Hot: 1, Warm: 1, Cold: 0 },
  atRiskLeads: 2,
  overdueLeads: 0,
  failedDeliveries: 1,
  protectedDeals: 1,
  commissionAtRisk: 1,
  agentAcknowledgements: 1,
  unacknowledgedAgentLinks: 1,
  activeFollowUps: 4,
  conciergeInteractions: 7,
  dataClasses: { test: 0, draft: 0 },
  conversionSprint: {
    days: 7,
    referred: 1,
    closedWon: 0,
    newLeads: 2,
    contacted: 1,
    targets: { referrals: 6, closures: 2 },
    recommendedFocus: "Assign the open buyer lead and secure signed OTP proof on the seller lead.",
    sources: [{ source: "Website", leads: 2 }]
  }
};

const staticTasks = [
  {
    leadId: "AX-STATIC-001",
    title: "Escalation: missing OTP",
    priority: "High",
    status: "due-soon",
    dueAt: new Date(staticNow + 3 * 3600000).toISOString(),
    leadName: "Naledi Mokoena",
    intent: "sell",
    area: "Sandton",
    reason: "Signed OTP not yet stored in the document vault.",
    detail: "Ask the agent to upload signed proof.",
    cadence: "Today"
  },
  {
    leadId: "AX-STATIC-002",
    title: "Assign agent",
    priority: "High",
    status: "due-soon",
    dueAt: new Date(staticNow + 30 * 60000).toISOString(),
    leadName: "Michael Naidoo",
    intent: "buy",
    area: "Cape Town",
    reason: "No receiving agent yet.",
    detail: "Use recommended Cape Town buyer specialist.",
    cadence: "Now"
  }
];

const staticWhatsapp = {
  cloudConfigured: false,
  webTest: {
    enabled: false,
    ready: false,
    status: "Static mode",
    lastError: "WhatsApp sending needs the live server."
  }
};

function staticJson(body, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function getStaticLeadList(resource) {
  const url = new URL(resource, window.location.href);
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const referral = url.searchParams.get("referral") || "all";
  const status = url.searchParams.get("status") || "all";
  let leads = staticLeads.slice();
  if (referral === "referred") leads = leads.filter((lead) => lead.referred || lead.assignedAgent?.name);
  if (referral === "unreferred") leads = leads.filter((lead) => !lead.referred && !lead.assignedAgent?.name);
  if (status && status !== "all") {
    leads = leads.filter((lead) => {
      const code = lead.lifecycle?.code || "new-unacknowledged";
      if (status === "in-progress") return !["new-unacknowledged", "closed", "sale-concluded"].includes(code);
      return code === status;
    });
  }
  if (search) {
    leads = leads.filter((lead) => JSON.stringify(lead).toLowerCase().includes(search));
  }
  return leads;
}

function installStaticApi() {
  if (!staticMode) return;
  const liveFetch = window.fetch.bind(window);
  window.fetch = (resource, options = {}) => {
    const url = new URL(resource, window.location.href);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.startsWith("/api")) return liveFetch(resource, options);
    if (path === "/api/analytics") return staticJson({ analytics: staticAnalytics });
    if (path === "/api/followup-tasks") {
      return staticJson({
        tasks: staticTasks,
        summary: { total: staticTasks.length, byStatus: { overdue: 0, "due-soon": staticTasks.length, upcoming: 0 } }
      });
    }
    if (path === "/api/concierge-daily-report") {
      return staticJson({
        windows: { localDateLabel: new Date().toLocaleDateString() },
        summary: {
          slaMetToday: 1,
          newLeadsToday: 2,
          escalationLeadsOpen: 2,
          commissionRiskOpen: 1,
          referredToday: 1,
          contactedToday: 1,
          closedWonToday: 0
        }
      });
    }
    if (path === "/api/whatsapp/status" || path === "/api/whatsapp-web/start" || path === "/api/whatsapp-web/logout" || path === "/api/whatsapp/test") {
      return staticJson({ whatsapp: staticWhatsapp, result: { delivered: false, reason: "Static mode" } });
    }
    if (path === "/api/whatsapp/inbox") {
      return staticJson({
        inbox: [
          {
            caseId: "AX-1048",
            client: "Johan & Mia Botha",
            stage: "Market preparation",
            next: "Upload certified ID",
            owner: "Seller",
            unreadCount: 1,
            lastMessageAt: new Date(staticNow - 12 * 60000).toISOString(),
            lastMessagePreview: "I have sent the ID and proof of address.",
            participants: [
              { name: "Johan Botha", phone: "+27832803176", role: "seller" }
            ],
            documents: [
              { id: "DOC-1048-ID", name: "Certified identity document", owner: "Johan Botha - Seller", status: "Uploaded", hasFile: true, uploadedAt: new Date(staticNow - 10 * 60000).toISOString() }
            ],
            messages: [
              {
                id: "wa-static-1",
                direction: "inbound",
                createdAt: new Date(staticNow - 12 * 60000).toISOString(),
                senderName: "Johan Botha",
                senderPhone: "+27832803176",
                senderRole: "seller",
                text: "I have sent the ID and proof of address.",
                readAt: null,
                attachments: [
                  {
                    documentId: "DOC-1048-ID",
                    documentName: "Certified identity document",
                    originalName: "seller-id-proof.pdf",
                    ingestStatus: "uploaded",
                    hasDownload: true
                  }
                ]
              }
            ]
          }
        ],
        whatsapp: staticWhatsapp
      });
    }
    if (/\/api\/whatsapp\/inbox\/[^/]+\/read$/.test(path) || /\/api\/whatsapp\/inbox\/[^/]+\/reply$/.test(path)) {
      return staticJson({ ok: true, inbox: [] });
    }
    if (/\/api\/whatsapp\/inbox\/documents\/[^/]+\/download$/.test(path) || /\/api\/whatsapp\/inbox\/media\/[^/]+\/download$/.test(path)) {
      return Promise.resolve(
        new Response("Static WhatsApp document placeholder", {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "Content-Disposition": 'attachment; filename="axiom-static-whatsapp-document.txt"'
          }
        })
      );
    }
    if (path === "/api/followup-risk") {
      const leads = staticLeads.flatMap((lead) =>
        (lead.escalationFlags || []).map((flag) => ({
          id: lead.id,
          label: getLeadDisplayName(lead),
          intent: lead.intent,
          state: "at-risk",
          elapsedMinutes: Math.max(1, Math.round((staticNow - new Date(lead.createdAt).getTime()) / 60000)),
          score: lead.scoring?.score,
          scoreBand: lead.scoring?.score >= 85 ? "Hot" : "Warm",
          snapshot: flag.reason || lead.copilot?.snapshot,
          agentContact: lead.agentContact
        }))
      );
      return staticJson({ leads });
    }
    if (path === "/api/leads/recent") {
      const leads = getStaticLeadList(resource);
      return staticJson({ leads, totalMatches: leads.length });
    }
    if (path === "/api/leads") {
      return staticJson({
        delivered: false,
        manualHandoffUrl: "https://wa.me/?text=Axiom%20static%20mode%20lead%20introduction",
        lead: staticLeads[0]
      });
    }
    if (path === "/api/concierge") {
      return staticJson({
        sessionId: "static-session",
        reply: "Static mode is open. For live AI replies and WhatsApp sending, run the server version later.",
        closed: false
      });
    }
    if (path === "/api/agent-applications") return staticJson({ ok: true });
    if (/\/api\/leads\/[^/]+\/handoff$/.test(path)) {
      return staticJson({ whatsappUrl: "https://wa.me/?text=Axiom%20lead%20introduction%20(static%20mode)" });
    }
    if (/\/api\/leads\/[^/]+\/documents\/[^/]+\/download$/.test(path)) {
      return Promise.resolve(
        new Response("Static document placeholder", {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "Content-Disposition": 'attachment; filename="axiom-static-document.txt"'
          }
        })
      );
    }
    return staticJson({
      ok: true,
      agentUrl: "agent-update.html?token=static",
      agentShareText: "Axiom static agent introduction: agent-update.html?token=static",
      stakeholderUrl: "stakeholder-update.html?token=static",
      stakeholderShareText: "Axiom static stakeholder portal: stakeholder-update.html?token=static",
      sharePackText: "Static stakeholder share pack created."
    });
  };
}

installStaticApi();

function adminHeaders() {
  return adminToken ? { "x-admin-password": adminToken } : {};
}

function isAdminUnlocked() {
  return Boolean(adminToken && operationsPanel && !operationsPanel.classList.contains("hidden"));
}

function setAdminMessage(text, isError = false) {
  if (!adminMessage) return;
  adminMessage.textContent = text;
  adminMessage.classList.remove("hidden");
  adminMessage.classList.toggle("error-note", isError);
}

function unlockOperations() {
  if (!operationsPanel || !adminGate) return;
  if (analyticsSection) analyticsSection.classList.remove("hidden");
  operationsPanel.classList.remove("hidden");
  adminGate.classList.add("compact-admin");
}

function setOperationsTab(name = "inbox") {
  operationsTabs.forEach((button) => {
    const isActive = button.getAttribute("data-operations-tab") === name;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  operationsTabPanels.forEach((panel) => {
    const isActive = panel.getAttribute("data-operations-panel") === name;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
  if (name === "whatsapp" && isAdminUnlocked()) {
    refreshOperationsSuite({ whatsapp: true });
  }
}

operationsTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setOperationsTab(button.getAttribute("data-operations-tab") || "inbox");
  });
});

document.querySelectorAll("[data-open-operations-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    setOperationsTab(button.getAttribute("data-open-operations-tab") || "inbox");
  });
});

function showAdminGate() {
  if (analyticsSection) analyticsSection.classList.remove("hidden");
}

function formatNumberWithCommas(value) {
  const digitsOnly = (value || "").replace(/\D/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function createField(field) {
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  let input;

  label.setAttribute("for", field.name);
  label.textContent = field.label;

  if (field.townLookupByProvince) {
    input = document.createElement("select");
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "Select a province first";
    placeholderOption.disabled = true;
    placeholderOption.defaultSelected = true;
    placeholderOption.selected = true;
    input.appendChild(placeholderOption);
    input.disabled = true;
    input.dataset.townLookup = "true";
    input.dataset.provinceField = field.provinceField || "province";
  } else if (field.type === "select") {
    input = document.createElement("select");
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "Select an option";
    placeholderOption.disabled = true;
    placeholderOption.defaultSelected = true;
    placeholderOption.selected = true;
    input.appendChild(placeholderOption);

    (field.options || []).forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      input.appendChild(option);
    });
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 3;
    if (field.placeholder) {
      input.placeholder = field.placeholder;
    }
  } else {
    input = document.createElement("input");
    input.type = field.type || "text";
    if (field.name === "budget" || field.name === "expectedPrice") {
      input.setAttribute("inputmode", "numeric");
      input.dataset.moneyFormat = "true";
    }
    if (field.placeholder) {
      input.placeholder = field.placeholder;
    }
  }

  input.id = field.name;
  input.name = field.name;
  input.required = Boolean(field.required);

  wrap.appendChild(label);
  if (field.allowCurrentLocation) {
    const row = document.createElement("div");
    row.className = "location-row";
    row.appendChild(input);

    const locationBtn = document.createElement("button");
    locationBtn.type = "button";
    locationBtn.className = "location-btn";
    locationBtn.textContent = "Use current location";
    locationBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Location is not supported on this device/browser.");
        return;
      }

      locationBtn.disabled = true;
      locationBtn.textContent = "Fetching location...";

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          input.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (device location)`;
          locationBtn.disabled = false;
          locationBtn.textContent = "Use current location";
        },
        () => {
          alert("Unable to fetch location. Please enter location manually.");
          locationBtn.disabled = false;
          locationBtn.textContent = "Use current location";
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });

    row.appendChild(locationBtn);
    wrap.appendChild(row);
  } else {
    wrap.appendChild(input);
  }

  return wrap;
}

function updateTownDatalistForProvince(container) {
  const townSelects = container.querySelectorAll("select[data-town-lookup='true']");
  townSelects.forEach((townSelect) => {
    const provinceFieldName = townSelect.dataset.provinceField || "province";
    const provinceSelect = container.querySelector(`[name='${provinceFieldName}']`);
    if (!provinceSelect) return;

    const renderTownOptions = (towns, selectedTown = "") => {
      townSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = towns.length ? "Select preferred area" : "Select a province first";
      placeholder.disabled = true;
      placeholder.selected = !selectedTown;
      townSelect.appendChild(placeholder);
      towns.forEach((town) => {
        const option = document.createElement("option");
        option.value = town;
        option.textContent = town;
        if (town === selectedTown) option.selected = true;
        townSelect.appendChild(option);
      });
      townSelect.disabled = !towns.length;
    };

    const syncList = () => {
      const provinceValue = provinceSelect.value;
      const towns = (townsByProvince[provinceValue] || []).slice().sort((a, b) => a.localeCompare(b));
      const currentTown = towns.includes(townSelect.value) ? townSelect.value : "";
      renderTownOptions(towns, currentTown);
    };

    provinceSelect.addEventListener("change", syncList);
    syncList();
  });
}

function bindMoneyFormatting(container) {
  const moneyInputs = container.querySelectorAll("input[data-money-format='true']");
  moneyInputs.forEach((input) => {
    input.addEventListener("input", () => {
      input.value = formatNumberWithCommas(input.value);
    });
    input.addEventListener("blur", () => {
      input.value = formatNumberWithCommas(input.value);
    });
  });
}

function openIntake(intent) {
  activeIntent = paths[intent] ? intent : "buy";
  const config = paths[activeIntent];

  intakeEyebrow.textContent = activeIntent === "sell" ? "Seller path" : "Buyer path";
  intakeTitle.textContent = config.intro;
  progressNote.textContent = activeIntent === "sell"
    ? "Share the basics. The concierge can fill in valuation, mandate, and occupancy details later."
    : "Share the basics. The concierge can fill in finance and property preference details later.";
  if (additionalInfoLabel) {
    additionalInfoLabel.innerHTML = activeIntent === "sell"
      ? 'Anything the property expert should know before calling? <span class="optional-label">Optional</span>'
      : 'Please tell us what your property should ideally have <span class="optional-label">Optional</span>';
  }
  if (additionalInfoInput) {
    additionalInfoInput.placeholder = activeIntent === "sell"
      ? "Example: valuation done, current mandate, tenant/owner occupied, urgency, access notes, or special instructions"
      : "Example: bedrooms, bathrooms, garden, parking, security, pet-friendly, finance status, or special instructions";
  }
  submitLeadBtn.textContent = config.submitText;
  dynamicFields.innerHTML = "";

  const personalHeading = document.createElement("div");
  personalHeading.className = "form-section-heading";
  personalHeading.textContent = "Your details";
  dynamicFields.appendChild(personalHeading);

  config.questions.forEach((field) => {
    if (field.name === "province") {
      const propertyHeading = document.createElement("div");
      propertyHeading.className = "form-section-heading";
      propertyHeading.textContent = "Property details";
      dynamicFields.appendChild(propertyHeading);
    }
    dynamicFields.appendChild(createField(field));
  });
  updateTownDatalistForProvince(dynamicFields);
  bindMoneyFormatting(dynamicFields);

  intakeForm.reset();
  conciergePanel?.classList.add("hidden");
  conciergeToggle?.classList.add("hidden");
  intakeOverlay.classList.remove("hidden");
  intakeOverlay.setAttribute("aria-hidden", "false");
}

function closeIntake() {
  intakeOverlay.classList.add("hidden");
  intakeOverlay.setAttribute("aria-hidden", "true");
  conciergeToggle?.classList.remove("hidden");
  if (submitLeadBtn) submitLeadBtn.disabled = false;
}

function openWhatsAppUrl(url) {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    // Popup blockers can block async opens; same-tab fallback guarantees delivery path.
    window.location.href = url;
  }
}

function getLeadPayload(formData) {
  const config = paths[activeIntent];
  const answers = config.questions.map((q) => ({
    label: q.label.replace(/^\d+\.\s*/, ""),
    value: (formData.get(q.name) || "").toString().trim()
  }));

  return {
    intent: activeIntent,
    label: config.label,
    answers,
    additionalInfo: (formData.get("additionalInfo") || "").toString().trim(),
    consent: formData.get("consent") === "on",
    acquisition: getAcquisitionContext()
  };
}

function getAcquisitionContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || params.get("source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
    referrer: document.referrer || "",
    landingPage: `${window.location.pathname}${window.location.search}`,
    dataMode: params.get("data_mode") || (params.get("test") === "1" ? "test" : "")
  };
}

function appendConciergeMessage(kind, text) {
  if (!conciergeMessages) return;
  const p = document.createElement("p");
  p.className = kind === "user" ? "user-msg" : "bot-msg";
  p.textContent = text;
  conciergeMessages.appendChild(p);
  conciergeMessages.scrollTop = conciergeMessages.scrollHeight;
}

async function refreshAnalytics() {
  if (!mTotalLeads || !adminToken) return;
  try {
    const response = await fetch("/api/analytics", { headers: adminHeaders() });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    const a = data?.analytics;
    if (!a) return;
    mTotalLeads.textContent = `${a.totalLeads}`;
    mAvgScore.textContent = `${a.avgScore}/100`;
    mCompletion.textContent = `${a.completionRate}%`;
    mHotLeads.textContent = `${a.scoreBands?.Hot ?? 0}`;
    mAtRisk.textContent = `${a.atRiskLeads ?? 0}`;
    mOverdue.textContent = `${a.overdueLeads ?? 0}`;
    if (mDeliveryFailed) mDeliveryFailed.textContent = `${a.failedDeliveries ?? 0}`;
    if (mProtectedDeals) mProtectedDeals.textContent = `${a.protectedDeals ?? 0}`;
    if (mCommissionRisk) mCommissionRisk.textContent = `${a.commissionAtRisk ?? 0}`;
    if (mAgentAcks) mAgentAcks.textContent = `${a.agentAcknowledgements ?? 0}`;
    if (mUnackedLinks) mUnackedLinks.textContent = `${a.unacknowledgedAgentLinks ?? 0}`;
    mFollowUps.textContent = `${a.activeFollowUps}`;
    mMessages.textContent = `${a.conciergeInteractions}`;
    renderConversionSprint(a.conversionSprint);
    renderInboxBoundary(a.dataClasses);
  } catch {
    setAdminMessage("Admin session could not load. Please unlock again.", true);
  }
}

function renderConversionSprint(sprint) {
  if (!sprintStatus || !sprint) return;
  const referralGap = Math.max(0, Number(sprint.targets?.referrals || 0) - Number(sprint.referred || 0));
  const closureGap = Math.max(0, Number(sprint.targets?.closures || 0) - Number(sprint.closedWon || 0));
  sprintStatus.textContent = referralGap || closureGap ? `${sprint.days}-day sprint active` : "Sprint target achieved";
  sprintStatus.classList.toggle("at-risk", Boolean(referralGap || closureGap));
  sprintReferrals.textContent = `${sprint.referred}/${sprint.targets?.referrals ?? 6}`;
  sprintClosures.textContent = `${sprint.closedWon}/${sprint.targets?.closures ?? 2}`;
  sprintLeads.textContent = `${sprint.newLeads ?? 0}`;
  sprintContacted.textContent = `${sprint.contacted ?? 0}`;
  sprintFocus.textContent = sprint.recommendedFocus || "Keep the next action explicit on every active lead.";
  if (inboxFocus) inboxFocus.textContent = sprint.recommendedFocus || "Keep the next action explicit on every active lead.";
  if (inboxMission) {
    const referralGap = Math.max(0, Number(sprint.targets?.referrals || 0) - Number(sprint.referred || 0));
    const closureGap = Math.max(0, Number(sprint.targets?.closures || 0) - Number(sprint.closedWon || 0));
    inboxMission.textContent = referralGap || closureGap
      ? `${referralGap} referral${referralGap === 1 ? "" : "s"} · ${closureGap} closure${closureGap === 1 ? "" : "s"} to target`
      : "Sprint target achieved";
  }
  const sources = Array.isArray(sprint.sources) ? sprint.sources : [];
  sprintSources.innerHTML = sources.length
    ? sources.map((item) => `<span class="sprint-source">${esc(item.source)} <b>${esc(item.leads)}</b></span>`).join("")
    : `<span class="small-note">Campaign source data will appear here as leads arrive.</span>`;
}

function renderInboxBoundary(dataClasses) {
  if (!inboxBoundary || !dataClasses) return;
  inboxBoundary.textContent = `Live inbox protected · ${dataClasses.test ?? 0} test records quarantined · ${dataClasses.draft ?? 0} draft chats parked`;
}

function renderInboxCommandDeck(leads = []) {
  if (!inboxCommandDeck) return;
  if (!Array.isArray(leads) || !leads.length) {
    inboxCommandDeck.innerHTML = "";
    if (inboxCommandSummary) inboxCommandSummary.textContent = "No live cases match the current filters.";
    return;
  }

  const hotLead = leads[0];
  const firstContactPending = leads.filter((lead) => !lead?.agentContact?.contactedAt).length;
  const handoffPending = leads.filter((lead) => !lead?.assignedAgent?.name || !lead?.agentHandoff || !["accepted", "complete", "contacted"].includes(lead.agentHandoff.status)).length;
  const commissionExposed = leads.filter((lead) => {
    const commission = lead.commissionProtection || {};
    return Boolean(lead.referred || lead.dealProtection) && !commission.protected;
  }).length;
  const vaultBlocked = leads.filter((lead) => Number(lead.documentVaultSummary?.missingCount || 0) > 0).length;
  const managedCases = leads.filter((lead) => lead.outcome?.caseMode === "managed_transaction").length;
  const topAction = hotLead?.nextBestAction?.title || hotLead?.followUpIntelligence?.primary || "Review the top live case";
  const topLeadName = getLeadDisplayName(hotLead);
  const topLeadArea = [hotLead?.slots?.area, hotLead?.slots?.province].filter(Boolean).join(", ") || "Area not captured";

  if (inboxCommandSummary) {
    inboxCommandSummary.textContent = `${topLeadName} is the clearest live move right now. ${topAction} in ${topLeadArea}.`;
  }

  const cards = [
    ["First contact", `${firstContactPending} pending`, "Cases still waiting for confirmed human contact", firstContactPending ? "warn" : "good"],
    ["Introductions", `${handoffPending} open`, "Cases not yet fully accepted or routed", handoffPending ? "warn" : "good"],
    ["Commission shield", `${commissionExposed} exposed`, "Referral cases still missing full protection", commissionExposed ? "warn" : "good"],
    ["Vault blockers", `${vaultBlocked} blocked`, "Cases waiting on required documents", vaultBlocked ? "warn" : "good"],
    ["Managed cases", `${managedCases} active`, "Transactions staying under full Axiom oversight", managedCases ? "active" : ""]
  ];

  inboxCommandDeck.innerHTML = cards
    .map(
      ([label, value, note, tone]) => `
        <article class="inbox-command-card ${tone || ""}">
          <span>${esc(String(label))}</span>
          <strong>${esc(String(value))}</strong>
          <small>${esc(String(note))}</small>
        </article>`
    )
    .join("");
}

function renderWhatsAppBridgeStatus(whatsapp) {
  if (!whatsappBridgeStatus || !whatsappBridgeBadge) return;
  const web = whatsapp?.webTest || {};
  const cloud = whatsapp?.cloudConfigured ? "Cloud API configured" : "Cloud API not configured";
  const mode = web.enabled ? `Web test mode: ${web.status}` : "Web test mode disabled";
  const ready = web.ready ? "Ready to send test alerts" : "Not ready";
  whatsappBridgeBadge.textContent = web.ready ? "Ready" : web.enabled ? web.status || "Enabled" : "Disabled";
  whatsappBridgeBadge.classList.toggle("at-risk", web.enabled && !web.ready);
  whatsappBridgeBadge.classList.toggle("overdue", Boolean(web.lastError));
  whatsappBridgeStatus.textContent = `${mode}. ${ready}. ${cloud}.${web.lastError ? ` Last error: ${web.lastError}` : ""}`;

  if (whatsappQrWrap && whatsappQrImage) {
    if (web.qrDataUrl) {
      whatsappQrImage.src = web.qrDataUrl;
      whatsappQrWrap.classList.remove("hidden");
    } else {
      whatsappQrImage.removeAttribute("src");
      whatsappQrWrap.classList.add("hidden");
    }
  }
}

function formatTaskDueText(task) {
  if (!task?.dueAt) return "No due time";
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return "No due time";
  const minutes = Math.floor((due.getTime() - Date.now()) / 60000);
  if (minutes < -1440) return `Overdue by ${Math.abs(Math.floor(minutes / 1440))} days`;
  if (minutes < -60) return `Overdue by ${Math.abs(Math.floor(minutes / 60))} hours`;
  if (minutes < 0) return `Overdue by ${Math.abs(minutes)} minutes`;
  if (minutes === 0) return "Due now";
  if (minutes < 60) return `Due in ${minutes} minutes`;
  if (minutes < 1440) return `Due in ${Math.floor(minutes / 60)} hours`;
  return `Due ${due.toLocaleDateString()}`;
}

function humanizeLabel(value) {
  return (value || "")
    .toString()
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatTaskItem(task) {
  const statusLabel = task.status === "overdue" ? "Overdue" : task.status === "due-soon" ? "Due soon" : "Upcoming";
  const intent = (task.intent || "unknown").toUpperCase();
  const ownershipLine = [task.owner ? `Owner: ${task.owner}` : "", task.lane ? `Lane: ${humanizeLabel(task.lane)}` : ""].filter(Boolean).join(" | ");
  const signalPills = [
    task.priority || "Low",
    statusLabel,
    task.actionType ? humanizeLabel(task.actionType) : "",
    task.lane ? humanizeLabel(task.lane) : ""
  ].filter(Boolean);
  return `
    <article class="task-item ${esc(task.status)} ${esc((task.priority || "Low").toLowerCase())}">
      <div class="task-main">
        <div class="task-title-row">
          <strong>${esc(task.title)}</strong>
          <span class="task-pill">${esc(task.priority || "Low")}</span>
          <span class="task-pill muted">${esc(statusLabel)}</span>
        </div>
        <div class="small-note">${esc(task.leadName)} | ${esc(intent)} | ${esc(task.area)}</div>
        ${ownershipLine ? `<div class="small-note">${esc(ownershipLine)}</div>` : ""}
        <span class="task-meta-pills">
          ${signalPills.map((pill, index) => `<span class="task-inline-pill ${index === 0 ? (task.priority || "Low").toLowerCase() : ""}">${esc(pill)}</span>`).join("")}
        </span>
        <div class="small-note">${esc(task.reason || "")}</div>
        ${task.detail ? `<div class="small-note">${esc(task.detail)}</div>` : ""}
      </div>
      <div class="task-side">
        <span>${esc(formatTaskDueText(task))}</span>
        <small>${esc(task.cadence || "Follow-up")}</small>
        <button class="location-btn ghost-action" type="button" data-open-task-lead="${esc(task.leadId)}">Open Lead</button>
      </div>
    </article>
  `;
}

function renderFollowupControlGrid(leads = []) {
  if (!followupControlGrid) return;
  if (!Array.isArray(leads) || !leads.length) {
    followupControlGrid.innerHTML = "";
    return;
  }
  const noContact = leads.filter((lead) => Array.isArray(lead.escalationFlags) && lead.escalationFlags.some((flag) => flag.category === "No contact")).length;
  const noUpdate = leads.filter((lead) => Array.isArray(lead.escalationFlags) && lead.escalationFlags.some((flag) => flag.category === "No update")).length;
  const wowSent = leads.filter((lead) => lead.wowAutomation?.lastSentAt).length;
  const locked = leads.filter((lead) => lead.commissionLock?.locked).length;
  const docsBlocked = leads.filter((lead) => Number(lead.documentVaultSummary?.missingCount || 0) > 0).length;
  const avgReadiness = leads.length
    ? Math.round(
        leads.reduce((sum, lead) => sum + Number(lead.documentVaultSummary?.readinessPercent || 0), 0) / leads.length
      )
    : 0;
  const cards = [
    ["No-contact", noContact, "Leads needing first human confirmation", noContact ? "warn" : "good"],
    ["No-update", noUpdate, "Active matters with stale movement", noUpdate ? "warn" : "good"],
    ["Wow touches", wowSent, "Leads already receiving proactive reassurance", wowSent ? "active" : ""],
    ["Commission locked", locked, "Introductions with protection steps in place", locked ? "good" : "warn"],
    ["Vault blocked", docsBlocked, `Average vault readiness ${avgReadiness}%`, docsBlocked ? "warn" : "good"]
  ];
  followupControlGrid.innerHTML = cards
    .map(
      ([label, value, note, tone]) => `
        <article class="followup-control-card ${tone || ""}">
          <span>${esc(String(label))}</span>
          <strong>${esc(String(value))}</strong>
          <small>${esc(String(note))}</small>
        </article>`
    )
    .join("");
}

function renderTaskCommandDeck(tasks = [], summary = {}) {
  if (!taskCommandDeck) return;
  if (!Array.isArray(tasks) || !tasks.length) {
    taskCommandDeck.innerHTML = "";
    if (taskCommandSummary) taskCommandSummary.textContent = "No active queue items right now.";
    return;
  }

  const topTask = tasks[0];
  const overdue = summary.byStatus?.overdue || 0;
  const dueSoon = summary.byStatus?.["due-soon"] || 0;
  const escalations = tasks.filter((task) => (task.title || "").toLowerCase().startsWith("escalation:")).length;
  const deadlineTasks = tasks.filter((task) => task.actionType === "deadline-chase").length;
  const commissionTasks = tasks.filter((task) => (task.lane || "").includes("referral") || (task.title || "").toLowerCase().includes("commission")).length;
  const managedTasks = tasks.filter((task) => task.lane === "managed-transaction").length;
  const topOwner = topTask?.owner || "Concierge";
  const topLead = topTask?.leadName || "Top live case";
  const topAction = topTask?.title || "Review next move";

  if (taskCommandSummary) {
    taskCommandSummary.textContent = `${topOwner} should act on ${topLead} first. ${topAction}.`;
  }

  const cards = [
    ["Overdue", `${overdue} live`, "Queue items already beyond the target window", overdue ? "warn" : "good"],
    ["Due soon", `${dueSoon} approaching`, "Queue items that need attention before they slip", dueSoon ? "active" : "good"],
    ["Deadline chase", `${deadlineTasks} active`, "Soft chase windows opened before dated steps become late", deadlineTasks ? "active" : "good"],
    ["Escalations", `${escalations} active`, "Tasks created by missed contact, stale updates, or drift", escalations ? "warn" : "good"],
    ["Commission work", `${commissionTasks} active`, "Tasks protecting referral value and payout proof", commissionTasks ? "active" : ""],
    ["Managed flow", `${managedTasks} active`, "Queue items inside full transaction oversight", managedTasks ? "active" : ""]
  ];

  taskCommandDeck.innerHTML = cards
    .map(
      ([label, value, note, tone]) => `
        <article class="task-command-card ${tone || ""}">
          <span>${esc(String(label))}</span>
          <strong>${esc(String(value))}</strong>
          <small>${esc(String(note))}</small>
        </article>`
    )
    .join("");
}

async function refreshFollowUpTasks() {
  if (!taskQueueList || !adminToken) return;
  try {
    const response = await fetch("/api/followup-tasks?limit=12", { headers: adminHeaders() });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    const tasks = data?.tasks || [];
    const summary = data?.summary || {};
    if (taskQueueCount) {
      const overdue = summary.byStatus?.overdue || 0;
      const dueSoon = summary.byStatus?.["due-soon"] || 0;
      const deadlineTasks = tasks.filter((task) => task.actionType === "deadline-chase").length;
      const escalations = tasks.filter((task) => (task.title || "").toLowerCase().startsWith("escalation:")).length;
      taskQueueCount.textContent = `${tasks.length} shown | ${summary.total ?? tasks.length} active | ${deadlineTasks} deadline chase | ${escalations} escalations | ${overdue} overdue | ${dueSoon} due soon`;
      taskQueueCount.classList.toggle("overdue", overdue > 0);
      taskQueueCount.classList.toggle("at-risk", !overdue && dueSoon > 0);
    }
    if (!tasks.length) {
      renderTaskCommandDeck([], summary);
      taskQueueList.innerHTML = `<p class="small-note">No automatic follow-up tasks right now.</p>`;
      return;
    }
    renderTaskCommandDeck(tasks, summary);
    taskQueueList.innerHTML = tasks.map(formatTaskItem).join("");
    taskQueueList.querySelectorAll("[data-open-task-lead]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-open-task-lead");
        if (!id) return;
        setOperationsTab("inbox");
        if (leadSearch) leadSearch.value = id;
        activeLeadStage = "all";
        renderLeadStageTabs();
        expandedLeadIds.clear();
        expandedLeadIds.add(id);
        await refreshAgentAssist();
        document.querySelector(`[data-lead-detail="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  } catch {
    setAdminMessage("Automatic follow-up tasks could not load. Please unlock again.", true);
  }
}

async function refreshDailyControlPanel() {
  if (!adminToken || !dailyControlDate) return;
  try {
    const response = await fetch("/api/concierge-daily-report", { headers: adminHeaders() });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    const summary = data?.summary || {};
    const windows = data?.windows || {};
    dailyControlDate.textContent = `For ${windows.localDateLabel || new Date().toLocaleDateString()}`;
    if (dailyControlSla) {
      const met = Number(summary.slaMetToday || 0);
      const total = Number(summary.newLeadsToday || 0);
      const pct = total > 0 ? Math.round((met / total) * 100) : 0;
      dailyControlSla.textContent = `${met}/${total} (${pct}%)`;
    }
    if (dailyControlEscalations) dailyControlEscalations.textContent = `${summary.escalationLeadsOpen || 0}`;
    if (dailyControlCommissionRisk) dailyControlCommissionRisk.textContent = `${summary.commissionRiskOpen || 0}`;
    if (dailyControlReferred) dailyControlReferred.textContent = `${summary.referredToday || 0}`;
    if (dailyControlContacted) dailyControlContacted.textContent = `${summary.contactedToday || 0}`;
    if (dailyControlClosures) dailyControlClosures.textContent = `${summary.closedWonToday || 0}`;
  } catch {
    setAdminMessage("Daily control panel could not load. Please unlock again.", true);
  }
}

async function refreshWhatsAppBridgeStatus() {
  if (!adminToken || !whatsappBridgeStatus) return;
  try {
    const response = await fetch("/api/whatsapp/status", { headers: adminHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    renderWhatsAppBridgeStatus(data.whatsapp);
  } catch {
    whatsappBridgeStatus.textContent = "Could not load WhatsApp bridge status.";
  }
}

function formatWhatsAppTimestamp(value) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString();
}

function formatWhatsappAppointmentStatus(status = "") {
  return (
    {
      proposed: "Proposed",
      "pending-confirmation": "Awaiting confirmation",
      confirmed: "Confirmed",
      "reschedule-requested": "Reschedule requested",
      completed: "Completed",
      missed: "Missed",
      cancelled: "Cancelled"
    }[String(status || "").toLowerCase()] || humanizeLabel(status || "appointment")
  );
}

function formatWhatsappAppointmentTime(value) {
  if (!value) return "Time pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time pending";
  return date.toLocaleString();
}

function renderWhatsappAppointmentPanel(selectedCase) {
  const appointments = Array.isArray(selectedCase?.appointments) ? selectedCase.appointments : [];
  const participants = Array.isArray(selectedCase?.participants) ? selectedCase.participants : [];
  const participantOptions = participants.length
    ? participants
        .map((participant, index) => {
          const label = [participant.name || participant.phone, participant.role ? humanizeLabel(participant.role) : "", participant.phone || ""].filter(Boolean).join(" · ");
          return `<option value="${esc(participant.phone || "")}" data-name="${esc(participant.name || "")}" data-role="${esc(participant.role || "")}" ${index === 0 ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("")
    : `<option value="">No participant available</option>`;
  const cards = appointments.length
    ? appointments
        .map((appointment) => {
          const status = String(appointment.status || "proposed").toLowerCase();
          const actions =
            status === "completed"
              ? ""
              : status === "cancelled" || status === "missed"
              ? `<button class="location-btn ghost-action" type="button" data-whatsapp-appointment-action="reopen" data-whatsapp-appointment-id="${esc(appointment.id)}">Reopen</button>`
              : [
                  !["confirmed"].includes(status)
                    ? `<button class="location-btn ghost-action" type="button" data-whatsapp-appointment-action="confirm" data-whatsapp-appointment-id="${esc(appointment.id)}">Confirm</button>`
                    : "",
                  status === "confirmed"
                    ? `<button class="location-btn ghost-action" type="button" data-whatsapp-appointment-action="complete" data-whatsapp-appointment-id="${esc(appointment.id)}">Complete</button>`
                    : "",
                  status === "confirmed"
                    ? `<button class="location-btn ghost-action" type="button" data-whatsapp-appointment-action="missed" data-whatsapp-appointment-id="${esc(appointment.id)}">Missed</button>`
                    : "",
                  `<button class="location-btn ghost-action" type="button" data-whatsapp-appointment-action="cancel" data-whatsapp-appointment-id="${esc(appointment.id)}">Cancel</button>`
                ]
                  .filter(Boolean)
                  .join("");
          return `
            <article class="whatsapp-appointment-card ${esc(status)}">
              <div class="whatsapp-appointment-topline">
                <strong>${esc(appointment.title || appointment.kindLabel || "Appointment")}</strong>
                <span class="whatsapp-appointment-status ${esc(status)}">${esc(formatWhatsappAppointmentStatus(status))}</span>
              </div>
              <small>${esc(formatWhatsappAppointmentTime(appointment.scheduledFor))}${appointment.location ? ` · ${esc(appointment.location)}` : ""}</small>
              <small>${esc(appointment.participantName || "Participant")}${appointment.participantRole ? ` · ${esc(humanizeLabel(appointment.participantRole))}` : ""}</small>
              ${appointment.notes ? `<small>${esc(appointment.notes)}</small>` : ""}
              ${actions ? `<div class="whatsapp-appointment-actions">${actions}</div>` : ""}
            </article>
          `;
        })
        .join("")
    : `<div class="small-note">No appointment loop has been booked on this case yet.</div>`;

  return `
    <section class="whatsapp-appointments-panel">
      <div class="whatsapp-thread-topline">
        <div>
          <h4>Appointments</h4>
          <div class="whatsapp-thread-meta-line">Book viewings, valuations, signings, callbacks and follow their WhatsApp confirmation loop here.</div>
        </div>
      </div>
      <div class="whatsapp-appointment-list">${cards}</div>
      <form class="whatsapp-appointment-form" data-whatsapp-appointment-form="${esc(selectedCase?.caseId || "")}">
        <select name="participant" ${participants.length ? "" : "disabled"}>
          ${participantOptions}
        </select>
        <select name="kind">
          <option value="viewing">Viewing</option>
          <option value="valuation">Valuation</option>
          <option value="signing">Signing</option>
          <option value="callback">Callback</option>
          <option value="inspection">Inspection</option>
        </select>
        <input name="scheduledFor" type="datetime-local" required />
        <input name="location" type="text" maxlength="200" placeholder="Location or meeting link" />
        <input name="notes" type="text" maxlength="500" placeholder="Optional note" />
        <button class="location-btn" type="submit" ${participants.length ? "" : "disabled"}>Book</button>
      </form>
    </section>
  `;
}

function getSelectedWhatsappCase() {
  return (whatsappInboxState.cases || []).find((item) => item.caseId === whatsappInboxState.selectedCaseId) || null;
}

function renderWhatsappCaseList() {
  if (!whatsappCaseList) return;
  const cases = Array.isArray(whatsappInboxState.cases) ? whatsappInboxState.cases : [];
  if (!cases.length) {
    whatsappCaseList.innerHTML = `<div class="whatsapp-empty-state"><p class="small-note">No WhatsApp case traffic has been captured yet.</p></div>`;
    return;
  }
  whatsappCaseList.innerHTML = cases
    .map((item) => {
      const active = item.caseId === whatsappInboxState.selectedCaseId;
      const unread = Number(item.unreadCount || 0);
      const humanTakeover = Boolean(item.humanTakeover?.active);
      return `
        <button class="whatsapp-case-item ${active ? "active" : ""}" type="button" data-whatsapp-case="${esc(item.caseId)}">
          <div class="whatsapp-case-topline">
            <strong>${esc(item.caseId)} · ${esc(item.client || "Case")}</strong>
            ${humanTakeover ? `<span class="whatsapp-unread-badge">Human</span>` : unread ? `<span class="whatsapp-unread-badge">${unread}</span>` : `<small>${esc(formatWhatsAppTimestamp(item.lastMessageAt))}</small>`}
          </div>
          <div class="small-note">${esc(item.stage || "No stage")} · ${esc(item.owner || "Owner pending")}</div>
          <div class="whatsapp-case-preview">${esc(item.lastMessagePreview || "No recent message")}</div>
        </button>
      `;
    })
    .join("");
  whatsappCaseList.querySelectorAll("[data-whatsapp-case]").forEach((button) => {
    button.addEventListener("click", async () => {
      const caseId = button.getAttribute("data-whatsapp-case");
      if (!caseId) return;
      whatsappInboxState.selectedCaseId = caseId;
      renderWhatsappInbox();
      const selected = getSelectedWhatsappCase();
      if (selected?.unreadCount) {
        try {
          await fetch(`/api/whatsapp/inbox/${encodeURIComponent(caseId)}/read`, {
            method: "POST",
            headers: adminHeaders()
          });
        } catch {}
        await refreshWhatsAppInbox({ preserveSelection: true });
      }
    });
  });
}

function renderWhatsappThreadRecipients(selectedCase) {
  if (!whatsappReplyRecipient) return;
  const participants = Array.isArray(selectedCase?.participants) ? selectedCase.participants : [];
  if (!selectedCase || !participants.length) {
    whatsappReplyRecipient.innerHTML = `<option value="">No recipient available</option>`;
    whatsappReplyRecipient.disabled = true;
    return;
  }
  whatsappReplyRecipient.disabled = false;
  whatsappReplyRecipient.innerHTML = participants
    .map((participant, index) => {
      const label = [participant.name || participant.phone, participant.role ? humanizeLabel(participant.role) : "", participant.phone || ""].filter(Boolean).join(" · ");
      return `<option value="${esc(participant.phone || "")}" data-name="${esc(participant.name || "")}" data-role="${esc(participant.role || "")}" ${index === 0 ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
}

function renderWhatsappThread() {
  const selectedCase = getSelectedWhatsappCase();
  if (whatsappThreadTitle) whatsappThreadTitle.textContent = selectedCase ? `${selectedCase.caseId} · ${selectedCase.client}` : "No WhatsApp case selected";
  if (whatsappThreadMeta) {
    whatsappThreadMeta.textContent = selectedCase
      ? `${selectedCase.stage || "No stage"} · ${selectedCase.owner || "Owner pending"} · ${selectedCase.documents?.length || 0} tracked document${selectedCase.documents?.length === 1 ? "" : "s"}`
      : "Inbound replies and document uploads will appear here.";
  }
  if (selectedCase?.humanTakeover?.active && whatsappThreadMeta) {
    const reasons = Array.isArray(selectedCase.humanTakeover.reasonLabels) ? selectedCase.humanTakeover.reasonLabels.join(", ") : "";
    whatsappThreadMeta.textContent += ` | Human takeover active${reasons ? ` (${reasons})` : ""}`;
    whatsappThreadMeta.insertAdjacentHTML("beforeend", ` <button class="location-btn ghost-action" type="button" data-whatsapp-human-resume="${esc(selectedCase.caseId)}">Resume Automation</button>`);
  }
  renderWhatsappThreadRecipients(selectedCase);
  if (!whatsappReplyInput) return;
  whatsappReplyInput.disabled = !selectedCase;
  if (!whatsappThreadMessages) return;
  if (!selectedCase) {
    whatsappThreadMessages.innerHTML = `<p class="small-note">Select a case on the left to view the WhatsApp thread.</p>`;
    return;
  }
  const messages = Array.isArray(selectedCase.messages) ? selectedCase.messages : [];
  const panelMarkup = renderWhatsappAppointmentPanel(selectedCase);
  const messageMarkup = messages.length
    ? messages
        .map((message) => {
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      return `
        <article class="whatsapp-message-card ${esc(message.direction || "inbound")} ${message.direction === "inbound" && !message.readAt ? "unread" : ""}">
          <div class="whatsapp-message-topline">
            <strong>${esc(message.direction === "outbound" ? message.senderName || "Concierge" : message.senderName || "Participant")}</strong>
            <small>${esc(formatWhatsAppTimestamp(message.createdAt))}</small>
          </div>
          <small>${esc(message.direction === "outbound" ? `To ${message.recipientName || message.recipientPhone || "participant"}` : `${humanizeLabel(message.senderRole || "participant")} · ${message.senderPhone || "Phone not captured"}`)}</small>
          ${message.text ? `<p>${esc(message.text)}</p>` : `<p class="small-note">Attachment received.</p>`}
          ${attachments.length ? `<div class="whatsapp-attachments">${attachments.map((attachment) => `
            <div class="whatsapp-attachment-row">
              <div class="register-cell-stack">
                <strong>${esc(attachment.documentName || attachment.originalName || "Attachment")}</strong>
                <small>${esc(attachment.originalName || attachment.mimeType || "WhatsApp upload")} · ${esc(attachment.ingestStatus || "captured")}</small>
                ${attachment.summary ? `<small>${esc(`Summary: ${attachment.summary}`)}</small>` : ""}
                ${attachment.transcript ? `<small>${esc(`Transcript: ${attachment.transcript}`)}</small>` : ""}
                ${attachment.sentiment?.severity ? `<small>${esc(`Sentiment risk: ${attachment.sentiment.severity} (${attachment.sentiment.score || 0})`)}</small>` : ""}
              </div>
              ${attachment.hasDownload && (attachment.documentId || attachment.downloadPath) ? `<button class="location-btn ghost-action" type="button" data-download-whatsapp-doc="${esc(attachment.documentId || "")}" data-download-whatsapp-path="${esc(attachment.downloadPath || "")}">Download</button>` : ""}
            </div>
          `).join("")}</div>` : ""}
          ${message.providerStatus ? `<small>${esc(message.providerStatus)}</small>` : ""}
        </article>
      `;
        })
        .join("")
    : `<p class="small-note">No WhatsApp messages captured for this case yet.</p>`;
  whatsappThreadMessages.innerHTML = `${panelMarkup}${messageMarkup}`;
  whatsappThreadMessages.querySelectorAll("[data-download-whatsapp-doc]").forEach((button) => {
    button.addEventListener("click", async () => {
      const docId = button.getAttribute("data-download-whatsapp-doc");
      const downloadPath = button.getAttribute("data-download-whatsapp-path") || "";
      const target = downloadPath || (docId ? `/api/whatsapp/inbox/documents/${encodeURIComponent(docId)}/download` : "");
      if (!target) return;
      try {
        const response = await fetch(target, {
          headers: adminHeaders()
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "Could not download WhatsApp document");
        }
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") || "";
        const fallbackName = `whatsapp-document-${docId}`;
        const match = /filename="([^"]+)"/i.exec(disposition);
        const filename = match?.[1] || fallbackName;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        setAdminMessage(error?.message || "Could not download WhatsApp document.", true);
      }
    });
  });
  whatsappThreadMessages.querySelectorAll("[data-whatsapp-appointment-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-whatsapp-appointment-action");
      const appointmentId = button.getAttribute("data-whatsapp-appointment-id");
      if (!action || !appointmentId) return;
      const oldText = button.textContent;
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        const response = await fetch(`/api/whatsapp/inbox/appointments/${encodeURIComponent(appointmentId)}/action`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not update the appointment");
        whatsappInboxState.cases = Array.isArray(data.inbox) ? data.inbox : whatsappInboxState.cases;
        renderWhatsappInbox();
        setAdminMessage(`Appointment updated: ${formatWhatsappAppointmentStatus(action)}.`);
      } catch (error) {
        button.disabled = false;
        button.textContent = oldText || "Save";
        setAdminMessage(error?.message || "Could not update the appointment.", true);
      }
    });
  });
  whatsappThreadMessages.querySelectorAll("[data-whatsapp-appointment-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const caseId = form.getAttribute("data-whatsapp-appointment-form");
      if (!caseId) return;
      const participantSelect = form.querySelector("select[name='participant']");
      const participantOption = participantSelect?.selectedOptions?.[0];
      const participantPhone = participantSelect?.value || "";
      const participantName = participantOption?.dataset?.name || "";
      const participantRole = participantOption?.dataset?.role || "";
      const kind = form.querySelector("select[name='kind']")?.value || "viewing";
      const scheduledFor = form.querySelector("input[name='scheduledFor']")?.value || "";
      const location = form.querySelector("input[name='location']")?.value || "";
      const notes = form.querySelector("input[name='notes']")?.value || "";
      const submitButton = form.querySelector("button[type='submit']");
      if (!participantPhone || !scheduledFor) {
        setAdminMessage("Choose a participant and date/time for the appointment.", true);
        return;
      }
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Booking...";
      }
      try {
        const response = await fetch(`/api/whatsapp/inbox/${encodeURIComponent(caseId)}/appointments`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            title: humanizeLabel(kind),
            participantName,
            participantPhone,
            participantRole,
            scheduledFor,
            location,
            notes
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not book the appointment");
        whatsappInboxState.cases = Array.isArray(data.inbox) ? data.inbox : whatsappInboxState.cases;
        renderWhatsappInbox();
        form.reset();
        setAdminMessage("Appointment booked and WhatsApp confirmation sent.");
      } catch (error) {
        setAdminMessage(error?.message || "Could not book the appointment.", true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Book";
        }
      }
    });
  });
  whatsappThreadMessages.scrollTop = whatsappThreadMessages.scrollHeight;
  if (whatsappThreadMeta) {
    whatsappThreadMeta.querySelectorAll("[data-whatsapp-human-resume]").forEach((button) => {
      button.addEventListener("click", async () => {
        const caseId = button.getAttribute("data-whatsapp-human-resume");
        if (!caseId) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Resuming...";
        try {
          const response = await fetch(`/api/whatsapp/inbox/${encodeURIComponent(caseId)}/human-takeover`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resume", note: "Resumed by concierge from WhatsApp inbox." })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || "Could not resume automation");
          whatsappInboxState.cases = Array.isArray(data.inbox) ? data.inbox : whatsappInboxState.cases;
          renderWhatsappInbox();
          setAdminMessage("Human takeover cleared. Automation can resume for this case.");
        } catch (error) {
          button.disabled = false;
          button.textContent = oldText || "Resume Automation";
          setAdminMessage(error?.message || "Could not resume automation for this case.", true);
        }
      });
    });
  }
}

function renderWhatsappInbox() {
  renderWhatsappCaseList();
  renderWhatsappThread();
}

async function refreshWhatsAppInbox({ preserveSelection = true } = {}) {
  if (!adminToken || !whatsappCaseList) return;
  try {
    const response = await fetch("/api/whatsapp/inbox", { headers: adminHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    whatsappInboxState.cases = Array.isArray(data.inbox) ? data.inbox : [];
    if (!preserveSelection || !whatsappInboxState.selectedCaseId || !whatsappInboxState.cases.some((item) => item.caseId === whatsappInboxState.selectedCaseId)) {
      whatsappInboxState.selectedCaseId = whatsappInboxState.cases[0]?.caseId || "";
    }
    renderWhatsappInbox();
  } catch {
    if (whatsappCaseList) {
      whatsappCaseList.innerHTML = `<div class="whatsapp-empty-state"><p class="small-note">WhatsApp inbox could not be loaded.</p></div>`;
    }
  }
}

async function refreshOperationsSuite({
  analytics = false,
  risk = false,
  followups = false,
  daily = false,
  assist = false,
  registers = false,
  whatsapp = false,
  skipExpandedAssist = false
} = {}) {
  if (analytics) await refreshAnalytics();
  if (risk) await refreshRiskQueue();
  if (followups) await refreshFollowUpTasks();
  if (daily) await refreshDailyControlPanel();
  if (assist && (!skipExpandedAssist || !hasExpandedLeadRows())) await refreshAgentAssist();
  if (registers) await refreshAdminRegisters();
  if (whatsapp) {
    await refreshWhatsAppBridgeStatus();
    await refreshWhatsAppInbox({ preserveSelection: true });
  }
}

async function refreshLeadWorkspace() {
  await refreshOperationsSuite({ analytics: true, risk: true, followups: true, assist: true });
}

function formatRiskItem(lead) {
  const stateClass = lead.state === "overdue" ? "overdue" : "at-risk";
  const stateLabel = lead.state === "overdue" ? "Overdue" : "At Risk";
  const score = lead.score !== null && lead.score !== undefined ? `${lead.score}/100` : "-";
  const workflow = lead.outcomeWorkflow || {};
  const lane = workflow.activeTrack ? humanizeLabel(workflow.activeTrack) : "Open routing";
  const owner = workflow.primaryOwner || workflow.owner || lead.caseFile?.owner || "Concierge";
  const nextAction = lead.nextBestAction?.title || lead.followUpIntelligence?.primary || "Review the intervention path";
  const urgencyLabel = lead.scoring?.urgency ? `${lead.scoring.urgency} urgency` : `${stateLabel} case`;
  return `
    <article class="risk-item">
      <div class="risk-topline">
        <strong>${lead.label} (${lead.intent?.toUpperCase() || "UNKNOWN"})</strong>
        <span class="risk-badge ${stateClass}">${stateLabel} - ${lead.elapsedMinutes} min</span>
      </div>
      <div class="small-note">Score: ${score} (${lead.scoreBand})</div>
      <div class="risk-meta-pills">
        <span class="risk-inline-pill ${stateClass}">${esc(urgencyLabel)}</span>
        <span class="risk-inline-pill">${esc(lane)}</span>
        <span class="risk-inline-pill">${esc(owner)}</span>
      </div>
      <div class="small-note">${lead.snapshot || "No snapshot available."}</div>
      <div class="small-note">Next intervention: ${esc(nextAction)}</div>
      ${formatContactForm(lead)}
    </article>
  `;
}

function renderRiskCommandDeck(leads = []) {
  if (!riskCommandDeck) return;
  if (!Array.isArray(leads) || !leads.length) {
    riskCommandDeck.innerHTML = "";
    if (riskCommandSummary) riskCommandSummary.textContent = "No live escalations right now.";
    return;
  }

  const overdue = leads.filter((lead) => lead.state === "overdue").length;
  const pendingContact = leads.filter((lead) => !lead?.agentContact?.contactedAt).length;
  const commissionExposed = leads.filter((lead) => !lead?.commissionProtection?.protected && (lead?.referred || lead?.assignedAgent?.name)).length;
  const documentBlocked = leads.filter((lead) => Number(lead?.documentVaultSummary?.missingCount || 0) > 0).length;
  const managed = leads.filter((lead) => lead?.outcome?.caseMode === "managed_transaction").length;
  const focusLead = leads[0];
  const focusName = getLeadDisplayName(focusLead);
  const focusAction = focusLead?.nextBestAction?.title || focusLead?.followUpIntelligence?.primary || "Review escalation";

  if (riskCommandSummary) {
    riskCommandSummary.textContent = `${focusName} is the first intervention priority right now. ${focusAction}.`;
  }

  const cards = [
    ["Overdue", `${overdue} live`, "Cases already outside the expected response window", overdue ? "warn" : "good"],
    ["Contact gap", `${pendingContact} open`, "Cases still waiting for confirmed human contact", pendingContact ? "warn" : "good"],
    ["Commission drift", `${commissionExposed} exposed`, "Referred cases still missing full protection", commissionExposed ? "warn" : "good"],
    ["Doc blockers", `${documentBlocked} blocked`, "Cases stalled by missing required evidence", documentBlocked ? "warn" : "good"],
    ["Managed risk", `${managed} active`, "Escalated cases under full transaction oversight", managed ? "active" : ""]
  ];

  riskCommandDeck.innerHTML = cards
    .map(
      ([label, value, note, tone]) => `
        <article class="risk-command-card ${tone || ""}">
          <span>${esc(String(label))}</span>
          <strong>${esc(String(value))}</strong>
          <small>${esc(String(note))}</small>
        </article>`
    )
    .join("");
}

function formatStageUpdateDeliveryMessage(delivery, fallback) {
  const attempted = Number(delivery?.attempted || 0);
  const delivered = Number(delivery?.delivered || 0);
  const failed = Math.max(0, attempted - delivered);
  if (!attempted) return fallback || "No WhatsApp stage recipients were available for this update.";
  return `${fallback || "Stage update saved."} WhatsApp delivery: ${delivered}/${attempted} sent${failed ? `, ${failed} failed` : ""}.`;
}

function esc(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const contactMethodOptions = ["WhatsApp", "Phone call", "Email", "SMS", "In person", "Other"];
const dealProtectionStatusOptions = ["Active", "Viewing/valuation booked", "Offer pending", "Under contract", "Closed won", "Cold", "Lost", "Disputed"];
const dealProtectionAgreementOptions = ["Not discussed", "Verbal", "Written", "Confirmed", "Disputed"];

function formatContactConfirmationForm(lead, contact) {
  return `
    <form class="contact-confirm-form" data-confirm-contact="${esc(lead.id)}">
      <label for="contact-medium-${esc(lead.id)}">Agent contacted client via</label>
      <div class="contact-confirm-grid">
        <select id="contact-medium-${esc(lead.id)}" name="medium" required>
          ${optionList(contactMethodOptions, contact?.medium || "WhatsApp")}
        </select>
        <input name="note" type="text" value="${esc(contact?.note || "")}" placeholder="Optional note" maxlength="240" />
        <button class="location-btn" type="submit">Confirm Contact</button>
      </div>
    </form>
  `;
}

function formatContactForm(lead) {
  const contact = lead.agentContact || null;
  const contactText = contact?.contactedAt
    ? `Contact made by ${contact.medium} at ${new Date(contact.contactedAt).toLocaleString()}${contact.note ? ` - ${contact.note}` : ""}`
    : "Client contact not confirmed yet";

  return `
    <div class="contact-control-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Client Contact Confirmation</strong>
          <div class="small-note">${esc(contactText)}</div>
        </div>
        <span class="match-confidence handoff-status ${esc(contact?.contactedAt ? "complete" : "not_started")}">${esc(contact?.contactedAt ? "Confirmed" : "Pending")}</span>
      </div>
      ${formatContactConfirmationForm(lead, contact)}
    </div>
  `;
}

function optionList(options, selected) {
  return options
    .map((option) => `<option value="${esc(option)}" ${selected === option ? "selected" : ""}>${esc(option)}</option>`)
    .join("");
}

function valueOptionList(options, selected) {
  return options
    .map((option) => `<option value="${esc(option.value)}" ${selected === option.value ? "selected" : ""}>${esc(option.label)}</option>`)
    .join("");
}

function getOutcomeModeSummary(outcome) {
  const caseMode = outcome.caseMode || "undecided";
  const commercialStatus = outcome.commercialStatus || "new";
  const responsibilityText = outcome.responsibilityEnds
    ? "Axiom responsibility ended after referral payment."
    : caseMode === "managed_transaction"
      ? "Axiom continues tracking this as a managed transaction case."
      : caseMode === "referral_only"
        ? "Axiom protects referral proof and commission outcome only."
        : "Choose whether this lead stays referral-only or becomes a managed transaction.";
  const updated = outcome.updatedAt ? `Updated ${new Date(outcome.updatedAt).toLocaleString()}` : "Not decided yet";
  return { caseMode, commercialStatus, responsibilityText, updated };
}

function formatOutcomeModeEditor(lead, { caseMode, commercialStatus, note }) {
  return `
    <form class="outcome-mode-form" data-outcome-mode="${esc(lead.id)}">
      <div class="deal-protection-grid">
        <label>
          Case mode
          <select name="caseMode" required>
            ${valueOptionList(leadCaseModeOptions, caseMode)}
          </select>
        </label>
        <label>
          Commercial status
          <select name="commercialStatus" required>
            ${valueOptionList(leadCommercialStatusOptions, commercialStatus)}
          </select>
        </label>
        <label>
          Outcome note
          <input name="note" type="text" value="${esc(note)}" maxlength="500" placeholder="Why this path was chosen" />
        </label>
      </div>
      <div class="agent-assign-row">
        <button class="location-btn" type="submit">Save Outcome Mode</button>
      </div>
    </form>
  `;
}

function formatOutcomeModePanel(lead) {
  const outcome = lead.outcome || {};
  const workflow = lead.outcomeWorkflow || null;
  const { caseMode, commercialStatus, responsibilityText, updated } = getOutcomeModeSummary(outcome);

  return `
    <div class="outcome-mode-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Outcome mode</strong>
          <div class="small-note">${esc(responsibilityText)}</div>
        </div>
        <span class="match-confidence outcome-mode ${esc(caseMode)}">${esc(outcome.caseModeLabel || "Undecided")}</span>
      </div>
      <div class="small-note">Commercial status: ${esc(outcome.commercialStatusLabel || "New")} | ${esc(updated)}</div>
      ${
        workflow
          ? `<div class="commission-summary-grid">
              <div>
                <span>Lane</span>
                <strong>${esc(humanizeLabel(workflow.activeTrack || "Undecided"))}</strong>
              </div>
              <div>
                <span>Primary owner</span>
                <strong>${esc(workflow.primaryOwner || "Concierge")}</strong>
              </div>
              <div>
                <span>Tracking scope</span>
                <strong>${esc(workflow.documentScope || "Standard")}</strong>
              </div>
              <div>
                <span>Next control</span>
                <strong>${esc(workflow.nextControl || "Review")}</strong>
              </div>
            </div>
            <div class="small-note">${esc(workflow.trackingScope || "")}</div>
            <div class="small-note">${esc(workflow.automationFocus || "")}</div>
            <div class="small-note">${esc(workflow.responsibilityBoundary || "")}</div>`
          : ""
      }
      ${outcome.note ? `<div class="small-note">Outcome note: ${esc(outcome.note)}</div>` : ""}
      ${formatOutcomeModeEditor(lead, { caseMode, commercialStatus, note: outcome.note || "" })}
    </div>
  `;
}

function formatDealProtectionForm(lead) {
  const deal = lead.dealProtection || {};
  const status = deal.status || "Active";
  const agreement = deal.commissionAgreement || "Not discussed";
  const updated = deal.updatedAt ? `Updated ${new Date(deal.updatedAt).toLocaleString()}` : "Not tracked yet";
  const nextCheckIn = deal.nextCheckIn || "";
  const acknowledgement = lead.agentAccess?.acknowledgedAt
    ? `Referral acknowledgement signed at ${new Date(lead.agentAccess.acknowledgedAt).toLocaleString()}`
    : "Referral acknowledgement pending";

  return `
    <div class="deal-protection">
      <strong>Deal protection</strong>
      <div class="small-note">Status: ${esc(status)} | Commission: ${esc(agreement)} | ${esc(updated)}</div>
      <div class="small-note">${esc(acknowledgement)}</div>
      ${deal.note ? `<div class="small-note">Note: ${esc(deal.note)}</div>` : ""}
      ${nextCheckIn ? `<div class="small-note">Next check-in: ${esc(new Date(nextCheckIn).toLocaleDateString())}</div>` : ""}
      ${formatDealProtectionEditor(lead, { status, agreement, nextCheckIn, note: deal.note || "" })}
    </div>
  `;
}

function formatDealProtectionEditor(lead, { status, agreement, nextCheckIn, note }) {
  return `
    <form class="deal-protection-form" data-deal-protection="${esc(lead.id)}">
      <div class="deal-protection-grid">
        <label>
          Deal status
          <select name="status" required>
            ${optionList(dealProtectionStatusOptions, status)}
          </select>
        </label>
        <label>
          Commission agreement
          <select name="commissionAgreement" required>
            ${optionList(dealProtectionAgreementOptions, agreement)}
          </select>
        </label>
        <label>
          Next check-in
          <input name="nextCheckIn" type="date" value="${esc(nextCheckIn)}" />
        </label>
      </div>
      <div class="agent-assign-row">
        <input name="note" type="text" value="${esc(note)}" placeholder="Deal note or commission protection detail" maxlength="500" />
        <button class="location-btn" type="submit">Save Deal Status</button>
      </div>
    </form>
  `;
}

function getCommissionProtectionSummary(commission) {
  return {
    expected: commission.expectedCommission ? formatZar(commission.expectedCommission) : "Not calculated",
    saleValue: commission.saleValue ? formatZar(commission.saleValue) : "Not captured",
    referralPercent: commission.referralPercent ? `${commission.referralPercent}%` : "Not set",
    dueDate: commission.payoutDueDate ? new Date(commission.payoutDueDate).toLocaleDateString() : "Not scheduled",
    status: commission.invoicePaymentStatus || commission.payoutStatus || "Not due",
    dueState: commission.dueState || "not-scheduled",
    priorityClass: (commission.priority || "Low").toLowerCase(),
    protectedText: commission.protected
      ? "Referral terms and expected fee are protected."
      : commission.termsProtected
        ? "Terms are protected. Confirm fee details."
        : "Referral terms or fee details still need protection."
  };
}

function formatCommissionSummaryGrid(summary) {
  const cards = [
    ["Referral %", summary.referralPercent],
    ["Expected fee", summary.expected],
    ["Sale value", summary.saleValue],
    ["Due date", summary.dueDate]
  ];
  return `
    <div class="commission-summary-grid">
      ${cards
        .map(
          ([label, value]) => `
            <div>
              <span>${esc(label)}</span>
              <strong>${esc(value)}</strong>
            </div>`
        )
        .join("")}
    </div>
  `;
}

function formatCommissionNextActionCard(commission, priorityClass) {
  return `
    <div class="next-action-card ${esc(priorityClass)}">
      <div>
        <strong>${esc(commission.nextAction || "Keep commission evidence updated.")}</strong>
        <span>${esc(commission.payoutReference ? `Reference: ${commission.payoutReference}` : "No invoice/payment reference captured yet.")}</span>
      </div>
      <em>${esc(commission.priority || "Low")}</em>
    </div>
  `;
}

function formatLockStepStrip(lock) {
  if (!Array.isArray(lock.steps) || !lock.steps.length) return "";
  return `
    <div class="system-step-strip">
      ${lock.steps
        .map(
          (step) => `
            <div class="system-step ${step.complete ? "complete" : "pending"}">
              <strong>${esc(step.label)}</strong>
              <span>${esc(step.complete ? "Locked" : "Open")}</span>
            </div>`
        )
        .join("")}
    </div>
  `;
}

function formatCommissionProtectionPanel(lead) {
  const commission = lead.commissionProtection || {};
  const lock = lead.commissionLock || {};
  const summary = getCommissionProtectionSummary(commission);

  return `
    <div class="commission-protection-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Commission Protection</strong>
          <div class="small-note">${esc(summary.protectedText)}</div>
        </div>
        <span class="match-confidence commission-state ${esc(summary.dueState)}">${esc(summary.status)}</span>
      </div>
      ${formatCommissionSummaryGrid(summary)}
      ${formatCommissionNextActionCard(commission, summary.priorityClass)}
      ${formatLockStepStrip(lock)}
      ${commission.note ? `<div class="small-note">Commission note: ${esc(commission.note)}</div>` : ""}
    </div>
  `;
}

function getSystemTrackCards(lead) {
  const escalation = lead.escalationSummary || {};
  const caseFile = lead.caseFile || {};
  const wow = lead.wowAutomation || {};
  const lock = lead.commissionLock || {};
  const vault = lead.documentVaultSummary || {};
  return [
    {
      title: "1. Escalation Engine",
      tone: escalation.total ? "warn" : "good",
      value: escalation.total ? `${escalation.total} active` : "Clear",
      note: escalation.categories?.length ? escalation.categories.join(" | ") : "No-contact, no-update, docs, transfer and commission risk are quiet."
    },
    {
      title: "2. Admin Control",
      tone: "active",
      value: caseFile.stageLabel || "Intake",
      note: [caseFile.owner ? `Owner: ${caseFile.owner}` : "", caseFile.nextMilestone ? `Next: ${caseFile.nextMilestone}` : ""].filter(Boolean).join(" | ") || "Case file is ready for the next milestone."
    },
    {
      title: "3. Client Wow",
      tone: wow.totalSent ? "good" : "active",
      value: wow.lastSentAt ? `${wow.totalSent || 0} sent` : "Queued to grow",
      note: wow.activeTypes?.length ? wow.activeTypes.join(" | ") : "Next-step briefs, reassurance touches and readiness nudges are available."
    },
    {
      title: "4. Introduce & Lock",
      tone: lock.locked ? "good" : "warn",
      value: lock.label || "Not locked",
      note: lock.totalSteps ? `${lock.completedSteps || 0}/${lock.totalSteps} lock steps complete` : "Secure the referral before momentum outruns proof."
    },
    {
      title: "5. Document Vault",
      tone: Number(vault.missingCount || 0) ? "warn" : "good",
      value: Number.isFinite(Number(vault.readinessPercent)) ? `${vault.readinessPercent}% ready` : "Waiting",
      note: `${vault.uploadedCount || 0} file${vault.uploadedCount === 1 ? "" : "s"} stored${vault.missingCount ? ` | ${vault.missingCount} missing` : " | No required gaps"}`
    }
  ];
}

function formatSystemTracksPanel(lead) {
  const cards = getSystemTrackCards(lead);
  return `
    <div class="system-track-grid">
      ${cards
        .map(
          (card) => `
            <section class="system-track-card ${esc(card.tone)}">
              <span>${esc(card.title)}</span>
              <strong>${esc(card.value)}</strong>
              <small>${esc(card.note)}</small>
            </section>`
        )
        .join("")}
    </div>
  `;
}

function formatDeliveryActivityPanel({ title = "", note = "", items = [], emptyState = "" } = {}) {
  if (!Array.isArray(items) || !items.length) return emptyState || "";
  return `
    <div class="proof-trail-panel">
      <strong>${esc(title || "Delivery activity")}</strong>
      ${note ? `<div class="small-note">${esc(note)}</div>` : ""}
      ${items
        .map((item) => {
          const stamp = item.at ? new Date(item.at).toLocaleString() : "Recently";
          const attempted = Number(item.attempted || 0);
          const delivered = Number(item.delivered || 0);
          const failed = Math.max(0, attempted - delivered);
          const targets = Array.isArray(item.deliveries)
            ? item.deliveries
                .map((delivery) => `${delivery.name || delivery.role || "Recipient"}: ${delivery.delivered ? "sent" : "failed"}`)
                .join(" | ")
            : "";
          return `
            <div class="small-note proof-item">
              ${esc(stamp)} | ${esc(item.label || "Update")} | ${esc(`${delivered}/${attempted} delivered`)}${failed ? ` | ${esc(`${failed} failed`)}` : ""}
              ${item.note ? `<br />${esc(item.note)}` : ""}
              ${targets ? `<br />${esc(targets)}` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function formatCollectionBlock({ className = "", title = "", items = [], renderItem, emptyState = "" } = {}) {
  if (!Array.isArray(items) || !items.length) return emptyState || "";
  return `
    <div class="${esc(className)}">
      ${title ? `<strong>${esc(title)}</strong>` : ""}
      ${items.map((item) => renderItem(item)).join("")}
    </div>
  `;
}

function formatStatusHeader({ title = "", subtitle = "", chipClass = "", chipText = "" } = {}) {
  return `
    <div class="agent-match-topline">
      <div>
        <strong>${esc(title)}</strong>
        <div class="small-note">${esc(subtitle)}</div>
      </div>
      <span class="match-confidence ${esc(chipClass)}">${esc(chipText)}</span>
    </div>
  `;
}

function formatActionRow({ tone = "low", title = "", summary = "", details = [], tag = "" } = {}) {
  const safeDetails = Array.isArray(details) ? details.filter(Boolean) : [];
  return `
    <div class="followup-action ${esc(tone)}">
      <div>
        <strong>${esc(title)}</strong>
        <span>${esc(summary)}</span>
        ${safeDetails.map((detail) => `<small>${esc(detail)}</small>`).join("")}
      </div>
      <em>${esc(tag)}</em>
    </div>
  `;
}

function formatActionList({ items = [], renderItem, emptyState = "" } = {}) {
  return formatCollectionBlock({
    className: "followup-action-list",
    items,
    renderItem,
    emptyState
  });
}

const stakeholderPortalRoles = [
  { role: "buyer", label: "Buyer", purpose: "Purchase status, finance readiness and signing updates" },
  { role: "seller", label: "Seller", purpose: "Sale status, compliance tasks and handover readiness" },
  { role: "agent", label: "Agent", purpose: "Client contact, offer movement and referral evidence" },
  { role: "attorney", label: "Attorney", purpose: "Transfer instruction, lodgement and registration updates" },
  { role: "bond-originator", label: "Bond Originator", purpose: "Bond application, approval conditions and guarantees" }
];

function formatTransactionTimelinePanel(lead) {
  const timeline = lead.transactionTimeline || {};
  const milestones = Array.isArray(timeline.milestones) ? timeline.milestones : [];
  if (!milestones.length) return "";
  const next = timeline.nextMilestone || null;
  const current = timeline.currentMilestone || null;

  return `
    <div class="transaction-timeline-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Transaction Timeline</strong>
          <div class="small-note">
            ${current ? `Current: ${esc(current.label)}` : "No transfer milestone completed yet."}
            ${next ? ` | Next: ${esc(next.label)} (${esc(next.owner)})` : " | Registration and handover complete."}
          </div>
        </div>
        <span class="match-confidence timeline-state ${esc(timeline.state || "not-started")}">${esc(timeline.progress ?? 0)}% complete</span>
      </div>
      <div class="timeline-progress" aria-hidden="true">
        <span style="width: ${Math.max(0, Math.min(100, Number(timeline.progress || 0)))}%"></span>
      </div>
      <div class="transaction-timeline-list">
        ${milestones
          .map(
            (item) => `
              <div class="transaction-milestone ${item.complete ? "complete" : "pending"}">
                <div class="timeline-marker">${item.complete ? "OK" : item.order}</div>
                <div>
                  <strong>${esc(item.label)}</strong>
                  <span>${esc(item.phase || "Transfer")} | Owner: ${esc(item.owner || "Concierge")}</span>
                  ${
                    item.complete
                      ? `<small>${esc(new Date(item.completedAt).toLocaleString())}${item.actor ? ` | ${esc(item.actor)}` : ""}${item.note ? ` | ${esc(item.note)}` : ""}</small>`
                      : `<small>Waiting for evidence or update.</small>`
                  }
                </div>
              </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function getDeadlineChaseStateLabel(state) {
  return (
    {
      overdue: "Overdue",
      "due-today": "Due today",
      "due-soon": "Due soon",
      scheduled: "Scheduled"
    }[state] || "Scheduled"
  );
}

function getDeadlineChaseTone(state) {
  if (state === "overdue") return "high";
  if (state === "due-today" || state === "due-soon") return "medium";
  return "low";
}

function formatDeadlineChasePanel(lead) {
  const deadline = lead.deadlineChase || {};
  const items = Array.isArray(deadline.items) ? deadline.items : [];
  const reminderLog = Array.isArray(lead.deadlineReminderLog) ? lead.deadlineReminderLog : [];
  const nextDue = deadline.nextDueAt ? new Date(deadline.nextDueAt).toLocaleString() : "No dated chase window yet";

  return `
    <div class="commission-protection-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Deadline Chase</strong>
          <div class="small-note">Soft reminders and chase windows for case dates, check-ins, and referral payout timing. Concierge can always override the date and keep the file moving.</div>
        </div>
        <span class="match-confidence commission-state ${deadline.overdueCount ? "overdue" : deadline.dueSoonCount ? "due-soon" : "scheduled"}">${esc(`${deadline.activeCount || 0} active`)}</span>
      </div>
      <div class="commission-summary-grid vault-health-grid">
        <div>
          <span>Tracked dates</span>
          <strong>${esc(String(deadline.trackedCount || 0))}</strong>
        </div>
        <div>
          <span>Active chase</span>
          <strong>${esc(String(deadline.activeCount || 0))}</strong>
        </div>
        <div>
          <span>Overdue</span>
          <strong>${esc(String(deadline.overdueCount || 0))}</strong>
        </div>
        <div>
          <span>Next due</span>
          <strong>${esc(nextDue)}</strong>
        </div>
      </div>
      ${formatActionList({
        items,
        emptyState: `<div class="small-note">No deadline chase windows are active right now.</div>`,
        renderItem: (item) =>
          formatActionRow({
            tone: getDeadlineChaseTone(item.deadlineState),
            title: item.label || "Deadline chase",
            summary: item.detail || "Keep the next dated step moving.",
            details: [
              item.deadlineAt ? `Deadline: ${new Date(item.deadlineAt).toLocaleString()}` : "",
              item.owner ? `Owner: ${item.owner}` : "",
              item.lane ? `Lane: ${humanizeLabel(item.lane)}` : ""
            ],
            tag: getDeadlineChaseStateLabel(item.deadlineState)
          })
      })}
      ${formatDeliveryActivityPanel({
        title: "Recent chase reminders",
        note: "These nudges support momentum, but they never stop concierge from overriding the date or moving the file forward.",
        items: reminderLog,
        emptyState: `<div class="small-note">No automatic chase reminders sent yet.</div>`
      })}
    </div>
  `;
}

function formatStageUpdatePanel(lead) {
  const items = Array.isArray(lead.stageUpdateNotifications) ? lead.stageUpdateNotifications : [];
  return formatDeliveryActivityPanel({
    title: "WhatsApp stage updates",
    note: "Automatic customer and stakeholder updates sent when the stage changes.",
    items
  });
}

function formatWowAutomationPanel(lead) {
  const wow = lead.wowAutomation || {};
  const items = Array.isArray(wow.items) ? wow.items : [];
  return formatDeliveryActivityPanel({
    title: "Client wow automations",
    note: "Proactive reassurance, next-step briefs and readiness nudges sent before silence turns into friction.",
    items
  });
}

function formatDealProofAcceptanceForm(lead, acceptance) {
  return `
    <form class="deal-proof-form" data-deal-acceptance="${esc(lead.id)}">
      <div class="deal-proof-grid">
        <label>
          Accepted by
          <input name="acceptedBy" type="text" value="${esc(acceptance?.acceptedBy || lead.assignedAgent?.name || "")}" placeholder="Agent name confirming referral terms" required />
        </label>
        <label>
          Acceptance channel
          <select name="via" required>
            ${optionList(referralAcceptanceViaOptions, acceptance?.via || "Signed form")}
          </select>
        </label>
        <label>
          Acceptance note
          <input name="note" type="text" value="${esc(acceptance?.note || "")}" maxlength="500" placeholder="Optional proof note" />
        </label>
      </div>
      <div class="agent-assign-row">
        <button class="location-btn" type="submit">Confirm Referral Acceptance</button>
      </div>
    </form>
  `;
}

function formatDealProofMilestoneForm(lead, milestones, selectedMilestoneCode) {
  return `
    <form class="deal-proof-form" data-deal-milestone="${esc(lead.id)}">
      <div class="deal-proof-grid">
        <label>
          Milestone
          <select name="code" required>
            ${dealMilestoneOptions
              .map(
                (item) =>
                  `<option value="${esc(item.value)}" ${selectedMilestoneCode === item.value ? "selected" : ""}>${esc(item.label)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          Updated by
          <input name="actor" type="text" value="Concierge" maxlength="120" />
        </label>
        <label>
          Channel
          <select name="via" required>
            ${optionList(["System note", ...referralAcceptanceViaOptions], "System note")}
          </select>
        </label>
      </div>
      <div class="deal-proof-grid">
        <label>
          Proof note
          <input name="note" type="text" value="" maxlength="500" placeholder="What confirms this milestone?" />
        </label>
        <label>
          Proof link / reference
          <input name="proofRef" type="text" value="" maxlength="500" placeholder="Optional URL, doc ref, or WhatsApp note id" />
        </label>
        <label>
          Recent milestone list
          <input type="text" value="${esc(milestones.map((item) => item.label).join(" -> ") || "None yet")}" disabled />
        </label>
      </div>
      <div class="agent-assign-row">
        <button class="location-btn" type="submit">Add Milestone Evidence</button>
      </div>
    </form>
  `;
}

function formatDealProofCommissionForm(lead, { saleValue, referralPercent, payoutStatus, payoutDueDate, payoutReference, payoutNote }) {
  return `
    <form class="deal-proof-form" data-deal-commission="${esc(lead.id)}">
      <div class="deal-proof-grid">
        <label>
          Final sale value (ZAR)
          <input name="saleValue" type="text" value="${esc(saleValue ? saleValue.toLocaleString("en-ZA") : "")}" inputmode="numeric" placeholder="e.g. 3,500,000" />
        </label>
        <label>
          Referral %
          <input name="referralPercent" type="number" min="0.1" max="100" step="0.1" value="${esc(referralPercent)}" />
        </label>
        <label>
          Invoice / payment status
          <select name="payoutStatus">
            ${optionList(commissionPayoutStatusOptions, payoutStatus)}
          </select>
        </label>
      </div>
      <div class="deal-proof-grid">
        <label>
          Invoice / payment due date
          <input name="payoutDueDate" type="date" value="${esc(payoutDueDate)}" />
        </label>
        <label>
          Invoice / payment reference
          <input name="payoutReference" type="text" value="${esc(payoutReference)}" maxlength="160" placeholder="Invoice / transfer reference" />
        </label>
        <label>
          Invoice / payment note
          <input name="note" type="text" value="${esc(payoutNote)}" maxlength="500" placeholder="Any commission risk detail" />
        </label>
      </div>
      <div class="agent-assign-row">
        <button class="location-btn" type="submit">Save Commission Tracker</button>
      </div>
    </form>
  `;
}

function formatDealProofPanel(lead) {
  const dealProof = lead.dealProof || {};
  const acceptance = dealProof.referralAcceptance || null;
  const milestones = Array.isArray(dealProof.milestones) ? dealProof.milestones : [];
  const commission = dealProof.commission || {};
  const acceptedText = acceptance?.acceptedAt
    ? `${acceptance.acceptedBy || "Agent"} via ${acceptance.via || "Unknown"} on ${new Date(acceptance.acceptedAt).toLocaleString()}`
    : "Pending";
  const latestMilestone = milestones.length ? milestones[milestones.length - 1] : null;
  const milestoneText = latestMilestone?.completedAt
    ? `${latestMilestone.label} at ${new Date(latestMilestone.completedAt).toLocaleString()}`
    : "No milestones logged yet";
  const saleValue = commission.saleValue ? Math.round(toNumber(commission.saleValue, 0)) : "";
  const referralPercent = toNumber(commission.referralPercent, 12.5);
  const expected = commission.expectedCommission ? formatZar(commission.expectedCommission) : "Not calculated";
  const payoutStatus = commission.payoutStatus || "Not due";
  const payoutDueDate = commission.payoutDueDate || "";
  const payoutReference = commission.payoutReference || "";
  const payoutNote = commission.note || "";
  const selectedMilestoneCode = latestMilestone?.code || "agent-contacted";

  return `
    <div class="deal-proof-panel">
      <strong>Deal proof & commission tracker</strong>
      <div class="small-note">Referral acceptance: ${esc(acceptedText)}</div>
      <div class="small-note">Latest milestone: ${esc(milestoneText)}</div>
      <div class="small-note">Expected referral payout: ${esc(expected)} | Payout status: ${esc(payoutStatus)}</div>
      ${formatDealProofAcceptanceForm(lead, acceptance)}
      ${formatDealProofMilestoneForm(lead, milestones, selectedMilestoneCode)}
      ${formatDealProofCommissionForm(lead, { saleValue, referralPercent, payoutStatus, payoutDueDate, payoutReference, payoutNote })}
      ${formatCollectionBlock({
        className: "deal-proof-history",
        items: milestones.slice().reverse(),
        renderItem: (item) => `
          <div class="small-note">
            ${esc(new Date(item.completedAt).toLocaleString())} - ${esc(item.label)}${item.actor ? ` - ${esc(item.actor)}` : ""}${item.note ? ` - ${esc(item.note)}` : ""}${item.proofRef ? ` - ${esc(item.proofRef)}` : ""}
          </div>`
      })}
    </div>
  `;
}

function formatLeadDocumentVaultGapNote(missingDocs) {
  return missingDocs.length
    ? `<div class="small-note error-note">Still missing: ${esc(missingDocs.join(", "))}</div>`
    : `<div class="small-note">No currently required documents are missing.</div>`;
}

function getLeadDocumentVaultFolders(folders, requiredDocs) {
  return folders.length ? folders : requiredDocs.map((label) => ({ label, required: true, stored: false, missing: true, count: 0 }));
}

function formatLeadDocumentVaultFolders(folders, requiredDocs) {
  return `
    <div class="vault-category-grid">
      ${getLeadDocumentVaultFolders(folders, requiredDocs)
        .map((folder) => {
          const ready = Boolean(folder.stored);
          return `
            <div class="vault-category ${ready ? "ready" : "pending"} ${folder.missing ? "missing" : ""}">
              <strong>${esc(folder.label || "Document folder")}</strong>
              <span>${ready ? `Stored${folder.count > 1 ? ` (${folder.count})` : ""}` : folder.required ? "Required now" : "Pending"}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function formatLeadDocumentVaultUploadForm(lead) {
  return `
    <form class="lead-doc-upload-form" data-lead-doc-upload="${esc(lead.id)}">
      <div class="deal-proof-grid">
        <label>
          Category
          <select name="category" required>
            ${optionList(leadDocumentCategoryOptions, "FICA")}
          </select>
        </label>
        <label>
          Note
          <input name="note" type="text" maxlength="500" placeholder="Optional context for this file" />
        </label>
        <label>
          File (PDF/JPG/PNG/DOC/DOCX/TXT)
          <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" required />
        </label>
      </div>
      <div class="agent-assign-row">
        <button class="location-btn" type="submit">Upload to Vault</button>
      </div>
    </form>
  `;
}

function formatLeadDocumentVaultPanel(lead) {
  const documents = Array.isArray(lead.leadDocuments) ? lead.leadDocuments : [];
  const requiredDocs = Array.isArray(lead.requiredLeadDocuments) ? lead.requiredLeadDocuments : [];
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const reminderLog = Array.isArray(lead.documentReminderLog) ? lead.documentReminderLog : [];
  const vault = lead.documentVaultSummary || {};
  const folders = Array.isArray(vault.folders) ? vault.folders : [];
  const readinessPercent = Number.isFinite(Number(vault.readinessPercent)) ? Number(vault.readinessPercent) : 0;
  const lastUploadedAt = vault.lastUploadedAt ? new Date(vault.lastUploadedAt).toLocaleString() : "No uploads yet";
  return `
    <div class="lead-doc-vault">
      <div class="agent-match-topline">
        <div>
          <strong>Document vault</strong>
          <div class="small-note">Secure storage for FICA, OTP, certificates, proof of payment, and compliance documents.</div>
        </div>
        <span class="match-confidence commission-state ${missingDocs.length ? "due-soon" : "paid"}">${esc(`${readinessPercent}% ready`)}</span>
      </div>
      <div class="commission-summary-grid vault-health-grid">
        <div>
          <span>Required now</span>
          <strong>${esc(String(requiredDocs.length))}</strong>
        </div>
        <div>
          <span>Missing now</span>
          <strong>${esc(String(missingDocs.length))}</strong>
        </div>
        <div>
          <span>Stored files</span>
          <strong>${esc(String(vault.uploadedCount || documents.length))}</strong>
        </div>
        <div>
          <span>Last upload</span>
          <strong>${esc(lastUploadedAt)}</strong>
        </div>
      </div>
      ${requiredDocs.length
        ? `<div class="small-note">Required now: ${esc(requiredDocs.join(", "))}</div>`
        : `<div class="small-note">Required documents will appear automatically as the deal advances.</div>`}
      ${formatLeadDocumentVaultGapNote(missingDocs)}
      ${formatLeadDocumentVaultFolders(folders, requiredDocs)}
      ${formatLeadDocumentVaultUploadForm(lead)}
      ${formatCollectionBlock({
        className: "deal-proof-history",
        items: reminderLog,
        emptyState: `<div class="small-note">No automatic missing-document reminders sent yet.</div>`,
        renderItem: (item) => `
          <div class="vault-item">
            <div>
              <strong>Reminder sent ${esc(item.at ? new Date(item.at).toLocaleString() : "recently")}</strong>
              <small>${esc((item.missingDocs || []).join(", ") || "Missing docs")}</small>
              <small>${esc(`${item.delivered || 0}/${item.attempted || 0} delivered`)}</small>
            </div>
          </div>`
      })}
      ${formatCollectionBlock({
        className: "deal-proof-history",
        items: documents,
        emptyState: `<div class="small-note">No files uploaded yet.</div>`,
        renderItem: (doc) => `
          <div class="vault-item">
            <div>
              <strong>${esc(doc.category || "Document")}</strong>
              <small>${esc(doc.originalName || "file")} | ${esc(Math.ceil((doc.size || 0) / 1024))} KB | ${esc(new Date(doc.uploadedAt).toLocaleString())}</small>
              ${doc.note ? `<small>${esc(doc.note)}</small>` : ""}
            </div>
            <button class="location-btn ghost-action" type="button" data-lead-doc-download="${esc(lead.id)}" data-lead-doc-id="${esc(doc.id)}">Download</button>
          </div>`
      })}
    </div>
  `;
}

function formatAgentLinkPanel(lead) {
  const access = lead.agentAccess || null;
  const handoff = lead.agentHandoff || {};
  const gates = Array.isArray(handoff.gates) ? handoff.gates : [];
  const isActive = Boolean(access?.active);
  const created = access?.createdAt ? new Date(access.createdAt).toLocaleString() : "Not created yet";
  const expires = access?.expiresAt ? new Date(access.expiresAt).toLocaleDateString() : "No expiry";
  const viewed = access?.lastViewedAt ? `Last viewed ${new Date(access.lastViewedAt).toLocaleString()}` : "Not viewed yet";
  const acknowledged = access?.acknowledgedAt
    ? `Acknowledged ${new Date(access.acknowledgedAt).toLocaleString()}`
    : "Acknowledgement pending";
  const lastSent = access?.lastSentAt
    ? `WhatsApp introduction sent ${new Date(access.lastSentAt).toLocaleString()}`
    : "WhatsApp introduction not sent yet";
  const deliveryState = access?.lastDeliveryStatus
    ? `${access.lastDeliveryStatus}${access?.lastDeliveryReason ? ` | ${access.lastDeliveryReason}` : ""}`
    : "No delivery status yet";
  const updates = Array.isArray(lead.agentUpdates) ? lead.agentUpdates.slice().reverse() : [];

  return `
    <div class="agent-link-panel">
      <div>
        <div class="agent-match-topline">
          <div>
            <strong>Agent Introduction</strong>
            <div class="small-note">${esc(handoff.nextAction || "Create the secure introduction link and track agent acceptance.")}</div>
          </div>
          <span class="match-confidence handoff-status ${esc(handoff.status || "not_started")}">${esc(handoff.label || "Not introduced")}</span>
        </div>
        <div class="small-note">Status: ${isActive ? "Active" : "Not active"} | Created: ${esc(created)} | Expires: ${esc(expires)}</div>
        <div class="small-note">${esc(acknowledged)} | ${esc(viewed)}</div>
        <div class="small-note">${esc(lastSent)} | ${esc(deliveryState)}</div>
        <div class="small-note">Agent must acknowledge that the 12,5% referral commission is payable only after a successful sale resulting from the introduction.</div>
      </div>
      ${formatAgentHandoffGates(gates)}
      ${formatAgentLinkActions(lead, isActive)}
      ${formatCollectionBlock({
        className: "agent-update-log",
        title: "Latest agent updates",
        items: updates,
        renderItem: (item) => `
          <div class="small-note">
            ${esc(new Date(item.at).toLocaleString())} - ${esc(item.agentName || "Agent")} - ${esc(item.status || "Update")} - ${esc(item.commissionAgreement || "No commission status")}${item.note ? ` - ${esc(item.note)}` : ""}
          </div>`
      })}
    </div>
  `;
}

function formatAgentHandoffGates(gates) {
  if (!Array.isArray(gates) || !gates.length) return "";
  return `
    <div class="handoff-gate-grid">
      ${gates
        .map(
          (gate) => `
            <div class="handoff-gate ${gate.complete ? "complete" : "pending"}">
              <strong>${esc(gate.label)}</strong>
              <span>${esc(gate.complete ? "Complete" : "Pending")}</span>
              <small>${esc(gate.detail || "")}</small>
              ${gate.completedAt ? `<small>${esc(new Date(gate.completedAt).toLocaleString())}</small>` : ""}
            </div>`
        )
        .join("")}
    </div>
  `;
}

function formatAgentLinkActions(lead, isActive) {
  return `
    <div class="risk-actions">
      <button class="location-btn" type="button" data-agent-link="${esc(lead.id)}">${isActive ? "Copy Agent Introduction" : "Create Agent Introduction"}</button>
      <button class="location-btn ghost-action" type="button" data-agent-handoff-whatsapp="${esc(lead.id)}">${isActive ? "Send to Agent on WhatsApp" : "Create + Send on WhatsApp"}</button>
      ${isActive ? `<button class="location-btn ghost-action" type="button" data-agent-link-refresh="${esc(lead.id)}">Refresh Secure Link</button>` : ""}
    </div>
  `;
}

function formatStakeholderPortalActions(lead) {
  return `
    <div class="risk-actions left-actions">
      <button class="location-btn" type="button" data-stakeholder-bulk="${esc(lead.id)}">Create All Party Links</button>
      <button class="location-btn ghost-action" type="button" data-stakeholder-sharepack="${esc(lead.id)}">Copy WhatsApp Share Pack</button>
    </div>
  `;
}

function formatStakeholderLinkRow(lead, access, item) {
  const entry = access[item.role] || null;
  const active = Boolean(entry?.active);
  const meta = active ? `Active${entry?.expiresAt ? ` | Expires ${new Date(entry.expiresAt).toLocaleDateString()}` : ""}` : "Not active";
  return `
    <div class="stakeholder-link-row">
      <div>
        <strong>${esc(item.label)}</strong>
        <small>${esc(item.purpose)}</small>
        <small>${esc(meta)}</small>
      </div>
      <button class="location-btn ghost-action" type="button" data-stakeholder-link="${esc(lead.id)}" data-stakeholder-role="${esc(item.role)}">
        ${active ? "Copy Link" : "Create Link"}
      </button>
    </div>
  `;
}

function formatStakeholderPortalPanel(lead) {
  const access = lead.stakeholderAccess || {};
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates.slice().reverse().slice(0, 5) : [];
  return `
    <div class="agent-link-panel">
      <div>
        <strong>Stakeholder Portals</strong>
        <div class="small-note">Secure role-specific links for buyer, seller, agent, attorney, and bond originator.</div>
        <div class="small-note">Portal updates are advisory only. Concierge can continue, correct, or override the case at any point.</div>
      </div>
      ${formatStakeholderPortalActions(lead)}
      <div class="stakeholder-role-brief">
        ${stakeholderPortalRoles.slice(0, 3).map((item) => `
          <div>
            <span>${esc(item.label)}</span>
            <strong>${esc((access[item.role]?.active) ? "Link live" : "Awaiting link")}</strong>
            <p>${esc(item.purpose)}</p>
          </div>
        `).join("")}
      </div>
      <div class="stakeholder-link-grid">
        ${stakeholderPortalRoles.map((item) => formatStakeholderLinkRow(lead, access, item)).join("")}
      </div>
      ${formatCollectionBlock({
        className: "agent-update-log",
        title: "Latest stakeholder updates",
        items: updates,
        renderItem: (item) => `
          <div class="small-note">
            ${esc(new Date(item.at).toLocaleString())} - ${esc(item.roleLabel || item.role || "Stakeholder")} - ${esc(item.note || "")}${item.advisoryOnly ? " - Advisory only" : ""}
          </div>`
      })}
    </div>
  `;
}

function buildStakeholderReviewActions(update) {
  const note = update?.note || "Stakeholder update shared.";
  const status = update?.status || "";
  const medium = update?.medium || "";
  const nextCheckIn = update?.nextCheckIn || "";
  const roleLabel = update?.roleLabel || update?.role || "Stakeholder";
  const milestoneCode = guessMilestoneCodeFromText(`${status} ${note}`);
  const actions = [
    {
      label: "Apply to progress",
      section: "progress",
      selector: "[data-deal-protection] input[name='note']",
      message: `${roleLabel} advisory update loaded into the progress form for concierge review.`,
      prefill: {
        "[data-deal-protection] select[name='status']": status,
        "[data-deal-protection] input[name='nextCheckIn']": nextCheckIn,
        "[data-deal-protection] input[name='note']": `${roleLabel} advisory update: ${note}`
      }
    },
    {
      label: "Convert to milestone",
      section: "evidence",
      selector: "[data-deal-milestone] input[name='note']",
      message: `${roleLabel} advisory update loaded into milestone evidence for concierge review.`,
      prefill: {
        "[data-deal-milestone] select[name='code']": milestoneCode,
        "[data-deal-milestone] input[name='actor']": "Concierge",
        "[data-deal-milestone] input[name='note']": `${roleLabel} advisory update: ${note}`
      }
    }
  ];

  if (medium) {
    actions.unshift({
      label: "Use as contact note",
      section: "handoff",
      selector: "[data-confirm-contact] input[name='note']",
      message: `${roleLabel} advisory contact note loaded for concierge confirmation.`,
      prefill: {
        "[data-confirm-contact] select[name='medium']": medium,
        "[data-confirm-contact] input[name='note']": `${roleLabel} advisory contact: ${note}`
      }
    });
  }

  return actions;
}

function getStakeholderReviewStateLabel(state = "") {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "pending-concierge-review") return "Awaiting concierge";
  if (normalized === "in-concierge-workflow") return "In workflow";
  if (normalized === "reference-only") return "Reference only";
  if (normalized === "dismissed") return "Dismissed";
  return "Advisory";
}

function getStakeholderReviewTone(state = "") {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "pending-concierge-review") return "pending";
  if (normalized === "in-concierge-workflow") return "active";
  if (normalized === "reference-only") return "good";
  if (normalized === "dismissed") return "muted";
  return "";
}

function formatConciergeReviewPanel(lead) {
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates : [];
  const pending = updates
    .filter((item) => item?.reviewState === "pending-concierge-review")
    .slice()
    .reverse()
    .slice(0, 4);
  const reviewed = updates
    .filter((item) => item?.reviewState && item.reviewState !== "pending-concierge-review")
    .slice()
    .reverse()
    .slice(0, 3);
  if (!pending.length && !reviewed.length) return "";

  return `
    <div class="concierge-review-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Concierge Review</strong>
          <div class="small-note">Portal updates can help the case, but concierge remains free to continue, correct, or override.</div>
        </div>
        <span class="match-confidence">${esc(`${pending.length} pending`)}</span>
      </div>
      ${
        pending.length
          ? `<div class="concierge-review-grid">
        ${pending
          .map((item) => {
            const actions = buildStakeholderReviewActions(item);
            return `
              <article class="concierge-review-card">
                <div class="concierge-review-topline">
                  <strong>${esc(item.roleLabel || item.role || "Stakeholder")}</strong>
                  <span class="${esc(getStakeholderReviewTone(item.reviewState))}">${esc(getStakeholderReviewStateLabel(item.reviewState))}</span>
                </div>
                <p>${esc(item.note || "Shared advisory update")}</p>
                <div class="small-note">${esc(new Date(item.at).toLocaleString())}${item.status ? ` | Suggested status: ${item.status}` : ""}${item.medium ? ` | Suggested contact: ${item.medium}` : ""}${item.nextCheckIn ? ` | Suggested next check-in: ${new Date(item.nextCheckIn).toLocaleDateString()}` : ""}</div>
                <div class="concierge-review-actions">
                  ${actions
                    .map(
                      (action) => `
                        <button
                          class="location-btn ghost-action"
                          type="button"
                          data-playbook-jump="true"
                          data-playbook-section="${esc(action.section || "")}"
                          data-playbook-selector="${esc(action.selector || "")}"
                          data-playbook-message="${esc(action.message || "")}"
                          data-playbook-prefill="${esc(JSON.stringify(action.prefill || {}))}"
                        >${esc(action.label || "Open")}</button>`
                    )
                    .join("")}
                  <button class="location-btn ghost-action" type="button" data-stakeholder-review-action="working" data-stakeholder-review-lead="${esc(lead.id)}" data-stakeholder-review-id="${esc(item.id)}">Working</button>
                  <button class="location-btn ghost-action" type="button" data-stakeholder-review-action="reference" data-stakeholder-review-lead="${esc(lead.id)}" data-stakeholder-review-id="${esc(item.id)}">Reference</button>
                  <button class="location-btn ghost-action" type="button" data-stakeholder-review-action="dismiss" data-stakeholder-review-lead="${esc(lead.id)}" data-stakeholder-review-id="${esc(item.id)}">Dismiss</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>`
          : `<div class="small-note">No advisory updates are waiting for concierge review right now.</div>`
      }
      ${
        reviewed.length
          ? `<div class="agent-update-log">
              <strong>Recent review outcomes</strong>
              ${reviewed
                .map(
                  (item) => `
                    <div class="small-note">
                      ${esc(new Date(item.reviewedAt || item.at).toLocaleString())} - ${esc(item.roleLabel || item.role || "Stakeholder")} - ${esc(getStakeholderReviewStateLabel(item.reviewState))} - ${esc(item.note || "")}
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function getAgentMatchSummary(match) {
  const agent = match.agent || {};
  const confidence = Number.isFinite(Number(match.confidence)) ? Number(match.confidence) : 0;
  const reasons = Array.isArray(match.reasons) ? match.reasons : [];
  const cautions = Array.isArray(match.cautions) ? match.cautions : [];
  const alternatives = Array.isArray(match.alternatives) ? match.alternatives : [];
  const metrics = agent.metrics || {};
  const metricsBits = [
    Number.isFinite(metrics.priorAssignments) ? `${metrics.priorAssignments} prior introduction${metrics.priorAssignments === 1 ? "" : "s"}` : "",
    Number.isFinite(metrics.hotLeadAssignments) && metrics.hotLeadAssignments > 0
      ? `${metrics.hotLeadAssignments} hot lead${metrics.hotLeadAssignments === 1 ? "" : "s"}`
      : "",
    Number.isFinite(metrics.averageResponseMinutes) ? `avg contact ${metrics.averageResponseMinutes} min` : ""
  ].filter(Boolean);
  return {
    agent,
    confidence,
    reasons,
    cautions,
    alternatives,
    metricsBits,
    canUseRecommendation: Boolean(match.available && agent.name)
  };
}

function formatAgentMatchCard(agent, metricsBits) {
  if (!agent.name) return "";
  return `
    <div class="match-agent-card">
      <span>${esc(agent.name)}</span>
      <small>${esc([agent.agency, agent.phone, agent.email].filter(Boolean).join(" | ") || "Details not captured")}</small>
      ${metricsBits.length ? `<small>${esc(metricsBits.join(" | "))}</small>` : ""}
    </div>
  `;
}

function formatMatchInsightColumn(label, items, emptyState) {
  return `
    <div>
      <span class="match-label">${esc(label)}</span>
      ${items.map((item) => `<div class="small-note">- ${esc(item)}</div>`).join("") || `<div class="small-note">${esc(emptyState)}</div>`}
    </div>
  `;
}

function formatAgentAlternatives(alternatives) {
  if (!Array.isArray(alternatives) || !alternatives.length) return "";
  return `<div class="small-note">Alternatives: ${alternatives
    .map((item) => `${esc(item.name)}${item.agency ? ` (${esc(item.agency)})` : ""} - ${esc(item.confidence)}%`)
    .join(" | ")}</div>`;
}

function formatRecommendedAgentAction(agent, canUseRecommendation) {
  if (!canUseRecommendation) return "";
  return `
    <div class="risk-actions left-actions">
      <button
        class="location-btn ghost-action"
        type="button"
        data-use-recommended-agent
        data-agent-name="${esc(agent.name)}"
        data-agent-phone="${esc(agent.phone || "")}"
        data-agent-agency="${esc(agent.agency || "")}"
      >Use Recommended Specialist</button>
    </div>
  `;
}

function formatAgentMatchPanel(lead) {
  const match = lead.agentMatch || null;
  if (!match) return "";
  const { agent, confidence, reasons, cautions, alternatives, metricsBits, canUseRecommendation } = getAgentMatchSummary(match);

  return `
    <div class="agent-match-panel ${match.available ? "" : "empty"}">
      ${formatStatusHeader({
        title: "Recommended specialist",
        subtitle: match.recommendation || "No recommendation yet",
        chipText: `${confidence}% confidence`
      })}
      <div class="small-note">${esc(match.nextAction || "Review the lead and select the best available property specialist.")}</div>
      ${formatAgentMatchCard(agent, metricsBits)}
      <div class="match-grid">
        ${formatMatchInsightColumn("Why this match", reasons, "No strong match signals yet.")}
        ${formatMatchInsightColumn("Check before introduction", cautions, "No cautions flagged.")}
      </div>
      ${formatAgentAlternatives(alternatives)}
      ${formatRecommendedAgentAction(agent, canUseRecommendation)}
    </div>
  `;
}

function formatDuplicateSignalsPanel(lead) {
  const signals = lead.duplicateSignals || null;
  if (!signals || !signals.isDuplicate) return "";
  const matches = Array.isArray(signals.matches) ? signals.matches : [];
  const level = (signals.level || "medium").toLowerCase();

  return `
    <div class="duplicate-intel-panel ${esc(level)}">
      ${formatStatusHeader({
        title: "Duplicate lead signal",
        subtitle: signals.recommendation || "Potential duplicate detected.",
        chipClass: `duplicate-confidence ${level}`,
        chipText: `${signals.confidence || 0}% confidence`
      })}
      ${formatActionList({
        items: matches,
        emptyState: `<div class="small-note">No matching lead IDs available yet.</div>`,
        renderItem: (item) =>
          formatActionRow({
            tone: level,
            title: item.id || "Lead",
            summary: `${item.fullName || "Name not captured"} | ${((item.intent || "unknown").toUpperCase())} | ${item.area || "Area not captured"}`,
            details: [(item.reasons || []).join(" | ")],
            tag: `${item.score || 0}%`
          })
      })}
    </div>
  `;
}

function formatIntakeIntelligencePanel(lead) {
  const intelligence = lead.intakeIntelligence || null;
  if (!intelligence) return "";
  const priorityClass = (intelligence.priority || "Low").toLowerCase();
  const missingCritical = Array.isArray(intelligence.missingCritical) ? intelligence.missingCritical : [];
  const missingEnrichment = Array.isArray(intelligence.missingEnrichment) ? intelligence.missingEnrichment : [];
  const actions = Array.isArray(intelligence.actions) ? intelligence.actions : [];
  const gapItems = [
    ...(missingCritical.length ? [{ tone: "high", title: "Critical gaps", summary: missingCritical.join(", "), tag: "Fix" }] : []),
    ...(missingEnrichment.length ? [{ tone: "medium", title: "Enrichment gaps", summary: missingEnrichment.join(", "), tag: "Improve" }] : [])
  ];

  return `
    <div class="intake-intel-panel">
      ${formatStatusHeader({
        title: "Intake intelligence",
        subtitle: intelligence.summary || "Lead capture quality and routing readiness.",
        chipClass: `intake-priority ${priorityClass}`,
        chipText: `${intelligence.captureScore ?? 0}% capture`
      })}
      <div class="next-action-card ${esc(priorityClass)}">
        <div>
          <strong>${esc(intelligence.routeReadiness || "Review intake")}</strong>
          <span>${esc(intelligence.quality || "Unknown")} quality | ${esc(intelligence.capturedSignals ?? 0)} of ${esc(intelligence.totalSignals ?? 0)} signals captured</span>
        </div>
        <em>${esc(intelligence.priority || "Low")}</em>
      </div>
      ${formatActionList({
        items: gapItems,
        renderItem: (item) => formatActionRow(item)
      })}
      ${formatActionList({
        items: actions,
        renderItem: (item) =>
          formatActionRow({
            tone: (item.priority || "Low").toLowerCase(),
            title: item.label || "Action",
            summary: item.detail || "",
            tag: item.priority || "Low"
          })
      })}
    </div>
  `;
}

function formatFollowUpIntelligencePanel(lead) {
  const intelligence = lead.followUpIntelligence || null;
  if (!intelligence) return "";
  const suggestions = Array.isArray(intelligence.suggestions) ? intelligence.suggestions : [];
  const priorityClass = (intelligence.priority || "Low").toLowerCase();
  const nextBestAction = lead.nextBestAction || null;
  const nextPriorityClass = (nextBestAction?.priority || "Low").toLowerCase();

  return `
    <div class="followup-intel-panel">
      ${formatStatusHeader({
        title: "Follow-up intelligence",
        subtitle: intelligence.reason || "Recommended next action based on lead status.",
        chipClass: `followup-priority ${priorityClass}`,
        chipText: intelligence.primary || "Check back in 24 hours"
      })}
      ${
        nextBestAction
          ? `<div class="next-action-card ${esc(nextPriorityClass)}">
              <div>
                <strong>Next best action: ${esc(nextBestAction.title || "Check back in 24 hours")}</strong>
                <span>${esc(nextBestAction.reason || "")}</span>
                ${(nextBestAction.owner || nextBestAction.lane) ? `<small>${esc([nextBestAction.owner ? `Owner: ${nextBestAction.owner}` : "", nextBestAction.lane ? `Lane: ${humanizeLabel(nextBestAction.lane)}` : ""].filter(Boolean).join(" | "))}</small>` : ""}
              </div>
              <em>${esc(nextBestAction.priority || "Low")}</em>
            </div>`
          : ""
      }
      ${formatActionList({
        items: suggestions,
        renderItem: (item) =>
          formatActionRow({
            tone: (item.priority || "Low").toLowerCase(),
            title: item.label || "Action",
            summary: item.reason || "",
            details: [item.detail || "", [item.owner ? `Owner: ${item.owner}` : "", item.lane ? `Lane: ${humanizeLabel(item.lane)}` : ""].filter(Boolean).join(" | ")],
            tag: item.priority || "Low"
          })
      })}
    </div>
  `;
}

function formatEscalationPanel(lead) {
  const flags = Array.isArray(lead.escalationFlags) ? lead.escalationFlags : [];
  const summary = lead.escalationSummary || {};
  if (!flags.length) return "";
  const categories = [...new Set(flags.map((flag) => flag.category).filter(Boolean))];
  return `
    <div class="escalation-panel">
      ${formatStatusHeader({
        title: "Escalation Engine",
        subtitle: "Monitors no contact, no update, missing docs, delayed transfer, and commission drift.",
        chipClass: `followup-priority ${esc(summary.highestTier || "high")}`,
        chipText: summary.highestTier ? `${flags.length} ${summary.highestTier}` : `${flags.length} active`
      })}
      ${categories.length ? `<div class="small-note">Active rules: ${esc(categories.join(" | "))}</div>` : ""}
      ${(summary.primaryOwner || summary.primaryAutomation) ? `<div class="small-note">Primary owner: ${esc(summary.primaryOwner || "Concierge")}${summary.primaryAutomation ? ` | ${esc(summary.primaryAutomation)}` : ""}</div>` : ""}
      ${
        summary.oldestDueAt
          ? `<div class="small-note">Oldest due point: ${esc(new Date(summary.oldestDueAt).toLocaleString())}${summary.overdue ? ` | ${esc(`${summary.overdue} overdue`)}` : ""}${summary.dueSoon ? ` | ${esc(`${summary.dueSoon} due soon`)}` : ""}</div>`
          : ""
      }
      ${formatActionList({
        items: flags,
        renderItem: (flag) =>
          formatActionRow({
            tone: flag.escalationTier || "high",
            title: flag.category ? `${flag.category}: ${flag.title || "Escalation"}` : flag.title || "Escalation",
            summary: flag.reason || "",
            details: [
              flag.nextAction ? `Next action: ${flag.nextAction}` : "",
              flag.ownerRole ? `Owner: ${flag.ownerRole}` : "",
              flag.workflowLane ? `Lane: ${humanizeLabel(flag.workflowLane)}` : "",
              flag.automationLabel ? `System response: ${flag.automationLabel}` : "",
              flag.responseWindow ? `Response window: ${flag.responseWindow}` : "",
              Array.isArray(flag.missingDocuments) && flag.missingDocuments.length ? `Missing: ${flag.missingDocuments.join(", ")}` : "",
              flag.dueAt ? `Due: ${new Date(flag.dueAt).toLocaleString()} | Status: ${flag.status || "open"}` : ""
            ],
            tag: flag.escalationTier || flag.priority || "High"
          })
      })}
      ${formatEscalationPlaybookGrid(lead, flags)}
    </div>
  `;
}

function guessMilestoneCodeFromText(text = "") {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return "agent-contacted";
  if (normalized.includes("otp") || normalized.includes("offer to purchase") || normalized.includes("signed offer")) return "otp-signed";
  if (normalized.includes("offer")) return "offer-received";
  if (normalized.includes("viewing") || normalized.includes("valuation")) return "viewing-booked";
  if (normalized.includes("bond approval")) return "bond-approval";
  if (normalized.includes("guarantees")) return "guarantees-issued";
  if (normalized.includes("transfer instruction")) return "transfer-instruction";
  if (normalized.includes("fica")) return "fica-complete";
  if (normalized.includes("compliance")) return "compliance-certificates";
  if (normalized.includes("rates clearance")) return "rates-clearance";
  if (normalized.includes("transfer documents")) return "transfer-documents-signed";
  if (normalized.includes("bond documents")) return "bond-documents-signed";
  if (normalized.includes("lodg")) return "lodged";
  if (normalized.includes("register")) return "registered";
  if (normalized.includes("sale pending")) return "sale-pending";
  if (normalized.includes("sale concluded")) return "sale-concluded";
  if (normalized.includes("handover")) return "handover-complete";
  return "agent-contacted";
}

function guessDocumentCategoryFromLabels(labels = []) {
  const joined = (Array.isArray(labels) ? labels : [labels]).join(" ").toLowerCase();
  if (joined.includes("otp") || joined.includes("offer to purchase") || joined.includes("signed offer")) return "Offer to Purchase (OTP)";
  if (joined.includes("fica") || joined.includes("id") || joined.includes("proof of address")) return "FICA";
  if (joined.includes("certificate")) return "Certificates";
  if (joined.includes("compliance")) return "Compliance documents";
  if (joined.includes("proof of payment") || joined.includes("payment")) return "Proof of payment";
  if (joined.includes("transfer")) return "Transfer documents";
  if (joined.includes("bond")) return "Bond documents";
  if (joined.includes("rates")) return "Rates clearance";
  if (joined.includes("referral")) return "Referral acceptance proof";
  if (joined.includes("handoff")) return "Agent introduction proof";
  if (joined.includes("invoice")) return "Commission invoice";
  if (joined.includes("commission")) return "Commission payment proof";
  return "Milestone evidence";
}

function getEscalationPlaybook(lead, flag) {
  const workflow = lead.outcomeWorkflow || {};
  const caseFile = lead.caseFile || {};
  const assignedAgent = lead.assignedAgent || lead.agentMatch?.agent || {};
  const missingDocs = Array.isArray(flag?.missingDocuments) && flag.missingDocuments.length
    ? flag.missingDocuments
    : (Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : []);
  const nextMilestone = flag?.nextMilestone?.label || lead.transactionTimeline?.nextMilestone?.label || workflow.nextControl || "next milestone";
  const nextMilestoneOwner = flag?.nextMilestone?.owner || lead.transactionTimeline?.nextMilestone?.owner || "responsible stakeholder";
  const owner = flag?.ownerRole || workflow.primaryOwner || workflow.owner || caseFile.owner || "Concierge";
  const lane = humanizeLabel(flag?.workflowLane || workflow.activeTrack || workflow.lane || "open routing");
  const dueText = flag?.dueAt ? new Date(flag.dueAt).toLocaleString() : "Immediate attention";
  const category = String(flag?.category || "Escalation");
  const normalizedCategory = category.toLowerCase();
  const clientName = getLeadDisplayName(lead);
  const receivingAgent = assignedAgent?.name || "receiving agent";
  const documentCategory = guessDocumentCategoryFromLabels(missingDocs);
  const milestoneCode = guessMilestoneCodeFromText(nextMilestone || flag?.title || flag?.reason || "");
  const firstContactAction = lead.referred
    ? `Call ${receivingAgent} and capture the exact contact time with ${clientName}.`
    : `Call or WhatsApp ${clientName} and save the first response attempt on the file.`;

  const defaults = {
    title: `${category} recovery`,
    objective: flag?.reason || "Stabilise the case and record the next accountable action.",
    firstMove: flag?.nextAction || "Review the case and assign the right owner.",
    steps: [
      "Confirm who owns the case right now.",
      "Record the blocker and the promised next move.",
      "Set a dated follow-up before leaving the file."
    ],
    proofItems: [
      "Owner name",
      "Time of latest update",
      "Next promised action"
    ],
    closeWhen: "Close this playbook when the blocker is cleared and the next dated step is recorded.",
    actions: [
      { label: "Open case snapshot", section: "snapshot", selector: ".case-workspace-hero", message: "Case snapshot opened." }
    ]
  };

  if (normalizedCategory === "no contact") {
    return {
      ...defaults,
      title: "No contact recovery",
      objective: "Restore human contact quickly and make one person accountable for the next touchpoint.",
      firstMove: firstContactAction,
      steps: [
        firstContactAction,
        lead.referred
          ? `Get ${receivingAgent} to confirm method, time, and outcome of the client contact.`
          : "Assign the correct specialist immediately if no receiving agent is live yet.",
        "Schedule the next appointment, callback window, or viewing before closing the update."
      ],
      proofItems: [
        "Contact method and timestamp",
        "Who made the contact",
        "Next appointment or callback window"
      ],
      closeWhen: "Close once first human contact and the next dated step are both captured.",
      actions: [
        {
          label: "Open contact form",
          section: "handoff",
          selector: "[data-confirm-contact] input[name='note']",
          prefill: {
            "[data-confirm-contact] select[name='medium']": "WhatsApp",
            "[data-confirm-contact] input[name='note']": `First contact confirmed. Capture outcome and next step for ${clientName}.`
          },
          message: "Ready to confirm client contact."
        },
        {
          label: "Open introduction",
          section: "handoff",
          selector: "[data-assign-agent] input[name='agentName']",
          prefill: assignedAgent?.name
            ? {
                "[data-assign-agent] input[name='agentName']": assignedAgent.name,
                "[data-assign-agent] input[name='agentPhone']": assignedAgent.phone || "",
                "[data-assign-agent] input[name='agentAgency']": assignedAgent.agency || ""
              }
            : null,
          message: "Ready to confirm or update the receiving agent."
        }
      ]
    };
  }

  if (normalizedCategory === "no update") {
    return {
      ...defaults,
      title: "No update restart",
      objective: "Re-open case momentum with a dated progress update and a visible blocker.",
      firstMove: `Ask ${owner} for a dated update on ${nextMilestone}.`,
      steps: [
        `Request a fresh update from ${owner} on the current case status.`,
        "Capture the blocker, decision, or stakeholder delay in plain language.",
        "Move the timeline forward with a new milestone date and follow-up owner."
      ],
      proofItems: [
        "Dated progress note",
        "Named blocker or decision",
        "New milestone date"
      ],
      closeWhen: "Close when the case has a fresh dated update and a new next milestone.",
      actions: [
        {
          label: "Log stage note",
          section: "progress",
          selector: "[data-lifecycle] input[name='note']",
          prefill: {
            "[data-lifecycle] input[name='note']": `Progress update captured for ${nextMilestone}. Blocker, owner, and next dated step confirmed.`
          },
          message: "Ready to log the latest case note."
        },
        {
          label: "Update milestone",
          section: "evidence",
          selector: "[data-deal-milestone] select[name='code']",
          prefill: {
            "[data-deal-milestone] select[name='code']": milestoneCode,
            "[data-deal-milestone] input[name='note']": `Case restarted with a fresh update on ${nextMilestone}.`
          },
          message: "Ready to record milestone progress."
        }
      ]
    };
  }

  if (normalizedCategory === "missing docs") {
    return {
      ...defaults,
      title: "Document recovery",
      objective: "Close vault gaps before they slow introduction, offer, transfer, or commission protection.",
      firstMove: `Request ${missingDocs.join(", ") || "the missing documents"} from the current owner and upload them to the vault.`,
      steps: [
        `Name the missing items clearly: ${missingDocs.join(", ") || "required proof still outstanding"}.`,
        "Confirm who will supply each item and by when.",
        "Upload the evidence to the vault and link it to the live milestone."
      ],
      proofItems: [
        "Uploaded file names",
        "Who supplied each document",
        "Milestone that is now unblocked"
      ],
      closeWhen: "Close when the missing evidence is stored and the blocked milestone is released.",
      actions: [
        {
          label: "Open vault upload",
          section: "evidence",
          selector: "[data-lead-doc-upload] select[name='category']",
          prefill: {
            "[data-lead-doc-upload] select[name='category']": documentCategory,
            "[data-lead-doc-upload] input[name='note']": `Requested missing evidence: ${missingDocs.join(", ") || "required case document"}.`
          },
          message: "Vault upload is ready for the missing document."
        },
        {
          label: "Open proof log",
          section: "evidence",
          selector: "[data-deal-milestone] input[name='note']",
          prefill: {
            "[data-deal-milestone] select[name='code']": milestoneCode,
            "[data-deal-milestone] input[name='note']": `Missing evidence chased: ${missingDocs.join(", ") || "required document"}`
          },
          message: "Ready to log proof context with the milestone."
        }
      ]
    };
  }

  if (normalizedCategory === "delayed transfer") {
    return {
      ...defaults,
      title: "Transfer acceleration",
      objective: "Force a dated commitment from the next stakeholder so the file starts moving again.",
      firstMove: `Escalate to ${nextMilestoneOwner} for a dated commitment on ${nextMilestone}.`,
      steps: [
        `Contact ${nextMilestoneOwner} for a concrete date on ${nextMilestone}.`,
        "Record the stated blocker, missing dependency, or promised completion date.",
        "Set the next chase date and inform the affected parties of the revised timing."
      ],
      proofItems: [
        "Stakeholder response time",
        "Promised completion date",
        "Revised timeline note"
      ],
      closeWhen: "Close when a dated commitment is captured and the timeline reflects the new transfer plan.",
      actions: [
        {
          label: "Update milestone",
          section: "evidence",
          selector: "[data-deal-milestone] select[name='code']",
          prefill: {
            "[data-deal-milestone] select[name='code']": milestoneCode,
            "[data-deal-milestone] input[name='note']": `Delayed transfer escalated to ${nextMilestoneOwner}. Awaiting dated commitment for ${nextMilestone}.`
          },
          message: "Ready to capture the delayed-transfer milestone update."
        },
        {
          label: "Set next check-in",
          section: "progress",
          selector: "[data-deal-protection] input[name='nextCheckIn']",
          prefill: {
            "[data-deal-protection] input[name='note']": `Delayed transfer chase opened for ${nextMilestone}. Waiting on ${nextMilestoneOwner}.`
          },
          message: "Ready to set the next chase date."
        }
      ]
    };
  }

  if (normalizedCategory === "commission protection") {
    return {
      ...defaults,
      title: "Commission shield",
      objective: "Lock the referral terms before the commercial file advances further.",
      firstMove: "Confirm the referral percentage, acceptance, and payment trigger on the case file.",
      steps: [
        "Get the receiving agent to accept or reconfirm the referral terms.",
        "Store proof of the referral percentage and payment trigger.",
        "Set the invoice or payment due checkpoint so the fee stays visible through completion."
      ],
      proofItems: [
        "Accepted referral terms",
        "Referral percentage",
        "Invoice or payment due checkpoint"
      ],
      closeWhen: "Close when the terms are accepted, proof is stored, and the fee checkpoint is visible in the case.",
      actions: [
        {
          label: "Capture acceptance",
          section: "evidence",
          selector: "[data-deal-acceptance] input[name='acceptedBy']",
          prefill: {
            "[data-deal-acceptance] input[name='note']": "Referral terms reconfirmed for commission protection."
          },
          message: "Ready to capture referral acceptance."
        },
        {
          label: "Open commission tracker",
          section: "evidence",
          selector: "[data-deal-commission] input[name='referralPercent']",
          prefill: {
            "[data-deal-commission] input[name='note']": "Commission protection checkpoint reviewed and updated."
          },
          message: "Commission tracker opened for an update."
        }
      ]
    };
  }

  return defaults;
}

function formatEscalationPlaybookGrid(lead, flags) {
  const seen = new Set();
  const playbooks = [];
  flags.forEach((flag) => {
    const key = String(flag?.category || flag?.code || "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    playbooks.push({
      ...getEscalationPlaybook(lead, flag),
      tone: flag?.escalationTier || flag?.priority || "high",
      owner: flag?.ownerRole || lead.outcomeWorkflow?.primaryOwner || lead.outcomeWorkflow?.owner || lead.caseFile?.owner || "Concierge",
      lane: humanizeLabel(flag?.workflowLane || lead.outcomeWorkflow?.activeTrack || lead.outcomeWorkflow?.lane || "open routing"),
      dueText: flag?.dueAt ? new Date(flag.dueAt).toLocaleString() : "Immediate attention"
    });
  });

  if (!playbooks.length) return "";

  return `
    <div class="escalation-playbook-wrap">
      <div class="small-note">Intervention playbooks</div>
      <div class="escalation-playbook-grid">
        ${playbooks
          .map(
            (playbook) => `
              <article class="escalation-playbook-card ${esc(String(playbook.tone).toLowerCase())}">
                <div class="escalation-playbook-topline">
                  <strong>${esc(playbook.title)}</strong>
                  <span>${esc(playbook.lane)}</span>
                </div>
                <p>${esc(playbook.objective)}</p>
                <div class="small-note">First move: ${esc(playbook.firstMove)}</div>
                <div class="small-note">Owner: ${esc(playbook.owner)} | Due: ${esc(playbook.dueText)}</div>
                <ol class="escalation-playbook-list">
                  ${playbook.steps.map((step) => `<li>${esc(step)}</li>`).join("")}
                </ol>
                ${
                  Array.isArray(playbook.actions) && playbook.actions.length
                    ? `<div class="escalation-playbook-actions">
                        ${playbook.actions
                          .map(
                            (action) => `
                              <button
                                class="location-btn ghost-action"
                                type="button"
                                data-playbook-jump="true"
                                data-playbook-section="${esc(action.section || "")}"
                                data-playbook-selector="${esc(action.selector || "")}"
                                data-playbook-message="${esc(action.message || "")}"
                                data-playbook-prefill="${esc(JSON.stringify(action.prefill || {}))}"
                              >${esc(action.label || "Open")}</button>`
                          )
                          .join("")}
                      </div>`
                    : ""
                }
                <div class="escalation-playbook-evidence">
                  <span>Capture proof</span>
                  <small>${esc(playbook.proofItems.join(" | "))}</small>
                </div>
                <div class="small-note">Resolve when: ${esc(playbook.closeWhen)}</div>
              </article>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function flashWorkspaceTarget(element) {
  if (!element) return;
  element.classList.remove("workspace-target-flash");
  void element.offsetWidth;
  element.classList.add("workspace-target-flash");
  setTimeout(() => {
    element.classList.remove("workspace-target-flash");
  }, 1600);
}

function getSuggestionFieldContainer(field) {
  return field.closest("label") || field.parentElement || field;
}

function clearPlaybookSuggestions(detail) {
  if (!detail) return;
  detail.querySelectorAll(".ai-suggestion-note").forEach((note) => note.remove());
  detail.querySelectorAll(".ai-suggested-field, .ai-suggested-field-edited").forEach((field) => {
    field.classList.remove("ai-suggested-field", "ai-suggested-field-edited");
    field.removeAttribute("data-ai-suggestion-state");
  });
}

function markFieldAsSuggested(field) {
  if (!(field instanceof HTMLElement)) return;
  const container = getSuggestionFieldContainer(field);
  container?.querySelector(".ai-suggestion-note")?.remove();

  const note = document.createElement("small");
  note.className = "ai-suggestion-note";
  note.textContent = "AI suggested value. Review before saving.";
  container?.appendChild(note);

  field.classList.add("ai-suggested-field");
  field.classList.remove("ai-suggested-field-edited");
  field.setAttribute("data-ai-suggestion-state", "suggested");

  if (!field.dataset.aiSuggestionBound) {
    const onEdit = () => {
      const host = getSuggestionFieldContainer(field);
      const currentNote = host?.querySelector(".ai-suggestion-note");
      if (currentNote) {
        currentNote.textContent = "Edited after AI suggestion.";
        currentNote.classList.add("edited");
      }
      field.classList.remove("ai-suggested-field");
      field.classList.add("ai-suggested-field-edited");
      field.setAttribute("data-ai-suggestion-state", "edited");
    };
    field.addEventListener("input", onEdit);
    field.addEventListener("change", onEdit);
    field.dataset.aiSuggestionBound = "true";
  }
}

function applyPlaybookPrefill(detail, rawPrefill) {
  if (!detail || !rawPrefill) return;
  clearPlaybookSuggestions(detail);
  let prefill = {};
  try {
    prefill = JSON.parse(rawPrefill);
  } catch {
    prefill = {};
  }
  Object.entries(prefill).forEach(([selector, value]) => {
    if (!selector) return;
    let field = null;
    try {
      field = detail.querySelector(selector);
    } catch {
      field = null;
    }
    if (!(field instanceof HTMLElement)) return;
    if ("value" in field) {
      field.value = value == null ? "" : String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      markFieldAsSuggested(field);
    }
  });
}

function focusLeadWorkspaceTarget(button) {
  const detail = button.closest("[data-lead-detail]");
  if (!detail) return;
  const sectionKey = button.getAttribute("data-playbook-section") || "";
  const selector = button.getAttribute("data-playbook-selector") || "";
  const message = button.getAttribute("data-playbook-message") || "Playbook target opened.";
  const rawPrefill = button.getAttribute("data-playbook-prefill") || "";
  const section = sectionKey ? detail.querySelector(`[data-case-section="${CSS.escape(sectionKey)}"]`) : null;
  const scrollTarget = section || detail;
  scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  flashWorkspaceTarget(scrollTarget);
  applyPlaybookPrefill(detail, rawPrefill);

  let target = null;
  if (selector) {
    try {
      target = detail.querySelector(selector);
    } catch {
      target = null;
    }
  }

  if (target instanceof HTMLElement) {
    setTimeout(() => {
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.select?.();
      }
      flashWorkspaceTarget(target.closest("form") || target);
    }, 220);
  }

  setAdminMessage(message);
}

function formatProofTrailPanel(lead) {
  const events = Array.isArray(lead.proofTrail) ? lead.proofTrail.slice().reverse() : [];
  return `
    <div class="proof-trail-panel">
      <strong>Proof trail</strong>
      <div class="small-note">Append-only event history for audit and commission protection.</div>
      ${formatCollectionBlock({
        items: events,
        emptyState: `<div class="small-note">No audit events captured yet.</div>`,
        renderItem: (event) => `
          <div class="small-note proof-item">
            ${esc(new Date(event.at).toLocaleString())} | ${esc(event.actor || "System")} | ${esc(event.summary || event.type || "Update")} | Hash: ${esc((event.hash || "").slice(0, 10))}
          </div>`
      })}
    </div>
  `;
}

function getLeadQueueParams() {
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("period", leadPeriod?.value || "all");
  params.set("sort", leadSort?.value || "latest");
  params.set("referral", leadReferral?.value || "all");
  params.set("dataset", leadDataset?.value || "live");
  params.set("status", activeLeadStage || leadStatus?.value || "all");
  const search = (leadSearch?.value || "").trim();
  if (search) params.set("search", search);
  return params.toString();
}

function getLeadDisplayName(lead) {
  const slots = lead.slots || {};
  return (slots.fullName || "").trim() || "Name not captured";
}

function getLeadSortValue(lead, field) {
  const slots = lead.slots || {};
  const assignedAgent = lead.assignedAgent || {};
  const lifecycle = lead.lifecycle || {};
  if (field === "name") return getLeadDisplayName(lead);
  if (field === "area") return [slots.area, slots.province].filter(Boolean).join(" ");
  if (field === "agent") return [assignedAgent.name, assignedAgent.agency].filter(Boolean).join(" ");
  if (field === "received") return new Date(lead.createdAt || 0).getTime() || 0;
  return "";
}

function sortLeadQueue(leads) {
  const { field, direction } = leadColumnSort;
  const multiplier = direction === "desc" ? -1 : 1;
  return leads.slice().sort((a, b) => {
    const aValue = getLeadSortValue(a, field);
    const bValue = getLeadSortValue(b, field);
    if (field === "received") return (aValue - bValue) * multiplier;
    return aValue.toString().localeCompare(bValue.toString(), undefined, { sensitivity: "base", numeric: true }) * multiplier;
  });
}

function getLeadQueueSignalSummary(lead, summary) {
  const workflow = lead.outcomeWorkflow || {};
  const nextBestAction = lead.nextBestAction || {};
  const escalation = lead.escalationSummary || {};
  const vault = lead.documentVaultSummary || {};
  const lane = workflow.activeTrack ? humanizeLabel(workflow.activeTrack) : "Open routing";
  const owner = workflow.primaryOwner || workflow.owner || lead.caseFile?.owner || "Concierge";
  const nextControl = nextBestAction.title || workflow.nextControl || "Review case";
  const readiness = Number.isFinite(Number(vault.readinessPercent)) ? `${vault.readinessPercent}% vault` : "Vault waiting";
  const escalationText = escalation.total ? `${escalation.total} escalation${escalation.total === 1 ? "" : "s"}` : "No escalations";
  const urgency = summary.urgency && summary.urgency !== "-" ? `${summary.urgency} urgency` : "Urgency unscored";
  return {
    lane,
    owner,
    nextControl,
    readiness,
    escalationText,
    urgency
  };
}

function formatLeadQueueHeader() {
  const headers = [
    { field: "name", label: "Case" },
    { field: "area", label: "Signal" },
    { field: "agent", label: "Ownership" },
    { field: "received", label: "Received" }
  ];
  return `
    <div class="lead-mail-header" role="row">
      <span class="mail-read-dot header-dot" aria-hidden="true"></span>
      ${headers
        .map((header) => {
          const active = leadColumnSort.field === header.field;
          const direction = active ? (leadColumnSort.direction === "asc" ? "up" : "down") : "";
          const marker = active ? (leadColumnSort.direction === "asc" ? "▲" : "▼") : "";
          return `
            <button class="lead-sort-tab ${active ? "active" : ""}" type="button" data-lead-sort="${esc(header.field)}" aria-sort="${active ? direction : "none"}">
              ${esc(header.label)} <span>${marker}</span>
            </button>`;
        })
        .join("")}
    </div>
  `;
}

function renderLeadStageTabs() {
  if (!leadStageTabs) return;
  leadStageTabs.innerHTML = leadStageTabOptions
    .map(
      (stage) => `
        <button class="lead-stage-tab ${activeLeadStage === stage.value ? "active" : ""}" type="button" data-stage-filter="${esc(stage.value)}">
          ${esc(stage.label)}
        </button>`
    )
    .join("");
}

function bindLeadStageTabs() {
  if (!leadStageTabs) return;
  leadStageTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage-filter]");
    if (!button || !leadStageTabs.contains(button)) return;
    activeLeadStage = button.getAttribute("data-stage-filter") || "all";
    expandedLeadIds.clear();
    renderLeadStageTabs();
    refreshAgentAssist();
  });
}

function formatLifecycleForm(lead) {
  const lifecycle = lead.lifecycle || {};
  const current = lifecycle.code || "new-unacknowledged";
  const updated = lifecycle.updatedAt ? `Updated ${new Date(lifecycle.updatedAt).toLocaleString()}` : "No action recorded yet";
  const note = lifecycle.note || "";
  return `
    <div class="lifecycle-panel">
      <div>
        <strong>Pipeline stage</strong>
        <div class="small-note">Current: ${esc(lifecycle.label || "New / Unacknowledged")} | ${esc(updated)}${lifecycle.ageDays !== null && lifecycle.ageDays !== undefined ? ` | ${esc(lifecycle.ageDays)} days with agent` : ""}</div>
        ${note ? `<div class="small-note">Pipeline note: ${esc(note)}</div>` : ""}
      </div>
      <div class="risk-actions left-actions">
        ${current === "new-unacknowledged" ? `<button class="location-btn" type="button" data-acknowledge-lead="${esc(lead.id)}">Acknowledge Lead</button>` : ""}
      </div>
      <form class="lifecycle-form" data-lifecycle="${esc(lead.id)}">
        <div class="lifecycle-grid">
          <label>
            Move to
            <select name="stage" required>
              ${manualLifecycleStageOptions
                .map((stage) => `<option value="${esc(stage.value)}" ${current === stage.value ? "selected" : ""}>${esc(stage.label)}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Pipeline note
            <input name="note" type="text" value="${esc(note)}" placeholder="Example: agent actively engaging client" maxlength="500" />
          </label>
          <button class="location-btn" type="submit">Save Stage</button>
        </div>
      </form>
    </div>
  `;
}

function formatAgencyOptions() {
  return estateAgencyOptions
    .map((agency) => `<option value="${esc(agency)}"></option>`)
    .join("");
}

function normaliseLookupText(value) {
  return (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function getAgencyMatches(query) {
  const needle = normaliseLookupText(query);
  const matches = estateAgencyOptions
    .filter((agency) => !needle || normaliseLookupText(agency).includes(needle))
    .sort((a, b) => {
      const aText = normaliseLookupText(a);
      const bText = normaliseLookupText(b);
      const aStarts = needle && aText.startsWith(needle) ? 0 : 1;
      const bStarts = needle && bText.startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    });
  if (needle && !matches.includes("Other / Independent")) matches.push("Other / Independent");
  return matches;
}

function renderAgencyMenu(wrapper) {
  const input = wrapper.querySelector("[data-agency-input]");
  const menu = wrapper.querySelector("[data-agency-menu]");
  if (!input || !menu) return;
  const matches = getAgencyMatches(input.value);
  menu.innerHTML = matches.length
    ? matches
        .map((agency, index) => `<button type="button" data-agency-option="${esc(agency)}" data-index="${index}">${esc(agency)}</button>`)
        .join("")
    : `<button type="button" data-agency-option="Other / Independent" data-index="0">Other / Independent</button>`;
  menu.hidden = false;
  wrapper.classList.add("open");
}

function closeAgencyMenus(scope = document) {
  scope.querySelectorAll("[data-agency-combobox]").forEach((wrapper) => {
    wrapper.classList.remove("open");
    const menu = wrapper.querySelector("[data-agency-menu]");
    if (menu) menu.hidden = true;
  });
}

function setActiveAgencyOption(menu, index) {
  const options = Array.from(menu.querySelectorAll("[data-agency-option]"));
  if (!options.length) return;
  const safeIndex = Math.max(0, Math.min(index, options.length - 1));
  options.forEach((option) => option.classList.remove("active"));
  options[safeIndex].classList.add("active");
  options[safeIndex].scrollIntoView({ block: "nearest" });
}

function selectAgencyOption(button) {
  const wrapper = button.closest("[data-agency-combobox]");
  const input = wrapper?.querySelector("[data-agency-input]");
  if (!wrapper || !input) return;
  input.value = button.getAttribute("data-agency-option") || "";
  input.focus();
  closeAgencyMenus(wrapper);
}

function bindAgencyAutocomplete(scope) {
  scope.querySelectorAll("[data-agency-combobox]").forEach((wrapper) => {
    const input = wrapper.querySelector("[data-agency-input]");
    const menu = wrapper.querySelector("[data-agency-menu]");
    if (!input || !menu) return;

    input.addEventListener("focus", () => renderAgencyMenu(wrapper));
    input.addEventListener("input", () => renderAgencyMenu(wrapper));
    input.addEventListener("keydown", (event) => {
      const options = Array.from(menu.querySelectorAll("[data-agency-option]"));
      const currentIndex = options.findIndex((option) => option.classList.contains("active"));
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (menu.hidden) renderAgencyMenu(wrapper);
        setActiveAgencyOption(menu, currentIndex < 0 ? 0 : currentIndex + 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (menu.hidden) renderAgencyMenu(wrapper);
        setActiveAgencyOption(menu, currentIndex < 0 ? 0 : currentIndex - 1);
      }
      if (event.key === "Enter" && !menu.hidden) {
        const active = menu.querySelector("[data-agency-option].active");
        if (active) {
          event.preventDefault();
          selectAgencyOption(active);
        }
      }
      if (event.key === "Escape") closeAgencyMenus(wrapper);
    });

    menu.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-agency-option]");
      if (!button) return;
      event.preventDefault();
      selectAgencyOption(button);
    });
  });
}

document.addEventListener("mousedown", (event) => {
  if (!event.target.closest("[data-agency-combobox]")) closeAgencyMenus();
});

function getLeadAssistSummary(lead) {
  const scoring = lead.scoring || {};
  const delivery = lead.delivery || {};
  const deliveryText = delivery.attemptedAt
    ? `${delivery.delivered ? "Delivered" : "Not delivered"} via WhatsApp at ${new Date(delivery.attemptedAt).toLocaleString()}`
    : "WhatsApp delivery not attempted yet";
  const autoAcknowledgement = lead.autoAcknowledgement || {};
  const autoAcknowledgementText = autoAcknowledgement.recordedAt
    ? `Receipt recorded automatically at ${new Date(autoAcknowledgement.recordedAt).toLocaleString()} | Client WhatsApp ${
        autoAcknowledgement.clientConfirmationDelivered ? "sent" : "not sent"
      }`
    : "Automatic receipt not recorded for this older lead";
  const confirmation = lead.clientConfirmationDelivery || {};
  const confirmationText = confirmation.attemptedAt
    ? `${confirmation.delivered ? "Sent" : "Not sent"} to client at ${new Date(confirmation.attemptedAt).toLocaleString()}`
    : "Client confirmation not sent yet";
  const assignedAgent = lead.assignedAgent || null;
  const assignedDetails = [assignedAgent?.phone, assignedAgent?.agency].filter(Boolean).join(" | ");
  const assignedText = assignedAgent?.name
    ? `Passed to ${assignedAgent.name}${assignedDetails ? ` (${assignedDetails})` : ""} at ${new Date(assignedAgent.assignedAt).toLocaleString()}`
    : "Not passed to an agent yet";
  const created = lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "Unknown date";
  const queueStatus = lead.queueStatus === "closed" ? "Closed" : "Open";
  const referralStatus = lead.referred ? "Referred" : "Unreferred";
  const duplicateSignals = lead.duplicateSignals || {};
  const duplicateLabel = duplicateSignals?.isDuplicate ? `Possible duplicate (${duplicateSignals.confidence || 0}%)` : "No duplicate signal";
  const lifecycle = lead.lifecycle || {};
  const lifecycleLabel = lifecycle.label || "New / Unacknowledged";
  const lifecycleClass =
    lifecycle.code === "new-unacknowledged"
      ? "at-risk"
      : ["sale-concluded", "closed"].includes(lifecycle.code)
        ? "overdue"
        : "";
  const slots = lead.slots || {};
  const isUnread = lifecycle.code === "new-unacknowledged" && !lead.conciergeAcknowledgedAt;
  const contactName = getLeadDisplayName(lead);
  const location = [slots.area, slots.province].filter(Boolean).join(", ") || "Area not captured";
  const priceSignal = slots.priceDisplay || slots.price || "Price not captured";
  const timeline = slots.timeline || "Timeline not captured";
  const acquisition = lead.acquisition || {};
  const acquisitionText = [acquisition.source, acquisition.medium, acquisition.campaign].filter(Boolean).join(" / ") || "Direct or source not captured";
  const agentColumn = assignedAgent?.name ? `${assignedAgent.name}${assignedAgent?.agency ? ` (${assignedAgent.agency})` : ""}` : "Unassigned";
  const received = lead.createdAt
    ? new Date(lead.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Unknown";

  return {
    urgency: scoring.urgency || "-",
    likelihood: scoring.closeLikelihood || "-",
    score: scoring.score !== null && scoring.score !== undefined ? `${scoring.score}/100` : "-",
    delivery,
    deliveryText,
    autoAcknowledgementText,
    confirmationText,
    assignedAgent,
    assignedText,
    created,
    queueStatus,
    referralStatus,
    duplicateSignals,
    duplicateLabel,
    lifecycle,
    lifecycleLabel,
    lifecycleClass,
    isUnread,
    contactName,
    location,
    priceSignal,
    timeline,
    acquisitionText,
    agentColumn,
    received
  };
}

function formatLeadDetailMeta(summary, lead) {
  return `
    <div class="small-note">Score: ${esc(summary.score)} | Close likelihood: ${esc(summary.likelihood)}</div>
    <div class="small-note">${esc(lead.copilot?.snapshot || "No snapshot available.")}</div>
    <div class="small-note">Automatic acknowledgement: ${esc(summary.autoAcknowledgementText)}</div>
    <div class="small-note">Delivery: ${esc(summary.deliveryText)}</div>
    <div class="small-note">Client confirmation: ${esc(summary.confirmationText)}</div>
    <div class="small-note">Agent introduction: ${esc(summary.assignedText)}</div>
    <div class="small-note">Acquisition source: ${esc(summary.acquisitionText)}</div>
  `;
}

function formatCaseWorkspaceMetric(label, value, note = "") {
  return `
    <article class="case-workspace-metric">
      <span>${esc(label)}</span>
      <strong>${esc(value || "-")}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </article>
  `;
}

function formatLeadCaseWorkspaceHeader(lead, summary) {
  const workflow = lead.outcomeWorkflow || {};
  const nextBestAction = lead.nextBestAction || {};
  const vault = lead.documentVaultSummary || {};
  const commission = lead.commissionProtection || {};
  const caseFile = lead.caseFile || {};
  const lane = workflow.lane || nextBestAction.lane || "";
  const laneLabel = lane ? humanizeLabel(lane) : "Open routing";
  const owner = workflow.owner || caseFile.owner || "Concierge";
  const milestone = caseFile.nextMilestone || lead.transactionTimeline?.nextMilestone?.label || "Review next move";
  const readinessPercent = Number.isFinite(Number(vault.readinessPercent)) ? `${vault.readinessPercent}% ready` : "Waiting";
  const commissionState = commission.invoicePaymentStatus || commission.payoutStatus || "Not due";
  const overviewBits = [
    summary.location,
    summary.priceSignal,
    summary.timeline
  ].filter(Boolean);

  return `
    <section class="case-workspace-hero">
      <div class="case-workspace-hero-main">
        <div class="case-workspace-kicker">Axiom Case Workspace</div>
        <h4>${esc(getLeadDisplayName(lead))}</h4>
        <p>${esc(lead.copilot?.snapshot || "Lead summary is ready for review and action.")}</p>
        <div class="case-workspace-meta">
          ${overviewBits.map((item) => `<span>${esc(item)}</span>`).join("")}
        </div>
      </div>
      <div class="case-workspace-metrics">
        ${formatCaseWorkspaceMetric("Case lane", laneLabel, `Owner: ${owner}`)}
        ${formatCaseWorkspaceMetric("Next control", nextBestAction.title || "Review case", nextBestAction.priority || milestone)}
        ${formatCaseWorkspaceMetric("Vault", readinessPercent, vault.missingCount ? `${vault.missingCount} required gap${vault.missingCount === 1 ? "" : "s"}` : "No required gaps")}
        ${formatCaseWorkspaceMetric("Commission", commissionState, commission.nextAction || "No immediate fee action")}
      </div>
    </section>
  `;
}

function formatCaseWorkspaceSection(title, note, blocks, tone = "") {
  const content = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean).join("");
  if (!content) return "";
  const sectionKey = tone || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `
    <section class="case-workspace-section ${esc(tone)}" data-case-section="${esc(sectionKey)}">
      <div class="case-workspace-section-head">
        <div>
          <strong>${esc(title)}</strong>
          ${note ? `<div class="small-note">${esc(note)}</div>` : ""}
        </div>
      </div>
      <div class="case-workspace-section-body">
        ${content}
      </div>
    </section>
  `;
}

function formatHandoffDeskCard(label, value, note = "", tone = "") {
  return `
    <article class="handoff-desk-card ${esc(tone)}">
      <span>${esc(label)}</span>
      <strong>${esc(value || "-")}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </article>
  `;
}

function formatHandoffControlStrip(lead, summary) {
  const handoff = lead.agentHandoff || {};
  const access = lead.agentAccess || {};
  const contact = lead.agentContact || {};
  const stakeholderAccess = lead.stakeholderAccess || {};
  const activeStakeholderLinks = Object.values(stakeholderAccess).filter((entry) => entry?.active).length;
  const assignedAgent = summary.assignedAgent?.name || "Not assigned";
  const contactLabel = contact.contactedAt ? "Confirmed" : "Pending";
  const contactNote = contact.contactedAt
    ? `${contact.medium || "Contact"} | ${new Date(contact.contactedAt).toLocaleString()}`
    : "Client contact still needs confirmation";
  const accessNote = access.active
    ? `Viewed: ${access.lastViewedAt ? new Date(access.lastViewedAt).toLocaleDateString() : "Not yet"}`
    : "Create a secure introduction link";

  return `
    <div class="handoff-desk-grid">
      ${formatHandoffDeskCard("Receiving agent", assignedAgent, summary.assignedAgent?.agency || "Select or confirm the specialist", summary.assignedAgent?.name ? "active" : "warn")}
      ${formatHandoffDeskCard("Introduction status", handoff.label || "Not introduced", handoff.nextAction || "Create the secure introduction and protect the terms.", handoff.status === "accepted" ? "good" : "warn")}
      ${formatHandoffDeskCard("Client contact", contactLabel, contactNote, contact.contactedAt ? "good" : "warn")}
      ${formatHandoffDeskCard("Party links", `${activeStakeholderLinks} live`, accessNote, activeStakeholderLinks ? "active" : "")}
    </div>
  `;
}

function formatHandoffWorkspace(columns) {
  const left = Array.isArray(columns?.left) ? columns.left.filter(Boolean).join("") : "";
  const right = Array.isArray(columns?.right) ? columns.right.filter(Boolean).join("") : "";
  return `
    <div class="handoff-workspace-grid">
      <div class="handoff-workspace-column">${left}</div>
      <div class="handoff-workspace-column">${right}</div>
    </div>
  `;
}

function formatProgressDeskCard(label, value, note = "", tone = "") {
  return `
    <article class="progress-desk-card ${esc(tone)}">
      <span>${esc(label)}</span>
      <strong>${esc(value || "-")}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </article>
  `;
}

function formatProgressControlStrip(lead) {
  const outcome = lead.outcome || {};
  const workflow = lead.outcomeWorkflow || {};
  const timeline = lead.transactionTimeline || {};
  const commission = lead.commissionProtection || {};
  const lock = lead.commissionLock || {};
  const lifecycle = lead.lifecycle || {};
  const nextMilestone = timeline.nextMilestone?.label || workflow.nextControl || "Review next move";
  const commercialStatus = outcome.commercialStatusLabel || "New";
  const laneLabel = workflow.activeTrack ? humanizeLabel(workflow.activeTrack) : (outcome.caseModeLabel || "Undecided");
  const commissionState = commission.invoicePaymentStatus || commission.payoutStatus || "Not due";
  const lockText = lock.label || "Not locked";
  const progressLabel = Number.isFinite(Number(timeline.progress)) ? `${timeline.progress}% complete` : (lifecycle.label || "In progress");

  return `
    <div class="progress-desk-grid">
      ${formatProgressDeskCard("Operating lane", laneLabel, workflow.primaryOwner ? `Owner: ${workflow.primaryOwner}` : "Choose the right case path", workflow.activeTrack ? "active" : "warn")}
      ${formatProgressDeskCard("Commercial state", commercialStatus, nextMilestone, ["accepted_by_agent", "client_contacted", "under_management", "referral_fee_due", "referral_fee_paid", "transaction_closed"].includes(outcome.commercialStatus) ? "good" : "")}
      ${formatProgressDeskCard("Commission shield", commissionState, lock.totalSteps ? `${lock.completedSteps || 0}/${lock.totalSteps} lock steps complete` : lockText, commission.protected ? "good" : "warn")}
      ${formatProgressDeskCard("Transaction movement", progressLabel, timeline.currentMilestone?.label ? `Current: ${timeline.currentMilestone.label}` : "No milestone confirmed yet", Number(timeline.progress || 0) >= 70 ? "good" : "active")}
    </div>
  `;
}

function formatProgressWorkspace(columns) {
  const left = Array.isArray(columns?.left) ? columns.left.filter(Boolean).join("") : "";
  const right = Array.isArray(columns?.right) ? columns.right.filter(Boolean).join("") : "";
  return `
    <div class="progress-workspace-grid">
      <div class="progress-workspace-column">${left}</div>
      <div class="progress-workspace-column">${right}</div>
    </div>
  `;
}

function formatEvidenceDeskCard(label, value, note = "", tone = "") {
  return `
    <article class="evidence-desk-card ${esc(tone)}">
      <span>${esc(label)}</span>
      <strong>${esc(value || "-")}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </article>
  `;
}

function formatEvidenceControlStrip(lead, followUps = [], objections = []) {
  const proof = lead.dealProof || {};
  const acceptance = proof.referralAcceptance || null;
  const milestones = Array.isArray(proof.milestones) ? proof.milestones : [];
  const vault = lead.documentVaultSummary || {};
  const proofTrail = Array.isArray(lead.proofTrail) ? lead.proofTrail : [];
  const missingCount = Number(vault.missingCount || 0);
  const readiness = Number.isFinite(Number(vault.readinessPercent)) ? `${vault.readinessPercent}% ready` : "Waiting";
  const acceptanceValue = acceptance?.acceptedAt ? "Captured" : "Pending";
  const acceptanceNote = acceptance?.acceptedAt
    ? `${acceptance.acceptedBy || "Agent"} | ${new Date(acceptance.acceptedAt).toLocaleDateString()}`
    : "Referral terms still need proof";
  const milestoneNote = milestones.length
    ? milestones[milestones.length - 1]?.label || "Latest milestone recorded"
    : "No evidence milestones logged";
  const messageCount = followUps.length + objections.length;

  return `
    <div class="evidence-desk-grid">
      ${formatEvidenceDeskCard("Referral proof", acceptanceValue, acceptanceNote, acceptance?.acceptedAt ? "good" : "warn")}
      ${formatEvidenceDeskCard("Milestone evidence", `${milestones.length} logged`, milestoneNote, milestones.length ? "active" : "warn")}
      ${formatEvidenceDeskCard("Vault readiness", readiness, missingCount ? `${missingCount} required gap${missingCount === 1 ? "" : "s"}` : "No required gaps", missingCount ? "warn" : "good")}
      ${formatEvidenceDeskCard("Audit trail", `${proofTrail.length} events`, proofTrail.length ? "Append-only history captured" : "No audit events yet", proofTrail.length ? "active" : "")}
      ${formatEvidenceDeskCard("Message packs", `${messageCount} ready`, followUps.length ? `${followUps.length} follow-up drafts | ${objections.length} objection replies` : "No reusable message packs yet", messageCount ? "good" : "")}
    </div>
  `;
}

function formatEvidenceWorkspace(columns) {
  const left = Array.isArray(columns?.left) ? columns.left.filter(Boolean).join("") : "";
  const right = Array.isArray(columns?.right) ? columns.right.filter(Boolean).join("") : "";
  return `
    <div class="evidence-workspace-grid">
      <div class="evidence-workspace-column">${left}</div>
      <div class="evidence-workspace-column">${right}</div>
    </div>
  `;
}

function formatLeadPrimaryActions(lead, delivery) {
  return `
    <div class="risk-actions">
      <button class="location-btn" type="button" data-open-handoff="${esc(lead.id)}">Open WhatsApp Introduction</button>
      <button class="location-btn" type="button" data-client-confirmation="${esc(lead.id)}">Send Client Confirmation</button>
      ${delivery.delivered ? "" : `<button class="location-btn" type="button" data-retry-delivery="${esc(lead.id)}">Retry Auto Delivery</button>`}
    </div>
  `;
}

function formatAgentAssignmentForm(lead, assignedAgent) {
  return `
    <form class="agent-assign-form" data-assign-agent="${esc(lead.id)}">
      <label>Agent passed to</label>
      <div class="agent-assign-row agent-handoff-grid">
        <label class="handoff-field" for="agent-${esc(lead.id)}">
          Agent name
          <input id="agent-${esc(lead.id)}" name="agentName" type="text" value="${esc(assignedAgent?.name || "")}" placeholder="Agent name" />
        </label>
        <label class="handoff-field">
          Cellphone
          <input name="agentPhone" type="text" value="${esc(assignedAgent?.phone || "")}" placeholder="Agent cellphone" />
        </label>
        <label class="handoff-field agency-field">
          Agency
          <span class="agency-combobox" data-agency-combobox>
            <input name="agentAgency" type="text" value="${esc(assignedAgent?.agency || "")}" placeholder="Start typing agency" autocomplete="off" data-agency-input required />
            <span class="agency-menu" data-agency-menu hidden></span>
          </span>
        </label>
        <button class="location-btn" type="submit">Save Introduction</button>
      </div>
    </form>
  `;
}

function formatAssistCopyBlock(title, items, leftKey, rightKey) {
  const safeItems = Array.isArray(items) ? items : [];
  return `
    <div class="assist-block">
      <div class="agent-match-topline">
        <div>
          <strong>${esc(title)}</strong>
          <div class="small-note">Reusable language attached to the case for fast, consistent communication.</div>
        </div>
        <span class="match-confidence">${esc(`${safeItems.length} ready`)}</span>
      </div>
      ${
        safeItems.length
          ? safeItems
              .map(
                (item) => `
                  <div class="assist-line">
                    <span>${esc(item[leftKey] || "")}: ${esc(item[rightKey] || "")}</span>
                    <button class="location-btn copy-btn" type="button" data-copy="${esc(item[rightKey] || "")}">Copy</button>
                  </div>`
              )
              .join("")
          : `<div class="small-note">No reusable messages captured yet.</div>`
      }
    </div>
  `;
}

function formatAssistItem(lead) {
  const summary = getLeadAssistSummary(lead);
  const signal = getLeadQueueSignalSummary(lead, summary);
  const followUps = Array.isArray(lead.followUpPlaybook) ? lead.followUpPlaybook : [];
  const objections = Array.isArray(lead.objectionPlaybook) ? lead.objectionPlaybook : [];
  const detailPanels = [
    formatLeadCaseWorkspaceHeader(lead, summary),
    formatCaseWorkspaceSection(
      "Case Snapshot",
      "Read the case quickly, understand urgency, and decide the next move.",
      [
        formatSystemTracksPanel(lead),
        formatLeadDetailMeta(summary, lead),
        formatIntakeIntelligencePanel(lead),
        formatDuplicateSignalsPanel(lead),
        formatFollowUpIntelligencePanel(lead),
        formatEscalationPanel(lead)
      ],
      "snapshot"
    ),
    formatCaseWorkspaceSection(
      "Introduction Control",
      "Move the case to the right person while keeping acceptance, contact, and visibility intact.",
      [
        formatHandoffControlStrip(lead, summary),
        formatLeadPrimaryActions(lead, summary.delivery),
        formatHandoffWorkspace({
          left: [
            formatAgentMatchPanel(lead),
            formatAgentAssignmentForm(lead, summary.assignedAgent),
            formatContactForm(lead)
          ],
          right: [
            formatConciergeReviewPanel(lead),
            formatAgentLinkPanel(lead),
            formatStakeholderPortalPanel(lead)
          ]
        })
      ],
      "handoff"
    ),
    formatCaseWorkspaceSection(
      "Protection & Progress",
      "Choose the operating lane, protect the fee, and keep the transaction moving forward.",
      [
        formatProgressControlStrip(lead),
        formatProgressWorkspace({
          left: [
            formatOutcomeModePanel(lead),
            formatLifecycleForm(lead),
            formatDealProtectionForm(lead)
          ],
          right: [
            formatCommissionProtectionPanel(lead),
            formatTransactionTimelinePanel(lead),
            formatDeadlineChasePanel(lead),
            formatStageUpdatePanel(lead),
            formatWowAutomationPanel(lead)
          ]
        })
      ],
      "progress"
    ),
    formatCaseWorkspaceSection(
      "Evidence & Vault",
      "Keep proof, files, and reusable messaging attached to the case record.",
      [
        formatEvidenceControlStrip(lead, followUps, objections),
        formatEvidenceWorkspace({
          left: [
            formatDealProofPanel(lead),
            formatProofTrailPanel(lead)
          ],
          right: [
            formatLeadDocumentVaultPanel(lead),
            formatAssistCopyBlock("Follow-up drafts", followUps, "trigger", "message"),
            formatAssistCopyBlock("Objection replies", objections, "objection", "response")
          ]
        })
      ],
      "evidence"
    )
  ].join("");

  return `
    <article class="risk-item lead-mail-item ${summary.isUnread ? "unread" : "read"}" data-lead-mail="${esc(lead.id)}">
      <button class="lead-mail-row" type="button" data-lead-toggle="${esc(lead.id)}" aria-expanded="false">
        <span class="mail-read-dot" aria-hidden="true"></span>
        <span class="mail-cell mail-contact">
          <strong>${esc(summary.contactName)}</strong>
          <small>${esc((lead.intent || "unknown").toUpperCase())} | Score ${esc(summary.score)} | ${esc(summary.lifecycleLabel)}</small>
          <span class="mail-meta-pills">
            <span class="mail-inline-pill ${summary.referralStatus === "Referred" ? "good" : "warn"}">${esc(summary.referralStatus)}</span>
            <span class="mail-inline-pill">${esc(signal.lane)}</span>
            <span class="mail-inline-pill ${summary.duplicateSignals?.isDuplicate ? "warn" : ""}">${esc(summary.duplicateLabel)}</span>
          </span>
        </span>
        <span class="mail-cell">
          <strong>${esc(summary.location)}</strong>
          <small>${esc(summary.priceSignal)} | ${esc(summary.timeline)}</small>
          <span class="mail-ops-line">
            <span class="mail-priority-chip ${esc(summary.lifecycleClass || "active")}">${esc(signal.urgency)}</span>
            <small>${esc(signal.nextControl)}</small>
          </span>
        </span>
        <span class="mail-cell">
          <strong>${esc(signal.owner)}</strong>
          <small>${esc(summary.agentColumn)}</small>
          <span class="mail-ops-line">
            <small>${esc(signal.escalationText)}</small>
            <small>${esc(signal.readiness)}</small>
          </span>
        </span>
        <span class="mail-date">${esc(summary.received)}</span>
      </button>
      <div class="lead-mail-detail" data-lead-detail="${esc(lead.id)}" hidden>
        <div class="lead-detail-header">
          <div>
            <strong>${esc(lead.label)} (${esc((lead.intent || "unknown").toUpperCase())})</strong>
            <div class="small-note">Created: ${esc(summary.created)}</div>
          </div>
          <div class="lead-badge-row">
            <span class="risk-badge">${esc(summary.urgency)} urgency</span>
            <span class="risk-badge ${summary.lifecycleClass}">${esc(summary.lifecycleLabel)}</span>
            <span class="risk-badge ${lead.queueStatus === "closed" ? "overdue" : ""}">${esc(summary.queueStatus)}</span>
            <span class="risk-badge ${lead.referred ? "" : "at-risk"}">${esc(summary.referralStatus)}</span>
            <span class="risk-badge ${summary.duplicateSignals?.isDuplicate ? "at-risk" : ""}">${esc(summary.duplicateLabel)}</span>
          </div>
        </div>
        ${detailPanels}
      </div>
    </article>
  `;
}

async function refreshRiskQueue() {
  if (!riskLeadList || !adminToken) return;
  try {
    const response = await fetch("/api/followup-risk", { headers: adminHeaders() });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    const leads = data?.leads || [];
    if (!leads.length) {
      renderRiskCommandDeck([]);
      riskLeadList.innerHTML = `<p class="small-note">No at-risk leads right now. Great follow-up discipline.</p>`;
      return;
    }
    renderRiskCommandDeck(leads);
    riskLeadList.innerHTML = leads.map(formatRiskItem).join("");
    bindContactForms(riskLeadList, async () => {
      await refreshLeadWorkspace();
    });
  } catch {
    setAdminMessage("Admin session could not load. Please unlock again.", true);
  }
}

function bindContactForms(container, onSaved) {
  container.querySelectorAll("[data-confirm-contact]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = form.getAttribute("data-confirm-contact");
      const button = form.querySelector("button[type='submit']");
      const medium = form.querySelector("select[name='medium']")?.value || "Not specified";
      const note = form.querySelector("input[name='note']")?.value || "";
      if (!id || !button) return;
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        const response = await fetch(`/api/leads/${encodeURIComponent(id)}/contacted`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ medium, note })
        });
        if (response.ok) {
          await onSaved();
        } else {
          button.disabled = false;
          button.textContent = "Confirm Contact";
        }
      } catch {
        button.disabled = false;
        button.textContent = "Confirm Contact";
      }
    });
  });
}

function bindLeadMailRows(container) {
  container.querySelectorAll("[data-lead-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-lead-toggle");
      const detail = id ? container.querySelector(`[data-lead-detail="${CSS.escape(id)}"]`) : null;
      if (!detail) return;
      const willOpen = detail.hidden;
      detail.hidden = !willOpen;
      button.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        expandedLeadIds.add(id);
      } else {
        expandedLeadIds.delete(id);
      }
    });
  });
}

function bindLeadSortHeaders(container) {
  container.querySelectorAll("[data-lead-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.getAttribute("data-lead-sort") || "received";
      const sameField = leadColumnSort.field === field;
      leadColumnSort = {
        field,
        direction: sameField && leadColumnSort.direction === "asc" ? "desc" : "asc"
      };
      if (field === "received" && leadSort) {
        leadSort.value = leadColumnSort.direction === "asc" ? "oldest" : "latest";
      }
      refreshAgentAssist();
    });
  });
}

function restoreExpandedLeadRows(container) {
  expandedLeadIds.forEach((id) => {
    const detail = container.querySelector(`[data-lead-detail="${CSS.escape(id)}"]`);
    const button = container.querySelector(`[data-lead-toggle="${CSS.escape(id)}"]`);
    if (!detail || !button) {
      expandedLeadIds.delete(id);
      return;
    }
    detail.hidden = false;
    button.setAttribute("aria-expanded", "true");
  });
}

function hasExpandedLeadRows() {
  return Boolean(agentAssistList?.querySelector("[data-lead-detail]:not([hidden])"));
}

function formatRegisterDate(value) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatZar(value) {
  const n = toNumber(value, 0);
  if (!n) return "Not set";
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(new Error("The selected file could not be read"));
    reader.readAsDataURL(file);
  });
}

function renderRegisterRows(body, rows) {
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" class="small-note">No matching records yet.</td></tr>`;
    return;
  }
  body.innerHTML = rows.join("");
}

function formatRegisterDeskCard(label, value, note = "", tone = "") {
  return `
    <article class="register-command-card ${esc(tone)}">
      <span>${esc(label)}</span>
      <strong>${esc(value || "-")}</strong>
      ${note ? `<small>${esc(note)}</small>` : ""}
    </article>
  `;
}

function formatRegisterPill(label, tone = "") {
  return `<span class="register-inline-pill ${esc(tone)}">${esc(label)}</span>`;
}

function formatRegisterCellStack(title, subtitle = "", meta = "") {
  return `
    <div class="register-cell-stack">
      <strong>${esc(title)}</strong>
      ${subtitle ? `<small>${esc(subtitle)}</small>` : ""}
      ${meta ? `<small>${esc(meta)}</small>` : ""}
    </div>
  `;
}

function renderProtectionDeskSummary(leads = []) {
  if (!registerCommandDeck) return;
  if (!Array.isArray(leads) || !leads.length) {
    registerCommandDeck.innerHTML = "";
    if (registerCommandSummary) registerCommandSummary.textContent = "No register records match the current filter.";
    return;
  }

  const referred = leads.filter((lead) => lead?.referred || lead?.assignedAgent?.name).length;
  const exposed = leads.filter((lead) => isCommissionRiskLead(lead)).length;
  const transferActive = leads.filter((lead) => ["sale-pending", "sale-concluded"].includes(lead?.lifecycle?.code) || Number(lead?.transactionTimeline?.progress || 0) > 0).length;
  const locked = leads.filter((lead) => lead?.commissionLock?.locked).length;
  const vaultBlocked = leads.filter((lead) => Number(lead?.documentVaultSummary?.missingCount || 0) > 0).length;
  const priorityLead = leads.find((lead) => isCommissionRiskLead(lead)) || leads[0];
  const priorityName = getLeadDisplayName(priorityLead);
  const priorityAction = priorityLead?.commissionProtection?.nextAction || priorityLead?.transactionTimeline?.nextMilestone?.label || "Review commercial position";

  if (registerCommandSummary) {
    registerCommandSummary.textContent = `${priorityName} is the clearest register priority right now. ${priorityAction}.`;
  }

  const cards = [
    ["Referred cases", `${referred} live`, "Cases with a live receiving-agent relationship", referred ? "active" : ""],
    ["Commission exposure", `${exposed} open`, "Cases still missing full fee protection", exposed ? "warn" : "good"],
    ["Transfer flow", `${transferActive} active`, "Cases already moving beyond introduction", transferActive ? "active" : ""],
    ["Locked referrals", `${locked} secured`, "Cases with referral lock steps in place", locked ? "good" : "warn"],
    ["Vault blockers", `${vaultBlocked} blocked`, "Cases still waiting on required proof", vaultBlocked ? "warn" : "good"]
  ];

  registerCommandDeck.innerHTML = cards
    .map(([label, value, note, tone]) => formatRegisterDeskCard(label, value, note, tone))
    .join("");
}

function isCommissionRiskLead(lead) {
  if (!lead) return false;
  const isReferred = Boolean(lead.referred || lead.assignedAgent?.name);
  if (!isReferred) return false;
  const terms = (lead.dealProtection?.commissionAgreement || "").toLowerCase();
  const status = (lead.dealProtection?.status || "").toLowerCase();
  const noTerms = !terms || terms === "not discussed";
  const weakTerms = ["verbal", "disputed"].includes(terms);
  const weakStatus = ["disputed", "lost", "cold"].includes(status);
  return noTerms || weakTerms || weakStatus;
}

function isSalePendingLead(lead) {
  const lifecycleCode = lead?.lifecycle?.code || "";
  const dealStatus = (lead?.dealProtection?.status || "").toLowerCase();
  return lifecycleCode === "sale-pending" || ["offer pending", "under contract"].includes(dealStatus);
}

function isClosedWonLead(lead) {
  const lifecycleCode = lead?.lifecycle?.code || "";
  const dealStatus = (lead?.dealProtection?.status || "").toLowerCase();
  return lifecycleCode === "sale-concluded" || dealStatus === "closed won";
}

function getRegisterFilteredLeads(leads) {
  if (!Array.isArray(leads)) return [];
  if (activeRegisterFilter === "referred") {
    return leads.filter((lead) => Boolean(lead?.referred || lead?.assignedAgent?.name));
  }
  if (activeRegisterFilter === "commission-risk") {
    return leads.filter((lead) => isCommissionRiskLead(lead));
  }
  if (activeRegisterFilter === "sale-pending") {
    return leads.filter((lead) => isSalePendingLead(lead));
  }
  if (activeRegisterFilter === "closed-won") {
    return leads.filter((lead) => isClosedWonLead(lead));
  }
  return leads;
}

function bindRegisterFilterChips() {
  if (!registerFilterChips) return;
  registerFilterChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-register-filter]");
    if (!button || !registerFilterChips.contains(button)) return;
    activeRegisterFilter = button.getAttribute("data-register-filter") || "all";
    registerFilterChips.querySelectorAll("[data-register-filter]").forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    refreshAdminRegisters();
  });
}

async function refreshAdminRegisters() {
  if (!adminToken || !referralRegisterBody || !commissionRegisterBody || !transferRegisterBody) return;
  try {
    const response = await fetch("/api/leads/recent?limit=100&period=all&sort=latest&referral=all&dataset=live&status=all", {
      headers: adminHeaders()
    });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    const allLeads = data?.leads || [];
    const leads = getRegisterFilteredLeads(allLeads);

    if (registerSnapshotCount) registerSnapshotCount.textContent = `${leads.length} shown`;
    renderProtectionDeskSummary(leads);

    const referralRows = leads
      .filter((lead) => lead?.referred || lead?.assignedAgent?.name)
      .slice(0, 14)
      .map((lead) => {
        const slots = lead.slots || {};
        const name = getLeadDisplayName(lead);
        const area = [slots.area, slots.province].filter(Boolean).join(", ") || "Area not set";
        const agent = lead.assignedAgent?.name || "Not assigned";
        const state = lead.referred ? "Referred" : "Awaiting referral";
        const lane = lead.outcomeWorkflow?.activeTrack ? humanizeLabel(lead.outcomeWorkflow.activeTrack) : "Open routing";
        return `<tr>
          <td>${formatRegisterCellStack(name, `${(lead.intent || "unknown").toUpperCase()} case`, lane)}</td>
          <td>${formatRegisterCellStack(area, slots.priceDisplay || slots.price || "Price not captured", slots.timeline || "Timeline not captured")}</td>
          <td>${formatRegisterCellStack(agent, lead.assignedAgent?.agency || "Agency not captured", lead.assignedAgent?.phone || "No agent cellphone")}</td>
          <td>${formatRegisterPill(state, lead.referred ? "good" : "warn")}</td>
        </tr>`;
      });
    renderRegisterRows(referralRegisterBody, referralRows);

    const commissionRows = leads
      .filter((lead) => lead?.referred || lead?.dealProtection)
      .slice(0, 14)
      .map((lead) => {
        const commission = lead.commissionProtection || {};
        const referralPercent = commission.referralPercent ? `${commission.referralPercent}%` : "-";
        const expected = commission.expectedCommission ? formatZar(commission.expectedCommission) : "Not calculated";
        const status = commission.invoicePaymentStatus || commission.payoutStatus || "Not due";
        const due = commission.payoutDueDate ? formatRegisterDate(commission.payoutDueDate) : "Not set";
        const tone = commission.protected ? "good" : commission.dueState === "overdue" || status === "Disputed" ? "warn" : "active";
        return `<tr>
          <td>${formatRegisterCellStack(getLeadDisplayName(lead), lead.assignedAgent?.name || "No receiving agent yet", lead.outcome?.commercialStatusLabel || "New")}</td>
          <td>${formatRegisterPill(referralPercent, "")}</td>
          <td>${formatRegisterCellStack(expected, commission.saleValue ? `Sale value ${formatZar(commission.saleValue)}` : "Sale value not captured")}</td>
          <td>${formatRegisterPill(status, tone)}</td>
          <td>${formatRegisterCellStack(due, commission.payoutReference || commission.nextAction || "No payment reference yet")}</td>
        </tr>`;
      });
    renderRegisterRows(commissionRegisterBody, commissionRows);

    const transferRows = leads
      .filter((lead) =>
        ["with-agent", "with-agent-1-week", "with-agent-2-weeks", "with-agent-1-month", "with-agent-1-month-plus", "sale-pending", "sale-concluded"].includes(
          lead?.lifecycle?.code
        )
      )
      .slice(0, 14)
      .map((lead) => {
        const timeline = lead.transactionTimeline || {};
        const current = timeline.currentMilestone?.label || lead.lifecycle?.label || "In progress";
        const next = timeline.nextMilestone?.label || "Complete";
        const contact = lead.agentContact?.medium || "Not confirmed";
        const updated = formatRegisterDate(timeline.currentMilestone?.completedAt || lead.lifecycle?.updatedAt || lead.updatedAt || lead.createdAt);
        const progress = Number.isFinite(Number(timeline.progress)) ? `${timeline.progress}% complete` : "Progress not set";
        return `<tr>
          <td>${formatRegisterCellStack(getLeadDisplayName(lead), lead.outcome?.caseModeLabel || "Case in progress", progress)}</td>
          <td>${formatRegisterCellStack(current, lead.lifecycle?.label || "Live case")}</td>
          <td>${formatRegisterCellStack(next, `Contact: ${contact}`, timeline.nextMilestone?.owner ? `Owner: ${timeline.nextMilestone.owner}` : "")}</td>
          <td>${formatRegisterCellStack(updated, lead.dealProtection?.status || "Status not tracked")}</td>
        </tr>`;
      });
    renderRegisterRows(transferRegisterBody, transferRows);
  } catch {
    setAdminMessage("Protection Desk could not load. Please unlock Mission Control again.", true);
  }
}

async function refreshAgentAssist() {
  if (!agentAssistList || !adminToken) return;
  const requestId = ++leadAssistRequestId;
  if (leadQueueCount) leadQueueCount.textContent = "Loading...";
  try {
    const response = await fetch(`/api/leads/recent?${getLeadQueueParams()}`, { headers: adminHeaders() });
    if (response.status === 401) throw new Error("Admin password needed");
    if (!response.ok) return;
    const data = await response.json();
    if (requestId !== leadAssistRequestId) return;
    const rawLeads = data?.leads || [];
    const leads = sortLeadQueue(rawLeads);
    latestLeadQueueSnapshot = leads;
    renderFollowupControlGrid(leads);
    renderInboxCommandDeck(leads);
    const totalMatches = data?.totalMatches ?? rawLeads.length;
    if (leadQueueCount) {
      leadQueueCount.textContent = `${leads.length}${totalMatches > leads.length ? ` of ${totalMatches}` : ""} shown`;
    }
    if (!leads.length) {
      renderFollowupControlGrid([]);
      renderInboxCommandDeck([]);
      agentAssistList.innerHTML = `<p class="small-note">No leads match the current filters. Try clearing the queue filters.</p>`;
      return;
    }
    agentAssistList.innerHTML = `${formatLeadQueueHeader()}${leads.map(formatAssistItem).join("")}`;
    bindLeadSortHeaders(agentAssistList);
    restoreExpandedLeadRows(agentAssistList);
    bindLeadMailRows(agentAssistList);
    bindAgencyAutocomplete(agentAssistList);
    agentAssistList.querySelectorAll("[data-use-recommended-agent]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest(".lead-mail-detail") || button.closest(".risk-item");
        const nameInput = card?.querySelector("input[name='agentName']");
        const phoneInput = card?.querySelector("input[name='agentPhone']");
        const agencyInput = card?.querySelector("input[name='agentAgency']");
        if (nameInput) nameInput.value = button.getAttribute("data-agent-name") || "";
        if (phoneInput) phoneInput.value = button.getAttribute("data-agent-phone") || "";
        if (agencyInput) agencyInput.value = button.getAttribute("data-agent-agency") || "";
        setAdminMessage("Recommended specialist loaded into the introduction fields. Review, then save the introduction.");
      });
    });
    agentAssistList.querySelectorAll("[data-acknowledge-lead]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-acknowledge-lead");
        if (!id) return;
        button.disabled = true;
        button.textContent = "Acknowledging...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/acknowledge`, {
            method: "POST",
            headers: adminHeaders()
          });
          if (!response.ok) throw new Error("Could not acknowledge lead");
          await refreshLeadWorkspace();
        } catch {
          button.disabled = false;
          button.textContent = "Acknowledge Lead";
          setAdminMessage("Could not acknowledge this lead. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-lifecycle]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-lifecycle");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const payload = {
          stage: form.querySelector("select[name='stage']")?.value || "acknowledged",
          note: form.querySelector("input[name='note']")?.value || ""
        };
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/lifecycle`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error("Could not save pipeline stage");
          await refreshLeadWorkspace();
        } catch {
          button.disabled = false;
          button.textContent = "Save Stage";
          setAdminMessage("Could not save the pipeline stage. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-outcome-mode]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-outcome-mode");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const payload = {
          caseMode: form.querySelector("select[name='caseMode']")?.value || "undecided",
          commercialStatus: form.querySelector("select[name='commercialStatus']")?.value || "new",
          note: form.querySelector("input[name='note']")?.value || ""
        };
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/outcome`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || "Could not save outcome mode");
          }
          await refreshOperationsSuite({ analytics: true, risk: true, followups: true, registers: true, assist: true });
          setAdminMessage("Outcome mode saved.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Save Outcome Mode";
          setAdminMessage(error?.message || "Could not save outcome mode. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-deal-protection]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-deal-protection");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const payload = {
          status: form.querySelector("select[name='status']")?.value || "Active",
          commissionAgreement: form.querySelector("select[name='commissionAgreement']")?.value || "Not discussed",
          nextCheckIn: form.querySelector("input[name='nextCheckIn']")?.value || "",
          note: form.querySelector("input[name='note']")?.value || ""
        };
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/deal-protection`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            await refreshOperationsSuite({ analytics: true, followups: true, assist: true });
          } else {
            button.disabled = false;
            button.textContent = "Save Deal Status";
          }
        } catch {
          button.disabled = false;
          button.textContent = "Save Deal Status";
        }
      });
    });
    agentAssistList.querySelectorAll("[data-deal-acceptance]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-deal-acceptance");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const payload = {
          acceptedBy: (form.querySelector("input[name='acceptedBy']")?.value || "").trim(),
          via: form.querySelector("select[name='via']")?.value || "Signed form",
          note: (form.querySelector("input[name='note']")?.value || "").trim()
        };
        if (!payload.acceptedBy) {
          setAdminMessage("Please capture who accepted the referral terms.", true);
          return;
        }
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/deal-proof/acceptance`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error("Could not save referral acceptance");
          const data = await response.json();
          await refreshLeadWorkspace();
          setAdminMessage(formatStageUpdateDeliveryMessage(data?.stageUpdateDelivery, "Referral acceptance saved with timestamp."));
        } catch {
          button.disabled = false;
          button.textContent = "Confirm Referral Acceptance";
          setAdminMessage("Could not save referral acceptance. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-deal-milestone]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-deal-milestone");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const payload = {
          code: form.querySelector("select[name='code']")?.value || "agent-contacted",
          actor: (form.querySelector("input[name='actor']")?.value || "Concierge").trim(),
          via: form.querySelector("select[name='via']")?.value || "System note",
          note: (form.querySelector("input[name='note']")?.value || "").trim(),
          proofRef: (form.querySelector("input[name='proofRef']")?.value || "").trim()
        };
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/deal-proof/milestone`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (!response.ok) throw new Error("Could not save milestone");
          await refreshLeadWorkspace();
          setAdminMessage(formatStageUpdateDeliveryMessage(data?.stageUpdateDelivery, "Milestone evidence saved."));
        } catch {
          button.disabled = false;
          button.textContent = "Add Milestone Evidence";
          setAdminMessage("Could not save milestone evidence. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-deal-commission]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-deal-commission");
        const button = form.querySelector("button[type='submit']");
        if (!id || !button) return;
        const saleValueRaw = (form.querySelector("input[name='saleValue']")?.value || "").replace(/\D/g, "");
        const payload = {
          saleValue: saleValueRaw ? Number(saleValueRaw) : 0,
          referralPercent: Number(form.querySelector("input[name='referralPercent']")?.value || 12.5),
          payoutStatus: form.querySelector("select[name='payoutStatus']")?.value || "Not due",
          payoutDueDate: form.querySelector("input[name='payoutDueDate']")?.value || "",
          payoutReference: (form.querySelector("input[name='payoutReference']")?.value || "").trim(),
          note: (form.querySelector("input[name='note']")?.value || "").trim()
        };
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/deal-proof/commission`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error("Could not save commission tracker");
          await refreshLeadWorkspace();
          setAdminMessage("Commission tracker saved.");
        } catch {
          button.disabled = false;
          button.textContent = "Save Commission Tracker";
          setAdminMessage("Could not save commission tracker. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-lead-doc-upload]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-lead-doc-upload");
        const button = form.querySelector("button[type='submit']");
        const category = form.querySelector("select[name='category']")?.value || "Other";
        const note = (form.querySelector("input[name='note']")?.value || "").trim();
        const fileInput = form.querySelector("input[name='file']");
        const file = fileInput?.files?.[0];
        if (!id || !button || !file) {
          setAdminMessage("Please select a file before uploading.", true);
          return;
        }
        button.disabled = true;
        button.textContent = "Uploading...";
        try {
          const base64 = await readFileAsBase64(file);
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/documents/upload`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              category,
              note,
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              base64
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Could not upload document");
          await refreshLeadWorkspace();
          setAdminMessage("Document uploaded to vault.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Upload to Vault";
          setAdminMessage(error?.message || "Could not upload document. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-lead-doc-download]").forEach((button) => {
      button.addEventListener("click", async () => {
        const leadId = button.getAttribute("data-lead-doc-download");
        const docId = button.getAttribute("data-lead-doc-id");
        if (!leadId || !docId) return;
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = "Preparing...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(docId)}/download`, {
            headers: adminHeaders()
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || "Could not download document");
          }
          const blob = await response.blob();
          const disposition = response.headers.get("Content-Disposition") || "";
          const fallbackName = `lead-document-${docId}`;
          const matchedName = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = matchedName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          setAdminMessage("Document downloaded.");
        } catch (error) {
          setAdminMessage(error?.message || "Could not download document. Please try again.", true);
        } finally {
          button.disabled = false;
          button.textContent = oldText;
        }
      });
    });
    bindContactForms(agentAssistList, async () => {
      await refreshLeadWorkspace();
    });
    agentAssistList.querySelectorAll("[data-assign-agent]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = form.getAttribute("data-assign-agent");
        const input = form.querySelector("input[name='agentName']");
        const phoneInput = form.querySelector("input[name='agentPhone']");
        const agencyInput = form.querySelector("input[name='agentAgency']");
        const button = form.querySelector("button[type='submit']");
        const agentName = (input?.value || "").trim();
        const agentPhone = (phoneInput?.value || "").trim();
        const agentAgency = (agencyInput?.value || "").trim();
        if (!id || !agentName || !agentAgency || !button) return;
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/assign-agent`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ agentName, agentPhone, agentAgency })
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            await refreshLeadWorkspace();
            setAdminMessage(formatStageUpdateDeliveryMessage(data?.stageUpdateDelivery, "Introduction saved."));
          } else {
            button.disabled = false;
            button.textContent = "Save Introduction";
          }
        } catch {
          button.disabled = false;
          button.textContent = "Save Introduction";
        }
      });
    });
    agentAssistList.querySelectorAll("[data-agent-link], [data-agent-link-refresh]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-agent-link") || button.getAttribute("data-agent-link-refresh");
        const refresh = button.hasAttribute("data-agent-link-refresh");
        const card = button.closest(".risk-item");
        const agentName = (card?.querySelector("input[name='agentName']")?.value || "").trim();
        const agentPhone = (card?.querySelector("input[name='agentPhone']")?.value || "").trim();
        const agentAgency = (card?.querySelector("input[name='agentAgency']")?.value || "").trim();
        if (!id) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = refresh ? "Refreshing..." : "Creating...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/agent-link`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ agentName, agentPhone, agentAgency, refresh })
          });
          if (!response.ok) throw new Error("Agent link unavailable");
          const data = await response.json();
          if (data?.agentUrl) {
            await navigator.clipboard.writeText(data.agentShareText || data.agentUrl);
            setAdminMessage("Secure agent introduction copied. Send it only to the receiving agent.");
          }
          button.textContent = "Copied";
          await refreshOperationsSuite({ analytics: true, followups: true, assist: true });
        } catch {
          button.disabled = false;
          button.textContent = oldText || "Create Agent Introduction";
          setAdminMessage("Could not create or copy the agent update link. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-agent-handoff-whatsapp]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-agent-handoff-whatsapp");
        const card = button.closest(".risk-item");
        const agentName = (card?.querySelector("input[name='agentName']")?.value || "").trim();
        const agentPhone = (card?.querySelector("input[name='agentPhone']")?.value || "").trim();
        const agentAgency = (card?.querySelector("input[name='agentAgency']")?.value || "").trim();
        if (!id) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Sending...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/agent-handoff-whatsapp`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ agentName, agentPhone, agentAgency })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            if (data?.fallbackUrl) window.open(data.fallbackUrl, "_blank", "noopener");
            throw new Error(data?.error || "Agent WhatsApp introduction could not be sent");
          }
          button.textContent = "Sent";
          setAdminMessage("Agent introduction sent on WhatsApp with acknowledgement required before client work continues.");
          await refreshOperationsSuite({ analytics: true, followups: true, assist: true, whatsapp: true });
        } catch (error) {
          button.disabled = false;
          button.textContent = oldText || "Send to Agent on WhatsApp";
          setAdminMessage(error?.message || "Could not send the WhatsApp introduction to the agent.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-stakeholder-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-stakeholder-link");
        const role = button.getAttribute("data-stakeholder-role");
        if (!id || !role) return;
        const card = button.closest(".risk-item");
        const agentName = (card?.querySelector("input[name='agentName']")?.value || "").trim();
        const agentPhone = (card?.querySelector("input[name='agentPhone']")?.value || "").trim();
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/stakeholder-link`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              role,
              name: role === "agent" ? agentName : "",
              phone: role === "agent" ? agentPhone : "",
              refresh: oldText.toLowerCase().includes("copy")
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Could not prepare stakeholder link");
          await navigator.clipboard.writeText(data?.stakeholderShareText || data?.stakeholderUrl || "");
          button.textContent = "Copied";
          setAdminMessage(`${(data?.roleLabel || role)} portal link copied for sharing.`);
          await refreshOperationsSuite({ assist: true, registers: true });
        } catch {
          button.disabled = false;
          button.textContent = oldText || "Create Link";
          setAdminMessage("Could not create/copy stakeholder portal link. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-stakeholder-bulk]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-stakeholder-bulk");
        if (!id) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Creating...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/stakeholder-links/bulk`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: true })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Could not create stakeholder links");
          await navigator.clipboard.writeText(data?.sharePackText || "");
          setAdminMessage("All stakeholder links created. WhatsApp-ready share pack copied.");
          await refreshOperationsSuite({ assist: true, registers: true });
        } catch {
          button.disabled = false;
          button.textContent = oldText || "Create All Party Links";
          setAdminMessage("Could not create all stakeholder links. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-stakeholder-sharepack]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-stakeholder-sharepack");
        if (!id) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Preparing...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/stakeholder-links/bulk`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: false })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Could not prepare share pack");
          await navigator.clipboard.writeText(data?.sharePackText || "");
          button.textContent = "Copied";
          setAdminMessage("WhatsApp share pack copied. Send directly to the relevant parties.");
          await refreshOperationsSuite({ assist: true });
        } catch {
          button.disabled = false;
          button.textContent = oldText || "Copy WhatsApp Share Pack";
          setAdminMessage("Could not copy the stakeholder share pack. Please try again.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-open-handoff]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-open-handoff");
        if (!id) return;
        button.disabled = true;
        button.textContent = "Opening...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/handoff`, {
            headers: adminHeaders()
          });
          if (!response.ok) throw new Error("Introduction unavailable");
          const data = await response.json();
          if (data?.whatsappUrl) openWhatsAppUrl(data.whatsappUrl);
          button.textContent = "Opened";
          setTimeout(() => {
            button.disabled = false;
            button.textContent = "Open WhatsApp Introduction";
          }, 1400);
        } catch {
          button.disabled = false;
          button.textContent = "Open WhatsApp Introduction";
        }
      });
    });
    agentAssistList.querySelectorAll("[data-retry-delivery]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-retry-delivery");
        if (!id) return;
        button.disabled = true;
        button.textContent = "Retrying...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/retry-delivery`, {
            method: "POST",
            headers: adminHeaders()
          });
          if (response.ok) {
            await refreshOperationsSuite({ assist: true });
          } else {
            button.disabled = false;
            button.textContent = "Retry Auto Delivery";
          }
        } catch {
          button.disabled = false;
          button.textContent = "Retry Auto Delivery";
        }
      });
    });
    agentAssistList.querySelectorAll("[data-client-confirmation]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-client-confirmation");
        if (!id) return;
        button.disabled = true;
        button.textContent = "Sending...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(id)}/client-confirmation`, {
            method: "POST",
            headers: adminHeaders()
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.reason || data?.error || "Client confirmation failed");
          setAdminMessage("Client confirmation WhatsApp sent through the test bridge.");
          await refreshOperationsSuite({ whatsapp: true, assist: true });
        } catch {
          button.disabled = false;
          button.textContent = "Send Client Confirmation";
          setAdminMessage("Client confirmation could not be sent. Check that the WhatsApp Test Bridge is ready.", true);
        }
      });
    });
    agentAssistList.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.getAttribute("data-copy") || "";
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          const old = button.textContent;
          button.textContent = "Copied";
          setTimeout(() => {
            button.textContent = old || "Copy";
          }, 1000);
        } catch {
          // Ignore clipboard failures.
        }
      });
    });
    agentAssistList.querySelectorAll("[data-playbook-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        focusLeadWorkspaceTarget(button);
      });
    });
    agentAssistList.querySelectorAll("[data-stakeholder-review-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-stakeholder-review-action");
        const leadId = button.getAttribute("data-stakeholder-review-lead");
        const updateId = button.getAttribute("data-stakeholder-review-id");
        if (!action || !leadId || !updateId) return;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/stakeholder-updates/${encodeURIComponent(updateId)}/review`, {
            method: "POST",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ action })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || "Could not save concierge review");
          await refreshLeadWorkspace();
          const messageMap = {
            working: "Advisory update moved into concierge workflow.",
            reference: "Advisory update kept as reference only.",
            dismiss: "Advisory update removed from the active review queue.",
            reopen: "Advisory update re-opened for concierge review."
          };
          setAdminMessage(messageMap[action] || "Concierge review saved.");
        } catch (error) {
          button.disabled = false;
          button.textContent = oldText || "Save";
          setAdminMessage(error?.message || "Could not save the concierge review state. Please try again.", true);
        }
      });
    });
  } catch {
    setAdminMessage("Admin session could not load. Please unlock again.", true);
  }
}

document.querySelectorAll("[data-intent]").forEach((button) => {
  button.addEventListener("click", () => {
    openIntake(button.getAttribute("data-intent") || "buy");
  });
});

if (adminGate) {
  if (adminMode) showAdminGate();

  adminGate.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminToken = (adminPassword?.value || "").trim();
    if (!adminToken) {
      setAdminMessage("Enter the access key to unlock Mission Control.", true);
      return;
    }

    try {
      const response = await fetch("/api/analytics", { headers: adminHeaders() });
      if (!response.ok) throw new Error("Invalid admin password");
      sessionStorage.setItem("axiomAdminPassword", adminToken);
      unlockOperations();
      setAdminMessage("Mission Control unlocked for this browser session.");
      if (adminPassword) adminPassword.value = "";
      await refreshOperationsSuite({
        analytics: true,
        risk: true,
        followups: true,
        daily: true,
        assist: true,
        registers: true,
        whatsapp: true
      });
    } catch {
      adminToken = "";
      sessionStorage.removeItem("axiomAdminPassword");
      setAdminMessage("That key did not unlock Mission Control.", true);
    }
  });
}

if (leadFilterForm) {
  let leadSearchTimer = null;
  [leadPeriod, leadSort, leadReferral, leadDataset, leadStatus].forEach((control) => {
    control?.addEventListener("change", () => {
      if (control === leadSort) {
        leadColumnSort = {
          field: "received",
          direction: leadSort.value === "oldest" ? "asc" : "desc"
        };
      }
      refreshAgentAssist();
    });
  });
  leadSearch?.addEventListener("input", () => {
    clearTimeout(leadSearchTimer);
    leadSearchTimer = setTimeout(() => refreshAgentAssist(), 250);
  });
}

renderLeadStageTabs();
bindLeadStageTabs();
bindRegisterFilterChips();

if (clearLeadFilters) {
  clearLeadFilters.addEventListener("click", () => {
    if (leadPeriod) leadPeriod.value = "all";
    if (leadSort) leadSort.value = "latest";
    if (leadReferral) leadReferral.value = "all";
    if (leadDataset) leadDataset.value = "live";
    if (leadStatus) leadStatus.value = "all";
    if (leadSearch) leadSearch.value = "";
    activeLeadStage = "all";
    renderLeadStageTabs();
    leadColumnSort = { field: "received", direction: "desc" };
    refreshAgentAssist();
  });
}

if (startWhatsappBridge) {
  startWhatsappBridge.addEventListener("click", async () => {
    startWhatsappBridge.disabled = true;
    startWhatsappBridge.textContent = "Starting...";
    try {
      const response = await fetch("/api/whatsapp-web/start", {
        method: "POST",
        headers: adminHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not start WhatsApp bridge");
      renderWhatsAppBridgeStatus(data.whatsapp);
      setAdminMessage("WhatsApp Web test bridge started. Scan the QR code if shown.");
    } catch {
      setAdminMessage("Could not start the WhatsApp Web test bridge.", true);
    } finally {
      startWhatsappBridge.disabled = false;
      startWhatsappBridge.textContent = "Start / Refresh QR";
    }
  });
}

if (sendWhatsappBridgeTest) {
  sendWhatsappBridgeTest.addEventListener("click", async () => {
    sendWhatsappBridgeTest.disabled = true;
    sendWhatsappBridgeTest.textContent = "Sending...";
    try {
      const response = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Axiom Realty AI WhatsApp Web test alert (${new Date().toLocaleString()})` })
      });
      const data = await response.json();
      renderWhatsAppBridgeStatus(data.whatsapp);
      if (!response.ok) throw new Error(data?.result?.reason || data?.error || "Test alert failed");
      setAdminMessage("WhatsApp test alert sent to the central concierge number.");
    } catch {
      setAdminMessage("WhatsApp test alert could not be sent. Check bridge status or scan the QR code.", true);
    } finally {
      sendWhatsappBridgeTest.disabled = false;
      sendWhatsappBridgeTest.textContent = "Send Test Alert";
    }
  });
}

if (refreshWhatsappInbox) {
  refreshWhatsappInbox.addEventListener("click", async () => {
    await refreshWhatsAppInbox({ preserveSelection: true });
  });
}

if (whatsappReplyForm) {
  whatsappReplyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedCase = getSelectedWhatsappCase();
    const message = (whatsappReplyInput?.value || "").trim();
    const recipientPhone = whatsappReplyRecipient?.value || "";
    const selectedOption = whatsappReplyRecipient?.selectedOptions?.[0];
    const recipientName = selectedOption?.dataset?.name || "";
    const recipientRole = selectedOption?.dataset?.role || "";
    if (!selectedCase) {
      setAdminMessage("Choose a WhatsApp case before sending a reply.", true);
      return;
    }
    if (!recipientPhone) {
      setAdminMessage("Choose a reply recipient first.", true);
      return;
    }
    if (!message) {
      setAdminMessage("Type a WhatsApp reply before sending.", true);
      return;
    }
    if (whatsappReplyInput) whatsappReplyInput.disabled = true;
    if (whatsappReplyRecipient) whatsappReplyRecipient.disabled = true;
    try {
      const response = await fetch(`/api/whatsapp/inbox/${encodeURIComponent(selectedCase.caseId)}/reply`, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message, recipientPhone, recipientName, recipientRole })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not send WhatsApp reply");
      whatsappInboxState.cases = Array.isArray(data.inbox) ? data.inbox : whatsappInboxState.cases;
      whatsappInboxState.selectedCaseId = selectedCase.caseId;
      renderWhatsappInbox();
      if (whatsappReplyInput) whatsappReplyInput.value = "";
      const delivery = data?.result?.notification?.status || "queued";
      setAdminMessage(`WhatsApp reply saved. Delivery status: ${delivery}.`);
    } catch (error) {
      setAdminMessage(error?.message || "Could not send WhatsApp reply.", true);
    } finally {
      if (whatsappReplyInput) whatsappReplyInput.disabled = false;
      renderWhatsappThread();
    }
  });
}

function formatWhatsAppAutomationResult(data, mode = "Smart reminders") {
  const summary = data?.summary || {};
  const smart = summary.smartReminders || {};
  const delivery = summary.delivery || summary;
  const docQueued = Number(summary.queued || 0);
  const smartQueued = Number(smart.queued || 0);
  const alreadyQueued = Number(summary.alreadyQueued || 0) + Number(smart.alreadyQueued || 0);
  const escalated = Number(summary.escalated || 0) + Number(smart.escalated || 0);
  const processed = Number(delivery.processed || 0);
  const delivered = Number(delivery.delivered || 0);
  const waiting = Number(delivery.waiting || 0);
  const failed = Number(delivery.failed || 0);
  const flowEntries = Object.entries(smart.flows || {});
  const flowText = flowEntries.length
    ? ` | ${flowEntries.map(([name, count]) => `${humanizeLabel(name)} ${count}`).join(", ")}`
    : "";
  if (mode === "Queue") {
    return `Queue: ${processed} processed, ${delivered} delivered, ${waiting} waiting, ${failed} failed.`;
  }
  return `${mode}: ${docQueued} document and ${smartQueued} smart reminder${smartQueued === 1 ? "" : "s"} queued, ${alreadyQueued} already queued today${flowText}. Delivery: ${processed} processed, ${delivered} delivered, ${waiting} waiting, ${failed} failed. Escalations: ${escalated}.`;
}

if (runSmartReminders) {
  runSmartReminders.addEventListener("click", async () => {
    runSmartReminders.disabled = true;
    runSmartReminders.textContent = "Running...";
    if (smartReminderStatus) smartReminderStatus.textContent = "Running smart reminder sweep...";
    try {
      const response = await fetch("/api/whatsapp/smart-reminders/run", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ processQueue: true })
      });
      const data = await response.json();
      renderWhatsAppBridgeStatus(data.whatsapp);
      if (!response.ok) throw new Error(data?.error || "Smart reminders failed");
      const message = formatWhatsAppAutomationResult(data, "Smart reminders");
      if (smartReminderStatus) smartReminderStatus.textContent = message;
      setAdminMessage(message);
      await refreshAgentAssist();
    } catch {
      const message = "Smart reminders could not run. Check admin access and WhatsApp bridge status.";
      if (smartReminderStatus) smartReminderStatus.textContent = message;
      setAdminMessage(message, true);
    } finally {
      runSmartReminders.disabled = false;
      runSmartReminders.textContent = "Run Smart Reminders";
    }
  });
}

if (processWhatsappQueue) {
  processWhatsappQueue.addEventListener("click", async () => {
    processWhatsappQueue.disabled = true;
    processWhatsappQueue.textContent = "Processing...";
    if (smartReminderStatus) smartReminderStatus.textContent = "Processing queued WhatsApp reminders...";
    try {
      const response = await fetch("/api/whatsapp/queue/process", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ forceRetry: true })
      });
      const data = await response.json();
      renderWhatsAppBridgeStatus(data.whatsapp);
      if (!response.ok) throw new Error(data?.error || "Queue processing failed");
      const message = formatWhatsAppAutomationResult(data, "Queue");
      if (smartReminderStatus) smartReminderStatus.textContent = message;
      setAdminMessage(message);
    } catch {
      const message = "Queued WhatsApp reminders could not be processed.";
      if (smartReminderStatus) smartReminderStatus.textContent = message;
      setAdminMessage(message, true);
    } finally {
      processWhatsappQueue.disabled = false;
      processWhatsappQueue.textContent = "Process Queue";
    }
  });
}

if (logoutWhatsappBridge) {
  logoutWhatsappBridge.addEventListener("click", async () => {
    logoutWhatsappBridge.disabled = true;
    logoutWhatsappBridge.textContent = "Logging out...";
    try {
      const response = await fetch("/api/whatsapp-web/logout", {
        method: "POST",
        headers: adminHeaders()
      });
      const data = await response.json();
      renderWhatsAppBridgeStatus(data.whatsapp);
      setAdminMessage("WhatsApp Web test bridge logged out.");
    } catch {
      setAdminMessage("Could not log out the WhatsApp Web test bridge.", true);
    } finally {
      logoutWhatsappBridge.disabled = false;
      logoutWhatsappBridge.textContent = "Logout Test Bridge";
    }
  });
}

if (downloadDailyReport) {
  downloadDailyReport.addEventListener("click", () => {
    window.open("/api/concierge-daily-report?format=csv", "_blank", "noopener");
  });
}

if (expertApplicationForm) {
  expertApplicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = expertApplicationForm.querySelector("button[type='submit']");
    const formData = new FormData(expertApplicationForm);
    const payload = Object.fromEntries(formData.entries());
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }
    if (expertApplicationMessage) {
      expertApplicationMessage.classList.add("hidden");
      expertApplicationMessage.classList.remove("error-note");
    }
    try {
      const response = await fetch("/api/agent-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Application could not be sent");
      expertApplicationForm.reset();
      if (expertApplicationMessage) {
        expertApplicationMessage.textContent =
          "Thank you. We have received your application and will review whether there is a suitable referral partnership fit.";
        expertApplicationMessage.classList.remove("hidden");
      }
    } catch (error) {
      if (expertApplicationMessage) {
        expertApplicationMessage.textContent = error?.message || "Application could not be sent. Please try again.";
        expertApplicationMessage.classList.remove("hidden");
        expertApplicationMessage.classList.add("error-note");
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Apply to partner with us";
      }
    }
  });
}

intakeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  progressNote.textContent = "Saving your request and preparing the concierge introduction...";
  submitLeadBtn.disabled = true;
  submitLeadBtn.textContent = "Sending...";
  const formData = new FormData(intakeForm);
  const activeConfig = paths[activeIntent];
  const payload = getLeadPayload(formData);

  fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      if (!response.ok) {
        let details = "Lead API request failed";
        try {
          const data = await response.json();
          if (data?.error) details = data.error;
        } catch {
          // ignore parse failure
        }
        throw new Error(details);
      }
      return response.json();
    })
    .then((result) => {
      const needsManualHandoff = !result.delivered && Boolean(result.manualHandoffUrl);
      nextStepMessage.textContent = needsManualHandoff
        ? `${activeConfig.responseText} WhatsApp is opening with your brief so you can send it directly to the concierge.`
        : !result.delivered
          ? "Your request has been saved, but the WhatsApp concierge introduction is temporarily unavailable. Please try again shortly."
          : activeConfig.responseText;
      nextStepMessage.classList.remove("hidden");
      if (isAdminUnlocked()) {
        refreshAnalytics();
        refreshRiskQueue();
        refreshAgentAssist();
      }
      closeIntake();
      if (needsManualHandoff) {
        openWhatsAppUrl(result.manualHandoffUrl);
      }
    })
    .catch((error) => {
      nextStepMessage.textContent = `We could not save your request yet (${error?.message || "validation error"}). Please check your answers and try again.`;
      nextStepMessage.classList.remove("hidden");
      submitLeadBtn.disabled = false;
      submitLeadBtn.textContent = activeConfig.submitText;
    });
});

closeModal.addEventListener("click", closeIntake);

intakeOverlay.addEventListener("click", (event) => {
  if (event.target === intakeOverlay) {
    closeIntake();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !intakeOverlay.classList.contains("hidden")) {
    closeIntake();
  }
});

if (conciergeToggle && conciergePanel) {
  conciergeToggle.addEventListener("click", () => conciergePanel.classList.toggle("hidden"));
}

if (conciergeClose && conciergePanel) {
  conciergeClose.addEventListener("click", () => conciergePanel.classList.add("hidden"));
}

if (conciergeForm) {
  conciergeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = (conciergeInput?.value || "").trim();
    if (!message) return;
    appendConciergeMessage("user", message);
    conciergeInput.value = "";
    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: activeSessionId, dataMode: getAcquisitionContext().dataMode })
      });
      const data = await response.json();
      if (data?.sessionId) {
        activeSessionId = data.sessionId;
      }
      appendConciergeMessage("bot", data.reply || "Thanks, I can guide you through the next step.");
      if (
        data?.closed &&
        data?.handoff?.manualHandoffUrl &&
        data?.sessionId &&
        !openedManualHandoffSessions.has(data.sessionId)
      ) {
        openedManualHandoffSessions.add(data.sessionId);
        appendConciergeMessage("bot", "WhatsApp is opening with your brief so you can send it directly to the concierge.");
        openWhatsAppUrl(data.handoff.manualHandoffUrl);
      } else if (data?.closed && data?.handoff && !data.handoff.delivered) {
        appendConciergeMessage("bot", "Your brief has been saved, but the WhatsApp concierge introduction is temporarily unavailable. Please try again shortly.");
      }
    } catch {
      appendConciergeMessage("bot", "I could not reach the AI service right now. Please continue with the intake form.");
    }
  });
}

const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

if (adminToken) {
  unlockOperations();
  refreshOperationsSuite({
    analytics: true,
    risk: true,
    followups: true,
    daily: true,
    assist: true,
    registers: true,
    whatsapp: true
  });
}

setInterval(() => {
  if (!isAdminUnlocked()) return;
  refreshOperationsSuite({
    analytics: true,
    risk: true,
    followups: true,
    daily: true,
    assist: true,
    registers: true,
    whatsapp: true,
    skipExpandedAssist: true
  });
}, 30000);
