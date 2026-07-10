-- First-class file metadata on documents (connector inventory).
-- file id → external_id (already present)
-- mime type → mime_type (already present)

alter table public.documents
  add column if not exists path          text,
  add column if not exists modified_at   timestamptz,
  add column if not exists owner         text,
  add column if not exists content_hash  text;

create index if not exists documents_content_hash_idx
  on public.documents (company_id, content_hash)
  where content_hash is not null;

create index if not exists documents_modified_at_idx
  on public.documents (company_id, modified_at desc nulls last);
