// Validação estática das migrations. Não precisa de banco, roda em qualquer
// lugar — inclusive no CI, que desde a unificação de schemas não consegue mais
// reconstruir o banco quando a cópia local não tem os objetos necessários.
//
// Uso:
//   node scripts/validar-migrations.mjs
//
// O QUE ISTO PEGA, E POR QUÊ. A conferência que importa — chamar as RPCs contra
// uma cópia do banco réplica — exige dado que o CI não tem. O que sobra para a
// automação é o que dá para afirmar lendo os arquivos, e a regra mais valiosa é
// a segunda abaixo: depois de 28/08/2026 os schemas `public`, `private`,
// `db_governanca`, `"DB_PESQUISAS"` e `auth` não existem mais, e uma migration
// nova que os cite compila sem reclamar e só quebra quando alguém usa a tela.
// Foi exatamente essa a forma do defeito daquele dia.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRETORIO = path.join(RAIZ, "database", "migrations");

// A partir desta migration o banco tem um schema só. As anteriores citam os
// schemas antigos legitimamente — é o histórico de como se chegou aqui — e não
// devem ser reescritas.
const CORTE_SCHEMA_UNICO = "20260828110000";

const SCHEMAS_REMOVIDOS = [
  { padrao: /\bpublic\.[a-z_]/g, nome: "public." },
  { padrao: /\bprivate\.[a-z_]/g, nome: "private." },
  { padrao: /\bdb_governanca\./g, nome: "db_governanca." },
  { padrao: /"DB_PESQUISAS"/g, nome: '"DB_PESQUISAS"' },
  { padrao: /\bauth\.(uid|role|jwt|email|users|identities)\b/g, nome: "auth." },
  { padrao: /\bextensions\.[a-z_]/g, nome: "extensions." },
];

const NOME_VALIDO = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

/** Remove comentários de linha e de bloco, para não acusar menção em prosa. */
function semComentarios(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((linha) => {
      const corte = linha.indexOf("--");
      return corte === -1 ? linha : linha.slice(0, corte);
    })
    .join("\n");
}

async function main() {
  const arquivos = (await readdir(DIRETORIO))
    .filter((n) => n.toLowerCase().endsWith(".sql"))
    .sort();

  const problemas = [];
  const timestamps = new Map();

  for (const arquivo of arquivos) {
    const correspondencia = NOME_VALIDO.exec(arquivo);

    if (!correspondencia) {
      problemas.push(`${arquivo}: nome fora do padrão AAAAMMDDHHMMSS_nome_em_snake_case.sql`);
      continue;
    }

    const [, versao] = correspondencia;

    if (timestamps.has(versao)) {
      problemas.push(`${arquivo}: timestamp repetido, já usado por ${timestamps.get(versao)}`);
    }
    timestamps.set(versao, arquivo);

    if (versao <= CORTE_SCHEMA_UNICO) continue;

    const conteudo = semComentarios(await readFile(path.join(DIRETORIO, arquivo), "utf8"));
    for (const { padrao, nome } of SCHEMAS_REMOVIDOS) {
      const ocorrencias = conteudo.match(padrao);
      if (ocorrencias) {
        problemas.push(
          `${arquivo}: cita \`${nome}\` (${ocorrencias.length}x), mas esse schema não existe mais. ` +
          "Use `sigav.`; para claims da sessão, `sigav.fc_uid_sessao()`, `fc_papel_sessao()` ou `fc_claims_sessao()`.",
        );
      }
    }
  }

  console.log(`${arquivos.length} migration(s) verificada(s).`);

  if (problemas.length) {
    console.error(`\n${problemas.length} problema(s):\n`);
    for (const p of problemas) console.error(`  ${p}`);
    process.exit(1);
  }

  console.log("Nomes válidos, timestamps únicos e nenhuma referência a schema removido.");
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
