"use client";

import { useEffect } from "react";

export function CddiScrollBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    document.documentElement.classList.add("cddi-route-active");
    document.body.classList.add("cddi-route-active");
    return () => {
      document.documentElement.classList.remove("cddi-route-active");
      document.body.classList.remove("cddi-route-active");
    };
  }, []);

  return <div className="cddi-route-shell">{children}</div>;
}
