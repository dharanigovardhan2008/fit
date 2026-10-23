import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "../../utils/cn";

export function StatCard({
  label, value, icon: Icon, tone = "default", sub,
}: { label: string; value: string; icon?: LucideIcon; tone?: "default" | "ink"; sub?: string }) {
  return (
    <Card className={cn("flex flex-col gap-3", tone === "ink" && "bg-ink text-on-ink shadow-dark-button")}>
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] font-medium uppercase tracking-wide", tone === "ink" ? "text-white/60" : "text-text-secondary")}>
          {label}
        </span>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", tone === "ink" ? "bg-white/10" : "bg-thumb")}>
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="text-[26px] font-semibold leading-8">{value}</span>
      {sub && <span className={cn("text-[11px]", tone === "ink" ? "text-white/60" : "text-text-secondary")}>{sub}</span>}
    </Card>
  );
}
