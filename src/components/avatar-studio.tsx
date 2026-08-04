"use client";

import { Avatar, Style } from "@dicebear/core";
import lorelei from "@dicebear/styles/lorelei.json" with { type: "json" };
import { Check, Dice5, Glasses, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import Image from "next/image";
import { ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AvatarConfig,
  avatarColors,
  beardOptions,
  browOptions,
  defaultAvatarConfig,
  earringsOptions,
  eyeOptions,
  glassesOptions,
  hairOptions,
  headOptions,
  mouthOptions,
  normalizeAvatarConfig,
  noseOptions,
} from "@/lib/avatar-config";
import { invalidatePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarStudioProps = {
  personName: string;
  initialUrl?: string | null;
  initialConfig?: Record<string, unknown> | null;
  active?: boolean;
};
type Tab = "face" | "expression" | "details" | "colors";

const loreleiStyle = new Style(lorelei);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [string, T]>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([text, item]) => (
          <button
            key={item}
            type="button"
            aria-pressed={value === item}
            onClick={() => onChange(item)}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition ${value === item ? "bg-[#0b4f82] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Palette<T extends string>({ label, colors, value, onChange }: {
  label: string;
  colors: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`${label} #${color}`}
            aria-pressed={value === color}
            className={`grid h-11 w-11 place-items-center rounded-xl transition hover:-translate-y-0.5 ${value === color ? "ring-4 ring-blue-100 shadow-md" : "ring-1 ring-slate-200"}`}
            style={{ backgroundColor: `#${color}` }}
          >
            {value === color && <Check className={`h-4 w-4 ${["1f2937", "3f2d20", "6b4226", "614335"].includes(color) ? "text-white" : "text-slate-950"}`} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ checked, label, onChange, icon }: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-bold transition ${checked ? "border-blue-200 bg-blue-50 text-[#0b4f82]" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#0b4f82]" />
      {icon}
      {label}
    </label>
  );
}

export function AvatarStudio({ personName, initialUrl, initialConfig, active = false }: AvatarStudioProps) {
  const [config, setConfig] = useState<AvatarConfig>(() => normalizeAvatarConfig(initialConfig, personName));
  const [tab, setTab] = useState<Tab>("face");
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(active ? initialUrl ?? null : null);

  const avatarUrl = useMemo(() => {
    const avatar = new Avatar(loreleiStyle, {
      seed: config.seed,
      size: 512,
      borderRadius: 18,
      scale: 0.92,
      backgroundColor: [config.backgroundColor],
      hairVariant: [config.hairVariant],
      hairColor: [config.hairColor],
      skinColor: [config.skinColor],
      eyesVariant: [config.eyesVariant],
      mouthVariant: [config.mouthVariant],
      eyebrowsVariant: [config.eyebrowsVariant],
      headVariant: [config.headVariant],
      noseVariant: [config.noseVariant],
      glassesVariant: [config.glassesVariant],
      glassesProbability: config.glasses ? 100 : 0,
      beardVariant: [config.beardVariant],
      beardProbability: config.beard ? 100 : 0,
      frecklesProbability: config.freckles ? 100 : 0,
      earringsVariant: [config.earringsVariant],
      earringsProbability: config.earrings ? 100 : 0,
      hairAccessoriesVariant: ["flowers"],
      hairAccessoriesProbability: config.hairAccessory ? 100 : 0,
      title: `Avatar de ${personName}`,
    });
    return avatar.toDataUri();
  }, [config, personName]);

  const update = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const randomize = () => setConfig((current) => ({
    ...current,
    seed: `${personName}-${crypto.randomUUID()}`,
    hairVariant: pick(hairOptions)[1],
    eyesVariant: pick(eyeOptions)[1],
    mouthVariant: pick(mouthOptions)[1],
    eyebrowsVariant: pick(browOptions)[1],
    headVariant: pick(headOptions)[1],
    noseVariant: pick(noseOptions)[1],
    glassesVariant: pick(glassesOptions)[1],
    beardVariant: pick(beardOptions)[1],
    earringsVariant: pick(earringsOptions)[1],
    glasses: Math.random() > 0.62,
    beard: Math.random() > 0.72,
    freckles: Math.random() > 0.76,
    earrings: Math.random() > 0.55,
    hairAccessory: Math.random() > 0.82,
    hairColor: pick(avatarColors.hair),
    skinColor: pick(avatarColors.skin),
    backgroundColor: pick(avatarColors.background),
  }));

  async function save() {
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("set_my_avatar_choice", {
        p_source: "GENERATED",
        p_avatar_url: avatarUrl,
        p_avatar_config: config,
      });
      if (error) throw error;
      const result = data as { avatarUrl?: string | null } | null;
      setSavedUrl(result?.avatarUrl ?? avatarUrl);
      invalidatePlatformContext();
      toast.success("Avatar personalizado salvo em toda a plataforma.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o avatar.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<[Tab, string]> = [
    ["face", "Rosto e cabelo"],
    ["expression", "Olhos e expressão"],
    ["details", "Detalhes"],
    ["colors", "Cores"],
  ];
  const isSaved = active && savedUrl === avatarUrl;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_55px_-36px_rgba(15,23,42,.45)]">
      <div className="grid lg:grid-cols-[340px_1fr]">
        <aside className="relative overflow-hidden bg-[linear-gradient(145deg,#073b62,#0b6791_58%,#087a55)] p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(103,232,249,.30),transparent_42%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-cyan-100"><Sparkles className="h-4 w-4" /> Estúdio de avatar</span>
            <div className="mx-auto mt-6 max-w-[250px] rounded-[2rem] bg-white/10 p-3 shadow-2xl ring-1 ring-white/20">
              <Image src={avatarUrl} alt={`Avatar de ${personName}`} width={512} height={512} unoptimized className="aspect-square w-full rounded-[1.5rem] bg-white object-contain" />
            </div>
            <div className="mt-5 text-center">
              <h3 className="text-xl font-black">Sua identidade visual</h3>
              <p className="mt-2 text-sm leading-6 text-blue-50/90">Monte seu personagem escolhendo cada detalhe. A prévia muda na hora.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={randomize} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold transition hover:bg-white/20"><Dice5 className="h-4 w-4" /> Surpreenda-me</button>
              <button type="button" onClick={() => setConfig(defaultAvatarConfig(personName))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold transition hover:bg-white/20"><RotateCcw className="h-4 w-4" /> Restaurar</button>
            </div>
          </div>
        </aside>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-eyebrow">Personalização completa</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Crie seu personagem institucional</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Escolha rosto, nariz, cabelo, olhos, boca, acessórios e cores. Suas escolhas ficam salvas para continuar editando depois.</p>
            </div>
            {isSaved && <span className="status-badge"><Check className="h-4 w-4" />Avatar em uso</span>}
          </div>

          <div role="tablist" aria-label="Etapas de personalização" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-w-fit rounded-xl px-4 py-2 text-sm font-black transition ${tab === id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
            ))}
          </div>

          <div role="tabpanel" className="mt-6 min-h-[270px] space-y-6">
            {tab === "face" && <>
              <Choice label="Formato do rosto" value={config.headVariant} options={headOptions} onChange={(value) => update("headVariant", value)} />
              <Choice label="Formato do nariz" value={config.noseVariant} options={noseOptions} onChange={(value) => update("noseVariant", value)} />
              <Choice label="Cabelo" value={config.hairVariant} options={hairOptions} onChange={(value) => update("hairVariant", value)} />
            </>}
            {tab === "expression" && <>
              <Choice label="Olhos" value={config.eyesVariant} options={eyeOptions} onChange={(value) => update("eyesVariant", value)} />
              <Choice label="Sobrancelhas" value={config.eyebrowsVariant} options={browOptions} onChange={(value) => update("eyebrowsVariant", value)} />
              <Choice label="Boca e expressão" value={config.mouthVariant} options={mouthOptions} onChange={(value) => update("mouthVariant", value)} />
            </>}
            {tab === "details" && <>
              <div className="grid gap-6 sm:grid-cols-2">
                <Choice label="Modelo de óculos" value={config.glassesVariant} options={glassesOptions} onChange={(value) => update("glassesVariant", value)} />
                <Choice label="Modelo de brinco" value={config.earringsVariant} options={earringsOptions} onChange={(value) => update("earringsVariant", value)} />
              </div>
              <Choice label="Modelo de barba" value={config.beardVariant} options={beardOptions} onChange={(value) => update("beardVariant", value)} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Toggle checked={config.glasses} onChange={(value) => update("glasses", value)} label="Óculos" icon={<Glasses className="h-4 w-4" />} />
                <Toggle checked={config.beard} onChange={(value) => update("beard", value)} label="Barba" />
                <Toggle checked={config.freckles} onChange={(value) => update("freckles", value)} label="Sardas" />
                <Toggle checked={config.earrings} onChange={(value) => update("earrings", value)} label="Brincos" />
                <Toggle checked={config.hairAccessory} onChange={(value) => update("hairAccessory", value)} label="Flores" />
              </div>
            </>}
            {tab === "colors" && <div className="grid gap-7 sm:grid-cols-2">
              <Palette label="Tom de pele" colors={avatarColors.skin} value={config.skinColor} onChange={(value) => update("skinColor", value)} />
              <Palette label="Cor do cabelo" colors={avatarColors.hair} value={config.hairColor} onChange={(value) => update("hairColor", value)} />
              <div className="sm:col-span-2"><Palette label="Cor de fundo" colors={avatarColors.background} value={config.backgroundColor} onChange={(value) => update("backgroundColor", value)} /></div>
            </div>}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-5 text-slate-400">A composição é gerada no navegador e salva com segurança no seu perfil institucional.</p>
            <button type="button" onClick={save} disabled={saving || isSaved} className="primary-button justify-center px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : isSaved ? "Avatar salvo" : "Usar este avatar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
