-- Phase 10: Company Value Navigator.
-- Enterprise value ranges, drivers, and isolated scenarios.
-- Never overwrites assessment snapshots; references snapshot_id only.

create table if not exists public.company_value_navigators (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  snapshot_id           uuid references public.analysis_snapshots (id) on delete set null,
  assessment_goal       text,
  valuation_method      text not null default 'market-multiples',
  current_ev_low        numeric(18,2),
  current_ev_high       numeric(18,2),
  potential_ev_low      numeric(18,2),
  potential_ev_high     numeric(18,2),
  value_gap_low         numeric(18,2),
  value_gap_high        numeric(18,2),
  probability_of_potential numeric(5,2),
  valuation_confidence  numeric(5,2) not null default 0,
  assumptions           jsonb not null default '[]'::jsonb,
  data_completeness     numeric(5,2) not null default 0,
  missing_inputs        jsonb not null default '[]'::jsonb,
  status                text not null default 'active'
                        check (status in ('active', 'archived')),
  generated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop index if exists company_value_navigators_one_active_idx;
create unique index company_value_navigators_one_active_idx
  on public.company_value_navigators (company_id)
  where (status = 'active');

create index if not exists company_value_navigators_company_idx
  on public.company_value_navigators (company_id);

drop trigger if exists company_value_navigators_set_updated_at
  on public.company_value_navigators;
create trigger company_value_navigators_set_updated_at
  before update on public.company_value_navigators
  for each row execute function public.set_updated_at();

alter table public.company_value_navigators enable row level security;

drop policy if exists company_value_navigators_select_member
  on public.company_value_navigators;
create policy company_value_navigators_select_member
  on public.company_value_navigators for select
  using (public.is_company_member(company_id));

drop policy if exists company_value_navigators_insert_writer
  on public.company_value_navigators;
create policy company_value_navigators_insert_writer
  on public.company_value_navigators for insert
  with check (public.is_company_writer(company_id));

drop policy if exists company_value_navigators_update_writer
  on public.company_value_navigators;
create policy company_value_navigators_update_writer
  on public.company_value_navigators for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create table if not exists public.company_value_drivers (
  id                    uuid primary key default gen_random_uuid(),
  navigator_id          uuid not null references public.company_value_navigators (id) on delete cascade,
  company_id            uuid not null references public.companies (id) on delete cascade,
  driver_key            text not null,
  title                 text not null,
  impact_low            numeric(18,2),
  impact_high           numeric(18,2),
  confidence            numeric(5,2) not null default 0,
  difficulty            text not null default 'medium'
                        check (difficulty in ('low', 'medium', 'high')),
  estimated_time        text,
  required_evidence     jsonb not null default '[]'::jsonb,
  supporting_evidence_ids text[] not null default '{}',
  business_rationale    text not null default '',
  assumptions           jsonb not null default '[]'::jsonb,
  dependencies          jsonb not null default '[]'::jsonb,
  status                text not null default 'open'
                        check (status in ('open', 'in_progress', 'done', 'blocked')),
  current_metric        text,
  target_metric         text,
  priority              numeric(8,3) not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists company_value_drivers_company_idx
  on public.company_value_drivers (company_id);

create index if not exists company_value_drivers_navigator_idx
  on public.company_value_drivers (navigator_id);

drop trigger if exists company_value_drivers_set_updated_at
  on public.company_value_drivers;
create trigger company_value_drivers_set_updated_at
  before update on public.company_value_drivers
  for each row execute function public.set_updated_at();

alter table public.company_value_drivers enable row level security;

drop policy if exists company_value_drivers_select_member
  on public.company_value_drivers;
create policy company_value_drivers_select_member
  on public.company_value_drivers for select
  using (public.is_company_member(company_id));

drop policy if exists company_value_drivers_insert_writer
  on public.company_value_drivers;
create policy company_value_drivers_insert_writer
  on public.company_value_drivers for insert
  with check (public.is_company_writer(company_id));

drop policy if exists company_value_drivers_update_writer
  on public.company_value_drivers;
create policy company_value_drivers_update_writer
  on public.company_value_drivers for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create table if not exists public.company_value_scenarios (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  navigator_id          uuid references public.company_value_navigators (id) on delete set null,
  snapshot_id           uuid references public.analysis_snapshots (id) on delete set null,
  name                  text not null,
  scenario_key          text not null,
  parameters            jsonb not null default '{}'::jsonb,
  estimated_ev_low      numeric(18,2),
  estimated_ev_high     numeric(18,2),
  confidence            numeric(5,2) not null default 0,
  major_risks           jsonb not null default '[]'::jsonb,
  recommended_actions   jsonb not null default '[]'::jsonb,
  assumptions           jsonb not null default '[]'::jsonb,
  -- Scenarios never mutate the current assessment snapshot.
  isolated_from_assessment boolean not null default true,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists company_value_scenarios_company_idx
  on public.company_value_scenarios (company_id);

drop trigger if exists company_value_scenarios_set_updated_at
  on public.company_value_scenarios;
create trigger company_value_scenarios_set_updated_at
  before update on public.company_value_scenarios
  for each row execute function public.set_updated_at();

alter table public.company_value_scenarios enable row level security;

drop policy if exists company_value_scenarios_select_member
  on public.company_value_scenarios;
create policy company_value_scenarios_select_member
  on public.company_value_scenarios for select
  using (public.is_company_member(company_id));

drop policy if exists company_value_scenarios_insert_writer
  on public.company_value_scenarios;
create policy company_value_scenarios_insert_writer
  on public.company_value_scenarios for insert
  with check (public.is_company_writer(company_id));

drop policy if exists company_value_scenarios_update_writer
  on public.company_value_scenarios;
create policy company_value_scenarios_update_writer
  on public.company_value_scenarios for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

comment on table public.company_value_navigators is
  'Phase 10 — enterprise value ranges for a company snapshot.';
comment on table public.company_value_drivers is
  'Phase 10 — ranked value creation drivers with explainability.';
comment on table public.company_value_scenarios is
  'Phase 10 — isolated what-if scenarios; never overwrite assessment SSOT.';
