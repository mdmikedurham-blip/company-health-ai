-- User preferences, company created_by, OAuth nonce replay store,
-- and role-aware RLS write policies for company-scoped tables.

-- ─── companies.created_by ────────────────────────────────────────────────────

alter table public.companies
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists companies_created_by_idx on public.companies (created_by);

-- ─── user_preferences ────────────────────────────────────────────────────────

create table if not exists public.user_preferences (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  active_company_id  uuid references public.companies (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists user_preferences_active_company_id_idx
  on public.user_preferences (active_company_id);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
  for select using (user_id = auth.uid());

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
  for insert with check (user_id = auth.uid());

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own on public.user_preferences
  for delete using (user_id = auth.uid());

-- ─── oauth_state_nonces (CSRF / replay protection for Drive OAuth) ────────────

create table if not exists public.oauth_state_nonces (
  nonce       text primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists oauth_state_nonces_expires_at_idx
  on public.oauth_state_nonces (expires_at);

alter table public.oauth_state_nonces enable row level security;
-- No policies for authenticated/anon — service role only.

-- ─── Role helpers ────────────────────────────────────────────────────────────

create or replace function public.company_member_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.company_members
  where company_id = target_company_id
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_company_writer(target_company_id uuid)
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
      and role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.is_company_admin(target_company_id uuid)
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
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
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
      and role = 'owner'
  );
$$;

-- Prefer active_company_id from preferences when still a member.
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select up.active_company_id
      from public.user_preferences up
      join public.company_members cm
        on cm.company_id = up.active_company_id
       and cm.user_id = auth.uid()
      where up.user_id = auth.uid()
      limit 1
    ),
    (
      select company_id
      from public.company_members
      where user_id = auth.uid()
      order by created_at asc
      limit 1
    )
  );
$$;

-- ─── Write policies (viewers are read-only) ──────────────────────────────────

-- companies
drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
  for update using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

drop policy if exists companies_delete_owner on public.companies;
create policy companies_delete_owner on public.companies
  for delete using (public.is_company_owner(id));

-- company_members: admins manage membership; users can leave
drop policy if exists company_members_insert_admin on public.company_members;
create policy company_members_insert_admin on public.company_members
  for insert with check (public.is_company_admin(company_id));

drop policy if exists company_members_update_admin on public.company_members;
create policy company_members_update_admin on public.company_members
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists company_members_delete_self_or_admin on public.company_members;
create policy company_members_delete_self_or_admin on public.company_members
  for delete using (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
  );

-- Tenant data: writers (owner/admin/member) may mutate; viewers cannot
drop policy if exists documents_insert_writer on public.documents;
create policy documents_insert_writer on public.documents
  for insert with check (public.is_company_writer(company_id));

drop policy if exists documents_update_writer on public.documents;
create policy documents_update_writer on public.documents
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists documents_delete_writer on public.documents;
create policy documents_delete_writer on public.documents
  for delete using (public.is_company_writer(company_id));

drop policy if exists evidence_insert_writer on public.evidence;
create policy evidence_insert_writer on public.evidence
  for insert with check (public.is_company_writer(company_id));

drop policy if exists evidence_update_writer on public.evidence;
create policy evidence_update_writer on public.evidence
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists evidence_delete_writer on public.evidence;
create policy evidence_delete_writer on public.evidence
  for delete using (public.is_company_writer(company_id));

drop policy if exists findings_insert_writer on public.findings;
create policy findings_insert_writer on public.findings
  for insert with check (public.is_company_writer(company_id));

drop policy if exists findings_update_writer on public.findings;
create policy findings_update_writer on public.findings
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists findings_delete_writer on public.findings;
create policy findings_delete_writer on public.findings
  for delete using (public.is_company_writer(company_id));

drop policy if exists risks_insert_writer on public.risks;
create policy risks_insert_writer on public.risks
  for insert with check (public.is_company_writer(company_id));

drop policy if exists risks_update_writer on public.risks;
create policy risks_update_writer on public.risks
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists risks_delete_writer on public.risks;
create policy risks_delete_writer on public.risks
  for delete using (public.is_company_writer(company_id));

drop policy if exists recommendations_insert_writer on public.recommendations;
create policy recommendations_insert_writer on public.recommendations
  for insert with check (public.is_company_writer(company_id));

drop policy if exists recommendations_update_writer on public.recommendations;
create policy recommendations_update_writer on public.recommendations
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists recommendations_delete_writer on public.recommendations;
create policy recommendations_delete_writer on public.recommendations
  for delete using (public.is_company_writer(company_id));

drop policy if exists health_scores_insert_writer on public.health_scores;
create policy health_scores_insert_writer on public.health_scores
  for insert with check (public.is_company_writer(company_id));

drop policy if exists health_scores_update_writer on public.health_scores;
create policy health_scores_update_writer on public.health_scores
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists health_scores_delete_writer on public.health_scores;
create policy health_scores_delete_writer on public.health_scores
  for delete using (public.is_company_writer(company_id));

drop policy if exists timeline_events_insert_writer on public.timeline_events;
create policy timeline_events_insert_writer on public.timeline_events
  for insert with check (public.is_company_writer(company_id));

drop policy if exists timeline_events_update_writer on public.timeline_events;
create policy timeline_events_update_writer on public.timeline_events
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists timeline_events_delete_writer on public.timeline_events;
create policy timeline_events_delete_writer on public.timeline_events
  for delete using (public.is_company_writer(company_id));

drop policy if exists connector_syncs_insert_writer on public.connector_syncs;
create policy connector_syncs_insert_writer on public.connector_syncs
  for insert with check (public.is_company_writer(company_id));

drop policy if exists connector_syncs_update_writer on public.connector_syncs;
create policy connector_syncs_update_writer on public.connector_syncs
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists connector_syncs_delete_admin on public.connector_syncs;
create policy connector_syncs_delete_admin on public.connector_syncs
  for delete using (public.is_company_admin(company_id));

drop policy if exists analysis_snapshots_insert_writer on public.analysis_snapshots;
create policy analysis_snapshots_insert_writer on public.analysis_snapshots
  for insert with check (public.is_company_writer(company_id));

drop policy if exists analysis_snapshots_update_writer on public.analysis_snapshots;
create policy analysis_snapshots_update_writer on public.analysis_snapshots
  for update using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

drop policy if exists analysis_snapshots_delete_admin on public.analysis_snapshots;
create policy analysis_snapshots_delete_admin on public.analysis_snapshots
  for delete using (public.is_company_admin(company_id));

-- connector_credentials: admins may disconnect (delete row); no client insert of tokens
drop policy if exists connector_credentials_delete_admin on public.connector_credentials;
create policy connector_credentials_delete_admin on public.connector_credentials
  for delete using (public.is_company_admin(company_id));
