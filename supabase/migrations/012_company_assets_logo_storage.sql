alter table public.company_settings
  add column if not exists logo_path text,
  add column if not exists logo_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company logos are publicly readable" on storage.objects;
create policy "company logos are publicly readable"
on storage.objects for select
using (bucket_id = 'company-assets');

drop policy if exists "admins upload company assets" on storage.objects;
create policy "admins upload company assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1] = public.current_company_id()::text
      and public.current_role() = 'company_admin'
    )
  )
);

drop policy if exists "admins update company assets" on storage.objects;
create policy "admins update company assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1] = public.current_company_id()::text
      and public.current_role() = 'company_admin'
    )
  )
)
with check (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1] = public.current_company_id()::text
      and public.current_role() = 'company_admin'
    )
  )
);

drop policy if exists "admins delete company assets" on storage.objects;
create policy "admins delete company assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1] = public.current_company_id()::text
      and public.current_role() = 'company_admin'
    )
  )
);
