-- Apply ONCE, after 202610140004_scoring_v2.sql. No account or work is replaced.
begin;
select pg_advisory_xact_lock(8102026);

alter table public.settings add column postponed_penalty_points numeric not null default 1
  check (postponed_penalty_points = 1);
insert into public.audit_log(action,details)
select 'practice_defaults_updated',jsonb_build_object('before',to_jsonb(s),'applies_to','next challenge') from public.settings s where id=true;
update public.settings set task_weight=70,practice_weight=25,performance_weight=5,test_weight=30 where id=true;

-- Existing active work keeps its weights. Only deadlines from installation day
-- onward receive this explicitly audited amendment. Archives remain untouched.
insert into public.audit_log(action,entity_id,details)
select 'postponement_policy_enabled',id,jsonb_build_object('previous_rules',rules,'points',1,'effective_from',private.today())
from public.challenges where ended_at is null;
update public.challenges set rules=rules||jsonb_build_object('postponed_penalty_points',1,'penalty_effective_from',private.today()) where ended_at is null;

create table private.notification_config(id boolean primary key default true check(id), enabled_on date not null);
insert into private.notification_config values(true,private.today());
create table public.notifications(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('score_up','score_down','test_approved','test_rejected','task_postponed','manual_points','reward')),
 severity text not null check(severity in ('info','success','warning')),
 title text not null, message text not null,
 event_key text not null unique,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index notifications_owner_time on public.notifications(owner_id,created_at desc,id);
create table public.notification_reads(
 notification_id uuid not null references public.notifications(id) on delete cascade,
 reader_id uuid not null references public.profiles(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(notification_id,reader_id)
);
create table public.score_adjustments(
 id uuid primary key,
 challenge_id uuid not null references public.challenges(id),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 points numeric not null check(points>0 and points<=100),
 reason text not null check(length(trim(reason)) between 5 and 500),
 actor_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index score_adjustments_owner_challenge on public.score_adjustments(challenge_id,owner_id);
create table private.score_notice_state(
 challenge_id uuid references public.challenges(id) on delete cascade,
 owner_id uuid references public.profiles(id) on delete cascade,
 score numeric not null, revision bigint not null default 0,
 primary key(challenge_id,owner_id)
);
revoke all on private.notification_config,private.score_notice_state from public,anon,authenticated;

create function private.adjusted_score(cid uuid,uid uuid,r jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; missed integer:=0; deduction numeric:=0; bonus numeric:=0; total numeric; floor_date date;
begin
 result:=private.score_with_rules(cid,uid,r);
 floor_date:=coalesce((r->>'penalty_effective_from')::date,(select (started_at at time zone 'Asia/Colombo')::date from public.challenges where id=cid));
 if coalesce((r->>'postponed_penalty_points')::numeric,0)>0 then
  select count(*) into missed from public.tasks where challenge_id=cid and owner_id=uid and cancelled_at is null
   and original_due>=floor_date and original_due<private.today()
   and ((completed_at at time zone 'Asia/Colombo')::date=original_due) is not true;
  deduction:=missed*(r->>'postponed_penalty_points')::numeric;
 end if;
 select coalesce(sum(points),0) into bonus from public.score_adjustments where challenge_id=cid and owner_id=uid;
 total:=least(100,greatest(0,(result->>'score')::numeric+bonus-deduction));
 return result||jsonb_build_object('missed_tasks',missed,'penalty_points',deduction,'manual_points',bonus,
  'score_before_adjustments',(result->>'score')::numeric,'score',total,
  'qualified',total>=(r->>'target_score')::numeric and (result->>'active_days')::integer>=(r->>'minimum_days')::integer
   and (result->>'on_time_percent')::numeric>=(r->>'minimum_on_time')::numeric and (result->>'subject_coverage')::integer=3);
end$$;
create or replace function private.score(cid uuid,uid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select private.adjusted_score(cid,uid,rules) from public.challenges where id=cid
$$;

create or replace function public.preview_challenge_scores(task_points numeric, practice_points numeric, performance_points numeric,
 papers_per_subject integer, target numeric, study_days integer, on_time numeric) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; c public.challenges; students jsonb;
begin
 perform private.require_host();
 select * into c from public.challenges where ended_at is null;
 r:=jsonb_build_object('rules_version',2,'task_weight',task_points,'practice_weight',practice_points,
  'performance_weight',performance_points,'practice_target',papers_per_subject,'target_score',target,
  'minimum_days',study_days,'minimum_on_time',on_time,'test_weight',practice_points+performance_points,
  'postponed_penalty_points',coalesce((c.rules->>'postponed_penalty_points')::numeric,0),'penalty_effective_from',c.rules->>'penalty_effective_from');
 perform private.validate_scoring_rules(r);
 select jsonb_object_agg(role,private.adjusted_score(c.id,id,r)) into students from public.profiles where role in ('melan','shashi');
 return jsonb_build_object('rules',r,'challenge_id',c.id,'students',students);
end$$;

-- Full precision comparisons; stable event keys and the shared lock prevent
-- duplicate notices from retries, concurrent clients and midnight catch-up.
create function private.record_score_notice(cid uuid,uid uuid,s jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare old_score numeric; rev bigint; new_score numeric:=(s->>'score')::numeric;
begin
 insert into private.score_notice_state(challenge_id,owner_id,score) values(cid,uid,0) on conflict do nothing;
 select score,revision into old_score,rev from private.score_notice_state where challenge_id=cid and owner_id=uid for update;
 if old_score=new_score then return; end if;
 rev:=rev+1;
 insert into public.notifications(owner_id,kind,severity,title,message,event_key,details)
 values(uid,case when new_score>old_score then 'score_up' else 'score_down' end,
  case when new_score>old_score then 'success' else 'warning' end,
  case when new_score>old_score then 'Challenge score increased' else 'Challenge score decreased' end,
  'Challenge score: '||round(old_score,1)||' → '||round(new_score,1)||' / 100. Task ratios, approved marks, missed deadlines and Host adjustments affect this score.',
  'score:'||cid||':'||uid||':'||rev,jsonb_build_object('challenge_id',cid,'before',old_score,'after',new_score,'delta',new_score-old_score,'breakdown',s));
 update private.score_notice_state set score=new_score,revision=rev where challenge_id=cid and owner_id=uid;
end$$;

create or replace function private.maintain() returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges; m jsonb; s jsonb; mid uuid; sid uuid;
begin
 perform pg_advisory_xact_lock(8102026);
 select * into c from public.challenges where ended_at is null;
 if c.id is not null then
  update public.tasks set challenge_id=c.id where challenge_id is null and cancelled_at is null and original_due<=private.today() and original_due>=(c.started_at at time zone 'Asia/Colombo')::date;
 end if;
 insert into public.task_days(task_id,study_date,completed)
 select t.id,d::date,coalesce((t.completed_at at time zone 'Asia/Colombo')::date=d::date,false)
 from public.tasks t cross join lateral generate_series(t.original_due::timestamp,least(private.today(),coalesce((t.completed_at at time zone 'Asia/Colombo')::date,private.today()))::timestamp,interval '1 day') d
 where t.cancelled_at is null and t.original_due<=private.today() on conflict(task_id,study_date) do nothing;
 insert into public.notifications(owner_id,kind,severity,title,message,event_key,details)
 select t.owner_id,'task_postponed','warning','Task postponed',
  t.title||' · original due date '||t.original_due||'. '||case when ch.id=c.id and coalesce((ch.rules->>'postponed_penalty_points')::numeric,0)>0
   and t.original_due>=coalesce((ch.rules->>'penalty_effective_from')::date,(ch.started_at at time zone 'Asia/Colombo')::date)
   then '1 challenge point deducted once. The total cannot go below zero.' else 'No additional point penalty applies to this task.' end,
  'postponed:'||t.id,jsonb_build_object('task_id',t.id,'original_due',t.original_due,'challenge_id',t.challenge_id)
 from public.tasks t left join public.challenges ch on ch.id=t.challenge_id
 where t.cancelled_at is null and t.original_due<private.today()
  and t.original_due>=(select enabled_on from private.notification_config where id=true)
  and ((t.completed_at at time zone 'Asia/Colombo')::date=t.original_due) is not true
 on conflict(event_key) do nothing;
 if c.id is null then return; end if;
 select id into mid from public.profiles where role='melan'; select id into sid from public.profiles where role='shashi';
 if mid is null or sid is null then return; end if;
 m:=private.score(c.id,mid); s:=private.score(c.id,sid);
 perform private.record_score_notice(c.id,mid,m); perform private.record_score_notice(c.id,sid,s);
 if (m->>'qualified')::boolean and (s->>'qualified')::boolean then
  update public.challenges set ended_at=now(),snapshot=jsonb_build_object('melan',m,'shashi',s,'elapsed_days',private.today()-(c.started_at at time zone 'Asia/Colombo')::date+1) where id=c.id;
  insert into public.rewards(challenge_id) values(c.id) on conflict do nothing;
  insert into public.audit_log(action,entity_id,details) values('challenge_unlocked',c.id,jsonb_build_object('melan',m,'shashi',s));
  insert into public.notifications(owner_id,kind,severity,title,message,event_key,details)
  select p.id,'reward','success','Movie Date Unlocked!','Your achievement is saved. A fresh challenge starts at zero.',
   'reward:'||c.id||':'||p.id,jsonb_build_object('challenge_id',c.id) from public.profiles p where role in ('melan','shashi');
  insert into public.challenges(rules) select to_jsonb(st)-'id'-'exam_date' from public.settings st;
 end if;
end$$;

-- Trusted audit events preserve each rejection/correction/approval separately.
create function private.notify_test_review() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tests;
begin
 if new.action not in ('test_approved','test_rejected') then return new; end if;
 select * into t from public.tests where id=new.entity_id;
 if t.id is null then return new; end if;
 insert into public.notifications(owner_id,kind,severity,title,message,event_key,details)
 values(t.owner_id,new.action,case when new.action='test_rejected' then 'warning' else 'success' end,
  case when new.action='test_rejected' then 'Test needs a correction' else 'Test approved' end,
  t.subject_code||' · Test '||lpad(t.test_number::text,2,'0')||'. '||case when new.action='test_rejected'
   then coalesce(t.rejection_reason,'Please review and resubmit.') else 'Approved by Host. Eligible results now count toward your challenge.' end,
  'review:'||new.id,jsonb_build_object('test_id',t.id,'challenge_id',t.challenge_id));
 return new;
end$$;
create trigger test_review_notification after insert on public.audit_log for each row execute function private.notify_test_review();

create function public.add_manual_points(adjustment_id uuid,student_id uuid,challenge_id uuid,points numeric,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare prev public.score_adjustments; cid uuid;
begin
 perform private.require_host(); perform pg_advisory_xact_lock(8102026);
 select * into prev from public.score_adjustments a where a.id=adjustment_id;
 if prev.id is not null then
  if prev.owner_id=student_id and prev.challenge_id=add_manual_points.challenge_id and prev.points=add_manual_points.points and prev.reason=trim(add_manual_points.reason) then return; end if;
  raise exception 'This adjustment receipt was already used for different details';
 end if;
 if adjustment_id is null or points is null or not(points>0 and points<=100) or reason is null or length(trim(reason)) not between 5 and 500 then
  raise exception 'Choose 0 to 100 positive points and give a reason of 5 to 500 characters'; end if;
 if not exists(select 1 from public.profiles where id=student_id and role in ('melan','shashi')) then raise exception 'Choose a student'; end if;
 perform private.maintain();
 select id into cid from public.challenges where ended_at is null;
 if cid is null or cid is distinct from challenge_id then raise exception 'The challenge changed. Refresh before adding points.'; end if;
 insert into public.score_adjustments(id,challenge_id,owner_id,points,reason,actor_id)
 values(adjustment_id,cid,student_id,points,trim(reason),auth.uid());
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'manual_points_added',adjustment_id,
  jsonb_build_object('owner_id',student_id,'challenge_id',cid,'points',points,'reason',trim(reason)));
 insert into public.notifications(owner_id,kind,severity,title,message,event_key,details)
 values(student_id,'manual_points','success','Host added challenge points','+'||points||' points · '||trim(reason)||'. The final score is capped at 100.',
 'manual:'||adjustment_id,jsonb_build_object('adjustment_id',adjustment_id,'challenge_id',cid,'points',points));
 perform private.maintain();
end$$;

create function public.mark_notification_read(notice_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member();
 if not exists(select 1 from public.notifications n where n.id=notice_id and (n.owner_id=auth.uid() or private.role()='host')) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.notification_reads(notification_id,reader_id) values(notice_id,auth.uid()) on conflict do nothing;
end$$;

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.score_adjustments enable row level security;
revoke all on public.notifications,public.notification_reads,public.score_adjustments from anon,authenticated;
grant select on public.notifications,public.notification_reads,public.score_adjustments to authenticated;
create policy notifications_read on public.notifications for select to authenticated using(owner_id=auth.uid() or private.role()='host');
create policy notification_receipts_read on public.notification_reads for select to authenticated using(reader_id=auth.uid());
create policy adjustments_read on public.score_adjustments for select to authenticated using(owner_id=auth.uid() or private.role()='host');
revoke all on function private.adjusted_score(uuid,uuid,jsonb),private.record_score_notice(uuid,uuid,jsonb),private.notify_test_review() from public,anon,authenticated;
revoke all on function public.add_manual_points(uuid,uuid,uuid,numeric,text),public.mark_notification_read(uuid) from public,anon;
grant execute on function public.add_manual_points(uuid,uuid,uuid,numeric,text),public.mark_notification_read(uuid) to authenticated;

-- Seed a baseline without running rollover or issuing any historical notices.
insert into private.score_notice_state(challenge_id,owner_id,score)
select c.id,p.id,(private.score(c.id,p.id)->>'score')::numeric from public.challenges c cross join public.profiles p
where c.ended_at is null and p.role in ('melan','shashi');
alter publication supabase_realtime add table public.notifications,public.notification_reads,public.score_adjustments;
notify pgrst,'reload schema';
commit;
