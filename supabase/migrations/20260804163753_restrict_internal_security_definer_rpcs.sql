begin;

-- Lote 1 da auditoria de SECURITY DEFINER (#76).
--
-- Quatro RPCs foram substituídos e não possuem consumidores no aplicativo,
-- nas políticas RLS ou nos logs recentes:
--   claim_my_access()
--   get_my_cddi_context()
--   get_platform_health()
--   start_or_resume_my_submission(text)
--
-- Dois helpers permanecem disponíveis ao proprietário postgres quando chamados
-- por RPCs SECURITY DEFINER, mas não devem ser invocados diretamente no Data API:
--   is_allowed_institutional_email(text)
--   is_platform_administrator()
revoke execute on function public.claim_my_access()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_my_cddi_context()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_platform_health()
  from public, anon, authenticated, service_role;
revoke execute on function public.is_allowed_institutional_email(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.is_platform_administrator()
  from public, anon, authenticated, service_role;
revoke execute on function public.start_or_resume_my_submission(text)
  from public, anon, authenticated, service_role;

commit;

-- Rollback:
-- grant execute on function public.claim_my_access() to authenticated;
-- grant execute on function public.get_my_cddi_context() to authenticated;
-- grant execute on function public.get_platform_health() to authenticated;
-- grant execute on function public.is_allowed_institutional_email(text) to authenticated;
-- grant execute on function public.is_platform_administrator() to authenticated;
-- grant execute on function public.start_or_resume_my_submission(text) to authenticated;
