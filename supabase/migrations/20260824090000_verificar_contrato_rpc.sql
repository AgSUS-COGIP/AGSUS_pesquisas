begin;

-- Verificação de contrato: quais RPCs críticas faltam neste banco.
--
-- O problema que ela resolve
-- A aplicação e o banco são acoplados por **nome de função**. Publicar o
-- frontend antes da migration produz `PGRST202 — Could not find the function …
-- in the schema cache` na frente de quem usa, e nada no build percebe: nem
-- `typecheck`, nem `lint`, nem `test` leem SQL. Aconteceu em 10/08/2026 com
-- `get_my_platform_context` e de novo em 20/08/2026 com
-- `fc_definir_notificacao_email`.
--
-- `npm run db:rpc` já confere o inventário completo contra o banco
-- reconstruído, mas ele roda no CI, sobre migrations — não sobre o ambiente
-- **onde a aplicação vai rodar**. Esta função fecha essa lacuna: pergunta ao
-- banco real quais nomes de um contrato mínimo estão ausentes.
--
-- Dois consumidores, um contrato
--   · `/api/health/readiness` — o ambiente está compatível com esta versão?
--   · smoke test do deploy — checagem antes de promover a aplicação.
--
-- Por que devolve os nomes ausentes, e não só um booleano
-- Quem opera precisa saber **qual** função falta para agir. O nome de função é
-- informação de esquema, não segredo — e a rota pública que a consome só expõe
-- `ready` ou `degraded`, guardando o detalhe para o log.
--
-- Sem grant, como as demais `fc_srv_*`: quem chama é a rota, com service role.

create or replace function public.fc_srv_verificar_contrato_rpc(p_nomes text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_ausentes text[];
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  if p_nomes is null or cardinality(p_nomes) = 0 then
    raise exception 'Informe ao menos um nome de função.';
  end if;

  -- Teto defensivo: a lista é um contrato curto por desenho, e receber milhares
  -- de nomes indicaria uso indevido, não verificação de contrato.
  if cardinality(p_nomes) > 200 then
    raise exception 'Verifique no máximo 200 funções por chamada.';
  end if;

  -- Compara só o **nome**, não a assinatura: é o nome que o PostgREST resolve
  -- e é a ausência dele que produz PGRST202. Divergência de assinatura é outro
  -- defeito, coberto por `npm run db:rpc` contra o banco reconstruído.
  select coalesce(array_agg(n order by n), array[]::text[])
  into v_ausentes
  from unnest(p_nomes) as n
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = n
  );

  return jsonb_build_object(
    'checked', cardinality(p_nomes),
    'missing', to_jsonb(v_ausentes),
    'compatible', cardinality(v_ausentes) = 0
  );
end;
$$;

revoke all on function public.fc_srv_verificar_contrato_rpc(text[]) from public, anon, authenticated;

comment on function public.fc_srv_verificar_contrato_rpc(text[]) is
  'Service role apenas. Devolve quais das funções informadas não existem neste banco. Alimenta o readiness e o smoke test de deploy.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_srv_verificar_contrato_rpc(text[]);
--   -- O readiness volta a não distinguir "banco incompatível" de "banco fora".
-- commit;
