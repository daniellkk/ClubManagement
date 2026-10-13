import clsx from "clsx";

/** Occupancy / progress bar — color thresholds from the design tokens:
 *  ≥80% green-500, 60–79% amber-400, <60% red-500. */
export function ProgressBar({
  percent,
  showLabel = true,
}: {
  percent: number;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color =
    clamped >= 80 ? "bg-green-500" : clamped >= 60 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-24">
      <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={clsx("h-full rounded-full", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 tabular-nums">{Math.round(clamped)}%</span>
      )}
    </div>
  );
}
