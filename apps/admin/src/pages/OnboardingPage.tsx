import clsx from "clsx";
import {
  Check,
  CheckCircle2,
  FileSpreadsheet,
  ImagePlus,
  LayoutDashboard,
  Palette,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ImportDialog } from "../components/fans/ImportDialog";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import {
  applyBrandColor,
  fetchTeamSymbols,
  useAuth,
  type TeamSymbol,
} from "../lib/auth";
import type { ImportResult } from "../lib/fans-api";
import { useAsync } from "../lib/use-async";

const PRESETS = ["#dc2626", "#1d4ed8", "#15803d", "#ca8a04", "#ea580c", "#7e22ce", "#111827"];
const LOGO_MAX_BYTES = 512_000;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const STEPS = ["stepDetails", "stepBranding", "stepData"] as const;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [ownerName, setOwnerName] = useState(user?.name ?? "");
  const [symbol, setSymbol] = useState(user?.clubSymbol ?? "");
  const [clubName, setClubName] = useState(user?.clubName ?? "");
  const [color, setColor] = useState(user?.clubPrimaryColor ?? "#dc2626");
  const [logo, setLogo] = useState<string | null>(user?.clubLogoUrl ?? null);
  const [logoTouched, setLogoTouched] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const { data: symbols, loading: symbolsLoading } = useAsync(fetchTeamSymbols, []);
  const symbolLabel = (s: TeamSymbol) => (i18n.language === "he" ? s.name : s.nameEn);

  // Live theme preview while choosing; restore the saved color if the user leaves
  useEffect(() => {
    applyBrandColor(color);
    return () => applyBrandColor(user?.clubPrimaryColor);
  }, [color, user?.clubPrimaryColor]);

  function chooseSymbol(code: string) {
    setSymbol(code);
    const chosen = symbols?.find((s) => s.code === code);
    // The team name follows the symbol; it stays editable afterwards
    if (chosen) setClubName(symbolLabel(chosen));
  }

  async function onLogoFile(file: File) {
    setLogoError(null);
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError(t("onboarding.logoType"));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError(t("onboarding.logoTooLarge"));
      return;
    }
    setLogo(await readAsDataUrl(file));
    setLogoTouched(true);
  }

  function removeLogo() {
    setLogo(null);
    setLogoTouched(true);
    setLogoError(null);
  }

  const detailsValid =
    ownerName.trim().length >= 2 && symbol !== "" && clubName.trim().length >= 2;

  async function finish() {
    setError(null);
    setSaving(true);
    try {
      await completeOnboarding({
        ownerName,
        clubName,
        symbol,
        primaryColor: color,
        ...(logoTouched ? { logoDataUrl: logo } : {}),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.errGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("onboarding.title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("onboarding.subtitle")}</p>
          </div>
          <div className="flex rounded-lg bg-gray-200/70 p-1 text-xs">
            {(["he", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void i18n.changeLanguage(code)}
                className={clsx(
                  "rounded-md px-2.5 py-1 font-medium",
                  i18n.language === code ? "bg-white text-gray-900 shadow-sm" : "text-gray-600",
                )}
              >
                {code === "he" ? "עברית" : "English"}
              </button>
            ))}
          </div>
        </div>

        {/* Step indicator */}
        <ol className="mb-5 flex flex-wrap items-center gap-3" aria-label="steps">
          {STEPS.map((key, i) => (
            <li key={key} className="flex items-center gap-3">
              <span
                className={clsx(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  i < step && "bg-brand text-white",
                  i === step && "bg-brand text-white ring-4 ring-brand/20",
                  i > step && "bg-gray-200 text-gray-600",
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={clsx(
                  "text-sm",
                  i === step ? "font-semibold text-gray-900" : "text-gray-500",
                )}
              >
                {t(`onboarding.${key}`)}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-8 bg-gray-300" />}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:grid-cols-5">
          <div className="space-y-5 md:col-span-3">
            {/* ── Step 1: details ─────────────────────────────────────── */}
            {step === 0 && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">{t("onboarding.ownerName")}</span>
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">{t("onboarding.symbol")}</span>
                  <span className="relative block">
                    <select
                      required
                      value={symbol}
                      onChange={(e) => chooseSymbol(e.target.value)}
                      disabled={symbolsLoading}
                      className={clsx(inputClass, "appearance-none")}
                    >
                      <option value="" disabled>
                        {t("onboarding.symbolPlaceholder")}
                      </option>
                      {(symbols ?? []).map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {symbolLabel(s)}
                        </option>
                      ))}
                    </select>
                    {symbolsLoading && (
                      <span className="absolute inset-y-0 end-3 flex items-center">
                        <Spinner size="sm" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{t("onboarding.symbolHint")}</span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">{t("onboarding.clubName")}</span>
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            )}

            {/* ── Step 2: branding ────────────────────────────────────── */}
            {step === 1 && (
              <>
                <div className="text-sm">
                  <span className="mb-1 block font-medium text-gray-700">{t("onboarding.logo")}</span>
                  <p className="mb-3 text-xs text-gray-500">{t("onboarding.logoHint")}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50">
                      {logo ? (
                        <img src={logo} alt="" className="size-full object-contain p-1" />
                      ) : (
                        <ImagePlus className="size-7 text-gray-400" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        icon={<ImagePlus className="size-4" />}
                        onClick={() => logoInput.current?.click()}
                      >
                        {t(logo ? "onboarding.logoReplace" : "onboarding.logoUpload")}
                      </Button>
                      {logo && (
                        <Button
                          type="button"
                          variant="ghost"
                          icon={<Trash2 className="size-4" />}
                          onClick={removeLogo}
                        >
                          {t("onboarding.logoRemove")}
                        </Button>
                      )}
                    </div>
                    <input
                      ref={logoInput}
                      type="file"
                      accept={LOGO_TYPES.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onLogoFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {logoError && <p className="mt-2 text-xs text-red-600">{logoError}</p>}
                </div>

                <div className="text-sm">
                  <span className="mb-2 block font-medium text-gray-700">{t("onboarding.primaryColor")}</span>
                  <p className="mb-2 text-xs text-gray-500">{t("onboarding.presets")}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => {
                      const active = preset.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setColor(preset)}
                          title={preset}
                          style={{ backgroundColor: preset }}
                          className={clsx(
                            "flex size-9 items-center justify-center rounded-full ring-offset-2 transition",
                            active ? "ring-2 ring-gray-900" : "hover:scale-110",
                          )}
                        >
                          {active && <Check className="size-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-4 flex items-center gap-3 text-xs text-gray-600">
                    <Palette className="size-4 text-gray-400" />
                    {t("onboarding.custom")}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="size-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                    />
                    <span dir="ltr" className="font-mono text-gray-500">{color}</span>
                  </label>
                </div>
              </>
            )}

            {/* ── Step 3: initial data ────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{t("onboarding.dataTitle")}</h2>
                  <p className="mt-1 text-sm text-gray-500">{t("onboarding.dataHint")}</p>
                </div>
                {importResult && !importResult.cancelled && (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                    <CheckCircle2 className="size-5 shrink-0 text-green-600" />
                    {t("onboarding.dataDone", { added: importResult.added, updated: importResult.updated })}
                  </div>
                )}
                <Button
                  type="button"
                  variant={importResult ? "ghost" : "primary"}
                  icon={<FileSpreadsheet className="size-4" />}
                  onClick={() => setImportOpen(true)}
                >
                  {t("onboarding.dataUpload")}
                </Button>
                <p className="text-xs text-gray-400">{t("onboarding.dataSkip")}</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
                  {t("onboarding.back")}
                </Button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 && !detailsValid}
                >
                  {t("onboarding.next")}
                </Button>
              ) : (
                <Button type="button" loading={saving} onClick={() => void finish()}>
                  {saving ? t("onboarding.saving") : t("onboarding.finish")}
                </Button>
              )}
            </div>
          </div>

          {/* Live preview of the sidebar + a KPI card in the chosen color */}
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-medium text-gray-500">{t("onboarding.preview")}</p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex">
                <div className="w-40 shrink-0 bg-sidebar p-4 text-white">
                  <div className="flex items-center gap-2">
                    {logo && (
                      <img src={logo} alt="" className="size-8 shrink-0 rounded-md bg-white/10 object-contain p-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand">{clubName || "—"}</p>
                      <p className="text-[10px] text-gray-400">{t("nav.crm")}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2 rounded-md bg-brand px-2 py-1.5 text-[11px]">
                      <LayoutDashboard className="size-3" /> {t("nav.dashboard")}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-300">
                      <Users className="size-3" /> {t("nav.fans")}
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-page p-4">
                  <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="flex size-8 items-center justify-center rounded-md bg-red-50 text-brand">
                      <Users className="size-4" />
                    </div>
                    <p className="mt-2 text-lg font-bold text-gray-900">18,500</p>
                    <p className="text-[11px] text-gray-500">{t("dashboard.kpiTotalFans")}</p>
                  </div>
                  <p className="mt-3 truncate text-[11px] text-gray-500">
                    {ownerName || "—"}
                    {symbol && <span className="ms-1 text-gray-400">· {symbol}</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={(result) => setImportResult(result)}
      />
    </div>
  );
}
