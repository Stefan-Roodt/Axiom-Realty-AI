window.townsByProvince = {
  "eastern-cape": [
    "East London",
    "Gqeberha",
    "Mthatha",
    "Queenstown",
    "Jeffreys Bay",
    "St Francis Bay",
    "Port Alfred",
    "Makhanda",
    "Graaff-Reinet",
    "Kariega",
    "Humansdorp",
    "King William's Town"
  ],
  "free-state": [
    "Bloemfontein",
    "Welkom",
    "Bethlehem",
    "Kroonstad",
    "Sasolburg",
    "Parys",
    "Harrismith",
    "Clarens",
    "Ficksburg",
    "Virginia",
    "Phuthaditjhaba",
    "Ladybrand"
  ],
  "gauteng": [
    "Johannesburg",
    "Sandton",
    "Randburg",
    "Roodepoort",
    "Midrand",
    "Centurion",
    "Pretoria",
    "Kempton Park",
    "Benoni",
    "Boksburg",
    "Alberton",
    "Edenvale",
    "Germiston",
    "Vereeniging",
    "Vanderbijlpark",
    "Krugersdorp"
  ],
  "kwazulu-natal": [
    "Durban",
    "Umhlanga",
    "Durban North",
    "Ballito",
    "Pinetown",
    "Hillcrest",
    "Pietermaritzburg",
    "Amanzimtoti",
    "Westville",
    "Kloof",
    "Richards Bay",
    "Empangeni",
    "Newcastle",
    "Margate",
    "Port Shepstone",
    "Howick"
  ],
  "limpopo": [
    "Polokwane",
    "Mokopane",
    "Tzaneen",
    "Hoedspruit",
    "Bela-Bela",
    "Modimolle",
    "Thohoyandou",
    "Louis Trichardt",
    "Lephalale",
    "Phalaborwa",
    "Giyani",
    "Makhado"
  ],
  "mpumalanga": [
    "Mbombela",
    "White River",
    "Hazyview",
    "Middelburg",
    "Witbank",
    "Secunda",
    "Ermelo",
    "Standerton",
    "Barberton",
    "Lydenburg",
    "Dullstroom",
    "Komatipoort"
  ],
  "north-west": [
    "Rustenburg",
    "Potchefstroom",
    "Klerksdorp",
    "Hartbeespoort",
    "Brits",
    "Mahikeng",
    "Lichtenburg",
    "Zeerust",
    "Vryburg",
    "Orkney",
    "Stilfontein",
    "Schweizer-Reneke"
  ],
  "northern-cape": [
    "Kimberley",
    "Upington",
    "Kuruman",
    "Springbok",
    "Kathu",
    "De Aar",
    "Colesberg",
    "Postmasburg",
    "Prieska",
    "Douglas",
    "Calvinia",
    "Hartswater"
  ],
  "western-cape": [
    "Cape Town",
    "Claremont",
    "Rondebosch",
    "Newlands",
    "Sea Point",
    "Somerset West",
    "Stellenbosch",
    "Paarl",
    "Bellville",
    "Durbanville",
    "Blouberg",
    "Hout Bay",
    "George",
    "Mossel Bay",
    "Knysna",
    "Hermanus",
    "Worcester",
    "Swellendam"
  ]
};

(function () {
  const form = document.getElementById("expertApplicationForm");
  if (!form) return;

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

  const townsByProvince = window.townsByProvince || {};
  const message = document.getElementById("expertApplicationMessage");

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

  function setMessage(text) {
    if (!message) return;
    message.textContent = text;
    message.classList.remove("hidden");
  }

  function fillProvinces() {
    if (!provinceSelect) return;
    provinceSelect.innerHTML = "";
    addOption(provinceSelect, "", "Select province");
    Object.keys(townsByProvince)
      .sort((left, right) => (provinceLabels[left] || left).localeCompare(provinceLabels[right] || right))
      .forEach((provinceId) => addOption(provinceSelect, provinceId, provinceLabels[provinceId] || provinceId));
  }

  function fillTowns(provinceId) {
    if (!townSelect) return;
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
    const town = townSelect?.value || "";
    if (!areasInput || !town) return;
    const current = areasInput.value.trim();
    const previousTown = areasInput.dataset.autofilledTown || "";

    if (!current || current === previousTown) {
      areasInput.value = town;
      areasInput.dataset.autofilledTown = town;
    }
  }

  provinceSelect?.addEventListener("change", () => {
    fillTowns(provinceSelect.value);
    if (areasInput && areasInput.value.trim() === (areasInput.dataset.autofilledTown || "")) {
      areasInput.value = "";
      areasInput.dataset.autofilledTown = "";
    }
  });

  townSelect?.addEventListener("change", autofillAreas);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const agentName = form.elements.name?.value?.trim() || "Agent";
    const town = townSelect?.value || areasInput?.value?.trim() || "your area";
    setMessage(`${agentName}, your application has been captured for ${town}. Axiom will use your mobile for WhatsApp follow-up and your email for formal records.`);
    form.reset();
    fillTowns("");
  });

  fillProvinces();
  fillTowns("");
})();
