create extension if not exists pg_cron with schema pg_catalog;
-- Colombo midnight is 18:30 UTC. catch_up RPC runs the same idempotent function.
select cron.schedule('study-midnight','30 18 * * *',$$select private.maintain()$$);
