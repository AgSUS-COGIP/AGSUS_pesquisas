import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { normalizePlatformBranding, DEFAULT_PLATFORM_BRANDING, type PlatformBranding } from "@/lib/platform-branding";
import { ehQuedaDeBackend, verificarProntidao } from "@/lib/readiness";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import TelaDeManutencao from "@/components/tela-manutencao";
import AccessScreen from "./tela-acesso";

/*
 * A disponibilidade é decidida a cada visita; a marca continua cacheada.
 *
 * ## O que estava errado
 *
 * A página inteira era estática (`revalidate = 60`) e a decisão de mostrar
 * indisponibilidade vinha da leitura da marca. Duas consequências.
 *
 * A primeira: `connection()` só era chamado **depois** de detectar a queda, o
 * que tirava do cache o render de indisponibilidade — mas não o contrário. Uma
 * tela de login já cacheada continuava sendo servida por até um minuto depois
 * do banco cair, e quem recarregava recebia a mesma cópia guardada.
 *
 * A segunda: o critério era a marca. Erro **com** código do PostgREST contava
 * como "a plataforma respondeu, logo está de pé" — e `57P03`, `53300` e
 * `PGRST002` são exatamente o banco fora **com** código.
 *
 * ## O que passou a valer
 *
 * A prontidão (`@/lib/readiness`) é a mesma que `/api/health/readiness`
 * responde, e é consultada a cada visita — sem cache, porque cache aqui é
 * justamente o defeito. É uma ida ao banco, que é o preço de saber a verdade
 * na porta de entrada.
 *
 * A marca segue cacheada por um minuto, sozinha: ela é a parte lenta e que
 * muda algumas vezes por ano. Assim continua chegando pronta, sem pendurar a
 * decisão de disponibilidade no mesmo cache.
 *
 * As duas vão juntas em `Promise.all`: quando o cache da marca está frio, as
 * idas acontecem lado a lado em vez de uma esperar a outra.
 */

/** Tempo máximo de espera pela marca. A tela abre no padrão se estourar. */
const TEMPO_LIMITE_MS = 5_000;

/**
 * Marca pública, cacheada por um minuto.
 *
 * `unstable_cache` porque `use cache` exige ligar `cacheComponents` no projeto
 * inteiro — mudança de comportamento de cache em todas as rotas, que não cabe
 * como efeito colateral desta correção.
 *
 * ## Falhar não é a mesma coisa que estar fora
 *
 * Marca indisponível **não** impede o acesso: a tela abre com o padrão, porque
 * arte de campanha não pode fechar a única porta de entrada da plataforma. Essa
 * decisão continua valendo — o que mudou é que ela deixou de responder também
 * pela saúde da plataforma.
 */
const obterMarca = unstable_cache(
  async (): Promise<PlatformBranding> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return DEFAULT_PLATFORM_BRANDING;
    }

    try {
      const supabase = createPublicSupabaseClient();
      const { data, error } = await supabase
        .rpc("fc_obter_marca_publica")
        .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));

      if (error || !data) return DEFAULT_PLATFORM_BRANDING;
      return normalizePlatformBranding(data);
    } catch {
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
