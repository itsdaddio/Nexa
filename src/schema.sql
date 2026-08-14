-- Nexa schema (Postgres)
-- Multi-tenant lead OS

CREATE TABLE IF NOT EXISTS workspaces (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  hubspot_token text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id         text PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('owner', 'admin', 'operator')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS referral_partners (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  partner_id   text NOT NULL REFERENCES referral_partners(id) ON DELETE CASCADE,
  code         text NOT NULL UNIQUE,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id                   text PRIMARY KEY,
  workspace_id         text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  email                text NOT NULL,
  phone                text,
  company              text,
  message              text,
  source               text NOT NULL CHECK (source IN ('direct', 'utm', 'referral', 'agency', 'content')),
  score                int  NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 99),
  status               text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  worked               boolean NOT NULL DEFAULT false,
  referral_partner_id  text REFERENCES referral_partners(id),
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  hubspot_contact_id   text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_workspace_status_idx ON leads (workspace_id, status);
CREATE INDEX IF NOT EXISTS leads_workspace_score_idx  ON leads (workspace_id, score DESC);
CREATE INDEX IF NOT EXISTS leads_workspace_created_idx ON leads (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);

CREATE TABLE IF NOT EXISTS activities (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id      text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         text NOT NULL
                 CHECK (type IN ('note', 'status_change', 'call', 'email', 'hubspot_push', 'enrolled')),
  body         text,
  meta         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text
);

CREATE INDEX IF NOT EXISTS activities_lead_idx ON activities (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sequences (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('onboard', 'nurture', 'reengage')),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id  text NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id      text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, lead_id)
);

CREATE INDEX IF NOT EXISTS sequence_enrollments_lead_idx ON sequence_enrollments (lead_id, created_at DESC);
