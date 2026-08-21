begin;

-- AGS-10 e AGS-11 — funções internas deixam de ser executáveis por sessão comum.
--
-- O que estava aberto
-- Quatro funções tinham `EXECUTE` para `authenticated`, e nenhuma delas é
-- contrato do frontend:
--
--   · `fc_expirar_pesquisas_arq()` — rotina **destrutiva** que apaga avaliação
--     arquivada há mais de 30 dias. Qualquer sessão autenticada podia dispará-la
--     pela Data API, fora de qualquer tela;
--   · `fc_condicao_atendida(uuid, uuid)`, `fc_alvo_visivel(uuid, uuid)` e
--     `fc_pergunta_visivel(uuid, uuid)` — recebem **identificador de submissão**
--     e não verificam se ela pertence a quem chamou. São `SECURITY DEFINER`,
--     logo ignoram RLS: passar o UUID da submissão de outra pessoa devolvia
--     resposta sobre o formulário dela.
--
-- Por que revogar é seguro
-- Nenhuma das quatro é chamada por `supabase.rpc(...)`. Confirmei em 21/08/2026:
-- em `src/` elas aparecem apenas em comentário e documentação. No banco são
-- invocadas de **dentro** de outras funções `security definer` — por `perform`
-- (`fc_expirar_pesquisas_arq`, no arquivamento preguiçoso de
-- `20260814090000`) ou dentro do corpo (`fc_pergunta_visivel`, chamada por
-- `submit_my_survey_submission`). Função `security definer` executa como a dona,
-- e a dona dispensa `EXECUTE` do papel de quem chamou.
--
-- É o mesmo desenho que `fc_abrir_ciclos_agendados()` já usa desde
-- `20260814100000`: nenhum grant, chamada só interna.
--
-- O que **não** foi feito, e por quê
-- Não acrescentei guarda de propriedade dentro dos três helpers condicionais. O
-- relatório oferece essa alternativa para o caso de existir chamada direta
-- legítima — não existe. Acrescentar verificação de escopo a uma função que
-- deixou de ser alcançável seria código sem leitor, e mudaria o custo do motor
-- de lógica condicional, que roda por pergunta no envio.
--
-- Não converti nada para `SECURITY INVOKER`. Os três helpers são chamados de
-- dentro de funções que já resolveram a autorização; invocá-los como o chamador
-- os faria bater na RLS de `submissions` no meio da avaliação de visibilidade, e
-- o envio passaria a falhar para quem legitimamente responde.

---------------------------------------------------------------------------
-- Rotina destrutiva: só processamento interno.
---------------------------------------------------------------------------
revoke execute on function public.fc_expirar_pesquisas_arq() from public, anon, authenticated;

comment on function public.fc_expirar_pesquisas_arq() is
  'Apaga avaliação arquivada há mais de 30 dias, preservando a que teve versão publicada ou submissão. Sem grant: chamada apenas de dentro das RPCs de catálogo e operações.';

---------------------------------------------------------------------------
-- Helpers do motor de lógica condicional: só chamada interna.
---------------------------------------------------------------------------
revoke execute on function public.fc_condicao_atendida(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fc_alvo_visivel(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fc_pergunta_visivel(uuid, uuid) from public, anon, authenticated;

comment on function public.fc_pergunta_visivel(uuid, uuid) is
  'Decide se a pergunta está visível na submissão. Recebe identificador de submissão sem verificar propriedade, por isso não tem grant: é chamada de dentro de submit_my_survey_submission, que já autorizou o acesso.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   grant execute on function public.fc_expirar_pesquisas_arq() to authenticated;
--   grant execute on function public.fc_condicao_atendida(uuid, uuid) to authenticated;
--   grant execute on function public.fc_alvo_visivel(uuid, uuid) to authenticated;
--   grant execute on function public.fc_pergunta_visivel(uuid, uuid) to authenticated;
--   -- Reverter reabre a rotina destrutiva e a inferência entre submissões.
-- commit;
