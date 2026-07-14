-- Deterministic document processing pipeline observability.
-- Coarse `status` remains the queue state machine; `pipeline_step` is the
-- human-readable durable stage within that machine.

alter table public.documents
  add column if not exists pipeline_step text,
  add column if not exists last_successful_pipeline_step text,
  add column if not exists pipeline_steps jsonb not null default '[]'::jsonb,
  add column if not exists pipeline_heartbeat_at timestamptz,
  add column if not exists failed_step text,
  add column if not exists error_category text,
  add column if not exists retryable boolean;

comment on column public.documents.pipeline_step is
  'Current durable pipeline step (upload|storage|text_extraction|ocr|classification|structured_fact_extraction|finding_generation|company_assessment_update|complete).';
comment on column public.documents.last_successful_pipeline_step is
  'Last pipeline step that completed successfully — resume/recovery continues from the next step.';
comment on column public.documents.pipeline_steps is
  'Append-only history: [{step, at, outcome, detail?}].';
comment on column public.documents.pipeline_heartbeat_at is
  'Worker heartbeat while a step is running. Absence > 60s triggers reclaim.';
comment on column public.documents.failed_step is
  'Pipeline step that failed (null when healthy).';
comment on column public.documents.error_category is
  'Machine category for the failure (timeout|storage|extraction|ocr|analysis|internal).';
comment on column public.documents.retryable is
  'Whether the failed step can be retried without a full pipeline restart.';

create index if not exists documents_pipeline_heartbeat_idx
  on public.documents (company_id, pipeline_heartbeat_at)
  where status in ('PROCESSING', 'EXTRACTED', 'ANALYZING', 'QUEUED')
    and pipeline_heartbeat_at is not null;
