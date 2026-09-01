import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import TelaDeManutencao from "@/components/tela-manutencao";
import { createPublicRpcClient } from "@/lib/db/rpc-adapter";
import { getEmpresaDbConfigurationStatus } from "@/lib/db/pool";
import {
  DEFAULT_PLATFORM_BRANDING,
  normalizePlatformBranding,
  type PlatformBranding,
} from "@/lib/platform-branding";
import { ehQuedaDeBackend, verificarProntidao } from "@/lib/readiness";
import AccessScreen from "./tela-acesso";

/**
 * A marca muda poucas vezes por ano e pode ser cacheada. A prontidão, por outro
 * lado, precisa ser consultada em toda visita para que a porta de entrada não
 * continue aberta durante uma queda nem permaneça fechada depois da recuperação.
 */
const obterMarca = unstable_cache(
  async (): Promise<PlatformBranding> => {
    if (!getEmpresaDbConfigurationStatus().configured) return DEFAULT_PLATFORM_BRANDING;

    try {
      const banco = createPublicRpcClient();
      const { data, error } = await banco.rpc("FC_OBTER_MARCA_PUBLICA");
      if (error || !data) return DEFAULT_PLATFORM_BRANDING;
      return normalizePlatformBranding(data);
    } catch {
      // Falha da identidade visual não fecha a única porta de entrada.
      return DEFAULT_PLATFORM_BRANDING;
    }
  },
  ["marca-publica-acesso"],
  { revalidate: 60, tags: ["marca-publica"] },
);

export default async function AccessPage() {
  /*
    Sem isto a página volta a ser pré-renderizada.

    Tirar `revalidate = 60` não basta: nada mais nesta página lê cookie,
    cabeçalho ou busca, então o Next a considera estática e resolve a prontidão
    **no build** — o resultado ficaria gravado no HTML e a tela nunca mudaria em
    produção. Seria o mesmo defeito de antes, só que permanente.

    `connection()` declara que este render depende da requisição, e precisa vir
    antes da verificação para que ela aconteça a cada visita.
  */
  await connection();

  const [prontidao, branding] = await Promise.all([verificarProntidao(), obterMarca()]);

  if (ehQuedaDeBackend(prontidao)) {
    return <TelaDeManutencao tipo="indisponibilidade" />;
  }

  return <AccessScreen initialBranding={branding} />;
}
