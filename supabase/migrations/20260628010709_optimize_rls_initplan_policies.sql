-- Optimize selected RLS policies flagged by Supabase Security Advisor as
-- auth_rls_initplan. The authorization logic is preserved; auth/helper
-- function calls are wrapped in SELECT so PostgreSQL evaluates them once
-- per statement instead of once per row.

drop policy if exists "platform admins read admin users" on public.platform_admin_users;
create policy "platform admins read admin users"
on public.platform_admin_users
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_platform_admin())
);

drop policy if exists "profiles are isolated" on public.profiles;
create policy "profiles are isolated"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or company_id = (select public.current_company_id())
);

drop policy if exists "users read own module permissions" on public.user_module_permissions;
create policy "users read own module permissions"
on public.user_module_permissions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    company_id = (select public.current_company_id())
    and (select public.current_role()) = any (array['super_admin'::public.user_role, 'company_admin'::public.user_role])
  )
);

drop policy if exists "admins create attendance audit logs" on public.attendance_audit_logs;
create policy "admins create attendance audit logs"
on public.attendance_audit_logs
for insert
to authenticated
with check (
  company_id = (select public.current_company_id())
  and (
    (select public.current_role()) = any (array['super_admin'::public.user_role, 'company_admin'::public.user_role])
    or exists (
      select 1
      from public.user_module_permissions permission
      where permission.user_id = (select auth.uid())
        and permission.company_id = (select public.current_company_id())
        and permission.module_key = 'attendance-management'
        and permission.can_view = true
    )
  )
);
