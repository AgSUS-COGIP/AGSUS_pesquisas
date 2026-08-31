begin;

-- ============================================================================
-- Funções mortas e sobrecargas que resolvem para a versão errada
-- ============================================================================
--
-- Levantamento de 31/08/2026, confrontando os três arquivos de contrato
-- (`rpc-permissions.ts`, `rpc-return-shape.ts`, `rpc-json-args.ts`) com o
-- catálogo real. O contrato estava coerente — nenhuma RPC declarada faltando no
-- banco, nenhum shape errado, nenhum argumento jsonb sem registro. O que
-- apareceu foi outra coisa: função morta e sobrecarga.
--
-- POR QUE SOBRECARGA É DEFEITO AQUI, e não um recurso. O adaptador monta
-- `select * from sigav.fn(arg => $1, ...)`, e o Postgres escolhe a assinatura
-- pelo CONJUNTO de argumentos nomeados. Duas versões do mesmo nome significam
-- que uma chamada que omite um parâmetro cai em OUTRA função — sem erro, com
-- outra regra de negócio dentro. Foi assim que `tx_perfis_param` sobreviveu ao
-- fim dos perfis: a versão antiga continuou atendendo quem não passava o
-- argumento novo.
--
-- O QUE SAI, e a prova de que não quebra nada. Para cada uma: zero chamadas em
-- `src/`, zero funções de `sigav` que a citem no corpo.
--
--   set_person_role(uuid, text, boolean)
--     Ponte para `fc_definir_perfil_pessoa`, removida em
--     20260828150000_remover_perfis_legados_do_banco.sql junto das tabelas de
--     perfil. Ficou QUEBRADA: corpo de função é texto, então a chamada a uma
--     função inexistente compila e só falharia quando alguém a executasse.
--     Defeito introduzido por aquela migration e não percebido na hora.
--
--   fc_definir_presenca_plataforma(boolean, text[])
--     Sobrecarga da era dos perfis — `tx_perfis_param` escolhia quais perfis
--     veriam a presença online. Hoje isso é a permissão ONLINE_PRESENCE. A
--     aplicação chama a versão de um argumento (src/app/api/plataforma/presenca).
--
--   save_my_survey_answer(uuid, uuid, uuid, text)
--     Assinatura de quando a resposta era só opção única e texto. A versão
--     vigente tem nove argumentos (múltipla escolha, número, booleano, data,
--     jsonb) e é a que a rota de respostas usa.
--
--   set_my_avatar_choice(text, text) e (text, text, jsonb)
--     A escolha de avatar saiu da interface: a foto vem da conta Google,
--     sincronizada no login (ver src/app/perfil/tela-perfil.tsx). Nenhuma das
--     duas é chamada em lugar algum. Saem também as três entradas de contrato.
--
--   list_platform_admin_person_audit(uuid, integer)
--     Sem chamada em `src/`, sem citação em outra função e fora do allowlist —
--     ou seja, inalcançável pelo adaptador, que recusa com 42501 o que não está
--     declarado. A auditoria por pessoa que a interface usa é outra.
--
-- O QUE FICA, DE PROPÓSITO: a sobrecarga de `fc_srv_concluir_email` e de
-- `fc_concluir_email_participante` (3 e 4 argumentos). Não é resíduo, é uma
-- decisão pendente: a versão de 3 argumentos atualiza a fila sem checar nada,
-- enquanto a de 4 exige `st_envio = 'PROCESSANDO'` com token vigente e levanta
-- erro se a reivindicação expirou. O despachador ainda cai na primeira quando
-- `email.claimToken` vem vazio, o que contorna a proteção contra execução
-- concorrente. A janela de deploy que justificava esse fallback fechou em
-- 20/08 (20260820180000_claim_de_email_expira.sql), mas remover a ponte muda o
-- caminho de entrega de e-mail — decisão de quem opera, não desta limpeza. O
-- teste de sobrecarga carrega a exceção nomeada e documentada.

do $migration$
declare
  c_mortas constant text[] := array[
    'sigav.set_person_role(uuid,text,boolean)',
    'sigav.fc_definir_presenca_plataforma(boolean,text[])',
    'sigav.save_my_survey_answer(uuid,uuid,uuid,text)',
    'sigav.set_my_avatar_choice(text,text)',
    'sigav.set_my_avatar_choice(text,text,jsonb)',
    'sigav.list_platform_admin_person_audit(uuid,integer)'
  ];
  v_assinatura text;
  v_oid oid;
  v_removidas int := 0;
  v_citadores text;
begin
  foreach v_assinatura in array c_mortas loop
    -- `to_regprocedure` devolve null em vez de erro quando a função não existe,
    -- o que torna a migration idempotente sem exception handler.
    v_oid := to_regprocedure(v_assinatura);

    if v_oid is null then
      raise notice '% já não existe; nada a fazer.', v_assinatura;
      continue;
    end if;

    -- Trava. O levantamento foi feito antes, mas a instância tem escritores
    -- paralelos: se alguém passou a chamar isto no meio do caminho, é melhor
    -- falhar do que remover uma dependência viva.
    select string_agg(p.oid::regprocedure::text, ', ')
      into v_citadores
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.oid <> v_oid
       and p.prosrc ~ ('\m' || split_part(split_part(v_assinatura, '.', 2), '(', 1) || '\M');

    if v_citadores is not null then
      raise exception
        'ABORTADO: % é citada por %. Resolva a dependência antes de remover.',
        v_assinatura, v_citadores;
    end if;

    execute format('drop function %s', v_assinatura);
    v_removidas := v_removidas + 1;
    raise notice '% removida.', v_assinatura;
  end loop;

  raise notice '% função(ões) morta(s) removida(s).', v_removidas;

  -- Conferência: nenhuma função DA APLICAÇÃO pode ter sobrecarga sobrado, exceto
  -- a dupla de e-mail explicada no cabeçalho.
  --
  -- O filtro por dono não é detalhe: em `sigav` moram também as funções do
  -- pgcrypto, e elas são legitimamente sobrecarregadas (`digest`, `hmac`,
  -- `pgp_sym_encrypt`, `armor`...). Sem o filtro, esta conferência acusaria doze
  -- "problemas" que não são desta aplicação nem estão ao seu alcance.
  select string_agg(nome || ' (' || qtd || ')', ', ')
    into v_citadores
    from (
      select p.proname as nome, count(*) as qtd
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'sigav' and p.prokind = 'f'
         and p.proowner = n.nspowner
         and p.proname not in ('fc_srv_concluir_email', 'fc_concluir_email_participante')
       group by p.proname
      having count(*) > 1
    ) sobrecargas;

  if v_citadores is not null then
    raise notice 'ATENÇÃO: ainda há sobrecarga não prevista: %', v_citadores;
  else
    raise notice 'nenhuma sobrecarga além da dupla de e-mail documentada.';
  end if;
end;
$migration$;

commit;

-- Rollback: recriar qualquer uma destas seria recriar código morto. A definição
-- de cada uma está nas migrations que as criaram, alcançáveis pelo histórico:
--   set_person_role                     -> 20260807150000_simplificar_modelo_papeis.sql
--   fc_definir_presenca_plataforma/2    -> 20260819135306_configurar_presenca_online.sql
--   save_my_survey_answer/4             -> 20260803105500_generic_survey_runtime_and_catalog.sql
--   set_my_avatar_choice                -> 20260804174641_personalized_avatar_config.sql
--   list_platform_admin_person_audit    -> 20260805133500_admin_people_teams_foundation.sql
-- `set_person_role` não pode ser recriada como estava: a função para a qual ela
-- fazia ponte não existe mais.
