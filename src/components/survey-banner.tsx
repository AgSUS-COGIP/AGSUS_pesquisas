"use client";

import { useState } from "react";
import { ExternalImage } from "@/components/external-image";

type SurveyBannerProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Capa institucional de uma pesquisa, com degradação para um bloco de gradiente
 * e `role="img"` caso a arte não carregue — a capa nunca deixa buraco no layout.
 *
 * Não há mais capa personalizada por ciclo: `src` é sempre o padrão institucional
 * resolvido por `resolveSurveyVisualIdentity()`. O `fallbackSrc` da versão
 * anterior deixou de existir porque apontava para essa mesma arte.
 */
export function SurveyBanner({
  src,
  alt,
  className,
}: SurveyBannerProps) {
  const [failed, setFailed] = useState(false);
  const activeSrc = failed ? null : src || null;

  function handleError() {
    setFailed(true);
  }

  if (!activeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`grid min-h-36 w-full place-items-center bg-gradient-to-r from-[#06355f] via-[#006d8f] to-[#0b8f58] px-6 text-center text-white ${className ?? ""}`}
      >
        <strong className="text-lg sm:text-xl">Identidade institucional AgSUS</strong>
      </div>
    );
  }

  return (
    <ExternalImage
      src={activeSrc}
      alt={alt}
      width={1600}
      height={400}
      className={className}
      onError={handleError}
    />
  );
}
