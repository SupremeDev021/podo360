begin;

do $$
begin
  if exists (
    select 1
    from public.attendances
    where status in ('ba_open', 'waiting', 'in_progress', 'paused')
      and finished_at is null
    group by company_id, patient_id
    having count(*) > 1
  ) then
    raise exception 'duplicate open attendances must be reviewed before applying this migration';
  end if;
end;
$$;

create unique index if not exists attendances_one_open_per_company_patient_idx
on public.attendances (company_id, patient_id)
where status in ('ba_open', 'waiting', 'in_progress', 'paused')
  and finished_at is null;

commit;
