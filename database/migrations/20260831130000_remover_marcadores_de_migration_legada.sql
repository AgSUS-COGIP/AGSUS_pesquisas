begin;

-- ============================================================================
-- Os 54 marcadores de migration legada saem do repositório e do histórico
-- ============================================================================
--
-- Cada um destes arquivos tinha o mesmo conteúdo: um cabeçalho de comentário
-- explicando que a versão consta no histórico de produção porque o SQL original
-- foi aplicado com um timestamp anterior ao baseline do repositório. Nenhum
-- deles tem uma linha de DDL ou DML — foram criados para que o CLI do Supabase
-- reconhecesse o histórico remoto sem reaplicar SQL.
--
-- Esse CLI não existe mais neste projeto. O histórico mora em
-- `sigav.tb_migracao` e quem aplica é `scripts/aplicar-migrations.mjs`, que já
-- resolve o mesmo caso por outro caminho: `--registrar-existentes` marca uma
-- migration como aplicada sem executar o SQL. Os 54 arquivos passaram a ser só
-- ruído — um quarto do diretório dizendo "me ignore".
--
-- POR QUE APAGAR TAMBÉM AS LINHAS DE tb_migracao. `tests/banco/schema.test.mjs`
-- compara disco e histórico com igualdade estrita, nos dois sentidos — e essa
-- checagem vale, porque é ela que pegaria alguém removendo uma migration de
-- verdade que já rodou. Apagar só os arquivos quebraria o teste; relaxá-lo para
-- permitir a remoção tiraria a guarda. Então os dois lados saem juntos, e o
-- teste continua estrito.
--
-- O QUE NÃO SE PERDE. A lista das 54 versões está aqui no próprio arquivo, e vai
-- para `sigav.audit_events` na execução. O conteúdo dos arquivos continua em
-- `git log -- database/migrations/`. Quem precisar responder "a versão X foi
-- aplicada um dia?" tem as duas fontes.
--
-- NÃO CONFUNDIR com as migrations pequenas de verdade: sete arquivos abaixo de
-- 600 bytes citam `public.`, `storage.objects` e `notify pgrst`. São históricas
-- e legítimas — ficam onde estão.

do $migration$
declare
  c_marcadores constant text[] := array[
    '20260730190536',
    '20260730191733',
    '20260730193515',
    '20260730193536',
    '20260730193555',
    '20260730193612',
    '20260730193631',
    '20260730193652',
    '20260730193706',
    '20260730193721',
    '20260730200202',
    '20260730200933',
    '20260731123027',
    '20260731135307',
    '20260731155855',
    '20260731160118',
    '20260731180850',
    '20260731180921',
    '20260731185809',
    '20260803115158',
    '20260803122559',
    '20260803133921',
    '20260803135248',
    '20260803140259',
    '20260803141501',
    '20260803145944',
    '20260803163528',
    '20260803165026',
    '20260803171628',
    '20260803172410',
    '20260803180352',
    '20260803180553',
    '20260803182204',
    '20260804141002',
    '20260804143218',
    '20260804153203',
    '20260804153210',
    '20260805140317',
    '20260805144130',
    '20260805180437',
    '20260805183414',
    '20260805185724',
    '20260805185837',
    '20260805192211',
    '20260805200305',
    '20260806121736',
    '20260806123125',
    '20260806134633',
    '20260806153318',
    '20260806153543',
    '20260806170036',
    '20260807131451',
    '20260807131627',
    '20260807141532'
  ];
  v_removidas int := 0;
  v_ausentes int := 0;
begin
  select count(*)
    into v_ausentes
    from unnest(c_marcadores) v
   where not exists (select 1 from sigav.tb_migracao m where m.co_versao = v);

  if v_ausentes = array_length(c_marcadores, 1) then
    raise notice 'nenhum marcador consta no histórico deste banco; nada a fazer.';
    return;
  end if;

  -- Registrar antes de apagar: a auditoria é o que sobra depois.
  insert into sigav.audit_events (event_type, entity_type, entity_id, before_data, metadata)
  values (
    'MIGRATION_MARKERS_REMOVED',
    'PLATFORM',
    'sigav.tb_migracao',
    jsonb_build_object(
      'versoes', to_jsonb(c_marcadores),
      'quantidade', array_length(c_marcadores, 1),
      'natureza', 'marcadores sem DDL, criados para o CLI do Supabase reconhecer histórico remoto'
    ),
    jsonb_build_object(
      'migration', '20260831130000_remover_marcadores_de_migration_legada',
      'arquivos', 'removidos de database/migrations/ no mesmo commit'
    )
  );

  delete from sigav.tb_migracao where co_versao = any(c_marcadores);
  get diagnostics v_removidas = row_count;

  raise notice '% linha(s) de marcador removida(s) do histórico; % não estavam registradas.',
    v_removidas, v_ausentes;
end;
$migration$;

commit;

-- Rollback:
-- begin;
--   insert into sigav.tb_migracao (co_versao, no_migracao, ds_hash, no_origem)
--   select item, 'marcador_legado', 'sem-hash', 'registro-historico'
--     from sigav.audit_events e,
--          jsonb_array_elements_text(e.before_data->'versoes') item
--    where e.event_type = 'MIGRATION_MARKERS_REMOVED'
--   on conflict (co_versao) do nothing;
-- commit;
--
-- Os arquivos voltam por `git checkout <commit anterior> -- database/migrations/`.
