"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Hourglass, Info, ListFilter, Search, UserMinus, UserPlus, Users2, X } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PeopleBaseSummaryCard } from "@/components/people-base-summary";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { Breadcrumbs } from "@/components/ui/page-navigation";
import { PageHeader, StatCard, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { listarCiclosDeParticipantes } from "@/lib/api/cliente-pessoas";
import { aplicarPublico, buscarPessoasDoPublico, obterDimensoesDoPublico, previsualizarPublico } from "@/lib/api/cliente-publico";
import {
  CHAVES_DE_DIMENSAO,
  ROTULO_DA_DIMENSAO,
  regraTemCriterio,
  regraVazia,
  type ChaveDeDimensao,
  type DimensoesDoPublico,
  type PessoaEncontrada,
  type PreviaDoPublico,
  type RegraDePublico,
} from "@/lib/api/contratos-publico";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";
import { ErroDeApi } from "@/lib/api/requisicao";
import { errorMessageFromUnknown } from "@/lib/observability";

/**
 * Definir público da avaliação.
 *
 * Substitui o vinculador antigo, que ficava aqui. Por um tempo as duas telas
 * conviveram e a divisão parecia defensável — uma para somar uma pessoa, outra
 * para critério institucional. Não era: depois que esta ganhou busca de pessoa,
 * passou a fazer tudo o que a outra fazia, e mais.
 *
 * O problema não era só redundância. As duas discordavam sobre quem é elegível
 * — a antiga exigia `employment_status = 'ATIVO'`, esta usa `people.active` —,
 * então respondiam com conjuntos de pessoas diferentes à mesma pergunta. Duas
 * portas para o mesmo lugar já é ruim; duas portas que levam a lugares
 * ligeiramente diferentes é como se perde a confiança no número da tela.
 *
 * Continua havendo `/admin/participantes/todos`, que é outra coisa: conferir,
 * bloquear e remover quem já está vinculado.
 */
export default function AdminParticipantsPage() {
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
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [resultados, setResultados] = useState<PessoaEncontrada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  // Nome de cada pessoa escolhida, guardado no momento da escolha. As listas da
  // regra carregam identificadores, e mostrar UUID a quem opera não é opção.
  const [nomesDePessoas, setNomesDePessoas] = useState<Record<string, string>>({});
  // Marcação da busca atual. Some quando os resultados mudam: manter marcada
  // uma pessoa que saiu da lista faria a ação em lote agir no invisível.
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  const cicloSelecionado = useMemo(
    () => ciclos.find((item) => item.id === cicloId) ?? null,
    [ciclos, cicloId],
  );
  const temCriterio = regraTemCriterio(regra);
  const todasMarcadas = resultados.length > 0 && resultados.every((pessoa) => marcadas.has(pessoa.personId));

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
    // O seletor de pessoas também zera: nomes escolhidos para um ciclo não
    // devem reaparecer como se pertencessem ao seguinte.
    setBuscaPessoa("");
    setResultados([]);
    setBuscou(false);
    setMarcadas(new Set());
    setNomesDePessoas({});
  }

  // Qualquer mudança na regra invalida a prévia: número velho ao lado de
  // critério novo é a forma mais fácil de alguém confirmar o que não conferiu.
  function alterarRegra(proxima: RegraDePublico) {
    setRegra(proxima);
    setPrevia(null);
  }

  async function buscarPessoas() {
    if (!cicloId) return;
    setBuscando(true);
    try {
      const resposta = await buscarPessoasDoPublico(cicloId, buscaPessoa);
      setResultados(resposta.people ?? []);
      setMarcadas(new Set());
      setBuscou(true);
    } catch (erro) {
      toast.error(errorMessageFromUnknown(erro));
    } finally {
      setBuscando(false);
    }
  }

  function alternarMarcada(pessoa: PessoaEncontrada) {
    setNomesDePessoas((mapa) => ({ ...mapa, [pessoa.personId]: pessoa.fullName }));
    setMarcadas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(pessoa.personId)) proximas.delete(pessoa.personId);
      else proximas.add(pessoa.personId);
      return proximas;
    });
  }

  function alternarTodasMarcadas() {
    if (todasMarcadas) {
      setMarcadas(new Set());
      return;
    }
    setNomesDePessoas((mapa) => ({
      ...mapa,
      ...Object.fromEntries(resultados.map((pessoa) => [pessoa.personId, pessoa.fullName])),
    }));
    setMarcadas(new Set(resultados.map((pessoa) => pessoa.personId)));
  }

  /**
   * Move as pessoas marcadas para uma das listas.
   *
   * Incluir e excluir são mutuamente exclusivos: pôr alguém nas duas listas
   * significaria pedir e desfazer o mesmo pedido, e a exclusão venceria em
   * silêncio. Entrar numa lista remove da outra.
   *
   * A marcação é limpa depois de aplicar — deixá-la de pé faria o próximo
   * clique agir de novo sobre as mesmas pessoas sem que ninguém pedisse.
   */
  function aplicarEmLote(chave: "includePersonIds" | "excludePersonIds") {
    if (marcadas.size === 0) return;
    const oposta = chave === "includePersonIds" ? "excludePersonIds" : "includePersonIds";
    const escolhidas = Array.from(marcadas);
    const atuais = regra[chave] ?? [];

    alterarRegra({
      ...regra,
      [chave]: Array.from(new Set([...atuais, ...escolhidas])),
      [oposta]: (regra[oposta] ?? []).filter((id) => !marcadas.has(id)),
    });
    setMarcadas(new Set());
  }

  function removerPessoa(chave: "includePersonIds" | "excludePersonIds", id: string) {
    alterarRegra({ ...regra, [chave]: (regra[chave] ?? []).filter((item) => item !== id) });
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

    // A confirmação precisa dizer o que sai, não só o que entra. Confirmar uma
    // troca de critério sem saber que 30 pessoas deixam o público é confirmar
    // outra operação.
    const saida = previa.removedCount > 0
      ? ` ${previa.removedCount} ${previa.removedCount === 1 ? "pessoa sai" : "pessoas saem"} do público.`
      : "";
    const confirmado = await confirm({
      title: "Aplicar o público?",
      description:
        `"${cicloSelecionado.name}" fica com ${previa.effectiveCount} ${previa.effectiveCount === 1 ? "pessoa" : "pessoas"}. ` +
        `${previa.newLinkCount} ${previa.newLinkCount === 1 ? "entra agora" : "entram agora"}.${saida}`,
      confirmLabel: "Aplicar público",
      tone: previa.removedCount > 0 ? "danger" : "primary",
      showReviewNotice: false,
    });
    if (!confirmado) return;

    setAplicando(true);
    try {
      const resultado = await aplicarPublico(cicloId, regra);
      toast.success(
        `Público aplicado: ${resultado.effectiveCount} no total — ${resultado.assignedCount} novo(s), ${resultado.keptCount} mantido(s), ${resultado.removedCount} fora.`,
      );
      // Recarrega do servidor em vez de atualizar o número em memória.
      // `participantCount` da listagem e `effectiveCount` da prévia contam
      // coisas diferentes — a listagem inclui quem está bloqueado, a prévia
      // não. Escrever um no lugar do outro faria o número mudar sozinho no
      // próximo carregamento da página, sem nada ter acontecido.
      setCiclos(await listarCiclosDeParticipantes());
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

  return <PlatformShell user={guard.user} eyebrow="Público e elegibilidade" title="Participantes">
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <Breadcrumbs items={[{ label: "Administração", href: "/admin" }, { label: "Participantes" }]} />

      <PageHeader
        eyebrow="Gestão por avaliação"
        title="Defina quem pode responder"
        description="Escolha a avaliação, monte o critério, confira quantas pessoas ele alcança e só então aplique. Nada é gravado antes da confirmação."
        actions={
          <Link
            href="/admin/participantes/todos"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            <Users2 className="h-4 w-4" aria-hidden="true" />
            Ver público vinculado
          </Link>
        }
      />

      {/* Contexto da base institucional. Estava na tela antiga e continua útil:
          diz de quantas pessoas o critério parte antes de qualquer filtro. */}
      <PeopleBaseSummaryCard />

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

          {/*
            Pessoa é a sexta dimensão, e não cabe numa lista de opções: são
            1.030 nomes. Aqui ela é busca, e cada resultado tem as duas ações
            possíveis — somar ao público ou tirá-lo dele.

            Vale para quando o filtro não alcança alguém que precisa responder, e
            para o contrário: alguém que o filtro alcançou mas não deve entrar.
          */}
          <section className="mt-6 rounded-xl border border-[var(--border-subtle)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pessoa</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Inclusões somam ao que os filtros alcançaram. Exclusões prevalecem sobre tudo.
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Input
                label="Buscar por nome, matrícula, e-mail ou cargo"
                value={buscaPessoa}
                onChange={(evento) => setBuscaPessoa(evento.target.value)}
                onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); void buscarPessoas(); } }}
                containerClassName="min-w-0 flex-1 basis-72"
                placeholder="Ex.: Maria, 12345, Assessor"
              />
              {/* Mesma causa do aviso acima: a busca é outra função da mesma
                  migration. Oferecer um botão que só sabe falhar é pior do que
                  desabilitá-lo. */}
              <Button variant="secondary" onClick={() => void buscarPessoas()} disabled={buscando || dimensoesIndisponiveis}>
                {buscando
                  ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Buscando...</>
                  : <><Search className="h-4 w-4" aria-hidden="true" />Buscar</>}
              </Button>
            </div>

            {resultados.length > 0 && (
              <>
                {/*
                  Marcar e agir em bloco, em vez de um botão por linha. Buscar
                  "assessor" traz dezenas de pessoas, e incluir uma a uma seria
                  o mesmo trabalho manual que esta tela existe para eliminar.

                  A ação fica acima da lista e não dentro dela: com a lista
                  rolando, um rodapé de ações sairia de vista justamente quando
                  a seleção fica grande.
                */}
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2">
                  <label className="flex cursor-pointer items-center gap-2 px-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={todasMarcadas}
                      // Estado intermediário quando parte está marcada: sem ele
                      // a caixa mostraria "nada marcado" com metade selecionada.
                      ref={(elemento) => { if (elemento) elemento.indeterminate = marcadas.size > 0 && !todasMarcadas; }}
                      onChange={alternarTodasMarcadas}
                      className="h-4 w-4 accent-[var(--brand-solid)]"
                    />
                    {marcadas.size > 0 ? `${marcadas.size} selecionada(s)` : "Selecionar todas"}
                  </label>
                  <span className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => aplicarEmLote("includePersonIds")} disabled={marcadas.size === 0}>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      Incluir selecionadas
                    </Button>
                    <Button variant="secondary" onClick={() => aplicarEmLote("excludePersonIds")} disabled={marcadas.size === 0}>
                      <UserMinus className="h-4 w-4" aria-hidden="true" />
                      Excluir selecionadas
                    </Button>
                  </span>
                </div>

                <ul className="mt-2 max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
                  {resultados.map((pessoa) => {
                    const incluida = (regra.includePersonIds ?? []).includes(pessoa.personId);
                    const excluida = (regra.excludePersonIds ?? []).includes(pessoa.personId);
                    return (
                      <li key={pessoa.personId}>
                        <label className="flex cursor-pointer items-center gap-3 p-3 transition hover:bg-[var(--surface-hover)]">
                          <input
                            type="checkbox"
                            checked={marcadas.has(pessoa.personId)}
                            onChange={() => alternarMarcada(pessoa)}
                            className="h-4 w-4 shrink-0 accent-[var(--brand-solid)]"
                          />
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-semibold text-[var(--text-primary)]">{pessoa.fullName}</strong>
                            <small className="block truncate text-xs text-[var(--text-secondary)]">
                              {[pessoa.employeeNumber, pessoa.jobTitle, pessoa.unit].filter(Boolean).join(" · ")}
                            </small>
                          </span>
                          {/* Só o estado atual. As ações vivem no bloco acima —
                              dois caminhos para a mesma coisa na mesma linha é
                              como a tela vira adivinhação. */}
                          {incluida && <Badge variant="success" className="shrink-0">Incluída</Badge>}
                          {excluida && <Badge variant="danger" className="shrink-0">Excluída</Badge>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {buscou && resultados.length === 0 && (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Nenhuma pessoa ativa encontrada para esse termo.
              </p>
            )}

            {/* As escolhas ficam visíveis mesmo depois de a busca ser limpa —
                senão a regra teria efeito sem que nada na tela o mostrasse. */}
            {[
              { chave: "includePersonIds" as const, titulo: "Incluídas", tom: "success" as const },
              { chave: "excludePersonIds" as const, titulo: "Excluídas", tom: "danger" as const },
            ].map(({ chave, titulo, tom }) => {
              const ids = regra[chave] ?? [];
              if (ids.length === 0) return null;
              return (
                <div key={chave} className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-muted)]">{titulo} ({ids.length})</h4>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {ids.map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => removerPessoa(chave, id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                        >
                          <Badge variant={tom} className="px-1.5 py-0 text-[10px]">{titulo === "Incluídas" ? "+" : "−"}</Badge>
                          {nomesDePessoas[id] ?? id.slice(0, 8)}
                          <X className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">Remover {nomesDePessoas[id] ?? "pessoa"} da lista de {titulo.toLowerCase()}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

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
              {/* O total em destaque é o efetivo, não o alcance do critério: é
                  ele que descreve como o público fica depois de aplicar. */}
              <StatCard label="Público depois de aplicar" value={previa.effectiveCount} description={`o critério alcança ${previa.matchedCount}`} />
              <StatCard label="Vínculos novos" value={previa.newLinkCount} description="pessoas que ainda não estavam" />
              <StatCard label="Mantidas" value={previa.keptCount} description="já estavam e continuam" />
              <StatCard label="Saem do público" value={previa.removedCount} description="deixaram de casar com o critério" />
            </div>

            {/* Os avisos só aparecem quando têm o que dizer. Cartão de zero é
                ruído que ensina a ignorar a área inteira. */}
            {previa.removedCount > 0 && (
              <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">Aplicar substitui o público, não soma ao anterior.</strong>{" "}
                  {previa.removedCount} {previa.removedCount === 1 ? "pessoa sai" : "pessoas saem"} porque o critério novo não {previa.removedCount === 1 ? "a alcança" : "as alcança"}.
                  O vínculo e o histórico continuam registrados — ninguém é apagado.
                </span>
              </p>
            )}

            {previa.retainedWithProgressCount > 0 && (
              <p role="status" className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {previa.retainedWithProgressCount} {previa.retainedWithProgressCount === 1 ? "pessoa permanece" : "pessoas permanecem"} no público mesmo sem casar com o critério, por já {previa.retainedWithProgressCount === 1 ? "ter começado ou concluído" : "terem começado ou concluído"} a avaliação. Trabalho feito não é desfeito por mudança de critério.
                </span>
              </p>
            )}

            {previa.blockedKeptCount > 0 && (
              <p role="status" className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {previa.blockedKeptCount} {previa.blockedKeptCount === 1 ? "pessoa casa" : "pessoas casam"} com o critério mas {previa.blockedKeptCount === 1 ? "segue bloqueada" : "seguem bloqueadas"} por decisão administrativa, e {previa.blockedKeptCount === 1 ? "continua" : "continuam"} assim. Para liberar, use a gestão do público vinculado.
                </span>
              </p>
            )}

            {previa.ineligibleIncludedCount > 0 && (
              <p role="status" className="mt-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
                {previa.ineligibleIncludedCount} {previa.ineligibleIncludedCount === 1 ? "pessoa incluída não está" : "pessoas incluídas não estão"} ativa(s) na base e por isso não {previa.ineligibleIncludedCount === 1 ? "entra" : "entram"} no público.
              </p>
            )}

            {previa.effectiveCount === 0 ? (
              <EmptyState
                className="mt-4"
                title="Nenhuma pessoa alcançada"
                description="O critério atual não deixa ninguém no público. Revise as escolhas antes de aplicar."
              />
            ) : (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Amostra do público
                  <span className="ml-2 font-normal text-[var(--text-secondary)]">
                    {previa.sample.length} de {previa.effectiveCount}
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
              <Button onClick={() => void confirmarAplicacao()} disabled={aplicando || previa.effectiveCount === 0}>
                {aplicando
                  ? <><Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" />Aplicando...</>
                  : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Aplicar público</>}
              </Button>
              <p className="text-sm text-[var(--text-secondary)]">
                O público fica registrado como está agora e não muda sozinho se alguém trocar de cargo depois. Aplicar de novo substitui o público pelo critério vigente.
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
