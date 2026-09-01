// Gera a migration que põe FUNÇÕES, TRIGGERS e POLICIES de `sigav` no padrão
// institucional da AgSUS, em MAIÚSCULAS citadas — completando o que
// 20260831150000 fez com tabelas, constraints e índices.
//
//   item 9 — Function `FC_[NOME]`;
//            Trigger  `TBI_/TAI_` (insert), `TBU_/TAU_` (update),
//                     `TBD_/TAD_` (delete), `TBA_/TAA_` (all), `TIO_` (instead of);
//   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
//
// Uso: node --env-file=.env.local <este arquivo> > saida.sql

import pg from "pg";

// Funções cujo nome também muda de PALAVRA (inglês -> português). As demais
// já eram `fc_*` e só mudam de caixa.
const TRADUZ = {
  add_person_to_my_team: "fc_incluir_pessoa_equipe",
  add_survey_question: "fc_incluir_pergunta",
  add_survey_section: "fc_incluir_secao",
  application_accepts_responses: "fc_ciclo_aceita_resposta",
  assign_admin_all_available_participants: "fc_atrib_todos_disponiveis",
  assign_admin_application_participant: "fc_atrib_participante",
  assign_admin_application_participants_bulk: "fc_atrib_participante_lote",
  can_access_application: "fc_pode_acessar_ciclo",
  can_audit_platform: "fc_pode_auditar",
  can_edit_submission: "fc_pode_editar_submissao",
  can_manage_surveys: "fc_pode_gerir_pesquisa",
  can_track_platform_presence: "fc_pode_registrar_presenca",
  can_view_platform_presence: "fc_pode_ver_presenca",
  claim_my_access: "fc_reivindicar_acesso",
  create_and_assign_admin_participant: "fc_criar_e_atrib_partic",
  create_survey_draft: "fc_criar_rascunho_pesquisa",
  current_person_id: "fc_pessoa_sessao",
  delete_survey_question: "fc_excluir_pergunta",
  duplicate_survey_builder_item: "fc_duplicar_item_construtor",
  effective_platform_modules: "fc_modulos_efetivos",
  enforce_draft_survey_structure: "fc_exigir_rascunho_estrut",
  get_admin_people_base_summary: "fc_resumo_base_pessoas",
  get_application_visual_settings: "fc_obter_visual_ciclo",
  get_cddi_monitoring_dashboard: "fc_painel_monitor_cddi",
  get_cddi_monitoring_dashboard_internal: "fc_painel_monitor_cddi_int",
  get_my_cddi_context: "fc_obter_contexto_cddi",
  get_my_cddi_identity: "fc_obter_identidade_cddi",
  get_my_team_workspace: "fc_obter_espaco_equipe",
  get_platform_health: "fc_saude_plataforma",
  get_public_survey_form: "fc_obter_form_publico",
  get_survey_builder: "fc_obter_construtor",
  get_survey_dashboard: "fc_obter_painel_pesq",
  get_survey_operations: "fc_obter_operacoes_pesquisa",
  handle_cddi_leadership_answer_sync: "fc_sincr_resp_lideranca",
  has_active_role: "fc_tem_papel_ativo",
  has_platform_module: "fc_tem_modulo",
  is_allowed_institutional_email: "fc_email_instituc_permitido",
  is_platform_administrator: "fc_e_administrador",
  list_admin_application_participants: "fc_listar_partic_ciclo",
  list_admin_participant_applications: "fc_listar_ciclos_partic",
  list_managed_surveys: "fc_listar_pesquisas_geridas",
  list_my_survey_catalog: "fc_listar_catalogo_pesquisa",
  list_platform_admin_leadership_links: "fc_listar_vinculos_lideranca",
  manage_survey_cycle: "fc_gerir_ciclo_pesquisa",
  move_survey_question_to_section: "fc_mover_pergunta_secao",
  normalize_agsus_google_oauth_referrer: "fc_normalizar_referrer_oauth",
  remove_person_from_my_team: "fc_remover_pessoa_equipe",
  reorder_survey_builder_item: "fc_reordenar_item_construtor",
  resolve_authenticated_person: "fc_resolver_pessoa_autentic",
  rls_auto_enable: "fc_rls_habilitar_auto",
  save_my_cddi_answer: "fc_salvar_resposta_cddi",
  save_my_survey_answer: "fc_salvar_resposta_pesquisa",
  search_admin_people_for_application: "fc_buscar_pessoas_ciclo",
  search_platform_admin_people: "fc_buscar_pessoas_admin",
  search_team_candidates: "fc_buscar_candidatos_equipe",
  set_admin_application_participant_status: "fc_definir_situacao_partic",
  set_my_avatar_url: "fc_definir_avatar",
  set_platform_admin_leadership_link: "fc_definir_vinculo_lideranca",
  set_updated_at: "fc_definir_dt_alteracao",
  start_or_resume_my_cddi_submission: "fc_iniciar_ou_retomar_cddi",
  start_or_resume_my_submission: "fc_iniciar_ou_retomar_subm",
  start_or_resume_my_survey_submission: "fc_iniciar_ou_retomar_pesq",
  submit_my_cddi_submission: "fc_enviar_submissao_cddi",
  submit_my_survey_submission: "fc_enviar_submissao_pesquisa",
  sync_cddi_leader_technical_answer: "fc_sincr_resp_tecnica_cddi",
  sync_cddi_manager_rows: "fc_sincr_linhas_gestor_cddi",
  sync_my_google_avatar: "fc_sincr_avatar_google",
  sync_new_cddi_submission_leader_answer: "fc_sincr_resp_lider_nova",
  sync_people_base_rows: "fc_sincr_linhas_base_pessoa",
  unaccent_lower: "fc_sem_acento_minuscula",
  update_application_visual_settings: "fc_atualizar_visual_ciclo",
  update_platform_admin_person: "fc_atualizar_pessoa_admin",
  update_survey_question: "fc_atualizar_pergunta",
  update_survey_section: "fc_atualizar_secao",
  validate_answer_option: "fc_validar_opcao_resposta",
  validate_answer_question: "fc_validar_pergunta_resposta",
  validate_cddi_final_result: "fc_validar_result_final_cddi",
  validate_cddi_submission: "fc_validar_submissao_cddi",
  validate_submission_participant: "fc_validar_partic_submissao",
  validate_survey_version_integrity: "fc_validar_integridade_versao",
  // Já eram `fc_`, mas estouram os 30 caracteres do item 3.
  fc_previsualizar_publico_avaliacao: "fc_previsualizar_publico",
  fc_srv_registrar_erro_aplicacao: "fc_srv_registrar_erro",
  fc_srv_resolver_identidade_oauth: "fc_srv_resolver_ident_oauth",
};

// Forma curta por tabela, para nome de trigger dentro dos 30 caracteres.
const CODIGO = {
  TB_PESSOA: "pessoa", TB_IDENTIDADE_ACESSO: "ident_acesso",
  TB_UNIDADE_ORGANIZACIONAL: "unid_org", TB_DOMINIO_INSTITUCIONAL: "dom_inst",
  TB_MODULO_PLATAFORMA: "mod_plat", RL_PESSOA_MODULO: "pessoa_mod",
  TB_PESQUISA: "pesq", TH_VERSAO_PESQUISA: "versao_pesq",
  TB_SECAO_PESQUISA: "secao_pesq", TB_PERGUNTA_PESQUISA: "perg_pesq",
  TB_OPCAO_PERGUNTA: "opcao_perg", TB_APLICACAO_PESQUISA: "aplic_pesq",
  RL_APLICACAO_PESSOA: "aplic_pessoa", TB_SUBMISSAO: "subm",
  TB_RESPOSTA: "resp", RL_RESPOSTA_OPCAO: "resp_opcao",
  RT_LIDERANCA_CDDI: "lider_cddi", TB_CORRECAO_VINCULO_CDDI: "corr_vinc_cddi",
  TB_RESULTADO_COMPET_CDDI: "res_comp_cddi", TB_RESULTADO_FINAL_CDDI: "res_final_cddi",
  TB_LOTE_IMPORTACAO: "lote_imp", TB_OCORRENCIA_IMPORTACAO: "ocorr_imp",
  TL_EVENTO_AUDITORIA: "audit", TB_PREFERENCIA_USUARIO: "pref_usu",
  TB_ARQUIVO: "arquivo", TB_BILHETE_ANONIMO: "bilhete_anon",
  TB_CATALOGO_OBJETO: "catalogo_obj", TB_CONDICAO_REGRA: "cond_regra",
  TB_CONFIG_PLATAFORMA: "config_plat", TB_IDENTIDADE_OAUTH: "ident_oauth",
  TB_LIMITE_REQUISICAO_PUBLICA: "limite_req", TB_MIGRACAO: "migracao",
  TB_PRESENCA_ONLINE: "presenca", TB_REGRA_CONDICIONAL: "regra_cond",
  TB_USUARIO_IDENTIDADE: "usu_ident", TL_EMAIL_PARTICIPANTE: "email_part",
  TL_ERRO_APLICACAO: "erro_aplic",
};

// Trigger cujo nome mecânico (`prefixo_codigo`) colidiria com um irmão na mesma
// tabela. O discriminador é escrito à mão, em português: derivar do nome antigo
// arrastava o inglês (`TBU_PESSOA_PEOPLE_FOTO_GOOGLE`).
const TRIGGER_EXPLICITO = {
  tba_ciclo_anonimo: "tbu_aplic_pesq_ciclo_anonimo",
  tbu_people_foto_google: "tbu_pessoa_foto_google",
  tau_cancela_ciclos_arq: "tau_pesq_cancela_ciclos",
  submissions_validate_cddi: "tba_subm_validar_cddi",
  submissions_validate_participant: "tba_subm_validar_partic",
  submissions_sync_cddi_leader_answer: "tai_subm_sincr_resp_lider",
  answers_validate_question: "tba_resp_validar_pergunta",
  answer_options_validate_question: "tba_resp_opcao_validar_perg",
  cddi_final_results_validate_submissions: "tba_res_final_cddi_validar",
  cddi_leadership_answer_sync: "taa_lider_cddi_sincr_resp",
  enforce_draft_survey_sections: "tba_secao_pesq_exigir_rascunho",
  enforce_draft_survey_questions: "tba_perg_pesq_exigir_rascunho",
  enforce_draft_question_options: "tba_opcao_perg_exigir_rascunho",
};

const LIMITE = 30;
const id = (base) => `"${base.toUpperCase()}"`;
const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

const cliente = new pg.Client({
  host: new URL(process.env.EMPRESA_DATABASE_URL).hostname,
  port: Number(new URL(process.env.EMPRESA_DATABASE_URL).port || 5432),
  database: new URL(process.env.EMPRESA_DATABASE_URL).pathname.replace(/^\//, ""),
  user: process.env.MIGRATION_USERNAME_DATABASE_URL,
  password: process.env.MIGRATION_PASSWORD_DATABASE_URL,
});
await cliente.connect();

// --- Funções do projeto (extensões ficam de fora) ----------------------------
const { rows: funcoes } = await cliente.query(
  `select p.proname, p.oid::regprocedure::text as assinatura,
          pg_get_function_identity_arguments(p.oid) as args,
          pg_get_functiondef(p.oid) as definicao,
          p.prorettype = 'trigger'::regtype as e_trigger
     from pg_proc p
    where p.pronamespace = 'sigav'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by p.proname, p.oid`,
);

const NOVO = {};
for (const f of funcoes) NOVO[f.proname] = TRADUZ[f.proname] ?? f.proname;
for (const [antigo, novo] of Object.entries(NOVO)) {
  if (novo.length > LIMITE) throw new Error(`${antigo} -> ${novo} tem ${novo.length} caracteres`);
  if (!/^fc_[a-z0-9_]+$/.test(novo)) throw new Error(`${antigo} -> ${novo} fora do padrão FC_`);
}
const ANTIGOS = Object.keys(NOVO);

const partes = [];
const emitir = (s) => partes.push(s);

emitir(`-- Nomenclatura institucional para FUNÇÕES, TRIGGERS e POLICIES de \`sigav\`.
--
-- Completa 20260831150000 (tabelas, constraints e índices) aplicando o mesmo
-- "Padrão Institucional de Nomenclatura" da AgSUS (UTIC, maio/2026, v1.0):
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres;
--   item 9 — \`FC_\` para function; \`TBI_/TAI_\`, \`TBU_/TAU_\`, \`TBD_/TAD_\`,
--            \`TBA_/TAA_\` e \`TIO_\` para trigger, conforme momento e evento.
--
-- Como nas tabelas, o identificador é CITADO: \`sigav."FC_PESSOA_SESSAO"()\`.
-- O adaptador de RPC do app já cita nome de função e de argumento
-- (\`quoteIdent\` em src/lib/db/rpc-adapter.ts), então a chamada continua
-- funcionando — o que muda é a string do nome, atualizada no mesmo commit.
--
-- NÃO MUDAM, porque são contrato com o frontend:
--   - nomes de PARÂMETRO das funções (o adaptador resolve por nome);
--   - colunas declaradas em \`returns table(...)\` — viram chave JSON quando o
--     shape é "set" (\`FC_REIVINDICAR_ACESSO\`, \`FC_ARQ_LISTAR\` e outras 4);
--   - chaves de \`jsonb_build_object\` nos corpos.
--
-- As 36 funções da extensão pgcrypto ficam de fora: o nome pertence à extensão.
--
-- Corpo de função é texto resolvido em execução. Toda chamada entre funções
-- deste schema é qualificada (\`sigav.<nome>(\`) — 441 ocorrências verificadas,
-- e as 2 menções nuas restantes estão em comentário. A seção 4 reescreve as
-- afetadas trocando só essas chamadas qualificadas.

begin;

-- ---------------------------------------------------------------------------
-- 1. Funções (item 9)
-- ---------------------------------------------------------------------------
`);

// Sobrecarga tem o mesmo nome e assinaturas diferentes: renomeia uma a uma.
for (const f of funcoes) {
  emitir(`alter function sigav.${f.proname}(${f.args}) rename to ${id(NOVO[f.proname])};`);
}
emitir("");

// --- Triggers ---------------------------------------------------------------
const { rows: triggers } = await cliente.query(
  `select c.relname as tabela, t.tgname as nome, t.tgtype,
          p.proname as funcao
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_proc p on p.oid = t.tgfoid
    where c.relnamespace = 'sigav'::regnamespace and not t.tgisinternal
    order by c.relname, t.tgname`,
);

const usados = new Set();
function prefixoTrigger(tgtype) {
  const instead = (tgtype & 64) > 0;
  const before = (tgtype & 2) > 0;
  const eventos = [(tgtype & 4) > 0, (tgtype & 16) > 0, (tgtype & 8) > 0].filter(Boolean).length;
  if (instead) return "tio";
  const momento = before ? "tb" : "ta";
  if (eventos > 1) return `${momento}a`;
  if ((tgtype & 4) > 0) return `${momento}i`;
  if ((tgtype & 16) > 0) return `${momento}u`;
  return `${momento}d`;
}
/** Termo que distingue triggers irmãos na mesma tabela (mesmo momento/evento). */
function termo(tabela, nome) {
  const daTabela = new Set(tabela.toLowerCase().split("_"));
  let tokens = nome.toLowerCase().split("_").filter((t) => !daTabela.has(t));
  while (tokens.length > 1 && ["tba", "tbu", "tau", "tbi", "tai", "tad", "tbd"].includes(tokens[0])) tokens = tokens.slice(1);
  return tokens;
}
function nomearTrigger(prefixo, codigo, tokens) {
  const base = `${prefixo}_${codigo}`;
  if (base.length <= LIMITE && !usados.has(base)) { usados.add(base); return base; }
  for (let descarte = 0; descarte < Math.max(tokens.length, 1); descarte += 1) {
    for (const n of [null, 8, 6, 4, 3]) {
      const cauda = tokens.slice(descarte).map((t) => (n && t.length > n ? t.slice(0, n) : t)).join("_");
      const nome = `${base}_${cauda}`;
      if (cauda && nome.length <= LIMITE && !usados.has(nome)) { usados.add(nome); return nome; }
    }
  }
  throw new Error(`Não foi possível nomear trigger ${base}`);
}

emitir(`-- ---------------------------------------------------------------------------
-- 2. Triggers (item 9) — prefixo pelo momento e pelo evento
-- ---------------------------------------------------------------------------
`);
for (const t of triggers) {
  const codigo = CODIGO[t.tabela];
  if (!codigo) throw new Error(`Falta CODIGO para ${t.tabela}`);
  let novo = TRIGGER_EXPLICITO[t.nome];
  if (novo) {
    if (novo.length > LIMITE || usados.has(novo)) throw new Error(`Trigger explícito inválido: ${novo}`);
    usados.add(novo);
  } else {
    novo = nomearTrigger(prefixoTrigger(t.tgtype), codigo, termo(t.tabela, t.nome));
  }
  emitir(`alter trigger ${t.nome} on sigav.${id(t.tabela)} rename to ${id(novo)};`);
}
emitir("");

// --- Policies ---------------------------------------------------------------
const { rows: policies } = await cliente.query(
  `select tablename, policyname from pg_policies where schemaname = 'sigav' order by tablename, policyname`,
);
emitir(`-- ---------------------------------------------------------------------------
-- 3. Policies
--
-- O padrão não define prefixo para policy. Fica o \`PL_\` que o schema já usava,
-- agora na caixa do item 3.
-- ---------------------------------------------------------------------------
`);
for (const p of policies) {
  emitir(`alter policy ${p.policyname} on sigav.${id(p.tablename)} rename to ${id(p.policyname)};`);
}
emitir("");

// --- Corpos -----------------------------------------------------------------
function reescrever(def) {
  let s = def;

  // `fc_srv_verificar_migrations` é LANGUAGE sql — corpo validado na criação — e
  // aponta para `supabase_migrations.schema_migrations`, schema removido quando
  // o histórico passou a morar em `sigav."TB_MIGRACAO"`. A função já estava
  // quebrada em execução; sem este reparo o CREATE OR REPLACE falha. A intenção
  // e as chaves de retorno seguem iguais.
  s = s.replace(/supabase_migrations\.schema_migrations m/g, 'sigav."TB_MIGRACAO" m');
  s = s.replace(/\bm\.version\b/g, "m.co_versao");
  s = s.replace(
    /select max\(version\) from supabase_migrations\.schema_migrations/g,
    'select max(co_versao) from sigav."TB_MIGRACAO"',
  );

  for (const antigo of ANTIGOS) {
    s = s.replace(new RegExp(`\\bsigav\\.${antigo}\\s*\\(`, "g"), `sigav.${id(NOVO[antigo])}(`);
  }
  s = s.split("\n").map((l) => {
    if (!/^\s*--/.test(l)) return l;
    let x = l;
    for (const antigo of ANTIGOS) x = x.replace(new RegExp(`\\b${antigo}\\b`, "g"), NOVO[antigo].toUpperCase());
    return x;
  }).join("\n");
  return s;
}

const afetadas = funcoes
  .map((f) => ({ ...f, nova: reescrever(f.definicao) }))
  .filter((f) => f.nova !== f.definicao);

emitir(`-- ---------------------------------------------------------------------------
-- 4. Corpos que chamam outras funções do schema (${afetadas.length} de ${funcoes.length})
--
-- \`CREATE OR REPLACE\` já com o nome novo: a seção 1 renomeou, então a
-- definição abaixo substitui a função certa.
-- ---------------------------------------------------------------------------
`);
for (const f of afetadas) {
  // A definição capturada ainda traz o nome antigo no cabeçalho.
  const cabecalhoNovo = f.nova.replace(
    new RegExp(`^CREATE OR REPLACE FUNCTION sigav\\.${f.proname}\\(`),
    `CREATE OR REPLACE FUNCTION sigav.${id(NOVO[f.proname])}(`,
  );
  emitir(`${cabecalhoNovo.trim()};\n`);
}

// --- Autoverificação --------------------------------------------------------
emitir(`-- ---------------------------------------------------------------------------
-- 5. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_antigas text[] := array[${ANTIGOS.map(quote).join(", ")}];
  v_nome    text;
  v_restos  text;
begin
  foreach v_nome in array v_antigas loop
    select string_agg(p.proname, ', ' order by p.proname) into v_restos
      from pg_proc p
     where p.pronamespace = 'sigav'::regnamespace
       and pg_get_functiondef(p.oid) ~ ('sigav\\.' || v_nome || '\\s*\\(');
    if v_restos is not null then
      raise exception 'Ainda chamam sigav.% sem aspas: %', v_nome, v_restos;
    end if;
  end loop;

  select string_agg(p.proname, ', ' order by p.proname) into v_restos
    from pg_proc p
   where p.pronamespace = 'sigav'::regnamespace
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (p.proname <> upper(p.proname) or p.proname !~ '^FC_');
  if v_restos is not null then
    raise exception 'Funções fora do padrão FC_ MAIÚSCULO: %', v_restos;
  end if;

  select string_agg(t.tgname, ', ' order by t.tgname) into v_restos
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relnamespace = 'sigav'::regnamespace and not t.tgisinternal
     and (t.tgname <> upper(t.tgname) or t.tgname !~ '^(TBI|TAI|TBU|TAU|TBD|TAD|TBA|TAA|TIO|TRA)_');
  if v_restos is not null then
    raise exception 'Triggers fora do padrão: %', v_restos;
  end if;

  raise notice 'nomenclatura: ${funcoes.length} funções, ${triggers.length} triggers e ${policies.length} policies em MAIÚSCULAS';
end
$verificacao$;

commit;`);

console.log(partes.join("\n"));
console.error(`funcoes=${funcoes.length} traduzidas=${Object.keys(TRADUZ).length} triggers=${triggers.length} policies=${policies.length} corpos=${afetadas.length}`);
await cliente.end();
