# Axiom Realty AI - Phase 1 API Setup

## 1) Install dependencies

```powershell
npm install
```

## 2) Create your local env

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

- `ADMIN_PASSWORD=AxiomAdmin2026!`
- `WHATSAPP_TO_NUMBER=27XXXXXXXXX` (your central concierge WhatsApp number, including country code)
- `LEAD_DEDUPE_WINDOW_DAYS=45` (how far back duplicate lead checks should look)
- Add WhatsApp Cloud API credentials when ready:
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
- Add formal stakeholder email delivery webhook when ready:
  - `OPERATIONS_EMAIL_WEBHOOK_URL`
  - `CONCIERGE_EMAIL` (optional fallback for concierge notifications)

## 3) Run locally

```powershell
npm run dev
```

Open:

- `http://127.0.0.1:8080`

Admin view:

- `http://127.0.0.1:8080/?admin=1`
- Unlock with the `ADMIN_PASSWORD` value in `.env` or the built-in fallback `AxiomAdmin2026!`

Or double-click:

- `Open Axiom Realty AI.bat`

To push to GitHub + Render in one step (once configured), use:

```text
.\Deploy.cmd
```

Or run:

```text
npm run deploy:live
```

Set `RENDER_DEPLOY_HOOK_URL` if you want an immediate Render trigger after push; otherwise Render deploys on git push automatically. The deploy helper only stages website/deployment files, not local drafts or secrets.

There is also a desktop shortcut-style starter:

- `C:\Users\Hugo\Desktop\buy-sell-website\Open Axiom Realty AI.bat`

## 4) How lead routing works now

- Frontend sends structured lead data to `POST /api/leads`.
- If WhatsApp Cloud API credentials are configured and `WHATSAPP_AUTO_SEND=true`, the backend sends the packaged lead directly to the central concierge.
- If automatic delivery is unavailable, the backend returns a prepared WhatsApp URL and the frontend opens it so the visitor can send the brief directly to the configured concierge.
- If the concierge number is missing, the lead is still saved and the visitor sees an honest temporary-unavailable message.
- The AI concierge chat uses the same fallback and opens it only once when the brief is complete.
- The admin lead queue includes duplicate lead detection, next-best-action guidance, stronger specialist routing confidence based on partner history, and a synced case-file stage per lead.
- Axiom Realty OS now supports secure one-time participant access links (case-scoped) and a backend case-aware AI concierge endpoint for live status and escalation.
- Axiom Realty OS now also supports OTP sign-in and concierge-issued participant identity invites per case.
- Axiom Realty OS now applies Rule Pack v1 (RACI-driven control gates) per case, with active gate status, missing evidence visibility, and dynamic risk priorities.
- Automation sweep now pushes `gate-nudge` WhatsApp alerts for blocked or near-escalation control gates to the responsible stakeholder, with concierge fallback if contact routing is missing.
- Closing Command AI now predicts case delay risk, estimates potential slip days, re-orders recovery actions by dependency + SLA window, and pushes role-specific WhatsApp next-best actions automatically.
- Channel policy is now role-aware: buyer/seller/agent communication defaults to WhatsApp, while formal stakeholders (attorneys, bond originators, banks and similar parties) default to email when email contact details are available.
- After transaction completion/registration, the system can send a one-time buyer/seller WhatsApp opt-in for discounted moving-company quotations, capture Y/N replies, and notify concierge on YES responses.
- When a buyer has outstanding finance-related requirements, the system can send a one-time WhatsApp opt-in asking whether our bond originator should negotiate competing finance quotes; Y/N replies are captured and YES alerts concierge.
- In the same finance outreach cycle, the system can also send a buyer life-cover comparison opt-in (independent Y/N capture), so buyers can request a market comparison instead of taking a bank-default policy.
- When a seller still has an outstanding Electrical Compliance Certificate requirement, the system sends a one-time WhatsApp opt-in to arrange a trusted electrician partner, captures Y/N replies, and alerts concierge on YES responses.
- When a seller still has an outstanding Gas Certificate of Compliance requirement, the system sends a one-time WhatsApp opt-in to arrange a trusted partner, captures Y/N replies, and alerts concierge on YES responses.

## 5) Quick test endpoints

- `GET /api/health` returns service status.
- `GET /api/whatsapp/status` shows if auto-send is fully configured.
- `GET /api/launch-readiness` returns the production launch checks. It requires the admin password header.
- `POST /api/whatsapp/test` sends a live test message to your configured WhatsApp number.
- `POST /api/os/login-access` signs a user in with a secure one-time participant access token.
- `POST /api/os/auth/request-otp` requests an OTP sign-in code for a known workspace cellphone.
- `POST /api/os/auth/verify-otp` verifies an OTP code and starts an authenticated session.
- `POST /api/os/cases/:id/access-links` issues a case-scoped secure access link (concierge only).
- `POST /api/os/cases/:id/invite-party` creates/updates a participant identity (cellphone and/or email) and issues a secure invite link (concierge only).
- `POST /api/os/ai/ask` returns a case-aware AI concierge update and auto-escalates sensitive queries.
- `GET /api/os/my-day` returns role-aware prioritized daily actions and ready-to-send update suggestions.
- `POST /api/os/cases/:id/birthday` stores seller or buyer birthday so the automation sweep can send birthday greetings + agent follow-up alerts.
- `GET /api/os/cases/:id/rule-pack` returns the live Rule Pack v1 control gate evaluation and stakeholder map for the case.
- `GET /api/os/cases/:id/recovery-plan` returns live delay risk intelligence and a generated recovery playbook for the case.
- `POST /api/os/cases/:id/recovery/queue` queues sequenced next-best actions to responsible parties (concierge only).

## Notes

- This keeps your current WhatsApp flow working while enabling API integration gradually.
- Runtime code no longer falls back to a hard-coded destination. `WHATSAPP_TO_NUMBER` must be configured explicitly.
- Use `LAUNCH-CHECKLIST.md` before exposing the site to real leads.
- Next phase can add DB storage + CRM sync + lead scoring.
