/**
 * Birthdays arrive from spreadsheets as "15/03/1988", "1988-03-15", "15.3.1988"
 * or an Excel serial ("32217"). Returns a UTC midnight date, or null.
 */
export function parseBirthDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  let y: number;
  let m: number;
  let d: number;
  let match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s.*)?$/);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
  } else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else if (/^\d{4,6}$/.test(s)) {
    // Excel serial day number (1900 date system)
    const date = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    y = date.getUTCFullYear();
    m = date.getUTCMonth() + 1;
    d = date.getUTCDate();
  } else {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  const thisYear = new Date().getUTCFullYear();
  const valid =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y > 1900 && y <= thisYear;
  return valid ? date : null;
}

export function birthMonthOf(date: Date | null): number | null {
  return date ? date.getUTCMonth() + 1 : null;
}
