begin;

-- Fila de trabalho da administração: quem participa do ciclo mas não tem chefia
-- vinculada e, por isso, fica bloqueado na etapa de identificação do CDDI.
--
-- Devolve junto o gestor que a base institucional indicava (gravado em
-- `people.metadata` pela importação) e o motivo da pendência, para que a
-- correção em /admin/equipes não seja uma busca às cegas:
--
--   MISSING_EMAIL — a base não trouxe e-mail de gestor para a pessoa
--   NOT_FOUND     — o e-mail veio, mas nenhuma pessoa ativa tem esse endereço
--   AMBIGUOUS     — mais de uma pessoa ativa responde por aquele e-mail
--   SEM_DADO      — a pessoa não constava da carga da base

-- `create or replace` não altera o tipo de retorno de uma função existente:
-- a remoção explícita mantém a migration reexecutável.
drop function if exists public.fc_listar_pessoas_sem_chefia(uuid, text, integer);

create function public.fc_listar_pessoas_sem_chefia(
  target_application_id uuid,
  target_search text default null,
  target_limit integer default 100
)
-- Devolve `jsonb` com chaves em camelCase, como as demais RPCs administrativas
-- desta tela: o frontend consome o retorno direto, sem camada de tradução.
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 100), 1), 500);
  v_result jsonb;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if not exists (select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'fullName'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'personId', person.id,
      'fullName', person.full_name,
      'employeeNumber', person.employee_number,
      'institutionalEmail', person.institutional_email,
      'jobTitle', person.job_title,
      -- A unidade fica em `metadata->>'unit'`, como em search_platform_admin_people:
      -- `organizational_unit_id` é a chave estrangeira, não o rótulo exibido.
      'organizationalUnit', nullif(btrim(coalesce(person.metadata->>'unit', '')), ''),
      'managerName', nullif(btrim(coalesce(person.metadata->>'manager_name', '')), ''),
      'managerEmail', nullif(btrim(coalesce(person.metadata->>'manager_email', '')), ''),
      'managerResolution', coalesce(nullif(btrim(coalesce(person.metadata->>'manager_resolution', '')), ''), 'SEM_DADO')
    ) as item
    from public.people as person
    where person.active
    -- Só quem participa do ciclo: a pendência de chefia só existe para quem
    -- precisa responder.
    and exists (
      select 1
      from public.application_participants as participant
      where participant.person_id = person.id
        and participant.application_id = target_application_id
    )
    and not exists (
      select 1
      from public.cddi_leadership_links as link
      where link.subordinate_person_id = person.id
        and link.application_id = target_application_id
        and link.status = 'ACTIVE'
        and link.valid_to is null
    )
    and (
      v_search = ''
      or lower(person.full_name) like '%' || v_search || '%'
      or lower(coalesce(person.employee_number, '')) like '%' || v_search || '%'
      or lower(coalesce(person.institutional_email, '')) like '%' || v_search || '%'
      or lower(coalesce(person.metadata->>'manager_email', '')) like '%' || v_search || '%'
    )
    order by person.full_name
    limit v_limit
  ) as pendentes;

  return v_result;
end;
$function$;

revoke all on function public.fc_listar_pessoas_sem_chefia(uuid, text, integer) from public, anon;
grant execute on function public.fc_listar_pessoas_sem_chefia(uuid, text, integer) to authenticated;

comment on function public.fc_listar_pessoas_sem_chefia(uuid, text, integer) is
  'Participantes do ciclo sem vínculo de chefia vigente, com o gestor indicado pela base e o motivo da pendência.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_pessoas_sem_chefia(uuid, text, integer);
--   notify pgrst, 'reload schema';
-- commit;
