"use client";

import { useEffect } from "react";

export function CddiScrollBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("cddi-route-active");
    body.classList.add("cddi-route-active");

    const applyMode = () => {
      const main = document.querySelector<HTMLElement>(".cddi-route-shell > main");
      const footer = main?.querySelector<HTMLElement>(":scope > footer");
      const content = main?.querySelector<HTMLElement>(":scope > div");
      const banner = content?.firstElementChild instanceof HTMLElement ? content.firstElementChild : null;

      main?.classList.toggle("cddi-form-mode", Boolean(footer));
      content?.classList.toggle("cddi-form-content", Boolean(footer));
      banner?.classList.toggle("cddi-form-banner", Boolean(footer));
    };

    applyMode();
    const observer = new MutationObserver(applyMode);
    observer.observe(document.querySelector(".cddi-route-shell") ?? body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      html.classList.remove("cddi-route-active");
      body.classList.remove("cddi-route-active");
    };
  }, []);

  return <div className="cddi-route-shell">{children}</div>;
}
