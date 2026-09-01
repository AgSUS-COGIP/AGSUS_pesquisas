import { describe, expect, it } from "vitest";
import {
  FILTROS_CDDI_VAZIOS,
  aoClicarNoKpi,
  atendeFiltros,
  estadoAoTrocarCiclo,
  kpiClicavel,
  opcoesDaDimensao,
  reconciliarFiltros,
  situacoesDisponiveis,
  temRecorteAtivo,
  type FiltrosCddi,
  type PessoaFiltravel,
} from "./filtros-cddi";

/*
 * O que estes testes protegem.
 *
 * O defeito que motivou este módulo não era um filtro que não funciona: era um
 * filtro que **continua funcionando depois de sumir da tela**. Trocar a
 * diretoria tirava a unidade antiga da lista de opções, mas não do estado, e o
 * painel passava a mostrar números que nenhum filtro visível explicava.
 *
 * Por isso o foco aqui são as **transições**, e não os estados isolados: o que
 * quebra é a passagem de um recorte para outro.
 */

function pessoa(parcial: Partial<PessoaFiltravel> & { personId: string }): PessoaFiltravel {
  return {
    directorate: "DIR A",
    unit: "UNIDADE X",
    coordination: "COORD 1",
    managerName: "Chefe Um",
    autoCompleted: false,
    leaderCompleted: false,
    ...parcial,
  };
}

/*
  Base pequena e deliberada: a unidade X só existe na diretoria A, e a Y só na
  B. É o que torna a troca de diretoria uma transição de verdade.
*/
const base: PessoaFiltravel[] = [
  pessoa({ personId: "p1", directorate: "DIR A", unit: "UNIDADE X", coordination: "COORD 1", managerName: "Chefe Um", autoCompleted: true, leaderCompleted: true }),
  pessoa({ personId: "p2", directorate: "DIR A", unit: "UNIDADE X", coordination: "COORD 2", managerName: "Chefe Dois", autoCompleted: true }),
  pessoa({ personId: "p3", directorate: "DIR B", unit: "UNIDADE Y", coordination: "COORD 3", managerName: "Chefe Tres" }),
  pessoa({ personId: "p4", directorate: "DIR B", unit: "UNIDADE Y", coordination: "COORD 3", managerName: null }),
];

function filtros(parcial: Partial<FiltrosCddi>): FiltrosCddi {
  return { ...FILTROS_CDDI_VAZIOS, ...parcial };
}

describe("opções facetadas", () => {
  it("uma dimensão não restringe a si mesma", () => {
    // Sem isso, escolher uma unidade apagaria as outras da lista e marcar a
    // segunda seria impossível.
    const comUnidade = filtros({ units: ["UNIDADE X"] });

    expect(opcoesDaDimensao(base, comUnidade, "unit")).toEqual(["UNIDADE X", "UNIDADE Y"]);
  });

  it("as demais dimensões restringem", () => {
    const comDiretoria = filtros({ directorates: ["DIR A"] });

    expect(opcoesDaDimensao(base, comDiretoria, "unit")).toEqual(["UNIDADE X"]);
    expect(opcoesDaDimensao(base, comDiretoria, "coordination")).toEqual(["COORD 1", "COORD 2"]);
  });

  it("quem não tem chefia não aparece entre as chefias", () => {
    expect(opcoesDaDimensao(base, FILTROS_CDDI_VAZIOS, "manager")).toEqual(["Chefe Dois", "Chefe Tres", "Chefe Um"]);
  });

  it("as situações disponíveis incluem a ausência de chefia", () => {
    const disponiveis = situacoesDisponiveis(base, FILTROS_CDDI_VAZIOS);

    expect(disponiveis.has("COMPLETE")).toBe(true);
    expect(disponiveis.has("AWAITING_LEADER")).toBe(true);
    expect(disponiveis.has("PENDING")).toBe(true);
    expect(disponiveis.has("NO_MANAGER")).toBe(true);
  });
});

describe("transição — a dimensão alterada é autoritativa", () => {
  it("Diretoria A + Unidade X → trocar para Diretoria B remove a unidade", () => {
    // O caso exato do relato. A diretoria nova precisa sobreviver, e a unidade
    // antiga precisa sair do **estado**, não só da lista.
    const antes = filtros({ directorates: ["DIR A"], units: ["UNIDADE X"] });
    const depois = reconciliarFiltros(base, { ...antes, directorates: ["DIR B"] }, "directorate");

    expect(depois.directorates).toEqual(["DIR B"]);
    expect(depois.units).toEqual([]);
  });

  it("o inverso: trocar a unidade remove a diretoria incompatível", () => {
    const antes = filtros({ directorates: ["DIR A"], units: ["UNIDADE X"] });
    const depois = reconciliarFiltros(base, { ...antes, units: ["UNIDADE Y"] }, "unit");

    expect(depois.units).toEqual(["UNIDADE Y"]);
    expect(depois.directorates).toEqual([]);
  });

  it("nunca reduz a dimensão que o usuário acabou de mexer", () => {
    // Um algoritmo simétrico poderia resolver o conflito descartando a escolha
    // nova — e a pessoa veria a própria ação ser desfeita.
    const conflito = filtros({ directorates: ["DIR B"], units: ["UNIDADE X"], coordinations: ["COORD 1"] });
    const depois = reconciliarFiltros(base, conflito, "directorate");

    expect(depois.directorates).toEqual(["DIR B"]);
  });

  it("propaga em cadeia: unidade → coordenação → chefia → participante", () => {
    // Uma passagem só não estabiliza: descartar a unidade deixa a coordenação
    // órfã, que deixa a chefia órfã, que deixa o participante órfão.
    const antes = filtros({
      directorates: ["DIR A"],
      units: ["UNIDADE X"],
      coordinations: ["COORD 2"],
      managers: ["Chefe Dois"],
      participantIds: ["p2"],
    });
    const depois = reconciliarFiltros(base, { ...antes, directorates: ["DIR B"] }, "directorate");

    expect(depois.directorates).toEqual(["DIR B"]);
    expect(depois.units).toEqual([]);
    expect(depois.coordinations).toEqual([]);
    expect(depois.managers).toEqual([]);
    expect(depois.participantIds).toEqual([]);
  });

  it("preserva o que continua compatível", () => {
    // Reconciliar não é limpar: o que ainda existe no novo recorte fica.
    const antes = filtros({ directorates: ["DIR A"], coordinations: ["COORD 1", "COORD 3"] });
    const depois = reconciliarFiltros(base, antes, "directorate");

    expect(depois.coordinations).toEqual(["COORD 1"]);
  });

  it("troca de chefia reconcilia diretoria e unidade", () => {
    const antes = filtros({ directorates: ["DIR A"], units: ["UNIDADE X"], managers: ["Chefe Um"] });
    const depois = reconciliarFiltros(base, { ...antes, managers: ["Chefe Tres"] }, "manager");

    expect(depois.managers).toEqual(["Chefe Tres"]);
    expect(depois.directorates).toEqual([]);
    expect(depois.units).toEqual([]);
  });

  it("status incompatível sai do estado", () => {
    // `COMPLETE` só existe em p1, que é da DIR A. Ao ir para a DIR B, ele
    // deixaria de existir e não pode continuar restringindo escondido.
    const antes = filtros({ directorates: ["DIR A"], statuses: ["COMPLETE"] });
    const depois = reconciliarFiltros(base, { ...antes, directorates: ["DIR B"] }, "directorate");

    expect(depois.directorates).toEqual(["DIR B"]);
    expect(depois.statuses).toEqual([]);
  });

  it("KPI e dropdown reconciliam pelo mesmo caminho", () => {
    // Clicar num KPI é alterar a dimensão `status`; a diretoria incompatível
    // sai do mesmo jeito que sairia por um dropdown.
    const antes = filtros({ directorates: ["DIR A"] });
    const depois = reconciliarFiltros(base, { ...antes, statuses: ["NO_MANAGER"] }, "status");

    expect(depois.statuses).toEqual(["NO_MANAGER"]);
    expect(depois.directorates).toEqual([]);
  });

  it("participante escolhido reconcilia todas as dimensões acima", () => {
    const antes = filtros({ directorates: ["DIR A"], units: ["UNIDADE X"] });
    const depois = reconciliarFiltros(base, { ...antes, participantIds: ["p3"] }, "participant");

    expect(depois.participantIds).toEqual(["p3"]);
    expect(depois.directorates).toEqual([]);
    expect(depois.units).toEqual([]);
  });

  it("estabiliza sem alterar nada quando tudo já é compatível", () => {
    const compativel = filtros({ directorates: ["DIR A"], units: ["UNIDADE X"], coordinations: ["COORD 1"] });

    expect(reconciliarFiltros(base, compativel, "directorate")).toEqual(compativel);
  });

  it("recorte vazio permanece vazio", () => {
    expect(reconciliarFiltros(base, FILTROS_CDDI_VAZIOS, "directorate")).toEqual(FILTROS_CDDI_VAZIOS);
  });
});

describe("atendeFiltros", () => {
  it("exclui quem não tem valor na dimensão exigida", () => {
    // p4 não tem chefia: com filtro de chefia ativo, ela sai.
    const comChefia = filtros({ managers: ["Chefe Tres"] });

    expect(atendeFiltros(base[2], comChefia)).toBe(true);
    expect(atendeFiltros(base[3], comChefia)).toBe(false);
  });

  it("cruza dimensões diferentes", () => {
    const cruzado = filtros({ directorates: ["DIR A"], coordinations: ["COORD 2"] });

    expect(atendeFiltros(base[0], cruzado)).toBe(false);
    expect(atendeFiltros(base[1], cruzado)).toBe(true);
  });

  it("soma valores da mesma dimensão", () => {
    const somado = filtros({ coordinations: ["COORD 1", "COORD 3"] });

    expect(base.filter((item) => atendeFiltros(item, somado))).toHaveLength(3);
  });
});

describe("KPI com contagem zero", () => {
  /*
    Os KPIs contam sobre o recorte, não sobre a base. Zero quer dizer "ninguém
    nessa situação entre estes participantes" — e não "vá procurar em outro
    lugar". Deixar o clique passar apagaria o recorte inteiro, porque nenhum
    valor de nenhuma dimensão sobrevive a um resultado vazio.
  */
  it("Diretoria + Unidade → KPI zero → clique não altera o recorte", () => {
    // DIR B / UNIDADE Y tem p3 e p4, ambos sem nada concluído: `COMPLETE` é 0.
    const recorte = filtros({ directorates: ["DIR B"], units: ["UNIDADE Y"] });
    const naoConcluidos = base.filter((item) => atendeFiltros(item, recorte));
    const concluidos = naoConcluidos.filter((item) => item.autoCompleted && item.leaderCompleted).length;

    expect(concluidos).toBe(0);
    expect(kpiClicavel("COMPLETE", concluidos, recorte.statuses)).toBe(false);
    expect(aoClicarNoKpi(base, recorte, "COMPLETE", concluidos)).toBe(recorte);
  });

  it("com contagem maior que zero, o clique aplica e reconcilia", () => {
    // `COMPLETE` só existe em p1, da DIR A — a DIR B selecionada não sobrevive.
    const recorte = filtros({ directorates: ["DIR B"] });
    const depois = aoClicarNoKpi(base, recorte, "COMPLETE", 1);

    expect(depois.statuses).toEqual(["COMPLETE"]);
    expect(depois.directorates).toEqual([]);
  });

  it("a situação já selecionada continua clicável mesmo em zero", () => {
    // Sem esta exceção, o filtro que zerou a própria contagem não teria como
    // ser desmarcado e a tela ficaria travada em zero.
    const travado = filtros({ statuses: ["COMPLETE"] });

    expect(kpiClicavel("COMPLETE", 0, travado.statuses)).toBe(true);
    expect(aoClicarNoKpi(base, travado, "COMPLETE", 0).statuses).toEqual([]);
  });

  it("o KPI de participantes limpa a situação e nunca é bloqueado", () => {
    // Chave vazia não escolhe situação: ela remove. Só amplia o recorte.
    expect(kpiClicavel("", 0, ["COMPLETE"])).toBe(true);
    expect(aoClicarNoKpi(base, filtros({ statuses: ["COMPLETE"] }), "", 0).statuses).toEqual([]);
  });
});

describe("troca de ciclo", () => {
  it("zera recorte, busca e paginação", () => {
    // Público diferente: a unidade do ciclo anterior pode não existir no novo, e
    // preservá-la recriaria o filtro invisível que esta correção fecha.
    const depois = estadoAoTrocarCiclo("CDDI-2027");

    expect(depois.cycleCode).toBe("CDDI-2027");
    expect(depois.filtros).toEqual(FILTROS_CDDI_VAZIOS);
    expect(depois.query).toBe("");
    expect(depois.page).toBe(1);
  });

  it("não reaproveita nada do ciclo anterior", () => {
    expect(temRecorteAtivo(estadoAoTrocarCiclo("CDDI-2027").filtros)).toBe(false);
  });
});

describe("temRecorteAtivo", () => {
  it("distingue recorte de ausência de recorte", () => {
    expect(temRecorteAtivo(FILTROS_CDDI_VAZIOS)).toBe(false);
    expect(temRecorteAtivo(filtros({ statuses: ["COMPLETE"] }))).toBe(true);
  });
});
