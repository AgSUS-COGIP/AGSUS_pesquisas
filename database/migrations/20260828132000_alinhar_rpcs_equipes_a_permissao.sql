begin;

-- Estas RPCs são de pessoas, equipes, lideranças, auditoria funcional e
-- respostas excepcionais. Historicamente todas chamavam
-- is_platform_administrator(), pois Superadmin era o único perfil que recebia
-- a área. Com permissões independentes, o portão correto é ADMIN_TEAMS; manter o
-- helper antigo faria a interface e o banco discordarem.
do $alinhamento$
declare
  v_funcao record;
  v_definicao text;
  v_restantes integer;
  v_nomes constant text[] := array[
    'fc_listar_auditoria_pessoa',
    'fc_listar_ciclos_lideranca_adm',
    'fc_listar_pessoas_sem_chefia',
    'fc_listar_respostas_ciclo',
    'fc_pesquisar_pessoa_admin',
    'fc_remover_resposta_pessoa',
    'list_platform_admin_leadership_links',
    'list_platform_admin_person_audit',
    'search_platform_admin_people',
    'set_platform_admin_leadership_link',
    'update_platform_admin_person'
  ]::text[];
begin
  for v_funcao in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'sigav'
      and p.proname = any(v_nomes)
      and p.prosrc like '%is_platform_administrator()%'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    v_definicao := replace(
      v_definicao,
      'sigav.is_platform_administrator()',
      'sigav.has_platform_module(''ADMIN_TEAMS'')'
    );
    v_definicao := replace(
      v_definicao,
      'is_platform_administrator()',
      'sigav.has_platform_module(''ADMIN_TEAMS'')'
    );
    execute v_definicao;
  end loop;

  select count(*)::integer
  into v_restantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'sigav'
    and p.proname = any(v_nomes)
    and p.prosrc like '%is_platform_administrator()%';

  if v_restantes <> 0 then
    raise exception 'Ainda existem % RPCs funcionais dependentes do perfil administrativo.', v_restantes;
  end if;
end;
$alinhamento$;

commit;

-- Rollback: refazer a substituição inversa somente restauraria o acoplamento
-- entre ADMIN_TEAMS e ADMIN_ACCESS; não há dado transformado nesta migration.
