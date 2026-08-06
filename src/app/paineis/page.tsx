"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, FileText, UsersRound } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ManagedSurvey = {
  surveyId: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  applicationId: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  applicationStatus: string | null;
  opensAt: string | null;
  closesAt: string | null;
  sections: number;
  questions: number;
  updatedAt: string;
};

function formatDate(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function DashboardsPage() {
  const { context, loading: contextLoading, error: contextError } = usePlatformContext();
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    let active = true;

    async function loadSurveys() {
      const supabase = createBrowserSupabaseClient();
      const { data, error: surveysError } = await supabase.rpc("list_managed_surveys");
      if (!active) return;
      if (surveysError) {
        setError(surveysError.message);
        setSurveys([]);
      } else {
        setSurveys((data ?? []) as ManagedSurvey[]);
      }
      setLoading(false);
    }

    void loadSurveys();
    return () => { active = false; };
  }, [context?.person]);

  const modules = useMemo(() => context ? deriveModules(context) : [], [context]);

  if (contextLoading || loading) return <PlatformSkeleton title="Carregando painéis" />;
  if (!context?.person) return <main className="p-10 text-red-700">{contextError || "Acesso não identificado."}</main>;

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    avatarUrl: context.person.avatarUrl,
    profileLabel: profileLabel(context),
    roles: context.roles,
    modules,
  };

  const availableSurveys = surveys.filter((survey) => survey.applicationCode && survey.applicationId);

  return (
    <PlatformShell user={user} eyebrow="Visualizações autorizadas" title="Painéis">
      <PageHeader
        eyebrow="Dados conectados às pesquisas"
        title="Painéis disponíveis"
        description="Cada pesquisa publicada passa a ter acompanhamento próprio, sem misturar respostas, participantes ou resultados de outros instrumentos."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Surface className="p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></div>
          <h2 className="mt-4 text-lg font-black text-[var(--text-primary)]">AgSUS Monitora CDDI</h2>
          <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--text-secondary)]">Indicadores, competências, evolução das respostas e acompanhamento operacional por participante.</p>
          <Link href="/paineis/cddi" className="primary-button mt-5 w-full justify-center">Abrir painel CDDI</Link>
        </Surface>

        {modules.includes("TEAM") ? (
          <Surface className="p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UsersRound className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-black text-[var(--text-primary)]">Painel da liderança</h2>
            <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--text-secondary)]">Acompanhamento das avaliações e pendências das pessoas vinculadas à equipe.</p>
            <Link href="/paineis/cddi" className="secondary-button mt-5 w-full justify-center">Acompanhar equipe</Link>
          </Surface>
        ) : null}

        {availableSurveys.map((survey) => (
          <Surface key={survey.applicationId} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><BarChart3 className="h-5 w-5" /></div>
              <Badge variant={survey.applicationStatus === "OPEN" ? "success" : "neutral"}>
                {survey.applicationStatus === "OPEN" ? "Aberta" : survey.applicationStatus || "Sem ciclo"}
              </Badge>
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">{survey.code}</p>
            <h2 className="mt-1 text-lg font-black text-[var(--text-primary)]">{survey.applicationName || survey.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Pesquisa institucional criada na plataforma."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              <span>{survey.sections} seção(ões)</span>
              <span>·</span>
              <span>{survey.questions} pergunta(s)</span>
              <span>·</span>
              <span>até {formatDate(survey.closesAt)}</span>
            </div>
            <Link href={`/paineis/${encodeURIComponent(survey.applicationCode!)}`} className="primary-button mt-5 w-full justify-center">
              Abrir painel da pesquisa
            </Link>
          </Surface>
        ))}
      </div>

      {!availableSurveys.length ? (
        <Surface className="mt-6 p-5">
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden="true" />}
            title="Nenhuma pesquisa publicada com painel"
            description={error || "Crie e publique uma pesquisa para que o painel correspondente apareça automaticamente aqui."}
            action={<Link href="/admin/pesquisas" className="secondary-button">Administrar pesquisas</Link>}
          />
        </Surface>
      ) : null}
    </PlatformShell>
  );
}
