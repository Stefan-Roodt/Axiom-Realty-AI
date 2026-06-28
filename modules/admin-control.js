(function attachAdminControlModule(window) {
  const estateAgencyOptions = [
    "3%.Com Properties",
    "@Realty",
    "Acutts",
    "AIDA",
    "Apple Property",
    "Better Homes",
    "Century 21",
    "Chas Everitt",
    "Dormehl Phalane Property Group",
    "Engel & Volkers",
    "eXp South Africa",
    "Fine & Country",
    "Greeff Christie's International Real Estate",
    "Harcourts",
    "Huizemark",
    "Jawitz Properties",
    "Just Property",
    "Keller Williams",
    "Leapfrog",
    "Lew Geffen Sotheby's International Realty",
    "Meridian Realty",
    "Only Realty",
    "Other / Independent",
    "Pam Golding Properties",
    "Property.CoZa",
    "Rawson Properties",
    "RealNet",
    "RE/MAX",
    "Seeff",
    "Sotheby's International Realty",
    "Tyson Properties",
    "Urban Link",
    "Wakefields"
  ];

  const manualLifecycleStageOptions = [
    { value: "acknowledged", label: "Acknowledged" },
    { value: "with-agent", label: "With agent" },
    { value: "sale-pending", label: "Sale pending" },
    { value: "sale-concluded", label: "Sale concluded" },
    { value: "closed", label: "Closed" }
  ];

  const referralAcceptanceViaOptions = ["Signed form", "Portal acknowledgement", "WhatsApp", "Phone call", "Email", "SMS", "In person", "Other"];
  const dealMilestoneOptions = [
    { value: "referral-accepted", label: "Referral accepted" },
    { value: "agent-contacted", label: "Agent contacted client" },
    { value: "viewing-booked", label: "Viewing/valuation booked" },
    { value: "offer-received", label: "Offer received" },
    { value: "otp-signed", label: "Offer to purchase signed" },
    { value: "sale-pending", label: "Sale pending" },
    { value: "suspensive-conditions", label: "Suspensive conditions tracked" },
    { value: "bond-approval", label: "Bond approval confirmed" },
    { value: "guarantees-issued", label: "Guarantees issued" },
    { value: "transfer-instruction", label: "Transfer instruction sent" },
    { value: "fica-complete", label: "FICA complete" },
    { value: "compliance-certificates", label: "Compliance certificates ready" },
    { value: "rates-clearance", label: "Rates clearance issued" },
    { value: "transfer-documents-signed", label: "Transfer documents signed" },
    { value: "bond-documents-signed", label: "Bond documents signed" },
    { value: "lodged", label: "Lodged at Deeds Office" },
    { value: "registered", label: "Registered" },
    { value: "sale-concluded", label: "Sale concluded" },
    { value: "handover-complete", label: "Handover complete" },
    { value: "deal-lost", label: "Deal lost/closed" }
  ];

  const commissionPayoutStatusOptions = ["Not due", "Due", "Invoiced", "Paid", "Disputed", "Waived"];
  const leadDocumentCategoryOptions = [
    "FICA",
    "Offer to Purchase (OTP)",
    "Certificates",
    "Proof of payment",
    "Compliance documents",
    "Transfer documents",
    "Bond documents",
    "Rates clearance",
    "Referral acceptance proof",
    "Agent introduction proof",
    "Milestone evidence",
    "Commission invoice",
    "Commission payment proof",
    "Communication log",
    "Other"
  ];

  const leadCaseModeOptions = [
    { value: "undecided", label: "Undecided" },
    { value: "referral_only", label: "Referral-only" },
    { value: "managed_transaction", label: "Managed transaction" },
    { value: "archived", label: "Archived" }
  ];

  const leadCommercialStatusOptions = [
    { value: "new", label: "New" },
    { value: "handed_off", label: "Handed off" },
    { value: "accepted_by_agent", label: "Accepted by agent" },
    { value: "client_contacted", label: "Client contacted" },
    { value: "referral_fee_due", label: "Referral fee due" },
    { value: "referral_fee_paid", label: "Referral fee paid" },
    { value: "under_management", label: "Under management" },
    { value: "transaction_closed", label: "Transaction closed" },
    { value: "archived", label: "Archived" }
  ];

  const leadStageTabOptions = [
    { value: "all", label: "All" },
    { value: "new-unacknowledged", label: "New" },
    { value: "in-progress", label: "In progress" },
    { value: "with-agent", label: "With agent" },
    { value: "sale-pending", label: "Sale pending" },
    { value: "closed", label: "Closed" }
  ];

  const operationsRoleProfiles = {
    admin: {
      label: "Admin overview",
      defaultTab: "inbox",
      allowedTabs: ["inbox", "progress", "followups", "risk", "sprint", "metrics", "registers", "whatsapp"],
      refreshTargets: { analytics: true, risk: true, followups: true, daily: true, assist: true, registers: true, whatsapp: true, progress: true }
    },
    agent: {
      label: "Agent workspace",
      defaultTab: "followups",
      allowedTabs: ["inbox", "followups", "risk"],
      refreshTargets: { analytics: true, risk: true, followups: true, daily: true, assist: true }
    },
    buyer: {
      label: "Client progress portal",
      defaultTab: "progress",
      allowedTabs: ["progress"],
      refreshTargets: { progress: true }
    }
  };

  window.AxiomAdminControl = Object.freeze({
    estateAgencyOptions,
    manualLifecycleStageOptions,
    referralAcceptanceViaOptions,
    dealMilestoneOptions,
    commissionPayoutStatusOptions,
    leadDocumentCategoryOptions,
    leadCaseModeOptions,
    leadCommercialStatusOptions,
    leadStageTabOptions,
    operationsRoleProfiles
  });
})(window);
