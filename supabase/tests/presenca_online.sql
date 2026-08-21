-- Presença online: grants, RLS e comportamento dos dois portões.

begin;

select plan(16);

-- ---------------------------------------------------------------------------
-- Superfície de segurança.
-- ---------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.tb_presenca_online'::regclass),
  'tb_presenca_online mantém RLS habilitada'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'tb_presenca_online'
      and grantee in ('anon', 'authenticated')
  ),
  0,
  'anon e authenticated não acessam a tabela diretamente'
);

select ok(
  not has_function_privilege('anon', 'public.fc_registrar_presenca()'::regprocedure, 'execute'),
  'anon não executa a batida de presença'
);

select ok(
  not has_function_privilege('anon', 'public.fc_listar_presenca_online()'::regprocedure, 'execute'),
  'anon não executa a listagem de presença'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_registrar_presenca()'::regprocedure, 'execute'),
  'authenticated pode registrar a própria presença pela RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_listar_presenca_online()'::regprocedure, 'execute'),
  'authenticated pode alcançar a RPC, que aplica o portão de visualização'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in ('fc_registrar_presenca', 'fc_listar_presenca_online')
      and proc.prosecdef
      and exists (
        select 1
        from unnest(coalesce(proc.proconfig, array[]::text[])) config
        where config like 'search_path=%'
      )
  ),
  2,
  'as duas RPCs são security definer com search_path fixo'
);

select ok(
  lower(pg_catalog.pg_get_functiondef('public.fc_listar_presenca_online()'::regprocedure))
    like '%order by pr.dt_visto_em desc, p.full_name, p.id%limit 200%',
  'o limite de 200 escolhe primeiro as batidas mais recentes de forma determinística'
);

-- ---------------------------------------------------------------------------
-- Duas identidades: uma pessoa responde e registra; outra administra e lê.
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  (
    '00000000-0000-4000-8000-00000000e001',
    'authenticated', 'authenticated',
    'presenca-viewer@agenciasus.org.br', now(), now()
  ),
  (
    '00000000-0000-4000-8000-00000000e002',
    'authenticated', 'authenticated',
    'presenca-tracker@agenciasus.org.br', now(), now()
  );

insert into public.people (
  id, auth_user_id, employee_number, full_name, institutional_email
) values
  (
    '00000000-0000-4000-8000-00000000e003',
    '00000000-0000-4000-8000-00000000e001',
    'TESTE-PRESENCA-VIEWER',
    'Visualizador de Presença',
    'presenca-viewer@agenciasus.org.br'
  ),
  (
    '00000000-0000-4000-8000-00000000e004',
    '00000000-0000-4000-8000-00000000e002',
    'TESTE-PRESENCA-TRACKER',
    'Participante com Plataforma Aberta',
    'presenca-tracker@agenciasus.org.br'
  );

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e003', id
from public.system_roles where code = 'ADMINISTRATOR';

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e004', id
from public.system_roles where code = 'RESPONDENT';

-- A lista é reservada ao administrador; a pessoa participante ainda pode bater.
update public.tb_config_plataforma
set fl_presenca_online_ativa = false,
    tx_perfis_visualizacao_presenca = array['ADMINISTRATOR']::text[]
where co_configuracao = 1;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e002","role":"authenticated"}',
  true
);

select is(
  public.fc_registrar_presenca()->>'status',
  'DISABLED',
  'presença desligada devolve DISABLED, sem tratar configuração como erro'
);

select is(
  (select count(*)::integer from public.tb_presenca_online where sq_pessoa = '00000000-0000-4000-8000-00000000e004'),
  0,
  'presença desligada não grava batida'
);

update public.tb_config_plataforma
set fl_presenca_online_ativa = true
where co_configuracao = 1;

select is(
  public.fc_registrar_presenca()->>'status',
  'OK',
  'participante autenticado registra a própria presença quando o recurso está ligado'
);

select is(
  (select count(*)::integer from public.tb_presenca_online where sq_pessoa = '00000000-0000-4000-8000-00000000e004'),
  1,
  'a batida mantém uma única linha para a pessoa'
);

select throws_ok(
  'select public.fc_listar_presenca_online()',
  'Acesso restrito aos perfis configurados para ver a presença.',
  'quem pode registrar não recebe automaticamente permissão para ver a lista'
);

-- Troca para a sessão administrativa autorizada a visualizar.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}',
  true
);

select is(
  (select jsonb_array_length(public.fc_listar_presenca_online())),
  1,
  'perfil autorizado vê a pessoa com batida recente'
);

update public.tb_presenca_online
set dt_visto_em = timezone('utc', now()) - interval '3 minutes'
where sq_pessoa = '00000000-0000-4000-8000-00000000e004';

select is(
  (select jsonb_array_length(public.fc_listar_presenca_online())),
  0,
  'batida fora da janela de dois minutos não aparece'
);

update public.tb_presenca_online
set dt_visto_em = timezone('utc', now())
where sq_pessoa = '00000000-0000-4000-8000-00000000e004';

update public.people
set active = false
where id = '00000000-0000-4000-8000-00000000e004';

select is(
  (select jsonb_array_length(public.fc_listar_presenca_online())),
  0,
  'pessoa inativa não aparece mesmo com batida recente'
);

select * from finish();
rollback;
