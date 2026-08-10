"use client";

import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Mail, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type PeopleBaseSummary = {
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

const emptySummary: PeopleBaseSummary = {
  totalPeople: 0,
  activePeople: 0,
  inactivePeople: 0,
  withInstitutionalEmail: 0,
  withoutInstitutionalEmail: 0,
  authenticatedPeople: 0,
  withChosenAvatar: 0,
  linkedToApplication: 0,
  availableToLink: 0,
};

export function PeopleBaseSummaryCard() {
  const [summary, setSummary] = useState<PeopleBaseSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("get_admin_people_base_summary", {
        target_application_id: null,
      });
      if (error) throw error;
      setSummary((data ?? emptySummary) as PeopleBaseSummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar a base institucional.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = [
    { label: "Pessoas na base", value: summary.totalPeople, helper: "cadastros institucionais", icon: UsersRound, tone: "text-[#003b70] bg-blue-50" },
    { label: "Ativas e disponíveis", value: summary.availableToLink, helper: "podem ser vinculadas", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Com e-mail", value: summary.withInstitutionalEmail, helper: "aptas ao acesso", icon: Mail, tone: "text-violet-700 bg-violet-50" },
    { label: "Já autenticadas", value: summary.authenticatedPeople, helper: "entraram na plataforma", icon: KeyRound, tone: "text-amber-700 bg-amber-50" },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Base mestra de pessoas</p>
          <h2 className="mt-1 text-xl font-black text-[#003b70]">Disponibilidade para avaliações</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">A importação atualiza estes cadastros. A autorização para responder é realizada separadamente em cada avaliação.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
        </button>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
        {metrics.map(({ label, value, helper, icon: Icon, tone }) => (
          <article key={label} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-slate-950">{loading ? "—" : value.toLocaleString("pt-BR")}</strong><small className="text-xs text-slate-500">{helper}</small></div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
            </div>
          </article>
        ))}
      </div>

      {!loading && summary.totalPeople <= 1 && (
        <div className="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:mx-6 sm:mb-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span><strong>A base ainda não foi carregada.</strong> Há somente {summary.totalPeople} pessoa cadastrada. Reimporte a planilha oficial pela opção “Atualizar base” para disponibilizar os trabalhadores na vinculação de avaliações.</span>
        </div>
      )}
    </section>
  );
}
