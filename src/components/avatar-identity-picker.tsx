"use client";

import { Check, Image as ImageIcon, Loader2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AvatarStudio } from "@/components/avatar-studio";
import { invalidatePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarSource = "GOOGLE" | "GENERATED" | "INITIALS";
type Props = { personName: string; currentUrl?: string | null; currentSource?: string | null; currentConfig?: Record<string, unknown> | null; googleUrl?: string | null };

function initialAvatarSource(currentSource: string | null | undefined, googleUrl: string | null | undefined): AvatarSource {
  if (currentSource === "GENERATED") return "GENERATED";
  if (currentSource === "INITIALS") return "INITIALS";
  return googleUrl ? "GOOGLE" : "INITIALS";
}

export function AvatarIdentityPicker({ personName, currentUrl, currentSource, currentConfig, googleUrl }: Props) {
  const [selectedSource, setSelectedSource] = useState<AvatarSource>(() => initialAvatarSource(currentSource, googleUrl));
  const [saving, setSaving] = useState<AvatarSource | "">("");

  async function persist(source: Exclude<AvatarSource, "GENERATED">) {
    setSaving(source);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_my_avatar_choice", { p_source: source, p_avatar_url: null });
      if (error) throw error;
      setSelectedSource(source);
      invalidatePlatformContext();
      toast.success("Imagem de perfil atualizada em toda a plataforma.");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a imagem.");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6" aria-labelledby="profile-image-title">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">Imagem de perfil</p>
            <h2 id="profile-image-title" className="mt-1 text-lg font-black text-slate-950">Use primeiro a foto da sua conta Google</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">A foto da conta institucional é a opção recomendada. Também é possível usar as iniciais ou criar um avatar no estúdio abaixo.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">Uma única escolha aparece em todo o sistema</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={!googleUrl || Boolean(saving)} onClick={() => void persist("GOOGLE")} className={`choice-card ${selectedSource === "GOOGLE" ? "choice-card-active" : ""}`}>
            <span className="choice-icon"><ImageIcon className="h-5 w-5" /></span>
            <span><strong>Foto do Google</strong><small>{googleUrl ? "Opção recomendada · conta institucional" : "Foto não disponibilizada pela conta"}</small></span>
            {saving === "GOOGLE" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "GOOGLE" && <Check className="ml-auto h-4 w-4" />}
          </button>
          <button type="button" disabled={Boolean(saving)} onClick={() => void persist("INITIALS")} className={`choice-card ${selectedSource === "INITIALS" ? "choice-card-active" : ""}`}>
            <span className="choice-icon"><UserRound className="h-5 w-5" /></span>
            <span><strong>Usar iniciais</strong><small>Opção simples, leve e sem arquivo</small></span>
            {saving === "INITIALS" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "INITIALS" && <Check className="ml-auto h-4 w-4" />}
          </button>
        </div>
      </section>
      <AvatarStudio personName={personName} initialUrl={selectedSource === "GENERATED" ? currentUrl : null} initialConfig={currentConfig} active={selectedSource === "GENERATED"} />
    </div>
  );
}
