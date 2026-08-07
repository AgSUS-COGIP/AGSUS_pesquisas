"use client";

import { useState } from "react";
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
  const canRenderImage = Boolean(src) && failedSource !== src && !loading;

  if (canRenderImage && src) {
    return (
      <ExternalImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        onError={() => setFailedSource(src)}
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
