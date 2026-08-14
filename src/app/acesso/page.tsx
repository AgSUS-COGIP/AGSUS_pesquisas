import { createClient } from "@supabase/supabase-js";
import { normalizePlatformBranding, DEFAULT_PLATFORM_BRANDING } from "@/lib/platform-branding";
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
 * Cliente anônimo, sem cookies.
 *
 * `createServerSupabaseClient()` lê `cookies()`, e **qualquer** leitura de
 * cookie tira a rota da geração estática — com ele, o `revalidate` acima não
 * teria efeito nenhum e a página continuaria dinâmica.
 *
 * Aqui não há sessão a considerar: `/acesso` é público e
 * `fc_obter_marca_plataforma()` é executável por `anon`. Nenhum dado pessoal
 * trafega nesta chamada.
 */
async function fetchBranding() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return DEFAULT_PLATFORM_BRANDING;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("fc_obter_marca_plataforma");
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
