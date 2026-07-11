-- Phase 1: persisted company classification (stage-aware due diligence).
-- Separate AI-inferred profile from user-confirmed overrides.
-- Never silently overwrite confirmed values (application layer enforces).

create table if not exists public.company_classifications (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null unique references public.companies (id) on delete cascade,
  snapshot_id                 uuid references public.analysis_snapshots (id) on delete set null,

  -- Effective display fields (inferred unless confirmed override applied)
  stage                       text,
  industry                    text,
  business_model              text,
  revenue_model               text,
  annual_revenue_range        text,
  employee_count_range        text,
  customer_count_range        text,
  funding_status              text,
  outside_investors           boolean,
  jurisdiction_entity_type    text,
  board_required              boolean,
  board_present               boolean,
  audit_expected              boolean,
  security_maturity_expected  text,

  confidence                  numeric(5, 2) not null default 0,
  source_evidence_ids         uuid[] not null default '{}',
  generated_at                timestamptz not null default now(),

  -- Per-field provenance: { field: { value, evidenceIds, extractionSource, confidence, origin, updatedAt } }
  field_provenance            jsonb not null default '{}'::jsonb,

  -- AI-inferred snapshot (immutable relative to last classify run)
  inferred                    jsonb not null default '{}'::jsonb,
  inference_rationale         text,
  assumptions                 jsonb not null default '[]'::jsonb,

  -- User-confirmed overrides (never cleared by re-inference)
  confirmed                   jsonb not null default '{}'::jsonb,
  confirmed_at                timestamptz,
  confirmed_by                uuid references public.profiles (id) on delete set null,

  -- Coverage / readiness (derived at classify time)
  evidence_coverage_pct       numeric(5, 2) not null default 0,
  dimension_coverage          jsonb not null default '{}'::jsonb,
  missing_required            jsonb not null default '[]'::jsonb,
  missing_recommended         jsonb not null default '[]'::jsonb,
  optional_remaining          jsonb not null default '[]'::jsonb,
  health_score_available      boolean not null default false,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint company_classifications_stage_check
    check (
      stage is null or stage in (
        'Idea',
        'Pre-product / MVP',
        'Early Revenue',
        'Product-Market Fit',
        'Growth',
        'Scale',
        'Exit Ready'
      )
    ),
  constraint company_classifications_confidence_check
    check (confidence >= 0 and confidence <= 100)
);

create index if not exists company_classifications_company_id_idx
  on public.company_classifications (company_id);

create index if not exists company_classifications_snapshot_id_idx
  on public.company_classifications (snapshot_id);

drop trigger if exists company_classifications_set_updated_at on public.company_classifications;
create trigger company_classifications_set_updated_at
  before update on public.company_classifications
  for each row execute function public.set_updated_at();

alter table public.company_classifications enable row level security;

drop policy if exists company_classifications_select_member on public.company_classifications;
create policy company_classifications_select_member on public.company_classifications
  for select using (public.is_company_member(company_id));

drop policy if exists company_classifications_insert_writer on public.company_classifications;
create policy company_classifications_insert_writer on public.company_classifications
  for insert with check (public.is_company_writer(company_id));

drop policy if exists company_classifications_update_writer on public.company_classifications;
create policy company_classifications_update_writer on public.company_classifications
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists company_classifications_delete_admin on public.company_classifications;
create policy company_classifications_delete_admin on public.company_classifications
  for delete using (public.is_company_admin(company_id));

-- Dimension status may be not_applicable for stage-irrelevant dimensions.
alter table public.health_scores
  drop constraint if exists health_scores_status_check;

alter table public.health_scores
  add constraint health_scores_status_check
  check (status in ('healthy', 'watch', 'at-risk', 'insufficient', 'not_applicable'));
