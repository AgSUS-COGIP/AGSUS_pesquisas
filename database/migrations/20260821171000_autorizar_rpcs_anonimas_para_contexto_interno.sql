begin;

-- A chave secreta configurada no ambiente executa as RPCs no contexto
-- autenticado do PostgREST. Mantemos `anon` revogado e autorizamos esse
-- contexto interno usado exclusivamente pelos Route Handlers públicos.
grant execute on function public.fc_obter_form_anonimo(text), public.fc_iniciar_resp_anon(text), public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), public.fc_enviar_resp_anon(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
