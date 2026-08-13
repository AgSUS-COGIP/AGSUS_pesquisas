/**
 * Espera da tela de acesso.
 *
 * Sem este arquivo, o Next usa o `loading.tsx` da raiz — que é a casca do
 * sistema autenticado, com barra lateral e cartões. Quem ainda vai entrar veria
 * por um instante o esqueleto de um sistema em que nem entrou, o que é pior do
 * que não mostrar nada.
 *
 * Aqui a espera tem a forma da própria tela: duas colunas, painel à esquerda e
 * arte à direita, sem texto nem marca. Nada pisca depois, porque nada é
 * afirmado antes — a cor e a arte configuradas só aparecem quando chegam.
 */
export default function AccessLoading() {
  return (
    <main className="grid min-h-screen bg-white md:grid-cols-2 lg:grid-cols-[minmax(0,460px)_1fr]" aria-busy="true">
      <span className="sr-only">Carregando a tela de acesso.</span>
      <section className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-slate-100 motion-safe:animate-pulse" />
          <div className="h-3 w-32 rounded-full bg-slate-100 motion-safe:animate-pulse" />
          <div className="h-6 w-48 rounded-full bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-4 h-12 w-full rounded-xl bg-slate-100 motion-safe:animate-pulse" />
        </div>
      </section>
      <div className="hidden bg-slate-50 md:block" />
    </main>
  );
}
