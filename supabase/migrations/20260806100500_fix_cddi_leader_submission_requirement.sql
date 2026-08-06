begin;

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
  select q.id
    into v_question_id
  from public.survey_applications app
  join public.survey_questions q
    on q.survey_version_id = app.survey_version_id
  where app.id = target_application_id
    and q.code = 'CHEFIA_RESPONSAVEL'
    and q.question_type = 'PERSON'
  order by q.position
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
    and submission.submission_type = 'AUTO'
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

create or replace function public.handle_cddi_leadership_answer_sync()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.status = 'ACTIVE'
     and new.valid_from <= now()
     and (new.valid_to is null or new.valid_to > now()) then
    perform public.sync_cddi_leader_technical_answer(
      new.application_id,
      new.subordinate_person_id,
      new.leader_person_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists cddi_leadership_answer_sync
  on public.cddi_leadership_links;

create trigger cddi_leadership_answer_sync
after insert or update of leader_person_id, status, valid_from, valid_to
on public.cddi_leadership_links
for each row
execute function public.handle_cddi_leadership_answer_sync();

-- Repara rascunhos existentes sem alterar a estrutura publicada da pesquisa.
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
revoke all on function public.handle_cddi_leadership_answer_sync()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
