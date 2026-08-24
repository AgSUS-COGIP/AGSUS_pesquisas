#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerVersoesMigrations, verificarMigrations } from "./lib/contrato-migrations.mjs";
import { variavel } from "./lib/contrato-rpc.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

async function principal() {
  const versoes = lerVersoesMigrations(RAIZ);
  const resultado = await verificarMigrations({
    url: variavel("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    chave: variavel("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    versoes,
  });

  if (resultado.situacao === "compativel") {
    console.log(`Histórico de migrations alinhado: ${resultado.conferidas} versão(ões) conferida(s).`);
    return;
  }

  if (resultado.situacao === "indisponivel") {
    console.error(`Verificação de migrations falhou: ${resultado.motivo}`);
    if (resultado.detalhe) console.error(resultado.detalhe);
    process.exitCode = 1;
    return;
  }

  console.error(`Histórico de migrations incompleto: ${resultado.ausentes.length} versão(ões) ausente(s).`);
  for (const versao of resultado.ausentes) console.error(`  - ${versao}`);
  if (resultado.ultimaAplicada) console.error(`Última versão registrada no banco: ${resultado.ultimaAplicada}`);
  process.exitCode = 1;
}

await principal();
