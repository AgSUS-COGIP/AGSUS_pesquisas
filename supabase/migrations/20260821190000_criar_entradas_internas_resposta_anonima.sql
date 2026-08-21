begin;

-- Entradas exclusivas do backend para a jornada pública. Objetos novos evitam
-- herdar ACLs inconsistentes das RPCs que já existiam em bancos atualizados em
-- momentos diferentes. As funções de domínio continuam sendo a única fonte da
-- regra e são chamadas sob o proprietário destas envoltórias.
create or replace function public.fc_srv_obter_form_anonimo(target_application_code text)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_obter_form_anonimo(target_application_code);
$$;

create or replace function public.fc_srv_iniciar_resp_anon(target_application_code text)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_iniciar_resp_anon(target_application_code);
$$;

create or replace function public.fc_srv_gravar_resp_anon(
  target_submission_id uuid,
  target_session_token text,
  target_question_id uuid,
  target_option_ids uuid[],
  target_text text,
  target_number numeric,
  target_boolean boolean,
  target_date date,
  target_datetime timestamptz,
  target_json jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_gravar_resp_anon(
    target_submission_id,
    target_session_token,
    target_question_id,
    target_option_ids,
    target_text,
    target_number,
    target_boolean,
    target_date,
    target_datetime,
    target_json
  );
$$;

create or replace function public.fc_srv_enviar_resp_anon(
  target_submission_id uuid,
  target_session_token text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_enviar_resp_anon(target_submission_id, target_session_token);
$$;

revoke all on function public.fc_srv_obter_form_anonimo(text) from public, anon, authenticated;
revoke all on function public.fc_srv_iniciar_resp_anon(text) from public, anon, authenticated;
revoke all on function public.fc_srv_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.fc_srv_enviar_resp_anon(uuid, text) from public, anon, authenticated;

grant execute on function public.fc_srv_obter_form_anonimo(text) to service_role;
grant execute on function public.fc_srv_iniciar_resp_anon(text) to service_role;
grant execute on function public.fc_srv_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) to service_role;
grant execute on function public.fc_srv_enviar_resp_anon(uuid, text) to service_role;

notify pgrst, 'reload schema';
commit;
