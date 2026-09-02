// Gateway RPC — POC de conectividade.
//
//   Vercel Preview → HTTPS (túnel) → este processo → VPN Sophos → db_dataware
//
// Roda na máquina conectada à VPN. O PostgreSQL continua alcançável só daqui:
// a porta 5432 não é publicada nem tunelada. O que atravessa a internet é uma
// única porta HTTP deste servidor, e só ela.
//
// ## Por que não é um proxy de SQL
//
// Este processo **não executa SQL arbitrário**. Ele aceita um nome de função e
// um objeto de argumentos, e só prossegue se o nome estiver em
// `rpc-permissions.ts` — a mesma allowlist versionada que o adaptador já usa.
// Nome fora da lista é recusado antes de qualquer conexão com o banco.
//
// ## Por que importa os contratos em vez de copiá-los
//
// `rpc-permissions`, `rpc-return-shape` e `rpc-json-args` são importados dos
// arquivos do próprio projeto. Cópia divergiria na primeira RPC nova, e a
// divergência apareceria como "função não encontrada" em produção, não aqui.
// O Node deste projeto lê `.ts` diretamente — `tests/banco/contrato-rpc.test.mjs`
// já depende disso.

import { createServer } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import pg from "pg";

import { RPC_PERMISSIONS, isRpcAllowedForRole } from "../src/lib/db/rpc-permissions.ts";
import { RPC_RETURN_SHAPE } from "../src/lib/db/rpc-return-shape.ts";
import { RPC_JSON_ARGS } from "../src/lib/db/rpc-json-args.ts";

const PORTA = Number(process.env.GATEWAY_PORT || 8787);
const SEGREDO = process.env.GATEWAY_TOKEN;
const LIMITE_CORPO = 1_048_576; // 1 MB
const TIMEOUT_BANCO = 8_000;

if (!SEGREDO || SEGREDO.length < 32) {
  console.error("GATEWAY_TOKEN ausente ou curto demais (mínimo 32 caracteres).");
  process.exit(1);
}

const SCHEMA = "sigav";
const PAPEIS = new Set(["anon", "authenticated", "service_role"]);

// ---------------------------------------------------------------------------
// Banco — igual ao pool da aplicação, e sempre dentro da rede privada.
// ---------------------------------------------------------------------------

const url = new URL(String(process.env.EMPRESA_DATABASE_URL).replace(/^jdbc:/, ""));
const pool = new pg.Pool({
  host: url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.replace(/^\//, ""),
  user: process.env.USERNAME_DATABASE_URL,
  password: process.env.PASSWORD_DATABASE_URL,
  ssl: false, // trecho interno, dentro da VPN — o trecho externo é HTTPS
  max: 5,
  connectionTimeoutMillis: TIMEOUT_BANCO,
  application_name: "gateway-rpc-poc",
});

function aspas(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function formatar(nome, resultado) {
  const forma = RPC_RETURN_SHAPE[nome] ?? "set";
  if (forma === "void") return null;
  if (forma === "set") return resultado.rows;
  const linha = resultado.rows[0];
  if (!linha) return null;
  const colunas = Object.keys(linha);
  return colunas.length === 1 ? linha[colunas[0]] : linha;
}

async function executar(nome, argumentos, papel, claims) {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");

    // As claims são remontadas aqui, e o papel é imposto pelo gateway — não
    // vem do corpo da requisição. Assim uma claim `role` forjada não promove
    // ninguém: quem decide é a allowlist, conferida antes.
    const efetivas = { ...(claims ?? {}), role: papel };
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(efetivas)]);
    await cliente.query("select set_config('request.jwt.claim.role', $1, true)", [papel]);
    if (typeof efetivas.sub === "string") {
      await cliente.query("select set_config('request.jwt.claim.sub', $1, true)", [efetivas.sub]);
    }

    const jsonArgs = new Set(RPC_JSON_ARGS[nome] ?? []);
    const nomes = Object.keys(argumentos);
    const chamada = nomes.map((n, i) => `${aspas(n)} => $${i + 1}`).join(", ");
    const valores = nomes.map((n) => {
      const v = argumentos[n];
      if (jsonArgs.has(n) && v !== null && v !== undefined && typeof v !== "string") return JSON.stringify(v);
      return v;
    });

    const sql = `select * from ${SCHEMA}.${aspas(nome)}(${chamada})`;
    const resultado = await cliente.query(sql, valores);
    await cliente.query("commit");
    return { data: formatar(nome, resultado), error: null };
  } catch (erro) {
    await cliente.query("rollback").catch(() => {});
    return { data: null, error: { code: erro.code ?? "GATEWAY_DB", message: erro.message } };
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function autenticado(req) {
  const cabecalho = req.headers.authorization ?? "";
  const enviado = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  const a = Buffer.from(enviado);
  const b = Buffer.from(SEGREDO);
  // Comprimentos diferentes já reprovam; `timingSafeEqual` exige tamanhos iguais.
  return a.length === b.length && timingSafeEqual(a, b);
}

function responder(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
    "Cache-Control": "no-store",
  });
  res.end(texto);
}

const erro = (code, message) => ({ data: null, error: { code, message } });

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", (p) => {
      tamanho += p.length;
      if (tamanho > LIMITE_CORPO) {
        reject(Object.assign(new Error("corpo acima de 1 MB"), { excedeu: true }));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}

const servidor = createServer(async (req, res) => {
  const inicio = performance.now();
  const rota = new URL(req.url, "http://gateway").pathname;

  // Liveness sem autenticação e sem banco: serve para o túnel provar que está
  // de pé sem que isso revele nada nem gaste conexão.
  if (req.method === "GET" && rota === "/saude") {
    return responder(res, 200, { status: "ok", servico: "gateway-rpc-poc" });
  }

  if (req.method !== "POST" || rota !== "/rpc") {
    return responder(res, 404, erro("GATEWAY_ROTA", "Use POST /rpc."));
  }

  if (!autenticado(req)) {
    console.warn("[gateway] 401 sem credencial de serviço");
    return responder(res, 401, erro("GATEWAY_AUTH", "Credencial de serviço ausente ou inválida."));
  }

  let corpo;
  try {
    corpo = JSON.parse(await lerCorpo(req));
  } catch (e) {
    if (e.excedeu) return responder(res, 413, erro("GATEWAY_TAMANHO", "Corpo acima do limite de 1 MB."));
    return responder(res, 400, erro("GATEWAY_JSON", "Corpo não é JSON válido."));
  }

  const { funcao, argumentos = {}, papel, claims = null } = corpo ?? {};

  if (typeof funcao !== "string" || !funcao) {
    return responder(res, 400, erro("GATEWAY_ENTRADA", "Informe `funcao`."));
  }
  if (!PAPEIS.has(papel)) {
    return responder(res, 400, erro("GATEWAY_ENTRADA", "`papel` deve ser anon, authenticated ou service_role."));
  }
  if (argumentos === null || typeof argumentos !== "object" || Array.isArray(argumentos)) {
    return responder(res, 400, erro("GATEWAY_ENTRADA", "`argumentos` deve ser um objeto."));
  }
  if (claims !== null && (typeof claims !== "object" || Array.isArray(claims))) {
    return responder(res, 400, erro("GATEWAY_ENTRADA", "`claims` deve ser objeto ou nulo."));
  }
  // `sub` é o que vira FC_UID_SESSAO(); formato inválido não deve chegar ao banco.
  if (claims?.sub !== undefined && claims.sub !== null && typeof claims.sub !== "string") {
    return responder(res, 400, erro("GATEWAY_ENTRADA", "`claims.sub` deve ser texto."));
  }

  // A recusa acontece **antes** de qualquer conexão: nome fora da allowlist não
  // chega perto do banco. Mesmo código 42501 que o adaptador direto devolve, de
  // modo que as rotas não distinguem um transporte do outro.
  if (!(funcao in RPC_PERMISSIONS)) {
    console.warn("[gateway] 403 fora da allowlist:", funcao);
    return responder(res, 403, erro("42501", `Acesso restrito: "${funcao}" não está na allowlist.`));
  }
  if (!isRpcAllowedForRole(funcao, papel)) {
    console.warn("[gateway] 403 papel sem permissão:", funcao, papel);
    return responder(res, 403, erro("42501", `Acesso restrito: "${funcao}" não está liberada para o papel "${papel}".`));
  }

  const id = randomUUID().slice(0, 8);
  const resultado = await executar(funcao, argumentos, papel, claims);
  const ms = Math.round(performance.now() - inicio);
  console.log(`[gateway] ${id} ${funcao} papel=${papel} ${resultado.error ? "erro=" + resultado.error.code : "ok"} ${ms}ms`);

  res.setHeader("X-Gateway-Ms", String(ms));
  return responder(res, 200, resultado);
});

servidor.headersTimeout = 15_000;
servidor.requestTimeout = 20_000;

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`gateway-rpc ouvindo em http://127.0.0.1:${PORTA}`);
  console.log(`allowlist: ${Object.keys(RPC_PERMISSIONS).length} funções`);
});
