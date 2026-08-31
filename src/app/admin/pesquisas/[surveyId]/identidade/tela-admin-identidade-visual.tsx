"use client";

import Link from "next/link";
import { ChangeEvent, use, useEffect, useState } from "react";
import { ArrowLeft, Hourglass, ImagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { SurveyBanner } from "@/components/survey-banner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Surface } from "@/components/ui/surface";
import { BotaoProximaEtapa, CabecalhoDaConfiguracao } from "@/components/configuracao-avaliacao";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { errorMessageFromUnknown } from "@/lib/observability";
import { enviarArquivo } from "@/lib/api/cliente-arquivos";
import { obterIdentidadeVisual, salvarIdentidadeVisual } from "@/lib/api/cliente-construtor";
import type { IdentidadeVisual as VisualIdentity } from "@/lib/api/contratos-construtor";
import { DEFAULT_CDDI_VISUAL_IDENTITY } from "@/lib/survey-visual-identity";
import { cn } from "@/lib/utils";

/**
 * A aplicação (ciclo) a que a capa pertence.
 *
 * A tela não carrega mais o construtor inteiro para chegar até aqui: ela pedia
 * `get_survey_builder` — seções, perguntas e alternativas — só para extrair
 * `application.id`, que era o argumento das duas RPCs de capa. Essa tradução
 * passou para a rota, que devolve o identificador junto do que a tela de fato
 * exibe: o código e o nome do ciclo.
 */
type ApplicationSummary = {
  id: string;
  code: string;
  name: string;
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
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  // O cabeçalho da jornada nomeia a avaliação; o ciclo vai para a linha de apoio.
  const [nomeDaAvaliacao, setNomeDaAvaliacao] = useState<string | null>(null);
  const [visual, setVisual] = useState<VisualIdentity>(EMPTY_VISUAL);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!granted) return;
    let active = true;
    const load = async () => {
      setDataLoading(true);
      try {
        // Uma chamada onde havia duas encadeadas: a rota resolve o ciclo da
        // avaliação antes de ler a capa, e devolve os dois juntos.
        const dados = await obterIdentidadeVisual(surveyId);
        if (!active) return;
        setApplication({
          id: dados.applicationId,
          code: dados.applicationCode,
          name: dados.applicationName,
        });
        setNomeDaAvaliacao(dados.surveyName);
        setVisual({ ...EMPTY_VISUAL, ...(dados.visualIdentity ?? {}) });
      } catch (loadError) {
        if (!active) return;
        toast.error(errorMessageFromUnknown(loadError));
      } finally {
        if (active) setDataLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [granted, surveyId]);

  async function uploadBanner(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !application) return;
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
      // Sem bucket, o upload atravessa a aplicação: é o único caminho pelo qual
      // o navegador alcança o Postgres. A autoridade que era das políticas do
      // bucket passou para `can_manage_surveys()`, checada no corpo da RPC. O
      // que já era REST — a **gravação da identidade**, onde está a regra de
      // negócio — não mudou.
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // O caminho continua começando pelo id da aplicação: é o que amarra a
      // imagem a este ciclo, e é o valor que `bannerPath` já guarda.
      const path = `${application.id}/banner.${extension}`;
      const arquivo = await enviarArquivo("survey-assets", path, file);
      setVisual((current) => ({
        ...current,
        bannerPath: arquivo.caminho,
        // `?v=` derrota o cache ao substituir a capa pelo mesmo caminho.
        bannerUrl: `${arquivo.url}?v=${Date.now()}`,
        themeVariant: "CUSTOM",
      }));
      toast.success("Imagem enviada. Salve as alterações para publicá-la no instrumento.");
    } catch (uploadError) {
      toast.error(errorMessageFromUnknown(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!application) return;
    // As três checagens espelham as validações da RPC, para que o operador leia o
    // motivo no formulário em vez de receber a exceção do banco.
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
      await salvarIdentidadeVisual(surveyId, visual);
      toast.success("Identidade visual atualizada.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError));
    } finally {
      setSaving(false);
    }
  }

  function resetVisualIdentity() {
    setVisual(EMPTY_VISUAL);
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
    >
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Fica fora do bloco de carregamento de propósito: a navegação da
            jornada precisa existir antes dos dados e sobreviver a uma falha da
            RPC — sem ela, um erro aqui deixaria a pessoa sem saída visível. */}
        <CabecalhoDaConfiguracao
          surveyId={surveyId}
          applicationId={application?.id}
          nome={nomeDaAvaliacao ?? undefined}
          etapa="identidade"
          meta={[application?.code ? `Ciclo ${application.code}` : null, "Capa e textos de abertura"]}
          acao={<BotaoProximaEtapa etapa="identidade" surveyId={surveyId} applicationId={application?.id} />}
        />

        {dataLoading || !application ? (
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
            {/* O nome da avaliação já é o título do cabeçalho da jornada; aqui
                basta dizer o que esta etapa faz. */}
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Identidade visual</h3>

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
                    <label htmlFor="banner-upload" className="block text-sm font-semibold text-[var(--text-primary)]">
                      Imagem de capa
                    </label>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">JPG, PNG ou WEBP, até 5 MB. Recomenda-se proporção horizontal de 4:1.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label
                        htmlFor="banner-upload"
                        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-strong)]"
                      >
                        {uploading
                          ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />
                          : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
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
                          <Trash2 className="h-4 w-4" aria-hidden="true" /> Restaurar padrão
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
                    placeholder={application.name}
                    hint="Deixe em branco para usar o nome do ciclo."
                  />

                  <Textarea
                    label="Subtítulo ou texto de apoio"
                    value={visual.heroSubtitle ?? ""}
                    maxLength={500}
                    rows={5}
                    onChange={(event) => setVisual((current) => ({ ...current, heroSubtitle: event.target.value }))}
                    hint="Apresentação exibida abaixo do título, na abertura do instrumento."
                  />

                  <div className="space-y-3">
                    <Button fullWidth size="lg" disabled={saving || uploading} onClick={save}>
                      {saving ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
                      {saving ? "Salvando..." : "Salvar identidade visual"}
                    </Button>

                    {/* Sai sem gravar: o que está no formulário é descartado, e a
                        capa publicada continua sendo a do último salvamento. */}
                    <Link
                      href={`/admin/pesquisas/${surveyId}/operacao`}
                      aria-disabled={saving || uploading}
                      onClick={(event) => { if (saving || uploading) event.preventDefault(); }}
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "lg", fullWidth: true }),
                        (saving || uploading) && "pointer-events-none opacity-50",
                      )}
                    >
                      Cancelar
                    </Link>
                  </div>
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
                      src={visual.themeVariant === "CUSTOM" && visual.bannerUrl
                        ? visual.bannerUrl
                        : DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl}
                      fallbackSrc={DEFAULT_CDDI_VISUAL_IDENTITY.bannerUrl}
                      alt={visual.themeVariant === "CUSTOM" && visual.bannerUrl
                        ? visual.bannerAlt || "Pré-visualização da capa do instrumento"
                        : DEFAULT_CDDI_VISUAL_IDENTITY.bannerAlt}
                      className="aspect-[4/1] w-full object-cover"
                    />
                    <div className="border-t-[5px] border-[var(--cddi-rule)] p-6">
                      <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">{application.code}</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cddi-ink)]">
                        {visual.heroTitle?.trim() || application.name}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                        {visual.heroSubtitle?.trim() || "Texto de apresentação do instrumento configurado pela administração."}
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
