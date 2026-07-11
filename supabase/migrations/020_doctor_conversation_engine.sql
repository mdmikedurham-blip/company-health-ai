-- Phase 8: Company Doctor Conversation Engine.
-- Persisted mentor conversation + investigations per company.
-- Evidence and assessment snapshots remain shared; Doctor only interprets.

create table if not exists public.doctor_conversations (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  snapshot_id           uuid references public.analysis_snapshots (id) on delete set null,
  assessment_goal       text,
  company_stage         text,
  status                text not null default 'active'
                        check (status in ('active', 'archived', 'closed')),
  current_topic         text,
  current_investigation_id uuid,
  current_hypothesis    text,
  confidence            numeric(5,2) not null default 0,
  unanswered_questions  jsonb not null default '[]'::jsonb,
  requested_evidence    jsonb not null default '[]'::jsonb,
  completed_investigation_ids text[] not null default '{}',
  conversation_history  jsonb not null default '[]'::jsonb,
  recently_learned      jsonb not null default '[]'::jsonb,
  top_observation       text,
  next_action           jsonb,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Allow only one active conversation per company via partial unique index.
drop index if exists doctor_conversations_one_active_idx;
create unique index doctor_conversations_one_active_idx
  on public.doctor_conversations (company_id)
  where (status = 'active');

create index if not exists doctor_conversations_company_idx
  on public.doctor_conversations (company_id);

drop trigger if exists doctor_conversations_set_updated_at
  on public.doctor_conversations;
create trigger doctor_conversations_set_updated_at
  before update on public.doctor_conversations
  for each row execute function public.set_updated_at();

alter table public.doctor_conversations enable row level security;

drop policy if exists doctor_conversations_select_member
  on public.doctor_conversations;
create policy doctor_conversations_select_member
  on public.doctor_conversations
  for select
  using (public.is_company_member(company_id));

drop policy if exists doctor_conversations_insert_writer
  on public.doctor_conversations;
create policy doctor_conversations_insert_writer
  on public.doctor_conversations
  for insert
  with check (public.is_company_writer(company_id));

drop policy if exists doctor_conversations_update_writer
  on public.doctor_conversations;
create policy doctor_conversations_update_writer
  on public.doctor_conversations
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create table if not exists public.doctor_investigations (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references public.doctor_conversations (id) on delete cascade,
  company_id            uuid not null references public.companies (id) on delete cascade,
  template_id           text not null,
  title                 text not null,
  business_question     text not null,
  hypotheses            jsonb not null default '[]'::jsonb,
  required_evidence     jsonb not null default '[]'::jsonb,
  confidence            numeric(5,2) not null default 0,
  blocking_unknowns     jsonb not null default '[]'::jsonb,
  status                text not null default 'open'
                        check (status in (
                          'open',
                          'asking',
                          'awaiting_evidence',
                          'analyzing',
                          'recommended',
                          'completed',
                          'dismissed'
                        )),
  priority              numeric(8,3) not null default 0,
  current_question      text,
  evidence_request      jsonb,
  recommendation        jsonb,
  explainability        jsonb not null default '{}'::jsonb,
  snapshot_id           uuid references public.analysis_snapshots (id) on delete set null,
  opened_at             timestamptz not null default now(),
  completed_at          timestamptz,
  updated_at            timestamptz not null default now()
);

create index if not exists doctor_investigations_company_idx
  on public.doctor_investigations (company_id);

create index if not exists doctor_investigations_conversation_idx
  on public.doctor_investigations (conversation_id);

create index if not exists doctor_investigations_status_idx
  on public.doctor_investigations (company_id, status);

drop trigger if exists doctor_investigations_set_updated_at
  on public.doctor_investigations;
create trigger doctor_investigations_set_updated_at
  before update on public.doctor_investigations
  for each row execute function public.set_updated_at();

alter table public.doctor_investigations enable row level security;

drop policy if exists doctor_investigations_select_member
  on public.doctor_investigations;
create policy doctor_investigations_select_member
  on public.doctor_investigations
  for select
  using (public.is_company_member(company_id));

drop policy if exists doctor_investigations_insert_writer
  on public.doctor_investigations;
create policy doctor_investigations_insert_writer
  on public.doctor_investigations
  for insert
  with check (public.is_company_writer(company_id));

drop policy if exists doctor_investigations_update_writer
  on public.doctor_investigations;
create policy doctor_investigations_update_writer
  on public.doctor_investigations
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

comment on table public.doctor_conversations is
  'Phase 8 — one active Doctor mentor conversation per company.';
comment on table public.doctor_investigations is
  'Phase 8 — focused investigations (one active ask/evidence request at a time).';
