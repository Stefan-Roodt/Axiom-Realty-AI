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

  window.AxiomPublicUi = Object.freeze({
    southAfricanProvinces,
    fallbackTownsByProvince,
    townsByProvince,
    normalizedTownsByProvince,
    FALLBACK_PROVINCE_PLACEHOLDER,
    propertyTypeOptions,
    normalizeProvinceName,
    getTownsByProvinceName,
    createTownDatalist
  });
})(window, document);
