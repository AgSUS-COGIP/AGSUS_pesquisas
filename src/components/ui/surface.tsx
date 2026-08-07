import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, description, className }: { label: string; value: ReactNode; description?: string; className?: string }) {
  return (
    <article className={cn("rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]", className)}>
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</p>
      <strong className="mt-2 block text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">{value}</strong>
      {description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>}
    </article>
  );
}
