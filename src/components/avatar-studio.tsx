"use client";

import { Check, Dice5, Loader2, RotateCcw, Save, Sparkles, UserRoundCog } from "lucide-react";
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

const options = {
  top: [
    ["Cabelo curto", "shortFlat"],
    ["Curto ondulado", "shortWaved"],
    ["Curto arredondado", "shortRound"],
    ["Longo liso", "longHairStraight"],
    ["Longo ondulado", "longHairCurvy"],
    ["Coque", "bun"],
    ["Chapéu", "winterHat02"],
    ["Hijab", "hijab"],
  ],
  eyes: [
    ["Clássicos", "default"],
    ["Felizes", "happy"],
    ["Sorrindo", "squint"],
    ["Piscando", "wink"],
    ["Corações", "hearts"],
  ],
  eyebrows: [
    ["Naturais", "defaultNatural"],
    ["Expressivas", "raisedExcitedNatural"],
    ["Concentradas", "flatNatural"],
    ["Preocupadas", "sadConcernedNatural"],
    ["Assimétricas", "upDownNatural"],
  ],
  mouth: [
    ["Sorriso", "smile"],
    ["Clássica", "default"],
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
} as const;

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
    radius: "18",
    size: "512",
  });
  if (config.accessories) params.set("accessories", config.accessories);
  else params.set("accessoriesProbability", "0");
  if (config.facialHair) params.set("facialHair", config.facialHair);
  else params.set("facialHairProbability", "0");
  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
}

export function AvatarStudio({ personName, initialUrl }: AvatarStudioProps) {
  const [config, setConfig] = useState<AvatarConfig>({ ...defaults, seed: personName || defaults.seed });
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? null);
  const avatarUrl = useMemo(() => buildAvatarUrl(config), [config]);

  function update<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value, seed: `${personName}-${Date.now()}` }));
  }

  function randomize() {
    setConfig({
      seed: `${personName}-${crypto.randomUUID()}`,
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

  async function saveAvatar() {
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_my_avatar_url", { p_avatar_url: avatarUrl });
      if (error) throw error;
      setSavedUrl(avatarUrl);
      toast.success("Seu personagem foi salvo como avatar institucional.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,.45)]">
      <div className="grid lg:grid-cols-[.72fr_1.28fr]">
        <aside className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,.28),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(56,189,248,.28),transparent_38%),linear-gradient(145deg,#052e4f,#075ea8)] p-7 text-white sm:p-9">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[.16em] text-cyan-100">
                <Sparkles className="h-4 w-4" /> Estúdio de avatar
              </span>
              {savedUrl === avatarUrl && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/15 px-3 py-2 text-xs font-black text-emerald-200"><Check className="h-4 w-4" /> Salvo</span>}
            </div>
            <div className="mx-auto mt-8 grid aspect-square max-w-[290px] place-items-center overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
              <img src={avatarUrl} alt={`Personagem de ${personName}`} className="h-full w-full rounded-[2rem] object-cover" />
            </div>
            <div className="mt-7 text-center">
              <h3 className="text-2xl font-black">Crie seu personagem</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-blue-100">Personalize traços, cabelo, roupa, acessórios e cores. O avatar aparecerá no cabeçalho, menu e perfil.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={randomize} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white/15"><Dice5 className="h-5 w-5" /> Surpreenda-me</button>
              <button type="button" onClick={() => setConfig({ ...defaults, seed: personName })} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white/15"><RotateCcw className="h-5 w-5" /> Reiniciar</button>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#003b70]"><UserRoundCog className="h-6 w-6" /></div>
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Personalização</p><h2 className="mt-1 text-2xl font-black text-slate-950">Monte a sua identidade visual</h2><p className="mt-2 text-sm leading-6 text-slate-500">As alterações aparecem instantaneamente na prévia.</p></div>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {(["top", "eyes", "eyebrows", "mouth", "accessories", "facialHair", "clothing"] as const).map((key) => {
              const labels: Record<typeof key, string> = { top: "Cabelo e cobertura", eyes: "Olhos", eyebrows: "Sobrancelhas", mouth: "Expressão", accessories: "Acessórios", facialHair: "Barba e bigode", clothing: "Roupa" };
              return <label key={key} className="text-sm font-black text-slate-700">{labels[key]}<select value={config[key]} onChange={(event) => update(key, event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100">{options[key].map(([label, value]) => <option key={`${key}-${value || "none"}`} value={value}>{label}</option>)}</select></label>;
            })}
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            {(["skinColor", "hairColor", "backgroundColor"] as const).map((key) => {
              const labels = { skinColor: "Tom de pele", hairColor: "Cor do cabelo", backgroundColor: "Fundo" };
              return <fieldset key={key}><legend className="text-sm font-black text-slate-700">{labels[key]}</legend><div className="mt-3 flex flex-wrap gap-2">{palette[key].map((color) => <button key={color} type="button" onClick={() => update(key, color)} className={`grid h-10 w-10 place-items-center rounded-xl border-2 transition hover:scale-105 ${config[key] === color ? "border-[#003b70] ring-4 ring-blue-100" : "border-white ring-1 ring-slate-200"}`} style={{ backgroundColor: `#${color}` }} aria-label={`Selecionar cor ${color}`}>{config[key] === color && <Check className="h-4 w-4 text-slate-900" />}</button>)}</div></fieldset>;
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <p className="max-w-md text-xs leading-5 text-slate-500">Personagem gerado com DiceBear. Nenhuma foto pessoal é necessária; a configuração produz um SVG leve e consistente.</p>
            <button type="button" onClick={saveAvatar} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-[#003b70] px-6 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#075ea8] disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Usar este personagem</button>
          </div>
        </div>
      </div>
    </section>
  );
}
