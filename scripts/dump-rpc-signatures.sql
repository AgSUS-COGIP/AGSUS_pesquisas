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
-- 3. `executavel` responde a outra pergunta que derruba a tela do mesmo jeito:
--    a função existe, mas o papel que deve chamá-la não tem EXECUTE.
-- 4. Funções `fc_srv_*` são entradas exclusivas do backend e são chamadas pelas
--    rotas com `createAdminSupabaseClient()`. Para elas o contrato correto é
--    `service_role`; conceder EXECUTE a `authenticated` só para satisfazer o gate
--    reabriria uma superfície que as migrations fecharam de propósito. As demais
--    RPCs continuam verificadas como `authenticated`.

select coalesce(json_agg(f order by f->>'nome'), '[]'::json)::text
from (
  select json_build_object(
           'nome', p.proname,
           'executavel', case
             when p.proname like 'fc\_srv\_%' escape '\'
               then has_function_privilege('service_role', p.oid, 'EXECUTE')
             else has_function_privilege('authenticated', p.oid, 'EXECUTE')
           end,
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
