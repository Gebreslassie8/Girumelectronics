'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, Wallet, DollarSign, Calendar,
  Banknote, Building2, Loader2, ArrowLeftRight,
} from 'lucide-react';
import { formatETB } from '@/lib/utils';
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

const VALID_CATEGORIES = [
  'purchase',
  'salary',
  'rent',
  'utilities',
  'transport',
  'maintenance',
  'marketing',
  'other',
];

const formatEthiopianDate = (date) => {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch (e) {
    return d.toLocaleDateString('am-ET', { timeZone: ETHIOPIAN_TIME_ZONE });
  }
};

function toUtcNoonDate(isoStr) {
  if (!isoStr) return new Date(NaN);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoStr).trim());
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return new Date(NaN);
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
  if (isNaN(date.getTime())) return null;

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
  } catch (e) {
    // Fallback handled below
  }
  return null;
}

function ethToGregorianIso(ethYear, ethMonth, ethDay) {
  const isLeap = (ethYear + 1) % 4 === 0;
  const maxDay = ethMonth === 13 ? (isLeap ? 6 : 5) : 30;
  const clampedDay = Math.min(Math.max(1, ethDay), maxDay);

  let gYear = ethYear + 7;
  let gMonth = ethMonth + 8;
  if (gMonth > 12) {
    gMonth -= 12;
    gYear += 1;
  }

  const candidate = new Date(Date.UTC(gYear, gMonth - 1, Math.min(clampedDay + 10, 28), 12, 0, 0));
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
        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white hover:border-sky-300 hover:bg-sky-50/50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm text-gray-800 flex items-center justify-between gap-2 text-left transition"
      >
        <span className={value ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {value ? formatEthiopianDate(`${value}T12:00:00`) : 'የኢትዮጵያ ቀን ይምረጡ'}
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
        <div className="absolute z-30 mt-1.5 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {ETHIOPIAN_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value) || 2019)}
              className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand"
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
                      ? 'bg-brand text-white font-bold shadow-sm'
                      : 'text-gray-700 hover:bg-sky-50 hover:text-sky-700'
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
              className="text-brand font-semibold hover:underline"
            >
              ዛሬ
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              ዝጋ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const T = {
  expenses:          'ወጪዎች',
  total:             'ጠቅላላ',
  totalAmount:       'ጠቅላላ ወጪ',
  newExpense:        'አዲስ ወጪ',
  cash:              'ጥሬ ገንዘብ',
  transfer:          'ዝውውር',
  nonCash:           'ያልሆነ ጥሬ',
  search:            'ፈልግ (የባለቤት ስም፣ ምክንያት)...',
  allReasons:        'ሁሉም ምክንያት',
  allPayments:       'ሁሉም የክፍያ ዘዴዎች',
  allBranches:       'ሁሉም ቅርንጫፎች',
  branch:            'ቅርንጫፍ',
  ownerName:         'የባለቤት ስም',
  reason:            'የተከፈለበት ምክንያት',
  amount:            'መጠን',
  paymentMethod:     'የክፍያ ዘዴ',
  date:              'ቀን',
  action:            'ተግባር',
  noData:            'ምንም ወጪ አልተገኘም',
  loading:           'በመጫን ላይ...',
  error:             'ስህተት ተፈጥሯል',
  retry:             'እንደገና ሞክር',
  ownerPlaceholder:  'ምሳሌ፡ አበበ ከበደ',
  reasonPlaceholder: 'ምሳሌ፡ የቢሮ ኪራይ ወይም ደመወዝ',
  cancel:            'ሰርዝ',
  save:              'ገምር',
  update:            'አስተካክል',
  deleteTitle:       'ወጪ ይሰረዝ?',
  deleteMsg:         'ይህን ወጪ መሰረዝ ይፈልጋሉ?',
  confirmDelete:     'አዎ፣ ሰርዝ',
  keep:              'ተወው',
  branchReq:         'ቅርንጫፍ ይምረጡ',
  successAdd:        'ወጪ ተጨምሯል',
  successUpdate:     'ወጪ ተስተካክሏል',
  successDelete:     'ወጪ ተሰርዟል',
  createErr:         'ስህተት ተፈጥሯል',
  branchNotFound:    'ቅርንጫፍ ዝርዝር አልተገኘም — /api/branches ያስፈልጋል',
};

const PAYMENT_METHODS = {
  cash: { label: 'ጥሬ ገንዘብ', color: 'green' },
  bank: { label: 'ዝውውር',     color: 'blue'  },
};

function inferCategoryFromReason(rawReason) {
  const lower = String(rawReason || '').trim().toLowerCase();
  if (VALID_CATEGORIES.includes(lower)) return lower;
  if (lower.includes('salary') || lower.includes('ደመወዝ')) return 'salary';
  if (lower.includes('rent') || lower.includes('ኪራይ')) return 'rent';
  if (lower.includes('util') || lower.includes('ኤሌክትሪክ') || lower.includes('ውሃ') || lower.includes('መብራት')) return 'utilities';
  if (lower.includes('trans') || lower.includes('ትራንስፖርት') || lower.includes('ነዳጅ')) return 'transport';
  if (lower.includes('maint') || lower.includes('ጥገና')) return 'maintenance';
  if (lower.includes('market') || lower.includes('ማስታወቂያ')) return 'marketing';
  if (lower.includes('purch') || lower.includes('ግዢ') || lower.includes('ዕቃ')) return 'purchase';
  return 'other';
}

function normalizePaymentMethod(method) {
  if (method === 'cash') return 'cash';
  if (['bank', 'transfer', 'ዝውውር'].includes(method)) return 'bank';
  return 'other';
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = ['admin', 'owner', 'seller'].includes(user?.role);
  const canDelete = ['admin', 'owner','seller'].includes(user?.role);
  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return typeof user.branch === 'object' ? user.branch._id : user.branch;
  }, [user]);

  const loadExpenses = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiFetch('/expenses');
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err?.message || T.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, []);
  useEffect(() => {
    apiFetch('/branches').then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => setBranches([]));
  }, []);

  const roleFiltered = useMemo(() => {
    if (user?.role !== 'seller' || !userBranchId) return expenses;
    return expenses.filter((e) => {
      const bid = typeof e.branch === 'object' ? e.branch?._id : e.branch;
      return String(bid) === String(userBranchId);
    });
  }, [expenses, user, userBranchId]);

  const uniqueReasons = useMemo(() => {
    const s = new Set(roleFiltered.map((e) => e.description || e.reason || e.category).filter(Boolean));
    return [...s];
  }, [roleFiltered]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((e) => {
      const q = search.toLowerCase();
      const ownerVal = (e.paidTo || e.ownerName || '').toLowerCase();
      const reasonVal = (e.description || e.reason || e.category || '').toLowerCase();
      const matchSearch = ownerVal.includes(q) || reasonVal.includes(q);
      const pm = normalizePaymentMethod(e.paymentMethod);
      const matchPayment = paymentFilter === 'all' || pm === paymentFilter;
      const reasonLabel = e.description || e.reason || e.category || '';
      const matchReason = reasonFilter === 'all' || reasonLabel === reasonFilter;
      const bid = typeof e.branch === 'object' ? e.branch?._id : e.branch;
      const matchBranch = branchFilter === 'all' || String(bid) === String(branchFilter);
      return matchSearch && matchPayment && matchReason && matchBranch;
    });
  }, [roleFiltered, search, paymentFilter, reasonFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const totalAmount = roleFiltered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const cashTotal = roleFiltered
      .filter((e) => normalizePaymentMethod(e.paymentMethod) === 'cash')
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { total, totalAmount, cashTotal, nonCashTotal: totalAmount - cashTotal };
  }, [roleFiltered]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingExpense) {
        const updated = await apiFetch(`/expenses/${editingExpense._id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });

        const matchedBranch =
          branches.find((b) => String(b._id) === String(updated?.branch?._id || updated?.branch || data.branch)) ||
          (typeof updated?.branch === 'object' ? updated.branch : null) ||
          editingExpense.branch;

        const normalizedUpdated = {
          ...editingExpense,
          ...updated,
          branch: matchedBranch || updated?.branch || data.branch,
        };

        setExpenses((prev) =>
          prev.map((e) => (e._id === editingExpense._id ? normalizedUpdated : e))
        );
        toast.success(T.successUpdate);
      } else {
        const created = await apiFetch('/expenses', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        const matchedBranch =
          branches.find((b) => String(b._id) === String(created?.branch?._id || created?.branch || data.branch)) ||
          (typeof created?.branch === 'object' ? created.branch : null);

        setExpenses((prev) => [
          { ...created, branch: matchedBranch || created?.branch || data.branch },
          ...prev,
        ]);
        toast.success(T.successAdd);
      }
      setShowModal(false);
      setEditingExpense(null);
    } catch (err) {
      toast.error(err?.message || T.createErr);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/expenses/${deleteTarget._id}`, { method: 'DELETE' });
      setExpenses((prev) => prev.filter((e) => e._id !== deleteTarget._id));
      toast.success(T.successDelete);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.message || T.createErr);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{T.expenses}</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} {T.expenses} · {formatETB(stats.totalAmount)} {T.total}</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingExpense(null); setShowModal(true); }}>
            <Plus size={18} /> {T.newExpense}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={T.total} value={stats.total} icon={Wallet} color="bg-blue-500" />
        <StatCard label={T.totalAmount} value={formatETB(stats.totalAmount)} icon={DollarSign} color="bg-red-500" />
        <StatCard label={T.cash} value={formatETB(stats.cashTotal)} icon={Banknote} color="bg-green-500" />
        <StatCard label={T.nonCash} value={formatETB(stats.nonCashTotal)} icon={ArrowLeftRight} color="bg-purple-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={T.search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">{T.allReasons}</option>
            {uniqueReasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">{T.allPayments}</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {['admin', 'owner'].includes(user?.role) ? (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="all">{T.allBranches}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
              <Building2 size={14} />
              <span className="font-medium truncate">
                {user?.branch ? (typeof user.branch === 'object' ? user.branch.name : T.branch) : T.branch}
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.ownerName}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.reason}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{T.amount} (ETB)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{T.paymentMethod}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.branch}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.date}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{T.action}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <Loader2 size={28} className="animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{T.loading}</p>
                </td></tr>
              ) : fetchError ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <p className="text-sm text-red-600 font-medium">{T.error}</p>
                  <p className="text-xs text-gray-500 mt-1">{fetchError}</p>
                  <button onClick={loadExpenses} className="mt-3 px-3 py-1.5 text-xs bg-brand text-white rounded-lg">{T.retry}</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <Wallet size={28} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">{T.noData}</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map((expense) => {
                  const pmKey = normalizePaymentMethod(expense.paymentMethod);
                  const payment = PAYMENT_METHODS[pmKey] || { label: expense.paymentMethod, color: 'gray' };
                  const ownerText = expense.paidTo || expense.ownerName || '-';
                  const reasonText = expense.description || expense.reason || expense.category || '-';
                  return (
                    <tr key={expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{ownerText}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{reasonText}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatETB(expense.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge color={payment.color}>{payment.label}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{expense.branch?.name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatEthiopianDate(expense.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewExpense(expense)}
                          onEdit={() => { setEditingExpense(expense); setShowModal(true); }}
                          onDelete={() => setDeleteTarget(expense)}
                          canEdit={canManage}
                          canDelete={canDelete}
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingExpense(null); }}
        title={editingExpense ? T.update : T.newExpense} size="md">
        <ExpenseForm expense={editingExpense} onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingExpense(null); }}
          currentUser={user} branches={branches} saving={saving} />
      </Modal>

      <Modal isOpen={!!viewExpense} onClose={() => setViewExpense(null)} title={T.expenses} size="md">
        {viewExpense && <ExpenseView expense={viewExpense} />}
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} title={T.deleteTitle} message={T.deleteMsg}
        itemName={deleteTarget?.paidTo || deleteTarget?.ownerName || deleteTarget?.description || deleteTarget?.reason}
        itemType={`${deleteTarget ? formatETB(deleteTarget.amount) : ''}`}
        confirmLabel={T.confirmDelete} cancelLabel={T.keep}
        loading={deleting} variant="danger" />
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
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

function ExpenseForm({ expense, onSave, onCancel, currentUser, branches, saving }) {
  const isSeller = currentUser?.role === 'seller';
  const userBranchId = isSeller && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : null;
  const defaultBranch = userBranchId
    || (expense?.branch && (typeof expense.branch === 'object' ? expense.branch._id : expense.branch))
    || branches[0]?._id || '';

  const [form, setForm] = useState({
    ownerName: expense?.paidTo || expense?.ownerName || '',
    amount: expense?.amount ?? '',
    reason: expense?.description || expense?.reason || (expense?.category && expense.category !== 'other' ? expense.category : '') || '',
    paymentMethod: normalizePaymentMethod(expense?.paymentMethod) === 'cash' ? 'cash' : 'bank',
    expenseDate: expense?.expenseDate ? String(expense.expenseDate).slice(0, 10) : new Date().toISOString().split('T')[0],
    branch: defaultBranch,
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.branch) {
      toast.error(T.branchReq);
      return;
    }
    const cleanReason = form.reason.trim();
    onSave({
      paidTo: form.ownerName.trim(),
      ownerName: form.ownerName.trim(),
      amount: Number(form.amount),
      category: inferCategoryFromReason(cleanReason),
      description: cleanReason || undefined,
      reason: cleanReason || undefined,
      paymentMethod: form.paymentMethod,
      expenseDate: form.expenseDate,
      branch: form.branch,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label={T.ownerName + ' *'}>
        <input
          name="ownerName"
          value={form.ownerName}
          onChange={onChange}
          required
          placeholder={T.ownerPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
      </FormField>

      <FormField label={T.amount + ' (ETB) *'}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">ETB</span>
          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={onChange}
            required
            min={0}
            step="0.01"
            placeholder="0.00"
            className="w-full pl-14 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>
      </FormField>

      <FormField label={T.reason}>
        <input
          name="reason"
          value={form.reason}
          onChange={onChange}
          placeholder={T.reasonPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
      </FormField>

      <FormField label={T.paymentMethod + ' *'}>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, paymentMethod: key }))}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 font-medium text-sm transition ${
                form.paymentMethod === key
                  ? 'border-sky-500 bg-sky-50/90 text-sky-700 shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700'
              }`}
            >
              {key === 'cash' ? <Banknote size={16} /> : <ArrowLeftRight size={16} />}
              {val.label}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label={T.date + ' *'}>
        <EthiopianDateInput
          value={form.expenseDate}
          onChange={(val) => setForm((f) => ({ ...f, expenseDate: val }))}
          required
        />
      </FormField>

      <FormField label={T.branch + ' *'}>
        {isSeller ? (
          <div className="w-full px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium">
            {typeof currentUser.branch === 'object' ? currentUser.branch?.name : T.branch}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-xs text-red-600">{T.branchNotFound}</div>
        ) : (
          <select
            name="branch"
            value={form.branch}
            onChange={onChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          >
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
      </FormField>

      <div className="flex gap-2.5 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition"
        >
          {T.cancel}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark disabled:opacity-50 flex items-center justify-center gap-2 transition"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {expense ? T.update : T.save}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ExpenseView({ expense }) {
  const pmKey = normalizePaymentMethod(expense.paymentMethod);
  const payment = PAYMENT_METHODS[pmKey] || { label: expense.paymentMethod, color: 'gray' };
  const ownerText = expense.paidTo || expense.ownerName || '-';
  const reasonText = expense.description || expense.reason || expense.category || '-';

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50/70 border border-red-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Wallet size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">{T.ownerName}</p>
            <p className="font-bold text-gray-900 text-lg truncate">{ownerText}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500">{T.amount}</p>
          <p className="font-extrabold text-red-600 text-lg">{formatETB(expense.amount)}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">{T.reason}:</span>
          <span className="font-semibold text-gray-800 text-right">{reasonText}</span>
        </div>
        <div className="flex justify-between gap-3 items-center">
          <span className="text-gray-500">{T.paymentMethod}:</span>
          <Badge color={payment.color}>{payment.label}</Badge>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">{T.branch}:</span>
          <span className="font-medium text-gray-800">{expense.branch?.name || '-'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">{T.date}:</span>
          <span className="font-medium text-gray-800">{formatEthiopianDate(expense.expenseDate)}</span>
        </div>
        {expense.recordedBy?.fullName && (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">መዝጋቢ:</span>
            <span className="font-medium text-gray-800">{expense.recordedBy.fullName}</span>
          </div>
        )}
      </div>
    </div>
  );
}