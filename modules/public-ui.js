window.AxiomPublicUi = window.AxiomPublicUi || {
  ready: true,
};

(function () {
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

  function createSelectField(id, name, labelText, placeholder) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.id = id;
    select.name = name;
    select.required = true;
    addOption(select, "", placeholder);
    label.appendChild(select);
    return { label, select };
  }

  function initExpertApplicationForm() {
    const form = document.getElementById("expertApplicationForm");
    if (!form || form.dataset.locationReady === "true") return;
    form.dataset.locationReady = "true";

    const existingAreasInput = form.elements.areasCovered;
    if (existingAreasInput && !existingAreasInput.id) {
      existingAreasInput.id = "expertAreasCovered";
    }

    let provinceSelect = document.getElementById("expertProvince");
    let townSelect = document.getElementById("expertTown");
    const areasInput = document.getElementById("expertAreasCovered");
    const areasLabel = areasInput?.closest("label");

    if (areasLabel && !provinceSelect) {
      const created = createSelectField("expertProvince", "province", "Province", "Select province");
      areasLabel.before(created.label);
      provinceSelect = created.select;
    }

    if (areasLabel && !townSelect) {
      const created = createSelectField("expertTown", "town", "Town / city", "Select province first");
      created.select.disabled = true;
      areasLabel.before(created.label);
      townSelect = created.select;
    }

    if (areasInput) {
      areasInput.placeholder = "Select a town or add extra suburbs";
    }

    const townsByProvince = normalizeTownSource();
    if (!provinceSelect || !townSelect || !Object.keys(townsByProvince).length) return;

    function fillProvinces() {
      provinceSelect.innerHTML = "";
      addOption(provinceSelect, "", "Select province");
      Object.keys(townsByProvince)
        .sort((left, right) => (provinceLabels[left] || left).localeCompare(provinceLabels[right] || right))
        .forEach((provinceId) => addOption(provinceSelect, provinceId, provinceLabels[provinceId] || provinceId));
    }

    function fillTowns(provinceId) {
      townSelect.innerHTML = "";
      if (!provinceId || !townsByProvince[provinceId]?.length) {
        townSelect.disabled = true;
        addOption(townSelect, "", "Select province first");
        return;
      }
      townSelect.disabled = false;
      addOption(townSelect, "", "Select town / city");
      townsByProvince[provinceId].forEach((town) => addOption(townSelect, town, town));
    }

    function autofillAreas() {
      const town = townSelect.value || "";
      if (!areasInput || !town) return;
      const current = areasInput.value.trim();
      const previousTown = areasInput.dataset.autofilledTown || "";
      if (!current || current === previousTown) {
        areasInput.value = town;
        areasInput.dataset.autofilledTown = town;
      }
    }

    provinceSelect.addEventListener("change", () => {
      fillTowns(provinceSelect.value);
      if (areasInput && areasInput.value.trim() === (areasInput.dataset.autofilledTown || "")) {
        areasInput.value = "";
        areasInput.dataset.autofilledTown = "";
      }
    });

    townSelect.addEventListener("change", autofillAreas);
    fillProvinces();
    fillTowns("");
  }

  function initValuationLocationFields() {
    const form = document.getElementById("valuationForm");
    const suburbInput = document.getElementById("valuationSuburb");
    if (!form || !suburbInput || form.dataset.locationReady === "true") return;

    const townsByProvince = normalizeTownSource();
    if (!Object.keys(townsByProvince).length) return;
    form.dataset.locationReady = "true";

    const suburbLabel = suburbInput.closest("label");
    if (!suburbLabel) return;

    const provinceField = createSelectField("valuationProvince", "valuationProvince", "Province", "Select province");
    const suburbSelect = document.createElement("select");
    suburbSelect.id = "valuationSuburbSelect";
    suburbSelect.name = "valuationSuburbSelect";
    suburbSelect.required = true;

    suburbInput.type = "hidden";
    suburbInput.required = false;
    suburbLabel.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = "Town / suburb ";
    });
    suburbLabel.appendChild(suburbSelect);
    suburbLabel.before(provinceField.label);

    Object.keys(townsByProvince)
      .sort((left, right) => (provinceLabels[left] || left).localeCompare(provinceLabels[right] || right))
      .forEach((provinceId) => addOption(provinceField.select, provinceId, provinceLabels[provinceId] || provinceId));

    function findProvinceForTown(town) {
      const normalized = String(town || "").trim().toLowerCase();
      return Object.keys(townsByProvince).find((provinceId) =>
        townsByProvince[provinceId].some((item) => item.toLowerCase() === normalized)
      ) || "";
    }

    function fillSuburbs(provinceId, selectedTown = "") {
      suburbSelect.innerHTML = "";
      addOption(suburbSelect, "", provinceId ? "Select town / suburb" : "Select province first");
      suburbSelect.disabled = !provinceId;
      (townsByProvince[provinceId] || []).forEach((town) => addOption(suburbSelect, town, town));
      suburbSelect.value = selectedTown;
      suburbInput.value = suburbSelect.value;
    }

    provinceField.select.addEventListener("change", () => fillSuburbs(provinceField.select.value));
    suburbSelect.addEventListener("change", () => {
      suburbInput.value = suburbSelect.value;
    });

    const initialTown = suburbInput.value;
    const initialProvince = findProvinceForTown(initialTown);
    provinceField.select.value = initialProvince;
    fillSuburbs(initialProvince, initialTown);

    document.getElementById("resetValuation")?.addEventListener("click", () => {
      window.setTimeout(() => {
        const resetTown = suburbInput.value;
        const resetProvince = findProvinceForTown(resetTown);
        provinceField.select.value = resetProvince;
        fillSuburbs(resetProvince, resetTown);
      });
    });
  }

  function initIndicativePriceGuideTerminology() {
    const section = document.getElementById("seller-valuation");
    if (!section) return;

    const eyebrow = section.querySelector(".section-heading .eyebrow");
    const heading = section.querySelector(".section-heading h2");
    const generateButton = document.querySelector("#valuationForm button[type='submit']");
    const summaryTitle = document.getElementById("valuationSummaryTitle");
    const statusLabels = Array.from(section.querySelectorAll(".valuation-status span"));
    const messageHeadings = Array.from(section.querySelectorAll(".valuation-message-shell strong"));

    if (eyebrow) eyebrow.textContent = "Indicative Price Guide";
    if (heading) heading.textContent = "Get a grounded indicative price range for your property.";
    if (generateButton) generateButton.textContent = "Generate Indicative Price Guide";
    if (summaryTitle) summaryTitle.textContent = "Indicative price guide ready.";

    statusLabels.forEach((label) => {
      if (label.textContent.trim() === "Valuation date") label.textContent = "Guide date";
    });
    messageHeadings.forEach((headingNode) => {
      if (headingNode.textContent.trim() === "WhatsApp prompt before valuation") {
        headingNode.textContent = "WhatsApp prompt before the price guide";
      }
    });

    if (summaryTitle) {
      new MutationObserver(() => {
        if (/^Valuation ready/i.test(summaryTitle.textContent)) {
          summaryTitle.textContent = summaryTitle.textContent.replace(/^Valuation ready/i, "Indicative price guide ready");
        }
      }).observe(summaryTitle, { childList: true, characterData: true, subtree: true });
    }
  }

  function pageIsPublicRoute() {
    const path = window.location.pathname.toLowerCase();
    if (["", "/", "/index.html"].includes(path)) return false;
    if (path.includes("mission-control")) return false;
    if (path.includes("client-progress")) return false;
    return ["/sellers.html", "/buyers.html", "/agents.html", "/concierge.html"].includes(path);
  }

  function initFloatingConcierge() {
    if (document.querySelector(".floating-concierge") || !pageIsPublicRoute()) return;

    const panel = document.createElement("aside");
    panel.className = "floating-concierge";
    panel.setAttribute("aria-label", "Axiom floating concierge");
    panel.innerHTML = `
      <div class="floating-concierge__mark" aria-hidden="true">A</div>
      <div class="floating-concierge__body">
        <span>Axiom Concierge</span>
        <strong>Hi, I am here to help.</strong>
        <small>Tell me if you want to sell or buy, and I will start the right brief.</small>
      </div>
      <div class="floating-concierge__actions">
        <a href="sellers.html#seller-intake" data-intent="sell">I want to sell</a>
        <a href="buyers.html#buyer-intake" data-intent="buy">I want to buy</a>
      </div>
    `;

    document.body.appendChild(panel);
  }

  function initMissionControlConcierge() {
    const toggle = document.getElementById("conciergeToggle");
    const panel = document.getElementById("conciergePanel");
    const close = document.getElementById("conciergeClose");
    const form = document.getElementById("conciergeForm");
    const input = document.getElementById("conciergeInput");
    const messages = document.getElementById("conciergeMessages");
    if (!toggle || !panel) return;

    if (messages && !messages.querySelector(".concierge-quick-actions")) {
      const actions = document.createElement("div");
      actions.className = "concierge-quick-actions cta-group";
      actions.innerHTML = `
        <button class="btn btn-secondary" type="button" data-intent="sell">I want to sell</button>
        <button class="btn btn-secondary" type="button" data-intent="buy">I want to buy</button>
      `;
      messages.appendChild(actions);
    }

    function openPanel() {
      panel.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close AI concierge");
      input?.focus();
    }

    function closePanel() {
      panel.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open AI concierge");
    }

    toggle.setAttribute("aria-controls", "conciergePanel");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      if (panel.classList.contains("hidden")) openPanel();
      else closePanel();
    });
    close?.addEventListener("click", closePanel);

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = input?.value.trim() || "";
      if (!message) return;
      if (input) input.value = "";

      if (!messages) return;
      const userMessage = document.createElement("p");
      userMessage.className = "user-msg";
      userMessage.textContent = message;
      messages.appendChild(userMessage);

      const reply = document.createElement("p");
      reply.className = "bot-msg";
      reply.textContent = "Thinking...";
      messages.appendChild(reply);
      messages.scrollTop = messages.scrollHeight;

      try {
        const response = await fetch("/api/ai/concierge-draft", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: "Respond as the conversational Mission Control property concierge.",
            audience: "Signed-in Axiom Mission Control user",
            prompt: message,
            instructions:
              "Answer the user's property or caseflow question directly and concisely. If they want to buy or sell, invite them to use the matching quick action. Ask one useful question at a time. Do not give legal, financial, or formal valuation advice.",
            fallback:
              "I can help with a buyer or seller brief, caseflow questions, and the next action. Choose Buy or Sell above, or tell me what you need help with."
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Concierge request failed.");
        reply.textContent = data?.draft?.text || "Tell me whether you are buying, selling, or need help with an active case.";
      } catch (error) {
        reply.textContent = /sign|session|permission|author/i.test(error?.message || "")
          ? "Please sign in to Mission Control before using the NVIDIA-powered concierge."
          : "The AI concierge is temporarily unavailable. You can still use the Buy or Sell options above.";
      }
      messages.scrollTop = messages.scrollHeight;
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.classList.contains("hidden")) closePanel();
    });
  }

  function initPublicUi() {
    initExpertApplicationForm();
    initValuationLocationFields();
    initIndicativePriceGuideTerminology();
    initFloatingConcierge();
    initMissionControlConcierge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPublicUi);
  } else {
    initPublicUi();
  }
})();
