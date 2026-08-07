import { createBrowserClient } from "@supabase/ssr";

export function isBrowserSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("As variáveis públicas do Supabase ainda não foram configuradas.");
  }

  return createBrowserClient(url, publishableKey, {
    isSingleton: true,
    auth: {
      experimental: {
        appendPkceFlowIdToRedirects: true,
      },
    },
  });
}
