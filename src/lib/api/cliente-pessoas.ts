import { chamar } from "./requisicao";
import type {
  AreaDeAcessos,
  AreaVinculosLideranca,
  AtualizarMarcaEntrada,
  AtualizarPessoaEntrada,
  AvaliacaoComParticipantes,
  CandidatoDaEquipe,
  CicloDeLideranca,
  CicloDePesquisa,
  DefinirTextosEmailEntrada,
  DefinirTextosMarcaEntrada,
  DefinirComunicadoInicioEntrada,
  DefinirVinculoLiderancaEntrada,
  EnviarEmailsEntrada,
  HistoricoDeEmails,
  PessoaDaAudiencia,
  ResultadoDoDespacho,
  ResultadoDoEnvioManual,
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
  return chamar<AreaVinculosLideranca>(
    `/api/pessoas/vinculos-lideranca${consulta({ avaliacao, busca: opcoes?.busca, limite: opcoes?.limite })}`,
  );
}

/** Ciclos CDDI disponíveis para a correção administrativa de liderança. */
export function listarCiclosAdministrativosDeLideranca() {
  return chamar<AvaliacaoComParticipantes[]>("/api/pessoas/vinculos-lideranca/ciclos");
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

/** Publica, atualiza ou desativa o comunicado institucional da página inicial. */
export function definirComunicadoDaPaginaInicial(entrada: DefinirComunicadoInicioEntrada) {
  return chamar<unknown>("/api/plataforma/marca/comunicado", {
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

/**
 * Define os textos institucionais da tela de acesso.
 *
 * Campo vazio restaura o padrão do código — a tela de entrada nunca fica sem
 * título nem sem instrução.
 */
export function definirTextosDaMarca(entrada: DefinirTextosMarcaEntrada) {
  return chamar<unknown>("/api/plataforma/marca/textos", {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

// ── Central de e-mails ────────────────────────────────────────────────────────

/**
 * Define a instrução de acesso e o rodapé do e-mail aos participantes.
 *
 * Campo vazio restaura o padrão do código — nenhum e-mail sai sem explicar como
 * acessar nem sem assinatura institucional.
 */
export function definirTextosDeEmail(entrada: DefinirTextosEmailEntrada) {
  return chamar<unknown>("/api/plataforma/emails/textos", {
    method: "PUT",
    body: JSON.stringify(entrada),
  });
}

/** Histórico de envios, com resumo por situação. Sem ciclo, traz a plataforma toda. */
export function listarEnviosDeEmail(opcoes?: { avaliacao?: string | null; situacao?: string; limite?: number }) {
  return chamar<HistoricoDeEmails>(
    `/api/plataforma/emails${consulta({
      avaliacao: opcoes?.avaliacao,
      situacao: opcoes?.situacao,
      limite: opcoes?.limite,
    })}`,
  );
}

/** Audiência elegível do ciclo, com a situação de resposta de cada pessoa. */
export function listarAudienciaDeEmail(
  avaliacao: string,
  opcoes?: { situacao?: string; busca?: string; limite?: number },
) {
  return chamar<PessoaDaAudiencia[]>(
    `/api/plataforma/emails/audiencia${consulta({
      avaliacao,
      situacao: opcoes?.situacao,
      busca: opcoes?.busca,
      limite: opcoes?.limite,
    })}`,
  );
}

/**
 * Enfileira o lembrete dirigido. **Não envia** — quem envia é `despacharEmails`,
 * pelo mesmo caminho dos automáticos.
 */
export function enviarEmailsParaPessoas(entrada: EnviarEmailsEntrada) {
  return chamar<ResultadoDoEnvioManual>("/api/plataforma/emails/enviar", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Processa **um lote** da fila e devolve o que aconteceu.
 *
 * `remaining` verdadeiro significa "pode haver mais" — a tela chama de novo até
 * ele ficar falso. Cada chamada é curta de propósito: o SMTP é sequencial e mil
 * mensagens não cabem numa invocação serverless.
 */
export function despacharEmails() {
  return chamar<ResultadoDoDespacho>("/api/plataforma/emails/despachar", { method: "POST" });
}

/** Define a cor da barra lateral; `null` volta à cor institucional. */
export function definirCorDaBarraLateral(cor: string | null) {
  return chamar<unknown>("/api/plataforma/marca/cor-barra-lateral", {
    method: "PUT",
    body: JSON.stringify({ cor }),
  });
}

/**
 * Registra a batida de presença de quem chamou.
 *
 * Não recebe pessoa: a identidade vem da sessão. Devolve `DISABLED` quando a
 * presença está desligada na configuração — resposta normal, não erro.
 */
export function registrarPresenca() {
  return chamar<{ status: string }>("/api/plataforma/presenca/batida", { method: "POST" });
}

/**
 * Quem está online agora.
 *
 * Restrita pelo banco aos perfis configurados. Quem não pode ver recebe 403 —
 * distinto de lista vazia, que significa "ninguém online".
 */
export function listarPresencaOnline() {
  return chamar<unknown>("/api/plataforma/presenca/online");
}

/** Liga/desliga a presença e restringe os perfis que a visualizam. */
export function definirPresencaOnline(ativa: boolean, perfis: string[]) {
  return chamar<unknown>("/api/plataforma/presenca", {
    method: "PUT",
    body: JSON.stringify({ ativa, perfis }),
  });
}

/** Página da matriz de perfis e pessoas. */
export function obterAreaDeAcessos(opcoes?: { busca?: string; limite?: number; offset?: number }) {
  return chamar<AreaDeAcessos>(
    `/api/plataforma/acessos${consulta({
      busca: opcoes?.busca,
      limite: opcoes?.limite,
      offset: opcoes?.offset,
    })}`,
  );
}

/** Define **o** perfil da pessoa; o anterior é encerrado na mesma transação. */
export function definirPerfilDaPessoa(pessoaId: string, perfil: string) {
  return chamar<unknown>(`/api/plataforma/acessos/${pessoaId}`, {
    method: "PUT",
    body: JSON.stringify({ perfil }),
  });
}
