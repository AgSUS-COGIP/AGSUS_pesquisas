"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Surface } from "@/components/ui/surface";
import { listarParticipantesDoPainel } from "@/lib/api/cliente-paineis";
import {
  DIMENSOES_DE_FILTRO,
  FILTROS_VAZIOS,
  ROTULO_DA_SITUACAO,
  SITUACOES_DE_PARTICIPANTE,
  escreverFiltrosNaUrl,
  lerFiltrosDaUrl,
  temFiltroAtivo,
  type DimensaoDeFiltro,
  type FiltrosDeParticipantes,
  type SituacaoDeParticipante,
} from "@/lib/filtros-de-participantes";
import { VARIANTE_DE_BADGE, type TomSemantico } from "@/lib/tom-semantico";

/**
 * Quem respondeu, quem falta, e onde a pendência está concentrada.
 *
 * O painel respondia "quantos" e nunca "quem" — e é "quem" que permite operar
 * o ciclo: cobrar quem não começou, descobrir que a pendência inteira é de uma
 * unidade só.
 *
 * ## O que esta lista deliberadamente não faz
 *
 * Não mostra resposta, nem liga pessoa a resposta. Isso não é contenção de
 * escrita: a RPC por trás lê apenas `application_participants` e `people`, e o
 * anonimato do produto é estrutural — em ciclo anônimo a submissão nasce sem
 * `participant_id` e sem `respondent_person_id`. Acompanhar participação e ler
 * resposta são leituras que o banco mantém separadas, e esta tela fica do lado
 * seguro da separação.
 */

type Participante = {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string | null;
  unit: string | null;
  directorate: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};

type Resposta = {
  total: number;
  pagina: number;
  tamanho: number;
  participantes: Participante[];
  dimensoes: Record<DimensaoDeFiltro, string[]>;
};

const ROTULO_DA_DIMENSAO: Record<DimensaoDeFiltro, string> = {
  directorate: "Diretoria",
  unit: "Unidade",
  coordination: "Coordenação",
  costCenter: "Centro de custo",
  jobTitle: "Cargo",
};

/*
  A situação usa a mesma gramática de cor do resto do produto: âmbar para o que
  pede ação, ciano para o que está em curso, verde para o que terminou, neutro
  para o que saiu de cena. Cor nunca sozinha — o rótulo diz o mesmo.
*/
const TOM_DA_SITUACAO: Record<SituacaoDeParticipante, TomSemantico> = {
  ELIGIBLE: "warning",
  INVITED: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  BLOCKED: "danger",
  EXCLUDED: "neutral",
};

const TAMANHO_DA_PAGINA = 25;

function formatarData(valor: string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
}

export function ListaDeParticipantes({ applicationCode }: { applicationCode: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /*
    A URL é a fonte, e não uma cópia do estado.

    O componente não guarda o recorte em `useState`: ele o **deriva** da query
    string a cada render. Assim recarregar, voltar pelo navegador e colar o
    endereço para outra pessoa mostram exatamente a mesma lista — e, quando a
    exportação chegar, ela parte do mesmo lugar que a tela.

    Guardar em estado e só espelhar na URL cria duas verdades que divergem no
    primeiro botão "voltar".
  */
  const filtros = useMemo(
    () => lerFiltrosDaUrl(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const pagina = Math.max(1, Number.parseInt(searchParams.get("pagina") ?? "1", 10) || 1);

  /*
    A busca é a única exceção, e por um motivo: é campo de digitação. Escrever
    na URL a cada tecla encheria o histórico de entradas intermediárias e faria
    o botão "voltar" percorrer letra por letra. O texto vive em estado local até
    o envio; o recorte aplicado continua sendo o da URL.
  */
  const [buscaDigitada, setBuscaDigitada] = useState(filtros.busca);

  const parametros = useMemo(() => {
    const query = escreverFiltrosNaUrl(filtros);
    query.set("pagina", String(pagina));
    query.set("tamanho", String(TAMANHO_DA_PAGINA));
    return query;
  }, [filtros, pagina]);

  /*
    `replace`, não `push`: ajustar um filtro não é navegar. Com `push`, sair da
    tela exigiria um "voltar" para cada clique dado num chip.

    `scroll: false` porque o recorte muda uma tabela no meio da página — subir
    ao topo faria a pessoa perder de vista o que acabou de mudar.
  */
  function navegar(novosFiltros: FiltrosDeParticipantes, novaPagina: number) {
    const query = escreverFiltrosNaUrl(novosFiltros);
    if (novaPagina > 1) query.set("pagina", String(novaPagina));
    const busca = query.toString();
    router.replace(busca ? `${pathname}?${busca}` : pathname, { scroll: false });
  }

  const consulta = useQuery({
    // A chave inclui o recorte inteiro: trocar de filtro é outra consulta, não
    // a mesma com outro resultado.
    queryKey: ["painel-participantes", applicationCode, parametros.toString()],
    queryFn: () => listarParticipantesDoPainel(applicationCode, parametros) as Promise<Resposta>,
    staleTime: 30_000,
  });

  const dados = consulta.data;
  const totalDePaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanho)) : 1;

  /** Qualquer mudança de recorte volta para a primeira página. */
  function aplicar(novos: FiltrosDeParticipantes) {
    navegar(novos, 1);
  }

  function alternarValor(dimensao: DimensaoDeFiltro, valor: string) {
    const atuais = filtros[dimensao];
    aplicar({
      ...filtros,
      [dimensao]: atuais.includes(valor) ? atuais.filter((item) => item !== valor) : [...atuais, valor],
    });
  }

  function alternarSituacao(situacao: SituacaoDeParticipante) {
    const atuais = filtros.situacao;
    aplicar({
      ...filtros,
      situacao: atuais.includes(situacao) ? atuais.filter((item) => item !== situacao) : [...atuais, situacao],
    });
  }

  return (
    <Surface className="mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Acompanhamento</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Participantes</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Situação de cada pessoa neste ciclo. Não mostra respostas.
          </p>
        </div>
        {dados ? (
          <Badge variant="neutral">
            {temFiltroAtivo(filtros) ? `${dados.total} no recorte` : `${dados.total} no total`}
          </Badge>
        ) : null}
      </div>

      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          aplicar({ ...filtros, busca: buscaDigitada });
        }}
      >
        {/*
          `w-full` abaixo de `sm`, e só então `flex-1`.

          Com `flex-1` desde o início, o campo dividia a linha com "Buscar" e
          "Limpar filtros": a 375 px sobravam 85 px para ele, e o placeholder
          "Nome, matrícula, e-mail ou cargo" aparecia cortado em "No".

          Ocupando a linha inteira, o `flex-wrap` do formulário já leva os
          botões para baixo sozinho — não é preciso mexer no contêiner.
        */}
        <label className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-1">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Buscar pessoa</span>
          <span className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
            <input
              type="search"
              value={buscaDigitada}
              onChange={(evento) => setBuscaDigitada(evento.target.value)}
              placeholder="Nome, matrícula, e-mail ou cargo"
              className="min-h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </span>
        </label>
        <Button type="submit" variant="secondary">Buscar</Button>
        {temFiltroAtivo(filtros) ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBuscaDigitada("");
              aplicar(FILTROS_VAZIOS);
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </form>

      <fieldset className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <legend className="sr-only">Filtrar por situação</legend>
        <p className="text-xs font-medium text-[var(--text-secondary)]">Situação</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SITUACOES_DE_PARTICIPANTE.map((situacao) => {
            const ativo = filtros.situacao.includes(situacao);
            return (
              <button
                key={situacao}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarSituacao(situacao)}
                className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  ativo
                    ? "border-[var(--brand-primary)] bg-[var(--control-active)] text-[var(--brand-primary)]"
                    : "border-transparent bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {ROTULO_DA_SITUACAO[situacao]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {dados?.dimensoes
        ? DIMENSOES_DE_FILTRO.filter((dimensao) => (dados.dimensoes[dimensao] ?? []).length > 1).map((dimensao) => (
            <fieldset key={dimensao} className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <legend className="sr-only">Filtrar por {ROTULO_DA_DIMENSAO[dimensao]}</legend>
              <p className="text-xs font-medium text-[var(--text-secondary)]">{ROTULO_DA_DIMENSAO[dimensao]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dados.dimensoes[dimensao].map((valor) => {
                  const ativo = filtros[dimensao].includes(valor);
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternarValor(dimensao, valor)}
                      className={`inline-flex min-h-9 max-w-full items-center truncate rounded-md border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                        ativo
                          ? "border-[var(--brand-primary)] bg-[var(--control-active)] text-[var(--brand-primary)]"
                          : "border-transparent bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {valor}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))
        : null}

      {consulta.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando participantes…
        </p>
      ) : consulta.isError ? (
        <EmptyState
          className="mt-6"
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          title="Não foi possível carregar os participantes"
          description={consulta.error instanceof Error ? consulta.error.message : "Tente novamente em instantes."}
          action={<Button variant="secondary" onClick={() => void consulta.refetch()}>Tentar novamente</Button>}
        />
      ) : !dados?.participantes.length ? (
        <EmptyState
          className="mt-6"
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          title={temFiltroAtivo(filtros) ? "Nenhuma pessoa neste recorte" : "Nenhum participante vinculado"}
          description={
            temFiltroAtivo(filtros)
              ? "Ajuste ou limpe os filtros para ver outras pessoas."
              : "Defina o público deste ciclo para acompanhar as respostas."
          }
        />
      ) : (
        <>
          {/* A tabela rola sozinha: a página nunca rola na horizontal. */}
          <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  {["Pessoa", "Cargo", "Unidade", "Situação", "Início", "Envio"].map((coluna) => (
                    <th
                      key={coluna}
                      scope="col"
                      className="border-b border-[var(--border-strong)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[.08em] text-[var(--text-secondary)]"
                    >
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.participantes.map((pessoa) => (
                  <tr key={pessoa.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-3 align-top">
                      <strong className="block font-semibold text-[var(--text-primary)]">{pessoa.fullName}</strong>
                      <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{pessoa.employeeNumber}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--text-secondary)]">{pessoa.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3 align-top text-[var(--text-secondary)]">{pessoa.unit ?? "—"}</td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={VARIANTE_DE_BADGE[TOM_DA_SITUACAO[pessoa.status as SituacaoDeParticipante] ?? "neutral"]}>
                        {ROTULO_DA_SITUACAO[pessoa.status as SituacaoDeParticipante] ?? pessoa.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top tabular-nums text-[var(--text-secondary)]">{formatarData(pessoa.startedAt)}</td>
                    <td className="px-4 py-3 align-top tabular-nums text-[var(--text-secondary)]">{formatarData(pessoa.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
              Página {dados.pagina} de {totalDePaginas} · {dados.total} {dados.total === 1 ? "pessoa" : "pessoas"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={dados.pagina <= 1}
                onClick={() => navegar(filtros, Math.max(1, pagina - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={dados.pagina >= totalDePaginas}
                onClick={() => navegar(filtros, pagina + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}
