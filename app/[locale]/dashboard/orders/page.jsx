'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, FileText, Clock, Package, CheckCircle2,
  DollarSign, Calendar, User, Phone, MapPin, Building2,
  Play, Truck, Wallet,
} from 'lucide-react';
import { formatETB } from '@/lib/utils';
import { ORDER_STATUS, ORDER_ITEM_TYPES } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

const ETHIOPIAN_TIME_ZONE = 'Africa/Addis_Ababa';

const ETHIOPIAN_MONTHS = [
  { value: 1,  label: 'መስከረም' },
  { value: 2,  label: 'ጥቅምት' },
  { value: 3,  label: 'ኅዳር' },
  { value: 4,  label: 'ታኅሣሥ' },
  { value: 5,  label: 'ጥር' },
  { value: 6,  label: 'የካቲት' },
  { value: 7,  label: 'መጋቢት' },
  { value: 8,  label: 'ሚያዝያ' },
  { value: 9,  label: 'ግንቦት' },
  { value: 10, label: 'ሰኔ' },
  { value: 11, label: 'ሐምሌ' },
  { value: 12, label: 'ነሐሴ' },
  { value: 13, label: 'ጳጉሜን' },
];

const ETHIOPIAN_WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatEthiopianDate(input, options = {}) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);

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

function toUtcNoonDate(isoStr) {
  if (!isoStr) return new Date(NaN);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoStr).trim());
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  }
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

function toIsoDateFromUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEthDateParts(isoStr) {
  const date = toUtcNoonDate(isoStr);
  if (Number.isNaN(date.getTime())) return null;

  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: ETHIOPIAN_TIME_ZONE,
    weekday: 'short',
  }).format(date);
  const dow = ETHIOPIAN_WEEKDAYS_EN.indexOf(weekdayStr);

  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (year && month && day) {
      return { year, month, day, dow: dow >= 0 ? dow : 0 };
    }
  } catch {
    // Fallback handled below
  }
  return null;
}

function ethToGregorianIso(ethYear, ethMonth, ethDay) {
  const isLeap = (ethYear + 1) % 4 === 0;
  const maxDay = ethMonth === 13 ? (isLeap ? 6 : 5) : 30;
  const clampedDay = Math.min(Math.max(1, ethDay), maxDay);

  // Approx Gregorian date in Addis Ababa for (ethYear, ethMonth, clampedDay)
  let gYear = ethYear + 7;
  let gMonth = ethMonth + 8;
  if (gMonth > 12) {
    gMonth -= 12;
    gYear += 1;
  }

  let candidate = new Date(Date.UTC(gYear, gMonth - 1, Math.min(clampedDay + 10, 28), 12, 0, 0));
  for (let i = -15; i <= 15; i++) {
    const test = new Date(candidate.getTime() + i * 86400000);
    const p = getEthDateParts(toIsoDateFromUtc(test));
    if (p && p.year === ethYear && p.month === ethMonth && p.day === clampedDay) {
      return toIsoDateFromUtc(test);
    }
  }
  return toIsoDateFromUtc(candidate);
}

function getEthMonthDays(ethYear, ethMonth) {
  const isLeap = (ethYear + 1) % 4 === 0;
  const totalDays = ethMonth === 13 ? (isLeap ? 6 : 5) : 30;
  const days = [];
  for (let d = 1; d <= totalDays; d++) {
    const iso = ethToGregorianIso(ethYear, ethMonth, d);
    const parts = getEthDateParts(iso);
    days.push({ day: d, iso, dow: parts ? parts.dow : 0 });
  }
  return days;
}

function EthiopianDateInput({ value, onChange, required = false }) {
  const initialParts = useMemo(() => {
    const p = getEthDateParts(value);
    return p || { year: 2019, month: 3, day: 13, dow: 0 };
  }, [value]);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  useEffect(() => {
    const p = getEthDateParts(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  const monthDays = useMemo(() => getEthMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const leadingBlanks = monthDays.length > 0 ? monthDays[0].dow : 0;

  const selectDate = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 flex items-center justify-between gap-2 text-left"
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value ? formatEthiopianDate(value) : 'የኢትዮጵያ ቀን ይምረጡ'}
        </span>
        <Calendar size={15} className="text-gray-400 flex-shrink-0" />
      </button>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ''}
          onChange={() => {}}
          required
          className="sr-only"
        />
      )}

      {open && (
        <div className="absolute z-30 mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {ETHIOPIAN_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value) || 2019)}
              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-gray-400 mb-1">
            <span>እሑድ</span>
            <span>ሰኞ</span>
            <span>ማክሰ</span>
            <span>ረቡዕ</span>
            <span>ሐሙስ</span>
            <span>ዓርብ</span>
            <span>ቅዳሜ</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: leadingBlanks }).map((_, idx) => (
              <span key={`b-${idx}`} />
            ))}
            {monthDays.map((d) => {
              const isSelected = value === d.iso;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => selectDate(d.iso)}
                  className={`h-7 w-full rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'bg-brand text-white font-bold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100 text-xs">
            <button
              type="button"
              onClick={() => selectDate(toIsoDateFromUtc(new Date()))}
              className="text-brand font-medium hover:underline"
            >
              ዛሬ
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ዝጋ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimum prepayment amount
const MIN_PREPAYMENT = 1000;

const NEXT_STATUS = {
  pending:        'in_production',
  in_production:  'ready',
  ready:          'picked_up',
};

const STAFF_ROLES = ['seller', 'cashier', 'storekeeper'];

export default function OrdersPage() {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isAdminActor = user?.role === 'admin' || user?.role === 'owner';
  const isStaffActor = STAFF_ROLES.includes(user?.role);
  const canManage = isAdminActor || isStaffActor;
  const userBranchId = user?.branch
    ? String(typeof user.branch === 'object' ? user.branch._id : user.branch)
    : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/orders').catch(() => []),
      apiFetch('/branches').catch(() => []),
    ])
      .then(([ords, brs]) => {
        if (!cancelled) {
          setOrders(Array.isArray(ords) ? ords : []);
          setBranches(Array.isArray(brs) ? brs : []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const roleFiltered = useMemo(() => {
    let result = orders;
    if (isStaffActor && userBranchId) {
      result = result.filter((o) => String(o.branch?._id || o.branch) === userBranchId);
    }
    if (user?.role === 'customer') {
      result = result.filter((o) => o.customerPhone === user.phone);
    }
    return result;
  }, [orders, user, isStaffActor, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((o) => {
      const q = search.toLowerCase();
      const matchSearch =
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.itemType || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchBranch = branchFilter === 'all' ||
        (o.branch?._id || o.branch) === branchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [roleFiltered, search, statusFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const pending = roleFiltered.filter((o) => o.status === 'pending').length;
    const inProduction = roleFiltered.filter((o) => o.status === 'in_production').length;
    const ready = roleFiltered.filter((o) => o.status === 'ready').length;
    const totalRevenue = roleFiltered.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const totalRemaining = roleFiltered.reduce((s, o) => s + (o.remainingPayment || 0), 0);
    return { total, pending, inProduction, ready, totalRevenue, totalRemaining };
  }, [roleFiltered]);

  const canActorModifyOrder = (order) => {
    if (!order) return canManage;
    if (isAdminActor) return true;
    if (!isStaffActor) return false;
    const orderBranchId = order.branch?._id ? String(order.branch._id) : order.branch ? String(order.branch) : null;
    if (userBranchId && orderBranchId) {
      return orderBranchId === userBranchId;
    }
    return true;
  };

  const handleDeleteClick = (order) => setDeleteTarget(order);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/orders/' + deleteTarget._id, { method: 'DELETE' });
      setOrders((prev) => prev.filter((o) => o._id !== deleteTarget._id));
      toast.success('ትዕዛዝ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingOrder) {
        const updated = await apiFetch('/orders/' + editingOrder._id, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setOrders((prev) => prev.map((o) => (o._id === editingOrder._id ? updated : o)));
        toast.success('ትዕዛዝ ተስተካክሏል');
      } else {
        const created = await apiFetch('/orders', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setOrders((prev) => [created, ...prev]);
        toast.success('ትዕዛዝ ተጨምሯል');
      }
      setShowModal(false);
      setEditingOrder(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  };

  const handleAddPayment = async (order, amount) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast.error('መጠን ያስገቡ'); return; }
    const remaining = Number(order.remainingPayment) || 0;
    if (amt > remaining) { toast.error('ከቀሪ መብለጥ አይችልም'); return; }

    const newPrepaid   = (Number(order.prepayment) || 0) + amt;
    const newRemaining = Math.max(0, (Number(order.totalPrice) || 0) - newPrepaid);
    try {
      const updated = await apiFetch('/orders/' + order._id, {
        method: 'PATCH',
        body: JSON.stringify({ prepayment: newPrepaid, remainingPayment: newRemaining }),
      });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? { ...o, ...updated } : o)));
      if (viewOrder && viewOrder._id === order._id) {
        setViewOrder({ ...viewOrder, ...updated });
      }
      toast.success(`${formatETB(amt)} ተቀብሏል`);
    } catch (err) {
      toast.error(err.message || 'ክፍያ መመዝገብ አልተሳካም');
    }
  };

  const handleAdvanceStatus = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) {
      toast.error('ይህ ትዕዛዝ የመጨረሻ ደረጃ ላይ ነው');
      return;
    }
    try {
      const updated = await apiFetch('/orders/' + order._id, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? updated : o)));
      if (viewOrder && viewOrder._id === order._id) {
        setViewOrder(updated);
      }
      toast.success('ሁኔታ ተቀይሯል: ' + (ORDER_STATUS[next]?.label || next));
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ትዕዛዞች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ትዕዛዞች · {formatETB(stats.totalRevenue)} ጠቅላላ ዋጋ · <span className="text-orange-600 font-medium">{formatETB(stats.totalRemaining)} ቀሪ</span>
          </p>
          {isStaffActor && user?.branch && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={() => { setEditingOrder(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ትዕዛዝ
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ትዕዛዞች" value={stats.total} icon={FileText} color="bg-blue-500" />
        <StatCard label="በመጠባበቅ" value={stats.pending} icon={Clock} color="bg-yellow-500" />
        <StatCard label="በምርት ላይ" value={stats.inProduction} icon={Play} color="bg-purple-500" />
        <StatCard label="ተዘጋጅቷል" value={stats.ready} icon={CheckCircle2} color="bg-green-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ትዕዛዝ፣ ደንበኛ፣ ስልክ፣ ዕቃ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
          >
            <option value="all">ሁሉም ሁኔታዎች</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>

          {isAdminActor ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
            >
              <option value="all">ሁሉም ቅርንጫፎች</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
              <Building2 size={14} />
              <span className="font-medium">
                {user?.branch ? (typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ') : 'ቅርንጫፍ'}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ትዕዛዝ ቁጥር</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ደንበኛ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ዕቃ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ብዛት</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ጠቅላላ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ቅድመ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ቀሪ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ሁኔታ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ቀጠሮ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <FileText size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">ምንም ትዕዛዝ አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' };
                  const rowCanModify = canActorModifyOrder(order);
                  return (
                    <tr key={order._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{order.customerName}</p>
                        <p className="text-xs text-gray-500">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {order.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{order.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatETB(order.totalPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {formatETB(order.prepayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RemainingCell
                          order={order}
                          onAdd={(amt) => handleAddPayment(order, amt)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatEthiopianDate(order.appointmentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewOrder(order)}
                          onEdit={() => { setEditingOrder(order); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(order)}
                          canEdit={rowCanModify}
                          canDelete={rowCanModify}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingOrder(null); }}
        title={editingOrder ? 'ትዕዛዝ አስተካክል' : 'አዲስ ትዕዛዝ'}
        size="lg"
      >
        <OrderForm
          order={editingOrder}
          branches={branches}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingOrder(null); }}
          currentUser={user}
        />
      </Modal>

      <Modal
        isOpen={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title="የትዕዛዝ ዝርዝር"
      >
        {viewOrder && (
          <OrderView
            order={viewOrder}
            onAdvanceStatus={() => handleAdvanceStatus(viewOrder)}
            onAddPayment={(amt) => handleAddPayment(viewOrder, amt)}
            canManage={canActorModifyOrder(viewOrder)}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ትዕዛዝ ይሰረዝ?"
        message="ይህን ትዕዛዝ መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.customerName}
        itemType={(deleteTarget?.orderNumber || '') + ' · ' + (deleteTarget?.itemType || '')}
        confirmLabel="አዎ፣ ሰርዝ"
        cancelLabel="ተወው"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div className={'p-2.5 rounded-lg ' + color}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

function RemainingCell({ order, onAdd }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = Number(order.remainingPayment) || 0;

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600">
        <CheckCircle2 size={10} /> ተከፍሏል
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-red-600 font-medium hover:text-red-800"
        title="ክፍያ መዝግብ"
      >
        {formatETB(remaining)}
        <Plus size={11} className="opacity-60" />
      </button>
    );
  }

  const handle = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > remaining) { toast.error('ትክክለኛ መጠን ያስገቡ'); return; }
    setBusy(true);
    try { await onAdd(amt); setOpen(false); setAmount(''); }
    finally { setBusy(false); }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="መጠን"
        min={0}
        max={remaining}
        step="0.01"
        className="w-20 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        autoFocus
      />
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="px-1.5 py-1 rounded bg-brand text-white text-xs disabled:opacity-50"
        title="አስቀምጥ"
      >✓</button>
      <button
        type="button"
        onClick={() => { setOpen(false); setAmount(''); }}
        className="px-1.5 py-1 rounded text-gray-400 hover:text-gray-600 text-xs"
        title="ሰርዝ"
      >✕</button>
    </div>
  );
}

// ============================================================
// Order form — with MANDATORY prepayment, minimum 1000 ETB
// ============================================================
function OrderForm({ order, branches, onSave, onCancel, currentUser }) {
  const isStaff = STAFF_ROLES.includes(currentUser?.role);

  const staffBranch = isStaff && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : '';

  const [form, setForm] = useState({
    customerName: order?.customerName || '',
    customerPhone: order?.customerPhone || '',
    address: order?.address || '',
    itemType: order?.itemType || 'ምጣድ',
    quantity: order?.quantity || 1,
    unitPrice: order?.unitPrice || 0,
    prepayment: order?.prepayment || 0,
    status: order?.status || 'pending',
    orderDate: order?.orderDate
      ? new Date(order.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    appointmentDate: order?.appointmentDate
      ? new Date(order.appointmentDate).toISOString().split('T')[0]
      : '',
    note: order?.note || '',
    branch: order?.branch?._id || order?.branch || staffBranch,
    measurements: order?.measurements || { width: '', height: '', depth: '', unit: 'cm' },
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: ['quantity', 'unitPrice', 'prepayment'].includes(name) ? Number(value) : value,
    });
  };

  const onMeasurementChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      measurements: { ...form.measurements, [name]: value },
    });
  };

  const totalPrice = form.quantity * form.unitPrice;
  const remainingPayment = Math.max(totalPrice - form.prepayment, 0);

  // Show inline error if prepayment < MIN_PREPAYMENT
  const prepaymentError = form.prepayment < MIN_PREPAYMENT
    ? `ቅድመ ክፍያ ቢያንስ ${formatETB(MIN_PREPAYMENT)} መሆን አለበት`
    : form.prepayment > totalPrice
      ? 'ቅድመ ክፍያ ከጠቅላላ ዋጋ መብለጥ አይችልም'
      : null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.itemType.trim()) {
      toast.error('የዕቃ ዓይነት ያስገቡ');
      return;
    }

    // ---- Prepayment validation ----
    if (!form.prepayment || form.prepayment < MIN_PREPAYMENT) {
      toast.error(`ቅድመ ክፍያ ቢያንስ ${formatETB(MIN_PREPAYMENT)} መሆን አለበት`);
      return;
    }
    if (form.prepayment > totalPrice) {
      toast.error('ቅድመ ክፍያ ከጠቅላላ ዋጋ መብለጥ አይችልም');
      return;
    }

    onSave({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      address: form.address,
      itemType: form.itemType.trim(),
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      totalPrice,
      prepayment: form.prepayment,
      remainingPayment,
      status: form.status,
      orderDate: form.orderDate,
      appointmentDate: form.appointmentDate,
      note: form.note || undefined,
      branch: form.branch || null,
      measurements: form.measurements,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <User size={14} /> የደንበኛ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ስም *">
            <input name="customerName" value={form.customerName} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ስልክ *">
            <input name="customerPhone" value={form.customerPhone} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="አድራሻ *" full>
            <input name="address" value={form.address} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
        </div>
      </div>

      {/* Order info */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <FileText size={14} /> የትዕዛዝ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="የዕቃ ዓይነት *">
            <input
              type="text"
              name="itemType"
              list="order-item-types"
              value={form.itemType}
              onChange={onChange}
              required
              placeholder="የዕቃ ዓይነት ያስገቡ..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
            <datalist id="order-item-types">
              {ORDER_ITEM_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </FormField>

          <FormField label="ሁኔታ">
            <select
              name="status"
              value={form.status}
              onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            >
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label || v}</option>
              ))}
            </select>
          </FormField>

          <FormField label="ብዛት *">
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={onChange}
              required
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>

          <FormField label="የአንዱ ዋጋ (ETB) *">
            <input
              type="number"
              name="unitPrice"
              value={form.unitPrice}
              onChange={onChange}
              required
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>

          <FormField label={`ቅድመ ክፍያ (ETB) * (ቢያንስ ${formatETB(MIN_PREPAYMENT)})`}>
            <input
              type="number"
              name="prepayment"
              value={form.prepayment}
              onChange={onChange}
              required
              min={MIN_PREPAYMENT}
              max={totalPrice || undefined}
              className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 ${
                prepaymentError ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {prepaymentError && (
              <p className="text-xs text-red-600 mt-1">{prepaymentError}</p>
            )}
          </FormField>

          <FormField label="ቅርንጫፍ">
            <select
              name="branch"
              value={form.branch}
              onChange={onChange}
              disabled={isStaff && Boolean(staffBranch)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 disabled:bg-gray-100"
            >
              <option value="">— ይምረጡ —</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="የትዕዛዝ ቀን">
            <EthiopianDateInput
              value={form.orderDate}
              onChange={(iso) => setForm((prev) => ({ ...prev, orderDate: iso }))}
            />
          </FormField>

          <FormField label="የቀጠሮ ቀን *">
            <EthiopianDateInput
              value={form.appointmentDate}
              onChange={(iso) => setForm((prev) => ({ ...prev, appointmentDate: iso }))}
              required
            />
          </FormField>
        </div>
      </div>

      {/* Measurements */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Package size={14} /> ልኬት
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="ስፋት">
            <input
              name="width"
              value={form.measurements?.width || ''}
              onChange={onMeasurementChange}
              placeholder="cm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>
          <FormField label="ቁመት">
            <input
              name="height"
              value={form.measurements?.height || ''}
              onChange={onMeasurementChange}
              placeholder="cm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>
          <FormField label="ጥልቀት">
            <input
              name="depth"
              value={form.measurements?.depth || ''}
              onChange={onMeasurementChange}
              placeholder="cm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>
          <FormField label="መለኪያ">
            <input
              name="unit"
              value={form.measurements?.unit || 'cm'}
              onChange={onMeasurementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </FormField>
        </div>
      </div>

      {/* Note */}
      <FormField label="ማስታወሻ" full>
        <textarea
          name="note"
          value={form.note}
          onChange={onChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
        />
      </FormField>

      {/* Price Summary */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <span className="text-gray-500">ጠቅላላ ዋጋ: </span>
          <span className="font-bold text-gray-800">{formatETB(totalPrice)}</span>
        </div>
        <div>
          <span className="text-gray-500">ቅድመ ክፍያ: </span>
          <span className="font-semibold text-green-600">{formatETB(form.prepayment || 0)}</span>
        </div>
        <div>
          <span className="text-gray-500">ቀሪ ሂሳብ: </span>
          <span className="font-bold text-red-600">{formatETB(remainingPayment)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          ሰርዝ
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition"
        >
          {order ? 'አስተካክል' : 'ጨምር'}
        </button>
      </div>
    </form>
  );
}

function OrderView({ order, onAdvanceStatus, onAddPayment, canManage }) {
  const [payAmount, setPayAmount] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' };
  const nextStatusKey = NEXT_STATUS[order.status];
  const nextStatusLabel = nextStatusKey ? (ORDER_STATUS[nextStatusKey]?.label || nextStatusKey) : null;
  const remaining = Number(order.remainingPayment) || 0;

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error('መጠን ያስገቡ');
      return;
    }
    setSubmittingPay(true);
    try {
      await onAddPayment(amt);
      setPayAmount('');
    } finally {
      setSubmittingPay(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <p className="font-mono text-xs text-brand font-semibold">{order.orderNumber}</p>
          <p className="font-bold text-gray-800 text-lg mt-0.5">{order.customerName}</p>
          <p className="text-xs text-gray-500">{order.customerPhone}</p>
        </div>
        <Badge color={status.color}>{status.label}</Badge>
      </div>

      <div className="space-y-2.5">
        <Row label="አድራሻ" value={order.address || '-'} />
        <Row label="የዕቃ ዓይነት" value={order.itemType} />
        <Row label="ብዛት" value={order.quantity} bold />
        <Row label="የአንዱ ዋጋ" value={formatETB(order.unitPrice || 0)} />
        <Row label="ጠቅላላ ዋጋ" value={formatETB(order.totalPrice || 0)} bold />
        <Row label="ቅድመ ክፍያ" value={formatETB(order.prepayment || 0)} color="text-green-600" bold />
        <Row label="ቀሪ ሂሳብ" value={formatETB(remaining)} color={remaining > 0 ? 'text-red-600' : 'text-green-600'} bold />
        <Row label="የትዕዛዝ ቀን" value={formatEthiopianDate(order.orderDate)} />
        <Row label="የቀጠሮ ቀን" value={formatEthiopianDate(order.appointmentDate)} />
        <Row label="ቅርንጫፍ" value={order.branch?.name || '-'} />
        {order.note && <Row label="ማስታወሻ" value={order.note} />}
      </div>

      {canManage && remaining > 0 && (
        <form onSubmit={handlePaySubmit} className="pt-3 border-t border-gray-100 flex items-center gap-2">
          <input
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="ተጨማሪ ክፍያ (ETB)"
            min={1}
            max={remaining}
            step="0.01"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button type="submit" disabled={submittingPay}>
            <Wallet size={15} /> ክፍያ መዝግብ
          </Button>
        </form>
      )}

      {canManage && nextStatusLabel && (
        <div className="pt-3 border-t border-gray-100">
          <Button
            type="button"
            onClick={onAdvanceStatus}
            className="w-full justify-center"
          >
            <Truck size={16} /> ወደ "{nextStatusLabel}" አሸጋግር
          </Button>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value, mono, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''} ${color || 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}