"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, RotateCcw, Save, SwatchBook } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ExternalImage } from "@/components/external-image";
import { FullPageState } from "@/components/full-page-state";
import { platformBrandingQueryKey, usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding } from "@/lib/platform-branding";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(60),
  productName: z.string().trim().min(1, "Informe o nome do sistema.").max(60),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use uma cor no formato #RRGGBB."),
});

type FormValues = z.infer<typeof schema>;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function PlatformSettingsPage() {
  const { context, loading, error } = usePlatformContext();
  const { branding } = usePlatformBranding();
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

      if (logoFile) {
        const extension = logoFile.name.split(".").at(-1)?.toLowerCase() || "png";
        const path = `branding/logo-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("platform-assets").upload(path, logoFile, {
          cacheControl: "3600",
          contentType: logoFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
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
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(platformBrandingQueryKey, updated);
      setLogoFile(null);
      setRemoveLogo(false);
      toast.success("Identidade da plataforma atualizada.");
    },
    onError: (saveError) => toast.error(saveError instanceof Error ? saveError.message : "Não foi possível salvar a identidade."),
  });

  function selectLogo(file: File | undefined) {
    if (!file) return;
    if (!acceptedTypes.has(file.type)) {
      toast.error("Envie uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O logotipo deve possuir no máximo 2 MB.");
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
  }

  if (loading) return <PlatformSkeleton title="Carregando configurações" />;
  if (!context?.person) return <FullPageState title="Não foi possível abrir as configurações" description={error || "Seu acesso institucional não foi identificado."} />;
  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_ACCESS")) return <FullPageState tone="restricted" title="Configurações restritas" description="Seu perfil não possui permissão para alterar a identidade da plataforma." />;

  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), avatarUrl: context.person.avatarUrl, roles: context.roles, modules };
  const displayedLogo = removeLogo ? DEFAULT_PLATFORM_BRANDING.logoUrl : previewUrl ?? branding.logoUrl;

  return (
    <PlatformShell user={user} eyebrow="Administração" title="Configurações do sistema">
      <PageHeader eyebrow="Identidade global" title="Marca e aparência" description="Defina como a plataforma é identificada no menu, no acesso e nas áreas institucionais. As alterações ficam registradas para auditoria." />

      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><SwatchBook className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[var(--text-primary)]">Nomes institucionais</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Textos curtos funcionam melhor no menu lateral e em telas menores.</p></div></div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Input label="Organização" placeholder="AgSUS" error={form.formState.errors.organizationName?.message} {...form.register("organizationName")} />
              <Input label="Nome do sistema" placeholder="Pesquisas" error={form.formState.errors.productName?.message} {...form.register("productName")} />
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><ImageUp className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[var(--text-primary)]">Logotipo</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">PNG, JPG ou WebP, até 2 MB. Prefira uma imagem quadrada com fundo transparente.</p></div></div>
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm"><ExternalImage src={displayedLogo} alt="Prévia do logotipo" width={96} height={96} className="h-full w-full object-contain" /></div>
              <div className="flex-1">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand-solid)] px-4 text-sm font-black text-white transition hover:bg-[var(--brand-solid-hover)]">
                  <ImageUp className="h-4 w-4" />Selecionar imagem
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => selectLogo(event.target.files?.[0])} />
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
                <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-2"><ExternalImage src={displayedLogo} alt="" width={40} height={40} className="h-10 w-10 object-contain" /></span><span><small className="block uppercase tracking-[.18em] text-[var(--sidebar-muted)]">{watchedOrganization}</small><strong className="mt-1 block">{watchedName}</strong></span></div>
                <div className="mt-5 rounded-xl px-3 py-3 text-sm font-bold" style={{ background: watchedColor }}>Visão geral</div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">A prévia representa a identidade global. Banners específicos continuam configuráveis dentro de cada pesquisa.</p>
            </div>
          </Surface>
          <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{mutation.isPending ? "Salvando..." : "Salvar identidade"}</Button>
        </aside>
      </form>
    </PlatformShell>
  );
}
