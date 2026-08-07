begin;

-- A chefia responsável é um vínculo institucional. A resposta técnica mantém
-- o contrato da versão publicada sem exigir digitação manual no formulário.
create or replace function public.sync_cddi_leader_technical_answer(
  target_application_id uuid,
  target_subordinate_person_id uuid,
  target_leader_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_question_id uuid;
begin
  select question.id
    into v_question_id
  from public.survey_applications application
  join public.survey_questions question
    on question.survey_version_id = application.survey_version_id
  where application.id = target_application_id
    and question.code = 'CHEFIA_RESPONSAVEL'
    and question.question_type = 'PERSON'
  order by question.position
  limit 1;

  if v_question_id is null then
    return;
  end if;

  insert into public.answers (
    submission_id,
    question_id,
    answer_json,
    updated_at
  )
  select
    submission.id,
    v_question_id,
    jsonb_build_object(
      'personId', target_leader_person_id,
      'source', 'cddi_leadership_links'
    ),
    timezone('utc', now())
  from public.submissions submission
  where submission.application_id = target_application_id
    and submission.subject_person_id = target_subordinate_person_id
    and submission.submission_type in ('AUTO', 'CHEFIA')
    and submission.status = 'DRAFT'
  on conflict (submission_id, question_id) do update
    set answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = excluded.answer_json,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.sync_new_cddi_submission_leader_answer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_leader_person_id uuid;
begin
  if new.submission_type not in ('AUTO', 'CHEFIA') or new.status <> 'DRAFT' then
    return new;
  end if;

  select link.leader_person_id
    into v_leader_person_id
  from public.cddi_leadership_links link
  where link.application_id = new.application_id
    and link.subordinate_person_id = new.subject_person_id
    and link.status = 'ACTIVE'
    and link.valid_from <= now()
    and (link.valid_to is null or link.valid_to > now())
  order by link.valid_from desc, link.created_at desc
  limit 1;

  if v_leader_person_id is not null then
    perform public.sync_cddi_leader_technical_answer(
      new.application_id,
      new.subject_person_id,
      v_leader_person_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_sync_cddi_leader_answer
  on public.submissions;

create trigger submissions_sync_cddi_leader_answer
after insert on public.submissions
for each row
execute function public.sync_new_cddi_submission_leader_answer();

-- Repara rascunhos já abertos, incluindo o fluxo de avaliação pela chefia.
do $$
declare
  link record;
begin
  for link in
    select application_id, subordinate_person_id, leader_person_id
    from public.cddi_leadership_links
    where status = 'ACTIVE'
      and valid_from <= now()
      and (valid_to is null or valid_to > now())
  loop
    perform public.sync_cddi_leader_technical_answer(
      link.application_id,
      link.subordinate_person_id,
      link.leader_person_id
    );
  end loop;
end;
$$;

revoke all on function public.sync_cddi_leader_technical_answer(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.sync_new_cddi_submission_leader_answer()
  from public, anon, authenticated;

comment on function public.sync_new_cddi_submission_leader_answer() is
  'Registra automaticamente a chefia institucional em novos rascunhos CDDI.';

notify pgrst, 'reload schema';
commit;
