(function attachCommunicationsModule(window) {
  const routes = {
    health: () => "/healthz",
    appStatus: () => "/api/app-status",
    systemStatus: () => "/api/system-status",
    adminExport: () => "/api/admin/export",
    adminAuditLog: () => "/api/admin/audit-log",
    whatsappStatus: () => "/api/whatsapp/status",
    whatsappInbox: () => "/api/whatsapp/inbox",
    whatsappWebStart: () => "/api/whatsapp-web/start",
    whatsappWebLogout: () => "/api/whatsapp-web/logout",
    whatsappTest: () => "/api/whatsapp/test",
    whatsappSmartRemindersRun: () => "/api/whatsapp/smart-reminders/run",
    whatsappQueueProcess: () => "/api/whatsapp/queue/process",
    whatsappInboxRead: (caseId) => `/api/whatsapp/inbox/${encodeURIComponent(caseId)}/read`,
    whatsappInboxReply: (caseId) => `/api/whatsapp/inbox/${encodeURIComponent(caseId)}/reply`,
    whatsappInboxAppointments: (caseId) => `/api/whatsapp/inbox/${encodeURIComponent(caseId)}/appointments`,
    whatsappAppointmentAction: (appointmentId) => `/api/whatsapp/inbox/appointments/${encodeURIComponent(appointmentId)}/action`,
    whatsappHumanTakeover: (caseId) => `/api/whatsapp/inbox/${encodeURIComponent(caseId)}/human-takeover`,
    whatsappDocumentDownload: (documentId) => `/api/whatsapp/inbox/documents/${encodeURIComponent(documentId)}/download`,
    clientWhatsappOtpRequest: () => "/api/client-auth/request-whatsapp-otp",
    clientWhatsappOtpVerify: () => "/api/client-auth/verify-whatsapp-otp",
    clientSession: () => "/api/client-auth/session",
    clientLeadDetail: (leadId) => `/api/client-auth/lead/${encodeURIComponent(leadId)}`,
    clientLogout: () => "/api/client-auth/logout"
  };

  window.AxiomCommunications = Object.freeze({ routes });
})(window);
