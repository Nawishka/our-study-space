-- Full-Supabase smoke checks. Local embedded PostgreSQL exercises the detailed
-- upgrade/data preservation, formula, correction, RLS and reward lifecycle.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(7);
select has_column('public','settings','rules_version','Versioned next-challenge settings');
select has_column('public','settings','practice_target','Configurable paper target');
select has_function('public','preview_challenge_scores',array['numeric','numeric','numeric','integer','numeric','integer','numeric'],'Read-only preview RPC');
select ok(not has_function_privilege('anon','public.preview_challenge_scores(numeric,numeric,numeric,integer,numeric,integer,numeric)','EXECUTE'),'Anonymous preview blocked');
select ok(not has_function_privilege('authenticated','private.score_with_rules(uuid,uuid,jsonb)','EXECUTE'),'No access to private calculator');
select ok(not has_table_privilege('authenticated','public.settings','UPDATE'),'Settings stay RPC-only');
select ok((select task_weight+practice_weight+performance_weight=100 and rules_version=2 from public.settings where id=true),'New rules total 100');
select * from finish();
rollback;
