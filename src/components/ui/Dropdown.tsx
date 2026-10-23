import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface DropdownProps {
  id?: string;
  label?: string;
  required?: boolean;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra buttons at the bottom of the list, for example "+ Add gym" */
  actions?: DropdownAction[];
  /** "pill" is the compact header style, "field" matches form inputs */
  variant?: "pill" | "field";
  align?: "left" | "right";
  ariaLabel?: string;
  className?: string;
}

// A dropdown that matches the app's look (the browser's own list cannot be styled).
export function Dropdown({
  id, label, required, value, options, onChange, placeholder = "Select", actions, variant = "field",
  align = "left", ariaLabel, className,
}: DropdownProps) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(next: string) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (options.length ? (a + step + options.length) % options.length : -1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active].value);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={buttonId} className="text-[13px] font-medium text-text-primary">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
        <button
          id={buttonId}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          }}
          className={cn(
            "flex w-full items-center justify-between gap-3 text-left text-text-primary transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/10",
            variant === "pill"
              ? "h-10 max-w-[240px] rounded-full border border-track bg-white px-4 text-[13px] font-medium shadow-card hover:border-ink/20"
              : "h-[50px] rounded-[18px] border border-transparent bg-thumb px-4 text-sm focus:border-ink/40",
          )}
        >
          <span className={cn("truncate", !selected && "text-text-secondary")}>{selected?.label ?? placeholder}</span>
          <ChevronDown size={16} className={cn("shrink-0 text-text-secondary transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>

        {open && (
          <div
            role="listbox"
            className={cn(
              "absolute z-50 mt-2 max-h-72 min-w-full w-max max-w-[300px] overflow-y-auto rounded-2xl border border-black/5 bg-white p-1.5 shadow-dock no-scrollbar animate-fade-in",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {options.length === 0 && <p className="px-3 py-2 text-[13px] text-text-secondary">Nothing to choose yet</p>}
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors",
                  o.value === value ? "bg-ink font-semibold text-on-ink" : i === active ? "bg-thumb text-text-primary" : "text-text-primary hover:bg-thumb",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
            {actions && actions.length > 0 && (
              <div className="mt-1.5 border-t border-track pt-1.5">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      a.onClick();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-text-primary transition-colors hover:bg-thumb"
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
