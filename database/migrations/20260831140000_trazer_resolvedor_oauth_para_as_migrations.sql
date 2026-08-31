begin;

-- ============================================================================
-- `fc_srv_resolver_identidade_oauth` passa a ser definida por migration
-- ============================================================================
--
-- Esta função nasceu fora do histórico versionado, em
-- `scripts/auth-identidade-oauth.sql`: era o bootstrap que permitiu o Auth.js
-- substituir o GoTrue sem mudar a lógica do banco. Na época fazia sentido —
-- `rpc-permissions.ts` até registra as duas funções criadas "pelos scripts de
-- bootstrap, não por migration do projeto".
--
-- POR QUE ELA MUDA DE CASA AGORA. Aquele script ficou congelado no mundo
-- pré-unificação: o corpo lê e escreve em `auth.users` e `auth.identities`, e o
-- `search_path` inclui `auth`. Esses objetos foram renomeados para
-- `sigav.tb_usuario_identidade` e `sigav.tb_identidade_oauth` em
-- 20260828100000_unificar_auth_e_extensions_em_sigav.sql, que reescreveu o corpo
-- da função no banco — mas não reescreveu o script.
--
-- O resultado é a pior espécie de resíduo: um arquivo que parece um utilitário
-- de manutenção e, ao ser executado, REGRIDE o banco silenciosamente, porque
-- `create or replace` sobrescreve a versão unificada com a antiga. Descoberto em
-- 31/08/2026 ao rodá-lo — o invariante 3
-- (`database/tests/invariantes_schema.sql`) acusou na hora: "1 objeto citando
-- schema removido: função fc_srv_resolver_identidade_oauth".
--
-- Definição versionada resolve as duas pontas: o corpo abaixo é o mesmo do
-- script, com os nomes unificados, e o script sai do repositório. Quem precisar
-- reinstalar a função aplica migrations, como em todo o resto do schema.
--
-- SEM MUDANÇA DE COMPORTAMENTO. A lógica é a de sempre: recusa domínio não
-- institucional, reaproveita a identidade do provedor, cai para o e-mail quando
-- não há identidade (é o passo que preserva `sigav.people.auth_user_id` de quem
-- já usava a plataforma) e só então cria conta nova. Os metadados são reescritos
-- a cada login para o nome e o avatar acompanharem a conta Google, como o GoTrue
-- fazia.

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
-- `auth` sai do search_path: o schema não existe mais.
set search_path = pg_catalog, sigav
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
  from sigav.tb_identidade_oauth
  where provider = v_provider and provider_id = v_sub;

  -- 2) sem identidade: reaproveita a conta existente com o mesmo e-mail.
  --    Este é o passo que preserva o vínculo de quem já usava a plataforma.
  if v_user_id is null then
    select id into v_user_id
    from sigav.tb_usuario_identidade
    where lower(email) = v_email
    order by created_at nulls last
    limit 1;
  end if;

  -- 3) ninguém encontrado: conta nova de fato
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    v_novo := true;

    insert into sigav.tb_usuario_identidade
      (id, email, raw_user_meta_data, raw_app_meta_data,
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
    update sigav.tb_usuario_identidade
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
  -- `email` NÃO entra na lista de colunas: é coluna gerada a partir de
  -- `identity_data->>'email'`, e o Postgres recusa insert que atribua valor a
  -- ela. `id` também fica de fora — tem default `gen_random_uuid()`.
  insert into sigav.tb_identidade_oauth
    (provider_id, provider, user_id, identity_data,
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
  'Cria ou reaproveita a conta em sigav.tb_usuario_identidade/tb_identidade_oauth a partir do perfil OAuth, para o Auth.js substituir o GoTrue sem alterar a lógica do banco. Reaproveita conta existente pelo e-mail, preservando sigav.people.auth_user_id.';

-- ----------------------------------------------------------------------------
-- Posse e privilégio
-- ----------------------------------------------------------------------------
-- `security definer` roda com os privilégios do DONO, e o dono é quem criou.
-- Aplicada por migration, a função nasce da dona do schema — que é o certo — mas
-- o bloco abaixo garante isso mesmo se alguém aplicar como outro papel.
--
-- Nenhuma role é nomeada: era o defeito do script antigo, que escrevia
-- `usr_sip_app` sob um `if exists` e, no ambiente local (onde a role virou
-- `migration_user`), simplesmente não fazia nada — deixando o dono errado em
-- silêncio.

do $posse$
declare
  v_dona text := (select r.rolname
                    from pg_namespace n
                    join pg_roles r on r.oid = n.nspowner
                   where n.nspname = 'sigav');
  v_runtime text := (select rolname from pg_roles where rolname = 'app_user');
begin
  execute format(
    'alter function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) owner to %I',
    v_dona);

  -- Chamada antes de existir sessão: nenhuma sessão de usuário pode invocá-la.
  -- A barreira de papel lógico está em src/lib/db/rpc-permissions.ts, que a
  -- libera só para `service_role`.
  revoke all on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text)
    from public;

  if v_runtime is not null then
    execute format(
      'grant execute on function sigav.fc_srv_resolver_identidade_oauth(text, text, text, text, text) to %I',
      v_runtime);
    raise notice 'dona %, EXECUTE concedido a %.', v_dona, v_runtime;
  else
    raise notice 'dona %; sem app_user neste cluster, o runtime executa por posse.', v_dona;
  end if;
end;
$posse$;

commit;

-- Rollback: a definição anterior está em
-- `git show <commit anterior>:scripts/auth-identidade-oauth.sql`, mas recriá-la
-- como estava reintroduziria as referências a `auth.users`/`auth.identities` e
-- voltaria a falhar no invariante 3. Se for preciso reverter, reverta o corpo
-- mantendo os nomes unificados.
