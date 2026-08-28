"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Hourglass, Info, ListFilter, Users2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Checkbox, Select } from "@/components/ui/form-controls";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { PageHeader, StatCard, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { listarCiclosDeParticipantes } from "@/lib/api/cliente-pessoas";
import { aplicarPublico, obterDimensoesDoPublico, previsualizarPublico } from "@/lib/api/cliente-publico";
import {
  CHAVES_DE_DIMENSAO,
  ROTULO_DA_DIMENSAO,
  regraTemCriterio,
  regraVazia,
  type ChaveDeDimensao,
  type DimensoesDoPublico,
  type PreviaDoPublico,
  type RegraDePublico,
} from "@/lib/api/contratos-publico";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";
import { ErroDeApi } from "@/lib/api/requisicao";
import { errorMessageFromUnknown } from "@/lib/observability";

/**
 * Definir público da avaliação.
 *
 * A tela antiga continua existindo em `/admin/participantes`: ela resolve o caso
 * de vincular uma pessoa específica, que continua legítimo. Esta aqui resolve o
 * caso institucional — centenas de pessoas escolhidas por critério, não por
 * busca nominal.
 *
 * A separação em duas telas é deliberada. O construtor de público tem etapas,
 * prévia e confirmação; enfiá-lo dentro da tela de busca faria as duas
 * experiências disputarem a mesma área e obrigaria quem só quer somar uma pessoa
 * a atravessar um fluxo de quatro passos.
 */
export default function AdminDefinirPublicoPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_PARTICIPANTS);
  const confirm = useConfirm();

  const [ciclos, setCiclos] = useState<AvaliacaoComParticipantes[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [dimensoes, setDimensoes] = useState<DimensoesDoPublico["dimensions"]>({});
  const [regra, setRegra] = useState<RegraDePublico>(regraVazia);
  const [previa, setPrevia] = useState<PreviaDoPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [dimensoesIndisponiveis, setDimensoesIndisponiveis] = useState(false);

  const cicloSelecionado = useMemo(
    () => ciclos.find((item) => item.id === cicloId) ?? null,
    [ciclos, cicloId],
  );
  const temCriterio = regraTemCriterio(regra);

  useEffect(() => {
    let ativo = true;
    listarCiclosDeParticipantes()
      .then((lista) => { if (ativo) setCiclos(lista); })
      .catch((erro) => { if (ativo) toast.error(errorMessageFromUnknown(erro)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!cicloId) return;
    let ativo = true;
    setDimensoesIndisponiveis(false);
    obterDimensoesDoPublico(cicloId)
      .then((resposta) => { if (ativo) setDimensoes(resposta.dimensions ?? {}); })
      .catch((erro) => {
        if (!ativo) return;
        // Ambiente sem a rotina publicada devolve 501. Sem este tratamento a
        // tela mostrava cinco dimensões vazias — indistinguível de uma base
        // sem dados, e portanto o pior jeito de descobrir que falta um deploy.
        if (erro instanceof ErroDeApi && erro.indisponivelNoAmbiente) {
          setDimensoesIndisponiveis(true);
          return;
        }
        toast.error(errorMessageFromUnknown(erro));
      });
    return () => { ativo = false; };
  }, [cicloId]);

  // Trocar de ciclo zera regra e prévia. Manter a seleção anterior mostraria
  // números de um ciclo ao lado do nome de outro.
  function selecionarCiclo(id: string) {
    setCicloId(id);
    setRegra(regraVazia());
    setPrevia(null);
  }

  // Qualquer mudança na regra invalida a prévia: número velho ao lado de
  // critério novo é a forma mais fácil de alguém confirmar o que não conferiu.
  function alterarRegra(proxima: RegraDePublico) {
    setRegra(proxima);
    setPrevia(null);
  }

  function alternarValor(dimensao: ChaveDeDimensao, valor: string) {
    const atuais = regra.filters[dimensao] ?? [];
    const proximos = atuais.includes(valor)
      ? atuais.filter((item) => item !== valor)
      : [...atuais, valor];
    alterarRegra({ ...regra, filters: { ...regra.filters, [dimensao]: proximos } });
  }

  const calcularPrevia = useCallback(async () => {
    if (!cicloId || !temCriterio) return;
    setCalculando(true);
    try {
      setPrevia(await previsualizarPublico(cicloId, regra));
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro));
    } finally {
      setCalculando(false);
    }
  }, [cicloId, regra, temCriterio]);

  async function confirmarAplicacao() {
    if (!cicloId || !previa || !cicloSelecionado) return;

    const confirmado = await confirm({
      title: "Aplicar o público?",
      description:
        `${previa.matchedCount} ${previa.matchedCount === 1 ? "pessoa passa" : "pessoas passam"} a compor o público de "${cicloSelecionado.name}". ` +
        `${previa.newLinkCount} ${previa.newLinkCount === 1 ? "vínculo novo" : "vínculos novos"} e ` +
        `${previa.excludedCount} ${previa.excludedCount === 1 ? "exclusão registrada" : "exclusões registradas"}.`,
      confirmLabel: "Aplicar público",
      showReviewNotice: false,
    });
    if (!confirmado) return;

    setAplicando(true);
    try {
      const resultado = await aplicarPublico(cicloId, regra);
      toast.success(
        `Público aplicado: ${resultado.assignedCount} novo(s), ${resultado.reactivatedCount} reativado(s), ${resultado.keptCount} mantido(s).`,
      );
      setCiclos((atuais) => atuais.map((item) => item.id === cicloId
        ? { ...item, participantCount: previa.matchedCount }
        : item));
      await calcularPrevia();
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro));
    } finally {
      setAplicando(false);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="público da avaliação"
      unidentifiedTitle="Não foi possível abrir a definição de público"
      restrictedTitle="Definição de público restrita"
      restrictedDescription="Seu perfil não possui permissão para definir o público de uma avaliação."
    />;
  }

  return <PlatformShell user={guard.user} eyebrow="Público e elegibilidade" title="Definir público">
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Breadcrumbs items={[
        { label: "Administração", href: "/admin" },
        { label: "Participantes", href: "/admin/participantes" },
        { label: "Definir público" },
      ]} />

      <PageHeader
        eyebrow="Etapa a etapa"
        title="Definir público da avaliação"
        description="Escolha a avaliação, monte o critério, confira quantas pessoas ele alcança e só então aplique. Nada é gravado antes da confirmação."
        actions={
          <Link
            href="/admin/participantes"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Vincular pessoa a pessoa
          </Link>
        }
      />

      {/* Etapa 1 — a avaliação */}
      <Surface className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">1. Avaliação</h2>
        {carregando ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Carregando ciclos...</p>
        ) : ciclos.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Nenhum ciclo disponível"
            description="Crie uma avaliação e um ciclo antes de definir o público."
          />
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-end">
            <Select
              label="Ciclo"
              value={cicloId}
              onChange={(evento) => selecionarCiclo(evento.target.value)}
            >
              <option value="">Selecione a avaliação</option>
              {ciclos.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
              ))}
            </Select>
            {cicloSelecionado && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <Badge variant="neutral">{cicloSelecionado.participantCount} no público atual</Badge>
                <Badge variant="neutral">{cicloSelecionado.completedCount} concluíram</Badge>
                <Badge variant="outline">{cicloSelecionado.accessMode === "RESTRICTED" ? "Acesso restrito" : "Acesso institucional"}</Badge>
              </div>
            )}
          </div>
        )}
      </Surface>

      {cicloId && <>
        {/* Etapa 2 — o critério */}
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">2. Critério</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Dentro de uma mesma dimensão os valores somam. Entre dimensões diferentes eles se cruzam —
                escolher <em>Cargo: Assessor</em> e <em>Unidade: Escritório A</em> alcança quem é as duas coisas.
              </p>
            </div>
          </div>

          {dimensoesIndisponiveis && (
            <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Rotina ainda não publicada neste ambiente.</strong>{" "}
                As opções por dimensão vêm de uma função do banco que só existe depois do deploy desta versão.
                Enquanto isso a tela não consegue montar critério — e mostrar dimensões vazias aqui seria pior,
                porque pareceria uma base sem dados.
              </span>
            </p>
          )}

          <div className="mt-4">
            <Checkbox
              label="Toda a instituição elegível"
              description="Alcança todas as pessoas ativas, ignorando os filtros abaixo. Marque só quando a avaliação for para todo mundo."
              checked={regra.allEligible ?? false}
              onChange={(evento) => alterarRegra({ ...regra, allEligible: evento.target.checked })}
            />
          </div>

          {!regra.allEligible && (
            <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {CHAVES_DE_DIMENSAO.map((dimensao) => {
                const opcoes = dimensoes[dimensao] ?? [];
                const escolhidos = regra.filters[dimensao] ?? [];
                return (
                  <section key={dimensao} className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{ROTULO_DA_DIMENSAO[dimensao]}</h3>
                      {escolhidos.length > 0 && <Badge variant="info">{escolhidos.length}</Badge>}
                    </div>
                    {opcoes.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">Sem valores registrados na base.</p>
                    ) : (
                      // Altura limitada: Coordenação tem mais de cem opções em
                      // produção, e uma lista dessa altura empurraria as outras
                      // dimensões para fora da tela.
                      <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                        {opcoes.map((opcao) => {
                          const marcado = escolhidos.includes(opcao.label);
                          return (
                            <li key={opcao.label}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-[var(--surface-hover)]">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => alternarValor(dimensao, opcao.label)}
                                  className="h-4 w-4 shrink-0 accent-[var(--brand-solid)]"
                                />
                                <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]" title={opcao.label}>{opcao.label}</span>
                                <span className="shrink-0 text-xs text-[var(--text-muted)]">{opcao.count}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => void calcularPrevia()} disabled={!temCriterio || calculando}>
              {calculando
                ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Calculando...</>
                : <><ListFilter className="h-4 w-4" aria-hidden="true" />Ver quem será alcançado</>}
            </Button>
            {!temCriterio && (
              <p className="text-sm text-[var(--text-secondary)]">
                Escolha ao menos um valor — critério em branco não seleciona ninguém.
              </p>
            )}
          </div>
        </Surface>

        {/* Etapa 3 — a prévia */}
        {previa && (
          <Surface className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">3. Prévia</h2>
            <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-[var(--text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Nada foi gravado. Estes números vêm da mesma regra que a aplicação vai usar.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Público encontrado" value={previa.matchedCount} description="já sem as pessoas excluídas" />
              <StatCard label="Vínculos novos" value={previa.newLinkCount} description="pessoas que ainda não estavam" />
              <StatCard label="Já vinculadas" value={previa.alreadyLinkedCount} description="permanecem como estão" />
              <StatCard label="Exclusões" value={previa.excludedCount} description="casaram com o critério e foram retiradas" />
            </div>

            {previa.ineligibleIncludedCount > 0 && (
              <p role="status" className="mt-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
                {previa.ineligibleIncludedCount} {previa.ineligibleIncludedCount === 1 ? "pessoa incluída não está" : "pessoas incluídas não estão"} ativa(s) na base e por isso não {previa.ineligibleIncludedCount === 1 ? "entra" : "entram"} no público.
              </p>
            )}

            {previa.matchedCount === 0 ? (
              <EmptyState
                className="mt-4"
                title="Nenhuma pessoa alcançada"
                description="O critério atual não encontra ninguém ativo na base. Revise as escolhas antes de aplicar."
              />
            ) : (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Amostra do público
                  <span className="ml-2 font-normal text-[var(--text-secondary)]">
                    {previa.sample.length} de {previa.matchedCount}
                  </span>
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[38rem] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[.08em] text-[var(--text-muted)]">
                        <th scope="col" className="py-2 pr-3 font-semibold">Pessoa</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Cargo</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Unidade</th>
                        <th scope="col" className="py-2 font-semibold">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.sample.map((pessoa) => (
                        <tr key={pessoa.personId} className="border-b border-[var(--border-subtle)] last:border-0">
                          <td className="py-2 pr-3 text-[var(--text-primary)]">{pessoa.fullName}</td>
                          <td className="py-2 pr-3 text-[var(--text-secondary)]">{pessoa.jobTitle ?? "—"}</td>
                          <td className="py-2 pr-3 text-[var(--text-secondary)]">{pessoa.unit ?? "—"}</td>
                          <td className="py-2">
                            {pessoa.alreadyLinked
                              ? <Badge variant="neutral">Já no público</Badge>
                              : <Badge variant="success">Entra agora</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Etapa 4 — a confirmação */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-5">
              <Button onClick={() => void confirmarAplicacao()} disabled={aplicando || previa.matchedCount === 0}>
                {aplicando
                  ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Aplicando...</>
                  : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Aplicar público</>}
              </Button>
              <p className="text-sm text-[var(--text-secondary)]">
                O público fica registrado como está agora e não muda sozinho se alguém trocar de cargo depois.
              </p>
            </div>
          </Surface>
        )}
      </>}

      {!cicloId && !carregando && ciclos.length > 0 && (
        <EmptyState
          title="Escolha uma avaliação"
          description="O critério e a prévia aparecem depois que você seleciona o ciclo."
          icon={<Users2 className="h-6 w-6" aria-hidden="true" />}
        />
      )}
    </div>
  </PlatformShell>;
}
