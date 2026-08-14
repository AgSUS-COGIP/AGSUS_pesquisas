begin;

-- Limpeza de superfície legada encontrada em auditoria do banco de produção.
--
-- Duas coisas diferentes, tratadas de formas diferentes — a diferença é se
-- alguma versão publicada do frontend já chamou aquilo pelo nome.
--
-- 1. `fc_zzz_teste` — lixo, removida
-- ----------------------------------
-- `select 1`, sem `search_path` fixo, sem comentário, sem migration que a
-- criasse: foi aplicada direto no editor em algum teste e ficou. Nunca fez parte
-- de contrato nenhum, então remover não quebra bundle algum.
--
-- 2. `set_person_role` — vira ponte, não é removida
-- -------------------------------------------------
-- A documentação afirmava que ela saiu em `20260810120000`, substituída por
-- `fc_definir_perfil_pessoa`. Não saiu: continua em produção, `security definer`,
-- com a lógica **antiga** de conceder e revogar papel avulso — anterior ao modelo
-- de perfis exclusivos.
--
-- Apagá-la seria o reflexo errado. Um bundle publicado que ainda a chame passaria
-- a receber `Could not find the function … in the schema cache`, que é exatamente
-- a falha de 10/08/2026. O caminho do projeto para esse caso já está escrito:
-- manter o nome e delegar à função nova.
--
-- Como ponte, ela deixa de ter lógica própria. Some a chance de alguém conceder
-- um segundo perfil vigente por esse caminho — hoje o índice `in_perfil_unico_vigente`
-- barraria com erro de constraint, o que é proteção, mas proteção que aparece
-- como defeito para quem clicou.
--
-- `enabled => false` significa "tire este perfil da pessoa". No modelo exclusivo
-- não existe ficar sem perfil: o piso é Participante, e é para ele que a pessoa
-- volta. Traduzir assim preserva a intenção de quem chamou.
--
-- O que **não** é mexido: `set_my_avatar_choice` e `set_my_avatar_url` (nas duas
-- assinaturas) e a assinatura de quatro argumentos de `save_my_survey_answer`.
-- As três são pontes de compatibilidade deliberadas, criadas para bundles
-- antigos; removê-las é o oposto do que este arquivo defende.

drop function if exists public.fc_zzz_teste();

create or replace function public.set_person_role(
  target_person_id uuid,
  target_role_code text,
  enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  -- Ponte para `fc_definir_perfil_pessoa`, que valida Superadmin, recusa perfil
  -- inválido, encerra o vigente antes de conceder o novo e audita. Nada é
  -- revalidado aqui: duplicar as checagens é como as duas versões divergem.
  return public.fc_definir_perfil_pessoa(
    target_person_id,
    case when coalesce(enabled, true) then target_role_code else 'RESPONDENT' end
  );
end;
$$;

revoke all on function public.set_person_role(uuid, text, boolean) from public, anon;
grant execute on function public.set_person_role(uuid, text, boolean) to authenticated;

comment on function public.set_person_role(uuid, text, boolean) is
  'Ponte de compatibilidade para bundles antigos. Delega a fc_definir_perfil_pessoa; enabled=false devolve a pessoa ao piso Participante. Não use em código novo.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição anterior de set_person_role (20260807150000) traz de
--   -- volta a concessão de papel avulso, incompatível com perfis exclusivos.
--   -- fc_zzz_teste não deve ser recriada.
-- commit;
