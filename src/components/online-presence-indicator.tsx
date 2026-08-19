"use client";

import { UsersRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { normalizeOnlinePresenceState, type OnlinePresencePerson } from "@/lib/online-presence";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type PresenceUser = {
  id?: string;
  fullName: string;
  institutionalEmail?: string | null;
  profileLabel: string;
  avatarUrl?: string | null;
};

const PLATFORM_PRESENCE_TOPIC = "platform-online";

/** Mostra, em tempo real, as pessoas autenticadas com a plataforma aberta. */
export function OnlinePresenceIndicator({ user, canView }: { user: PresenceUser; canView: boolean }) {
  const [people, setPeople] = useState<OnlinePresencePerson[]>([]);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const presenceKey = user.id ?? user.institutionalEmail ?? null;

  useEffect(() => {
    if (!presenceKey) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(PLATFORM_PRESENCE_TOPIC, {
      config: {
        private: true,
        presence: { key: presenceKey },
      },
    });
    let active = true;

    const sync = () => {
      if (active) setPeople(normalizeOnlinePresenceState(channel.presenceState()));
    };

    if (canView) channel.on("presence", { event: "sync" }, sync);

    channel.subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void channel.track({
            personId: presenceKey,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl ?? null,
            profileLabel: user.profileLabel,
            onlineAt: new Date().toISOString(),
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      active = false;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [canView, presenceKey, user.avatarUrl, user.fullName, user.profileLabel]);

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

  const count = people.length;
  const label = connected
    ? `${count} ${count === 1 ? "pessoa online" : "pessoas online"}`
    : "Conectando presença";

  if (!canView) return null;

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
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.14)]" : "bg-slate-300"}`} aria-hidden="true" />
        <UsersRound className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline" aria-live="polite">{connected ? `${count} online` : "Conectando"}</span>
      </button>

      {open ? (
        <div
          id={listId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_24px_60px_-28px_rgba(15,23,42,.55)]"
        >
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <strong className="block text-sm text-[var(--text-primary)]">Pessoas online</strong>
            <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">Atualizado automaticamente enquanto a plataforma estiver aberta.</span>
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
            <p className="px-4 py-5 text-sm text-[var(--text-secondary)]">{connected ? "Nenhuma presença sincronizada ainda." : "Conectando ao serviço de presença…"}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
