-- Company-level analysis serialization for bulk manual uploads.
-- Prevents concurrent replaceCompanyTimeline / recommendations / health writes.

create index if not exists documents_extracted_queue_idx
  on public.documents (company_id, status, created_at)
  where status in ('EXTRACTED', 'ANALYZING');

-- Advisory lock key from company uuid (stable across sessions).
create or replace function public.company_analysis_lock_key(p_company_id uuid)
returns bigint
language sql
immutable
as $$
  select ('x' || substr(md5(p_company_id::text), 1, 16))::bit(64)::bigint;
$$;

create or replace function public.try_lock_company_analysis(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return pg_try_advisory_lock(public.company_analysis_lock_key(p_company_id));
end;
$$;

create or replace function public.unlock_company_analysis(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return pg_advisory_unlock(public.company_analysis_lock_key(p_company_id));
end;
$$;

revoke all on function public.company_analysis_lock_key(uuid) from public;
revoke all on function public.try_lock_company_analysis(uuid) from public;
revoke all on function public.unlock_company_analysis(uuid) from public;

grant execute on function public.company_analysis_lock_key(uuid) to service_role;
grant execute on function public.try_lock_company_analysis(uuid) to service_role;
grant execute on function public.unlock_company_analysis(uuid) to service_role;

comment on function public.try_lock_company_analysis is
  'Non-blocking advisory lock: one company analysis job at a time.';
comment on function public.unlock_company_analysis is
  'Release company analysis advisory lock held by this session.';
