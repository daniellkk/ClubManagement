import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Active-filter pill with a clear button. */
export function FilterChip({
  children,
  onClear,
  clearLabel,
}: {
  children: ReactNode;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-brand/30 ps-3 pe-1.5 py-1 text-xs font-medium text-brand">
      {children}
      <button
        type="button"
        onClick={onClear}
        title={clearLabel}
        className="rounded-full p-0.5 hover:bg-brand hover:text-white transition-colors"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
