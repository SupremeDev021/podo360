-- Production hardening for the official Podo360 Supabase project.
-- This migration does not remove data. It narrows exposed execution/listing
-- surfaces and fixes mutable search_path warnings raised by Supabase Advisor.

create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'unaccent') then
    execute 'alter extension unaccent set schema extensions';
  else
    execute 'create extension if not exists unaccent with schema extensions';
  end if;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_patient_name(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select lower(regexp_replace(extensions.unaccent(coalesce(value, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.hash_patient_lookup(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when value is null or length(trim(value)) = 0 then null
    else encode(extensions.digest(lower(regexp_replace(value, '[^a-zA-Z0-9@.]', '', 'g')), 'sha256'), 'hex')
  end
$$;

-- Remove default PUBLIC/anon execute exposure for functions in the exposed API
-- schema. Grant back only the RPC/helper functions that authenticated users
-- need for app flows and RLS policy evaluation.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on function public.current_profile() to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.can_access_company(uuid) to authenticated;
grant execute on function public.has_financial_access() to authenticated;
grant execute on function public.has_clinical_write_access() to authenticated;
grant execute on function public.has_attendance_management_access() to authenticated;
grant execute on function public.has_hci_enabled(uuid) to authenticated;
grant execute on function public.has_hci_view_access() to authenticated;
grant execute on function public.has_valid_hci_consent(uuid, uuid, public.hci_access_scope) to authenticated;
grant execute on function public.find_unique_medical_record(text, text, date, text, text) to authenticated;
grant execute on function public.mark_attendance_started(uuid) to authenticated;
grant execute on function public.mark_attendance_finished(uuid) to authenticated;
grant execute on function public.cancel_attendance_finalization(uuid, text) to authenticated;

-- Company logo URLs remain usable because the bucket is public, but broad
-- SELECT/listing is no longer available to anonymous users.
drop policy if exists "company logos are publicly readable" on storage.objects;

drop policy if exists "clinic admins read own company assets" on storage.objects;
create policy "clinic admins read own company assets"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);
