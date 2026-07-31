"use client";

import { Check, Dice5, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AvatarStudioProps = {
  personName: string;
  initialUrl?: string | null;
};

type AvatarConfig = {
  seed: string;
  top: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  accessories: string;
  facialHair: string;
  clothing: string;
  skinColor: string;
  hairColor: string;
  backgroundColor: string;
};

type StudioTab = "face" | "hair" | "style" | "colors";

type SelectOption = readonly [string, string];

const options: Record<"top" | "eyes" | "eyebrows" | "mouth" | "accessories" | "facialHair" | "clothing", readonly SelectOption[]> = {
  top: [
    ["Curto clássico", "shortFlat"],
    ["Curto ondulado", "shortWaved"],
    ["Curto arredondado", "shortRound"],
    ["Longo liso", "longHairStraight"],
    ["Longo ondulado", "longHairCurvy"],
    ["Coque", "bun"],
    ["Chapéu de inverno", "winterHat02"],
    ["Hijab", "hijab"],
  ],
  eyes: [
    ["Naturais", "default"],
    ["Alegres", "happy"],
    ["Sorrindo", "squint"],
    ["Piscando", "wink"],
    ["Corações", "hearts"],
  ],
  eyebrows: [
    ["Naturais", "defaultNatural"],
    ["Expressivas", "raisedExcitedNatural"],
    ["Concentradas", "flatNatural"],
    ["Sensíveis", "sadConcernedNatural"],
    ["Assimétricas", "upDownNatural"],
  ],
  mouth: [
    ["Sorriso", "smile"],
    ["Natural", "default"],
    ["Confiante", "twinkle"],
    ["Séria", "serious"],
    ["Surpresa", "disbelief"],
  ],
  accessories: [
    ["Sem acessórios", ""],
    ["Óculos clássico", "prescription01"],
    ["Óculos moderno", "prescription02"],
    ["Óculos redondo", "round"],
    ["Óculos escuro", "sunglasses"],
    ["Wayfarer", "wayfarers"],
  ],
  facialHair: [
    ["Sem barba", ""],
    ["Barba leve", "beardLight"],
    ["Barba clássica", "beardMedium"],
    ["Barba marcante", "beardMajestic"],
    ["Bigode", "moustacheFancy"],
  ],
  clothing: [
    ["Camisa", "shirtCrewNeck"],
    ["Camisa gola V", "shirtVNeck"],
    ["Moletom", "hoodie"],
    ["Suéter", "collarAndSweater"],
    ["Blazer", "blazerAndShirt"],
    ["Camiseta gráfica", "graphicShirt"],
  ],
};

const palette = {
  skinColor: ["f8d25c", "edb98a", "fd9841", "d08b5b", "ae5d29", "614335"],
  hairColor: ["2c1b18", "4a312c", "724133", "a55728", "b58143", "e8e1e1", "c93305"],
  backgroundColor: ["e6f4ff", "e8f8f0", "fff4cc", "fce8ec", "eee8ff", "dff7fb"],
} as const;

const defaults: AvatarConfig = {
  seed: "agsus-avatar",
  top: "shortFlat",
  eyes: "happy",
  eyebrows: "defaultNatural",
  mouth: "smile",
  accessories: "",
  facialHair: "",
  clothing: "blazerAndShirt",
  skinColor: "edb98a",
  hairColor: "2c1b18",
  backgroundColor: "e6f4ff",
};

const tabs: Array<{ id: StudioTab; label: string; description: string }> = [
  { id: "face", label: "Rosto", description: "Olhos, expressão e sobrancelhas" },
  { id: "hair", label: "Cabelo", description: "Corte, cor e barba" },
  { id: "style", label: "Estilo", description: "Roupa e acessórios" },
  { id: "colors", label: "Cores", description: "Pele, cabelo e fundo" },
];

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildAvatarUrl(config: AvatarConfig) {
  const params = new URLSearchParams({
    seed: config.seed,
    top: config.top,
    eyes: config.eyes,
    eyebrows: config.eyebrows,
    mouth: config.mouth,
    clothing: config.clothing,
    skinColor: config.skinColor,
    hairColor: config.hairColor,
    backgroundColor: config.backgroundColor,
    borderRadius: "18",
    scale: "0.9",
    size: "512",
  });
  if (config.accessories) params.set("accessories", config.accessories);
  else params.set("accessoriesProbability", "0");
  if (config.facialHair) params.set("facialHair", config.facialHair);
  else params.set("facialHairProbability", "0");
  return `https://api.dicebear.com/10.x/avataaars/svg?${params.toString()}`;
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: readonly SelectOption[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-black text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold text-slate-800 shadow-sm outline-none transition hover:border-slate-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
        {values.map(([optionLabel, optionValue]) => <option key={`${label}-${optionValue || "none"}`} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function ColorField({ label, colors, selected, onChange }: { label: string; colors: readonly string[]; selected: string; onChange: (color: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-700">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-3">
        {colors.map((color) => (
          <button key={color} type="button" onClick={() => onChange(color)} className={`grid h-12 w-12 place-items-center rounded-2xl transition duration-200 hover:-translate-y-1 ${selected === color ? "ring-4 ring-cyan-100 shadow-lg" : "ring-1 ring-slate-200 shadow-sm"}`} style={{ backgroundColor: `#${color}` }} aria-label={`Selecionar ${label.toLowerCase()} ${color}`}>
            {selected === color && <Check className="h-5 w-5 text-slate-900" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarStudio({ personName, initialUrl }: AvatarStudioProps) {
  const stableSeed = useMemo(() => `agsus-${personName.trim().toLowerCase().replace(/\s+/g, "-")}`, [personName]);
  const [config, setConfig] = useState<AvatarConfig>({ ...defaults, seed: stableSeed });
  const [activeTab, setActiveTab] = useState<StudioTab>("face");
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? null);
  const avatarUrl = useMemo(() => buildAvatarUrl(config), [config]);

  function update<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) {
    setImageError(false);
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function randomize() {
    setImageError(false);
    setConfig({
      seed: `${stableSeed}-${crypto.randomUUID()}`,
      top: pick(options.top)[1],
      eyes: pick(options.eyes)[1],
      eyebrows: pick(options.eyebrows)[1],
      mouth: pick(options.mouth)[1],
      accessories: pick(options.accessories)[1],
      facialHair: pick(options.facialHair)[1],
      clothing: pick(options.clothing)[1],
      skinColor: pick(palette.skinColor),
      hairColor: pick(palette.hairColor),
      backgroundColor: pick(palette.backgroundColor),
    });
  }

  function reset() {
    setImageError(false);
    setConfig({ ...defaults, seed: stableSeed });
  }

  async function saveAvatar() {
    if (imageError) {
      toast.error("A prévia não foi carregada. Tente outra combinação antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_my_avatar_url", { p_avatar_url: avatarUrl });
      if (error) throw error;
      setSavedUrl(avatarUrl);
      toast.success("Personagem salvo como avatar institucional.");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2.25rem] bg-white shadow-[0_30px_90px_-45px_rgba(15,23,42,.5)] ring-1 ring-slate-200/80">
      <div className="grid xl:grid-cols-[.82fr_1.18fr]">
        <aside className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(45,212,191,.32),transparent_30%),radial-gradient(circle_at_88%_84%,rgba(59,130,246,.32),transparent_34%),linear-gradient(150deg,#031c34,#075ea8)] p-6 text-white sm:p-9">
          <div className="absolute inset-5 -z-10 rounded-[2.5rem] border border-white/10 bg-white/[.04] backdrop-blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[.16em] text-cyan-100"><Sparkles className="h-4 w-4" />Avatar Lab</span>
              {savedUrl === avatarUrl && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/15 px-3 py-2 text-xs font-black text-emerald-200"><Check className="h-4 w-4" />Em uso</span>}
            </div>

            <div className="mx-auto mt-8 max-w-[310px] rounded-[3rem] bg-gradient-to-br from-white/25 via-white/10 to-transparent p-px shadow-[0_35px_80px_-30px_rgba(0,0,0,.7)]">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-[calc(3rem-1px)] bg-white/95 p-4">
                {imageError ? (
                  <div className="text-center text-slate-500"><strong className="block text-slate-800">Prévia indisponível</strong><span className="mt-2 block text-sm">Use “Reiniciar” ou “Surpreenda-me”.</span></div>
                ) : (
                  <img src={avatarUrl} onError={() => setImageError(true)} alt={`Personagem de ${personName}`} className="h-full w-full object-contain drop-shadow-[0_18px_18px_rgba(15,23,42,.18)]" />
                )}
              </div>
            </div>

            <div className="mt-7 text-center">
              <h3 className="text-2xl font-black tracking-tight">Seu personagem institucional</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-blue-100">Uma identidade leve e consistente para o cabeçalho, menu, perfil e espaços colaborativos.</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={randomize} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"><Dice5 className="h-5 w-5" />Surpreenda-me</button>
              <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"><RotateCcw className="h-5 w-5" />Reiniciar</button>
            </div>
          </div>
        </aside>

        <div className="p-5 sm:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Personalização guiada</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Crie sem se perder em opções</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Escolha uma etapa. A prévia permanece estável enquanto você altera cada característica.</p>
          </div>

          <div role="tablist" aria-label="Etapas de personalização" className="mt-7 grid gap-2 rounded-[1.4rem] bg-slate-100 p-1.5 sm:grid-cols-4">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return <button key={tab.id} role="tab" aria-selected={active} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-2xl px-4 py-3 text-left transition duration-200 ${active ? "bg-white text-[#003b70] shadow-[0_8px_24px_-14px_rgba(15,23,42,.55)] ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/60 hover:text-slate-800"}`}><strong className="block text-sm">{tab.label}</strong><span className="mt-0.5 hidden text-[11px] font-medium sm:block">{tab.description}</span></button>;
            })}
          </div>

          <div role="tabpanel" className="mt-7 min-h-[290px] rounded-[1.75rem] bg-[linear-gradient(145deg,#f8fafc,#ffffff)] p-5 ring-1 ring-slate-200/80 sm:p-6">
            {activeTab === "face" && <div className="grid gap-5 sm:grid-cols-2"><SelectField label="Olhos" value={config.eyes} values={options.eyes} onChange={(value) => update("eyes", value)} /><SelectField label="Sobrancelhas" value={config.eyebrows} values={options.eyebrows} onChange={(value) => update("eyebrows", value)} /><SelectField label="Expressão" value={config.mouth} values={options.mouth} onChange={(value) => update("mouth", value)} /></div>}
            {activeTab === "hair" && <div className="grid gap-5 sm:grid-cols-2"><SelectField label="Cabelo e cobertura" value={config.top} values={options.top} onChange={(value) => update("top", value)} /><SelectField label="Barba e bigode" value={config.facialHair} values={options.facialHair} onChange={(value) => update("facialHair", value)} /><div className="sm:col-span-2"><ColorField label="Cor do cabelo" colors={palette.hairColor} selected={config.hairColor} onChange={(value) => update("hairColor", value)} /></div></div>}
            {activeTab === "style" && <div className="grid gap-5 sm:grid-cols-2"><SelectField label="Roupa" value={config.clothing} values={options.clothing} onChange={(value) => update("clothing", value)} /><SelectField label="Acessórios" value={config.accessories} values={options.accessories} onChange={(value) => update("accessories", value)} /></div>}
            {activeTab === "colors" && <div className="grid gap-7 sm:grid-cols-2"><ColorField label="Tom de pele" colors={palette.skinColor} selected={config.skinColor} onChange={(value) => update("skinColor", value)} /><ColorField label="Cor de fundo" colors={palette.backgroundColor} selected={config.backgroundColor} onChange={(value) => update("backgroundColor", value)} /></div>}
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-5 text-slate-500">Gerado em SVG pelo DiceBear 10.x. O personagem mantém a mesma aparência entre páginas e dispositivos após o salvamento.</p>
            <button type="button" onClick={saveAvatar} disabled={saving || imageError} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#003b70,#0877bd)] px-6 py-3.5 font-black text-white shadow-[0_15px_35px_-15px_rgba(0,59,112,.8)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}Usar este personagem</button>
          </div>
        </div>
      </div>
    </section>
  );
}
