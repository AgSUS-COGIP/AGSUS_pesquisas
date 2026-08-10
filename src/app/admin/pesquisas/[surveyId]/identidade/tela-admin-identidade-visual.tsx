"use client";

import Link from "next/link";
import { ChangeEvent, use, useEffect, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { ExternalImage } from "@/components/external-image";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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

type VisualIdentity = {
  bannerUrl: string | null;
  bannerPath: string | null;
  bannerAlt: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  themeVariant: "INSTITUTIONAL" | "CUSTOM";
};

const EMPTY_VISUAL: VisualIdentity = {
  bannerUrl: null,
  bannerPath: null,
  bannerAlt: null,
  heroTitle: null,
  heroSubtitle: null,
  themeVariant: "INSTITUTIONAL",
};

export default function SurveyVisualIdentityPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const { context, loading, error } = usePlatformContext();
  const [builder, setBuilder] = useState<BuilderData | null>(null);
  const [visual, setVisual] = useState<VisualIdentity>(EMPTY_VISUAL);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!context?.person) return;
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
        const payload = settingsData as { visualIdentity?: Partial<VisualIdentity> };
        setVisual({ ...EMPTY_VISUAL, ...(payload.visualIdentity ?? {}) });
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar a identidade visual.");
      } finally {
        setDataLoading(false);
      }
    };
    void load();
  }, [context?.person, surveyId]);

  async function uploadBanner(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !builder) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${builder.application.id}/banner.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("survey-assets")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("survey-assets").getPublicUrl(path);
      setVisual((current) => ({
        ...current,
        bannerPath: path,
        bannerUrl: `${publicUrlData.publicUrl}?v=${Date.now()}`,
        themeVariant: "CUSTOM",
      }));
      toast.success("Imagem enviada. Salve as alterações para publicá-la no instrumento.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!builder) return;
    if (visual.themeVariant === "CUSTOM" && (!visual.bannerUrl?.trim() || !visual.bannerPath?.trim())) {
      toast.error("Envie uma imagem antes de salvar o modo personalizado.");
      return;
    }
    if (visual.themeVariant === "CUSTOM" && !visual.bannerAlt?.trim()) {
      toast.error("Informe o texto alternativo da imagem personalizada.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: saveError } = await supabase.rpc("update_application_visual_settings", {
        target_application_id: builder.application.id,
        banner_url: visual.bannerUrl,
        banner_path: visual.bannerPath,
        banner_alt: visual.bannerAlt,
        hero_title: visual.heroTitle,
        hero_subtitle: visual.heroSubtitle,
        theme_variant: visual.themeVariant,
      });
      if (saveError) throw saveError;
      toast.success("Identidade visual atualizada.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Não foi possível salvar a identidade visual.");
    } finally {
      setSaving(false);
    }
  }

  function resetVisualIdentity() {
    setVisual(EMPTY_VISUAL);
  }

  if (loading) return <PlatformSkeleton title="Carregando identidade visual" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  if (!modules.includes(PLATFORM_MODULE.ADMIN_SURVEYS)) return <main className="p-10 text-red-700">Acesso restrito à administração.</main>;

  const person = context.person;
  const user = {
    fullName: person.fullName,
    institutionalEmail: person.institutionalEmail,
    employeeNumber: person.employeeNumber,
    profileLabel: profileLabel(context),
    roles: context.roles,
    modules,
  };

  return (
    <PlatformShell
      user={user}
      eyebrow="Administração"
      title="Identidade visual"
      actions={
        <Link
          href={`/admin/pesquisas/${surveyId}`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Voltar ao construtor
        </Link>
      }
    >
      {dataLoading || !builder ? (
        <div className="grid min-h-[50vh] place-items-center" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
          <span className="sr-only">Carregando configurações visuais.</span>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6">
          <PageHeader
            eyebrow={builder.application.code}
            title="Identidade visual do instrumento"
            description="Defina a imagem de capa e os textos exibidos no início da avaliação, edital ou ciclo."
          />

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <Surface className="p-6">
              <div className="space-y-5">
                <Select
                  label="Modo visual"
                  value={visual.themeVariant}
                  onChange={(event) => setVisual((current) => ({
                    ...current,
                    themeVariant: event.target.value as VisualIdentity["themeVariant"],
                  }))}
                  hint="Use o padrão institucional ou uma capa personalizada."
                >
                  <option value="INSTITUTIONAL">Padrão institucional</option>
                  <option value="CUSTOM">Imagem personalizada</option>
                </Select>

                <div>
                  <label htmlFor="banner-upload" className="block text-sm font-semibold text-slate-800">
                    Imagem de capa
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-500">JPG, PNG ou WEBP, até 5 MB. Recomenda-se proporção horizontal de 4:1.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label
                      htmlFor="banner-upload"
                      className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-strong)]"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {uploading ? "Enviando..." : "Selecionar imagem"}
                    </label>
                    <input
                      id="banner-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={uploadBanner}
                    />
                    {(visual.bannerUrl || visual.bannerAlt || visual.heroTitle || visual.heroSubtitle || visual.themeVariant !== "INSTITUTIONAL") && (
                      <Button variant="secondary" onClick={resetVisualIdentity}>
                        <Trash2 className="h-4 w-4" /> Restaurar padrão
                      </Button>
                    )}
                  </div>
                </div>

                <Input
                  label="Texto alternativo da imagem"
                  value={visual.bannerAlt ?? ""}
                  maxLength={180}
                  required={visual.themeVariant === "CUSTOM"}
                  onChange={(event) => setVisual((current) => ({ ...current, bannerAlt: event.target.value }))}
                  hint={visual.themeVariant === "CUSTOM" ? "Obrigatório para imagens personalizadas." : "Descreva a imagem para leitores de tela."}
                />

                <Input
                  label="Título principal"
                  value={visual.heroTitle ?? ""}
                  maxLength={160}
                  onChange={(event) => setVisual((current) => ({ ...current, heroTitle: event.target.value }))}
                  placeholder={builder.application.name}
                />

                <Textarea
                  label="Subtítulo ou texto de apoio"
                  value={visual.heroSubtitle ?? ""}
                  maxLength={500}
                  rows={5}
                  onChange={(event) => setVisual((current) => ({ ...current, heroSubtitle: event.target.value }))}
                />

                <Button fullWidth size="lg" disabled={saving || uploading} onClick={save}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {saving ? "Salvando..." : "Salvar identidade visual"}
                </Button>
              </div>
            </Surface>

            <Surface className="overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Pré-visualização</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Como o instrumento será apresentado</h2>
              </div>
              <div className="bg-[#eef3f8] p-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {visual.themeVariant === "CUSTOM" && visual.bannerUrl ? (
                    <ExternalImage
                      src={visual.bannerUrl}
                      alt={visual.bannerAlt || "Pré-visualização da capa do instrumento"}
                      width={1600}
                      height={400}
                      className="aspect-[4/1] w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-[4/1] w-full place-items-center bg-gradient-to-r from-[#06355f] via-[#006d8f] to-[#0b8f58] px-6 text-center text-white">
                      <strong className="text-xl">Identidade institucional AgSUS</strong>
                    </div>
                  )}
                  <div className="border-t-[5px] border-[#2d3f97] p-6">
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#0b8f58]">{builder.application.code}</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#26368d]">
                      {visual.heroTitle?.trim() || builder.application.name}
                    </h1>
                    <p className="mt-3 leading-7 text-slate-600">
                      {visual.heroSubtitle?.trim() || "Texto de apresentação do instrumento configurado pela administração."}
                    </p>
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}
