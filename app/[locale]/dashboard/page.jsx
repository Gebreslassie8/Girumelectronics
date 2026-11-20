'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from '@/i18n/navigation';
import Link from 'next/link';
import {
  Package, ShoppingCart, FileText, TrendingUp, TrendingDown,
  DollarSign, Users, Shield, Briefcase, ArrowRight, Plus,
  BarChart3, Building2, Clock, CheckCircle2, AlertTriangle,
  Activity, Calendar, Filter, X, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { ORDER_STATUS } from '@/lib/constants';

const DATE_RANGES = [
  { key: 'today', label: 'ዛሬ' },
  { key: 'week',  label: 'ሳምንት' },
  { key: 'month', label: 'ወር' },
  { key: 'year',  label: 'ዓመት' },
  { key: 'all',   label: 'ሁሉም' },
];

const ROLE_INFO = {
  admin:    { icon: Shield,    label: 'አስተዳዳሪ', color: 'from-purple-600 via-purple-500 to-indigo-600', desc: 'ሙሉ ስርዓት ቁጥጥር እና ትንተና' },
  seller:   { icon: Briefcase, label: 'ሻጭ',      color: 'from-blue-600 via-blue-500 to-cyan-600',       desc: 'ትዕዛዞች እና ሽያጭ አስተዳደር' },
  customer: { icon: Users,     label: 'ደንበኛ',   color: 'from-green-600 via-green-500 to-emerald-600',  desc: 'የእኔ ትዕዛዞች እና ግዢዎች' },
};

const QUICK_ACTIONS = {
  admin: [
    { label: 'አዲስ ምርት',   icon: Plus,      href: '/dashboard/products',  color: 'bg-blue-500' },
    { label: 'አዲስ ሠራተኛ',  icon: Users,     href: '/dashboard/employees', color: 'bg-purple-500' },
    { label: 'አዲስ ቅርንጫፍ', icon: Building2, href: '/dashboard/branches',  color: 'bg-orange-500' },
    { label: 'ሪፖርት',       icon: BarChart3, href: '/dashboard/analytics', color: 'bg-green-500' },
  ],
  seller: [
    { label: 'አዲስ ትዕዛዝ',  icon: Plus,     href: '/dashboard/orders',   color: 'bg-blue-500' },
    { label: 'አዲስ ደረሰኝ',  icon: FileText, href: '/dashboard/receipts', color: 'bg-purple-500' },
    { label: 'ምርቶች',      icon: Package,  href: '/dashboard/products', color: 'bg-green-500' },
  ],
  customer: [
    { label: 'ምርቶችን ይመልከቱ', icon: Package,  href: '/dashboard/products', color: 'bg-green-500' },
    { label: 'የእኔ ትዕዛዞች',    icon: FileText, href: '/dashboard/orders',   color: 'bg-blue-500' },
    { label: 'ደረሰኞች',        icon: FileText, href: '/dashboard/receipts', color: 'bg-purple-500' },
  ],
};

function filterByDate(dateStr, range) {
  if (!dateStr || range === 'all') return true;
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  switch (range) {
    case 'today': return diffDays === 0;
    case 'week':  return diffDays <= 7;
    case 'month': return diffDays <= 30;
    case 'year':  return diffDays <= 365;
    default:      return true;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const role = user?.role || 'customer';
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
        const [o, p] = await Promise.all([
          apiFetch('/orders').catch(() => []),
          apiFetch('/products').catch(() => []),
        ]);
        if (!cancelled) {
          setOrders(Array.isArray(o) ? o : []);
          setProducts(Array.isArray(p) ? p : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return typeof user.branch === 'object' ? user.branch._id : user.branch;
  }, [user]);

  const roleFilteredOrders = useMemo(() => {
    let result = orders;
    if (role === 'seller' && userBranchId) {
      result = result.filter((o) => o.branch?._id === userBranchId);
    }
    if (role === 'customer') {
      result = result.filter((o) => o.customerPhone === user?.phone);
    }
    return result;
  }, [orders, role, userBranchId, user]);

  const filteredOrders = useMemo(() => {
    return roleFilteredOrders.filter((o) => {
      const matchDate = filterByDate(o.createdAt, dateRange);
      const matchBranch = branchFilter === 'all' || o.branch?._id === branchFilter;
      return matchDate && matchBranch;
    });
  }, [roleFilteredOrders, dateRange, branchFilter]);

  const dynamicStats = useMemo(() => {
    const orderCount = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const totalProfit = Math.round(totalRevenue * 0.58);
    const pending = filteredOrders.filter((o) => o.status === 'pending').length;
    const ready = filteredOrders.filter((o) => o.status === 'ready').length;
    const pickedUp = filteredOrders.filter((o) => o.status === 'picked_up').length;

    if (role === 'admin') {
      return [
        { label: 'ጠቅላላ ገቢ', value: 'ETB ' + totalRevenue.toLocaleString(), icon: DollarSign,   color: 'bg-green-500' },
        { label: 'ትርፍ',       value: 'ETB ' + totalProfit.toLocaleString(),  icon: TrendingUp,   color: 'bg-brand' },
        { label: 'ትዕዛዞች',     value: String(orderCount),                    icon: ShoppingCart, color: 'bg-purple-500' },
        { label: 'ሠራተኞች',     value: '30',                                    icon: Users,        color: 'bg-orange-500' },
      ];
    }
    if (role === 'seller') {
      return [
        { label: 'የእኔ ትዕዛዞች', value: String(orderCount),                    icon: ShoppingCart, color: 'bg-blue-500' },
        { label: 'ገቢ',        value: 'ETB ' + totalRevenue.toLocaleString(), icon: DollarSign,   color: 'bg-green-500' },
        { label: 'ተጠባባቂ',   value: String(pending),                       icon: Clock,        color: 'bg-yellow-500' },
        { label: 'ተረክቧል',    value: String(pickedUp),                      icon: CheckCircle2, color: 'bg-brand' },
      ];
    }
    return [
      { label: 'የእኔ ትዕዛዞች', value: String(orderCount),                    icon: ShoppingCart, color: 'bg-blue-500' },
      { label: 'በመጠባበቅ',   value: String(pending),                       icon: Clock,        color: 'bg-yellow-500' },
      { label: 'ተዘጋጅቷል',  value: String(ready),                         icon: Package,      color: 'bg-green-500' },
      { label: 'ተረክቧል',    value: String(pickedUp),                      icon: CheckCircle2, color: 'bg-gray-500' },
    ];
  }, [filteredOrders, role]);

  const lowStock = useMemo(() => {
    if (role === 'customer') return [];
    let result = products.filter((p) => (p.quantity ?? 0) < 10);
    if (role === 'seller' && userBranchId) {
      result = result.filter((p) => p.branch?._id === userBranchId);
    }
    return result;
  }, [products, role, userBranchId]);

  const activeFilters = (dateRange !== 'week' ? 1 : 0) + (branchFilter !== 'all' ? 1 : 0);
  const clearFilters = () => { setDateRange('week'); setBranchFilter('all'); };
  const showAnalytics = role === 'admin';
  const showLowStock = role === 'admin' || role === 'seller';

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
            እንኳን ደህና መጡ, {user?.fullName || 'ተጠቃሚ'}! 👋
          </h1>
          <p className="text-white/85 text-sm md:text-base">{info.desc}</p>
          <div className="mt-4 flex items-center gap-2 text-white/70 text-xs">
            <Calendar size={14} />
            <span>{new Date().toLocaleDateString('am-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/10" />
      </div>

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
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition sm:hidden"
          >
            <Filter size={14} />
            {showFilterPanel ? 'ዝጋ' : 'ክፈት'}
          </button>
          <div className="hidden sm:flex items-center gap-3 flex-wrap">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-medium">
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
              {filteredOrders.slice(0, 5).map((order) => {
                const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' };
                return (
                  <div
                    key={order._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => router.push('/dashboard/orders')}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand font-semibold text-xs">
                          {(order.customerName || '?').charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{order.customerName}</p>
                        <p className="text-xs text-gray-500">{order.itemType}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-gray-800">
                        {(order.totalPrice || 0).toLocaleString()} ETB
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
              {lowStock.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-yellow-50/50 border border-yellow-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <span className={'text-xs font-bold ' + (item.quantity === 0 ? 'text-red-600' : 'text-yellow-600')}>
                      {item.quantity}/10
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={'h-full ' + (item.quantity === 0 ? 'bg-red-500' : 'bg-yellow-500')}
                      style={{ width: Math.min(((item.quantity || 0) / 10) * 100, 100) + '%' }}
                    />
                  </div>
                </div>
              ))}
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