alter type public.appointment_status add value if not exists 'confirmed';
alter type public.appointment_status add value if not exists 'waiting_arrival';
alter type public.appointment_status add value if not exists 'arrived';
alter type public.appointment_status add value if not exists 'converted_to_ba';
alter type public.appointment_status add value if not exists 'rescheduled';

alter table public.appointments
  add column if not exists unique_medical_record_id uuid references public.unique_medical_records(id) on delete set null,
  add column if not exists temporary_patient_name text,
  add column if not exists temporary_patient_phone text,
  add column if not exists temporary_patient_whatsapp text,
  add column if not exists temporary_patient_email text,
  add column if not exists temporary_patient_birth_date date,
  add column if not exists appointment_date date,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists procedure_type text,
  add column if not exists appointment_type text check (appointment_type in ('first_evaluation', 'return', 'procedure', 'follow_up')),
  add column if not exists initial_complaint text,
  add column if not exists origin text,
  add column if not exists converted_attendance_id uuid references public.attendances(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.profiles(id);

alter table public.attendances
  add column if not exists converted_from_appointment boolean not null default false;

update public.appointments
set
  appointment_date = coalesce(appointment_date, scheduled_at::date),
  start_time = coalesce(start_time, scheduled_at::time),
  end_time = coalesce(end_time, (scheduled_at + (duration_minutes || ' minutes')::interval)::time)
where appointment_date is null or start_time is null or end_time is null;

create index if not exists idx_appointments_company_date_status
on public.appointments(company_id, appointment_date, status);

create index if not exists idx_appointments_patient_record
on public.appointments(company_id, patient_id, unique_medical_record_id);

drop policy if exists "reception and care team manage appointments" on public.appointments;
create policy "company team manages clinical appointments"
on public.appointments for all
to authenticated
using (
  public.current_company_id() = company_id
  and public.current_role() in ('company_admin', 'professional', 'reception')
)
with check (
  public.current_company_id() = company_id
  and public.current_role() in ('company_admin', 'professional', 'reception')
);
