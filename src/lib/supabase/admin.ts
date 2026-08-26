import { createClient } from "@supabase/supabase-js";
import { SUPABASE_DB_SCHEMA } from "./schema";

// Nomes modernos primeiro, legados como alternativa: projetos criados antes da
// renomeação do Supabase continuam funcionando sem editar variáveis.
const ADMIN_URL_VARIABLES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
const ADMIN_KEY_VARIABLES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

type Environment = Readonly<Record<string, string | undefined>>;

type ConfigurationStatus = {
  configured: boolean;
  hasUrl: boolean;
  hasSecretKey: boolean;
  missingVariables: string[];
};

function firstConfiguredValue(environment: Environment, variables: readonly string[]) {
  for (const variable of variables) {
    const value = environment[variable]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Verifica se as variáveis administrativas estão presentes, sem criar cliente.
 *
 * Usada por `/api/health` para diagnosticar configuração incompleta sem tocar no
 * banco. Recebe `environment` como parâmetro para permitir teste sem mutar
 * `process.env`.
 */
export function getAdminSupabaseConfigurationStatus(
  environment: Environment = process.env,
): ConfigurationStatus {
  const hasUrl = Boolean(firstConfiguredValue(environment, ADMIN_URL_VARIABLES));
  const hasSecretKey = Boolean(firstConfiguredValue(environment, ADMIN_KEY_VARIABLES));
  const missingVariables: string[] = [];

  if (!hasUrl) missingVariables.push("SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL");
  if (!hasSecretKey) missingVariables.push("SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY");

  return {
    configured: hasUrl && hasSecretKey,
    hasUrl,
    hasSecretKey,
    missingVariables,
  };
}

export class AdminSupabaseConfigurationError extends Error {
  readonly missingVariables: readonly string[];

  constructor(missingVariables: readonly string[]) {
    super(`Configuração administrativa do Supabase incompleta: ${missingVariables.join(", ")}.`);
    this.name = "AdminSupabaseConfigurationError";
    this.missingVariables = missingVariables;
  }
}

/**
 * Cria um cliente Supabase com a chave de serviço.
 *
 * **Este cliente ignora Row Level Security.** Só pode ser usado em Route Handlers
 * (`src/app/api/**`) — importá-lo em componente de cliente vazaria a chave secreta
 * no bundle enviado ao navegador. Nunca aceite nome de tabela ou coluna vindo da
 * requisição em consultas feitas com ele.
 *
 * @throws {AdminSupabaseConfigurationError} quando falta URL ou chave secreta.
 */
export function createAdminSupabaseClient() {
  const configuration = getAdminSupabaseConfigurationStatus();
  if (!configuration.configured) {
    throw new AdminSupabaseConfigurationError(configuration.missingVariables);
  }

  const url = firstConfiguredValue(process.env, ADMIN_URL_VARIABLES)!;
  const secretKey = firstConfiguredValue(process.env, ADMIN_KEY_VARIABLES)!;

  return createClient(url, secretKey, {
    db: { schema: SUPABASE_DB_SCHEMA },
    // Sem sessão nem renovação: o cliente é criado por requisição e não deve
    // guardar estado entre invocações da função serverless.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
