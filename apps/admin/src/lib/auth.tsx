import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  googleLinked: boolean;
  clubId: string;
  clubName: string;
  clubPrimaryColor: string;
  clubLogoUrl: string | null;
  clubSymbol: string | null;
  onboarded: boolean;
}

export interface OnboardingInput {
  ownerName: string;
  clubName: string;
  symbol: string;
  primaryColor: string;
  /** omitted = keep the current logo, null = remove it, string = new data URL */
  logoDataUrl?: string | null;
}

export interface TeamSymbol {
  code: string;
  name: string;
  nameEn: string;
}

/** Team symbols the wizard offers — maintained on the API in one place. */
export async function fetchTeamSymbols(): Promise<TeamSymbol[]> {
  const res = await fetch("/api/auth/team-symbols");
  if (!res.ok) throw new Error(await readError(res, "failed"));
  return (await res.json()) as TeamSymbol[];
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

/** Sign-in methods the API has credentials for */
export interface AuthConfig {
  google: boolean;
  firebase: FirebaseWebConfig | null;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch("/api/auth/config");
  if (!res.ok) return { google: false, firebase: null };
  return (await res.json()) as AuthConfig;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Exchange a Firebase ID token (after the Google popup) for our session */
  loginWithFirebase: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_PRIMARY = "#dc2626";

/** Darken a hex color by a fraction (0–1) for hover states. */
export function darkenHex(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const f = 1 - amount;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Per-tenant theme: the club's brand color drives every `brand` token. */
export function applyBrandColor(color: string | undefined) {
  const primary = color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_PRIMARY;
  const root = document.documentElement.style;
  root.setProperty("--tenant-primary", primary);
  root.setProperty("--tenant-primary-hover", darkenHex(primary, 0.15));
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return message ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me: AdminUser | null) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the CSS theme in sync with the signed-in club
  useEffect(() => {
    applyBrandColor(user?.clubPrimaryColor);
  }, [user?.clubPrimaryColor]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await readError(res, "ההתחברות נכשלה, נסה שוב"));
    setUser((await res.json()) as AdminUser);
  }, []);

  const loginWithFirebase = useCallback(async (idToken: string) => {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error(await readError(res, "ההתחברות נכשלה, נסה שוב"));
    setUser((await res.json()) as AdminUser);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }, []);

  const completeOnboarding = useCallback(async (input: OnboardingInput) => {
    const res = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, "השמירה נכשלה, נסה שוב"));
    setUser((await res.json()) as AdminUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginWithFirebase, logout, completeOnboarding }),
    [user, loading, login, loginWithFirebase, logout, completeOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
