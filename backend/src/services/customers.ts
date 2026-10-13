type Purchase = {
  id: string; status: string; totalCents: number; currency: string; createdAt: Date; paidAt: Date | null;
};
export function summarizeOrders(orders: Purchase[]) {
  const paid = orders.filter(order => order.status === "PAID");
  const totals = new Map<string, number>();
  for (const order of paid) totals.set(order.currency, (totals.get(order.currency) || 0) + order.totalCents);
  return {
    totalOrders: orders.length, paidOrders: paid.length,
    totals: [...totals].map(([currency, totalCents]) => ({ currency, totalCents })).sort((a, b) => a.currency.localeCompare(b.currency)),
    lastPurchaseAt: paid.reduce<Date | null>((latest, order) => {
      const date = order.paidAt ?? order.createdAt;
      return !latest || date > latest ? date : latest;
    }, null)
  };
}
type PurchasedItem = {
  productId: string; variantId: string; productName: string; variantName: string;
  product: { type: string; assets: Array<{ variantId: string | null }> };
  variant: { format: string | null; licenseName: string | null };
  order: { id: string; status: string; createdAt: Date; paidAt: Date | null };
};
export function customerLibrary(items: PurchasedItem[]) {
  const grouped = new Map<string, PurchasedItem[]>();
  for (const item of items) {
    const key = JSON.stringify([item.productId, item.variantId]);
    const existing = grouped.get(key) || []; existing.push(item); grouped.set(key, existing);
  }
  return [...grouped].map(([id, entries]) => {
    entries.sort((a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime());
    const paid = entries.filter(item => item.order.status === "PAID").sort((a, b) => (b.order.paidAt ?? b.order.createdAt).getTime() - (a.order.paidAt ?? a.order.createdAt).getTime());
    const item = (paid[0] || entries[0])!;
    return {
      id, productId: item.productId, variantId: item.variantId, name: item.productName, variantName: item.variantName,
      type: item.product.type, format: item.variant.format, licenseName: item.variant.licenseName,
      access: paid.length ? "AVAILABLE" : "BLOCKED", orderId: item.order.id, orderStatus: item.order.status,
      reason: paid.length ? "Compra paga confirmada" : item.order.status === "PENDING" ? "Aguardando confirmação do pagamento" : item.order.status === "REFUNDED" ? "Compra reembolsada" : "Pedido cancelado",
      filesCount: item.product.assets.filter(asset => !asset.variantId || asset.variantId === item.variantId).length
    };
  }).sort((a, b) => Number(b.access === "AVAILABLE") - Number(a.access === "AVAILABLE") || a.name.localeCompare(b.name, "pt-BR"));
}
// The client sees calendar months in America/Maceio (UTC-03:00, no DST).
export function currentMonthStart(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 60 * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));
}
