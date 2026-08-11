"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const schema = z.object({
  code: z.string().min(3, "Informe um código com pelo menos 3 caracteres.").max(30),
  name: z.string().min(5, "Informe um nome mais descritivo.").max(140),
  description: z.string().max(600).optional(),
  applicationName: z.string().min(5, "Informe o nome do primeiro ciclo.").max(160),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  anonymous: z.boolean(),
  allowDrafts: z.boolean(),
}).refine((data) => !data.opensAt || !data.closesAt || new Date(data.closesAt) > new Date(data.opensAt), {
  message: "O encerramento deve ser posterior à abertura.",
  path: ["closesAt"],
});

type FormValues = z.infer<typeof schema>;

export default function NewSurveyPage() {
  const router = useRouter();
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
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

  async function submit(values: FormValues) {
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
      const result = data as { code?: string } | null;
      toast.success(`Avaliação ${result?.code ?? values.code.toUpperCase()} criada como rascunho.`);
      router.push("/admin/pesquisas");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível criar a avaliação.");
    }
  }

  return <PlatformShell user={guard.user} eyebrow="Administração" title="Nova avaliação">
    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <form onSubmit={form.handleSubmit(submit)} noValidate className="rounded-[2rem] border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[var(--brand-primary)]"><Sparkles className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--brand-secondary)]">Construtor institucional</p><h2 className="mt-1 text-3xl font-black text-[var(--brand-primary)]">Crie a base da avaliação</h2><p className="mt-2 leading-7 text-slate-600">O sistema criará a avaliação, a primeira versão, o ciclo inicial e uma seção de introdução. Depois você poderá adicionar perguntas e público.</p></div></div>

        <ErrorSummary errors={validationErrors} className="mt-6" />

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Input label="Código institucional" placeholder="EX.: CLIMA-2027" required error={form.formState.errors.code?.message} {...form.register("code")} />
          <Input label="Nome da avaliação" placeholder="Avaliação de Clima Organizacional" required error={form.formState.errors.name?.message} {...form.register("name")} />
        </div>

        <Textarea label="Descrição" rows={4} placeholder="Objetivo, público e contexto da avaliação." error={form.formState.errors.description?.message} containerClassName="mt-5" {...form.register("description")} />
        <Input label="Nome do primeiro ciclo" placeholder="Avaliação de Clima 2027 — 1º ciclo" required error={form.formState.errors.applicationName?.message} containerClassName="mt-5" {...form.register("applicationName")} />

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Input type="datetime-local" label="Abertura planejada" error={form.formState.errors.opensAt?.message} {...form.register("opensAt")} />
          <Input type="datetime-local" label="Encerramento planejado" error={form.formState.errors.closesAt?.message} {...form.register("closesAt")} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Checkbox label="Permitir rascunhos" description="A pessoa poderá salvar e continuar depois." {...form.register("allowDrafts")} />
          <Checkbox label="Avaliação anônima" description="Respostas sem identificação nominal nos resultados." {...form.register("anonymous")} />
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Link href="/admin/pesquisas" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</Link>
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Criar rascunho
          </Button>
        </div>
      </form>

      <aside className="space-y-5">
        <article className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><ShieldCheck className="h-6 w-6" /></span><h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">Governança desde o início</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Toda avaliação nasce em rascunho, com versão controlada e autoria registrada. A publicação ocorre somente após revisão da administração.</p></article>
        {[{ icon: FileText, title: "Próximo passo", text: "Adicionar seções, perguntas e alternativas no construtor." },{ icon: CalendarDays, title: "Ciclo", text: "Definir período, público, regras de acesso e notificações." }].map(({icon:Icon,title,text}) => <article key={title} className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-[var(--brand-secondary)]" /><h3 className="mt-4 text-lg font-black text-[var(--brand-primary)]">{title}</h3><p className="mt-2 leading-6 text-slate-600">{text}</p></article>)}
      </aside>
    </section>
  </PlatformShell>;
}
