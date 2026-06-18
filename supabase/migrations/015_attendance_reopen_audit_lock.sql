alter table public.attendances
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text,
  add column if not exists finalization_cancelled_at timestamptz,
  add column if not exists finalization_cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists finalization_cancelled_reason text,
  add column if not exists previous_finished_at timestamptz;

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  ba_number text not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  action text not null check (action in ('finalized', 'finalization_cancelled', 'reopened_for_editing', 'edited_after_reopen')),
  previous_status public.attendance_status,
  new_status public.attendance_status,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_attendance_audit_logs_company_attendance
on public.attendance_audit_logs(company_id, attendance_id, created_at desc);

alter table public.attendance_audit_logs enable row level security;

drop policy if exists "attendance audit logs are company scoped" on public.attendance_audit_logs;
create policy "attendance audit logs are company scoped"
on public.attendance_audit_logs for select to authenticated
using (public.can_access_company(company_id));

drop policy if exists "admins create attendance audit logs" on public.attendance_audit_logs;
create policy "admins create attendance audit logs"
on public.attendance_audit_logs for insert to authenticated
with check (
  company_id = public.current_company_id()
  and (
    public.current_role() in ('super_admin', 'company_admin')
    or exists (
      select 1
      from public.user_module_permissions permission
      where permission.user_id = auth.uid()
        and permission.company_id = public.current_company_id()
        and permission.module_key = 'attendance-management'
        and permission.can_view = true
    )
  )
);

create or replace function public.has_attendance_management_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('super_admin', 'company_admin'), false)
    or exists (
      select 1
      from public.user_module_permissions permission
      where permission.user_id = auth.uid()
        and permission.company_id = public.current_company_id()
        and permission.module_key = 'attendance-management'
        and permission.can_view = true
    );
$$;

create or replace function public.assert_attendance_is_editable(target_attendance_id uuid, target_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.attendances attendance
    where attendance.id = target_attendance_id
      and attendance.company_id = target_company_id
      and (attendance.status = 'completed' or attendance.finished_at is not null)
  ) then
    raise exception 'attendance_finalized';
  end if;
end;
$$;

create or replace function public.prevent_finalized_attendance_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attendance_id uuid;
  target_company_id uuid;
begin
  target_attendance_id := coalesce(new.attendance_id, old.attendance_id);
  target_company_id := coalesce(new.company_id, old.company_id);
  perform public.assert_attendance_is_editable(target_attendance_id, target_company_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_finalized_attendance_write on public.anamnesis_records;
create trigger prevent_finalized_attendance_write
before insert or update or delete on public.anamnesis_records
for each row execute function public.prevent_finalized_attendance_write();

drop trigger if exists prevent_finalized_attendance_write on public.foot_sensitivity_maps;
create trigger prevent_finalized_attendance_write
before insert or update or delete on public.foot_sensitivity_maps
for each row execute function public.prevent_finalized_attendance_write();

drop trigger if exists prevent_finalized_attendance_write on public.attendance_images;
create trigger prevent_finalized_attendance_write
before insert or update or delete on public.attendance_images
for each row execute function public.prevent_finalized_attendance_write();

drop trigger if exists prevent_finalized_attendance_write on public.attendance_used_products;
create trigger prevent_finalized_attendance_write
before insert or update or delete on public.attendance_used_products
for each row execute function public.prevent_finalized_attendance_write();

drop trigger if exists prevent_finalized_attendance_write on public.patient_body_maps;
create trigger prevent_finalized_attendance_write
before insert or update or delete on public.patient_body_maps
for each row execute function public.prevent_finalized_attendance_write();

create or replace function public.mark_attendance_finished(target_attendance_id uuid)
returns public.attendances
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_attendance public.attendances%rowtype;
begin
  update public.attendances
  set
    status = 'completed',
    finished_at = now(),
    finished_by = auth.uid(),
    updated_at = now()
  where id = target_attendance_id
    and company_id = public.current_company_id()
    and public.current_role() in ('company_admin', 'professional')
    and status in ('in_progress', 'paused')
    and finished_at is null
  returning * into updated_attendance;

  if updated_attendance.id is null then
    raise exception 'attendance_not_found_or_not_finishable';
  end if;

  insert into public.attendance_history (company_id, patient_id, attendance_id, event_type, description, created_by)
  values (
    updated_attendance.company_id,
    updated_attendance.patient_id,
    updated_attendance.id,
    'attendance_finished',
    'Atendimento finalizado',
    auth.uid()
  );

  insert into public.attendance_audit_logs (
    company_id,
    attendance_id,
    ba_number,
    patient_id,
    unique_medical_record_id,
    action,
    previous_status,
    new_status,
    reason,
    created_by,
    metadata
  )
  values (
    updated_attendance.company_id,
    updated_attendance.id,
    updated_attendance.ba_number,
    updated_attendance.patient_id,
    updated_attendance.unique_medical_record_id,
    'finalized',
    'in_progress',
    updated_attendance.status,
    'Finalização confirmada pelo usuário.',
    auth.uid(),
    jsonb_build_object('finished_at', updated_attendance.finished_at)
  );

  return updated_attendance;
end;
$$;

create or replace function public.cancel_attendance_finalization(target_attendance_id uuid, reopen_reason text)
returns public.attendances
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_attendance public.attendances%rowtype;
  updated_attendance public.attendances%rowtype;
  clean_reason text := nullif(trim(coalesce(reopen_reason, '')), '');
begin
  if clean_reason is null then
    raise exception 'reopen_reason_required';
  end if;

  select *
  into previous_attendance
  from public.attendances
  where id = target_attendance_id
    and company_id = public.current_company_id()
  for update;

  if previous_attendance.id is null then
    raise exception 'attendance_not_found';
  end if;

  if not public.has_attendance_management_access() then
    raise exception 'not_authorized_to_reopen_attendance';
  end if;

  if previous_attendance.status <> 'completed' and previous_attendance.finished_at is null then
    raise exception 'attendance_not_finalized';
  end if;

  update public.attendances
  set
    status = 'in_progress',
    previous_finished_at = coalesce(previous_attendance.finished_at, previous_finished_at),
    finalization_cancelled_at = now(),
    finalization_cancelled_by = auth.uid(),
    finalization_cancelled_reason = clean_reason,
    reopened_at = now(),
    reopened_by = auth.uid(),
    reopen_reason = clean_reason,
    finished_at = null,
    finished_by = null,
    updated_at = now()
  where id = previous_attendance.id
  returning * into updated_attendance;

  insert into public.attendance_audit_logs (
    company_id,
    attendance_id,
    ba_number,
    patient_id,
    unique_medical_record_id,
    action,
    previous_status,
    new_status,
    reason,
    created_by,
    metadata
  )
  values (
    updated_attendance.company_id,
    updated_attendance.id,
    updated_attendance.ba_number,
    updated_attendance.patient_id,
    updated_attendance.unique_medical_record_id,
    'finalization_cancelled',
    previous_attendance.status,
    updated_attendance.status,
    clean_reason,
    auth.uid(),
    jsonb_build_object(
      'previous_finished_at', previous_attendance.finished_at,
      'previous_finished_by', previous_attendance.finished_by
    )
  );

  return updated_attendance;
end;
$$;
