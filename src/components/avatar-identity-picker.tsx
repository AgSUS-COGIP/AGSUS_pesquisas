"use client";

import { Camera, Check, Image as ImageIcon, Loader2, UserRound } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarStudio } from "@/components/avatar-studio";
import { invalidatePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarSource = "GOOGLE" | "UPLOADED" | "GENERATED" | "INITIALS";

type Props = {
  personName: string;
  currentUrl?: string | null;
  currentSource?: string | null;
  currentConfig?: Record<string, unknown> | null;
  googleUrl?: string | null;
};

export function AvatarIdentityPicker({ personName, currentUrl, currentSource, currentConfig, googleUrl }: Props) {
  const [selectedSource, setSelectedSource] = useState<AvatarSource>((currentSource as AvatarSource) || (currentUrl ? "GOOGLE" : "INITIALS"));
  const [saving, setSaving] = useState<AvatarSource | "UPLOAD" | "">("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function persist(source: AvatarSource, url?: string | null) {
    setSaving(source);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_my_avatar_choice", {
        p_source: source,
        p_avatar_url: url ?? null,
      });
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

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return toast.error("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 5 MB.");

    setSaving("UPLOAD");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Sessão não localizada.");
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userData.user.id}/profile.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await persist("UPLOADED", `${publicUrlData.publicUrl}?v=${Date.now()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
      setSaving("");
    }
  }

  return (
    <div className="space-y-5">
      <AvatarStudio
        personName={personName}
        initialUrl={selectedSource === "GENERATED" ? currentUrl : null}
        initialConfig={currentConfig}
        active={selectedSource === "GENERATED"}
      />

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">Outras opções</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Prefere usar uma foto?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Você também pode usar a conta Google, enviar uma imagem ou exibir suas iniciais.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">Uma única escolha aparece em todo o sistema</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button type="button" disabled={!googleUrl || Boolean(saving)} onClick={() => void persist("GOOGLE")} className={`choice-card ${selectedSource === "GOOGLE" ? "choice-card-active" : ""}`}>
            <span className="choice-icon"><ImageIcon className="h-5 w-5" /></span>
            <span><strong>Foto do Google</strong><small>{googleUrl ? "Usar a foto da conta institucional" : "Foto não disponibilizada"}</small></span>
            {saving === "GOOGLE" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "GOOGLE" && <Check className="ml-auto h-4 w-4" />}
          </button>
          <button type="button" disabled={Boolean(saving)} onClick={() => inputRef.current?.click()} className={`choice-card ${selectedSource === "UPLOADED" ? "choice-card-active" : ""}`}>
            <span className="choice-icon"><Camera className="h-5 w-5" /></span>
            <span><strong>Enviar foto</strong><small>JPG, PNG ou WEBP até 5 MB</small></span>
            {saving === "UPLOAD" || saving === "UPLOADED" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "UPLOADED" && <Check className="ml-auto h-4 w-4" />}
          </button>
          <button type="button" disabled={Boolean(saving)} onClick={() => void persist("INITIALS")} className={`choice-card ${selectedSource === "INITIALS" ? "choice-card-active" : ""}`}>
            <span className="choice-icon"><UserRound className="h-5 w-5" /></span>
            <span><strong>Usar iniciais</strong><small>Opção simples e neutra</small></span>
            {saving === "INITIALS" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "INITIALS" && <Check className="ml-auto h-4 w-4" />}
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
        </div>
      </section>
    </div>
  );
}
