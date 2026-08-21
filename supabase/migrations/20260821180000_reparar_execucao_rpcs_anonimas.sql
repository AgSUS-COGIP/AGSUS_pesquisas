begin;

-- Reparação explícita para bancos que já registraram a migration inicial
-- antes de os privilégios das RPCs públicas terem sido atualizados. A chave
-- `sb_secret_*` usada exclusivamente pelos Route Handlers assume `service_role`;
-- visitantes continuam sem executar estas funções diretamente.
revoke all on function public.fc_obter_form_anonimo(text) from public, anon;
revoke all on function public.fc_iniciar_resp_anon(text) from public, anon;
revoke all on function public.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon;
revoke all on function public.fc_enviar_resp_anon(uuid, text) from public, anon;

grant execute on function public.fc_obter_form_anonimo(text) to service_role, authenticated;
grant execute on function public.fc_iniciar_resp_anon(text) to service_role, authenticated;
grant execute on function public.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) to service_role, authenticated;
grant execute on function public.fc_enviar_resp_anon(uuid, text) to service_role, authenticated;

notify pgrst, 'reload schema';
commit;
