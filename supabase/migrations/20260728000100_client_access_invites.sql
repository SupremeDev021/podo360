create table if not exists public.client_access_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  registration_request_id uuid not null references public.platform_client_registration_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  platform_company_id uuid not null references public.platform_companies(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'company_admin',
  status text not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_access_invites_role_check check (role = 'company_admin'),
  constraint client_access_invites_status_check check (
    status in ('pending', 'processing', 'used', 'expired', 'cancelled')
  ),
  constraint client_access_invites_email_check check (
    email = lower(btrim(email)) and position('@' in email) > 1
  ),
  constraint client_access_invites_expiration_check check (expires_at > created_at),
  constraint client_access_invites_usage_check check (
    (status = 'used' and used_at is not null and used_by is not null)
    or (status <> 'used')
  )
);

create index if not exists client_access_invites_request_idx
  on public.client_access_invites (registration_request_id, created_at desc);

create index if not exists client_access_invites_company_idx
  on public.client_access_invites (platform_company_id, status);

create unique index if not exists client_access_invites_one_pending_per_request_email_idx
  on public.client_access_invites (registration_request_id, email)
  where status in ('pending', 'processing');

create or replace function public.set_client_access_invites_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_access_invites_updated_at
  on public.client_access_invites;

create trigger set_client_access_invites_updated_at
before update on public.client_access_invites
for each row
execute function public.set_client_access_invites_updated_at();

alter table public.client_access_invites enable row level security;

revoke all on public.client_access_invites from anon;
revoke insert, update, delete on public.client_access_invites from authenticated;
grant select on public.client_access_invites to authenticated;

drop policy if exists "Platform admins can read client access invites"
  on public.client_access_invites;

create policy "Platform admins can read client access invites"
on public.client_access_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admin_users admin_user
    where admin_user.user_id = (select auth.uid())
      and admin_user.active = true
      and admin_user.role in ('owner', 'admin', 'support', 'commercial')
  )
);

revoke execute on function public.set_client_access_invites_updated_at() from public, anon, authenticated;

