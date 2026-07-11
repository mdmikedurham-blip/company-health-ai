-- Phase 3: persisted company assessment goal (operating mode).
-- Default: run-the-company. Goals influence prioritization/presentation only;
-- evidence and health scoring remain shared (no scoring changes in this migration).

create table if not exists public.company_assessment_goals (
  company_id    uuid primary key references public.companies (id) on delete cascade,
  goal          text not null default 'run-the-company'
                check (goal in (
                  'run-the-company',
                  'raise-capital',
                  'sell-the-company',
                  'acquire-a-company',
                  'board-readiness',
                  'enterprise-sales',
                  'annual-audit',
                  'ipo-readiness'
                )),
  selected_by   uuid references public.profiles (id) on delete set null,
  selected_at   timestamptz not null default now(),
  last_updated  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists company_assessment_goals_goal_idx
  on public.company_assessment_goals (goal);

drop trigger if exists company_assessment_goals_set_updated_at
  on public.company_assessment_goals;
create trigger company_assessment_goals_set_updated_at
  before update on public.company_assessment_goals
  for each row execute function public.set_updated_at();

alter table public.company_assessment_goals enable row level security;

drop policy if exists company_assessment_goals_select_member
  on public.company_assessment_goals;
create policy company_assessment_goals_select_member
  on public.company_assessment_goals
  for select
  using (public.is_company_member(company_id));

drop policy if exists company_assessment_goals_insert_writer
  on public.company_assessment_goals;
create policy company_assessment_goals_insert_writer
  on public.company_assessment_goals
  for insert
  with check (public.is_company_writer(company_id));

drop policy if exists company_assessment_goals_update_writer
  on public.company_assessment_goals;
create policy company_assessment_goals_update_writer
  on public.company_assessment_goals
  for update
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

comment on table public.company_assessment_goals is
  'Company operating mode / assessment goal. Default run-the-company. Does not duplicate evidence.';
