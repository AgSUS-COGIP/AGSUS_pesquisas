#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

if (process.env.VERCEL_ENV !== "production") process.exit(1);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("[db-gate] credenciais do Supabase ausentes; build de produção bloqueado.");
  process.exit(0);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "Content-Profile": "sigav",
};

async function rpc(name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} respondeu ${response.status}`);
  return response.json();
}

const versions = readdirSync(join(process.cwd(), "supabase", "migrations"))
  .map((name) => name.match(/^(\d{14})_.+\.sql$/)?.[1])
  .filter(Boolean);

const timeoutAt = Date.now() + 10 * 60 * 1000;
let migrationState;
while (Date.now() < timeoutAt) {
  migrationState = await rpc("fc_srv_verificar_migrations", { p_versoes: versions });
  if (migrationState?.compatible === true) break;
  console.log(`[db-gate] aguardando ${migrationState?.missing?.length ?? "?"} migration(ões)...`);
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

if (migrationState?.compatible !== true) {
  console.error("[db-gate] banco ainda não recebeu todas as migrations; build bloqueado.");
  process.exit(0);
}

const source = readFileSync(join(process.cwd(), "src", "lib", "rpc-criticas.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
const block = source.match(/RPCS_CRITICAS\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? "";
const names = [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);

const rpcState = await rpc("fc_srv_verificar_contrato_rpc", { p_nomes: names });
if (rpcState?.compatible !== true) {
  console.error(`[db-gate] RPCs críticas ausentes: ${(rpcState?.missing ?? []).join(", ")}`);
  process.exit(0);
}

console.log(`[db-gate] banco alinhado: ${versions.length} migrations e ${names.length} RPCs críticas.`);
process.exit(1);
