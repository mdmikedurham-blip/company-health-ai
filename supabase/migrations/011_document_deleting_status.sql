-- Add DELETING status for processed document removal + analysis rebuild.

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
      'FAILED',
      'DELETING'
    )
  );

create index if not exists documents_deleting_idx
  on public.documents (company_id, status, updated_at)
  where status = 'DELETING';
