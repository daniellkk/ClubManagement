import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Card-styled section that expands/collapses on header click. */
export function Collapsible({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-start"
      >
        <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={clsx(
            "size-5 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
