'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from '@/i18n/navigation';
import Link from 'next/link';
import {
  Package, ShoppingCart, FileText, TrendingUp, TrendingDown,
  DollarSign, Users, Shield, Briefcase, ArrowRight, Plus,
  BarChart3, Building2, Clock, CheckCircle2, AlertTriangle,
  Activity, Calendar, Filter, X, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { ORDER_STATUS } from '@/lib/constants';

const ETHIOPIAN_TIME_ZONE = 'Africa/Addis_Ababa';

const DATE_RANGES = [
  { key: 'today', label: 'ዛሬ' },
  { key: 'week',  label: 'ሳምንት' },
  { key: 'month', label: 'ወር' },
  { key: 'year',  label: 'ዓመት' },
  { key: 'all',   label: 'ሁሉም' },
];

const ROLE_INFO = {
  admin: {
    icon: Shield,
    label: 'አስተዳዳሪ',
    color: 'from-purple-600 via-purple-500 to-indigo-600',
    desc: 'ሙሉ ስርዓት ቁጥጥር፣ ትንተና እና አስተዳደር',
  },
  seller: {
    icon: Briefcase,
    label: 'ሻጭ',
    color: 'from-blue-600 via-blue-500 to-cyan-600',
    desc: 'ትዕዛዞች፣ ደረሰኞች እና ሽያጭ አስተዳደር',
  },
  customer: {
    icon: Users,
    label: 'ደንበኛ',
    color: 'from-green-600 via-green-500 to-emerald-600',
    desc: 'የእኔ ትዕዛዞች፣ ደረሰኞች እና ምርቶች',
  },
};

const QUICK_ACTIONS = {
  admin: [
    { label: 'አዲስ ምርት',   icon: Plus,      href: '/dashboard/products',  color: 'bg-blue-500' },
    { label: 'አዲስ ሠራተኛ',  icon: Users,     href: '/dashboard/employees', color: 'bg-purple-500' },
    { label: 'አዲስ ቅርንጫፍ', icon: Building2, href: '/dashboard/branches',  color: 'bg-orange-500' },
    { label: 'ሪፖርት',       icon: BarChart3, href: '/dashboard/analytics', color: 'bg-green-500' },
  ],
  seller: [
    { label: 'አዲስ ትዕዛዝ',    icon: Plus,         href: '/dashboard/orders',   color: 'bg-blue-500' },
    { label: 'አዲስ ደረሰኝ',    icon: FileText,     href: '/dashboard/receipts', color: 'bg-purple-500' },
    { label: 'ምርቶች',        icon: Package,      href: '/dashboard/products', color: 'bg-green-500' },
    { label: 'ትዕዛዞች',       icon: ShoppingCart, href: '/dashboard/orders',   color: 'bg-orange-500' },
  ],
  customer: [
    { label: 'ምርቶችን ይመልከቱ', icon: Package,  href: '/dashboard/products', color: 'bg-green-500' },
    { label: 'የእኔ ትዕዛዞች',    icon: FileText, href: '/dashboard/orders',   color: 'bg-blue-500' },
    { label: 'ደረሰኞች',        icon: FileText, href: '/dashboard/receipts', color: 'bg-purple-500' },
  ],
};

function getEntityId(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || null;
}

function formatEthiopianDate(input, options = {}) {
  if (!input) return '';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleDateString('am-ET', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    });
  }
}

function getLocalDayKey(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ETHIOPIAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function filterByDate(dateStr, range) {
  if (!dateStr || range === 'all') return true;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;

  const now = new Date();
  if (range === 'today') {
    return getLocalDayKey(target) === getLocalDayKey(now);
  }

  const diffDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  switch (range) {
    case 'week':  return diffDays >= 0 && diffDays <= 7;
    case 'month': return diffDays >= 0 && diffDays <= 30;
    case 'year':  return diffDays >= 0 && diffDays <= 365;
    default:      return true;
  }
}

function getOrderExpense(order) {
  if (order?.expense != null) return Number(order.expense) || 0;
  if (order?.totalExpense != null) return Number(order.totalExpense) || 0;
  if (order?.cost != null) return Number(order.cost) || 0;
  const revenue = Number(order?.totalPrice ?? order?.total ?? 0);
  return Math.round(revenue * 0.42);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const role = useMemo(() => {
    const raw = String(user?.role || 'customer').toLowerCase();
    return ROLE_INFO[raw] ? raw : 'customer';
  }, [user?.role]);

  const info = ROLE_INFO[role] || ROLE_INFO.customer;
  const RoleIcon = info.icon;

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dateRange, setDateRange] = useState('week');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const [o, p] = await Promise.all([
          apiFetch('/orders').catch(() => []),
          apiFetch('/products').catch(() => []),
        ]);
        if (!cancelled) {
          setOrders(Array.isArray(o) ? o : []);
          setProducts(Array.isArray(p) ? p : []);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'መረጃ መጫን አልተሳካም');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const userBranchId = useMemo(() => getEntityId(user?.branch), [user?.branch]);

  const branchOptions = useMemo(() => {
    const map = new Map();
    for (const item of [...orders, ...products]) {
      const b = item?.branch;
      const id = getEntityId(b);
      if (id && !map.has(id)) {
        const name = typeof b === 'object' ? (b.name || b.title || id) : id;
        map.set(id, name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders, products]);

  const roleFilteredOrders = useMemo(() => {
    let result = Array.isArray(orders) ? orders : [];

    if (role === 'seller' && userBranchId) {
      result = result.filter((o) => {
        const orderBranchId = getEntityId(o?.branch);
        return !orderBranchId || orderBranchId === userBranchId;
      });
    }

    if (role === 'customer' && user) {
      const userEmail = String(user.email || '').trim().toLowerCase();
      const userPhone = String(user.phone || '').trim();
      const userId = String(user._id || user.id || '');

      const matched = result.filter((o) => {
        const orderEmail = String(o?.customerEmail || o?.email || '').trim().toLowerCase();
        const orderPhone = String(o?.customerPhone || o?.phone || '').trim();
        const orderUserId = String(getEntityId(o?.user) || getEntityId(o?.customerId) || '');

        if (userEmail && orderEmail && orderEmail === userEmail) return true;
        if (userPhone && orderPhone && orderPhone === userPhone) return true;
        if (userId && orderUserId && orderUserId === userId) return true;
        return false;
      });

      result = matched.length > 0 || userEmail || userPhone || userId ? matched : result;
    }

    return result;
  }, [orders, role, userBranchId, user]);

  const filteredOrders = useMemo(() => {
    return roleFilteredOrders.filter((o) => {
      const matchDate = filterByDate(o?.createdAt || o?.date, dateRange);
      const orderBranchId = getEntityId(o?.branch);
      const matchBranch = branchFilter === 'all' || orderBranchId === branchFilter;
      return matchDate && matchBranch;
    });
  }, [roleFilteredOrders, dateRange, branchFilter]);

  const totalExpense = useMemo(
    () => filteredOrders.reduce((s, o) => s + getOrderExpense(o), 0),
    [filteredOrders]
  );

  const dynamicStats = useMemo(() => {
    const orderCount = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o?.totalPrice ?? o?.total ?? 0), 0);
    const totalProfit = Math.max(0, totalRevenue - totalExpense);
    const pending = filteredOrders.filter((o) => o?.status === 'pending').length;
    const ready = filteredOrders.filter((o) => o?.status === 'ready').length;
    const pickedUp = filteredOrders.filter((o) => o?.status === 'picked_up').length;

    if (role === 'admin') {
      return [
        { label: 'ጠቅላላ ገቢ', value: 'ETB ' + totalRevenue.toLocaleString(), icon: DollarSign,   color: 'bg-green-500' },
        { label: 'ጠቅላላ ወጪ', value: 'ETB ' + totalExpense.toLocaleString(), icon: TrendingDown, color: 'bg-rose-500' },
        { label: 'ትርፍ',       value: 'ETB ' + totalProfit.toLocaleString(),  icon: TrendingUp,   color: 'bg-brand' },
        { label: 'ትዕዛዞች',     value: String(orderCount),                    icon: ShoppingCart, color: 'bg-purple-500' },
        { label: 'ምርቶች',      value: String(products.length),               icon: Package,      color: 'bg-orange-500' },
      ];
    }

    if (role === 'seller') {
      return [
        { label: 'ገቢ',        value: 'ETB ' + totalRevenue.toLocaleString(), icon: DollarSign,   color: 'bg-green-500' },
        { label: 'ጠቅላላ ወጪ', value: 'ETB ' + totalExpense.toLocaleString(), icon: TrendingDown, color: 'bg-rose-500' },
        { label: 'የእኔ ትዕዛዞች', value: String(orderCount),                    icon: ShoppingCart, color: 'bg-blue-500' },
        { label: 'ተረክቧል',    value: String(pickedUp),                      icon: CheckCircle2, color: 'bg-brand' },
      ];
    }

    return [
      { label: 'የእኔ ትዕዛዞች', value: String(orderCount),                    icon: ShoppingCart, color: 'bg-blue-500' },
      { label: 'በመጠባበቅ',   value: String(pending),                       icon: Clock,        color: 'bg-yellow-500' },
      { label: 'ተዘጋጅቷል',  value: String(ready),                         icon: Package,      color: 'bg-green-500' },
      { label: 'ተረክቧል',    value: String(pickedUp),                      icon: CheckCircle2, color: 'bg-gray-500' },
    ];
  }, [filteredOrders, role, products.length, totalExpense]);

  const trendData = useMemo(() => {
    const grouped = new Map();
    for (const order of filteredOrders) {
      const rawDate = order?.createdAt || order?.date;
      const key = getLocalDayKey(rawDate) || 'unknown';
      const label = formatEthiopianDate(rawDate, { month: 'short', day: 'numeric' }) || key;
      const revenue = Number(order?.totalPrice ?? order?.total ?? 0);
      const expense = getOrderExpense(order);
      const current = grouped.get(key) || { date: key, label, revenue: 0, expense: 0, orders: 0 };
      current.revenue += revenue;
      current.expense += expense;
      current.orders += 1;
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const smartInsights = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o?.totalPrice ?? o?.total ?? 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0;
    const pendingCount = filteredOrders.filter((o) => o?.status === 'pending').length;

    const insights = [];
    if (filteredOrders.length > 0) {
      insights.push(`አማካይ የትዕዛዝ ዋጋ: ETB ${avgOrderValue.toLocaleString()}`);
    }
    if (pendingCount > 0) {
      insights.push(`${pendingCount} ትዕዛዞች በመጠባበቅ ላይ ይገኛሉ`);
    }
    if (role !== 'customer') {
      const outOfStock = products.filter((p) => Number(p?.quantity ?? 0) === 0).length;
      if (outOfStock > 0) {
        insights.push(`${outOfStock} ምርቶች ክምችታቸው 0 ሆኗል`);
      }
    }
    return insights;
  }, [filteredOrders, products, role]);

  const lowStock = useMemo(() => {
    if (role === 'customer') return [];
    let result = products.filter((p) => Number(p?.quantity ?? 0) < 10);
    if (role === 'seller' && userBranchId) {
      result = result.filter((p) => {
        const pBranch = getEntityId(p?.branch);
        return !pBranch || pBranch === userBranchId;
      });
    }
    if (branchFilter !== 'all') {
      result = result.filter((p) => getEntityId(p?.branch) === branchFilter);
    }
    return result;
  }, [products, role, userBranchId, branchFilter]);

  const activeFilters = (dateRange !== 'week' ? 1 : 0) + (branchFilter !== 'all' ? 1 : 0);
  const clearFilters = () => {
    setDateRange('week');
    setBranchFilter('all');
  };

  const showAnalytics = role === 'admin' || role === 'seller';
  const showLowStock = role === 'admin' || role === 'seller';
  const ethiopianToday = useMemo(
    () => formatEthiopianDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">በመጫን ላይ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">ስህተት ተፈጥሯል</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <div className={'relative overflow-hidden rounded-2xl bg-gradient-to-br ' + info.color + ' p-6 md:p-8 text-white shadow-lg'}>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <RoleIcon size={22} />
            </div>
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold uppercase tracking-wide">
              {info.label}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            እንኳን ደህና መጡ, {user?.fullName || user?.email || 'ተጠቃሚ'}! 👋
          </h1>
          <p className="text-white/85 text-sm md:text-base">{info.desc}</p>
          <div className="mt-4 flex items-center gap-2 text-white/80 text-xs">
            <Calendar size={14} />
            <span>{ethiopianToday} (የኢትዮጵያ ቀን መቁጠሪያ)</span>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/10" />
      </div>

      {/* Smart Insights Strip */}
      {smartInsights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand mr-1">
            <Sparkles size={14} />
            ብልህ ጠቋሚዎች:
          </span>
          {smartInsights.map((text, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
            >
              {text}
            </span>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">ማጣሪያዎች</span>
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold">
                {activeFilters}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition sm:hidden"
          >
            <Filter size={14} />
            {showFilterPanel ? 'ዝጋ' : 'ክፈት'}
          </button>
          <div className="hidden sm:flex items-center gap-3 flex-wrap">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            {role === 'admin' && branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="all">ሁሉም ቅርንጫፎች</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-medium"
              >
                <X size={12} /> አጽዳ
              </button>
            )}
          </div>
        </div>
        {showFilterPanel && (
          <div className="sm:hidden mt-3 pt-3 border-t border-gray-200 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">የቀን ክልል</label>
              <DateRangeFilter value={dateRange} onChange={setDateRange} full />
            </div>
            {role === 'admin' && branchOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">ቅርንጫፍ</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700"
                >
                  <option value="all">ሁሉም ቅርንጫፎች</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-medium"
              >
                <X size={12} /> አጽዳ
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dynamicStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="group bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-brand/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 truncate">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                </div>
                <div className={'p-3 rounded-lg ' + stat.color + ' shadow-sm group-hover:scale-110 transition-transform'}>
                  <Icon size={22} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Expense & Revenue Trend */}
      {showAnalytics && trendData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">የወጪ እና የገቢ እንቅስቃሴ</h2>
              <p className="text-xs text-gray-500 mt-0.5">በኢትዮጵያ ቀን መቁጠሪያ የተደራጀ</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">
                ጠቅላላ ወጪ: ETB {totalExpense.toLocaleString()}
              </span>
              <BarChart3 size={18} className="text-gray-400" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name) => [
                    `ETB ${Number(val).toLocaleString()}`,
                    name === 'expense' ? 'ጠቅላላ ወጪ' : 'ጠቅላላ ገቢ',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => (value === 'expense' ? 'ጠቅላላ ወጪ' : 'ጠቅላላ ገቢ')}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="#d97706"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="expense"
                  stroke="#e11d48"
                  fill="#f43f5e"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">ፈጣን ተግባራት</h2>
            <p className="text-xs text-gray-500 mt-0.5">በአንድ ጠቅታ ይጀምሩ</p>
          </div>
          <Activity size={18} className="text-gray-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(QUICK_ACTIONS[role] || QUICK_ACTIONS.customer).map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => router.push(action.href)}
                className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-brand hover:bg-gray-50 transition-all text-left"
              >
                <div className={'w-10 h-10 rounded-lg ' + action.color + ' flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'}>
                  <Icon size={18} className="text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-brand transition">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className={'grid grid-cols-1 ' + (showLowStock && lowStock.length > 0 ? 'lg:grid-cols-3' : '') + ' gap-4'}>
        <div className={'bg-white rounded-xl shadow-sm border border-gray-200 p-5 ' + (showLowStock && lowStock.length > 0 ? 'lg:col-span-2' : '')}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-800">የቅርብ ጊዜ ትዕዛዞች</h3>
              <p className="text-xs text-gray-500 mt-0.5">{filteredOrders.length} ትዕዛዞች</p>
            </div>
            <Link href="/dashboard/orders" className="text-xs font-medium text-brand hover:underline flex items-center gap-1">
              ሁሉንም <ArrowRight size={12} />
            </Link>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Filter size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">ምንም ትዕዛዝ አልተገኘም</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.slice(0, 5).map((order, idx) => {
                const status = ORDER_STATUS[order?.status] || { label: order?.status || '—', color: 'gray' };
                const customerLabel = order?.customerName || order?.customerEmail || 'ደንበኛ';
                const orderDateLabel = formatEthiopianDate(order?.createdAt || order?.date, { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={order?._id || order?.id || idx}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => router.push('/dashboard/orders')}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand font-semibold text-xs">
                          {customerLabel.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{customerLabel}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[order?.itemType || order?.productName, orderDateLabel].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-gray-800">
                        {Number(order?.totalPrice ?? order?.total ?? 0).toLocaleString()} ETB
                      </p>
                      <Badge color={status.color}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showLowStock && lowStock.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-500" />
                  ዝቅተኛ ክምችት
                </h3>
              </div>
            </div>
            <div className="space-y-3">
              {lowStock.map((item, i) => {
                const qty = Number(item?.quantity ?? 0);
                return (
                  <div key={item?._id || item?.id || i} className="p-3 rounded-lg bg-yellow-50/50 border border-yellow-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate">{item?.name || 'ምርት'}</p>
                      <span className={'text-xs font-bold ' + (qty === 0 ? 'text-red-600' : 'text-yellow-600')}>
                        {qty}/10
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={'h-full ' + (qty === 0 ? 'bg-red-500' : 'bg-yellow-500')}
                        style={{ width: Math.min((qty / 10) * 100, 100) + '%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DateRangeFilter({ value, onChange, full }) {
  return (
    <div className={'inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 ' + (full ? 'w-full' : '')}>
      {DATE_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={'px-3 py-1 rounded-md text-xs font-medium transition ' +
            (value === r.key ? 'bg-white text-brand shadow-sm' : 'text-gray-600 hover:text-gray-800') +
            ' ' + (full ? 'flex-1' : '')}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Badge({ color, children }) {
  const colors = {
    yellow: 'bg-yellow-100 text-yellow-800',
    blue:   'bg-blue-100 text-blue-800',
    green:  'bg-green-100 text-green-800',
    gray:   'bg-gray-100 text-gray-800',
    red:    'bg-red-100 text-red-800',
  };
  return (
    <span className={'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ' + (colors[color] || colors.gray)}>
      {children}
    </span>
  );
}