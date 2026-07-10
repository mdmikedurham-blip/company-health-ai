-- Manual document uploads: status/metadata columns + private Storage bucket.
-- Tenant isolation: object keys are `{company_id}/{document_id}/{filename}`.

-- ─── documents upload columns ────────────────────────────────────────────────

alter table public.documents
  add column if not exists filename text,
  add column if not exists byte_size bigint,
  add column if not exists storage_path text,
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null,
  add column if not exists status text;

update public.documents
set
  filename = coalesce(filename, title),
  status = coalesce(status, 'PROCESSED')
where filename is null
   or status is null;

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (
    status in ('UPLOADED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED')
  );

alter table public.documents
  alter column status set default 'UPLOADED';

alter table public.documents
  alter column status set not null;

create index if not exists documents_status_idx
  on public.documents (company_id, status);

create index if not exists documents_uploaded_by_idx
  on public.documents (uploaded_by);

create index if not exists documents_storage_path_idx
  on public.documents (storage_path)
  where storage_path is not null;

-- ─── Storage bucket (private) ────────────────────────────────────────────────

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-documents',
  'company-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Defense-in-depth: even with signed URLs / service role, path must be company-scoped.
drop policy if exists company_documents_select_member on storage.objects;
create policy company_documents_select_member
  on storage.objects
  for select
  using (
    bucket_id = 'company-documents'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists company_documents_insert_writer on storage.objects;
create policy company_documents_insert_writer
  on storage.objects
  for insert
  with check (
    bucket_id = 'company-documents'
    and public.is_company_writer((storage.foldername(name))[1]::uuid)
  );

drop policy if exists company_documents_update_writer on storage.objects;
create policy company_documents_update_writer
  on storage.objects
  for update
  using (
    bucket_id = 'company-documents'
    and public.is_company_writer((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'company-documents'
    and public.is_company_writer((storage.foldername(name))[1]::uuid)
  );

drop policy if exists company_documents_delete_writer on storage.objects;
create policy company_documents_delete_writer
  on storage.objects
  for delete
  using (
    bucket_id = 'company-documents'
    and public.is_company_writer((storage.foldername(name))[1]::uuid)
  );
