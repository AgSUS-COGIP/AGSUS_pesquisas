"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  ImagePlus,
  LogIn,
  Mail,
  Megaphone,
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
  Upload,
  UserCog,
  UsersRound,
  Workflow,
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
import { Checkbox, Input, Textarea } from "@/components/ui/form-controls";
import {
  contrastRatio,
  DARK_FOREGROUND,
  LIGHT_FOREGROUND,
  needsLightForeground,
  WCAG_AA_NORMAL_TEXT,
} from "@/lib/color-contrast";
import { errorMessageFromUnknown } from "@/lib/observability";
import { invalidatePlatformContext, usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { PLATFORM_ACCESS_PRESETS, matchingAccessPreset } from "@/lib/platform-access-presets";
import { DEFAULT_PLATFORM_BRANDING, normalizePlatformBranding } from "@/lib/platform-branding";
import {
  ACCESS_PAGE_SIZE,
  accessPageRange,
  nextAccessOffset,
  previousAccessOffset,
} from "@/lib/access-pagination";
import { enviarArquivo, listarArquivos, removerArquivo } from "@/lib/api/cliente-arquivos";
import {
  atualizarMarcaDaPlataforma,
  definirComunicadoDaPaginaInicial,
  definirCorDaBarraLateral,
  definirCorDoPainelDeAcesso,
  definirTextosDaMarca,
  definirFundoDeAcesso,
  definirPresencaOnline,
  definirPermissoesDaPessoa,
  obterAreaDeAcessos,
} from "@/lib/api/cliente-pessoas";

const schema = z.object({
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(60),
  productName: z.string().trim().min(1, "Informe o nome do sistema.").max(60),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use uma cor no formato #RRGGBB."),
});

type FormValues = z.infer<typeof schema>;

// Permissões e pessoas (consolidados de /admin/acessos) -------------------------
type Permission = {
  code: string;
  name: string;
  description: string | null;
  category: string;
  position: number;
  required: boolean;
};
type Person = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  active: boolean;
  permissions: string[];
};
type Workspace = {
  status: "OK";
  technicalRole: "authenticated";
  permissions: Permission[];
  people: Person[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

// Abas do workspace. Cada card declara sua seção e só aparece na aba
// correspondente (ou em "Tudo") e quando casa com a busca.
type SectionId = "brand" | "home" | "login" | "appearance" | "features" | "operation" | "access";
const TABS: { id: "all" | SectionId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "Tudo", icon: LayoutGrid },
  { id: "brand", label: "Marca", icon: Type },
  { id: "home", label: "Página inicial", icon: Megaphone },
  // A tela de acesso tem aba própria porque configurá-la exigia visitar duas:
  // os textos ficavam em Marca e a cor do painel com a arte de fundo em
  // Aparência. São ajustes da mesma tela, e quem vai mexer nela quer ver o
  // conjunto — com a prévia ao lado, não em duas viagens.
  { id: "login", label: "Tela de acesso", icon: LogIn },
  { id: "appearance", label: "Aparência", icon: SwatchBook },
  { id: "features", label: "Recursos", icon: RadioTower },
  { id: "operation", label: "Operação", icon: Workflow },
  { id: "access", label: "Acessos", icon: UserCog },
];
// Acento superior de cada seção — sempre por token, nunca hexadecimal literal.
const SECTION_ACCENT: Record<SectionId, string> = {
  brand: "var(--brand-solid)",
  home: "var(--status-info-text)",
  login: "var(--brand-primary)",
  appearance: "var(--brand-secondary)",
  features: "var(--status-success-text)",
  operation: "var(--status-info-text)",
  access: "var(--status-warning-text)",
};

const OPERATION_LINKS = [
  {
    href: "/admin/pesquisas",
    title: "Avaliações e ciclos",
    description: "Criar instrumentos, configurar períodos e acompanhar a operação.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/participantes",
    title: "Participantes",
    description: "Definir público, elegibilidade e situação das pessoas no ciclo.",
    icon: UsersRound,
  },
  {
    href: "/admin/equipes",
    title: "Lideranças e equipes",
    description: "Revisar vínculos de chefia antes que afetem as avaliações.",
    icon: Workflow,
  },
  {
    href: "/admin/emails",
    title: "Comunicação",
    description: "Enviar lembretes e consultar fila, entregas e falhas.",
    icon: Mail,
  },
  {
    href: "/admin/importacoes",
    title: "Importações",
    description: "Atualizar a base institucional e conferir o processamento.",
    icon: Upload,
  },
  {
    href: "/admin/respostas",
    title: "Respostas",
    description: "Consultar intervenções administrativas e corrigir casos excepcionais.",
    icon: FileClock,
  },
] as const;

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

  // Estado da seção Acessos
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleError, setPeopleError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState("");
  const [presenceEnabled, setPresenceEnabled] = useState(branding.onlinePresenceEnabled);
  const [savingPresence, setSavingPresence] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcement, setAnnouncement] = useState({
    enabled: branding.homeAnnouncementEnabled,
    title: branding.homeAnnouncementTitle,
    message: branding.homeAnnouncementMessage,
    link: branding.homeAnnouncementLink ?? "",
    linkLabel: branding.homeAnnouncementLinkLabel,
  });

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

  /*
    Sincroniza o formulário com a marca vinda do servidor — sem apagar o que
    está sendo digitado.

    O efeito anterior dependia de `[branding, form]`, e `branding` é objeto
    novo a cada resposta do React Query. Como várias ações desta tela gravam a
    marca e atualizam o cache (cor da barra lateral, arte de acesso, textos do
    e-mail), qualquer uma delas disparava `form.reset` e **apagava o nome ou a
    cor que a pessoa havia acabado de escrever** — sem aviso, sem desfazer.

    Duas mudanças fecham isso:

      · as dependências são os **valores**, não o objeto;
      · o reset é pulado enquanto o formulário estiver sujo.

    Editar não é perder: quem tem alteração pendente mantém o que escreveu, e o
    indicador de "alterações não salvas" continua avisando. A sincronização volta
    a acontecer assim que o formulário ficar limpo.
  */
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
  }, [branding.onlinePresenceEnabled]);

  useEffect(() => {
    setAnnouncement({
      enabled: branding.homeAnnouncementEnabled,
      title: branding.homeAnnouncementTitle,
      message: branding.homeAnnouncementMessage,
      link: branding.homeAnnouncementLink ?? "",
      linkLabel: branding.homeAnnouncementLinkLabel,
    });
  }, [
    branding.homeAnnouncementEnabled,
    branding.homeAnnouncementTitle,
    branding.homeAnnouncementMessage,
    branding.homeAnnouncementLink,
    branding.homeAnnouncementLinkLabel,
  ]);

  const loadPeople = useCallback(async (term = "", offset = 0) => {
    setFetching(true);
    setPeopleError("");
    try {
      const page = await obterAreaDeAcessos({
        busca: term,
        limite: ACCESS_PAGE_SIZE,
        offset,
      });
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


  /*
   * Envio da arte de fundo da tela de acesso.
   *
   * Mesmo bucket do logotipo (`platform-assets`), em caminho próprio. A
   * gravação no banco vem **depois** do upload, e uma falha ali remove o
   * arquivo enviado — senão o storage acumularia imagens que nenhuma
   * configuração aponta.
   */
  const [uploadingBackground, setUploadingBackground] = useState(false);

  /*
   * Os textos da tela de acesso ficam em estado local até serem salvos, e não
   * são gravados a cada tecla como as cores.
   *
   * Cor é escolha instantânea num seletor; texto é redigido, revisado e às
   * vezes abandonado no meio. Salvar a cada tecla publicaria frase incompleta
   * na única porta de entrada da plataforma, e cada tecla seria uma escrita no
   * banco.
   *
   * O estado nasce do que a marca já traz, então o campo mostra o texto vigente
   * — inclusive quando ele é o padrão do código, para quem edita ver o que está
   * substituindo em vez de um campo vazio.
   */
  const [textos, setTextos] = useState({
    expansao: branding.productDescription,
    saudacao: branding.accessGreeting,
    instrucao: branding.accessInstruction,
  });
  const accessPanelIsDark = needsLightForeground(branding.accessPanelColor);

  /*
   * Contraste do texto que a tela de acesso realmente vai usar sobre esta cor.
   *
   * Mede o par escolhido pela regra, e não o melhor par possível: é o número
   * que a pessoa vai ver na tela, não o que ela veria se a regra fosse outra.
   * Painel branco não precisa de aviso — é o padrão institucional.
   */
  const contrastePainel = branding.accessPanelColor
    ? contrastRatio(
        accessPanelIsDark ? LIGHT_FOREGROUND : DARK_FOREGROUND,
        branding.accessPanelColor,
      )
    : null;
  const contrastePainelAprovado = (contrastePainel ?? 0) >= WCAG_AA_NORMAL_TEXT;

  /*
   * Contraste da barra lateral, medido contra o par que ela realmente usa.
   *
   * Diferente do painel de acesso, aqui não há alternância automática: a barra
   * é escura por construção e o texto dela é claro. Por isso a prévia decide o
   * texto pela mesma regra, e o aviso mede o par exibido.
   */
  const corDaBarra = branding.sidebarColor;
  const sidebarIsDark = needsLightForeground(corDaBarra ?? "#0f2942");
  const contrasteBarra = corDaBarra
    ? contrastRatio(sidebarIsDark ? LIGHT_FOREGROUND : DARK_FOREGROUND, corDaBarra)
    : null;
  const contrasteBarraAprovado = (contrasteBarra ?? 0) >= WCAG_AA_NORMAL_TEXT;

  /*
   * Galeria das artes já enviadas.
   *
   * Sem ela, cada envio deixava o arquivo anterior no storage sem nada
   * apontando para ele — e trocar de volta para a arte do ano passado exigia
   * enviar tudo de novo. Com a lista, as campanhas ficam guardadas e a troca é
   * um clique.
   *
   * Lista tudo que está em `branding/`, e não só as artes de acesso: é onde
   * também ficaram os logotipos enviados antes de a marca virar fixa, que hoje
   * são órfãos e ninguém tinha como remover pela interface.
   */
  const [gallery, setGallery] = useState<{ path: string; url: string; sizeKb: number }[]>([]);

  const loadGallery = useCallback(async () => {
    try {
      const arquivos = await listarArquivos("platform-assets", "branding/");
      setGallery(
        arquivos.map((item) => ({
          path: item.caminho,
          url: item.url,
          sizeKb: Math.round(item.tamanho / 1024),
        })),
      );
    } catch (listError) {
      // A galeria é acessório: falhar aqui não pode impedir configurar o resto.
      console.warn("Galeria de artes indisponível:", errorMessageFromUnknown(listError));
    }
  }, []);

  useEffect(() => {
    if (granted) void loadGallery();
  }, [granted, loadGallery]);

  /** Ativa uma arte já enviada, sem precisar reenviá-la. */
  const applyGalleryImage = useCallback(async (item: { path: string; url: string }) => {
    setUploadingBackground(true);
    try {
      await definirFundoDeAcesso(item.url, item.path);
      queryClient.setQueryData(platformBrandingQueryKey, {
        ...branding, accessBackgroundUrl: item.url, accessBackgroundPath: item.path,
      });
      toast.success("Arte aplicada à tela de acesso.");
    } catch (useError) {
      toast.error(errorMessageFromUnknown(useError) || "Não foi possível aplicar a arte.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient]);

  const savePresence = useCallback(async () => {
    setSavingPresence(true);
    try {
      await definirPresencaOnline(presenceEnabled);
      queryClient.setQueryData(platformBrandingQueryKey, {
        ...branding,
        onlinePresenceEnabled: presenceEnabled,
      });
      toast.success(presenceEnabled ? "Presença online atualizada." : "Presença online desativada.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a presença online.");
    } finally {
      setSavingPresence(false);
    }
  }, [branding, presenceEnabled, queryClient]);

  const saveAnnouncement = useCallback(async () => {
    const title = announcement.title.trim();
    const message = announcement.message.trim();
    const link = announcement.link.trim();
    const linkLabel = announcement.linkLabel.trim();

    if (announcement.enabled && (!title || !message)) {
      toast.error("Informe título e mensagem antes de ativar o comunicado.");
      return;
    }
    if (link && !/^(?:https:\/\/\S+|\/(?!\/)\S+)$/i.test(link)) {
      toast.error("O link deve ser uma rota interna ou um endereço HTTPS.");
      return;
    }

    setSavingAnnouncement(true);
    try {
      const updated = normalizePlatformBranding(await definirComunicadoDaPaginaInicial({
        ativo: announcement.enabled,
        titulo: title || null,
        mensagem: message || null,
        link: link || null,
        rotuloLink: link ? linkLabel || "Saiba mais" : null,
      }));
      queryClient.setQueryData(platformBrandingQueryKey, updated);
      setAnnouncement({
        enabled: updated.homeAnnouncementEnabled,
        title: updated.homeAnnouncementTitle,
        message: updated.homeAnnouncementMessage,
        link: updated.homeAnnouncementLink ?? "",
        linkLabel: updated.homeAnnouncementLinkLabel,
      });
      toast.success(updated.homeAnnouncementEnabled ? "Comunicado publicado na página inicial." : "Comunicado desativado.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar o comunicado.");
    } finally {
      setSavingAnnouncement(false);
    }
  }, [announcement, queryClient]);

  /**
   * Remove uma arte do storage.
   *
   * Recusa a que está em uso: apagá-la deixaria a tela de acesso apontando para
   * um arquivo que não existe mais — e é a única tela por onde se entra.
   */
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
      await removerArquivo("platform-assets", item.path);
      await loadGallery();
      toast.success("Arte removida do armazenamento.");
    } catch (deleteError) {
      toast.error(errorMessageFromUnknown(deleteError) || "Não foi possível apagar a arte.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding.accessBackgroundPath, confirm, loadGallery]);

  /** Grava a cor do painel; `null` restaura o branco institucional. */
  const saveAccessPanelColor = useCallback(async (color: string | null) => {
    setUploadingBackground(true);
    try {
      // Grava só a cor. A funcao anterior gravava os tres campos de uma vez,
      // entao reenviar a imagem a partir de um estado desatualizado apagava o
      // fundo — foi o que aconteceu em producao. A rota REST preserva essa
      // separação: cor e fundo têm endereços próprios.
      await definirCorDoPainelDeAcesso(color);
      queryClient.setQueryData(platformBrandingQueryKey, { ...branding, accessPanelColor: color });
      toast.success(color ? "Cor do painel atualizada." : "Painel branco restaurado.");
    } catch (saveError) {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a cor.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient]);

  /** Grava a cor da barra lateral; `null` restaura a cor institucional. */
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

  /**
   * Grava os três textos institucionais de uma vez.
   *
   * Os três vão juntos porque `fc_definir_textos_marca` grava os três: enviar
   * um só zeraria os outros dois. Campo vazio significa restaurar o padrão do
   * código, não apagar — a tela de entrada não pode ficar sem título.
   */
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
    // 2 MB é o limite do próprio bucket `platform-assets`. Validar aqui existe
    // para a pessoa saber antes de esperar o envio, e o número precisa bater com
    // o do storage: prometer 4 MB faria uma imagem de 3 MB passar por esta
    // checagem e ser recusada depois, com mensagem técnica.
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem precisa ter até 2 MB.");
      return;
    }
    setUploadingBackground(true);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // O caminho continua sob `branding/`: a política do bucket que o exigia não
    // existe mais, mas é o prefixo que a galeria lista e o que separa as artes
    // de acesso do resto do balde.
    const path = `branding/acesso-${crypto.randomUUID()}.${extension}`;
    try {
      const arquivo = await enviarArquivo("platform-assets", path, file);

      // O rollback segue valendo: se a gravação da configuração falhar, o
      // arquivo recém-enviado sai do armazenamento, senão o acervo acumularia
      // imagens que nenhuma configuração aponta.
      try {
        await definirFundoDeAcesso(arquivo.url, arquivo.caminho);
      } catch (saveError) {
        await removerArquivo("platform-assets", arquivo.caminho);
        throw saveError;
      }

      queryClient.setQueryData(platformBrandingQueryKey, {
        ...branding,
        accessBackgroundUrl: arquivo.url,
        accessBackgroundPath: arquivo.caminho,
      });
      // A arte recém-enviada precisa aparecer na galeria na hora: sem isso,
      // ela só surgiria no próximo carregamento da tela.
      await loadGallery();
      toast.success("Fundo da tela de acesso atualizado.");
    } catch (uploadError) {
      toast.error(errorMessageFromUnknown(uploadError) || "Não foi possível enviar a imagem.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient, loadGallery]);

  /*
    Restaurar a arte padrão são duas operações, e só uma delas é a restauração.

    A que importa é a configuração deixar de apontar para a imagem: feito isso,
    a tela de acesso já mostra a arte institucional. Apagar o arquivo do storage
    é faxina — evita imagem órfã que configuração nenhuma referencia.

    As duas estavam no mesmo `try`, e a consequência era uma mensagem falsa:
    falha ao apagar o arquivo virava "Não foi possível restaurar a arte padrão",
    quando a arte **já estava** restaurada. Quem operasse tentaria de novo, e a
    segunda tentativa falharia igual — o arquivo continuaria lá, e a
    configuração já estava certa desde a primeira.

    O cache também era atualizado só depois da remoção, então a mesma falha
    deixava a prévia exibindo o fundo antigo, contradizendo o banco.

    Agora a ordem é: gravar, refletir, anunciar — e então limpar, avisando sobre
    o arquivo que ficou, que é o que de fato não aconteceu. A remoção continua
    vindo **depois** da gravação: na ordem inversa, uma falha ao gravar deixaria
    a tela apontando para imagem que não existe mais.
  */
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
        await removerArquivo("platform-assets", caminhoAnterior);
        await loadGallery();
      }
    } catch (cleanupError) {
      // A restauração valeu; o que sobrou foi o arquivo. A galéria mostra a
      // imagem, então é de lá que ela pode ser removida na mão.
      console.warn("Falha ao remover a arte anterior do storage.", cleanupError);
      toast.warning("Arte padrão restaurada, mas a imagem anterior continua na galeria. Remova-a por lá quando quiser.");
    } finally {
      setUploadingBackground(false);
    }
  }, [branding, queryClient, loadGallery]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // O logotipo é identidade institucional fixa: a rota sempre zera os
      // campos de logo no banco, para nenhum upload antigo sobrescrever a marca.
      // Por isso ele não faz parte do corpo enviado daqui.
      return normalizePlatformBranding(await atualizarMarcaDaPlataforma(values));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(platformBrandingQueryKey, updated);
      /*
        Reset **depois** da gravação confirmada, com o que o servidor devolveu.

        Antes quem limpava o formulário era o efeito de sincronização — e era
        justamente ele o defeito. Com o efeito passando a respeitar edição
        pendente, sem este reset o formulário ficaria sujo para sempre depois de
        salvar, e o indicador de alterações pendentes mentiria.
      */
      const salvos: FormValues = {
        organizationName: updated.organizationName,
        productName: updated.productName,
        primaryColor: updated.primaryColor,
      };
      ultimoSincronizado.current = salvos;
      form.reset(salvos);
      toast.success("Identidade da plataforma atualizada.");
    },
    onError: (saveError) => {
      toast.error(errorMessageFromUnknown(saveError) || "Não foi possível salvar a identidade.");
    },
  });

  const brandDirty = form.formState.isDirty;
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

  const isCurrentPerson = (person: Person) => Boolean(currentPersonId) && person.personId === currentPersonId;

  async function setPermissions(person: Person, permissions: readonly string[], successMessage: string) {
    const normalized = [...new Set(permissions)];
    if (isCurrentPerson(person) && !normalized.includes(PLATFORM_MODULE.ADMIN_ACCESS)) {
      toast.error("Você não pode retirar sua própria permissão de administrar acessos.");
      return;
    }

    setChanging(person.personId);
    try {
      await definirPermissoesDaPessoa(person.personId, normalized);

      toast.success(successMessage);
      invalidatePlatformContext();
      await loadPeople(peopleSearch, workspace?.offset ?? 0);
    } catch (changeError) {
      toast.error(errorMessageFromUnknown(changeError) || "Não foi possível alterar as permissões.");
      await loadPeople(peopleSearch, workspace?.offset ?? 0);
    } finally {
      setChanging("");
    }
  }

  async function togglePermission(person: Person, permission: Permission) {
    if (permission.required) return;
    const enabled = person.permissions.includes(permission.code);
    const next = enabled
      ? person.permissions.filter((code) => code !== permission.code)
      : [...person.permissions, permission.code];
    await setPermissions(
      person,
      next,
      `${permission.name} ${enabled ? "retirada de" : "concedida a"} ${person.fullName}.`,
    );
  }

  async function applyPreset(person: Person, presetCode: string) {
    const preset = PLATFORM_ACCESS_PRESETS.find((item) => item.code === presetCode);
    if (!preset) return;
    await setPermissions(person, preset.permissions, `Preset ${preset.name} aplicado a ${person.fullName}.`);
  }

  const permissions = useMemo(
    () => [...(workspace?.permissions ?? [])].sort((a, b) => a.position - b.position || a.code.localeCompare(b.code)),
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
  const homeVisible = cardVisible("home", "página inicial inicio comunicado banner aviso institucional título mensagem link ativação");
  const loginVisible = cardVisible("login", "tela de acesso login entrada saudação instrução expansão sigla cor do painel arte fundo campanha");
  const appearanceVisible = cardVisible("appearance", "aparência logotipo logo cor principal cores tema prévia menu barra lateral");
  const featuresVisible = cardVisible("features", "recursos presença online pessoas conectadas realtime desempenho perfis");
  const operationVisible = cardVisible("operation", "operação avaliações ciclos participantes lideranças equipes comunicação emails lembretes importações respostas histórico falhas auditoria");
  const accessVisible = cardVisible("access", "acessos permissões perfis pessoas segurança participante avaliador admin superadmin");
  const visibleCount = [brandVisible, homeVisible, loginVisible, appearanceVisible, featuresVisible, operationVisible, accessVisible].filter(Boolean).length;
  const presenceDirty = presenceEnabled !== branding.onlinePresenceEnabled;
  const announcementDirty = announcement.enabled !== branding.homeAnnouncementEnabled
    || announcement.title.trim() !== branding.homeAnnouncementTitle
    || announcement.message.trim() !== branding.homeAnnouncementMessage
    || announcement.link.trim() !== (branding.homeAnnouncementLink ?? "")
    || announcement.linkLabel.trim() !== branding.homeAnnouncementLinkLabel;

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="configurações"
      unidentifiedTitle="Não foi possível abrir as configurações"
      restrictedTitle="Configurações restritas"
      restrictedDescription="Você não possui a permissão necessária para alterar configurações e acessos."
    />;
  }

  const displayedLogo = DEFAULT_PLATFORM_BRANDING.logoUrl;

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="Configurações do sistema">
      <div className="min-w-0 pb-28">
        <header className="border-b border-[var(--border-subtle)] pb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Configurações</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Administre identidade, funcionamento e permissões da plataforma. Cada alteração informa quando é aplicada.</p>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 lg:sticky lg:top-24" aria-label="Navegação das configurações">
            <label className="relative block w-full min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={wsQuery}
                onChange={(event) => setWsQuery(event.target.value)}
                placeholder="Buscar seção..."
                aria-label="Buscar seção de configuração"
                className="min-h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-10 pr-9 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-solid)] focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand-solid)_18%,transparent)]"
              />
              {wsQuery ? (
                <button type="button" onClick={() => setWsQuery("")} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>

          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" role="tablist" aria-label="Categorias de configuração">
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
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition lg:w-full ${
                    active
                      ? "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--brand-primary)]"
                      : "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-1 pt-3 text-xs text-[var(--text-muted)]">
            <span>{visibleCount} {visibleCount === 1 ? "seção disponível" : "seções disponíveis"}</span>
            {brandDirty ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--status-warning-text)]"><CircleDot className="h-3 w-3" aria-hidden="true" />Alterações não salvas</span>
            ) : null}
          </div>
          </aside>

        <div className="space-y-4">
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
                <Input label="Nome do sistema" placeholder="SIGAV" form="config-brand-form" error={form.formState.errors.productName?.message} {...form.register("productName")} />
              </div>

            </section>
          ) : null}

          {/* PÁGINA INICIAL */}
          {homeVisible ? (
            <section data-config-section="home" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.home }}>
              <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><Megaphone className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-[var(--text-primary)]">Comunicado institucional</h3>
                    <Badge variant={announcement.enabled ? "success" : "neutral"}>{announcement.enabled ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Mensagem curta no topo da Visão geral, sem bloquear tarefas ou ocupar a tela inteira.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.75fr)]">
                <div className="space-y-4">
                  <Checkbox
                    label="Exibir comunicado na página inicial"
                    description="Ao ativar, título e mensagem passam a ser obrigatórios. Desativar preserva o conteúdo para uso futuro."
                    checked={announcement.enabled}
                    onChange={(event) => setAnnouncement((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                  <Input
                    label="Título"
                    hint={`${announcement.title.length}/120 caracteres`}
                    maxLength={120}
                    value={announcement.title}
                    onChange={(event) => setAnnouncement((current) => ({ ...current, title: event.target.value }))}
                  />
                  <Textarea
                    label="Mensagem"
                    hint={`${announcement.message.length}/400 caracteres`}
                    maxLength={400}
                    value={announcement.message}
                    onChange={(event) => setAnnouncement((current) => ({ ...current, message: event.target.value }))}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Link opcional"
                      hint="Use /rota-interna ou https://..."
                      placeholder="/pesquisas"
                      maxLength={500}
                      value={announcement.link}
                      onChange={(event) => setAnnouncement((current) => ({ ...current, link: event.target.value }))}
                    />
                    <Input
                      label="Texto do link"
                      hint="Até 60 caracteres."
                      placeholder="Saiba mais"
                      maxLength={60}
                      disabled={!announcement.link.trim()}
                      value={announcement.linkLabel}
                      onChange={(event) => setAnnouncement((current) => ({ ...current, linkLabel: event.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" disabled={!announcementDirty || savingAnnouncement} onClick={() => void saveAnnouncement()}>
                      {savingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                      {savingAnnouncement ? "Salvando..." : announcement.enabled ? "Publicar comunicado" : "Salvar como inativo"}
                    </Button>
                  </div>
                </div>

                <div className="lg:sticky lg:top-4 lg:self-start">
                  <p className="section-eyebrow">Prévia na Visão geral</p>
                  <div className="mt-3 rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5 shadow-sm">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm"><Megaphone className="h-4 w-4" aria-hidden="true" /></span>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Comunicado institucional</p>
                    <strong className="mt-1 block text-base text-[var(--text-primary)]">{announcement.title.trim() || "Título do comunicado"}</strong>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{announcement.message.trim() || "A mensagem aparece aqui de forma compacta, antes das pendências."}</p>
                    {announcement.link.trim() ? (
                      <span className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--brand-primary)] shadow-sm">
                        {announcement.linkLabel.trim() || "Saiba mais"}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">A prévia não publica nada. Use o botão da seção para gravar e gerar o evento de auditoria.</p>
                </div>
              </div>
            </section>
          ) : null}

          {/* TELA DE ACESSO */}
          {loginVisible ? (
            <section data-config-section="login" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.login }}>
              <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><LogIn className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)]">Tela de acesso</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">O que quem ainda não entrou vê. A prévia acompanha o que você digita, antes de salvar.</p>
                </div>
              </div>

              {/*
                Formulário à esquerda, prévia à direita, e a prévia é `sticky`:
                a seção é alta, e uma prévia que rolasse para fora da tela ao
                editar o terceiro campo não serviria para nada.
              */}
              <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Textos</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    Deixar um campo vazio restaura o texto padrão — a tela nunca fica sem título.
                  </p>

                  <div className="mt-4 grid gap-4">
                    <Input
                      label="Expansão da sigla"
                      hint="Exibida abaixo da assinatura. Até 120 caracteres."
                      maxLength={120}
                      value={textos.expansao}
                      onChange={(event) => setTextos((atual) => ({ ...atual, expansao: event.target.value }))}
                    />
                    <Input
                      label="Saudação"
                      hint="Título de maior destaque do cartão. Até 80 caracteres."
                      maxLength={80}
                      value={textos.saudacao}
                      onChange={(event) => setTextos((atual) => ({ ...atual, saudacao: event.target.value }))}
                    />
                    <Input
                      label="Instrução"
                      hint="Linha abaixo da saudação. Até 120 caracteres."
                      maxLength={120}
                      value={textos.instrucao}
                      onChange={(event) => setTextos((atual) => ({ ...atual, instrucao: event.target.value }))}
                    />
                  </div>

                  {/*
                    Botão próprio, e não o "Salvar alterações" do rodapé: aquele
                    chama `fc_atualizar_marca_plataforma`, que não conhece estes
                    campos. Ligá-lo aqui faria a tela mostrar sucesso sem que o
                    texto mudasse.
                  */}
                  <div className="mt-4 flex justify-end">
                    <Button type="button" disabled={uploadingBackground} onClick={() => void saveBrandTexts()}>
                      {uploadingBackground ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                      Salvar textos
                    </Button>
                  </div>
                </div>

                <div className="lg:sticky lg:top-4 lg:self-start">
                  <p className="section-eyebrow">Prévia</p>
                  <AccessScreenPreview
                    className="mt-3"
                    organizationName={watchedOrganization}
                    productDescription={textos.expansao || DEFAULT_PLATFORM_BRANDING.productDescription}
                    greeting={textos.saudacao || DEFAULT_PLATFORM_BRANDING.accessGreeting}
                    instruction={textos.instrucao || DEFAULT_PLATFORM_BRANDING.accessInstruction}
                    panelColor={branding.accessPanelColor}
                    backgroundUrl={branding.accessBackgroundUrl ?? "/acesso-fundo.png"}
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    Reprodução em escala menor. A arte e a cor do painel são configuradas em Aparência.
                  </p>
                </div>
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
                    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm"><PlatformLogo src={displayedLogo} alt="Logotipo institucional" organizationName={watchedOrganization} width={96} height={96} loading={brandingLoading} className="h-full w-full object-contain text-xl" /></div>
                      <div className="flex-1">
                        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-xs font-black text-[var(--status-success-text)]"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />Marca institucional fixa</p>
                        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">O logotipo oficial da AgSUS é aplicado automaticamente em toda a plataforma e não pode ser substituído por aqui — assim a identidade nunca diverge entre as telas.</p>
                      </div>
                    </div>
                  </div>

                  {/*
                    Fundo da tela de acesso.

                    Diferente do logotipo, esta arte **é** configurável: ela
                    acompanha campanha institucional (Agosto Lilás, Setembro
                    Amarelo) e muda várias vezes por ano. Fixa no repositório,
                    cada troca viraria pedido para a equipe técnica mais um
                    deploy — e no intervalo a plataforma anunciaria o mês errado.
                  */}
                  <div className="border-t border-[var(--border-subtle)] pt-6">
                    <p className="section-eyebrow">Fundo da tela de acesso</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      {/* Dizia "ao lado do formulário", o que descrevia o
                          layout de duas colunas que a tela de acesso deixou de
                          ter: a arte agora cobre a janela inteira e o cartão
                          flutua sobre ela. Texto de interface que descreve
                          layout precisa mudar junto com o layout, senão orienta
                          para uma tela que não existe mais. */}
                      Imagem de fundo da tela de acesso, exibida em tela cheia com o formulário sobreposto. Use para acompanhar campanhas institucionais. Prefira arte 16:9 e evite texto importante no terço esquerdo, onde fica o formulário. JPG, PNG ou WEBP, até 2 MB.
                    </p>

                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div
                        className="h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-cover bg-center"
                        style={{ backgroundImage: `url(${branding.accessBackgroundUrl ?? "/acesso-fundo.png"})` }}
                        role="img"
                        aria-label={branding.accessBackgroundUrl ? "Prévia do fundo configurado" : "Prévia da arte institucional padrão"}
                      />
                      <div className="flex-1">
                        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]">
                          <ImagePlus className="h-4 w-4" aria-hidden="true" />
                          {uploadingBackground ? "Enviando..." : "Escolher imagem"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={uploadingBackground}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void uploadAccessBackground(file);
                            }}
                          />
                        </label>
                        {branding.accessBackgroundUrl ? (
                          <button
                            type="button"
                            onClick={() => void clearAccessBackground()}
                            disabled={uploadingBackground}
                            className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--status-danger-text)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                          >
                            Restaurar padrão
                          </button>
                        ) : null}
                        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                          {branding.accessBackgroundUrl
                            ? "A imagem vale imediatamente para quem abrir a tela de acesso."
                            : "Sem imagem configurada, vale a arte institucional padrão."}
                        </p>
                      </div>
                    </div>

                    {/*
                      Galeria: as artes enviadas ficam guardadas para reuso.

                      A campanha de agosto volta em agosto do ano que vem — sem
                      esta lista, seria preciso reenviar o arquivo toda vez, e o
                      anterior ficaria no armazenamento sem nada apontando para
                      ele. Aqui a troca é um clique e a limpeza é possível.
                    */}
                    {gallery.length > 0 ? (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">
                          Artes enviadas
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          Reaproveite campanhas anteriores sem reenviar o arquivo. A arte em uso não pode ser apagada.
                        </p>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {gallery.map((item) => {
                            const emUso = branding.accessBackgroundPath === item.path;
                            return (
                              <li
                                key={item.path}
                                className={`overflow-hidden rounded-xl border ${emUso ? "border-[var(--brand-solid)] ring-1 ring-[var(--brand-solid)]" : "border-[var(--border-subtle)]"}`}
                              >
                                <div
                                  className="h-20 bg-cover bg-center"
                                  style={{ backgroundImage: `url(${item.url})` }}
                                  role="img"
                                  aria-label={emUso ? "Arte em uso na tela de acesso" : "Arte disponível"}
                                />
                                <div className="flex items-center justify-between gap-2 p-2">
                                  <span className="text-[11px] text-[var(--text-muted)]">
                                    {emUso ? "Em uso" : `${item.sizeKb} KB`}
                                  </span>
                                  <span className="flex gap-1">
                                    {!emUso ? (
                                      <button
                                        type="button"
                                        onClick={() => void applyGalleryImage(item)}
                                        disabled={uploadingBackground}
                                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                                      >
                                        Usar
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => void deleteGalleryImage(item)}
                                      disabled={uploadingBackground || emUso}
                                      title={emUso ? "Arte em uso: escolha outra antes de apagar" : "Apagar do armazenamento"}
                                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--status-danger-text)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Apagar
                                    </button>
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {/*
                      Cor do painel do formulário.

                      O contraste do texto e do botão é **derivado** desta cor,
                      não escolhido à parte: cor livre com contraste manual
                      produziria tela ilegível na primeira combinação infeliz. A
                      prévia mostra o resultado já invertido, para a escolha ser
                      informada em vez de às cegas.
                    */}
                    <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Cor do painel do formulário</p>
                      {/*
                        A frase anterior dizia que texto e botão "se ajustam
                        sozinhos para continuar legíveis". A primeira metade é
                        verdade — o contraste é derivado da cor. A segunda não:
                        a regra escolhe entre texto claro e escuro por limiar de
                        luminância, e há cores em que a opção escolhida não
                        atinge o mínimo da WCAG. O lilás `#ba93ef`, em uso hoje,
                        é uma delas: 2,47 contra os 4,5 exigidos.

                        Prometer legibilidade automática fazia a tela mentir
                        justamente para quem depende dela. Agora ela informa o
                        número e avisa quando a escolha reprova — a decisão
                        continua sendo de quem configura, mas deixa de ser às
                        cegas.
                      */}
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        O texto e o botão alternam entre claro e escuro conforme a cor escolhida. Confira o contraste abaixo antes de salvar.
                      </p>

                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <input
                          type="color"
                          aria-label="Cor do painel da tela de acesso"
                          value={branding.accessPanelColor ?? "#ffffff"}
                          onChange={(event) => void saveAccessPanelColor(event.target.value)}
                          disabled={uploadingBackground}
                          className="h-12 w-16 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1"
                        />

                        <div
                          className="flex-1 rounded-xl border border-[var(--border-subtle)] p-4"
                          style={{ backgroundColor: branding.accessPanelColor ?? "#ffffff" }}
                        >
                          {/* A prévia inclui o logotipo porque é ele que mais
                              muda de tratamento: sobre painel escuro é
                              renderizado em branco sólido. Prévia que omite
                              isso deixaria a surpresa para a tela real. */}
                          <div
                            className="w-fit"
                            style={accessPanelIsDark ? { filter: "brightness(0) invert(1)" } : undefined}
                          >
                            <PlatformLogo
                              src={DEFAULT_PLATFORM_BRANDING.logoUrl}
                              alt=""
                              organizationName={watchedOrganization}
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain text-[10px]"
                            />
                          </div>
                          <p className={`mt-2 text-sm font-semibold ${accessPanelIsDark ? "text-white" : "text-[#003b70]"}`}>
                            Seja bem-vindo(a) à AgSUS
                          </p>
                          <span className={`mt-2 inline-flex min-h-9 items-center rounded-lg px-4 text-xs font-semibold ${accessPanelIsDark ? "bg-white text-[#003b70]" : "bg-[#003b70] text-white"}`}>
                            Entrar com Google institucional
                          </span>
                        </div>

                        {branding.accessPanelColor ? (
                          <button
                            type="button"
                            onClick={() => void saveAccessPanelColor(null)}
                            disabled={uploadingBackground}
                            className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                          >
                            Voltar ao branco
                          </button>
                        ) : null}
                      </div>

                      {/*
                        O aviso de contraste que `WCAG_AA_NORMAL_TEXT` existia
                        para alimentar desde que foi criado — e que nenhuma tela
                        consumia. A constante estava documentada em
                        `color-contrast.ts` como sendo "para a tela de
                        configuração avisar quando a combinação escolhida fica
                        abaixo do mínimo legível", e a tela nunca avisou.

                        `role="status"` e não `alert`: o número muda a cada
                        ajuste do seletor, e `alert` interromperia o leitor de
                        tela a cada passo do arrasta-cor.
                      */}
                      {contrastePainel !== null && (
                        <p
                          role="status"
                          className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs leading-5 ${
                            contrastePainelAprovado
                              ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                              : "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                          }`}
                        >
                          {contrastePainelAprovado
                            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                          <span>
                            Contraste do texto sobre esta cor: <strong className="font-bold">{contrastePainel.toFixed(2)}</strong>.{" "}
                            {contrastePainelAprovado
                              ? `Atinge o mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA.`
                              : `Abaixo do mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA — quem tem baixa visão pode não conseguir ler. Uma cor mais escura resolve sem mudar o tom.`}
                          </span>
                        </p>
                      )}
                    </div>

                    {/*
                      Cor da barra lateral.

                      Fica junto da cor do painel de acesso porque as duas são
                      "cor de superfície escolhida por quem administra", e não
                      cor de identidade — esta última é a Cor principal, logo
                      abaixo, aplicada em botões e navegação ativa.
                    */}
                    <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Cor da barra lateral</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        Fundo do menu à esquerda em toda a aplicação. Sem cor definida, vale a institucional.
                      </p>

                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <input
                          type="color"
                          aria-label="Cor da barra lateral"
                          value={branding.sidebarColor ?? "#0f2942"}
                          onChange={(event) => void saveSidebarColor(event.target.value)}
                          disabled={uploadingBackground}
                          className="h-12 w-16 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1"
                        />

                        <div
                          className="flex-1 rounded-xl border border-[var(--border-subtle)] p-4"
                          style={{ backgroundColor: branding.sidebarColor ?? "#0f2942" }}
                        >
                          <p className={`text-[10px] font-black uppercase tracking-[.12em] ${sidebarIsDark ? "text-white/60" : "text-slate-600"}`}>Principal</p>
                          <p className={`mt-2 text-sm font-bold ${sidebarIsDark ? "text-white" : "text-[#003b70]"}`}>Visão geral</p>
                        </div>

                        {branding.sidebarColor ? (
                          <button
                            type="button"
                            onClick={() => void saveSidebarColor(null)}
                            disabled={uploadingBackground}
                            className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                          >
                            Restaurar institucional
                          </button>
                        ) : null}
                      </div>

                      {/*
                        Mesmo aviso da cor do painel, e pelo mesmo motivo: a
                        barra lateral tem texto claro por construção, então cor
                        clara demais ali apaga a navegação inteira sem que nada
                        reclame.
                      */}
                      {contrasteBarra !== null && (
                        <p
                          role="status"
                          className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs leading-5 ${
                            contrasteBarraAprovado
                              ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                              : "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                          }`}
                        >
                          {contrasteBarraAprovado
                            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                          <span>
                            Contraste do texto sobre esta cor: <strong className="font-bold">{contrasteBarra.toFixed(2)}</strong>.{" "}
                            {contrasteBarraAprovado
                              ? `Atinge o mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA.`
                              : `Abaixo do mínimo de ${WCAG_AA_NORMAL_TEXT} da WCAG AA — os nomes do menu podem ficar ilegíveis.`}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-6">
                    <p className="section-eyebrow">Cor principal</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Aplicada em botões e navegação ativa. O modo escuro mantém contraste próprio para textos e superfícies.</p>
                    <div className="mt-4 flex max-w-md items-center gap-3">
                      {/*
                        O `aria-label` é o único nome que este controle pode ter:
                        "Cor principal" acima é um parágrafo, não `label`, e o
                        `label` ao lado pertence ao campo hexadecimal. Sem ele o
                        leitor de tela anunciava apenas "seletor de cor" — e é o
                        controle que define a cor de toda a plataforma.
                      */}
                      <input id="primaryColor" aria-label="Cor principal da plataforma" type="color" value={watchedColor} onChange={(event) => form.setValue("primaryColor", event.target.value, { shouldDirty: true, shouldValidate: true })} className="h-12 w-16 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1" />
                      <Input label="Valor hexadecimal" containerClassName="flex-1" form="config-brand-form" error={form.formState.errors.primaryColor?.message} {...form.register("primaryColor")} />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                  <div className="h-1.5" style={{ background: watchedColor }} />
                  <div className="p-5">
                    <p className="section-eyebrow">Prévia do menu</p>
                    <div className="mt-4 rounded-2xl bg-[var(--sidebar-background)] p-4 text-white">
                      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white p-2"><PlatformLogo src={displayedLogo} alt="" organizationName={watchedOrganization} width={40} height={40} loading={brandingLoading} className="h-10 w-10 object-contain text-xs" /></span><span><small className="block uppercase tracking-[.18em] text-[var(--sidebar-muted)]">{watchedOrganization}</small><strong className="mt-1 block">{watchedName}</strong></span></div>
                      <div className="mt-5 rounded-xl px-3 py-3 text-sm font-bold text-white" style={{ background: watchedColor }}>Visão geral</div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">A prévia representa a identidade global.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* RECURSOS */}
          {featuresVisible ? (
            <section data-config-section="features" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.features }}>
              <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><RadioTower className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-[var(--text-primary)]">Pessoas online</h3>
                      <Badge variant={presenceEnabled ? "success" : "neutral"}>{presenceEnabled ? "Ativo" : "Desativado"}</Badge>
                    </div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Conta todas as pessoas com a plataforma aberta. A quantidade e a lista ficam visíveis apenas para quem recebeu a permissão correspondente.</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={presenceEnabled}
                  onClick={() => setPresenceEnabled((current) => !current)}
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${presenceEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${presenceEnabled ? "translate-x-6" : "translate-x-1"}`} />
                  <span className="sr-only">{presenceEnabled ? "Desativar pessoas online" : "Ativar pessoas online"}</span>
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <strong className="block text-sm text-[var(--text-primary)]">Visualização controlada por permissão</strong>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Toda pessoa autenticada registra a própria presença quando o recurso está ligado. Nomes e fotos só aparecem para quem recebeu “Visualizar presença online” na seção Pessoas e permissões.</p>
                </div>

                <aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <p className="section-eyebrow">Impacto controlado</p>
                  <strong className="mt-2 block text-sm text-[var(--text-primary)]">Sem consulta contínua ao banco</strong>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Cada pessoa mantém uma conexão enquanto usa o sistema. Não há gravação por minuto nem atualização por movimento do usuário.</p>
                  <Button type="button" onClick={() => void savePresence()} disabled={!presenceDirty || savingPresence} className="mt-4 w-full">
                    {savingPresence ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    {savingPresence ? "Salvando..." : "Salvar recurso"}
                  </Button>
                </aside>
              </div>
            </section>
          ) : null}

          {/* OPERAÇÃO */}
          {operationVisible ? (
            <section data-config-section="operation" className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6" style={{ borderTopColor: SECTION_ACCENT.operation }}>
              <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><Workflow className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-[var(--text-primary)]">Central operacional</h3>
                    <Badge variant="info">Atalhos administrativos</Badge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Reúna num só lugar o que precisa ser acompanhado antes, durante e depois de cada ciclo. Cada destino mantém suas próprias permissões e validações.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {OPERATION_LINKS.map(({ href, title, description, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--brand-secondary)] hover:bg-[var(--surface-hover)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]/20"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-[var(--text-primary)]">{title}</strong>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{description}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-5 grid gap-3 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--status-success-bg)] p-4 text-[var(--status-success-text)]">
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  <strong className="mt-2 block text-sm">Comunicação rastreável</strong>
                  <span className="mt-1 block text-xs leading-5 opacity-80">Fila e histórico diferenciam pendência, envio e falha.</span>
                </div>
                <div className="rounded-xl bg-[var(--status-info-bg)] p-4 text-[var(--status-info-text)]">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  <strong className="mt-2 block text-sm">Ciclo sob controle</strong>
                  <span className="mt-1 block text-xs leading-5 opacity-80">Instrumento, público e período continuam separados.</span>
                </div>
                <div className="rounded-xl bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
                  <FileClock className="h-4 w-4" aria-hidden="true" />
                  <strong className="mt-2 block text-sm">Exceções visíveis</strong>
                  <span className="mt-1 block text-xs leading-5 opacity-80">Correções administrativas ficam fora do fluxo cotidiano.</span>
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
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Todos usam a role técnica <code>authenticated</code>. Marque permissões individualmente ou aplique um preset funcional; toda mudança é imediata e auditada.</p>
                  </div>
                </div>
                <form
                  onSubmit={(event) => { event.preventDefault(); void loadPeople(peopleQuery, 0); }}
                  className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end lg:w-auto lg:min-w-[26rem]"
                >
                  <Input
                    label="Pesquisar pessoa"
                    value={peopleQuery}
                    onChange={(event) => setPeopleQuery(event.target.value)}
                    placeholder="Nome, matrícula, e-mail ou cargo"
                    containerClassName="min-w-0 flex-1"
                  />
                  <Button type="submit" disabled={fetching} className="sm:mb-0">
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                    Buscar
                  </Button>
                </form>
              </div>

              <DataTableContainer className="mt-5 min-w-0 border-0 shadow-none" aria-label="Pessoas e permissões da plataforma">
                {fetching && !workspace ? (
                  <DataTableState aria-live="polite">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
                    <p className="mt-3 font-semibold">Carregando pessoas e permissões...</p>
                  </DataTableState>
                ) : peopleError && !workspace ? (
                  <DataTableState role="alert">
                    <TriangleAlert className="mx-auto h-6 w-6 text-[var(--status-danger-text)]" aria-hidden="true" />
                    <p className="mt-3 font-semibold">{peopleError}</p>
                    <Button className="mt-4" variant="secondary" onClick={() => void loadPeople(peopleSearch, 0)}>
                      Tentar novamente
                    </Button>
                  </DataTableState>
                ) : (
                  <DataTableScroll className="max-h-[60dvh] min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
                    <DataTable className="min-w-max">
                      <DataTableHead className="sticky top-0 z-20">
                        <DataTableRow className="hover:bg-transparent">
                          <DataTableHeaderCell className="sticky left-0 z-30 min-w-[19rem] bg-[var(--surface-muted)] shadow-[10px_0_18px_-18px_rgba(15,23,42,.8)] sm:min-w-[22rem]">
                            Pessoa
                          </DataTableHeaderCell>
                          {permissions.map((permission) => (
                            <DataTableHeaderCell key={permission.code} className="w-36 min-w-36 text-center">
                              <span title={permission.description ?? permission.name}>{permission.name}</span>
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
                                  <label className="mt-2 block text-[11px] font-semibold text-[var(--text-secondary)]">
                                    Preset funcional
                                    <select
                                      value={matchingAccessPreset(person.permissions)?.code ?? "CUSTOM"}
                                      onChange={(event) => void applyPreset(person, event.target.value)}
                                      disabled={changing === person.personId}
                                      className="mt-1 block min-h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2 text-xs text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-50"
                                    >
                                      <option value="CUSTOM" disabled>Personalizado</option>
                                      {PLATFORM_ACCESS_PRESETS.map((preset) => (
                                        <option key={preset.code} value={preset.code}>{preset.name}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </div>
                            </DataTableCell>
                            {permissions.map((permission) => {
                              const active = person.permissions.includes(permission.code);
                              const busy = changing === person.personId;
                              const isSelfAdminPermission = isCurrentPerson(person)
                                && permission.code === PLATFORM_MODULE.ADMIN_ACCESS;
                              const blocked = busy || permission.required || isSelfAdminPermission;

                              return (
                                <DataTableCell key={permission.code} className="w-36 min-w-36 text-center">
                                  <button
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={`${active ? "Retirar" : "Conceder"} ${permission.name} ${active ? "de" : "a"} ${person.fullName}`}
                                    title={permission.required
                                      ? "Permissão básica obrigatória para toda pessoa autenticada."
                                      : isSelfAdminPermission
                                        ? "Você não pode retirar sua própria administração de acessos."
                                        : permission.description ?? undefined}
                                    onClick={() => void togglePermission(person, permission)}
                                    disabled={blocked}
                                    className={`grid h-7 w-7 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-40 ${
                                      busy ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
                                    } ${
                                      active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white enabled:hover:border-emerald-400"
                                    }`}
                                  >
                                    {busy ? (
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
                          <DataTableEmpty colSpan={Math.max(permissions.length + 1, 1)}>
                            Nenhuma pessoa encontrada para os critérios informados.
                          </DataTableEmpty>
                        )}
                      </DataTableBody>
                    </DataTable>
                  </DataTableScroll>
                )}
              </DataTableContainer>
              {workspace ? (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                  {peopleError ? (
                    <p role="alert" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--status-danger-text)]">
                      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {peopleError} A página anterior foi mantida.
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p aria-live="polite" className="text-sm font-semibold text-[var(--text-secondary)]">
                      {accessPageRange(workspace.offset, workspace.people.length, workspace.total)}
                      {peopleSearch ? ` para “${peopleSearch}”` : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={fetching || workspace.offset === 0}
                        onClick={() => void loadPeople(peopleSearch, previousAccessOffset(workspace.offset, workspace.limit))}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={fetching || !workspace.hasMore}
                        onClick={() => void loadPeople(peopleSearch, nextAccessOffset(workspace.offset, workspace.limit))}
                      >
                        {fetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
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
