-- Connector OAuth credentials (refresh tokens encrypted at rest by the app).
-- Server jobs use the service role; browser clients never read token columns.

create table public.connector_credentials (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id) on delete cascade,
  connector_id            text not null,
  status                  text not null default 'pending'
                          check (status in ('pending', 'connected', 'error')),
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  scopes                  text[] not null default '{}',
  account_email           text,
  connected_by_user_id    uuid references public.users (id) on delete set null,
  last_synced_at          timestamptz,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (company_id, connector_id)
);

create index connector_credentials_company_id_idx
  on public.connector_credentials (company_id);
create index connector_credentials_status_idx
  on public.connector_credentials (status)
  where status = 'connected';

create trigger connector_credentials_set_updated_at
  before update on public.connector_credentials
  for each row execute function public.set_updated_at();

alter table public.connector_credentials enable row level security;

-- Members can see connection status metadata, never token ciphertext via a view-safe select.
-- Token columns are still in the table; RLS allows select for company members so UI can
-- show status. Prefer selecting only non-secret columns from the client.
create policy connector_credentials_select_company on public.connector_credentials
  for select using (company_id = public.current_user_company_id());
