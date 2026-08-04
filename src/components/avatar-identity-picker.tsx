"use client";

import { Avatar, Style } from "@dicebear/core";
import avataaars from "@dicebear/styles/avataaars.json" with { type: "json" };
import personas from "@dicebear/styles/personas.json" with { type: "json" };
import { Camera, Check, Image as ImageIcon, Loader2, RotateCw, UserRound } from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidatePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarSource = "GOOGLE" | "UPLOADED" | "GENERATED" | "INITIALS";
type GeneratedStyle = "PERSONAS" | "AVATAAARS";

type Props = {
  personName: string;
  currentUrl?: string | null;
  currentSource?: string | null;
  googleUrl?: string | null;
};

const personasStyle = new Style(personas);
const avataaarsStyle = new Style(avataaars);
const backgrounds = ["e9f2fb", "e7f5ef", "f3edf9", "fff3df", "eef1f5", "fbeaec"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

function generatedAvatar(name: string, variant: number, generatedStyle: GeneratedStyle) {
  const style = generatedStyle === "AVATAAARS" ? avataaarsStyle : personasStyle;
  const avatar = new Avatar(style, {
    seed: `${name}-${generatedStyle.toLowerCase()}-${variant}`,
    size: 512,
    backgroundColor: [backgrounds[variant % backgrounds.length]],
    title: `Avatar de ${name}`,
  });
  return avatar.toDataUri();
}

export function AvatarIdentityPicker({ personName, currentUrl, currentSource, googleUrl }: Props) {
  const [selectedUrl, setSelectedUrl] = useState(currentUrl ?? null);
  const [selectedSource, setSelectedSource] = useState<AvatarSource>((currentSource as AvatarSource) || (currentUrl ? "GOOGLE" : "INITIALS"));
  const [saving, setSaving] = useState<AvatarSource | "UPLOAD" | "">("");
  const [avatarRound, setAvatarRound] = useState(0);
  const [generatedStyle, setGeneratedStyle] = useState<GeneratedStyle>("PERSONAS");
  const inputRef = useRef<HTMLInputElement>(null);

  const generated = useMemo(
    () => Array.from({ length: 8 }, (_, index) => generatedAvatar(personName, avatarRound * 8 + index, generatedStyle)),
    [personName, avatarRound, generatedStyle],
  );

  async function persist(source: AvatarSource, url?: string | null) {
    setSaving(source);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("set_my_avatar_choice", {
        p_source: source,
        p_avatar_url: url ?? null,
      });
      if (error) throw error;
      const result = data as { avatarUrl?: string | null } | null;
      setSelectedSource(source);
      setSelectedUrl(result?.avatarUrl ?? url ?? null);
      invalidatePlatformContext();
      toast.success("Imagem de perfil atualizada.");
      window.setTimeout(() => window.location.reload(), 250);
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

  function changeGeneratedStyle(style: GeneratedStyle) {
    setGeneratedStyle(style);
    setAvatarRound(0);
  }

  const activePreview = selectedUrl ? (
    <img src={selectedUrl} alt="Imagem em uso" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <span className="text-3xl font-bold text-slate-700">{initials(personName)}</span>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Imagem atual</p>
          <div className="mx-auto mt-6 grid h-40 w-40 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
            {activePreview}
          </div>
          <h3 className="mt-5 text-center text-lg font-semibold text-slate-950">{personName}</h3>
          <p className="mt-1 text-center text-sm text-slate-500">
            Origem: {selectedSource === "GOOGLE" ? "Conta Google" : selectedSource === "UPLOADED" ? "Foto enviada" : selectedSource === "GENERATED" ? "Avatar profissional" : "Iniciais"}
          </p>
        </aside>

        <div className="p-6 sm:p-7">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Escolha como deseja aparecer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Uma única escolha é aplicada em toda a plataforma. Ela não será substituída automaticamente em novos acessos.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button type="button" disabled={!googleUrl || Boolean(saving)} onClick={() => void persist("GOOGLE")} className={`choice-card ${selectedSource === "GOOGLE" ? "choice-card-active" : ""}`}>
              <span className="choice-icon"><ImageIcon className="h-5 w-5" /></span>
              <span><strong>Foto do Google</strong><small>{googleUrl ? "Usar a foto da conta institucional" : "Foto não disponibilizada"}</small></span>
              {selectedSource === "GOOGLE" && <Check className="ml-auto h-4 w-4" />}
            </button>
            <button type="button" disabled={Boolean(saving)} onClick={() => inputRef.current?.click()} className={`choice-card ${selectedSource === "UPLOADED" ? "choice-card-active" : ""}`}>
              <span className="choice-icon"><Camera className="h-5 w-5" /></span>
              <span><strong>Enviar foto</strong><small>JPG, PNG ou WEBP até 5 MB</small></span>
              {saving === "UPLOAD" ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : selectedSource === "UPLOADED" && <Check className="ml-auto h-4 w-4" />}
            </button>
            <button type="button" disabled={Boolean(saving)} onClick={() => void persist("INITIALS")} className={`choice-card ${selectedSource === "INITIALS" ? "choice-card-active" : ""}`}>
              <span className="choice-icon"><UserRound className="h-5 w-5" /></span>
              <span><strong>Usar iniciais</strong><small>Opção simples e neutra</small></span>
              {selectedSource === "INITIALS" && <Check className="ml-auto h-4 w-4" />}
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">Avatares profissionais</h3>
                <p className="mt-1 text-sm text-slate-500">Escolha um estilo e gere combinações localmente no navegador.</p>
              </div>
              <button type="button" onClick={() => setAvatarRound((value) => value + 1)} className="secondary-button">
                <RotateCw className="h-4 w-4" />Gerar outras opções
              </button>
            </div>

            <div className="mt-4 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Estilo dos avatares gerados">
              <button
                type="button"
                role="tab"
                aria-selected={generatedStyle === "PERSONAS"}
                onClick={() => changeGeneratedStyle("PERSONAS")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${generatedStyle === "PERSONAS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Personas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={generatedStyle === "AVATAAARS"}
                onClick={() => changeGeneratedStyle("AVATAAARS")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${generatedStyle === "AVATAAARS" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Avataaars
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8" role="tabpanel" aria-label={`Opções do estilo ${generatedStyle === "AVATAAARS" ? "Avataaars" : "Personas"}`}>
              {generated.map((url, index) => (
                <button
                  key={`${generatedStyle}-${avatarRound}-${index}`}
                  type="button"
                  disabled={Boolean(saving)}
                  onClick={() => void persist("GENERATED", url)}
                  className="group relative aspect-square overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <img src={url} alt={`Avatar ${generatedStyle === "AVATAAARS" ? "Avataaars" : "Personas"} ${index + 1}`} className="h-full w-full object-cover" />
                  {selectedSource === "GENERATED" && selectedUrl === url && (
                    <span className="absolute inset-0 grid place-items-center bg-blue-950/35 text-white"><Check className="h-5 w-5" /></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
