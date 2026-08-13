begin;

-- 20260730200000_initial_platform_schema.sql concedeu insert/update/delete em
-- submissions, answers e answer_options à role authenticated, e as políticas de
-- RLS vigentes só verificam private.can_edit_submission() (dono + DRAFT +
-- acesso ao ciclo) — nada restringe QUAIS colunas podem ser escritas. Com isso,
-- um participante autenticado podia gravar via PostgREST direto na própria
-- submissão em rascunho e forjar answers.score (que submit_my_cddi_submission
-- agrega com avg/max para compor o resultado oficial do CDDI) ou sobrescrever o
-- answer_json técnico de CHEFIA_RESPONSAVEL, contornando as RPCs.
--
-- A escrita legítima sempre passou pelas RPCs SECURITY DEFINER
-- (start_or_resume_*, save_my_*, submit_*), que executam como dono das tabelas
-- e não dependem destes grants. O frontend não faz nenhum .from() nessas
-- tabelas, então revogar o DML direto não quebra nenhum fluxo publicado.
-- A leitura (select) permanece, governada pelas políticas de RLS existentes.
-- As políticas de insert/update/delete dessas tabelas ficam inertes (sem
-- privilégio subjacente) e são mantidas de propósito: removê-las mudaria o
-- comportamento caso algum grant volte, e o privilégio é a barreira primária.
revoke insert, update, delete on public.submissions from anon, authenticated;
revoke insert, update, delete on public.answers from anon, authenticated;
revoke insert, update, delete on public.answer_options from anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   grant insert, update, delete on public.submissions, public.answers,
--     public.answer_options to authenticated;
--   notify pgrst, 'reload schema';
-- commit;
