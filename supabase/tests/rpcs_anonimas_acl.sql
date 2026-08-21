-- Jornada anônima: somente as envoltórias de backend podem ser executadas pelo
-- service_role. As funções de domínio ficam privadas ao proprietário do banco.

begin;

select plan(24);

-- ---------------------------------------------------------------------------
-- Funções de domínio: nenhuma função é contrato direto da Data API.
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.fc_obter_form_anonimo(text)'::regprocedure, 'execute'), 'anon não executa fc_obter_form_anonimo');
select ok(not has_function_privilege('authenticated', 'public.fc_obter_form_anonimo(text)'::regprocedure, 'execute'), 'authenticated não executa fc_obter_form_anonimo');
select ok(not has_function_privilege('service_role', 'public.fc_obter_form_anonimo(text)'::regprocedure, 'execute'), 'service_role não executa diretamente fc_obter_form_anonimo');

select ok(not has_function_privilege('anon', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'anon não executa fc_iniciar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'authenticated não executa fc_iniciar_resp_anon');
select ok(not has_function_privilege('service_role', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'service_role não executa diretamente fc_iniciar_resp_anon');

select ok(not has_function_privilege('anon', 'public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'anon não executa fc_gravar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'authenticated não executa fc_gravar_resp_anon');
select ok(not has_function_privilege('service_role', 'public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'service_role não executa diretamente fc_gravar_resp_anon');

select ok(not has_function_privilege('anon', 'public.fc_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'anon não executa fc_enviar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'authenticated não executa fc_enviar_resp_anon');
select ok(not has_function_privilege('service_role', 'public.fc_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'service_role não executa diretamente fc_enviar_resp_anon');

-- ---------------------------------------------------------------------------
-- Envoltórias internas: somente service_role alcança o contrato do backend.
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.fc_srv_obter_form_anonimo(text)'::regprocedure, 'execute'), 'anon não executa fc_srv_obter_form_anonimo');
select ok(not has_function_privilege('authenticated', 'public.fc_srv_obter_form_anonimo(text)'::regprocedure, 'execute'), 'authenticated não executa fc_srv_obter_form_anonimo');
select ok(has_function_privilege('service_role', 'public.fc_srv_obter_form_anonimo(text)'::regprocedure, 'execute'), 'service_role executa fc_srv_obter_form_anonimo');

select ok(not has_function_privilege('anon', 'public.fc_srv_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'anon não executa fc_srv_iniciar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_srv_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'authenticated não executa fc_srv_iniciar_resp_anon');
select ok(has_function_privilege('service_role', 'public.fc_srv_iniciar_resp_anon(text)'::regprocedure, 'execute'), 'service_role executa fc_srv_iniciar_resp_anon');

select ok(not has_function_privilege('anon', 'public.fc_srv_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'anon não executa fc_srv_gravar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_srv_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'authenticated não executa fc_srv_gravar_resp_anon');
select ok(has_function_privilege('service_role', 'public.fc_srv_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure, 'execute'), 'service_role executa fc_srv_gravar_resp_anon');

select ok(not has_function_privilege('anon', 'public.fc_srv_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'anon não executa fc_srv_enviar_resp_anon');
select ok(not has_function_privilege('authenticated', 'public.fc_srv_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'authenticated não executa fc_srv_enviar_resp_anon');
select ok(has_function_privilege('service_role', 'public.fc_srv_enviar_resp_anon(uuid,text)'::regprocedure, 'execute'), 'service_role executa fc_srv_enviar_resp_anon');

select * from finish();
rollback;
