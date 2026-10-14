-- Apply ONCE after the existing migrations. No accounts, tasks, tests, proofs,
-- challenges or rewards are replaced. Existing challenge JSON stays untouched.
begin;
select pg_advisory_xact_lock(8102026);

alter table public.settings
  add column practice_weight numeric not null default 15 check(practice_weight between 0 and 100),
  add column performance_weight numeric not null default 15 check(performance_weight between 0 and 100),
  add column practice_target integer not null default 2 check(practice_target between 1 and 100),
  add column rules_version integer not null default 2 check(rules_version=2);

insert into public.audit_log(action,details)
select 'scoring_v2_installed',jsonb_build_object('previous_settings',to_jsonb(s),'applies_to','next challenge only')
from public.settings s where id=true;
update public.settings set task_weight=70,test_weight=30 where id=true;
-- test_weight remains the combined test allocation for old clients/old rules.
alter table public.settings add constraint scoring_v2_weights
  check(task_weight+practice_weight+performance_weight=100 and test_weight=practice_weight+performance_weight);

create function private.validate_scoring_rules(r jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if r is null or not coalesce(
  (r->>'rules_version')::integer=2 and
  (r->>'task_weight')::numeric between 0 and 100 and
  (r->>'practice_weight')::numeric between 0 and 100 and
  (r->>'performance_weight')::numeric between 0 and 100 and
  (r->>'task_weight')::numeric+(r->>'practice_weight')::numeric+(r->>'performance_weight')::numeric=100 and
  (r->>'practice_target')::numeric between 1 and 100 and
  (r->>'practice_target')::numeric=trunc((r->>'practice_target')::numeric) and
  (r->>'target_score')::numeric between 0 and 100 and
  (r->>'minimum_days')::numeric between 1 and 365 and
  (r->>'minimum_days')::numeric=trunc((r->>'minimum_days')::numeric) and
  (r->>'minimum_on_time')::numeric between 0 and 100,false)
 then raise exception 'Use weights totaling 100, a whole practice target from 1 to 100, valid percentages, and 1 to 365 active days'; end if;
end$$;

-- Calculation shared by the authoritative score and host-only read-only preview.
-- v1 deliberately preserves the original pooled-test formula and JSON shape.
create function private.score_with_rules(cid uuid, uid uuid, r jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare total_n integer; done_n integer; days_n integer; avg_n numeric; coverage_n integer;
 task_n numeric; test_n numeric; practice_n numeric:=0; performance_n numeric:=0;
 pct numeric; score_n numeric; subject_stats jsonb; result jsonb;
begin
 select count(*),count(*) filter(where (completed_at at time zone 'Asia/Colombo')::date=original_due),
 count(distinct original_due) filter(where (completed_at at time zone 'Asia/Colombo')::date=original_due)
 into total_n,done_n,days_n from public.tasks
 where challenge_id=cid and owner_id=uid and cancelled_at is null and original_due<=private.today();
 select coalesce(avg(obtained/maximum*100),0),count(distinct subject_code)
 into avg_n,coverage_n from public.tests where challenge_id=cid and owner_id=uid and status='approved';
 select coalesce(jsonb_object_agg(code,jsonb_build_object('count',n,'average',a)),'{}'::jsonb)
 into subject_stats from (
  select s.code,count(t.id) n,avg(t.obtained/t.maximum*100) a from public.subjects s
  left join public.tests t on t.subject_code=s.code and t.owner_id=uid and t.challenge_id=cid and t.status='approved'
  where s.student_role=(select role from public.profiles where id=uid) group by s.code
 ) stats;
 pct:=case when total_n=0 then 0 else 100.0*done_n/total_n end;
 task_n:=(r->>'task_weight')::numeric*pct/100;
 if coalesce((r->>'rules_version')::integer,1)=2 then
  perform private.validate_scoring_rules(r);
  select coalesce(sum(least((value->>'count')::numeric/(r->>'practice_target')::numeric,1)),0)*(r->>'practice_weight')::numeric/3,
   coalesce(sum(coalesce((value->>'average')::numeric,0)),0)*(r->>'performance_weight')::numeric/300,
   coalesce(sum(coalesce((value->>'average')::numeric,0)),0)/3
  into practice_n,performance_n,avg_n from jsonb_each(subject_stats);
  test_n:=practice_n+performance_n;
 else
  test_n:=(r->>'test_weight')::numeric*avg_n/100;
 end if;
 score_n:=least(100,greatest(0,task_n+test_n));
 result:=jsonb_build_object('owner_id',uid,'total_tasks',total_n,'on_time_tasks',done_n,'active_days',days_n,
  'on_time_percent',pct,'test_average',avg_n,'subject_coverage',coverage_n,'task_score',task_n,'test_score',test_n,
  'score',score_n,'subjects',subject_stats,'qualified',score_n >= (r->>'target_score')::numeric and
  days_n >= (r->>'minimum_days')::integer and pct >= (r->>'minimum_on_time')::numeric and coverage_n=3);
 if coalesce((r->>'rules_version')::integer,1)=2 then
  result:=result||jsonb_build_object('practice_score',practice_n,'performance_score',performance_n,'rules_version',2);
 end if;
 return result;
end$$;

create or replace function private.score(cid uuid, uid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select private.score_with_rules(cid,uid,rules) from public.challenges where id=cid
$$;

create function public.update_scoring_settings(exam date, task_points numeric, practice_points numeric,
 performance_points numeric, papers_per_subject integer, target numeric, study_days integer, on_time numeric)
returns void language plpgsql security definer set search_path='' as $$
declare prev jsonb; r jsonb;
begin
 perform private.require_host(); perform pg_advisory_xact_lock(8102026);
 r:=jsonb_build_object('rules_version',2,'task_weight',task_points,'practice_weight',practice_points,
  'performance_weight',performance_points,'practice_target',papers_per_subject,'target_score',target,
  'minimum_days',study_days,'minimum_on_time',on_time);
 perform private.validate_scoring_rules(r);
 select to_jsonb(s) into prev from public.settings s where id=true;
 update public.settings set exam_date=exam,task_weight=task_points,test_weight=practice_points+performance_points,
  practice_weight=practice_points,performance_weight=performance_points,practice_target=papers_per_subject,
  target_score=target,minimum_days=study_days,minimum_on_time=on_time,rules_version=2 where id=true;
 if not found then raise exception 'The shared settings record is missing'; end if;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'settings_changed',
  jsonb_build_object('before',prev,'after',(select to_jsonb(s) from public.settings s where id=true)));
end$$;

-- Backward-compatible old-client entry point during rollout. New test points
-- split equally; existing active/archived rules remain unchanged.
create or replace function public.update_settings(exam date, task_points numeric, test_points numeric,
 target numeric, study_days integer, on_time numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_host(); perform pg_advisory_xact_lock(8102026);
 perform public.update_scoring_settings(exam,task_points,test_points/2,test_points/2,
  (select practice_target from public.settings where id=true),target,study_days,on_time);
end$$;

create function public.preview_challenge_scores(task_points numeric, practice_points numeric, performance_points numeric,
 papers_per_subject integer, target numeric, study_days integer, on_time numeric) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; cid uuid; students jsonb;
begin
 perform private.require_host();
 r:=jsonb_build_object('rules_version',2,'task_weight',task_points,'practice_weight',practice_points,
  'performance_weight',performance_points,'practice_target',papers_per_subject,'target_score',target,
  'minimum_days',study_days,'minimum_on_time',on_time,'test_weight',practice_points+performance_points);
 perform private.validate_scoring_rules(r);
 select id into cid from public.challenges where ended_at is null;
 select jsonb_object_agg(role,private.score_with_rules(cid,id,r)) into students
 from public.profiles where role in ('melan','shashi');
 return jsonb_build_object('rules',r,'challenge_id',cid,'students',students);
end$$;

revoke all on function private.validate_scoring_rules(jsonb),private.score_with_rules(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_scoring_settings(date,numeric,numeric,numeric,integer,numeric,integer,numeric),
 public.preview_challenge_scores(numeric,numeric,numeric,integer,numeric,integer,numeric) from public,anon;
grant execute on function public.update_scoring_settings(date,numeric,numeric,numeric,integer,numeric,integer,numeric),
 public.preview_challenge_scores(numeric,numeric,numeric,integer,numeric,integer,numeric) to authenticated;
-- Existing maintenance/activation copy all settings into challenge.rules, so
-- they automatically freeze v2 for the next challenge under the existing lock.
notify pgrst, 'reload schema';
commit;
