"use client";

import { ArrowRight, BarChart3, Building2, CalendarClock, CheckCircle2, CircleAlert, FileText, Loader2, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type CatalogItem = {
  surveyId: string;
  surveyCode: string;
  surveyName: string;
  description: string | null;
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  applicationStatus: string;
  opensAt: string | null;
  closesAt: string | null;
  completedAt: string | null;
  submissionStatus: string | null;
  sections: number;
  questions: number;
  canRespond: boolean;
};

function metadataText(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function applicationHref(item: CatalogItem) {
  return item.surveyCode === "CDDI" ? "/cddi" : `/pesquisas/${encodeURIComponent(item.applicationCode)}`;
}

function itemState(item: CatalogItem) {
  if (["SUBMITTED", "VALIDATED"].includes(item.submissionStatus ?? "") || item.completedAt) return "COMPLETED";
  if (item.submissionStatus === "DRAFT") return "IN_PROGRESS";
  if (item.applicationStatus === "CLOSED") return "CLOSED";
  if (item.applicationStatus === "SCHEDULED") return "SCHEDULED";
  return "PENDING";
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function ParticipantAreaPage() {
  const { context, loading, error } = usePlatformContext();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    if (!context?.person) return;
    const load = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: catalogError } = await supabase.rpc("list_my_survey_catalog");
        if (catalogError) throw catalogError;
        setCatalog(Array.isArray(data) ? data as CatalogItem[] : []);
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar sua jornada de pesquisas.");
      } finally {
        setCatalogLoading(false);
      }
    };
    void load();
  }, [context?.person]);

  const metrics = useMemo(() => {
    const completed = catalog.filter((item) => itemState(item) === "COMPLETED").length;
    const inProgress = catalog.filter((item) => itemState(item) === "IN_PROGRESS").length;
    const pending = catalog.filter((item) => itemState(item) === "PENDING").length;
    return { completed, inProgress, pending, total: catalog.length };
  }, [catalog]);

  const priorityItem = useMemo(() => {
    return [...catalog].sort((a, b) => {
      const rank = (item: CatalogItem) => ({ IN_PROGRESS: 0, PENDING: 1, SCHEDULED: 2, CLOSED: 3, COMPLETED: 4 }[itemState(item)] ?? 5);
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.closesAt ?? a.opensAt ?? "2999-12-31").getTime() - new Date(b.closesAt ?? b.opensAt ?? "2999-12-31").getTime();
    })[0] ?? null;
  }, [catalog]);

  if (loading) return <PlatformSkeleton title="Preparando painel institucional" />;
  if (!context?.person || context.status !== "OK") {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-red-700">Acesso institucional</p><h1 className="mt-2 text-2xl font-black text-[#003b70]">Não foi possível abrir seu painel</h1><p className="mt-4 leading-7 text-slate-600">{error || context?.message || "Cadastro institucional não localizado."}</p><Link href="/acesso" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar ao acesso</Link></section></main>;
  }

  const person = context.person;
  const modules = deriveModules(context);
  const isLeader = modules.includes("TEAM");
  const isAdmin = modules.some((item) => item.startsWith("ADMIN_"));
  const firstName = person.fullName.split(/\s+/)[0];
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter ?? "Unidade não informada";
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const profile = profileLabel(context);
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profile, avatarUrl: person.avatarUrl, roles: context.roles, modules };

  const actions = [
    { href: "/pesquisas", title: "Pesquisas", text: "Iniciar, continuar ou consultar instrumentos", icon: FileText, accent: "text-blue-700 bg-blue-50" },
    ...(isLeader ? [{ href: "/equipe", title: "Minha equipe", text: "Acompanhar integrantes e avaliações", icon: Users2, accent: "text-emerald-700 bg-emerald-50" }] : []),
    { href: "/resultados", title: "Resultados", text: "Consultar devolutivas e indicadores", icon: BarChart3, accent: "text-violet-700 bg-violet-50" },
    ...(isAdmin ? [{ href: "/admin", title: "Administração", text: "Gerenciar pesquisas, pessoas e acessos", icon: ShieldCheck, accent: "text-amber-700 bg-amber-50" }] : []),
  ];

  return (
    <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <article className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500">{greeting()},</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-brand-primary">{firstName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Veja o que exige sua atenção, acompanhe seus instrumentos e acesse as áreas permitidas ao seu perfil.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [String(metrics.pending), "Pendentes", "text-blue-700"],
                [String(metrics.inProgress), "Em andamento", "text-amber-700"],
                [String(metrics.completed), "Concluídas", "text-emerald-700"],
                [String(metrics.total), "Disponíveis", "text-brand-primary"],
              ].map(([value, label, accent]) => <div key={label} className="metric-card"><strong className={`block text-2xl ${accent}`}>{catalogLoading ? "—" : value}</strong><span className="text-[11px] font-bold text-slate-500">{label}</span></div>)}
            </div>
          </div>
        </article>

        <aside className="overflow-hidden rounded-2xl bg-brand-primary text-white shadow-sm">
          {catalogLoading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-200" /></div> : priorityItem ? <div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-200">Próxima ação</p><h3 className="mt-2 text-xl font-black">{priorityItem.applicationName}</h3></div>{itemState(priorityItem) === "COMPLETED" ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CalendarClock className="h-5 w-5 text-amber-300" />}</div><p className="mt-3 line-clamp-2 text-sm leading-6 text-blue-100">{priorityItem.description || priorityItem.surveyName}</p><p className="mt-3 text-xs font-bold text-blue-200">Prazo: {dateLabel(priorityItem.closesAt)}</p><Link href={applicationHref(priorityItem)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-brand-primary transition hover:bg-blue-50">{itemState(priorityItem) === "IN_PROGRESS" ? "Continuar" : itemState(priorityItem) === "COMPLETED" ? "Consultar" : "Abrir pesquisa"}<ArrowRight className="h-4 w-4" /></Link></div> : <div className="p-6"><CircleAlert className="h-6 w-6 text-cyan-200"/><h3 className="mt-4 text-xl font-black">Nenhuma ação pendente</h3><p className="mt-2 text-sm leading-6 text-blue-100">Quando uma pesquisa for disponibilizada ao seu perfil, ela aparecerá aqui.</p></div>}
        </aside>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <aside className="surface-card p-5">
          <div className="flex items-center justify-between gap-4"><div><p className="section-eyebrow">Ações rápidas</p><h2 className="mt-1 text-lg font-black text-brand-primary">Acessos principais</h2></div><Link href="/perfil" className="text-xs font-black text-emerald-700">Perfil →</Link></div>
          <div className="mt-4 divide-y divide-slate-100">
            {actions.map(({ href, title, text, icon: Icon, accent }) => <Link key={href} href={href} className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{title}</strong><small className="block truncate text-xs text-slate-500">{text}</small></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-primary" /></Link>)}
          </div>
        </aside>

        <article className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="section-eyebrow">Sua jornada</p><h2 className="mt-1 text-xl font-black text-brand-primary">Instrumentos recentes</h2></div><Link href="/pesquisas" className="text-sm font-black text-brand-primary">Ver catálogo →</Link></div></div>
          {catalogLoading ? <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div> : catalog.length ? <div className="divide-y divide-slate-100">{catalog.slice(0, 4).map((item) => { const state = itemState(item); return <Link key={item.applicationId} href={applicationHref(item)} className="group flex items-center gap-4 p-5 transition hover:bg-blue-50/40"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${state === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : state === "IN_PROGRESS" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{state === "COMPLETED" ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{item.applicationName}</strong><small className="mt-1 block truncate text-xs text-slate-500">{item.surveyName} · {item.questions} perguntas</small></span><span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600 sm:inline">{state === "COMPLETED" ? "Concluída" : state === "IN_PROGRESS" ? "Em andamento" : state === "CLOSED" ? "Encerrada" : "Pendente"}</span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-primary" /></Link>; })}</div> : <div className="p-10 text-center text-slate-500"><FileText className="mx-auto h-10 w-10 text-slate-300"/><p className="mt-3 font-bold">Nenhuma pesquisa disponível no momento.</p></div>}
        </article>
      </section>

      <section className="surface-card mt-4 px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-brand-primary"><Building2 className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Identidade institucional</p><h3 className="text-sm font-black text-slate-900">{person.fullName}</h3></div></div>
          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3"><span><strong className="block text-slate-400">Cargo</strong>{person.jobTitle ?? "Não informado"}</span><span><strong className="block text-slate-400">Unidade</strong>{unit}</span>{coordination && <span><strong className="block text-slate-400">Coordenação</strong>{coordination}</span>}</div>
        </div>
      </section>
    </PlatformShell>
  );
}
