"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, RotateCcw, Save, SwatchBook } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { platformBrandingQueryKey, usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformLogo } from "@/components/platform-logo";
import { PlatformShell } from "@/components/platform-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding } from "@/lib/platform-branding";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(60),
  productName: z.string().trim().min(1, "Informe o nome do sistema.").max(60),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use uma cor no formato #RRGGBB."),
});

type FormValues = z.infer<typeof schema>;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const logoExtensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function validateLogoComposition(file: File) {
  const image = await createImageBitmap(file);
  try {
    if (image.width < 128 || image.height < 128) {
      throw new Error("Use uma imagem com pelo menos 128 × 128 pixels.");
    }
    const aspectRatio = image.width / image.height;
    if (aspectRatio < 0.5 || aspectRatio > 2) {
      throw new Error("Use um logotipo quadrado ou com proporção próxima de 1:1.");
    }

    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const cornerIndexes = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
    const background = cornerIndexes.reduce(
      (color, index) => ({
        r: color.r + pixels[index] / cornerIndexes.length,
        g: color.g + pixels[index + 1] / cornerIndexes.length,
        b: color.b + pixels[index + 2] / cornerIndexes.length,
        a: color.a + pixels[index + 3] / cornerIndexes.length,
      }),
      { r: 0, g: 0, b: 0, a: 0 },
    );
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const alpha = pixels[index + 3];
        const colorDistance = Math.abs(pixels[index] - background.r)
          + Math.abs(pixels[index + 1] - background.g)
          + Math.abs(pixels[index + 2] - background.b)
          + Math.abs(alpha - background.a);
        const isContent = background.a < 24 ? alpha > 32 : colorDistance > 70;
        if (!isContent) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const contentWidth = maxX >= minX ? (maxX - minX + 1) / width : 0;
    const contentHeight = maxY >= minY ? (maxY - minY + 1) / height : 0;
    if (contentWidth < 0.35 || contentHeight < 0.35) {
      throw new Error("O símbolo ocupa uma área muito pequena da imagem. Recorte as margens antes de enviar.");
    }
  } finally {
    image.close();
  }
}

export default function PlatformSettingsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_ACCESS);
  const { branding, loading: brandingLoading } = usePlatformBranding();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationName: branding.organizationName,
      productName: branding.productName,
      primaryColor: branding.primaryColor,
    },
  });
  const watchedName = useWatch({ control: form.control, name: "productName" }) || branding.productName;
  const watchedOrganization = useWatch({ control: form.control, name: "organizationName" }) || branding.organizationName;
  const watchedColor = useWatch({ control: form.control, name: "primaryColor" }) || branding.primaryColor;

  useEffect(() => {
    form.reset({
      organizationName: branding.organizationName,
      productName: branding.productName,
      primaryColor: branding.primaryColor,
    });
  }, [branding, form]);

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const supabase = createBrowserSupabaseClient();
      let logoUrl = removeLogo ? null : branding.logoUrl === DEFAULT_PLATFORM_BRANDING.logoUrl ? null : branding.logoUrl;
      let logoPath = removeLogo ? null : branding.logoPath;
      let uploadedPath: string | null = null;

      try {
        if (logoFile) {
          const extension = logoExtensionByType[logoFile.type] ?? "png";
          const path = `branding/logo-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("platform-assets").upload(path, logoFile, {
            cacheControl: "3600",
            contentType: logoFile.type,
            upsert: false,
          });
          if (uploadError) throw uploadError;
          uploadedPath = path;
          const { data } = supabase.storage.from("platform-assets").getPublicUrl(path);
          logoUrl = data.publicUrl;
          logoPath = path;
        }

        const { data, error: saveError } = await supabase.rpc("fc_atualizar_marca_plataforma", {
          no_organizacao_param: values.organizationName,
          no_produto_param: values.productName,
          tx_url_logotipo_param: logoUrl,
          tx_caminho_param: logoPath,
          co_cor_principal_param: values.primaryColor,
        });
        if (saveError) throw saveError;

        return normalizePlatformBranding(data);
      } catch (saveError) {
        if (uploadedPath) await supabase.storage.from("platform-assets").remove([uploadedPath]);
        throw saveError;
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(platformBrandingQueryKey, updated);
      setLogoFile(null);
      setRemoveLogo(false);
      toast.success("Identidade da plataforma atualizada.");
    },
    onError: (saveError) => {
      const message = saveError instanceof Error ? saveError.message : "Não foi possível salvar a identidade.";
      toast.error(/bucket not found/i.test(message) ? "O armazenamento institucional não está disponível. Atualize a página e tente novamente." : message);
    },
  });

  async function selectLogo(file: File | undefined) {
    if (!file) return;
    if (!acceptedTypes.has(file.type)) {
      toast.error("Envie uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O logotipo deve possuir no máximo 2 MB.");
      return;
    }
    try {
      await validateLogoComposition(file);
      setLogoFile(file);
      setRemoveLogo(false);
    } catch (validationError) {
      toast.error(validationError instanceof Error ? validationError.message : "Não foi possível validar o logotipo.");
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="configurações"
      unidentifiedTitle="Não foi possível abrir as configurações"
      restrictedTitle="Configurações restritas"
      restrictedDescription="Seu perfil não possui permissão para alterar a identidade da plataforma."
    />;
  }

  const displayedLogo = removeLogo ? DEFAULT_PLATFORM_BRANDING.logoUrl : previewUrl ?? branding.logoUrl;

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="Configurações do sistema">
      <PageHeader eyebrow="Identidade global" title="Marca e aparência" description="Defina como a plataforma é identificada no menu, no acesso e nas áreas institucionais. As alterações ficam registradas para auditoria." />

      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><SwatchBook className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[var(--text-primary)]">Nomes institucionais</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Textos curtos funcionam melhor no menu lateral e em telas menores.</p></div></div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Input label="Organização" placeholder="AgSUS" error={form.formState.errors.organizationName?.message} {...form.register("organizationName")} />
              <Input label="Nome do sistema" placeholder="Avaliações" error={form.formState.errors.productName?.message} {...form.register("productName")} />
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><ImageUp className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[var(--text-primary)]">Logotipo</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">PNG, JPG ou WebP, até 2 MB. Prefira uma imagem quadrada com fundo transparente.</p></div></div>
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm"><PlatformLogo src={displayedLogo} alt="Prévia do logotipo" organizationName={watchedOrganization} width={96} height={96} loading={brandingLoading && !previewUrl} className="h-full w-full object-contain text-xl" /></div>
              <div className="flex-1">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand-solid)] px-4 text-sm font-black text-white transition hover:bg-[var(--brand-solid-hover)]">
                  <ImageUp className="h-4 w-4" />Selecionar imagem
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void selectLogo(event.target.files?.[0])} />
                </label>
                <Button type="button" variant="ghost" className="ml-2" onClick={() => { setLogoFile(null); setRemoveLogo(true); }}><RotateCcw className="h-4 w-4" />Usar marca padrão</Button>
                <p className="mt-3 text-xs text-[var(--text-secondary)]">{logoFile ? logoFile.name : removeLogo ? "A marca institucional padrão será restaurada." : branding.logoPath ? "Logotipo personalizado ativo." : "Marca institucional padrão ativa."}</p>
              </div>
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <label className="block text-sm font-semibold text-[var(--text-primary)]" htmlFor="primaryColor">Cor principal</label>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Aplicada em botões e navegação ativa. O modo escuro mantém contraste próprio para textos e superfícies.</p>
            <div className="mt-4 flex max-w-md items-center gap-3">
              <input id="primaryColor" type="color" value={watchedColor} onChange={(event) => form.setValue("primaryColor", event.target.value, { shouldDirty: true, shouldValidate: true })} className="h-12 w-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" />
              <Input label="Valor hexadecimal" containerClassName="flex-1" error={form.formState.errors.primaryColor?.message} {...form.register("primaryColor")} />
            </div>
          </Surface>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Surface className="overflow-hidden">
            <div className="h-1.5" style={{ background: watchedColor }} />
            <div className="p-6">
              <p className="section-eyebrow">Prévia do menu</p>
              <div className="mt-5 rounded-2xl bg-[var(--sidebar-background)] p-4 text-white">
                <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-2"><PlatformLogo src={displayedLogo} alt="" organizationName={watchedOrganization} width={40} height={40} loading={brandingLoading && !previewUrl} className="h-10 w-10 object-contain text-xs" /></span><span><small className="block uppercase tracking-[.18em] text-[var(--sidebar-muted)]">{watchedOrganization}</small><strong className="mt-1 block">{watchedName}</strong></span></div>
                <div className="mt-5 rounded-xl px-3 py-3 text-sm font-bold" style={{ background: watchedColor }}>Visão geral</div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">A prévia representa a identidade global. Banners específicos continuam configuráveis dentro de cada avaliação.</p>
            </div>
          </Surface>
          <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{mutation.isPending ? "Salvando..." : "Salvar identidade"}</Button>
        </aside>
      </form>
    </PlatformShell>
  );
}
