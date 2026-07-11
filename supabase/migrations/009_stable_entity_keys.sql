-- Stable human keys for entities whose PKs must be uuid.
-- Readable identifiers live in text columns; uuid PKs use deterministic UUIDs.

alter table public.findings
  add column if not exists stable_key text;

alter table public.risks
  add column if not exists stable_key text;

alter table public.recommendations
  add column if not exists stable_key text;

alter table public.timeline_events
  add column if not exists event_key text;

create unique index if not exists findings_company_stable_key_uidx
  on public.findings (company_id, stable_key)
  where stable_key is not null;

create unique index if not exists risks_company_stable_key_uidx
  on public.risks (company_id, stable_key)
  where stable_key is not null;

create unique index if not exists recommendations_company_stable_key_uidx
  on public.recommendations (company_id, stable_key)
  where stable_key is not null;

create unique index if not exists timeline_events_company_event_key_uidx
  on public.timeline_events (company_id, event_key)
  where event_key is not null;
