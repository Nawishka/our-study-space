-- Run once in the existing project's SQL Editor, or apply with supabase db push.
-- Fix settings saves under Supabase's safe-update protection.
-- CREATE OR REPLACE preserves the existing function's grants and identity.
begin;

create or replace function public.update_settings(
  exam date, task_points numeric, test_points numeric,
  target numeric, study_days integer, on_time numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  prev jsonb;
begin
  perform private.require_host();
  perform pg_advisory_xact_lock(8102026);
  select to_jsonb(s) into prev from public.settings s where s.id = true;

  update public.settings
  set exam_date = exam,
      task_weight = task_points,
      test_weight = test_points,
      target_score = target,
      minimum_days = study_days,
      minimum_on_time = on_time
  where id = true;

  if not found then
    raise exception 'The shared settings record is missing. Ask the owner to check database setup.';
  end if;

  -- Active challenges retain their frozen rules; changes apply to the next one.
  insert into public.audit_log(actor_id, action, details)
  values (
    auth.uid(), 'settings_changed',
    jsonb_build_object(
      'before', prev,
      'after', (select to_jsonb(s) from public.settings s where s.id = true)
    )
  );
end;
$$;

commit;
