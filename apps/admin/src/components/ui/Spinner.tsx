import clsx from "clsx";
import { useTranslation } from "react-i18next";

type Size = "sm" | "md" | "lg";
type Tone = "brand" | "white";

const sizes: Record<Size, string> = {
  sm: "size-4 border-2",
  md: "size-8 border-2",
  lg: "size-12 border-[3px]",
};

/** The one loader used everywhere — a ring in the club's primary color. */
export function Spinner({
  size = "md",
  tone = "brand",
  className,
}: {
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      role="status"
      aria-label={t("common.loading")}
      className={clsx(
        "inline-block shrink-0 animate-spin rounded-full border-t-transparent",
        tone === "brand" ? "border-brand" : "border-white",
        sizes[size],
        className,
      )}
    />
  );
}
