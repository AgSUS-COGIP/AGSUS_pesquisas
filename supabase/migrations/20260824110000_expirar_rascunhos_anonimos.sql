begin;

-- Item 7 — expiração de rascunho anônimo abandonado.
--
-- O que se acumula
-- A jornada anônima pública (`/responder/`) cria uma submissão `DRAFT` marcada
-- com `origin = 'PUBLIC_ANONYMOUS_LINK'`, e o token da sessão vive no
-- `metadata` da própria linha, como hash SHA-256 desde `20260822213947`.
--
-- Quem abre o link e não conclui deixa esse rascunho para trás. Não há login,
-- então ninguém volta para limpar: sem expiração, a tabela cresce com dado que
-- nunca mais será usado, e cada linha carrega um hash de credencial que já não
-- serve para nada.
--
-- Em 24/08/2026 havia 13 rascunhos anônimos e **nenhum com mais de 30 dias** —
-- o mais antigo era de anteontem. Ou seja: não há acúmulo antigo a limpar hoje.
-- O que esta migration instala é o mecanismo, antes de o problema existir.
--
-- Por que o prazo é configurável
-- Escolher um número no código seria decidir, em nome de quem opera, quanto
-- tempo alguém pode levar para terminar um formulário — e apagar rascunho vivo
-- é irreversível. O prazo vira coluna de configuração, com padrão de 60 dias e
-- piso de 7: prazo curto demais transforma a limpeza em perda de trabalho.
--
-- Três coisas que a limpeza **não** faz
--   · não toca em submissão enviada (`SUBMITTED`, `VALIDATED`) — nunca;
--   · não toca em rascunho identificado, que tem dono e pode ser retomado;
--   · não apaga por data de criação, e sim por `updated_at`. Quem voltou ontem
--     para continuar não perde o trabalho por ter começado há dois meses.
--
-- As respostas somem junto por `answers.submission_id … on delete cascade`, que
-- já existe. O hash do token mora no `metadata` da linha apagada, então
-- desaparece com ela — sem passo separado que possa ser esquecido.

---------------------------------------------------------------------------
-- 1. O prazo, configurável.
---------------------------------------------------------------------------
alter table public.tb_config_plataforma
  add column if not exists nu_dias_retencao_rascunho_anonimo integer not null default 60;

alter table public.tb_config_plataforma
  drop constraint if exists ck_config_retencao_anonima;
alter table public.tb_config_plataforma
  add constraint ck_config_retencao_anonima
  check (nu_dias_retencao_rascunho_anonimo between 7 and 730);

comment on column public.tb_config_plataforma.nu_dias_retencao_rascunho_anonimo is
  'Dias que um rascunho anônimo público sobrevive sem alteração antes de ser apagado. Entre 7 e 730; padrão 60. Prazo curto demais transforma limpeza em perda de trabalho.';

---------------------------------------------------------------------------
-- 2. Quem muda o prazo.
--
-- Função focada, como as demais de configuração: `fc_atualizar_marca_plataforma`
-- substitui a linha inteira, e acrescentar parâmetro a ela criaria sobrecarga
-- no PostgREST — a classe de falha de 10/08/2026.
---------------------------------------------------------------------------
create or replace function public.fc_definir_retencao_anonima(p_dias integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- A constraint já recusaria, mas a mensagem chegaria como erro de restrição.
  -- Aqui ela chega em português, para quem está configurando.
  if p_dias is null or p_dias < 7 or p_dias > 730 then
    raise exception 'O prazo deve ficar entre 7 e 730 dias.';
  end if;

  update public.tb_config_plataforma
  set nu_dias_retencao_rascunho_anonimo = p_dias,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'dias', p_dias);
end;
$$;

revoke all on function public.fc_definir_retencao_anonima(integer) from public, anon;
grant execute on function public.fc_definir_retencao_anonima(integer) to authenticated;

comment on function public.fc_definir_retencao_anonima(integer) is
  'Define por quantos dias um rascunho anônimo público sobrevive sem alteração. Entre 7 e 730.';

---------------------------------------------------------------------------
-- 3. A limpeza.
--
-- Preguiçosa, no mesmo desenho de `fc_abrir_ciclos_agendados()` e do
-- arquivamento: o projeto não tem job agendado (sem `pg_cron`), então a
-- materialização acontece no caminho de uso. Sem grant — é chamada de dentro
-- de função que executa como dona.
---------------------------------------------------------------------------
create or replace function public.fc_expirar_rascunhos_anonimos()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dias integer;
  v_apagados integer;
begin
  select nu_dias_retencao_rascunho_anonimo into v_dias
  from public.tb_config_plataforma where co_configuracao = 1;

  -- Configuração ausente não autoriza apagar nada: sem prazo conhecido, a
  -- escolha segura é não fazer.
  if v_dias is null then
    return 0;
  end if;

  delete from public.submissions s
  where s.status = 'DRAFT'
    and s.metadata->>'origin' = 'PUBLIC_ANONYMOUS_LINK'
    -- `updated_at`, não `created_at`: quem voltou ontem para continuar não
    -- perde o trabalho por ter começado há muito tempo.
    and s.updated_at < timezone('utc', now()) - make_interval(days => v_dias);

  get diagnostics v_apagados = row_count;

  -- Só audita quando houve o que apagar: registrar zero a cada carregamento de
  -- formulário encheria a auditoria de ruído e esconderia o evento real.
  if v_apagados > 0 then
    insert into public.audit_events(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    )
    values (
      null, 'ANONYMOUS_DRAFTS_EXPIRED', 'submissions', null, null, null, null,
      jsonb_build_object('apagados', v_apagados, 'diasRetencao', v_dias)
    );
  end if;

  return v_apagados;
end;
$$;

revoke all on function public.fc_expirar_rascunhos_anonimos() from public, anon, authenticated;

comment on function public.fc_expirar_rascunhos_anonimos() is
  'Apaga rascunho anônimo público sem alteração há mais que o prazo configurado. Nunca toca em submissão enviada nem em rascunho identificado. Respostas somem por cascade; o hash do token mora na linha apagada.';

---------------------------------------------------------------------------
-- 4. Quem dispara a limpeza.
--
-- Invólucro para a rota, no padrão `fc_srv_*` do projeto: a limpeza roda quando
-- alguém abre um formulário anônimo — o mesmo caminho que cria os rascunhos.
--
-- Ficou separada da própria `fc_obter_form_anonimo` de propósito. Aquela é a
-- leitura que serve o formulário a quem está esperando a tela; pendurar um
-- `delete` nela faria a pessoa pagar, no tempo de carregamento, por uma
-- faxina que não é dela. A rota chama as duas, e só a leitura bloqueia.
---------------------------------------------------------------------------
create or replace function public.fc_srv_expirar_rascunhos_anon()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  return public.fc_expirar_rascunhos_anonimos();
end;
$$;

-- O grant a service_role e' explicito, e nao herdado do default privilege do
-- projeto. Esta funcao e' chamada de dentro de after(), com o erro reduzido a
-- console.warn para que a faxina nunca derrube a jornada de quem responde —
-- entao uma ACL faltando nao apareceria em lugar nenhum: a rota continuaria
-- respondendo 200 e a expiracao simplesmente nunca aconteceria. Depender de
-- configuracao fora da migration e' o que torna essa falha invisivel.
revoke all on function public.fc_srv_expirar_rascunhos_anon() from public, anon, authenticated;
grant execute on function public.fc_srv_expirar_rascunhos_anon() to service_role;

comment on function public.fc_srv_expirar_rascunhos_anon() is
  'Service role apenas. Dispara a expiração de rascunhos anônimos; chamada pela rota do formulário público.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_expirar_rascunhos_anonimos();
--   drop function if exists public.fc_definir_retencao_anonima(integer);
--   alter table public.tb_config_plataforma
--     drop constraint if exists ck_config_retencao_anonima,
--     drop column if exists nu_dias_retencao_rascunho_anonimo;
--   -- Rascunhos já apagados não voltam: o rollback devolve o mecanismo, não os
--   -- dados. Por isso o prazo tem piso de 7 dias e padrão folgado.
-- commit;
