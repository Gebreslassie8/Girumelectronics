'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, FileText, CheckCircle2, Clock,
  User, Calendar, Building2, DollarSign,
  Printer, Download,
} from 'lucide-react';
import { formatETB } from '@/lib/utils';
import { RECEIPT_STATUS, DEFAULT_RECEIPT_NOTE } from '@/lib/constants';
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
        className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm text-gray-800 flex items-center justify-between gap-2 text-left transition"
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

export default function ReceiptsPage() {
  const { user } = useAuth();

  const [receipts, setReceipts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'seller';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/receipts').catch(() => []),
      apiFetch('/branches').catch(() => []),
    ])
      .then(([recs, brs]) => {
        if (!cancelled) {
          setReceipts(Array.isArray(recs) ? recs : []);
          setBranches(Array.isArray(brs) ? brs : []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return typeof user.branch === 'object' ? user.branch._id : user.branch;
  }, [user]);

  const roleFiltered = useMemo(() => {
    let result = receipts;
    if (user?.role === 'seller' && userBranchId) {
      result = result.filter((r) => (r.branch?._id || r.branch) === userBranchId);
    }
    if (user?.role === 'customer') {
      result = result.filter((r) => r.customerPhone === user.phone);
    }
    return result;
  }, [receipts, user, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        (r.receiptNumber || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.customerPhone || '').includes(q) ||
        (r.order?.orderNumber || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchBranch = branchFilter === 'all' ||
        (r.branch?._id || r.branch) === branchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [roleFiltered, search, statusFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const active = roleFiltered.filter((r) => r.status === 'active').length;
    const completed = roleFiltered.filter((r) => r.status === 'completed').length;
    const totalPrepaid = roleFiltered.reduce((s, r) => s + (r.prepayment || 0), 0);
    const totalRemaining = roleFiltered.reduce((s, r) => s + (r.remainingPayment || 0), 0);
    return { total, active, completed, totalPrepaid, totalRemaining };
  }, [roleFiltered]);

  const handleDeleteClick = (receipt) => setDeleteTarget(receipt);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/receipts/' + deleteTarget._id, { method: 'DELETE' });
      setReceipts((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      toast.success('ደረሰኝ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingReceipt) {
        const updated = await apiFetch('/receipts/' + editingReceipt._id, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setReceipts((prev) => prev.map((r) => (r._id === editingReceipt._id ? updated : r)));
        toast.success('ደረሰኝ ተስተካክሏል');
      } else {
        const created = await apiFetch('/receipts', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setReceipts((prev) => [created, ...prev]);
        toast.success('ደረሰኝ ተፈጥሯል');
      }
      setShowModal(false);
      setEditingReceipt(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  };

  const printOrDownloadPDF = (receipt) => {
    const html = buildReceiptHTML(receipt, true);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = html;

    iframe.onload = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow.document;

        const fontLinks = document.querySelectorAll('link[rel="stylesheet"], style');
        fontLinks.forEach((node) => {
          if (node.tagName === 'LINK') {
            const clone = node.cloneNode();
            iframeDoc.head.appendChild(clone);
          } else if (node.tagName === 'STYLE') {
            const clone = node.cloneNode(true);
            iframeDoc.head.appendChild(clone);
          }
        });

        iframeWindow.focus();
        iframeWindow.print();

        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 60000);
      } catch (err) {
        console.error('[printPDF]', err);
        toast.error('PDF ማውጣት አልተሳካም');
        if (iframe.parentNode) document.body.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
  };

  const handlePrint = (receipt) => printOrDownloadPDF(receipt);
  const handleDownload = (receipt) => printOrDownloadPDF(receipt);

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-500">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">በመጫን ላይ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center rounded-2xl bg-red-50/60 border border-red-100">
        <p className="text-red-600 font-semibold">ስህተት ተፈጥሯል</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">ደረሰኞች</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
            <span>{filtered.length} ደረሰኞች</span>
            <span>·</span>
            <span className="font-semibold text-emerald-700">{formatETB(stats.totalPrepaid)} የተከፈለ</span>
            {user?.role === 'seller' && userBranchId && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand/5 px-2 py-0.5 rounded-full">
                  <Building2 size={12} />
                  {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
                </span>
              </>
            )}
            {user?.role === 'customer' && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand/5 px-2 py-0.5 rounded-full">
                  <User size={12} />
                  የእኔ ደረሰኞች
                </span>
              </>
            )}
          </div>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingReceipt(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ደረሰኝ
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ደረሰኞች" value={stats.total} icon={FileText} color="bg-blue-600" />
        <StatCard label="ንቁ" value={stats.active} icon={Clock} color="bg-emerald-600" />
        <StatCard label="ተጠናቋል" value={stats.completed} icon={CheckCircle2} color="bg-indigo-600" />
        <StatCard label="የተከፈለ" value={formatETB(stats.totalPrepaid)} icon={DollarSign} color="bg-amber-600" />
      </div>

      <Card padding="sm" className="rounded-2xl border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ደረሰኝ፣ ደንበኛ፣ ስልክ፣ ትዕዛዝ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm text-gray-800 transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm bg-white text-gray-800 transition"
          >
            <option value="all">ሁሉም ሁኔታዎች</option>
            {Object.entries(RECEIPT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>

          {user?.role === 'admin' ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm bg-white text-gray-800 transition"
            >
              <option value="all">ሁሉም ቅርንጫፎች</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-blue-50/80 border border-blue-100 text-blue-700 text-sm flex items-center gap-2">
              <Building2 size={14} />
              <span className="font-medium truncate">
                {user?.branch
                  ? (typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ')
                  : 'ሁሉም ቅርንጫፎች'}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none" className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/90 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">ደረሰኝ ቁጥር</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">ደንበኛ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">ዕቃ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">ጠቅላላ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">ቅድመ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">ቀሪ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">ሁኔታ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">ቀን</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">ተግባር</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14">
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <FileText size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm font-medium">
                        {user?.role === 'customer' ? 'የእርስዎ ደረሰኝ የለም' : 'ምንም ደረሰኝ አልተገኘም'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((receipt) => {
                  const status = RECEIPT_STATUS[receipt.status] || { label: receipt.status, color: 'gray' };
                  return (
                    <tr key={receipt._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-semibold">
                        {receipt.receiptNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{receipt.customerName}</p>
                        <p className="text-xs text-gray-500">{receipt.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {receipt.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatETB(receipt.totalPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {formatETB(receipt.prepayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold">
                        {formatETB(receipt.remainingPayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatEthiopianDate(receipt.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewReceipt(receipt)}
                          onEdit={() => { setEditingReceipt(receipt); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(receipt)}
                          canEdit={canManage}
                          canDelete={canManage}
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
        onClose={() => { setShowModal(false); setEditingReceipt(null); }}
        title={editingReceipt ? 'ደረሰኝ አስተካክል' : 'አዲስ ደረሰኝ'}
        size="lg"
      >
        <ReceiptForm
          receipt={editingReceipt}
          branches={branches}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingReceipt(null); }}
          currentUser={user}
        />
      </Modal>

      <Modal
        isOpen={!!viewReceipt}
        onClose={() => setViewReceipt(null)}
        title="የደረሰኝ ዝርዝር"
        size="md"
      >
        {viewReceipt && (
          <ReceiptView
            receipt={viewReceipt}
            onPrint={() => handlePrint(viewReceipt)}
            onDownload={() => handleDownload(viewReceipt)}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ደረሰኝ ይሰረዝ?"
        message="ይህን ደረሰኝ መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.customerName}
        itemType={(deleteTarget?.receiptNumber || '') + ' · ' + (deleteTarget?.itemType || '')}
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
    <Card padding="sm" className="rounded-2xl border-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
        </div>
        <div className={'p-2.5 rounded-xl flex-shrink-0 shadow-sm ' + color}>
          <Icon size={19} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

function ReceiptForm({ receipt, branches, onSave, onCancel, currentUser }) {
  const isSeller = currentUser?.role === 'seller';

  const defaultBranch = isSeller && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : (receipt?.branch?._id || receipt?.branch || '');

  const [form, setForm] = useState({
    orderNumber: receipt?.order?.orderNumber || '',
    productCode: receipt?.productCode || '',
    itemType: receipt?.itemType || 'ምጣድ',
    customerName: receipt?.customerName || '',
    customerPhone: receipt?.customerPhone || '',
    prepayment: receipt?.prepayment || 0,
    totalPrice: receipt?.totalPrice || 0,
    orderDate: receipt?.orderDate
      ? new Date(receipt.orderDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    appointmentDate: receipt?.appointmentDate
      ? new Date(receipt.appointmentDate).toISOString().split('T')[0]
      : '',
    note: receipt?.note || DEFAULT_RECEIPT_NOTE,
    status: receipt?.status || 'active',
    branch: defaultBranch,
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: ['prepayment', 'totalPrice'].includes(name) ? Number(value) : value,
    });
  };

  const remaining = Math.max((Number(form.totalPrice) || 0) - (Number(form.prepayment) || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(form.prepayment) > Number(form.totalPrice)) {
      toast.error('ቅድመ ክፍያ ከጠቅላላ ዋጋ መብለጥ አይችልም');
      return;
    }
    onSave({
      productCode: form.productCode || undefined,
      itemType: form.itemType,
      customerName: form.customerName,
      customerPhone: form.customerPhone || undefined,
      prepayment: Number(form.prepayment) || 0,
      remainingPayment: remaining,
      totalPrice: Number(form.totalPrice) || 0,
      orderDate: form.orderDate,
      appointmentDate: form.appointmentDate,
      note: form.note,
      status: form.status,
      branch: form.branch || null,
      orderNumber: form.orderNumber || undefined,
    });
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm text-gray-800 bg-white transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5 flex items-center gap-1.5">
          <User size={14} className="text-brand" /> የደንበኛ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ስም *">
            <input name="customerName" value={form.customerName} onChange={onChange} required className={inputClass} />
          </FormField>
          <FormField label="ስልክ">
            <input name="customerPhone" value={form.customerPhone} onChange={onChange} className={inputClass} />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5 flex items-center gap-1.5">
          <FileText size={14} className="text-brand" /> የትዕዛዝ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="የትዕዛዝ ቁጥር">
            <input name="orderNumber" value={form.orderNumber} onChange={onChange} className={inputClass} />
          </FormField>
          <FormField label="የምርት ኮድ">
            <input name="productCode" value={form.productCode} onChange={onChange} className={inputClass} />
          </FormField>
          <FormField label="የዕቃ ዓይነት *">
            <input name="itemType" value={form.itemType} onChange={onChange} required className={inputClass} />
          </FormField>
          <FormField label="የትዕዛዝ ቀን *">
            <EthiopianDateInput
              value={form.orderDate}
              onChange={(val) => setForm({ ...form, orderDate: val })}
              required
            />
          </FormField>
          <FormField label="ቀጠሮ ቀን *" full>
            <EthiopianDateInput
              value={form.appointmentDate}
              onChange={(val) => setForm({ ...form, appointmentDate: val })}
              required
            />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5 flex items-center gap-1.5">
          <DollarSign size={14} className="text-brand" /> ክፍያ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ጠቅላላ ዋጋ *">
            <input type="number" name="totalPrice" value={form.totalPrice} onChange={onChange} required min={0} className={inputClass} />
          </FormField>
          <FormField label="ቅድመ ክፍያ *">
            <input type="number" name="prepayment" value={form.prepayment} onChange={onChange} required min={0} className={inputClass} />
          </FormField>
        </div>

        <div className="mt-3 bg-blue-50/80 border border-blue-100 rounded-xl p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700 font-semibold">ቀሪ ክፍያ (auto):</span>
            <span className={'font-bold text-base ' + (remaining <= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatETB(remaining)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ሁኔታ">
          <select name="status" value={form.status} onChange={onChange} className={inputClass}>
            {Object.entries(RECEIPT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>
        </FormField>

        <FormField label="ቅርንጫፍ *">
          {isSeller ? (
            <div className="w-full px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium">
              {typeof currentUser.branch === 'object' ? currentUser.branch?.name : 'ቅርንጫፍ'}
            </div>
          ) : (
            <select name="branch" value={form.branch} onChange={onChange} className={inputClass}>
              <option value="">— ይምረጡ —</option>
              {branches.length === 0 ? (
                <option value="" disabled>ቅርንጫፍ በመጫን ላይ...</option>
              ) : (
                branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)
              )}
            </select>
          )}
        </FormField>
      </div>

      <FormField label="ማስታወሻ">
        <textarea name="note" value={form.note} onChange={onChange} rows={3}
          className={inputClass + ' resize-none'}
        />
      </FormField>

      <div className="flex gap-2.5 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark shadow-sm transition">
          {receipt ? 'አስተካክል' : 'ፍጠር'}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReceiptView({ receipt, onPrint, onDownload }) {
  const status = RECEIPT_STATUS[receipt.status] || { label: receipt.status, color: 'gray' };

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-brand to-brand-dark text-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold leading-snug">ግሩም ዘመናዊ የኤሌክትሪክ እና ማገዶ ቆጣቢ ምጣድ</h2>
              <p className="text-xs text-blue-100 font-semibold mt-0.5">GRUM STOVE &amp; MANUFACTURING</p>
              <p className="text-xs text-blue-100 mt-1">አዲስ አበባ · ቦሌ ክ/ከተማ</p>
              <p className="text-xs text-blue-100">0924 254 988 · 0903 284 493 · info@grumstove.com</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] text-blue-100 uppercase tracking-wider">ደረሰኝ ቁጥር</p>
              <p className="font-mono font-bold text-base">{receipt.receiptNumber}</p>
              <p className="text-xs text-blue-100 mt-1">{formatEthiopianDate(receipt.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">ደንበኛ</p>
              <p className="font-semibold text-gray-800">{receipt.customerName}</p>
              {receipt.customerPhone && (
                <p className="text-xs text-gray-500 mt-0.5">{receipt.customerPhone}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">ሁኔታ</p>
              <Badge color={status.color}>{status.label}</Badge>
              {receipt.branch?.name && (
                <p className="text-xs text-gray-500 mt-1">{receipt.branch.name}</p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 text-xs font-semibold text-gray-600 uppercase">ዕቃ</th>
                  <th className="text-right py-1.5 text-xs font-semibold text-gray-600 uppercase">መጠን</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 text-gray-800">
                    <span className="font-medium">{receipt.itemType}</span>
                    {receipt.productCode && (
                      <p className="text-xs text-gray-500 font-mono">ኮድ: {receipt.productCode}</p>
                    )}
                    {receipt.order?.orderNumber && (
                      <p className="text-xs text-gray-500 font-mono">ትዕዛዝ: {receipt.order.orderNumber}</p>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-800 font-semibold">
                    {formatETB(receipt.totalPrice || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-sm bg-gray-50/60 p-3.5 rounded-xl border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-600">ጠቅላላ ዋጋ</span>
              <span className="font-semibold text-gray-800">{formatETB(receipt.totalPrice || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ቅድመ ክፍያ</span>
              <span className="font-semibold text-emerald-600">{formatETB(receipt.prepayment || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-700">ቀሪ ክፍያ</span>
              <span className="font-bold text-red-600 text-base">{formatETB(receipt.remainingPayment || 0)}</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
            {receipt.orderDate && <p>የትዕዛዝ ቀን: {formatEthiopianDate(receipt.orderDate)}</p>}
            <p>ቀጠሮ ቀን: {formatEthiopianDate(receipt.appointmentDate)}</p>
            <p>ቅርንጫፍ: {receipt.branch?.name || '-'}</p>
            <p>ያዘጋጀው: {receipt.issuedBy?.fullName || '-'}</p>
          </div>

          {receipt.note && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
              {receipt.note}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          onClick={onDownload}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
        >
          <Download size={16} /> አውርድ PDF
        </button>
        <button
          onClick={onPrint}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition"
        >
          <Printer size={16} /> አትም
        </button>
      </div>
    </div>
  );
}

function buildReceiptHTML(receipt, forPrint) {
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtAmount = (val) => {
    const n = Number(val) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const receiptNo = receipt.receiptNumber || '';
  const statusText = (receipt.status || 'ACTIVE').toUpperCase();
  const branchName = receipt.branch?.name || '';
  const customerName = receipt.customerName || '';
  const customerPhone = receipt.customerPhone || '';
  const itemType = receipt.itemType || '';
  const productCode = receipt.productCode || '';
  const qty = Number(receipt.quantity ?? receipt.order?.quantity ?? 1) || 1;
  const totalPrice = Number(receipt.totalPrice) || 0;
  const prepayment = Number(receipt.prepayment) || 0;
  const remaining = receipt.remainingPayment !== undefined && receipt.remainingPayment !== null
    ? Number(receipt.remainingPayment)
    : Math.max(totalPrice - prepayment, 0);

  const issuedEthDate = formatEthiopianDate(receipt.createdAt);
  const orderEthDate = formatEthiopianDate(receipt.orderDate || receipt.createdAt);
  const appointmentEthDate = formatEthiopianDate(receipt.appointmentDate);
  const noteText = receipt.note || '';
  const issuedByName = receipt.issuedBy?.fullName || 'Admin User';

  return `<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8" />
  <title>ደረሰኝ</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Ethiopic', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 12mm 14mm;
    }
    .box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 16px;
      background: #ffffff;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 10px;
      border-bottom: 1.5px solid #1e293b;
    }
    .company-am {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }
    .company-en {
      font-size: 11px;
      font-weight: 700;
      margin: 2px 0 6px;
      color: #334155;
      letter-spacing: 0.03em;
    }
    .company-lines {
      font-size: 11px;
      line-height: 1.5;
      color: #334155;
    }
    .meta-right {
      text-align: right;
      font-size: 11px;
      min-width: 150px;
    }
    .meta-lbl {
      font-size: 10px;
      color: #64748b;
    }
    .meta-val {
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
      margin-bottom: 5px;
    }
    .status-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 4px;
      border: 1px solid #94a3b8;
      background: #f8fafc;
      color: #0f172a;
      margin-bottom: 5px;
    }
    .block {
      margin-top: 10px;
      padding: 9px 11px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fcfcfd;
    }
    .block-title {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 5px;
      color: #0f172a;
    }
    .line-pair {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 2px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11.5px;
      background: #ffffff;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      font-weight: 700;
      background: #f1f5f9;
      color: #0f172a;
    }
    .c { text-align: center; }
    .r { text-align: right; font-variant-numeric: tabular-nums; }
    .summary-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-top: 10px;
    }
    .dates-side {
      flex: 1;
      padding: 9px 11px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fcfcfd;
      font-size: 11px;
    }
    .dates-side .line-pair {
      justify-content: flex-start;
      gap: 14px;
      margin-bottom: 6px;
    }
    .dates-side .line-pair:last-child {
      margin-bottom: 0;
    }
    .amounts-side {
      width: 245px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #ffffff;
      font-size: 11.5px;
    }
    .amt-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .amt-row.last {
      font-weight: 700;
      border-bottom: none;
      padding-top: 6px;
      margin-top: 2px;
      border-top: 1px solid #94a3b8;
    }
    .text-block {
      margin-top: 10px;
      padding: 8px 11px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fcfcfd;
      font-size: 11px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
    }
    .sign-col {
      border-top: 1px solid #334155;
      padding-top: 4px;
      min-width: 140px;
    }
    .issued-col {
      text-align: center;
    }
    .org-col {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="box">
      <div class="header-row">
        <div>
          <div class="company-am">ግሩም ዘመናዊ የኤሌክትሪክ እና ማገዶ ቆጣቢ ምጣድ</div>
          <div class="company-en">GRUM STOVE &amp; MANUFACTURING</div>
          <div class="company-lines">
            <div>አዲስ አበባ · ቦሌ ክ/ከተማ</div>
            <div>0924 254 988</div>
            <div>0903 284 493</div>
            <div>info@grumstove.com</div>
          </div>
        </div>
        <div class="meta-right">
          <div class="meta-lbl">ደረሰኝ ቁጥር</div>
          <div class="meta-val">${esc(receiptNo)}</div>
          <div class="meta-lbl">የተሰጠ ቀን</div>
          <div class="meta-val">${esc(issuedEthDate)}</div>
          <div class="status-tag">${esc(statusText)}</div>
          <div class="meta-lbl">ቅርንጫፍ</div>
          <div class="meta-val" style="margin-bottom:0">${esc(branchName)}</div>
        </div>
      </div>

      <div class="block">
        <div class="block-title">የደንበኛ መረጃ</div>
        <div class="line-pair"><span>ስም</span><span>${esc(customerName)}</span></div>
        <div class="line-pair"><span>ስልክ</span><span>${esc(customerPhone)}</span></div>
      </div>

      <div class="block">
        <div class="block-title">የትዕዛዝ ዝርዝር</div>
        <table>
          <thead>
            <tr>
              <th>ዕቃ</th>
              <th>ኮድ</th>
              <th class="c">ብዛት</th>
              <th class="r">ዋጋ (ETB)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${esc(itemType)}</td>
              <td>${esc(productCode)}</td>
              <td class="c">${esc(qty)}</td>
              <td class="r">${esc(fmtAmount(totalPrice))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="summary-box">
        <div class="dates-side">
          <div class="line-pair"><span>የትዕዛዝ ቀን</span><span>${esc(orderEthDate)}</span></div>
          <div class="line-pair"><span>ቀጠሮ ቀን</span><span>${esc(appointmentEthDate)}</span></div>
        </div>
        <div class="amounts-side">
          <div class="amt-row"><span>ጠቅላላ ዋጋ</span><span>ብር ${esc(fmtAmount(totalPrice))}</span></div>
          <div class="amt-row"><span>ቅድመ ክፍያ</span><span>ብር ${esc(fmtAmount(prepayment))}</span></div>
          <div class="amt-row last"><span>ቀሪ ክፍያ</span><span>ብር ${esc(fmtAmount(remaining))}</span></div>
        </div>
      </div>

      ${noteText ? `
      <div class="text-block">
        <div class="block-title">ማስታወሻ</div>
        <div>${esc(noteText)}</div>
      </div>` : ''}

      <div class="text-block">
        <div class="block-title">ማሳሰቢያ</div>
        <div>የተከፈለው ቅድመ ክፍያ (ክብድ) የቆይታ ጊዜው 2 ወር ነው። በዚሁ ጊዜ ውስጥ ዕቃውን ካልተረከቡ ወይም የጥሬ ዕቃ ዋጋ ጭማሪ ካጋጠመ፣ የዋጋው ልዩነት ታስቦ የሚስተካከል መሆኑን እንገልጻለን።</div>
        <div style="margin-top:6px">0924254988/0903284493</div>
        <div>ስለመረጡን እናመሰግናለን!</div>
      </div>

      <div class="footer-row">
        <div class="sign-col">የደንበኛ ፊርማ</div>
        <div class="issued-col">
          <div>ደረሰኝ በ ${esc(issuedByName)} ተዘጋጅቷል</div>
          <div class="meta-lbl">${esc(issuedByName)} /ISSUED BY</div>
        </div>
        <div class="org-col">
          <div>${esc(issuedEthDate)}</div>
          <div>GRUM STOVE ADDIS ABABA</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}