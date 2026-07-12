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

  function initAgentFlowDiagram() {
    const note = document.querySelector(".agent-hero-flow-svg .flow-note");
    if (!note) return;
    note.textContent = "Human review loops back when judgement is needed.";
    note.setAttribute("x", "490");
    note.setAttribute("y", "310");
    note.setAttribute("text-anchor", "middle");
  }

  function initMissionControlLayout() {
    const operationsPanel = document.getElementById("operationsPanel");
    if (!operationsPanel || operationsPanel.dataset.layoutReady === "true") return;
    operationsPanel.dataset.layoutReady = "true";

    const healthStrips = operationsPanel.querySelectorAll(".system-health-strip");
    healthStrips[1]?.classList.add("mission-control-secondary-status");

    const accessSetup = operationsPanel.querySelector(".access-setup-panel");
    if (accessSetup && !accessSetup.closest(".mission-control-advanced")) {
      const details = document.createElement("details");
      details.className = "mission-control-advanced";
      const summary = document.createElement("summary");
      summary.innerHTML = "<strong>Access &amp; team setup</strong><span>Add people, roles, branches, or rollout teams</span>";
      accessSetup.before(details);
      details.append(summary, accessSetup);
    }
  }

  function initMissionControlTabs() {
    const tabs = Array.from(document.querySelectorAll("[data-operations-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-operations-panel]"));
    if (!tabs.length || !panels.length) return;

    function activateTab(tabKey) {
      const targetTab = tabs.find((tab) => tab.dataset.operationsTab === tabKey);
      if (!targetTab || targetTab.disabled || targetTab.hidden) return;

      tabs.forEach((tab) => {
        const active = tab === targetTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      panels.forEach((panel) => {
        const active = panel.dataset.operationsPanel === tabKey;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.operationsTab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const availableTabs = tabs.filter((item) => !item.disabled && !item.hidden);
        const currentIndex = availableTabs.indexOf(tab);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextTab = availableTabs[(currentIndex + direction + availableTabs.length) % availableTabs.length];
        if (nextTab) {
          activateTab(nextTab.dataset.operationsTab);
          nextTab.focus();
        }
      });
      if (!tab.classList.contains("active")) tab.tabIndex = -1;
    });

    document.querySelectorAll("[data-open-operations-tab]").forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.openOperationsTab));
    });
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
    panel.className = "floating-concierge is-collapsed";
    panel.setAttribute("aria-label", "Axiom floating concierge");
    panel.innerHTML = `
      <button class="floating-concierge__toggle" type="button" aria-expanded="false" aria-label="Open Axiom Concierge">
        <span class="floating-concierge__mark" aria-hidden="true">A</span>
        <span class="floating-concierge__toggle-copy"><strong>Axiom Concierge</strong><small>Buy or sell</small></span>
      </button>
      <div class="floating-concierge__body">
        <span>Axiom Concierge</span>
        <strong>Hi, I am here to help.</strong>
        <small>Tell me if you want to sell or buy, and I will start the right brief.</small>
      </div>
      <div class="floating-concierge__actions">
        <a href="sellers.html?intent=sell#seller-intake" data-intent="sell">I want to sell</a>
        <a href="buyers.html?intent=buy#buyer-intake" data-intent="buy">I want to buy</a>
      </div>
    `;

    document.body.appendChild(panel);
    const toggle = panel.querySelector(".floating-concierge__toggle");
    toggle?.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", collapsed ? "Open Axiom Concierge" : "Minimise Axiom Concierge");
    });
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

  function initPublicFooter() {
    if (document.querySelector("footer") || !pageIsPublicRoute()) return;
    const footer = document.createElement("footer");
    footer.className = "footer public-route-footer";
    footer.innerHTML = `<div class="wrapper"><p>Axiom Realty AI · Property Concierge · POPIA-aware workflows</p><nav aria-label="Footer"><a href="index.html">Home</a><a href="sellers.html">Sell</a><a href="buyers.html">Buy</a><a href="agents.html">Agents</a><a href="mission-control.html">Mission Control</a></nav></div>`;
    document.body.appendChild(footer);
  }

  function initUiPolish() {
    const agentHeading = document.querySelector("body:has(.agent-hero-stage) h1");
    if (agentHeading) agentHeading.textContent = "Your 24/7 AI Estate Agent Concierge.";

    const qrImage = document.querySelector('img[alt="WhatsApp Web QR code"]');
    if (qrImage) {
      const syncQrVisibility = () => {
        qrImage.hidden = !String(qrImage.getAttribute("src") || "").trim();
      };
      syncQrVisibility();
      new MutationObserver(syncQrVisibility).observe(qrImage, { attributes: true, attributeFilter: ["src"] });
    }
  }

  function initPublicUi() {
    initExpertApplicationForm();
    initValuationLocationFields();
    initIndicativePriceGuideTerminology();
    initAgentFlowDiagram();
    initMissionControlLayout();
    initMissionControlTabs();
    initPublicFooter();
    initUiPolish();
    initFloatingConcierge();
    initMissionControlConcierge();
  }

  initPublicUi();
})();
