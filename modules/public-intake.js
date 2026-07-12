window.AxiomPublicIntake =
  window.AxiomPublicIntake ||
  {
    ready: true,
  };

(function () {
  if (window.AxiomPublicIntake.initialized) return;
  window.AxiomPublicIntake.initialized = true;

  const triggerButtons = Array.from(document.querySelectorAll("[data-intent]"));
  if (!triggerButtons.length) return;

  function ensureIntakeOverlay() {
    const existing = document.getElementById("intakeOverlay");
    if (existing) return existing;

    const panel = document.createElement("div");
    panel.id = "intakeOverlay";
    panel.className = "intake-overlay hidden";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="intake-modal" role="dialog" aria-modal="true" aria-labelledby="intakeTitle">
        <button class="close-modal" id="closeModal" type="button" aria-label="Close">&times;</button>
        <p class="eyebrow" id="intakeEyebrow">Seller Intake</p>
        <h2 id="intakeTitle">Start the sale with a sharper first brief</h2>
        <p class="small-note" id="progressNote">This should take about a minute.</p>
        <form id="intakeForm">
          <div id="dynamicFields"></div>
          <label id="additionalInfoLabel">
            Anything important? <span class="optional-label">Optional</span>
          </label>
          <textarea id="additionalInfo" name="additionalInfo"></textarea>
          <p class="small-note hidden" id="nextStepMessage"></p>
          <div class="cta-group">
            <button class="btn btn-secondary" type="button" id="closeModalSecondary">Cancel</button>
            <button class="btn btn-primary" type="submit" id="submitLeadBtn">Send Request</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#closeModalSecondary")?.addEventListener("click", closeOverlay);
    return panel;
  }

  const overlay = ensureIntakeOverlay();
  const form = document.getElementById("intakeForm");
  const dynamicFields = document.getElementById("dynamicFields");
  const closeButton = document.getElementById("closeModal");
  const title = document.getElementById("intakeTitle");
  const eyebrow = document.getElementById("intakeEyebrow");
  const progressNote = document.getElementById("progressNote");
  const additionalInfo = document.getElementById("additionalInfo");
  const additionalInfoLabel = document.getElementById("additionalInfoLabel");
  const nextStepMessage = document.getElementById("nextStepMessage");
  const submitButton = document.getElementById("submitLeadBtn");

  if (!overlay || !form || !dynamicFields || !closeButton || !submitButton) {
    return;
  }

  const apiRequest =
    window.AxiomApi?.request ||
    (async (url, options) => {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        ...options,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Request failed");
      }
      return data;
    });

  const provinceLabels = {
    "eastern-cape": "Eastern Cape",
    "free-state": "Free State",
    gauteng: "Gauteng",
    "kwazulu-natal": "KwaZulu-Natal",
    limpopo: "Limpopo",
    mpumalanga: "Mpumalanga",
    "north-west": "North West",
    "northern-cape": "Northern Cape",
    "western-cape": "Western Cape",
  };

  function slugifyProvince(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normalizeTownSource() {
    const source = window.townsByProvince || window.townsByProvinceData || {};
    return Object.entries(source).reduce((result, [province, towns]) => {
      const provinceId = slugifyProvince(province);
      if (!provinceId || !Array.isArray(towns)) return result;
      result[provinceId] = Array.from(new Set(towns.filter(Boolean).map((town) => String(town).trim()))).sort((left, right) =>
        left.localeCompare(right)
      );
      return result;
    }, {});
  }

  function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  const townsByProvince = normalizeTownSource();

  const fieldSets = {
    sell: {
      eyebrow: "Seller Intake",
      title: "Start the sale with a sharper first brief",
      progress: "This should take about a minute. Axiom will tighten the rest if anything important is still missing.",
      notesLabel: "Anything important about the property or the sale?",
      notesPlaceholder: "Bedrooms, bathrooms, condition, parking, urgency, mandate status, valuation expectations, or anything a specialist should know.",
      successLink: { href: "sellers.html", label: "See seller service" },
      fields: [
        { name: "clientName", label: "Your name", type: "text", required: true, autocomplete: "name" },
        { name: "mobile", label: "Mobile / WhatsApp", type: "tel", required: true, autocomplete: "tel" },
        { name: "email", label: "Email", type: "email", required: false, autocomplete: "email" },
        { name: "province", label: "Province", type: "provinceSelect", required: true },
        { name: "area", label: "Property suburb / area", type: "townSelect", required: true },
        {
          name: "propertyType",
          label: "Property type",
          type: "select",
          required: true,
          options: ["House", "Apartment", "Townhouse", "Vacant land", "Smallholding"],
        },
        { name: "price", label: "Expected price or valuation need", type: "text", required: true, placeholder: "e.g. Around R2.4m or need a valuation guide" },
        {
          name: "timeline",
          label: "Selling timeline",
          type: "select",
          required: true,
          options: [
            "As soon as possible",
            "Within 30 days",
            "1 to 3 months",
            "3 to 6 months",
            "Just exploring for now",
            "Need a valuation first",
          ],
        },
        { name: "reason", label: "Reason for selling", type: "text", required: true, placeholder: "Relocating, downsizing, upgrading..." },
      ],
    },
    buy: {
      eyebrow: "Buyer Intake",
      title: "Start the search with a cleaner buyer brief",
      progress: "This should take about a minute. Axiom will fill the gaps before the right specialist steps in.",
      notesLabel: "Anything important about the search?",
      notesPlaceholder: "Must-haves, schools, pets, parking, deal-breakers, offer timing, or special finance notes.",
      successLink: { href: "buyers.html", label: "See buyer route" },
      fields: [
        { name: "clientName", label: "Your name", type: "text", required: true, autocomplete: "name" },
        { name: "mobile", label: "Mobile / WhatsApp", type: "tel", required: true, autocomplete: "tel" },
        { name: "email", label: "Email", type: "email", required: false, autocomplete: "email" },
        { name: "province", label: "Province", type: "provinceSelect", required: true },
        { name: "area", label: "Preferred suburb / area", type: "townSelect", required: true },
        {
          name: "propertyType",
          label: "Property type",
          type: "select",
          required: true,
          options: ["House", "Apartment", "Townhouse", "Vacant land", "Smallholding"],
        },
        { name: "budget", label: "Budget range", type: "text", required: true, placeholder: "e.g. R1.8m to R2.2m" },
        {
          name: "finance",
          label: "Finance position",
          type: "select",
          required: true,
          options: ["Cash", "Pre-approved bond", "Applying for finance", "Need guidance"],
        },
        {
          name: "timeline",
          label: "Buying timeline",
          type: "select",
          required: true,
          options: [
            "Ready to view now",
            "Within 30 days",
            "1 to 3 months",
            "3 to 6 months",
            "Just exploring for now",
            "Need finance guidance first",
          ],
        },
      ],
    },
  };

  let currentIntent = "sell";
  let successPanel = null;
  let successTitle = null;
  let successSummary = null;
  let successReference = null;
  let successRoute = null;
  let successWindow = null;
  let successNext = null;
  let successFacts = null;
  let successGaps = null;
  let successGapsLabel = null;
  let successBand = null;
  let successScoreNote = null;
  let successLink = null;
  let successClose = null;
  let successWhatsappPanel = null;
  let successWhatsappStatus = null;
  let successWhatsappNote = null;
  let successWhatsappLink = null;
  let routeSteps = [];
  let defaultSubmitLabel = submitButton.textContent;

  function ensureStyles() {
    if (document.getElementById("axiom-public-intake-styles")) return;
    const style = document.createElement("style");
    style.id = "axiom-public-intake-styles";
    style.textContent = `
      .intake-success-panel {
        display: grid;
        gap: 1rem;
        margin-top: 1rem;
        padding: 1rem 1.05rem;
        border-radius: 20px;
        border: 1px solid rgba(34, 211, 238, 0.18);
        background: linear-gradient(145deg, rgba(6, 14, 29, 0.96), rgba(10, 24, 44, 0.86));
      }
      .intake-success-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        flex-wrap: wrap;
      }
      .intake-status-pill {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0.28rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(34, 211, 238, 0.24);
        background: rgba(15, 23, 42, 0.84);
        color: #67e8f9;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .intake-success-panel strong {
        color: #f8fafc;
      }
      .intake-success-summary {
        color: #cbd5e1;
      }
      .intake-success-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.8rem;
      }
      .intake-success-grid.intake-success-grid-wide {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .intake-success-card {
        padding: 0.9rem;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(15, 23, 42, 0.78);
      }
      .intake-success-card span {
        display: block;
        margin-bottom: 0.24rem;
        color: #67e8f9;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .intake-success-card p {
        margin: 0.4rem 0 0;
        color: #9fb0c8;
        font-size: 0.92rem;
      }
      .intake-whatsapp-test .btn {
        width: fit-content;
        margin-top: 0.8rem;
      }
      .intake-route-rail {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .intake-route-step {
        position: relative;
        min-height: 118px;
        padding: 0.9rem;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(9, 16, 30, 0.76);
      }
      .intake-route-step::after {
        content: "";
        position: absolute;
        top: 26px;
        right: -0.5rem;
        width: 1rem;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(34, 211, 238, 0.72), rgba(167, 139, 250, 0.7));
      }
      .intake-route-step:last-child::after {
        display: none;
      }
      .intake-route-step[data-state="current"] {
        border-color: rgba(34, 211, 238, 0.36);
        background: linear-gradient(145deg, rgba(9, 20, 38, 0.94), rgba(16, 33, 59, 0.88));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }
      .intake-route-step[data-state="complete"] {
        border-color: rgba(74, 222, 128, 0.28);
      }
      .intake-route-step[data-state="pending"] {
        opacity: 0.88;
      }
      .intake-route-step b {
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(34, 211, 238, 0.26);
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        font-size: 0.9rem;
      }
      .intake-route-step[data-state="complete"] b {
        border-color: rgba(74, 222, 128, 0.28);
        background: rgba(20, 83, 45, 0.38);
      }
      .intake-route-step span {
        display: block;
        margin-top: 0.75rem;
        color: #67e8f9;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .intake-route-step strong {
        display: block;
        margin-top: 0.22rem;
      }
      .intake-route-step small {
        display: block;
        margin-top: 0.35rem;
        color: #9fb0c8;
        line-height: 1.45;
      }
      .intake-success-list {
        margin: 0;
        padding-left: 1rem;
        color: #cbd5e1;
      }
      .intake-success-list li + li {
        margin-top: 0.36rem;
      }
      .intake-success-actions {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
      }
      @media (max-width: 820px) {
        .intake-route-rail,
        .intake-success-grid.intake-success-grid-wide,
        .intake-success-grid {
          grid-template-columns: 1fr;
        }
        .intake-success-actions .btn {
          width: 100%;
        }
        .intake-whatsapp-test .btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSuccessPanel() {
    if (successPanel) return;
    ensureStyles();
    successPanel = document.createElement("div");
    successPanel.className = "intake-success-panel hidden";
    successPanel.innerHTML = `
      <div class="intake-success-topline">
        <div>
          <p class="eyebrow">Brief Received</p>
          <h3 id="intakeSuccessTitle">Axiom has your brief.</h3>
        </div>
        <span class="intake-status-pill" id="intakeSuccessPill">Next step clear</span>
      </div>
      <p class="intake-success-summary" id="intakeSuccessSummary"></p>
      <div class="intake-success-grid intake-success-grid-wide">
        <article class="intake-success-card">
          <span>Reference</span>
          <strong id="intakeSuccessReference">-</strong>
        </article>
        <article class="intake-success-card">
          <span>Follow-up route</span>
          <strong id="intakeSuccessRoute">-</strong>
        </article>
        <article class="intake-success-card">
          <span>Expected timing</span>
          <strong id="intakeSuccessWindow">-</strong>
        </article>
        <article class="intake-success-card">
          <span>Brief strength</span>
          <strong id="intakeSuccessBand">-</strong>
          <p id="intakeSuccessScoreNote">-</p>
        </article>
      </div>
      <div class="intake-route-rail" aria-label="How Axiom moves this forward">
        <article class="intake-route-step" id="intakeRouteStep1" data-state="complete">
          <b>1</b>
          <span>Brief captured</span>
          <strong>Request registered</strong>
          <small>The public concierge has the core facts and a live case reference.</small>
        </article>
        <article class="intake-route-step" id="intakeRouteStep2" data-state="current">
          <b>2</b>
          <span>Concierge shaping</span>
          <strong>Brief cleaned</strong>
          <small>Any missing facts are tightened so the first specialist contact starts properly.</small>
        </article>
        <article class="intake-route-step" id="intakeRouteStep3" data-state="pending">
          <b>3</b>
          <span>Specialist handover</span>
          <strong>Right person steps in</strong>
          <small>The agent gets a cleaner brief, clearer next action, and less back-and-forth.</small>
        </article>
      </div>
      <div class="intake-success-card">
        <span>What happens next</span>
        <strong id="intakeSuccessNext">-</strong>
      </div>
      <div class="intake-success-card intake-whatsapp-test hidden" id="intakeWhatsappTest">
        <span>WhatsApp test</span>
        <strong id="intakeWhatsappStatus">Message queued</strong>
        <p id="intakeWhatsappNote">Open the prepared WhatsApp message for testing.</p>
        <a class="btn btn-primary" id="intakeWhatsappLink" href="#" target="_blank" rel="noopener">Open WhatsApp message</a>
      </div>
      <div class="intake-success-grid">
        <article class="intake-success-card">
          <span>What Axiom already knows</span>
          <ul class="intake-success-list" id="intakeSuccessFacts"></ul>
        </article>
        <article class="intake-success-card">
          <span id="intakeSuccessGapsLabel">If anything still needs tightening</span>
          <ul class="intake-success-list" id="intakeSuccessGaps"></ul>
        </article>
      </div>
      <div class="intake-success-actions">
        <button type="button" class="btn btn-primary" id="intakeSuccessClose">Done</button>
        <a class="btn btn-secondary" id="intakeSuccessLink" href="sellers.html">See service</a>
      </div>
    `;
    form.after(successPanel);
    successTitle = document.getElementById("intakeSuccessTitle");
    successSummary = document.getElementById("intakeSuccessSummary");
    successReference = document.getElementById("intakeSuccessReference");
    successRoute = document.getElementById("intakeSuccessRoute");
    successWindow = document.getElementById("intakeSuccessWindow");
    successNext = document.getElementById("intakeSuccessNext");
    successFacts = document.getElementById("intakeSuccessFacts");
    successGaps = document.getElementById("intakeSuccessGaps");
    successGapsLabel = document.getElementById("intakeSuccessGapsLabel");
    successBand = document.getElementById("intakeSuccessBand");
    successScoreNote = document.getElementById("intakeSuccessScoreNote");
    successLink = document.getElementById("intakeSuccessLink");
    successClose = document.getElementById("intakeSuccessClose");
    successWhatsappPanel = document.getElementById("intakeWhatsappTest");
    successWhatsappStatus = document.getElementById("intakeWhatsappStatus");
    successWhatsappNote = document.getElementById("intakeWhatsappNote");
    successWhatsappLink = document.getElementById("intakeWhatsappLink");
    routeSteps = [
      document.getElementById("intakeRouteStep1"),
      document.getElementById("intakeRouteStep2"),
      document.getElementById("intakeRouteStep3"),
    ].filter(Boolean);
    successClose.addEventListener("click", closeOverlay);
  }

  function createField(field) {
    const label = document.createElement("label");
    label.textContent = field.label;

    let input;
    if (field.type === "select" || field.type === "provinceSelect" || field.type === "townSelect") {
      input = document.createElement("select");
      if (field.type === "provinceSelect") {
        addOption(input, "", "Select province");
        Object.keys(townsByProvince)
          .sort((left, right) => (provinceLabels[left] || left).localeCompare(provinceLabels[right] || right))
          .forEach((provinceId) => addOption(input, provinceId, provinceLabels[provinceId] || provinceId));
      } else if (field.type === "townSelect") {
        input.disabled = true;
        input.dataset.townSelect = "true";
        addOption(input, "", "Select province first");
      } else {
        addOption(input, "", `Select ${field.label.toLowerCase()}`);
        field.options.forEach((optionLabel) => addOption(input, optionLabel, optionLabel));
      }
    } else {
      input = document.createElement("input");
      input.type = field.type;
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
      if (field.autocomplete) {
        input.autocomplete = field.autocomplete;
      }
    }

    input.name = field.name;
    input.required = Boolean(field.required);
    label.appendChild(input);
    return label;
  }

  function wireTownDropdowns() {
    const provinceSelect = dynamicFields.querySelector('select[name="province"]');
    const townSelect = dynamicFields.querySelector('select[name="area"][data-town-select="true"]');
    if (!provinceSelect || !townSelect) return;

    function fillTowns() {
      const provinceId = provinceSelect.value;
      townSelect.innerHTML = "";
      if (!provinceId || !townsByProvince[provinceId]?.length) {
        townSelect.disabled = true;
        addOption(townSelect, "", "Select province first");
        return;
      }

      townSelect.disabled = false;
      addOption(townSelect, "", "Select suburb / town");
      townsByProvince[provinceId].forEach((town) => addOption(townSelect, town, town));
    }

    provinceSelect.addEventListener("change", fillTowns);
    fillTowns();
  }

  function renderFields(intent) {
    const config = fieldSets[intent] || fieldSets.sell;
    currentIntent = intent;
    dynamicFields.innerHTML = "";
    config.fields.forEach((field) => {
      dynamicFields.appendChild(createField(field));
    });
    wireTownDropdowns();
    eyebrow.textContent = config.eyebrow;
    title.textContent = config.title;
    progressNote.textContent = config.progress;
    additionalInfo.placeholder = config.notesPlaceholder;
    additionalInfoLabel.innerHTML = `${config.notesLabel} <span class="optional-label">Optional</span>`;
    submitButton.textContent = "Send Request";
  }

  function openOverlay(intent) {
    renderFields(intent);
    form.reset();
    form.classList.remove("hidden");
    ensureSuccessPanel();
    successPanel.classList.add("hidden");
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeOverlay() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function publicBandLabel(outcome) {
    if (outcome.handoffReady) return "Specialist-ready";
    if (outcome.band === "warm") return "Strong start";
    if (outcome.band === "nurture") return "Brief received";
    return "Concierge review";
  }

  function updateList(target, items, fallback) {
    target.innerHTML = "";
    const rows = Array.isArray(items) && items.length ? items : [fallback];
    rows.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      target.appendChild(li);
    });
  }

  function buildPayload(formData) {
    const answers = [];
    const get = (name) => String(formData.get(name) || "").trim();
    const clientName = get("clientName");
    const mobile = get("mobile");
    const email = get("email");
    const province = get("province");
    const area = get("area");
    const propertyType = get("propertyType");
    const timeline = get("timeline");
    const additional = String(additionalInfo.value || "").trim();

    answers.push({ label: "Client name", value: clientName });
    answers.push({ label: "Mobile", value: mobile });
    if (email) answers.push({ label: "Email", value: email });
    if (province) answers.push({ label: "Province", value: provinceLabels[province] || province });
    answers.push({ label: "Area", value: area });
    answers.push({ label: "Property type", value: propertyType });
    answers.push({ label: "Timeline", value: timeline });
    answers.push({ label: "Source", value: "Website enquiry" });

    if (currentIntent === "sell") {
      answers.push({ label: "Listing price", value: get("price") });
      answers.push({ label: "Reason", value: get("reason") });
    } else {
      answers.push({ label: "Budget", value: get("budget") });
      answers.push({ label: "Finance", value: get("finance") });
      if (additional) {
        answers.push({ label: "Must have", value: additional });
      }
    }

    return {
      intent: currentIntent,
      label: `${clientName || "Client"} (${area || "Area to confirm"})`,
      mobile,
      email,
      additionalInfo: additional,
      contact: {
        mobile,
        email,
        preferred: mobile ? "WhatsApp" : "Email",
      },
      acquisition: {
        mode: "website",
        sourceLabel: "Website enquiry",
        signal: timeline,
        province,
        area,
      },
      answers,
    };
  }

  function describeBand(band) {
    if (band === "hot") return "Hot lead";
    if (band === "warm") return "Warm lead";
    if (band === "nurture") return "Nurture lead";
    return "Early-stage brief";
  }

  function setRouteState(handoffReady) {
    if (!routeSteps.length) return;
    const states = handoffReady ? ["complete", "complete", "current"] : ["complete", "current", "pending"];
    routeSteps.forEach((step, index) => {
      step.dataset.state = states[index] || "pending";
    });
  }

  function renderSuccess(response, formData) {
    ensureSuccessPanel();
    const outcome = response.publicOutcome || {};
    const leadQuality = response.leadQuality || {};
    const briefCard = response.briefCard || {};
    const config = fieldSets[currentIntent] || fieldSets.sell;
    const handoffReady = Boolean(outcome.handoffReady || leadQuality.handoffReady);
    const clientName = formData.get("clientName") || "you";
    const fallbackTitle = `${currentIntent === "sell" ? "Seller" : "Buyer"} brief received for ${clientName}.`;
    const fallbackSummary = handoffReady
      ? `Axiom has enough context to move this ${currentIntent === "sell" ? "sale" : "search"} forward with a cleaner first handover.`
      : "Axiom has the request and may ask one or two quick follow-up questions before the specialist handover is made.";
    const fallbackWindow = handoffReady
      ? "Specialist target: within 3 working hours."
      : "Concierge follow-up first: one or two quick detail checks if needed.";

    successTitle.textContent = outcome.title || fallbackTitle;
    successSummary.textContent = outcome.summary || fallbackSummary;
    successReference.textContent = outcome.reference || response.leadId || "-";
    successRoute.textContent = outcome.routeLabel || (formData.get("mobile") ? "WhatsApp first" : "Email follow-up");
    successWindow.textContent = outcome.followUpWindow || fallbackWindow;
    successNext.textContent = outcome.nextStep || leadQuality.conciergeAction || "Concierge follow-up in progress.";
    successBand.textContent = `${describeBand(outcome.band || leadQuality.band)}${leadQuality.score ? ` · ${leadQuality.score}/100` : ""}`;
    successScoreNote.textContent = handoffReady
      ? "Clean enough for a focused first specialist call."
      : "Axiom will tighten the loose bits before the handover goes out.";
    updateList(
      successFacts,
      outcome.knownFacts || briefCard.knownFacts,
      `${currentIntent === "sell" ? "Seller" : "Buyer"} area: ${formData.get("area") || "To confirm"}`
    );
    successGapsLabel.textContent = handoffReady ? "What still stays watched" : "Likely concierge follow-up";
    updateList(
      successGaps,
      handoffReady ? outcome.missingItems || leadQuality.missingItems : leadQuality.conciergeQuestions || outcome.missingItems,
      handoffReady ? "No major brief gaps are showing right now." : "No extra follow-up is showing right now."
    );
    successLink.href = config.successLink.href;
    successLink.textContent = config.successLink.label;
    document.getElementById("intakeSuccessPill").textContent = publicBandLabel({
      band: outcome.band || leadQuality.band,
      handoffReady,
    });
    setRouteState(handoffReady);

    successBand.textContent = `${describeBand(outcome.band || leadQuality.band)}${leadQuality.score ? ` - ${leadQuality.score}/100` : ""}`;
    const whatsapp = response.whatsapp || {};
    if (whatsapp.manualTestLink && successWhatsappPanel && successWhatsappLink) {
      successWhatsappStatus.textContent = whatsapp.realDeliveryConnected
        ? "WhatsApp acknowledgement queued"
        : "WhatsApp test message ready";
      successWhatsappNote.textContent = whatsapp.note || "Open the prepared WhatsApp message for testing.";
      successWhatsappLink.href = whatsapp.manualTestLink;
      successWhatsappLink.textContent = whatsapp.realDeliveryConnected ? "Open WhatsApp copy" : "Open WhatsApp test message";
      successWhatsappPanel.classList.remove("hidden");
    } else if (successWhatsappPanel) {
      successWhatsappPanel.classList.add("hidden");
    }

    form.classList.add("hidden");
    successPanel.classList.remove("hidden");
    nextStepMessage.textContent = `${successTitle.textContent} ${successNext.textContent}`;
    nextStepMessage.classList.remove("hidden");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    const formData = new FormData(form);

    try {
      const payload = buildPayload(formData);
      const response = await apiRequest("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      renderSuccess(response, formData);
    } catch (error) {
      nextStepMessage.textContent = error?.message || "Axiom could not send the request right now.";
      nextStepMessage.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
    }
  }

  triggerButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const intent = button.getAttribute("data-intent");
      if (intent === "buy" || intent === "sell") {
        event.preventDefault();
        openOverlay(intent);
      }
    });
  });

  closeButton.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });
  form.addEventListener("submit", handleSubmit);
  renderFields("sell");

  const requestedIntent = new URLSearchParams(window.location.search).get("intent");
  if (requestedIntent === "buy" || requestedIntent === "sell") {
    openOverlay(requestedIntent);
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
})();
