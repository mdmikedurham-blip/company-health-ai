-- Phase 6: Assessment Snapshot Engine — canonical published assessment.
-- Extends analysis_snapshots with publish lifecycle + companies.current_snapshot_id.
-- Historical published snapshots are immutable (payload is the archive).
-- Normalized intelligence tables remain the current-state projection of current_snapshot_id.

alter table public.analysis_snapshots
  add column if not exists publish_kind text not null default 'legacy'
    check (publish_kind in ('draft', 'published', 'superseded', 'failed', 'legacy')),
  add column if not exists published_at timestamptz,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references public.analysis_snapshots (id) on delete set null,
  add column if not exists parent_snapshot_id uuid references public.analysis_snapshots (id) on delete set null,
  add column if not exists assessment_goal text,
  add column if not exists company_stage text,
  add column if not exists analysis_version text,
  add column if not exists extraction_version text,
  add column if not exists evidence_version text,
  add column if not exists document_versions jsonb not null default '[]'::jsonb,
  add column if not exists generated_by text,
  add column if not exists confidence numeric(5, 2),
  add column if not exists coverage_ratio numeric(5, 4),
  add column if not exists overall_health_available boolean not null default false;

create index if not exists analysis_snapshots_publish_kind_idx
  on public.analysis_snapshots (company_id, publish_kind, published_at desc nulls last);

create index if not exists analysis_snapshots_published_at_idx
  on public.analysis_snapshots (company_id, published_at desc nulls last)
  where publish_kind in ('published', 'superseded');

alter table public.companies
  add column if not exists current_snapshot_id uuid
    references public.analysis_snapshots (id) on delete set null;

create index if not exists companies_current_snapshot_id_idx
  on public.companies (current_snapshot_id)
  where current_snapshot_id is not null;

comment on column public.companies.current_snapshot_id is
  'Pointer to the single published assessment snapshot currently driving the product.';

comment on column public.analysis_snapshots.publish_kind is
  'draft | published | superseded | failed | legacy. Published payloads are immutable archives.';

comment on column public.analysis_snapshots.payload is
  'For publish_kind=published: full assessment pack (questions, findings, risks, health, coverage, provenance).';
