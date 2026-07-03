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
      defaultTab: "overview",
      allowedTabs: ["overview", "inbox", "progress", "followups", "risk", "sprint", "metrics", "registers", "whatsapp"],
      refreshTargets: { analytics: true, risk: true, followups: true, daily: true, assist: true, registers: true, whatsapp: true, progress: true }
    },
    agent: {
      label: "Agent workspace",
      defaultTab: "followups",
      allowedTabs: ["inbox", "followups", "risk"],
      refreshTargets: { analytics: true, risk: true, followups: true, daily: true, assist: true }
    },
    buyer: {
      label: "Buyer portal",
      defaultTab: "progress",
      allowedTabs: ["progress"],
      refreshTargets: { progress: true }
    },
    seller: {
      label: "Seller portal",
      defaultTab: "progress",
      allowedTabs: ["progress"],
      refreshTargets: { progress: true }
    }
  };

  function attachMissionControlUnlockPatch() {
    const adminGate = document.getElementById("adminGate");
    const adminMessage = document.getElementById("adminMessage");
    const analyticsSection = document.getElementById("analytics");
    const operationsPanel = document.getElementById("operationsPanel");
    const operationsRoleSelect = document.getElementById("operationsRole");
    const operationsRoleHint = document.getElementById("operationsRoleHint");
    const overviewTab = document.querySelector('[data-operations-tab="overview"]');
    const overviewPanel = document.querySelector('[data-operations-panel="overview"]');

    if (!adminGate || !adminMessage || !analyticsSection || !operationsPanel) {
      return;
    }

    function openMissionControlView() {
      analyticsSection.classList.remove("hidden");
      operationsPanel.classList.remove("hidden");
      adminGate.classList.add("hidden");

      if (operationsRoleSelect) {
        operationsRoleSelect.value = "admin";
        operationsRoleSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (operationsRoleHint) {
        operationsRoleHint.textContent = "Admin overview: full overview";
      }

      if (overviewTab instanceof HTMLButtonElement) {
        overviewTab.click();
      } else if (overviewPanel) {
        document
          .querySelectorAll("[data-operations-panel]")
          .forEach((panel) => panel.setAttribute("hidden", ""));
        overviewPanel.removeAttribute("hidden");
        overviewPanel.classList.add("active");
      }
    }

    function hasUnlockSuccess() {
      return /Mission Control unlocked/i.test(adminMessage.textContent || "");
    }

    const observer = new MutationObserver(() => {
      if (hasUnlockSuccess()) {
        openMissionControlView();
      }
    });

    observer.observe(adminMessage, {
      childList: true,
      characterData: true,
      subtree: true
    });

    if (hasUnlockSuccess()) {
      openMissionControlView();
    }
  }

  function attachHomepageRoutePatch() {
    const path = window.location.pathname || "/";
    const onHomepage = path === "/" || path.endsWith("/index.html");
    if (!onHomepage) {
      return;
    }

    const navLinks = document.querySelector(".nav-links");
    if (navLinks) {
      navLinks.innerHTML = [
        '<a class="admin-nav-link" href="#top" data-home-intent-link="sell">Sell a Property</a>',
        '<a class="admin-nav-link" href="#top" data-home-intent-link="buy">Buy a Property</a>',
        '<a class="admin-nav-link" href="#property-experts">Estate Agents</a>',
        '<a class="admin-nav-link" href="?admin=1#admin">Mission Control</a>'
      ].join("");
    }

    const eyebrow = document.querySelector(".hero .copy .eyebrow");
    const heroHeading = document.querySelector(".hero .copy h1");
    const heroSubtext = document.querySelector(".hero .copy .subtext");
    const proofGrid = document.querySelector(".hero-proof-grid");
    const ctaGroup = document.querySelector(".cta-group");
    const primarySellButton = document.querySelector('.hero-choice[data-intent="sell"]');
    const primaryBuyButton = document.querySelector('.hero-choice[data-intent="buy"]');
    const promiseText = document.querySelector(".promise-text");
    const flowTitle = document.querySelector(".hero-signal-panel strong");
    const flowCopy = document.querySelector(".hero-signal-panel small");

    if (eyebrow) eyebrow.textContent = "Axiom Realty AI";
    if (heroHeading) heroHeading.textContent = "Move before interest cools, momentum drifts, or the wrong first impression costs you.";
    if (heroSubtext) {
      heroSubtext.textContent =
        "Axiom helps sellers come in prepared, well positioned, and taken seriously while serious buyers move faster with clearer briefs and cleaner next steps. The sooner the right conversation starts, the better the chance of keeping momentum on your side.";
    }

    if (proofGrid) {
      proofGrid.innerHTML = [
        "<span><strong>Sellers</strong> Catch demand while it is still warm</span>",
        "<span><strong>Buyers</strong> Get lined up before the right property moves</span>",
        "<span><strong>Agents</strong> Respond faster with real context</span>"
      ].join("");
    }

    if (primarySellButton) primarySellButton.textContent = "I Want to Sell";
    if (primaryBuyButton) primaryBuyButton.textContent = "I Want to Buy";

    if (ctaGroup && !ctaGroup.querySelector('[data-home-agent-link="true"]')) {
      const agentLink = document.createElement("a");
      agentLink.className = "btn btn-secondary";
      agentLink.href = "#property-experts";
      agentLink.dataset.homeAgentLink = "true";
      agentLink.textContent = "I Am an Agent";
      ctaGroup.appendChild(agentLink);
    }

    if (promiseText) promiseText.textContent = "Faster contact. Better timing. Stronger momentum.";
    if (flowTitle) flowTitle.textContent = "Property. Area. Timing.";
    if (flowCopy) {
      flowCopy.textContent = "The next conversation starts with urgency, context, and a clearer chance of closing.";
    }

    document.querySelectorAll("[data-home-intent-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        const intent = event.currentTarget?.getAttribute("data-home-intent-link");
        const targetButton = intent ? document.querySelector(`.hero-choice[data-intent="${intent}"]`) : null;
        if (targetButton instanceof HTMLButtonElement) {
          event.preventDefault();
          targetButton.click();
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        attachMissionControlUnlockPatch();
        attachHomepageRoutePatch();
      },
      { once: true }
    );
  } else {
    attachMissionControlUnlockPatch();
    attachHomepageRoutePatch();
  }

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
