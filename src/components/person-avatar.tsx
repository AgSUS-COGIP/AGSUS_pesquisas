"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { ExternalImage } from "@/components/external-image";
import { cn } from "@/lib/utils";

type PersonAvatarProps = {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  alt?: string;
};

function validAvatarUrl(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Foto institucional proveniente da conta Google.
 * Quando a conta não fornece uma imagem ou o carregamento falha, exibe somente
 * um ícone neutro: a plataforma não gera avatares nem usa iniciais.
 */
export function PersonAvatar({
  fullName,
  avatarUrl,
  className,
  imageClassName,
  fallbackClassName,
  alt,
}: PersonAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const normalizedUrl = validAvatarUrl(avatarUrl);
  const imageFailed = Boolean(normalizedUrl && failedUrl === normalizedUrl);

  // Uma URL diferente da que falhou merece nova tentativa.
  useEffect(() => {
    if (failedUrl && failedUrl !== normalizedUrl) setFailedUrl(null);
  }, [failedUrl, normalizedUrl]);

  if (normalizedUrl && !imageFailed) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-slate-200", className)}>
        <ExternalImage
          src={normalizedUrl}
          alt={alt ?? `Foto de ${fullName}`}
          width={128}
          height={128}
          onError={() => setFailedUrl(normalizedUrl)}
          className={cn("h-full w-full object-cover", imageClassName)}
          // Exigido pelas URLs de foto do Google, que recusam requisição com referer.
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={alt ?? `Foto do Google indisponível para ${fullName}`}
      className={cn(
        "grid shrink-0 place-items-center bg-slate-100 text-slate-400 ring-1 ring-slate-200",
        className,
      )}
    >
      <UserRound aria-hidden="true" className={cn("h-1/2 w-1/2", fallbackClassName)} />
    </span>
  );
}
