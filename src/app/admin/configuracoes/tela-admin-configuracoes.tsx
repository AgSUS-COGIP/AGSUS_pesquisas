"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ImagePlus,
  LogIn,
  RadioTower,
  CircleDot,
  LayoutGrid,
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  SwatchBook,
  TriangleAlert,
  Type,
  UserCog,
  X,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/confirmation-provider";
import { AccessScreenPreview } from "@/components/access-screen-preview";
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
import {
  contrastRatio,
  DARK_FOREGROUND,
  LIGHT_FOREGROUND,
  needsLightForeground,
  WCAG_AA_NORMAL_TEXT,
} from "@/lib/color-contrast";
import { errorMessageFromUnknown } from "@/lib/observability";
import { invalidatePlatformContext, usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE, resolvePlatformRole } from "@/lib/platform-modules";
import { PLATFORM_ROLE, PLATFORM_ROLE_LABELS } from "@/lib/platform-roles";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding } from "@/lib/platform-branding";
import {
  ACCESS_PAGE_SIZE,
  accessPageRange,
  nextAccessOffset,
  previousAccessOffset,
} from "@/lib/access-pagination";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  atualizarMarcaDaPlataforma,
  definirCorDaBarraLateral,
  definirCorDoPainelDeAcesso,
  definirTextosDaMarca,
  definirFundoDeAcesso,
  definirPresencaOnline,
  definirPerfilDaPessoa,
  obterAreaDeAcessos,
} from "@/lib/api/cliente-pessoas";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(60),
  productName: z.string().trim().min(1, "Informe o nome do sistema.").max(60),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use uma cor no formato #RRGGBB."),
});

type FormValues = z.infer<typeof schema>;

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
type Workspace = {
  status: "OK";
  roles: Role[];
  people: Person[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const roleOrder: string[] = [
  PLATFORM_ROLE.SUPER_ADMIN,
  PLATFORM_ROLE.ADMIN,
  PLATFORM_ROLE.MANAGER,
  PLATFORM_ROLE.EVALUATOR,
  PLATFORM_ROLE.PARTICIPANT,
];

type SectionId = "brand" | "login" | "appearance" | "features" | "access";
const TABS: { id: "all" | SectionId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "Tudo", icon: LayoutGrid },
  { id: "brand", label: "Marca", icon: Type },
  { id: "login", label: "Tela de acesso", icon: LogIn },
  { id: "appearance", label: "Aparência", icon: SwatchBook },
  { id: "features", label: "Recursos", icon: RadioTower },
  { id: "access", label: "Acessos", icon: UserCog },
];
const SECTION_ACCENT: Record<SectionId, string> = {
  brand: "var(--brand-solid)",
  login: "var(--brand-primary)",
  appearance: "var(--brand-secondary)",
  features: "var(--status-success-text)",
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

export default function PlatformSettingsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_ACCESS);
  const { branding, loading: brandingLoading } = usePlatformBranding();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const granted = guard.state === "granted";
  const currentPersonId = guard.state === "granted" ? guard.person.id : undefined;

  const [tab, setTab] = useState<"all" | SectionId>("all");
  const [wsQuery, setWsQuery] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleError, setPeopleError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState("");
  const [presenceEnabled, setPresenceEnabled] = useState(branding.onlinePresenceEnabled);
  const [presenceRoles, setPresenceRoles] = useState<string[]>(branding.onlinePresenceViewerRoles);
  const [savingPresence, setSavingPresence] = useState(false);

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
  const ultimoSincronizado = useRef<FormValues | null>(null);
  const formularioSujo = form.formState.isDirty;

  useEffect(() => {
    const valores: FormValues = {
      organizationName: branding.organizationName,
      productName: branding.productName,
      primaryColor: branding.primaryColor,
    };
    const anterior = ultimoSincronizado.current;
    const mudou = !anterior
      || anterior.organizationName !== valores.organizationName
      || anterior.productName !== valores.productName
      || anterior.primaryColor !== valores.primaryColor;
    if (!mudou || formularioSujo) return;
    ultimoSincronizado.current = valores;
    form.reset(valores);
  }, [branding.organizationName, branding.productName, branding.primaryColor, form, formularioSujo]);

  useEffect(() => {
    setPresenceEnabled(branding.onlinePresenceEnabled);
    setPresenceRoles(branding.onlinePresenceViewerRoles);
  }, [branding.onlinePresenceEnabled, branding.onlinePresenceViewerRoles]);

  const loadPeople = useCallback(async (term = "", offset = 0) => {
    setFetching(true);
    setPeopleError("");
    try {
      const page = await obterAreaDeAcessos({ busca: term, limite: ACCESS_PAGE_SIZE, offset });
      setWorkspace(page);
      setPeopleSearch(term.trim());
    } catch (loadError) {
      const message = errorMessageFromUnknown(loadError) || "Não foi possível carregar os acessos.";
      setPeopleError(message);
      toast.error(message);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (granted) void loadPeople();
  }, [granted, loadPeople]);

  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [textos, setTextos] = useState({
    expansao: branding.productDescription,
    saudacao: branding.accessGreeting,
    instrucao: branding.accessInstruction,
  });
  const accessPanelIsDark = needsLightForeground(branding.accessPanelColor);
  const contrastePainel = branding.accessPanelColor
    ? contrastRatio(accessPanelIsDark ? LIGHT_FOREGROUND : DARK_FOREGROUND, branding.accessPanelColor)
    : null;
  const contrastePainelAprovado = (contrastePainel ?? 0) >= WCAG_AA_NORMAL_TEXT;
  const corDaBarra = branding.sidebarColor;
  const sidebarIsDark = needsLightForeground(corDaBarra ?? "#0f2942");
  const contrasteBarra = corDaBarra
    ? contrastRatio(sidebarIsDark ? LIGHT_FOREGROUND : DARK_FOREGROUND, corDaBarra)
    : null;
  const contrasteBarraAprovado = (contrasteBarra ?? 0) >= WCAG_AA_NORMAL_TEXT;
  const [gallery, setGallery] = useState<{ path: string; url: string; sizeKb: number }[]>([]);

  const loadGallery = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.storage.from("platform-assets").list("branding", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      setGallery((data ?? []).filter((item) => item.name && !item.name.startsWith(".")).map((item) => {
        const path = `branding/${item.name}`;
        return {
          path,
          url: supabase.storage.from("platform-assets").getPublicUrl(path).data.publicUrl,
          sizeKb: Math.round(((item.metadata?.size as number) ?? 0) / 1024),
        };
      }));
    } catch (listError) {
      console.warn("Galeria de artes indisponível:", errorMessageFromUnknown(listError));
    }
  }, []);

  useEffect(() => {
    if (granted) void loadGallery();
  }, [granted, loadGallery]);

  const applyGalleryImage = useCallback(async (item: { path: string; url: string }) => {
    setUploadingBackground(true);
    try {
      await definirFundoDeAcesso(item.url, item.path);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, accessBackgroundUrl: item.url, accessBackgroundPath: item.path });
      toast.success("Arte aplicada à tela de acesso.");
    } catch (useError) {
      toast.error(errorMessageFromUnknown(useError) || "Não foi possível aplicar a arte.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient]);

  const togglePresenceRole = useCallback((role: string) => {
    setPresenceRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }, []);

  const savePresence = useCallback(async () => {
    if (presenceRoles.length === 0) {
      toast.error("Selecione ao menos um perfil para usar a presença online.");
      return;
    }
    setSavingPresence(true);
    try {
      await definirPresencaOnline(presenceEnabled, presenceRoles);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, onlinePresenceEnabled: presenceEnabled, onlinePresenceViewerRoles: presenceRoles });
      toast.success(presenceEnabled ? "Presença online atualizada." : "Presença online desativada.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a presença online.");
    } finally {
      setSavingPresence(false);
    }
  }, [branding, presenceEnabled, presenceRoles, queryClient]);

  const deleteGalleryImage = useCallback(async (item: { path: string }) => {
    if (branding.accessBackgroundPath === item.path) {
      toast.error("Esta arte está em uso. Escolha outra ou restaure o padrão antes de apagar.");
      return;
    }
    const confirmed = await confirm({
      title: "Apagar esta arte?",
      description: "O arquivo sai do armazenamento e não há como recuperar. Artes em uso não podem ser apagadas.",
      confirmLabel: "Apagar arte",
      tone: "danger",
    });
    if (!confirmed) return;
    setUploadingBackground(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage.from("platform-assets").remove([item.path]);
      if (error) throw error;
      await loadGallery();
      toast.success("Arte removida do armazenamento.");
    } catch (deleteError) {
      toast.error(errorMessageFromUnknown(deleteError) || "Não foi possível apagar a arte.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding.accessBackgroundPath, confirm, loadGallery]);

  const saveAccessPanelColor = useCallback(async (color: string | null) => {
    setUploadingBackground(true);
    try {
      await definirCorDoPainelDeAcesso(color);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, accessPanelColor: color });
      toast.success(color ? "Cor do painel atualizada." : "Painel branco restaurado.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a cor.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient]);

  const saveSidebarColor = useCallback(async (color: string | null) => {
    setUploadingBackground(true);
    try {
      await definirCorDaBarraLateral(color);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, sidebarColor: color });
      toast.success(color ? "Cor da barra lateral atualizada." : "Cor institucional restaurada.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a cor.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient]);

  const saveBrandTexts = useCallback(async () => {
    setUploadingBackground(true);
    try {
      const entrada = {
        expansao: textos.expansao.trim() || null,
        saudacao: textos.saudacao.trim() || null,
        instrucao: textos.instrucao.trim() || null,
      };
      await definirTextosDaMarca(entrada);
      queryClient.setQueryData(platformBrandingQueryKey, {
        ...branding,
        productDescription: entrada.expansao ?? DEFAULT_PLATFORM_BRANDING.productDescription,
        accessGreeting: entrada.saudacao ?? DEFAULT_PLATFORM_BRANDING.accessGreeting,
        accessInstruction: entrada.instrucao ?? DEFAULT_PLATFORM_BRANDING.accessInstruction,
      });
      toast.success("Textos da tela de acesso atualizados.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar os textos.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient, textos]);

  const uploadAccessBackground = useCallback(async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem precisa ter até 2 MB.");
      return;
    }
    setUploadingBackground(true);
    const supabase = createBrowserSupabaseClient();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `branding/acesso-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("platform-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("platform-assets").getPublicUrl(path);
      try {
        await definirFundoDeAcesso(publicUrl.publicUrl, path);
      } catch (saveError) {
        await supabase.storage.from("platform-assets").remove([path]);
        throw saveError;
      }
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, accessBackgroundUrl: publicUrl.publicUrl, accessBackgroundPath: path });
      await loadGallery();
      toast.success("Fundo da tela de acesso atualizado.");
    } catch (uploadError) {
      toast.error(errorMessageFromUnknown(uploadError) || "Não foi possível enviar a imagem.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient, loadGallery]);

  const clearAccessBackground = useCallback(async () => {
    setUploadingBackground(true);
    const caminhoAnterior = branding.accessBackgroundPath;
    try {
      await definirFundoDeAcesso(null, null);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, accessBackgroundUrl: null, accessBackgroundPath: null });
      toast.success("Arte institucional padrão restaurada.");
    } catch (clearError) {
      toast.error(errorMessageFromUnknown(clearError) || "Não foi possível restaurar a arte padrão.");
      setUploadingBackground(false);
      return;
    }
    try {
      if (caminhoAnterior) {
        const { error: removeError } = await createBrowserSupabaseClient().storage.from("platform-assets").remove([caminhoAnterior]);
        if (removeError) throw removeError;
        await loadGallery();
      }
    } catch (cleanupError) {
      console.warn("Falha ao remover a arte anterior do storage.", cleanupError);
      toast.warning("Arte padrão restaurada, mas a imagem anterior continua na galeria. Remova-a por lá quando quiser.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient, loadGallery]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => normalizePlatformBranding(await atualizarMarcaDaPlataforma(values)),
    onSuccess: (updated) => {
      queryClient.setQueryData(platformBrandingQueryKey, updated);
      const salvos: FormValues = {
        organizationName: updated.organizationName,
        productName: updated.productName,
        primaryColor: updated.primaryColor,
      };
      ultimoSincronizado.current = salvos;
      form.reset(salvos);
      toast.success("Identidade da plataforma atualizada.");
    },
    onError: (saveError) => toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a identidade."),
  });

  const brandDirty = form.formState.isDirty;
  const submitBranding = useCallback(() => {
    void form.handleSubmit((values) => mutation.mutate(values))();
  }, [form, mutation]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && brandDirty && !mutation.isPending) {
        event.preventDefault();
        submitBranding();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [brandDirty, mutation.isPending, submitBranding]);

  const isCurrentPerson = (person: Person) => Boolean(currentPersonId) && person.personId === currentPersonId;

  async function setProfile(person: Person, role: Role) {
    if (person.roles.length === 1 && person.roles[0]?.code === role.code) return;
    if (isCurrentPerson(person) && role.code !== PLATFORM_ROLE.SUPER_ADMIN) {
      toast.error("Você não pode retirar seu próprio perfil de Superadmin.");
      return;
    }
    setChanging(`${person.personId}:${role.code}`);
    try {
      await definirPerfilDaPessoa(person.personId, role.code);
      toast.success(`${person.fullName} agora tem o perfil ${role.name}.`);
      invalidatePlatformContext();
      await loadPeople(peopleSearch, workspace?.offset ?? 0);
    } catch (changeError) {
      toast.error(errorMessageFromUnknown(changeError) || "Não foi possível alterar o perfil.");
      await loadPeople(peopleSearch, workspace?.offset ?? 0);
    } finally {
      setChanging("");
    }
  }

  const roles = useMemo(() => [...(workspace?.roles ?? [])].sort((a, b) => {
    const ai = roleOrder.indexOf(a.code);
    const bi = roleOrder.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }), [workspace]);

  const term = normalize(wsQuery);
  const cardVisible = (section: SectionId, keywords: string) => (tab === "all" || tab === section) && (!term || normalize(keywords).includes(term));
  const brandVisible = cardVisible("brand", "marca nomes institucionais organização nome do sistema identidade");
  const loginVisible = cardVisible("login", "tela de acesso login entrada saudação instrução expansão sigla cor do painel arte fundo campanha");
  const appearanceVisible = cardVisible("appearance", "aparência logotipo logo cor principal cores tema prévia menu barra lateral");
  const featuresVisible = cardVisible("features", "recursos presença online pessoas conectadas realtime desempenho perfis");
  const accessVisible = cardVisible("access", "acessos permissões perfis pessoas segurança participante avaliador gestor admin superadmin");
  const visibleCount = [brandVisible, loginVisible, appearanceVisible, featuresVisible, accessVisible].filter(Boolean).length;
  const presenceDirty = presenceEnabled !== branding.onlinePresenceEnabled
    || [...presenceRoles].sort().join("|") !== [...branding.onlinePresenceViewerRoles].sort().join("|");

  if (guard.state !== "granted") {
    return <PlatformGuardState guard={guard} title="configurações" unidentifiedTitle="Não foi possível abrir as configurações" restrictedTitle="Configurações restritas" restrictedDescription="Somente o Superadmin pode alterar a identidade da plataforma e os perfis de acesso." />;
  }

  const displayedLogo = DEFAULT_PLATFORM_BRANDING.logoUrl;

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="Configurações do sistema">
      <div className="min-w-0 pb-28">
        <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm sm:px-6" aria-label="Navegação das configurações">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div><span className="section-eyebrow">Administração do sistema</span><h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">Configurações</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Localize ajustes, revise acessos e salve alterações com validação antes de publicar.</p></div>
            <label className="relative block w-full min-w-0 lg:w-80"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" /><input type="search" value={wsQuery} onChange={(event) => setWsQuery(event.target.value)} placeholder="Pesquisar configuração..." aria-label="Pesquisar configuração" className="min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-10 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-solid)] focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand-solid)_18%,transparent)]" />{wsQuery ? <button type="button" onClick={() => setWsQuery("")} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" aria-hidden="true" /></button> : null}</label>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias de configuração">{TABS.map((item) => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(item.id)} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-black transition ${active ? "border-[color-mix(in_srgb,var(--brand-solid)_45%,transparent)] bg-[var(--status-info-bg)] text-[var(--brand-primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--brand-primary)]"}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" /><span>{item.label}</span></button>; })}</div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-[11px] font-bold text-[var(--text-muted)]"><span>{visibleCount} {visibleCount === 1 ? "seção disponível" : "seções disponíveis"}</span>{brandDirty ? <span className="inline-flex items-center gap-1.5 text-[var(--status-warning-text)]"><CircleDot className="h-3 w-3" aria-hidden="true" />Alterações não salvas</span> : null}</div>
        </section>

        <div className="mt-5 space-y-5">
          {brandVisible ? <section data-config-section="brand" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.brand }}><div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><Type className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-base font-black text-[var(--text-primary)]">Nomes institucionais</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">Textos curtos funcionam melhor no menu lateral e em telas menores.</p></div></div><div className="mt-5 grid gap-5 md:grid-cols-2"><Input label="Organização" placeholder="AgSUS" form="config-brand-form" error={form.formState.errors.organizationName?.message} {...form.register("organizationName")} /><Input label="Nome do sistema" placeholder="SIGAV" form="config-brand-form" error={form.formState.errors.productName?.message} {...form.register("productName")} /></div></section> : null}

          {loginVisible ? <section data-config-section="login" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.login }}><div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><LogIn className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-base font-black text-[var(--text-primary)]">Tela de acesso</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">O que quem ainda não entrou vê. A prévia acompanha o que você digita, antes de salvar.</p></div></div><div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem]"><div><p className="text-sm font-semibold text-[var(--text-primary)]">Textos</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Deixar um campo vazio restaura o texto padrão — a tela nunca fica sem título.</p><div className="mt-4 grid gap-4"><Input label="Expansão da sigla" hint="Exibida abaixo da assinatura. Até 120 caracteres." maxLength={120} value={textos.expansao} onChange={(event) => setTextos((atual) => ({ ...atual, expansao: event.target.value }))} /><Input label="Saudação" hint="Título de maior destaque do cartão. Até 80 caracteres." maxLength={80} value={textos.saudacao} onChange={(event) => setTextos((atual) => ({ ...atual, saudacao: event.target.value }))} /><Input label="Instrução" hint="Linha abaixo da saudação. Até 120 caracteres." maxLength={120} value={textos.instrucao} onChange={(event) => setTextos((atual) => ({ ...atual, instrucao: event.target.value }))} /></div><div className="mt-4 flex justify-end"><Button type="button" disabled={uploadingBackground} onClick={() => void saveBrandTexts()}>{uploadingBackground ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Salvar textos</Button></div></div><div className="lg:sticky lg:top-4 lg:self-start"><p className="section-eyebrow">Prévia</p><AccessScreenPreview className="mt-3" organizationName={watchedOrganization} productDescription={textos.expansao || DEFAULT_PLATFORM_BRANDING.productDescription} greeting={textos.saudacao || DEFAULT_PLATFORM_BRANDING.accessGreeting} instruction={textos.instrucao || DEFAULT_PLATFORM_BRANDING.accessInstruction} panelColor={branding.accessPanelColor} backgroundUrl={branding.accessBackgroundUrl ?? "/acesso-fundo.png"} /><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Reprodução em escala menor. A arte e a cor do painel são configuradas em Aparência.</p></div></div></section> : null}

          {appearanceVisible ? <section data-config-section="appearance" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.appearance }}><div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><SwatchBook className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-base font-black text-[var(--text-primary)]">Logotipo, cor e prévia</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">Aparência global da plataforma. Banners específicos continuam por avaliação.</p></div></div><div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><div><p className="section-eyebrow">Logotipo</p><div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm"><PlatformLogo src={displayedLogo} alt="Logotipo institucional" organizationName={watchedOrganization} width={96} height={96} loading={brandingLoading} className="h-full w-full object-contain text-xl" /></div><div className="flex-1"><p className="inline-flex items-center gap-2 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-xs font-black text-[var(--status-success-text)]"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />Marca institucional fixa</p><p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">O logotipo oficial da AgSUS é aplicado automaticamente em toda a plataforma e não pode ser substituído por aqui — assim a identidade nunca diverge entre as telas.</p></div></div></div><div className="border-t border-[var(--border-subtle)] pt-6"><p className="section-eyebrow">Fundo da tela de acesso</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Imagem de fundo da tela de acesso, exibida em tela cheia com o formulário sobreposto. Use para acompanhar campanhas institucionais. Prefira arte 16:9 e evite texto importante no terço esquerdo, onde fica o formulário. JPG, PNG ou WEBP, até 2 MB.</p><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start"><div className="h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-cover bg-center" style={{ backgroundImage: `url(${branding.accessBackgroundUrl ?? "/acesso-fundo.png"})` }} role="img" aria-label={branding.accessBackgroundUrl ? "Prévia do fundo configurado" : "Prévia da arte institucional padrão"} /><div className="flex-1"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"><ImagePlus className="h-4 w-4" aria-hidden="true" />{uploadingBackground ? "Enviando..." : "Escolher imagem"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingBackground} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadAccessBackground(file); }} /></label>{branding.accessBackgroundUrl ? <button type="button" onClick={() => void clearAccessBackground()} disabled={uploadingBackground} className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--status-danger-text)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60">Restaurar padrão</button> : null}<p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{branding.accessBackgroundUrl ? "A imagem vale imediatamente para quem abrir a tela de acesso." : "Sem imagem configurada, vale a arte institucional padrão."}</p></div></div>{gallery.length > 0 ? <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">Artes enviadas</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Reaproveite campanhas anteriores sem reenviar o arquivo. A arte em uso não pode ser apagada.</p><ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{gallery.map((item) => { const emUso = branding.accessBackgroundPath === item.path; return <li key={item.path} className={`overflow-hidden rounded-xl border ${emUso ? "border-[var(--brand-solid)] ring-1 ring-[var(--brand-solid)]" : "border-[var(--border-subtle)]"}`}><div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${item.url})` }} role="img" aria-label={emUso ? "Arte em uso na tela de acesso" : "Arte disponível"} /><div className="flex items-center justify-between gap-2 p-2"><span className="text-[11px] text-[var(--text-muted)]">{emUso ? "Em uso" : `${item.sizeKb} KB`}</span><span className="flex gap-1">{!emUso ? <button type="button" onClick={() => void applyGalleryImage(item)} disabled={uploadingBackground} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60">Usar</button> : null}<button type="button" onClick={() => void deleteGalleryImage(item)} disabled={uploadingBackground || emUso} title={emUso ? "Arte em uso: escolha outra antes de apagar" : "Apagar do armazenamento"} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--status-danger-text)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">Apagar</button></span></div></li>; })}</ul></div> : null}<div className="mt-6 border-t border-[var(--border-subtle)] pt-5"><p className="text-sm font-semibold text-[var(--text-primary)]">Cor do painel do formulário</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">O texto e o botão alternam entre claro e escuro conforme a cor escolhida. Confira o contraste abaixo antes de salvar.</p><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><input type="color" aria-label="Cor do painel da tela de acesso" value={branding.accessPanelColor ?? "#ffffff"} onChange={(event) => void saveAccessPanelColor(event.target.value)} disabled={uploadingBackground} className="h-12 w-16 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" /><div className="flex-1 rounded-xl border border-[var(--border-subtle)] p-4" style={{ backgroundColor: branding.accessPanelColor ?? "#ffffff" }}><div className="w-fit" style={accessPanelIsDark ? { filter: "brightness(0) invert(1)" } : undefined}><PlatformLogo src={DEFAULT_PLATFORM_BRANDING.logoUrl} alt="" organizationName={watchedOrganization} width={28} height={28} className="h-7 w-7 object-contain text-[10px]" /></div><p className={`mt-2 text-sm font-semibold ${accessPanelIsDark ? "text-white" : "text-[#003b70]"}`}>Seja bem-vindo(a) à AgSUS</p><span className={`mt-2 inline-flex min-h-9 items-center rounded-lg px-4 text-xs font-semibold ${accessPanelIsDark ? "bg-white text-[#003b70]" : "bg-[#003b70] text-white"}`}>Entrar com Google institucional</span></div>{branding.accessPanelColor ? <button type="button" onClick={() => void saveAccessPanelColor(null)} disabled={uploadingBackground} className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60">Voltar ao branco</button> : null}</div>{contrastePainel !== null ? <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs leading-5 ${contrastePainelAprovado ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"}`}>{contrastePainelAprovado ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}<span>Contraste do texto sobre esta cor: <strong className="font-bold">{contrastePainel.toFixed(2)}</strong>. {contrastePainelAprovado ? `Atinge o mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA.` : `Abaixo do mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA — quem tem baixa visão pode não conseguir ler. Uma cor mais escura resolve sem mudar o tom.`}</span></p> : null}</div><div className="mt-6 border-t border-[var(--border-subtle)] pt-5"><p className="text-sm font-semibold text-[var(--text-primary)]">Cor da barra lateral</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Fundo do menu à esquerda em toda a aplicação. Sem cor definida, vale a institucional.</p><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><input type="color" aria-label="Cor da barra lateral" value={branding.sidebarColor ?? "#0f2942"} onChange={(event) => void saveSidebarColor(event.target.value)} disabled={uploadingBackground} className="h-12 w-16 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" /><div className="flex-1 rounded-xl border border-[var(--border-subtle)] p-4" style={{ backgroundColor: branding.sidebarColor ?? "#0f2942" }}><p className={`text-[10px] font-black uppercase tracking-[.12em] ${sidebarIsDark ? "text-white/60" : "text-slate-600"}`}>Principal</p><p className={`mt-2 text-sm font-bold ${sidebarIsDark ? "text-white" : "text-[#003b70]"}`}>Visão geral</p></div>{branding.sidebarColor ? <button type="button" onClick={() => void saveSidebarColor(null)} disabled={uploadingBackground} className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60">Restaurar institucional</button> : null}</div>{contrasteBarra !== null ? <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs leading-5 ${contrasteBarraAprovado ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"}`}>{contrasteBarraAprovado ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}<span>Contraste do texto sobre esta cor: <strong className="font-bold">{contrasteBarra.toFixed(2)}</strong>. {contrasteBarraAprovado ? `Atinge o mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA.` : `Abaixo do mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA — os nomes do menu podem ficar ilegíveis.`}</span></p> : null}</div></div><div className="border-t border-[var(--border-subtle)] pt-6"><p className="section-eyebrow">Cor principal</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Aplicada em botões e navegação ativa. O modo escuro mantém contraste próprio para textos e superfícies.</p><div className="mt-4 flex max-w-md items-center gap-3"><input id="primaryColor" aria-label="Cor principal da plataforma" type="color" value={watchedColor} onChange={(event) => form.setValue("primaryColor", event.target.value, { shouldDirty: true, shouldValidate: true })} className="h-12 w-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" /><Input label="Valor hexadecimal" containerClassName="flex-1" form="config-brand-form" error={form.formState.errors.primaryColor?.message} {...form.register("primaryColor")} /></div></div></div><div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]"><div className="h-1.5" style={{ background: watchedColor }} /><div className="p-5"><p className="section-eyebrow">Prévia do menu</p><div className="mt-4 rounded-2xl bg-[var(--sidebar-background)] p-4 text-white"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-2"><PlatformLogo src={displayedLogo} alt="" organizationName={watchedOrganization} width={40} height={40} loading={brandingLoading} className="h-10 w-10 object-contain text-xs" /></span><span><small className="block uppercase tracking-[.18em] text-[var(--sidebar-muted)]">{watchedOrganization}</small><strong className="mt-1 block">{watchedName}</strong></span></div><div className="mt-5 rounded-xl px-3 py-3 text-sm font-bold text-white" style={{ background: watchedColor }}>Visão geral</div></div><p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">A prévia representa a identidade global.</p></div></div></div></section> : null}

          {featuresVisible ? <section data-config-section="features" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.features }}><div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><RadioTower className="h-5 w-5" aria-hidden="true" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-[var(--text-primary)]">Pessoas online</h3><Badge variant={presenceEnabled ? "success" : "neutral"}>{presenceEnabled ? "Ativo" : "Desativado"}</Badge></div><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Conta todas as pessoas com a plataforma aberta. A quantidade e a lista ficam visíveis apenas para os perfis autorizados abaixo.</p></div></div><button type="button" role="switch" aria-checked={presenceEnabled} onClick={() => setPresenceEnabled((current) => !current)} className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${presenceEnabled ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${presenceEnabled ? "translate-x-6" : "translate-x-1"}`} /><span className="sr-only">{presenceEnabled ? "Desativar pessoas online" : "Ativar pessoas online"}</span></button></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]"><fieldset><legend className="text-sm font-bold text-[var(--text-primary)]">Quem pode visualizar</legend><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Todos os perfis ativos são contabilizados. Somente os perfis selecionados podem ver a quantidade, os nomes e as fotos.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{roleOrder.map((role) => { const selected = presenceRoles.includes(role); return <label key={role} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selected ? "border-emerald-300 bg-emerald-50/70" : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"}`}><input type="checkbox" checked={selected} onChange={() => togglePresenceRole(role)} className="h-4 w-4 accent-emerald-600" /><span><strong className="block text-sm text-[var(--text-primary)]">{PLATFORM_ROLE_LABELS[role as keyof typeof PLATFORM_ROLE_LABELS]}</strong><span className="block text-xs text-[var(--text-secondary)]">{selected ? "Pode visualizar" : "Apenas é contabilizado"}</span></span></label>; })}</div></fieldset><aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4"><p className="section-eyebrow">Impacto controlado</p><strong className="mt-2 block text-sm text-[var(--text-primary)]">Sem consulta contínua ao banco</strong><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Cada pessoa mantém uma conexão enquanto usa o sistema. Não há gravação por minuto nem atualização por movimento do usuário.</p><Button type="button" onClick={() => void savePresence()} disabled={!presenceDirty || savingPresence || presenceRoles.length === 0} className="mt-4 w-full">{savingPresence ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{savingPresence ? "Salvando..." : "Salvar recurso"}</Button></aside></div></section> : null}

          {accessVisible ? <section data-config-section="access" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.access }}><div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"><UserCog className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-base font-black text-[var(--text-primary)]">Pessoas e permissões</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{roles.length ? `Cada pessoa tem exatamente um dos ${roles.length} perfis. Selecionar um substitui o anterior — a mudança é imediata e auditada.` : "Pesquise uma pessoa e defina seu perfil. A mudança é imediata e auditada."}</p></div></div><form onSubmit={(event) => { event.preventDefault(); void loadPeople(peopleQuery, 0); }} className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end lg:w-auto lg:min-w-[26rem]"><Input label="Pesquisar pessoa" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Nome, matrícula ou e-mail" containerClassName="min-w-0 flex-1" /><Button type="submit" disabled={fetching} className="sm:mb-0">{fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}Buscar</Button></form></div><DataTableContainer className="mt-5 min-w-0 border-0 shadow-none" aria-label="Pessoas e perfis da plataforma">{fetching && !workspace ? <DataTableState aria-live="polite"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brand-primary)]" aria-hidden="true" /><p className="mt-3 font-semibold">Carregando pessoas e permissões...</p></DataTableState> : peopleError && !workspace ? <DataTableState role="alert"><TriangleAlert className="mx-auto h-6 w-6 text-[var(--status-danger-text)]" aria-hidden="true" /><p className="mt-3 font-semibold">{peopleError}</p><Button className="mt-4" variant="secondary" onClick={() => void loadPeople(peopleSearch, 0)}>Tentar novamente</Button></DataTableState> : <DataTableScroll className="max-h-[60dvh] min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]"><DataTable className="min-w-max"><DataTableHead className="sticky top-0 z-20"><DataTableRow className="hover:bg-transparent"><DataTableHeaderCell className="sticky left-0 z-30 min-w-[19rem] bg-[var(--surface-muted)] shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] sm:min-w-[22rem]">Pessoa</DataTableHeaderCell>{roles.map((role) => <DataTableHeaderCell key={role.code} className="w-32 min-w-32 text-center"><span title={role.description ?? role.name}>{role.name}</span></DataTableHeaderCell>)}</DataTableRow></DataTableHead><DataTableBody>{(workspace?.people ?? []).map((person) => <DataTableRow key={person.personId} className="group"><DataTableCell className="sticky left-0 z-10 bg-[var(--surface-card)] shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] transition-colors group-hover:bg-[var(--surface-interactive)]"><div className="flex min-w-72 items-center gap-3"><PersonAvatar fullName={person.fullName} className="h-10 w-10 rounded-xl" fallbackClassName="text-xs" /><div className="min-w-0 max-w-[17rem] sm:max-w-[20rem]"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong><Badge variant={person.active ? "success" : "neutral"}>{person.active ? "Ativo" : "Inativo"}</Badge></div><span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{person.institutionalEmail ?? person.employeeNumber ?? "Sem identificação"}</span><span className="block truncate text-[11px] text-[var(--text-muted)]">{person.jobTitle ?? "Cargo não informado"}{person.unit ? ` · ${person.unit}` : ""}</span></div></div></DataTableCell>{roles.map((role) => { const active = effectiveRoleCode(person) === role.code; const busy = changing.startsWith(`${person.personId}:`); const isSelfDowngrade = isCurrentPerson(person) && role.code !== PLATFORM_ROLE.SUPER_ADMIN; const blocked = busy || isSelfDowngrade; return <DataTableCell key={role.code} className="w-32 min-w-32 text-center"><button type="button" aria-pressed={active} aria-label={`Definir o perfil ${role.name} para ${person.fullName}`} title={isSelfDowngrade ? "Você não pode retirar seu próprio perfil de Superadmin." : undefined} onClick={() => void setProfile(person, role)} disabled={blocked} className={`grid h-7 w-7 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-40 ${busy ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"} ${active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white enabled:hover:border-emerald-400"}`}>{busy && changing === `${person.personId}:${role.code}` ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" aria-hidden="true" /> : active ? <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" /> : null}</button></DataTableCell>; })}</DataTableRow>))}{!fetching && !(workspace?.people?.length) ? <DataTableEmpty colSpan={Math.max(roles.length + 1, 1)}>Nenhuma pessoa encontrada para os critérios informados.</DataTableEmpty> : null}</DataTableBody></DataTable></DataTableScroll>}</DataTableContainer>{workspace ? <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">{peopleError ? <p role="alert" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--status-danger-text)]"><TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{peopleError} A página anterior foi mantida.</p> : null}<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className="text-sm font-semibold text-[var(--text-secondary)]">{accessPageRange(workspace.offset, workspace.people.length, workspace.total)}{peopleSearch ? ` para “${peopleSearch}”` : ""}</p><div className="flex items-center gap-2"><Button type="button" variant="secondary" disabled={fetching || workspace.offset === 0} onClick={() => void loadPeople(peopleSearch, previousAccessOffset(workspace.offset, workspace.limit))}>Anterior</Button><Button type="button" variant="secondary" disabled={fetching || !workspace.hasMore} onClick={() => void loadPeople(peopleSearch, nextAccessOffset(workspace.offset, workspace.limit))}>{fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Próxima</Button></div></div></div> : null}</section> : null}

          {visibleCount === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-12 text-center"><Search className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" /><strong className="mt-4 block text-[var(--text-primary)]">Nenhuma configuração encontrada</strong><p className="mt-1 text-sm text-[var(--text-secondary)]">Ajuste a busca ou escolha outra aba.</p></div> : null}
        </div>
      </div>
      <form id="config-brand-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="hidden" aria-hidden="true" />
      <div className="pointer-events-none sticky bottom-0 z-30 -mx-4 mt-4 sm:-mx-6 lg:-mx-8"><div className="pointer-events-auto border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] px-4 py-3 backdrop-blur sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${brandDirty ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" : "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"}`}>{brandDirty ? <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}</span><div className="leading-tight"><strong className="block text-sm text-[var(--text-primary)]">{brandDirty ? "Alterações de identidade pendentes" : "Nenhuma alteração pendente"}</strong><span className="text-xs text-[var(--text-secondary)]">{brandDirty ? "Salve para aplicar marca e aparência a toda a plataforma." : "Perfis de acesso são aplicados imediatamente ao clicar."}</span></div></div><div className="flex items-center gap-3"><span className="hidden text-[11px] font-bold text-[var(--text-muted)] sm:inline">Ctrl + S</span><Button type="submit" form="config-brand-form" size="lg" disabled={!brandDirty || mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}{mutation.isPending ? "Salvando..." : "Salvar alterações"}</Button></div></div></div></div>
    </PlatformShell>
  );
}
