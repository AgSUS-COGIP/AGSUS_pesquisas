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
  "mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-100";

function FieldText({ id, children, error = false }: { id: string; children: ReactNode; error?: boolean }) {
  return (
    <p id={id} className={cn("mt-2 text-xs leading-5", error ? "font-semibold text-red-700" : "text-slate-500")}>
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
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
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
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
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
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
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

export type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
  error?: string;
  type?: "checkbox" | "radio";
  containerClassName?: string;
};

export const Choice = forwardRef<HTMLInputElement, ChoiceProps>(function Choice(
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
          "flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-slate-300",
          error ? "border-red-400" : "border-[var(--border-subtle)]",
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
            "mt-0.5 h-5 w-5 shrink-0 border-slate-300 accent-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
            className,
          )}
        />
        <span className="min-w-0">
          <strong className="block text-sm font-semibold text-slate-900">{label}</strong>
          {description && <span id={descriptionId} className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}
        </span>
      </label>
      {error && <FieldText id={errorId!} error>{error}</FieldText>}
    </div>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, Omit<ChoiceProps, "type">>(function Checkbox(props, ref) {
  return <Choice {...props} ref={ref} type="checkbox" />;
});

export const Radio = forwardRef<HTMLInputElement, Omit<ChoiceProps, "type">>(function Radio(props, ref) {
  return <Choice {...props} ref={ref} type="radio" />;
});
