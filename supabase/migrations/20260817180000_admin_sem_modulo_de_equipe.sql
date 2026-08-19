begin;

-- O perfil Admin deixa de receber o módulo `TEAM`.
--
-- Por quê
-- "Minha equipe" (`/equipe`) serve a quem lidera pessoas: a tela lista os
-- ciclos em que a pessoa tem vínculo ativo de chefia e permite avaliar quem
-- está sob ela. Isso é atributo de **dado** — `cddi_leadership_links` —, não de
-- perfil. O Admin descreve quem opera as avaliações, não quem chefia alguém.
--
-- O levantamento na base confirmou:
--
--     Avaliador     114 pessoas, 114 lideram equipe
--     Admin           3 pessoas,   0 lideram equipe
--     Superadmin      2 pessoas,   1 lidera equipe
--     Participante    1 pessoa,    0 lideram equipe
--
-- Para os três Admins a tela só existia para abrir vazia. Avaliador mantém o
-- módulo, e Superadmin o mantém por ter todos.
--
-- Os dois mapas precisam concordar
-- O mapa de módulos vive em dois lugares: o `case` desta função, que é a
-- autoridade declarada no banco, e `ROLE_MODULES` em
-- `src/lib/platform-modules.ts`, que a interface usa. Hoje a guarda do
-- frontend recalcula os módulos a partir dos papéis e não consome o array que
-- esta função devolve — mas divergir os dois deixaria o banco afirmando uma
-- coisa e a tela outra, e a próxima pessoa a ler o `case` concluiria o
-- contrário do que acontece. A alteração aqui acompanha a de lá.
--
-- A ressalva
-- Um Admin que **venha** a liderar equipe perde o caminho para avaliá-la.
-- Enquanto isso não acontecer o custo é zero; quando acontecer, o certo não é
-- devolver `TEAM` ao perfil, e sim conceder o módulo a quem lidera de fato.
--
-- Vale notar que isso exigiria mais do que parece: `isLeader`, no retorno desta
-- função, **não** consulta `cddi_leadership_links` — é `(v_role = 'LEADER')`,
-- ou seja, o próprio perfil com outro nome. Conceder por liderança real pede
-- uma consulta nova aos vínculos, e de quebra corrigiria o Superadmin que
-- lidera equipe e hoje recebe `isLeader` falso. Fica anotado, fora do escopo
-- desta migration.
--
-- A assinatura não muda: a função não tem parâmetros e continua sem. O que muda
-- é um elemento de um array no retorno.

CREATE OR REPLACE FUNCTION public.fc_obter_contexto_plataforma()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_person public.people%rowtype;
  v_roles text[] := array[]::text[];
  v_role text;
  v_modules text[] := array[]::text[];
  v_participant public.application_participants%rowtype;
  v_application public.survey_applications%rowtype;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from public.people
  where auth_user_id = auth.uid()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object('status', 'UNLINKED', 'message', 'Conta autenticada sem cadastro institucional ativo.');
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_roles
  from public.person_role_assignments pra
  join public.system_roles sr on sr.id = pra.role_id
  where pra.person_id = v_person.id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  -- Perfil efetivo: o de maior privilégio entre os vigentes. Sem papel
  -- reconhecido, o efetivo é Participante — o piso do modelo.
  v_role := case
    when 'ADMINISTRATOR' = any(v_roles) then 'ADMINISTRATOR'
    when 'SURVEY_MANAGER' = any(v_roles) then 'SURVEY_MANAGER'
    when 'LEADER' = any(v_roles) then 'LEADER'
    else 'RESPONDENT'
  end;

  v_modules := case v_role
    when 'ADMINISTRATOR' then array[
      'HOME','SURVEYS','DASHBOARDS','TEAM',
      'ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_ACCESS','ADMIN_IMPORT'
    ]
    when 'SURVEY_MANAGER' then array[
      'HOME','SURVEYS','DASHBOARDS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS'
    ]
    when 'LEADER' then array['HOME','SURVEYS','TEAM']
    else array['SURVEYS']
  end;

  select ap.id into v_participant_id
  from public.application_participants ap
  join public.survey_applications sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and ap.status not in ('REMOVED','INELIGIBLE')
  order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant
    from public.application_participants
    where id = v_participant_id;

    select * into v_application
    from public.survey_applications
    where id = v_participant.application_id;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'person', jsonb_build_object(
      'id', v_person.id,
      'employeeNumber', v_person.employee_number,
      'fullName', v_person.full_name,
      'institutionalEmail', v_person.institutional_email,
      'jobTitle', v_person.job_title,
      'costCenter', v_person.cost_center,
      'workplace', v_person.workplace,
      'metadata', coalesce(v_person.metadata, '{}'::jsonb),
      'avatarUrl', v_person.metadata->>'avatar_url'
    ),
    'participant', case when v_participant.id is null then null else jsonb_build_object(
      'id', v_participant.id,
      'status', v_participant.status,
      'accessProfile', v_participant.access_profile,
      'completedAt', v_participant.completed_at,
      'metadata', coalesce(v_participant.metadata, '{}'::jsonb)
    ) end,
    'application', case when v_application.id is null then null else jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ) end,
    'isLeader', (v_role = 'LEADER'),
    'roles', to_jsonb(array[v_role]),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', public.can_manage_surveys()
  );
end;
$function$;


revoke all on function public.fc_obter_contexto_plataforma() from public, anon;
grant execute on function public.fc_obter_contexto_plataforma() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Devolver 'TEAM' ao array de SURVEY_MANAGER, e reverter ADMIN_ROLE_MODULES
--   -- em src/lib/platform-modules.ts junto: os dois mapas precisam concordar.
--   notify pgrst, 'reload schema';
-- commit;
