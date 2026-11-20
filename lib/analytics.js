// lib/analytics.js
// Computes analytics from real orders. No mock data.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function startOf(range) {
  const now = new Date();
  if (range === 'day')   { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (range === 'week')  return new Date(now.getTime() - 7 * 864e5);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year')  return new Date(now.getFullYear(), 0, 1);
  return new Date(0);
}

export function computeStats(orders = [], range = 'month', expenseRatio = 0.42) {
  const from = startOf(range);
  const inRange = orders.filter((o) => {
    const d = new Date(o.createdAt || o.date || 0);
    return !isNaN(d) && d >= from;
  });
  const revenue = inRange.reduce((s, o) => s + (o.totalPrice ?? 0), 0);
  // Replace expenseRatio with a real cost field if your orders have one:
  const expense = Math.round(revenue * expenseRatio);
  return { revenue, expense, profit: revenue - expense, orders: inRange.length };
}

export function computeMonthlySeries(orders = [], expenseRatio = 0.42) {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: MONTHS[d.getMonth()],
      revenue: 0,
      expense: 0,
      orders: 0,
      _key: `${d.getFullYear()}-${d.getMonth()}`,
    });
  }
  orders.forEach((o) => {
    const d = new Date(o.createdAt || o.date || 0);
    if (isNaN(d)) return;
    const b = buckets.find((x) => x._key === `${d.getFullYear()}-${d.getMonth()}`);
    if (!b) return;
    b.revenue += o.totalPrice ?? 0;
    b.expense += Math.round((o.totalPrice ?? 0) * expenseRatio);
    b.orders  += 1;
  });
  return buckets.map(({ _key, ...r }) => r);
}

export function computeCategoryShare(orders = []) {
  const palette = ['#1d4ed8','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];
  const totals = {};
  orders.forEach((o) => {
    (o.items ?? []).forEach((it) => {
      const cat = it.category || it.product?.category || 'Other';
      totals[cat] = (totals[cat] ?? 0) + (it.price ?? 0) * (it.quantity ?? 1);
    });
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grand = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return entries.map(([name, value], i) => ({
    name,
    value: Math.round((value / grand) * 100),
    color: palette[i % palette.length],
  }));
}

export function computeBranchPerformance(orders = [], expenseRatio = 0.42) {
  const byBranch = {};
  orders.forEach((o) => {
    const name = o.branch?.name || 'Unknown';
    if (!byBranch[name]) byBranch[name] = { name, revenue: 0, expense: 0 };
    byBranch[name].revenue += o.totalPrice ?? 0;
    byBranch[name].expense += Math.round((o.totalPrice ?? 0) * expenseRatio);
  });
  return Object.values(byBranch).sort((a, b) => b.revenue - a.revenue);
}

export function computeTopProducts(orders = [], limit = 5) {
  const totals = {};
  orders.forEach((o) => {
    (o.items ?? []).forEach((it) => {
      const name = it.name || it.product?.name || 'Unknown';
      if (!totals[name]) totals[name] = { name, sold: 0, revenue: 0 };
      totals[name].sold    += it.quantity ?? 1;
      totals[name].revenue += (it.price ?? 0) * (it.quantity ?? 1);
    });
  });
  return Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}