import Link from "next/link";
import { CircleAlert, LockKeyhole, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FullPageStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  tone?: "error" | "restricted";
};

const toneStyles: Record<NonNullable<FullPageStateProps["tone"]>, { icon: LucideIcon; iconClass: string; eyebrowClass: string }> = {
  error: { icon: CircleAlert, iconClass: "bg-red-50 text-red-700 ring-red-100", eyebrowClass: "text-red-700" },
  restricted: { icon: LockKeyhole, iconClass: "bg-amber-50 text-amber-800 ring-amber-100", eyebrowClass: "text-amber-800" },
};

export function FullPageState({
  eyebrow,
  title,
  description,
  actionHref = "/area",
  actionLabel = "Voltar à visão geral",
  tone = "error",
}: FullPageStateProps) {
  const styles = toneStyles[tone];
  const Icon = styles.icon;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-page)] px-5 py-10">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent),var(--brand-secondary))]" />
        <div className="p-7 text-center sm:p-9">
          <span className={cn("mx-auto grid h-14 w-14 place-items-center rounded-2xl ring-4", styles.iconClass)}>
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className={cn("mt-5 text-xs font-black uppercase tracking-[.16em]", styles.eyebrowClass)}>{eyebrow ?? (tone === "restricted" ? "Acesso restrito" : "Não foi possível continuar")}</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
          <Link href={actionHref} className={cn(buttonVariants({ size: "lg" }), "mt-7")}>{actionLabel}</Link>
        </div>
      </section>
    </main>
  );
}
