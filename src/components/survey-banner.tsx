"use client";

import { useState } from "react";
import { ExternalImage } from "@/components/external-image";

type SurveyBannerProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
};

export function SurveyBanner({
  src,
  fallbackSrc,
  alt,
  className,
}: SurveyBannerProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(src || fallbackSrc || null);

  function handleError() {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      return;
    }
    setActiveSrc(null);
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
