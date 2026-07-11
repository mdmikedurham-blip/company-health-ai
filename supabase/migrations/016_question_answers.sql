-- Phase 4: Due Diligence question answers (canonical reasoning layer).
-- Catalog lives in application code; this table persists answers only.
-- Evidence is never duplicated — answers reference evidence ids.

create table if not exists public.question_answers (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references public.companies (id) on delete cascade,
  snapshot_id               uuid references public.analysis_snapshots (id) on delete set null,
  question_id               text not null,
  answer_state              text not null
                            check (answer_state in (
                              'SUPPORTED',
                              'CONTRADICTED',
                              'INSUFFICIENT_EVIDENCE',
                              'NOT_APPLICABLE',
                              'UNKNOWN'
                            )),
  confidence                numeric(5, 2) not null default 0
                            check (confidence >= 0 and confidence <= 100),
  supporting_evidence_ids   text[] not null default '{}',
  missing_evidence          text[] not null default '{}',
  reasoning                 text not null default '',
  stage_level               text not null default 'optional'
                            check (stage_level in ('required', 'optional', 'not_applicable')),
  effective_importance      numeric(8, 3) not null default 1,
  last_updated              timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  unique (company_id, question_id)
);

create index if not exists question_answers_company_id_idx
  on public.question_answers (company_id);

create index if not exists question_answers_snapshot_id_idx
  on public.question_answers (snapshot_id)
  where snapshot_id is not null;

create index if not exists question_answers_state_idx
  on public.question_answers (company_id, answer_state);

alter table public.question_answers enable row level security;

drop policy if exists question_answers_select_member on public.question_answers;
create policy question_answers_select_member
  on public.question_answers
  for select
  using (public.is_company_member(company_id));

drop policy if exists question_answers_insert_writer on public.question_answers;
create policy question_answers_insert_writer
  on public.question_answers
  for insert
  with check (public.is_company_writer(company_id));

drop policy if exists question_answers_update_writer on public.question_answers;
create policy question_answers_update_writer
  on public.question_answers
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists question_answers_delete_writer on public.question_answers;
create policy question_answers_delete_writer
  on public.question_answers
  for delete
  using (public.is_company_writer(company_id));

comment on table public.question_answers is
  'Persisted diligence question answers. Catalog is code; answers reference evidence ids only.';
