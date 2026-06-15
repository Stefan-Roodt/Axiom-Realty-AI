const statusEl = document.getElementById("agentStatus");
const leadSummary = document.getElementById("leadSummary");
const updateCard = document.getElementById("agentUpdateCard");
const updateForm = document.getElementById("agentUpdateForm");
const acknowledgeReferral = document.getElementById("acknowledgeReferral");
const ackText = document.getElementById("ackText");
const ackStatus = document.getElementById("ackStatus");
const mediumSelect = document.getElementById("medium");
const statusSelect = document.getElementById("status");
const commissionSelect = document.getElementById("commissionAgreement");
const nextCheckInInput = document.getElementById("nextCheckIn");
const contactNoteInput = document.getElementById("contactNote");
const dealNoteInput = document.getElementById("dealNote");
const submitButton = document.getElementById("agentSubmit");

const token = new URLSearchParams(window.location.search).get("token") || "";
let currentLead = null;

const fallbackOptions = {
  dealStatuses: ["Active", "Viewing/valuation booked", "Offer pending", "Under contract", "Closed won", "Cold", "Lost", "Disputed"],
  commissionAgreements: ["Not discussed", "Verbal", "Written", "Confirmed", "Disputed"],
  contactMedia: ["WhatsApp", "Phone call", "Email", "SMS", "In person", "Other"]
};

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
  statusEl.textContent = message;
  statusEl.classList.toggle("error-note", isError);
}

function populateSelect(select, options, selected) {
  select.innerHTML = options
    .map((option) => `<option value="${esc(option)}" ${selected === option ? "selected" : ""}>${esc(option)}</option>`)
    .join("");
}

function renderLead(lead, options, acknowledgementText) {
  currentLead = lead;
  const detail = lead.lead || {};
  const contact = lead.contact || {};
  const deal = lead.dealProtection || {};
  const agentContact = lead.agentContact || {};
  const access = lead.agentAccess || {};
  const handoff = lead.agentHandoff || {};
  const gates = Array.isArray(handoff.gates) ? handoff.gates : [];
  const intent = lead.intent === "sell" ? "Seller" : lead.intent === "buy" ? "Buyer" : "Property";

  leadSummary.innerHTML = `
    <p class="eyebrow">${esc(intent)} lead</p>
    <h2>${esc(lead.snapshot || "Property brief")}</h2>
    <div class="agent-summary-grid">
      <div><span>Client</span><strong>${esc(contact.name)}</strong></div>
      <div><span>WhatsApp</span><strong>${esc(contact.whatsapp)}</strong></div>
      <div><span>Email</span><strong>${esc(contact.email)}</strong></div>
      <div><span>Area</span><strong>${esc(detail.area)}</strong></div>
      <div><span>Province</span><strong>${esc(detail.province)}</strong></div>
      <div><span>Price</span><strong>${esc(detail.price)}</strong></div>
      <div><span>Property type</span><strong>${esc(detail.propertyType)}</strong></div>
      <div><span>Bedrooms</span><strong>${esc(detail.bedrooms)}</strong></div>
      <div><span>Bathrooms</span><strong>${esc(detail.bathrooms)}</strong></div>
      <div><span>Timeline</span><strong>${esc(detail.timeline)}</strong></div>
    </div>
    <div class="agent-note">
      <strong>Additional considerations</strong>
      <p>${esc(detail.additionalConsiderations)}</p>
    </div>
    ${
      gates.length
        ? `<div class="agent-handoff-strip">
            ${gates
              .map(
                (gate) => `
                  <div class="${gate.complete ? "complete" : "pending"}">
                    <strong>${esc(gate.label)}</strong>
                    <span>${esc(gate.complete ? "Complete" : "Required")}</span>
                  </div>`
              )
              .join("")}
          </div>`
        : ""
    }
  `;

  ackText.textContent = acknowledgementText;
  if (access.acknowledgedAt) {
    acknowledgeReferral.checked = true;
    acknowledgeReferral.disabled = true;
    ackStatus.textContent = `Acknowledged ${new Date(access.acknowledgedAt).toLocaleString()}.`;
  } else {
    acknowledgeReferral.checked = false;
    acknowledgeReferral.disabled = false;
    ackStatus.textContent = "Required before an update can be saved.";
  }

  populateSelect(mediumSelect, options.contactMedia || fallbackOptions.contactMedia, agentContact.medium || "WhatsApp");
  populateSelect(statusSelect, options.dealStatuses || fallbackOptions.dealStatuses, deal.status || "Active");
  populateSelect(
    commissionSelect,
    options.commissionAgreements || fallbackOptions.commissionAgreements,
    deal.commissionAgreement || "Written"
  );
  nextCheckInInput.value = deal.nextCheckIn || "";
  contactNoteInput.value = agentContact.note || "";
  dealNoteInput.value = deal.note || "";

  leadSummary.classList.remove("hidden");
  updateCard.classList.remove("hidden");
  setStatus("Lead loaded. Please save an update after first client contact.");
}

async function loadLead() {
  if (!token) {
    setStatus("This agent update link is missing its secure token. Please ask the concierge for a fresh link.", true);
    return;
  }

  try {
    const response = await fetch(`/api/agent-lead/${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load this lead.");
    renderLead(data.lead, data.options || fallbackOptions, data.acknowledgementText || "");
  } catch (error) {
    setStatus(error.message || "This agent update link could not be loaded.", true);
  }
}

updateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentLead) return;
  if (!acknowledgeReferral.checked) {
    ackStatus.textContent = "Please acknowledge the referral arrangement before saving.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    const response = await fetch(`/api/agent-lead/${encodeURIComponent(token)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acknowledgeReferral: acknowledgeReferral.checked,
        medium: mediumSelect.value,
        contactNote: contactNoteInput.value.trim(),
        status: statusSelect.value,
        commissionAgreement: commissionSelect.value,
        nextCheckIn: nextCheckInInput.value,
        dealNote: dealNoteInput.value.trim()
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not save the update.");
    renderLead(data.lead, fallbackOptions, ackText.textContent);
    setStatus("Update saved. The Axiom concierge now has this timestamped record.");
  } catch (error) {
    setStatus(error.message || "Could not save the update.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Update";
  }
});

loadLead();
