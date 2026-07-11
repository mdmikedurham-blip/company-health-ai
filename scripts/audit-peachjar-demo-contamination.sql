-- =============================================================================
-- Peachjar demo/mock contamination audit (READ-ONLY)
-- Run in Supabase SQL Editor. Does not UPDATE or DELETE anything.
-- =============================================================================

-- 1) Resolve Peachjar company_id
with peachjar as (
  select c.id as company_id, c.name as company_name, c.created_at
  from public.companies c
  where c.name ilike '%peachjar%'
  order by c.created_at asc
  limit 1
),

-- 2) Inventory counts for that tenant (context only)
inventory as (
  select
    p.company_id,
    p.company_name,
    (select count(*) from public.documents d
      where d.company_id = p.company_id) as documents_total,
    (select count(*) from public.documents d
      where d.company_id = p.company_id
        and d.connector_id = 'manual-upload'
        and d.status = 'PROCESSED') as documents_processed_manual,
    (select count(*) from public.evidence e
      where e.company_id = p.company_id) as evidence_total,
    (select count(*) from public.findings f
      where f.company_id = p.company_id) as findings_total,
    (select count(*) from public.risks r
      where r.company_id = p.company_id) as risks_total,
    (select count(*) from public.recommendations rec
      where rec.company_id = p.company_id) as recommendations_total,
    (select count(*) from public.health_scores hs
      where hs.company_id = p.company_id) as health_scores_total,
    (select count(*) from public.timeline_events te
      where te.company_id = p.company_id) as timeline_events_total,
    (select count(*) from public.analysis_snapshots a
      where a.company_id = p.company_id) as analysis_snapshots_total
  from peachjar p
),

-- 3) Suspect rows across intelligence tables
suspect as (
  -- documents: Acme/demo titles or non-uuid-like demo paths
  select
    'documents'::text as table_name,
    d.id::text as row_id,
    coalesce(d.filename, d.title) as title_or_label,
    d.created_at,
    case
      when d.title ilike '%acme%' or coalesce(d.filename, '') ilike '%acme%'
        then 'title/filename contains Acme'
      when d.title ilike '%meridian corp%' or coalesce(d.filename, '') ilike '%meridian corp%'
        then 'title/filename contains Meridian Corp (Acme mock)'
      when d.external_id ilike 'gdrive-%'
        or d.external_id ilike 'hubspot-%'
        or d.external_id ilike 'carta-%'
        then 'external_id matches mock connector prefix'
      else 'demo fingerprint'
    end as suspected_reason
  from public.documents d
  join peachjar p on p.company_id = d.company_id
  where
    d.title ilike '%acme%'
    or coalesce(d.filename, '') ilike '%acme%'
    or d.title ilike '%meridian corp%'
    or coalesce(d.filename, '') ilike '%meridian corp%'
    or d.title ilike '%board minutes%may 2026%'
    or d.title ilike '%arr cohort%'
    or d.external_id ilike 'gdrive-%'
    or d.external_id ilike 'hubspot-%'
    or d.external_id ilike 'carta-%'
    or d.external_id ilike 'quickbooks-%'
    or d.external_id ilike 'box-%'
    or d.external_id ilike 'bamboohr-%'

  union all

  -- evidence: known Acme mock evidence IDs / titles / seed metadata
  select
    'evidence',
    e.id::text,
    e.title,
    e.created_at,
    case
      when e.id::text similar to '%(ev-board-minutes|ev-arr-cohort|ev-cash-runway|ev-equity-grants|ev-legal-audit|ev-people-health|ev-soc2-review|ev-product-roadmap|ev-ai-readiness|ev-revenue-quality)%'
        then 'id matches Acme mock evidence id'
      when e.title ilike '%acme%' then 'title contains Acme'
      when e.title ilike '%meridian corp%' then 'title contains Meridian Corp (Acme mock)'
      when e.title ilike '%board minutes%may 2026%' then 'title matches Acme board minutes mock'
      when e.title ilike '%arr cohort%' then 'title matches Acme ARR cohort mock'
      when e.title ilike '%equity grant%' then 'title matches Acme Carta mock'
      when e.title ilike '%cash%runway%' or e.title ilike '%runway%' then 'title matches Acme runway mock'
      when e.metadata ? 'seed' and (e.metadata->>'seed') in ('true', 't', '1')
        then 'metadata.seed = true'
      when e.source_system in ('Google Drive', 'HubSpot', 'Carta', 'QuickBooks', 'Box', 'BambooHR')
        and e.document_id is null
        and e.id::text like 'ev-%'
        then 'mock connector source_system with ev-* id and no document_id'
      else 'demo fingerprint'
    end
  from public.evidence e
  join peachjar p on p.company_id = e.company_id
  where
    e.id::text similar to '%(ev-board-minutes|ev-arr-cohort|ev-cash-runway|ev-equity-grants|ev-legal-audit|ev-people-health|ev-soc2-review|ev-product-roadmap|ev-ai-readiness|ev-revenue-quality)%'
    or e.title ilike '%acme%'
    or e.title ilike '%meridian corp%'
    or e.title ilike '%board minutes%may 2026%'
    or e.title ilike '%arr cohort%'
    or e.title ilike '%equity grant review%'
    or e.title ilike '%legal folder audit%'
    or e.title ilike '%people health report%'
    or e.title ilike '%cash%runway%'
    or (e.metadata ? 'seed' and (e.metadata->>'seed') in ('true', 't', '1'))
    or (
      e.source_system in ('Google Drive', 'HubSpot', 'Carta', 'QuickBooks', 'Box', 'BambooHR')
      and e.document_id is null
      and e.id::text like 'ev-%'
    )

  union all

  -- findings
  select
    'findings',
    f.id::text,
    f.title,
    f.created_at,
    case
      when f.title ilike '%acme%' then 'title contains Acme'
      when f.title ilike '%meridian corp%' then 'title contains Meridian Corp (Acme mock)'
      when f.title ilike '%customer concentration%' and f.description ilike '%58%'
        then 'matches Acme concentration finding pattern'
      else 'demo fingerprint'
    end
  from public.findings f
  join peachjar p on p.company_id = f.company_id
  where
    f.title ilike '%acme%'
    or f.title ilike '%meridian corp%'
    or f.description ilike '%meridian corp%'
    or f.description ilike '%acme corp%'
    or (f.title ilike '%concentration%' and f.description ilike '%58% of ARR%')

  union all

  -- risks
  select
    'risks',
    r.id::text,
    r.title,
    r.created_at,
    case
      when r.title ilike '%acme%' then 'title contains Acme'
      when r.title ilike '%meridian corp%' then 'title contains Meridian Corp (Acme mock)'
      when r.summary ilike '%meridian corp%' or r.summary ilike '%acme corp%'
        then 'summary references Acme/Meridian mock'
      else 'demo fingerprint'
    end
  from public.risks r
  join peachjar p on p.company_id = r.company_id
  where
    r.title ilike '%acme%'
    or r.title ilike '%meridian corp%'
    or r.summary ilike '%meridian corp%'
    or r.summary ilike '%acme corp%'
    or r.why_it_matters ilike '%meridian corp%'
    or r.why_it_matters ilike '%acme corp%'

  union all

  -- recommendations
  select
    'recommendations',
    rec.id::text,
    rec.title,
    rec.created_at,
    case
      when rec.title ilike '%acme%' then 'title contains Acme'
      when rec.title ilike '%meridian corp%' then 'title contains Meridian Corp (Acme mock)'
      when coalesce(rec.description, '') ilike '%meridian corp%'
        or coalesce(rec.description, '') ilike '%acme corp%'
        then 'description references Acme/Meridian mock'
      else 'demo fingerprint'
    end
  from public.recommendations rec
  join peachjar p on p.company_id = rec.company_id
  where
    rec.title ilike '%acme%'
    or rec.title ilike '%meridian corp%'
    or coalesce(rec.description, '') ilike '%meridian corp%'
    or coalesce(rec.description, '') ilike '%acme corp%'
    or coalesce(rec.rationale, '') ilike '%meridian corp%'
    or coalesce(rec.rationale, '') ilike '%acme corp%'

  union all

  -- health_scores: Acme prior baseline fingerprints in stored JSON
  select
    'health_scores',
    hs.id::text,
    format('score=%s confidence=%s as_of=%s', hs.score, hs.confidence, hs.as_of),
    hs.created_at,
    case
      when hs.score = 82 and hs.confidence = 88 and hs.change_label ilike '%june%'
        then 'matches Acme previousHealthScore (82 / 88% / June)'
      when hs.score_change::text ilike '%june baseline%'
        then 'score_change references June baseline (Acme seed)'
      when hs.score_change::text ilike '%acme%'
        then 'score_change JSON mentions Acme'
      when hs.dimensions::text ilike '%acme%'
        then 'dimensions JSON mentions Acme'
      else 'demo fingerprint'
    end
  from public.health_scores hs
  join peachjar p on p.company_id = hs.company_id
  where
    (hs.score = 82 and hs.confidence = 88 and hs.change_label ilike '%june%')
    or hs.change_label ilike '%june baseline%'
    or hs.score_change::text ilike '%june baseline%'
    or hs.score_change::text ilike '%acme%'
    or hs.dimensions::text ilike '%acme%'
    or hs.score_explanations::text ilike '%meridian corp%'
    or hs.score_explanations::text ilike '%acme corp%'

  union all

  -- timeline_events: seed timeline / Acme titles
  select
    'timeline_events',
    te.id::text,
    te.title,
    te.created_at,
    case
      when te.title ilike '%june health score: 82%' then 'Acme seed timeline title'
      when te.metadata ? 'seed' and (te.metadata->>'seed') in ('true', 't', '1')
        then 'metadata.seed = true'
      when te.metadata->>'eventKey' like 'tl-seed-%' then 'metadata.eventKey is tl-seed-*'
      when te.title ilike '%acme%' or te.title ilike '%meridian corp%'
        then 'title references Acme/Meridian mock'
      when te.summary ilike '%acme%' or te.description ilike '%acme%'
        then 'summary/description references Acme'
      else 'demo fingerprint'
    end
  from public.timeline_events te
  join peachjar p on p.company_id = te.company_id
  where
    te.title ilike '%june health score: 82%'
    or te.title ilike '%acme%'
    or te.title ilike '%meridian corp%'
    or coalesce(te.summary, '') ilike '%acme%'
    or coalesce(te.description, '') ilike '%acme%'
    or (te.metadata ? 'seed' and (te.metadata->>'seed') in ('true', 't', '1'))
    or te.metadata->>'eventKey' like 'tl-seed-%'
    or te.company_id::text = 'company-acme'

  union all

  -- analysis_snapshots: payload with mock doc counts / Acme source
  select
    'analysis_snapshots',
    a.id::text,
    coalesce(a.payload->>'source', a.status),
    a.created_at,
    case
      when (a.payload->>'documentsAnalyzed')::int = 1292
        then 'payload.documentsAnalyzed = 1292 (sum of Acme mock connectors)'
      when a.payload::text ilike '%company-acme%' then 'payload references company-acme'
      when a.payload::text ilike '%acme%' then 'payload mentions Acme'
      when a.payload->>'source' ilike '%demo%' then 'payload.source looks like demo'
      else 'demo fingerprint'
    end
  from public.analysis_snapshots a
  join peachjar p on p.company_id = a.company_id
  where
    (a.payload ? 'documentsAnalyzed'
      and (a.payload->>'documentsAnalyzed') ~ '^[0-9]+$'
      and (a.payload->>'documentsAnalyzed')::int = 1292)
    or a.payload::text ilike '%company-acme%'
    or a.payload::text ilike '%acme corp%'
    or a.payload->>'source' ilike '%demo%'
    or a.payload::text ilike '%1,292%'
)

-- -----------------------------------------------------------------------------
-- Result A: company identity + inventory
-- -----------------------------------------------------------------------------
select
  'inventory'::text as result_set,
  i.company_id::text as row_id,
  i.company_name as title_or_label,
  null::timestamptz as created_at,
  format(
    'docs=%s processed_manual=%s evidence=%s findings=%s risks=%s recs=%s scores=%s timeline=%s snapshots=%s',
    i.documents_total,
    i.documents_processed_manual,
    i.evidence_total,
    i.findings_total,
    i.risks_total,
    i.recommendations_total,
    i.health_scores_total,
    i.timeline_events_total,
    i.analysis_snapshots_total
  ) as suspected_reason,
  null::text as table_name
from inventory i

union all

-- -----------------------------------------------------------------------------
-- Result B: flagged suspect rows
-- -----------------------------------------------------------------------------
select
  'suspect_row'::text as result_set,
  s.row_id,
  s.title_or_label,
  s.created_at,
  s.suspected_reason,
  s.table_name
from suspect s

order by
  result_set,
  table_name nulls first,
  created_at nulls last,
  row_id;
