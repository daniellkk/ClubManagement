import { LogIn } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { fetchAuthConfig, useAuth } from "../lib/auth";
import { googleIdTokenViaFirebase, preloadFirebase } from "../lib/firebase";
import { useAsync } from "../lib/use-async";

const OAUTH_ERROR_KEYS: Record<string, string> = {
  not_invited: "login.errNotInvited",
  google: "login.errGoogle",
};

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login, loginWithFirebase } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const key = OAUTH_ERROR_KEYS[searchParams.get("error") ?? ""];
    return key ? t(key) : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Which Google path the server has credentials for: Firebase popup or direct OAuth
  const { data: config } = useAsync(fetchAuthConfig, []);
  const googleAvailable = Boolean(config?.firebase || config?.google);

  // Have the SDK ready before the click so the popup opens inside the user-gesture window
  const firebaseEnabled = Boolean(config?.firebase);
  useEffect(() => {
    if (firebaseEnabled) void preloadFirebase().catch(() => undefined);
  }, [firebaseEnabled]);

  if (user) return <Navigate to="/" replace />;

  async function onGoogle() {
    if (!config) return;
    setError(null);
    if (config.firebase) {
      setGoogleBusy(true);
      try {
        const idToken = await googleIdTokenViaFirebase(config.firebase);
        if (idToken) await loginWithFirebase(idToken);
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        const code = (e as { code?: string }).code;
        console.error("Google sign-in failed", e);
        setError(
          message === "not_invited"
            ? t("login.errNotInvited")
            : `${t("login.errGoogle")}${code ? ` (${code})` : ""}`,
        );
      } finally {
        setGoogleBusy(false);
      }
    } else if (config.google) {
      window.location.assign("/api/auth/google");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand">{t("nav.clubName")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("nav.crm")}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {t("login.heading")}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-100 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("login.password")}
              </label>
              <input
                id="password"
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-start focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>

            <Button
              type="submit"
              loading={submitting}
              icon={<LogIn className="size-4" />}
              className="w-full justify-center"
            >
              {submitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">{t("login.or")}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={!googleAvailable || googleBusy}
            className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
          >
            {googleBusy ? <Spinner size="sm" /> : <GoogleIcon />}
            {googleBusy ? t("login.googleOpening") : t("login.google")}
          </button>
          {config && !googleAvailable && (
            <p className="mt-2 text-center text-xs text-gray-400">{t("login.googleUnavailable")}</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t("login.adminsOnly")}
        </p>
      </div>
    </div>
  );
}
