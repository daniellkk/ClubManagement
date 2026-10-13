import clsx from "clsx";
import { Check, Globe, Pencil, Shield, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../lib/auth";
import type { Lang } from "../lib/i18n";

const LANGS: { code: Lang; labelKey: string; subKey: string }[] = [
  { code: "he", labelKey: "settings.langHe", subKey: "settings.langHeSub" },
  { code: "en", labelKey: "settings.langEn", subKey: "settings.langEnSub" },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 truncate">{children}</dd>
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const current: Lang = i18n.language === "en" ? "en" : "he";

  return (
    <div key={i18n.language}>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card
            title={t("settings.language")}
            className="xl:col-span-2"
            actions={<Globe className="size-5 text-gray-400" />}
          >
            <p className="mb-4 text-sm text-gray-500">{t("settings.languageHint")}</p>
            <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LANGS.map((lang) => {
                const active = lang.code === current;
                return (
                  <button
                    key={lang.code}
                    role="radio"
                    aria-checked={active}
                    onClick={() => void i18n.changeLanguage(lang.code)}
                    className={clsx(
                      "rounded-xl border p-4 text-start transition-colors",
                      active
                        ? "border-brand bg-red-50/60"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-gray-900">
                        {t(lang.labelKey)}
                      </span>
                      <span
                        className={clsx(
                          "flex size-6 items-center justify-center rounded-full border",
                          active
                            ? "border-brand bg-brand text-white"
                            : "border-gray-300 text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{t(lang.subKey)}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="space-y-6">
            <Card
              title={t("settings.account")}
              actions={<UserRound className="size-5 text-gray-400" />}
            >
              <dl className="space-y-3">
                <Row label={t("settings.name")}>{user?.name}</Row>
                <Row label={t("settings.email")}>
                  <span dir="ltr">{user?.email}</span>
                </Row>
                <Row label={t("settings.role")}>
                  <Badge variant="subscriber">
                    {user ? t(`roles.${user.role}`) : "—"}
                  </Badge>
                </Row>
                <Row label={t("settings.signInMethod")}>
                  {user?.googleLinked
                    ? t("settings.signInGoogle")
                    : t("settings.signInPassword")}
                </Row>
              </dl>
            </Card>

            <Card
              title={t("settings.club")}
              actions={<Shield className="size-5 text-gray-400" />}
            >
              <dl className="space-y-3">
                <Row label={t("settings.clubName")}>{user?.clubName}</Row>
                <Row label={t("settings.symbol")}>
                  {user?.clubSymbol ? (
                    <Badge variant="subscriber">{user.clubSymbol}</Badge>
                  ) : (
                    "—"
                  )}
                </Row>
                <Row label={t("settings.logo")}>
                  {user?.clubLogoUrl ? (
                    <img
                      src={user.clubLogoUrl}
                      alt=""
                      className="size-10 rounded-lg border border-gray-200 bg-white object-contain p-1"
                    />
                  ) : (
                    <span className="text-gray-400">{t("settings.noLogo")}</span>
                  )}
                </Row>
                <Row label={t("settings.season")}>2025/26</Row>
                <Row label={t("settings.brandColor")}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 rounded-full bg-brand ring-2 ring-brand/20" />
                    <span dir="ltr" className="tabular-nums">
                      {user?.clubPrimaryColor ?? "#dc2626"}
                    </span>
                  </span>
                </Row>
              </dl>
              <Link
                to="/onboarding"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <Pencil className="size-3.5" />
                {t("settings.editClub")}
              </Link>
            </Card>
          </div>
        </div>

        <p className="text-xs text-gray-400">{t("settings.comingSoon")}</p>
      </div>
    </div>
  );
}
