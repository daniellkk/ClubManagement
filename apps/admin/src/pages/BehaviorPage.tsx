import clsx from "clsx";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  PieChart as PieChartIcon,
  Search,
  Smartphone,
  Star,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { FilterableTh } from "../components/table/FilterableTh";
import { Card } from "../components/ui/Card";
import { Collapsible } from "../components/ui/Collapsible";
import { FilterChip } from "../components/ui/FilterChip";
import { InfoTip } from "../components/ui/InfoTip";
import { KpiCard } from "../components/ui/KpiCard";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { PageHeader } from "../components/ui/PageHeader";
import { Pagination } from "../components/ui/Pagination";
import { ScoreBadge } from "../components/ui/ScoreBadge";
import { useFilterState, type ColumnDef } from "../lib/column-filters";
import { formatDate, formatNumber } from "../lib/format";
import { currentLang, l10n } from "../lib/i18n";
import { cityById, fanPopulation, type PeriodCode, type PopulationFan } from "../lib/mock-data";
import {
  attendanceIn,
  attendedIn,
  gamesPlayed as gamesPlayedIn,
  lastGameFor,
  periodGames,
  type GameFilter,
} from "../lib/periods";
import { populationFacets, queryPopulation } from "../lib/population-query";
import { useSort } from "../lib/table";
import { useAsync, useDebounced } from "../lib/use-async";

type Segment = "all" | "subscribers" | "nonSubscribers";
type SortKey =
  | "name"
  | "age"
  | "city"
  | "subType"
  | "home"
  | "away"
  | "score"
  | "lastLogin";

const PERIODS: PeriodCode[] = [
  "season",
  "prevSeason",
  "last3Months",
  "lastMonth",
  "lastGame",
];
/** Pseudo city id for the "other cities" slice */
const OTHERS = "others";

// Categorical palette — validated with the dataviz six-checks (CVD-safe, ≥3:1).
// Fixed order; "Others" is a neutral, direct-labeled in the legend.
const CITY_COLORS = [
  "#dc2626",
  "#1d4ed8",
  "#15803d",
  "#7e22ce",
  "#b45309",
  "#0891b2",
  "#be185d",
];
const OTHERS_COLOR = "#6b7280";

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode; info?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-brand text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          {opt.icon}
          {opt.label}
          {opt.info && <InfoTip text={opt.info} />}
        </button>
      ))}
    </div>
  );
}

const selectClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";

export function BehaviorPage() {
  const { t, i18n } = useTranslation();
  const [segment, setSegment] = useState<Segment>("subscribers");
  const [gameFilter, setGameFilter] = useState<GameFilter>("both");
  const [period, setPeriod] = useState<PeriodCode>("season");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const { sort, toggle, setSort } = useSort<SortKey>({ key: "score", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── General filters → the fan set every view is built from ──────────────
  const filtered = useMemo(() => {
    const inSegment =
      segment === "all"
        ? fanPopulation
        : fanPopulation.filter((f) =>
            segment === "subscribers" ? f.subscriber : !f.subscriber,
          );
    // "All games" over the current season = everyone in the segment;
    // any narrower slice = fans who attended at least one relevant game
    if (gameFilter === "both" && period === "season") return inSegment;
    return inSegment.filter(
      (f) => attendedIn(attendanceIn(f, period, gameFilter), gameFilter) > 0,
    );
  }, [segment, gameFilter, period]);

  // Games covered by the venue filter in the period; "last game" = one game only
  const venueGames = periodGames(period, gameFilter);
  const gamesPlayed = gamesPlayedIn(period, gameFilter);
  const lastGame = period === "lastGame" ? lastGameFor(gameFilter) : null;
  const lastGameLabel = lastGame
    ? t("behavior.lastGameSub", {
        venue: t(lastGame.venue === "home" ? "behavior.venueHome" : "behavior.venueAway"),
        opponent: l10n(lastGame.opponent),
        date: formatDate(lastGame.date),
      })
    : null;

  const kpis = useMemo(() => {
    const n = filtered.length || 1;
    const attended = (f: PopulationFan) =>
      attendedIn(attendanceIn(f, period, gameFilter), gameFilter);
    const totalAttended = filtered.reduce((s, f) => s + attended(f), 0);
    return {
      count: filtered.length,
      avgGames: totalAttended / n,
      avgAttendancePct: Math.round((totalAttended / n / gamesPlayed) * 100),
      avgScore: Math.round(filtered.reduce((s, f) => s + f.score, 0) / n),
      appActivePct: Math.round(
        (filtered.filter((f) => f.appLogins30d > 0).length / n) * 100,
      ),
    };
  }, [filtered, gameFilter, period, gamesPlayed]);

  // ── City aggregation (pie + map) ─────────────────────────────────────────
  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of filtered) counts.set(f.cityId, (counts.get(f.cityId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const cityDistribution = useMemo(() => {
    const top = cityCounts.slice(0, CITY_COLORS.length).map(([cityId, count], i) => ({
      cityId,
      name: l10n(cityById[cityId].name),
      value: count,
      color: CITY_COLORS[i],
    }));
    const othersTotal = cityCounts
      .slice(CITY_COLORS.length)
      .reduce((s, [, count]) => s + count, 0);
    if (othersTotal > 0) {
      top.push({ cityId: OTHERS, name: t("behavior.othersSlice"), value: othersTotal, color: OTHERS_COLOR });
    }
    return top;
  }, [cityCounts, t]);

  const mapPoints = useMemo(
    () => cityCounts.map(([cityId, count]) => ({ city: cityById[cityId], count })),
    [cityCounts],
  );

  // ── Table: paged query with search + Excel-style column filters + sort ───
  const columns = useMemo<ColumnDef<PopulationFan>[]>(
    () => [
      { key: "name", getValue: (f) => f.name },
      { key: "age", getValue: (f) => f.age },
      { key: "city", getValue: (f) => l10n(cityById[f.cityId].name) },
      {
        key: "subType",
        getValue: (f) => (f.subscriptionType ? t(`subTypes.${f.subscriptionType}`) : null),
      },
      { key: "home", getValue: (f) => attendanceIn(f, period, gameFilter).home },
      { key: "away", getValue: (f) => attendanceIn(f, period, gameFilter).away },
      { key: "score", getValue: (f) => f.score },
      {
        key: "lastLogin",
        getValue: (f) => f.appLastLogin,
        format: (v) => (v ? formatDate(String(v)) : ""),
      },
    ],
    // i18n.language is part of the key: labels change with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, period, gameFilter, i18n.language],
  );
  const colByKey = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])),
    [columns],
  );
  const { filters, setFilter, clearAll, activeCount } = useFilterState();

  // Any change of general filters / search / column filters / sort → page 1
  useEffect(() => {
    setPage(1);
  }, [filtered, debouncedQuery, filters, sort, pageSize]);

  const { data: pageData, loading } = useAsync(
    () =>
      queryPopulation({
        rows: filtered,
        page,
        pageSize,
        q: debouncedQuery,
        sortKey: sort.key ?? undefined,
        sortDir: sort.dir,
        columns,
        filters,
      }),
    [filtered, page, pageSize, debouncedQuery, sort, columns, filters],
  );
  const pageRows = pageData?.items ?? [];
  const total = pageData?.total ?? 0;

  const loadOptions = useCallback(
    (key: string) => populationFacets(filtered, columns, filters, key),
    [filtered, columns, filters],
  );

  const changeFilters = (fn: () => void) => {
    fn();
    setPage(1);
  };

  /** Drill-down from a pie slice or map marker: filter the table's city column. */
  const drillToCity = useCallback(
    (cityId: string) => {
      const names =
        cityId === OTHERS
          ? cityCounts.slice(CITY_COLORS.length).map(([id]) => l10n(cityById[id].name))
          : [l10n(cityById[cityId].name)];
      setFilter("city", new Set(names));
      setPage(1);
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [cityCounts, setFilter],
  );

  const cityChip =
    filters.city && filters.city.size === 1 ? [...filters.city][0] : null;

  const thProps = (key: SortKey, label: string) => ({
    columnKey: key,
    label,
    sort,
    onSort: toggle,
    onSetSort: setSort,
    selected: filters[key],
    onFilter: (s: Set<string> | undefined) => changeFilters(() => setFilter(key, s)),
    loadOptions,
    format: colByKey[key]?.format,
  });

  return (
    <div key={i18n.language}>
      <PageHeader title={t("behavior.title")} subtitle={t("behavior.subtitle")} />
      <div className="p-8 space-y-6">
        {/* ── General filters ─────────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("behavior.generalFilters")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              value={segment}
              onChange={(v) => changeFilters(() => setSegment(v))}
              options={[
                { value: "all", label: t("behavior.segAll") },
                { value: "subscribers", label: t("behavior.segSubscribers") },
                {
                  value: "nonSubscribers",
                  label: t("behavior.segNonSubscribers"),
                  info: t("behavior.segNonSubscribersInfo"),
                },
              ]}
            />
            <SegmentedControl
              value={gameFilter}
              onChange={(v) => changeFilters(() => setGameFilter(v))}
              options={[
                { value: "both", label: t("behavior.filterBoth") },
                { value: "home", label: t("behavior.filterHome") },
                { value: "away", label: t("behavior.filterAway") },
              ]}
            />
            <div className="flex items-center gap-1.5">
              <select
                value={period}
                onChange={(e) => changeFilters(() => setPeriod(e.target.value as PeriodCode))}
                className={selectClass}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`behavior.period${p.charAt(0).toUpperCase()}${p.slice(1)}`)}
                  </option>
                ))}
              </select>
              {lastGameLabel && (
                <InfoTip text={t("behavior.lastGameInfo", { game: lastGameLabel })} />
              )}
            </div>
          </div>
          {(gameFilter !== "both" || period !== "season") && (
            <p className="mt-2 text-xs text-gray-400">{t("behavior.filterNote")}</p>
          )}
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label={t("behavior.kpiFans")}
            info={t("behavior.kpiFansInfo")}
            value={formatNumber(kpis.count)}
            icon={<Users className="size-5" />}
            iconColor="red"
          />
          <KpiCard
            label={t("behavior.kpiAvgGames")}
            value={kpis.avgGames.toFixed(1)}
            icon={<Trophy className="size-5" />}
            iconColor="purple"
            sub={lastGameLabel ?? t("behavior.ofGames", { count: gamesPlayed })}
          />
          <KpiCard
            label={t("behavior.kpiAvgAttendance")}
            value={`${kpis.avgAttendancePct}%`}
            icon={<Ticket className="size-5" />}
            iconColor="blue"
          />
          <KpiCard
            label={t("behavior.kpiAvgScore")}
            value={String(kpis.avgScore)}
            icon={<Star className="size-5" />}
            iconColor="amber"
          />
          <KpiCard
            label={t("behavior.kpiAppActive")}
            value={`${kpis.appActivePct}%`}
            icon={<Smartphone className="size-5" />}
            iconColor="green"
          />
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div ref={tableRef} className="scroll-mt-6">
          <Card title={t("behavior.tableTitle")}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute top-2.5 start-3 size-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => changeFilters(() => setQuery(e.target.value))}
                  placeholder={t("behavior.searchFans")}
                  className="w-56 rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              {cityChip && (
                <FilterChip
                  onClear={() => changeFilters(() => setFilter("city", undefined))}
                  clearLabel={t("common.clearFilter")}
                >
                  {t("behavior.cityFilter", { city: cityChip })}
                </FilterChip>
              )}
              {activeCount > 0 && (
                <>
                  <span className="text-xs text-gray-500">
                    {t("table.activeFilters", { count: activeCount })}
                  </span>
                  <button
                    onClick={() => changeFilters(clearAll)}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {t("table.clearAll")}
                  </button>
                </>
              )}
            </div>

            <LoadingOverlay loading={loading}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <FilterableTh {...thProps("name", t("common.name"))} />
                    <FilterableTh {...thProps("age", t("common.age"))} />
                    <FilterableTh {...thProps("city", t("common.city"))} />
                    <FilterableTh {...thProps("subType", t("fans.colSubType"))} />
                    <FilterableTh {...thProps("home", t("behavior.colHomeAtt"))} />
                    <FilterableTh {...thProps("away", t("behavior.colAwayAtt"))} />
                    <FilterableTh {...thProps("score", t("common.score"))} />
                    <FilterableTh {...thProps("lastLogin", t("behavior.colAppLastLogin"))} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!loading && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        {t("behavior.noResults")}
                      </td>
                    </tr>
                  )}
                  {loading && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16" />
                    </tr>
                  )}
                  {pageRows.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                      <td className="px-4 py-3">{f.age}</td>
                      <td className="px-4 py-3">{l10n(cityById[f.cityId].name)}</td>
                      <td className="px-4 py-3">
                        {f.subscriptionType ? (
                          t(`subTypes.${f.subscriptionType}`)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {venueGames.home ? (
                          `${attendanceIn(f, period, gameFilter).home}/${venueGames.home}`
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {venueGames.away ? (
                          `${attendanceIn(f, period, gameFilter).away}/${venueGames.away}`
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={f.score} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {f.appLastLogin ? formatDate(f.appLastLogin) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </LoadingOverlay>
            <div className="border-t border-gray-100 px-1 pt-3 mt-2">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </Card>
        </div>

        {/* ── Map (collapsible) ───────────────────────────────────────── */}
        <Collapsible title={t("behavior.sectionMap")} icon={<MapPin className="size-5 text-gray-400" />}>
          <p className="mb-3 text-xs text-gray-400">{t("behavior.clickHint")}</p>
          <div dir="ltr" className="h-[48rem] overflow-hidden rounded-lg">
            <MapContainer
              center={[31.1, 34.85]}
              zoom={8}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapPoints.map(({ city, count }) => (
                <CircleMarker
                  key={city.id}
                  center={[city.lat, city.lng]}
                  radius={Math.min(30, 6 + Math.sqrt(count) * 3.2)}
                  pathOptions={{ color: "#dc2626", weight: 1.5, fillColor: "#dc2626", fillOpacity: 0.35 }}
                  eventHandlers={{ click: () => drillToCity(city.id) }}
                >
                  <LeafletTooltip direction="top">
                    <span className="font-medium">
                      {l10n(city.name)} — {t("behavior.fansCount", { count })}
                    </span>
                  </LeafletTooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Collapsible>

        {/* ── Pie (collapsible) ───────────────────────────────────────── */}
        <Collapsible title={t("behavior.sectionPie")} icon={<PieChartIcon className="size-5 text-gray-400" />}>
          <p className="mb-3 text-xs text-gray-400">{t("behavior.clickHint")}</p>
          <div dir="ltr" className="h-[28rem]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={cityDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={95}
                  outerRadius={170}
                  paddingAngle={2}
                  className="cursor-pointer"
                  onClick={(_, index) => drillToCity(cityDistribution[index].cityId)}
                >
                  {cityDistribution.map((entry) => (
                    <Cell key={entry.cityId} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    t("behavior.fansCount", { count: value as number }),
                    String(name),
                  ]}
                />
                {/* Cities listed beside the pie on the reading-end side: left in RTL, right in LTR */}
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align={currentLang() === "he" ? "left" : "right"}
                  iconType="circle"
                  wrapperStyle={{ paddingInline: 24, lineHeight: "2rem", fontSize: 14 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
