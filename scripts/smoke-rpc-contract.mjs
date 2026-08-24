#!/usr/bin/env node
/**
 * Smoke test de contrato: as RPCs críticas existem no ambiente-alvo?
 *
 * ## Por que existe, se já há `db:rpc`
 *
 * `npm run db:rpc` confere o inventário completo contra o banco **reconstruído
 * pelas migrations**, no CI. Ele prova que o repositório é coerente consigo
 * mesmo — não que o ambiente onde a aplicação vai rodar recebeu aquelas
 * migrations. Essa distinção é exatamente o que faltou em 10/08/2026 e de novo
 * em 20/08/2026: as migrations existiam no repositório e não estavam aplicadas.
 *
 * Este script pergunta ao banco real, depois do `db push`, e antes de promover
 * a aplicação.
 *
 * ## Uso
 *
 * ```bash
 * SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/smoke-rpc-contract.mjs
 * ```
 *
 * Sai com `0` quando o contrato está completo, `1` quando falta alguma função —
 * e imprime **quais**, porque quem opera precisa saber o que aplicar.
 *
 * Diferente da rota `/api/health/readiness`, que é anônima e só devolve
 * `ready`/`degraded`, aqui o detalhe é o produto: o canal é o log do CI.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lê a lista do TypeScript em vez de duplicá-la aqui.
 *
 * Duas cópias do contrato divergiriam na primeira RPC nova — e a divergência
 * seria silenciosa, que é o pior tipo. O arquivo é uma lista de literais, então
 * extrair por regex é suficiente e evita depender de um passo de build.
 */
function lerContrato() {
  const fonte = readFileSync(join(RAIZ, "src/lib/rpc-criticas.ts"), "utf8");
  const bloco = fonte.match(/RPCS_CRITICAS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!bloco) throw new Error("Não foi possível ler RPCS_CRITICAS de src/lib/rpc-criticas.ts");

  /*
    Os comentários saem antes da extração.

    O padrão casa qualquer literal entre aspas dentro do bloco, e o bloco tem
    comentários explicando por que cada nome está ali. Bastava um deles citar
    uma RPC entre aspas duplas para o smoke passar a exigir do banco uma função
    que ninguém chama — e o portão de deploy barraria uma publicação correta,
    ou, pior, mediria contrato diferente do que a aplicação usa.

    Não é hipótese: o comentário sobre `fc_obter_formulario_publico` foi escrito
    logo abaixo, e só não quebrou porque usa crase.
  */
  const semComentarios = bloco[1]
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

  const nomes = [...semComentarios.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  if (!nomes.length) throw new Error("RPCS_CRITICAS está vazia.");
  return nomes;
}

function variavel(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor && valor.trim()) return valor.trim();
  }
  return "";
}

async function principal() {
  const url = variavel("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const chave = variavel("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !chave) {
    console.error("Faltam SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).");
    process.exitCode = 1;
    return;
  }

  const nomes = lerContrato();
  const resposta = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/fc_srv_verificar_contrato_rpc`, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_nomes: nomes }),
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    // A própria função de verificação pode faltar — e isso **é** o defeito que
    // o script procura, não um erro de infraestrutura a ser tolerado.
    console.error(`Verificação de contrato falhou (HTTP ${resposta.status}): ${texto}`);
    console.error("Se o erro citar fc_srv_verificar_contrato_rpc, a migration que a cria não foi aplicada.");
    process.exitCode = 1;
    return;
  }

  const resultado = JSON.parse(texto);
  if (resultado?.compatible) {
    console.log(`Contrato de RPC íntegro: ${resultado.checked} função(ões) conferida(s).`);
    return;
  }

  const ausentes = Array.isArray(resultado?.missing) ? resultado.missing : [];
  console.error(`Contrato de RPC incompleto: ${ausentes.length} de ${resultado?.checked} ausente(s).`);
  for (const nome of ausentes) console.error(`  - ${nome}`);
  console.error("");
  console.error("A aplicação NÃO deve ser promovida neste estado: publicar agora reproduz");
  console.error("o PGRST202 que derrubou a plataforma em 10/08/2026 e em 20/08/2026.");
  process.exitCode = 1;
}

await principal();
