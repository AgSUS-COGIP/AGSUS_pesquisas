"use client";

import Link from "next/link";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { PlatformIcon } from "@/components/platform-icons";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

type Item = {
  title: string;
  text: string;
  status?: string;
  href?: string;
  actionLabel?: string;
};

export function AdminModulePage({ eyebrow, title, description, requiredModule, primaryAction, items }: { eyebrow: string; title: string; description: string; requiredModule: string; primaryAction?: { label: string; href: string }; items: Item[] }) {
  const { context, loading, error } = usePlatformContext();
  if (loading) return <PlatformSkeleton title={`Carregando ${title}`} />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  if (!modules.includes(requiredModule)) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6"><section className="max-w-lg rounded-3xl bg-white p-8 shadow-xl"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700"><PlatformIcon name="lock" /></div><h1 className="mt-5 text-3xl font-black text-[#003b70]">Acesso restrito</h1><p className="mt-3 text-slate-600">Seu perfil não possui permissão para este módulo.</p><Link href="/area" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao painel</Link></section></main>;
  }

  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };

  return <PlatformShell user={user} eyebrow={eyebrow} title={title} actions={primaryAction ? <Link href={primaryAction.href} className="hidden rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#075ea8] md:inline-flex">{primaryAction.label}</Link> : undefined}>
    <section className="rounded-[2rem] border border-[#d7e5f2] bg-white p-7 shadow-sm"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">{eyebrow}</p><h2 className="mt-1 text-3xl font-black text-[#003b70]">{title}</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">{description}</p></div><Link href="/admin" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-[#003b70] transition hover:bg-white"><PlatformIcon name="chevron-left" className="h-4 w-4" />Voltar à central</Link></div></section>

    <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => <article key={item.title} className="flex min-h-64 flex-col rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black text-[#003b70]">{item.title}</h3>{item.status && <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{item.status}</span>}</div><p className="mt-3 flex-1 leading-7 text-slate-600">{item.text}</p>{item.href ? <Link href={item.href} className="mt-6 inline-flex items-center justify-between rounded-xl bg-[#003b70] px-4 py-3 text-sm font-black text-white transition hover:bg-[#075ea8]">{item.actionLabel ?? "Abrir gestão"}<PlatformIcon name="chevron-right" className="h-4 w-4" /></Link> : <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500"><PlatformIcon name="clock" className="h-4 w-4" />Módulo em evolução</div>}</article>)}
    </section>
  </PlatformShell>;
}
