const portalRole = document.getElementById("portalRole");
const stakeholderStatus = document.getElementById("stakeholderStatus");
const stakeholderLeadSummary = document.getElementById("stakeholderLeadSummary");
const stakeholderUpdateCard = document.getElementById("stakeholderUpdateCard");
const stakeholderUpdateForm = document.getElementById("stakeholderUpdateForm");
const stakeholderDealStatus = document.getElementById("stakeholderDealStatus");
const stakeholderContactMedium = document.getElementById("stakeholderContactMedium");
const stakeholderNextCheckIn = document.getElementById("stakeholderNextCheckIn");
const stakeholderNote = document.getElementById("stakeholderNote");
const stakeholderSubmit = document.getElementById("stakeholderSubmit");

const token = new URLSearchParams(window.location.search).get("token") || "";
let currentLead = null;

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
                      <small>${esc(item.note || "")}</small>
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

function renderLead(data) {
  const lead = data?.lead;
  const access = data?.access || {};
  if (!lead) return;
  currentLead = lead;
  if (portalRole) {
    portalRole.textContent = `${access.roleLabel || "Stakeholder"} Portal`;
  }

  const detail = lead.lead || {};
  const lifecycle = lead.lifecycle || {};
  const deal = lead.dealProtection || {};
  const portalBrief = lead.portalBrief || {};
  const timeline = lead.transactionTimeline || {};
  const updates = Array.isArray(lead.stakeholderUpdates) ? lead.stakeholderUpdates.slice() : [];
  const proof = Array.isArray(lead.proofTrail) ? lead.proofTrail.slice() : [];
  const stageUpdates = Array.isArray(lead.stageUpdateNotifications) ? lead.stageUpdateNotifications : [];
  const requiredDocs = Array.isArray(lead.requiredLeadDocuments) ? lead.requiredLeadDocuments : [];
  const missingDocs = Array.isArray(lead.missingLeadDocuments) ? lead.missingLeadDocuments : [];
  const reminderLog = Array.isArray(lead.documentReminderLog) ? lead.documentReminderLog : [];
  const assigned = lead.assignedAgent || {};
  const responsibilities = Array.isArray(portalBrief.responsibilities) ? portalBrief.responsibilities : [];
  const currentMilestone = portalBrief.currentMilestone || timeline.currentMilestone || null;
  const nextMilestone = portalBrief.nextMilestone || timeline.nextMilestone || null;
  const pulse = getPortalPulse(lead);

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
        <b>${esc(Number.isFinite(Number(portalBrief.progress ?? timeline.progress)) ? `${portalBrief.progress ?? timeline.progress}%` : "0%")}</b>
        <span>progress</span>
      </div>
    </div>
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
    <div class="agent-summary-grid">
      <div><span>Client</span><strong>${esc(detail.fullName)}</strong></div>
      <div><span>WhatsApp</span><strong>${esc(detail.whatsapp)}</strong></div>
      <div><span>Email</span><strong>${esc(detail.email)}</strong></div>
      <div><span>Area</span><strong>${esc(detail.area)}</strong></div>
      <div><span>Province</span><strong>${esc(detail.province)}</strong></div>
      <div><span>Price</span><strong>${esc(detail.price)}</strong></div>
      <div><span>Property type</span><strong>${esc(detail.propertyType)}</strong></div>
      <div><span>Timeline</span><strong>${esc(detail.timeline)}</strong></div>
      <div><span>Stage</span><strong>${esc(lifecycle.label || "In progress")}</strong></div>
      <div><span>Deal status</span><strong>${esc(deal.status || "Active")}</strong></div>
      <div><span>Commission status</span><strong>${esc(deal.commissionAgreement || "Not discussed")}</strong></div>
      <div><span>Assigned agent</span><strong>${esc(assigned.name || "Not assigned")}</strong></div>
    </div>
    <div class="portal-checklist-grid">
      <section class="portal-panel">
        <h3>What is done</h3>
        <div class="small-note">${esc(currentMilestone ? currentMilestone.label : "No milestone completed yet.")}</div>
        <div class="small-note">${esc(currentMilestone?.completedAt ? formatPortalDate(currentMilestone.completedAt) : "Waiting for first recorded milestone.")}</div>
      </section>
      <section class="portal-panel">
        <h3>What is next</h3>
        <div class="small-note">${esc(nextMilestone ? nextMilestone.label : "Journey complete")}</div>
        <div class="small-note">${esc(nextMilestone?.owner ? `Owner: ${nextMilestone.owner}` : "No further owner action required.")}</div>
      </section>
      <section class="portal-panel">
        <h3>Document readiness</h3>
        <div class="small-note">${esc(requiredDocs.length ? `Required now: ${requiredDocs.join(", ")}` : "No mandatory documents currently unlocked.")}</div>
        <div class="small-note ${missingDocs.length ? "error-note" : ""}">${esc(missingDocs.length ? `Still missing: ${missingDocs.join(", ")}` : "No required documents are currently missing.")}</div>
      </section>
    </div>
    <section class="portal-panel">
      <h3>Live transaction timeline</h3>
      ${renderPortalTimeline(timeline)}
    </section>
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
  setStatus("Shared case loaded. Save an update to keep all parties aligned.");
}

async function loadLead() {
  if (!token) {
    setStatus("This shared link is missing its secure token. Request a new link from concierge.", true);
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
    renderLead({ lead: data.lead, access: { roleLabel: currentLead.roleLabel || "Stakeholder" } });
    setStatus("Shared update saved. All parties now see this progress.");
  } catch (error) {
    setStatus(error.message || "Could not save shared update.", true);
  } finally {
    stakeholderSubmit.disabled = false;
    stakeholderSubmit.textContent = "Save Shared Update";
  }
});

loadLead();
