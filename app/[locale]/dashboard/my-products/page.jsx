'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart,
  Package,
  DollarSign,
  Clock,
  CheckCircle2,
  Search,
  Calendar,
  Filter,
  Eye,
  Building2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ORDER_STATUS } from '@/lib/constants';
import { formatETB, formatDate, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

const DATE_RANGES = [
  { key: 'all', label: 'ሁሉም' },
  { key: 'week', label: 'ሳምንት' },
  { key: 'month', label: 'ወር' },
  { key: 'year', label: 'ዓመት' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'ሁሉም' },
  { key: 'pending', label: 'በመጠባበቅ' },
  { key: 'in_production', label: 'በምርት ላይ' },
  { key: 'ready', label: 'ተዘጋጅቷል' },
  { key: 'delivered', label: 'ተላልፏል' },
];

function filterByDate(dateStr, range) {
  if (range === 'all' || !dateStr) return true;
  const now = new Date();
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return true;
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  switch (range) {
    case 'week':
      return diffDays <= 7;
    case 'month':
      return diffDays <= 30;
    case 'year':
      return diffDays <= 365;
    default:
      return true;
  }
}

function normalizePhone(p) {
  const s = String(p || '').replace(/\s+/g, '');
  if (/^\+?2519\d{8}$/.test(s)) return '0' + s.slice(-9);
  if (/^9\d{8}$/.test(s)) return '0' + s;
  return s;
}

export default function MyProductsPage() {
  const { user, token } = useAuth();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [viewItem, setViewItem] = useState(null);

  const loadData = useCallback(
    async ({ isManualRefresh = false } = {}) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const [ordersRes, productsRes] = await Promise.all([
          fetch('/api/orders', { headers, credentials: 'include', cache: 'no-store' }),
          fetch('/api/products', { headers, credentials: 'include', cache: 'no-store' }),
        ]);

        if (!ordersRes.ok) {
          throw new Error('ትዕዛዞችን መጫን አልተቻለም');
        }

        const ordersData = await ordersRes.json();
        const orderList = Array.isArray(ordersData)
          ? ordersData
          : ordersData.orders || ordersData.data || [];
        setOrders(orderList);

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const productList = Array.isArray(productsData)
            ? productsData
            : productsData.products || productsData.data || [];
          setProducts(productList);
        }
      } catch (err) {
        if (isManualRefresh) {
          toast.error(err.message || 'መረጃ ማደስ አልተቻለም');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadData({ isManualRefresh: false });
  }, [loadData]);

  // Customer's orders only
  const myOrders = useMemo(() => {
    if (!user) return [];
    const userPhone = normalizePhone(user.phone);
    const userId = String(user._id || user.id || '');

    return orders.filter((o) => {
      const orderPhone = normalizePhone(o.customerPhone);
      const orderUserId = String(o.customerId || o.user || '');
      const matchesPhone = Boolean(userPhone && orderPhone && userPhone === orderPhone);
      const matchesId = Boolean(userId && orderUserId && userId === orderUserId);
      return matchesPhone || matchesId;
    });
  }, [orders, user]);

  // Attach matching product details
  const purchasedItems = useMemo(() => {
    return myOrders.map((o) => {
      const product = products.find(
        (p) =>
          (o.productId && String(p._id || p.id) === String(o.productId)) ||
          p.category === o.itemType ||
          p.name === o.itemType
      );
      return { ...o, product };
    });
  }, [myOrders, products]);

  // Filter + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchasedItems.filter((item) => {
      const orderNum = String(item.orderNumber || item._id || '').toLowerCase();
      const itemType = String(item.itemType || '').toLowerCase();
      const prodName = String(item.product?.name || '').toLowerCase();

      const matchSearch =
        !q || orderNum.includes(q) || itemType.includes(q) || prodName.includes(q);
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchDate = filterByDate(item.createdAt, dateRange);
      return matchSearch && matchStatus && matchDate;
    });
  }, [purchasedItems, search, statusFilter, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const total = purchasedItems.length;
    const totalSpent = purchasedItems.reduce(
      (s, o) => s + Number(o.totalPrice || 0),
      0
    );
    const delivered = purchasedItems.filter((o) => o.status === 'delivered').length;
    const pending = purchasedItems.filter((o) => o.status === 'pending').length;
    return { total, totalSpent, delivered, pending };
  }, [purchasedItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">ምርቶች ታሪክ</h1>
          <p className="text-sm text-stone-500 mt-1">
            {filtered.length} የገዙት ምርቶች · {formatETB(stats.totalSpent)} ጠቅላላ ወጪ
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData({ isManualRefresh: true })}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-stone-200 bg-white text-stone-700 hover:border-amber-600 hover:text-amber-800 hover:bg-amber-50/50 transition disabled:opacity-40 self-start sm:self-auto"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin text-amber-700' : ''} />
          አድስ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="ጠቅላላ ግዢዎች"
          value={stats.total}
          icon={ShoppingCart}
          color="bg-amber-700"
        />
        <StatCard
          label="ጠቅላላ ወጪ"
          value={formatETB(stats.totalSpent)}
          icon={DollarSign}
          color="bg-emerald-700"
        />
        <StatCard
          label="የተላለፉ"
          value={stats.delivered}
          icon={CheckCircle2}
          color="bg-stone-800"
        />
        <StatCard
          label="በመጠባበቅ"
          value={stats.pending}
          icon={Clock}
          color="bg-amber-600"
        />
      </div>

      {/* Filters */}
      <Card padding="sm" className="border border-stone-200 bg-white rounded-2xl">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ፈልግ (ትዕዛዝ ቁጥር፣ ዕቃ፣ ምርት)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600 text-sm text-stone-800 bg-white"
            />
          </div>

          {/* Status + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-stone-100">
              <Filter size={14} className="text-stone-500 ml-2 flex-shrink-0" />
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap',
                    statusFilter === s.key
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100">
              <Calendar size={14} className="text-stone-500 ml-2 flex-shrink-0" />
              {DATE_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setDateRange(r.key)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition flex-1',
                    dateRange === r.key
                      ? 'bg-white text-amber-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none" className="border border-stone-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">ትዕዛዝ ቁጥር</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">ዕቃ</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-700">ብዛት</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">ጠቅላላ</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">ቅድመ</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">ቀሪ</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-700">ሁኔታ</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">ቀን</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-stone-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={22} className="animate-spin text-amber-700" />
                      <p className="text-xs sm:text-sm">ከዳታቤዝ በመጫን ላይ...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                        <ShoppingCart size={28} className="text-stone-400" />
                      </div>
                      <p className="text-stone-600 text-sm font-medium">ምንም የተገዛ ምርት አልተገኘም</p>
                      <p className="text-xs text-stone-400">
                        {search || statusFilter !== 'all' || dateRange !== 'all'
                          ? 'ማጣሪያዎችዎን ያስተካክሉ'
                          : 'እስካሁን ምንም አልገዙም'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const status = ORDER_STATUS[item.status] || {
                    label: item.status || '—',
                    color: 'gray',
                  };
                  const displayOrderNum =
                    item.orderNumber ||
                    String(item._id || '').slice(-6).toUpperCase() ||
                    '—';

                  return (
                    <tr
                      key={item._id || item.orderNumber}
                      className="border-b border-stone-100 hover:bg-amber-50/30 transition"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-amber-800 font-semibold">
                        {displayOrderNum}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-amber-100/80 flex items-center justify-center flex-shrink-0">
                            <ShoppingCart size={16} className="text-amber-800" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-800">{item.itemType || 'ምርት'}</p>
                            {item.product?.name && (
                              <p className="text-xs text-stone-500 truncate max-w-xs">
                                {item.product.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-stone-800">
                        {item.quantity ?? 1}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">
                        {formatETB(item.totalPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {formatETB(item.prepayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-700 font-medium">
                        {formatETB(item.remainingPayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {item.createdAt ? formatDate(item.createdAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-100/80 transition"
                            title="ይመልከቱ"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Modal */}
      <Modal
        isOpen={!!viewItem}
        onClose={() => setViewItem(null)}
        title="የግዢ ዝርዝር"
      >
        {viewItem && <OrderDetailView item={viewItem} />}
      </Modal>
    </div>
  );
}

// ============ Sub-components ============

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card padding="sm" className="border border-stone-200 bg-white rounded-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-stone-500 truncate">{label}</p>
          <p className="text-xl font-bold text-stone-900 mt-1 truncate">{value}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl shrink-0', color)}>
          <Icon size={19} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

function OrderDetailView({ item }) {
  const status = ORDER_STATUS[item.status] || {
    label: item.status || '—',
    color: 'gray',
  };
  const displayOrderNum =
    item.orderNumber || String(item._id || '').slice(-6).toUpperCase() || '—';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
        <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center">
          <ShoppingCart size={26} className="text-amber-800" />
        </div>
        <div>
          <p className="font-bold text-stone-900 text-lg">{item.itemType || 'ምርት'}</p>
          <p className="text-sm text-stone-500 font-mono">{displayOrderNum}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 py-4">
        <StatBox
          label="ጠቅላላ"
          value={formatETB(item.totalPrice || 0)}
          icon={DollarSign}
          color="text-amber-800 bg-amber-50"
        />
        <StatBox
          label="ቅድመ"
          value={formatETB(item.prepayment || 0)}
          icon={CheckCircle2}
          color="text-emerald-700 bg-emerald-50"
        />
        <StatBox
          label="ቀሪ"
          value={formatETB(item.remainingPayment || 0)}
          icon={Clock}
          color="text-red-700 bg-red-50"
        />
      </div>

      {/* Info */}
      <div className="space-y-3 pt-3 border-t border-stone-100 text-sm">
        <Row
          label="ዕቃ"
          value={`${item.itemType || 'ምርት'} × ${item.quantity ?? 1}`}
          icon={Package}
        />
        <Row
          label="ቀን"
          value={item.createdAt ? formatDate(item.createdAt) : '—'}
          icon={Calendar}
        />
        <Row
          label="ቀጠሮ"
          value={item.appointmentDate ? formatDate(item.appointmentDate) : '—'}
          icon={Calendar}
        />
        <Row
          label="ቅርንጫፍ"
          value={
            typeof item.branch === 'object'
              ? item.branch?.name || '-'
              : item.branch || '-'
          }
          icon={Building2}
        />
        {item.measurements?.width && (
          <Row
            label="ልኬት"
            value={`${item.measurements.width} × ${item.measurements.height || ''} ${item.measurements.unit || ''}`}
          />
        )}
        {item.note && <Row label="ማስታወሻ" value={item.note} />}
        <div className="flex justify-between items-center">
          <span className="text-stone-500">ሁኔታ:</span>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
      </div>

      {/* Product Details */}
      {item.product && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-xs font-semibold text-stone-600 mb-2">የምርት ዝርዝር</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/70">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={20} className="text-amber-800" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-800 truncate">{item.product.name}</p>
              <p className="text-xs text-stone-500">{item.product.category}</p>
            </div>
            <p className="text-sm font-semibold text-amber-800 flex-shrink-0">
              {formatETB(item.product.sellingPrice || 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  const [iconColor, bgColor] = color.split(' ');
  return (
    <div className={cn('rounded-xl p-2.5 text-center', bgColor)}>
      <div className="flex items-center justify-center mb-1">
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-xs font-bold text-stone-800">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500 flex-shrink-0 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}:
      </span>
      <span className="text-right text-stone-800">{value}</span>
    </div>
  );
}