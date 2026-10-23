import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id: string;
}

function FieldShell({
  label, error, hint, required, id, children,
}: FieldWrapperProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] leading-4 text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-4 text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, id, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-[50px] w-full rounded-[18px] border bg-thumb px-4 text-sm text-text-primary placeholder:text-placeholder transition-colors",
          error ? "border-danger" : "border-transparent focus:border-ink/40",
          "focus:outline-none focus:ring-2 focus:ring-ink/10",
          className,
        )}
        aria-invalid={!!error}
        {...rest}
      />
    </FieldShell>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, required, id, className, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <select
        ref={ref}
        id={id}
        className={cn(
          "h-[50px] w-full rounded-[18px] border bg-thumb px-4 text-sm text-text-primary transition-colors",
          error ? "border-danger" : "border-transparent focus:border-ink/40",
          "focus:outline-none focus:ring-2 focus:ring-ink/10",
          className,
        )}
        aria-invalid={!!error}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, id, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "min-h-[96px] w-full rounded-[18px] border bg-thumb px-4 py-3 text-sm text-text-primary placeholder:text-placeholder transition-colors",
          error ? "border-danger" : "border-transparent focus:border-ink/40",
          "focus:outline-none focus:ring-2 focus:ring-ink/10",
          className,
        )}
        aria-invalid={!!error}
        {...rest}
      />
    </FieldShell>
  );
});
