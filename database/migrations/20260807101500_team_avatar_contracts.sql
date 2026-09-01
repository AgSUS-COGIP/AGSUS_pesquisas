begin;

create or replace function public.fc_obter_minha_equipe(
  target_application_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_workspace jsonb;
  v_members jsonb;
begin
  v_workspace := public.get_my_team_workspace(target_application_code);

  select coalesce(
    jsonb_agg(
      member || jsonb_build_object(
        'avatarUrl', nullif(btrim(coalesce(person.metadata->>'avatar_url', '')), '')
      )
      order by member->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_members
  from jsonb_array_elements(coalesce(v_workspace->'members', '[]'::jsonb)) member
  left join public.people person on person.id = (member->>'personId')::uuid;

  return jsonb_set(v_workspace, '{members}', v_members, true);
end;
$$;

create or replace function public.fc_pesquisar_equipe(
  target_application_id uuid,
  search_term text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_candidates jsonb;
  v_result jsonb;
begin
  v_candidates := public.search_team_candidates(target_application_id, search_term);

  select coalesce(
    jsonb_agg(
      candidate || jsonb_build_object(
        'avatarUrl', nullif(btrim(coalesce(person.metadata->>'avatar_url', '')), '')
      )
      order by candidate->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_result
  from jsonb_array_elements(coalesce(v_candidates, '[]'::jsonb)) candidate
  left join public.people person on person.id = (candidate->>'personId')::uuid;

  return v_result;
end;
$$;

revoke all on function public.fc_obter_minha_equipe(text) from public;
revoke all on function public.fc_pesquisar_equipe(uuid, text) from public;
grant execute on function public.fc_obter_minha_equipe(text) to authenticated;
grant execute on function public.fc_pesquisar_equipe(uuid, text) to authenticated;

comment on function public.fc_obter_minha_equipe(text) is
  'Retorna a área da liderança com a identidade visual vigente de cada integrante.';
comment on function public.fc_pesquisar_equipe(uuid, text) is
  'Pesquisa pessoas elegíveis incluindo a identidade visual vigente.';

commit;
