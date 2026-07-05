BEGIN;

CREATE TABLE IF NOT EXISTS axiom_state_blobs (
  state_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  province_ids TEXT[] NOT NULL DEFAULT '{}',
  branch_ids TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_branches (
  id TEXT PRIMARY KEY,
  organisation_id TEXT REFERENCES axiom_organisations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  province_id TEXT NOT NULL DEFAULT '',
  admin_ids TEXT[] NOT NULL DEFAULT '{}',
  agent_ids TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  contact_mobile TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_leads (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  lead_quality_band TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_mobile TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS axiom_cases (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES axiom_leads(id) ON DELETE SET NULL,
  case_name TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS axiom_tasks (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  due_label TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_reminders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL DEFAULT '',
  case_name TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  due_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_escalations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL DEFAULT '',
  case_name TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_commission_protection (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL DEFAULT '',
  case_name TEXT NOT NULL DEFAULT '',
  agent_name TEXT NOT NULL DEFAULT '',
  split TEXT NOT NULL DEFAULT '',
  fee TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT '',
  referral_status TEXT NOT NULL DEFAULT '',
  risk_tag TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_deal_rooms (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL DEFAULT '',
  room_slug TEXT NOT NULL DEFAULT '',
  case_id TEXT NOT NULL DEFAULT '',
  case_name TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  next_step TEXT NOT NULL DEFAULT '',
  access_code TEXT NOT NULL DEFAULT '',
  share_url TEXT NOT NULL DEFAULT '',
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_communications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  case_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT '',
  to_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  scheduled_for TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_service_pulse (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL DEFAULT '',
  case_name TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  agent_name TEXT NOT NULL DEFAULT '',
  respondent_role TEXT NOT NULL DEFAULT '',
  respondent_name TEXT NOT NULL DEFAULT '',
  touchpoint TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  sentiment TEXT NOT NULL DEFAULT '',
  used_for_matching BOOLEAN NOT NULL DEFAULT FALSE,
  agency_id TEXT NOT NULL DEFAULT '',
  branch_id TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_agent_network_records (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL DEFAULT '',
  agency_name TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  role_category TEXT NOT NULL DEFAULT '',
  province_id TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  towns TEXT[] NOT NULL DEFAULT '{}',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_mobile TEXT NOT NULL DEFAULT '',
  contact_whatsapp TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT '',
  outreach_status TEXT NOT NULL DEFAULT '',
  pilot_status TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axiom_audit_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_axiom_users_role_scope ON axiom_users(role, agency_id, branch_id, province_id);
CREATE INDEX IF NOT EXISTS idx_axiom_leads_pipeline ON axiom_leads(intent, lead_quality_band, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_leads_scope ON axiom_leads(agency_id, branch_id, province_id, agent_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_axiom_cases_scope ON axiom_cases(agency_id, branch_id, province_id, agent_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_axiom_tasks_queue ON axiom_tasks(status, priority, category);
CREATE INDEX IF NOT EXISTS idx_axiom_tasks_scope ON axiom_tasks(agency_id, branch_id, province_id, agent_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_axiom_comm_status ON axiom_communications(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_axiom_service_pulse_agent ON axiom_service_pulse(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_agent_network_province ON axiom_agent_network_records(province_id, outreach_status, pilot_status);
CREATE INDEX IF NOT EXISTS idx_axiom_audit_created ON axiom_audit_events(created_at DESC);

COMMIT;
