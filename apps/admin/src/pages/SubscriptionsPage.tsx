import {
  History,
  MessageSquare,
  Percent,
  Phone,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SortableTh } from "../components/ui/SortableTh";
import { formatDate, formatMonth, formatNumber } from "../lib/format";
import { l10n } from "../lib/i18n";
import {
  churnedSubscribers,
  cityById,
  renewalTrend,
  seasonComparison,
  subscriptionKpis,
  type ChurnedSubscriber,
  type PriorityCode,
} from "../lib/mock-data";
import { sortRows, useSort } from "../lib/table";

type ChurnSortKey =
  | "customerNumber"
  | "name"
  | "age"
  | "city"
  | "type"
  | "years"
  | "lastPayment"
  | "priority";

const PRIORITY_RANK: Record<PriorityCode, number> = { high: 3, medium: 2, low: 1 };

function PriorityBadge({ priority }: { priority: PriorityCode }) {
  const { t } = useTranslation();
  const variant =
    priority === "high" ? "danger" : priority === "medium" ? "warning" : "success";
  return <Badge variant={variant}>{t(`priority.${priority}`)}</Badge>;
}

export function SubscriptionsPage() {
  const { t, i18n } = useTranslation();
  const { sort, toggle } = useSort<ChurnSortKey>({ key: "priority", dir: "desc" });

  const trend = renewalTrend.map((r) => ({
    ...r,
    label: formatMonth(r.year, r.month),
  }));

  const churnValue = (s: ChurnedSubscriber): unknown => {
    switch (sort.key) {
      case "customerNumber":
        return Number(s.customerNumber);
      case "name":
        return s.name;
      case "age":
        return s.age;
      case "city":
        return l10n(cityById[s.cityId].name);
      case "type":
        return t(`subTypes.${s.type}`);
      case "years":
        return s.years;
      case "lastPayment":
        return s.lastPayment;
      case "priority":
        return PRIORITY_RANK[s.priority];
    }
  };
  const churned = sortRows(churnedSubscribers, churnValue, sort.dir);

  return (
    <div key={i18n.language}>
      <PageHeader
        title={t("subscriptions.title")}
        subtitle={t("subscriptions.subtitle")}
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label={t("subscriptions.kpiActive")}
            value={formatNumber(subscriptionKpis.active)}
            icon={<UserCheck className="size-5" />}
            iconColor="green"
          />
          <KpiCard
            label={t("subscriptions.kpiLastSeason")}
            value={formatNumber(subscriptionKpis.lastSeason)}
            icon={<History className="size-5" />}
            iconColor="blue"
          />
          <KpiCard
            label={t("subscriptions.kpiNotRenewed")}
            value={formatNumber(subscriptionKpis.notRenewed)}
            icon={<UserX className="size-5" />}
            iconColor="red"
          />
          <KpiCard
            label={t("subscriptions.kpiRenewalPct")}
            value={`${subscriptionKpis.renewalPercent}%`}
            icon={<Percent className="size-5" />}
            iconColor="amber"
            footer={
              <ProgressBar percent={subscriptionKpis.renewalPercent} showLabel={false} />
            }
          />
          <KpiCard
            label={t("subscriptions.kpiRetention")}
            value={formatNumber(subscriptionKpis.retentionPotential)}
            icon={<Users className="size-5" />}
            iconColor="purple"
            sub={t("subscriptions.retentionSub")}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title={t("subscriptions.chartSeasons")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <BarChart data={seasonComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="season" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Bar isAnimationActive={false}
                    dataKey="subscribers"
                    name={t("common.subscribers")}
                    fill="#dc2626"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("subscriptions.chartTrend")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Legend />
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="active"
                    name={t("subscriptions.seriesActive")}
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="renewed"
                    name={t("subscriptions.seriesRenewed")}
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card
          title={t("subscriptions.churnTable")}
          actions={
            <Button icon={<MessageSquare className="size-4" />}>
              {t("subscriptions.retentionCampaign")}
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <SortableTh columnKey="customerNumber" label={t("common.customerNumber")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="name" label={t("common.name")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="age" label={t("common.age")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="city" label={t("common.city")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="type" label={t("fans.colSubType")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="years" label={t("subscriptions.colYears")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="lastPayment" label={t("subscriptions.colLastPayment")} sort={sort} onToggle={toggle} />
                  <SortableTh columnKey="priority" label={t("priority.label")} sort={sort} onToggle={toggle} />
                  <th className="px-4 py-3 text-start font-medium">{t("subscriptions.colSuggested")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {churned.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-500 tabular-nums">
                      {s.customerNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">{s.age}</td>
                    <td className="px-4 py-3">{l10n(cityById[s.cityId].name)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="subscriber">{t(`subTypes.${s.type}`)}</Badge>
                    </td>
                    <td className="px-4 py-3">{s.years}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(s.lastPayment)}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={s.priority} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t(`subscriptions.${s.actionKey}`)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title={t("common.sendMessage")}
                        >
                          <MessageSquare className="size-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title={t("common.call")}
                        >
                          <Phone className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
