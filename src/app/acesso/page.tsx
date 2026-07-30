"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) window.location.replace("/area");
    };
    void checkSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith("@agenciasus.org.br")) {
      setMessage("Utilize seu e-mail institucional @agenciasus.org.br.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/confirm?next=/area`;
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o link de acesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#edf3f8] px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#102c4c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-400/20" />
          <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-emerald-400/15" />
          <div className="relative">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">AgSUS</p>
            <h1 className="mt-4 max-w-lg text-4xl font-black leading-tight">Ciclo de Devolutivas e Desenvolvimento Individual</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
              Autoavaliação, avaliação da chefia, devolutivas e acompanhamento do desenvolvimento profissional em um ambiente seguro.
            </p>
          </div>
          <div className="relative grid gap-3 text-sm text-blue-100">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">Acesso restrito aos participantes cadastrados.</div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">O link de acesso é pessoal e enviado ao e-mail institucional.</div>
          </div>
        </section>

        <section className="flex items-center p-7 sm:p-12">
          <div className="mx-auto w-full max-w-md">
            <Link href="/" className="text-sm font-black text-[var(--primary)]">← Voltar ao início</Link>
            <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[var(--success)]">Acesso institucional</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--primary-dark)]">Entre no CDDI 2026</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Informe seu e-mail institucional. Você receberá um link seguro e de uso único para confirmar sua identidade.
            </p>

            {sent ? (
              <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <strong className="text-lg text-emerald-900">Verifique sua caixa de entrada</strong>
                <p className="mt-2 leading-7 text-emerald-800">Enviamos o link de acesso para <b>{email.trim().toLowerCase()}</b>.</p>
                <button type="button" onClick={() => setSent(false)} className="mt-5 rounded-xl border border-emerald-300 bg-white px-4 py-3 font-black text-emerald-900">Usar outro e-mail</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="text-sm font-black text-slate-700">E-mail institucional</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nome@agenciasus.org.br"
                    required
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                {message && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>}
                <button disabled={loading} className="w-full rounded-2xl bg-[var(--primary)] px-5 py-4 font-black text-white shadow-lg disabled:opacity-60">
                  {loading ? "Enviando link seguro..." : "Enviar link de acesso"}
                </button>
              </form>
            )}

            <p className="mt-8 text-xs leading-5 text-slate-500">
              Após a autenticação, a matrícula será solicitada somente quando o e-mail estiver associado a mais de um cadastro.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
