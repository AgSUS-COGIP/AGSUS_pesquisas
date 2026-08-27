import { Pool } from "pg";

/**
 * Conexão direta com db_dataware (Postgres da empresa), usada no lugar da
 * Data API do Supabase. Uma única credencial (usr_sip_app, dona de todas as
 * tabelas/funções de `sigav`) — não há roles anon/authenticated/service_role
 * neste cluster. A distinção de quem pode chamar cada RPC é feita em nível de
 * aplicação por rpc-permissions.ts, não pelo Postgres.
 */

const ENV_URL_VARIABLES = ["EMPRESA_DATABASE_URL"] as const;

/**
 * Verifica as variáveis de conexão sem abrir conexão nem criar pool.
 *
 * Usada por `/api/health/readiness` para diagnosticar configuração incompleta
 * antes de tocar o banco, no mesmo formato que
 * `getAdminSupabaseConfigurationStatus()` oferecia para o Supabase.
 */
export function getEmpresaDbConfigurationStatus() {
  const missingVariables: string[] = [];
  if (!ENV_URL_VARIABLES.some((name) => process.env[name]?.trim())) {
    missingVariables.push(ENV_URL_VARIABLES.join(" ou "));
  }
  if (!process.env.USERNAME_DATABASE_URL?.trim()) missingVariables.push("USERNAME_DATABASE_URL");
  if (!process.env.PASSWORD_DATABASE_URL?.trim()) missingVariables.push("PASSWORD_DATABASE_URL");

  return { configured: missingVariables.length === 0, missingVariables };
}

function readConnectionConfig() {
  const rawUrl = ENV_URL_VARIABLES.map((name) => process.env[name]).find(Boolean);
  if (!rawUrl) {
    throw new Error(`Nenhuma das variáveis ${ENV_URL_VARIABLES.join(", ")} está configurada.`);
  }

  // Aceita tanto "postgresql://" quanto o formato JDBC "jdbc:postgresql://".
  const normalized = rawUrl.startsWith("jdbc:") ? rawUrl.slice(5) : rawUrl;
  const parsed = new URL(normalized);

  const user = process.env.USERNAME_DATABASE_URL || parsed.username || undefined;
  const password = process.env.PASSWORD_DATABASE_URL || parsed.password || undefined;
  if (!user || !password) {
    throw new Error("USERNAME_DATABASE_URL e PASSWORD_DATABASE_URL precisam estar configurados.");
  }

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, ""),
    user,
    password,
  };
}

// O App Router recarrega módulos a cada mudança em dev; sem cache no
// `globalThis`, cada recarga abriria um pool novo e vazaria conexões até
// esgotar o limite do Postgres.
const globalForPool = globalThis as unknown as { empresaDbPool?: Pool };

export function getEmpresaDbPool(): Pool {
  if (!globalForPool.empresaDbPool) {
    globalForPool.empresaDbPool = new Pool({
      ...readConnectionConfig(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return globalForPool.empresaDbPool;
}
