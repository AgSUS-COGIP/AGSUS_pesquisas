"use client";

import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3.5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/20";

function FieldText({ id, children, error = false }: { id: string; children: ReactNode; error?: boolean }) {
  return (
    <p id={id} className={cn("mt-2 text-xs leading-5", error ? "font-semibold text-[var(--status-danger-text)]" : "text-[var(--text-secondary)]")}>
      {children}
    </p>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id: providedId, label, hint, error, className, containerClassName, required, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required && <span className="ml-1 text-[var(--status-danger-text)]" aria-hidden="true">*</span>}
      </label>
      {hint && <FieldText id={hintId!}>{hint}</FieldText>}
      <input
        {...props}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(controlClass, className)}
      />
      {error && <FieldText id={errorId!} error>{error}</FieldText>}
    </div>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id: providedId, label, hint, error, className, containerClassName, required, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required && <span className="ml-1 text-[var(--status-danger-text)]" aria-hidden="true">*</span>}
      </label>
      {hint && <FieldText id={hintId!}>{hint}</FieldText>}
      <textarea
        {...props}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(controlClass, "min-h-28 resize-y", className)}
      />
      {error && <FieldText id={errorId!} error>{error}</FieldText>}
    </div>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id: providedId, label, hint, error, className, containerClassName, required, children, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">
        {label}
        {required && <span className="ml-1 text-[var(--status-danger-text)]" aria-hidden="true">*</span>}
      </label>
      {hint && <FieldText id={hintId!}>{hint}</FieldText>}
      <select
        {...props}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(controlClass, className)}
      >
        {children}
      </select>
      {error && <FieldText id={errorId!} error>{error}</FieldText>}
    </div>
  );
});

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
  error?: string;
  type?: "checkbox" | "radio";
  containerClassName?: string;
};

const Choice = forwardRef<HTMLInputElement, ChoiceProps>(function Choice(
  { id: providedId, label, description, error, type = "checkbox", className, containerClassName, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className={containerClassName}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border bg-[var(--surface-card)] p-4 transition hover:border-[var(--border-strong)]",
          error ? "border-[var(--status-danger-border)]" : "border-[var(--border-subtle)]",
        )}
      >
        <input
          {...props}
          ref={ref}
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 border-[var(--border-strong)] accent-[var(--brand-solid)] focus-visible:outline-none",
            className,
          )}
        />
        <span className="min-w-0">
          <strong className="block text-sm font-semibold text-[var(--text-primary)]">{label}</strong>
          {description && <span id={descriptionId} className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{description}</span>}
        </span>
      </label>
      {error && <FieldText id={errorId!} error>{error}</FieldText>}
    </div>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, Omit<ChoiceProps, "type">>(function Checkbox(props, ref) {
  return <Choice {...props} ref={ref} type="checkbox" />;
});

