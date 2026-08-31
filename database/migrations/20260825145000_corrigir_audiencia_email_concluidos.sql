begin;

create or replace function public.fc_listar_audiencia_email(
  p_aplicacao uuid,
  p_situacao text default 'ALL',
  p_busca text default null,
  p_limite integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 500), 2000));
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDING', 'DRAFT', 'DONE') then
    raise exception 'Situação inválida. Use ALL, PENDING, DRAFT ou DONE.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.employee_number as "employeeNumber",
      p.institutional_email as email,
      ap.status as "participantStatus",
      d.situacao as situation,
      d.ultimo_envio as "lastEmailAt",
      d.ultimo_tipo as "lastEmailKind",
      d.ultimo_estado as "lastEmailStatus",
      (p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') as "emailValido"
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    cross join lateral (
      select
        case
          when ap.completed_at is not null
            or exists (
              select 1
              from public.submissions sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status in ('SUBMITTED', 'VALIDATED')
            ) then 'DONE'
          when exists (
              select 1
              from public.submissions sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status = 'DRAFT'
            ) then 'DRAFT'
          else 'PENDING'
        end as situacao,
        (
          select t.dt_criacao
          from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_envio,
        (
          select t.tp_email
          from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_tipo,
        (
          select t.st_envio
          from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_estado
    ) d
    where ap.application_id = p_aplicacao
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS', 'COMPLETED')
      and p.active
      and (v_situacao = 'ALL' or d.situacao = v_situacao)
      and (
        v_busca is null
        or public.unaccent_lower(p.full_name) like '%' || public.unaccent_lower(v_busca) || '%'
        or p.employee_number like '%' || v_busca || '%'
        or public.unaccent_lower(p.institutional_email) like '%' || public.unaccent_lower(v_busca) || '%'
      )
    limit v_limite
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_audiencia_email(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.fc_listar_audiencia_email(uuid, text, text, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
