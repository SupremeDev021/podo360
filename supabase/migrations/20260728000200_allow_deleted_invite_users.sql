alter table public.client_access_invites
  drop constraint if exists client_access_invites_usage_check;

alter table public.client_access_invites
  add constraint client_access_invites_usage_check check (
    (status = 'used' and used_at is not null)
    or (status <> 'used')
  );

