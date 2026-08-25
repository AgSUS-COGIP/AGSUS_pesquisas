import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformSkeleton } from "./platform-skeleton";

vi.mock("./ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div aria-hidden="true" className={className} />,
}));

describe("progresso visual da entrada", () => {
  it("mostra uma indicação visível e acessível durante o pós-login", () => {
    const html = renderToStaticMarkup(
      <PlatformSkeleton title="Entrando no sistema" showProgress />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<p[^>]*>Entrando no sistema…<\/p>/);
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("não acrescenta texto visual nos carregamentos comuns", () => {
    const html = renderToStaticMarkup(<PlatformSkeleton title="Carregando pesquisas" />);
    expect(html).not.toMatch(/<p[^>]*>Carregando pesquisas…<\/p>/);
  });
});
