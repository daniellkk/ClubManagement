import {
  ArrowUpRight,
  Megaphone,
  ShoppingBag,
  Smartphone,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDateTime,
  formatMonth,
  formatNumber,
} from "../lib/format";
import { l10n } from "../lib/i18n";
import {
  activityFeed,
  dashboardKpis,
  fanGrowth,
  recentCampaigns,
  subscriberSplit,
  type CampaignStatusCode,
} from "../lib/mock-data";
import { storeStats } from "../lib/store-stats";

function CampaignBadge({ status }: { status: CampaignStatusCode }) {
  const { t } = useTranslation();
  const variant =
    status === "active" ? "success" : status === "draft" ? "warning" : "neutral";
  const key =
    status === "active" ? "status.active" : status === "draft" ? "status.draft" : "status.finished";
  return <Badge variant={variant}>{t(key)}</Badge>;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();

  const growth = fanGrowth.map((g) => ({
    ...g,
    label: formatMonth(g.year, g.month),
  }));
  const split = subscriberSplit.map((s) => ({
    ...s,
    name: t(`dashboard.${s.key}`),
  }));

  return (
    <div key={i18n.language}>
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label={t("dashboard.kpiTotalFans")}
            value={formatNumber(dashboardKpis.totalFans)}
            icon={<Users className="size-5" />}
            iconColor="red"
            delta={t("common.deltaLastMonth", { pct: dashboardKpis.totalFansDeltaPct })}
          />
          <KpiCard
            label={t("dashboard.kpiActiveSubscribers")}
            value={formatNumber(dashboardKpis.activeSubscribers)}
            icon={<UserCheck className="size-5" />}
            iconColor="green"
            delta={t("common.deltaLastMonth", { pct: dashboardKpis.activeSubscribersDeltaPct })}
          />
          <KpiCard
            label={t("dashboard.kpiNotRenewed")}
            value={formatNumber(dashboardKpis.notRenewed)}
            icon={<UserX className="size-5" />}
            iconColor="amber"
          />
          <KpiCard
            label={t("dashboard.kpiActiveInApp")}
            value={formatNumber(dashboardKpis.activeInApp)}
            icon={<Smartphone className="size-5" />}
            iconColor="blue"
          />
          <KpiCard
            label={t("dashboard.kpiActiveCampaigns")}
            value={String(dashboardKpis.activeCampaigns)}
            icon={<Megaphone className="size-5" />}
            iconColor="purple"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title={t("dashboard.chartGrowth")} className="xl:col-span-2">
            {/* Recharts renders LTR internally */}
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="fansFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Area isAnimationActive={false}
                    type="monotone"
                    dataKey="fans"
                    name={t("common.fans")}
                    stroke="#dc2626"
                    strokeWidth={2}
                    fill="url(#fansFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("dashboard.chartSplit")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie isAnimationActive={false}
                    data={split}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {split.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title={t("dashboard.recentCampaigns")} className="xl:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <CampaignBadge status={c.status} />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {t("dashboard.reach", { count: c.reach })}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{c.date}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t("dashboard.recentActivity")}>
            <ul className="space-y-4">
              {activityFeed.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p className="text-sm text-gray-700">{t(`dashboard.${item.key}`)}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(item.time)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Store snapshot — same aggregates as the store page */}
        <Card
          title={t("dashboard.storeTitle")}
          actions={
            <Link to="/store" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              {t("dashboard.viewStore")}
              <ArrowUpRight className="size-4" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t("dashboard.storeRevenue"), value: formatCurrencyCompact(storeStats.revenue) },
                { label: t("dashboard.storeOrders"), value: formatNumber(storeStats.orderCount) },
                { label: t("dashboard.storeAvgOrder"), value: formatCurrency(storeStats.avgOrder) },
                {
                  label: t("dashboard.storeTop"),
                  value: l10n(storeStats.topProduct.name),
                  sub: t("store.unitsSold", { count: storeStats.topProductUnits }),
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-gray-50 p-4">
                  <div className="flex size-8 items-center justify-center rounded-md bg-red-50 text-brand">
                    <ShoppingBag className="size-4" />
                  </div>
                  <p className="mt-2 truncate text-xl font-bold text-gray-900 tabular-nums">{tile.value}</p>
                  <p className="text-xs text-gray-500">{tile.label}</p>
                  {tile.sub && <p className="text-[11px] text-gray-400">{tile.sub}</p>}
                </div>
              ))}
            </div>
            <div className="lg:col-span-2">
              <p className="mb-2 text-sm font-medium text-gray-700">{t("dashboard.storeMonthly")}</p>
              <div dir="ltr" className="h-48">
                <ResponsiveContainer>
                  <BarChart data={storeStats.monthly.map((m) => ({ label: formatMonth(m.year, m.month), revenue: m.revenue }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={60} tickFormatter={(v: number) => formatCurrencyCompact(v)} />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    <Bar isAnimationActive={false} dataKey="revenue" name={t("common.revenue")} fill="#dc2626" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
