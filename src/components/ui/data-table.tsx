"use client";

import { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DataTableContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function DataTableToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 xl:flex-row xl:items-center xl:justify-between", className)}
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
  return <thead className={cn("bg-slate-50", className)} {...props} />;
}

export function DataTableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("border-b border-[var(--border-subtle)] px-5 py-4 text-xs font-semibold uppercase tracking-[.12em] text-slate-500", className)}
      {...props}
    />
  );
}

export function DataTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function DataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-slate-100 transition hover:bg-blue-50/40", className)} {...props} />;
}

export function DataTableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4 align-middle", className)} {...props} />;
}

export function DataTableState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-10 text-center text-sm text-slate-600", className)}>{children}</div>;
}

export function DataTableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center text-sm font-semibold text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export function DataTableFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-3 border-t border-[var(--border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)}
      {...props}
    />
  );
}
