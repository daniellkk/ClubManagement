import { Banknote, Package, ShoppingBag, Trophy } from "lucide-react";
import { useMemo } from "react";
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
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatMonth,
  formatNumber,
} from "../lib/format";
import { l10n } from "../lib/i18n";
import { productById, type ProductCategory } from "../lib/mock-data";
import { storeStats } from "../lib/store-stats";

// Fixed entity→color mapping from the validated categorical palette
const CATEGORY_COLORS: Record<ProductCategory, string> = {
  jerseys: "#dc2626",
  scarves: "#1d4ed8",
  accessories: "#15803d",
  kids: "#7e22ce",
  other: "#b45309",
};

const categoryKey = (c: ProductCategory) => `store.cat${c.charAt(0).toUpperCase()}${c.slice(1)}`;

export function StorePage() {
  const { t, i18n } = useTranslation();

  // Labels depend on the language; the aggregates themselves are shared with the dashboard
  const view = useMemo(
    () => ({
      monthly: storeStats.monthly.map((m) => ({ label: formatMonth(m.year, m.month), revenue: m.revenue })),
      topProducts: storeStats.topProducts.map((p) => ({
        name: l10n(p.product.name),
        category: p.product.category,
        revenue: p.revenue,
      })),
      categories: storeStats.categories.map((c) => ({
        key: c.category,
        name: t(categoryKey(c.category)),
        value: c.revenue,
        color: CATEGORY_COLORS[c.category],
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  return (
    <div key={i18n.language}>
      <PageHeader title={t("store.title")} subtitle={t("store.subtitle")} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={t("store.kpiRevenue")}
            value={formatCurrencyCompact(storeStats.revenue)}
            icon={<Banknote className="size-5" />}
            iconColor="red"
          />
          <KpiCard
            label={t("store.kpiOrders")}
            value={formatNumber(storeStats.orderCount)}
            icon={<ShoppingBag className="size-5" />}
            iconColor="blue"
          />
          <KpiCard
            label={t("store.kpiAvgOrder")}
            value={formatCurrency(storeStats.avgOrder)}
            icon={<Package className="size-5" />}
            iconColor="green"
          />
          <KpiCard
            label={t("store.kpiTopProduct")}
            value={l10n(storeStats.topProduct.name)}
            icon={<Trophy className="size-5" />}
            iconColor="amber"
            sub={t("store.unitsSold", { count: storeStats.topProductUnits })}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title={t("store.chartRevenue")} className="xl:col-span-2">
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <BarChart data={view.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    width={60}
                    tickFormatter={(v: number) => formatCurrencyCompact(v)}
                  />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Bar
                    isAnimationActive={false}
                    dataKey="revenue"
                    name={t("common.revenue")}
                    fill="#dc2626"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("store.chartCategories")}>
            <div dir="ltr" className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={view.categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {view.categories.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title={t("store.chartTop")}>
            <div dir="ltr" className="h-80">
              <ResponsiveContainer>
                <BarChart data={view.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    tickFormatter={(v: number) => formatCurrencyCompact(v)}
                  />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Bar isAnimationActive={false} dataKey="revenue" name={t("common.revenue")} radius={[0, 4, 4, 0]}>
                    {view.topProducts.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.category]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t("store.recentOrders")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-4 py-3 text-start font-medium">{t("common.date")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("store.colFan")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("store.colProduct")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("store.colCategory")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("store.colPrice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {storeStats.recent.map((order) => {
                    const product = productById[order.productId];
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-500">{formatDate(order.date)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{order.fanName}</td>
                        <td className="px-4 py-3">
                          {l10n(product.name)}
                          {order.qty > 1 && <span className="text-gray-400"> ×{order.qty}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[product.category] }} />
                            {t(categoryKey(product.category))}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatCurrency(product.price * order.qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
