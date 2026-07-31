import Link from "next/link";

const destaques = [
  { numero: "12", rotulo: "competências avaliadas" },
  { numero: "2", rotulo: "perspectivas de avaliação" },
  { numero: "1–5", rotulo: "escala de desenvolvimento" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061a2f] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,18,41,.96),rgba(0,59,112,.78),rgba(0,93,107,.64)),url('https://i.postimg.cc/RFw7RxXC/image.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(0,168,214,.18),transparent_30%),radial-gradient(circle_at_84%_78%,rgba(11,143,88,.18),transparent_32%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-[#003b70] shadow-lg">Ag</div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">AgSUS</p>
              <p className="text-lg font-extrabold tracking-tight">Pesquisas e Avaliações</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold text-blue-50 backdrop-blur sm:inline-flex">
            Ambiente institucional
          </span>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-200 backdrop-blur">
              CDDI 2026 disponível
            </span>

            <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Desenvolvimento individual com critérios claros e uma experiência simples.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-blue-100 sm:text-lg">
              Realize sua autoavaliação, acompanhe a avaliação da liderança e organize o ciclo de devolutivas por competências em um ambiente institucional seguro.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/acesso"
                className="inline-flex min-h-13 items-center justify-center rounded-xl bg-[#0d6efd] px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-[#005bd7]"
              >
                Acessar o CDDI 2026
              </Link>
              <Link
                href="/formulario/CDDI-2026"
                className="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                Conhecer o formulário
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {destaques.map((item) => (
                <div key={item.rotulo} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <strong className="block text-2xl font-black text-white">{item.numero}</strong>
                  <span className="mt-1 block text-xs leading-5 text-blue-100">{item.rotulo}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[500px]">
            <div className="overflow-hidden rounded-[30px] bg-[#003b70] shadow-[0_35px_100px_rgba(0,0,0,.45)] ring-1 ring-white/10">
              <div className="agsus-stripe" aria-hidden="true" />
              <div className="bg-white px-7 py-8 text-[#10243e] sm:px-9 sm:py-10">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#edf5fc] text-xl font-black text-[#003b70] shadow-sm">Ag</div>
                <p className="mt-6 text-center text-xs font-black uppercase tracking-[0.2em] text-[#0b8f58]">Acesso institucional</p>
                <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-[#003b70]">AgSUS Pesquisas</h2>
                <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-600">
                  Entre com seu e-mail institucional para acessar suas avaliações, rascunhos e atividades do ciclo.
                </p>

                <Link
                  href="/acesso"
                  className="mt-7 flex w-full items-center justify-center rounded-xl bg-[#003b70] px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#005292]"
                >
                  Entrar com e-mail institucional
                </Link>

                <div className="mt-5 rounded-2xl border border-[#d7e5f2] bg-[#f6f9fc] p-4 text-center text-xs leading-5 text-slate-600">
                  O acesso é pessoal. Um link seguro será enviado para o endereço cadastrado no ciclo.
                </div>
              </div>
              <div className="agsus-stripe" aria-hidden="true" />
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-blue-200 sm:flex-row sm:items-center sm:justify-between">
          <span>Plataforma institucional de pesquisas e ciclos avaliativos</span>
          <span>AgSUS · CDDI 2026</span>
        </footer>
      </div>
    </main>
  );
}
