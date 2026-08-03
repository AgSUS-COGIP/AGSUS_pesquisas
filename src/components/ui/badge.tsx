import { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-700",
        info: "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200",
        success: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
        warning: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
        danger: "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200",
        outline: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300",
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
