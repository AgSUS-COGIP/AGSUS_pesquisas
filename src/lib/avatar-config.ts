export type AvatarConfig = {
  version: 1;
  style: "lorelei";
  seed: string;
  hairVariant: HairVariant;
  eyesVariant: EyeVariant;
  mouthVariant: MouthVariant;
  eyebrowsVariant: EyebrowVariant;
  headVariant: HeadVariant;
  noseVariant: NoseVariant;
  glassesVariant: GlassesVariant;
  beardVariant: BeardVariant;
  earringsVariant: EarringsVariant;
  glasses: boolean;
  beard: boolean;
  freckles: boolean;
  earrings: boolean;
  hairAccessory: boolean;
  hairColor: HairColor;
  skinColor: SkinColor;
  backgroundColor: BackgroundColor;
};

export const hairOptions = [
  ["Clássico", "variant01"],
  ["Curto", "variant05"],
  ["Ondulado", "variant12"],
  ["Cacheado", "variant18"],
  ["Crespo", "variant24"],
  ["Longo", "variant31"],
  ["Coque", "variant40"],
  ["Moderno", "variant47"],
] as const;
export const eyeOptions = [["Natural", "variant01"], ["Alegre", "variant06"], ["Sereno", "variant10"], ["Atento", "variant16"], ["Expressivo", "variant22"]] as const;
export const mouthOptions = [["Sorriso", "happy01"], ["Acolhedora", "happy06"], ["Confiante", "happy12"], ["Discreta", "happy17"], ["Séria", "sad03"]] as const;
export const browOptions = [["Natural", "variant01"], ["Suave", "variant04"], ["Definida", "variant08"], ["Expressiva", "variant12"]] as const;
export const headOptions = [["Rosto 1", "variant01"], ["Rosto 2", "variant02"], ["Rosto 3", "variant03"], ["Rosto 4", "variant04"]] as const;
export const noseOptions = [["Nariz 1", "variant01"], ["Nariz 2", "variant02"], ["Nariz 3", "variant03"], ["Nariz 4", "variant04"], ["Nariz 5", "variant05"], ["Nariz 6", "variant06"]] as const;
export const glassesOptions = [["Óculos 1", "variant01"], ["Óculos 2", "variant02"], ["Óculos 3", "variant03"], ["Óculos 4", "variant04"], ["Óculos 5", "variant05"]] as const;
export const beardOptions = [["Curta", "variant01"], ["Cheia", "variant02"]] as const;
export const earringsOptions = [["Brinco 1", "variant01"], ["Brinco 2", "variant02"], ["Brinco 3", "variant03"]] as const;

export const avatarColors = {
  hair: ["1f2937", "3f2d20", "6b4226", "a16207", "d4a574", "d1d5db"],
  skin: ["ffdbb4", "edb98a", "d08b5b", "ae5d29", "614335"],
  background: ["eaf7f6", "eaf2ff", "f4eeff", "fff4e5", "fdeef2", "eef2f6"],
} as const;

type OptionValue<T extends ReadonlyArray<readonly [string, string]>> = T[number][1];
export type HairVariant = OptionValue<typeof hairOptions>;
export type EyeVariant = OptionValue<typeof eyeOptions>;
export type MouthVariant = OptionValue<typeof mouthOptions>;
export type EyebrowVariant = OptionValue<typeof browOptions>;
export type HeadVariant = OptionValue<typeof headOptions>;
export type NoseVariant = OptionValue<typeof noseOptions>;
export type GlassesVariant = OptionValue<typeof glassesOptions>;
export type BeardVariant = OptionValue<typeof beardOptions>;
export type EarringsVariant = OptionValue<typeof earringsOptions>;
export type HairColor = (typeof avatarColors.hair)[number];
export type SkinColor = (typeof avatarColors.skin)[number];
export type BackgroundColor = (typeof avatarColors.background)[number];

const optionValues = <T extends ReadonlyArray<readonly [string, string]>>(options: T): Array<T[number][1]> =>
  options.map(([, value]) => value) as Array<T[number][1]>;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function seedValue(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized && normalized.length <= 120 ? normalized : fallback;
}

export function defaultAvatarConfig(personName: string): AvatarConfig {
  return {
    version: 1,
    style: "lorelei",
    seed: personName.trim() || "agsus-avatar",
    hairVariant: "variant05",
    eyesVariant: "variant06",
    mouthVariant: "happy06",
    eyebrowsVariant: "variant04",
    headVariant: "variant01",
    noseVariant: "variant01",
    glassesVariant: "variant01",
    beardVariant: "variant01",
    earringsVariant: "variant01",
    glasses: false,
    beard: false,
    freckles: false,
    earrings: false,
    hairAccessory: false,
    hairColor: "3f2d20",
    skinColor: "edb98a",
    backgroundColor: "eaf2ff",
  };
}

export function normalizeAvatarConfig(value: unknown, personName: string): AvatarConfig {
  const source = recordValue(value);
  const fallback = defaultAvatarConfig(personName);
  return {
    version: 1,
    style: "lorelei",
    seed: seedValue(source.seed, fallback.seed),
    hairVariant: enumValue(source.hairVariant, optionValues(hairOptions), fallback.hairVariant),
    eyesVariant: enumValue(source.eyesVariant, optionValues(eyeOptions), fallback.eyesVariant),
    mouthVariant: enumValue(source.mouthVariant, optionValues(mouthOptions), fallback.mouthVariant),
    eyebrowsVariant: enumValue(source.eyebrowsVariant, optionValues(browOptions), fallback.eyebrowsVariant),
    headVariant: enumValue(source.headVariant, optionValues(headOptions), fallback.headVariant),
    noseVariant: enumValue(source.noseVariant, optionValues(noseOptions), fallback.noseVariant),
    glassesVariant: enumValue(source.glassesVariant, optionValues(glassesOptions), fallback.glassesVariant),
    beardVariant: enumValue(source.beardVariant, optionValues(beardOptions), fallback.beardVariant),
    earringsVariant: enumValue(source.earringsVariant, optionValues(earringsOptions), fallback.earringsVariant),
    glasses: booleanValue(source.glasses, fallback.glasses),
    beard: booleanValue(source.beard, fallback.beard),
    freckles: booleanValue(source.freckles, fallback.freckles),
    earrings: booleanValue(source.earrings, fallback.earrings),
    hairAccessory: booleanValue(source.hairAccessory, fallback.hairAccessory),
    hairColor: enumValue(source.hairColor, avatarColors.hair, fallback.hairColor),
    skinColor: enumValue(source.skinColor, avatarColors.skin, fallback.skinColor),
    backgroundColor: enumValue(source.backgroundColor, avatarColors.background, fallback.backgroundColor),
  };
}
