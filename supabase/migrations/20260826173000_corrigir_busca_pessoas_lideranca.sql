begin;

-- A busca administrativa de pessoas era literal: "Joao Costa" nao encontrava
-- "Joao Armandes Vieira Costa" e nomes digitados sem acento deixavam de
-- aparecer. Mantemos o mesmo contrato da RPC, mas normalizamos acentos e
-- exigimos que cada termo digitado exista em algum dos campos pesquisaveis.
create or replace function public.fc_pesquisar_pessoa_admin(
  target_search text default null,
  target_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := btrim(coalesce(target_search, ''));
  v_limit integer := least(greatest(coalesce(target_limit, 80), 1), 250);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'personId', p.id,
          'employeeNumber', p.employee_number,
          'fullName', p.full_name,
          'institutionalEmail', p.institutional_email,
          'jobTitle', p.job_title,
          'costCenter', p.cost_center,
          'workplace', p.workplace,
          'directorate', nullif(btrim(coalesce(p.metadata->>'directorate', '')), ''),
          'organizationalUnit', nullif(btrim(coalesce(p.metadata->>'unit', '')), ''),
          'coordination', nullif(btrim(coalesce(p.metadata->>'coordination', '')), ''),
          'employmentStatus', p.employment_status,
          'active', p.active,
          'updatedAt', p.updated_at
        )
        order by p.active desc, p.full_name
      ),
      '[]'::jsonb
    )
    from (
      select candidate.*
      from public.people candidate
      where v_search = ''
        or not exists (
          select 1
          from unnest(
            regexp_split_to_array(
              translate(
                lower(v_search),
                'áàãâäéèêëíìîïóòõôöúùûüç',
                'aaaaaeeeeiiiiooooouuuuc'
              ),
              E'\\s+'
            )
          ) as term
          where term <> ''
            and translate(
              lower(concat_ws(
                ' ',
                candidate.full_name,
                candidate.employee_number,
                candidate.institutional_email,
                candidate.job_title,
                candidate.cost_center,
                candidate.workplace,
                candidate.metadata->>'directorate',
                candidate.metadata->>'unit',
                candidate.metadata->>'coordination'
              )),
              'áàãâäéèêëíìîïóòõôöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'
            ) not like '%' || term || '%'
        )
      order by candidate.active desc, candidate.full_name
      limit v_limit
    ) p
  );
end;
$function$;

revoke all on function public.fc_pesquisar_pessoa_admin(text, integer) from public, anon;
grant execute on function public.fc_pesquisar_pessoa_admin(text, integer) to authenticated;

comment on function public.fc_pesquisar_pessoa_admin(text, integer) is
  'Busca administrativa de pessoas por termos independentes, tolerante a acentos, preservando o contrato existente.';

commit;
