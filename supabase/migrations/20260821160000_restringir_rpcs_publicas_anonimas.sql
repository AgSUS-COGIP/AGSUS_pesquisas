begin;

-- A rota pública é a única porta de entrada da jornada anônima. As RPCs
-- internas não podem ser executadas diretamente pelo papel `anon`.
revoke all on function public.fc_obter_form_anonimo(text), public.fc_iniciar_resp_anon(text), public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), public.fc_enviar_resp_anon(uuid,text) from public, anon, authenticated;
grant execute on function public.fc_obter_form_anonimo(text), public.fc_iniciar_resp_anon(text), public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), public.fc_enviar_resp_anon(uuid,text) to service_role;
grant execute on function public.fc_obter_form_anonimo(text), public.fc_iniciar_resp_anon(text), public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), public.fc_enviar_resp_anon(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
