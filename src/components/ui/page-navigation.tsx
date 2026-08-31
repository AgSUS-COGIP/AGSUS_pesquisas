import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items, className, label = "Navegação estrutural" }: { items: BreadcrumbItem[]; className?: string; label?: string }) {
  if (!items.length) return null;

  return (
    <nav aria-label={label} className={cn("mb-3", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--border-strong)]" aria-hidden="true" />}
              {item.href && !current ? (
                <Link href={item.href} className="rounded-md px-1 py-0.5 transition hover:text-[var(--brand-primary)] focus-visible:outline-none">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? "page" : undefined} className={cn("px-1 py-0.5", current && "text-[var(--text-primary)]")}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

