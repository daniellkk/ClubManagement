import { Banknote, Home, Percent, Ticket, Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FilterableTh } from "../components/table/FilterableTh";
import { Badge, competitionBadge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { ScoreBadge } from "../components/ui/ScoreBadge";
import {
  applyColumnFilters,
  computeFacets,
  useFilterState,
  type ColumnDef,
} from "../lib/column-filters";
import { formatCurrencyCompact, formatDate, formatNumber } from "../lib/format";
import { l10n } from "../lib/i18n";
import { homeGames, homeKpis, topHomeFans, type GameStatusCode, type MockGame } from "../lib/mock-data";
import { sortRows, useSort } from "../lib/table";

type GameSortKey = "date" | "opponent" | "competition" | "subscribers" | "tickets" | "total" | "occupancy" | "status";

function GameStatusBadge({ status }: { status: GameStatusCode }) {
  const { t } = useTranslation();
  if (status === "finished") return <Badge variant="neutral">{t("status.finished")}</Badge>;
  if (status === "selling") return <Badge variant="success">{t("status.selling")}</Badge>;
  return <Badge variant="warning">{t("status.planned")}</Badge>;
}

export function HomeGamesPage() {
  const { t, i18n } = useTranslation();
  const { filters, setFilter, clearAll, activeCount } = useFilterState();
  const { sort, toggle, setSort } = useSort<GameSortKey>({ key: "date", dir: "desc" });

  const finished = homeGames.filter((g) => g.status === "finished");
  const attendanceByGame = finished
    .map((g) => ({ opponent: l10n(g.opponent), subscribers: g.subscribers, tickets: g.tickets }))
    .reverse();
  const ticketTrend = finished.map((g) => ({ opponent: l10n(g.opponent), tickets: g.tickets })).reverse();
  const avgTickets = Math.round(ticketTrend.reduce((sum, g) => sum + g.tickets, 0) / (ticketTrend.length || 1));

  // Excel-style column filters over the (mock) games list
  const columns = useMemo<ColumnDef<MockGame>[]>(
    () => [
      { key: "date", getValue: (g) => g.date, format: (v) => (v ? formatDate(String(v)) : "") },
      { key: "opponent", getValue: (g) => l10n(g.opponent) },
      { key: "competition", getValue: (g) => t(competitionBadge(g.competition).labelKey) },
      { key: "subscribers", getValue: (g) => g.subscribers || null },
      { key: "tickets", getValue: (g) => g.tickets },
      { key: "total", getValue: (g) => g.total },
      { key: "occupancy", getValue: (g) => Math.round((g.total / g.capacity) * 100), format: (v) => `${v}%` },
      { key: "status", getValue: (g) => t(`status.${g.status}`) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);
  const rows = useMemo(() => {
    const filtered = applyColumnFilters(homeGames, columns, filters);
    return sort.key ? sortRows(filtered, (g) => colByKey[sort.key!]?.getValue(g), sort.dir) : filtered;
  }, [columns, filters, sort, colByKey]);
  const loadOptions = useCallback(
    (key: string) => Promise.resolve(computeFacets(homeGames, columns, filters, key)),
    [columns, filters],
  );
  const thProps = (key: GameSortKey, label: string) => ({
    columnKey: key,
    label,
    sort,
    onSort: toggle,
    onSetSort: setSort,
    selected: filters[key],
    onFilter: (s: Set<string> | undefined) => setFilter(key, s),
    loadOptions,
    format: colByKey[key]?.format,
  });

  return (
    <div key={i18n.language}>
      <PageHeader title={t("homeGames.title")} subtitle={t("homeGames.subtitle")} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard label={t("homeGames.kpiGames")} value={String(homeKpis.games)} icon={<Home className="size-5" />} iconColor="red" />
          <KpiCard label={t("homeGames.kpiAvgCrowd")} value={formatNumber(homeKpis.avgCrowd)} icon={<Users className="size-5" />} iconColor="blue" />
          <KpiCard
            label={t("homeGames.kpiSubUtil")}
            value={`${homeKpis.subscriberUtilization}%`}
            icon={<Percent className="size-5" />}
            iconColor="green"
            footer={<ProgressBar percent={homeKpis.subscriberUtilization} showLabel={false} />}
          />
          <KpiCard label={t("homeGames.kpiTickets")} value={formatNumber(homeKpis.ticketsSold)} icon={<Ticket className="size-5" />} iconColor="amber" />
          <KpiCard label={t("homeGames.kpiRevenue")} value={formatCurrencyCompact(homeKpis.revenue)} icon={<Banknote className="size-5" />} iconColor="purple" />
        </div>

        <Card title={t("homeGames.tableTitle")}>
          {activeCount > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-xs text-gray-500">{t("table.activeFilters", { count: activeCount })}</span>
              <button onClick={clearAll} className="text-sm font-medium text-brand hover:underline">
                {t("table.clearAll")}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <FilterableTh {...thProps("date", t("homeGames.colDate"))} />
                  <FilterableTh {...thProps("opponent", t("homeGames.colOpponent"))} />
                  <FilterableTh {...thProps("competition", t("competition.label"))} />
                  <FilterableTh {...thProps("subscribers", t("common.subscribers"))} />
                  <FilterableTh {...thProps("tickets", t("common.tickets"))} />
                  <FilterableTh {...thProps("total", t("common.total"))} />
                  <FilterableTh {...thProps("occupancy", t("homeGames.colOccupancy"))} />
                  <FilterableTh {...thProps("status", t("common.status"))} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      {t("fans.noResults")}
                    </td>
                  </tr>
                )}
                {rows.map((g) => {
                  const comp = competitionBadge(g.competition);
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-500">{formatDate(g.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{l10n(g.opponent)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={comp.variant}>{t(comp.labelKey)}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{g.subscribers ? formatNumber(g.subscribers) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(g.tickets)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{formatNumber(g.total)}</td>
                      <td className="px-4 py-3 w-40">
                        <ProgressBar percent={(g.total / g.capacity) * 100} />
                      </td>
                      <td className="px-4 py-3">
                        <GameStatusBadge status={g.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title={t("homeGames.chartAttendance")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <BarChart data={attendanceByGame}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="opponent" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Legend />
                  <Bar isAnimationActive={false} dataKey="subscribers" name={t("common.subscribers")} stackId="a" fill="#1d4ed8" radius={[0, 0, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="tickets" name={t("common.tickets")} stackId="a" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("homeGames.chartTickets")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <LineChart data={ticketTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="opponent" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <ReferenceLine y={avgTickets} stroke="#9ca3af" strokeDasharray="6 4" label={{ value: t("homeGames.seasonAvg"), fill: "#6b7280", fontSize: 11 }} />
                  <Line isAnimationActive={false} type="monotone" dataKey="tickets" name={t("common.tickets")} stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title={t("homeGames.topFans")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="px-4 py-3 text-start font-medium">#</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("awayGames.colGames")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.tickets")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("awayGames.colAppUsage")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.score")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topHomeFans.map((f) => (
                <tr key={f.rank} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold text-gray-400">{f.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                        {f.name[0]}
                      </span>
                      <span className="font-medium text-gray-900">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{f.games}</td>
                  <td className="px-4 py-3 tabular-nums">{f.tickets}</td>
                  <td className="px-4 py-3 w-36">
                    <ProgressBar percent={f.appUsage} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={f.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
