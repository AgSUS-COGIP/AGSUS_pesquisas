import { chamar } from "./requisicao";
import type {
  AreaDeAcessos,
  AtualizarMarcaEntrada,
  AtualizarPessoaEntrada,
  AvaliacaoComParticipantes,
  CandidatoDaEquipe,
  CicloDeLideranca,
  CicloDePesquisa,
  DefinirVinculoLiderancaEntrada,
  EquipeDaLideranca,
  EventoAuditoriaPessoa,
  ParticipanteDaAvaliacao,
  PessoaAdministrativa,
  PessoaCandidataAoCiclo,
  PessoaSemChefia,
  RespostaDoCiclo,
  ResultadoVinculoEmLote,
  ResumoBasePessoas,
  VincularParticipantesEntrada,
  VinculoLideranca,
} from "./contratos-pessoas";

/** Cliente REST do domínio de pessoas, participantes, equipes e acessos. */

/** Monta a query string descartando o que estiver vazio. */
function consulta(parametros: Record<string, string | number | null | undefined>) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === null || valor === undefined || valor === "") continue;
    busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

// ── Pessoas ───────────────────────────────────────────────────────────────────

/** Busca na base institucional de pessoas. */
export function buscarPessoas(opcoes?: { busca?: string; limite?: number }) {
  return chamar<PessoaAdministrativa[]>(
    `/api/pessoas${consulta({ busca: opcoes?.busca, limite: opcoes?.limite })}`,
  );
}

/** Corrige a ficha funcional. A matrícula não muda — o banco recusa. */
export function atualizarPessoa(id: string, entrada: AtualizarPessoaEntrada) {
  return chamar<unknown>(`/api/pessoas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(entrada),
  });
}

/** Histórico administrativo da pessoa. */
export function listarAuditoriaDaPessoa(id: string, opcoes?: { limite?: number }) {
  return chamar<EventoAuditoriaPessoa[]>(
    `/api/pessoas/${id}/auditoria${consulta({ limite: opcoes?.limite })}`,
  );
}

/** Retrato da base mestra; `avaliacao` recorta por ciclo. */
export function obterResumoDaBase(opcoes?: { avaliacao?: string | null }) {
  return chamar<ResumoBasePessoas>(
    `/api/pessoas/resumo-base${consulta({ avaliacao: opcoes?.avaliacao })}`,
  );
}

/** Vínculos de chefia do ciclo, vigentes e encerrados. */
export function listarVinculosDeLideranca(avaliacao: string, opcoes?: { busca?: string; limite?: number }) {
  return chamar<VinculoLideranca[]>(
    `/api/pessoas/vinculos-lideranca${consulta({ avaliacao, busca: opcoes?.busca, limite: opcoes?.limite })}`,
  );
}

/** Define a chefia de alguém; encerra o vínculo anterior sem apagar histórico. */
export function definirVinculoDeLideranca(entrada: DefinirVinculoLiderancaEntrada) {
  return chamar<unknown>("/api/pessoas/vinculos-lideranca", {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

/** Participantes do ciclo sem chefia vigente — fila de correção. */
export function listarPessoasSemChefia(avaliacao: string, opcoes?: { busca?: string; limite?: number }) {
  return chamar<PessoaSemChefia[]>(
    `/api/pessoas/sem-chefia${consulta({ avaliacao, busca: opcoes?.busca, limite: opcoes?.limite })}`,
  );
}

// ── Participantes de um ciclo ─────────────────────────────────────────────────

/** Ciclos disponíveis para gestão de público, com as contagens de cada um. */
export function listarCiclosDeParticipantes() {
  return chamar<AvaliacaoComParticipantes[]>("/api/avaliacoes/ciclos-participantes");
}

/** Público vinculado ao ciclo. */
export function listarParticipantes(avaliacao: string) {
  return chamar<ParticipanteDaAvaliacao[]>(`/api/avaliacoes/${avaliacao}/participantes`);
}

/** Pessoas da base, com a situação que cada uma já tem neste ciclo. */
export function listarPessoasDisponiveis(avaliacao: string, opcoes?: { busca?: string }) {
  return chamar<PessoaCandidataAoCiclo[]>(
    `/api/avaliacoes/${avaliacao}/pessoas-disponiveis${consulta({ busca: opcoes?.busca })}`,
  );
}

/** Vincula pessoas ao público: lista, todo o público elegível, ou cadastro novo. */
export function vincularParticipantes(avaliacao: string, entrada: VincularParticipantesEntrada) {
  return chamar<ResultadoVinculoEmLote>(`/api/avaliacoes/${avaliacao}/participantes`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/** Bloqueia, reativa ou remove um participante. Remover marca `EXCLUDED`. */
export function alterarStatusDoParticipante(
  avaliacao: string,
  participante: string,
  status: "ELIGIBLE" | "BLOCKED" | "EXCLUDED",
) {
  return chamar<unknown>(`/api/avaliacoes/${avaliacao}/participantes/${participante}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ── Equipe da liderança ───────────────────────────────────────────────────────

/** Ciclos em que a pessoa lidera equipe, do mais recente ao mais antigo. */
export function listarCiclosDeLideranca() {
  return chamar<CicloDeLideranca[]>("/api/equipe/ciclos");
}

/** Equipe no ciclo escolhido; sem código, o banco resolve o mais recente. */
export function obterMinhaEquipe(ciclo: string | null) {
  return chamar<EquipeDaLideranca>(`/api/equipe${consulta({ ciclo })}`);
}

/** Pessoas elegíveis a entrar na equipe: sem liderança ativa no ciclo. */
export function listarCandidatosDaEquipe(avaliacao: string, busca: string) {
  return chamar<CandidatoDaEquipe[]>(`/api/equipe/candidatos${consulta({ avaliacao, busca })}`);
}

/** Inclui alguém na equipe neste ciclo. */
export function incluirIntegrante(applicationId: string, personId: string) {
  return chamar<unknown>("/api/equipe/membros", {
    method: "POST",
    body: JSON.stringify({ applicationId, personId }),
  });
}

/** Retira o integrante: encerra a vigência do vínculo, preservando o histórico. */
export function retirarIntegrante(vinculoId: string) {
  return chamar<unknown>(`/api/equipe/membros/${vinculoId}`, { method: "DELETE" });
}

// ── Respostas de participantes ────────────────────────────────────────────────

/** Ciclos de uma pesquisa, pelo código dela. */
export function listarCiclosDaPesquisa(codigo: string) {
  return chamar<CicloDePesquisa[]>(`/api/avaliacoes/${encodeURIComponent(codigo)}/ciclos`);
}

/** Respostas registradas no ciclo. */
export function listarRespostasDoCiclo(ciclo: string, opcoes?: { busca?: string; limite?: number }) {
  return chamar<RespostaDoCiclo[]>(
    `/api/respostas${consulta({ ciclo, busca: opcoes?.busca, limite: opcoes?.limite })}`,
  );
}

/** Anula (preservando o registro) ou apaga a resposta. O motivo vai à auditoria. */
export function removerResposta(submissaoId: string, modo: "INVALIDATE" | "DELETE", motivo: string) {
  return chamar<unknown>(`/api/respostas/${submissaoId}`, {
    method: "DELETE",
    body: JSON.stringify({ modo, motivo }),
  });
}

// ── Plataforma: marca e acessos ───────────────────────────────────────────────

/** Marca institucional resolvida. O formato é normalizado por quem consome. */
export function obterMarcaDaPlataforma() {
  return chamar<unknown>("/api/plataforma/marca");
}

/** Grava nomes e cor principal. O logotipo é fixo e não trafega. */
export function atualizarMarcaDaPlataforma(entrada: AtualizarMarcaEntrada) {
  return chamar<unknown>("/api/plataforma/marca", {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

/** Define a arte de fundo do acesso; `null` nos dois campos restaura o padrão. */
export function definirFundoDeAcesso(url: string | null, caminho: string | null) {
  return chamar<unknown>("/api/plataforma/marca/fundo-acesso", {
    method: "PUT",
    body: JSON.stringify({ url, caminho }),
  });
}

/** Define a cor do painel do acesso; `null` volta ao branco institucional. */
export function definirCorDoPainelDeAcesso(cor: string | null) {
  return chamar<unknown>("/api/plataforma/marca/cor-painel", {
    method: "PUT",
    body: JSON.stringify({ cor }),
  });
}

/** Matriz de perfis e pessoas. */
export function obterAreaDeAcessos(opcoes?: { busca?: string }) {
  return chamar<AreaDeAcessos>(`/api/plataforma/acessos${consulta({ busca: opcoes?.busca })}`);
}

/** Define **o** perfil da pessoa; o anterior é encerrado na mesma transação. */
export function definirPerfilDaPessoa(pessoaId: string, perfil: string) {
  return chamar<unknown>(`/api/plataforma/acessos/${pessoaId}`, {
    method: "PUT",
    body: JSON.stringify({ perfil }),
  });
}
