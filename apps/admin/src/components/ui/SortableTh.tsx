import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortState } from "../../lib/table";

interface SortableThProps<K extends string> {
  columnKey: K;
  label: string;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  className?: string;
}

/** Table header cell that sorts its column on click. */
export function SortableTh<K extends string>({
  columnKey,
  label,
  sort,
  onToggle,
  className,
}: SortableThProps<K>) {
  const active = sort.key === columnKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={clsx("px-4 py-3 text-start font-medium", className)}>
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={clsx(
          "inline-flex items-center gap-1 rounded hover:text-gray-900",
          active ? "text-gray-900" : "text-gray-500",
        )}
      >
        {label}
        <Icon className={clsx("size-3.5", active ? "text-brand" : "text-gray-300")} />
      </button>
    </th>
  );
}
