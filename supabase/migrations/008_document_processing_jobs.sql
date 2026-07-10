-- Durable manual-upload processing: expanded statuses, lease columns, atomic claim.

-- ─── processing columns ──────────────────────────────────────────────────────

alter table public.documents
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists error_message text,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists last_stage text,
  add column if not exists locked_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (
    status in (
      'UPLOADED',
      'QUEUED',
      'PROCESSING',
      'EXTRACTED',
      'ANALYZING',
      'PROCESSED',
      'FAILED'
    )
  );

create index if not exists documents_processing_queue_idx
  on public.documents (company_id, status, created_at)
  where status in ('QUEUED', 'PROCESSING');

create index if not exists documents_lease_expires_idx
  on public.documents (lease_expires_at)
  where status = 'PROCESSING' and lease_expires_at is not null;

-- ─── atomic claim (service role / SECURITY DEFINER) ──────────────────────────

create or replace function public.claim_document_for_processing(
  p_document_id uuid,
  p_company_id uuid,
  p_lease_seconds integer default 300
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.documents;
  lease_secs integer := greatest(coalesce(p_lease_seconds, 300), 60);
begin
  update public.documents d
  set
    status = 'PROCESSING',
    processing_started_at = coalesce(d.processing_started_at, now()),
    processing_attempts = coalesce(d.processing_attempts, 0) + 1,
    locked_at = now(),
    lease_expires_at = now() + make_interval(secs => lease_secs),
    last_stage = 'claim',
    error_message = null,
    updated_at = now()
  where d.id = p_document_id
    and d.company_id = p_company_id
    and (
      d.status = 'QUEUED'
      or (
        d.status = 'PROCESSING'
        and (
          d.lease_expires_at is null
          or d.lease_expires_at < now()
        )
      )
    )
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_document_for_processing(uuid, uuid, integer) from public;
grant execute on function public.claim_document_for_processing(uuid, uuid, integer) to service_role;

comment on function public.claim_document_for_processing is
  'Atomically claim a QUEUED or stale PROCESSING document for a single worker.';
