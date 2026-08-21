begin;

-- A primeira versão publicada usou nomes provisórios. Bancos que já a
-- receberam são migrados para a convenção `fc_`; num banco reconstruído, as
-- funções já nascem com esses nomes na migration anterior.
do $migration$
begin
  if to_regprocedure('public.get_public_anonymous_survey_form(text)') is not null then
    alter function public.get_public_anonymous_survey_form(text) rename to fc_obter_form_anonimo;
  end if;
  if to_regprocedure('public.start_public_anonymous_survey_submission(text)') is not null then
    alter function public.start_public_anonymous_survey_submission(text) rename to fc_iniciar_resp_anon;
  end if;
  if to_regprocedure('public.save_public_anonymous_survey_answer(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamp with time zone,jsonb)') is not null then
    alter function public.save_public_anonymous_survey_answer(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb) rename to fc_gravar_resp_anon;
  end if;
  if to_regprocedure('public.submit_public_anonymous_survey_submission(uuid,text)') is not null then
    alter function public.submit_public_anonymous_survey_submission(uuid,text) rename to fc_enviar_resp_anon;
  end if;
end;
$migration$;

-- `get_public_survey_form` materializa a abertura de ciclos agendados. A
-- envoltória pública não pode ser STABLE, pois PostgreSQL executa funções
-- STABLE em transação somente de leitura e bloqueia essa materialização.
alter function public.fc_obter_form_anonimo(text) volatile;

notify pgrst, 'reload schema';
commit;
