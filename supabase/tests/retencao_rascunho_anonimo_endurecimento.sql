-- Regressões de segurança/performance do endurecimento da retenção anônima.

begin;

select plan(6);

select ok(
  position('participant_id is null' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_expirar_rascunhos_anonimos()'::regprocedure
  ))) > 0,
  'a expiração exige ausência de participant_id'
);

select ok(
  position('respondent_person_id is null' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_expirar_rascunhos_anonimos()'::regprocedure
  ))) > 0,
  'a expiração exige ausência de respondent_person_id'
);

select ok(
  position('subject_person_id is null' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_expirar_rascunhos_anonimos()'::regprocedure
  ))) > 0,
  'a expiração exige ausência de subject_person_id'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'submissions'
      and indexname = 'in_sub_anon_rasc_updated'
  ),
  'há índice dedicado à varredura de retenção anônima'
);

select ok(
  position('auth.jwt()' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_srv_expirar_rascunhos_anon()'::regprocedure
  ))) > 0,
  'o invólucro valida a claim do JWT em defesa em profundidade'
);

select ok(
  position('coalesce(auth.role()' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_srv_expirar_rascunhos_anon()'::regprocedure
  ))) = 0,
  'ausência de auth.role não é tratada implicitamente como service_role'
);

select * from finish();
rollback;
