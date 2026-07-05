import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const dataFiles = ["leads.json", "auth-sessions.json", "audit-log.json", "auth-otp.json", "operations-state.json"];

async function snapshotData() {
  const snapshots = new Map();
  for (const fileName of dataFiles) {
    const filePath = path.join(dataDir, fileName);
    try {
      snapshots.set(fileName, await fs.readFile(filePath, "utf8"));
    } catch {
      snapshots.set(fileName, "[]\n");
    }
  }
  return snapshots;
}

async function restoreData(snapshots) {
  await fs.mkdir(dataDir, { recursive: true });
  for (const [fileName, contents] of snapshots.entries()) {
    await fs.writeFile(path.join(dataDir, fileName), contents, "utf8");
  }
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body
  };
}

async function loginRole(baseUrl, role, contact, fallbackCode) {
  const otpRequest = await requestJson(baseUrl, "/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, contact })
  });
  const login = await requestJson(baseUrl, "/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role,
      contact,
      code: otpRequest.body?.devCodePreview || fallbackCode
    })
  });
  return {
    otpRequest,
    login,
    cookie: login.headers["set-cookie"] || ""
  };
}

async function run() {
  const snapshots = await snapshotData();
  const { server, host, port } = await startServer({
    host: "127.0.0.1",
    port: Number(process.env.VERIFY_PORT || 8091)
  });
  const baseUrl = `http://${host}:${port}`;

  try {
    const health = await requestJson(baseUrl, "/healthz");
    const appStatus = await requestJson(baseUrl, "/api/app-status");
    const accessModel = await requestJson(baseUrl, "/api/auth/access-model");
    const fallbackCode =
      process.env.PRINCIPAL_ACCESS_KEY ||
      process.env.ADMIN_ACCESS_KEY ||
      process.env.ADMIN_PASSWORD ||
      "AxiomAdmin2026!";
    const fallbackLogin = await requestJson(baseUrl, "/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "principal",
        contact: process.env.PRINCIPAL_SIGNIN_CONTACT || "principal@axiom.local",
        code: fallbackCode
      })
    });
    const fallbackCookie = fallbackLogin.headers["set-cookie"] || "";
    const systemStatus = await requestJson(baseUrl, "/api/system-status", {
      headers: { cookie: fallbackCookie }
    });
    await requestJson(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: { cookie: fallbackCookie }
    });
    const otpRequest = await requestJson(baseUrl, "/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "principal",
        contact: process.env.PRINCIPAL_SIGNIN_CONTACT || "principal@axiom.local"
      })
    });
    const login = await requestJson(baseUrl, "/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "principal",
        contact: process.env.PRINCIPAL_SIGNIN_CONTACT || "principal@axiom.local",
        code: otpRequest.body?.devCodePreview
      })
    });
    const cookie = login.headers["set-cookie"] || "";
    const session = await requestJson(baseUrl, "/api/auth/session", {
      headers: { cookie }
    });
    const operations = await requestJson(baseUrl, "/api/admin/operations", {
      headers: { cookie }
    });
    const caseBrain = await requestJson(baseUrl, "/api/admin/case-brain", {
      headers: { cookie }
    });
    const aiValue = await requestJson(baseUrl, "/api/ai/value-opportunities", {
      headers: { cookie }
    });
    const protectCommission = await requestJson(baseUrl, "/api/admin/protection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        caseName: "Verification protected deal",
        agent: "Verification Agent",
        split: "25% referral split",
        fee: "R10,000",
        dueDate: "2026-07-30",
        evidence: "Verification proof saved"
      })
    });
    const shareDealRoom = await requestJson(baseUrl, "/api/admin/dealroom/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        caseName: "Verification share room",
        clientName: "Verification Client",
        stage: "Offer accepted",
        progress: 40,
        nextStep: "Attorney to confirm the next signature slot.",
        accessCode: "AX-TEST",
        roomId: "VERIFY-ROOM"
      })
    });
    const publicDealRoom = await requestJson(baseUrl, "/api/public/deal-room/access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId: "VERIFY-ROOM",
        accessCode: "AX-TEST"
      })
    });
    const servicePulse = await requestJson(baseUrl, "/api/public/service-pulse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId: "VERIFY-ROOM",
        accessCode: "AX-TEST",
        respondentRole: "seller",
        respondentName: "Verification Client",
        touchpoint: "weekly seller update",
        score: 9,
        tags: ["clear update", "quick response"],
        comment: "The update was clear and I knew what would happen next."
      })
    });
    const lead = await requestJson(baseUrl, "/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        intent: "sell",
        label: "Backend verification lead",
        additionalInfo: "Smoke test run",
        mobile: "+27 82 555 0199",
        email: "verification.client@example.co.za",
        contact: {
          mobile: "+27 82 555 0199",
          email: "verification.client@example.co.za",
          preferred: "WhatsApp"
        },
        answers: [
          { label: "Seller name", value: "Verification User" },
          { label: "Mobile", value: "+27 82 555 0199" },
          { label: "Email", value: "verification.client@example.co.za" },
          { label: "Suburb", value: "Claremont" },
          { label: "Property type", value: "House" },
          { label: "Expected price", value: "R3.8m" },
          { label: "Bedrooms", value: "3" },
          { label: "Bathrooms", value: "2" },
          { label: "Condition", value: "Good condition with modern kitchen" }
        ]
      })
    });
    const pilotScenario = await requestJson(baseUrl, "/api/admin/pilot/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "queue_scenario",
        agentId: "agent-aisha",
        scenarioId: "scenario-deal-room-share"
      })
    });
    const pilotIssue = await requestJson(baseUrl, "/api/admin/pilot/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "log_issue",
        agentId: "agent-aisha",
        scenarioId: "scenario-deal-room-share",
        severity: "medium",
        summary: "Verification issue log for pilot control room"
      })
    });
    const agentNetworkSnapshot = await requestJson(baseUrl, "/api/admin/agent-network", {
      headers: { cookie }
    });
    const agentNetworkRecord = await requestJson(baseUrl, "/api/admin/agent-network/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "add_record",
        record: {
          id: "network-verification-agent",
          agentName: "Verification Network Agent",
          agencyName: "Verification Realty",
          branchName: "Pretoria North",
          province: "Gauteng",
          towns: ["Pretoria", "Centurion"],
          suburbs: ["Pretoria North", "Centurion"],
          specialties: ["seller mandates", "buyer qualification"],
          languages: ["English", "Afrikaans"],
          independentStatus: "independent",
          ppraStatus: "to_confirm",
          contact: {
            email: "verification.agent@example.co.za",
            mobile: "+27 82 444 0101",
            whatsapp: "+27 82 444 0101",
            website: "https://example.co.za/agents/verification-agent"
          },
          source: {
            type: "public_domain",
            name: "Verification public profile",
            url: "https://example.co.za/agents/verification-agent",
            note: "Public business profile used for backend verification."
          },
          consent: {
            emailStatus: "not_contacted",
            whatsappStatus: "not_contacted",
            doNotContact: false
          },
          verification: {
            status: "source_found"
          },
          matchingSignals: {
            sellerFit: 82,
            buyerFit: 74,
            referralFit: 80,
            responseReliability: 68
          }
        }
      })
    });
    const agentNetworkVerify = await requestJson(baseUrl, "/api/admin/agent-network/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "mark_verified",
        recordId: "network-verification-agent",
        reviewNote: "Verification source checked during backend test."
      })
    });
    const agentNetworkConsent = await requestJson(baseUrl, "/api/admin/agent-network/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "update_consent",
        recordId: "network-verification-agent",
        emailStatus: "business_context",
        whatsappStatus: "opted_in",
        doNotContact: false,
        lawfulUseNote: "Verified public business profile; controlled one-to-one pilot invitation allowed."
      })
    });
    const agentNetworkOutreach = await requestJson(baseUrl, "/api/admin/agent-network/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "log_outreach",
        recordId: "network-verification-agent",
        channel: "WhatsApp",
        purpose: "pilot_invitation",
        queueMessage: true,
        message: "Hi Verification Network Agent. Axiom is testing a controlled estate-agent pilot. Would you be open to a short WhatsApp introduction? Reply STOP if you prefer not to be contacted."
      })
    });
    const agentNetworkPilot = await requestJson(baseUrl, "/api/admin/agent-network/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        action: "promote_to_pilot",
        recordId: "network-verification-agent"
      })
    });
    const analytics = await requestJson(baseUrl, "/api/analytics", {
      headers: { cookie }
    });
    const operationsAfterLead = await requestJson(baseUrl, "/api/admin/operations", {
      headers: { cookie }
    });
    const reporting = await requestJson(baseUrl, "/api/admin/reporting", {
      headers: { cookie }
    });
    const principalOnboarding = await requestJson(baseUrl, "/api/admin/onboard-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        role: "principal",
        personName: "L. Ferreira",
        agencyName: "RE/MAX Potchefstroom",
        branchName: "Potchefstroom",
        town: "Potchefstroom",
        province: "North West",
        email: "l.ferreira@remax-potch.example.co.za",
        mobile: "+27 82 000 1100",
        agentSeats: 8,
        adminSeats: 1,
        packageLabel: "Axiom Mission Control"
      })
    });
    const agentOnboarding = await requestJson(baseUrl, "/api/admin/onboard-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        role: "agent",
        personName: "RE/MAX Potch Agent 1",
        agencyName: "RE/MAX Potchefstroom",
        branchName: "Potchefstroom",
        town: "Potchefstroom",
        province: "North West",
        email: "agent1@remax-potch.example.co.za",
        mobile: "+27 82 000 1101"
      })
    });
    const sellerOnboarding = await requestJson(baseUrl, "/api/admin/onboard-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        role: "seller",
        personName: "Verification Seller",
        agencyName: "RE/MAX Potchefstroom",
        branchName: "Potchefstroom",
        town: "Potchefstroom",
        province: "North West",
        email: "seller.verify@example.co.za",
        mobile: "+27 82 000 1102",
        caseId: "verify-case",
        agentId: "agent-re-max-potch-agent-1-re-max-potchefstroom"
      })
    });
    const branchTeamRollout = await requestJson(baseUrl, "/api/admin/onboard-team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        agencyName: "RE/MAX Potchefstroom",
        branchName: "Potchefstroom",
        town: "Potchefstroom",
        province: "North West",
        admins: "Potch Office Admin | potch.admin@remax-potch.example.co.za | +27 82 000 1200",
        agents: [
          "RE/MAX Potch Agent 1 | agent1@remax-potch.example.co.za | +27 82 000 1201",
          "RE/MAX Potch Agent 2 | agent2@remax-potch.example.co.za | +27 82 000 1202"
        ]
      })
    });
    const queueMessage = await requestJson(baseUrl, "/api/admin/whatsapp/queue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        caseId: "verify-case",
        caseName: "Backend verification case",
        category: "verification",
        toName: "Verification Agent",
        toRole: "agent",
        ownerName: "Axiom",
        body: "Verification message"
      })
    });
    const processQueue = await requestJson(baseUrl, "/api/admin/whatsapp/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({ limit: 5 })
    });
    const logout = await requestJson(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: { cookie }
    });
    const sessionAfterLogout = await requestJson(baseUrl, "/api/auth/session", {
      headers: { cookie }
    });
    const officeAdminOtpRequest = await requestJson(baseUrl, "/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "office_admin",
        contact: process.env.OFFICE_ADMIN_SIGNIN_CONTACT || "office@axiom.local"
      })
    });
    const officeAdminLogin = await requestJson(baseUrl, "/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "office_admin",
        contact: process.env.OFFICE_ADMIN_SIGNIN_CONTACT || "office@axiom.local",
        code: officeAdminOtpRequest.body?.devCodePreview
      })
    });
    const officeAdminCookie = officeAdminLogin.headers["set-cookie"] || "";
    const officeAdminExport = await requestJson(baseUrl, "/api/admin/export", {
      headers: { cookie: officeAdminCookie }
    });
    const agentOtpRequest = await requestJson(baseUrl, "/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "agent",
        contact: process.env.AGENT_SIGNIN_CONTACT || "agent@axiom.local"
      })
    });
    const agentLogin = await requestJson(baseUrl, "/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "agent",
        contact: process.env.AGENT_SIGNIN_CONTACT || "agent@axiom.local",
        code: agentOtpRequest.body?.devCodePreview
      })
    });
    const agentCookie = agentLogin.headers["set-cookie"] || "";
    const agentAudit = await requestJson(baseUrl, "/api/admin/audit-log", {
      headers: { cookie: agentCookie }
    });
    const buyerAuth = await loginRole(
      baseUrl,
      "buyer",
      process.env.BUYER_SIGNIN_CONTACT || "buyer@axiom.local",
      process.env.BUYER_ACCESS_KEY || "AxiomBuyer2026!"
    );
    const buyerOperations = await requestJson(baseUrl, "/api/admin/operations", {
      headers: { cookie: buyerAuth.cookie }
    });
    const buyerAiValue = await requestJson(baseUrl, "/api/ai/value-opportunities", {
      headers: { cookie: buyerAuth.cookie }
    });
    const buyerExport = await requestJson(baseUrl, "/api/admin/export", {
      headers: { cookie: buyerAuth.cookie }
    });
    const sellerAuth = await loginRole(
      baseUrl,
      "seller",
      process.env.SELLER_SIGNIN_CONTACT || "seller@axiom.local",
      process.env.SELLER_ACCESS_KEY || "AxiomSeller2026!"
    );
    const sellerOperations = await requestJson(baseUrl, "/api/admin/operations", {
      headers: { cookie: sellerAuth.cookie }
    });
    const attorneyAuth = await loginRole(
      baseUrl,
      "attorney",
      process.env.ATTORNEY_SIGNIN_CONTACT || "attorney@axiom.local",
      process.env.ATTORNEY_ACCESS_KEY || "AxiomAttorney2026!"
    );
    const bondAuth = await loginRole(
      baseUrl,
      "bond_originator",
      process.env.BOND_ORIGINATOR_SIGNIN_CONTACT || "bond@axiom.local",
      process.env.BOND_ORIGINATOR_ACCESS_KEY || "AxiomBond2026!"
    );

    const failures = [
      !health.ok && `/healthz returned ${health.status}`,
      !appStatus.ok && `/api/app-status returned ${appStatus.status}`,
      !accessModel.ok && `/api/auth/access-model returned ${accessModel.status}`,
      !fallbackLogin.ok && `access-key fallback login returned ${fallbackLogin.status}`,
      !fallbackLogin.headers["set-cookie"] && "Access-key fallback login did not return a session cookie",
      !systemStatus.ok && `/api/system-status returned ${systemStatus.status}`,
      systemStatus.body?.diagnostics?.deployment?.accessKeyFallbackEnabled !== true &&
        "System status does not report access-key fallback enabled",
      systemStatus.body?.diagnostics?.whatsapp?.mode !== (process.env.WHATSAPP_MODE || "managed-simulation") &&
        "System status does not expose the WhatsApp test mode",
      !otpRequest.ok && `/api/auth/request-otp returned ${otpRequest.status}`,
      !login.ok && `/api/auth/verify-otp returned ${login.status}`,
      !session.ok && `/api/auth/session returned ${session.status}`,
      !operations.ok && `/api/admin/operations returned ${operations.status}`,
      !caseBrain.ok && `/api/admin/case-brain returned ${caseBrain.status}`,
      !aiValue.ok && `/api/ai/value-opportunities returned ${aiValue.status}`,
      !protectCommission.ok && `/api/admin/protection returned ${protectCommission.status}`,
      !shareDealRoom.ok && `/api/admin/dealroom/share returned ${shareDealRoom.status}`,
      !publicDealRoom.ok && `/api/public/deal-room/access returned ${publicDealRoom.status}`,
      !servicePulse.ok && `/api/public/service-pulse returned ${servicePulse.status}`,
      !lead.ok && `/api/leads returned ${lead.status}`,
      !pilotScenario.ok && `/api/admin/pilot/action queue_scenario returned ${pilotScenario.status}`,
      !pilotIssue.ok && `/api/admin/pilot/action log_issue returned ${pilotIssue.status}`,
      !agentNetworkSnapshot.ok && `/api/admin/agent-network returned ${agentNetworkSnapshot.status}`,
      !agentNetworkRecord.ok && `/api/admin/agent-network/action add_record returned ${agentNetworkRecord.status}`,
      !agentNetworkVerify.ok && `/api/admin/agent-network/action mark_verified returned ${agentNetworkVerify.status}`,
      !agentNetworkConsent.ok && `/api/admin/agent-network/action update_consent returned ${agentNetworkConsent.status}`,
      !agentNetworkOutreach.ok && `/api/admin/agent-network/action log_outreach returned ${agentNetworkOutreach.status}`,
      !agentNetworkPilot.ok && `/api/admin/agent-network/action promote_to_pilot returned ${agentNetworkPilot.status}`,
      !operationsAfterLead.ok && `/api/admin/operations after lead returned ${operationsAfterLead.status}`,
      !analytics.ok && `/api/analytics returned ${analytics.status}`,
      !reporting.ok && `/api/admin/reporting returned ${reporting.status}`,
      !reporting.body?.reporting?.rollups && "Reporting endpoint missing agency/branch/province/agent rollups",
      reporting.body?.reporting?.rollups && !("agents" in reporting.body.reporting.rollups) &&
        "Reporting endpoint missing agent rollups",
      !principalOnboarding.ok && `/api/admin/onboard-role principal returned ${principalOnboarding.status}`,
      principalOnboarding.body?.onboarding?.role !== "principal" && "Principal onboarding did not create principal role",
      principalOnboarding.body?.onboarding?.signIn?.accessScope?.agencyIds?.[0] !== "agency-re-max-potchefstroom" &&
        "Principal onboarding did not scope L. Ferreira to RE/MAX Potchefstroom",
      principalOnboarding.body?.onboarding?.signIn?.accessScope?.provinceIds?.[0] !== "north-west" &&
        "Principal onboarding did not scope L. Ferreira to North West",
      !agentOnboarding.ok && `/api/admin/onboard-role agent returned ${agentOnboarding.status}`,
      agentOnboarding.body?.onboarding?.role !== "agent" && "Agent onboarding did not create agent role",
      !sellerOnboarding.ok && `/api/admin/onboard-role seller returned ${sellerOnboarding.status}`,
      sellerOnboarding.body?.onboarding?.recordType !== "partyUser" && "Seller onboarding did not create a case party user",
      sellerOnboarding.body?.onboarding?.signIn?.accessScope?.caseIds?.[0] !== "verify-case" &&
        "Seller onboarding did not bind seller to the linked case",
      sellerOnboarding.body?.onboarding?.accessRecord?.profileImage?.status !== "requested" &&
        "Seller onboarding did not request a consent-based profile selfie",
      !branchTeamRollout.ok && `/api/admin/onboard-team returned ${branchTeamRollout.status}`,
      branchTeamRollout.body?.rollout?.counts?.admins !== 1 && "Branch team rollout did not create one admin",
      branchTeamRollout.body?.rollout?.counts?.agents !== 2 && "Branch team rollout did not create two agents",
      !branchTeamRollout.body?.rollout?.created?.every((item) => item.scope?.agencyIds?.[0] === "agency-re-max-potchefstroom") &&
        "Branch team rollout did not scope all people to RE/MAX Potchefstroom",
      !accessModel.body?.onboardingModel?.caseRoles?.some((item) => item.role === "buyer") &&
        "Access model missing buyer onboarding path",
      !accessModel.body?.onboardingModel?.internalRoles?.some((item) => item.role === "agent") &&
        "Access model missing agent onboarding path",
      !queueMessage.ok && `/api/admin/whatsapp/queue returned ${queueMessage.status}`,
      !processQueue.ok && `/api/admin/whatsapp/process returned ${processQueue.status}`,
      !logout.ok && `/api/auth/logout returned ${logout.status}`,
      !sessionAfterLogout.ok && `/api/auth/session after logout returned ${sessionAfterLogout.status}`,
      !otpRequest.body?.devCodePreview && "OTP request did not return a test code preview",
      !officeAdminOtpRequest.ok && `office admin OTP request returned ${officeAdminOtpRequest.status}`,
      !officeAdminLogin.ok && `office admin login returned ${officeAdminLogin.status}`,
      !agentOtpRequest.ok && `agent OTP request returned ${agentOtpRequest.status}`,
      !agentLogin.ok && `agent login returned ${agentLogin.status}`,
      !buyerAuth.otpRequest.ok && `buyer OTP request returned ${buyerAuth.otpRequest.status}`,
      !buyerAuth.login.ok && `buyer login returned ${buyerAuth.login.status}`,
      !sellerAuth.otpRequest.ok && `seller OTP request returned ${sellerAuth.otpRequest.status}`,
      !sellerAuth.login.ok && `seller login returned ${sellerAuth.login.status}`,
      !attorneyAuth.otpRequest.ok && `attorney OTP request returned ${attorneyAuth.otpRequest.status}`,
      !attorneyAuth.login.ok && `attorney login returned ${attorneyAuth.login.status}`,
      !bondAuth.otpRequest.ok && `bond originator OTP request returned ${bondAuth.otpRequest.status}`,
      !bondAuth.login.ok && `bond originator login returned ${bondAuth.login.status}`,
      !login.headers["set-cookie"] && "Login did not return a session cookie",
      !session.body?.authenticated && "Session did not report authenticated=true",
      session.body?.role !== "principal" && `Expected principal session, got ${session.body?.role}`,
      !Array.isArray(operations.body?.snapshot?.teamMembers) && "Operations snapshot missing team members",
      !Array.isArray(operations.body?.snapshot?.tasks) && "Operations snapshot missing tasks",
      !Array.isArray(operations.body?.snapshot?.commissionTimeline) && "Operations snapshot missing commission timeline",
      !Array.isArray(operations.body?.snapshot?.dealRooms) && "Operations snapshot missing deal rooms",
      !operations.body?.snapshot?.caseBrain?.model?.name && "Operations snapshot missing Case Brain model",
      !operations.body?.snapshot?.aiValue?.opportunities?.length && "Operations snapshot missing AI value opportunities",
      !caseBrain.body?.caseBrain?.model?.name && "Case Brain endpoint did not return the model",
      !aiValue.body?.aiValue?.opportunities?.length && "AI value endpoint did not return opportunities",
      !protectCommission.body?.item?.caseName && "Protection endpoint did not return a timeline item",
      !shareDealRoom.body?.room?.shareUrl && "Deal Room share endpoint did not return a share URL",
      publicDealRoom.body?.room?.roomId !== "VERIFY-ROOM" && "Public Deal Room access did not unlock the expected room",
      servicePulse.body?.servicePulse?.score !== 9 && "Service Pulse endpoint did not store the expected score",
      !lead.body?.leadId && "Lead creation did not return a leadId",
      !lead.body?.leadQuality?.band && "Lead creation did not return a quality band",
      !lead.body?.briefCard?.handoffStage && "Lead creation did not return a brief card",
      !lead.body?.sourceToSale?.sourceKey && "Lead creation did not return source-to-sale details",
      !Array.isArray(operationsAfterLead.body?.snapshot?.leads) && "Operations snapshot missing scored leads",
      !operationsAfterLead.body?.snapshot?.leads?.some((item) => item.id === lead.body?.leadId && item.leadQuality?.score >= 0) &&
        "Scored lead not present in operations snapshot",
      !operationsAfterLead.body?.snapshot?.leads?.some((item) => item.id === lead.body?.leadId && item.contact?.email === "verification.client@example.co.za" && item.contact?.mobile) &&
        "Lead contact email/mobile not stored in structured contact block",
      !operationsAfterLead.body?.snapshot?.sourceToSale?.summary && "Operations snapshot missing source-to-sale tracker",
      !operationsAfterLead.body?.snapshot?.leadActionCentre?.rows?.length && "Operations snapshot missing Lead Action Centre rows",
      !operationsAfterLead.body?.snapshot?.leadActionCentre?.rows?.some((item) => item.whatsappDraft && item.nextBestAction) &&
        "Lead Action Centre rows missing WhatsApp draft or next best action",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.nextBestAction && item.whatsappDraft) &&
        "Case Brain did not create a usable case file for the new lead",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.sellerValuationFlow?.status === "permission_ready" && item.sellerValuationFlow?.delayMinutesAfterYes === 5) &&
        "Case Brain seller valuation flow is not ready for the verification seller lead",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.fridaySellerUpdate?.schedule?.day === "Friday" && item.fridaySellerUpdate?.schedule?.time === "15:30" && item.fridaySellerUpdate?.communicationStorage?.approvalRequired) &&
        "Case Brain Friday seller update pack is missing approval-first scheduling",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.postViewingFeedback?.optional === true && item.postViewingFeedback?.communicationStorage?.noFeedbackIsValid) &&
        "Case Brain post-viewing feedback flow is not optional and stored with comms",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.dealRoomSummaryFlow?.passwordProtected && ["share_ready", "shared"].includes(item.dealRoomSummaryFlow?.status)) &&
        "Case Brain Deal Room summary flow is not ready for a qualified lead",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.commissionProtectionFlow?.referralPercent === 25 && item.commissionProtectionFlow?.payableOnlyOnSuccessfulSale && item.commissionProtectionFlow?.noSaleNoCommission) &&
        "Case Brain commission protection flow is missing 25% successful-sale-only terms",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.principalIntelligenceFlow?.internalOnly && Array.isArray(item.principalIntelligenceFlow?.rollupDimensions)) &&
        "Case Brain principal intelligence flow is not available for internal reporting",
      !operationsAfterLead.body?.snapshot?.caseBrain?.cases?.some((item) => item.leadId === lead.body?.leadId && item.agentMatchingFlow?.internalOnly && item.agentMatchingFlow?.useForRouting) &&
        "Case Brain agent matching flow is not available for internal routing",
      !operationsAfterLead.body?.snapshot?.caseBrain?.summary?.valuationOffersReady &&
        "Case Brain summary missing valuation offer readiness",
      !operationsAfterLead.body?.snapshot?.caseBrain?.summary?.sellerUpdatesReady &&
        "Case Brain summary missing Friday seller update readiness",
      !operationsAfterLead.body?.snapshot?.caseBrain?.summary?.dealRoomSummariesReady &&
        "Case Brain summary missing Deal Room summary readiness",
      !operationsAfterLead.body?.snapshot?.caseBrain?.summary?.commissionProtectionsNeeded &&
        "Case Brain summary missing commission protection readiness",
      !operationsAfterLead.body?.snapshot?.caseBrain?.summary?.agentMatchesReady &&
        "Case Brain summary missing agent match readiness",
      !operationsAfterLead.body?.snapshot?.agentSuccessDesk?.agents?.length && "Operations snapshot missing Agent Success Desk",
      !operationsAfterLead.body?.snapshot?.agentActionDigests?.digests?.length && "Operations snapshot missing weekday Agent Action Digests",
      !operationsAfterLead.body?.snapshot?.agentActionDigests?.digests?.some((item) => item.caseBrainHighlights?.length || item.topActions?.some((action) => action.caseBrainSignal)) &&
        "Agent Action Digests are not using Case Brain signals",
      operationsAfterLead.body?.snapshot?.agentActionDigests?.schedule?.time !== "09:30" &&
        "Agent Action Digest schedule is not set to 09:30",
      !Array.isArray(operationsAfterLead.body?.snapshot?.sellerDemandSnapshots) && "Operations snapshot missing seller demand snapshots",
      !operationsAfterLead.body?.snapshot?.sellerDemandSnapshots?.some((item) => item.communicationStorage?.storedWithCase) &&
        "Seller demand snapshot is not marked for communications storage",
      !Array.isArray(operationsAfterLead.body?.snapshot?.servicePulse) && "Operations snapshot missing service pulse records",
      !operationsAfterLead.body?.snapshot?.servicePulse?.some((item) => item.id === servicePulse.body?.servicePulse?.id && item.score === 9) &&
        "Stored service pulse record not present in operations snapshot",
      !operationsAfterLead.body?.snapshot?.servicePulseRollups?.summary?.total && "Operations snapshot missing service pulse rollups",
      !operationsAfterLead.body?.snapshot?.agentMatchingSignals?.agents?.length && "Operations snapshot missing agent matching signals",
      !operationsAfterLead.body?.snapshot?.whatsapp?.feedbackLog?.some((item) => item.category === "client-service-pulse") &&
        "Service pulse was not copied into the communications feedback log",
      !operationsAfterLead.body?.snapshot?.pilotControl?.agents?.length && "Operations snapshot missing pilot agents",
      !operationsAfterLead.body?.snapshot?.pilotControl?.scenarios?.length && "Operations snapshot missing pilot scenarios",
      !operationsAfterLead.body?.snapshot?.pilotControl?.messageLog?.some((item) => item.scenarioId === "scenario-deal-room-share") &&
        "Pilot scenario queue did not add a message log entry",
      !operationsAfterLead.body?.snapshot?.pilotControl?.issueLog?.some((item) => /Verification issue log/.test(item.summary || "")) &&
        "Pilot issue log entry not present in operations snapshot",
      !operationsAfterLead.body?.snapshot?.whatsapp?.queue?.some((item) => item.category === "pilot-scenario") &&
        "Pilot scenario did not queue a WhatsApp test message",
      !operationsAfterLead.body?.snapshot?.agentNetworkDirectory?.authorized &&
        "Agent Network Directory is not authorized for principal snapshot",
      !operationsAfterLead.body?.snapshot?.agentNetworkDirectory?.records?.some((item) => item.id === "network-verification-agent" && item.verification?.status === "verified") &&
        "Verified Agent Network Directory record missing from snapshot",
      !operationsAfterLead.body?.snapshot?.agentNetworkDirectory?.records?.some((item) => item.id === "network-verification-agent" && item.pilotInviteReady) &&
        "Agent Network Directory record was not marked pilot invite ready",
      !operationsAfterLead.body?.snapshot?.agentNetworkDirectory?.provinceRollups?.some((item) => item.provinceId === "gauteng") &&
        "Agent Network Directory province rollup missing Gauteng",
      !operationsAfterLead.body?.snapshot?.agentNetworkDirectory?.outreachLog?.some((item) => item.recordId === "network-verification-agent") &&
        "Agent Network Directory outreach log missing verification record",
      !operationsAfterLead.body?.snapshot?.whatsapp?.queue?.some((item) => item.category === "agent-network-invite") &&
        "Agent Network Directory did not queue a controlled outreach message",
      !operationsAfterLead.body?.snapshot?.pilotControl?.agents?.some((item) => item.sourceRecordId === "network-verification-agent") &&
        "Agent Network Directory record was not promoted to Pilot Control",
      !accessModel.body?.agentNetworkModel?.complianceGuardrails?.includes("no uncontrolled bulk messaging") &&
        "Access model missing Agent Network compliance guardrails",
      sessionAfterLogout.body?.authenticated && "Session remained authenticated after logout",
      officeAdminExport.status !== 403 && `office admin export expected 403 but got ${officeAdminExport.status}`,
      agentAudit.status !== 403 && `agent audit expected 403 but got ${agentAudit.status}`,
      buyerExport.status !== 403 && `buyer export expected 403 but got ${buyerExport.status}`,
      !buyerOperations.ok && `buyer operations returned ${buyerOperations.status}`,
      !sellerOperations.ok && `seller operations returned ${sellerOperations.status}`,
      buyerOperations.body?.snapshot?.identity?.role !== "buyer" && "Buyer snapshot did not carry buyer role",
      sellerOperations.body?.snapshot?.identity?.role !== "seller" && "Seller snapshot did not carry seller role",
      buyerAiValue.body?.aiValue?.role !== "buyer" && "Buyer AI value endpoint did not return buyer role",
      (buyerOperations.body?.snapshot?.teamMembers || []).some((member) => member.role !== "agent") &&
        "Buyer snapshot exposed a non-agent team member",
      !accessModel.body?.roles?.some((role) => role.role === "principal") && "Access model missing principal role",
      !accessModel.body?.roles?.some((role) => role.role === "office_admin") && "Access model missing office admin role",
      !accessModel.body?.roles?.some((role) => role.role === "buyer") && "Access model missing buyer role",
      !accessModel.body?.roles?.some((role) => role.role === "seller") && "Access model missing seller role",
      !accessModel.body?.roles?.some((role) => role.role === "attorney") && "Access model missing attorney role",
      !accessModel.body?.roles?.some((role) => role.role === "bond_originator") && "Access model missing bond originator role",
      !accessModel.body?.hierarchyModel?.branches?.length && "Access model missing hierarchy branches",
      !accessModel.body?.aiValueModel && "Access model missing AI value model"
    ].filter(Boolean);

    if (failures.length) {
      console.error("Backend verification failed:");
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
      return;
    }

    console.log("Backend verification passed.");
    console.log(`Lead created during test: ${lead.body.leadId}`);
    console.log(`Analytics total leads during test run: ${analytics.body?.analytics?.totalLeads ?? "n/a"}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await restoreData(snapshots);
  }
}

await run();
