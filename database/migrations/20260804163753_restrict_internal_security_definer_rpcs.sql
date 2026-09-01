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
-- Parte dessas RPCs existia apenas em ambientes antigos e não faz parte de uma
-- instalação limpa. Revoga somente as assinaturas presentes para que o histórico
-- de migrations possa ser reconstruído sem reintroduzir funções obsoletas.
do $$
declare
  v_signature text;
  v_function regprocedure;
begin
  foreach v_signature in array array[
    'public.claim_my_access()',
    'public.get_my_cddi_context()',
    'public.get_platform_health()',
    'public.is_allowed_institutional_email(text)',
    'public.is_platform_administrator()',
    'public.start_or_resume_my_submission(text)'
  ]
  loop
    v_function := to_regprocedure(v_signature);

    if v_function is not null then
      execute format(
        'revoke execute on function %s from public, anon, authenticated, service_role',
        v_function
      );
    end if;
  end loop;
end;
$$;

commit;

-- Rollback:
-- grant execute on function public.claim_my_access() to authenticated;
-- grant execute on function public.get_my_cddi_context() to authenticated;
-- grant execute on function public.get_platform_health() to authenticated;
-- grant execute on function public.is_allowed_institutional_email(text) to authenticated;
-- grant execute on function public.is_platform_administrator() to authenticated;
-- grant execute on function public.start_or_resume_my_submission(text) to authenticated;
