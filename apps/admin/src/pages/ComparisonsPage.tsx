import clsx from "clsx";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../lib/format";
import { l10n } from "../lib/i18n";
import { awayGames, homeGames, seasonStats, teamStats } from "../lib/mock-data";

type Dimension = "seasons" | "games" | "teams";
type Metric = "attendance" | "tickets" | "revenue" | "subscribers" | "occupancy";

interface Item {
  id: string;
  label: string;
  sub?: string;
  metrics: Partial<Record<Metric, number>>;
  extra: { label: string; value: string }[];
}

const METRICS: Metric[] = ["attendance", "tickets", "revenue", "subscribers", "occupancy"];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
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
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === opt.value ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ComparisonsPage() {
  const { t, i18n } = useTranslation();
  const [dimension, setDimension] = useState<Dimension>("seasons");
  const [metric, setMetric] = useState<Metric>("attendance");
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    if (dimension === "seasons") {
      return seasonStats.map((s) => ({
        id: s.season,
        label: s.season,
        sub: s.inProgress ? t("comparisons.inProgress") : undefined,
        metrics: {
          attendance: s.avgAttendance,
          tickets: s.tickets,
          revenue: s.revenue,
          subscribers: s.subscribers,
          occupancy: s.occupancy,
        },
        extra: [
          { label: t("comparisons.homeGames"), value: String(s.homeGames) },
          { label: t("comparisons.awayGames"), value: String(s.awayGames) },
        ],
      }));
    }
    if (dimension === "games") {
      const played = [
        ...homeGames.map((g) => ({ g, venue: "home" as const })),
        ...awayGames.map((g) => ({ g, venue: "away" as const })),
      ]
        .filter(({ g }) => g.status === "finished")
        .sort((a, b) => a.g.date.localeCompare(b.g.date));
      return played.map(({ g, venue }) => ({
        id: g.id,
        label: `${l10n(g.opponent)} (${t(`comparisons.${venue}`)})`,
        sub: formatDate(g.date),
        metrics: {
          attendance: g.attended ?? g.total,
          tickets: g.tickets,
          revenue: g.revenue,
          occupancy: Math.round((g.total / g.capacity) * 100),
        },
        extra: [
          { label: t("competition.label"), value: t(`competition.${g.competition.toLowerCase()}`) },
          { label: t("awayGames.colStadium"), value: l10n(g.stadium) },
        ],
      }));
    }
    return teamStats.map((tm) => ({
      id: tm.id,
      label: l10n(tm.opponent),
      sub: t("comparisons.games") + ` ${tm.games}`,
      metrics: { attendance: tm.avgAttendance, tickets: tm.tickets, revenue: tm.revenue },
      extra: [
        { label: t("comparisons.homeGames"), value: String(tm.homeGames) },
        { label: t("comparisons.awayGames"), value: String(tm.awayGames) },
        { label: t("comparisons.record"), value: `${tm.wins}-${tm.draws}-${tm.losses}` },
      ],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, t, i18n.language]);

  const availableMetrics = METRICS.filter((m) => items.some((i) => i.metrics[m] !== undefined));
  const activeMetric = availableMetrics.includes(metric) ? metric : availableMetrics[0];
  const a = items.find((i) => i.id === aId) ?? items[0];
  const b = items.find((i) => i.id === bId && i.id !== a?.id) ?? items.find((i) => i.id !== a?.id) ?? items[1];

  const metricLabel = (m: Metric) => t(`comparisons.metric${m.charAt(0).toUpperCase()}${m.slice(1)}`);
  const dimLabel = t(`comparisons.dim${dimension.charAt(0).toUpperCase()}${dimension.slice(1)}`);
  const fmt = (m: Metric, v: number | undefined) => {
    if (v === undefined) return t("comparisons.notAvailable");
    if (m === "revenue") return formatCurrency(v);
    if (m === "occupancy") return `${v}%`;
    return formatNumber(v);
  };
  const axisFmt = (m: Metric, v: number) =>
    m === "revenue" ? formatCurrencyCompact(v) : m === "occupancy" ? `${v}%` : formatNumber(v);

  const chartData = items.map((i) => ({ label: i.label, value: i.metrics[activeMetric] ?? 0 }));
  const selectClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";

  const changeDimension = (d: Dimension) => {
    setDimension(d);
    setAId(null);
    setBId(null);
  };

  return (
    <div key={i18n.language}>
      <PageHeader title={t("comparisons.title")} subtitle={t("comparisons.subtitle")} />
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-gray-500">{t("comparisons.compareBy")}</span>
          <SegmentedControl
            value={dimension}
            onChange={changeDimension}
            options={[
              { value: "seasons", label: t("comparisons.dimSeasons") },
              { value: "games", label: t("comparisons.dimGames") },
              { value: "teams", label: t("comparisons.dimTeams") },
            ]}
          />
          <span className="text-sm text-gray-500">{t("comparisons.metric")}</span>
          <select value={activeMetric} onChange={(e) => setMetric(e.target.value as Metric)} className={selectClass}>
            {availableMetrics.map((m) => (
              <option key={m} value={m}>
                {metricLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <Card title={t("comparisons.chartTitle", { metric: metricLabel(activeMetric), dim: dimLabel })}>
          <div dir="ltr" className="h-80">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} interval={0} angle={items.length > 6 ? -20 : 0} height={items.length > 6 ? 60 : 30} textAnchor={items.length > 6 ? "end" : "middle"} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={64} tickFormatter={(v: number) => axisFmt(activeMetric, v)} />
                <Tooltip formatter={(v) => fmt(activeMetric, v as number)} />
                <Bar isAnimationActive={false} dataKey="value" name={metricLabel(activeMetric)} fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {a && b && (
          <Card title={t("comparisons.directTitle")}>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-500">{t("comparisons.itemA")}</span>
                <select value={a.id} onChange={(e) => setAId(e.target.value)} className={clsx(selectClass, "w-full")}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-500">{t("comparisons.itemB")}</span>
                <select value={b.id} onChange={(e) => setBId(e.target.value)} className={clsx(selectClass, "w-full")}>
                  {items
                    .filter((i) => i.id !== a.id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-4 py-3 text-start font-medium">{t("comparisons.colMetric")}</th>
                    <th className="px-4 py-3 text-start font-medium">
                      {a.label}
                      {a.sub && <span className="ms-1 text-xs text-gray-400">· {a.sub}</span>}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {b.label}
                      {b.sub && <span className="ms-1 text-xs text-gray-400">· {b.sub}</span>}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">{t("comparisons.colDelta")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {availableMetrics.map((m) => {
                    const va = a.metrics[m];
                    const vb = b.metrics[m];
                    const delta = va !== undefined && vb !== undefined ? vb - va : undefined;
                    const pct = delta !== undefined && va ? Math.round((delta / va) * 100) : undefined;
                    const Icon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
                    return (
                      <tr key={m} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{metricLabel(m)}</td>
                        <td className="px-4 py-3 tabular-nums">{fmt(m, va)}</td>
                        <td className="px-4 py-3 tabular-nums">{fmt(m, vb)}</td>
                        <td className="px-4 py-3">
                          {delta === undefined ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span
                              className={clsx(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                                delta > 0 ? "bg-green-100 text-green-700" : delta < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600",
                              )}
                            >
                              <Icon className="size-3.5" />
                              {fmt(m, Math.abs(delta))}
                              {pct !== undefined && ` (${pct > 0 ? "+" : ""}${pct}%)`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {a.extra.map((row, idx) => (
                    <tr key={row.label} className="text-gray-600">
                      <td className="px-4 py-3">{row.label}</td>
                      <td className="px-4 py-3">{row.value}</td>
                      <td className="px-4 py-3">{b.extra[idx]?.value ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
