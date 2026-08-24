-- Assinaturas das funções de `public`, como o PostgREST as enxerga.
--
-- Sai uma linha só, com um JSON, para `validate-rpc-contracts.mjs` comparar
-- com as chamadas `supabase.rpc(...)` do frontend. Use com `psql -t -A`.
--
-- Quatro detalhes que mudam o resultado:
--
-- 1. `proargnames` inclui os parâmetros de saída de função que devolve tabela.
--    Só entram aqui os de entrada (`i`, `b`, `v`) — passar o nome de um OUT
--    numa chamada não resolve overload nenhum.
-- 2. `pronargdefaults` conta os defaults a partir do fim. Os primeiros
--    `total - pronargdefaults` parâmetros são obrigatórios; os demais, opcionais.
-- 3. As permissões são registradas por papel. Rotas autenticadas usam
--    `authenticated`; as poucas rotas de infraestrutura que criam o cliente
--    administrativo usam `service_role`. Misturar os dois produziria falso
--    positivo ou, pior, deixaria de cobrar o grant realmente usado em runtime.
-- 4. Funções `fc_srv_*` são entradas exclusivas do backend, chamadas pelas
--    rotas com `createAdminSupabaseClient()` — para elas o contrato correto é
--    `service_role`. Conceder EXECUTE a `authenticated` só para satisfazer o
--    gate reabriria uma superfície que as migrations fecharam de propósito.

select coalesce(json_agg(f order by f->>'nome'), '[]'::json)::text
from (
  select json_build_object(
           'nome', p.proname,
           'executavel_authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
           'executavel_service_role', has_function_privilege('service_role', p.oid, 'EXECUTE'),
           'parametros', coalesce(a.nomes, '[]'::json),
           'obrigatorios', coalesce(a.obrigatorios, '[]'::json)
         ) as f
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral (
    select json_agg(s.nome order by s.pos) as nomes,
           json_agg(s.nome order by s.pos)
             filter (where s.pos <= s.total - p.pronargdefaults) as obrigatorios
    from (
      select u.nome,
             row_number() over (order by u.ord) as pos,
             count(*) over () as total
      from unnest(p.proargnames) with ordinality as u(nome, ord)
      where p.proargmodes is null or p.proargmodes[u.ord] in ('i', 'b', 'v')
    ) s
  ) a on true
  where n.nspname = 'public'
    and p.prokind = 'f'
) t;
