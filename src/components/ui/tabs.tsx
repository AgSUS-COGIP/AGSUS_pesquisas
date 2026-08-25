"use client";

import { ButtonHTMLAttributes, ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

export function Tabs({ items, defaultValue, ariaLabel = "Seções", className }: { items: TabItem[]; defaultValue?: string; ariaLabel?: string; className?: string }) {
  const firstEnabled = items.find((item) => !item.disabled)?.value ?? "";
  const [value, setValue] = useState(defaultValue && items.some((item) => item.value === defaultValue && !item.disabled) ? defaultValue : firstEnabled);
  const baseId = useId();
  const active = items.find((item) => item.value === value) ?? items.find((item) => !item.disabled);

  function move(currentIndex: number, direction: 1 | -1) {
    if (!items.length) return;
    let nextIndex = currentIndex;
    for (let attempt = 0; attempt < items.length; attempt += 1) {
      nextIndex = (nextIndex + direction + items.length) % items.length;
      if (!items[nextIndex]?.disabled) {
        setValue(items[nextIndex].value);
        window.requestAnimationFrame(() => document.getElementById(`${baseId}-tab-${items[nextIndex].value}`)?.focus());
        return;
      }
    }
  }

  return (
    <section className={className}>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-1">
        {items.map((item, index) => (
          <button
            key={item.value}
            id={`${baseId}-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={value === item.value}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={value === item.value ? 0 : -1}
            disabled={item.disabled}
            onClick={() => setValue(item.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); move(index, 1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); move(index, -1); }
              if (event.key === "Home") { event.preventDefault(); setValue(firstEnabled); }
              if (event.key === "End") {
                event.preventDefault();
                const last = [...items].reverse().find((candidate) => !candidate.disabled);
                if (last) setValue(last.value);
              }
            }}
            className={cn(
              "min-h-10 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              value === item.value
                ? "bg-[var(--surface-card)] text-[var(--brand-primary)] shadow-sm ring-1 ring-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {active && (
        <div
          id={`${baseId}-panel-${active.value}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active.value}`}
          tabIndex={0}
          className="mt-4 outline-none"
        >
          {active.content}
        </div>
      )}
    </section>
  );
}

export type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
