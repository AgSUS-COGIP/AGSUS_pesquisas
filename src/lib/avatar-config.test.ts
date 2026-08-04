import { describe, expect, it } from "vitest";
import { defaultAvatarConfig, normalizeAvatarConfig } from "./avatar-config";

describe("normalizeAvatarConfig", () => {
  it("creates a complete stable configuration when metadata is missing", () => {
    expect(normalizeAvatarConfig(null, "Ana Souza")).toEqual(defaultAvatarConfig("Ana Souza"));
  });

  it("preserves every supported personalized feature", () => {
    const config = normalizeAvatarConfig({
      version: 1,
      style: "lorelei",
      seed: "perfil-ana",
      hairVariant: "variant31",
      eyesVariant: "variant16",
      mouthVariant: "happy12",
      eyebrowsVariant: "variant08",
      headVariant: "variant03",
      noseVariant: "variant06",
      glassesVariant: "variant05",
      beardVariant: "variant02",
      earringsVariant: "variant03",
      glasses: true,
      beard: true,
      freckles: true,
      earrings: true,
      hairAccessory: true,
      hairColor: "6b4226",
      skinColor: "ae5d29",
      backgroundColor: "f4eeff",
    }, "Ana Souza");

    expect(config).toMatchObject({
      seed: "perfil-ana",
      hairVariant: "variant31",
      eyesVariant: "variant16",
      mouthVariant: "happy12",
      noseVariant: "variant06",
      glasses: true,
      earrings: true,
      hairAccessory: true,
      skinColor: "ae5d29",
    });
  });

  it("replaces invalid or malformed metadata with safe defaults", () => {
    const config = normalizeAvatarConfig({
      seed: " ",
      hairVariant: "unknown",
      noseVariant: "variant99",
      glasses: "yes",
      skinColor: "javascript",
    }, "Bruno Lima");

    expect(config).toEqual(defaultAvatarConfig("Bruno Lima"));
  });
});
