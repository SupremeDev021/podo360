alter table public.attendance_images
  add column if not exists foot_side text check (foot_side in ('right', 'left', 'not_applicable')),
  add column if not exists foot_region text,
  add column if not exists description text,
  add column if not exists clinical_notes text,
  add column if not exists comparative_notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.attendance_images
  drop constraint if exists attendance_images_image_type_check;

alter table public.attendance_images
  add constraint attendance_images_image_type_check
  check (image_type in ('before', 'during', 'after', 'current_state', 'return', 'evolution'));

create index if not exists idx_attendance_images_patient_timeline
on public.attendance_images(unique_medical_record_id, patient_id, created_at);

create index if not exists idx_attendance_images_filters
on public.attendance_images(company_id, foot_side, foot_region, image_type);

drop trigger if exists set_updated_at on public.attendance_images;
create trigger set_updated_at
before update on public.attendance_images
for each row execute function public.touch_updated_at();
