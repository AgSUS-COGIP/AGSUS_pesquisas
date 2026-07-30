const pilares = [
  {
    titulo: "Pesquisas configuráveis",
    descricao: "Criação de formulários, seções, perguntas, públicos e períodos de aplicação.",
  },
  {
    titulo: "Governança e segurança",
    descricao: "Perfis de acesso, trilhas de auditoria e políticas de segurança no banco.",
  },
  {
    titulo: "Resultados institucionais",
    descricao: "Acompanhamento, consolidação, exportação e integração com ferramentas analíticas.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
      <header className="flex items-center justify-between gap-6 rounded-3xl border border-[var(--border)] bg-white/90 px-6 py-5 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--success)]">
            AgSUS
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--primary-dark)]">
            Plataforma de Pesquisas e Avaliações
          </h1>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
          Fundação técnica
        </span>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-extrabold text-[var(--primary)]">
            Sistema institucional em construção
          </span>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-[var(--primary-dark)] sm:text-5xl">
            Uma única plataforma para diferentes pesquisas, avaliações e formulários.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            O CDDI será o primeiro módulo. A arquitetura está sendo preparada para receber novos ciclos, públicos, questionários e regras sem reconstruir o sistema.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-xl bg-[var(--primary)] px-5 py-3 font-bold text-white shadow-sm">
              Next.js + TypeScript
            </span>
            <span className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 font-bold text-slate-700">
              Supabase PostgreSQL
            </span>
            <span className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 font-bold text-slate-700">
              GitHub + Vercel
            </span>
          </div>
        </div>

        <aside className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--primary)]">
            Primeiro módulo
          </p>
          <h3 className="mt-3 text-3xl font-black text-[var(--primary-dark)]">CDDI 2026</h3>
          <p className="mt-3 leading-7 text-slate-600">
            Migração controlada do aplicativo atual, preservando participantes, lideranças, vínculos, avaliações, rascunhos, cálculos e comprovantes.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            O banco ainda não foi alterado. As tabelas e políticas serão criadas por migrations versionadas após a modelagem das três planilhas oficiais.
          </div>
        </aside>
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        {pilares.map((pilar) => (
          <article key={pilar.titulo} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-5 h-1.5 w-12 rounded-full bg-[var(--success)]" />
            <h3 className="text-lg font-black text-[var(--primary-dark)]">{pilar.titulo}</h3>
            <p className="mt-3 leading-7 text-slate-600">{pilar.descricao}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
