"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleDot,
  ImageUp,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  SwatchBook,
  Type,
  UserCog,
  X,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { platformBrandingQueryKey, usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformLogo } from "@/components/platform-logo";
import { PlatformShell } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableEmpty,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableState,
} from "@/components/ui/data-table";
import { Input } from "@/components/ui/form-controls";
import { errorMessageFromUnknown } from "@/lib/observability";
import { invalidatePlatformContext, usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE, resolvePlatformRole } from "@/lib/platform-modules";
import { PLATFORM_ROLE } from "@/lib/platform-roles";
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

// Perfis e pessoas (consolidados de /admin/acessos) ------------------------------
type Role = { code: string; name: string; description: string | null };
type PersonRole = { code: string };
type Person = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  active: boolean;
  roles: PersonRole[];
};
type Workspace = { roles: Role[]; people: Person[] };

const roleOrder: string[] = [PLATFORM_ROLE.SUPER_ADMIN, PLATFORM_ROLE.ADMIN, PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.PARTICIPANT];

// Abas do workspace. Cada card declara sua seção e só aparece na aba
// correspondente (ou em "Tudo") e quando casa com a busca.
type SectionId = "brand" | "appearance" | "access";
const TABS: { id: "all" | SectionId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "Tudo", icon: LayoutGrid },
  { id: "brand", label: "Marca", icon: Type },
  { id: "appearance", label: "Aparência", icon: SwatchBook },
  { id: "access", label: "Acessos", icon: UserCog },
];
// Acento superior de cada seção — sempre por token, nunca hexadecimal literal.
const SECTION_ACCENT: Record<SectionId, string> = {
  brand: "var(--brand-solid)",
  appearance: "var(--brand-secondary)",
  access: "var(--status-warning-text)",
};

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function effectiveRoleCode(person: Person) {
  return resolvePlatformRole(person.roles.map((role) => role.code));
}

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
  const granted = guard.state === "granted";
  const currentPersonId = guard.state === "granted" ? guard.person.id : undefined;

  const [tab, setTab] = useState<"all" | SectionId>("all");
  const [wsQuery, setWsQuery] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Estado da seção Acessos
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState("");

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

  const loadPeople = useCallback(async (term = "") => {
    setFetching(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("list_access_workspace", { search_term: term });
      if (rpcError) throw rpcError;
      setWorkspace(data as Workspace);
    } catch (loadError) {
      toast.error(errorMessageFromUnknown(loadError) || "Não foi possível carregar os acessos.");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (granted) void loadPeople();
  }, [granted, loadPeople]);

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

  const brandDirty = form.formState.isDirty || Boolean(logoFile) || removeLogo;
  const submitBranding = useCallback(() => {
    void form.handleSubmit((values) => mutation.mutate(values))();
  }, [form, mutation]);

  // Ctrl/Cmd + S salva a identidade quando há alterações pendentes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        if (brandDirty && !mutation.isPending) {
          event.preventDefault();
          submitBranding();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [brandDirty, mutation.isPending, submitBranding]);

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

  const isCurrentPerson = (person: Person) => Boolean(currentPersonId) && person.personId === currentPersonId;

  async function setProfile(person: Person, role: Role) {
    if (person.roles.length === 1 && person.roles[0]?.code === role.code) return;
    if (isCurrentPerson(person) && role.code !== PLATFORM_ROLE.SUPER_ADMIN) {
      toast.error("Você não pode retirar seu próprio perfil de Superadmin.");
      return;
    }

    setChanging(`${person.personId}:${role.code}`);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("fc_definir_perfil_pessoa", {
        p_pessoa: person.personId,
        p_perfil: role.code,
      });
      if (rpcError) throw rpcError;

      toast.success(`${person.fullName} agora tem o perfil ${role.name}.`);
      invalidatePlatformContext();
      await loadPeople(peopleQuery);
    } catch (changeError) {
      toast.error(errorMessageFromUnknown(changeError) || "Não foi possível alterar o perfil.");
      await loadPeople(peopleQuery);
    } finally {
      setChanging("");
    }
  }

  const roles = useMemo(
    () =>
      [...(workspace?.roles ?? [])].sort((a, b) => {
        const ai = roleOrder.indexOf(a.code);
        const bi = roleOrder.indexOf(b.code);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
    [workspace],
  );

  // Visibilidade de cada card: casa a aba ativa e a busca do workspace.
  const term = normalize(wsQuery);
  const cardVisible = (section: SectionId, keywords: string) => {
    const tabOk = tab === "all" || tab === section;
    const searchOk = !term || normalize(keywords).includes(term);
    return tabOk && searchOk;
  };
  const brandVisible = cardVisible("brand", "marca nomes institucionais organização nome do sistema identidade");
  const appearanceVisible = cardVisible("appearance", "aparência logotipo logo cor principal cores tema prévia menu");
  const accessVisible = cardVisible("access", "acessos permissões perfis pessoas segurança participante avaliador admin superadmin");
  const visibleCount = [brandVisible, appearanceVisible, accessVisible].filter(Boolean).length;

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="configurações"
      unidentifiedTitle="Não foi possível abrir as configurações"
      restrictedTitle="Configurações restritas"
      restrictedDescription="Somente o Superadmin pode alterar a identidade da plataforma e os perfis de acesso."
    />;
  }

  const displayedLogo = removeLogo ? DEFAULT_PLATFORM_BRANDING.logoUrl : previewUrl ?? branding.logoUrl;

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="Configurações do sistema">
      <div className="min-w-0 pb-28">
        {/* Barra de navegação do workspace */}
        <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm sm:px-6" aria-label="Navegação das configurações">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="section-eyebrow">Administração do sistema</span>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">Configurações</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Localize ajustes, revise acessos e salve alterações com validação antes de publicar.</p>
            </div>
            <label className="relative block w-full min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={wsQuery}
                onChange={(event) => setWsQuery(event.target.value)}
                placeholder="Pesquisar configuração..."
                aria-label="Pesquisar configuração"
                className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-10 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-solid)] focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand-solid)_18%,transparent)]"
              />
              {wsQuery ? (
                <button type="button" onClick={() => setWsQuery("")} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias de configuração">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition ${
                    active
                      ? "border-[color-mix(in_srgb,var(--brand-solid)_45%,transparent)] bg-[var(--status-info-bg)] text-[var(--brand-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--brand-primary)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-[11px] font-bold text-[var(--text-muted)]">
            <span>{visibleCount} {visibleCount === 1 ? "seção disponível" : "seções disponíveis"}</span>
            {brandDirty ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--status-warning-text)]"><CircleDot className="h-3 w-3" aria-hidden="true" />Alterações não salvas</span>
            ) : null}
          </div>
        </section>

        <div className="mt-5 space-y-5">
          {/* MARCA */}
          {brandVisible ? (
            <section data-config-section="brand" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.brand }}>
              <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><Type className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)]">Nomes institucionais</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Textos curtos funcionam melhor no menu lateral e em telas menores.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Input label="Organização" placeholder="AgSUS" form="config-brand-form" error={form.formState.errors.organizationName?.message} {...form.register("organizationName")} />
                <Input label="Nome do sistema" placeholder="Avaliações" form="config-brand-form" error={form.formState.errors.productName?.message} {...form.register("productName")} />
              </div>
            </section>
          ) : null}

          {/* APARÊNCIA */}
          {appearanceVisible ? (
            <section data-config-section="appearance" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.appearance }}>
              <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><SwatchBook className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)]">Logotipo, cor e prévia</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Aparência global da plataforma. Banners específicos continuam por avaliação.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div>
                    <p className="section-eyebrow">Logotipo</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">PNG, JPG ou WebP, até 2 MB. Prefira uma imagem quadrada com fundo transparente.</p>
                    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm"><PlatformLogo src={displayedLogo} alt="Prévia do logotipo" organizationName={watchedOrganization} width={96} height={96} loading={brandingLoading && !previewUrl} className="h-full w-full object-contain text-xl" /></div>
                      <div className="flex-1">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand-solid)] px-4 text-sm font-black text-white transition hover:bg-[var(--brand-solid-hover)]">
                          <ImageUp className="h-4 w-4" aria-hidden="true" />Selecionar imagem
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void selectLogo(event.target.files?.[0])} />
                        </label>
                        <Button type="button" variant="ghost" className="ml-2" onClick={() => { setLogoFile(null); setRemoveLogo(true); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Usar marca padrão</Button>
                        <p className="mt-3 text-xs text-[var(--text-secondary)]">{logoFile ? logoFile.name : removeLogo ? "A marca institucional padrão será restaurada." : branding.logoPath ? "Logotipo personalizado ativo." : "Marca institucional padrão ativa."}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-6">
                    <p className="section-eyebrow">Cor principal</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Aplicada em botões e navegação ativa. O modo escuro mantém contraste próprio para textos e superfícies.</p>
                    <div className="mt-4 flex max-w-md items-center gap-3">
                      <input id="primaryColor" type="color" value={watchedColor} onChange={(event) => form.setValue("primaryColor", event.target.value, { shouldDirty: true, shouldValidate: true })} className="h-12 w-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" />
                      <Input label="Valor hexadecimal" containerClassName="flex-1" form="config-brand-form" error={form.formState.errors.primaryColor?.message} {...form.register("primaryColor")} />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                  <div className="h-1.5" style={{ background: watchedColor }} />
                  <div className="p-5">
                    <p className="section-eyebrow">Prévia do menu</p>
                    <div className="mt-4 rounded-2xl bg-[var(--sidebar-background)] p-4 text-white">
                      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-2"><PlatformLogo src={displayedLogo} alt="" organizationName={watchedOrganization} width={40} height={40} loading={brandingLoading && !previewUrl} className="h-10 w-10 object-contain text-xs" /></span><span><small className="block uppercase tracking-[.18em] text-[var(--sidebar-muted)]">{watchedOrganization}</small><strong className="mt-1 block">{watchedName}</strong></span></div>
                      <div className="mt-5 rounded-xl px-3 py-3 text-sm font-bold text-white" style={{ background: watchedColor }}>Visão geral</div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">A prévia representa a identidade global.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* ACESSOS */}
          {accessVisible ? (
            <section data-config-section="access" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.access }}>
              <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"><UserCog className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <h3 className="text-base font-black text-[var(--text-primary)]">Pessoas e permissões</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{roles.length ? `Cada pessoa tem exatamente um dos ${roles.length} perfis. Selecionar um substitui o anterior — a mudança é imediata e auditada.` : "Pesquise uma pessoa e defina seu perfil. A mudança é imediata e auditada."}</p>
                  </div>
                </div>
                <form
                  onSubmit={(event) => { event.preventDefault(); void loadPeople(peopleQuery); }}
                  className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end lg:w-auto lg:min-w-[26rem]"
                >
                  <Input
                    label="Pesquisar pessoa"
                    value={peopleQuery}
                    onChange={(event) => setPeopleQuery(event.target.value)}
                    placeholder="Nome, matrícula ou e-mail"
                    containerClassName="min-w-0 flex-1"
                  />
                  <Button type="submit" disabled={fetching} className="sm:mb-0">
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                    Buscar
                  </Button>
                </form>
              </div>

              <DataTableContainer className="mt-5 min-w-0 border-0 shadow-none" aria-label="Pessoas e perfis da plataforma">
                {fetching && !workspace ? (
                  <DataTableState aria-live="polite">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
                    <p className="mt-3 font-semibold">Carregando pessoas e permissões...</p>
                  </DataTableState>
                ) : (
                  <DataTableScroll className="max-h-[60dvh] min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
                    <DataTable className="min-w-max">
                      <DataTableHead className="sticky top-0 z-20">
                        <DataTableRow className="hover:bg-transparent">
                          <DataTableHeaderCell className="sticky left-0 z-30 min-w-[19rem] bg-[var(--surface-muted)] shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] sm:min-w-[22rem]">
                            Pessoa
                          </DataTableHeaderCell>
                          {roles.map((role) => (
                            <DataTableHeaderCell key={role.code} className="w-32 min-w-32 text-center">
                              <span title={role.description ?? role.name}>{role.name}</span>
                            </DataTableHeaderCell>
                          ))}
                        </DataTableRow>
                      </DataTableHead>
                      <DataTableBody>
                        {(workspace?.people ?? []).map((person) => (
                          <DataTableRow key={person.personId} className="group">
                            <DataTableCell className="sticky left-0 z-10 bg-[var(--surface-card)] shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] transition-colors group-hover:bg-[var(--surface-interactive)]">
                              <div className="flex min-w-72 items-center gap-3">
                                <PersonAvatar fullName={person.fullName} className="h-10 w-10 rounded-xl" fallbackClassName="text-xs" />
                                <div className="min-w-0 max-w-[17rem] sm:max-w-[20rem]">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <strong className="truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong>
                                    <Badge variant={person.active ? "success" : "neutral"}>{person.active ? "Ativo" : "Inativo"}</Badge>
                                  </div>
                                  <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">
                                    {person.institutionalEmail ?? person.employeeNumber ?? "Sem identificação"}
                                  </span>
                                  <span className="block truncate text-[11px] text-[var(--text-muted)]">
                                    {person.jobTitle ?? "Cargo não informado"}
                                    {person.unit ? ` · ${person.unit}` : ""}
                                  </span>
                                </div>
                              </div>
                            </DataTableCell>
                            {roles.map((role) => {
                              const active = effectiveRoleCode(person) === role.code;
                              const busy = changing.startsWith(`${person.personId}:`);
                              const isSelfDowngrade = isCurrentPerson(person) && role.code !== PLATFORM_ROLE.SUPER_ADMIN;
                              const blocked = busy || isSelfDowngrade;

                              return (
                                <DataTableCell key={role.code} className="w-32 min-w-32 text-center">
                                  <button
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={`Definir o perfil ${role.name} para ${person.fullName}`}
                                    title={isSelfDowngrade ? "Você não pode retirar seu próprio perfil de Superadmin." : undefined}
                                    onClick={() => void setProfile(person, role)}
                                    disabled={blocked}
                                    className={`grid h-7 w-7 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-40 ${
                                      busy ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
                                    } ${
                                      active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white enabled:hover:border-emerald-400"
                                    }`}
                                  >
                                    {busy && changing === `${person.personId}:${role.code}` ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" aria-hidden="true" />
                                    ) : active ? (
                                      <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                                    ) : null}
                                  </button>
                                </DataTableCell>
                              );
                            })}
                          </DataTableRow>
                        ))}
                        {!fetching && !(workspace?.people?.length) && (
                          <DataTableEmpty colSpan={Math.max(roles.length + 1, 1)}>
                            Nenhuma pessoa encontrada para os critérios informados.
                          </DataTableEmpty>
                        )}
                      </DataTableBody>
                    </DataTable>
                  </DataTableScroll>
                )}
              </DataTableContainer>
            </section>
          ) : null}

          {visibleCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-12 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
              <strong className="mt-4 block text-[var(--text-primary)]">Nenhuma configuração encontrada</strong>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Ajuste a busca ou escolha outra aba.</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Formulário da marca (campos ficam nos cards via atributo form=) */}
      <form id="config-brand-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="hidden" aria-hidden="true" />

      {/* Barra de salvar fixa */}
      <div className="pointer-events-none sticky bottom-0 z-30 -mx-4 mt-4 sm:-mx-6 lg:-mx-8">
        <div className="pointer-events-auto border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${brandDirty ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" : "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"}`}>
                {brandDirty ? <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="leading-tight">
                <strong className="block text-sm text-[var(--text-primary)]">{brandDirty ? "Alterações de identidade pendentes" : "Nenhuma alteração pendente"}</strong>
                <span className="text-xs text-[var(--text-secondary)]">{brandDirty ? "Salve para aplicar marca e aparência a toda a plataforma." : "Perfis de acesso são aplicados imediatamente ao clicar."}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] font-bold text-[var(--text-muted)] sm:inline">Ctrl + S</span>
              <Button type="submit" form="config-brand-form" size="lg" disabled={!brandDirty || mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {mutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
