import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-xl bg-track", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-[22px] border border-black/5 bg-surface p-5 shadow-card">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-7 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox, title, description, action,
}: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-track bg-white/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-thumb text-text-secondary">
        <Icon size={22} aria-hidden="true" />
      </div>
      <p className="text-[14px] font-semibold text-text-primary">{title}</p>
      <p className="max-w-xs text-[12px] leading-5 text-text-secondary">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-danger/20 bg-danger/5 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <p className="text-[14px] font-semibold text-text-primary">Something did not load</p>
      <p className="max-w-xs text-[12px] leading-5 text-text-secondary">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
