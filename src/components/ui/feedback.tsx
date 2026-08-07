import { AlertCircle, Inbox } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ErrorSummary({ title = "Revise as informações", errors, className }: { title?: string; errors: string[]; className?: string }) {
  if (!errors.length) return null;
  return (
    <section role="alert" aria-labelledby="error-summary-title" tabIndex={-1} className={cn("rounded-xl border border-red-300 bg-red-50 p-4 text-red-950", className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
        <div>
          <h2 id="error-summary-title" className="font-semibold">{title}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function EmptyState({ title, description, icon, action, className }: { title: string; description: string; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center", className)}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)]">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}
