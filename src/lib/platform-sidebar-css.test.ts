import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sidebarCss = readFileSync(join(process.cwd(), "src/app/sidebar-monitora.css"), "utf8");

describe("compact sidebar first paint", () => {
  it("hides expanded group labels from the persisted compact state before React sync", () => {
    expect(sidebarCss).toContain(
      'html[data-agsus-sidebar-compact="true"] aside.platform-desktop-sidebar section > p',
    );
    expect(sidebarCss).toContain(
      'html[data-agsus-sidebar-compact="true"] aside.platform-desktop-sidebar nav a > span:not(:first-child)',
    );
    expect(sidebarCss).toContain("display: none !important;");
  });

  it("keeps compact navigation targets centered at the expected width", () => {
    expect(sidebarCss).toContain("width: 2.75rem;");
    expect(sidebarCss).toContain("justify-content: center;");
  });
});
