"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarUploaderProps = {
  personName: string;
  initialUrl?: string | null;
  initials: string;
};

export function AvatarUploader({ personName, initialUrl, initials }: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function saveAvatarUrl(url: string) {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("set_my_avatar_url", { p_avatar_url: url });
    if (error) throw error;
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
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
      const versionedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
      await saveAvatarUrl(versionedUrl);
      setAvatarUrl(versionedUrl);
      toast.success("Foto de perfil atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    try {
      await saveAvatarUrl("");
      setAvatarUrl(null);
      toast.success("Foto removida. O avatar com iniciais será utilizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Foto de ${personName}`} className="h-32 w-32 rounded-[2rem] object-cover ring-4 ring-white/20 shadow-2xl" />
        ) : (
          <div className="grid h-32 w-32 place-items-center rounded-[2rem] bg-white text-4xl font-black text-[#003b70] shadow-2xl">{initials}</div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-3 -right-3 grid h-12 w-12 place-items-center rounded-2xl border-4 border-[#075ea8] bg-white text-[#003b70] shadow-xl transition hover:-translate-y-0.5 disabled:opacity-60"
          aria-label="Alterar foto de perfil"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} />
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#003b70] shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
          {avatarUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={removeAvatar}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </button>
        )}
      </div>
      <p className="mt-4 max-w-xs text-center text-xs leading-5 text-blue-100">JPG, PNG ou WEBP, com até 5 MB. A imagem será usada somente como avatar institucional.</p>
    </div>
  );
}
