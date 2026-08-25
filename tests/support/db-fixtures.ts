import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Fixtures de E2E são criadas direto nas tabelas, com a chave de serviço —
// do mesmo jeito que os testes pgTAP fazem dentro de uma transação, só que
// aqui não há rollback: o servidor Next.js precisa ver os dados depois que a
// fixture termina. Por isso cada execução usa um sufixo único (timestamp +
// UUID criptográfico) em código/e-mail/matrícula, e `teardownParticipantSurveyFixture`
// desfaz o que foi criado.
//
// Ignora RPC de propósito: `create_survey_draft`/`manage_survey_cycle`
// validam `can_manage_surveys()` a partir de `auth.uid()`, que não existe
// numa chamada com chave de serviço. A fixture não está testando essas RPCs
// — só precisa que uma pesquisa publicada e aberta exista.

let adminClient: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL/SUPABASE_SECRET_KEY (ou os nomes legados) não estão configurados — " +
      "confirme que .env.local existe e que `supabase start` já rodou.",
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function runSuffix() {
  return `${Date.now()}-${randomUUID()}`;
}

async function insertOne<T>(table: string, values: Record<string, unknown>, select = "id"): Promise<T> {
  const { data, error } = await admin().from(table).insert(values).select(select).single();
  if (error || !data) {
    throw new Error(`Falha ao inserir fixture em ${table}: ${error?.message ?? "sem dado devolvido"}`);
  }
  return data as T;
}

/** Pergunta a semear. `type` segue os códigos de `survey_questions.question_type`. */
export type QuestionSeed = {
  title: string;
  type?: "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SCALE" | "BOOLEAN" | "INTEGER";
  required?: boolean;
  /** Rótulos das alternativas — obrigatórios nos tipos de escolha. */
  options?: string[];
};

export type SectionSeed = {
  title: string;
  questions: QuestionSeed[];
};

export type SeedOptions = {
  /** Ciclo anônimo: exibe o selo "Anônima" e o aviso antes das perguntas. */
  anonymous?: boolean;
  /**
   * `CLOSED` deixa a tela somente leitura: `application_accepts_responses()`
   * recusa, e `start_or_resume_my_survey_submission` devolve `PERIOD_CLOSED`
   * sem criar rascunho. O formulário continua carregando — `get_public_survey_form`
   * aceita `SCHEDULED`, `OPEN` e `CLOSED`.
   */
  cycleStatus?: "OPEN" | "CLOSED";
  /** Estrutura do instrumento. O padrão é uma seção com uma pergunta obrigatória. */
  sections?: SectionSeed[];
};

const DEFAULT_SECTIONS: SectionSeed[] = [
  {
    title: "Seção única",
    questions: [{ title: "Como você avalia o atendimento recebido?", type: "SHORT_TEXT", required: true }],
  },
];

export type SurveyFixtureIds = {
  authUserId: string;
  personId: string;
  surveyId: string;
  versionId: string;
  applicationId: string;
  questionIds: string[];
};

export type SurveyFixture = {
  email: string;
  fullName: string;
  employeeNumber: string;
  applicationCode: string;
  surveyName: string;
  /** Primeira pergunta da primeira seção — atalho para o caso de uma pergunta só. */
  questionTitle: string;
  anonymous: boolean;
  cycleStatus: "OPEN" | "CLOSED";
  sections: SectionSeed[];
  ids: SurveyFixtureIds;
};

/**
 * Cria uma pessoa de teste (com login de e-mail próprio) e uma pesquisa já
 * publicada, aberta e de acesso institucional — o suficiente para as jornadas
 * de resposta do runtime genérico.
 *
 * Qualquer falha no meio do caminho desfaz o que já foi criado antes de
 * relançar o erro — sem isto, uma execução que falha na metade (ex.: um
 * `insert` rejeitado) deixaria pessoa/pesquisa órfãs, sem nenhum `SurveyFixture`
 * para o chamador passar a `teardownParticipantSurveyFixture()`.
 */
export async function seedParticipantSurveyFixture(options: SeedOptions = {}): Promise<SurveyFixture> {
  const anonymous = options.anonymous ?? false;
  const cycleStatus = options.cycleStatus ?? "OPEN";
  const sections = options.sections ?? DEFAULT_SECTIONS;

  if (!sections.length || !sections[0].questions.length) {
    throw new Error("A fixture precisa de ao menos uma seção com uma pergunta.");
  }

  const suffix = runSuffix();
  const email = `e2e-participante-${suffix}@agenciasus.org.br`;
  const fullName = "Participante E2E";
  const employeeNumber = `E2E-${suffix}`;
  const surveyCode = `E2E-PESQUISA-${suffix}`;
  const surveyName = "Pesquisa de teste E2E";

  const ids: Partial<SurveyFixtureIds> = { questionIds: [] };

  try {
    const { data: authUser, error: authError } = await admin().auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (authError || !authUser?.user) {
      throw new Error(`Falha ao criar usuário de teste: ${authError?.message ?? "sem usuário devolvido"}`);
    }
    ids.authUserId = authUser.user.id;

    const person = await insertOne<{ id: string }>("people", {
      auth_user_id: authUser.user.id,
      employee_number: employeeNumber,
      full_name: fullName,
      institutional_email: email,
    });
    ids.personId = person.id;

    const survey = await insertOne<{ id: string }>("surveys", {
      code: surveyCode,
      name: surveyName,
      status: "ACTIVE",
    });
    ids.surveyId = survey.id;

    const now = Date.now();
    // A versão nasce DRAFT: o trigger `enforce_draft_survey_structure` recusa
    // inserir seção/pergunta contra uma versão já PUBLISHED. Só depois de a
    // estrutura existir é que a versão é publicada de fato.
    const version = await insertOne<{ id: string }>("survey_versions", {
      survey_id: survey.id,
      version_number: 1,
      title: surveyName,
      status: "DRAFT",
    });
    ids.versionId = version.id;

    for (const [sectionIndex, sectionSeed] of sections.entries()) {
      const section = await insertOne<{ id: string }>("survey_sections", {
        survey_version_id: version.id,
        code: `S${sectionIndex + 1}`,
        title: sectionSeed.title,
        position: sectionIndex + 1,
      });

      for (const [questionIndex, questionSeed] of sectionSeed.questions.entries()) {
        const question = await insertOne<{ id: string }>("survey_questions", {
          survey_version_id: version.id,
          section_id: section.id,
          code: `S${sectionIndex + 1}Q${questionIndex + 1}`,
          title: questionSeed.title,
          question_type: questionSeed.type ?? "SHORT_TEXT",
          required: questionSeed.required ?? true,
          position: questionIndex + 1,
        });
        ids.questionIds!.push(question.id);

        for (const [optionIndex, label] of (questionSeed.options ?? []).entries()) {
          await insertOne("question_options", {
            question_id: question.id,
            code: `O${optionIndex + 1}`,
            label,
            value: `${optionIndex + 1}`,
            position: optionIndex + 1,
          });
        }
      }
    }

    const { error: publishError } = await admin()
      .from("survey_versions")
      .update({ status: "PUBLISHED", published_at: new Date(now).toISOString() })
      .eq("id", version.id);
    if (publishError) {
      throw new Error(`Falha ao publicar versão da fixture: ${publishError.message}`);
    }

    // Um ciclo encerrado precisa de período no passado, não só de `status`:
    // `application_accepts_responses()` olha as duas coisas.
    const period = cycleStatus === "CLOSED"
      ? { opens_at: new Date(now - 172_800_000).toISOString(), closes_at: new Date(now - 86_400_000).toISOString() }
      : { opens_at: new Date(now - 60_000).toISOString(), closes_at: new Date(now + 86_400_000).toISOString() };

    const applicationCode = `${surveyCode}-1`;
    const application = await insertOne<{ id: string }>("survey_applications", {
      survey_version_id: version.id,
      code: applicationCode,
      name: "Ciclo de teste E2E",
      status: cycleStatus,
      ...period,
      anonymous,
      // Sem RPC nem tela grava `access_mode` — o padrão da tabela é RESTRICTED,
      // que exigiria uma linha em `application_participants`. INSTITUTIONAL é
      // o único jeito de a pessoa de teste ver o ciclo sem esse vínculo extra.
      access_mode: "INSTITUTIONAL",
    });
    ids.applicationId = application.id;

    return {
      email,
      fullName,
      employeeNumber,
      applicationCode,
      surveyName,
      questionTitle: sections[0].questions[0].title,
      anonymous,
      cycleStatus,
      sections,
      ids: ids as SurveyFixtureIds,
    };
  } catch (error) {
    await teardownParticipantSurveyFixture(ids);
    throw error;
  }
}

/**
 * Desfaz `seedParticipantSurveyFixture()` — chamado depois do teste, contra
 * um projeto Supabase real e persistente (sem `supabase db reset` para
 * limpar sozinho). Aceita ids parciais: uma seed que falhou na metade só tem
 * os ids criados até ali, e cada passo abaixo é pulado sem o seu.
 *
 * A ordem segue de baixo para cima porque boa parte das FKs deste esquema é
 * RESTRICT, não CASCADE (`survey_applications`, `submissions`, `answers` —
 * ver `20260730200000_initial_platform_schema.sql`); a mesma armadilha que
 * `fc_excluir_pesquisa_rascunho` resolve para exclusão de rascunho, mas essa
 * RPC exige `can_manage_surveys()` via `auth.uid()` (inexistente com chave de
 * serviço) e rejeita versão publicada — não dá para reutilizá-la aqui. Antes
 * de apagar seção/pergunta é preciso voltar a versão para DRAFT: o trigger
 * `enforce_draft_survey_structure` bloqueia alterações estruturais em versão
 * publicada, e a fixture publica a versão de propósito (para a pesquisa
 * aparecer no catálogo).
 *
 * `tb_bilhete_anonimo` não aparece aqui porque suas três FKs são CASCADE —
 * o bilhete de um ciclo anônimo sai junto com a submissão.
 *
 * Best-effort: um passo que falha só gera aviso, para não derrubar o
 * resultado do teste por causa da limpeza.
 */
export async function teardownParticipantSurveyFixture(ids: Partial<SurveyFixtureIds>): Promise<void> {
  const { authUserId, personId, surveyId, versionId, questionIds, applicationId } = ids;

  async function step(label: string, action: () => PromiseLike<{ error: { message: string } | null }>) {
    try {
      const { error } = await action();
      if (error) console.warn(`Falha ao limpar fixture de E2E (${label}): ${error.message}`);
    } catch (error) {
      console.warn(`Falha ao limpar fixture de E2E (${label}):`, error);
    }
  }

  if (applicationId) {
    // `submissions` (RESTRICT de application/participant/pessoa) precisa sair
    // antes de tudo o mais; `answers`/`answer_options` vêm junto por CASCADE.
    await step("submissions", () => admin().from("submissions").delete().eq("application_id", applicationId));
    await step("application_participants", () =>
      admin().from("application_participants").delete().eq("application_id", applicationId));
    await step("survey_applications", () => admin().from("survey_applications").delete().eq("id", applicationId));
  }

  if (versionId) {
    await step("reabrir versão como rascunho", () =>
      admin().from("survey_versions").update({ status: "DRAFT" }).eq("id", versionId));
    if (questionIds?.length) {
      await step("question_options", () =>
        admin().from("question_options").delete().in("question_id", questionIds));
    }
    await step("survey_questions", () =>
      admin().from("survey_questions").delete().eq("survey_version_id", versionId));
    await step("survey_sections", () =>
      admin().from("survey_sections").delete().eq("survey_version_id", versionId));
    await step("survey_versions", () => admin().from("survey_versions").delete().eq("id", versionId));
  }

  if (surveyId) {
    await step("surveys", () => admin().from("surveys").delete().eq("id", surveyId));
  }

  if (personId) {
    await step("people", () => admin().from("people").delete().eq("id", personId));
  }

  if (authUserId) {
    const { error: authError } = await admin().auth.admin.deleteUser(authUserId);
    if (authError) console.warn(`Falha ao limpar fixture de E2E (usuário de auth): ${authError.message}`);
  }
}
