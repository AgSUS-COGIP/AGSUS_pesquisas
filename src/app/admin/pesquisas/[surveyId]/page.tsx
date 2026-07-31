"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlignLeft, CheckSquare, CircleDot, FileText, Loader2, Plus, Save, Settings2, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Option = { id?: string; label: string; value: string; score?: number | null; position?: number };
type Question = { id: string; code: string; title: string; description: string | null; questionType: string; required: boolean; position: number; options: Option[] };
type Section = { id: string; code: string; title: string; description: string | null; position: number; questions: Question[] };
type BuilderData = {
  status: string;
  survey: { id: string; code: string; name: string; description: string | null; status: string };
  version: { id: string; number: number; status: string };
  application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null };
  sections: Section[];
};

const QUESTION_TYPES = [
  ["SHORT_TEXT", "Texto curto", FileText],
  ["LONG_TEXT", "Texto longo", AlignLeft],
  ["SINGLE_CHOICE", "Escolha única", CircleDot],
  ["MULTIPLE_CHOICE", "Múltipla escolha", CheckSquare],
  ["SCALE", "Escala", SlidersHorizontal],
] as const;

function typeLabel(type: string) {
  return QUESTION_TYPES.find(([value]) => value === type)?.[1] ?? type;
}

export default function SurveyBuilderPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const { context, loading, error } = usePlatformContext();
  const [builder, setBuilder] = useState<BuilderData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [questionDialog, setQuestionDialog] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionDescription, setQuestionDescription] = useState("");
  const [questionType, setQuestionType] = useState("SHORT_TEXT");
  const [required, setRequired] = useState(true);
  const [optionsText, setOptionsText] = useState("Opção 1\nOpção 2");
  const [working, setWorking] = useState(false);

  async function loadBuilder() {
    setDataLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: builderError } = await supabase.rpc("get_survey_builder", { target_survey_id: surveyId });
      if (builderError) throw builderError;
      setBuilder(data as BuilderData);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar o construtor.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (context?.person) void loadBuilder();
  }, [context?.person, surveyId]);

  const totalQuestions = useMemo(() => builder?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0, [builder]);

  async function addSection() {
    if (!sectionTitle.trim()) return toast.error("Informe o título da seção.");
    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: sectionError } = await supabase.rpc("add_survey_section", {
        target_survey_id: surveyId,
        section_title: sectionTitle,
        section_description: sectionDescription || null,
      });
      if (sectionError) throw sectionError;
      toast.success("Seção adicionada.");
      setSectionDialog(false);
      setSectionTitle("");
      setSectionDescription("");
      await loadBuilder();
    } catch (sectionError) {
      toast.error(sectionError instanceof Error ? sectionError.message : "Não foi possível criar a seção.");
    } finally { setWorking(false); }
  }

  async function addQuestion() {
    if (!questionDialog || !questionTitle.trim()) return toast.error("Informe o enunciado da pergunta.");
    const needsOptions = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SCALE"].includes(questionType);
    const optionLines = optionsText.split("\n").map((line) => line.trim()).filter(Boolean);
    if (needsOptions && optionLines.length < 2) return toast.error("Informe pelo menos duas alternativas.");
    const options = optionLines.map((label, index) => ({ label, value: String(index + 1), score: questionType === "SCALE" ? index + 1 : null }));
    setWorking(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: questionError } = await supabase.rpc("add_survey_question", {
        target_survey_id: surveyId,
        target_section_id: questionDialog,
        question_title: questionTitle,
        question_description: questionDescription || "",
        question_type: questionType,
        is_required: required,
        question_options: needsOptions ? options : [],
      });
      if (questionError) throw questionError;
      toast.success("Pergunta adicionada.");
      setQuestionDialog(null);
      setQuestionTitle("");
      setQuestionDescription("");
      setQuestionType("SHORT_TEXT");
      setRequired(true);
      setOptionsText("Opção 1\nOpção 2");
      await loadBuilder();
    } catch (questionError) {
      toast.error(questionError instanceof Error ? questionError.message : "Não foi possível adicionar a pergunta.");
    } finally { setWorking(false); }
  }

  async function deleteQuestion(question: Question) {
    if (!window.confirm(`Excluir a pergunta “${question.title}”?`)) return;
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: deleteError } = await supabase.rpc("delete_survey_question", { target_question_id: question.id });
      if (deleteError) throw deleteError;
      toast.success("Pergunta excluída.");
      await loadBuilder();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a pergunta.");
    }
  }

  if (loading) return <PlatformSkeleton title="Carregando construtor" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_SURVEYS")) return <main className="p-10 text-red-700">Acesso restrito à Equipe Técnica.</main>;
  const person = context.person;
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };

  return <PlatformShell user={user} eyebrow="Equipe Técnica" title={builder?.survey.name ?? "Construtor de pesquisa"} actions={<Link href="/admin/pesquisas" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 sm:inline-flex">Voltar ao catálogo</Link>}>
    {dataLoading || !builder ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003b70]" /></div> : <>
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#062f54,#006b8f)] p-7 text-white shadow-xl"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">{builder.survey.code}</span><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Versão {builder.version.number}</span><span className="rounded-full bg-amber-300/20 px-4 py-2 text-xs font-black text-amber-100">{builder.version.status}</span></div><h2 className="mt-5 text-3xl font-black sm:text-4xl">Estruture o formulário</h2><p className="mt-3 leading-7 text-cyan-50/80">Organize o instrumento em seções, escolha o tipo de resposta e configure alternativas sem editar código.</p></div><button type="button" onClick={() => setSectionDialog(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-[#003b70]"><Plus className="h-5 w-5" /> Nova seção</button></div></section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">{[["Seções",builder.sections.length],["Perguntas",totalQuestions],["Ciclo",builder.application.status]].map(([label,value])=><article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p><strong className="mt-2 block text-2xl font-black text-[#003b70]">{value}</strong></article>)}</section>

      <div className="mt-6 space-y-5">{builder.sections.map((section, sectionIndex)=><section key={section.id} className="rounded-[2rem] border border-slate-200 bg-white shadow-sm"><header className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 font-black text-[#003b70]">{sectionIndex+1}</span><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#0b8f58]">{section.code}</p><h3 className="mt-1 text-xl font-black text-[#003b70]">{section.title}</h3><p className="mt-1 text-sm text-slate-500">{section.description || "Sem descrição."}</p></div></div><button type="button" onClick={()=>setQuestionDialog(section.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" /> Adicionar pergunta</button></header><div className="p-5">{section.questions.length ? <div className="space-y-3">{section.questions.map((question,index)=><article key={question.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-start"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-black text-[#003b70]">{index+1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[#003b70]">{question.title}</strong>{question.required && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-700">Obrigatória</span>}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{typeLabel(question.questionType)}</span></div>{question.description && <p className="mt-2 text-sm text-slate-500">{question.description}</p>}{question.options.length>0 && <div className="mt-3 flex flex-wrap gap-2">{question.options.map((option)=><span key={`${question.id}-${option.value}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">{option.label}</span>)}</div>}</div><button type="button" onClick={()=>deleteQuestion(question)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"><Trash2 className="h-4 w-4" /> Excluir</button></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Settings2 className="mx-auto h-8 w-8 text-slate-300" /><strong className="mt-3 block text-[#003b70]">Seção ainda sem perguntas</strong><p className="mt-2 text-sm text-slate-500">Adicione o primeiro item desta etapa.</p></div>}</div></section>)}</div>
    </>}

    {sectionDialog && <Modal title="Nova seção" subtitle="Crie uma etapa para organizar o formulário." onClose={()=>setSectionDialog(false)}><label className="block text-sm font-black text-slate-700">Título<input value={sectionTitle} onChange={(e)=>setSectionTitle(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><label className="mt-4 block text-sm font-black text-slate-700">Descrição<textarea rows={3} value={sectionDescription} onChange={(e)=>setSectionDescription(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><button type="button" disabled={working} onClick={addSection} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white disabled:opacity-50">{working?<Loader2 className="h-5 w-5 animate-spin"/>:<Save className="h-5 w-5"/>} Salvar seção</button></Modal>}

    {questionDialog && <Modal title="Nova pergunta" subtitle="Configure o tipo de resposta e as alternativas." onClose={()=>setQuestionDialog(null)}><label className="block text-sm font-black text-slate-700">Enunciado<input value={questionTitle} onChange={(e)=>setQuestionTitle(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><label className="mt-4 block text-sm font-black text-slate-700">Descrição<textarea rows={2} value={questionDescription} onChange={(e)=>setQuestionDescription(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><div className="mt-4 grid gap-2 sm:grid-cols-2">{QUESTION_TYPES.map(([value,label,Icon])=><button key={value} type="button" onClick={()=>setQuestionType(value)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-black ${questionType===value?"border-blue-400 bg-blue-50 text-[#003b70]":"border-slate-200 bg-white text-slate-600"}`}><Icon className="h-5 w-5" />{label}</button>)}</div>{["SINGLE_CHOICE","MULTIPLE_CHOICE","SCALE"].includes(questionType)&&<label className="mt-4 block text-sm font-black text-slate-700">Alternativas, uma por linha<textarea rows={5} value={optionsText} onChange={(e)=>setOptionsText(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>}<label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><input type="checkbox" checked={required} onChange={(e)=>setRequired(e.target.checked)} className="h-5 w-5 accent-[#003b70]" /><span className="font-black text-slate-700">Resposta obrigatória</span></label><button type="button" disabled={working} onClick={addQuestion} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white disabled:opacity-50">{working?<Loader2 className="h-5 w-5 animate-spin"/>:<Save className="h-5 w-5"/>} Salvar pergunta</button></Modal>}
  </PlatformShell>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <><button type="button" aria-label="Fechar janela" onClick={onClose} className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-sm" /><section role="dialog" aria-modal="true" className="fixed inset-x-4 top-[6vh] z-[100] mx-auto max-h-[88vh] max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-6"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#0b8f58]">Construtor</p><h2 className="mt-1 text-2xl font-black text-[#003b70]">{title}</h2><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><X className="h-5 w-5" /></button></header><div className="p-6">{children}</div></section></>;
}
