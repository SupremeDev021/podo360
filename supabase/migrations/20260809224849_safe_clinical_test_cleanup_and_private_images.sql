insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-images',
  'clinical-images',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinical team reads own clinical images" on storage.objects;
create policy "clinical team reads own clinical images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'clinical-images'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (storage.foldername(name))[2] = 'attendance-images'
);

drop policy if exists "clinical team uploads own clinical images" on storage.objects;
create policy "clinical team uploads own clinical images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clinical-images'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (storage.foldername(name))[2] = 'attendance-images'
  and (select public.has_clinical_write_access())
);

drop policy if exists "clinical team updates own clinical images" on storage.objects;
create policy "clinical team updates own clinical images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'clinical-images'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (storage.foldername(name))[2] = 'attendance-images'
  and (select public.has_clinical_write_access())
)
with check (
  bucket_id = 'clinical-images'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (storage.foldername(name))[2] = 'attendance-images'
  and (select public.has_clinical_write_access())
);

drop policy if exists "clinical team deletes own clinical images" on storage.objects;
create policy "clinical team deletes own clinical images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'clinical-images'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (storage.foldername(name))[2] = 'attendance-images'
  and (select public.has_clinical_write_access())
);

create or replace function public.cleanup_safe_clinical_test_run(test_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  actor_role text;
  patient_ids uuid[];
  record_ids uuid[];
  patient_count integer := 0;
  attendance_count integer := 0;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  if test_run_id !~ '^TESTE_CLINICO_FINAL_SEGURO_[0-9]{8}_[0-9]{6}_[0-9a-f]{8}$' then
    raise exception 'invalid_test_run_id';
  end if;

  select profile.company_id, profile.role::text
  into actor_company_id, actor_role
  from public.profiles profile
  where profile.id = actor_id
    and profile.active = true;

  if actor_company_id is null or actor_role not in ('super_admin', 'company_admin') then
    raise exception 'test_cleanup_not_allowed';
  end if;

  select
    coalesce(array_agg(patient.id), '{}'::uuid[]),
    coalesce(array_agg(patient.unique_medical_record_id), '{}'::uuid[]),
    count(*)::integer
  into patient_ids, record_ids, patient_count
  from public.patients patient
  where patient.company_id = actor_company_id
    and patient.created_by = actor_id
    and patient.full_name like test_run_id || '%'
    and patient.created_at >= now() - interval '24 hours';

  if patient_count = 0 then
    return jsonb_build_object('patients', 0, 'attendances', 0, 'unique_medical_records', 0);
  end if;

  if patient_count > 4 then
    raise exception 'test_cleanup_scope_too_large';
  end if;

  select count(*)::integer
  into attendance_count
  from public.attendances attendance
  where attendance.patient_id = any(patient_ids)
    and attendance.company_id = actor_company_id;

  delete from public.patients patient
  where patient.id = any(patient_ids)
    and patient.company_id = actor_company_id
    and patient.created_by = actor_id
    and patient.full_name like test_run_id || '%';

  delete from public.unique_medical_records record
  where record.id = any(record_ids)
    and not exists (
      select 1 from public.patient_company_links link
      where link.unique_medical_record_id = record.id
    )
    and not exists (
      select 1 from public.patients patient
      where patient.unique_medical_record_id = record.id
    );

  return jsonb_build_object(
    'patients', patient_count,
    'attendances', attendance_count,
    'unique_medical_records', coalesce(array_length(record_ids, 1), 0)
  );
end;
$$;

revoke all on function public.cleanup_safe_clinical_test_run(text) from public;
revoke all on function public.cleanup_safe_clinical_test_run(text) from anon;
grant execute on function public.cleanup_safe_clinical_test_run(text) to authenticated;

notify pgrst, 'reload schema';
