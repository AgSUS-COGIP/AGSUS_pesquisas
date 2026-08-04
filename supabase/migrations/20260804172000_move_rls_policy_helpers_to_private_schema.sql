begin;

create schema if not exists private;

comment on schema private is
  'Internal database helpers. This schema must not be exposed through the Data API.';

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;

alter function public.can_audit_platform()
  set schema private;

alter function public.can_edit_submission(uuid)
  set schema private;

revoke all on function private.can_audit_platform() from public;
revoke all on function private.can_audit_platform() from anon;
revoke all on function private.can_audit_platform() from service_role;
grant execute on function private.can_audit_platform() to authenticated;

revoke all on function private.can_edit_submission(uuid) from public;
revoke all on function private.can_edit_submission(uuid) from anon;
revoke all on function private.can_edit_submission(uuid) from service_role;
grant execute on function private.can_edit_submission(uuid) to authenticated;

comment on function private.can_audit_platform() is
  'Internal RLS helper for platform audit authorization; not a Data API RPC.';

comment on function private.can_edit_submission(uuid) is
  'Internal RLS helper for editable survey submissions; not a Data API RPC.';

commit;

-- Rollback:
-- begin;
-- alter function private.can_audit_platform() set schema public;
-- alter function private.can_edit_submission(uuid) set schema public;
-- revoke all on function public.can_audit_platform() from public, anon, service_role;
-- revoke all on function public.can_edit_submission(uuid) from public, anon, service_role;
-- grant execute on function public.can_audit_platform() to authenticated;
-- grant execute on function public.can_edit_submission(uuid) to authenticated;
-- drop schema if exists private;
-- commit;
