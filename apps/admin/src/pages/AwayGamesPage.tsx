import {
  Banknote,
  BarChart3,
  Download,
  Megaphone,
  Percent,
  Plane,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import { FilterableTh } from "../components/table/FilterableTh";
import { Badge, competitionBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
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
import { awayGames, awayKpis, buyerSplit, potentialFans, topFans, type MockGame } from "../lib/mock-data";
import { sortRows, useSort } from "../lib/table";

type GameSortKey = "date" | "opponent" | "competition" | "stadium" | "tickets" | "attended" | "revenue" | "occupancy";

export function AwayGamesPage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const { filters, setFilter, clearAll, activeCount } = useFilterState();
  const { sort, toggle, setSort } = useSort<GameSortKey>({ key: "date", dir: "desc" });

  const ticketsAndAttendance = awayGames
    .filter((g) => g.status === "finished")
    .map((g) => ({ opponent: l10n(g.opponent), tickets: g.tickets, attended: g.attended ?? 0 }))
    .reverse();

  const split = buyerSplit.map((b) => ({
    ...b,
    name: b.key === "vip" ? t("awayGames.buyersVip") : t(`common.${b.key}`),
  }));

  // Excel-style column filters over the (mock) games list
  const columns = useMemo<ColumnDef<MockGame>[]>(
    () => [
      { key: "date", getValue: (g) => g.date, format: (v) => (v ? formatDate(String(v)) : "") },
      { key: "opponent", getValue: (g) => l10n(g.opponent) },
      { key: "competition", getValue: (g) => t(competitionBadge(g.competition).labelKey) },
      { key: "stadium", getValue: (g) => l10n(g.stadium) },
      { key: "tickets", getValue: (g) => g.tickets },
      { key: "attended", getValue: (g) => g.attended ?? null },
      { key: "revenue", getValue: (g) => g.revenue, format: (v) => formatCurrencyCompact(Number(v)) },
      { key: "occupancy", getValue: (g) => Math.round((g.total / g.capacity) * 100), format: (v) => `${v}%` },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const colByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awayGames;
    return awayGames.filter(
      (g) =>
        g.opponent.he.includes(query) ||
        g.opponent.en.toLowerCase().includes(q) ||
        g.stadium.he.includes(query) ||
        g.stadium.en.toLowerCase().includes(q),
    );
  }, [query]);

  const rows = useMemo(() => {
    const filtered = applyColumnFilters(searched, columns, filters);
    return sort.key ? sortRows(filtered, (g) => colByKey[sort.key!]?.getValue(g), sort.dir) : filtered;
  }, [searched, columns, filters, sort, colByKey]);

  const loadOptions = useCallback(
    (key: string) => Promise.resolve(computeFacets(searched, columns, filters, key)),
    [searched, columns, filters],
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
      <PageHeader
        title={t("awayGames.title")}
        subtitle={t("awayGames.subtitle")}
        actions={
          <>
            <Button icon={<Megaphone className="size-4" />}>{t("awayGames.createCampaign")}</Button>
            <Button variant="ghost" icon={<BarChart3 className="size-4" />}>
              {t("awayGames.crowdAnalysis")}
            </Button>
            <Button variant="ghost" icon={<Download className="size-4" />}>
              {t("awayGames.exportReport")}
            </Button>
          </>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label={t("awayGames.kpiRevenue")}
            value={formatCurrencyCompact(awayKpis.revenue)}
            icon={<Banknote className="size-5" />}
            iconColor="amber"
            delta={t("common.deltaLastSeason", { pct: awayKpis.revenueDeltaPct })}
          />
          <KpiCard
            label={t("awayGames.kpiArrival")}
            value={`${awayKpis.arrivalPercent}%`}
            icon={<Percent className="size-5" />}
            iconColor="purple"
            delta={t("common.deltaLastSeason", { pct: awayKpis.arrivalDeltaPct })}
          />
          <KpiCard
            label={t("awayGames.kpiAttendees")}
            value={formatNumber(awayKpis.attendees)}
            icon={<Users className="size-5" />}
            iconColor="green"
            sub={t("awayGames.ofGames", { count: awayKpis.games })}
          />
          <KpiCard
            label={t("awayGames.kpiBuyers")}
            value={formatNumber(awayKpis.ticketBuyers)}
            icon={<Ticket className="size-5" />}
            iconColor="red"
            delta={t("common.deltaLastSeason", { pct: awayKpis.ticketBuyersDeltaPct })}
          />
          <KpiCard
            label={t("awayGames.kpiGames")}
            value={String(awayKpis.games)}
            icon={<Plane className="size-5" />}
            iconColor="blue"
            sub={t("awayGames.ofPlanned", { count: awayKpis.gamesPlanned })}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title={t("awayGames.chartTickets")} className="xl:col-span-2">
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <BarChart data={ticketsAndAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="opponent" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={50} />
                  <Tooltip />
                  <Legend />
                  <Bar isAnimationActive={false} dataKey="tickets" name={t("common.tickets")} fill="#dc2626" radius={[6, 6, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="attended" name={t("awayGames.seriesAttended")} fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("awayGames.chartBuyerSplit")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie isAnimationActive={false} data={split} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
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

        <Card title={t("awayGames.tableTitle")}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute top-2.5 start-3 size-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("awayGames.searchPlaceholder")}
                className="w-64 rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            {activeCount > 0 && (
              <>
                <span className="text-xs text-gray-500">{t("table.activeFilters", { count: activeCount })}</span>
                <button onClick={clearAll} className="text-sm font-medium text-brand hover:underline">
                  {t("table.clearAll")}
                </button>
              </>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <FilterableTh {...thProps("date", t("common.date"))} />
                  <FilterableTh {...thProps("opponent", t("homeGames.colOpponent"))} />
                  <FilterableTh {...thProps("competition", t("competition.label"))} />
                  <FilterableTh {...thProps("stadium", t("awayGames.colStadium"))} />
                  <FilterableTh {...thProps("tickets", t("common.tickets"))} />
                  <FilterableTh {...thProps("attended", t("awayGames.colAttended"))} />
                  <FilterableTh {...thProps("revenue", t("common.revenue"))} />
                  <FilterableTh {...thProps("occupancy", t("homeGames.colOccupancy"))} />
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
                      <td className="px-4 py-3">{l10n(g.stadium)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(g.tickets)}</td>
                      <td className="px-4 py-3 tabular-nums">{g.attended ? formatNumber(g.attended) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrencyCompact(g.revenue)}</td>
                      <td className="px-4 py-3 w-40">
                        <ProgressBar percent={(g.total / g.capacity) * 100} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title={t("awayGames.topFans")}>
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
                {topFans.map((f) => (
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

          <Card title={t("awayGames.potentialFans")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {potentialFans.map((f) => (
                <div key={f.fanId} className="group rounded-lg border border-gray-100 p-4 transition-colors hover:border-brand/40">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{f.name}</p>
                    <ScoreBadge score={f.score} />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {t("awayGames.lastGame", {
                      game: t("awayGames.vsOpponent", { opponent: l10n(f.lastGameOpponent), date: formatDate(f.lastGameDate) }),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("awayGames.pastAway", { count: f.previousAttendance, channel: t(`channels.${f.preferredChannel}`) })}
                  </p>
                  <button className="mt-3 w-full rounded-lg bg-gray-100 py-1.5 text-xs font-medium text-gray-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-brand hover:text-white">
                    {t("awayGames.sendInvite")}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
