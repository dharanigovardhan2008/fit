import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "home" | "list";
}

export function Chip({ active, size = "list", className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-6 text-[12px] font-medium leading-4 transition-colors duration-200",
        size === "home" ? "h-11" : "h-8",
        active ? "bg-ink text-on-ink" : "bg-thumb text-text-secondary hover:text-text-primary",
        className,
      )}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral", children, className,
}: { tone?: "neutral" | "success" | "warning" | "warn" | "danger" | "ink"; children: React.ReactNode; className?: string }) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-track text-text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    warn: "bg-amber-100 text-amber-700",
    danger: "bg-danger/10 text-danger",
    ink: "bg-ink text-on-ink",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
