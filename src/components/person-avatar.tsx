"use client";

import { useEffect, useState } from "react";
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

export function personInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

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

  useEffect(() => {
    if (failedUrl && failedUrl !== normalizedUrl) setFailedUrl(null);
  }, [failedUrl, normalizedUrl]);

  if (normalizedUrl && !imageFailed) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-slate-200", className)}>
        <ExternalImage
          src={normalizedUrl}
          alt={alt ?? `Avatar de ${fullName}`}
          width={128}
          height={128}
          onError={() => setFailedUrl(normalizedUrl)}
          className={cn("h-full w-full object-cover", imageClassName)}
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={alt ?? `Avatar de ${fullName}`}
      className={cn(
        "grid shrink-0 place-items-center bg-sky-50 font-black text-[#003b70] ring-1 ring-sky-100",
        className,
        fallbackClassName,
      )}
    >
      {personInitials(fullName)}
    </span>
  );
}
