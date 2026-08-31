"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A jornada de configuração de uma avaliação.
 *
 * As cinco áreas já existiam, cada uma na sua rota, sem nada que dissesse que
 * pertencem ao mesmo trabalho. Depois de criar a avaliação, a pessoa caía no
 * construtor e a única navegação global era "Voltar ao catálogo" — que sugere
 * abandonar a configuração, não continuá-la.
 *
 * Este cabeçalho é a costura: mesmo lugar, mesma ordem e mesmo destaque nas
 * cinco telas. Ele responde três perguntas de uma vez — onde estou, o que já
 * configurei, e qual é o próximo passo.
 *
 * ## Por que etapas e não um assistente
 *
 * Assistente linear obrigaria a percorrer tudo na ordem e a recomeçar para
 * ajustar uma coisa só. Configuração de avaliação não é assim: quem já publicou
 * uma volta para trocar o período, ou só a capa. As etapas indicam ordem
 * sugerida sem impor caminho.
 */

export type EtapaDaConfiguracao = "estrutura" | "publico" | "ciclo" | "identidade" | "revisao";

type DefinicaoDeEtapa = {
  chave: EtapaDaConfiguracao;
  rotulo: string;
  /** Texto do botão que leva a esta etapa a partir da anterior. */
  chamada: string;
};

/**
 * A ordem sugerida.
 *
 * Estrutura antes de Público porque o instrumento define quem faz sentido
 * convidar. Ciclo antes de Identidade porque período é operação e capa é
 * apresentação — quem tem pressa precisa da primeira, não da segunda. Revisar
 * fecha, porque é onde as pendências das quatro anteriores aparecem juntas.
 */
export const ETAPAS_DA_CONFIGURACAO: DefinicaoDeEtapa[] = [
  { chave: "estrutura", rotulo: "Estrutura", chamada: "Montar a estrutura" },
  { chave: "publico", rotulo: "Público", chamada: "Definir público" },
  { chave: "ciclo", rotulo: "Ciclo", chamada: "Configurar ciclo" },
  { chave: "identidade", rotulo: "Identidade", chamada: "Ajustar identidade" },
  { chave: "revisao", rotulo: "Revisar e publicar", chamada: "Revisar e publicar" },
];

/**
 * Endereço de cada etapa.
 *
 * Público reaproveita `/admin/participantes` com o ciclo no endereço, em vez de
 * uma tela paralela: a Fase 1 já resolve filtro, cascata, prévia e aplicação, e
 * duplicá-la criaria duas respostas para a mesma pergunta.
 *
 * Ciclo e Revisar apontam para a **mesma** página de operação, com ênfases
 * diferentes. Ela já concentra período, avisos, checklist de pendências e as
 * ações de publicar e abrir — separar em duas rotas exigiria um segundo
 * mecanismo de publicação, que é justamente o que não se deve ter.
 */
export function enderecoDaEtapa(
  etapa: EtapaDaConfiguracao,
  surveyId: string,
  applicationId?: string | null,
) {
  switch (etapa) {
    case "estrutura":
      return `/admin/pesquisas/${surveyId}`;
    case "publico":
      // `pesquisa` viaja junto porque a tela de público conhece o ciclo, não a
      // avaliação — e sem ela a navegação de etapas não teria como voltar às
      // outras quatro. A alternativa seria a RPC de ciclos passar a devolver o
      // identificador da avaliação, o que é migration para resolver um problema
      // de endereço.
      return applicationId
        ? `/admin/participantes?ciclo=${encodeURIComponent(applicationId)}&pesquisa=${encodeURIComponent(surveyId)}`
        : "/admin/participantes";
    case "ciclo":
      return `/admin/pesquisas/${surveyId}/operacao`;
    case "identidade":
      return `/admin/pesquisas/${surveyId}/identidade`;
    case "revisao":
      return `/admin/pesquisas/${surveyId}/operacao?etapa=revisao`;
  }
}

/** A etapa seguinte na ordem sugerida, ou nula quando já é a última. */
export function proximaEtapa(atual: EtapaDaConfiguracao) {
  const indice = ETAPAS_DA_CONFIGURACAO.findIndex((item) => item.chave === atual);
  return ETAPAS_DA_CONFIGURACAO[indice + 1] ?? null;
}

type CabecalhoProps = {
  surveyId: string;
  applicationId?: string | null;
  /** Nome da avaliação. Ausente enquanto carrega. */
  nome?: string | null;
  etapa: EtapaDaConfiguracao;
  /**
   * Linha de contexto: estado, contagens, prazo. Partes curtas, separadas por
   * ponto médio — "Rascunho · 1 seção · 7 perguntas". Frase, não cartões.
   */
  meta?: (string | null | undefined)[];
  /** Ação principal da etapa, à direita do cabeçalho. */
  acao?: ReactNode;
};

/**
 * Cabeçalho compacto e navegação de etapas.
 *
 * O que substituiu: um cartão de 3xl com ícone decorativo, título "Studio de
 * avaliação", parágrafo explicativo e uma faixa de três indicadores — ocupando
 * a maior parte da primeira dobra para dizer em que tela a pessoa já sabia
 * estar. O conteúdo que importa, a estrutura da avaliação, começava abaixo de
 * tudo isso.
 *
 * Aqui o nome da avaliação é o título, o estado e as contagens cabem numa linha
 * de texto, e a navegação vem logo abaixo. Cor só para estado e ação.
 */
export function CabecalhoDaConfiguracao({
  surveyId,
  applicationId,
  nome,
  etapa,
  meta,
  acao,
}: CabecalhoProps) {
  const partes = (meta ?? []).filter(Boolean) as string[];

  return (
    <header className="border-b border-[var(--border-subtle)] pb-4">
      {/*
        Trilha em vez de um botão isolado de voltar. "Voltar ao catálogo"
        continua a um clique, mas deixa de ser a única navegação global — era o
        que fazia a saída parecer o próximo passo.
      */}
      <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Link href="/admin/pesquisas" className="rounded transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          Avaliações
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate text-[var(--text-secondary)]">{nome ?? "Carregando..."}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {nome ?? "Configuração da avaliação"}
          </h2>
          {partes.length > 0 && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {partes.join(" · ")}
            </p>
          )}
        </div>
        {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
      </div>

      <NavegacaoDasEtapas surveyId={surveyId} applicationId={applicationId} etapa={etapa} />
    </header>
  );
}

function NavegacaoDasEtapas({
  surveyId,
  applicationId,
  etapa,
}: {
  surveyId: string;
  applicationId?: string | null;
  etapa: EtapaDaConfiguracao;
}) {
  return (
    /*
      Rola na horizontal no celular em vez de quebrar em duas linhas: cinco
      etapas empilhadas viram uma lista, e lista não comunica sequência.
      `-mb-px` encaixa a borda ativa exatamente sobre a borda do cabeçalho.
    */
    <nav aria-label="Etapas da configuração" className="-mb-4 mt-4 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {ETAPAS_DA_CONFIGURACAO.map((item) => {
          const atual = item.chave === etapa;
          return (
            <li key={item.chave}>
              <Link
                href={enderecoDaEtapa(item.chave, surveyId, applicationId)}
                aria-current={atual ? "page" : undefined}
                // `whitespace-nowrap` porque sem ele "Revisar e publicar"
                // quebrava em duas linhas no celular e desalinhava a régua de
                // etapas — a rolagem horizontal existe justamente para isso.
                className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  atual
                    ? "border-[var(--brand-primary)] font-semibold text-[var(--brand-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Botão que leva à etapa seguinte.
 *
 * É a resposta a "e agora?" — a pergunta que a tela não respondia. Fica ausente
 * na última etapa, onde o próximo passo é publicar, e essa ação já é da própria
 * página com as regras dela.
 */
export function BotaoProximaEtapa({
  etapa,
  surveyId,
  applicationId,
}: {
  etapa: EtapaDaConfiguracao;
  surveyId: string;
  applicationId?: string | null;
}) {
  const proxima = proximaEtapa(etapa);
  if (!proxima) return null;

  return (
    <Link
      href={enderecoDaEtapa(proxima.chave, surveyId, applicationId)}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] transition-colors hover:bg-[var(--brand-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
    >
      Continuar: {proxima.chamada.toLowerCase()}
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
