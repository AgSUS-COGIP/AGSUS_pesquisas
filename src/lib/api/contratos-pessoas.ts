/**
 * Contratos REST do domínio de pessoas, participantes, equipes e acessos.
 *
 * Os nomes de campo espelham literalmente o que as RPCs devolvem (camelCase,
 * montado com `jsonb_build_object` no banco): não há camada de tradução, e é
 * assim que o compilador reclama quando o banco muda de formato.
 */

// ── Pessoas: ficha funcional e auditoria ──────────────────────────────────────

/** Pessoa da base institucional, no formato de `search_platform_admin_people`. */
export type PessoaAdministrativa = {
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  workplace: string | null;
  directorate: string | null;
  organizationalUnit: string | null;
  coordination: string | null;
  employmentStatus: string;
  active: boolean;
  updatedAt: string;
};

/**
 * Corpo aceito por `PATCH /api/pessoas/[id]`.
 *
 * A matrícula não aparece de propósito: `update_platform_admin_person` não a
 * altera, e aceitá-la prometeria uma edição que o banco recusa.
 */
export type AtualizarPessoaEntrada = {
  fullName: string;
  institutionalEmail?: string | null;
  jobTitle?: string | null;
  costCenter?: string | null;
  workplace?: string | null;
  directorate?: string | null;
  organizationalUnit?: string | null;
  coordination?: string | null;
  employmentStatus: string;
  active: boolean;
  justification: string;
};

/** Evento de auditoria da ficha funcional de uma pessoa. */
export type EventoAuditoriaPessoa = {
  eventId: number;
  eventType: string;
  actorPersonId: string | null;
  actorName: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  justification: string | null;
  createdAt: string;
};

/** Retrato da base mestra devolvido por `get_admin_people_base_summary`. */
export type ResumoBasePessoas = {
  totalPeople: number;
  activePeople: number;
  inactivePeople: number;
  withInstitutionalEmail: number;
  withoutInstitutionalEmail: number;
  authenticatedPeople: number;
  withChosenAvatar: number;
  linkedToApplication: number;
  availableToLink: number;
};

// ── Vínculos de liderança ─────────────────────────────────────────────────────

/** Vínculo de chefia de um ciclo, vigente ou encerrado. */
export type VinculoLideranca = {
  linkId: string;
  applicationId: string;
  leaderPersonId: string;
  leaderName: string;
  leaderEmployeeNumber: string;
  subordinatePersonId: string;
  subordinateName: string;
  subordinateEmployeeNumber: string;
  status: string;
  validFrom: string;
  validTo: string | null;
  origin: string;
};

/** Página administrativa de vínculos, com contagens independentes do limite. */
export type AreaVinculosLideranca = {
  links: VinculoLideranca[];
  totalActive: number;
  totalMatches: number;
  limit: number;
};

/** Participante do ciclo sem chefia vigente — fila de correção da administração. */
export type PessoaSemChefia = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  organizationalUnit: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerResolution: string;
};

/** Corpo aceito por `PUT /api/pessoas/vinculos-lideranca`. */
export type DefinirVinculoLiderancaEntrada = {
  applicationId: string;
  subordinatePersonId: string;
  leaderPersonId: string;
  justification: string;
};

// ── Avaliações e participantes ────────────────────────────────────────────────

/** Ciclo no seletor administrativo de participantes. */
export type AvaliacaoComParticipantes = {
  id: string;
  code: string;
  name: string;
  status: string;
  accessMode: string;
  participantCount: number;
  completedCount: number;
};

/** Participante vinculado a um ciclo. */
export type ParticipanteDaAvaliacao = {
  id: string;
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  avatarUrl: string | null;
  accessProfile: string | null;
  status: string;
  completedAt: string | null;
  hasSubmission: boolean;
};

/** Pessoa candidata a vínculo, com a situação que ela já tem no ciclo. */
export type PessoaCandidataAoCiclo = {
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  avatarUrl: string | null;
  participantId: string | null;
  participantStatus: string | null;
};

/**
 * Corpo aceito por `POST /api/avaliacoes/[id]/participantes`.
 *
 * As três formas produzem o mesmo efeito e diferem só em como o conjunto é
 * escolhido: `pessoas` vincula os identificadores dados, `todosDisponiveis`
 * vincula o público elegível inteiro, e `criar` cadastra alguém fora da base
 * antes de vincular.
 */
export type VincularParticipantesEntrada = {
  pessoas?: string[];
  todosDisponiveis?: boolean;
  criar?: {
    employeeNumber: string;
    fullName: string;
    institutionalEmail: string;
    jobTitle?: string | null;
    costCenter?: string | null;
    workplace?: string | null;
  };
};

/** Contagens devolvidas pelas RPCs de vínculo em lote. */
export type ResultadoVinculoEmLote = {
  requestedCount?: number;
  assignedCount?: number;
  reactivatedCount?: number;
  skippedCount?: number;
};

/** Corpo aceito por `PATCH /api/avaliacoes/[id]/participantes/[participanteId]`. */
export type AlterarStatusParticipanteEntrada = {
  status: "ELIGIBLE" | "BLOCKED" | "EXCLUDED";
};

// ── Equipe da liderança ───────────────────────────────────────────────────────

/** Ciclo em que a pessoa lidera equipe. */
export type CicloDeLideranca = {
  id: string;
  code: string;
  name: string;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
};

/** Integrante da equipe, com a situação da avaliação dele no ciclo. */
export type IntegranteDaEquipe = {
  linkId: string;
  personId: string;
  fullName: string;
  employeeNumber: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  avatarUrl: string | null;
  status: string;
  validFrom: string;
  submissionStatus: string | null;
  submissionUpdatedAt: string | null;
};

/** Pessoa elegível a entrar na equipe: sem liderança ativa no ciclo. */
export type CandidatoDaEquipe = {
  personId: string;
  fullName: string;
  employeeNumber: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  avatarUrl: string | null;
};

/** Agregado da equipe no ciclo, devolvido por `fc_obter_minha_equipe`. */
export type EquipeDaLideranca = {
  status: string;
  application: {
    id: string;
    code: string;
    name: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  members: IntegranteDaEquipe[];
  total: number;
};

/** Corpo aceito por `POST /api/equipe/membros`. */
export type IncluirIntegranteEntrada = {
  applicationId: string;
  personId: string;
};

// ── Respostas de participantes ────────────────────────────────────────────────

/** Ciclo de uma pesquisa, com a contagem de participantes. */
export type CicloDePesquisa = {
  applicationId: string;
  code: string;
  name: string;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  participants: number;
};

/** Resposta registrada em um ciclo. */
export type RespostaDoCiclo = {
  submissionId: string;
  personId: string | null;
  fullName: string | null;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  submissionType: string;
  status: string;
  submittedAt: string | null;
  answers: number;
  subjectName: string | null;
};

/**
 * Corpo aceito por `DELETE /api/respostas/[submissaoId]`.
 *
 * `INVALIDATE` tira dos painéis preservando o registro; `DELETE` remove o
 * conteúdo da base. O motivo é obrigatório nos dois e vai para a auditoria.
 */
export type RemoverRespostaEntrada = {
  modo: "INVALIDATE" | "DELETE";
  motivo: string;
};

// ── Plataforma: marca e acessos ───────────────────────────────────────────────

/** Perfil disponível na matriz de acessos. */
export type PerfilDeAcesso = {
  code: string;
  name: string;
  description: string | null;
};

/** Pessoa na matriz de acessos, com os papéis vigentes dela. */
export type PessoaComPerfis = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  active: boolean;
  roles: { code: string }[];
};

/** Página da matriz devolvida por `fc_listar_acessos_paginados`. */
export type AreaDeAcessos = {
  status: "OK";
  roles: PerfilDeAcesso[];
  people: PessoaComPerfis[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/** Corpo aceito por `PUT /api/plataforma/acessos/[pessoaId]`. */
export type DefinirPerfilEntrada = {
  perfil: string;
};

/** Corpo aceito por `PUT /api/plataforma/marca`. */
export type AtualizarMarcaEntrada = {
  organizationName: string;
  productName: string;
  primaryColor: string;
};

/** Configuração do recurso de presença online. */
export type DefinirPresencaOnlineEntrada = {
  ativa: boolean;
  perfis: string[];
};

/**
 * Corpo aceito por `PUT /api/plataforma/marca/fundo-acesso`.
 *
 * `url` e `caminho` nulos restauram a arte institucional padrão — é assim que a
 * RPC distingue "trocar a arte" de "voltar ao padrão", sem uma segunda função.
 */
export type DefinirFundoAcessoEntrada = {
  url: string | null;
  caminho: string | null;
};

/** Corpo aceito por `PUT /api/plataforma/marca/cor-painel`. `cor` nula volta ao branco. */
export type DefinirCorPainelEntrada = {
  cor: string | null;
};

/**
 * Corpo de `PUT /api/plataforma/marca/textos`.
 *
 * Os três campos vão juntos porque `fc_definir_textos_marca` grava os três de
 * uma vez: enviar só um zeraria os outros dois. A tela sempre manda o conjunto
 * completo, mesmo que a pessoa tenha alterado um só.
 */
export type DefinirTextosMarcaEntrada = {
  expansao: string | null;
  saudacao: string | null;
  instrucao: string | null;
};

/** Textos institucionais do e-mail aos participantes. Vazio restaura o padrão. */
export type DefinirTextosEmailEntrada = {
  instrucao: string | null;
  rodape: string | null;
};

/** Pessoas escolhidas para receber o lembrete dirigido de um ciclo. */
export type EnviarEmailsEntrada = {
  avaliacao: string;
  pessoas: string[];
};

/**
 * Uma pessoa da audiência de um ciclo, com a situação de resposta dela.
 *
 * `situation` considera só a resposta **da própria pessoa sobre si**: no CDDI
 * quem lidera equipe também responde sobre outros, e contar essas marcaria a
 * chefia como concluída sem que a autoavaliação existisse.
 */
export type PessoaDaAudiencia = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  email: string | null;
  participantStatus: string;
  situation: "PENDING" | "DRAFT" | "DONE";
  emailValido: boolean;
  lastEmailAt: string | null;
  lastEmailKind: string | null;
  lastEmailStatus: string | null;
};

/** Um registro do histórico de envios. */
export type EnvioDeEmail = {
  id: string;
  kind: string;
  /** PENDENTE (na fila) → PROCESSANDO (reivindicado) → ENVIADO ou FALHOU. */
  status: "PENDENTE" | "PROCESSANDO" | "ENVIADO" | "FALHOU";
  erro: string | null;
  createdAt: string;
  sentAt: string | null;
  personName: string;
  personEmail: string | null;
  applicationCode: string;
  applicationName: string;
};

export type HistoricoDeEmails = {
  /** Contagem por situação. Chave ausente significa zero. */
  resumo: Partial<Record<"PENDENTE" | "PROCESSANDO" | "ENVIADO" | "FALHOU", number>>;
  envios: EnvioDeEmail[];
};

/**
 * Resultado de uma execução do despacho.
 *
 * Espelha `ParticipantEmailDispatchResult` do despachador, que já processa
 * vários lotes por chamada (`batches`) dentro do próprio orçamento de tempo.
 * `claimed` em zero é o sinal de fila vazia — é por ele que a tela sabe parar
 * de insistir, já que não existe um `remaining` explícito.
 */
export type ResultadoDoDespacho =
  | { status: "skipped"; missingConfiguration: string[] }
  | { status: "ok"; batches: number; claimed: number; sent: number; failed: number };

/** Resultado do enfileiramento dirigido. `ignoradas` não é erro — ver a RPC. */
export type ResultadoDoEnvioManual = {
  status: string;
  solicitadas: number;
  enfileiradas: number;
  ignoradas: number;
};
