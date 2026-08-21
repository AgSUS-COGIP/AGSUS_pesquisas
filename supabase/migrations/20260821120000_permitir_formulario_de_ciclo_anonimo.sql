begin;

-- A definição do formulário ainda passava por `can_access_application()`,
-- que exige uma pessoa autenticada. Em ciclo anônimo o acesso ao instrumento
-- é deliberadamente público; respostas e rascunhos continuam protegidos pelas
-- RPCs de sessão efêmera, não por esse SELECT de definição.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_public_survey_form(text)'::regprocedure) into v_definition;
  v_definition := replace(
    v_definition,
    'and public.can_access_application(sa.id)',
    'and (sa.anonymous or public.can_access_application(sa.id))'
  );
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
