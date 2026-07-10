-- Company Health AI — canonical PostgreSQL schema (Supabase)
-- Tables: companies, users, documents, evidence, findings, risks,
--         recommendations, health_scores, timeline_events, connector_syncs

create extension if not exists "pgcrypto";

-- ─── companies ───────────────────────────────────────────────────────────────

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan          text not null default 'standard',
  founded       text,
  stage         text,
  employees     integer,
  arr           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── users (app profiles; auth.users is Supabase Auth) ───────────────────────

create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  company_id    uuid references public.companies (id) on delete set null,
  email         text not null,
  full_name     text,
  role          text not null default 'member'
                check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_company_id_idx on public.users (company_id);

-- ─── documents (raw source files / records from connectors) ──────────────────

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  connector_id    text not null,
  external_id     text not null,
  title           text not null,
  mime_type       text,
  uri             text,
  raw_summary     text,
  metadata        jsonb not null default '{}'::jsonb,
  synced_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, connector_id, external_id)
);

create index documents_company_id_idx on public.documents (company_id);
create index documents_connector_id_idx on public.documents (company_id, connector_id);

-- ─── evidence (normalized Insight Engine input) ──────────────────────────────

create table public.evidence (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  document_id       uuid references public.documents (id) on delete set null,
  source_system     text not null,
  source_type       text not null,
  title             text not null,
  content_summary   text not null default '',
  extracted_facts   jsonb not null default '{}'::jsonb,
  dimension_ids     text[] not null default '{}',
  dimension_id      text not null,
  dimension         text not null,
  occurred_at       timestamptz not null,
  collected_at      timestamptz not null,
  reliability       numeric(4, 3) not null
                    check (reliability >= 0 and reliability <= 1),
  metadata          jsonb not null default '{}'::jsonb,
  citation          jsonb not null default '{}'::jsonb,
  finding_ids       text[] not null default '{}',
  linked_risk_ids   text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index evidence_company_id_idx on public.evidence (company_id);
create index evidence_dimension_id_idx on public.evidence (company_id, dimension_id);
create index evidence_document_id_idx on public.evidence (document_id);

-- ─── findings ────────────────────────────────────────────────────────────────

create table public.findings (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  title           text not null,
  description     text not null,
  summary         text not null default '',
  dimension_id    text not null,
  dimension       text not null,
  insight_ids     text[] not null default '{}',
  evidence_ids    text[] not null default '{}',
  direction       text not null
                  check (direction in ('positive', 'negative', 'neutral')),
  materiality     numeric(5, 2) not null default 0,
  confidence      numeric(5, 2) not null default 0,
  score_impact    numeric(6, 2) not null default 0,
  source_system   text not null default '',
  extracted_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index findings_company_id_idx on public.findings (company_id);
create index findings_dimension_id_idx on public.findings (company_id, dimension_id);

-- ─── risks ───────────────────────────────────────────────────────────────────

create table public.risks (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id) on delete cascade,
  title                   text not null,
  summary                 text not null,
  dimension_id            text not null,
  dimension               text not null,
  severity                text not null
                          check (severity in ('high', 'medium', 'low')),
  likelihood              numeric(5, 2) not null default 0,
  impact                  numeric(5, 2) not null default 0,
  finding_ids             text[] not null default '{}',
  evidence_ids            text[] not null default '{}',
  confidence              numeric(5, 2) not null default 0,
  status                  text not null default 'open'
                          check (status in ('open', 'monitoring', 'resolved', 'accepted')),
  estimated_score_impact  numeric(6, 2) not null default 0,
  why_it_matters          text not null default '',
  recommendation_id       text,
  recommendation          text not null default '',
  primary_evidence_label  text not null default '',
  explain_prompt          text not null default '',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index risks_company_id_idx on public.risks (company_id);
create index risks_status_idx on public.risks (company_id, status);
create index risks_severity_idx on public.risks (company_id, severity);

-- ─── recommendations ─────────────────────────────────────────────────────────

create table public.recommendations (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references public.companies (id) on delete cascade,
  title                       text not null,
  description                 text not null,
  dimension_id                text not null,
  dimension                   text not null,
  risk_ids                    text[] not null default '{}',
  evidence_ids                text[] not null default '{}',
  finding_ids                 text[] not null default '{}',
  priority                    text not null
                              check (priority in ('high', 'medium', 'low')),
  effort                      text not null
                              check (effort in ('low', 'medium', 'high')),
  confidence                  numeric(5, 2) not null default 0,
  estimated_score_improvement numeric(6, 2) not null default 0,
  rationale                   text not null default '',
  next_steps                  text[] not null default '{}',
  priority_score              numeric(10, 4) not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index recommendations_company_id_idx on public.recommendations (company_id);
create index recommendations_priority_score_idx
  on public.recommendations (company_id, priority_score desc);

-- ─── health_scores (point-in-time score snapshots) ───────────────────────────

create table public.health_scores (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  score               numeric(5, 2) not null
                      check (score >= 0 and score <= 100),
  status              text not null
                      check (status in ('healthy', 'watch', 'at-risk')),
  change              numeric(6, 2) not null default 0,
  change_label        text not null default '',
  confidence          numeric(5, 2) not null default 0,
  dimensions          jsonb not null default '[]'::jsonb,
  score_explanations  jsonb not null default '[]'::jsonb,
  score_change        jsonb,
  as_of               timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index health_scores_company_id_idx on public.health_scores (company_id);
create index health_scores_as_of_idx on public.health_scores (company_id, as_of desc);

-- ─── timeline_events ─────────────────────────────────────────────────────────

create table public.timeline_events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  event_date          date not null,
  month               text not null,
  type                text not null
                      check (type in (
                        'score-change',
                        'evidence-added',
                        'finding-created',
                        'risk-created',
                        'risk-resolved',
                        'board',
                        'legal',
                        'customer',
                        'financial'
                      )),
  title               text not null,
  description         text not null default '',
  score_before        numeric(5, 2),
  score_after         numeric(5, 2),
  dimension_id        text,
  dimension           text,
  why_health_changed  text,
  created_at          timestamptz not null default now()
);

create index timeline_events_company_id_idx on public.timeline_events (company_id);
create index timeline_events_date_idx on public.timeline_events (company_id, event_date desc);

-- ─── connector_syncs (ingest run audit) ──────────────────────────────────────

create table public.connector_syncs (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  connector_id          text not null,
  status                text not null default 'running'
                        check (status in ('running', 'succeeded', 'failed', 'partial')),
  documents_analyzed    integer not null default 0,
  evidence_created      integer not null default 0,
  error_message         text,
  started_at            timestamptz not null default now(),
  finished_at           timestamptz,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index connector_syncs_company_id_idx on public.connector_syncs (company_id);
create index connector_syncs_connector_idx
  on public.connector_syncs (company_id, connector_id, started_at desc);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.set_updated_at();

create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

create trigger risks_set_updated_at
  before update on public.risks
  for each row execute function public.set_updated_at();

create trigger recommendations_set_updated_at
  before update on public.recommendations
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.evidence enable row level security;
alter table public.findings enable row level security;
alter table public.risks enable row level security;
alter table public.recommendations enable row level security;
alter table public.health_scores enable row level security;
alter table public.timeline_events enable row level security;
alter table public.connector_syncs enable row level security;

-- Helper: current user's company
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where id = auth.uid()
$$;

-- users: read/update own row
create policy users_select_own on public.users
  for select using (id = auth.uid());

create policy users_update_own on public.users
  for update using (id = auth.uid());

-- companies: members of the company
create policy companies_select_member on public.companies
  for select using (id = public.current_user_company_id());

-- Tenant-scoped tables: same company as the signed-in user
create policy documents_select_company on public.documents
  for select using (company_id = public.current_user_company_id());

create policy evidence_select_company on public.evidence
  for select using (company_id = public.current_user_company_id());

create policy findings_select_company on public.findings
  for select using (company_id = public.current_user_company_id());

create policy risks_select_company on public.risks
  for select using (company_id = public.current_user_company_id());

create policy recommendations_select_company on public.recommendations
  for select using (company_id = public.current_user_company_id());

create policy health_scores_select_company on public.health_scores
  for select using (company_id = public.current_user_company_id());

create policy timeline_events_select_company on public.timeline_events
  for select using (company_id = public.current_user_company_id());

create policy connector_syncs_select_company on public.connector_syncs
  for select using (company_id = public.current_user_company_id());

-- Service role / server writes bypass RLS; add insert/update policies later
-- when authenticated client writes are required.
