(function attachPublicUiModule(window, document) {
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
  const normalizedTownsByProvince = Object.entries(townsByProvince).reduce((acc, [province, cities]) => {
    acc[province?.toString().trim().toLowerCase()] = Array.isArray(cities) ? cities : [];
    return acc;
  }, {});
  const FALLBACK_PROVINCE_PLACEHOLDER = "Select a province first";
  const propertyTypeOptions = ["Land", "Duplex", "Simplex", "Flat", "House", "Farm"];

  function normalizeProvinceName(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function getTownsByProvinceName(provinceValue) {
    const normalized = normalizeProvinceName(provinceValue);
    const direct = townsByProvince[provinceValue];
    if (Array.isArray(direct) && direct.length) return direct;
    const normalizedMatch = normalizedTownsByProvince[normalized];
    return Array.isArray(normalizedMatch) ? normalizedMatch : [];
  }

  function createTownDatalist(field) {
    const list = document.createElement("datalist");
    const id = `${field.name}-town-list`;
    list.id = id;
    list.className = "town-datalist";
    return { list, id };
  }

  function isHomepage() {
    const path = (window.location.pathname || "").toLowerCase();
    return !path || path.endsWith("/") || path.endsWith("/index.html") || path === "/index.html";
  }

  function setText(node, text) {
    if (node) node.textContent = text;
  }

  function setHtml(node, html) {
    if (node) node.innerHTML = html;
  }

  function applyHomepageMessaging() {
    if (!isHomepage()) return;

    const navLinks = Array.from(document.querySelectorAll(".nav-links a.admin-nav-link"));
    navLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (href.includes("sellers.html")) link.textContent = "Sell a Property";
      if (href.includes("buyers.html")) link.textContent = "Buy a Property";
      if (href.includes("agents.html")) link.textContent = "Estate Agents";
    });

    const hero = document.querySelector("header.hero .copy");
    if (hero) {
      setText(hero.querySelector(".eyebrow"), "Axiom Realty AI");
      setText(hero.querySelector("h1"), "Sell smarter. Move sooner. Start properly.");
      setText(
        hero.querySelector(".subtext"),
        "Axiom helps sellers come in prepared, well positioned, and taken seriously while serious buyers move faster with clearer briefs and cleaner next steps. The sooner the right conversation starts, the better the chance of keeping momentum on your side."
      );

      const proofSpans = hero.querySelectorAll(".hero-proof-grid span");
      if (proofSpans[0]) setHtml(proofSpans[0], "<strong>Sellers</strong> Catch demand while it is still warm");
      if (proofSpans[1]) setHtml(proofSpans[1], "<strong>Buyers</strong> Get lined up before the right property moves");
      if (proofSpans[2]) setHtml(proofSpans[2], "<strong>Agents</strong> Respond faster with real context");

      const ctaButtons = hero.querySelectorAll(".cta-group .btn");
      ctaButtons.forEach((button) => {
        const href = (button.getAttribute("href") || "").toLowerCase();
        const intent = (button.dataset?.intent || "").toLowerCase();
        if (intent === "sell") button.textContent = "I Want to Sell";
        if (intent === "buy") button.textContent = "I Want to Buy";
        if (href.includes("expertapplicationform")) {
          button.textContent = "I Am an Agent";
          button.setAttribute("href", "agents.html");
        }
      });

      setText(hero.querySelector(".promise-text"), "Faster contact. Better timing. Stronger momentum.");
    }

    const floatingCard = document.querySelector(".hero-floating-card");
    if (floatingCard) {
      const parts = floatingCard.querySelectorAll("span, strong, small");
      if (parts[0]) parts[0].textContent = "Seller route";
      if (parts[1]) parts[1].textContent = "Your area, your price reality, your timing, your next best move.";
      if (parts[2]) parts[2].textContent = "Enough structure for a serious first call while the lead is still warm.";
    }

    const signalPanel = document.querySelector(".hero-signal-panel");
    if (signalPanel) {
      const parts = signalPanel.querySelectorAll("span, strong, small");
      if (parts[0]) parts[0].textContent = "How Axiom helps";
      if (parts[1]) parts[1].textContent = "Property. Area. Timing.";
      if (parts[2]) parts[2].textContent = "The next conversation starts with urgency, context, and a clearer chance of closing.";
    }

    const sectionHeading = document.querySelector("#routes .section-heading");
    if (sectionHeading) {
      setText(sectionHeading.querySelector(".eyebrow"), "Choose Your Route");
      setText(sectionHeading.querySelector("h2"), "Momentum starts with the right route.");
      setText(
        sectionHeading.querySelector("p:last-of-type"),
        "Sellers, buyers, and estate agents need different first conversations. Axiom separates those routes so the pitch, the paperwork, and the next move start in the right place."
      );
    }

    const sellerCard = document.querySelector(".customer-path-card.seller");
    if (sellerCard) {
      setText(sellerCard.querySelector("span"), "Sell a Property");
      setText(sellerCard.querySelector("h2"), "Do not let your sale go stale before the right agent even steps in.");
      setText(
        sellerCard.querySelector("p"),
        "Share the essentials now, from area and property type to timing and price expectations. We shape that into a cleaner brief quickly so the right selling specialist can respond while urgency, presentation, and seller confidence are still working in your favour."
      );
      const link = sellerCard.querySelector("a");
      if (link) link.textContent = "Start selling properly";
    }

    const buyerCard = document.querySelector(".customer-path-card.buyer");
    if (buyerCard) {
      setText(buyerCard.querySelector("span"), "Buy a Property");
      setText(buyerCard.querySelector("h2"), "Get clear before the right property slips past you.");
      setText(
        buyerCard.querySelector("p"),
        "Share budget, area, timing, and must-haves once so the right agent can move faster when a real opportunity appears instead of losing time on vague back-and-forth."
      );
      const link = buyerCard.querySelector("a");
      if (link) link.textContent = "See buyer route";
    }

    const agentCard = document.querySelector(".customer-path-card.agent");
    if (agentCard) {
      setText(agentCard.querySelector("span"), "Estate Agents");
      setText(agentCard.querySelector("h2"), "Look more organised. Respond with more confidence. Chase less.");
      setText(
        agentCard.querySelector("p"),
        "Axiom helps agencies work from cleaner briefs, steadier updates, stronger referral proof, and one clearer operating rhythm across live matters."
      );
      const link = agentCard.querySelector("a");
      if (link) link.textContent = "See agent route";
    }

    const afterContact = document.querySelector("#property-experts .section-heading");
    if (afterContact) {
      setText(afterContact.querySelector(".eyebrow"), "After The First Contact");
      setText(afterContact.querySelector("h2"), "A stronger start gives everyone a better chance to close.");
      setText(
        afterContact.querySelector("p:last-of-type"),
        "Once the right person comes in through the right route, Axiom keeps the brief, the documents, the follow-up, and the next action visible so momentum does not leak away."
      );
    }

    const agentPanel = document.querySelector("#property-experts .agent-benefit-panel");
    if (agentPanel) {
      const panelTexts = agentPanel.querySelectorAll("p.eyebrow, h3, p");
      if (panelTexts[0]) panelTexts[0].textContent = "For Agents And Support Teams";
      if (panelTexts[1]) panelTexts[1].textContent = "Look more organised. Respond with more confidence. Chase less.";
      if (panelTexts[2]) {
        panelTexts[2].textContent = "Axiom prepares the seller or buyer brief before you engage, keeps WhatsApp follow-up visible, and tracks documents, case notes, deadlines, and next actions in one place so clients feel the difference.";
      }

      const items = agentPanel.querySelectorAll("li");
      if (items[0]) items[0].textContent = "Stronger buyer and seller context before first contact";
      if (items[1]) items[1].textContent = "Clear referral proof and acceptance visibility";
      if (items[2]) items[2].textContent = "Document and requirement tracking for each live matter";
      if (items[3]) items[3].textContent = "Messages, notes, and updates saved back to the file";

      const links = agentPanel.querySelectorAll("a");
      links.forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        if (href.includes("buyers.html")) link.textContent = "See buyer route";
        if (href.includes("agents.html")) link.textContent = "See agent route";
        if (href.includes("expertapplicationform")) link.textContent = "Apply as a property expert";
      });
    }
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

  function uniqueSortedTowns(townList) {
    return Array.from(new Set((Array.isArray(townList) ? townList : []).map((town) => String(town || "").trim()).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right)
    );
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
      const created = createSelectField("expertTown", "town", "Town / city", FALLBACK_PROVINCE_PLACEHOLDER);
      created.select.disabled = true;
      areasLabel.before(created.label);
      townSelect = created.select;
    }

    if (areasInput) {
      areasInput.placeholder = "Select a town or add extra suburbs";
    }

    if (!provinceSelect || !townSelect) return;

    function fillProvinces() {
      provinceSelect.innerHTML = "";
      addOption(provinceSelect, "", "Select province");
      southAfricanProvinces.forEach((province) => addOption(provinceSelect, province, province));
    }

    function fillTowns(provinceName) {
      const towns = uniqueSortedTowns(getTownsByProvinceName(provinceName));
      townSelect.innerHTML = "";
      if (!provinceName || !towns.length) {
        townSelect.disabled = true;
        addOption(townSelect, "", FALLBACK_PROVINCE_PLACEHOLDER);
        return;
      }
      townSelect.disabled = false;
      addOption(townSelect, "", "Select town / city");
      towns.forEach((town) => addOption(townSelect, town, town));
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
    fillTowns(provinceSelect.value);
  }

  function normalizeAccessKeyText(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function applyMissionControlKeyGuard() {
    const gate = document.getElementById("adminGate");
    const otpInput = document.getElementById("adminOtp");
    const roleInput = document.getElementById("accessRouteRole");
    if (!gate || !otpInput || gate.dataset.keyGuardReady === "true") return;
    gate.dataset.keyGuardReady = "true";

    const aliases = {
      "axiomadmin2026": "AxiomAdmin2026!",
      "axiomadmin2026!": "AxiomAdmin2026!",
      "axiomadmim2026": "AxiomAdmin2026!",
      "axiomadmim2026!": "AxiomAdmin2026!",
      "axiomoffice2026": "AxiomOffice2026!",
      "axiomoffice2026!": "AxiomOffice2026!",
      "axiomagent2026": "AxiomAgent2026!",
      "axiomagent2026!": "AxiomAgent2026!"
    };

    gate.addEventListener(
      "submit",
      () => {
        const normalized = normalizeAccessKeyText(otpInput.value);
        const corrected = aliases[normalized];
        if (!corrected) return;
        otpInput.value = corrected;

        if (roleInput && corrected === "AxiomAdmin2026!") {
          roleInput.value = "principal";
          document.querySelectorAll("[data-access-route]").forEach((option) => {
            option.classList.toggle("active", option.dataset.accessRoute === "principal");
          });
        }
      },
      true
    );
  }

  applyHomepageMessaging();
  initExpertApplicationForm();
  applyMissionControlKeyGuard();

  window.AxiomPublicUi = Object.freeze({
    southAfricanProvinces,
    fallbackTownsByProvince,
    townsByProvince,
    normalizedTownsByProvince,
    FALLBACK_PROVINCE_PLACEHOLDER,
    propertyTypeOptions,
    normalizeProvinceName,
    getTownsByProvinceName,
    createTownDatalist,
    initExpertApplicationForm
  });
})(window, document);
