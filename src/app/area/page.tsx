"use client";

import { ArrowRight, BarChart3, Building2, CalendarClock, CheckCircle2, CircleAlert, FileText, Loader2, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
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
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()).replace(/\D/g, ""));
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

function stateLabel(state: string) {
  if (state === "COMPLETED") return "Concluída";
  if (state === "IN_PROGRESS") return "Em andamento";
  if (state === "CLOSED") return "Encerrada";
  if (state === "SCHEDULED") return "Agendada";
  return "Pendente";
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function ParticipantAreaPage() {
  const { context, loading, error } = usePlatformContext();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [salutation, setSalutation] = useState("Olá");

  useEffect(() => setSalutation(greeting()), []);

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
    const pending = catalog.filter((item) => ["PENDING", "SCHEDULED"].includes(itemState(item))).length;
    return { completed, inProgress, pending, total: catalog.length };
  }, [catalog]);

  const priorityItem = useMemo(() => {
    return catalog
      .filter((item) => !["COMPLETED", "CLOSED"].includes(itemState(item)))
      .sort((a, b) => {
        const rank = (item: CatalogItem) => {
          const state = itemState(item);
          if (state === "IN_PROGRESS") return 0;
          if (state === "PENDING") return 1;
          if (state === "SCHEDULED") return 2;
          return 3;
        };
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
      <div className="space-y-5">
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <article className="relative min-h-[265px] overflow-hidden rounded-[1.5rem] border border-sky-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,.17),transparent_38%),linear-gradient(135deg,#ffffff_0%,#f4f9fc_72%,#edf8f5_100%)] p-6 shadow-[0_20px_60px_-44px_rgba(7,59,98,.65)] sm:p-7">
            <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[28px] border-white/50" aria-hidden="true" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex items-start gap-4">
                <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-14 w-14 rounded-2xl shadow-sm ring-4 ring-white" fallbackClassName="text-lg" />
                <div>
                  <p className="text-xs font-bold text-slate-500">{salutation},</p>
                  <h2 className="mt-0.5 text-3xl font-black tracking-tight text-brand-primary sm:text-4xl">{firstName}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Veja o que precisa da sua atenção e acompanhe sua jornada em um só lugar.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [String(metrics.pending), "Pendentes", "text-blue-700", "bg-blue-50"],
                  [String(metrics.inProgress), "Em andamento", "text-amber-700", "bg-amber-50"],
                  [String(metrics.completed), "Concluídas", "text-emerald-700", "bg-emerald-50"],
                  [String(metrics.total), "Disponíveis", "text-[#0b4f82]", "bg-sky-50"],
                ].map(([value, label, accent, surface]) => (
                  <div key={label} className="rounded-2xl border border-white/90 bg-white/85 p-3.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,.6)] backdrop-blur">
                    <span className={`mb-2 block h-1.5 w-7 rounded-full ${surface}`} />
                    <strong className={`block text-2xl ${accent}`}>{catalogLoading ? "—" : value}</strong>
                    <span className="text-[11px] font-bold text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <aside className="relative min-h-[265px] overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#073b62_0%,#0b5f88_58%,#087a55_130%)] text-white shadow-[0_24px_60px_-38px_rgba(7,59,98,.9)]">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[34px] border-white/5" aria-hidden="true" />
            {catalogLoading ? (
              <div className="grid min-h-[265px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-200" /></div>
            ) : priorityItem ? (
              <div className="relative flex min-h-[265px] flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-200">Próxima ação</p><h3 className="mt-2 text-2xl font-black leading-tight">{priorityItem.applicationName}</h3></div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-amber-200 ring-1 ring-white/10"><CalendarClock className="h-5 w-5" /></span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-blue-50/90">{priorityItem.description || priorityItem.surveyName}</p>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
                  <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-200">Prazo</p><p className="mt-1 text-sm font-bold text-white">{dateLabel(priorityItem.closesAt)}</p></div>
                  <Link href={applicationHref(priorityItem)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#073b62] shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-cyan-50">
                    {itemState(priorityItem) === "IN_PROGRESS" ? "Continuar" : "Abrir pesquisa"}<ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="relative flex min-h-[265px] flex-col justify-center p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-emerald-200"><CheckCircle2 className="h-6 w-6" /></span><h3 className="mt-4 text-2xl font-black">Tudo em dia</h3><p className="mt-2 max-w-md text-sm leading-6 text-blue-50/90">Você não tem ações pendentes. Novos instrumentos aparecerão aqui quando forem liberados.</p></div>
            )}
          </aside>
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(330px,.78fr)_minmax(0,1.22fr)]">
          <aside className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div><p className="section-eyebrow">Ações rápidas</p><h2 className="mt-1 text-xl font-black text-brand-primary">Acessos principais</h2></div>
              <Link href="/perfil" className="rounded-lg px-2 py-1 text-xs font-black text-emerald-700 transition hover:bg-emerald-50">Editar perfil →</Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {actions.map(({ href, title, text, icon: Icon, accent }) => (
                <Link key={href} href={href} className="group relative rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-[0_16px_38px_-28px_rgba(7,59,98,.7)]">
                  <div className="flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-primary" /></div>
                  <strong className="mt-3 block text-sm text-slate-900">{title}</strong>
                  <small className="mt-1 block text-xs leading-5 text-slate-500">{text}</small>
                </Link>
              ))}
            </div>
          </aside>

          <article className="surface-card overflow-hidden">
            <div className="border-b border-slate-100 bg-[linear-gradient(90deg,#fff,#f7fbfd)] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="section-eyebrow">Sua jornada</p><h2 className="mt-1 text-xl font-black text-brand-primary">Instrumentos recentes</h2></div><Link href="/pesquisas" className="rounded-lg px-2 py-1 text-sm font-black text-brand-primary transition hover:bg-blue-50">Ver catálogo →</Link></div>
            </div>
            {catalogLoading ? (
              <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>
            ) : catalog.length ? (
              <div className="divide-y divide-slate-100">
                {catalog.slice(0, 4).map((item) => {
                  const state = itemState(item);
                  return (
                    <Link key={item.applicationId} href={applicationHref(item)} className="group flex items-center gap-4 p-5 transition hover:bg-sky-50/55">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${state === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : state === "IN_PROGRESS" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{state === "COMPLETED" ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{item.applicationName}</strong><small className="mt-1 block truncate text-xs text-slate-500">{item.surveyName} · {item.questions} perguntas</small></span>
                      <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600 sm:inline">{stateLabel(state)}</span>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-primary" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500"><CircleAlert className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold">Nenhuma pesquisa disponível no momento.</p></div>
            )}
          </article>
        </section>

        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-[0_16px_45px_-38px_rgba(15,23,42,.55)]">
          <div className="h-1 bg-[linear-gradient(90deg,#0b4f82,#1388b8,#087a55)]" />
          <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3"><PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-11 w-11 rounded-xl" fallbackClassName="text-sm" /><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Identidade institucional</p><h3 className="text-sm font-black text-slate-900">{person.fullName}</h3></div></div>
            <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3"><span><strong className="block text-slate-400">Cargo</strong>{person.jobTitle ?? "Não informado"}</span><span><strong className="block text-slate-400">Unidade</strong>{unit}</span>{coordination && <span><strong className="block text-slate-400">Coordenação</strong>{coordination}</span>}</div>
            <Link href="/perfil" className="secondary-button shrink-0 justify-center">Personalizar perfil</Link>
          </div>
        </section>
      </div>
    </PlatformShell>
  );
}
