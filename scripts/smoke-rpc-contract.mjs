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

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lerContratoCritico, variavel, verificarContrato } from "./lib/contrato-rpc.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
  A leitura do contrato e a consulta ao banco moram em ./lib/contrato-rpc.mjs,
  compartilhadas com o portao de deploy (vercel-ignore-build.mjs). Sao a mesma
  pergunta feita dos dois lados: aqui depois de aplicar as migrations, la' antes
  de publicar a aplicacao. Duas copias divergiriam na primeira correcao, e a
  divergencia apareceria como um deploy aprovado por um criterio e recusado pelo
  outro, sem nada explicando por que.
*/
async function principal() {
  const resultado = await verificarContrato({
    url: variavel("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    chave: variavel("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    nomes: lerContratoCritico(RAIZ),
  });

  if (resultado.situacao === "compativel") {
    console.log(`Contrato de RPC íntegro: ${resultado.conferidas} função(ões) conferida(s).`);
    return;
  }

  if (resultado.situacao === "indisponivel") {
    console.error(`Verificação de contrato falhou: ${resultado.motivo}`);
    if (resultado.detalhe) console.error(resultado.detalhe);
    process.exitCode = 1;
    return;
  }

  console.error(`Contrato de RPC incompleto: ${resultado.ausentes.length} de ${resultado.conferidas} ausente(s).`);
  for (const nome of resultado.ausentes) console.error(`  - ${nome}`);
  console.error("");
  console.error("A aplicacao NAO deve ser promovida neste estado: publicar agora reproduz");
  console.error("o PGRST202 que derrubou a plataforma em 10/08/2026 e em 20/08/2026.");
  process.exitCode = 1;
}

await principal();
