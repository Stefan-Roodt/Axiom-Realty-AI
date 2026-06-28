const portalRole = document.getElementById("portalRole");
const portalHeading = document.getElementById("portalHeading");
const portalIntro = document.getElementById("portalIntro");
const stakeholderStatus = document.getElementById("stakeholderStatus");
const stakeholderLeadSummary = document.getElementById("stakeholderLeadSummary");
const stakeholderUpdateCard = document.getElementById("stakeholderUpdateCard");
const stakeholderUpdateForm = document.getElementById("stakeholderUpdateForm");
const stakeholderDealStatus = document.getElementById("stakeholderDealStatus");
const stakeholderContactMedium = document.getElementById("stakeholderContactMedium");
const stakeholderNextCheckIn = document.getElementById("stakeholderNextCheckIn");
const stakeholderDealStatusLabel = document.getElementById("stakeholderDealStatusLabel");
const stakeholderContactMediumLabel = document.getElementById("stakeholderContactMediumLabel");
const stakeholderNextCheckInLabel = document.getElementById("stakeholderNextCheckInLabel");
const stakeholderNoteLabel = document.getElementById("stakeholderNoteLabel");
const stakeholderNote = document.getElementById("stakeholderNote");
const stakeholderSubmit = document.getElementById("stakeholderSubmit");
const stakeholderFormTitle = document.getElementById("stakeholderFormTitle");
const stakeholderFormHint = document.getElementById("stakeholderFormHint");
const stakeholderPromptDeck = document.getElementById("stakeholderPromptDeck");

const token = new URLSearchParams(window.location.search).get("token") || "";
let currentLead = null;
let currentAccess = null;

function esc(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message, isError = false) {
  stakeholderStatus.textContent = message;
  stakeholderStatus.classList.toggle("error-note", isError);
}

function populateSelect(select, options) {
  const initial = select.innerHTML;
  select.innerHTML = initial + (options || []).map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
}

function formatPortalDate(value, fallback = "Not yet") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString();
}

function formatPortalDateShort(value, fallback = "Not set") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString();
}

function getPortalPulse(lead) {
  const timeline = lead.transactionTimeline || {};
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const current = timeline.currentMilestone || null;
  const next = timeline.nextMilestone || null;

  if (!next && timeline.state === "complete") {
    return {
      tone: "complete",
      label: "Completed",
      title: "This journey is complete.",
      detail: "Registration and handover are done. The record remains available for clarity and proof."
    };
  }
  if (missingDocs.length) {
    return {
      tone: "docs",
      label: "Action needed",
      title: "We are still waiting on documents.",
      detail: `Outstanding now: ${missingDocs.join(", ")}.`
    };
  }
  if (timeline.state === "near-registration") {
    return {
      tone: "near",
      label: "Near registration",
      title: current ? `${current.label} is complete.` : "The journey is close to registration.",
      detail: next ? `Next: ${next.label}${next.owner ? ` (${next.owner})` : ""}.` : "Final completion steps are underway."
    };
  }
  return {
    tone: "live",
    label: "In motion",
    title: current ? `${current.label} is complete.` : "Your matter is actively in progress.",
    detail: next ? `Next: ${next.label}${next.owner ? ` (${next.owner})` : ""}.` : "Axiom is tracking the next move."
  };
}

function getRoleConfig(role, lead) {
  const timeline = lead.transactionTimeline || {};
  const next = timeline.nextMilestone || null;
  const nextLabel = next?.label || "the next transaction milestone";
  const nextOwner = next?.owner || "the responsible party";
  const assignedAgent = lead.assignedAgent || {};
  const clientName = lead.lead?.fullName || "the client";
  const configs = {
    buyer: {
      heading: "Buyer portal. Clear progress, no guesswork.",
      intro: "Track finance readiness, signing progress, and the next move without chasing different people for updates.",
      formTitle: "Share a buyer-side update",
      formHint: "Use this when finance, signing, viewing, or availability has changed.",
      noteLabel: "Buyer-side update",
      notePlaceholder: "Share any finance, signing, viewing, or availability update that will help the team move the purchase forward.",
      formControls: {
        showStatus: false,
        showMedium: true,
        showNextCheckIn: true,
        mediumLabel: "Best contact channel (optional)",
        nextCheckInLabel: "Preferred next check-in (optional)"
      },
      laneTitle: "What you most need to watch",
      laneText: `Stay aligned on ${nextLabel} and flag anything that could slow finance or signing.`,
      updatePrompts: [
        { label: "Finance ready", note: "Buyer finance readiness confirmed and still on track for the next step.", medium: "Phone call" },
        { label: "Docs sent", note: "Buyer-side documents have been shared and are ready for review.", medium: "Email" },
        { label: "Delay risk", note: "Buyer-side delay risk identified. Please review the blocker and revised timing.", medium: "WhatsApp" }
      ]
    },
    seller: {
      heading: "Seller portal. Sale progress with the right detail.",
      intro: "See where the sale sits, what documents matter next, and what could delay transfer or handover.",
      formTitle: "Share a seller-side update",
      formHint: "Use this when compliance, signatures, access, or handover readiness has changed.",
      noteLabel: "Seller-side update",
      notePlaceholder: "Share any compliance, signing, access, or handover update that will help the sale move cleanly forward.",
      formControls: {
        showStatus: false,
        showMedium: true,
        showNextCheckIn: true,
        mediumLabel: "Best contact channel (optional)",
        nextCheckInLabel: "Expected next seller touchpoint (optional)"
      },
      laneTitle: "What you most need to watch",
      laneText: `Keep ${nextLabel} moving and flag any seller-side delay before it impacts transfer.`,
      updatePrompts: [
        { label: "Compliance ready", note: "Seller-side compliance items are ready or booked. Please proceed with the next transfer step.", medium: "Phone call" },
        { label: "Handover planning", note: "Handover readiness has been discussed and the expected timing is now clearer.", medium: "WhatsApp" },
        { label: "Seller blocker", note: "A seller-side blocker needs attention before the file can move cleanly to the next step.", medium: "Phone call" }
      ]
    },
    agent: {
      heading: "Agent portal. Keep contact, offers, and proof in motion.",
      intro: "This view is built for the receiving agent: fast visibility, clean updates, and clear proof for every major move.",
      formTitle: "Share an agent update",
      formHint: "Use this to confirm contact, offers, viewings, or any movement that changes the case status.",
      noteLabel: "Agent progress update",
      notePlaceholder: "Share a dated client-contact, viewing, offer, or proof update so the case stays current.",
      formControls: {
        showStatus: true,
        showMedium: true,
        showNextCheckIn: true,
        statusLabel: "Deal movement (optional)",
        mediumLabel: "Client contact channel (optional)",
        nextCheckInLabel: "Next client check-in (optional)"
      },
      laneTitle: "What you most need to watch",
      laneText: assignedAgent.name
        ? `${assignedAgent.name} should keep ${nextLabel} moving and make every client touchpoint visible.`
        : `Keep ${clientName} contact and ${nextLabel} clearly updated in the case.`,
      updatePrompts: [
        { label: "Client contacted", note: "Client contact confirmed. Next appointment or callback window has been agreed.", status: "Active", medium: "WhatsApp" },
        { label: "Viewing booked", note: "A viewing or valuation has been booked and the case is moving to the next live step.", status: "Viewing/valuation booked", medium: "Phone call" },
        { label: "Offer progress", note: "Offer progress updated. Please review the latest position and any required proof.", status: "Offer pending", medium: "Email" }
      ]
    },
    attorney: {
      heading: "Attorney portal. Transfer visibility without noise.",
      intro: "Track instruction, documents, lodgement, and registration timing in one place, with the next blocker easy to spot.",
      formTitle: "Share a transfer update",
      formHint: "Use this when instruction, signing, lodgement, registration, or legal blockers have changed.",
      noteLabel: "Transfer / legal update",
      notePlaceholder: "Share a legal, lodgement, document, or registration update that affects the transfer timeline.",
      formControls: {
        showStatus: true,
        showMedium: false,
        showNextCheckIn: true,
        statusLabel: "Transfer status (optional)",
        nextCheckInLabel: "Next transfer checkpoint (optional)"
      },
      laneTitle: "What you most need to watch",
      laneText: `The file is watching ${nextLabel}. If timing slips, flag it early so Axiom can manage expectations.`,
      updatePrompts: [
        { label: "Instruction received", note: "Transfer instruction is in hand and the file is moving through the next legal step.", status: "Active" },
        { label: "Lodgement progress", note: "Transfer progress updated. Lodgement or registration timing has been clarified.", status: "Under contract" },
        { label: "Legal blocker", note: "A transfer blocker needs attention. Please review the document or timing issue now.", status: "Disputed" }
      ]
    },
    "bond-originator": {
      heading: "Bond portal. Finance movement made visible.",
      intro: "Keep approvals, guarantees, and buyer finance risk visible before they ripple into transfer delays.",
      formTitle: "Share a finance update",
      formHint: "Use this when approval, conditions, guarantees, or finance blockers have changed.",
      noteLabel: "Finance update",
      notePlaceholder: "Share a bond, approval, guarantee, or finance-risk update that affects the transaction timing.",
      formControls: {
        showStatus: true,
        showMedium: false,
        showNextCheckIn: true,
        statusLabel: "Finance status (optional)",
        nextCheckInLabel: "Next finance checkpoint (optional)"
      },
      laneTitle: "What you most need to watch",
      laneText: `The file is waiting on ${nextLabel}. Surface finance blockers before they become transfer blockers.`,
      updatePrompts: [
        { label: "Application moving", note: "Bond application progress has moved forward and the next finance step is clear.", status: "Active" },
        { label: "Approval conditions", note: "Approval conditions have been updated. Please review what remains outstanding.", status: "Under contract" },
        { label: "Finance blocker", note: "A finance-side blocker needs attention before the matter can move cleanly forward.", status: "Disputed" }
      ]
    }
  };

  return configs[role] || {
    heading: "Shared portal. One live case view.",
    intro: "Track the live case, see the next move, and keep the shared record current with useful updates.",
    formTitle: "Share a progress update",
    formHint: "Use this when anything changes that the wider team should know.",
    noteLabel: "Progress update",
    notePlaceholder: "Share a clear, dated update that helps the wider team stay aligned.",
    formControls: {
      showStatus: true,
      showMedium: true,
      showNextCheckIn: true,
      statusLabel: "Deal status (optional)",
      mediumLabel: "Contact medium (optional)",
      nextCheckInLabel: "Next check-in (optional)"
    },
    laneTitle: "What you most need to watch",
    laneText: `Keep ${nextLabel} current and flag any blocker early.`,
    updatePrompts: [
      { label: "Status update", note: "A useful shared progress update has been captured for the case.", status: "Active", medium: "WhatsApp" }
    ]
  };
}

function getPortalHealthCards(lead, roleConfig) {
  const timeline = lead.transactionTimeline || {};
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates : [];
  const stageUpdates = Array.isArray(lead.stageUpdateNotifications) ? lead.stageUpdateNotifications : [];
  const current = timeline.currentMilestone?.label || "Not started";
  const next = timeline.nextMilestone?.label || "Complete";
  return [
    { label: "Current step", value: current, note: "Latest recorded milestone" },
    { label: "Next move", value: next, note: roleConfig.laneText },
    { label: "Docs waiting", value: missingDocs.length ? `${missingDocs.length} open` : "Clear", note: missingDocs.length ? missingDocs.join(", ") : "No required gaps right now", tone: missingDocs.length ? "warn" : "good" },
    { label: "Shared updates", value: `${updates.length} saved`, note: stageUpdates.length ? `${stageUpdates.length} stage messages logged` : "No stage messages yet" }
  ];
}

function getRoleSummaryCards(lead, access) {
  const detail = lead.lead || {};
  const assigned = lead.assignedAgent || {};
  const lifecycle = lead.lifecycle || {};
  const deal = lead.dealProtection || {};
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates : [];
  const currentMilestone = lead.portalBrief?.currentMilestone || lead.transactionTimeline?.currentMilestone || null;
  const nextMilestone = lead.portalBrief?.nextMilestone || lead.transactionTimeline?.nextMilestone || null;
  const lastUpdate = formatPortalDateShort(updates.length ? updates[updates.length - 1]?.at : lead.updatedAt, "Not yet");
  const role = lead.role || access.role || "stakeholder";

  const cardsByRole = {
    buyer: [
      ["Client", detail.fullName],
      ["Area", detail.area],
      ["Price", detail.price],
      ["Property type", detail.propertyType],
      ["Timeline", detail.timeline],
      ["Stage", lifecycle.label || "In progress"],
      ["Receiving agent", assigned.name || "Not assigned"],
      ["Last update", lastUpdate]
    ],
    seller: [
      ["Client", detail.fullName],
      ["Area", detail.area],
      ["Price", detail.price],
      ["Property type", detail.propertyType],
      ["Timeline", detail.timeline],
      ["Stage", lifecycle.label || "In progress"],
      ["Deal status", deal.status || "Active"],
      ["Last update", lastUpdate]
    ],
    agent: [
      ["Client", detail.fullName],
      ["WhatsApp", detail.whatsapp],
      ["Email", detail.email],
      ["Area", detail.area],
      ["Timeline", detail.timeline],
      ["Stage", lifecycle.label || "In progress"],
      ["Deal status", deal.status || "Active"],
      ["Commission status", deal.commissionAgreement || "Not discussed"],
      ["Last update", lastUpdate]
    ],
    attorney: [
      ["Client", detail.fullName],
      ["Area", detail.area],
      ["Price", detail.price],
      ["Stage", lifecycle.label || "In progress"],
      ["Current milestone", currentMilestone?.label || "Not started"],
      ["Next milestone", nextMilestone?.label || "Complete"],
      ["Receiving agent", assigned.name || "Not assigned"],
      ["Last update", lastUpdate]
    ],
    "bond-originator": [
      ["Client", detail.fullName],
      ["Price", detail.price],
      ["Timeline", detail.timeline],
      ["Stage", lifecycle.label || "In progress"],
      ["Deal status", deal.status || "Active"],
      ["Next milestone", nextMilestone?.label || "Complete"],
      ["Receiving agent", assigned.name || "Not assigned"],
      ["Last update", lastUpdate]
    ]
  };

  return (cardsByRole[role] || [
    ["Client", detail.fullName],
    ["Area", detail.area],
    ["Price", detail.price],
    ["Stage", lifecycle.label || "In progress"],
    ["Last update", lastUpdate]
  ]).map(([label, value]) => ({ label, value: value || "Not provided" }));
}

function renderRoleSummaryGrid(cards) {
  return `
    <div class="agent-summary-grid">
      ${cards
        .map(
          (card) => `
            <div>
              <span>${esc(card.label)}</span>
              <strong>${esc(card.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function applyRoleFormConfig(roleConfig) {
  const controls = roleConfig.formControls || {};
  if (stakeholderDealStatusLabel) {
    stakeholderDealStatusLabel.hidden = !controls.showStatus;
    stakeholderDealStatusLabel.firstChild.textContent = `${controls.statusLabel || "Deal status (optional)"}\n              `;
    if (!controls.showStatus && stakeholderDealStatus) stakeholderDealStatus.value = "";
  }
  if (stakeholderContactMediumLabel) {
    stakeholderContactMediumLabel.hidden = !controls.showMedium;
    stakeholderContactMediumLabel.firstChild.textContent = `${controls.mediumLabel || "Contact medium (optional)"}\n              `;
    if (!controls.showMedium && stakeholderContactMedium) stakeholderContactMedium.value = "";
  }
  if (stakeholderNextCheckInLabel) {
    stakeholderNextCheckInLabel.hidden = !controls.showNextCheckIn;
    stakeholderNextCheckInLabel.firstChild.textContent = `${controls.nextCheckInLabel || "Next check-in (optional)"}\n              `;
    if (!controls.showNextCheckIn && stakeholderNextCheckIn) stakeholderNextCheckIn.value = "";
  }
  if (stakeholderNoteLabel) {
    stakeholderNoteLabel.firstChild.textContent = `${roleConfig.noteLabel || "Progress update"}\n            `;
  }
  if (stakeholderNote) {
    stakeholderNote.placeholder = roleConfig.notePlaceholder || "Share an update so all parties remain aligned and informed.";
  }
}

function renderPortalHealthCards(cards) {
  return `
    <div class="portal-health-grid">
      ${cards
        .map(
          (card) => `
            <article class="portal-health-card ${esc(card.tone || "")}">
              <span>${esc(card.label)}</span>
              <strong>${esc(card.value)}</strong>
              <small>${esc(card.note || "")}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderPortalTimeline(timeline) {
  const milestones = Array.isArray(timeline?.milestones) ? timeline.milestones : [];
  if (!milestones.length) return `<div class="small-note">No timeline milestones yet.</div>`;
  return `
    <div class="portal-timeline">
      ${milestones
        .map(
          (item) => `
            <article class="portal-step ${item.complete ? "complete" : "pending"}">
              <div class="portal-step-marker">${item.complete ? "OK" : item.order}</div>
              <div class="portal-step-copy">
                <strong>${esc(item.label)}</strong>
                <span>${esc(item.phase || "Transaction")} | ${esc(item.owner || "Axiom")}</span>
                <small>${
                  item.complete
                    ? esc(`${formatPortalDate(item.completedAt)}${item.note ? ` | ${item.note}` : ""}`)
                    : esc("Waiting for evidence or owner action.")
                }</small>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRoleChecklist(lead, roleConfig, access) {
  const timeline = lead.transactionTimeline || {};
  const currentMilestone = lead.portalBrief?.currentMilestone || timeline.currentMilestone || null;
  const nextMilestone = lead.portalBrief?.nextMilestone || timeline.nextMilestone || null;
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const documents = Array.isArray(lead.leadDocuments) ? lead.leadDocuments.slice().reverse().slice(0, 4) : [];
  return `
    <div class="portal-checklist-grid">
      <section class="portal-panel">
        <h3>What is done</h3>
        <div class="small-note">${esc(currentMilestone ? currentMilestone.label : "No milestone completed yet.")}</div>
        <div class="small-note">${esc(currentMilestone?.completedAt ? formatPortalDate(currentMilestone.completedAt) : "Waiting for first recorded milestone.")}</div>
      </section>
      <section class="portal-panel">
        <h3>What you should watch</h3>
        <div class="small-note">${esc(roleConfig.laneTitle)}</div>
        <div class="small-note">${esc(roleConfig.laneText)}</div>
      </section>
      <section class="portal-panel">
        <h3>Document readiness</h3>
        <div class="small-note">${esc(missingDocs.length ? `Still needed: ${missingDocs.join(", ")}` : "No required documents are currently missing.")}</div>
        <div class="small-note">${esc(documents.length ? `${documents.length} recent document item(s) visible in the record.` : "No recent document uploads visible yet.")}</div>
      </section>
      <section class="portal-panel">
        <h3>Your portal lane</h3>
        <div class="small-note">${esc(access.roleLabel || "Stakeholder")}</div>
        <div class="small-note">${esc(lead.portalBrief?.focus || "Shared case visibility and updates.")}</div>
      </section>
      <section class="portal-panel">
        <h3>Next owner</h3>
        <div class="small-note">${esc(nextMilestone?.owner || "No further owner action required.")}</div>
        <div class="small-note">${esc(nextMilestone?.label || "Journey complete")}</div>
      </section>
      <section class="portal-panel">
        <h3>Best update to share</h3>
        <div class="small-note">${esc(roleConfig.formHint)}</div>
        <div class="small-note">Short, dated, specific updates help every party stay aligned.</div>
      </section>
    </div>
  `;
}

function renderPortalPeople(lead, access) {
  const detail = lead.lead || {};
  const assigned = lead.assignedAgent || {};
  const nextMilestone = lead.portalBrief?.nextMilestone || lead.transactionTimeline?.nextMilestone || null;
  return `
    <section class="portal-panel">
      <h3>Who is moving this case</h3>
      <div class="portal-people-grid">
        <div class="portal-person-card">
          <span>Client</span>
          <strong>${esc(detail.fullName)}</strong>
          <small>${esc(detail.whatsapp || "Contact not shared")}</small>
        </div>
        <div class="portal-person-card">
          <span>Receiving agent</span>
          <strong>${esc(assigned.name || "Not assigned")}</strong>
          <small>${esc(assigned.agency || "Agency not captured")}</small>
        </div>
        <div class="portal-person-card">
          <span>Your access</span>
          <strong>${esc(access.name || access.roleLabel || "Stakeholder")}</strong>
          <small>${esc(access.phone || access.email || "Secure portal access active")}</small>
        </div>
        <div class="portal-person-card">
          <span>Next owner</span>
          <strong>${esc(nextMilestone?.owner || "Axiom Concierge")}</strong>
          <small>${esc(nextMilestone?.label || "Journey complete")}</small>
        </div>
      </div>
    </section>
  `;
}

function renderPortalDocumentBoard(lead) {
  const requiredDocs = Array.isArray(lead.requiredLeadDocuments) ? lead.requiredLeadDocuments : [];
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const documents = Array.isArray(lead.leadDocuments) ? lead.leadDocuments.slice().reverse().slice(0, 6) : [];
  return `
    <div class="portal-doc-grid">
      <section class="portal-panel">
        <h3>Required now</h3>
        ${
          requiredDocs.length
            ? requiredDocs.map((doc) => `<div class="portal-chip-row">${esc(doc)}</div>`).join("")
            : `<div class="small-note">No mandatory documents currently unlocked.</div>`
        }
      </section>
      <section class="portal-panel">
        <h3>Still outstanding</h3>
        ${
          missingDocs.length
            ? missingDocs.map((doc) => `<div class="portal-chip-row warn">${esc(doc)}</div>`).join("")
            : `<div class="small-note">Nothing required is currently missing.</div>`
        }
      </section>
      <section class="portal-panel">
        <h3>Recent file activity</h3>
        ${
          documents.length
            ? documents
                .map(
                  (doc) => `
                    <div class="portal-log-item">
                      <strong>${esc(doc.category || "Document")}</strong>
                      <span>${esc(formatPortalDate(doc.uploadedAt))} | ${esc(doc.uploadedBy || "Concierge")}</span>
                      <small>${esc(doc.originalName || "file")}${doc.note ? ` | ${esc(doc.note)}` : ""}</small>
                    </div>
                  `
                )
                .join("")
            : `<div class="small-note">No document uploads are visible yet.</div>`
        }
      </section>
    </div>
  `;
}

function renderPortalUpdates(stageUpdates, stakeholderUpdates, proof) {
  const stage = Array.isArray(stageUpdates) ? stageUpdates.slice(0, 4) : [];
  const shared = Array.isArray(stakeholderUpdates) ? stakeholderUpdates.slice().reverse().slice(0, 4) : [];
  const trail = Array.isArray(proof) ? proof.slice().reverse().slice(0, 4) : [];

  return `
    <div class="portal-updates-grid">
      <section class="portal-panel">
        <h3>Recent progress messages</h3>
        ${
          stage.length
            ? stage
                .map(
                  (item) => `
                    <div class="portal-log-item">
                      <strong>${esc(item.label || "Progress update")}</strong>
                      <span>${esc(formatPortalDate(item.at))} | ${esc(`${item.delivered || 0}/${item.attempted || 0} delivered`)}</span>
                      ${item.note ? `<small>${esc(item.note)}</small>` : ""}
                    </div>
                  `
                )
                .join("")
            : `<div class="small-note">No customer-facing stage messages have been logged yet.</div>`
        }
      </section>
      <section class="portal-panel">
        <h3>Shared updates</h3>
        ${
          shared.length
            ? shared
                .map(
                  (item) => `
                    <div class="portal-log-item">
                      <strong>${esc(item.roleLabel || item.role || "Stakeholder")}</strong>
                      <span>${esc(formatPortalDate(item.at))}</span>
                      <small>${esc(item.note || "")}${item.advisoryOnly ? " | Advisory only until concierge review" : ""}</small>
                    </div>
                  `
                )
                .join("")
            : `<div class="small-note">No stakeholder updates yet.</div>`
        }
      </section>
      <section class="portal-panel">
        <h3>Audit trail</h3>
        ${
          trail.length
            ? trail
                .map(
                  (item) => `
                    <div class="portal-log-item">
                      <strong>${esc(item.summary || "Recorded event")}</strong>
                      <span>${esc(formatPortalDate(item.at))} | ${esc(item.actor || "System")}</span>
                    </div>
                  `
                )
                .join("")
            : `<div class="small-note">No audit events recorded yet.</div>`
        }
      </section>
    </div>
  `;
}

function renderPromptDeck(prompts) {
  if (!stakeholderPromptDeck) return;
  stakeholderPromptDeck.innerHTML = (prompts || [])
    .map(
      (item) => `
        <button
          class="portal-prompt-chip"
          type="button"
          data-prompt-note="${esc(item.note || "")}"
          data-prompt-status="${esc(item.status || "")}"
          data-prompt-medium="${esc(item.medium || "")}"
        >${esc(item.label || "Prompt")}</button>
      `
    )
    .join("");

  stakeholderPromptDeck.querySelectorAll("[data-prompt-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = button.getAttribute("data-prompt-note") || "";
      const status = button.getAttribute("data-prompt-status") || "";
      const medium = button.getAttribute("data-prompt-medium") || "";
      if (stakeholderNote && !stakeholderNote.value.trim()) {
        stakeholderNote.value = note;
      } else if (stakeholderNote) {
        stakeholderNote.value = note;
      }
      if (status && stakeholderDealStatus) stakeholderDealStatus.value = status;
      if (medium && stakeholderContactMedium) stakeholderContactMedium.value = medium;
      stakeholderNote?.focus();
      stakeholderNote?.setSelectionRange?.(stakeholderNote.value.length, stakeholderNote.value.length);
    });
  });
}

function renderLead(data) {
  const lead = data?.lead;
  const access = data?.access || {};
  if (!lead) return;
  currentLead = lead;
  currentAccess = access;

  const roleConfig = getRoleConfig(lead.role || access.role, lead);
  const detail = lead.lead || {};
  const lifecycle = lead.lifecycle || {};
  const deal = lead.dealProtection || {};
  const portalBrief = lead.portalBrief || {};
  const portalPolicy = lead.portalPolicy || {};
  const timeline = lead.transactionTimeline || {};
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates.slice() : [];
  const proof = Array.isArray(lead.proofTrail) ? lead.proofTrail.slice() : [];
  const stageUpdates = Array.isArray(lead.stageUpdateNotifications) ? lead.stageUpdateNotifications : [];
  const reminderLog = Array.isArray(lead.documentReminderLog) ? lead.documentReminderLog : [];
  const responsibilities = Array.isArray(portalBrief.responsibilities) ? portalBrief.responsibilities : [];
  const currentMilestone = portalBrief.currentMilestone || timeline.currentMilestone || null;
  const nextMilestone = portalBrief.nextMilestone || timeline.nextMilestone || null;
  const pulse = getPortalPulse(lead);
  const progressValue = Number.isFinite(Number(portalBrief.progress ?? timeline.progress)) ? `${portalBrief.progress ?? timeline.progress}%` : "0%";

  if (portalRole) portalRole.textContent = `${access.roleLabel || "Stakeholder"} Portal`;
  if (portalHeading) portalHeading.textContent = roleConfig.heading;
  if (portalIntro) portalIntro.textContent = roleConfig.intro;
  if (stakeholderFormTitle) stakeholderFormTitle.textContent = roleConfig.formTitle;
  if (stakeholderFormHint) stakeholderFormHint.textContent = roleConfig.formHint;
  applyRoleFormConfig(roleConfig);
  renderPromptDeck(roleConfig.updatePrompts);

  stakeholderLeadSummary.innerHTML = `
    <p class="eyebrow">${esc((lead.intent || "unknown").toUpperCase())} Lead</p>
    <h2>${esc(lead.snapshot || "Shared lead brief")}</h2>
    <div class="portal-hero-band ${esc(pulse.tone)}">
      <div>
        <span class="portal-hero-label">${esc(pulse.label)}</span>
        <strong>${esc(pulse.title)}</strong>
        <p>${esc(pulse.detail)}</p>
      </div>
      <div class="portal-hero-progress">
        <b>${esc(progressValue)}</b>
        <span>progress</span>
      </div>
    </div>
    ${renderPortalHealthCards(getPortalHealthCards(lead, roleConfig))}
    <div class="stakeholder-role-brief">
      <div>
        <span>Portal focus</span>
        <strong>${esc(portalBrief.title || `${access.roleLabel || "Stakeholder"} Portal`)}</strong>
        <p>${esc(portalBrief.focus || "Shared transaction visibility and progress updates.")}</p>
      </div>
      <div>
        <span>Current progress</span>
        <strong>${esc(Number.isFinite(Number(portalBrief.progress ?? timeline.progress)) ? `${portalBrief.progress ?? timeline.progress}% complete` : "In progress")}</strong>
        <p>${esc(currentMilestone ? `Current: ${currentMilestone.label}` : "No transaction milestone completed yet.")}</p>
      </div>
      <div>
        <span>Next action</span>
        <strong>${esc(nextMilestone ? nextMilestone.label : "Complete")}</strong>
        <p>${esc(portalBrief.nextAction || (nextMilestone ? `Owner: ${nextMilestone.owner}` : "Registration and handover complete."))}</p>
      </div>
    </div>
    <div class="portal-progress-rail" aria-hidden="true">
      <span style="width: ${Math.max(0, Math.min(100, Number(portalBrief.progress ?? timeline.progress ?? 0)))}%"></span>
    </div>
    ${
      responsibilities.length
        ? `<div class="agent-note">
            <strong>Your responsibilities</strong>
            ${responsibilities.map((item) => `<p>${esc(item)}</p>`).join("")}
          </div>`
        : ""
    }
    ${
      portalPolicy.note
        ? `<div class="agent-note portal-policy-note">
            <strong>Concierge safeguard</strong>
            <p>${esc(portalPolicy.note)}</p>
          </div>`
        : ""
    }
    ${renderRoleSummaryGrid(getRoleSummaryCards(lead, access))}
    ${renderRoleChecklist(lead, roleConfig, access)}
    ${renderPortalPeople(lead, access)}
    <section class="portal-panel">
      <h3>Live transaction timeline</h3>
      ${renderPortalTimeline(timeline)}
    </section>
    ${renderPortalDocumentBoard(lead)}
    <div class="agent-note">
      <strong>Additional considerations</strong>
      <p>${esc(detail.additionalConsiderations)}</p>
    </div>
    ${
      reminderLog.length
        ? `<section class="portal-panel">
            <h3>Recent document chases</h3>
            ${reminderLog
              .slice(0, 4)
              .map(
                (item) => `
                  <div class="portal-log-item">
                    <strong>${esc((item.missingDocs || []).join(", ") || "Missing documents")}</strong>
                    <span>${esc(formatPortalDate(item.at))} | ${esc(`${item.delivered || 0}/${item.attempted || 0} delivered`)}</span>
                  </div>
                `
              )
              .join("")}
          </section>`
        : ""
    }
    ${renderPortalUpdates(stageUpdates, updates, proof)}
  `;

  stakeholderLeadSummary.classList.remove("hidden");
  stakeholderUpdateCard.classList.remove("hidden");
  setStatus("Shared case loaded. Updates here support the file, and concierge can always keep the process moving.");
}

async function loadLead() {
  if (!token) {
    setStatus("This page needs the secure case link sent by Axiom. Ask the concierge to resend it if needed.", true);
    return;
  }
  try {
    const response = await fetch(`/api/stakeholder-lead/${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load shared case.");
    populateSelect(stakeholderDealStatus, data.options?.dealStatuses || []);
    populateSelect(stakeholderContactMedium, data.options?.contactMedia || []);
    renderLead(data);
  } catch (error) {
    setStatus(error.message || "Could not load shared case.", true);
  }
}

stakeholderUpdateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentLead) return;
  const note = (stakeholderNote?.value || "").trim();
  if (!note) return;
  stakeholderSubmit.disabled = true;
  stakeholderSubmit.textContent = "Saving...";
  try {
    const response = await fetch(`/api/stakeholder-lead/${encodeURIComponent(token)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: stakeholderDealStatus?.value || "",
        medium: stakeholderContactMedium?.value || "",
        nextCheckIn: stakeholderNextCheckIn?.value || "",
        note
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not save shared update.");
    stakeholderNote.value = "";
    if (stakeholderDealStatus) stakeholderDealStatus.value = "";
    if (stakeholderContactMedium) stakeholderContactMedium.value = "";
    if (stakeholderNextCheckIn) stakeholderNextCheckIn.value = "";
    renderLead({ lead: data.lead, access: currentAccess || { roleLabel: currentLead.roleLabel || "Stakeholder" } });
    setStatus("Shared update saved for concierge review. The case can still move even if no further portal action happens.");
  } catch (error) {
    setStatus(error.message || "Could not save shared update.", true);
  } finally {
    stakeholderSubmit.disabled = false;
    stakeholderSubmit.textContent = "Save Shared Update";
  }
});

loadLead();
