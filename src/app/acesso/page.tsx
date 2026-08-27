import { normalizePlatformBranding, DEFAULT_PLATFORM_BRANDING } from "@/lib/platform-branding";
import { createPublicRpcClient } from "@/lib/db/rpc-adapter";
import AccessScreen from "./tela-acesso";

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

/**
 * Marca pública carregada por um cliente sem cookies.
 *
 * A página de acesso é pública e não deve se tornar dinâmica por ler sessão.
 * O mesmo cliente é usado pela API quando ela cai no ramo anônimo, garantindo
 * que um cookie inválido nunca seja anexado a `fc_obter_marca_publica()`.
 */
async function fetchBranding() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return DEFAULT_PLATFORM_BRANDING;
  }

  try {
    const supabase = createPublicRpcClient();
    const { data, error } = await supabase.rpc("fc_obter_marca_publica");
    if (error || !data) return DEFAULT_PLATFORM_BRANDING;
    return normalizePlatformBranding(data);
  } catch {
    // Marca indisponível não impede o acesso: a tela abre com o padrão. Esta é a
    // única porta de entrada da plataforma e não pode depender disto.
    return DEFAULT_PLATFORM_BRANDING;
  }
}

export default async function AccessPage() {
  const branding = await fetchBranding();
  return <AccessScreen initialBranding={branding} />;
}
