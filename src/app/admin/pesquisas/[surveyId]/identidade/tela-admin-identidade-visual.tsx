"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Hourglass, Info, Save } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { SurveyBanner } from "@/components/survey-banner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_CDDI_VISUAL_IDENTITY } from "@/lib/survey-visual-identity";

type BuilderData = {
  application: {
    id: string;
    code: string;
    name: string;
  };
  survey: {
    name: string;
  };
};

/**
 * A capa é sempre a institucional — só os textos da abertura são configuráveis.
 * O envio de imagem foi removido da plataforma; ver `@/lib/survey-visual-identity`.
 */
type VisualTexts = {
  heroTitle: string | null;
  heroSubtitle: string | null;
};

const EMPTY_TEXTS: VisualTexts = {
  heroTitle: null,
  heroSubtitle: null,
};

export default function SurveyVisualIdentityPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const [builder, setBuilder] = useState<BuilderData | null>(null);
  const [texts, setTexts] = useState<VisualTexts>(EMPTY_TEXTS);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!granted) return;
    const load = async () => {
      setDataLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: builderData, error: builderError } = await supabase.rpc("get_survey_builder", {
          target_survey_id: surveyId,
        });
        if (builderError) throw builderError;
        const nextBuilder = builderData as BuilderData;
        setBuilder(nextBuilder);

        const { data: settingsData, error: settingsError } = await supabase.rpc(
          "get_application_visual_settings",
          { target_application_id: nextBuilder.application.id },
        );
        if (settingsError) throw settingsError;
        const payload = settingsData as { visualIdentity?: Partial<VisualTexts> };
        setTexts({
          heroTitle: payload.visualIdentity?.heroTitle ?? null,
          heroSubtitle: payload.visualIdentity?.heroSubtitle ?? null,
        });
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar a identidade visual.");
      } finally {
        setDataLoading(false);
      }
    };
    void load();
  }, [granted, surveyId]);

  async function save() {
    if (!builder) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      // A RPC mantém os parâmetros de banner por compatibilidade; enviamos nulo
      // e `INSTITUTIONAL` para que nenhum ciclo volte a ter capa personalizada.
      const { error: saveError } = await supabase.rpc("update_application_visual_settings", {
        target_application_id: builder.application.id,
        banner_url: null,
        banner_path: null,
        banner_alt: null,
        hero_title: texts.heroTitle,
        hero_subtitle: texts.heroSubtitle,
        theme_variant: "INSTITUTIONAL",
      });
      if (saveError) throw saveError;
      toast.success("Textos de abertura atualizados.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Não foi possível salvar a identidade visual.");
    } finally {
      setSaving(false);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="identidade visual"
      restrictedTitle="Identidade visual restrita"
      restrictedDescription="Seu perfil não possui permissão para configurar a identidade visual das avaliações."
    />;
  }

  return (
    <PlatformShell
      user={guard.user}
      eyebrow="Administração"
      title="Identidade visual"
      actions={
        <Link
          href={`/admin/pesquisas/${surveyId}/operacao`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          Voltar às propriedades
        </Link>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Breadcrumbs items={[
          { label: "Administração", href: "/admin" },
          { label: "Avaliações", href: "/admin/pesquisas" },
          { label: builder?.application.code ?? "Avaliação", href: `/admin/pesquisas/${surveyId}` },
          { label: "Identidade visual" },
        ]} />

        {dataLoading || !builder ? (
          <div className="space-y-6" aria-live="polite" aria-busy="true">
            <span className="sr-only">Carregando as configurações visuais.</span>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="grid gap-6 xl:grid-cols-2">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            <PageHeader
              eyebrow={builder.application.code}
              title="Textos de abertura do instrumento"
              description="Defina o título e o texto de apresentação exibidos no início da avaliação. A capa é sempre a institucional da AgSUS."
            />

            <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
              <Surface className="p-6">
                <p className="flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">A capa é padronizada.</strong> Todos os instrumentos abrem com a arte institucional da AgSUS — não há envio de imagem personalizada.
                  </span>
                </p>

                <div className="mt-5 space-y-5">
                  <Input
                    label="Título principal"
                    value={texts.heroTitle ?? ""}
                    maxLength={160}
                    onChange={(event) => setTexts((current) => ({ ...current, heroTitle: event.target.value }))}
                    placeholder={builder.application.name}
                    hint="Deixe em branco para usar o nome do ciclo."
                  />

                  <Textarea
                    label="Subtítulo ou texto de apoio"
                    value={texts.heroSubtitle ?? ""}
                    maxLength={500}
                    rows={5}
                    onChange={(event) => setTexts((current) => ({ ...current, heroSubtitle: event.target.value }))}
                    hint="Apresentação exibida abaixo do título, na abertura do instrumento."
                  />

                  <Button fullWidth size="lg" disabled={saving} onClick={save}>
                    {saving ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
                    {saving ? "Salvando..." : "Salvar textos de abertura"}
                  </Button>
                </div>
              </Surface>

              <Surface className="overflow-hidden">
                <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Pré-visualização</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Como o instrumento será apresentado</h2>
                </div>
                <div className="bg-[var(--surface-muted)] p-5">
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm">
                    <SurveyBanner
                      src={DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl}
                      alt={DEFAULT_CDDI_VISUAL_IDENTITY.bannerAlt}
                      className="aspect-[4/1] w-full object-cover"
                    />
                    <div className="border-t-[5px] border-[#2d3f97] p-6">
                      <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">{builder.application.code}</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#26368d]">
                        {texts.heroTitle?.trim() || builder.application.name}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                        {texts.heroSubtitle?.trim() || "Texto de apresentação do instrumento configurado pela administração."}
                      </p>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </>
        )}
      </div>
    </PlatformShell>
  );
}
