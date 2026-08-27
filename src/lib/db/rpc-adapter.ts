import type { QueryResult } from "pg";
import { SUPABASE_DB_SCHEMA } from "@/lib/supabase/schema";
import { getEmpresaDbPool } from "./pool";
import { getCurrentAuthClaims } from "./current-claims";
import { RPC_PERMISSIONS, isRpcAllowedForRole, type RpcRole } from "./rpc-permissions";
import { RPC_RETURN_SHAPE } from "./rpc-return-shape";
import { RPC_JSON_ARGS } from "./rpc-json-args";

export type { RpcRole } from "./rpc-permissions";

/** Mesmo formato que `resposta-http.ts` já sabe interpretar vindo do Supabase. */
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
 * o contrato que `supabase-js`/`PostgREST` davam: `{ data, error }`, com
 * `error` no formato que `resposta-http.ts` já sabe mapear para status HTTP.
 *
 * `role` decide o que `isRpcAllowedForRole` autoriza — é a única barreira que
 * separa uma sessão comum de uma função de cron/serviço, já que não existem
 * mais roles no Postgres para isso (ver rpc-permissions.ts). `claims` vira o
 * `request.jwt.claims` que os corpos das 155 funções e as policies legadas
 * continuam lendo via `auth.uid()`/`auth.role()`/`auth.jwt()` — nada nelas
 * precisou mudar.
 */
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
    const sql = `select * from ${SUPABASE_DB_SCHEMA}.${quoteIdent(functionName)}(${callArgs})`;

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
 * Equivalente a `createServerSupabaseClient()`: identidade da sessão logada.
 * A origem da identidade (hoje Supabase Auth, amanhã Auth.js) fica isolada em
 * `getCurrentAuthClaims()` — nada aqui muda quando ela trocar.
 */
export async function createServerRpcClient(): Promise<RpcClient> {
  const claims = await getCurrentAuthClaims();
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "authenticated", claims),
  };
}

/** Equivalente a `createAdminSupabaseClient()`: sem sessão, papel de serviço. */
export function createAdminRpcClient(): RpcClient {
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "service_role", { role: "service_role" }),
  };
}

/** Equivalente a `createPublicSupabaseClient()`: sem sessão, fluxo anônimo. */
export function createPublicRpcClient(): RpcClient {
  return {
    rpc: (functionName, args) => executeRpc(functionName, args, "anon", { role: "anon" }),
  };
}

export { RPC_PERMISSIONS, isRpcAllowedForRole };
