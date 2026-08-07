import { BrainCircuit, CheckCircle2, Network, ShieldCheck } from "lucide-react";
import Image from "next/image";

const INSTRUMENT_IMAGE = "/evaluation-journey.svg";

export function CddiVisualBanner() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-[radial-gradient(circle_at_top_right,#38bdf833,transparent_32%),linear-gradient(135deg,#031f3a,#06487d_58%,#087ea4)] p-6 text-white shadow-2xl sm:p-8">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
      <div className="absolute -right-10 top-10 h-44 w-44 rounded-full border border-cyan-300/20" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-cyan-200">
            <BrainCircuit className="h-4 w-4" /> Instrumento digital AgSUS
          </div>
          <h2 className="mt-5 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">Uma jornada orientada por dados, competências e desenvolvimento.</h2>
          <p className="mt-4 max-w-2xl leading-7 text-blue-100">O formulário organiza cada competência em etapas objetivas, salva o progresso e mantém a integridade das respostas durante toda a avaliação.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: CheckCircle2, title: "Progresso salvo", text: "Continuidade segura" },
              { icon: Network, title: "Etapas conectadas", text: "Fluxo orientado" },
              { icon: ShieldCheck, title: "Dados protegidos", text: "Acesso institucional" },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <Icon className="h-5 w-5 text-emerald-300" />
                <strong className="mt-3 block text-sm">{title}</strong>
                <span className="mt-1 block text-xs text-blue-200">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute inset-6 rounded-[2rem] bg-cyan-300/15 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 p-3 shadow-2xl">
            <Image src={INSTRUMENT_IMAGE} alt="Representação visual da automação do instrumento de avaliação" width={1200} height={675} sizes="(max-width: 1024px) 100vw, 45vw" className="h-auto w-full rounded-[1.4rem] object-contain" />
          </div>
        </div>
      </div>
    </section>
  );
}
