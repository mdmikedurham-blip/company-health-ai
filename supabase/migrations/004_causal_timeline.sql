-- Causal timeline: expand event types and provenance / chain columns.

alter table public.timeline_events
  drop constraint if exists timeline_events_type_check;

alter table public.timeline_events
  add constraint timeline_events_type_check
  check (type in (
    'document-added',
    'document-updated',
    'evidence-created',
    'finding-created',
    'finding-updated',
    'risk-created',
    'risk-updated',
    'risk-resolved',
    'dimension-score-changed',
    'overall-score-changed',
    'recommendation-created',
    'recommendation-completed',
    -- legacy
    'score-change',
    'evidence-added',
    'board',
    'legal',
    'customer',
    'financial'
  ));

alter table public.timeline_events
  add column if not exists occurred_at timestamptz,
  add column if not exists summary text,
  add column if not exists source_document_id text,
  add column if not exists evidence_ids text[] not null default '{}',
  add column if not exists finding_ids text[] not null default '{}',
  add column if not exists risk_ids text[] not null default '{}',
  add column if not exists previous_value numeric,
  add column if not exists current_value numeric,
  add column if not exists score_delta numeric,
  add column if not exists parent_event_id text,
  add column if not exists root_event_id text,
  add column if not exists causal_chain_id text,
  add column if not exists confidence numeric(5, 2) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.timeline_events
set
  summary = coalesce(summary, description),
  occurred_at = coalesce(occurred_at, event_date::timestamptz),
  root_event_id = coalesce(root_event_id, id::text),
  causal_chain_id = coalesce(causal_chain_id, 'chain-' || id::text)
where summary is null
   or occurred_at is null
   or root_event_id is null
   or causal_chain_id is null;

create index if not exists timeline_events_chain_idx
  on public.timeline_events (company_id, causal_chain_id);

create index if not exists timeline_events_root_idx
  on public.timeline_events (company_id, root_event_id);
