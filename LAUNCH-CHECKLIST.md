# Axiom Realty AI - Simple Launch Checklist

## Required before real leads

- [ ] Set `PUBLIC_BASE_URL` to the public HTTPS website URL. Do not leave it on `localhost`.
- [ ] Set `ALLOWED_ORIGIN` to that public website origin.
- [ ] Set a strong `ADMIN_PASSWORD`.
- [ ] Set `WHATSAPP_TO_NUMBER` to the central concierge WhatsApp number, including country code.
- [ ] Configure `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] Configure `OPERATIONS_EMAIL_WEBHOOK_URL` for formal stakeholder email delivery.
- [ ] Set `WHATSAPP_AUTO_SEND=true`.
- [ ] Set `WHATSAPP_WEB_TEST_MODE=false`. The WhatsApp Web bridge is for pre-launch testing only.
- [ ] Keep `operations.html` off the public deployment, or replace its demo workspaces with production authentication before storing real transaction data there.
- [ ] Confirm Rule Pack v1 is active in launch readiness (`rule-pack-active` check is ready).

## Five-minute smoke test

- [ ] Start the app and confirm `GET /api/health` returns `ok: true`.
- [ ] Check `GET /api/launch-readiness` with the admin password header and confirm every check is ready.
- [ ] Submit one buyer test lead and confirm the central concierge receives the packaged brief.
- [ ] Submit one seller test lead and confirm the central concierge receives the packaged brief.
- [ ] Test the AI concierge chat: confirm it asks in this order when details are missing: name, WhatsApp number, email, then property brief fields.
- [ ] Turn automatic delivery off briefly, submit one test lead, and confirm the prepared WhatsApp fallback opens to the correct concierge.
- [ ] Open the Operations lead queue, confirm each test lead has lifecycle + case-file stage data.
- [ ] Generate one agent update link and submit an agent update to confirm case-file stage and lifecycle both advance.
- [ ] In Operations, generate secure participant links for buyer/seller/agent/attorney/finance and confirm each can sign in with link-only access.
- [ ] In Operations, invite at least one participant per role with cellphone + secure link and confirm they can sign in by link and by OTP.
- [ ] Confirm channel policy: seller/buyer/agent reminders route to WhatsApp, and attorney/finance reminders route to email when email contacts are present.
- [ ] Ask the in-app AI concierge for case status, outstanding documents, and an escalation-style question; confirm case-aware answers and escalation logging.
- [ ] Sign in as each role and confirm the daily brief shows prioritized actions and copy-ready update text.
- [ ] Save a seller or buyer birthday on a test case, run automation sweep, and confirm two messages queue: client birthday greeting + agent follow-up alert.
- [ ] Complete a test transaction and run automation sweep; confirm buyer/seller receives one moving-services opt-in WhatsApp message and Y/N replies are captured via inbound webhook.
- [ ] Create a buyer test case with an outstanding finance-related document (for example bond approval/payslip), run automation sweep, and confirm one bond-originator opt-in WhatsApp is sent and buyer Y/N replies are captured via inbound webhook.
- [ ] On the same buyer finance test case and sweep, confirm one life-cover comparison opt-in WhatsApp is also sent and buyer Y/N replies are captured via inbound webhook.
- [ ] Create a seller test case with an outstanding Electrical Compliance Certificate document, run automation sweep, and confirm one COC support opt-in WhatsApp is sent and seller Y/N replies are captured via inbound webhook.
- [ ] Create a seller test case with an outstanding Gas Certificate of Compliance document, run automation sweep, and confirm one Gas COC support opt-in WhatsApp is sent and seller Y/N replies are captured via inbound webhook.
- [ ] Open a test case and confirm Rule Pack v1 shows an active control gate, owner, and missing evidence clearly.
- [ ] Confirm RACI stakeholder assignments are visible in the case drawer (at minimum SELL, BUY, AGENT, TRANS, ORIG, CONC).
- [ ] Run automation sweep and confirm blocked/at-risk gates queue `gate-nudge` WhatsApp notifications to the responsible owner (or concierge fallback if contact details are missing).
- [ ] In Journey > Recovery Console, run prediction on a test case and confirm risk score, risk band, predicted slip days, and signal reasons are shown.
- [ ] Confirm recovery actions are sequenced (step numbers + dependencies) and the displayed next-best actions align with urgency.
- [ ] Queue a recovery plan and confirm `next-best-action` notifications are created per responsible owner (with concierge fallback if routing is missing).
- [ ] Delete or clearly label the test data before launch.

## Daily launch watch

- [ ] Review Delivery Attention in Operations.
- [ ] Follow up any new lead that has not been acknowledged within the service target.
- [ ] Re-run the buyer and seller smoke tests after changing hosting, environment settings, or WhatsApp credentials.
