import type { FilterMap, FilterOption } from "./column-filters";
import type { PagedQuery, PagedResult } from "./paging";

// Fans live in Postgres — every call here is a paged / bounded API request.

export type FanStatusCode = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface ApiFan {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  age: number | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  oldEmail: string | null;
  legacyId: string | null;
  status: FanStatusCode;
  memberSince: string | null;
  engagementScore: number;
  appLastLoginAt: string | null;
  lastActivityAt: string | null;
  seatArea: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  importedAt: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  pushOptIn: boolean;
  currentSubscription: { type: string; status: string; paymentStatus: string } | null;
}

export interface FanDetail extends ApiFan {
  tags: string[];
  attendanceStats: { total: number; home: number; away: number };
  matchHistory: {
    gameId: string;
    opponent: string;
    venue: "HOME" | "AWAY";
    date: string;
    attended: boolean;
  }[];
}

export interface FanListQuery extends PagedQuery {
  q?: string;
  filters: FilterMap;
}

export interface ImportRow {
  customerNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  oldEmail?: string;
  legacyId?: string;
  phone?: string;
  city?: string;
  age?: number;
  /** as written in the file ("15/03/1988", ISO, Excel serial) — parsed by the API */
  birthDate?: string;
  seatArea?: string;
  seatRow?: string;
  seatNumber?: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  /** true when the user cancelled — counts are what was already saved */
  cancelled?: boolean;
  /** rows sent successfully before finishing/cancelling */
  done?: number;
}

export const IMPORT_CHUNK = 1000;
export const EXISTS_CHUNK = 1000;

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function serializeFilters(filters: FilterMap): string | undefined {
  const obj: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(filters)) {
    if (set) obj[key] = [...set];
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : undefined;
}

export function queryFans(query: FanListQuery): Promise<PagedResult<ApiFan>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.sortKey) params.set("sortKey", query.sortKey);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  const filters = serializeFilters(query.filters);
  if (filters) params.set("filters", filters);
  return request(`/api/fans?${params.toString()}`);
}

export function fanFacets(
  column: string,
  query: { q?: string; filters: FilterMap },
): Promise<FilterOption[]> {
  const params = new URLSearchParams({ column });
  if (query.q?.trim()) params.set("q", query.q.trim());
  const filters = serializeFilters(query.filters);
  if (filters) params.set("filters", filters);
  return request(`/api/fans/facets?${params.toString()}`);
}

export function fetchFan(id: string): Promise<FanDetail> {
  return request(`/api/fans/${encodeURIComponent(id)}`);
}

export interface UpdateFanInput {
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  email?: string;
  phone?: string;
}

export function updateFan(id: string, input: UpdateFanInput): Promise<ApiFan> {
  return request(`/api/fans/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFan(id: string): Promise<{ ok: boolean }> {
  return request(`/api/fans/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Which of the given customer numbers already exist (chunked). */
export async function checkExisting(customerNumbers: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < customerNumbers.length; i += EXISTS_CHUNK) {
    const chunk = customerNumbers.slice(i, i + EXISTS_CHUNK);
    const res = await request<{ existing: string[] }>("/api/fans/exists", {
      method: "POST",
      body: JSON.stringify({ customerNumbers: chunk }),
    });
    for (const n of res.existing) found.add(n);
  }
  return found;
}

/**
 * Sends the file to the API in chunks; the DB is the only place rows are stored.
 * Cancelling via `signal` stops after the chunk in flight — chunks already
 * saved stay saved and are reported in the result.
 */
export async function importFans(
  fileName: string,
  rows: ImportRow[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, cancelled: false, done: 0 };
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    if (signal?.aborted) {
      result.cancelled = true;
      break;
    }
    const chunk = rows.slice(i, i + IMPORT_CHUNK);
    try {
      const res = await request<ImportResult>("/api/fans/import", {
        method: "POST",
        body: JSON.stringify({ fileName, rows: chunk }),
        signal,
      });
      result.added += res.added;
      result.updated += res.updated;
      result.done = Math.min(rows.length, i + chunk.length);
      onProgress?.(result.done, rows.length);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        result.cancelled = true;
        break;
      }
      throw err;
    }
  }
  return result;
}

// ── Display helpers ─────────────────────────────────────────────────────────

// Club tiers are רגיל / כסף / VIP; legacy labels from older exports fold into them
const SUB_TYPE_CODES: Record<string, string> = {
  רגיל: "regular",
  regular: "regular",
  סטודנט: "regular",
  student: "regular",
  כסף: "silver",
  silver: "silver",
  זהב: "silver",
  gold: "silver",
  ותיק: "silver",
  veteran: "silver",
  VIP: "vip",
  vip: "vip",
};

/** Subscription types are free text in the DB; known ones get translated. */
export function subTypeLabel(
  type: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!type) return null;
  const code = SUB_TYPE_CODES[type] ?? SUB_TYPE_CODES[type.toLowerCase()];
  return code ? t(`subTypes.${code}`) : type;
}

export function statusLabel(status: FanStatusCode, t: (key: string) => string): string {
  return t(`status.${status.toLowerCase()}`);
}

export function seatLabel(
  fan: Pick<ApiFan, "seatArea" | "seatRow" | "seatNumber">,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!fan.seatArea && !fan.seatRow && !fan.seatNumber) return "";
  return t("fans.seatFormat", {
    area: fan.seatArea ?? "—",
    row: fan.seatRow ?? "—",
    seat: fan.seatNumber ?? "—",
  });
}
