-- ============================================================================
-- Ponte de identidade OAuth para o Auth.js
-- ============================================================================
--
-- Com o Auth.js no lugar do GoTrue, quem passa a criar identidade é a
-- aplicação — mas o schema `auth` continua sendo a fonte da verdade do banco:
--   - sigav.people.auth_user_id tem FK para auth.users(id);
--   - sigav.sync_my_google_avatar() lê auth.identities.identity_data->>'picture'
--     filtrando provider = 'google';
--   - as 156 funções resolvem a pessoa por auth.uid(), que vem do claim `sub`.
--
-- Manter essas duas tabelas preenchidas é o que permite trocar o provedor de
-- login sem alterar uma linha de lógica de negócio no banco.
--
-- A REGRA QUE PRESERVA OS VÍNCULOS EXISTENTES: quando não há identidade
-- registrada para o par (provider, provider_id), a função procura auth.users
-- PELO E-MAIL antes de criar alguém novo. É isso que faz as 29 pessoas já
-- cadastradas continuarem sendo reconhecidas depois do corte — o `id` delas é
-- reaproveitado como `sub`, e o vínculo com sigav.people permanece válido.
-- Sem essa busca por e-mail, todo mundo entraria como usuário novo e perderia
-- o vínculo com o próprio cadastro.
--
-- Executar em cada ambiente (local e, quando houver, o de produção):
--   docker exec -i agsus-local psql -U postgres -d db_dataware < scripts/auth-identidade-oauth.sql
--
-- ============================================================================

begin;

create or replace function sigav.fc_srv_resolver_identidade_oauth(
  p_provider text,
  p_provider_sub text,
  p_email text,
  p_nome text,
  p_avatar text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_sub text := btrim(coalesce(p_provider_sub, ''));
  v_user_id uuid;
  v_novo boolean := false;
  v_agora timestamptz := timezone('utc', now());
begin
  if v_email = '' or v_provider = '' or v_sub = '' then
    raise exception 'Provedor, identificador e e-mail são obrigatórios.';
  end if;

  -- O domínio institucional é decidido pelo banco (sigav.institutional_domains),
  -- não por lista no código: é a mesma fonte que resolve_authenticated_person
  -- consulta, então login e vinculação nunca discordam.
  if not sigav.is_allowed_institutional_email(v_email) then
    return jsonb_build_object('status', 'DOMINIO_NAO_AUTORIZADO', 'email', v_email);
  end if;

  -- 1) identidade já registrada para este provedor
  select user_id into v_user_id
  from auth.identities
  where provider = v_provider and provider_id = v_sub;

  -- 2) sem identidade: reaproveita o usuário existente com o mesmo e-mail.
  --    Este é o passo que preserva o vínculo de quem já usava a plataforma.
  if v_user_id is null then
    select id into v_user_id
    from auth.users
    where lower(email) = v_email
    order by created_at nulls last
    limit 1;
  end if;

  -- 3) ninguém encontrado: usuário novo de fato
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    v_novo := true;

    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data,
                            email_confirmed_at, created_at, updated_at, last_sign_in_at)
    values (
      v_user_id, v_email,
      jsonb_build_object('email', v_email, 'name', p_nome, 'full_name', p_nome,
                         'avatar_url', p_avatar, 'picture', p_avatar,
                         'email_verified', true, 'provider_id', v_sub),
      jsonb_build_object('provider', v_provider, 'providers', jsonb_build_array(v_provider)),
      v_agora, v_agora, v_agora, v_agora
    );
  else
    -- Os metadados são reescritos a cada login para o avatar e o nome
    -- acompanharem a conta Google, que é como o GoTrue se comportava.
    update auth.users
    set email = coalesce(nullif(v_email, ''), email),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'email', v_email, 'name', p_nome, 'full_name', p_nome,
          'avatar_url', p_avatar, 'picture', p_avatar, 'provider_id', v_sub),
        last_sign_in_at = v_agora,
        updated_at = v_agora
    where id = v_user_id;
  end if;

  -- A identidade guarda o que sync_my_google_avatar() vai ler. `picture` e
  -- `avatar_url` são gravados juntos porque a função aceita qualquer um dos
  -- dois, e assim ela não precisa mudar.
  --
  -- `email` NÃO entra na lista de colunas: em auth.identities ela é coluna
  -- gerada (`lower(identity_data->>'email')`), e o Postgres recusa insert que
  -- atribua valor a ela. Vai dentro do identity_data, de onde é derivada.
  insert into auth.identities (provider_id, provider, user_id, identity_data,
                               last_sign_in_at, created_at, updated_at)
  values (
    v_sub, v_provider, v_user_id,
    jsonb_build_object('sub', v_sub, 'iss', 'https://accounts.google.com',
                       'email', v_email, 'email_verified', true,
                       'name', p_nome, 'full_name', p_nome,
                       'picture', p_avatar, 'avatar_url', p_avatar,
                       'provider_id', v_sub),
    v_agora, v_agora, v_agora
  )
  on conflict (provider_id, provider) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'status', 'OK',
    'userId', v_user_id,
    'email', v_email,
    'novo', v_novo
  );
end;
$$;

comment on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) is
  'Cria ou reaproveita a identidade em auth.users/auth.identities a partir do perfil OAuth, para o Auth.js substituir o GoTrue sem alterar a lógica do banco. Reaproveita usuário existente pelo e-mail, preservando sigav.people.auth_user_id.';

-- ----------------------------------------------------------------------------
-- Dono e execução
-- ----------------------------------------------------------------------------
-- Estes dois passos não são formalidade. `SECURITY DEFINER` executa com os
-- privilégios do DONO da função, e o dono é quem a criou — então rodar este
-- arquivo como superuser deixaria uma função privilegiada rodando como
-- superuser, muito acima do necessário, e diferente das outras 156 de sigav.
--
-- Além disso a aplicação conecta como `usr_sip_app`. Sem `EXECUTE` explícito
-- ela não consegue chamar a função, e o PostgreSQL relata isso como
-- "function ... does not exist" (42883) em vez de erro de permissão — o que
-- manda quem está diagnosticando procurar por migration não aplicada, no lugar
-- errado. Foi exatamente o que aconteceu na primeira tentativa de login.
--
-- Idempotente: se o arquivo já for executado como `usr_sip_app`, o dono já é
-- esse e o `alter` não muda nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'usr_sip_app') then
    execute 'alter function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) owner to usr_sip_app';
  end if;
end;
$$;

-- Chamada antes de existir sessão: nenhuma sessão de usuário pode invocá-la.
revoke all on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text)
  from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) from authenticated';
  end if;
  -- Quem a chama é a conexão da aplicação, e a barreira de papel lógico está
  -- em src/lib/db/rpc-permissions.ts (service_role apenas).
  if exists (select 1 from pg_roles where rolname = 'usr_sip_app') then
    execute 'grant execute on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) to usr_sip_app';
  end if;
end;
$$;

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text);
-- commit;
