-- Restrict direct RPC execution of internal SECURITY DEFINER functions.
-- These functions are used by triggers or internal database flows and should
-- not be callable directly by logged-in application users.

revoke execute on function public.assert_attendance_is_editable(uuid, uuid) from authenticated;
revoke execute on function public.assign_attendance_ba_number() from authenticated;
revoke execute on function public.assign_unique_medical_record() from authenticated;
revoke execute on function public.create_attendance_side_effects() from authenticated;
revoke execute on function public.find_unique_medical_record(text, text, date, text, text) from authenticated;
revoke execute on function public.next_company_counter(uuid, text, integer) from authenticated;
revoke execute on function public.next_system_counter(text, integer) from authenticated;
revoke execute on function public.prevent_finalized_attendance_write() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.sync_patient_company_link() from authenticated;
