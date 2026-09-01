// Gera a migration que põe TODOS os objetos de tabela do schema `sigav` no
// padrão institucional da AgSUS em MAIÚSCULAS, como manda o item 3 da Parte I.
//
// Em PostgreSQL identificador sem aspas é dobrado para minúscula, então
// maiúscula de verdade exige identificador citado — `sigav."TB_PESSOA"` — em
// toda referência, para sempre. É o custo assumido desta escolha.
//
// Uso: node --env-file=.env.local <este arquivo> > saida.sql

import pg from "pg";

// As 24 tabelas que também mudam de PALAVRA (inglês -> português). Onde
// `sigav.tb_catalogo_objeto` já registrava um nome proposto, ele foi seguido.
const RENOMEIA = {
  people:                        "tb_pessoa",
  person_access_identities:      "tb_identidade_acesso",
  organizational_units:          "tb_unidade_organizacional",
  institutional_domains:         "tb_dominio_institucional",
  platform_modules:              "tb_modulo_plataforma",
  person_module_permissions:     "rl_pessoa_modulo",
  surveys:                       "tb_pesquisa",
  survey_versions:               "th_versao_pesquisa",
  survey_sections:               "tb_secao_pesquisa",
  survey_questions:              "tb_pergunta_pesquisa",
  question_options:              "tb_opcao_pergunta",
  survey_applications:           "tb_aplicacao_pesquisa",
  application_participants:      "rl_aplicacao_pessoa",
  submissions:                   "tb_submissao",
  answers:                       "tb_resposta",
  answer_options:                "rl_resposta_opcao",
  cddi_leadership_links:         "rt_lideranca_cddi",
  cddi_link_correction_requests: "tb_correcao_vinculo_cddi",
  cddi_competency_results:       "tb_resultado_compet_cddi",
  cddi_final_results:            "tb_resultado_final_cddi",
  data_import_batches:           "tb_lote_importacao",
  data_import_issues:            "tb_ocorrencia_importacao",
  audit_events:                  "tl_evento_auditoria",
  user_preferences:              "tb_preferencia_usuario",
};

// Forma curta por tabela, usada quando o nome de constraint/índice estouraria
// os 30 caracteres do item 3.
const CODIGO = {
  tb_pessoa: "pessoa", tb_identidade_acesso: "ident_acesso",
  tb_unidade_organizacional: "unid_org", tb_dominio_institucional: "dom_inst",
  tb_modulo_plataforma: "mod_plat", rl_pessoa_modulo: "pessoa_mod",
  tb_pesquisa: "pesq", th_versao_pesquisa: "versao_pesq",
  tb_secao_pesquisa: "secao_pesq", tb_pergunta_pesquisa: "perg_pesq",
  tb_opcao_pergunta: "opcao_perg", tb_aplicacao_pesquisa: "aplic_pesq",
  rl_aplicacao_pessoa: "aplic_pessoa", tb_submissao: "subm",
  tb_resposta: "resp", rl_resposta_opcao: "resp_opcao",
  rt_lideranca_cddi: "lider_cddi", tb_correcao_vinculo_cddi: "corr_vinc_cddi",
  tb_resultado_compet_cddi: "res_comp_cddi", tb_resultado_final_cddi: "res_final_cddi",
  tb_lote_importacao: "lote_imp", tb_ocorrencia_importacao: "ocorr_imp",
  tl_evento_auditoria: "audit", tb_preferencia_usuario: "pref_usu",
  // As 13 que já estavam no padrão e só mudam de caixa.
  tb_arquivo: "arquivo", tb_bilhete_anonimo: "bilhete_anon",
  tb_catalogo_objeto: "catalogo_obj", tb_condicao_regra: "cond_regra",
  tb_config_plataforma: "config_plat", tb_identidade_oauth: "ident_oauth",
  tb_limite_requisicao_publica: "limite_req", tb_migracao: "migracao",
  tb_presenca_online: "presenca", tb_regra_condicional: "regra_cond",
  tb_usuario_identidade: "usu_ident", tl_email_participante: "email_part",
  tl_erro_aplicacao: "erro_aplic",
};

const LIMITE = 30;
const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** Identificador citado em maiúsculas — a forma final de todo objeto. */
const id = (base) => `"${base.toUpperCase()}"`;

function conexao() {
  const bruta = process.env.EMPRESA_DATABASE_URL?.trim();
  if (!bruta) throw new Error("EMPRESA_DATABASE_URL ausente.");
  const url = new URL(bruta.startsWith("jdbc:") ? bruta.slice(5) : bruta);
  return {
    host: url.hostname, port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user: process.env.MIGRATION_USERNAME_DATABASE_URL?.trim() || url.username,
    password: process.env.MIGRATION_PASSWORD_DATABASE_URL?.trim() || url.password,
  };
}

// --- Nomes de constraint e índice -------------------------------------------

const RUIDO = new Set(["fkey", "pkey", "key", "idx", "unique", "uniq", "fk", "pk", "index"]);
const PREFIXO_PADRAO = new Set(["in", "uk", "ck", "pk", "fk", "ib", "itm"]);

/** O termo que distingue o objeto, tirado do nome atual (foi escolhido por gente). */
function termoDistintivo(tabela, nomeAtual) {
  let tokens = nomeAtual.split("_");

  // 1º o prefixo do padrão, se o nome já o tiver (`uk_tb_catalogo_objeto_atual`).
  while (tokens.length > 1 && (RUIDO.has(tokens[0]) || PREFIXO_PADRAO.has(tokens[0]))) tokens = tokens.slice(1);

  // 2º o nome da tabela. Tolerante à posição porque nem todo nome começa pelo
  // prefixo de tipo: `ck_config_plataforma_...` sobre `tb_config_plataforma`.
  const tokensTabela = new Set(tabela.split("_"));
  while (tokens.length > 1 && tokensTabela.has(tokens[0])) tokens = tokens.slice(1);

  // 3º o ruído de cauda (`_fkey`, `_idx`, `_unique`).
  while (tokens.length > 1 && RUIDO.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  return tokens.filter(Boolean);
}

const encurtar = (tokens, n) => tokens.map((t) => (n && t.length > n ? t.slice(0, n) : t)).join("_");
const usados = new Set();

/**
 * Abreviar vem antes de descartar, e quando é preciso descartar sai o token da
 * esquerda: a especificidade mora no fim (`current_leader`). Sem isso, dois FKs
 * para a mesma tabela viram nomes que só diferem por truncamento.
 */
function nomear(prefixo, codigo, termo) {
  const tokens = termo.length ? termo : ["ref"];
  for (let descarte = 0; descarte < tokens.length; descarte += 1) {
    const restantes = tokens.slice(descarte);
    for (const nCod of [null, 6, 4, 3]) {
      for (const nTermo of [null, 8, 6, 5, 4, 3]) {
        const nome = `${prefixo}_${encurtar(codigo.split("_"), nCod)}_${encurtar(restantes, nTermo)}`;
        if (nome.length <= LIMITE && !usados.has(nome)) { usados.add(nome); return nome; }
      }
    }
  }
  throw new Error(`Não foi possível nomear ${prefixo}_${codigo}_${tokens.join("_")}`);
}
function reservar(nome) {
  if (usados.has(nome) || nome.length > LIMITE) throw new Error(`Nome inválido/colidido: ${nome}`);
  usados.add(nome);
  return nome;
}

// --- Programa ---------------------------------------------------------------

const cliente = new pg.Client(conexao());
await cliente.connect();

const { rows: tabelas } = await cliente.query(
  `select relname from pg_class where relnamespace = 'sigav'::regnamespace and relkind = 'r' order by relname`,
);
// nome atual -> nome base final (minúsculo); a caixa entra depois, via id().
const BASE = {};
for (const { relname } of tabelas) BASE[relname] = RENOMEIA[relname] ?? relname;
const ATUAIS = Object.keys(BASE);

for (const atual of ATUAIS) {
  if (!CODIGO[BASE[atual]]) throw new Error(`Falta CODIGO para ${BASE[atual]}`);
}

const partes = [];
const emitir = (s) => partes.push(s);

emitir(`-- Nomenclatura institucional em MAIÚSCULAS para o schema \`sigav\`.
--
-- Aplica o "Padrão Institucional de Nomenclatura" da AgSUS (UTIC, maio/2026,
-- v1.0 — PDTIC 2026-2027), Parte I:
--   item 3  — nomes em MAIÚSCULAS, singular, separados por underscore,
--             no máximo 30 caracteres;
--   item 4  — abreviação (só palavra com mais de 8 letras, até 2/3 do
--             tamanho, mínimo 2 caracteres);
--   item 6  — tabelas: prefixo por tipo (TB/TH/TL/RL/RT);
--   item 8  — chaves e índices: PK_/FK_/UK_/CK_/IN_.
--
-- CAIXA: PostgreSQL dobra identificador SEM aspas para minúscula, então
-- \`create table TB_PESSOA\` produziria \`tb_pessoa\`. Para o nome ser de fato
-- maiúsculo o identificador precisa ser citado, e a citação passa a ser
-- obrigatória em TODA referência daqui em diante:
--
--     select * from sigav."TB_PESSOA";   -- funciona
--     select * from sigav.TB_PESSOA;     -- procura tb_pessoa -> erro
--
-- ESCOPO: nomes de tabela, constraint e índice, nas ${ATUAIS.length} tabelas do schema.
-- Não renomeia colunas (são o contrato de retorno das RPCs), nem parâmetros de
-- RPC, nem chaves JSON. Triggers e políticas RLS seguem com o nome atual.
--
-- Corpo de função em PL/pgSQL é texto resolvido em execução, então não
-- acompanha o rename como view, política, trigger e FK acompanham. A seção 4
-- reescreve as funções afetadas, trocando SÓ referências qualificadas. Nome nu
-- neste schema é sempre chave JSON de retorno ou nome de parâmetro de RPC;
-- mexer nelas quebraria a tela. A exceção são os literais comparados a
-- \`tg_table_name\`, tratados adiante — \`tg_table_name\` devolve o nome real,
-- que agora é maiúsculo.
--
-- ANTES DE APLICAR NO db_dataware: as definições da seção 4 vieram da réplica
-- local. Se produção tiver drift (este cluster tem histórico), elas
-- sobrescreveriam a versão de lá. Regere o arquivo contra o alvo com
-- \`node scripts/gerar-nomenclatura-maiuscula.mjs\` e confira o diff. A seção 7
-- aborta a transação inteira se sobrar qualquer referência pendente.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabelas (itens 3 e 6)
-- ---------------------------------------------------------------------------
`);
for (const atual of ATUAIS) {
  const nota = RENOMEIA[atual] ? "" : "  -- só a caixa muda";
  emitir(`alter table sigav.${atual} rename to ${id(BASE[atual])};${nota}`);
}
emitir("");

// --- Constraints ------------------------------------------------------------
const { rows: constraints } = await cliente.query(
  `select rel.relname as tabela, c.conname as nome, c.contype as tipo, pai.relname as tabela_pai,
          coalesce((select array_agg(a.attname order by k.ord)
                    from unnest(c.conkey) with ordinality k(att, ord)
                    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.att)::text[], '{}'::text[]) as colunas
   from pg_constraint c
   join pg_class rel on rel.oid = c.conrelid
   left join pg_class pai on pai.oid = c.confrelid
   where rel.relnamespace = 'sigav'::regnamespace and rel.relkind = 'r'
   order by rel.relname, c.contype, c.conname`,
);

emitir(`-- ---------------------------------------------------------------------------
-- 2. Chaves e constraints (item 8)
-- ---------------------------------------------------------------------------
`);

const destino = new Map();
// PK leva o nome inteiro da tabela quando cabe nos 30 (é o que
// `pk_tb_migracao` já fazia); senão recorre à forma curta.
for (const c of constraints.filter((c) => c.tipo === "p")) {
  const cheio = `pk_${BASE[c.tabela]}`;
  const nome = cheio.length <= LIMITE ? cheio : `pk_${CODIGO[BASE[c.tabela]]}`;
  destino.set(`${c.tabela}|${c.nome}`, reservar(nome));
}
for (const c of constraints.filter((c) => c.tipo === "u")) {
  destino.set(`${c.tabela}|${c.nome}`, nomear("uk", CODIGO[BASE[c.tabela]], termoDistintivo(c.tabela, c.nome)));
}
// FK_[PAI]_[FILHO] e, quando há mais de uma ligação no mesmo par, com a coluna.
for (const c of constraints.filter((c) => c.tipo === "f")) {
  const filho = CODIGO[BASE[c.tabela]];
  const pai = CODIGO[BASE[c.tabela_pai]] ?? (c.tabela_pai || "ext").replace(/^(tb|tl|rl|rt|th)_/, "");
  const simples = `fk_${pai}_${filho}`;
  let novo;
  if (simples.length <= LIMITE && !usados.has(simples)) { usados.add(simples); novo = simples; }
  else novo = nomear("fk", `${pai}_${filho}`, [c.colunas[0].replace(/_id$/, "")]);
  destino.set(`${c.tabela}|${c.nome}`, novo);
}
for (const c of constraints.filter((c) => c.tipo === "c")) {
  destino.set(`${c.tabela}|${c.nome}`, nomear("ck", CODIGO[BASE[c.tabela]], termoDistintivo(c.tabela, c.nome)));
}

for (const c of constraints) {
  const novo = destino.get(`${c.tabela}|${c.nome}`);
  emitir(`alter table sigav.${id(BASE[c.tabela])} rename constraint ${c.nome} to ${id(novo)};`);
}
emitir("");

// --- Índices ----------------------------------------------------------------
const { rows: indices } = await cliente.query(
  `select rel.relname as tabela, idx.relname as nome, i.indisunique as unico,
          (select array_agg(a.attname order by k.ord)
           from unnest(i.indkey::int[]) with ordinality k(att, ord)
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.att)::text[] as colunas
   from pg_index i
   join pg_class idx on idx.oid = i.indexrelid
   join pg_class rel on rel.oid = i.indrelid
   where rel.relnamespace = 'sigav'::regnamespace and rel.relkind = 'r'
     and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
   order by rel.relname, idx.relname`,
);

emitir(`-- ---------------------------------------------------------------------------
-- 3. Índices (item 8) — IN_FK quando o índice sustenta exatamente uma FK
-- ---------------------------------------------------------------------------
`);
const colunasFk = new Set(
  constraints.filter((c) => c.tipo === "f").map((c) => `${c.tabela}|${c.colunas.join(",")}`),
);
for (const i of indices) {
  const cols = i.colunas || [];
  const prefixo = i.unico ? "uk" : (colunasFk.has(`${i.tabela}|${cols.join(",")}`) ? "in_fk" : "in");
  const novo = nomear(prefixo, CODIGO[BASE[i.tabela]], termoDistintivo(i.tabela, i.nome));
  emitir(`alter index sigav.${i.nome} rename to ${id(novo)};`);
}
emitir("");

// --- Funções ----------------------------------------------------------------
const { rows: funcoes } = await cliente.query(
  `select p.proname, pg_get_functiondef(p.oid) as definicao
   from pg_proc p where p.pronamespace = 'sigav'::regnamespace order by p.proname, p.oid`,
);

// Literais comparados a `tg_table_name`: precisam do nome REAL, agora maiúsculo.
const LITERAIS_TG = ["survey_sections", "survey_questions", "question_options"];

function reescrever(def, nomeFuncao) {
  let s = def;
  for (const atual of ATUAIS) {
    const alvo = `sigav.${id(BASE[atual])}`;
    s = s.replace(new RegExp(`\\bsigav\\.${atual}\\b`, "g"), alvo);
    s = s.replace(new RegExp(`\\bsigav\\."${atual}"`, "g"), alvo);
  }
  if (nomeFuncao === "FC_EXIGIR_RASCUNHO_ESTRUT") {
    for (const atual of LITERAIS_TG) {
      s = s.replace(
        new RegExp(`(tg_table_name\\s*=\\s*)'${atual}'`, "g"),
        `$1'${BASE[atual].toUpperCase()}'`,
      );
    }
  }
  // Comentário de linha inteira: cosmético, para não descrever schema que não existe.
  s = s.split("\n").map((l) => {
    if (!/^\s*--/.test(l)) return l;
    let x = l;
    for (const atual of ATUAIS) {
      x = x.replace(new RegExp(`\\b${atual}\\b`, "g"), BASE[atual].toUpperCase());
    }
    return x;
  }).join("\n");
  return s;
}

const afetadas = funcoes
  .map((f) => ({ ...f, nova: reescrever(f.definicao, f.proname) }))
  .filter((f) => f.nova !== f.definicao);

emitir(`-- ---------------------------------------------------------------------------
-- 4. Funções (${afetadas.length} de ${funcoes.length})
-- ---------------------------------------------------------------------------
`);
for (const f of afetadas) emitir(`${f.nova.trim()};\n`);

// --- Catálogo ---------------------------------------------------------------
const CAT = { tb: "TABELA", th: "TABELA", tl: "LOG", rl: "RELACIONAMENTO", rt: "RELACIONAMENTO" };
emitir(`-- ---------------------------------------------------------------------------
-- 5. CHECK do catálogo de governança
--
-- \`CK_CATALOGO_OBJ_PROPOSTO\` exigia \`no_objeto_proposto = lower(...)\` e
-- \`^[a-z0-9_]+$\`, o que proibia exatamente a caixa que o item 3 manda usar.
-- A regra de 30 caracteres continua.
-- ---------------------------------------------------------------------------

alter table sigav."TB_CATALOGO_OBJETO"
  drop constraint ${id(destino.get("tb_catalogo_objeto|ck_tb_catalogo_objeto_proposto"))};

-- As propostas já registradas foram escritas em minúsculas sob a regra antiga.
-- É o mesmo nome, na caixa que o item 3 manda — e sem isto o CHECK novo é
-- violado pelas linhas que já estão na tabela.
update sigav."TB_CATALOGO_OBJETO"
   set no_objeto_proposto = upper(no_objeto_proposto),
       dt_alteracao = timezone('utc', now())
 where no_objeto_proposto is not null
   and no_objeto_proposto <> upper(no_objeto_proposto);

alter table sigav."TB_CATALOGO_OBJETO"
  add constraint ${id(destino.get("tb_catalogo_objeto|ck_tb_catalogo_objeto_proposto"))} check (
    no_objeto_proposto is null
    or (
      char_length(no_objeto_proposto) <= 30
      and no_objeto_proposto = upper(no_objeto_proposto)
      and no_objeto_proposto ~ '^[A-Z0-9_]+$'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Registro no catálogo
-- ---------------------------------------------------------------------------

insert into sigav."TB_CATALOGO_OBJETO" (
  sg_schema_atual, no_objeto_atual, tp_objeto, no_objeto_proposto,
  st_conformidade, ds_justificativa, ds_estrategia_migracao
) values`);

const linhas = ATUAIS.map((atual) => {
  const base = BASE[atual];
  const prefixo = base.slice(0, 2);
  const just = RENOMEIA[atual]
    ? `Renomeada de ${atual} e posta em maiúsculas conforme os itens 3 e 6 (prefixo ${prefixo.toUpperCase()}_).`
    : `Já estava no padrão de palavra; posta em maiúsculas conforme o item 3.`;
  return `  ('sigav', ${quote(base.toUpperCase())}, ${quote(CAT[prefixo])}, ${quote(base.toUpperCase())}, 'CONFORME', `
    + `${quote(just)}, ${quote("Rename fisico concluido; identificador citado. Colunas, parametros de RPC e chaves JSON preservados.")})`;
});
emitir(`${linhas.join(",\n")}
on conflict (sg_schema_atual, no_objeto_atual, tp_objeto) do update
set no_objeto_proposto = excluded.no_objeto_proposto,
    st_conformidade    = excluded.st_conformidade,
    ds_justificativa   = excluded.ds_justificativa,
    ds_estrategia_migracao = excluded.ds_estrategia_migracao,
    dt_alteracao       = timezone('utc', now());

-- As entradas antigas descrevem objetos que não existem mais.
update sigav."TB_CATALOGO_OBJETO"
   set st_registro_ativo = 'N',
       dt_alteracao = timezone('utc', now())
 where sg_schema_atual = 'sigav'
   and no_objeto_atual in (${ATUAIS.map(quote).join(", ")});
`);

// --- Autoverificação --------------------------------------------------------
emitir(`-- ---------------------------------------------------------------------------
-- 7. Autoverificação
--
-- Se o banco de destino tiver função que este arquivo não conhece (drift), ela
-- seguiria apontando para tabela que acabou de deixar de existir. Melhor
-- abortar a transação do que deixar o schema meio renomeado.
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_antigas text[] := array[${ATUAIS.map(quote).join(", ")}];
  v_nome    text;
  v_restos  text;
  v_fora    text;
begin
  foreach v_nome in array v_antigas loop
    select string_agg(p.proname, ', ' order by p.proname) into v_restos
      from pg_proc p
     where p.pronamespace = 'sigav'::regnamespace
       and pg_get_functiondef(p.oid) ~ ('sigav\\.' || v_nome || '\\y');

    if v_restos is not null then
      raise exception 'Funções ainda referenciam sigav.% sem aspas: %', v_nome, v_restos;
    end if;
  end loop;

  select string_agg(relname, ', ' order by relname) into v_fora
    from pg_class
   where relnamespace = 'sigav'::regnamespace and relkind = 'r'
     and relname <> upper(relname);
  if v_fora is not null then
    raise exception 'Tabelas fora da caixa do padrão: %', v_fora;
  end if;

  select string_agg(conname, ', ' order by conname) into v_fora
    from pg_constraint
   where connamespace = 'sigav'::regnamespace and conname <> upper(conname);
  if v_fora is not null then
    raise exception 'Constraints fora da caixa do padrão: %', v_fora;
  end if;

  raise notice 'nomenclatura: ${ATUAIS.length} tabelas em MAIÚSCULAS, nenhuma referência pendente';
end
$verificacao$;

commit;`);

console.log(partes.join("\n"));
console.error(`tabelas=${ATUAIS.length} constraints=${constraints.length} indices=${indices.length} funcoes=${afetadas.length}/${funcoes.length}`);
await cliente.end();
