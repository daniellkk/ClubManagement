import { ArrowLeft, ArrowRight, Check, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { ScoreBadge } from "../components/ui/ScoreBadge";
import { Spinner } from "../components/ui/Spinner";
import {
  fetchFan,
  seatLabel,
  statusLabel,
  subTypeLabel,
  type FanDetail,
} from "../lib/fans-api";
import { formatDate } from "../lib/format";
import { currentLang } from "../lib/i18n";
import { useAsync } from "../lib/use-async";

export function FanProfilePage() {
  const { id } = useParams();
  const { data: fan, loading, error } = useAsync(
    () => (id ? fetchFan(id) : Promise.reject(new Error("missing id"))),
    [id],
  );

  if (loading && !fan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !fan) return <Navigate to="/fans" replace />;
  return <FanProfile fan={fan} />;
}

function FanProfile({ fan }: { fan: FanDetail }) {
  const { t, i18n } = useTranslation();
  const BackArrow = currentLang() === "he" ? ArrowRight : ArrowLeft;
  const sub = fan.currentSubscription;
  const seat = seatLabel(fan, t);
  const subLabel = subTypeLabel(sub?.type, t);

  const details: [string, string][] = [
    [t("common.age"), fan.age === null ? "—" : String(fan.age)],
    [t("common.city"), fan.city || "—"],
    [t("common.email"), fan.email || "—"],
    [t("common.phone"), fan.phone || "—"],
    [t("fanProfile.memberSince"), fan.memberSince ? formatDate(fan.memberSince) : "—"],
  ];
  if (fan.oldEmail) details.push([t("import.fieldOldEmail"), fan.oldEmail]);
  if (fan.legacyId) details.push([t("import.fieldOldId"), fan.legacyId]);

  return (
    <div key={i18n.language}>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/fans"
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
              title={t("common.back")}
            >
              <BackArrow className="size-4" />
            </Link>
            <div className="flex size-12 items-center justify-center rounded-full bg-brand text-white font-bold">
              {fan.firstName[0] ?? ""}
              {fan.lastName[0] ?? ""}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {fan.firstName} {fan.lastName}
              </h1>
              <p className="text-sm text-gray-500">
                {t("common.customerNumber")} {fan.customerNumber}
                {fan.importedAt && (
                  <span className="ms-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {t("fans.importedBadge")}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link to={`/fans/${fan.id}/edit`}>
            <Button icon={<Pencil className="size-4" />}>{t("common.edit")}</Button>
          </Link>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card title={t("fanProfile.personalDetails")}>
            <dl className="space-y-3 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900 truncate" dir="auto">
                    {value}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{t("common.status")}</dt>
                <dd>
                  <Badge variant={fan.status === "ACTIVE" ? "success" : "neutral"}>
                    {statusLabel(fan.status, t)}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card title={t("fanProfile.fanScore")}>
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold text-gray-900 tabular-nums">
                {fan.engagementScore}
              </span>
              <div className="flex-1">
                <ProgressBar percent={fan.engagementScore} showLabel={false} />
              </div>
              <ScoreBadge score={fan.engagementScore} />
            </div>
            <p className="mt-3 text-xs text-gray-400">{t("fanProfile.scoreBasis")}</p>
          </Card>

          <Card title={t("fanProfile.consents")}>
            <ul className="space-y-2 text-sm">
              {(
                [
                  ["channels.email", fan.emailOptIn],
                  ["channels.sms", fan.smsOptIn],
                  ["channels.whatsapp", fan.whatsappOptIn],
                  ["channels.push", fan.pushOptIn],
                ] as const
              ).map(([key, on]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-gray-700">{t(key)}</span>
                  {on ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <Check className="size-4" /> {t("fanProfile.approved")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400">
                      <X className="size-4" /> {t("fanProfile.notApproved")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card title={t("fanProfile.subDetails")}>
              {sub ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">{t("fanProfile.subType")}</dt>
                    <dd>
                      <Badge variant="subscriber">{subLabel}</Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">{t("common.status")}</dt>
                    <dd className="font-medium text-gray-900">{sub.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">{t("fanProfile.paymentStatus")}</dt>
                    <dd>
                      <Badge variant={sub.paymentStatus === "PAID" ? "success" : "warning"}>
                        {sub.paymentStatus === "PAID" ? t("status.paid") : sub.paymentStatus}
                      </Badge>
                    </dd>
                  </div>
                  {seat && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">{t("fans.colSeat")}</dt>
                      <dd className="font-medium text-gray-900">{seat}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">{t("fanProfile.noActiveSub")}</p>
              )}
            </Card>

            <Card title={t("fanProfile.appActivity")}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">{t("fanProfile.lastLogin")}</dt>
                  <dd className="font-medium text-gray-900">
                    {fan.appLastLoginAt ? formatDate(fan.appLastLoginAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">{t("fans.colLastActivity")}</dt>
                  <dd className="font-medium text-gray-900">
                    {fan.lastActivityAt ? formatDate(fan.lastActivityAt) : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card title={t("fanProfile.attendance")}>
            <div className="grid grid-cols-3 gap-4 text-center mb-5">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold text-gray-900">{fan.attendanceStats.total}</p>
                <p className="text-xs text-gray-500">{t("fanProfile.totalGames")}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold text-gray-900">{fan.attendanceStats.home}</p>
                <p className="text-xs text-gray-500">{t("fanProfile.homeGames")}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold text-gray-900">{fan.attendanceStats.away}</p>
                <p className="text-xs text-gray-500">{t("fanProfile.awayGames")}</p>
              </div>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {t("fanProfile.matchHistory")}
            </h3>
            {fan.matchHistory.length === 0 ? (
              <p className="text-sm text-gray-500">—</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {fan.matchHistory.map((m) => (
                  <li key={m.gameId} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="text-gray-900">
                        {m.opponent} ({t(m.venue === "HOME" ? "fanProfile.home" : "fanProfile.away")})
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(m.date)}</p>
                    </div>
                    {m.attended ? (
                      <Badge variant="success">{t("fanProfile.attended")}</Badge>
                    ) : (
                      <Badge variant="danger">{t("fanProfile.missed")}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("fanProfile.purchases")}>
            <p className="text-sm text-gray-500">{t("fanProfile.noPurchases")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
