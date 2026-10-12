-- Prefer node scripts/manage-accounts.mjs: creates/migrates password accounts
-- and profiles together, preserving any existing UUIDs. Do not run this SQL afterward.
-- Manual fallback only: create admin-confirmed password users in Auth > Users:
-- Use the exact account identifiers configured in shared/accounts.json.
-- Choose unique strong passwords. The app does not send email.
-- Run ONCE only if no profiles already exist. Never delete/recreate old identities.
-- Replace UUID placeholders with their Auth user IDs, not emails. Never use user_metadata for roles.
begin;
insert into public.profiles(id,role,display_name) values
 ('REPLACE_WITH_HOST_AUTH_UUID','host','Host'),
 ('REPLACE_WITH_MELAN_AUTH_UUID','melan','Melan'),
 ('REPLACE_WITH_SHASHI_AUTH_UUID','shashi','Shashi');
commit;
-- Sign in as host, open Our Journey > Host settings, set the REAL exam date,
-- save your desired defaults and Activate the first challenge.
