import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "dark" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  /** Shows a spinner in place of the icon and disables the button */
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  dark: "bg-gray-900 text-white hover:bg-gray-800",
  ghost: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  danger: "bg-brand text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  icon,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <Spinner size="sm" tone={variant === "ghost" ? "brand" : "white"} /> : icon}
      {children}
    </button>
  );
}
