"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, FileText, Info, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Button } from "@/components/ui/button";
import { ErrorSummary } from "@/components/ui/feedback";
import { Checkbox, Input, Textarea } from "@/components/ui/form-controls";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { nowLocalInputValue, periodIssues, publishBlockedMessage } from "@/lib/survey-cycle-period";

const schema = z.object({
  code: z.string().min(3, "Informe um código com pelo menos 3 caracteres.").max(30),
  name: z.string().min(5, "Informe um nome mais descritivo.").max(140),
  description: z.string().max(600).optional(),
  applicationName: z.string().min(5, "Informe o nome do primeiro ciclo.").max(160),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  anonymous: z.boolean(),
  allowDrafts: z.boolean(),
}).superRefine((data, ctx) => {
  // A mesma regra vale no banco (create_survey_draft). Aqui ela só antecipa o
  // erro para o campo certo, antes de gastar uma ida ao servidor.
  for (const issue of periodIssues(data.opensAt ?? "", data.closesAt ?? "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
  }
});

type FormValues = z.infer<typeof schema>;

/**
 * O formulário é dividido em três etapas. Só a última oferece as ações que
 * gravam ("Criar rascunho" e "Publicar"); as anteriores avançam com "Prosseguir"
 * e saem com "Cancelar", de modo que nenhuma etapa intermediária pareça capaz de
 * concluir a criação.
 */
const STEPS = [
  { title: "Identificação", description: "Como a avaliação será reconhecida no catálogo institucional.", fields: ["code", "name", "description"] },
  { title: "Ciclo e período", description: "O primeiro ciclo de aplicação e a janela em que ele ficará disponível.", fields: ["applicationName", "opensAt", "closesAt", "allowDrafts"] },
  { title: "Revisão", description: "Confira os dados antes de criar a avaliação.", fields: [] },
] as const satisfies ReadonlyArray<{ title: string; description: string; fields: ReadonlyArray<keyof FormValues> }>;

const LAST_STEP = STEPS.length - 1;

function reviewDateLabel(value: string | undefined) {
  if (!value) return "Não definido";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não definido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed);
}

export default function NewSurveyPage() {
  const router = useRouter();
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const [step, setStep] = useState(0);
  // Distingue qual das duas ações da última etapa está em curso, para que só o
  // botão acionado exiba o indicador de carregamento.
  const [intent, setIntent] = useState<"DRAFT" | "PUBLISH" | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      applicationName: "",
      opensAt: "",
      closesAt: "",
      anonymous: false,
      allowDrafts: true,
    },
  });

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="nova avaliação"
      unidentifiedTitle="Não foi possível criar a avaliação"
      restrictedTitle="Criação de avaliações restrita"
      restrictedDescription="Somente a administração pode criar e configurar novas avaliações."
    />;
  }

  const validationErrors = Object.values(form.formState.errors)
    .map((fieldError) => fieldError?.message)
    .filter((message): message is string => Boolean(message));

  const values = form.getValues();
  const minOpensAt = nowLocalInputValue();

  async function goToNextStep() {
    // Valida só os campos da etapa atual: exigir o formulário inteiro impediria
    // avançar da primeira etapa por causa de campos que ainda nem apareceram.
    const valid = await form.trigger([...STEPS[step].fields]);
    if (!valid) return;
    setStep((current) => Math.min(current + 1, LAST_STEP));
  }

  async function submit(values: FormValues) {
    // Um rascunho preenchido hoje pode ser publicado dias depois; o período
    // informado envelhece nesse intervalo. A publicação só segue com período
    // ainda válido, e o toast diz exatamente o que corrigir.
    if (intent === "PUBLISH") {
      const blocked = publishBlockedMessage(values.opensAt ?? "", values.closesAt ?? "");
      if (blocked) {
        toast.error(blocked);
        setStep(1);
        setIntent(null);
        return;
      }
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: createError } = await supabase.rpc("create_survey_draft", {
        p_code: values.code,
        p_name: values.name,
        p_description: values.description || "",
        p_application_name: values.applicationName,
        p_opens_at: values.opensAt ? new Date(values.opensAt).toISOString() : null,
        p_closes_at: values.closesAt ? new Date(values.closesAt).toISOString() : null,
        p_anonymous: values.anonymous,
        p_allow_drafts: values.allowDrafts,
      });
      if (createError) throw createError;
      const result = data as { code?: string; surveyId?: string } | null;
      const code = result?.code ?? values.code.toUpperCase();

      // Publicar exige estrutura, e a avaliação nasce só com a seção
      // "Introdução", sem perguntas — o banco recusaria o PUBLISH agora. Em vez
      // de prometer o que falharia, a ação leva ao construtor, onde a estrutura
      // é montada e a publicação acontece pela tela de operação do ciclo.
      if (intent === "PUBLISH" && result?.surveyId) {
        toast.success(`Avaliação ${code} criada. Adicione as perguntas para concluir a publicação.`);
        router.push(`/admin/pesquisas/${result.surveyId}`);
        return;
      }

      toast.success(`Avaliação ${code} criada como rascunho.`);
      router.push("/admin/pesquisas");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível criar a avaliação.");
    } finally {
      setIntent(null);
    }
  }

  const submitting = form.formState.isSubmitting;

  return <PlatformShell user={guard.user} eyebrow="Administração" title="Nova avaliação">
    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <form onSubmit={form.handleSubmit(submit)} noValidate className="rounded-[2rem] border border-[var(--border-subtle)] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--brand-primary)]"><Sparkles className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--brand-secondary)]">Construtor institucional</p><h2 className="mt-1 text-3xl font-black text-[var(--brand-primary)]">Crie a base da avaliação</h2><p className="mt-2 leading-7 text-slate-600">O sistema criará a avaliação, a primeira versão, o ciclo inicial e uma seção de introdução. Depois você poderá adicionar perguntas e público.</p></div></div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Etapas da criação">
          {STEPS.map((item, index) => {
            const state = index === step ? "current" : index < step ? "done" : "todo";
            return (
              <li
                key={item.title}
                aria-current={state === "current" ? "step" : undefined}
                className={state === "current"
                  ? "rounded-2xl border border-blue-300 bg-blue-50 p-4"
                  : state === "done"
                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                    : "rounded-2xl border border-slate-200 bg-slate-50 p-4"}
              >
                <div className="flex items-center gap-2">
                  <span className={state === "done"
                    ? "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white"
                    : state === "current"
                      ? "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--brand-solid)] text-xs font-black text-white"
                      : "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-300 text-xs font-black text-white"}>
                    {state === "done" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <p className={state === "todo" ? "text-sm font-black text-slate-500" : "text-sm font-black text-[var(--brand-primary)]"}>{item.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
              </li>
            );
          })}
        </ol>

        <ErrorSummary errors={validationErrors} className="mt-6" />

        {step === 0 && (
          <div className="mt-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Código institucional" placeholder="EX.: CLIMA-2027" required error={form.formState.errors.code?.message} {...form.register("code")} />
              <Input label="Nome da avaliação" placeholder="Avaliação de Clima Organizacional" required error={form.formState.errors.name?.message} {...form.register("name")} />
            </div>
            <Textarea label="Descrição" rows={4} placeholder="Objetivo, público e contexto da avaliação." error={form.formState.errors.description?.message} containerClassName="mt-5" {...form.register("description")} />
          </div>
        )}

        {step === 1 && (
          <div className="mt-8">
            <Input label="Nome do primeiro ciclo" placeholder="Avaliação de Clima 2027 — 1º ciclo" required error={form.formState.errors.applicationName?.message} {...form.register("applicationName")} />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input type="datetime-local" label="Abertura planejada" min={minOpensAt} hint="Não pode ser anterior à data e hora atuais." error={form.formState.errors.opensAt?.message} {...form.register("opensAt")} />
              {/* `min` fixa apenas o piso "agora": acompanhar a abertura em tempo
                  real exigiria `watch()`, que desliga a memoização da tela toda.
                  A ordem entre as datas é cobrada por periodIssues() ao
                  prosseguir e revalidada no banco. */}
              <Input type="datetime-local" label="Encerramento planejado" min={minOpensAt} hint="Precisa ocorrer após a abertura." error={form.formState.errors.closesAt?.message} {...form.register("closesAt")} />
            </div>
            <div className="mt-6 grid gap-3">
              <Checkbox label="Permitir rascunhos" description="A pessoa poderá salvar e continuar depois." {...form.register("allowDrafts")} />
              {/* A opção "Avaliação anônima" foi retirada porque o anonimato
                  ainda não é estrutural: a submissão guarda quem respondeu, e
                  quem administra consegue reidentificar. Oferecer a caixa com
                  um aviso ao lado manteria a promessa na tela — quem marca
                  raramente lê a ressalva. O banco também recusa o valor
                  (gatilho `tba_aplicacao_anonima`). */}
              <p className="flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-sm leading-6 text-[var(--status-info-text)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">Toda avaliação é identificada.</strong> O modo anônimo está indisponível: as respostas ainda ficam vinculadas a quem respondeu, então a plataforma não pode prometer anonimato. A opção volta quando a separação entre identidade e conteúdo estiver implementada.
                </span>
              </p>
            </div>
          </div>
        )}

        {step === LAST_STEP && (
          <div className="mt-8 space-y-4">
            <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-2">
              {[
                ["Código institucional", values.code.toUpperCase() || "Não informado"],
                ["Nome da avaliação", values.name || "Não informado"],
                ["Primeiro ciclo", values.applicationName || "Não informado"],
                ["Abertura planejada", reviewDateLabel(values.opensAt)],
                ["Encerramento planejado", reviewDateLabel(values.closesAt)],
                ["Rascunhos", values.allowDrafts ? "Permitidos" : "Não permitidos"],
                // Sempre nominal: o modo anônimo está indisponível enquanto o
                // anonimato não for estrutural.
                ["Identificação", "Nominal"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-black uppercase tracking-[.12em] text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm font-bold text-[var(--brand-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
            {values.description && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-400">Descrição</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{values.description}</p>
              </div>
            )}
            <p className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <strong className="font-black">Criar rascunho</strong> registra a avaliação sem publicá-la. <strong className="font-black">Publicar</strong> registra e abre o construtor para você adicionar as perguntas — a publicação se conclui na operação do ciclo, que exige ao menos uma pergunta.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={submitting} className="mr-auto">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </Button>
          )}

          <Link href="/admin/pesquisas" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100">Cancelar</Link>

          {step < LAST_STEP ? (
            <Button size="lg" onClick={() => void goToNextStep()}>
              Prosseguir
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          ) : (
            <>
              <Button type="submit" variant="secondary" size="lg" disabled={submitting} onClick={() => setIntent("DRAFT")}>
                {submitting && intent === "DRAFT" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Criar rascunho
              </Button>
              <Button type="submit" size="lg" disabled={submitting} onClick={() => setIntent("PUBLISH")}>
                {submitting && intent === "PUBLISH" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Publicar
              </Button>
            </>
          )}
        </div>
      </form>

      <aside className="space-y-5">
        <article className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><ShieldCheck className="h-6 w-6" /></span><h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">Governança desde o início</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Toda avaliação nasce em rascunho, com versão controlada e autoria registrada. A publicação ocorre somente após revisão da administração.</p></article>
        {[{ icon: FileText, title: "Próximo passo", text: "Adicionar seções, perguntas e alternativas no construtor." },{ icon: CalendarDays, title: "Ciclo", text: "Definir período, público, regras de acesso e notificações." }].map(({icon:Icon,title,text}) => <article key={title} className="rounded-3xl border border-[var(--border-subtle)] bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-[var(--brand-secondary)]" /><h3 className="mt-4 text-lg font-black text-[var(--brand-primary)]">{title}</h3><p className="mt-2 leading-6 text-slate-600">{text}</p></article>)}
      </aside>
    </section>
  </PlatformShell>;
}
