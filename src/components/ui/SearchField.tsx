import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function SearchField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative h-[50px] w-full max-w-[327px]", className)}>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-placeholder" aria-hidden="true" />
      <input
        type="search"
        className="h-full w-full rounded-[25px] border border-transparent bg-white pl-11 pr-4 text-sm text-text-primary placeholder:text-placeholder shadow-card focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/10"
        {...rest}
      />
    </div>
  );
}
