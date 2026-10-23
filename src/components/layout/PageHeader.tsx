import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-5 text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
