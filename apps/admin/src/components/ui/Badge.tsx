import clsx from "clsx";
import type { ReactNode } from "react";

// Variants map 1:1 to the design's Table & Badge Colors tokens
export type BadgeVariant =
  | "success" // High / active — green-100 / green-700
  | "warning" // Medium — amber-100 / amber-700
  | "danger" // Low / urgent — red-100 / red-700
  | "league" // League badge — blue-50 / blue-700
  | "cup" // Cup badge — purple-50 / purple-700
  | "subscriber" // Subscriber type — blue-100 / blue-800
  | "neutral";

const variants: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  league: "bg-blue-50 text-blue-700",
  cup: "bg-purple-50 text-purple-700",
  subscriber: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}

/** Maps a competition code to its badge variant + i18n label key. */
export function competitionBadge(competition: string): {
  variant: BadgeVariant;
  labelKey: string;
} {
  switch (competition) {
    case "LEAGUE":
      return { variant: "league", labelKey: "competition.league" };
    case "CUP":
      return { variant: "cup", labelKey: "competition.cup" };
    case "EUROPE":
      return { variant: "cup", labelKey: "competition.europe" };
    default:
      return { variant: "neutral", labelKey: "competition.other" };
  }
}
