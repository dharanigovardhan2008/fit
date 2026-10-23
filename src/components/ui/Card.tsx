import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[22px] border border-black/5 bg-surface p-5 shadow-card", className)}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[14px] font-semibold leading-5 text-text-primary", className)} {...rest} />;
}

export function CardSubtitle({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[11px] leading-4 text-text-secondary", className)} {...rest} />;
}
