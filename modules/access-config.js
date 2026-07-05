function readConfigSecret(env, names, fallback) {
  for (const name of names) {
    const value = String(env[name] || "").trim();
    if (value) {
      return { value, source: name };
    }
  }
  return { value: fallback, source: "local default" };
}

function readBooleanEnv(env, name, fallback = false) {
  const value = String(env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export function createAccessConfig(env = process.env, options = {}) {
  const environment = options.environment || env.NODE_ENV || "local";
  const isRenderRuntime = readBooleanEnv(env, "RENDER", false) || Boolean(env.RENDER_SERVICE_ID);

  const principalAccessKey = readConfigSecret(env, ["PRINCIPAL_ACCESS_KEY", "ADMIN_ACCESS_KEY", "ADMIN_PASSWORD"], "AxiomAdmin2026!");
  const officeAdminAccessKey = readConfigSecret(env, ["OFFICE_ADMIN_ACCESS_KEY", "OFFICE_ADMIN_PASSWORD"], "AxiomOffice2026!");
  const agentAccessKey = readConfigSecret(env, ["AGENT_ACCESS_KEY", "AGENT_PASSWORD"], "AxiomAgent2026!");
  const buyerAccessKey = readConfigSecret(env, ["BUYER_ACCESS_KEY", "BUYER_PASSWORD"], "AxiomBuyer2026!");
  const sellerAccessKey = readConfigSecret(env, ["SELLER_ACCESS_KEY", "SELLER_PASSWORD"], "AxiomSeller2026!");
  const attorneyAccessKey = readConfigSecret(env, ["ATTORNEY_ACCESS_KEY", "ATTORNEY_PASSWORD"], "AxiomAttorney2026!");
  const bondOriginatorAccessKey = readConfigSecret(
    env,
    ["BOND_ORIGINATOR_ACCESS_KEY", "BOND_ORIGINATOR_PASSWORD"],
    "AxiomBond2026!"
  );

  const roleAccessKeys = {
    principal: principalAccessKey.value,
    office_admin: officeAdminAccessKey.value,
    concierge: officeAdminAccessKey.value,
    agent: agentAccessKey.value,
    buyer: buyerAccessKey.value,
    seller: sellerAccessKey.value,
    attorney: attorneyAccessKey.value,
    bond_originator: bondOriginatorAccessKey.value
  };

  const roleAccessKeySources = {
    principal: principalAccessKey.source,
    office_admin: officeAdminAccessKey.source,
    concierge: officeAdminAccessKey.source,
    agent: agentAccessKey.source,
    buyer: buyerAccessKey.source,
    seller: sellerAccessKey.source,
    attorney: attorneyAccessKey.source,
    bond_originator: bondOriginatorAccessKey.source
  };

  const roleSigninContacts = {
    principal: (env.PRINCIPAL_SIGNIN_CONTACT || "principal@axiom.local").trim(),
    office_admin: (env.OFFICE_ADMIN_SIGNIN_CONTACT || "office@axiom.local").trim(),
    concierge: (env.OFFICE_ADMIN_SIGNIN_CONTACT || "office@axiom.local").trim(),
    agent: (env.AGENT_SIGNIN_CONTACT || "agent@axiom.local").trim(),
    buyer: (env.BUYER_SIGNIN_CONTACT || "buyer@axiom.local").trim(),
    seller: (env.SELLER_SIGNIN_CONTACT || "seller@axiom.local").trim(),
    attorney: (env.ATTORNEY_SIGNIN_CONTACT || "attorney@axiom.local").trim(),
    bond_originator: (env.BOND_ORIGINATOR_SIGNIN_CONTACT || "bond@axiom.local").trim()
  };

  const permissionCatalog = {
    "system.view": "See platform health and backend status",
    "leads.create": "Register new leads and imports",
    "leads.view_all": "See the full office lead pipeline",
    "leads.view_assigned": "See assigned live leads",
    "leads.assign": "Route leads between office and agents",
    "progress.view_all": "See all live transaction progress",
    "progress.view_assigned": "See assigned live transaction progress",
    "reminders.view_all": "See the full reminder and action queue",
    "reminders.view_assigned": "See assigned reminder and action queue",
    "escalations.view_all": "See office escalation queues",
    "escalations.view_assigned": "See assigned escalations",
    "analytics.view_all": "See office-wide momentum and analytics",
    "analytics.view_self": "See personal momentum and analytics",
    "scorecards.view_all": "See all agent scorecards",
    "scorecards.view_self": "See personal scorecards",
    "service_pulse.view_all": "See all buyer and seller service pulse feedback",
    "service_pulse.view_assigned": "See assigned buyer and seller service pulse feedback",
    "service_pulse.capture": "Capture service pulse feedback",
    "commission.view_all": "See the full commission protection desk",
    "commission.view_assigned": "See assigned commission protection matters",
    "commission.protect": "Protect a deal and log commission proof",
    "comms.view_all": "See the full comms and WhatsApp trail",
    "comms.view_assigned": "See assigned comms and WhatsApp trail",
    "dealroom.share": "Create and share client Deal Room links",
    "pilot.view_all": "See WhatsApp pilot readiness across agents",
    "pilot.view_assigned": "See assigned WhatsApp pilot readiness",
    "pilot.manage": "Manage pilot agents, WhatsApp test scenarios and pilot issues",
    "agent_directory.view_all": "See the internal agent network directory",
    "agent_directory.view_assigned": "See assigned agent network directory records",
    "agent_directory.manage": "Create, verify and maintain sourced agent directory records",
    "agent_directory.outreach": "Log controlled outreach and pilot invitations",
    "seller_updates.approve": "Approve seller update packs before send",
    "market_updates.send": "Create market updates for clients",
    "referrals.accept": "Accept referral terms before lead activation",
    "client.view_own": "See own client progress and communication trail",
    "dealroom.view_assigned": "See assigned Deal Room progress",
    "org.manage_assigned": "Manage assigned agencies, branches, admins and agents",
    "rollups.view_all": "See agency, branch, province and agent rollups",
    "rollups.view_assigned": "See assigned province, branch and agent rollups",
    "audit.view": "See security and audit activity",
    "export.download": "Download office backup exports"
  };

  const workspaceTabDefinitions = {
    inbox: ["leads.view_all", "leads.view_assigned"],
    progress: ["progress.view_all", "progress.view_assigned"],
    followups: ["reminders.view_all", "reminders.view_assigned"],
    risk: ["escalations.view_all", "escalations.view_assigned"],
    sprint: ["analytics.view_all", "analytics.view_self"],
    metrics: ["scorecards.view_all", "scorecards.view_self"],
    registers: ["commission.view_all", "commission.view_assigned"],
    whatsapp: ["comms.view_all", "comms.view_assigned", "client.view_own"],
    network: ["agent_directory.view_all", "agent_directory.view_assigned"]
  };

  const accessProfiles = {
    principal: {
      label: "Estate principal",
      gateLabel: "Estate principal sign-in code",
      allowedViews: ["admin", "agent", "buyer", "seller"],
      defaultView: "admin",
      workspaceTabs: Object.keys(workspaceTabDefinitions),
      accessNote: "Signed in as estate principal. Full agency, branch, admin, agent, buyer, seller, province and rollup view unlocked.",
      permissions: Object.keys(permissionCatalog)
    },
    office_admin: {
      label: "Concierge / admin",
      gateLabel: "Concierge admin sign-in code",
      allowedViews: ["admin", "agent", "buyer", "seller"],
      defaultView: "admin",
      workspaceTabs: ["inbox", "progress", "followups", "risk", "sprint", "metrics", "registers", "whatsapp", "network"],
      accessNote: "Signed in as concierge admin. Assigned agents, branches, leads, reminders, protection, progress, and comms are unlocked.",
      permissions: [
        "system.view",
        "leads.create",
        "leads.view_all",
        "leads.assign",
        "progress.view_all",
        "reminders.view_all",
        "escalations.view_all",
        "analytics.view_all",
        "scorecards.view_all",
        "service_pulse.view_all",
        "service_pulse.capture",
        "commission.view_all",
        "commission.protect",
        "comms.view_all",
        "dealroom.share",
        "pilot.view_all",
        "pilot.manage",
        "agent_directory.view_assigned",
        "agent_directory.manage",
        "agent_directory.outreach",
        "seller_updates.approve",
        "market_updates.send",
        "referrals.accept",
        "org.manage_assigned",
        "rollups.view_assigned"
      ]
    },
    agent: {
      label: "Agent workspace",
      gateLabel: "Agent workspace sign-in code",
      allowedViews: ["agent", "buyer"],
      defaultView: "agent",
      workspaceTabs: ["inbox", "progress", "followups", "risk", "metrics", "registers", "whatsapp"],
      accessNote: "Signed in as agent. Assigned cases, client updates, protection, and live comms are unlocked.",
      permissions: [
        "leads.create",
        "leads.view_assigned",
        "progress.view_assigned",
        "reminders.view_assigned",
        "escalations.view_assigned",
        "analytics.view_self",
        "scorecards.view_self",
        "service_pulse.view_assigned",
        "service_pulse.capture",
        "commission.view_assigned",
        "commission.protect",
        "comms.view_assigned",
        "dealroom.share",
        "pilot.view_assigned",
        "seller_updates.approve",
        "market_updates.send",
        "referrals.accept"
      ]
    },
    buyer: {
      label: "Buyer",
      gateLabel: "Buyer sign-in code",
      allowedViews: ["buyer"],
      defaultView: "buyer",
      workspaceTabs: ["progress", "followups", "whatsapp"],
      accessNote: "Signed in as buyer. Only your own progress, next steps, and message trail are visible.",
      permissions: [
        "client.view_own",
        "dealroom.view_assigned",
        "progress.view_assigned",
        "reminders.view_assigned",
        "comms.view_assigned"
      ]
    },
    seller: {
      label: "Seller",
      gateLabel: "Seller sign-in code",
      allowedViews: ["seller"],
      defaultView: "seller",
      workspaceTabs: ["progress", "followups", "whatsapp"],
      accessNote: "Signed in as seller. Only your own sale progress, next steps, and message trail are visible.",
      permissions: [
        "client.view_own",
        "dealroom.view_assigned",
        "progress.view_assigned",
        "reminders.view_assigned",
        "comms.view_assigned"
      ]
    },
    attorney: {
      label: "Attorney",
      gateLabel: "Attorney sign-in code",
      allowedViews: ["seller"],
      defaultView: "seller",
      workspaceTabs: ["progress", "followups", "whatsapp"],
      accessNote: "Signed in as attorney. Only assigned transfer progress, outstanding items, and message trail are visible.",
      permissions: [
        "client.view_own",
        "dealroom.view_assigned",
        "progress.view_assigned",
        "reminders.view_assigned",
        "comms.view_assigned"
      ]
    },
    bond_originator: {
      label: "Bond originator",
      gateLabel: "Bond originator sign-in code",
      allowedViews: ["buyer"],
      defaultView: "buyer",
      workspaceTabs: ["progress", "followups", "whatsapp"],
      accessNote: "Signed in as bond originator. Only assigned finance progress, outstanding items, and message trail are visible.",
      permissions: [
        "client.view_own",
        "dealroom.view_assigned",
        "progress.view_assigned",
        "reminders.view_assigned",
        "comms.view_assigned"
      ]
    }
  };

  function normalizeRole(role) {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (normalized === "agent") return "agent";
    if (normalized === "office_admin" || normalized === "office" || normalized === "concierge") return "office_admin";
    if (normalized === "principal" || normalized === "admin" || normalized === "estate_principal") return "principal";
    if (normalized === "buyer") return "buyer";
    if (normalized === "seller") return "seller";
    if (normalized === "attorney" || normalized === "conveyancer") return "attorney";
    if (normalized === "bond" || normalized === "bond_originator" || normalized === "originator") return "bond_originator";
    return "principal";
  }

  function getRoleKey(role) {
    return roleAccessKeys[normalizeRole(role)] || roleAccessKeys.principal;
  }

  function getRoleProfile(role) {
    return accessProfiles[normalizeRole(role)] || accessProfiles.principal;
  }

  function getRolePermissions(role) {
    return getRoleProfile(role).permissions || [];
  }

  function getWorkspaceTabs(role) {
    return getRoleProfile(role).workspaceTabs || [];
  }

  function getRoleSigninContact(role) {
    return roleSigninContacts[normalizeRole(role)] || roleSigninContacts.principal;
  }

  function hasPermission(role, permission) {
    return getRolePermissions(role).includes(permission);
  }

  function hasAnyPermission(role, permissions = []) {
    return permissions.some((permission) => hasPermission(role, permission));
  }

  function getPermissionLabels(permissions = []) {
    return permissions.map((permission) => ({
      key: permission,
      label: permissionCatalog[permission] || permission
    }));
  }

  return {
    isRenderRuntime,
    accessConfig: {
      principalAccessKey: roleAccessKeys.principal,
      officeAdminAccessKey: roleAccessKeys.office_admin,
      agentAccessKey: roleAccessKeys.agent,
      accessKeySources: roleAccessKeySources,
      principalSigninContact: roleSigninContacts.principal,
      officeAdminSigninContact: roleSigninContacts.office_admin,
      agentSigninContact: roleSigninContacts.agent,
      buyerSigninContact: roleSigninContacts.buyer,
      sellerSigninContact: roleSigninContacts.seller,
      attorneySigninContact: roleSigninContacts.attorney,
      bondOriginatorSigninContact: roleSigninContacts.bond_originator,
      sessionHours: Math.max(1, Number(env.MISSION_CONTROL_SESSION_HOURS || 8)),
      otpMinutes: Math.max(3, Number(env.MISSION_CONTROL_OTP_MINUTES || 10)),
      cookieSecure: readBooleanEnv(env, "COOKIE_SECURE", environment === "production"),
      otpPreviewEnabled: readBooleanEnv(env, "MISSION_CONTROL_OTP_PREVIEW", environment !== "production")
    },
    permissionCatalog,
    workspaceTabDefinitions,
    accessProfiles,
    normalizeRole,
    getRoleKey,
    getRoleProfile,
    getRolePermissions,
    getWorkspaceTabs,
    getRoleSigninContact,
    hasPermission,
    hasAnyPermission,
    getPermissionLabels
  };
}
