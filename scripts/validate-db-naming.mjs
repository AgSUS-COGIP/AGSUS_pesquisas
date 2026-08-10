import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
};

function isLegacyRestored(file, kind, name) {
  return LEGACY_RESTORED_OBJECTS[file]?.[kind]?.has(name) === true;
}

function changedMigrationFiles() {
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", `${BASE_REF}...HEAD`, "--", "supabase/migrations"],
      { encoding: "utf8" },
    );
    return output
      .split("\n")
      .map((value) => value.trim())
      .filter((value) => migrationPattern.test(value));
  } catch {
    return [];
  }
}

function normalize(identifier) {
  return identifier.replaceAll('"', "").split(".").at(-1)?.toLowerCase() || "";
}

function assertName(errors, file, kind, rawName, pattern, maxLength = 30) {
  const name = normalize(rawName);
  // A dispensa vale só para o prefixo: tamanho e caracteres permitidos continuam
  // cobrados, porque nada em objeto legado justifica violá-los.
  if (!pattern.test(name) && !isLegacyRestored(file, kind, name)) {
    errors.push(`${file}: ${kind} '${name}' não segue o prefixo institucional.`);
  }
  if (name.length > maxLength) {
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
