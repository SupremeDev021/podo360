create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

do $$ begin
  create type public.sensitivity_status as enum ('present', 'reduced', 'absent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.foot_side as enum ('right', 'left');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.hci_consent_status as enum ('authorized', 'unauthorized', 'revoked', 'pending');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.hci_access_scope as enum (
    'clinical_summary',
    'full_history',
    'history_with_images',
    'history_without_images',
    'medical_reports_only',
    'recent_attendances'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.system_year_counters (
  id uuid primary key default gen_random_uuid(),
  counter_type text not null check (counter_type in ('unique_medical_record')),
  year integer not null,
  current_value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (counter_type, year)
);

create table if not exists public.company_year_counters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  counter_type text not null check (counter_type in ('ba')),
  year integer not null,
  current_value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, counter_type, year)
);

create table if not exists public.unique_medical_records (
  id uuid primary key default gen_random_uuid(),
  unique_record_number text not null unique,
  patient_unique_id uuid not null default gen_random_uuid(),
  cpf_hash text,
  normalized_patient_name text not null,
  birth_date date,
  phone_hash text,
  email_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_company_links (
  id uuid primary key default gen_random_uuid(),
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  local_patient_id uuid not null references public.patients(id) on delete cascade,
  first_attendance_date timestamptz,
  last_attendance_date timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, local_patient_id),
  unique (unique_medical_record_id, company_id, local_patient_id)
);

alter table public.patients
  add column if not exists unique_medical_record_id uuid references public.unique_medical_records(id),
  add column if not exists unique_record_number text;

alter table public.attendances
  add column if not exists unique_medical_record_id uuid references public.unique_medical_records(id),
  add column if not exists unique_record_number text,
  add column if not exists ba_number text,
  add column if not exists attendance_date timestamptz,
  add column if not exists main_complaint text;

alter table public.company_settings
  add column if not exists hci_enabled boolean not null default false,
  add column if not exists hci_require_consent_each_query boolean not null default true,
  add column if not exists hci_consent_validity_days integer not null default 180,
  add column if not exists hci_allow_images boolean not null default false,
  add column if not exists hci_default_scope public.hci_access_scope not null default 'history_without_images',
  add column if not exists hci_request_roles text[] not null default array['company_admin', 'professional', 'reception'],
  add column if not exists hci_view_roles text[] not null default array['company_admin', 'professional'];

create or replace function public.normalize_patient_name(value text)
returns text
language sql
stable
as $$
  select lower(regexp_replace(unaccent(coalesce(value, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.hash_patient_lookup(value text)
returns text
language sql
immutable
as $$
  select case
    when value is null or length(trim(value)) = 0 then null
    else encode(digest(lower(regexp_replace(value, '[^a-zA-Z0-9@.]', '', 'g')), 'sha256'), 'hex')
  end
$$;

create or replace function public.next_system_counter(target_type text, target_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  insert into public.system_year_counters (counter_type, year, current_value)
  values (target_type, target_year, 1)
  on conflict (counter_type, year)
  do update set current_value = public.system_year_counters.current_value + 1, updated_at = now()
  returning current_value into next_value;

  return next_value;
end;
$$;

create or replace function public.next_company_counter(target_company_id uuid, target_type text, target_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  insert into public.company_year_counters (company_id, counter_type, year, current_value)
  values (target_company_id, target_type, target_year, 1)
  on conflict (company_id, counter_type, year)
  do update set current_value = public.company_year_counters.current_value + 1, updated_at = now()
  returning current_value into next_value;

  return next_value;
end;
$$;

create or replace function public.find_unique_medical_record(
  target_cpf text,
  target_name text,
  target_birth_date date,
  target_phone text,
  target_email text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.unique_medical_records record
  where
    (public.hash_patient_lookup(target_cpf) is not null and record.cpf_hash = public.hash_patient_lookup(target_cpf))
    or (public.hash_patient_lookup(target_cpf) is not null and record.cpf_hash = public.hash_patient_lookup(target_cpf) and record.birth_date = target_birth_date)
    or (record.normalized_patient_name = public.normalize_patient_name(target_name) and record.birth_date = target_birth_date)
    or (record.normalized_patient_name = public.normalize_patient_name(target_name) and record.phone_hash = public.hash_patient_lookup(target_phone))
    or (public.hash_patient_lookup(target_email) is not null and record.email_hash = public.hash_patient_lookup(target_email))
  order by
    case
      when public.hash_patient_lookup(target_cpf) is not null and record.cpf_hash = public.hash_patient_lookup(target_cpf) then 1
      when record.normalized_patient_name = public.normalize_patient_name(target_name) and record.birth_date = target_birth_date then 2
      when record.normalized_patient_name = public.normalize_patient_name(target_name) and record.phone_hash = public.hash_patient_lookup(target_phone) then 3
      else 4
    end
  limit 1
$$;

create or replace function public.assign_unique_medical_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_record_id uuid;
  target_year integer := extract(year from now())::integer;
  next_value integer;
  new_record_number text;
begin
  existing_record_id := new.unique_medical_record_id;

  if existing_record_id is null then
    existing_record_id := public.find_unique_medical_record(new.cpf, new.full_name, new.birth_date, coalesce(new.whatsapp, new.phone), new.email);
  end if;

  if existing_record_id is null then
    next_value := public.next_system_counter('unique_medical_record', target_year);
    new_record_number := 'PU-' || target_year || '-' || lpad(next_value::text, 6, '0');

    insert into public.unique_medical_records (
      unique_record_number,
      cpf_hash,
      normalized_patient_name,
      birth_date,
      phone_hash,
      email_hash
    )
    values (
      new_record_number,
      public.hash_patient_lookup(new.cpf),
      public.normalize_patient_name(new.full_name),
      new.birth_date,
      public.hash_patient_lookup(coalesce(new.whatsapp, new.phone)),
      public.hash_patient_lookup(new.email)
    )
    returning id into existing_record_id;
  end if;

  new.unique_medical_record_id := existing_record_id;
  select unique_record_number into new.unique_record_number
  from public.unique_medical_records
  where id = existing_record_id;

  return new;
end;
$$;

drop trigger if exists before_patient_unique_medical_record on public.patients;
create trigger before_patient_unique_medical_record
before insert on public.patients
for each row execute function public.assign_unique_medical_record();

create or replace function public.sync_patient_company_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.patient_company_links (
    unique_medical_record_id,
    patient_id,
    company_id,
    local_patient_id,
    first_attendance_date,
    last_attendance_date
  )
  values (
    new.unique_medical_record_id,
    new.id,
    new.company_id,
    new.id,
    new.created_at,
    new.updated_at
  )
  on conflict (company_id, local_patient_id)
  do update set
    unique_medical_record_id = excluded.unique_medical_record_id,
    last_attendance_date = greatest(coalesce(public.patient_company_links.last_attendance_date, excluded.last_attendance_date), excluded.last_attendance_date),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists after_patient_company_link_sync on public.patients;
create trigger after_patient_company_link_sync
after insert or update of unique_medical_record_id
on public.patients
for each row execute function public.sync_patient_company_link();

do $$
declare
  patient_row record;
  existing_record_id uuid;
  target_year integer;
  next_value integer;
  new_record_number text;
begin
  for patient_row in
    select *
    from public.patients
    where unique_medical_record_id is null
  loop
    existing_record_id := public.find_unique_medical_record(
      patient_row.cpf,
      patient_row.full_name,
      patient_row.birth_date,
      coalesce(patient_row.whatsapp, patient_row.phone),
      patient_row.email
    );

    if existing_record_id is null then
      target_year := extract(year from coalesce(patient_row.created_at, now()))::integer;
      next_value := public.next_system_counter('unique_medical_record', target_year);
      new_record_number := 'PU-' || target_year || '-' || lpad(next_value::text, 6, '0');

      insert into public.unique_medical_records (
        unique_record_number,
        cpf_hash,
        normalized_patient_name,
        birth_date,
        phone_hash,
        email_hash,
        created_at,
        updated_at
      )
      values (
        new_record_number,
        public.hash_patient_lookup(patient_row.cpf),
        public.normalize_patient_name(patient_row.full_name),
        patient_row.birth_date,
        public.hash_patient_lookup(coalesce(patient_row.whatsapp, patient_row.phone)),
        public.hash_patient_lookup(patient_row.email),
        patient_row.created_at,
        patient_row.updated_at
      )
      returning id into existing_record_id;
    end if;

    update public.patients
    set
      unique_medical_record_id = existing_record_id,
      unique_record_number = (
        select unique_record_number
        from public.unique_medical_records
        where id = existing_record_id
      )
    where id = patient_row.id;
  end loop;
end $$;

alter table public.patients
  alter column unique_medical_record_id set not null,
  alter column unique_record_number set not null;

create or replace function public.assign_attendance_ba_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from coalesce(new.attendance_date, new.attended_at, now()))::integer;
  next_value integer;
  patient_record public.patients%rowtype;
begin
  select * into patient_record
  from public.patients
  where id = new.patient_id and company_id = new.company_id
  limit 1;

  if new.unique_medical_record_id is null then
    new.unique_medical_record_id := patient_record.unique_medical_record_id;
  end if;

  if new.unique_record_number is null or length(trim(new.unique_record_number)) = 0 then
    new.unique_record_number := patient_record.unique_record_number;
  end if;

  if new.attendance_date is null then
    new.attendance_date := coalesce(new.attended_at, now());
  end if;

  if new.ba_number is null or length(trim(new.ba_number)) = 0 then
    next_value := public.next_company_counter(new.company_id, 'ba', target_year);
    new.ba_number := 'BA-' || target_year || '-' || lpad(next_value::text, 6, '0');
  end if;

  if new.main_complaint is null then
    new.main_complaint := new.patient_complaint;
  end if;

  update public.patient_company_links
  set last_attendance_date = new.attendance_date, updated_at = now()
  where company_id = new.company_id and local_patient_id = new.patient_id;

  return new;
end;
$$;

drop trigger if exists before_attendance_ba_number on public.attendances;
create trigger before_attendance_ba_number
before insert on public.attendances
for each row execute function public.assign_attendance_ba_number();

update public.attendances attendance
set
  unique_medical_record_id = patient.unique_medical_record_id,
  unique_record_number = patient.unique_record_number,
  attendance_date = coalesce(attendance.attendance_date, attendance.attended_at),
  main_complaint = coalesce(attendance.main_complaint, attendance.patient_complaint)
from public.patients patient
where patient.id = attendance.patient_id
  and patient.company_id = attendance.company_id
  and attendance.unique_medical_record_id is null;

update public.attendances attendance
set ba_number = 'BA-' || extract(year from coalesce(attendance.attendance_date, attendance.attended_at, now()))::integer || '-' || lpad(numbered.row_number_value::text, 6, '0')
from (
  select
    id,
    row_number() over (
      partition by company_id, extract(year from coalesce(attendance_date, attended_at, now()))::integer
      order by coalesce(attendance_date, attended_at, now()), id
    ) as row_number_value
  from public.attendances
  where ba_number is null
) numbered
where numbered.id = attendance.id;

insert into public.company_year_counters (company_id, counter_type, year, current_value)
select
  company_id,
  'ba',
  split_part(ba_number, '-', 2)::integer,
  max(split_part(ba_number, '-', 3)::integer)
from public.attendances
where ba_number ~ '^BA-[0-9]{4}-[0-9]{6}$'
group by company_id, split_part(ba_number, '-', 2)::integer
on conflict (company_id, counter_type, year)
do update set current_value = greatest(public.company_year_counters.current_value, excluded.current_value), updated_at = now();

alter table public.attendances
  alter column unique_medical_record_id set not null,
  alter column unique_record_number set not null,
  alter column ba_number set not null,
  alter column attendance_date set default now();

create table if not exists public.anamnesis_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  unique_record_number text not null,
  ba_number text not null,
  form_data jsonb not null default '{}'::jsonb,
  current_step integer not null default 1,
  is_completed boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.foot_sensitivity_maps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  unique_record_number text not null,
  ba_number text not null,
  foot_side public.foot_side not null,
  region_key text not null,
  coordinates jsonb not null default '{}'::jsonb,
  sensitivity_status public.sensitivity_status not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  unique_record_number text not null,
  ba_number text not null,
  image_type text not null check (image_type in ('before', 'during', 'after')),
  file_url text not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.ai_referral_reports
  add column if not exists unique_medical_record_id uuid references public.unique_medical_records(id) on delete cascade,
  add column if not exists unique_record_number text,
  add column if not exists ba_numbers_analyzed text[] not null default '{}',
  add column if not exists generated_text text,
  add column if not exists edited_text text,
  add column if not exists include_hci boolean not null default false;

create table if not exists public.hci_patient_consents (
  id uuid primary key default gen_random_uuid(),
  unique_medical_record_id uuid not null references public.unique_medical_records(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  patient_cpf text,
  requester_company_id uuid not null references public.companies(id) on delete cascade,
  source_company_id uuid not null references public.companies(id) on delete cascade,
  consent_status public.hci_consent_status not null default 'pending',
  access_scope public.hci_access_scope not null default 'history_without_images',
  authorized_by uuid references public.profiles(id),
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  authorized_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hci_access_logs (
  id uuid primary key default gen_random_uuid(),
  unique_medical_record_id uuid references public.unique_medical_records(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  accessed_by_user_id uuid references public.profiles(id),
  requester_company_id uuid not null references public.companies(id) on delete cascade,
  source_company_id uuid not null references public.companies(id) on delete cascade,
  access_type public.hci_access_scope not null,
  accessed_sections text[] not null default '{}',
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists patients_company_unique_record_key on public.patients(company_id, unique_medical_record_id);
create index if not exists idx_patients_unique_record_number on public.patients(unique_record_number);
create unique index if not exists attendances_company_ba_number_key on public.attendances(company_id, ba_number);
create index if not exists idx_attendances_unique_record on public.attendances(unique_medical_record_id, company_id);
create index if not exists idx_patient_company_links_unique_record on public.patient_company_links(unique_medical_record_id, company_id);
create index if not exists idx_anamnesis_unique_record_company on public.anamnesis_records(unique_medical_record_id, company_id);
create index if not exists idx_foot_sensitivity_unique_record_company on public.foot_sensitivity_maps(unique_medical_record_id, company_id);
create index if not exists idx_attendance_images_unique_record_company on public.attendance_images(unique_medical_record_id, company_id);
create index if not exists idx_hci_consents_unique_record on public.hci_patient_consents(unique_medical_record_id, requester_company_id, source_company_id, consent_status);
create index if not exists idx_hci_access_logs_requester on public.hci_access_logs(requester_company_id, created_at);

create or replace function public.has_hci_enabled(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select hci_enabled from public.company_settings where company_id = target_company_id limit 1), false)
$$;

create or replace function public.has_hci_view_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('super_admin', 'company_admin', 'professional')
$$;

create or replace function public.has_valid_hci_consent(target_unique_record_id uuid, source_company uuid, requested_scope public.hci_access_scope)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hci_patient_consents consent
    where consent.unique_medical_record_id = target_unique_record_id
      and consent.requester_company_id = public.current_company_id()
      and consent.source_company_id = source_company
      and consent.consent_status = 'authorized'
      and (consent.expires_at is null or consent.expires_at > now())
      and (consent.access_scope = requested_scope or consent.access_scope in ('full_history', 'history_with_images', 'history_without_images'))
  )
$$;

do $$ declare
  table_name text;
begin
  foreach table_name in array array[
    'system_year_counters',
    'company_year_counters',
    'unique_medical_records',
    'patient_company_links',
    'anamnesis_records',
    'foot_sensitivity_maps',
    'hci_patient_consents'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end $$;

alter table public.system_year_counters enable row level security;
alter table public.company_year_counters enable row level security;
alter table public.unique_medical_records enable row level security;
alter table public.patient_company_links enable row level security;
alter table public.anamnesis_records enable row level security;
alter table public.foot_sensitivity_maps enable row level security;
alter table public.attendance_images enable row level security;
alter table public.hci_patient_consents enable row level security;
alter table public.hci_access_logs enable row level security;

create policy "unique records visible through own links"
on public.unique_medical_records for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.patient_company_links link
    where link.unique_medical_record_id = id
      and link.company_id = public.current_company_id()
  )
  or (
    public.has_hci_view_access()
    and exists (
      select 1 from public.patient_company_links link
      where link.unique_medical_record_id = id
        and link.company_id <> public.current_company_id()
        and public.has_hci_enabled(link.company_id)
        and public.has_hci_enabled(public.current_company_id())
    )
  )
);

create policy "patient company links visible to linked company"
on public.patient_company_links for select
to authenticated
using (public.is_super_admin() or company_id = public.current_company_id());

create policy "care team creates local patient links"
on public.patient_company_links for insert
to authenticated
with check (company_id = public.current_company_id() and public.current_role() in ('company_admin', 'professional', 'reception'));

create policy "clinical records are isolated by company"
on public.anamnesis_records for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

create policy "clinical team manages anamnesis"
on public.anamnesis_records for all
to authenticated
using (company_id = public.current_company_id() and public.has_clinical_write_access())
with check (company_id = public.current_company_id() and public.has_clinical_write_access());

create policy "foot sensitivity is isolated by company"
on public.foot_sensitivity_maps for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

create policy "clinical team manages foot sensitivity"
on public.foot_sensitivity_maps for all
to authenticated
using (company_id = public.current_company_id() and public.has_clinical_write_access())
with check (company_id = public.current_company_id() and public.has_clinical_write_access());

create policy "attendance images are isolated by company"
on public.attendance_images for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

create policy "clinical team manages attendance images"
on public.attendance_images for all
to authenticated
using (company_id = public.current_company_id() and public.has_clinical_write_access())
with check (company_id = public.current_company_id() and public.has_clinical_write_access());

create policy "hci consents visible to related companies"
on public.hci_patient_consents for select
to authenticated
using (public.is_super_admin() or public.current_company_id() in (requester_company_id, source_company_id));

create policy "hci requests by authorized roles"
on public.hci_patient_consents for insert
to authenticated
with check (
  public.current_company_id() = requester_company_id
  and public.current_role() in ('company_admin', 'professional', 'reception')
  and public.has_hci_enabled(requester_company_id)
);

create policy "hci consents updated by clinical admins"
on public.hci_patient_consents for update
to authenticated
using (public.current_company_id() in (requester_company_id, source_company_id) and public.current_role() in ('company_admin', 'professional'))
with check (public.current_company_id() in (requester_company_id, source_company_id) and public.current_role() in ('company_admin', 'professional'));

create policy "hci logs visible to admins"
on public.hci_access_logs for select
to authenticated
using (public.is_super_admin() or (public.current_company_id() = requester_company_id and public.current_role() = 'company_admin'));

create policy "hci logs are append only"
on public.hci_access_logs for insert
to authenticated
with check (
  public.current_company_id() = requester_company_id
  and public.current_role() in ('company_admin', 'professional')
  and public.has_valid_hci_consent(unique_medical_record_id, source_company_id, access_type)
);

drop policy if exists "attendances are isolated" on public.attendances;
create policy "attendances are isolated"
on public.attendances for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

drop policy if exists "clinical data is isolated" on public.patient_clinical_data;
create policy "clinical data is isolated"
on public.patient_clinical_data for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');

drop policy if exists "ai referral reports are isolated" on public.ai_referral_reports;
create policy "ai referral reports are isolated"
on public.ai_referral_reports for select
to authenticated
using (public.can_access_company(company_id) and public.current_role() <> 'financial');
