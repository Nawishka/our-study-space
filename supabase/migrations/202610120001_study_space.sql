-- Our Study Space. All dates representing study days use Asia/Colombo.
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 role text not null unique check (role in ('host','melan','shashi')),
 display_name text not null
);
create table public.subjects (code text primary key, name text not null, student_role text not null check(student_role in ('melan','shashi')));
insert into public.subjects values ('ET','Engineering Technology','melan'),('SFT','Science for Technology','melan'),('ICT','Information & Communication Technology','melan'),('BIO','Biology','shashi'),('CHEM','Chemistry','shashi'),('PHY','Physics','shashi');
create table public.settings (
 id boolean primary key default true check(id), exam_date date,
 task_weight numeric not null default 70 check(task_weight between 0 and 100),
 test_weight numeric not null default 30 check(test_weight between 0 and 100),
 target_score numeric not null default 85 check(target_score between 0 and 100),
 minimum_days integer not null default 20 check(minimum_days between 1 and 365),
 minimum_on_time numeric not null default 80 check(minimum_on_time between 0 and 100),
 check(task_weight+test_weight=100)
);
insert into public.settings(id) values(true);
create table public.challenges (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), ended_at timestamptz,
 rules jsonb not null, snapshot jsonb,
 check ((ended_at is null and snapshot is null) or (ended_at is not null and snapshot is not null))
);
create unique index one_active_challenge on public.challenges ((true)) where ended_at is null;
create table public.tasks (
 id uuid primary key, owner_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 240),
 original_due date not null, completed_at timestamptz, cancelled_at timestamptz,
 challenge_id uuid references public.challenges(id), created_at timestamptz not null default now()
);
create index tasks_owner_due on public.tasks(owner_id,original_due) where cancelled_at is null;
create index tasks_challenge on public.tasks(challenge_id);
create table public.task_days (
 task_id uuid not null references public.tasks(id), study_date date not null, completed boolean not null default false,
 primary key(task_id,study_date)
);
create table public.test_counters (
 owner_id uuid references public.profiles(id), subject_code text references public.subjects(code), next_number integer not null default 1,
 primary key(owner_id,subject_code)
);
create table public.tests (
 id uuid primary key, owner_id uuid not null references public.profiles(id), subject_code text not null references public.subjects(code),
 test_number integer not null check(test_number>0), obtained numeric not null check(obtained>=0), maximum numeric not null check(maximum>0),
 note text not null default '' check(length(note)<=2000), taken_on date not null,
 status text not null default 'draft' check(status in ('draft','pending','approved','rejected')),
 challenge_id uuid references public.challenges(id), created_at timestamptz not null default now(),
 submitted_at timestamptz, reviewed_at timestamptz, reviewer_id uuid references public.profiles(id), rejection_reason text,
 check(obtained<=maximum), unique(owner_id,subject_code,test_number)
);
create index tests_owner_status on public.tests(owner_id,status);
create index tests_challenge on public.tests(challenge_id);
create table public.evidence (
 id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id),
 object_path text not null unique, created_at timestamptz not null default now()
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid, action text not null, entity_id uuid,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.rewards (
 id uuid primary key default gen_random_uuid(), challenge_id uuid not null unique references public.challenges(id),
 unlocked_at timestamptz not null default now(), redeemed_at timestamptz
);

create function private.today() returns date language sql stable set search_path='' as $$select (now() at time zone 'Asia/Colombo')::date$$;
create function private.role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid()$$;
create function private.member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid())$$;
create function private.can_edit(owner uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(private.role()='host' or (auth.uid()=owner and private.role() in ('melan','shashi')),false)$$;
create function private.require_member() returns void language plpgsql security definer set search_path='' as $$begin if not private.member() then raise exception 'Access denied' using errcode='42501'; end if; end$$;
create function private.require_host() returns void language plpgsql security definer set search_path='' as $$begin if private.role() is distinct from 'host' then raise exception 'Host access required' using errcode='42501'; end if; end$$;

-- Immutable archival snapshots use the exact unrounded score to qualify.
create function private.score(cid uuid, uid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; total_n integer; done_n integer; days_n integer; avg_n numeric; coverage_n integer; task_n numeric; test_n numeric; pct numeric; score_n numeric;
begin
 select rules into r from public.challenges where id=cid;
 select count(*), count(*) filter(where (completed_at at time zone 'Asia/Colombo')::date=original_due),
 count(distinct original_due) filter(where (completed_at at time zone 'Asia/Colombo')::date=original_due)
 into total_n,done_n,days_n from public.tasks where challenge_id=cid and owner_id=uid and cancelled_at is null and original_due<=private.today();
 select coalesce(avg(obtained/maximum*100),0), count(distinct subject_code) into avg_n,coverage_n from public.tests where challenge_id=cid and owner_id=uid and status='approved';
 pct:=case when total_n=0 then 0 else 100.0*done_n/total_n end;
 task_n:=(r->>'task_weight')::numeric*pct/100; test_n:=(r->>'test_weight')::numeric*avg_n/100;
 score_n:=least(100,greatest(0,task_n+test_n));
 return jsonb_build_object('owner_id',uid,'total_tasks',total_n,'on_time_tasks',done_n,'active_days',days_n,'on_time_percent',pct,'test_average',avg_n,'subject_coverage',coverage_n,'task_score',task_n,'test_score',test_n,'score',score_n,
 'subjects',coalesce((select jsonb_object_agg(code,jsonb_build_object('count',(select count(*) from public.tests t where t.subject_code=s.code and t.owner_id=uid and t.challenge_id=cid and t.status='approved'),'average',(select avg(t.obtained/t.maximum*100) from public.tests t where t.subject_code=s.code and t.owner_id=uid and t.challenge_id=cid and t.status='approved'))) from public.subjects s where s.student_role=(select role from public.profiles where id=uid)),'{}'::jsonb),
 'qualified',score_n >= (r->>'target_score')::numeric and days_n >= (r->>'minimum_days')::integer and pct >= (r->>'minimum_on_time')::numeric and coverage_n=3);
end$$;

-- Shared transaction lock orders rollover, completion, approval and unlock.
create function private.maintain() returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges; m jsonb; s jsonb; mid uuid; sid uuid;
begin
 perform pg_advisory_xact_lock(8102026);
 select * into c from public.challenges where ended_at is null;
 -- Bind each original obligation only once, as it becomes due. Future plans cannot dilute today's score.
 if c.id is not null then
 update public.tasks set challenge_id=c.id where challenge_id is null and cancelled_at is null and original_due<=private.today() and original_due>=(c.started_at at time zone 'Asia/Colombo')::date;
 end if;
 insert into public.task_days(task_id,study_date,completed)
 select t.id,d::date,coalesce((t.completed_at at time zone 'Asia/Colombo')::date=d::date,false)
 from public.tasks t cross join lateral generate_series(t.original_due::timestamp,least(private.today(),coalesce((t.completed_at at time zone 'Asia/Colombo')::date,private.today()))::timestamp,interval '1 day') d
 where t.cancelled_at is null and t.original_due<=private.today()
 on conflict(task_id,study_date) do nothing;
 if c.id is null then return; end if;
 select id into mid from public.profiles where role='melan'; select id into sid from public.profiles where role='shashi';
 if mid is null or sid is null then return; end if;
 m:=private.score(c.id,mid); s:=private.score(c.id,sid);
 if (m->>'qualified')::boolean and (s->>'qualified')::boolean then
 update public.challenges set ended_at=now(),snapshot=jsonb_build_object('melan',m,'shashi',s,'elapsed_days',private.today()-(c.started_at at time zone 'Asia/Colombo')::date+1) where id=c.id;
 insert into public.rewards(challenge_id) values(c.id) on conflict do nothing;
 insert into public.audit_log(action,entity_id,details) values('challenge_unlocked',c.id,jsonb_build_object('melan',m,'shashi',s));
 insert into public.challenges(rules) select to_jsonb(st)-'id'-'exam_date' from public.settings st;
 end if;
end$$;

create function public.catch_up() returns void language plpgsql security definer set search_path='' as $$begin perform private.require_member(); perform private.maintain(); end$$;
create function public.challenge_scores() returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.challenges; result jsonb;
begin perform private.require_member(); perform private.maintain(); select * into c from public.challenges where ended_at is null;
 if c.id is null then return '{}'::jsonb; end if;
 select jsonb_object_agg(role,private.score(c.id,id)) into result from public.profiles where role in ('melan','shashi');
 return jsonb_build_object('challenge',to_jsonb(c),'students',result);
end$$;

create function public.activate_challenge() returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_host(); perform pg_advisory_xact_lock(8102026);
 if (select count(*) from public.profiles)<>3 then raise exception 'Provision all three accounts first'; end if;
 if not exists(select 1 from public.challenges where ended_at is null) then
 insert into public.challenges(rules) select to_jsonb(s)-'id'-'exam_date' from public.settings s;
 insert into public.audit_log(actor_id,action) values(auth.uid(),'challenge_activated'); end if;
 perform private.maintain();
end$$;

create function public.save_task(task_id uuid, student_id uuid, task_title text, due_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.tasks;
begin perform private.require_member(); perform pg_advisory_xact_lock(8102026);
 if not private.can_edit(student_id) or not exists(select 1 from public.profiles where id=student_id and role in ('melan','shashi')) then raise exception 'Access denied' using errcode='42501'; end if;
 select * into t from public.tasks where id=task_id for update;
 if t.id is not null then
 if t.owner_id<>student_id or t.original_due<=private.today() or t.cancelled_at is not null then raise exception 'Past and current obligations cannot be replanned'; end if;
 if due_date<=private.today() then raise exception 'Choose tomorrow or a future date'; end if;
 update public.tasks set title=trim(task_title),original_due=due_date where id=task_id;
 else
 if due_date<=private.today() or due_date>private.today()+730 then raise exception 'Choose a date within the next two years'; end if;
 insert into public.tasks(id,owner_id,title,original_due) values(task_id,student_id,trim(task_title),due_date);
 end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'task_saved',task_id,jsonb_build_object('before',to_jsonb(t),'title',task_title,'due',due_date));
 return task_id;
end$$;
create function public.cancel_task(task_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;
begin perform private.require_member(); perform pg_advisory_xact_lock(8102026); select * into t from public.tasks where id=task_id for update;
 if not private.can_edit(t.owner_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if t.original_due<=private.today() then raise exception 'Only future plans can be deleted'; end if;
 update public.tasks set cancelled_at=now() where id=task_id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'task_cancelled',task_id,to_jsonb(t));
end$$;
create function public.complete_task(task_id uuid, done boolean) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;
begin perform private.require_member(); perform pg_advisory_xact_lock(8102026); perform private.maintain();
 select * into t from public.tasks where id=task_id for update;
 if not private.can_edit(t.owner_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if t.original_due>private.today() or t.cancelled_at is not null then raise exception 'This task is not due'; end if;
 if done and t.completed_at is not null then return; end if;
 if not done and t.completed_at is null then return; end if;
 if exists(select 1 from public.challenges where id=t.challenge_id and ended_at is not null) and t.completed_at is not null then raise exception 'This completion is in an archived challenge'; end if;
 if not done and (t.completed_at at time zone 'Asia/Colombo')::date<>private.today() then raise exception 'Only today’s completions can be undone'; end if;
 update public.tasks set completed_at=case when done then now() else null end where id=task_id;
 update public.task_days set completed=done where task_days.task_id=complete_task.task_id and study_date=private.today();
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),case when done then 'task_done' else 'task_undone' end,task_id,to_jsonb(t));
 perform private.maintain();
end$$;

-- An id supplied by the client is a retry key, never an authority or owner claim.
create function public.save_test(test_id uuid, subject text, score_obtained numeric, score_maximum numeric, test_note text, test_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.tests; n integer; cid uuid;
begin perform private.require_member(); perform pg_advisory_xact_lock(8102026); perform private.maintain();
 if not exists(select 1 from public.subjects where code=subject and student_role=private.role()) then raise exception 'Select one of your subjects' using errcode='42501'; end if;
 if test_date>private.today() then raise exception 'Test date cannot be in the future'; end if;
 select * into t from public.tests where id=test_id for update;
 if t.id is not null then
 if t.owner_id<>auth.uid() or t.status='approved' or t.subject_code<>subject then raise exception 'This test cannot be edited' using errcode='42501'; end if;
 -- Taken date and challenge allocation stay immutable on corrections.
 update public.tests set obtained=score_obtained,maximum=score_maximum,note=test_note,status='draft',rejection_reason=null where id=test_id;
 else
 insert into public.test_counters(owner_id,subject_code,next_number) values(auth.uid(),subject,2)
 on conflict(owner_id,subject_code) do update set next_number=public.test_counters.next_number+1 returning next_number-1 into n;
 select id into cid from public.challenges where ended_at is null and test_date>=(started_at at time zone 'Asia/Colombo')::date;
 insert into public.tests(id,owner_id,subject_code,test_number,obtained,maximum,note,taken_on,challenge_id) values(test_id,auth.uid(),subject,n,score_obtained,score_maximum,test_note,test_date,cid);
 end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'test_draft_saved',test_id,jsonb_build_object('before',to_jsonb(t),'obtained',score_obtained,'maximum',score_maximum,'note',test_note));
 return test_id;
end$$;
create function public.submit_test(test_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tests;
begin perform private.require_member(); perform pg_advisory_xact_lock(8102026); select * into t from public.tests where id=test_id for update;
 if t.owner_id is distinct from auth.uid() then raise exception 'Access denied' using errcode='42501'; end if;
 if t.status='pending' then return; end if;
 if t.status<>'draft' then raise exception 'Save corrections first'; end if;
 insert into public.evidence(test_id,object_path) select test_id,name from storage.objects where bucket_id='test-proofs' and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]=test_id::text on conflict(object_path) do nothing;
 if not exists(select 1 from public.evidence e join storage.objects o on o.name=e.object_path and o.bucket_id='test-proofs' where e.test_id=submit_test.test_id) then raise exception 'Upload at least one marked paper before submitting'; end if;
 update public.tests set status='pending',submitted_at=now() where id=test_id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'test_submitted',test_id,to_jsonb(t));
end$$;
create function public.review_test(test_id uuid, approve boolean, reason text default '') returns void language plpgsql security definer set search_path='' as $$
declare t public.tests;
begin perform private.require_host(); perform pg_advisory_xact_lock(8102026); select * into t from public.tests where id=test_id for update;
 if t.status=(case when approve then 'approved' else 'rejected' end) then return; end if;
 if t.status is distinct from 'pending' then raise exception 'This test is no longer pending'; end if;
 if not approve and length(trim(reason))<3 then raise exception 'Please provide a rejection reason'; end if;
 update public.tests set status=case when approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewer_id=auth.uid(),rejection_reason=case when approve then null else left(trim(reason),2000) end where id=test_id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),case when approve then 'test_approved' else 'test_rejected' end,test_id,jsonb_build_object('before',to_jsonb(t),'reason',reason));
 perform private.maintain();
end$$;
create function public.update_settings(exam date, task_points numeric, test_points numeric, target numeric, study_days integer, on_time numeric) returns void language plpgsql security definer set search_path='' as $$
declare prev jsonb;
begin perform private.require_host(); perform pg_advisory_xact_lock(8102026); select to_jsonb(s) into prev from public.settings s;
 update public.settings set exam_date=exam,task_weight=task_points,test_weight=test_points,target_score=target,minimum_days=study_days,minimum_on_time=on_time;
 -- New scoring rules take effect on the NEXT challenge; the active challenge retains its agreed rules.
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'settings_changed',jsonb_build_object('before',prev,'after',(select to_jsonb(s) from public.settings s)));
end$$;
create function public.redeem_reward(reward_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_host(); update public.rewards set redeemed_at=coalesce(redeemed_at,now()) where id=reward_id;
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'reward_redeemed',reward_id); end$$;

-- No authenticated role has table-write privileges. All mutation goes through the narrow RPCs above.
do $$declare t text; begin foreach t in array array['profiles','subjects','settings','challenges','tasks','task_days','test_counters','tests','evidence','audit_log','rewards'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop; end$$;
create policy member_read on public.profiles for select to authenticated using(private.member());
create policy member_read on public.subjects for select to authenticated using(private.member());
create policy member_read on public.settings for select to authenticated using(private.member());
create policy member_read on public.challenges for select to authenticated using(private.member());
create policy member_read on public.tasks for select to authenticated using(private.member());
create policy member_read on public.task_days for select to authenticated using(private.member());
create policy member_read on public.rewards for select to authenticated using(private.member());
create policy test_read on public.tests for select to authenticated using(private.member() and (status='approved' or owner_id=auth.uid() or private.role()='host'));
create policy proof_read on public.evidence for select to authenticated using(exists(select 1 from public.tests t where t.id=test_id and private.can_edit(t.owner_id)));
create policy audit_read on public.audit_log for select to authenticated using(private.role()='host' or actor_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('test-proofs','test-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy proof_upload on storage.objects for insert to authenticated with check(bucket_id='test-proofs' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.tests t where t.id::text=(storage.foldername(name))[2] and t.owner_id=auth.uid() and t.status='draft'));
create policy proof_download on storage.objects for select to authenticated using(bucket_id='test-proofs' and exists(select 1 from public.tests t where t.id::text=(storage.foldername(name))[2] and private.can_edit(t.owner_id) and (storage.foldername(name))[1]=t.owner_id::text));
create policy orphan_delete on storage.objects for delete to authenticated using(bucket_id='test-proofs' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.evidence e where e.object_path=name) and exists(select 1 from public.tests t where t.id::text=(storage.foldername(name))[2] and t.owner_id=auth.uid() and t.status='draft'));
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.member(),private.role(),private.can_edit(uuid) to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.catch_up(),public.challenge_scores(),public.activate_challenge(),public.save_task(uuid,uuid,text,date),public.cancel_task(uuid),public.complete_task(uuid,boolean),public.save_test(uuid,text,numeric,numeric,text,date),public.submit_test(uuid),public.review_test(uuid,boolean,text),public.update_settings(date,numeric,numeric,numeric,integer,numeric),public.redeem_reward(uuid) to authenticated;

alter publication supabase_realtime add table public.tasks,public.task_days,public.tests,public.settings,public.challenges,public.rewards;
