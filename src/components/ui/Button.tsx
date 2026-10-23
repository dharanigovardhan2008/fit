import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-on-ink shadow-dark-button hover:bg-[#1c1c1c] active:scale-[0.98]",
  secondary: "bg-white text-text-primary border border-track hover:border-ink/30 active:scale-[0.98]",
  ghost: "bg-transparent text-text-primary hover:bg-black/5 active:scale-[0.98]",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger/5 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-xl",
  md: "h-[50px] px-6 text-sm rounded-2xl",
  lg: "h-[60px] px-8 text-sm rounded-[18px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, fullWidth, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
