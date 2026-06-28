(function attachDataWorkflowsModule(window) {
  const publicUi = window.AxiomPublicUi || {};
  const southAfricanProvinces = publicUi.southAfricanProvinces || [];

  const paths = {
    buy: {
      label: "Buyer Brief",
      intro: "Quick buyer request",
      submitText: "Find me a property expert",
      responseText: "Thank you. We've received your request and will match you with a suitable property expert.",
      questions: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
        {
          name: "province",
          label: "Province",
          type: "select",
          required: true,
          options: southAfricanProvinces
        },
        {
          name: "area",
          label: "Preferred area",
          type: "text",
          required: true,
          townLookupByProvince: true,
          provinceField: "province",
          placeholder: "Start typing town name"
        },
        { name: "budget", label: "Budget range (ZAR)", type: "text", required: true },
        {
          name: "timeline",
          label: "Timeline to buy",
          type: "select",
          required: true,
          options: ["Immediately", "Within 1 month", "Within 3 months", "Within 6 months", "6+ months"]
        }
      ]
    },
    sell: {
      label: "Seller Brief",
      intro: "Quick seller request",
      submitText: "Sell my property",
      responseText: "Thank you. We've received your request and will match you with a suitable property expert.",
      questions: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "phone", label: "Contact / WhatsApp number", type: "text", required: true },
        {
          name: "province",
          label: "Province",
          type: "select",
          required: true,
          options: southAfricanProvinces
        },
        {
          name: "location",
          label: "Property location",
          type: "text",
          required: true,
          townLookupByProvince: true,
          provinceField: "province",
          placeholder: "Start typing town name"
        },
        {
          name: "expectedPrice",
          label: "Expected selling price (ZAR)",
          type: "text",
          required: true
        },
        {
          name: "timeline",
          label: "Timeline to sell",
          type: "select",
          required: true,
          options: ["Immediately", "Within 1 month", "Within 3 months", "Within 6 months", "6+ months"]
        }
      ]
    }
  };

  window.AxiomDataWorkflows = Object.freeze({ paths });
})(window);
