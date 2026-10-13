import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";

// Icon backgrounds per the KPI Card Icon Backgrounds token table
export type KpiIconColor = "red" | "blue" | "green" | "purple" | "amber" | "gray";

const iconStyles: Record<KpiIconColor, string> = {
  red: "bg-red-50 text-brand",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  purple: "bg-purple-50 text-purple-600",
  amber: "bg-amber-50 text-amber-600",
  gray: "bg-gray-100 text-gray-600",
};

interface KpiCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  iconColor?: KpiIconColor;
  /** e.g. "+12% מחודש שעבר" — rendered green (positive) or red (negative) */
  delta?: string;
  deltaPositive?: boolean;
  /** extra muted line, e.g. "מתוך 17 מתוכננים" */
  sub?: string;
  /** optional custom footer (e.g. a progress bar) */
  footer?: ReactNode;
  /** explanation shown in an ⓘ tooltip next to the label */
  info?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  iconColor = "gray",
  delta,
  deltaPositive = true,
  sub,
  footer,
  info,
}: KpiCardProps) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div
          className={clsx(
            "flex size-11 items-center justify-center rounded-lg",
            iconStyles[iconColor],
          )}
        >
          {icon}
        </div>
        {delta && (
          <span
            className={clsx(
              "flex items-center gap-1 text-xs font-medium",
              deltaPositive ? "text-green-700" : "text-red-600",
            )}
          >
            {deltaPositive ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-gray-600">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      {delta && (
        <p
          className={clsx(
            "mt-1 text-xs font-medium",
            deltaPositive ? "text-green-700" : "text-red-600",
          )}
        >
          {delta}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
