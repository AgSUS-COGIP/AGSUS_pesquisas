import { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
        info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)] ring-1 ring-inset ring-[var(--status-info-border)]",
        success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-1 ring-inset ring-[var(--status-success-border)]",
        warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-1 ring-inset ring-[var(--status-warning-border)]",
        danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] ring-1 ring-inset ring-[var(--status-danger-border)]",
        /** Futuro/agendado. Violeta reservado a este significado — ver `theme-foundation.css`. */
        scheduled: "bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-text)] ring-1 ring-inset ring-[var(--status-scheduled-border)]",
        outline: "bg-[var(--surface-card)] text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-strong)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
