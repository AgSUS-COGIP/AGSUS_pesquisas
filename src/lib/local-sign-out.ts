type LocalSignOutOptions = { scope: "local" };

type LocalSignOutDependencies = {
  signOut: (options: LocalSignOutOptions) => Promise<{ error: unknown | null }>;
  navigate: (destination: "/acesso") => void;
};

export type LocalSignOutResult =
  | { ok: true }
  | { ok: false; error: unknown };

/** Encerra a sessão atual antes de navegar; falha nunca finge logout concluído. */
export async function finishLocalSignOut({
  signOut,
  navigate,
}: LocalSignOutDependencies): Promise<LocalSignOutResult> {
  try {
    const { error } = await signOut({ scope: "local" });
    if (error) return { ok: false, error };

    navigate("/acesso");
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
