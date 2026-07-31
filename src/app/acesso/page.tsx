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
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
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
    <main className="relative min-h-screen overflow-hidden bg-[#061a2f] px-5 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(0,18,45,.86),rgba(0,59,112,.7)),url('https://i.postimg.cc/RFw7RxXC/image.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(0,168,214,.16),transparent_30%),radial-gradient(circle_at_80%_85%,rgba(11,143,88,.18),transparent_30%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 text-white">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-black text-[#003b70] shadow-lg">Ag</div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">AgSUS</p>
              <p className="font-extrabold">Pesquisas e Avaliações</p>
            </div>
          </Link>
          <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-blue-50 backdrop-blur">
            Voltar ao início
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[520px] overflow-hidden rounded-[30px] bg-[#003b70] shadow-[0_40px_120px_rgba(0,0,0,.55)] ring-1 ring-white/10">
            <div className="agsus-stripe" aria-hidden="true" />
            <div className="bg-white px-7 py-8 text-[#10243e] sm:px-10 sm:py-10">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#edf5fc] text-xl font-black text-[#003b70] shadow-sm">Ag</div>
              <p className="mt-6 text-center text-xs font-black uppercase tracking-[0.2em] text-[#0b8f58]">Acesso institucional</p>
              <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-[#003b70]">AgSUS Pesquisas</h1>
              <p className="mt-2 text-center text-sm font-bold text-slate-700">Ciclo de Devolutivas e Desenvolvimento Individual</p>
              <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-500">
                Acesso exclusivo aos participantes cadastrados no CDDI 2026.
              </p>

              {sent ? (
                <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <strong className="block text-lg text-emerald-900">Link enviado com sucesso</strong>
                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    Verifique a caixa de entrada de <b>{email.trim().toLowerCase()}</b>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-900"
                  >
                    Usar outro e-mail
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-7 space-y-4">
                  <div>
                    <label htmlFor="email" className="text-sm font-black text-slate-700">E-mail institucional</label>
                    <div className="mt-2 flex items-center rounded-xl border border-[#bfd0df] bg-white px-4 transition focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-blue-100">
                      <span className="text-slate-400">✉</span>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="nome@agenciasus.org.br"
                        required
                        className="w-full border-0 bg-transparent px-3 py-4 outline-none"
                      />
                    </div>
                  </div>

                  {message && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full rounded-xl bg-[#003b70] px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#005292] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Enviando link seguro..." : "Receber link de acesso"}
                  </button>
                </form>
              )}

              <div className="mt-6 border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
                Ao continuar, você receberá um link pessoal e seguro para acessar sua avaliação.
              </div>
            </div>
            <div className="agsus-stripe" aria-hidden="true" />
          </div>
        </section>
      </div>
    </main>
  );
}
