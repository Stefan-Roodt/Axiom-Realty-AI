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

  function initPublicUi() {
    initExpertApplicationForm();
    initFloatingConcierge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPublicUi);
  } else {
    initPublicUi();
  }
})();
