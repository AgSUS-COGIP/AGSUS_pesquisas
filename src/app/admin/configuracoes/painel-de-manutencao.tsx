"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay-panel";
import { Checkbox, Input, Textarea } from "@/components/ui/form-controls";
import { useConfirm } from "@/components/confirmation-provider";
import { chamar } from "@/lib/api/requisicao";
import { errorMessageFromUnknown } from "@/lib/observability";
import { normalizarModulosDeManutencao, rotuloDoModulo } from "@/lib/manutencao";
import { platformNavigationGroups } from "@/lib/platform-navigation";
import type { PlatformModule } from "@/lib/platform-modules";

/**
 * Estado operacional da plataforma.
 *
 * ## Duas decisões diferentes, dois blocos
 *
 * Parar a plataforma inteira e parar um módulo têm consequências de ordens
 * distintas — uma manda todo mundo embora, a outra fecha uma porta e mantém as
 * demais. Um controle só, com um interruptor "global" no meio da lista de
 * módulos, tornaria fácil marcar a caixa errada.
 *
 * ## Ativar pede confirmação forte; liberar, não
 *
 * Ativar a manutenção global exige motivo **e** digitar a palavra, porque é a
 * ação que interrompe todo mundo e nada na tela a desfaz sozinha. Liberar
 * devolve o sistema ao normal: pede confirmação clara, não cerimônia. Exigir a
 * mesma digitação para liberar atrasaria justamente a operação que encurta uma
 * indisponibilidade.
 */

const PALAVRA_DE_CONFIRMACAO = "MANUTENÇÃO";
const MINIMO_DO_MOTIVO = 10;

type EstadoDaApi = {
  global: boolean;
  modules: string[];
  leituraDisponivel: boolean;
  controlPlaneAusente?: boolean;
  escritaDisponivel?: boolean;
  detalhe?: { reason: string; updatedAt: string | null; updatedBy: string | null };
};

/** Os módulos agrupados como no menu — mesmos rótulos, mesma ordem. */
const GRUPOS_DE_MODULOS = platformNavigationGroups.map((grupo) => ({
  titulo: grupo.title,
  modulos: [...new Set(grupo.items.map((item) => item.module).filter(Boolean) as PlatformModule[])],
}));

function formatarInstante(valor: string | null) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function PainelDeManutencao() {
  const confirm = useConfirm();
  const [estado, setEstado] = useState<EstadoDaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [palavra, setPalavra] = useState("");

  const carregar = useCallback(async () => {
    try {
      setEstado(await chamar<EstadoDaApi>("/api/plataforma/manutencao"));
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const modulosParados = useMemo(
    () => normalizarModulosDeManutencao(estado?.modules ?? []),
    [estado?.modules],
  );

  const gravar = useCallback(
    async (proximo: { global: boolean; modules: PlatformModule[]; reason: string }) => {
      setSalvando(true);
      try {
        const resposta = await chamar<{ estado: { global: boolean; modules: string[] } }>(
          "/api/plataforma/manutencao",
          { method: "PUT", body: JSON.stringify(proximo) },
        );
        setEstado((anterior) =>
          anterior
            ? { ...anterior, global: resposta.estado.global, modules: resposta.estado.modules }
            : anterior,
        );
        await carregar();
        return true;
      } catch (erro) {
        toast.error(errorMessageFromUnknown(erro));
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [carregar],
  );

  async function confirmarAtivacaoGlobal() {
    const ok = await gravar({ global: true, modules: modulosParados, reason: motivo.trim() });
    if (!ok) return;
    setDialogoAberto(false);
    setMotivo("");
    setPalavra("");
    toast.success("A plataforma está em manutenção.");
  }

  async function liberarPlataforma() {
    const confirmado = await confirm({
      title: "Liberar novamente o acesso ao sistema?",
      description:
        "A plataforma volta a atender imediatamente. A liberação fica registrada na auditoria.",
      confirmLabel: "Liberar acesso",
      showReviewNotice: false,
    });
    if (!confirmado) return;
    if (await gravar({ global: false, modules: modulosParados, reason: "" })) {
      toast.success("A plataforma voltou a operar.");
    }
  }

  async function alternarModulo(modulo: PlatformModule, ativar: boolean) {
    if (ativar) {
      const motivoDoModulo = await confirm({
        title: `Colocar ${rotuloDoModulo(modulo)} em manutenção?`,
        description:
          "As demais áreas continuam disponíveis. Quem tem acesso a este módulo verá a tela de manutenção; a administração continua entrando para conferir a correção.",
        confirmLabel: "Colocar em manutenção",
        showReviewNotice: false,
        prompt: {
          label: "Motivo da manutenção",
          placeholder: "Ex.: Ajuste no cálculo do painel institucional.",
          hint: "Fica registrado na auditoria. Não é exibido a quem usa.",
          minLength: MINIMO_DO_MOTIVO,
        },
      });
      if (!motivoDoModulo) return;
      if (await gravar({
        global: estado?.global ?? false,
        modules: [...modulosParados, modulo],
        reason: motivoDoModulo,
      })) {
        toast.success(`${rotuloDoModulo(modulo)} está em manutenção.`);
      }
      return;
    }

    const confirmado = await confirm({
      title: `Liberar novamente o módulo ${rotuloDoModulo(modulo)}?`,
      description: "O acesso volta imediatamente para quem já tinha permissão.",
      confirmLabel: "Liberar módulo",
      showReviewNotice: false,
    });
    if (!confirmado) return;
    if (await gravar({
      global: estado?.global ?? false,
      modules: modulosParados.filter((item) => item !== modulo),
      reason: "",
    })) {
      toast.success(`${rotuloDoModulo(modulo)} voltou a operar.`);
    }
  }

  const motivoValido = motivo.trim().length >= MINIMO_DO_MOTIVO;
  const palavraValida = palavra.trim().toLocaleUpperCase("pt-BR") === PALAVRA_DE_CONFIRMACAO;
  const escritaIndisponivel = estado?.escritaDisponivel === false;

  if (carregando) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Consultando o estado operacional…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/*
        Não conseguir ler é diferente de estar tudo bem. Sem este aviso, a tela
        afirmaria "Sistema operacional" quando na verdade não sabe.
      */}
      {estado && !estado.leituraDisponivel && !estado.controlPlaneAusente && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-sm leading-6 text-[var(--status-warning-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Não foi possível ler o estado de manutenção. A plataforma continua atendendo normalmente, e nada foi bloqueado por causa desta falha.
        </p>
      )}

      {/*
        Provisionamento pendente não é incidente. Dizer "não foi possível ler"
        aqui mandaria quem administra investigar uma falha que não existe.
      */}
      {estado?.controlPlaneAusente ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Este ambiente não tem control plane de manutenção configurado. A funcionalidade fica inerte aqui e nada é bloqueado por isso.
        </p>
      ) : escritaIndisponivel ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          A leitura funciona, mas a escrita não está configurada neste ambiente: a manutenção só pode ser alterada pelo painel da Vercel.
        </p>
      ) : null}

      {/* ── Estado da plataforma ───────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-subtle)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Estado da plataforma</h4>
              {estado?.global ? (
                <Badge variant="warning">Sistema em manutenção</Badge>
              ) : (
                <Badge variant="success">Sistema operacional</Badge>
              )}
            </div>

            {estado?.global && estado.detalhe ? (
              <dl className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                {estado.detalhe.updatedAt && (
                  <div className="flex gap-2">
                    <dt className="shrink-0">Desde:</dt>
                    <dd className="text-[var(--text-primary)]">{formatarInstante(estado.detalhe.updatedAt)}</dd>
                  </div>
                )}
                {estado.detalhe.reason && (
                  <div className="flex gap-2">
                    <dt className="shrink-0">Motivo:</dt>
                    <dd className="min-w-0 text-[var(--text-primary)]">{estado.detalhe.reason}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Todas as áreas estão atendendo normalmente.
              </p>
            )}
          </div>

          {estado?.global ? (
            <Button type="button" onClick={liberarPlataforma} disabled={salvando || escritaIndisponivel}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Retirar sistema da manutenção
            </Button>
          ) : (
            /*
              Contornado, e não preenchido: é a ação mais perigosa da tela, e
              preenchida ela venceria a disputa de atenção com tudo o mais.
            */
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => setDialogoAberto(true)}
              disabled={salvando || escritaIndisponivel}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Colocar sistema em manutenção
            </Button>
          )}
        </div>
      </section>

      {/* ── Manutenção por módulo ──────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Manutenção por módulo</h4>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          O módulo sai do ar para quem usa e continua acessível à administração, para conferir a correção antes de liberar. Nenhuma permissão é alterada.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GRUPOS_DE_MODULOS.map((grupo) => (
            <fieldset key={grupo.titulo} className="min-w-0" disabled={salvando || escritaIndisponivel}>
              {/*
                `--text-secondary`, e não `--text-muted`: medido no tema claro,
                o segundo dá 4,02:1 sobre esta superfície, abaixo do mínimo da
                WCAG AA para os 12px usados aqui.
              */}
              <legend className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
                {grupo.titulo}
              </legend>
              <div className="mt-2 space-y-2">
                {grupo.modulos.map((modulo) => (
                  <Checkbox
                    key={modulo}
                    label={rotuloDoModulo(modulo)}
                    checked={modulosParados.includes(modulo)}
                    onChange={(evento) => void alternarModulo(modulo, evento.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* ── Confirmação da manutenção global ───────────────────────────── */}
      <Dialog
        open={dialogoAberto}
        onOpenChange={(aberto) => {
          setDialogoAberto(aberto);
          if (!aberto) {
            setMotivo("");
            setPalavra("");
          }
        }}
        title="Colocar o sistema inteiro em manutenção?"
        description="Todas as pessoas passam imediatamente para a tela institucional de manutenção. Somente a administração continua acessando as Configurações, para desfazer."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmarAtivacaoGlobal}
              disabled={!motivoValido || !palavraValida || salvando}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
              Colocar em manutenção
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Motivo da manutenção"
            required
            rows={3}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Ex.: Correção de inconsistência na base de participantes."
            hint={`Fica registrado na auditoria e não é exibido a quem usa. Mínimo de ${MINIMO_DO_MOTIVO} caracteres.`}
          />

          {/*
            A palavra digitada existe para separar o clique da intenção. Um
            único botão, ainda que vermelho, é acionável por engano; escrever
            "MANUTENÇÃO" não é.
          */}
          <Input
            label={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
            required
            value={palavra}
            onChange={(evento) => setPalavra(evento.target.value)}
            autoComplete="off"
            spellCheck={false}
            hint="Confirmação exigida apenas para parar a plataforma inteira."
          />
        </div>
      </Dialog>
    </div>
  );
}
