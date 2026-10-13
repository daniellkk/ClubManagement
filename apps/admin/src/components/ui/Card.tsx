import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl bg-white border border-gray-100 shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 pt-5">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
