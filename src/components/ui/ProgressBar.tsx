export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-[14px] w-full max-w-[156px] overflow-hidden rounded-full bg-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="flex h-full items-center rounded-full bg-ink pl-[6px] transition-all duration-300"
        style={{ width: `${clamped}%` }}
      >
        {label && clamped > 18 && <span className="text-[8px] font-bold leading-[10px] text-white">{label}</span>}
      </div>
    </div>
  );
}
