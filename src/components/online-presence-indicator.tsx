"use client";

import { UsersRound } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { listarPresencaOnline, registrarPresenca } from "@/lib/api/cliente-pessoas";
import { normalizeOnlinePresenceList, type OnlinePresencePerson } from "@/lib/online-presence";

type PresenceUser = {
  id?: string;
  fullName: string;
  institutionalEmail?: string | null;
  profileLabel: string;
  avatarUrl?: string | null;
};

/**
 * Intervalo da batida.
 *
 * O banco considera online quem bateu nos últimos 2 minutos, então 45 segundos
 * dá margem para uma batida perdida sem a pessoa piscar para fora da lista.
 * Baixar isso multiplica escrita sem melhorar nada perceptível.
 */
const HEARTBEAT_MS = 45_000;

/**
 * Mostra as pessoas autenticadas com a plataforma aberta.
 *
 * ## Por que não usa Realtime
 *
 * O desenho pretendido é "todos anunciam, só perfis configurados enxergam", e
 * canal Realtime privado não faz isso: o protocolo exige permissão de leitura
 * para **entrar** no canal, e sem entrar não se consegue anunciar. Até
 * 21/08/2026 a consequência era dupla — a lista mostrava apenas quem podia
 * vê-la, e todos os demais registravam `Unauthorized` no log a cada
 * carregamento de página.
 *
 * Hoje são duas chamadas independentes: **bater** (todo mundo, se a presença
 * estiver ligada) e **ler** (só quem tem permissão). A autorização de cada uma
 * é do banco, pelos mesmos portões que as políticas do Realtime usavam.
 *
 * A batida acontece mesmo para quem não vê a lista — é o que faz a pessoa
 * aparecer para quem vê. Por isso o `return null` de `canView` fica **depois**
 * dos efeitos, e não antes.
 */
export function OnlinePresenceIndicator({ user, canView }: { user: PresenceUser; canView: boolean }) {
  const [people, setPeople] = useState<OnlinePresencePerson[]>([]);
  const [beating, setBeating] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const identified = Boolean(user.id ?? user.institutionalEmail);

  const beat = useCallback(async () => {
    try {
      const resultado = await registrarPresenca();
      setBeating(resultado?.status === "OK");
    } catch {
      // Presença é acessório: falhar aqui não pode virar erro na tela nem
      // relatório de observabilidade. O indicador apenas deixa de piscar verde.
      setBeating(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setPeople(normalizeOnlinePresenceList(await listarPresencaOnline()));
    } catch {
      // Inclui o 403 de quem não tem permissão. Silencioso de propósito: o
      // componente já não é renderizado para essa pessoa.
      setPeople([]);
    }
  }, []);

  useEffect(() => {
    if (!identified) return;
    let active = true;

    const tick = () => {
      // Aba escondida não bate: presença deve refletir quem está de fato com a
      // tela aberta, não quantas abas esquecidas alguém deixou em segundo plano.
      if (document.visibilityState !== "visible") return;
      void beat();
      if (canView) void load();
    };

    tick();
    const timer = window.setInterval(() => { if (active) tick(); }, HEARTBEAT_MS);
    // Voltar para a aba atualiza na hora, em vez de esperar o próximo intervalo.
    document.addEventListener("visibilitychange", tick);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [beat, canView, identified, load]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!canView) return null;

  const count = people.length;
  const label = beating
    ? `${count} ${count === 1 ? "pessoa online" : "pessoas online"}`
    : "Sincronizando presença";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`${label}. Ver lista.`}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${beating ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.14)]" : "bg-slate-300"}`} aria-hidden="true" />
        <UsersRound className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline" aria-live="polite">{beating ? `${count} online` : "Sincronizando"}</span>
      </button>

      {open ? (
        <div
          id={listId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_24px_60px_-28px_rgba(15,23,42,.55)]"
        >
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <strong className="block text-sm text-[var(--text-primary)]">Pessoas online</strong>
            <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">Atualizado a cada 45 segundos enquanto a plataforma estiver aberta.</span>
          </div>
          {people.length ? (
            <ul className="max-h-80 overflow-y-auto p-2">
              {people.map((person) => (
                <li key={person.personId} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-[var(--surface-hover)]">
                  <span className="relative">
                    <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-10 w-10 rounded-xl" fallbackClassName="text-xs" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-card)] bg-emerald-500" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong>
                    <span className="block truncate text-xs text-[var(--text-secondary)]">{person.profileLabel}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-sm text-[var(--text-secondary)]">{beating ? "Ninguém mais com a plataforma aberta agora." : "Sincronizando presença…"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
