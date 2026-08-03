"use client";

import { Avatar, Style } from "@dicebear/core";
import lorelei from "@dicebear/styles/lorelei.json" with { type: "json" };
import { Check, Dice5, Glasses, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarStudioProps = { personName: string; initialUrl?: string | null };
type Tab = "appearance" | "expression" | "details" | "colors";
type HairVariant = "variant01" | "variant05" | "variant12" | "variant18" | "variant24" | "variant31" | "variant40" | "variant47";
type EyeVariant = "variant01" | "variant06" | "variant10" | "variant16" | "variant22";
type MouthVariant = "happy01" | "happy06" | "happy12" | "happy17" | "sad03";
type EyebrowVariant = "variant01" | "variant04" | "variant08" | "variant12";
type HeadVariant = "variant01" | "variant02" | "variant03" | "variant04";
type GlassesVariant = "variant01" | "variant02" | "variant03" | "variant04" | "variant05";
type BeardVariant = "variant01" | "variant02";
type Config = {
  seed: string;
  hairVariant: HairVariant;
  eyesVariant: EyeVariant;
  mouthVariant: MouthVariant;
  eyebrowsVariant: EyebrowVariant;
  headVariant: HeadVariant;
  glassesVariant: GlassesVariant;
  beardVariant: BeardVariant;
  glasses: boolean;
  beard: boolean;
  freckles: boolean;
  hairColor: string;
  backgroundColor: string;
};

const colors = {
  hair: ["1f2937", "3f2d20", "6b4226", "a16207", "d4a574", "d1d5db"],
  background: ["eaf7f6", "eaf2ff", "f4eeff", "fff4e5", "fdeef2", "eef2f6"],
} as const;
const hairOptions = [["Clássico", "variant01"], ["Curto", "variant05"], ["Ondulado", "variant12"], ["Cacheado", "variant18"], ["Crespo", "variant24"], ["Longo", "variant31"], ["Coque", "variant40"], ["Moderno", "variant47"]] as const satisfies ReadonlyArray<readonly [string, HairVariant]>;
const eyeOptions = [["Natural", "variant01"], ["Alegre", "variant06"], ["Sereno", "variant10"], ["Atento", "variant16"], ["Expressivo", "variant22"]] as const satisfies ReadonlyArray<readonly [string, EyeVariant]>;
const mouthOptions = [["Sorriso", "happy01"], ["Acolhedor", "happy06"], ["Confiante", "happy12"], ["Discreto", "happy17"], ["Sério", "sad03"]] as const satisfies ReadonlyArray<readonly [string, MouthVariant]>;
const browOptions = [["Natural", "variant01"], ["Suave", "variant04"], ["Definida", "variant08"], ["Expressiva", "variant12"]] as const satisfies ReadonlyArray<readonly [string, EyebrowVariant]>;
const headOptions = [["Formato 1", "variant01"], ["Formato 2", "variant02"], ["Formato 3", "variant03"], ["Formato 4", "variant04"]] as const satisfies ReadonlyArray<readonly [string, HeadVariant]>;
const glassesOptions = [["Modelo 1", "variant01"], ["Modelo 2", "variant02"], ["Modelo 3", "variant03"], ["Modelo 4", "variant04"], ["Modelo 5", "variant05"]] as const satisfies ReadonlyArray<readonly [string, GlassesVariant]>;
const beardOptions = [["Curta", "variant01"], ["Cheia", "variant02"]] as const satisfies ReadonlyArray<readonly [string, BeardVariant]>;

const defaults: Config = { seed: "agsus-avatar", hairVariant: "variant05", eyesVariant: "variant06", mouthVariant: "happy06", eyebrowsVariant: "variant04", headVariant: "variant01", glassesVariant: "variant01", beardVariant: "variant01", glasses: false, beard: false, freckles: false, hairColor: "3f2d20", backgroundColor: "eaf2ff" };
const loreleiStyle = new Style(lorelei);

function pick<T>(items: readonly T[]): T { return items[Math.floor(Math.random() * items.length)]; }
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [string, T]>; onChange: (value: T) => void }) {
  return <fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</legend><div className="mt-2 flex flex-wrap gap-2">{options.map(([text, item]) => <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-xl px-3 py-2 text-sm font-bold transition ${value === item ? "bg-[#003b70] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{text}</button>)}</div></fieldset>;
}
function Palette({ label, colors: palette, value, onChange }: { label: string; colors: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</legend><div className="mt-3 flex flex-wrap gap-2">{palette.map((color) => <button key={color} type="button" onClick={() => onChange(color)} aria-label={`${label} #${color}`} className={`grid h-10 w-10 place-items-center rounded-xl transition hover:-translate-y-0.5 ${value === color ? "ring-4 ring-blue-100 shadow-md" : "ring-1 ring-slate-200"}`} style={{ backgroundColor: `#${color}` }}>{value === color && <Check className="h-4 w-4 text-slate-950" />}</button>)}</div></fieldset>;
}

export function AvatarStudio({ personName, initialUrl }: AvatarStudioProps) {
  const [config, setConfig] = useState<Config>({ ...defaults, seed: personName || defaults.seed });
  const [tab, setTab] = useState<Tab>("appearance");
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? null);
  const deferredConfig = useDeferredValue(config);

  const avatarUrl = useMemo(() => {
    const avatar = new Avatar(loreleiStyle, {
      seed: deferredConfig.seed,
      size: 512,
      borderRadius: 18,
      scale: 0.92,
      backgroundColor: [deferredConfig.backgroundColor],
      hairVariant: [deferredConfig.hairVariant],
      hairColor: [deferredConfig.hairColor],
      eyesVariant: [deferredConfig.eyesVariant],
      mouthVariant: [deferredConfig.mouthVariant],
      eyebrowsVariant: [deferredConfig.eyebrowsVariant],
      headVariant: [deferredConfig.headVariant],
      glassesVariant: [deferredConfig.glassesVariant],
      glassesProbability: deferredConfig.glasses ? 100 : 0,
      beardVariant: [deferredConfig.beardVariant],
      beardProbability: deferredConfig.beard ? 100 : 0,
      frecklesProbability: deferredConfig.freckles ? 100 : 0,
      title: `Avatar de ${personName}`,
    });
    return avatar.toDataUri();
  }, [deferredConfig, personName]);

  const update = <K extends keyof Config>(key: K, value: Config[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const randomize = () => setConfig((current) => ({ ...current, seed: `${personName}-${crypto.randomUUID()}`, hairVariant: pick(hairOptions)[1], eyesVariant: pick(eyeOptions)[1], mouthVariant: pick(mouthOptions)[1], eyebrowsVariant: pick(browOptions)[1], headVariant: pick(headOptions)[1], glassesVariant: pick(glassesOptions)[1], beardVariant: pick(beardOptions)[1], glasses: Math.random() > 0.6, beard: Math.random() > 0.7, freckles: Math.random() > 0.8, hairColor: pick(colors.hair), backgroundColor: pick(colors.background) }));

  async function save() {
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_my_avatar_url", { p_avatar_url: avatarUrl });
      if (error) throw error;
      setSavedUrl(avatarUrl);
      toast.success("Avatar institucional atualizado.");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o avatar.");
    } finally { setSaving(false); }
  }

  const tabs: Array<[Tab, string]> = [["appearance", "Aparência"], ["expression", "Expressão"], ["details", "Detalhes"], ["colors", "Cores"]];

  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[340px_1fr]">
    <aside className="relative overflow-hidden bg-[linear-gradient(145deg,#062f54,#075ea8)] p-6 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(34,211,238,.25),transparent_42%)]" /><div className="relative"><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-cyan-100"><Sparkles className="h-4 w-4" /> Estúdio de avatar</span><div className="mx-auto mt-6 max-w-[250px] rounded-[2rem] bg-white/10 p-3 shadow-2xl ring-1 ring-white/15"><img src={avatarUrl} alt={`Avatar de ${personName}`} className="aspect-square w-full rounded-[1.5rem] bg-white object-contain" /></div><div className="mt-5 text-center"><h3 className="text-xl font-black">Sua identidade visual</h3><p className="mt-2 text-sm leading-6 text-blue-100">Gerado localmente no navegador, com resultado estável e sem depender de serviços externos.</p></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={randomize} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold hover:bg-white/15"><Dice5 className="h-4 w-4" /> Nova combinação</button><button type="button" onClick={() => setConfig({ ...defaults, seed: personName || defaults.seed })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold hover:bg-white/15"><RotateCcw className="h-4 w-4" /> Restaurar</button></div></div></aside>
    <div className="p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Personalização guiada</p><h2 className="mt-1 text-2xl font-black text-slate-950">Crie seu personagem institucional</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Ajuste uma característica por vez. As alterações aparecem imediatamente na prévia.</p></div>{savedUrl === avatarUrl && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Avatar em uso</span>}</div>
      <div role="tablist" aria-label="Etapas de personalização" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-w-fit rounded-xl px-4 py-2 text-sm font-black transition ${tab === id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</div>
      <div role="tabpanel" className="mt-6 min-h-[245px] space-y-6">{tab === "appearance" && <><Choice label="Formato do rosto" value={config.headVariant} options={headOptions} onChange={(value) => update("headVariant", value)} /><Choice label="Cabelo" value={config.hairVariant} options={hairOptions} onChange={(value) => update("hairVariant", value)} /></>}{tab === "expression" && <><Choice label="Olhos" value={config.eyesVariant} options={eyeOptions} onChange={(value) => update("eyesVariant", value)} /><Choice label="Sobrancelhas" value={config.eyebrowsVariant} options={browOptions} onChange={(value) => update("eyebrowsVariant", value)} /><Choice label="Expressão" value={config.mouthVariant} options={mouthOptions} onChange={(value) => update("mouthVariant", value)} /></>}{tab === "details" && <><Choice label="Modelo de óculos" value={config.glassesVariant} options={glassesOptions} onChange={(value) => update("glassesVariant", value)} /><Choice label="Modelo de barba" value={config.beardVariant} options={beardOptions} onChange={(value) => update("beardVariant", value)} /><div className="grid gap-3 sm:grid-cols-3"><label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700"><input type="checkbox" checked={config.glasses} onChange={(event) => update("glasses", event.target.checked)} className="h-5 w-5 accent-[#003b70]" /><Glasses className="h-4 w-4" /> Óculos</label><label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700"><input type="checkbox" checked={config.beard} onChange={(event) => update("beard", event.target.checked)} className="h-5 w-5 accent-[#003b70]" /> Barba</label><label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700"><input type="checkbox" checked={config.freckles} onChange={(event) => update("freckles", event.target.checked)} className="h-5 w-5 accent-[#003b70]" /> Sardas</label></div></>}{tab === "colors" && <><Palette label="Cor do cabelo" colors={colors.hair} value={config.hairColor} onChange={(value) => update("hairColor", value)} /><Palette label="Cor de fundo" colors={colors.background} value={config.backgroundColor} onChange={(value) => update("backgroundColor", value)} /></>}</div>
      <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-400">O avatar é gerado como SVG e salvo no seu perfil institucional.</p><button type="button" onClick={save} disabled={saving || savedUrl === avatarUrl} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white transition hover:bg-[#075ea8] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Salvando..." : savedUrl === avatarUrl ? "Avatar salvo" : "Usar este avatar"}</button></div>
    </div>
  </div></section>;
}
