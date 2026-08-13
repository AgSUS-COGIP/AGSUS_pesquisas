begin;

-- Remove a unicidade de `surveys.code`.
--
-- O código institucional era `unique` desde o esquema inicial
-- (20260730200000), mas nenhuma rota ou RPC de resposta o usa como chave: o
-- runtime público (`get_public_survey_form`, catálogo, painéis) identifica o
-- ciclo por `survey_applications.code`, não por `surveys.code`. A unicidade
-- só servia para exibição no catálogo administrativo, e criava um efeito
-- colateral indesejado: reaproveitar um código de rascunho já usado (comum em
-- testes e em avaliações recorrentes por ano) falhava com erro de constraint
-- do Postgres, sem explicação legível na tela — a criação parecia travada.
--
-- O identificador único de verdade já existe e não muda: `surveys.id` (uuid).
-- `code` passa a ser só um rótulo institucional, repetível entre pesquisas
-- diferentes, com as mesmas regras de formato (`not null`, não vazio).
--
-- O nome da constraint é descoberto em tempo de execução porque foi criada
-- de forma implícita (`code text not null unique`), e o Postgres nomeia esse
-- tipo de constraint automaticamente — não há garantia de que o nome seja
-- literalmente `surveys_code_key` em todo ambiente.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.surveys'::regclass
    and contype = 'u'
    and conkey = (
      select array_agg(attnum)
      from pg_attribute
      where attrelid = 'public.surveys'::regclass
        and attname = 'code'
    );

  if v_constraint is not null then
    execute format('alter table public.surveys drop constraint %I', v_constraint);
  end if;
end $$;

commit;

-- Rollback:
-- begin;
--   -- Restaura a unicidade. Só é seguro reaplicar se, entre a aplicação desta
--   -- migration e o rollback, nenhum código repetido tiver sido gravado —
--   -- confira antes com:
--   --   select code, count(*) from public.surveys group by code having count(*) > 1;
--   alter table public.surveys add constraint surveys_code_key unique (code);
-- commit;
