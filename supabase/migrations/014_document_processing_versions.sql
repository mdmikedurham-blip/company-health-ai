-- Versioned document processing + safe reprocess + OCR status.
-- Adds extractor/analyzer version stamps and STALE / OCR_REQUIRED statuses.

alter table public.documents
  add column if not exists extraction_version text,
  add column if not exists analysis_version text,
  add column if not exists last_successful_extraction_version text,
  add column if not exists last_successful_analysis_version text,
  add column if not exists reprocess_error_message text,
  add column if not exists next_reprocess_at timestamptz;

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check check (
    status in (
      'UPLOADED',
      'QUEUED',
      'PROCESSING',
      'EXTRACTED',
      'ANALYZING',
      'PROCESSED',
      'FAILED',
      'DELETING',
      'STALE',
      'OCR_REQUIRED'
    )
  );

comment on column public.documents.extraction_version is
  'Extractor version last attempted on this document.';
comment on column public.documents.analysis_version is
  'Analysis version last attempted on this document.';
comment on column public.documents.last_successful_extraction_version is
  'Extractor version that last produced retained evidence.';
comment on column public.documents.last_successful_analysis_version is
  'Analysis version that last completed successfully for this document.';
comment on column public.documents.reprocess_error_message is
  'Last reprocess failure reason; prior evidence remains when set with PROCESSED.';
comment on column public.documents.next_reprocess_at is
  'Earliest time a failed reprocess may be retried (exponential backoff).';

create index if not exists documents_stale_version_idx
  on public.documents (company_id, status)
  where status in ('STALE', 'PROCESSED')
    and connector_id = 'manual-upload';

create index if not exists documents_next_reprocess_idx
  on public.documents (company_id, next_reprocess_at)
  where next_reprocess_at is not null;
