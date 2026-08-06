import { describe, expect, it } from "vitest";
import { getAdminSupabaseConfigurationStatus } from "./admin";

describe("getAdminSupabaseConfigurationStatus", () => {
  it("aceita a URL e a chave secreta modernas", () => {
    const status = getAdminSupabaseConfigurationStatus({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_example",
    });

    expect(status).toEqual({
      configured: true,
      hasUrl: true,
      hasSecretKey: true,
      missingVariables: [],
    });
  });

  it("mantém compatibilidade com as variáveis legadas", () => {
    const status = getAdminSupabaseConfigurationStatus({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role-key",
    });

    expect(status.configured).toBe(true);
    expect(status.missingVariables).toEqual([]);
  });

  it("informa quando a chave administrativa está ausente", () => {
    const status = getAdminSupabaseConfigurationStatus({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(status.configured).toBe(false);
    expect(status.hasUrl).toBe(true);
    expect(status.hasSecretKey).toBe(false);
    expect(status.missingVariables).toEqual([
      "SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY",
    ]);
  });
});
