begin;

-- Fecha a execução por `anon` nas duas RPCs do runtime genérico que gravam e
-- enviam respostas.
--
-- O PostgreSQL concede `execute` a `public` por padrão, e `anon` herda de
-- `public`. `20260803133300_harden_rpc_permissions.sql` revogou isso em massa,
-- mas o bloco `do $$` rodou uma vez só, sobre as funções que existiam naquele
-- momento. `save_my_survey_answer` e `submit_my_survey_submission` foram
-- redefinidas depois, em `20260803165000_harden_runtime_integrity_and_performance.sql`,
-- sem `revoke` próprio — então num banco reconstruído do zero elas nascem
-- chamáveis por quem sequer se autenticou.
--
-- Em produção o problema não se manifesta, porque revogações foram aplicadas
-- por SQL direto ao longo do tempo. Foi o teste de RLS efetiva, rodando sobre
-- `supabase db reset`, que revelou a diferença entre o banco real e o que o
-- repositório descreve.
--
-- A guarda dentro das funções continua sendo a defesa principal: ambas validam
-- `auth.uid()` e a titularidade da submissão. Este arquivo remove a porta antes
-- da fechadura.

-- As assinaturas divergem entre ambientes: produção ainda carrega a versão de
-- quatro argumentos de `save_my_survey_answer`, substituída pela de nove e
-- nunca removida, enquanto um banco reconstruído só conhece a atual. Listar as
-- assinaturas à mão quebraria em um dos dois lados, então o laço percorre as
-- sobrecargas que existirem — e o arquivo vale nos dois.
do $$
declare
  rotina record;
begin
  for rotina in
    select proc.oid::regprocedure as assinatura
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in ('save_my_survey_answer', 'submit_my_survey_submission')
  loop
    execute format('revoke all on function %s from public, anon', rotina.assinatura);
    execute format('grant execute on function %s to authenticated', rotina.assinatura);
  end loop;
end;
$$;

commit;

-- Rollback: reconceder a `public` reabriria a execução para `anon`. Se for mesmo
-- necessário desfazer, conceda explicitamente a `authenticated` e mantenha `anon` fora.
-- begin;
--   grant execute on function public.submit_my_survey_submission(uuid) to authenticated;
-- commit;
