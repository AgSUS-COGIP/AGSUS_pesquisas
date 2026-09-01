"use client";

import { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DataTableContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function DataTableScroll({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left", className)} {...props} />;
}

export function DataTableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[var(--surface-muted)]", className)} {...props} />;
}

export function DataTableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("border-b border-[var(--border-subtle)] px-5 py-4 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
}

export function DataTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function DataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-[var(--border-subtle)] transition hover:bg-[var(--surface-hover)]", className)} {...props} />;
}

export function DataTableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4 align-middle", className)} {...props} />;
}

export function DataTableState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-10 text-center text-sm text-[var(--text-secondary)]", className)} {...props} />;
}

export function DataTableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center text-sm font-semibold text-[var(--text-secondary)]">
        {children}
      </td>
    </tr>
  );
}

