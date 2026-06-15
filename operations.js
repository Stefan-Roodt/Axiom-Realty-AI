const state = {
  role: "concierge",
  activeCase: "AX-1048",
  caseFilter: "all",
  docFilter: "all",
  search: "",
  simulatedMilestone: 0,
  resolvedItems: [],
  notifications: [],
  escalations: [],
  priorities: [],
  cases: [],
  documents: [],
  timeline: {},
  activities: [],
  sessionUser: null,
  uploadDocumentId: null,
  automation: {},
  automationStatus: null,
  playbooks: [],
  workflowRuns: {},
  playbookCaseId: null,
  playbookMilestoneId: null,
  identities: [],
  accessLinks: [],
  pendingOtpChallengeId: null,
  dailyBrief: null,
  recoveryPlans: {},
  recoveryCaseId: null,
  studioLastAccessUrl: "",
  studioLastAccessLinkId: "",
  studioLastAccessQrDataUrl: "",
  lastPhase2Summary: null
};

const roleProfiles = {
  concierge: { title: "Concierge Command Centre", avatar: "SC", welcome: "Good evening, Stefan. Here is where your operation needs attention.", body: "AI is monitoring 48 active journeys, 164 document obligations and 23 partner actions across your property pipeline.", metrics: [["48","Active journeys","+8 this week"],["7","Need attention","2 require a human touch","warn"],["94%","On-time actions","+11% with automation"],["12","AI escalations","4 legal or pricing-sensitive","warn"]] },
  seller: { title: "My Sale Journey", avatar: "JB", welcome: "Good evening, Johan. Your property is nearly ready to launch.", body: "Everything is on track. There is one FICA document still needed today before your agent can complete the market launch pack.", metrics: [["58%","Journey complete","Next: certified ID"],["1","Document outstanding","Due today","warn"],["Elize","Your area specialist","Parys residential"],["3 Jun","Next milestone","Listing goes live"]] },
  buyer: { title: "My Buying Journey", avatar: "NM", welcome: "Good evening, Naledi. Let us keep your home search moving.", body: "Your buying brief is complete. Upload your latest payslip tomorrow so your finance partner can finalise the bond pre-check.", metrics: [["32%","Journey complete","Bond pre-approval"],["1","Document outstanding","Due tomorrow","warn"],["Thabo","Your property expert","Sandton sectional title"],["4","Matches curated","Ready for review"]] },
  agent: { title: "Agent Workbench", avatar: "EV", welcome: "Good evening, Elize. Your assigned journeys are up to date.", body: "AI has prepared follow-ups and client summaries. One seller needs a personal nudge before the market launch pack is complete.", metrics: [["9","Active clients","3 seller · 6 buyer"],["1","Follow-up due","Johan Botha today","warn"],["47m","Average response","Inside 2-hour SLA"],["94%","Update compliance","+7% this month"]] },
  attorney: { title: "Transfer Partner Workspace", avatar: "VM", welcome: "Good evening. Your transfer milestones are visible to the right people.", body: "Clients receive plain-language updates while your team keeps control of legal milestones and outstanding signatures.", metrics: [["11","Active transfers","3 lodged"],["2","Actions due","Rates clearance leads","warn"],["92%","On-time updates","Across transfer cases"],["4","Documents uploaded","Awaiting legal review"]] },
  finance: { title: "Finance Partner Workspace", avatar: "OB", welcome: "Good evening. Home-loan actions are connected to each property journey.", body: "Applicants know which finance document is outstanding and receive reminders before a missing item stalls the application.", metrics: [["8","Applications active","3 pre-checks"],["2","Documents due","1 due tomorrow","warn"],["3","Approvals issued","This week"],["1.2d","Average turnaround","Down 18%"]] }
};

const journeyStages = [
  ["Register & understand", "Seller creates a simple account. AI captures the property brief by portal, chat or WhatsApp.", "Create case · Send welcome · Ask only for missing facts"],
  ["Prepare pricing view", "AI discovers comparable evidence. Concierge and area specialist review a CMA-lite range.", "Collect comparables · Score quality · Route for human approval"],
  ["Appoint area specialist", "Best-fit agent receives a packaged brief and accepts the lead within the service level.", "Notify agent · Track acceptance · Reassign automatically if delayed"],
  ["Mandate & market launch", "Agent completes inspection, pricing discussion, listing pack and marketing preparation.", "Request FICA · Track mandate · Confirm each completed step"],
  ["Manage buyers & viewings", "Buyers receive matched listings, viewing confirmations and timely follow-ups.", "Schedule reminders · Capture feedback · Surface serious buyers"],
  ["Offer to purchase", "Agent handles negotiation. Parties receive plain-language updates and document requests.", "Explain process · Escalate legal questions · Confirm signatures"],
  ["Bond application", "Bond originator or bank tracks application needs, approval and conditions.", "Request finance documents · Remind applicants · Publish milestones"],
  ["Conveyancing preparation", "Transferring attorney manages FICA, transfer documents, clearance certificates and costs.", "Prepare upcoming requests · Alert responsible parties · Explain next step"],
  ["Lodgement & registration", "Attorneys lodge at the Deeds Office and confirm registration when completed.", "Send proactive updates · Confirm registration · Archive audit trail"]
];

const partners = [
  ["EV","Elize van Zyl","Area specialist · Parys","9 active cases","47m avg response","94% SLA"],
  ["TN","Thabo Nkosi","Buyer specialist · Sandton","12 active cases","1h 12m avg","91% SLA"],
  ["VM","Van der Merwe Inc.","Transferring attorneys","7 transfers","2 actions due","92% SLA"],
  ["NL","Naidoo Legal","Transferring attorneys","4 transfers","All updated","100% SLA"],
  ["OB","ooba Bond Originators","Finance partner","8 applications","1 action due","96% SLA"],
  ["AB","ABSA Home Loans","Financial institution","5 applications","2 conditions","89% SLA"]
];

const automations = [
  ["Smart intake concierge","Always on","Captures missing facts over portal or WhatsApp without forcing a long form."],
  ["Document anticipation","Milestone driven","Requests the next documents in advance and creates a visible responsibility trail."],
  ["Reminder ladder","7 · 5 · 3 · 2 · 1 days","Sends helpful nudges, then routes unresolved items to a human concierge."],
  ["Agent SLA monitor","Every 30 minutes","Flags delayed acceptance, missing contact attempts and overdue partner updates."],
  ["Question routing","AI first · Human when needed","Answers process questions and escalates legal, pricing, complaints and negotiation."],
  ["Timeline narrator","On every event","Turns complex transaction activity into clear next-step updates for each party."],
  ["WhatsApp sync","Webhook ready","Stores each inbound and outbound exchange against the shared case record."],
  ["Audit trail","On every change","Logs status updates, document decisions, reminders and human interventions."]
];

const managementCommunicationImprovements = [
  ["Pre-appointment document warmup", "Send required-doc previews 7 and 3 days before each meeting so clients arrive prepared.", "active"],
  ["Role-specific next-step brief", "Every role gets a plain-language message 24 hours before ownership changes.", "active"],
  ["Silence watchdog updates", "If no visible update is posted within 48 hours, trigger concierge reassurance to all affected parties.", "planned"],
  ["Partner readiness confirmation", "Ask attorneys and finance partners for readiness confirmation 5 days before control gates.", "active"],
  ["Decision-window countdown", "When offers or guarantees are pending, publish time-left reminders at 48h, 24h and 4h.", "planned"]
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const statusClass = (status) => status === "At risk" || status === "Overdue" ? "overdue" : status === "Waiting" || status === "Requested" || status === "Upcoming" ? "waiting" : status === "In progress" || status === "Uploaded" ? "progress" : "";
const buildAccessUrl = (token) => `${window.location.origin}/operations.html?access=${encodeURIComponent(token || "")}`;
const gateStatusClass = (status) => status === "blocked" ? "overdue" : status === "at-risk" ? "waiting" : status === "ready" ? "progress" : "";
const delayRiskClass = (band) => band === "critical" || band === "high" ? "overdue" : band === "medium" ? "waiting" : "progress";
$("#displayDate").textContent = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric"
}).format(new Date());

async function api(path, options = {}) {
  const token = localStorage.getItem("axiomOsToken") || "";
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    if (response.status === 401 && !["/api/os/login", "/api/os/login-access", "/api/os/auth/verify-otp"].includes(path)) {
      localStorage.removeItem("axiomOsToken");
      showLogin();
    }
    throw new Error(payload.error || "The operations request could not be completed");
  }
  return payload;
}

function applyOperationsStore(store) {
  if (!store) return;
  state.cases = Array.isArray(store.cases) ? store.cases : state.cases;
  state.documents = Array.isArray(store.documents) ? store.documents : state.documents;
  state.timeline = store.timeline || state.timeline;
  state.activities = Array.isArray(store.activities) ? store.activities : state.activities;
  state.resolvedItems = Array.isArray(store.resolvedItems) ? store.resolvedItems : [];
  state.notifications = Array.isArray(store.notifications) ? store.notifications : [];
  state.escalations = Array.isArray(store.escalations) ? store.escalations : [];
  state.priorities = Array.isArray(store.priorities) ? store.priorities : [];
  state.automation = store.automation || {};
  state.lastPhase2Summary = store.automation?.lastPhase2Summary || state.lastPhase2Summary;
  state.playbooks = Array.isArray(store.playbooks) ? store.playbooks : [];
  state.workflowRuns = store.workflowRuns || {};
  state.identities = Array.isArray(store.identities) ? store.identities : [];
  state.accessLinks = Array.isArray(store.accessLinks) ? store.accessLinks : [];
  const plans = { ...(state.recoveryPlans || {}) };
  state.cases.forEach((item) => {
    if (item?.delayIntelligence) {
      plans[item.id] = {
        caseId: item.id,
        generatedAt: item.delayIntelligence.generatedAt || null,
        risk: item.delayIntelligence,
        activeGate: item.activeGate ? { label: item.activeGate } : null,
        headline: item.delayIntelligence.band === "critical"
          ? `Critical delay risk detected. Predicted slip: ${item.delayIntelligence.predictedDelayDays || 0} days.`
          : item.delayIntelligence.band === "high"
            ? `High delay risk detected. Predicted slip: ${item.delayIntelligence.predictedDelayDays || 0} days.`
            : item.delayIntelligence.band === "medium"
              ? "Moderate delay risk detected. Preventive action is recommended."
              : "Delay risk is currently low.",
        actions: [],
        summary: { totalActions: 0, urgentActions: 0, contactGaps: 0 }
      };
    }
  });
  state.recoveryPlans = plans;
}

function renderOperatingViews() {
  renderOverview();
  renderCases();
  renderDocuments();
  renderFocus();
  renderPartnerAccessStudio();
  renderPlaybookConsole();
  renderRecoveryConsole();
  renderNotificationConsole();
  renderManagementDashboard();
  bindDynamicActions();
}

async function refreshAutomationStatus() {
  if (state.role !== "concierge") return;
  try {
    const payload = await api("/api/os/automation/status");
    state.automationStatus = payload;
    renderNotificationConsole();
    bindDynamicActions();
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshOperations() {
  try {
    const payload = await api("/api/os/state");
    applyOperationsStore(payload.store);
    try {
      const briefPayload = await api("/api/os/my-day");
      state.dailyBrief = briefPayload.brief || null;
    } catch {
      state.dailyBrief = null;
    }
    renderOperatingViews();
  } catch (error) {
    showToast(`Local sync unavailable: ${error.message}`);
  }
}

function showLogin() {
  document.body.classList.add("auth-locked");
  $("#loginModal").classList.add("open");
  $("#loginModal").setAttribute("aria-hidden", "false");
  closeDrawers();
}

function hideLogin() {
  document.body.classList.remove("auth-locked");
  $("#loginModal").classList.remove("open");
  $("#loginModal").setAttribute("aria-hidden", "true");
}

function updateSessionUi(user) {
  state.sessionUser = user;
  state.role = user.role;
  $("#roleSwitcher").value = user.role;
  $("#roleSwitcher").disabled = true;
  $("#logoutButton").textContent = `Sign out · ${user.name}`;
  $("#newCaseButton").hidden = user.role !== "concierge";
  $("#simulateJourney").hidden = user.role !== "concierge";
  $("#requestDocumentButton").hidden = !["concierge", "agent", "attorney"].includes(user.role);
  const managementNav = document.querySelector('.nav-item[data-view="management"]');
  if (managementNav) managementNav.hidden = user.role !== "concierge";
}

function completeSignIn(payload, message = "") {
  localStorage.setItem("axiomOsToken", payload.token);
  state.pendingOtpChallengeId = null;
  updateSessionUi(payload.user);
  applyOperationsStore(payload.store);
  renderOperatingViews();
  hideLogin();
  if (message) showToast(message);
}

async function signIn(cellphone, pin, profileId = "") {
  const payload = await api("/api/os/login", { method: "POST", body: JSON.stringify({ cellphone, pin, profileId }) });
  completeSignIn(payload, `Signed in securely as ${payload.user.name}.`);
}

async function signInWithAccessToken(accessToken) {
  let tokenInput = String(accessToken || "").trim();
  if (tokenInput.includes("access=")) {
    try {
      const parsed = new URL(tokenInput);
      tokenInput = parsed.searchParams.get("access") || tokenInput;
    } catch {
      const raw = tokenInput.split("access=")[1] || tokenInput;
      tokenInput = raw.split("&")[0] || raw;
    }
  }
  const payload = await api("/api/os/login-access", {
    method: "POST",
    body: JSON.stringify({ accessToken: tokenInput })
  });
  completeSignIn(payload, `Welcome back, ${payload.user.name}.`);
}

async function requestOtp(cellphone, profileId = "") {
  const payload = await api("/api/os/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ cellphone, profileId })
  });
  state.pendingOtpChallengeId = payload.challengeId;
  return payload;
}

async function verifyOtp(code) {
  if (!state.pendingOtpChallengeId) {
    throw new Error("Request a sign-in code first.");
  }
  const payload = await api("/api/os/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ challengeId: state.pendingOtpChallengeId, code })
  });
  completeSignIn(payload, `Signed in securely as ${payload.user.name}.`);
}

async function signOut() {
  try {
    await api("/api/os/logout", { method: "POST", body: "{}" });
  } catch {
    // Clear the local token even if the local server session already expired.
  }
  localStorage.removeItem("axiomOsToken");
  state.sessionUser = null;
  state.cases = [];
  state.documents = [];
  state.timeline = {};
  state.activities = [];
  state.priorities = [];
  state.identities = [];
  state.accessLinks = [];
  state.pendingOtpChallengeId = null;
  state.dailyBrief = null;
  showLogin();
}

async function bootstrapOperations() {
  const accessToken = new URLSearchParams(window.location.search).get("access");
  if (accessToken) {
    try {
      await signInWithAccessToken(accessToken);
      const url = new URL(window.location.href);
      url.searchParams.delete("access");
      window.history.replaceState({}, "", url.toString());
      return;
    } catch (error) {
      showToast(error.message);
      const url = new URL(window.location.href);
      url.searchParams.delete("access");
      window.history.replaceState({}, "", url.toString());
    }
  }
  const token = localStorage.getItem("axiomOsToken");
  if (!token) return showLogin();
  try {
    const session = await api("/api/os/session");
    updateSessionUi(session.user);
    await refreshOperations();
    hideLogin();
  } catch {
    showLogin();
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("The selected document could not be read"));
    reader.readAsDataURL(file);
  });
}

async function uploadDocument(file) {
  if (!state.uploadDocumentId || !file) return;
  try {
    const base64 = await readFileAsBase64(file);
    const payload = await api(`/api/os/documents/${encodeURIComponent(state.uploadDocumentId)}/upload`, {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mimeType: file.type, base64 })
    });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    showToast(`${file.name} uploaded securely and added to the review queue.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.uploadDocumentId = null;
    $("#documentUploadInput").value = "";
  }
}

async function downloadDocument(documentId) {
  const token = localStorage.getItem("axiomOsToken") || "";
  try {
    const response = await fetch(`/api/os/documents/${encodeURIComponent(documentId)}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "The protected document could not be downloaded");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] || "axiom-document";
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${name} downloaded from the protected document centre.`);
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function renderMetrics() {
  const profile = roleProfiles[state.role];
  const metrics = state.role === "concierge"
    ? [
        [String(state.cases.length), "Active journeys", "Live local operating record"],
        [String(state.priorities.filter(item => !state.resolvedItems.includes(`${item.caseId}:${item.issue}`)).length), "Need attention", "Prioritised for concierge review", "warn"],
        ["94%", "On-time actions", "+11% with automation"],
        [String(state.escalations.filter(item => item.status === "open").length), "AI escalations", "Human attention requested", "warn"]
      ]
    : profile.metrics;
  $("#metricGrid").innerHTML = metrics.map(([value, label, note, tone]) => `
    <article class="metric"><p>${esc(label)}</p><strong>${esc(value)}</strong><small class="${tone || ""}">${esc(note)}</small></article>
  `).join("");
}

function renderOverview() {
  const profile = roleProfiles[state.role];
  $("#screenTitle").textContent = profile.title;
  $("#roleAvatar").textContent = profile.avatar;
  $("#welcomeTitle").textContent = profile.welcome;
  $("#welcomeBody").textContent = state.role === "concierge"
    ? `AI is monitoring ${state.cases.length} active journeys, ${state.documents.length} document obligations and ${state.priorities.filter(item => !state.resolvedItems.includes(`${item.caseId}:${item.issue}`)).length} prioritised partner actions across your property pipeline.`
    : profile.body;
  $("#priorityTitle").textContent = state.role === "concierge" ? "Today's priority queue" : "Your next actions";
  renderMetrics();
  const queue = buildPriorityQueue().filter(item => !state.resolvedItems.includes(`${item.caseId}:${item.issue}`));
  $("#priorityList").innerHTML = queue.map(item => `
    <article class="priority-item">
      <i class="priority-line ${item.level === "high" ? "" : item.level === "medium" ? "medium" : "low"}"></i>
      <div>
        <div class="item-meta"><b>${esc(item.caseId)}</b><span>${esc(item.client)}</span><span>· ${esc(item.due)}</span></div>
        <strong>${esc(item.issue)}</strong>
        <p>${esc(item.detail)}</p>
      </div>
      <div class="priority-buttons">
        <button class="mini-btn" data-open-case="${esc(item.caseId)}">Open</button>
        ${state.role === "concierge" ? `<button class="mini-btn" data-resolve="${esc(item.issue)}" data-resolve-case="${esc(item.caseId)}">Resolve</button>` : ""}
      </div>
    </article>
  `).join("");
  $("#activityList").innerHTML = state.activities.map(([icon,title,detail,time]) => `
    <article class="activity-item">
      <span class="activity-icon">${esc(icon)}</span>
      <div><div class="item-meta"><span>${esc(time)}</span></div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>
    </article>
  `).join("");
}

function buildPriorityQueue() {
  if (state.role === "concierge" || state.role === "agent" || state.role === "attorney" || state.role === "finance") {
    return state.priorities;
  }
  return state.cases.slice(0, 3).map(item => ({
    level: item.status === "At risk" ? "high" : "medium",
    caseId: item.id,
    client: "Your action",
    issue: item.next,
    detail: `${item.stage}. Responsible party: ${item.owner}.`,
    due: item.due
  }));
}

function renderJourneyPulse(pulse) {
  if (!pulse) return "";
  const documents = Array.isArray(pulse.outstandingDocuments) ? pulse.outstandingDocuments : [];
  const handled = Array.isArray(pulse.handledForYou) ? pulse.handledForYou : [];
  const confirmations = Array.isArray(pulse.recentConfirmations) ? pulse.recentConfirmations : [];
  const contacts = pulse.humanContacts || {};
  return `
    <section class="client-pulse ${esc(pulse.tone || "calm")}">
      <div class="client-pulse-head">
        <div>
          <p class="overline">Axiom Journey Pulse</p>
          <h3>${esc(pulse.status || "On track")}</h3>
          <p>${esc(pulse.message || "")}</p>
        </div>
        <div class="pulse-progress">
          <strong>${Number(pulse.progress || 0)}%</strong>
          <span>${esc(pulse.stage || "Journey active")}</span>
        </div>
      </div>
      <div class="client-pulse-grid">
        <article>
          <span>Next visible action</span>
          <strong>${esc(pulse.nextAction || "No action required right now")}</strong>
          <small>${esc(pulse.nextOwner || "Axiom")} / Due ${esc(pulse.due || "To be confirmed")}</small>
        </article>
        <article>
          <span>Your human team</span>
          <strong>${esc(contacts.concierge || "Axiom concierge")}</strong>
          <small>Specialist: ${esc(contacts.specialist || "To appoint")}</small>
        </article>
      </div>
      <div class="client-pulse-columns">
        <div>
          <h4>Needed from you</h4>
          ${documents.length ? `<ul>${documents.map(doc => `<li><b>${esc(doc.name)}</b><small>${esc(doc.status)} / Due ${esc(doc.due)}</small></li>`).join("")}</ul>` : `<p>No documents are currently waiting on you.</p>`}
        </div>
        <div>
          <h4>Axiom is handling</h4>
          <ul>${handled.map(item => `<li>${esc(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <h4>Recently confirmed</h4>
          ${confirmations.length ? `<ul>${confirmations.map(item => `<li><b>${esc(item.title)}</b><small>${esc(item.time)}</small></li>`).join("")}</ul>` : `<p>Your first confirmation will appear here shortly.</p>`}
        </div>
      </div>
    </section>
  `;
}

function renderDailyBriefCard() {
  const brief = state.dailyBrief;
  const actions = Array.isArray(brief?.actions) ? brief.actions.slice(0, 5) : [];
  const journeyPulse = renderJourneyPulse(brief?.journeyPulse);
  if (!actions.length) {
    return `
      ${journeyPulse}
      <section class="next-step-card">
        <p class="overline">My daily brief</p>
        <h3>All clear for now</h3>
        <p>No urgent actions are currently assigned. Keep monitoring your case timeline for new updates.</p>
      </section>
    `;
  }
  const summary = brief?.summary || {};
  return `
    ${journeyPulse}
    <section class="next-step-card">
      <p class="overline">My daily brief</p>
      <h3>${esc(brief.headline || "Top actions for today")}</h3>
      <p>High priority: <strong>${Number(summary.highPriority || 0)}</strong> · Medium: <strong>${Number(summary.mediumPriority || 0)}</strong></p>
      <div class="timeline">
        ${actions.map((action) => `
          <article class="timeline-event">
            <span>${esc(action.caseId)} · ${esc(action.priority)}</span>
            <strong>${esc(action.title)}</strong>
            <p>${esc(action.detail)} · Due ${esc(action.due || "Not set")}</p>
            ${action.quickMessage ? `<button class="mini-btn" data-copy-brief="${esc(action.quickMessage)}">Copy update</button>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderFocus() {
  const panel = $("#caseFocus");
  const item = state.cases.find(entry => entry.id === state.activeCase) || state.cases[0];
  if (!item) {
    panel.innerHTML = `<div class="panel-head"><div><p class="overline">Recommended focus</p><h2>No active cases assigned</h2></div></div>`;
    return;
  }
  state.activeCase = item.id;
  const canRemind = ["concierge", "agent", "attorney", "finance"].includes(state.role);
  panel.innerHTML = `
    <div class="panel-head">
      <div><p class="overline">Recommended focus</p><h2>${state.role === "concierge" ? "Case requiring attention" : "Your current journey"}</h2></div>
      <button class="ghost-btn" data-open-case="${esc(item.id)}">Open full case</button>
    </div>
    <div class="focus-grid">
      <div>
        <span class="case-id">${esc(item.id)} · ${esc(item.journey.toUpperCase())} JOURNEY</span>
        <h3>${esc(item.client)}</h3>
        <p>${esc(item.property)} · ${esc(item.area)} · ${esc(item.value)}</p>
        <div class="progress-track"><span style="width: ${Number(item.progress) || 0}%"></span></div>
        <small>${esc(item.progress)}% complete · ${esc(item.stage)}</small>
      </div>
      <div class="focus-action">
        <span class="warning-icon">!</span>
        <div><strong>${esc(item.next)}</strong><p>Responsible: ${esc(item.owner)} · Due: ${esc(item.due)}. The shared record will confirm completion.</p></div>
        ${canRemind ? `<button class="primary-btn small" data-remind="${esc(item.client)}" data-case-id="${esc(item.id)}">Send WhatsApp</button>` : ""}
      </div>
    </div>
    ${renderDailyBriefCard()}
  `;
}

function renderCases() {
  const matches = state.cases.filter(item => {
    const filterOk = state.caseFilter === "all" || item.journey === state.caseFilter || (state.caseFilter === "risk" && item.status === "At risk");
    const searchOk = !state.search || `${item.id} ${item.client} ${item.area}`.toLowerCase().includes(state.search.toLowerCase());
    return filterOk && searchOk;
  });
  $("#caseRows").innerHTML = matches.map(item => `
    <tr>
      <td><strong>${esc(item.id)}</strong><small>${esc(item.area)}</small></td>
      <td>${esc(item.client)}<small>${esc(item.property)}</small></td>
      <td>${esc(item.journey)}</td>
      <td>${esc(item.stage)}<small>${item.progress}% complete · Gate: ${esc(item.activeGate || "N/A")} · Delay risk: ${esc((item.delayRiskBand || "low").toUpperCase())}</small></td>
      <td>${esc(item.next)}<small>Owner: ${esc(item.owner)}</small></td>
      <td>${esc(item.due)}</td>
      <td>
        <span class="status ${statusClass(item.status)}">${esc(item.status)}</span>
        <small><span class="status ${gateStatusClass(item.gateStatus)}">${esc(item.gateStatus || "in-progress")}</span></small>
      </td>
      <td><button class="mini-btn" data-open-case="${esc(item.id)}">Open</button></td>
    </tr>
  `).join("");
}

function renderDocuments() {
  const filtered = state.documents.filter(doc => state.docFilter === "all" || doc.status.toLowerCase() === state.docFilter);
  const overdue = state.documents.filter(doc => doc.status === "Overdue").length;
  const uploaded = state.documents.filter(doc => doc.status === "Uploaded").length;
  $("#documentMetrics").innerHTML = [
    [state.documents.length, "Tracked obligations", "Across active cases"],
    [overdue, "Needs intervention", "Concierge follow-up required", "warn"],
    [uploaded, "Ready for approval", "AI pre-check complete"]
  ].map(([value,label,note,tone]) => `<article class="metric"><p>${label}</p><strong>${value}</strong><small class="${tone || ""}">${note}</small></article>`).join("");
  $("#documentRows").innerHTML = filtered.map(doc => `
    <tr>
      <td><strong>${esc(doc.name)}</strong>${doc.file ? `<small>${esc(doc.file.originalName)} · ${Math.ceil(doc.file.size / 1024)} KB</small>` : ""}</td><td>${esc(doc.caseId)}</td><td>${esc(doc.owner)}</td><td>${esc(doc.due)}</td>
      <td>${esc(doc.reminder)}</td><td><span class="status ${statusClass(doc.status)}">${esc(doc.status)}</span></td>
      <td><div class="priority-buttons">${renderDocumentActions(doc)}</div></td>
    </tr>
  `).join("");
}

function renderDocumentActions(doc) {
  const canManage = ["concierge", "agent", "attorney", "finance"].includes(state.role);
  const canApprove = ["concierge", "attorney"].includes(state.role);
  const parts = [];
  if (doc.file) parts.push(`<button class="mini-btn" data-download-doc="${esc(doc.id)}">Download</button>`);
  if (doc.status !== "Approved") parts.push(`<button class="mini-btn" data-upload-doc="${esc(doc.id)}">${doc.file ? "Replace" : "Upload"}</button>`);
  if (doc.status === "Uploaded" && canApprove) parts.push(`<button class="mini-btn" data-doc-action="${esc(doc.name)}">Approve</button>`);
  if (doc.status !== "Approved" && canManage) parts.push(`<button class="mini-btn" data-doc-action="${esc(doc.name)}">Remind</button>`);
  return parts.join("");
}

function renderJourney() {
  $("#journeyMap").innerHTML = journeyStages.map(([title, desc, automation], index) => `
    <article class="journey-stage">
      <span class="stage-number">${index + 1}</span>
      <strong>${esc(title)}</strong>
      <p class="stage-desc">${esc(desc)}</p>
      <div class="stage-auto"><b>AI + AUTOMATION</b><small>${esc(automation)}</small></div>
    </article>
  `).join("");
}

function getEligibleJourneyCases() {
  return state.cases.filter(item => ["seller", "buyer", "transfer"].includes(item.journey));
}

function renderPlaybookConsole() {
  const caseSelect = $("#playbookCaseSelect");
  const milestoneSelect = $("#playbookMilestoneSelect");
  const summary = $("#playbookSummary");
  const milestones = $("#playbookMilestones");
  if (!caseSelect || !milestoneSelect || !summary || !milestones) return;
  const eligibleCases = getEligibleJourneyCases();
  if (!eligibleCases.length) {
    caseSelect.innerHTML = "";
    milestoneSelect.innerHTML = "";
    summary.innerHTML = `<p class="empty-state">No transaction playbook is assigned to this workspace yet.</p>`;
    milestones.innerHTML = "";
    $("#prepareMilestone").hidden = true;
    $("#advanceMilestone").hidden = true;
    return;
  }
  const selectedCase = eligibleCases.find(item => item.id === state.playbookCaseId)
    || eligibleCases.find(item => item.id === state.activeCase)
    || eligibleCases[0];
  state.playbookCaseId = selectedCase.id;
  const playbook = state.playbooks.find(item => item.journey === selectedCase.journey);
  const run = state.workflowRuns[selectedCase.id] || {};
  if (!playbook) {
    summary.innerHTML = `<p class="empty-state">This journey does not have a configured playbook.</p>`;
    milestones.innerHTML = "";
    return;
  }
  const selectedMilestone = playbook.milestones.find(item => item.id === state.playbookMilestoneId)
    || playbook.milestones.find(item => item.id === run.currentMilestoneId)
    || playbook.milestones[0];
  state.playbookMilestoneId = selectedMilestone.id;
  caseSelect.innerHTML = eligibleCases.map(item => `<option value="${esc(item.id)}" ${item.id === selectedCase.id ? "selected" : ""}>${esc(item.id)} / ${esc(item.client)} / ${esc(item.journey)}</option>`).join("");
  milestoneSelect.innerHTML = playbook.milestones.map((item, index) => `<option value="${esc(item.id)}" ${item.id === selectedMilestone.id ? "selected" : ""}>${index + 1}. ${esc(item.title)}</option>`).join("");
  const prepared = new Set(run.preparedMilestoneIds || []);
  const documentCount = playbook.milestones.reduce((count, item) => count + (item.documents || []).length, 0);
  summary.innerHTML = `
    <div class="playbook-summary">
      <div>
        <p class="overline">${esc(playbook.name)}</p>
        <h3>${esc(selectedCase.client)}</h3>
        <p>${esc(playbook.description)}</p>
      </div>
      <div class="playbook-stats">
        <span><b>${playbook.milestones.length}</b> milestones</span>
        <span><b>${documentCount}</b> document rules</span>
        <span><b>${prepared.size}</b> prepared</span>
        <span><b>${esc(playbook.reminderLadder)}</b> reminder ladder</span>
      </div>
    </div>
  `;
  milestones.innerHTML = playbook.milestones.map((item, index) => {
    const isPrepared = prepared.has(item.id);
    const isCurrent = item.id === selectedMilestone.id;
    const docs = (item.documents || []).map(document => document.name).join(", ");
    return `
      <article class="playbook-step ${isCurrent ? "current" : ""} ${isPrepared ? "prepared" : ""}">
        <span class="stage-number">${index + 1}</span>
        <div>
          <strong>${esc(item.title)}</strong>
          <p>${esc(item.description)}</p>
          <small>${docs ? `Documents: ${esc(docs)}` : "No document request at this milestone"}</small>
        </div>
        <div class="playbook-step-meta">
          <span>${esc(item.owner)}</span>
          <span>${esc(item.due)}</span>
          <b>${isPrepared ? "Prepared" : isCurrent ? "Selected" : "Upcoming"}</b>
        </div>
      </article>
    `;
  }).join("");
  const canPrepare = state.role === "concierge";
  $("#prepareMilestone").hidden = !canPrepare;
  $("#advanceMilestone").hidden = !canPrepare;
}

function renderRecoveryConsole() {
  const caseSelect = $("#recoveryCaseSelect");
  const summary = $("#recoverySummary");
  const actionsPanel = $("#recoveryActions");
  if (!caseSelect || !summary || !actionsPanel) return;
  const eligibleCases = getEligibleJourneyCases();
  if (!eligibleCases.length) {
    caseSelect.innerHTML = "";
    summary.innerHTML = `<p class="empty-state">No cases available for recovery analysis yet.</p>`;
    actionsPanel.innerHTML = "";
    $("#runRecoveryPlan").hidden = true;
    $("#queueRecoveryPlan").hidden = true;
    return;
  }
  const selectedCase = eligibleCases.find(item => item.id === state.recoveryCaseId)
    || eligibleCases.find(item => item.id === state.playbookCaseId)
    || eligibleCases.find(item => item.id === state.activeCase)
    || eligibleCases[0];
  state.recoveryCaseId = selectedCase.id;
  caseSelect.innerHTML = eligibleCases.map(item => `<option value="${esc(item.id)}" ${item.id === selectedCase.id ? "selected" : ""}>${esc(item.id)} / ${esc(item.client)} / ${esc(item.journey)}</option>`).join("");
  const plan = state.recoveryPlans?.[selectedCase.id] || null;
  const risk = plan?.risk || selectedCase.delayIntelligence || null;
  if (!risk) {
    summary.innerHTML = `<p class="empty-state">Run delay prediction to generate a recovery plan for this case.</p>`;
    actionsPanel.innerHTML = "";
  } else {
    const score = Number(risk.score || 0);
    const band = String(risk.band || "low").toUpperCase();
    const signals = Array.isArray(risk.signals) ? risk.signals.slice(0, 4) : [];
    summary.innerHTML = `
      <div class="recovery-summary">
        <div>
          <p class="overline">Closing Command AI</p>
          <h3>${esc(selectedCase.client)}</h3>
          <p>${esc(plan?.headline || "Delay risk intelligence is active for this case.")}</p>
        </div>
        <div class="playbook-stats">
          <span><b>${score}</b> risk score</span>
          <span><b>${band}</b> risk band</span>
          <span><b>${Number(risk.predictedDelayDays || 0)}</b> predicted slip days</span>
          <span><b>${Number(risk.confidence || 0)}%</b> confidence</span>
        </div>
      </div>
      <div class="timeline">
        ${signals.length ? signals.map(signal => `
          <article class="timeline-event">
            <span>Signal · Impact ${Number(signal.impact || 0)}</span>
            <strong>${esc(signal.label || "Risk signal detected")}</strong>
          </article>
        `).join("") : `<article class="timeline-event"><strong>No major risk signals currently detected.</strong></article>`}
      </div>
    `;

    const actions = Array.isArray(plan?.actions) ? plan.actions : [];
    const nextBestIds = new Set(Array.isArray(plan?.nextBestActions) ? plan.nextBestActions.map(action => action.id) : []);
    actionsPanel.innerHTML = actions.length
      ? actions.map(action => `
          <article class="playbook-step ${action.priority === "Critical" ? "current" : ""}">
            <span class="stage-number">${esc((action.ownerCode || "?").slice(0, 2))}</span>
            <div>
              <strong>${action.sequenceRank ? `#${action.sequenceRank} · ` : ""}${esc(action.title)}</strong>
              <p>${esc(action.detail)}</p>
              <small>Owner: ${esc(action.ownerLabel || action.ownerCode || "Assigned owner")} · Due: ${esc(action.due || "Soon")}${action.dependsOn?.length ? ` · Depends on ${esc(action.dependsOn.join(", "))}` : ""}</small>
              ${action.sequenceReason ? `<small>${esc(action.sequenceReason)}</small>` : ""}
            </div>
            <div class="playbook-step-meta">
              ${nextBestIds.has(action.id) ? `<span class="status progress">Next best</span>` : ""}
              <span class="status ${notificationStatusClass(action.contactReady ? "delivered" : "failed")}">${action.contactReady ? "Contact ready" : "Routing needed"}</span>
              <b>${esc(action.priority || "High")}</b>
            </div>
          </article>
        `).join("")
      : `<p class="empty-state">No recovery actions are currently required for this case.</p>`;
  }
  const isConcierge = state.role === "concierge";
  $("#runRecoveryPlan").hidden = !isConcierge;
  $("#queueRecoveryPlan").hidden = !isConcierge;
}

function renderPartnerAccessStudio() {
  const caseSelect = $("#studioAccessCase");
  const rows = $("#studioRecentAccessRows");
  const result = $("#studioAccessResult");
  const qrPanel = $("#studioQrPanel");
  const qrImage = $("#studioQrImage");
  if (!caseSelect || !rows || !result) return;
  const eligibleCases = getEligibleJourneyCases();
  const priorSelection = caseSelect.value;
  caseSelect.innerHTML = eligibleCases.map(item => `<option value="${esc(item.id)}">${esc(item.id)} / ${esc(item.client)} / ${esc(item.journey)}</option>`).join("");
  if (!eligibleCases.length) {
    rows.innerHTML = `<tr><td colspan="5">No active cases available for partner onboarding yet.</td></tr>`;
    result.textContent = "No secure link generated yet.";
    if (qrPanel) qrPanel.hidden = true;
    if (qrImage) qrImage.removeAttribute("src");
    return;
  }
  if (eligibleCases.some(item => item.id === priorSelection)) {
    caseSelect.value = priorSelection;
  } else if (!eligibleCases.some(item => item.id === caseSelect.value)) {
    caseSelect.value = eligibleCases[0].id;
  }
  const visibleLinks = (state.accessLinks || []).slice(0, 8);
  rows.innerHTML = visibleLinks.length
    ? visibleLinks.map(link => `
      <tr>
        <td>${esc(link.roleLabel || link.role)}</td>
        <td>${esc(link.name || "Participant")}</td>
        <td>${esc(link.caseId)}</td>
        <td>${esc(formatAutomationTime(link.createdAt))}</td>
        <td><span class="status ${link.active ? "progress" : "waiting"}">${link.active ? "Active" : "Inactive"}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">No secure links issued yet.</td></tr>`;
  if (qrPanel && state.studioLastAccessQrDataUrl) {
    qrPanel.hidden = false;
    if (qrImage) qrImage.src = state.studioLastAccessQrDataUrl;
  }
  updateStudioRoleDefaults();
}

function buildManagementSnapshot() {
  const atRiskCases = state.cases.filter(item => ["high", "critical", "medium"].includes(String(item.delayRiskBand || "").toLowerCase()) || item.status === "At risk");
  const dueSoonDocs = state.documents.filter(doc => {
    const due = parseDueDateLabel(doc.due);
    if (!due) return false;
    const twoDays = new Date();
    twoDays.setDate(twoDays.getDate() + 2);
    return due <= twoDays && doc.status !== "Approved";
  });
  const waitingNotifications = state.notifications.filter(item => ["waiting-channel", "failed"].includes(item.status));
  const contactGaps = atRiskCases.filter(item => [item.agent, item.attorney, item.finance].some(name => /to appoint/i.test(String(name || ""))));
  return {
    activeCases: state.cases.length,
    atRiskCases: atRiskCases.length,
    dueSoonDocs: dueSoonDocs.length,
    waitingNotifications: waitingNotifications.length,
    contactGaps: contactGaps.length,
    attentionCases: atRiskCases.slice(0, 8)
  };
}

function parseDueDateLabel(value) {
  const text = String(value || "").trim().toLowerCase();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (!text) return null;
  if (text === "today") return start;
  if (text === "tomorrow") return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const within = /^within\s+(\d+)\s+day/.exec(text);
  if (within) return new Date(start.getTime() + Number(within[1]) * 24 * 60 * 60 * 1000);
  return null;
}

function renderManagementDashboard() {
  const metrics = $("#managementMetrics");
  const improvements = $("#managementImprovements");
  const rows = $("#managementCaseRows");
  const phase2Result = $("#phase2SummaryResult");
  if (!metrics || !improvements || !rows) return;
  if (state.role !== "concierge") {
    metrics.innerHTML = `<article class="metric"><p>Restricted</p><strong>Role-limited</strong><small class="warn">Management dashboard is concierge-only.</small></article>`;
    improvements.innerHTML = "";
    rows.innerHTML = `<tr><td colspan="5">Sign in as concierge to view management insights.</td></tr>`;
    if (phase2Result) phase2Result.textContent = "Sign in as concierge to run phase 2 automation.";
    return;
  }
  const snapshot = buildManagementSnapshot();
  const slaBreaches = state.escalations.filter(item => item.status === "open" && item.slaState === "breached").length;
  metrics.innerHTML = [
    [snapshot.activeCases, "Active journeys", "Across all authorised pipelines"],
    [snapshot.atRiskCases, "Delay-risk cases", "High and medium risk cases in focus", snapshot.atRiskCases ? "warn" : ""],
    [snapshot.dueSoonDocs, "Documents due in 48h", "Opportunity for earlier reminders", snapshot.dueSoonDocs ? "warn" : ""],
    [snapshot.contactGaps, "Partner contact gaps", "Cases with missing owner assignment", snapshot.contactGaps ? "warn" : ""],
    [slaBreaches, "Escalation SLA breaches", "Escalations overdue for human response", slaBreaches ? "warn" : ""]
  ].map(([value, label, note, tone]) => `<article class="metric"><p>${label}</p><strong>${value}</strong><small class="${tone || ""}">${note}</small></article>`).join("");
  improvements.innerHTML = managementCommunicationImprovements.map((item, index) => `
    <article class="improvement-row">
      <span class="improvement-index">${index + 1}</span>
      <div><strong>${esc(item[0])}</strong><p>${esc(item[1])}</p></div>
      <span class="improvement-badge ${item[2] === "planned" ? "planned" : ""}">${item[2] === "planned" ? "Planned" : "Active"}</span>
    </article>
  `).join("");
  rows.innerHTML = snapshot.attentionCases.length
    ? snapshot.attentionCases.map(item => `
      <tr>
        <td>${esc(item.id)}</td>
        <td>${esc(item.client)}</td>
        <td><span class="management-case-risk ${String(item.delayRiskBand || "low").toLowerCase() === "high" || String(item.delayRiskBand || "low").toLowerCase() === "critical" ? "high" : "medium"}">${esc(String(item.delayRiskBand || "low").toUpperCase())}</span></td>
        <td>${esc(item.next)}<small>Owner: ${esc(item.owner)} / Due ${esc(item.due)}</small></td>
        <td>${/to appoint/i.test(`${item.agent} ${item.attorney} ${item.finance}`) ? "Missing partner details" : "No gap"}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">No high-attention cases currently flagged.</td></tr>`;
  if (phase2Result) {
    if (!state.lastPhase2Summary) {
      phase2Result.textContent = "No phase 2 run yet in this session.";
    } else {
      const summary = state.lastPhase2Summary;
      const roleBriefs = Number(summary.roleBriefs?.queued || 0);
      const watchdog = Number(summary.silenceWatchdog?.queued || 0);
      const readiness = Number(summary.partnerReadiness?.queued || 0);
      const countdown = Number(summary.decisionCountdown?.queued || 0);
      const redFlags = Number(summary.redFlags?.queued || 0);
      const sla = Number(summary.escalationSlaBreaches || 0);
      phase2Result.textContent = `Phase 2 run complete: ${roleBriefs} role briefs, ${watchdog} silence updates, ${readiness} readiness prompts, ${countdown} decision reminders, ${redFlags} red-flag alert${redFlags === 1 ? "" : "s"}, ${sla} SLA breach${sla === 1 ? "" : "es"} detected.`;
    }
  }
}

function updateStudioRoleDefaults() {
  const caseId = $("#studioAccessCase")?.value || "";
  const role = $("#studioAccessRole")?.value || "seller";
  const item = state.cases.find(entry => entry.id === caseId) || null;
  if (!item) return;
  const nameInput = $("#studioAccessName");
  const phoneInput = $("#studioAccessCellphone");
  const birthdayInput = $("#studioAccessBirthday");
  if (nameInput && !nameInput.value.trim()) nameInput.value = getSuggestedParticipantName(item, role);
  if (phoneInput && !phoneInput.value.trim() && (role === "seller" || role === "buyer")) {
    phoneInput.value = item.cellphone || "";
  }
  if (birthdayInput) {
    birthdayInput.disabled = !["seller", "buyer"].includes(role);
    if (!birthdayInput.disabled && !birthdayInput.value.trim()) {
      const birthdays = item.birthdays || {};
      birthdayInput.value = role === "seller" ? (birthdays.seller || "") : (birthdays.buyer || "");
    }
    if (birthdayInput.disabled) birthdayInput.value = "";
  }
}

async function createStudioAccessLink() {
  const caseId = $("#studioAccessCase")?.value || "";
  const role = $("#studioAccessRole")?.value || "";
  const name = ($("#studioAccessName")?.value || "").trim();
  const cellphone = ($("#studioAccessCellphone")?.value || "").trim();
  const email = ($("#studioAccessEmail")?.value || "").trim();
  const birthday = ($("#studioAccessBirthday")?.value || "").trim();
  if (!caseId) return showToast("Choose a case first.");
  if (!name) return showToast("Participant name is required.");
  if (!cellphone && !email) return showToast("Provide cellphone or email to issue secure access.");
  try {
    const payload = await api(`/api/os/cases/${encodeURIComponent(caseId)}/invite-party`, {
      method: "POST",
      body: JSON.stringify({ role, name, cellphone, email, birthday })
    });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    state.studioLastAccessUrl = payload.invite?.accessUrl || "";
    state.studioLastAccessLinkId = payload.invite?.accessLinkId || "";
    state.studioLastAccessQrDataUrl = "";
    const qrPanel = $("#studioQrPanel");
    const qrImage = $("#studioQrImage");
    if (qrPanel) qrPanel.hidden = true;
    if (qrImage) qrImage.removeAttribute("src");
    $("#studioAccessResult").textContent = state.studioLastAccessUrl
      ? `Secure link ready for ${name}: ${state.studioLastAccessUrl}`
      : `Secure access generated for ${name}.`;
    showToast(`Secure access created for ${name}.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function showStudioQrCode() {
  const linkId = state.studioLastAccessLinkId;
  if (!linkId) return showToast("Generate a secure link first.");
  try {
    const payload = await api(`/api/os/access-links/${encodeURIComponent(linkId)}/qr`);
    state.studioLastAccessQrDataUrl = payload.qrDataUrl || "";
    const qrPanel = $("#studioQrPanel");
    const qrImage = $("#studioQrImage");
    if (qrPanel && state.studioLastAccessQrDataUrl) qrPanel.hidden = false;
    if (qrImage && state.studioLastAccessQrDataUrl) qrImage.src = state.studioLastAccessQrDataUrl;
    showToast("QR code ready for mobile onboarding.");
  } catch (error) {
    showToast(error.message);
  }
}

async function runPhase2Automation() {
  if (state.role !== "concierge") return showToast("Concierge sign-in required.");
  try {
    const payload = await api("/api/os/automation/phase2", {
      method: "POST",
      body: JSON.stringify({ processQueue: false })
    });
    applyOperationsStore(payload.store);
    state.lastPhase2Summary = payload.summary || null;
    renderOperatingViews();
    const totalQueued =
      Number(payload.summary?.roleBriefs?.queued || 0) +
      Number(payload.summary?.silenceWatchdog?.queued || 0) +
      Number(payload.summary?.partnerReadiness?.queued || 0) +
      Number(payload.summary?.decisionCountdown?.queued || 0) +
      Number(payload.summary?.redFlags?.queued || 0);
    showToast(`Phase 2 automation complete. ${totalQueued} proactive communication tasks queued.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function exportWeeklySummary() {
  if (state.role !== "concierge") return showToast("Concierge sign-in required.");
  const token = localStorage.getItem("axiomOsToken") || "";
  try {
    const response = await fetch("/api/os/management/weekly-summary?format=txt", {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Weekly summary export failed");
    }
    const text = await response.text();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `axiom-weekly-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Weekly management summary exported.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderPartners() {
  $("#partnerGrid").innerHTML = partners.map(([initials,name,type,cases,response,sla]) => `
    <article class="partner-card">
      <header><span class="partner-avatar">${initials}</span><div><h3>${esc(name)}</h3><p>${esc(type)}</p></div></header>
      <div class="partner-stats"><span>Pipeline<strong>${esc(cases)}</strong></span><span>Response<strong>${esc(response)}</strong></span><span>Service<strong>${esc(sla)}</strong></span></div>
    </article>
  `).join("");
}

function renderAutomations() {
  $("#automationGrid").innerHTML = automations.map(([title,tag,desc]) => `
    <article class="automation-card"><i class="switch"></i><span class="tag">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(desc)}</p></article>
  `).join("");
}

function renderNotificationConsole() {
  const metrics = $("#deliveryMetrics");
  const rows = $("#notificationRows");
  const channel = $("#channelStatus");
  if (!metrics || !rows || !channel) return;
  const counts = state.notifications.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {});
  metrics.innerHTML = [
    [counts.queued || 0, "Queued", "Ready for processing"],
    [counts.delivered || 0, "Delivered", "Provider confirmed"],
    [(counts["waiting-channel"] || 0) + (counts.failed || 0), "Needs attention", "Retry when channel is ready", "warn"]
  ].map(([value,label,note,tone]) => `<article class="metric"><p>${label}</p><strong>${value}</strong><small class="${tone || ""}">${note}</small></article>`).join("");
  const config = state.automationStatus?.channels;
  channel.innerHTML = config
    ? `
      <span class="channel-pill ${config.webhookConfigured ? "ready" : "waiting"}">Webhook ${config.webhookConfigured ? "configured" : "ready for configuration"}</span>
      <span class="channel-pill ${config.emailWebhookConfigured ? "ready" : "waiting"}">Email webhook ${config.emailWebhookConfigured ? "configured" : "not configured"}</span>
      <span class="channel-pill ${config.whatsapp.cloudConfigured ? "ready" : "waiting"}">Cloud API ${config.whatsapp.cloudConfigured ? "configured" : "not configured"}</span>
      <span class="channel-pill ${config.whatsapp.webTest.ready ? "ready" : "waiting"}">WhatsApp Web ${config.whatsapp.webTest.ready ? "connected" : config.whatsapp.webTest.status}</span>
      <span class="channel-pill">Last sweep ${esc(formatAutomationTime(state.automation.lastSweepAt))}</span>
      ${config.whatsapp.webTest.qrDataUrl ? `<img class="whatsapp-qr" src="${esc(config.whatsapp.webTest.qrDataUrl)}" alt="WhatsApp Web pairing QR code" />` : ""}
    `
    : `<span class="channel-pill">Sign in as concierge to inspect delivery channels</span>`;
  rows.innerHTML = state.notifications.slice(0, 16).map(item => `
    <tr>
      <td><strong>${esc(item.template || "message")}</strong><small>${esc(item.message || "Portal update")}</small></td>
      <td>${esc(item.caseId)}</td>
      <td>${esc(item.recipient)}<small>${esc(item.recipientPhone || item.recipientEmail || "Contact pending")}</small></td>
      <td>${esc(item.channel)}</td>
      <td>${Number(item.attempts || 0)}</td>
      <td><span class="status ${notificationStatusClass(item.status)}">${esc(item.status)}</span></td>
      <td>${state.role === "concierge" && ["waiting-channel", "failed"].includes(item.status) ? `<button class="mini-btn" data-retry-notification="${esc(item.id)}">Retry</button>` : ""}</td>
    </tr>
  `).join("");
  $("#runReminderSweep").hidden = state.role !== "concierge";
  $("#processNotifications").hidden = state.role !== "concierge";
  $("#connectWhatsappWeb").hidden = state.role !== "concierge" || Boolean(config?.whatsapp.webTest.ready);
}

function notificationStatusClass(status) {
  if (status === "delivered" || status === "read" || status === "sent") return "";
  if (status === "failed") return "overdue";
  return "waiting";
}

function formatAutomationTime(value) {
  if (!value) return "not run yet";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getTimeline(caseId) {
  return state.timeline[caseId] || [
    ["Today", "Journey record active", "The case is visible to authorised parties. AI is monitoring the next required action."],
    ["Earlier", "Account registered", "Axiom created the case and sent a WhatsApp welcome message."]
  ];
}

function renderCaseAccessLinks(caseId) {
  const links = (state.accessLinks || []).filter(item => item.caseId === caseId).slice(0, 5);
  if (!links.length) {
    return `<article class="timeline-event"><span>No links yet</span><strong>Generate your first secure link</strong><p>Each invited participant receives scoped access to this case only.</p></article>`;
  }
  return links.map(link => `
    <article class="timeline-event">
      <span>${esc(link.roleLabel || link.role)} ${link.active ? "active" : "inactive"}</span>
      <strong>${esc(link.name || "Participant")}</strong>
      <p>Created ${esc(formatAutomationTime(link.createdAt))}${link.usedAt ? ` · Used ${esc(formatAutomationTime(link.usedAt))}` : ""}${link.expiresAt ? ` · Expires ${esc(formatAutomationTime(link.expiresAt))}` : ""}</p>
      <div class="priority-buttons">
        ${link.active && link.accessToken ? `<button class="mini-btn" data-copy-access="${esc(link.accessToken)}">Copy link</button>` : ""}
        ${link.active ? `<button class="mini-btn" data-revoke-access="${esc(link.id)}">Revoke</button>` : ""}
      </div>
    </article>
  `).join("");
}

function getSuggestedParticipantName(caseItem, role) {
  if (!caseItem) return "";
  if (role === "seller" || role === "buyer") return caseItem.client || "";
  if (role === "agent") return caseItem.agent || "";
  if (role === "attorney") return caseItem.attorney || "";
  if (role === "finance") return caseItem.finance || "";
  return "";
}

function formatBirthdayLabel(value) {
  if (!value) return "Not set";
  if (/^\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return `${match[2]}-${match[3]}`;
  return value;
}

function renderGateChecklist(item) {
  const gates = item?.rulePack?.gates || [];
  if (!gates.length) return `<p class="empty-state">Control gates are not available for this case yet.</p>`;
  return `
    <div class="timeline">
      ${gates.map(gate => `
        <article class="timeline-event">
          <span>${esc(gate.owner)} · Escalate after ${esc(gate.escalateAfter || "policy window")}</span>
          <strong>${esc(gate.label)} · ${gate.completed ? "Ready" : "Pending"}</strong>
          <p>${gate.completed ? "Evidence confirmed." : `Missing evidence: ${esc((gate.missingEvidence || []).join(", ") || "Review required")}`}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderStakeholderHighlights(item) {
  const stakeholders = item?.rulePack?.stakeholders || item?.stakeholders || {};
  const rows = [
    ["SELL", stakeholders.SELL],
    ["BUY", stakeholders.BUY],
    ["AGENT", stakeholders.AGENT],
    ["TRANS", stakeholders.TRANS],
    ["ORIG", stakeholders.ORIG],
    ["CONC", stakeholders.CONC]
  ];
  return `
    <div class="summary-grid">
      ${rows.map(([code, name]) => `<div class="summary-box"><span>${esc(code)}</span><strong>${esc(name || "To appoint")}</strong></div>`).join("")}
    </div>
  `;
}

function openCase(caseId) {
  const item = state.cases.find(entry => entry.id === caseId) || state.cases[0];
  if (!item) return showToast("No case is available in this workspace.");
  state.activeCase = item.id;
  const canRemind = ["concierge", "agent", "attorney", "finance"].includes(state.role);
  $("#caseDrawerContent").innerHTML = `
    <header class="drawer-head">
      <p class="overline">${esc(item.id)} / ${esc(item.journey)} journey</p>
      <h2>${esc(item.client)}</h2>
      <p>${esc(item.property)} / ${esc(item.area)} / ${esc(item.value)}</p>
      <div class="progress-track"><span style="width:${item.progress}%"></span></div>
      <small>${item.progress}% complete / ${esc(item.stage)}</small>
    </header>
    <div class="drawer-body">
      <div class="summary-grid">
        <div class="summary-box"><span>Area specialist</span><strong>${esc(item.agent)}</strong></div>
        <div class="summary-box"><span>Concierge</span><strong>${esc(item.concierge)}</strong></div>
        <div class="summary-box"><span>Attorney</span><strong>${esc(item.attorney)}</strong></div>
      </div>
      <section class="next-step-card">
        <p class="overline">Immediate next action</p>
        <h3>${esc(item.next)}</h3>
        <p>Responsible: <strong>${esc(item.owner)}</strong> / Due: <strong>${esc(item.due)}</strong></p>
        ${canRemind ? `<button class="primary-btn small" data-remind="${esc(item.client)}" data-case-id="${esc(item.id)}">Send smart reminder</button>` : ""}
      </section>
      <section class="next-step-card">
        <p class="overline">Control gate</p>
        <h3><span class="status ${gateStatusClass(item.gateStatus)}">${esc(item.gateStatus || "in-progress")}</span></h3>
        <p>Active gate: <strong>${esc(item.activeGate || "Not identified yet")}</strong></p>
        ${renderGateChecklist(item)}
      </section>
      <div class="case-tabs"><button class="active">Timeline</button><button>Documents</button><button>Messages</button><button>Tasks</button><button>Audit log</button></div>
      <div class="timeline">
        ${getTimeline(item.id).map(([time,title,desc]) => `<article class="timeline-event"><span>${esc(time)}</span><strong>${esc(title)}</strong><p>${esc(desc)}</p></article>`).join("")}
        <article class="timeline-event future"><span>Upcoming</span><strong>${esc(item.next)}</strong><p>AI will keep all responsible parties informed before this becomes a delay.</p></article>
      </div>
    </div>
  `;
  $("#caseDrawer").classList.add("open");
  $("#modalBackdrop").classList.add("open");
  $("#caseDrawer").setAttribute("aria-hidden", "false");
  bindDynamicActions();
}

function closeDrawers() {
  $("#caseDrawer").classList.remove("open");
  $("#aiDrawer").classList.remove("open");
  $("#registrationModal").classList.remove("open");
  $("#modalBackdrop").classList.remove("open");
  $("#caseDrawer").setAttribute("aria-hidden", "true");
  $("#aiDrawer").setAttribute("aria-hidden", "true");
  $("#registrationModal").setAttribute("aria-hidden", "true");
}

function openAi() {
  const active = state.cases.find(item => item.id === state.activeCase);
  $("#aiContextText").textContent = active ? `Current context: ${active.id} · ${active.client} · Next: ${active.next}.` : "I can answer journey questions, explain documents and escalate sensitive matters.";
  $("#aiDrawer").classList.add("open");
  $("#modalBackdrop").classList.add("open");
  $("#aiDrawer").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#aiInput").focus(), 150);
}

async function handleAiQuestion(question) {
  if (!question.trim()) return;
  $("#aiMessages").insertAdjacentHTML("beforeend", `<div class="message user">${esc(question)}</div>`);
  const active = state.cases.find(item => item.id === state.activeCase) || state.cases[0];
  if (!active) {
    $("#aiMessages").insertAdjacentHTML("beforeend", `<div class="message ai">No active case is assigned to this workspace yet. A concierge can help create or assign one.</div>`);
    return;
  }
  try {
    const payload = await api("/api/os/ai/ask", {
      method: "POST",
      body: JSON.stringify({ caseId: active.id, question })
    });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    const reply = payload.ai?.answer || "I could not prepare a full answer right now. Please try again.";
    const tone = payload.ai?.escalated ? "escalation" : "ai";
    $("#aiMessages").insertAdjacentHTML("beforeend", `<div class="message ${tone}">${esc(reply)}</div>`);
    $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight;
  } catch (error) {
    $("#aiMessages").insertAdjacentHTML("beforeend", `<div class="message escalation">${esc(error.message || "I could not reach the concierge service right now.")}</div>`);
    $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight;
  }
}

function switchScreen(name) {
  if (name === "management" && state.role !== "concierge") {
    showToast("Management dashboard is available to concierge workspaces only.");
    name = "overview";
  }
  $$(".screen").forEach(screen => screen.classList.toggle("active", screen.dataset.screen === name));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "automation") refreshAutomationStatus();
}

function bindDynamicActions() {
  $$("[data-open-case]").forEach(button => button.onclick = () => openCase(button.dataset.openCase));
  $$("[data-remind]").forEach(button => button.onclick = async () => {
    const caseId = button.dataset.caseId || state.activeCase;
    try {
      const payload = await api(`/api/os/cases/${encodeURIComponent(caseId)}/reminders`, {
        method: "POST",
        body: JSON.stringify({ recipient: button.dataset.remind })
      });
      applyOperationsStore(payload.store);
      renderOperatingViews();
      if ($("#caseDrawer").classList.contains("open")) openCase(caseId);
      showToast(`WhatsApp reminder queued for ${button.dataset.remind}. Timeline updated.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  $$("[data-resolve]").forEach(button => button.onclick = async () => {
    try {
      const payload = await api(`/api/os/cases/${encodeURIComponent(button.dataset.resolveCase)}/resolve`, {
        method: "POST",
        body: JSON.stringify({ issue: button.dataset.resolve })
      });
      applyOperationsStore(payload.store);
      renderOperatingViews();
      showToast(`Marked "${button.dataset.resolve}" as resolved. Audit trail updated.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  $$("[data-doc-action]").forEach(button => button.onclick = async () => {
    const action = button.textContent.trim().toLowerCase();
    try {
      const payload = await api("/api/os/documents/action", {
        method: "POST",
        body: JSON.stringify({ name: button.dataset.docAction, action })
      });
      applyOperationsStore(payload.store);
      renderOperatingViews();
      showToast(`${button.textContent} action recorded for ${button.dataset.docAction}.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  $$("[data-upload-doc]").forEach(button => button.onclick = () => {
    state.uploadDocumentId = button.dataset.uploadDoc;
    $("#documentUploadInput").click();
  });
  $$("[data-download-doc]").forEach(button => button.onclick = () => downloadDocument(button.dataset.downloadDoc));
  $$("[data-retry-notification]").forEach(button => button.onclick = async () => {
    try {
      const payload = await api(`/api/os/notifications/${encodeURIComponent(button.dataset.retryNotification)}/retry`, { method: "POST", body: "{}" });
      applyOperationsStore(payload.store);
      renderOperatingViews();
      await refreshAutomationStatus();
      showToast(`Delivery retry completed with status: ${payload.notification.status}.`);
    } catch (error) {
      showToast(error.message);
    }
  });
  $$("[data-revoke-access]").forEach(button => button.onclick = async () => {
    const id = button.dataset.revokeAccess;
    try {
      const payload = await api(`/api/os/access-links/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
        body: "{}"
      });
      applyOperationsStore(payload.store);
      renderOperatingViews();
      if ($("#caseDrawer").classList.contains("open")) openCase(state.activeCase);
      showToast("Secure link revoked.");
    } catch (error) {
      showToast(error.message);
    }
  });
  $$("[data-copy-access]").forEach(button => button.onclick = async () => {
    const url = buildAccessUrl(button.dataset.copyAccess || "");
    if (!button.dataset.copyAccess) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showToast("Secure link copied.");
        return;
      } catch {
        // Fall back to toast with link if clipboard is blocked.
      }
    }
    showToast(`Secure link: ${url}`);
  });
  $$("[data-copy-brief]").forEach(button => button.onclick = async () => {
    const text = button.dataset.copyBrief || "";
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Update copied.");
        return;
      } catch {
        // Fall back to toast preview when clipboard is blocked.
      }
    }
    showToast(text);
  });
}

$$(".nav-item").forEach(button => button.addEventListener("click", () => switchScreen(button.dataset.view)));
$$("[data-view-link]").forEach(button => button.addEventListener("click", () => switchScreen(button.dataset.viewLink)));
$$("[data-open-ai]").forEach(button => button.addEventListener("click", openAi));
$("#openPartnerStudio")?.addEventListener("click", () => {
  switchScreen("partners");
  setTimeout(() => {
    $(".partner-access-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#studioAccessName")?.focus();
  }, 120);
});
$("#closeCaseDrawer").addEventListener("click", closeDrawers);
$("#closeAiDrawer").addEventListener("click", closeDrawers);
$("#modalBackdrop").addEventListener("click", closeDrawers);
$("#roleSwitcher").addEventListener("change", event => {
  event.target.value = state.role;
  showToast("Sign out and use another authorised demo workspace to change roles.");
});
$("#logoutButton").addEventListener("click", signOut);
$("#caseFilters").addEventListener("click", event => {
  if (!event.target.dataset.caseFilter) return;
  state.caseFilter = event.target.dataset.caseFilter;
  $$("#caseFilters .filter-chip").forEach(chip => chip.classList.toggle("active", chip === event.target));
  renderCases();
  bindDynamicActions();
});
$("#documentFilters").addEventListener("click", event => {
  if (!event.target.dataset.docFilter) return;
  state.docFilter = event.target.dataset.docFilter;
  $$("#documentFilters .filter-chip").forEach(chip => chip.classList.toggle("active", chip === event.target));
  renderDocuments();
  bindDynamicActions();
});
$("#caseSearch").addEventListener("input", event => { state.search = event.target.value; renderCases(); bindDynamicActions(); });
$("#simulateJourney").addEventListener("click", async () => {
  state.simulatedMilestone += 1;
  try {
    const payload = await api("/api/os/simulate", { method: "POST", body: JSON.stringify({ caseId: state.activeCase }) });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    showToast(`Simulation complete: next milestone prepared, document requests queued and timeline notifications created.`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#playbookCaseSelect").addEventListener("change", event => {
  state.playbookCaseId = event.target.value;
  state.activeCase = event.target.value;
  state.recoveryCaseId = event.target.value;
  state.playbookMilestoneId = null;
  renderPlaybookConsole();
  renderRecoveryConsole();
});
$("#playbookMilestoneSelect").addEventListener("change", event => {
  state.playbookMilestoneId = event.target.value;
  renderPlaybookConsole();
});
$("#recoveryCaseSelect").addEventListener("change", event => {
  state.recoveryCaseId = event.target.value;
  state.activeCase = event.target.value;
  renderRecoveryConsole();
});
$("#runRecoveryPlan").addEventListener("click", async () => {
  const caseId = state.recoveryCaseId || state.playbookCaseId || state.activeCase;
  if (!caseId) return showToast("Select a case first.");
  try {
    const payload = await api(`/api/os/cases/${encodeURIComponent(caseId)}/recovery-plan`);
    state.recoveryPlans[caseId] = payload.recoveryPlan;
    renderRecoveryConsole();
    showToast(`Recovery intelligence updated: ${payload.recoveryPlan.risk.band.toUpperCase()} risk (${payload.recoveryPlan.risk.score}/100).`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#queueRecoveryPlan").addEventListener("click", async () => {
  const caseId = state.recoveryCaseId || state.playbookCaseId || state.activeCase;
  if (!caseId) return showToast("Select a case first.");
  try {
    const payload = await api(`/api/os/cases/${encodeURIComponent(caseId)}/recovery/queue`, {
      method: "POST",
      body: "{}"
    });
    applyOperationsStore(payload.store);
    if (payload.recoveryPlan) state.recoveryPlans[caseId] = payload.recoveryPlan;
    renderOperatingViews();
    const queued = Number(payload.recoveryQueueSummary?.queued || 0);
    const fallback = Number(payload.recoveryQueueSummary?.fallbackQueued || 0);
    const owners = Number(payload.recoveryQueueSummary?.ownersTargeted || 0);
    showToast(`Next-best actions orchestrated for ${owners} owners: ${queued} direct, ${fallback} fallback.`);
  } catch (error) {
    showToast(error.message);
  }
});
async function prepareSelectedMilestone(advance = false) {
  const caseId = state.playbookCaseId || state.activeCase;
  if (!caseId) return showToast("Select a case before preparing a milestone.");
  try {
    const payload = await api(`/api/os/cases/${encodeURIComponent(caseId)}/playbook/prepare`, {
      method: "POST",
      body: JSON.stringify({ milestoneId: state.playbookMilestoneId, advance })
    });
    applyOperationsStore(payload.store);
    state.playbookMilestoneId = payload.result.milestone.id;
    renderOperatingViews();
    showToast(`${payload.result.milestone.title} prepared: ${payload.result.createdDocuments} document requests and ${payload.result.queuedNotifications} WhatsApp notices created.`);
  } catch (error) {
    showToast(error.message);
  }
}
$("#prepareMilestone").addEventListener("click", () => prepareSelectedMilestone(false));
$("#advanceMilestone").addEventListener("click", () => prepareSelectedMilestone(true));
$("#requestDocumentButton").addEventListener("click", async () => {
  const name = window.prompt("Which document should be requested?", "Additional supporting document");
  if (!name?.trim()) return;
  const item = state.cases.find(entry => entry.id === state.activeCase) || state.cases[0];
  if (!item) return showToast("Assign a case before requesting a document.");
  try {
    const payload = await api("/api/os/documents", {
      method: "POST",
      body: JSON.stringify({ caseId: item.id, name: name.trim(), owner: `${item.client} - ${item.owner}`, due: "Within 3 days" })
    });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    showToast(`${name.trim()} requested. WhatsApp and portal reminders queued.`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#notificationButton").addEventListener("click", () => showToast("12 notifications: 7 automated updates, 3 documents and 2 human interventions."));
$("#connectWhatsappWeb").addEventListener("click", async () => {
  try {
    showToast("Starting the WhatsApp Web bridge. A QR code will appear if pairing is required.");
    await api("/api/os/automation/whatsapp-web/start", { method: "POST", body: "{}" });
    await refreshAutomationStatus();
  } catch (error) {
    showToast(error.message);
  }
});
$("#runReminderSweep").addEventListener("click", async () => {
  try {
    const payload = await api("/api/os/automation/sweep", { method: "POST", body: "{}" });
    applyOperationsStore(payload.store);
    if (payload.summary?.phase2) state.lastPhase2Summary = payload.summary.phase2;
    renderOperatingViews();
    await refreshAutomationStatus();
    showToast(`Sweep complete: ${payload.summary.queued} reminders, ${payload.summary.movingServices?.queued || 0} moving offers, ${payload.summary.gates?.queued || 0} gate nudges, ${payload.summary.phase2?.roleBriefs?.queued || 0} phase-2 role briefs.`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#processNotifications").addEventListener("click", async () => {
  try {
    const payload = await api("/api/os/automation/process", { method: "POST", body: JSON.stringify({ forceRetry: true }) });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    await refreshAutomationStatus();
    showToast(`Queue processed: ${payload.summary.delivered} delivered, ${payload.summary.waiting} waiting, ${payload.summary.failed} failed.`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#newCaseButton").addEventListener("click", () => { $("#registrationModal").classList.add("open"); $("#modalBackdrop").classList.add("open"); });
$("#closeRegistration").addEventListener("click", closeDrawers);
$("#registrationForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const payload = await api("/api/os/cases", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    applyOperationsStore(payload.store);
    renderOperatingViews();
    closeDrawers();
    showToast(`${form.get("firstName")} ${form.get("surname")} registered. WhatsApp welcome and secure portal route queued.`);
    event.target.reset();
  } catch (error) {
    showToast(error.message);
  }
});
$("#aiForm").addEventListener("submit", event => { event.preventDefault(); handleAiQuestion($("#aiInput").value); $("#aiInput").value = ""; });
$$("[data-prompt]").forEach(button => button.addEventListener("click", () => handleAiQuestion(button.dataset.prompt)));
$("#documentUploadInput").addEventListener("change", event => uploadDocument(event.target.files?.[0]));
$("#demoAccount").addEventListener("change", event => {
  const option = event.target.options[event.target.selectedIndex];
  $("#loginCellphone").value = option.value;
  $("#loginPin").value = option.dataset.pin || "";
});
$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const option = $("#demoAccount").options[$("#demoAccount").selectedIndex];
    await signIn($("#loginCellphone").value, $("#loginPin").value, option.dataset.profileId || "");
  } catch (error) {
    showToast(error.message);
  }
});
$("#requestOtpButton").addEventListener("click", async () => {
  const cellphone = ($("#loginCellphone")?.value || "").trim();
  if (!cellphone) {
    showToast("Enter your cellphone number first.");
    return;
  }
  try {
    const option = $("#demoAccount").options[$("#demoAccount").selectedIndex];
    const payload = await requestOtp(cellphone, option.dataset.profileId || "");
    const expiresAt = payload.expiresAt ? formatAutomationTime(payload.expiresAt) : "soon";
    showToast(`OTP sent. Enter the code before ${expiresAt}.`);
  } catch (error) {
    showToast(error.message);
  }
});
$("#verifyOtpButton").addEventListener("click", async () => {
  const code = ($("#loginOtpCode")?.value || "").trim();
  if (!code) {
    showToast("Enter the OTP code first.");
    return;
  }
  try {
    await verifyOtp(code);
  } catch (error) {
    showToast(error.message);
  }
});
$("#accessTokenLoginButton").addEventListener("click", async () => {
  const token = ($("#loginAccessToken")?.value || "").trim();
  if (!token) {
    showToast("Paste a secure access token first.");
    return;
  }
  try {
    await signInWithAccessToken(token);
  } catch (error) {
    showToast(error.message);
  }
});
$("#studioAccessCase")?.addEventListener("change", () => updateStudioRoleDefaults());
$("#studioAccessRole")?.addEventListener("change", () => updateStudioRoleDefaults());
$("#studioCreateAccess")?.addEventListener("click", () => createStudioAccessLink());
$("#studioCopyLink")?.addEventListener("click", async () => {
  if (!state.studioLastAccessUrl) {
    showToast("Generate a secure link first.");
    return;
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(state.studioLastAccessUrl);
      showToast("Secure link copied.");
      return;
    } catch {
      // Fall back to toast preview when clipboard is blocked.
    }
  }
  showToast(`Secure link: ${state.studioLastAccessUrl}`);
});
$("#studioShowQr")?.addEventListener("click", () => showStudioQrCode());
$("#runPhase2Automation")?.addEventListener("click", () => runPhase2Automation());
$("#exportWeeklySummary")?.addEventListener("click", () => exportWeeklySummary());

renderJourney();
renderPartners();
renderAutomations();
bootstrapOperations();
