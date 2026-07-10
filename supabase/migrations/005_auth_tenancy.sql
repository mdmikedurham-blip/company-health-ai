-- Auth tenancy: profiles, company_members, analysis_snapshots, membership RLS.
-- Evolves public.users → public.profiles and moves role onto company_members.

-- ─── Rename users → profiles ─────────────────────────────────────────────────

alter table if exists public.users rename to profiles;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'users_company_id_idx'
  ) then
    alter index public.users_company_id_idx rename to profiles_company_id_idx;
  end if;
end $$;

drop trigger if exists users_set_updated_at on public.profiles;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── company_members ─────────────────────────────────────────────────────────

create table if not exists public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member'
                check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_id_idx on public.company_members (user_id);
create index if not exists company_members_company_id_idx on public.company_members (company_id);

drop trigger if exists company_members_set_updated_at on public.company_members;
create trigger company_members_set_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- Backfill membership from legacy profiles.company_id + role (if columns exist)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'company_id'
  ) then
    execute $sql$
      insert into public.company_members (company_id, user_id, role)
      select company_id, id, role
      from public.profiles
      where company_id is not null
      on conflict (company_id, user_id) do nothing
    $sql$;

    alter table public.profiles drop column company_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    alter table public.profiles drop column role;
  end if;
end $$;

-- ─── analysis_snapshots ──────────────────────────────────────────────────────

create table if not exists public.analysis_snapshots (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'running', 'completed', 'failed')),
  payload       jsonb not null default '{}'::jsonb,
  error_message text,
  as_of         timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists analysis_snapshots_company_id_idx
  on public.analysis_snapshots (company_id);
create index if not exists analysis_snapshots_as_of_idx
  on public.analysis_snapshots (company_id, as_of desc);
create index if not exists analysis_snapshots_status_idx
  on public.analysis_snapshots (company_id, status);

drop trigger if exists analysis_snapshots_set_updated_at on public.analysis_snapshots;
create trigger analysis_snapshots_set_updated_at
  before update on public.analysis_snapshots
  for each row execute function public.set_updated_at();

-- ─── Profile bootstrap on auth signup ────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      null
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Drop legacy policies ────────────────────────────────────────────────────

drop policy if exists users_select_own on public.profiles;
drop policy if exists users_update_own on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists companies_select_member on public.companies;
drop policy if exists documents_select_company on public.documents;
drop policy if exists evidence_select_company on public.evidence;
drop policy if exists findings_select_company on public.findings;
drop policy if exists risks_select_company on public.risks;
drop policy if exists recommendations_select_company on public.recommendations;
drop policy if exists health_scores_select_company on public.health_scores;
drop policy if exists timeline_events_select_company on public.timeline_events;
drop policy if exists connector_syncs_select_company on public.connector_syncs;
drop policy if exists connector_credentials_select_company on public.connector_credentials;
drop policy if exists company_members_select_own on public.company_members;
drop policy if exists analysis_snapshots_select_company on public.analysis_snapshots;

-- ─── Membership helpers ──────────────────────────────────────────────────────

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.current_user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.company_members
  where user_id = auth.uid();
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.company_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.company_members enable row level security;
alter table public.analysis_snapshots enable row level security;
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

create policy company_members_select_own on public.company_members
  for select using (
    user_id = auth.uid()
    or public.is_company_member(company_id)
  );

create policy companies_select_member on public.companies
  for select using (public.is_company_member(id));

create policy documents_select_company on public.documents
  for select using (public.is_company_member(company_id));

create policy evidence_select_company on public.evidence
  for select using (public.is_company_member(company_id));

create policy findings_select_company on public.findings
  for select using (public.is_company_member(company_id));

create policy risks_select_company on public.risks
  for select using (public.is_company_member(company_id));

create policy recommendations_select_company on public.recommendations
  for select using (public.is_company_member(company_id));

create policy health_scores_select_company on public.health_scores
  for select using (public.is_company_member(company_id));

create policy timeline_events_select_company on public.timeline_events
  for select using (public.is_company_member(company_id));

create policy connector_syncs_select_company on public.connector_syncs
  for select using (public.is_company_member(company_id));

create policy analysis_snapshots_select_company on public.analysis_snapshots
  for select using (public.is_company_member(company_id));

create policy connector_credentials_select_company on public.connector_credentials
  for select using (public.is_company_member(company_id));

-- Prevent anon/authenticated from reading refresh-token ciphertext.
-- Service role bypasses RLS and retains full column access for sync jobs.
revoke all on public.connector_credentials from anon;
grant select (
  id,
  company_id,
  connector_id,
  status,
  access_token_expires_at,
  scopes,
  account_email,
  connected_by_user_id,
  last_synced_at,
  metadata,
  created_at,
  updated_at
) on public.connector_credentials to authenticated;
