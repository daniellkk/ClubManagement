import clsx from "clsx";
import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

/**
 * Keeps the previous content visible and dims it with a centered spinner while
 * a fetch/patch/delete is in flight — no layout jump between pages.
 */
export function LoadingOverlay({
  loading,
  children,
  className,
}: {
  loading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)} aria-busy={loading}>
      {children}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60">
          <Spinner />
        </div>
      )}
    </div>
  );
}
