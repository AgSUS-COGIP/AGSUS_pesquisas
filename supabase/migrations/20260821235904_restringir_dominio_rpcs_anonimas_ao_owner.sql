begin;

-- O backend público usa exclusivamente as entradas `fc_srv_*`, executadas com
-- `service_role`. As funções de domínio são implementação interna e não devem
-- ser alcançáveis diretamente pela Data API, nem mesmo por uma sessão
-- autenticada ou pelo próprio `service_role`.
--
-- Esta migration captura no repositório o estado de segurança já adotado em
-- produção depois da criação das envoltórias internas. Sem ela, um banco novo
-- reconstruído apenas pelas migrations terminaria reabrindo as funções de
-- domínio por causa das concessões transitórias de 16/08 a 18/08.

revoke all on function public.fc_obter_form_anonimo(text)
  from public, anon, authenticated, service_role;
revoke all on function public.fc_iniciar_resp_anon(text)
  from public, anon, authenticated, service_role;
revoke all on function public.fc_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.fc_enviar_resp_anon(uuid, text)
  from public, anon, authenticated, service_role;

-- As envoltórias permanecem como a única porta do backend. Repetir os REVOKEs
-- aqui torna o contrato explícito e resistente a ACLs herdadas de ambientes
-- antigos.
revoke all on function public.fc_srv_obter_form_anonimo(text)
  from public, anon, authenticated;
revoke all on function public.fc_srv_iniciar_resp_anon(text)
  from public, anon, authenticated;
revoke all on function public.fc_srv_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.fc_srv_enviar_resp_anon(uuid, text)
  from public, anon, authenticated;

grant execute on function public.fc_srv_obter_form_anonimo(text) to service_role;
grant execute on function public.fc_srv_iniciar_resp_anon(text) to service_role;
grant execute on function public.fc_srv_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) to service_role;
grant execute on function public.fc_srv_enviar_resp_anon(uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   grant execute on function public.fc_obter_form_anonimo(text) to service_role, authenticated;
--   grant execute on function public.fc_iniciar_resp_anon(text) to service_role, authenticated;
--   grant execute on function public.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) to service_role, authenticated;
--   grant execute on function public.fc_enviar_resp_anon(uuid, text) to service_role, authenticated;
-- commit;
