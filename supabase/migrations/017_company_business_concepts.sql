-- Phase 5: Business Concepts (knowledge model between Evidence and Questions).
-- Catalog lives in application code; this table persists aggregated concept state.

create table if not exists public.company_business_concepts (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references public.companies (id) on delete cascade,
  snapshot_id                 uuid references public.analysis_snapshots (id) on delete set null,
  concept_id                  text not null,
  state                       text not null default 'unknown'
                              check (state in (
                                'supported',
                                'contradicted',
                                'partial',
                                'unknown',
                                'not_applicable'
                              )),
  confidence                  numeric(5, 2) not null default 0
                              check (confidence >= 0 and confidence <= 100),
  coverage                    numeric(5, 4) not null default 0
                              check (coverage >= 0 and coverage <= 1),
  supporting_evidence_ids     text[] not null default '{}',
  supporting_fact_keys        text[] not null default '{}',
  supporting_fact_ids         text[] not null default '{}',
  supporting_document_ids     text[] not null default '{}',
  contradicting_evidence_ids  text[] not null default '{}',
  contradicting_fact_keys     text[] not null default '{}',
  reasoning                   text not null default '',
  fact_values                 jsonb not null default '{}'::jsonb,
  last_updated                timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  unique (company_id, concept_id)
);

create index if not exists company_business_concepts_company_id_idx
  on public.company_business_concepts (company_id);

create index if not exists company_business_concepts_snapshot_id_idx
  on public.company_business_concepts (snapshot_id)
  where snapshot_id is not null;

create index if not exists company_business_concepts_state_idx
  on public.company_business_concepts (company_id, state);

alter table public.company_business_concepts enable row level security;

drop policy if exists company_business_concepts_select_member
  on public.company_business_concepts;
create policy company_business_concepts_select_member
  on public.company_business_concepts
  for select
  using (public.is_company_member(company_id));

drop policy if exists company_business_concepts_insert_writer
  on public.company_business_concepts;
create policy company_business_concepts_insert_writer
  on public.company_business_concepts
  for insert
  with check (public.is_company_writer(company_id));

drop policy if exists company_business_concepts_update_writer
  on public.company_business_concepts;
create policy company_business_concepts_update_writer
  on public.company_business_concepts
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists company_business_concepts_delete_writer
  on public.company_business_concepts;
create policy company_business_concepts_delete_writer
  on public.company_business_concepts
  for delete
  using (public.is_company_writer(company_id));

comment on table public.company_business_concepts is
  'Aggregated business concepts from evidence facts. Questions evaluate concepts, not documents.';
