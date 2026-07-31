"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

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
  const { context, loading, error } = usePlatformContext();
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

  if (loading) return <PlatformSkeleton title="Preparando nova pesquisa" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_SURVEYS")) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><section className="max-w-lg rounded-3xl bg-white p-8 shadow-xl"><h1 className="text-3xl font-black text-[#003b70]">Acesso restrito</h1><p className="mt-3 text-slate-600">Somente a Equipe Técnica pode criar pesquisas.</p><Link href="/area" className="mt-6 inline-flex rounded-xl bg-[#003b70] px-5 py-3 font-black text-white">Voltar</Link></section></main>;
  }

  const person = context.person;
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };

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
      toast.success(`Pesquisa ${result?.code ?? values.code.toUpperCase()} criada como rascunho.`);
      router.push("/admin/pesquisas");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Não foi possível criar a pesquisa.");
    }
  }

  const fieldClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";

  return <PlatformShell user={user} eyebrow="Equipe Técnica" title="Nova pesquisa">
    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-[2rem] border border-[#d7e5f2] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><Sparkles className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#0b8f58]">Construtor institucional</p><h2 className="mt-1 text-3xl font-black text-[#003b70]">Crie a base da pesquisa</h2><p className="mt-2 leading-7 text-slate-600">O sistema criará a pesquisa, a primeira versão, o ciclo inicial e uma seção de introdução. Depois você poderá adicionar perguntas e público.</p></div></div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-black text-slate-700">Código institucional<input {...form.register("code")} placeholder="EX.: CLIMA-2027" className={fieldClass} />{form.formState.errors.code && <span className="mt-2 block text-xs font-bold text-red-600">{form.formState.errors.code.message}</span>}</label>
          <label className="text-sm font-black text-slate-700">Nome da pesquisa<input {...form.register("name")} placeholder="Pesquisa de Clima Organizacional" className={fieldClass} />{form.formState.errors.name && <span className="mt-2 block text-xs font-bold text-red-600">{form.formState.errors.name.message}</span>}</label>
        </div>

        <label className="mt-5 block text-sm font-black text-slate-700">Descrição<textarea {...form.register("description")} rows={4} placeholder="Objetivo, público e contexto da pesquisa." className={fieldClass} /></label>
        <label className="mt-5 block text-sm font-black text-slate-700">Nome do primeiro ciclo<input {...form.register("applicationName")} placeholder="Pesquisa de Clima 2027 — 1º ciclo" className={fieldClass} />{form.formState.errors.applicationName && <span className="mt-2 block text-xs font-bold text-red-600">{form.formState.errors.applicationName.message}</span>}</label>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-black text-slate-700">Abertura planejada<input type="datetime-local" {...form.register("opensAt")} className={fieldClass} /></label>
          <label className="text-sm font-black text-slate-700">Encerramento planejado<input type="datetime-local" {...form.register("closesAt")} className={fieldClass} />{form.formState.errors.closesAt && <span className="mt-2 block text-xs font-bold text-red-600">{form.formState.errors.closesAt.message}</span>}</label>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" {...form.register("allowDrafts")} className="mt-1 h-5 w-5 accent-[#003b70]" /><span><strong className="block text-slate-800">Permitir rascunhos</strong><small className="mt-1 block leading-5 text-slate-500">A pessoa poderá salvar e continuar depois.</small></span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" {...form.register("anonymous")} className="mt-1 h-5 w-5 accent-[#003b70]" /><span><strong className="block text-slate-800">Pesquisa anônima</strong><small className="mt-1 block leading-5 text-slate-500">Respostas sem identificação nominal nos resultados.</small></span></label>
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3"><Link href="/admin/pesquisas" className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-600">Cancelar</Link><button type="submit" disabled={form.formState.isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-6 py-3 font-black text-white shadow-lg transition hover:bg-[#075ea8] disabled:opacity-60">{form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}Criar rascunho</button></div>
      </form>

      <aside className="space-y-5">
        <article className="rounded-[2rem] bg-[linear-gradient(145deg,#003b70,#075ea8)] p-7 text-white shadow-xl"><ShieldCheck className="h-8 w-8 text-emerald-300" /><h3 className="mt-5 text-2xl font-black">Governança desde o início</h3><p className="mt-3 leading-7 text-blue-100">Toda pesquisa nasce em rascunho, com versão controlada e autoria registrada. A publicação ocorre somente após revisão da Equipe Técnica.</p></article>
        {[{ icon: FileText, title: "Próximo passo", text: "Adicionar seções, perguntas e alternativas no construtor." },{ icon: CalendarDays, title: "Ciclo", text: "Definir período, público, regras de acesso e notificações." }].map(({icon:Icon,title,text}) => <article key={title} className="rounded-3xl border border-[#d7e5f2] bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-[#0b8f58]" /><h3 className="mt-4 text-lg font-black text-[#003b70]">{title}</h3><p className="mt-2 leading-6 text-slate-600">{text}</p></article>)}
      </aside>
    </section>
  </PlatformShell>;
}
