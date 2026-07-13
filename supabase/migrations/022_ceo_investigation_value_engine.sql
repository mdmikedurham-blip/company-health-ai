-- Phase 11: CEO Investigation Loop + Transparent Enterprise Value Engine.
-- Extends doctor_investigations and company_value_navigators (020/021).

alter table public.doctor_investigations
  add column if not exists observation text,
  add column if not exists primary_hypothesis text,
  add column if not exists alternative_hypotheses jsonb not null default '[]'::jsonb,
  add column if not exists supporting_fact_keys text[] not null default '{}',
  add column if not exists supporting_evidence_ids text[] not null default '{}',
  add column if not exists materiality numeric(5,2),
  add column if not exists expected_business_impact text,
  add column if not exists estimated_confidence_gain numeric(5,2),
  add column if not exists estimated_value_impact jsonb;

comment on column public.doctor_investigations.observation is
  'Phase 11 — what the system noticed for this investigation.';
comment on column public.doctor_investigations.estimated_value_impact is
  'Phase 11 — MoneyRange JSON { low, high, currency }.';

alter table public.company_value_navigators
  add column if not exists business_discount_low numeric(18,2),
  add column if not exists business_discount_high numeric(18,2),
  add column if not exists evidence_discount_low numeric(18,2),
  add column if not exists evidence_discount_high numeric(18,2),
  add column if not exists comparable_basis jsonb not null default '{}'::jsonb;

comment on column public.company_value_navigators.business_discount_low is
  'Phase 11 — EV haircut from company weakness (range low).';
comment on column public.company_value_navigators.evidence_discount_low is
  'Phase 11 — EV haircut from uncertainty / missing evidence (range low).';
comment on column public.company_value_navigators.comparable_basis is
  'Phase 11 — comparable/multiple basis metadata for explainability.';
