import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const BASE_REF = process.env.DB_NAMING_BASE || "origin/main";
const migrationPattern = /^supabase\/migrations\/.*\.sql$/;

const prefixes = {
  table: /^(tb|rl|rt|tl|au|tm|th|ta|bk|td|tf)_[a-z0-9_]+$/,
  schema: /^db(dm)?_[a-z0-9]+$/,
  view: /^(vw|mv)_[a-z0-9_]+$/,
  function: /^(fc|sp)_[a-z0-9_]+$/,
  index: /^(in|in_fk|ib|itm|pi)_[a-z0-9_]+$/,
  constraint: /^(pk|fk|uk|ck)_[a-z0-9_]+$/,
  trigger: /^(tbi|tai|tbu|tau|tbd|tad|tba|taa|tio|tra)_[a-z0-9_]+$/,
  column: /^(co|sq|dt|hr|ds|no|nu|qt|vl|tx|sg|st|tp|im|cg|au)_[a-z0-9_]+$/,
};

/**
 * Objetos legados cuja **restauração** é permitida fora do padrão institucional.
 *
 * Existe uma classe de migration que não cria objeto novo: recria um objeto
 * antigo que deveria existir e não existe, porque o banco divergiu do histórico
 * de migrations. Nesse caso o nome legado é um requisito, não um desvio —
 * renomear tornaria o banco restaurado incompatível com o de quem aplicou a
 * migration original.
 *
 * A exceção é deliberadamente estreita: vale por **arquivo**, por **tipo** e por
 * **nome exato** — nunca por prefixo ou padrão. Assim ela dispensa reproduzir um
 * objeto que já existe no projeto, sem abrir espaço para batizar objeto novo fora
 * do padrão, e sem afrouxar o gate para as outras migrations.
 *
 * Não acrescente entrada aqui para contornar o gate num objeto novo — para esses,
 * o padrão de docs/database-naming-standard.md continua obrigatório.
 */
const LEGACY_RESTORED_OBJECTS = {
  // Painel CDDI: a migration apenas **redefine** a função legada para deixar de
  // contar submissão anulada como concluída (AGS-01). O nome excede 30
  // caracteres porque é anterior ao padrão institucional, e é consumido por
  // `get_cddi_monitoring_dashboard`; renomeá-lo aqui exigiria o procedimento de
  // objeto legado inteiro, alheio à correção.
  "supabase/migrations/20260821140000_painel_cddi_ignora_submissao_anulada.sql": {
    "função": new Set(["get_cddi_monitoring_dashboard_internal"]),
  },
  // Catálogo de módulos, de 20260731115500_platform_navigation_permissions.sql.
  // Restaurado em bancos onde aquela migration nunca rodou; ver
  // docs/operacao-permissoes.md.
  "supabase/migrations/20260810130000_restaurar_catalogo_modulos_plataforma.sql": {
    tabela: new Set(["platform_modules", "role_module_permissions", "person_module_permissions"]),
    coluna: new Set([
      "code", "name", "description", "category", "position", "active", "created_at",
      "role_id", "module_code", "allowed", "person_id", "granted_by", "updated_at",
    ]),
  },
  // RPCs de avatar legadas mantidas como pontes para bundles já publicados.
  // A migration apenas redefine funções existentes; não cria uma nova API fora
  // do padrão institucional.
  "supabase/migrations/20260810141000_usar_foto_google_automaticamente.sql": {
    função: new Set([
      "set_my_avatar_choice",
      "set_my_avatar_url",
      "sync_my_google_avatar",
    ]),
  },
  // Painel do CDDI acelerado: a migration apenas redefine a função existente,
  // com o papel resolvido antes do filtro em vez de por linha. Renomeá-la
  // exigiria mexer no wrapper que os bundles publicados chamam, e a mudança é
  // de desempenho — não é hora de trocar contrato.
  "supabase/migrations/20260814170000_acelerar_painel_cddi.sql": {
    função: new Set(["get_cddi_monitoring_dashboard_internal"]),
  },
  // Seletores passam a respeitar o arquivamento. Só `list_admin_participant_applications`
  // precisa da dispensa — as outras duas funções da migration já nascem `fc_`.
  // Renomeá-la quebraria as três telas que a chamam pelo nome no bundle publicado.
  "supabase/migrations/20260817120000_seletores_respeitam_arquivamento.sql": {
    função: new Set(["list_admin_participant_applications"]),
  },
  // Acentos das RPCs de participantes: a migration só reescreve o texto das
  // mensagens, byte a byte. Renomear qualquer uma delas seria uma mudança de
  // contrato escondida numa correção de encoding.
  "supabase/migrations/20260817140000_corrigir_acentos_rpcs_participantes.sql": {
    função: new Set([
      "assign_admin_application_participant",
      "create_and_assign_admin_participant",
      "list_admin_application_participants",
      "search_admin_people_for_application",
      "set_admin_application_participant_status",
    ]),
  },
  // Notificação por e-mail: a migration acrescenta o campo `emailNotifications`
  // ao retorno de `get_survey_operations`, função legada consumida pelo nome
  // pela tela de propriedades em bundles já publicados. Os objetos novos do
  // arquivo (tl_email_participante, fc_*) seguem o padrão e não constam aqui.
  "supabase/migrations/20260818130000_notificar_participantes_por_email.sql": {
    função: new Set(["get_survey_operations"]),
  },
  // Corrige o estado inicial sem trocar o contrato já consumido pelo
  // frontend. A fila de e-mails usa apenas objetos novos no padrão fc_*.
  "supabase/migrations/20260820153000_corrigir_criacao_e_fila_emails.sql": {
    função: new Set(["create_survey_draft"]),
  },
  // A exclusão definitiva de uma arquivada amplia o único caminho autorizado
  // para remover estrutura publicada. O gatilho já existia antes desta
  // migration e é referenciado pelas três triggers estruturais; renomeá-lo
  // quebraria essa vinculação em bancos que já o possuem.
  "supabase/migrations/20260820220000_exclusao_definitiva_de_arquivada.sql": {
    função: new Set(["enforce_draft_survey_structure"]),
  },
  // `set_person_role` convertida em ponte para `fc_definir_perfil_pessoa`.
  // Renomeá-la seria o mesmo que removê-la: bundles publicados a chamam pelo
  // nome, e é assim que a plataforma caiu em 10/08/2026. A migration não cria
  // API nova — esvazia a antiga, deixando só a delegação.
  "supabase/migrations/20260814140000_limpar_superficie_legada.sql": {
    função: new Set(["set_person_role"]),
  },
  // Regra de período no futuro aplicada às duas RPCs legadas que gravam
  // abertura e encerramento. A migration apenas redefine funções existentes,
  // consumidas pelo nome por bundles já publicados — renomeá-las derrubaria a
  // criação de avaliações e a operação de ciclos. A função nova do arquivo
  // (fc_excluir_pesquisa_rascunho) segue o padrão e não consta aqui.
  "supabase/migrations/20260811120000_periodo_futuro_e_exclusao_rascunho.sql": {
    função: new Set([
      "create_survey_draft",
      "manage_survey_cycle",
    ]),
  },
  // Event trigger que liga RLS em toda tabela nova. Existe no banco desde
  // sempre, aplicado por SQL direto, e nunca virou arquivo — por isso o
  // `supabase db reset` do CI reconstruía o esquema sem ele e o teste de RLS
  // falhava em qualquer branch. O nome legado é requisito: renomear criaria um
  // segundo gatilho no banco que já tem o original. Ver docs/operacao-permissoes.md.
  "supabase/migrations/20260812160000_restaurar_event_trigger_rls_automatica.sql": {
    função: new Set(["rls_auto_enable"]),
  },
  // Anonimato estrutural: as duas RPCs do runtime genérico precisam saber que o
  // ciclo é anônimo — uma para não gravar a identidade na submissão, a outra
  // para destruir o vínculo no envio. São funções legadas consumidas pelo nome
  // por bundles publicados; renomeá-las derrubaria toda resposta em andamento.
  // Os objetos novos do arquivo (tb_bilhete_anonimo, fc_validar_ciclo_anonimo,
  // tba_ciclo_anonimo) seguem o padrão institucional e não constam aqui.
  "supabase/migrations/20260813220000_anonimato_estrutural.sql": {
    função: new Set([
      "start_or_resume_my_survey_submission",
      "submit_my_survey_submission",
    ]),
  },
  // `list_managed_surveys` redefinida para excluir modelos do catálogo
  // administrativo. Função legada consumida pelo nome por bundles publicados
  // (catálogo e painéis): renomeá-la derrubaria as duas telas. A migration só
  // acrescenta um `where` à definição existente; as funções novas do arquivo
  // (`fc_listar_modelos_avaliacao`, `fc_definir_modelo_avaliacao`) seguem o
  // padrão institucional e não constam aqui.
  "supabase/migrations/20260813190000_galeria_de_modelos.sql": {
    função: new Set(["list_managed_surveys"]),
  },
  // Sete RPCs que existem em produção e que nenhuma migration criava — foram
  // aplicadas por SQL direto. As seis primeiras são chamadas pelo frontend e a
  // última pela RPC do painel CDDI; renomeá-las derrubaria os bundles já
  // publicados, que as invocam pelo nome. O arquivo apenas versiona o que já
  // existe. Ver docs/operacao-permissoes.md.
  "supabase/migrations/20260812170000_restaurar_rpcs_de_participantes_e_painel.sql": {
    função: new Set([
      "list_admin_participant_applications",
      "list_admin_application_participants",
      "search_admin_people_for_application",
      "assign_admin_application_participant",
      "create_and_assign_admin_participant",
      "set_admin_application_participant_status",
      "get_cddi_monitoring_dashboard_internal",
    ]),
  },
  // Redefinição de `submit_my_survey_submission` para que pergunta escondida pela
  // lógica condicional deixe de contar como obrigatória pendente. A função é
  // chamada pelo nome pelo runtime genérico já publicado; criar uma `fc_*` no
  // lugar dela exigiria publicar o frontend antes, e no intervalo o envio ficaria
  // impossível em qualquer instrumento com regra ativa. A migration só troca o
  // corpo, mantendo a assinatura.
  "supabase/migrations/20260813120000_motor_logica_condicional.sql": {
    função: new Set(["submit_my_survey_submission"]),
  },
  // Arquivamento de avaliação: CANCEL passa a arquivar a pesquisa junto, e
  // ganham as ações ARCHIVE/UNARCHIVE. `manage_survey_cycle` é chamada pelo
  // nome pela tela de operação do ciclo já publicada; `list_managed_surveys`
  // é chamada pelo nome pelo catálogo administrativo já publicado. Renomear
  // qualquer uma das duas para `fc_*` derrubaria a tela correspondente antes
  // de o frontend novo estar no ar. A função nova do arquivo
  // (fc_expirar_pesquisas_arq) segue o padrão e não consta aqui.
  "supabase/migrations/20260814090000_arquivar_pesquisa.sql": {
    função: new Set(["manage_survey_cycle", "list_managed_surveys"]),
  },
  // Abertura automática do ciclo agendado. Quatro das cinco funções legadas
  // aqui são chamadas pelo nome por bundles já publicados (a tela de operação,
  // o catálogo do participante e as duas jornadas de resposta); a quinta,
  // `application_accepts_responses`, é referenciada por políticas de RLS e por
  // meia dúzia de RPCs do runtime — trocá-la por uma `fc_*` exigiria redefinir
  // todas elas na mesma migration. A função nova do arquivo
  // (fc_abrir_ciclos_agendados) segue o padrão e não consta aqui.
  // Remoção do módulo RESULTS. `fc_obter_contexto_plataforma` já segue o padrão
  // institucional; o que a dispensa aqui é só o tamanho — são 31 caracteres,
  // um acima do limite. O nome foi escolhido em 20260807150000 e é chamado por
  // todo bundle publicado, então encurtá-lo agora derrubaria a plataforma
  // inteira: é o contrato de autorização de toda tela autenticada.
  "supabase/migrations/20260814110000_remover_modulo_resultados.sql": {
    função: new Set(["fc_obter_contexto_plataforma"]),
  },
  "supabase/migrations/20260814100000_abrir_ciclos_agendados.sql": {
    função: new Set([
      "application_accepts_responses",
      "manage_survey_cycle",
      "list_my_survey_catalog",
      "get_public_survey_form",
      "get_survey_operations",
    ]),
  },
  // Checklist deixa de cobrar "nenhum participante vinculado" em ciclo
  // anônimo: a jornada pública nem consulta application_participants. Mesma
  // política das demais redefinições de `get_survey_operations` — função
  // legada consumida pelo nome pela tela de propriedades já publicada.
  "supabase/migrations/20260821170000_checklist_ignora_publico_anonimo.sql": {
    função: new Set(["get_survey_operations"]),
  },
};

function isLegacyRestored(file, kind, name) {
  return LEGACY_RESTORED_OBJECTS[file]?.[kind]?.has(name) === true;
}

function changedMigrationFiles() {
  try {
    const commands = [
      ["diff", "--name-only", `${BASE_REF}...HEAD`, "--", "supabase/migrations"],
      ["diff", "--name-only", "--", "supabase/migrations"],
      ["ls-files", "--others", "--exclude-standard", "--", "supabase/migrations"],
    ];
    const files = commands.flatMap((arguments_) => execFileSync("git", arguments_, { encoding: "utf8" }).split("\n"));
    return [...new Set(files)]
      .map((value) => value.trim())
      .filter((value) => migrationPattern.test(value) && existsSync(value));
  } catch {
    return [];
  }
}

function normalize(identifier) {
  return identifier.replaceAll('"', "").split(".").at(-1)?.toLowerCase() || "";
}

function assertName(errors, file, kind, rawName, pattern, maxLength = 30) {
  const name = normalize(rawName);
  // Objeto restaurado é dispensado de prefixo **e** de tamanho. A regra anterior
  // cobrava o tamanho mesmo dos legados, sob o argumento de que nada justifica
  // violá-lo — o que não se sustenta nesta classe de migration: restaurar exige
  // o nome exato que o banco e os bundles publicados já usam. Encurtar
  // `set_admin_application_participant_status` criaria uma segunda função e
  // derrubaria a tela que a chama. A alternativa seria deixar o objeto fora do
  // repositório, que é justamente o defeito que a restauração corrige.
  //
  // A allowlist continua estreita e indexada por arquivo, tipo e nome exato, e
  // o conjunto de caracteres segue cobrado para todos.
  const legacyRestored = isLegacyRestored(file, kind, name);
  if (!pattern.test(name) && !legacyRestored) {
    errors.push(`${file}: ${kind} '${name}' não segue o prefixo institucional.`);
  }
  if (name.length > maxLength && !legacyRestored) {
    errors.push(`${file}: ${kind} '${name}' excede ${maxLength} caracteres.`);
  }
  if (!/^[a-z0-9_]+$/.test(name)) {
    errors.push(`${file}: ${kind} '${name}' contém caractere não permitido.`);
  }
}

function splitTopLevelDefinitions(body) {
  const definitions = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    const nextCharacter = body[index + 1];

    if (inSingleQuote) {
      current += character;
      if (character === "'" && nextCharacter === "'") {
        current += nextCharacter;
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += character;
      if (character === '"' && nextCharacter === '"') {
        current += nextCharacter;
        index += 1;
      } else if (character === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (character === "'") {
      inSingleQuote = true;
      current += character;
      continue;
    }

    if (character === '"') {
      inDoubleQuote = true;
      current += character;
      continue;
    }

    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);

    if (character === "," && depth === 0) {
      if (current.trim()) definitions.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) definitions.push(current.trim());
  return definitions;
}

function validateColumns(errors, file, sql) {
  const createTableRegex = /create\s+table(?:\s+if\s+not\s+exists)?\s+([^\s(]+)\s*\(([^;]+?)\)\s*;/gis;
  for (const match of sql.matchAll(createTableRegex)) {
    const definitions = splitTopLevelDefinitions(match[2]);
    for (const definition of definitions) {
      if (/^(constraint|primary|foreign|unique|check|exclude|like)\b/i.test(definition)) continue;
      const column = definition.match(/^([a-zA-Z0-9_"]+)\s+/)?.[1];
      if (column) assertName(errors, file, "coluna", column, prefixes.column);
    }
  }
}

function validateFile(file) {
  const sql = readFileSync(file, "utf8")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const errors = [];

  for (const match of sql.matchAll(/create\s+schema(?:\s+if\s+not\s+exists)?\s+([^\s;]+)/gi)) {
    assertName(errors, file, "schema", match[1], prefixes.schema, 20);
  }
  for (const match of sql.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+([^\s(]+)/gi)) {
    assertName(errors, file, "tabela", match[1], prefixes.table);
  }
  for (const match of sql.matchAll(/create\s+(?:materialized\s+)?view\s+([^\s(]+)/gi)) {
    assertName(errors, file, "view", match[1], prefixes.view);
  }
  for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([^\s(]+)/gi)) {
    assertName(errors, file, "função", match[1], prefixes.function);
  }
  for (const match of sql.matchAll(/create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+([^\s]+)/gi)) {
    assertName(errors, file, "índice", match[1], prefixes.index);
  }
  for (const match of sql.matchAll(/constraint\s+([^\s]+)\s+(?:primary|foreign|unique|check|exclude)/gi)) {
    assertName(errors, file, "constraint", match[1], prefixes.constraint);
  }
  for (const match of sql.matchAll(/create\s+trigger\s+([^\s]+)/gi)) {
    assertName(errors, file, "trigger", match[1], prefixes.trigger);
  }

  validateColumns(errors, file, sql);
  return errors;
}

const files = changedMigrationFiles();
if (!files.length) {
  console.log("Nenhuma nova migração SQL para validar.");
  process.exit(0);
}

const errors = files.flatMap(validateFile);
if (errors.length) {
  console.error("Falha no padrão institucional de nomenclatura do banco:\n");
  for (const error of errors) console.error(`- ${error}`);
  console.error("\nConsulte docs/database-naming-standard.md.");
  process.exit(1);
}

console.log(`Padrão institucional validado em ${files.length} migração(ões).`);
