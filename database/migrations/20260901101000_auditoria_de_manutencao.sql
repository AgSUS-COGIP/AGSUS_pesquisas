-- Auditoria da manutenção operacional.
--
-- ## O que esta migration não faz
--
-- Nenhuma tabela, nenhum schema, nenhuma coluna. O estado de manutenção mora
-- fora do PostgreSQL, porque ele precisa ser legível justamente quando o
-- PostgreSQL não estiver — guardá-lo aqui faria a informação sumir na hora em
-- que ela é necessária.
--
-- O que fica aqui é o **registro** da mudança, e `sigav."TL_EVENTO_AUDITORIA"` já tem
-- todos os campos: ator, tipo de evento, entidade, estado anterior, estado
-- posterior e metadados livres. Criar uma tabela de histórico de manutenção
-- seria um segundo diário de bordo, que divergiria do primeiro.
--
-- ## Por que uma função, e não um insert direto
--
-- `TL_EVENTO_AUDITORIA` não aceita escrita direta da aplicação — e não deve aceitar,
-- senão qualquer sessão poderia forjar registro de auditoria. A função é
-- `security definer` e confere o papel dentro do banco, de modo que a
-- autorização não depende de a aplicação ter lembrado de conferir.
--
-- ## Consequência aceita
--
-- Se a manutenção for alterada direto pelo painel da Vercel durante uma
-- emergência com o banco fora, essa mudança não terá registro aqui — não há
-- onde escrever. Fila ou tabela de pendências para cobrir esse caso seria
-- estrutura nova para um cenário de exceção, e fica de fora.

create or replace function sigav."FC_REGISTRAR_MANUT_AUDITORIA"(
  p_evento text,
  p_motivo text,
  p_estado_anterior jsonb,
  p_estado_posterior jsonb,
  p_modulos text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav'
as $function$
declare
  v_ator uuid := sigav."FC_PESSOA_SESSAO"();
  v_id bigint;
begin
  -- A autorização é conferida aqui, e não só na rota: a rota é uma cortesia
  -- para dar erro cedo, esta é a garantia.
  if not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Apenas a administração da plataforma pode registrar manutenção.'
      using errcode = '42501';
  end if;

  -- Lista fechada de propósito. Evento livre transformaria a auditoria num
  -- campo de texto onde cada chamada inventa o próprio vocabulário, e nenhuma
  -- consulta posterior conseguiria agrupar.
  if p_evento not in (
    'PLATFORM_MAINTENANCE_ENABLED',
    'PLATFORM_MAINTENANCE_DISABLED',
    'MODULE_MAINTENANCE_ENABLED',
    'MODULE_MAINTENANCE_DISABLED'
  ) then
    raise exception 'Evento de manutenção desconhecido: %', p_evento
      using errcode = '22023';
  end if;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_ator,
    p_evento,
    'PLATFORM_MAINTENANCE',
    'maintenance',
    p_estado_anterior,
    p_estado_posterior,
    jsonb_build_object(
      'reason', coalesce(p_motivo, ''),
      'modules', to_jsonb(coalesce(p_modulos, '{}'::text[])),
      -- Qual store recebeu a escrita. Sem isto, auditoria de Preview e de
      -- Production ficam indistinguíveis no mesmo banco.
      'source', 'SIGAV_ADMIN'
    )
  )
  returning "SQ_EVENTO" into v_id;

  return jsonb_build_object('status', 'OK', 'id', v_id);
end;
$function$;

-- `20260803133300` aplicou a revogação em massa num bloco `do $$` executado uma
-- única vez: função criada depois dele precisa repetir os grants à mão, senão
-- nasce executável por `public` e `anon`.
revoke all on function sigav."FC_REGISTRAR_MANUT_AUDITORIA"(text, text, jsonb, jsonb, text[]) from public;

-- Rollback:
-- begin;
--   drop function if exists sigav."FC_REGISTRAR_MANUT_AUDITORIA"(text, text, jsonb, jsonb, text[]);
-- commit;
