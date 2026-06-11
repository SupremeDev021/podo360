do $$ begin
  create type public.attendance_status as enum (
    'ba_open',
    'waiting',
    'in_progress',
    'paused',
    'completed',
    'cancelled',
    'no_show'
  );
exception when duplicate_object then null;
end $$;

alter type public.sensitivity_status add value if not exists 'not_tested';

alter table public.attendances
  add column if not exists opened_at timestamptz not null default now(),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists opened_by uuid references public.profiles(id),
  add column if not exists started_by uuid references public.profiles(id),
  add column if not exists finished_by uuid references public.profiles(id),
  add column if not exists initial_notes text,
  add column if not exists visit_kind text check (visit_kind in ('first_evaluation', 'return')),
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.anamnesis_records
  add column if not exists step_statuses jsonb not null default '{}'::jsonb;

alter table public.foot_sensitivity_maps
  add column if not exists point_key text;

update public.foot_sensitivity_maps
set point_key = foot_side::text || '-' || region_key
where point_key is null;

alter table public.foot_sensitivity_maps
  alter column point_key set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendances'
      and column_name = 'status'
      and udt_name = 'appointment_status'
  ) then
    alter table public.attendances
      alter column status drop default,
      alter column status type public.attendance_status
      using (
        case status::text
          when 'scheduled' then 'waiting'
          when 'in_progress' then 'in_progress'
          when 'completed' then 'completed'
          when 'cancelled' then 'cancelled'
          when 'no_show' then 'no_show'
          else 'waiting'
        end
      )::public.attendance_status,
      alter column status set default 'waiting';
  end if;
end $$;

alter table public.attendances
  alter column status set default 'waiting';

create index if not exists idx_attendances_company_status_opened
on public.attendances(company_id, status, opened_at desc);

create index if not exists idx_attendances_unique_record_ba
on public.attendances(unique_medical_record_id, ba_number);

create index if not exists idx_foot_sensitivity_attendance_point
on public.foot_sensitivity_maps(attendance_id, foot_side, point_key);

drop policy if exists "professionals manage attendances" on public.attendances;
create policy "care team manages hospital BA"
on public.attendances for all
to authenticated
using (
  public.current_company_id() = company_id
  and public.current_role() in ('company_admin', 'professional', 'reception')
)
with check (
  public.current_company_id() = company_id
  and public.current_role() in ('company_admin', 'professional', 'reception')
);

create or replace function public.mark_attendance_started(target_attendance_id uuid)
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
    status = 'in_progress',
    started_at = coalesce(started_at, now()),
    started_by = coalesce(started_by, auth.uid()),
    updated_at = now()
  where id = target_attendance_id
    and company_id = public.current_company_id()
    and public.current_role() in ('company_admin', 'professional')
    and status in ('ba_open', 'waiting', 'paused', 'in_progress')
  returning * into updated_attendance;

  if updated_attendance.id is null then
    raise exception 'attendance_not_found_or_not_startable';
  end if;

  insert into public.attendance_history (company_id, patient_id, attendance_id, event_type, description, created_by)
  values (
    updated_attendance.company_id,
    updated_attendance.patient_id,
    updated_attendance.id,
    'attendance_started',
    'Atendimento iniciado',
    auth.uid()
  );

  return updated_attendance;
end;
$$;

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
    finished_at = coalesce(finished_at, now()),
    finished_by = coalesce(finished_by, auth.uid()),
    updated_at = now()
  where id = target_attendance_id
    and company_id = public.current_company_id()
    and public.current_role() in ('company_admin', 'professional')
    and status in ('in_progress', 'paused')
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

  return updated_attendance;
end;
$$;
