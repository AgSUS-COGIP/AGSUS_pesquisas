"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Save, Send, History, Users } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { usePlatformBranding, platformBrandingQueryKey } from "@/components/platform-branding-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select, Checkbox } from "@/components/ui/form-controls";
import { EmptyState, ErrorSummary } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { errorMessageFromUnknown } from "@/lib/observability";
import {
  DEFAULT_PARTICIPANT_EMAIL_INSTRUCTION,
  defaultParticipantEmailFooter,
  participantEmailContent,
  type ParticipantEmailKind,
} from "@/lib/participant-emails";
import {
  despacharEmails,
  definirTextosDeEmail,
  enviarEmailsParaPessoas,
  listarAudienciaDeEmail,
  listarCiclosDeParticipantes,
  listarEnviosDeEmail,
} from "@/lib/api/cliente-pessoas";
import type {
  AvaliacaoComParticipantes,
  HistoricoDeEmails,
  PessoaDaAudiencia,
} from "@/lib/api/contratos-pessoas";

/** Abas da central. Cada uma responde a uma pergunta diferente de quem opera. */
const PAINEIS = [
  { id: "enviar", label: "Enviar", icon: Send },
  { id: "fila", label: "Fila e histórico", icon: History },
  { id: "textos", label: "Textos", icon: Mail },
] as const;
type PainelId = (typeof PAINEIS)[number]["id"];

const SITUACOES = [
  { value: "PENDING", label: "Ainda não respondeu" },
  { value: "DRAFT", label: "Começou e não enviou" },
  { value: "DONE", label: "Já concluiu" },
  { value: "ALL", label: "Todos" },
] as const;

const SITUACAO_LABEL: Record<string, string> = {
  PENDING: "Não respondeu",
  DRAFT: "Rascunho",
  DONE: "Concluída",
};

/*
 * Os quatro estados da fila, na ordem em que acontecem.
 *
 * `PENDENTE` e `PROCESSANDO` são coisas diferentes e a distinção importa para
 * quem opera: o primeiro é "está na fila, ninguém tentou", o segundo é "alguém
 * reivindicou e não terminou". Uma tela que conhecesse só três estados
 * esconderia o quarto e mostraria contadores zerados com linhas na lista — foi
 * exatamente o que aconteceu em 20/08/2026.
 */
const ESTADOS_ENVIO = ["PENDENTE", "PROCESSANDO", "ENVIADO", "FALHOU"] as const;
const ENVIO_LABEL: Record<string, string> = {
  PENDENTE: "Na fila",
  PROCESSANDO: "Enviando",
  ENVIADO: "Enviado",
  FALHOU: "Falhou",
};

const TIPO_LABEL: Record<string, string> = {
  research_opened: "Abertura",
  research_expiring_24h: "24 horas finais",
  manual_reminder: "Lembrete dirigido",
};

/** Amostra da prévia — fictícia de propósito, e com data fixa para não redesenhar a cada render. */
const PREVIA = {
  personName: "Maria da Silva",
  applicationName: "Avaliação de exemplo 2026",
  applicationCode: "EXEMPLO-2026",
  surveyCode: "EXEMPLO",
  closesAt: "2026-12-15T20:59:00.000Z",
  surveyDescription: "Exemplo do texto que vem da descrição da avaliação, editada no construtor.",
} as const;
const PREVIA_URL = "https://exemplo.agsus.org.br/pesquisas/EXEMPLO-2026";
const PREVIA_TIPOS: { kind: ParticipantEmailKind; label: string }[] = [
  { kind: "research_opened", label: "Abertura" },
  { kind: "research_expiring_24h", label: "24 h finais" },
  { kind: "manual_reminder", label: "Lembrete" },
];

/**
 * Teto de pessoas carregadas por vez.
 *
 * 2000 é o máximo que `fc_listar_audiencia_email` aceita, e cobre com folga o
 * maior ciclo em operação (CDDI-2026, 1023 participantes). O padrão da RPC é
 * 500, e pedi-lo explicitamente aqui evita o pior caso: uma lista cortada em
 * 500 que **parece** ser a audiência inteira. Quando o corte acontecer mesmo
 * assim, a tela avisa — cap silencioso lê-se como "estão todos aqui".
 */
const LIMITE_AUDIENCIA = 2000;

function dataHora(valor: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export default function TelaAdminEmails() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { branding } = usePlatformBranding();

  const [painel, setPainel] = useState<PainelId>("enviar");
  const [ciclos, setCiclos] = useState<AvaliacaoComParticipantes[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [carregandoCiclos, setCarregandoCiclos] = useState(true);

  // ── Enviar ──────────────────────────────────────────────────────────────
  const [situacao, setSituacao] = useState<string>("PENDING");
  const [busca, setBusca] = useState("");
  const [audiencia, setAudiencia] = useState<PessoaDaAudiencia[]>([]);
  const [carregandoAudiencia, setCarregandoAudiencia] = useState(false);
  /*
   * Erro de carga é estado próprio, e não lista vazia.
   *
   * Sem isto, uma RPC que falha deixa `audiencia` em `[]` e a tela mostra
   * "Ninguém neste filtro" — afirmação falsa e cara: quem opera conclui que o
   * ciclo não tem ninguém pendente e vai embora. O caso apareceu de imediato no
   * localhost, com a migration ainda não aplicada devolvendo 501.
   */
  const [erroAudiencia, setErroAudiencia] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ enviados: number; falhas: number } | null>(null);

  // ── Fila ────────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState<HistoricoDeEmails | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  /** Mesma razão do erro de audiência: "nenhum envio" e "não deu para ler" não são a mesma frase. */
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [filtroEnvio, setFiltroEnvio] = useState("ALL");
  const [processando, setProcessando] = useState(false);

  // ── Textos ──────────────────────────────────────────────────────────────
  const [textos, setTextos] = useState({ instrucao: "", rodape: "" });
  const [salvandoTextos, setSalvandoTextos] = useState(false);
  const [previaTipo, setPreviaTipo] = useState<ParticipantEmailKind>("research_opened");

  // Os campos nascem vazios quando nada foi configurado: o padrão é longo e
  // interpola os nomes da marca, então despejá-lo no campo faria a instalação
  // gravar uma cópia congelada que pararia de acompanhar a marca no dia
  // seguinte. Vazio significa "usar o padrão", e o placeholder mostra qual é.
  useEffect(() => {
    setTextos({ instrucao: branding.emailInstruction, rodape: branding.emailFooter });
  }, [branding.emailInstruction, branding.emailFooter]);

  useEffect(() => {
    if (!granted) return;
    let ativo = true;
    void (async () => {
      try {
        const linhas = await listarCiclosDeParticipantes();
        if (!ativo) return;
        setCiclos(linhas);
        setCicloId((atual) => atual || linhas[0]?.id || "");
      } catch (erro) {
        if (ativo) toast.error(errorMessageFromUnknown(erro) || "Não foi possível carregar os ciclos.");
      } finally {
        if (ativo) setCarregandoCiclos(false);
      }
    })();
    return () => { ativo = false; };
  }, [granted]);

  const carregarAudiencia = useCallback(async () => {
    if (!cicloId) return;
    setCarregandoAudiencia(true);
    setErroAudiencia(null);
    try {
      const linhas = await listarAudienciaDeEmail(cicloId, {
        situacao,
        busca: busca || undefined,
        limite: LIMITE_AUDIENCIA,
      });
      setAudiencia(linhas);
      // A seleção é descartada de propósito ao trocar filtro, ciclo ou busca:
      // manter marcações invisíveis faria o botão dizer "enviar para 40" com 3
      // pessoas na tela, e ninguém saberia quem são as outras 37.
      setSelecionadas(new Set());
    } catch (erro) {
      const mensagem = errorMessageFromUnknown(erro) || "Não foi possível carregar a audiência.";
      setErroAudiencia(mensagem);
      setAudiencia([]);
      setSelecionadas(new Set());
      toast.error(mensagem);
    } finally {
      setCarregandoAudiencia(false);
    }
  }, [busca, cicloId, situacao]);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      setHistorico(await listarEnviosDeEmail({ avaliacao: cicloId || null, situacao: filtroEnvio }));
    } catch (erro) {
      const mensagem = errorMessageFromUnknown(erro) || "Não foi possível carregar o histórico.";
      setErroHistorico(mensagem);
      setHistorico(null);
      toast.error(mensagem);
    } finally {
      setCarregandoHistorico(false);
    }
  }, [cicloId, filtroEnvio]);

  useEffect(() => {
    if (!granted || painel !== "enviar" || !cicloId) return;
    void carregarAudiencia();
  }, [granted, painel, cicloId, carregarAudiencia]);

  useEffect(() => {
    if (!granted || painel !== "fila") return;
    void carregarHistorico();
  }, [granted, painel, carregarHistorico]);

  const elegiveis = useMemo(() => audiencia.filter((pessoa) => pessoa.emailValido), [audiencia]);
  const semEmail = audiencia.length - elegiveis.length;
  const cicloAtual = ciclos.find((ciclo) => ciclo.id === cicloId);
  const cicloAberto = cicloAtual?.status === "OPEN";

  /**
   * Processa a fila em laço, um lote por chamada, até o servidor dizer que não
   * há mais — ou até 60 lotes, teto contra laço infinito se algo travar no
   * estado PROCESSANDO. Cada chamada é curta; o progresso aparece a cada volta.
   */
  const drenarFila = useCallback(async () => {
    let enviados = 0;
    let falhas = 0;
    /*
     * `pulado` sobe para quem chamou em vez de virar só um toast aqui.
     *
     * Sem isso o chamador não distingue "a fila esvaziou" de "o servidor nem
     * tentou", e anuncia sucesso com zero enviados — foi o que aconteceu em
     * 20/08/2026: a rota devolveu 503 por falta de SMTP_APP_PASSWORD, a tela
     * mostrou o erro e **em seguida** um "0 e-mails enviados" como se tivesse
     * dado certo.
     */
    let pulado: string[] | null = null;
    for (let volta = 0; volta < 60; volta += 1) {
      const resultado = await despacharEmails();
      if (resultado.status === "skipped") {
        pulado = resultado.missingConfiguration;
        break;
      }
      enviados += resultado.sent;
      falhas += resultado.failed;
      setProgresso({ enviados, falhas });
      if (!resultado.remaining) break;
    }
    return { enviados, falhas, pulado };
  }, []);

  const enviarSelecionadas = useCallback(async () => {
    const pessoas = [...selecionadas];
    if (!pessoas.length) return;

    // A confirmação **diz o número**. É a diferença entre revisar e descobrir
    // depois: um clique aqui alcança pessoas reais e consome cota de envio da
    // conta institucional.
    const ok = await confirm({
      title: `Enviar e-mail para ${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"}?`,
      description: `O lembrete será enviado agora, pelo e-mail institucional, para quem você selecionou em "${cicloAtual?.name ?? "este ciclo"}". Não é possível cancelar depois de começar.`,
      confirmLabel: "Enviar agora",
      tone: pessoas.length > 50 ? "danger" : undefined,
    });
    if (!ok) return;

    setEnviando(true);
    setProgresso({ enviados: 0, falhas: 0 });
    try {
      const fila = await enviarEmailsParaPessoas({ avaliacao: cicloId, pessoas });
      if (fila.enfileiradas === 0) {
        // A causa mais comum não é inelegibilidade: é já existir um lembrete
        // aguardando envio. Culpar o cadastro manda quem opera investigar o
        // lugar errado — a fila é o primeiro lugar a olhar.
        toast.error("Ninguém entrou na fila. Quem você selecionou já tem um lembrete aguardando envio, ou deixou de ser elegível no ciclo. Confira em Fila e histórico.");
        void carregarAudiencia();
        return;
      }
      if (fila.ignoradas > 0) {
        toast.warning(`${fila.ignoradas} de ${fila.solicitadas} ficaram de fora — sem e-mail válido, fora do ciclo, ou já com lembrete na fila.`);
      }
      const { enviados, falhas, pulado } = await drenarFila();
      if (pulado) {
        // Enfileirou, mas o servidor não despachou. A distinção importa: o
        // trabalho não se perdeu, e some assim que a configuração existir.
        toast.error(`${fila.enfileiradas} na fila, mas o servidor não enviou: falta ${pulado.join(", ")}. Ficam aguardando e saem no próximo despacho.`);
      } else if (falhas > 0) {
        toast.warning(`${enviados} enviados, ${falhas} falharam. Veja o motivo em Fila e histórico.`);
      } else if (enviados === 0) {
        toast.warning(`${fila.enfileiradas} na fila, mas nada foi enviado ainda. Veja em Fila e histórico.`);
      } else {
        toast.success(`${enviados} ${enviados === 1 ? "e-mail enviado" : "e-mails enviados"}.`);
      }
      setSelecionadas(new Set());
      void carregarAudiencia();
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro) || "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }, [carregarAudiencia, cicloAtual, cicloId, confirm, drenarFila, selecionadas]);

  const processarFila = useCallback(async () => {
    setProcessando(true);
    setProgresso({ enviados: 0, falhas: 0 });
    try {
      const { enviados, falhas, pulado } = await drenarFila();
      if (pulado) {
        toast.error(`O servidor não conseguiu enviar: falta ${pulado.join(", ")}. A fila continua intacta.`);
      } else if (enviados === 0 && falhas === 0) {
        toast.info("Nada pendente na fila.");
      } else {
        toast.success(`Fila processada: ${enviados} enviados, ${falhas} falharam.`);
      }
      void carregarHistorico();
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro) || "Não foi possível processar a fila.");
    } finally {
      setProcessando(false);
    }
  }, [carregarHistorico, drenarFila]);

  const salvarTextos = useCallback(async () => {
    setSalvandoTextos(true);
    try {
      const entrada = {
        instrucao: textos.instrucao.trim() || null,
        rodape: textos.rodape.trim() || null,
      };
      await definirTextosDeEmail(entrada);
      // Guarda o valor bruto: vazio continua vazio, porque "não configurado" é
      // um estado real e o padrão só é aplicado no envio.
      queryClient.setQueryData(platformBrandingQueryKey, {
        ...branding,
        emailInstruction: entrada.instrucao ?? "",
        emailFooter: entrada.rodape ?? "",
      });
      toast.success("Textos do e-mail atualizados.");
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro) || "Não foi possível salvar os textos.");
    } finally {
      setSalvandoTextos(false);
    }
  }, [branding, queryClient, textos]);

  /*
   * A prévia chama o **mesmo** gerador do envio, e por isso não pode mentir.
   * Reproduzir o layout aqui divergiria do template no primeiro ajuste, e a
   * divergência só apareceria na caixa de entrada de mil pessoas.
   */
  const previa = useMemo(
    () => participantEmailContent(
      {
        ...PREVIA,
        kind: previaTipo,
        organizationName: branding.organizationName,
        productName: branding.productName,
        emailInstruction: textos.instrucao,
        emailFooter: textos.rodape,
      },
      PREVIA_URL,
    ),
    [branding.organizationName, branding.productName, previaTipo, textos],
  );

  if (guard.state !== "granted") {
    return (
      <PlatformGuardState
        guard={guard}
        title="central de e-mails"
        restrictedTitle="Acesso restrito"
        restrictedDescription="A central de e-mails é da administração de avaliações."
      />
    );
  }

  const todasMarcadas = elegiveis.length > 0 && selecionadas.size === elegiveis.length;

  return (
    <PlatformShell user={guard.user} eyebrow="Administração" title="E-mails aos participantes">
      <div className="space-y-6">
        {/* Seletor de ciclo: vale para os três painéis. */}
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Select
              label="Ciclo"
              hint={carregandoCiclos ? "Carregando…" : "Vale para envio, fila e histórico."}
              value={cicloId}
              disabled={carregandoCiclos}
              onChange={(evento) => setCicloId(evento.target.value)}
            >
              {ciclos.length === 0 ? <option value="">Nenhum ciclo disponível</option> : null}
              {ciclos.map((ciclo) => (
                <option key={ciclo.id} value={ciclo.id}>
                  {ciclo.name} ({ciclo.code}) — {ciclo.participantCount} participantes
                </option>
              ))}
            </Select>
            {cicloAtual ? (
              <div className="flex items-center gap-2 pb-1">
                <Badge variant={cicloAberto ? "success" : "warning"} title={cicloAtual.status}>
                  {cicloAberto ? "Aberto" : "Não está aberto"}
                </Badge>
              </div>
            ) : null}
          </div>
          {cicloAtual && !cicloAberto ? (
            <p className="mt-3 text-sm text-[var(--status-warning-text)]">
              O ciclo precisa estar aberto para receber e-mails. Abra-o em Propriedades da avaliação.
            </p>
          ) : null}
        </section>

        {/* Abas */}
        {/*
          Botões com `aria-pressed`, e não `role="tab"`.
          O padrão ARIA de abas exige `aria-controls` apontando para um
          `role="tabpanel"` e navegação por setas; declarar só os papéis promete
          ao leitor de tela um comportamento que a tela não entrega — pior do
          que não usar o padrão. Mesmo tratamento do seletor de prévia abaixo.
        */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--surface-muted)] p-1" role="group" aria-label="Painel da central de e-mails">
          {PAINEIS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={painel === item.id}
              onClick={() => setPainel(item.id)}
              /*
                Sem `title`: ele vira o nome acessível do botão e o leitor de
                tela passa a anunciar a dica no lugar do rótulo. Cada painel já
                se explica no próprio título e na linha abaixo dele.
              */
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                painel === item.id
                  ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>

        {/* ── ENVIAR ─────────────────────────────────────────────────────── */}
        {painel === "enviar" ? (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black text-[var(--text-primary)]">Escolher quem recebe</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  O lembrete usa os mesmos textos dos avisos automáticos. Selecionar só você é a forma de testar.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <Select label="Situação" value={situacao} onChange={(evento) => setSituacao(evento.target.value)}>
                {SITUACOES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
              <form onSubmit={(evento) => { evento.preventDefault(); void carregarAudiencia(); }}>
                <Input
                  label="Buscar"
                  hint="Nome, matrícula ou e-mail. Enter aplica."
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                />
              </form>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  label={`Selecionar ${elegiveis.length} ${elegiveis.length === 1 ? "pessoa" : "pessoas"}`}
                  checked={todasMarcadas}
                  disabled={elegiveis.length === 0}
                  onChange={(evento) =>
                    setSelecionadas(evento.target.checked ? new Set(elegiveis.map((p) => p.personId)) : new Set())
                  }
                />
                {semEmail > 0 ? (
                  <span className="text-xs text-[var(--status-warning-text)]">
                    {semEmail} sem e-mail válido — não podem ser selecionadas.
                  </span>
                ) : null}
                {audiencia.length >= LIMITE_AUDIENCIA ? (
                  <span className="text-xs text-[var(--status-warning-text)]">
                    Lista cortada em {LIMITE_AUDIENCIA}. Refine a busca para alcançar o restante.
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {progresso && enviando ? (
                  <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">
                    {progresso.enviados} enviados{progresso.falhas ? `, ${progresso.falhas} falharam` : ""}…
                  </span>
                ) : null}
                <Button
                  type="button"
                  disabled={selecionadas.size === 0 || enviando || !cicloAberto}
                  title={!cicloAberto ? "O ciclo precisa estar aberto." : undefined}
                  onClick={() => void enviarSelecionadas()}
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Enviar para {selecionadas.size}
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
              {carregandoAudiencia ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2, 3].map((linha) => <Skeleton key={linha} className="h-10 w-full" />)}
                </div>
              ) : erroAudiencia ? (
                <div className="p-4">
                  <ErrorSummary title="Não foi possível carregar a audiência" errors={[erroAudiencia]} />
                  <Button type="button" variant="secondary" className="mt-3" onClick={() => void carregarAudiencia()}>
                    Tentar de novo
                  </Button>
                </div>
              ) : audiencia.length === 0 ? (
                <EmptyState
                  title="Ninguém neste filtro"
                  description="Troque a situação ou limpe a busca. Só aparecem participantes elegíveis e ativos."
                />
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {audiencia.map((pessoa) => (
                    <li key={pessoa.personId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Checkbox
                        label=""
                        aria-label={`Selecionar ${pessoa.fullName}`}
                        checked={selecionadas.has(pessoa.personId)}
                        disabled={!pessoa.emailValido}
                        onChange={(evento) =>
                          setSelecionadas((atual) => {
                            const proxima = new Set(atual);
                            if (evento.target.checked) proxima.add(pessoa.personId);
                            else proxima.delete(pessoa.personId);
                            return proxima;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{pessoa.fullName}</p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {pessoa.employeeNumber ? `${pessoa.employeeNumber} · ` : ""}
                          {pessoa.emailValido ? pessoa.email : "sem e-mail válido"}
                        </p>
                      </div>
                      <Badge
                        variant={pessoa.situation === "DONE" ? "success" : pessoa.situation === "DRAFT" ? "info" : "neutral"}
                        title={pessoa.situation}
                      >
                        {SITUACAO_LABEL[pessoa.situation]}
                      </Badge>
                      <span className="w-40 text-right text-xs text-[var(--text-secondary)]">
                        {pessoa.lastEmailAt
                          ? `${TIPO_LABEL[pessoa.lastEmailKind ?? ""] ?? pessoa.lastEmailKind} · ${dataHora(pessoa.lastEmailAt)}`
                          : "nunca recebeu"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {/* ── FILA E HISTÓRICO ───────────────────────────────────────────── */}
        {painel === "fila" ? (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
                  <History className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-black text-[var(--text-primary)]">Fila e histórico</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Tudo que a plataforma tentou enviar, com o motivo de cada falha.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {progresso && processando ? (
                  <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">
                    {progresso.enviados} enviados{progresso.falhas ? `, ${progresso.falhas} falharam` : ""}…
                  </span>
                ) : null}
                <Button type="button" variant="secondary" disabled={processando} onClick={() => void processarFila()}>
                  {processando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Processar fila agora
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ESTADOS_ENVIO.map((chave) => (
                <div key={chave} className="rounded-xl border border-[var(--border-subtle)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{ENVIO_LABEL[chave]}</p>
                  {/* Traço, não zero: "não deu para ler" não é "não há nenhum". */}
                  <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                    {erroHistorico ? "—" : historico?.resumo?.[chave] ?? 0}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 max-w-xs">
              <Select label="Filtrar por situação" value={filtroEnvio} onChange={(evento) => setFiltroEnvio(evento.target.value)}>
                <option value="ALL">Todos</option>
                {ESTADOS_ENVIO.map((chave) => (
                  <option key={chave} value={chave}>{ENVIO_LABEL[chave]}</option>
                ))}
              </Select>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
              {carregandoHistorico ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2].map((linha) => <Skeleton key={linha} className="h-10 w-full" />)}
                </div>
              ) : erroHistorico ? (
                <div className="p-4">
                  <ErrorSummary title="Não foi possível carregar o histórico" errors={[erroHistorico]} />
                  <Button type="button" variant="secondary" className="mt-3" onClick={() => void carregarHistorico()}>
                    Tentar de novo
                  </Button>
                </div>
              ) : !historico?.envios?.length ? (
                <EmptyState
                  title="Nenhum envio registrado"
                  description="Nada foi enviado ainda para este recorte. Um envio aparece aqui assim que entra na fila."
                />
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {historico.envios.map((envio) => (
                    <li key={envio.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{envio.personName}</p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {envio.personEmail} · {TIPO_LABEL[envio.kind] ?? envio.kind} · {envio.applicationCode}
                        </p>
                        {envio.erro ? (
                          <p className="mt-1 text-xs text-[var(--status-danger-text)]">{envio.erro}</p>
                        ) : null}
                      </div>
                      <Badge
                        variant={envio.status === "ENVIADO" ? "success" : envio.status === "FALHOU" ? "danger" : envio.status === "PROCESSANDO" ? "info" : "neutral"}
                        title={envio.status}
                      >
                        {/* Estado desconhecido mostra o código cru em vez de sumir da tela. */}
                        {ENVIO_LABEL[envio.status] ?? envio.status}
                      </Badge>
                      <span className="w-32 text-right text-xs text-[var(--text-secondary)]">
                        {dataHora(envio.sentAt ?? envio.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {/* ── TEXTOS ─────────────────────────────────────────────────────── */}
        {painel === "textos" ? (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black text-[var(--text-primary)]">Textos institucionais</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Os dois trechos que se repetem em todo e-mail, de todo ciclo. A prévia é o e-mail de verdade.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem]">
              <div>
                <div className="grid gap-4">
                  <Textarea
                    label="Como acessar"
                    hint="Aparece logo acima do botão. É o texto que mais muda o resultado: quem recebe costuma não saber que a entrada é a própria conta do trabalho. Até 400 caracteres."
                    maxLength={400}
                    rows={3}
                    placeholder={DEFAULT_PARTICIPANT_EMAIL_INSTRUCTION}
                    value={textos.instrucao}
                    onChange={(evento) => setTextos((atual) => ({ ...atual, instrucao: evento.target.value }))}
                  />
                  <Textarea
                    label="Assinatura do rodapé"
                    hint="Última linha da mensagem, em letra menor. Até 400 caracteres."
                    maxLength={400}
                    rows={3}
                    placeholder={defaultParticipantEmailFooter(branding.organizationName, branding.productName)}
                    value={textos.rodape}
                    onChange={(evento) => setTextos((atual) => ({ ...atual, rodape: evento.target.value }))}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">O que não se configura aqui</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--text-secondary)]">
                    <li><strong>Ligar o aviso automático</strong> é decisão de cada ciclo, em Propriedades da avaliação.</li>
                    <li><strong>O que a avaliação é</strong> vem da descrição dela, editada no construtor — assim cada avaliação explica a si mesma, e a frase não existe em dois lugares.</li>
                  </ul>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button type="button" disabled={salvandoTextos} onClick={() => void salvarTextos()}>
                    {salvandoTextos ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    Salvar textos
                  </Button>
                </div>
              </div>

              <div className="lg:sticky lg:top-4 lg:self-start">
                <p className="section-eyebrow">Prévia</p>
                <div className="mt-3 flex gap-1 rounded-lg bg-[var(--surface-muted)] p-1" role="group" aria-label="Tipo de e-mail na prévia">
                  {PREVIA_TIPOS.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => setPreviaTipo(item.kind)}
                      aria-pressed={previaTipo === item.kind}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                        previaTipo === item.kind
                          ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">Assunto</p>
                <p className="text-xs leading-5 text-[var(--text-secondary)]">{previa.subject}</p>
                {/*
                  `srcDoc` num iframe, e não `dangerouslySetInnerHTML`: o corpo é
                  um documento HTML completo, com estilos inline pensados para
                  cliente de e-mail. Injetá-lo na página deixaria o CSS da
                  aplicação contaminar a prévia — que passaria a mostrar algo
                  diferente do que chega na caixa de entrada. `sandbox` vazio
                  desliga script e navegação: é prévia, não execução.
                */}
                <iframe
                  title="Prévia do e-mail ao participante"
                  srcDoc={previa.html}
                  sandbox=""
                  className="mt-2 h-[26rem] w-full rounded-xl border border-[var(--border-subtle)] bg-white"
                />
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  Exemplo com dados fictícios. A prévia usa o mesmo gerador do envio.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </PlatformShell>
  );
}
