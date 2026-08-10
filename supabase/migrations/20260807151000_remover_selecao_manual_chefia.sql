begin;

-- A chefia responsável deixa de ser escolhida manualmente pelo participante.
-- O vínculo passa a vir exclusivamente de cddi_leadership_links, alimentado
-- pela importação da base oficial (sync_cddi_manager_rows) e pelas correções
-- administrativas (set_platform_admin_leadership_link). A leitura continua por
-- get_my_cddi_identity, que já devolve a chefia vigente do vínculo.
--
-- Remover as funções de autosserviço garante a regra no banco, não apenas na
-- interface: sem elas, nenhum cliente consegue alterar a própria chefia.

drop function if exists public.search_cddi_leaders(text, text);
drop function if exists public.set_my_cddi_leader(text, uuid);

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- recriar public.search_cddi_leaders(text, text) e
--   -- public.set_my_cddi_leader(text, uuid) conforme
--   -- 20260803123000_cddi_identity_and_leader_selection.sql (linhas 59-177),
--   -- incluindo os grants de execute para authenticated.
-- commit;
