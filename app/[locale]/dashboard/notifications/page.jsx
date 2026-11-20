'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Bell, CheckCheck, Trash2, Search, RefreshCw, ArrowUpRight,
  Package, FileText, Wallet, Users, ShoppingCart,
  AlertCircle, CheckCircle2, Info, Clock, Building2, Shield,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS } from '@/lib/utils';

const SIDEBAR_PATHS = [
  '/dashboard',
  '/dashboard/users',
  '/dashboard/employees',
  '/dashboard/inventory',
  '/dashboard/products',
  '/dashboard/orders',
  '/dashboard/receipts',
  '/dashboard/branches',
  '/dashboard/warranty',
  '/dashboard/expenses',
  '/dashboard/analytics',
  '/dashboard/sold-items',
  '/dashboard/notifications',
  '/dashboard/activity',
  '/dashboard/settings',
];

const TYPE_META = {
  order:     { icon: ShoppingCart, color: 'text-amber-700',   bg: 'bg-amber-100/80' },
  inventory: { icon: Package,      color: 'text-orange-700',  bg: 'bg-orange-100/80' },
  stock:     { icon: Package,      color: 'text-orange-700',  bg: 'bg-orange-100/80' },
  receipt:   { icon: FileText,     color: 'text-stone-700',   bg: 'bg-stone-200/70' },
  payment:   { icon: Wallet,       color: 'text-emerald-700', bg: 'bg-emerald-100/80' },
  warranty:  { icon: Shield,       color: 'text-amber-800',   bg: 'bg-amber-100/70' },
  user:      { icon: Users,        color: 'text-neutral-700', bg: 'bg-neutral-200/70' },
  branch:    { icon: Building2,    color: 'text-stone-700',   bg: 'bg-stone-200/70' },
  system:    { icon: Info,         color: 'text-neutral-600', bg: 'bg-neutral-100' },
  other:     { icon: Info,         color: 'text-neutral-600', bg: 'bg-neutral-100' },
};

const PRIORITY_META = {
  high:   { icon: AlertCircle,  color: 'text-red-700',     bg: 'bg-red-100/80',     label: 'አስቸኳይ' },
  normal: { icon: Clock,        color: 'text-neutral-600', bg: 'bg-neutral-100',    label: 'መደበኛ' },
  low:    { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100/70', label: 'ዝቅተኛ' },
};

const ROLE_FILTERS = {
  admin:       ['all', 'unread', 'order', 'stock', 'payment', 'user', 'branch', 'system'],
  owner:       ['all', 'unread', 'order', 'stock', 'payment', 'user', 'branch', 'system'],
  seller:      ['all', 'unread', 'order', 'stock', 'payment'],
  cashier:     ['all', 'unread', 'order', 'payment'],
  storekeeper: ['all', 'unread', 'stock', 'order'],
  customer:    ['all', 'unread', 'order', 'payment', 'warranty'],
};

const FILTER_LABELS = {
  all:      'ሁሉም',
  unread:   'ያልተነበቡ',
  order:    'ትዕዛዞች',
  stock:    'ክምችት',
  payment:  'ክፍያ',
  warranty: 'ዋስትና',
  user:     'ተጠቃሚዎች',
  branch:   'ቅርንጫፎች',
  system:   'ስርዓት',
};

function resolvePriority(item) {
  if (item.priority) return item.priority;
  if (item.severity === 'error' || item.severity === 'warning') return 'high';
  if (item.severity === 'success') return 'low';
  return 'normal';
}

export default function NotificationsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale;
  const { user, token } = useAuth();
  const role = (user?.role || 'customer').toLowerCase();
  const roleLabel = ROLE_LABELS[role] || ROLE_LABELS[user?.role] || 'ተጠቃሚ';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const resolveSidebarHref = useCallback(
    (link) => {
      if (!link) return null;
      if (link.startsWith('http://') || link.startsWith('https://')) return link;

      let clean = link.startsWith('/') ? link : `/${link}`;
      if (locale && (clean === `/${locale}` || clean.startsWith(`/${locale}/`))) {
        clean = clean.slice(locale.length + 1) || '/dashboard';
      }

      const matchedSidebarPath = SIDEBAR_PATHS.find(
        (p) => clean === p || clean.startsWith(`${p}/`)
      );

      if (!matchedSidebarPath) {
        const trimmed = clean.replace(/^\/+/, '');
        const candidate = trimmed.startsWith('dashboard/') ? `/${trimmed}` : `/dashboard/${trimmed}`;
        const fallbackMatch = SIDEBAR_PATHS.find(
          (p) => candidate === p || candidate.startsWith(`${p}/`)
        );
        clean = fallbackMatch ? candidate : '/dashboard';
      }

      return locale ? `/${locale}${clean}` : clean;
    },
    [locale]
  );

  const normalizeItem = useCallback((item) => ({
    ...item,
    id: String(item._id || item.id),
    read: Boolean(item.read ?? item.isRead),
    priority: resolvePriority(item),
    time: item.time || item.createdAt || new Date().toISOString(),
  }), []);

  const fetchNotifications = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/notifications', {
        headers: authHeaders,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'ማሳወቂያዎችን ከዳታቤዝ መጫን አልተቻለም።');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.notifications || [];
      setNotifications(list.map(normalizeItem));
    } catch (err) {
      setError(err.message || 'የዳታቤዝ ግንኙነት ስህተት ተከስቷል።');
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders, normalizeItem]);

  useEffect(() => {
    setFilter('all');
    fetchNotifications();
  }, [fetchNotifications]);

  const filters = ROLE_FILTERS[role] || ROLE_FILTERS.customer;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      const matchesSearch =
        !q ||
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      if (filter === 'stock') return n.type === 'stock' || n.type === 'inventory';
      return n.type === filter;
    });
  }, [notifications, search, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Reading a notification removes it from the list & deletes it on the server
  const markRead = async (item) => {
    const previous = notifications;
    const targetHref = resolveSidebarHref(item.link);

    setNotifications((prev) => prev.filter((n) => n.id !== item.id));

    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(previous);
      setError('ማሳወቂያውን ማስወገድ አልተቻለም።');
      return;
    }

    if (targetHref) {
      router.push(targetHref);
    }
  };

  // Marking all read removes all notifications from the list & clears them on the server
  const markAllRead = async () => {
    const previous = notifications;
    setNotifications([]);

    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(previous);
      setError('ሁሉንም ማሳወቂያዎች ማስወገድ አልተቻለም።');
    }
  };

  const removeOne = async (id) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(previous);
      setError('ማሳወቂያውን ማጥፋት አልተቻለም።');
    }
  };

  const clearAll = async () => {
    const previous = notifications;
    setNotifications([]);

    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifications(previous);
      setError('ማሳወቂያዎችን ማጽዳት አልተቻለም።');
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'አሁን';
    if (mins < 60) return `${mins} ደቂቃ በፊት`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ሰዓት በፊት`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ቀን በፊት`;
    return d.toLocaleDateString('am-ET');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-2 sm:px-0">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Bell size={19} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900">ማሳወቂያዎች</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-700 text-white">
                {unreadCount} አዲስ
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1.5 flex items-center gap-1.5">
            <Shield size={13} className="text-amber-700" />
            <span>ሚና:</span>
            <span className="font-semibold text-stone-700">{roleLabel}</span>
            <span>·</span>
            <span>ጠቅላላ: {notifications.length}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchNotifications({ isRefresh: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            አድስ
          </button>

          <button
            type="button"
            onClick={markAllRead}
            disabled={notifications.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={15} />
            ሁሉንም አንብብ እና አጽዳ
          </button>

          <button
            type="button"
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg bg-white text-red-700 border border-red-200 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            ሁሉንም አጥፋ
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-xs font-semibold underline shrink-0"
          >
            ዝጋ
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="በርዕስ ወይም በመልእክት ይፈልጉ..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-amber-600 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {filters.map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition ${
                  active
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                }`}
              >
                {FILTER_LABELS[key] || key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-xl bg-stone-100 border border-stone-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 py-14 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <Bell size={22} />
          </div>
          <p className="text-sm sm:text-base font-semibold text-stone-800">ምንም ማሳወቂያ አልተገኘም</p>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {search || filter !== 'all'
              ? 'የፍለጋ ቃሉን ወይም ማጣሪያውን ቀይረው ይሞክሩ።'
              : 'አዳዲስ ክንውኖች ሲፈጠሩ ማሳወቂያዎች እዚህ ይታያሉ።'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => {
            const typeMeta = TYPE_META[n.type] || TYPE_META.system;
            const TypeIcon = typeMeta.icon;
            const prioMeta = PRIORITY_META[n.priority] || PRIORITY_META.normal;
            const PrioIcon = prioMeta.icon;
            const targetHref = resolveSidebarHref(n.link);

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => markRead(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    markRead(n);
                  }
                }}
                className={`group relative flex items-start gap-3.5 rounded-xl border p-4 transition cursor-pointer ${
                  n.read
                    ? 'bg-white border-stone-200/80 hover:border-stone-300'
                    : 'bg-amber-50/40 border-amber-300/80 hover:border-amber-400'
                }`}
              >
                {!n.read && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-700 mt-2 shrink-0"
                    aria-label="ያልተነበበ"
                  />
                )}

                <div
                  className={`w-10 h-10 rounded-lg ${typeMeta.bg} ${typeMeta.color} flex items-center justify-center shrink-0`}
                >
                  <TypeIcon size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      className={`text-sm ${
                        n.read ? 'font-medium text-stone-700' : 'font-bold text-stone-900'
                      }`}
                    >
                      {n.title}
                    </h2>

                    {n.priority === 'high' && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${prioMeta.bg} ${prioMeta.color}`}
                      >
                        <PrioIcon size={11} />
                        {prioMeta.label}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex items-center gap-3 mt-2.5 text-xs text-stone-400">
                    <span>{formatTime(n.time)}</span>
                    {targetHref && (
                      <span className="inline-flex items-center gap-0.5 text-amber-800 font-semibold group-hover:underline">
                        ዝርዝር ይመልከቱ
                        <ArrowUpRight size={13} />
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeOne(n.id);
                  }}
                  title="አጥፋ"
                  aria-label="ማሳወቂያ አጥፋ"
                  className="p-2 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 transition shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}