import { connection } from "next/server";
import { normalizePlatformBranding, DEFAULT_PLATFORM_BRANDING, type PlatformBranding } from "@/lib/platform-branding";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import AccessScreen from "./tela-acesso";
import TelaDeManutencao from "./tela-manutencao";

/*
 * A página é cacheada e revalidada a cada minuto, em vez de renderizada a cada
 * visita.
 *
 * Renderizada sob demanda, toda abertura esperava a consulta da marca antes de
 * qualquer HTML — e o Next preenchia essa espera com o `loading.tsx`, tempo em
 * que a pessoa olha um esqueleto em vez da tela de entrar.
 *
 * Cacheada, a tela chega pronta. O custo é a marca demorar até um minuto para
 * refletir uma troca em /admin/configuracoes — aceitável para arte de campanha,
 * que muda algumas vezes por ano.
 */
export const revalidate = 60;

/** Tempo máximo de espera pela marca antes de considerar a plataforma fora. */
const TEMPO_LIMITE_MS = 5_000;

type ResultadoDaMarca = {
  branding: PlatformBranding;
  /** A plataforma não respondeu — nem para recusar. */
  indisponivel: boolean;
};

/**
 * Marca pública carregada por um cliente sem cookies.
 *
 * A página de acesso é pública e não deve se tornar dinâmica por ler sessão.
 * O mesmo cliente é usado pela API quando ela cai no ramo anônimo, garantindo
 * que um cookie inválido nunca seja anexado a `fc_obter_marca_publica()`.
 *
 * ## Falhar não é a mesma coisa que estar fora
 *
 * Marca indisponível **não** impede o acesso: a tela abre com o padrão, porque
 * arte de campanha não pode fechar a única porta de entrada da plataforma. Essa
 * decisão continua valendo.
 *
 * O que faltava era distinguir essa falha da plataforma inteira não responder.
 * Quando o backend cai, a tela abria idêntica a um dia normal — com a arte
 * padrão, o botão de entrar e nada que dissesse o que estava acontecendo. Quem
 * clicava não ia a lugar nenhum e não tinha como saber se o problema era o
 * sistema ou a própria conta, que pedem providências opostas.
 *
 * O critério é conservador de propósito, porque errar para o lado de mostrar
 * manutenção fecha a porta de quem poderia entrar:
 *
 *   - erro **com código** do PostgREST → a plataforma respondeu, ainda que
 *     recusando. É problema da marca, e a tela de acesso abre;
 *   - exceção ou erro sem código → transporte: DNS, rede, projeto pausado,
 *     tempo esgotado. Ninguém atendeu, e aí sim é manutenção.
 */
async function fetchBranding(): Promise<ResultadoDaMarca> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    // Ambiente sem configuração não é queda: é build ou pré-visualização sem
    // backend. Mostrar manutenção aqui seria mentir sobre produção.
    return { branding: DEFAULT_PLATFORM_BRANDING, indisponivel: false };
  }

  try {
    const supabase = createPublicSupabaseClient();
    // Sem o limite de tempo, um backend que aceita conexão e não responde
    // deixaria a página pendurada — pior que a tela errada, porque não há nem o
    // que ler enquanto espera.
    const { data, error } = await supabase
      .rpc("fc_obter_marca_publica")
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));

    if (error) {
      return { branding: DEFAULT_PLATFORM_BRANDING, indisponivel: !error.code };
    }
    if (!data) return { branding: DEFAULT_PLATFORM_BRANDING, indisponivel: false };
    return { branding: normalizePlatformBranding(data), indisponivel: false };
  } catch {
    return { branding: DEFAULT_PLATFORM_BRANDING, indisponivel: true };
  }
}

export default async function AccessPage() {
  const { branding, indisponivel } = await fetchBranding();

  if (indisponivel) {
    // Tira **este** render do cache. Com `revalidate = 60`, a indisponibilidade
    // ficaria guardada: o sistema voltaria e a tela continuaria dizendo que
    // está fora por até um minuto — inclusive para quem clicasse em "Tentar
    // novamente", que receberia a mesma página cacheada e concluiria que o
    // botão não funciona.
    await connection();
    return <TelaDeManutencao />;
  }

  return <AccessScreen initialBranding={branding} />;
}
