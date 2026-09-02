import type { QueryResult } from "pg";
import { DATABASE_SCHEMA } from "./schema";
import { getEmpresaDbPool } from "./pool";
import { getCurrentAuthClaims } from "./current-claims";
import { RPC_PERMISSIONS, isRpcAllowedForRole, type RpcRole } from "./rpc-permissions";
import { RPC_RETURN_SHAPE } from "./rpc-return-shape";
import { RPC_JSON_ARGS } from "./rpc-json-args";

export type { RpcRole } from "./rpc-permissions";

/** Mesmo formato que `resposta-http.ts` já sabe interpretar vindo do banco. */
export type RpcError = {
  code?: string;
  message?: string;
  details?: string | null;
};

export type RpcResult<T = unknown> = { data: T | null; error: RpcError | null };

/**
 * Traduz o SQLSTATE nativo para o código que o restante do app já espera.
 *
 * `resposta-http.ts` já entende SQLSTATE direto (`42501`, `23505`, `P0001`,
 * `22P02`) — só os códigos `PGRST*` eram invenção do PostgREST. Um deles
 * carrega comportamento que não pode ser perdido: `PGRST202` ("função não
 * existe no schema") vira 501 com a mensagem "confirme o deploy e as
 * migrations", e é usado como sinal de rollout app-before-db em
 * `public-rate-limit.ts` e em `GET /api/plataforma/marca`. O equivalente
 * nativo é `42883` (undefined_function).
 */
function traduzirCodigoErro(code: string | undefined): string | undefined {
  if (code === "42883") return "PGRST202";
  return code;
}

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function shapeResult(functionName: string, result: QueryResult): unknown {
  const shape = RPC_RETURN_SHAPE[functionName];

  if (shape === "void") return null;
  if (shape === "set") return result.rows;

  if (shape === undefined) {
    // Não deveria acontecer — rpc-permissions.ts e rpc-return-shape.ts são
    // gerados a partir do mesmo conjunto de nomes. Se divergirem (ex.: um foi
    // regenerado e o outro não), erra para o lado seguro em vez de arriscar
    // devolver a linha inteira quando o chamador espera um valor escalar.
    console.warn(`[rpc-adapter] "${functionName}" sem metadado de shape — tratando como "set".`);
    return result.rows;
  }

  // "scalar": uma linha, uma coluna.
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const [value] = Object.values(row);
  return value ?? null;
}

/**
 * Executa uma RPC de `sigav` na conexão direta com db_dataware, reproduzindo
 * o contrato HTTP anterior: `{ data, error }`, com
 * `error` no formato que `resposta-http.ts` já sabe mapear para status HTTP.
 *
 * `role` decide o que `isRpcAllowedForRole` autoriza — é a única barreira que
 * separa uma sessão comum de uma função de cron/serviço, já que não existem
 * mais roles no Postgres para isso (ver rpc-permissions.ts). `claims` vira o
 * `request.jwt.claims` que os corpos das funções continuam lendo — hoje por
 * `sigav."FC_UID_SESSAO"()`/`fc_papel_sessao()`/`fc_claims_sessao()`, que
 * sucederam `auth.uid()`/`auth.role()`/`auth.jwt()` quando o schema `auth` foi
 * absorvido por `sigav`. O formato das claims não mudou.
 */
/**
 * Transporte HTTPS até o gateway na rede da AgSUS.
 *
 * O segredo vive só no servidor: `GATEWAY_TOKEN` não tem prefixo
 * `NEXT_PUBLIC_`, então o bundle do navegador nunca o vê — e esta função só
 * roda em rotas de servidor, que é de onde `executeRpc` já era chamada.
 *
 * O timeout externo (12s) é maior que o do banco no gateway (8s) de propósito:
 * assim o erro que chega aqui é o do PostgreSQL, com código e mensagem reais,
 * em vez de um aborto genérico que esconderia a causa.
 */
async function executeRpcViaGateway(
  functionName: string,
  args: Record<string, unknown>,
  role: RpcRole,
  claims: Record<string, unknown> | null,
): Promise<RpcResult> {
  const base = process.env.GATEWAY_URL!.replace(/\/+$/, "");
  const token = process.env.GATEWAY_TOKEN;

  if (!token) {
    return { data: null, error: { code: "GATEWAY_CONFIG", message: "GATEWAY_TOKEN não configurado." } };
  }

  const cancelamento = AbortSignal.timeout(12_000);

  try {
    const resposta = await fetch(`${base}/rpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ funcao: functionName, argumentos: args, papel: role, claims }),
      signal: cancelamento,
      cache: "no-store",
    });

    const corpo = (await resposta.json()) as RpcResult;

    // 401/403/413 já chegam no formato `{ data, error }`; devolver como está
    // mantém as rotas idênticas nos dois transportes.
    if (corpo && typeof corpo === "object" && ("data" in corpo || "error" in corpo)) {
      return corpo;
    }

    return { data: null, error: { code: "GATEWAY_RESPOSTA", message: `Resposta inesperada (${resposta.status}).` } };
  } catch (err) {
    const causa = err as { name?: string; message?: string };
    const timeout = causa.name === "TimeoutError" || causa.name === "AbortError";
    return {
      data: null,
      error: {
        code: timeout ? "GATEWAY_TIMEOUT" : "GATEWAY_INDISPONIVEL",
        message: timeout ? "O gateway não respondeu a tempo." : `Falha ao alcançar o gateway: ${causa.message ?? "desconhecida"}`,
      },
    };
  }
}

export async function executeRpc(
  functionName: string,
  args: Record<string, unknown> = {},
  role: RpcRole,
  claims: Record<string, unknown> | null = null,
): Promise<RpcResult> {
  if (!isRpcAllowedForRole(functionName, role)) {
    return {
      data: null,
      error: {
        code: "42501",
        message: `Acesso restrito: "${functionName}" não está liberada para o papel "${role}".`,
      },
    };
  }

  /*
    Transporte intercambiável.

    Com `GATEWAY_URL` configurada, a chamada sai por HTTPS até um gateway dentro
    da rede da AgSUS, que executa a mesma RPC contra o mesmo banco. Sem ela, o
    caminho é o de sempre: conexão direta.

    A troca é aqui, e só aqui, porque este já era o ponto único de acoplamento —
    nenhuma das 90 rotas precisa saber por onde a chamada foi. O formato de
    retorno é o mesmo `{ data, error }` nos dois casos, incluindo o `42501` de
    RPC fora da allowlist, que o gateway devolve com o mesmo código.

    No modo gateway, `EMPRESA_DATABASE_URL` e as credenciais do PostgreSQL não
    precisam existir neste ambiente: quem conecta ao banco é o gateway.
  */
  if (process.env.GATEWAY_URL) {
    return executeRpcViaGateway(functionName, args, role, claims);
  }

  const pool = getEmpresaDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const effectiveClaims: Record<string, unknown> = { ...(claims ?? {}), role };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(effectiveClaims)]);
    await client.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
    if (typeof effectiveClaims.sub === "string") {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [effectiveClaims.sub]);
    }

    const jsonArgNames = new Set(RPC_JSON_ARGS[functionName] ?? []);
    const argNames = Object.keys(args);
    const callArgs = argNames.map((name, i) => `${quoteIdent(name)} => $${i + 1}`).join(", ");
    const values = argNames.map((name) => {
      const value = args[name];
      // node-postgres não serializa objeto/array JS para JSON ao vincular
      // parâmetro — vira "[object Object]" ou um array literal do Postgres.
      // Argumentos jsonb precisam do JSON.stringify explícito.
      if (jsonArgNames.has(name) && value !== null && value !== undefined && typeof value !== "string") {
        return JSON.stringify(value);
      }
      return value;
    });
    const sql = `select * from ${DATABASE_SCHEMA}.${quoteIdent(functionName)}(${callArgs})`;

    const result = await client.query(sql, values);
    await client.query("commit");

    return { data: shapeResult(functionName, result), error: null };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    const pgErr = err as { code?: string; message?: string; detail?: string };
    return {
      data: null,
      error: {
        code: traduzirCodigoErro(pgErr.code),
        message: pgErr.message,
        details: pgErr.detail ?? null,
      },
    };
  } finally {
    client.release();
  }
}

type RpcClient = { rpc: (functionName: string, args?: Record<string, unknown>) => Promise<RpcResult> };

/**
 * Cliente para chamadas feitas em nome da sessão logada.
 */
export async function createServerRpcClient(): Promise<RpcClient> {
  const claims = await getCurrentAuthClaims();
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "authenticated", claims),
  };
}

/** Cliente de serviço, sem sessão de usuário. */
export function createAdminRpcClient(): RpcClient {
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "service_role", { role: "service_role" }),
  };
}

/** Cliente público, sem sessão de usuário. */
export function createPublicRpcClient(): RpcClient {
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "anon", { role: "anon" }),
  };
}

export { RPC_PERMISSIONS, isRpcAllowedForRole };
