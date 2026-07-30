import Link from "next/link";

const recursos = [
  {
    titulo: "Autoavaliação guiada",
    descricao: "Doze competências, comportamentos observáveis, nível de desenvolvimento e orientações de preenchimento.",
  },
  {
    titulo: "Avaliação pela liderança",
    descricao: "Fluxo preparado para vincular lideranças, acompanhar equipes, salvar rascunhos e concluir avaliações.",
  },
  {
    titulo: "Resultados institucionais",
    descricao: "Cálculo por competência, pareamento entre autoavaliação e chefia e trilha completa de auditoria.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-white/10 bg-[#102c4c] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 lg:px-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">AgSUS</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Pesquisas e Avaliações</h1>
            <p className="mt-1 text-sm text-blue-100">Plataforma institucional de formulários e ciclos avaliativos</p>
          </div>
          <span className="hidden rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-blue-50 sm:inline-flex">
            Ambiente institucional
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-20">
        <div>
          <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">
            Primeiro ciclo disponível
          </span>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-[var(--primary-dark)] sm:text-5xl">
            Ciclo de Devolutivas e Desenvolvimento Individual
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Instrumento estruturado para autoavaliação, avaliação pela chefia direta, devolutivas e definição de ações de desenvolvimento por competências.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/cddi"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-4 font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-[#064f8d]"
            >
              Abrir formulário CDDI 2026
            </Link>
            <span className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-sm font-bold text-slate-600">
              12 competências · 52 perguntas
            </span>
          </div>
        </div>

        <aside className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-xl shadow-blue-950/10">
          <div className="bg-gradient-to-r from-[#102c4c] via-[var(--primary)] to-[#087a78] p-7 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">CDDI 2026</p>
            <h3 className="mt-3 text-3xl font-black">Formulário por competências</h3>
            <p className="mt-3 leading-7 text-blue-50">
              Experiência guiada inspirada no padrão de navegação do AgSUS Monitora e no fluxo operacional do CDDI atual.
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl bg-blue-50 p-4">
              <strong className="text-[var(--primary-dark)]">Escala comportamental</strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">Nunca, raramente, às vezes, frequentemente e sempre.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <strong className="text-emerald-900">Rascunho automático</strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">O progresso local é preservado durante o preenchimento.</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <strong className="text-amber-900">Revisão antes do envio</strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">Cada competência apresenta seu percentual de conclusão.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14 lg:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {recursos.map((recurso) => (
            <article key={recurso.titulo} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="mb-5 h-1.5 w-12 rounded-full bg-[var(--success)]" />
              <h3 className="text-lg font-black text-[var(--primary-dark)]">{recurso.titulo}</h3>
              <p className="mt-3 leading-7 text-slate-600">{recurso.descricao}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
