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
  "Agent handoff proof",
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
    label: "Buyer Lead",
    intro: "I want to Buy",
    submitText: "Find me a property expert",
    responseText:
      "Thank you. We’ve received your request and will match you with a suitable property expert.",
    questions: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
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
      {
        name: "propertyType",
        label: "Property type",
        type: "select",
        required: false,
        options: propertyTypeOptions
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
    label: "Seller Lead",
    intro: "I want to Sell",
    submitText: "Sell my property",
    responseText:
      "Thank you. We’ve received your request and will match you with a suitable property expert.",
    questions: [
      { name: "fullName", label: "Full name", type: "text", required: true },
      { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
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
        name: "propertyType",
        label: "Property type",
        type: "select",
        required: false,
        options: propertyTypeOptions
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
const analyticsSection = document.getElementById("analytics");
const riskLeadList = document.getElementById("riskLeadList");
const taskQueueList = document.getElementById("taskQueueList");
const dailyControlDate = document.getElementById("dailyControlDate");
const dailyControlSla = document.getElementById("dailyControlSla");
const dailyControlEscalations = document.getElementById("dailyControlEscalations");
const dailyControlCommissionRisk = document.getElementById("dailyControlCommissionRisk");
const dailyControlReferred = document.getElementById("dailyControlReferred");
const dailyControlContacted = document.getElementById("dailyControlContacted");
const dailyControlClosures = document.getElementById("dailyControlClosures");
const downloadDailyReport = document.getElementById("downloadDailyReport");
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
const logoutWhatsappBridge = document.getElementById("logoutWhatsappBridge");
const registerSnapshotCount = document.getElementById("registerSnapshotCount");
const registerFilterChips = document.getElementById("registerFilterChips");
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
    agentHandoff: { status: "not_started", label: "Not handed off", nextAction: "Assign a Cape Town buyer specialist and create handoff link." },
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
      nextAction: "Load the recommended specialist into the handoff fields.",
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
        manualHandoffUrl: "https://wa.me/?text=Axiom%20static%20mode%20lead%20handoff",
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
      return staticJson({ whatsappUrl: "https://wa.me/?text=Axiom%20lead%20handoff%20(static%20mode)" });
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
      agentShareText: "Axiom static agent handoff: agent-update.html?token=static",
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

  if (field.type === "select") {
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
    if (field.townLookupByProvince) {
      const listId = `${field.name}List`;
      input.setAttribute("list", listId);
      input.setAttribute("autocomplete", "off");

      const datalist = document.createElement("datalist");
      datalist.id = listId;
      wrap.appendChild(datalist);
      input.dataset.townLookup = "true";
      input.dataset.provinceField = field.provinceField || "province";
      input.dataset.listId = listId;
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
  const townInputs = container.querySelectorAll("input[data-town-lookup='true']");
  townInputs.forEach((input) => {
    const provinceFieldName = input.dataset.provinceField || "province";
    const provinceSelect = container.querySelector(`[name='${provinceFieldName}']`);
    const listId = input.dataset.listId;
    const datalist = listId ? container.querySelector(`#${listId}`) : null;
    if (!provinceSelect || !datalist) return;

    const renderMatches = (towns, term) => {
      const query = (term || "").trim().toLowerCase();
      const matches = query
        ? towns.filter((town) => town.toLowerCase().startsWith(query) || town.toLowerCase().includes(query)).slice(0, 25)
        : [];
      datalist.innerHTML = "";
      matches.forEach((town) => {
        const option = document.createElement("option");
        option.value = town;
        datalist.appendChild(option);
      });
    };

    const syncList = () => {
      const provinceValue = provinceSelect.value;
      const towns = (townsByProvince[provinceValue] || []).slice().sort((a, b) => a.localeCompare(b));
      if (input.value && !towns.includes(input.value) && !input.value.includes("(device location)")) {
        input.value = "";
      }
      renderMatches(towns, input.value);
    };

    provinceSelect.addEventListener("change", syncList);
    input.addEventListener("input", () => {
      const provinceValue = provinceSelect.value;
      const towns = (townsByProvince[provinceValue] || []).slice().sort((a, b) => a.localeCompare(b));
      renderMatches(towns, input.value);
    });
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

  intakeEyebrow.textContent = "Property request";
  intakeTitle.textContent = config.intro;
  progressNote.textContent = "Answer the essentials first. We only ask what the concierge needs to act fast.";
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

function formatTaskItem(task) {
  const statusLabel = task.status === "overdue" ? "Overdue" : task.status === "due-soon" ? "Due soon" : "Upcoming";
  const intent = (task.intent || "unknown").toUpperCase();
  return `
    <article class="task-item ${esc(task.status)} ${esc((task.priority || "Low").toLowerCase())}">
      <div class="task-main">
        <div class="task-title-row">
          <strong>${esc(task.title)}</strong>
          <span class="task-pill">${esc(task.priority || "Low")}</span>
          <span class="task-pill muted">${esc(statusLabel)}</span>
        </div>
        <div class="small-note">${esc(task.leadName)} | ${esc(intent)} | ${esc(task.area)}</div>
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
      const escalations = tasks.filter((task) => (task.title || "").toLowerCase().startsWith("escalation:")).length;
      taskQueueCount.textContent = `${tasks.length} shown | ${summary.total ?? tasks.length} active | ${escalations} escalations | ${overdue} overdue | ${dueSoon} due soon`;
      taskQueueCount.classList.toggle("overdue", overdue > 0);
      taskQueueCount.classList.toggle("at-risk", !overdue && dueSoon > 0);
    }
    if (!tasks.length) {
      taskQueueList.innerHTML = `<p class="small-note">No automatic follow-up tasks right now.</p>`;
      return;
    }
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

function formatRiskItem(lead) {
  const stateClass = lead.state === "overdue" ? "overdue" : "at-risk";
  const stateLabel = lead.state === "overdue" ? "Overdue" : "At Risk";
  const score = lead.score !== null && lead.score !== undefined ? `${lead.score}/100` : "-";
  return `
    <article class="risk-item">
      <div class="risk-topline">
        <strong>${lead.label} (${lead.intent?.toUpperCase() || "UNKNOWN"})</strong>
        <span class="risk-badge ${stateClass}">${stateLabel} - ${lead.elapsedMinutes} min</span>
      </div>
      <div class="small-note">Score: ${score} (${lead.scoreBand})</div>
      <div class="small-note">${lead.snapshot || "No snapshot available."}</div>
      ${formatContactForm(lead)}
    </article>
  `;
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

function formatContactForm(lead) {
  const contact = lead.agentContact || null;
  const contactText = contact?.contactedAt
    ? `Contact made by ${contact.medium} at ${new Date(contact.contactedAt).toLocaleString()}${contact.note ? ` - ${contact.note}` : ""}`
    : "Client contact not confirmed yet";

  return `
    <div class="small-note">Contact status: ${esc(contactText)}</div>
    <form class="contact-confirm-form" data-confirm-contact="${esc(lead.id)}">
      <label for="contact-medium-${esc(lead.id)}">Agent contacted client via</label>
      <div class="contact-confirm-grid">
        <select id="contact-medium-${esc(lead.id)}" name="medium" required>
          ${["WhatsApp", "Phone call", "Email", "SMS", "In person", "Other"]
            .map((option) => `<option value="${esc(option)}" ${contact?.medium === option ? "selected" : ""}>${esc(option)}</option>`)
            .join("")}
        </select>
        <input name="note" type="text" value="${esc(contact?.note || "")}" placeholder="Optional note" maxlength="240" />
        <button class="location-btn" type="submit">Confirm Contact</button>
      </div>
    </form>
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

function formatOutcomeModePanel(lead) {
  const outcome = lead.outcome || {};
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
      ${outcome.note ? `<div class="small-note">Outcome note: ${esc(outcome.note)}</div>` : ""}
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
            <input name="note" type="text" value="${esc(outcome.note || "")}" maxlength="500" placeholder="Why this path was chosen" />
          </label>
        </div>
        <div class="agent-assign-row">
          <button class="location-btn" type="submit">Save Outcome Mode</button>
        </div>
      </form>
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
      <form class="deal-protection-form" data-deal-protection="${esc(lead.id)}">
        <div class="deal-protection-grid">
          <label>
            Deal status
            <select name="status" required>
              ${optionList(["Active", "Viewing/valuation booked", "Offer pending", "Under contract", "Closed won", "Cold", "Lost", "Disputed"], status)}
            </select>
          </label>
          <label>
            Commission agreement
            <select name="commissionAgreement" required>
              ${optionList(["Not discussed", "Verbal", "Written", "Confirmed", "Disputed"], agreement)}
            </select>
          </label>
          <label>
            Next check-in
            <input name="nextCheckIn" type="date" value="${esc(nextCheckIn)}" />
          </label>
        </div>
        <div class="agent-assign-row">
          <input name="note" type="text" value="${esc(deal.note || "")}" placeholder="Deal note or commission protection detail" maxlength="500" />
          <button class="location-btn" type="submit">Save Deal Status</button>
        </div>
      </form>
    </div>
  `;
}

function formatCommissionProtectionPanel(lead) {
  const commission = lead.commissionProtection || {};
  const expected = commission.expectedCommission ? formatZar(commission.expectedCommission) : "Not calculated";
  const saleValue = commission.saleValue ? formatZar(commission.saleValue) : "Not captured";
  const referralPercent = commission.referralPercent ? `${commission.referralPercent}%` : "Not set";
  const dueDate = commission.payoutDueDate ? new Date(commission.payoutDueDate).toLocaleDateString() : "Not scheduled";
  const status = commission.invoicePaymentStatus || commission.payoutStatus || "Not due";
  const dueState = commission.dueState || "not-scheduled";
  const priorityClass = (commission.priority || "Low").toLowerCase();
  const protectedText = commission.protected
    ? "Referral terms and expected fee are protected."
    : commission.termsProtected
      ? "Terms are protected. Confirm fee details."
      : "Referral terms or fee details still need protection.";

  return `
    <div class="commission-protection-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Commission Protection</strong>
          <div class="small-note">${esc(protectedText)}</div>
        </div>
        <span class="match-confidence commission-state ${esc(dueState)}">${esc(status)}</span>
      </div>
      <div class="commission-summary-grid">
        <div>
          <span>Referral %</span>
          <strong>${esc(referralPercent)}</strong>
        </div>
        <div>
          <span>Expected fee</span>
          <strong>${esc(expected)}</strong>
        </div>
        <div>
          <span>Sale value</span>
          <strong>${esc(saleValue)}</strong>
        </div>
        <div>
          <span>Due date</span>
          <strong>${esc(dueDate)}</strong>
        </div>
      </div>
      <div class="next-action-card ${esc(priorityClass)}">
        <div>
          <strong>${esc(commission.nextAction || "Keep commission evidence updated.")}</strong>
          <span>${esc(commission.payoutReference ? `Reference: ${commission.payoutReference}` : "No invoice/payment reference captured yet.")}</span>
        </div>
        <em>${esc(commission.priority || "Low")}</em>
      </div>
      ${commission.note ? `<div class="small-note">Commission note: ${esc(commission.note)}</div>` : ""}
    </div>
  `;
}

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

function formatStageUpdatePanel(lead) {
  const items = Array.isArray(lead.stageUpdateNotifications) ? lead.stageUpdateNotifications : [];
  if (!items.length) return "";
  return `
    <div class="proof-trail-panel">
      <strong>WhatsApp stage updates</strong>
      <div class="small-note">Automatic customer and stakeholder updates sent when the stage changes.</div>
      ${items
        .map((item) => {
          const stamp = item.at ? new Date(item.at).toLocaleString() : "Not sent";
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
              ${esc(stamp)} | ${esc(item.label || "Stage update")} | ${esc(`${delivered}/${attempted} delivered`)}${failed ? ` | ${esc(`${failed} failed`)}` : ""}
              ${item.note ? `<br />${esc(item.note)}` : ""}
              ${targets ? `<br />${esc(targets)}` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
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
      ${
        milestones.length
          ? `<div class="deal-proof-history">
              ${milestones
                .slice()
                .reverse()
                .map(
                  (item) => `
                    <div class="small-note">
                      ${esc(new Date(item.completedAt).toLocaleString())} - ${esc(item.label)}${item.actor ? ` - ${esc(item.actor)}` : ""}${item.note ? ` - ${esc(item.note)}` : ""}${item.proofRef ? ` - ${esc(item.proofRef)}` : ""}
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function formatLeadDocumentVaultPanel(lead) {
  const documents = Array.isArray(lead.leadDocuments) ? lead.leadDocuments : [];
  const requiredDocs = Array.isArray(lead.requiredLeadDocuments) ? lead.requiredLeadDocuments : [];
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const reminderLog = Array.isArray(lead.documentReminderLog) ? lead.documentReminderLog : [];
  const coreFolders = ["FICA", "Offer to Purchase (OTP)", "Certificates", "Proof of payment", "Compliance documents"];
  const hasFolderDoc = (label) =>
    documents.some((doc) => {
      const haystack = `${doc.category || ""} ${doc.originalName || ""} ${doc.note || ""}`.toLowerCase();
      const aliases = {
        FICA: ["fica", "identity", "proof of address"],
        "Offer to Purchase (OTP)": ["offer to purchase", "otp", "signed offer"],
        Certificates: ["certificate", "coc", "clearance"],
        "Proof of payment": ["proof of payment", "payment proof", "pop"],
        "Compliance documents": ["compliance", "coc"]
      }[label] || [label];
      return aliases.some((alias) => haystack.includes(alias.toLowerCase()));
    });
  return `
    <div class="lead-doc-vault">
      <strong>Document vault</strong>
      <div class="small-note">Secure storage for FICA, OTP, certificates, proof of payment, and compliance documents.</div>
      ${
        requiredDocs.length
          ? `<div class="small-note">Required now: ${esc(requiredDocs.join(", "))}</div>`
          : `<div class="small-note">Required documents will appear automatically as the deal advances.</div>`
      }
      ${
        missingDocs.length
          ? `<div class="small-note error-note">Still missing: ${esc(missingDocs.join(", "))}</div>`
          : `<div class="small-note">No currently required documents are missing.</div>`
      }
      <div class="vault-category-grid">
        ${coreFolders
          .map((label) => {
            const ready = hasFolderDoc(label);
            return `
              <div class="vault-category ${ready ? "ready" : "pending"}">
                <strong>${esc(label)}</strong>
                <span>${ready ? "Stored" : "Pending"}</span>
              </div>
            `;
          })
          .join("")}
      </div>
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
      ${
        reminderLog.length
          ? `<div class="deal-proof-history">
              ${reminderLog
                .map(
                  (item) => `
                    <div class="vault-item">
                      <div>
                        <strong>Reminder sent ${esc(item.at ? new Date(item.at).toLocaleString() : "recently")}</strong>
                        <small>${esc((item.missingDocs || []).join(", ") || "Missing docs")}</small>
                        <small>${esc(`${item.delivered || 0}/${item.attempted || 0} delivered`)}</small>
                      </div>
                    </div>`
                )
                .join("")}
            </div>`
          : `<div class="small-note">No automatic missing-document reminders sent yet.</div>`
      }
      ${
        documents.length
          ? `<div class="deal-proof-history">
              ${documents
                .map(
                  (doc) => `
                    <div class="vault-item">
                      <div>
                        <strong>${esc(doc.category || "Document")}</strong>
                        <small>${esc(doc.originalName || "file")} | ${esc(Math.ceil((doc.size || 0) / 1024))} KB | ${esc(new Date(doc.uploadedAt).toLocaleString())}</small>
                        ${doc.note ? `<small>${esc(doc.note)}</small>` : ""}
                      </div>
                      <button class="location-btn ghost-action" type="button" data-lead-doc-download="${esc(lead.id)}" data-lead-doc-id="${esc(doc.id)}">Download</button>
                    </div>`
                )
                .join("")}
            </div>`
          : `<div class="small-note">No files uploaded yet.</div>`
      }
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
  const updates = Array.isArray(lead.agentUpdates) ? lead.agentUpdates.slice().reverse() : [];

  return `
    <div class="agent-link-panel">
      <div>
        <div class="agent-match-topline">
          <div>
            <strong>Agent Handoff</strong>
            <div class="small-note">${esc(handoff.nextAction || "Create the secure handoff link and track agent acceptance.")}</div>
          </div>
          <span class="match-confidence handoff-status ${esc(handoff.status || "not_started")}">${esc(handoff.label || "Not handed off")}</span>
        </div>
        <div class="small-note">Status: ${isActive ? "Active" : "Not active"} | Created: ${esc(created)} | Expires: ${esc(expires)}</div>
        <div class="small-note">${esc(acknowledged)} | ${esc(viewed)}</div>
        <div class="small-note">Agent must acknowledge that the 12,5% referral commission is payable only after a successful sale resulting from the introduction.</div>
      </div>
      ${
        gates.length
          ? `<div class="handoff-gate-grid">
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
            </div>`
          : ""
      }
      <div class="risk-actions">
        <button class="location-btn" type="button" data-agent-link="${esc(lead.id)}">${isActive ? "Copy Agent Handoff" : "Create Agent Handoff"}</button>
        ${isActive ? `<button class="location-btn ghost-action" type="button" data-agent-link-refresh="${esc(lead.id)}">Refresh Secure Link</button>` : ""}
      </div>
      ${
        updates.length
          ? `<div class="agent-update-log">
              <strong>Latest agent updates</strong>
              ${updates
                .map(
                  (item) => `
                    <div class="small-note">
                      ${esc(new Date(item.at).toLocaleString())} - ${esc(item.agentName || "Agent")} - ${esc(item.status || "Update")} - ${esc(item.commissionAgreement || "No commission status")}${item.note ? ` - ${esc(item.note)}` : ""}
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function formatStakeholderPortalPanel(lead) {
  const access = lead.stakeholderAccess || {};
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates.slice().reverse().slice(0, 5) : [];
  const roles = [
    { role: "buyer", label: "Buyer", purpose: "Purchase status, finance readiness and signing updates" },
    { role: "seller", label: "Seller", purpose: "Sale status, compliance tasks and handover readiness" },
    { role: "agent", label: "Agent", purpose: "Client contact, offer movement and referral evidence" },
    { role: "attorney", label: "Attorney", purpose: "Transfer instruction, lodgement and registration updates" },
    { role: "bond-originator", label: "Bond Originator", purpose: "Bond application, approval conditions and guarantees" }
  ];
  return `
    <div class="agent-link-panel">
      <div>
        <strong>Stakeholder Portals</strong>
        <div class="small-note">Secure role-specific links for buyer, seller, agent, attorney, and bond originator.</div>
      </div>
      <div class="risk-actions left-actions">
        <button class="location-btn" type="button" data-stakeholder-bulk="${esc(lead.id)}">Create All Party Links</button>
        <button class="location-btn ghost-action" type="button" data-stakeholder-sharepack="${esc(lead.id)}">Copy WhatsApp Share Pack</button>
      </div>
      <div class="stakeholder-link-grid">
        ${roles
          .map((item) => {
            const entry = access[item.role] || null;
            const active = Boolean(entry?.active);
            const meta = active
              ? `Active${entry?.expiresAt ? ` | Expires ${new Date(entry.expiresAt).toLocaleDateString()}` : ""}`
              : "Not active";
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
          })
          .join("")}
      </div>
      ${
        updates.length
          ? `<div class="agent-update-log">
              <strong>Latest stakeholder updates</strong>
              ${updates
                .map(
                  (item) => `
                    <div class="small-note">
                      ${esc(new Date(item.at).toLocaleString())} - ${esc(item.roleLabel || item.role || "Stakeholder")} - ${esc(item.note || "")}
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function formatAgentMatchPanel(lead) {
  const match = lead.agentMatch || null;
  if (!match) return "";
  const agent = match.agent || {};
  const confidence = Number.isFinite(Number(match.confidence)) ? Number(match.confidence) : 0;
  const reasons = Array.isArray(match.reasons) ? match.reasons : [];
  const cautions = Array.isArray(match.cautions) ? match.cautions : [];
  const alternatives = Array.isArray(match.alternatives) ? match.alternatives : [];
  const canUseRecommendation = Boolean(match.available && agent.name);
  const metrics = agent.metrics || {};
  const metricsBits = [
    Number.isFinite(metrics.priorAssignments) ? `${metrics.priorAssignments} prior handoff${metrics.priorAssignments === 1 ? "" : "s"}` : "",
    Number.isFinite(metrics.hotLeadAssignments) && metrics.hotLeadAssignments > 0
      ? `${metrics.hotLeadAssignments} hot lead${metrics.hotLeadAssignments === 1 ? "" : "s"}`
      : "",
    Number.isFinite(metrics.averageResponseMinutes) ? `avg contact ${metrics.averageResponseMinutes} min` : ""
  ].filter(Boolean);

  return `
    <div class="agent-match-panel ${match.available ? "" : "empty"}">
      <div class="agent-match-topline">
        <div>
          <strong>Recommended specialist</strong>
          <div class="small-note">${esc(match.recommendation || "No recommendation yet")}</div>
        </div>
        <span class="match-confidence">${esc(confidence)}% confidence</span>
      </div>
      <div class="small-note">${esc(match.nextAction || "Review the lead and select the best available property specialist.")}</div>
      ${
        agent.name
          ? `<div class="match-agent-card">
              <span>${esc(agent.name)}</span>
              <small>${esc([agent.agency, agent.phone, agent.email].filter(Boolean).join(" | ") || "Details not captured")}</small>
              ${metricsBits.length ? `<small>${esc(metricsBits.join(" | "))}</small>` : ""}
            </div>`
          : ""
      }
      <div class="match-grid">
        <div>
          <span class="match-label">Why this match</span>
          ${reasons.map((reason) => `<div class="small-note">- ${esc(reason)}</div>`).join("") || `<div class="small-note">No strong match signals yet.</div>`}
        </div>
        <div>
          <span class="match-label">Check before handoff</span>
          ${cautions.map((item) => `<div class="small-note">- ${esc(item)}</div>`).join("") || `<div class="small-note">No cautions flagged.</div>`}
        </div>
      </div>
      ${
        alternatives.length
          ? `<div class="small-note">Alternatives: ${alternatives
              .map((item) => `${esc(item.name)}${item.agency ? ` (${esc(item.agency)})` : ""} - ${esc(item.confidence)}%`)
              .join(" | ")}</div>`
          : ""
      }
      ${
        canUseRecommendation
          ? `<div class="risk-actions left-actions">
              <button
                class="location-btn ghost-action"
                type="button"
                data-use-recommended-agent
                data-agent-name="${esc(agent.name)}"
                data-agent-phone="${esc(agent.phone || "")}"
                data-agent-agency="${esc(agent.agency || "")}"
              >Use Recommended Specialist</button>
            </div>`
          : ""
      }
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
      <div class="agent-match-topline">
        <div>
          <strong>Duplicate lead signal</strong>
          <div class="small-note">${esc(signals.recommendation || "Potential duplicate detected.")}</div>
        </div>
        <span class="match-confidence duplicate-confidence ${esc(level)}">${esc(signals.confidence || 0)}% confidence</span>
      </div>
      ${
        matches.length
          ? `<div class="followup-action-list">
              ${matches
                .map(
                  (item) => `
                    <div class="followup-action ${esc(level)}">
                      <div>
                        <strong>${esc(item.id)}</strong>
                        <span>${esc(item.fullName || "Name not captured")} | ${esc((item.intent || "unknown").toUpperCase())} | ${esc(item.area || "Area not captured")}</span>
                        <small>${esc((item.reasons || []).join(" | "))}</small>
                      </div>
                      <em>${esc(item.score)}%</em>
                    </div>`
                )
                .join("")}
            </div>`
          : `<div class="small-note">No matching lead IDs available yet.</div>`
      }
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

  return `
    <div class="intake-intel-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Intake intelligence</strong>
          <div class="small-note">${esc(intelligence.summary || "Lead capture quality and routing readiness.")}</div>
        </div>
        <span class="match-confidence intake-priority ${esc(priorityClass)}">${esc(intelligence.captureScore ?? 0)}% capture</span>
      </div>
      <div class="next-action-card ${esc(priorityClass)}">
        <div>
          <strong>${esc(intelligence.routeReadiness || "Review intake")}</strong>
          <span>${esc(intelligence.quality || "Unknown")} quality | ${esc(intelligence.capturedSignals ?? 0)} of ${esc(intelligence.totalSignals ?? 0)} signals captured</span>
        </div>
        <em>${esc(intelligence.priority || "Low")}</em>
      </div>
      ${
        missingCritical.length || missingEnrichment.length
          ? `<div class="followup-action-list">
              ${
                missingCritical.length
                  ? `<div class="followup-action high">
                      <div>
                        <strong>Critical gaps</strong>
                        <span>${esc(missingCritical.join(", "))}</span>
                      </div>
                      <em>Fix</em>
                    </div>`
                  : ""
              }
              ${
                missingEnrichment.length
                  ? `<div class="followup-action medium">
                      <div>
                        <strong>Enrichment gaps</strong>
                        <span>${esc(missingEnrichment.join(", "))}</span>
                      </div>
                      <em>Improve</em>
                    </div>`
                  : ""
              }
            </div>`
          : ""
      }
      ${
        actions.length
          ? `<div class="followup-action-list">
              ${actions
                .map(
                  (item) => `
                    <div class="followup-action ${esc((item.priority || "Low").toLowerCase())}">
                      <div>
                        <strong>${esc(item.label || "Action")}</strong>
                        <span>${esc(item.detail || "")}</span>
                      </div>
                      <em>${esc(item.priority || "Low")}</em>
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
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
      <div class="agent-match-topline">
        <div>
          <strong>Follow-up intelligence</strong>
          <div class="small-note">${esc(intelligence.reason || "Recommended next action based on lead status.")}</div>
        </div>
        <span class="match-confidence followup-priority ${esc(priorityClass)}">${esc(intelligence.primary || "Check back in 24 hours")}</span>
      </div>
      ${
        nextBestAction
          ? `<div class="next-action-card ${esc(nextPriorityClass)}">
              <div>
                <strong>Next best action: ${esc(nextBestAction.title || "Check back in 24 hours")}</strong>
                <span>${esc(nextBestAction.reason || "")}</span>
              </div>
              <em>${esc(nextBestAction.priority || "Low")}</em>
            </div>`
          : ""
      }
      <div class="followup-action-list">
        ${suggestions
          .map(
            (item) => `
              <div class="followup-action ${esc((item.priority || "Low").toLowerCase())}">
                <div>
                  <strong>${esc(item.label)}</strong>
                  <span>${esc(item.reason || "")}</span>
                  ${item.detail ? `<small>${esc(item.detail)}</small>` : ""}
                </div>
                <em>${esc(item.priority || "Low")}</em>
              </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function formatEscalationPanel(lead) {
  const flags = Array.isArray(lead.escalationFlags) ? lead.escalationFlags : [];
  if (!flags.length) return "";
  const categories = [...new Set(flags.map((flag) => flag.category).filter(Boolean))];
  return `
    <div class="escalation-panel">
      <div class="agent-match-topline">
        <div>
          <strong>Escalation Engine</strong>
          <div class="small-note">Monitors no contact, no update, missing docs, and delayed transfer.</div>
        </div>
        <span class="match-confidence followup-priority high">${esc(flags.length)} active</span>
      </div>
      ${categories.length ? `<div class="small-note">Active rules: ${esc(categories.join(" | "))}</div>` : ""}
      <div class="followup-action-list">
        ${flags
          .map(
            (flag) => `
              <div class="followup-action high">
                <div>
                  <strong>${esc(flag.category ? `${flag.category}: ${flag.title || "Escalation"}` : flag.title || "Escalation")}</strong>
                  <span>${esc(flag.reason || "")}</span>
                  ${flag.nextAction ? `<small>Next action: ${esc(flag.nextAction)}</small>` : ""}
                  ${
                    Array.isArray(flag.missingDocuments) && flag.missingDocuments.length
                      ? `<small>Missing: ${esc(flag.missingDocuments.join(", "))}</small>`
                      : ""
                  }
                  ${flag.dueAt ? `<small>Due: ${esc(new Date(flag.dueAt).toLocaleString())}</small>` : ""}
                </div>
                <em>${esc(flag.priority || "High")}</em>
              </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function formatProofTrailPanel(lead) {
  const events = Array.isArray(lead.proofTrail) ? lead.proofTrail.slice().reverse() : [];
  return `
    <div class="proof-trail-panel">
      <strong>Proof trail</strong>
      <div class="small-note">Append-only event history for audit and commission protection.</div>
      ${
        events.length
          ? events
              .map(
                (event) => `
                  <div class="small-note proof-item">
                    ${esc(new Date(event.at).toLocaleString())} | ${esc(event.actor || "System")} | ${esc(event.summary || event.type || "Update")} | Hash: ${esc((event.hash || "").slice(0, 10))}
                  </div>`
              )
              .join("")
          : `<div class="small-note">No audit events captured yet.</div>`
      }
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

function formatLeadQueueHeader() {
  const headers = [
    { field: "name", label: "Lead name" },
    { field: "area", label: "Area" },
    { field: "agent", label: "Agent" },
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

function formatAssistItem(lead) {
  const scoring = lead.scoring || {};
  const urgency = scoring.urgency || "-";
  const likelihood = scoring.closeLikelihood || "-";
  const score = scoring.score !== null && scoring.score !== undefined ? `${scoring.score}/100` : "-";
  const followUps = Array.isArray(lead.followUpPlaybook) ? lead.followUpPlaybook : [];
  const objections = Array.isArray(lead.objectionPlaybook) ? lead.objectionPlaybook : [];
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

  return `
    <article class="risk-item lead-mail-item ${isUnread ? "unread" : "read"}" data-lead-mail="${esc(lead.id)}">
      <button class="lead-mail-row" type="button" data-lead-toggle="${esc(lead.id)}" aria-expanded="false">
        <span class="mail-read-dot" aria-hidden="true"></span>
        <span class="mail-cell mail-contact">
          <strong>${esc(contactName)}</strong>
          <small>${esc((lead.intent || "unknown").toUpperCase())} | ${esc(urgency)} urgency | Score ${esc(score)}</small>
        </span>
        <span class="mail-cell">
          <strong>${esc(location)}</strong>
          <small>${esc(priceSignal)} | ${esc(timeline)}</small>
        </span>
        <span class="mail-cell">
          <strong>${esc(agentColumn)}</strong>
          <small>${esc(assignedAgent?.phone || "No agent cellphone")}</small>
        </span>
        <span class="mail-date">${esc(received)}</span>
      </button>
      <div class="lead-mail-detail" data-lead-detail="${esc(lead.id)}" hidden>
        <div class="lead-detail-header">
          <div>
            <strong>${esc(lead.label)} (${esc((lead.intent || "unknown").toUpperCase())})</strong>
            <div class="small-note">Created: ${esc(created)}</div>
          </div>
          <div class="lead-badge-row">
            <span class="risk-badge">${esc(urgency)} urgency</span>
            <span class="risk-badge ${lifecycleClass}">${esc(lifecycleLabel)}</span>
            <span class="risk-badge ${lead.queueStatus === "closed" ? "overdue" : ""}">${esc(queueStatus)}</span>
            <span class="risk-badge ${lead.referred ? "" : "at-risk"}">${esc(referralStatus)}</span>
            <span class="risk-badge ${duplicateSignals?.isDuplicate ? "at-risk" : ""}">${esc(duplicateLabel)}</span>
          </div>
        </div>
        <div class="small-note">Score: ${esc(score)} | Close likelihood: ${esc(likelihood)}</div>
        <div class="small-note">${esc(lead.copilot?.snapshot || "No snapshot available.")}</div>
        <div class="small-note">Automatic acknowledgement: ${esc(autoAcknowledgementText)}</div>
        <div class="small-note">Delivery: ${esc(deliveryText)}</div>
        <div class="small-note">Client confirmation: ${esc(confirmationText)}</div>
        <div class="small-note">Agent handoff: ${esc(assignedText)}</div>
        <div class="small-note">Acquisition source: ${esc(acquisitionText)}</div>
        ${formatIntakeIntelligencePanel(lead)}
        ${formatDuplicateSignalsPanel(lead)}
        ${formatFollowUpIntelligencePanel(lead)}
        ${formatEscalationPanel(lead)}
        ${formatAgentMatchPanel(lead)}
        ${formatOutcomeModePanel(lead)}
        ${formatLifecycleForm(lead)}
        <div class="risk-actions">
          <button class="location-btn" type="button" data-open-handoff="${esc(lead.id)}">Open WhatsApp Handoff</button>
          <button class="location-btn" type="button" data-client-confirmation="${esc(lead.id)}">Send Client Confirmation</button>
          ${delivery.delivered ? "" : `<button class="location-btn" type="button" data-retry-delivery="${esc(lead.id)}">Retry Auto Delivery</button>`}
        </div>
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
            <button class="location-btn" type="submit">Save Handoff</button>
          </div>
        </form>
        ${formatAgentLinkPanel(lead)}
        ${formatStakeholderPortalPanel(lead)}
        ${formatContactForm(lead)}
        ${formatDealProtectionForm(lead)}
        ${formatCommissionProtectionPanel(lead)}
        ${formatTransactionTimelinePanel(lead)}
        ${formatStageUpdatePanel(lead)}
        ${formatDealProofPanel(lead)}
        ${formatLeadDocumentVaultPanel(lead)}
        ${formatProofTrailPanel(lead)}
        <div class="assist-block">
          <strong>Follow-up drafts</strong>
          ${followUps
            .map(
              (f) => `
            <div class="assist-line">
              <span>${esc(f.trigger)}: ${esc(f.message)}</span>
              <button class="location-btn copy-btn" type="button" data-copy="${esc(f.message)}">Copy</button>
            </div>`
            )
            .join("")}
        </div>
        <div class="assist-block">
          <strong>Objection replies</strong>
          ${objections
            .map(
              (o) => `
            <div class="assist-line">
              <span>${esc(o.objection)}: ${esc(o.response)}</span>
              <button class="location-btn copy-btn" type="button" data-copy="${esc(o.response)}">Copy</button>
            </div>`
            )
            .join("")}
        </div>
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
      riskLeadList.innerHTML = `<p class="small-note">No at-risk leads right now. Great follow-up discipline.</p>`;
      return;
    }
    riskLeadList.innerHTML = leads.map(formatRiskItem).join("");
    bindContactForms(riskLeadList, async () => {
      await refreshAnalytics();
      await refreshRiskQueue();
      await refreshFollowUpTasks();
      await refreshAgentAssist();
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

    const referralRows = leads
      .filter((lead) => lead?.referred || lead?.assignedAgent?.name)
      .slice(0, 14)
      .map((lead) => {
        const slots = lead.slots || {};
        const name = getLeadDisplayName(lead);
        const area = [slots.area, slots.province].filter(Boolean).join(", ") || "Area not set";
        const agent = lead.assignedAgent?.name || "Not assigned";
        const state = lead.referred ? "Referred" : "Awaiting referral";
        return `<tr><td>${esc(name)}</td><td>${esc(area)}</td><td>${esc(agent)}</td><td>${esc(state)}</td></tr>`;
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
        return `<tr><td>${esc(getLeadDisplayName(lead))}</td><td>${esc(referralPercent)}</td><td>${esc(expected)}</td><td>${esc(status)}</td><td>${esc(due)}</td></tr>`;
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
        return `<tr><td>${esc(getLeadDisplayName(lead))}</td><td>${esc(current)}</td><td>${esc(next)} / ${esc(contact)}</td><td>${esc(updated)}</td></tr>`;
      });
    renderRegisterRows(transferRegisterBody, transferRows);
  } catch {
    setAdminMessage("Registers could not load. Please unlock Operations again.", true);
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
    const totalMatches = data?.totalMatches ?? rawLeads.length;
    if (leadQueueCount) {
      leadQueueCount.textContent = `${leads.length}${totalMatches > leads.length ? ` of ${totalMatches}` : ""} shown`;
    }
    if (!leads.length) {
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
        setAdminMessage("Recommended specialist loaded into the handoff fields. Review, then save the handoff.");
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAdminRegisters();
          await refreshAgentAssist();
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
            await refreshAnalytics();
            await refreshFollowUpTasks();
            await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
          await refreshAnalytics();
          await refreshRiskQueue();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
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
      await refreshAnalytics();
      await refreshRiskQueue();
      await refreshFollowUpTasks();
      await refreshAgentAssist();
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
            await refreshAnalytics();
            await refreshRiskQueue();
            await refreshFollowUpTasks();
            await refreshAgentAssist();
            setAdminMessage(formatStageUpdateDeliveryMessage(data?.stageUpdateDelivery, "Handoff saved."));
          } else {
            button.disabled = false;
            button.textContent = "Save Handoff";
          }
        } catch {
          button.disabled = false;
          button.textContent = "Save Handoff";
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
            setAdminMessage("Secure agent handoff copied. Send it only to the receiving agent.");
          }
          button.textContent = "Copied";
          await refreshAnalytics();
          await refreshFollowUpTasks();
          await refreshAgentAssist();
        } catch {
          button.disabled = false;
          button.textContent = oldText || "Create Agent Handoff";
          setAdminMessage("Could not create or copy the agent update link. Please try again.", true);
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
          await refreshAgentAssist();
          await refreshAdminRegisters();
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
          await refreshAgentAssist();
          await refreshAdminRegisters();
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
          await refreshAgentAssist();
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
          if (!response.ok) throw new Error("Handoff unavailable");
          const data = await response.json();
          if (data?.whatsappUrl) openWhatsAppUrl(data.whatsappUrl);
          button.textContent = "Opened";
          setTimeout(() => {
            button.disabled = false;
            button.textContent = "Open WhatsApp Handoff";
          }, 1400);
        } catch {
          button.disabled = false;
          button.textContent = "Open WhatsApp Handoff";
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
            await refreshAgentAssist();
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
          await refreshWhatsAppBridgeStatus();
          await refreshAgentAssist();
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
      setAdminMessage("Enter the admin password to unlock operations.", true);
      return;
    }

    try {
      const response = await fetch("/api/analytics", { headers: adminHeaders() });
      if (!response.ok) throw new Error("Invalid admin password");
      sessionStorage.setItem("axiomAdminPassword", adminToken);
      unlockOperations();
      setAdminMessage("Operations unlocked for this browser session.");
      if (adminPassword) adminPassword.value = "";
      await refreshAnalytics();
      await refreshRiskQueue();
      await refreshFollowUpTasks();
      await refreshDailyControlPanel();
      await refreshAgentAssist();
      await refreshAdminRegisters();
      await refreshWhatsAppBridgeStatus();
    } catch {
      adminToken = "";
      sessionStorage.removeItem("axiomAdminPassword");
      setAdminMessage("That password did not unlock Operations Intelligence.", true);
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
  progressNote.textContent = "Saving your request and preparing the concierge handoff...";
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
          ? "Your request has been saved, but the WhatsApp concierge handoff is temporarily unavailable. Please try again shortly."
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
        appendConciergeMessage("bot", "Your brief has been saved, but the WhatsApp concierge handoff is temporarily unavailable. Please try again shortly.");
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
  refreshAnalytics();
  refreshRiskQueue();
  refreshFollowUpTasks();
  refreshDailyControlPanel();
  refreshAgentAssist();
  refreshAdminRegisters();
  refreshWhatsAppBridgeStatus();
}

setInterval(() => {
  if (!isAdminUnlocked()) return;
  refreshAnalytics();
  refreshRiskQueue();
  refreshFollowUpTasks();
  refreshDailyControlPanel();
  if (!hasExpandedLeadRows()) {
    refreshAgentAssist();
  }
  refreshAdminRegisters();
  refreshWhatsAppBridgeStatus();
}, 30000);
