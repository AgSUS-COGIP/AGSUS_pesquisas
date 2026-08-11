"use client";

import { useEffect, useState } from "react";
import { ExternalImage } from "@/components/external-image";
import { cn } from "@/lib/utils";

type PlatformLogoProps = {
  src: string | null | undefined;
  alt: string;
  organizationName: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  loading?: boolean;
  className?: string;
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function PlatformLogo({
  src,
  alt,
  organizationName,
  width,
  height,
  sizes,
  priority,
  loading = false,
  className,
}: PlatformLogoProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Renderiza o logotipo assim que houver uma URL — mesmo durante o carregamento
  // da marca. `src` já vem com o padrão institucional (logo local) antes de a
  // busca terminar, então a marca do banco apenas o substitui quando chega. Sem
  // isso, a tela pública exibia um quadrado cinza pulsante até a marca resolver.
  //
  // `readySrc` mantém a imagem visível até a próxima terminar de carregar. Quando
  // `src` muda (logo local → marca do banco, a mesma arte), trocar direto causava
  // um "piscar"; aqui a nova URL é pré-carregada e só entra quando está pronta.
  const [readySrc, setReadySrc] = useState<string | null>(src ?? null);

  useEffect(() => {
    if (!src || src === readySrc) return;
    let active = true;
    const image = new window.Image();
    image.onload = () => { if (active) setReadySrc(src); };
    image.onerror = () => { if (active) setFailedSource(src); };
    image.src = src;
    return () => { active = false; };
  }, [src, readySrc]);

  const displaySrc = readySrc ?? src;
  const canRenderImage = Boolean(displaySrc) && failedSource !== displaySrc;

  if (canRenderImage && displaySrc) {
    return (
      <ExternalImage
        src={displaySrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        onError={() => setFailedSource(displaySrc)}
        className={className}
      />
    );
  }

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "inline-grid place-items-center rounded-[inherit] bg-[color-mix(in_srgb,var(--brand-solid)_12%,white)] font-black tracking-[-0.08em] text-[var(--brand-solid)]",
        className,
      )}
    >
      {loading ? (
        <span className="h-1/2 w-1/2 animate-pulse rounded-lg bg-current/15" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{initials(organizationName)}</span>
      )}
    </span>
  );
}
