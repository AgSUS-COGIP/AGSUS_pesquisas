begin;

-- A opção "Avaliação anônima" existe no cadastro, mas o anonimato **não é
-- estrutural**: `submissions` guarda `participant_id`, `respondent_person_id` e
-- `subject_person_id`, e `answers` referencia a submissão. Quem administra
-- consegue percorrer essa cadeia e reidentificar quem respondeu — a plataforma
-- prometeria algo que não entrega.
--
-- Enquanto a separação entre identidade e conteúdo não existir (fase de
-- anonimato estrutural), nenhuma aplicação nova pode nascer anônima.
--
-- Estado verificado em 12/08/2026, antes deste bloqueio:
--   aplicações com anonymous = true .... 1 (PESQUISA1-1, CANCELLED)
--   submissões nessa aplicação ......... 0
--   respostas identificadas indevidamente 0
-- Ou seja: ninguém respondeu acreditando num anonimato que não foi entregue.
-- Não há dado a migrar nem incidente a tratar — a janela está limpa.
--
-- O gatilho barra o valor na origem, não só na RPC de criação: vale para
-- `create_survey_draft`, para SQL direto e para qualquer função futura. A linha
-- histórica de PESQUISA1-1 permanece intacta — o bloqueio só atua quando
-- `anonymous` passa a ser verdadeiro, nunca sobre quem já era.

create or replace function public.fc_bloquear_aplicacao_anonima()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- Só barra a transição para anônimo. Atualizar outros campos de uma
  -- aplicação que já estava marcada continua permitido, para não travar a
  -- manutenção de registros históricos.
  if new.anonymous is true
     and (tg_op = 'INSERT' or old.anonymous is distinct from true) then
    raise exception
      'O modo anônimo está temporariamente indisponível: as respostas ainda ficam vinculadas a quem respondeu. Crie a avaliação como identificada.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

revoke all on function public.fc_bloquear_aplicacao_anonima() from public, anon, authenticated, service_role;

create trigger tba_aplicacao_anonima
before insert or update of anonymous on public.survey_applications
for each row execute function public.fc_bloquear_aplicacao_anonima();

comment on function public.fc_bloquear_aplicacao_anonima() is
  'Impede novas aplicações anônimas enquanto o anonimato não for estrutural (identidade separada do conteúdo).';

notify pgrst, 'reload schema';

commit;

-- Rollback: remover na fase que entregar o anonimato estrutural.
-- begin;
--   drop trigger if exists tba_aplicacao_anonima on public.survey_applications;
--   drop function if exists public.fc_bloquear_aplicacao_anonima();
--   notify pgrst, 'reload schema';
-- commit;
