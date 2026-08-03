import { LoaderCircle } from "lucide-react";

export default function GlobalLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,.1),transparent_32%),#f5f8fb] px-6">
      <section role="status" aria-live="polite" aria-busy="true" className="flex w-full max-w-sm flex-col items-center rounded-[2rem] border border-white/80 bg-white/85 p-8 text-center shadow-[0_30px_80px_-45px_rgba(15,23,42,.55)] backdrop-blur-xl">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#003b70] text-white shadow-lg" aria-hidden="true">
          <LoaderCircle className="h-7 w-7 animate-spin motion-reduce:animate-none" />
        </div>
        <h1 className="mt-5 text-xl font-black tracking-tight text-[#003b70]">Preparando seu ambiente</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Carregando dados, permissões e módulos institucionais.</p>
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-500 motion-reduce:animate-none" />
        </div>
      </section>
    </main>
  );
}
