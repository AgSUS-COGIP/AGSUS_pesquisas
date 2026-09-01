import { getEmailConfigurationStatus } from "@/config/email";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { getEmpresaDbConfigurationStatus } from "@/lib/db/pool";
import { RPCS_CRITICAS } from "@/lib/rpc-criticas";
import type { Prontidao } from "@/lib/readiness-state";
export { ehQuedaDeBackend, type Prontidao } from "@/lib/readiness-state";

/** O ambiente responde e o schema possui o contrato exigido pela aplicação? */
export async function verificarProntidao(): Promise<Prontidao> {
  const faltando = [
    ...getEmpresaDbConfigurationStatus().missingVariables,
    ...getEmailConfigurationStatus().missingVariables,
  ];
  if (!process.env.CRON_SECRET?.trim()) faltando.push("CRON_SECRET");

  if (faltando.length) {
    return { estado: "configuracao-ausente", detalhe: faltando.join(", ") };
  }

  try {
    const banco = createAdminRpcClient();
    const { data, error } = await banco.rpc("FC_SRV_VERIFICAR_CONTRATO_RPC", {
      p_nomes: [...RPCS_CRITICAS],
    });

    if (error) {
      return {
        estado: "esquema-incompativel",
        detalhe: `${error.code ?? "DB_ERROR"} ${error.message}`,
      };
    }

    const resultado = data as { compatible?: boolean; missing?: string[] } | null;
    if (!resultado?.compatible) {
      return {
        estado: "esquema-incompativel",
        detalhe: resultado?.missing?.join(", ") ?? "desconhecido",
      };
    }

    return { estado: "pronta" };
  } catch (erro) {
    return {
      estado: "backend-inacessivel",
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}
