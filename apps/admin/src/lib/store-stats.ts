import {
  orders,
  productById,
  type Order,
  type Product,
  type ProductCategory,
} from "./mock-data";

export interface StoreStats {
  revenue: number;
  orderCount: number;
  avgOrder: number;
  topProduct: Product;
  topProductUnits: number;
  /** month is 1-based */
  monthly: { year: number; month: number; revenue: number }[];
  topProducts: { product: Product; revenue: number }[];
  categories: { category: ProductCategory; revenue: number }[];
  recent: Order[];
}

/** Aggregates the (mock) store orders once; pages add their own labels. */
export function computeStoreStats(): StoreStats {
  let revenue = 0;
  const unitsByProduct = new Map<string, number>();
  const revenueByProduct = new Map<string, number>();
  const revenueByMonth = new Map<number, number>();
  const revenueByCategory = new Map<ProductCategory, number>();

  for (const order of orders) {
    const product = productById[order.productId];
    const amount = product.price * order.qty;
    revenue += amount;
    unitsByProduct.set(order.productId, (unitsByProduct.get(order.productId) ?? 0) + order.qty);
    revenueByProduct.set(order.productId, (revenueByProduct.get(order.productId) ?? 0) + amount);
    const month = Number(order.date.slice(5, 7));
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + amount);
    revenueByCategory.set(product.category, (revenueByCategory.get(product.category) ?? 0) + amount);
  }

  const topByUnits = [...unitsByProduct.entries()].sort((a, b) => b[1] - a[1]);
  return {
    revenue,
    orderCount: orders.length,
    avgOrder: Math.round(revenue / orders.length),
    topProduct: productById[topByUnits[0][0]],
    topProductUnits: topByUnits[0][1],
    monthly: [...revenueByMonth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([month, value]) => ({ year: 2026, month, revenue: value })),
    topProducts: [...revenueByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([productId, value]) => ({ product: productById[productId], revenue: value })),
    categories: [...revenueByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => ({ category, revenue: value })),
    recent: [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
  };
}

export const storeStats = computeStoreStats();
