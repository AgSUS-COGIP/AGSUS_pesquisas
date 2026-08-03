"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type PersonAvatarProps = {
  fullName: string;
  avatarUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  alt?: string;
};

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
  const [failed, setFailed] = useState(false);
  const normalizedUrl = typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null;

  useEffect(() => setFailed(false), [normalizedUrl]);

  if (normalizedUrl && !failed) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-slate-200", className)}>
        <img
          src={normalizedUrl}
          alt={alt ?? `Avatar de ${fullName}`}
          onError={() => setFailed(true)}
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
