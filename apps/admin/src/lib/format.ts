import { currentLang } from "./i18n";

// Formatters are locale-aware: he → he-IL, en → en-US. Currency stays ILS.
function locale(): string {
  return currentLang() === "en" ? "en-US" : "he-IL";
}

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(kind: "currency" | "plain"): Intl.NumberFormat {
  const key = `${locale()}:${kind}`;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt =
      kind === "currency"
        ? new Intl.NumberFormat(locale(), {
            style: "currency",
            currency: "ILS",
            maximumFractionDigits: 0,
          })
        : new Intl.NumberFormat(locale());
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatCurrency(value: number): string {
  return numberFormat("currency").format(value);
}

/** Compact currency for KPI cards, e.g. ₪201K */
export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₪${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₪${Math.round(value / 1_000)}K`;
  return numberFormat("currency").format(value);
}

export function formatNumber(value: number): string {
  return numberFormat("plain").format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Localized month name for chart axes; month is 1-based. */
export function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale(), {
    month: "short",
  });
}
