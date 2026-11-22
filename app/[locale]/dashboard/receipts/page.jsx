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

const STAFF_ROLES = ['seller', 'cashier', 'storekeeper'];

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

  const isAdminActor = user?.role === 'admin' || user?.role === 'owner';
  const isStaffActor = STAFF_ROLES.includes(user?.role);
  const canManage = isAdminActor || isStaffActor;

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
    return String(typeof user.branch === 'object' ? user.branch._id : user.branch);
  }, [user]);

  const roleFiltered = useMemo(() => {
    let result = receipts;
    if (isStaffActor && userBranchId) {
      result = result.filter((r) => String(r.branch?._id || r.branch) === userBranchId);
    }
    if (user?.role === 'customer') {
      result = result.filter((r) => r.customerPhone === user.phone);
    }
    return result;
  }, [receipts, user, isStaffActor, userBranchId]);

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

  const canActorModifyReceipt = (receipt) => {
    if (!receipt) return canManage;
    if (isAdminActor) return true;
    if (!isStaffActor) return false;
    const receiptBranchId = receipt.branch?._id
      ? String(receipt.branch._id)
      : receipt.branch
      ? String(receipt.branch)
      : null;
    if (userBranchId && receiptBranchId) {
      return receiptBranchId === userBranchId;
    }
    return true;
  };

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

  const printOrDownloadPDF = (receipt, mode = 'print') => {
    const html = buildReceiptHTML(receipt, { mode });

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = html;

    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 60000);
    };

    iframe.onload = async () => {
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow.document;

        const fontLinks = document.querySelectorAll('link[rel="stylesheet"], style');
        fontLinks.forEach((node) => {
          if (node.tagName === 'LINK') {
            iframeDoc.head.appendChild(node.cloneNode());
          } else if (node.tagName === 'STYLE') {
            iframeDoc.head.appendChild(node.cloneNode(true));
          }
        });

        if (iframeDoc.fonts && iframeDoc.fonts.ready) {
          await iframeDoc.fonts.ready;
        }

        iframeWindow.focus();
        iframeWindow.print();
        cleanup();
      } catch (err) {
        console.error('[printPDF]', err);
        toast.error('PDF ማውጣት አልተሳካም');
        if (iframe.parentNode) document.body.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
  };

  const handlePrint = (receipt) => printOrDownloadPDF(receipt, 'print');
  const handleDownload = (receipt) => printOrDownloadPDF(receipt, 'download');

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
            {isStaffActor && userBranchId && (
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

          {isAdminActor ? (
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
                  const rowCanModify = canActorModifyReceipt(receipt);
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
  const isStaff = STAFF_ROLES.includes(currentUser?.role);

  const defaultBranch = isStaff && currentUser?.branch
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
        <FormField label="ቅርንጫፍ">
          <select
            name="branch"
            value={form.branch}
            onChange={onChange}
            disabled={isStaff && Boolean(defaultBranch)}
            className={`${inputClass} disabled:bg-gray-100`}
          >
            <option value="">— ይምረጡ —</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="ማስታወሻ" full>
        <textarea
          name="note"
          value={form.note}
          onChange={onChange}
          rows={2}
          className={inputClass}
        />
      </FormField>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          ሰርዝ
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition"
        >
          {receipt ? 'አስተካክል' : 'ጨምር'}
        </button>
      </div>
    </form>
  );
}

function buildReceiptHTML(receipt, options = {}) {
  const safe = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const statusObj = RECEIPT_STATUS[receipt.status] || {
    label: receipt.status || 'ንቁ',
    color: 'gray',
  };

  const total = Math.max(Number(receipt.totalPrice) || 0, 0);
  const prepaid = Math.max(Number(receipt.prepayment) || 0, 0);
  const remaining =
    receipt.remainingPayment !== undefined
      ? Math.max(Number(receipt.remainingPayment) || 0, 0)
      : Math.max(total - prepaid, 0);

  const paidRatio = total > 0 ? Math.min(100, Math.round((prepaid / total) * 100)) : 100;
  const isSettled = remaining <= 0 && total > 0;

  const branchName = receipt.branch?.name || 'ዋና ቅርንጫፍ';
  const branchCode = receipt.branch?.code ? ` (${receipt.branch.code})` : '';
  const orderNum = receipt.order?.orderNumber || receipt.orderNumber || '—';
  const issuedByName = receipt.issuedBy?.fullName || '—';

  const orderDateEth = formatEthiopianDate(receipt.orderDate || receipt.createdAt);
  const apptDateEth = formatEthiopianDate(receipt.appointmentDate);
  const issuedDateEth = formatEthiopianDate(new Date());

  const paymentBadgeLabel = isSettled ? 'ሙሉ ተከፍሏል · PAID' : 'ቀሪ ክፍያ አለው · PARTIAL';
  const paymentBadgeBg = isSettled ? '#dcfce7' : '#fef3c7';
  const paymentBadgeColor = isSettled ? '#166534' : '#92400e';
  const barColor = isSettled ? '#16a34a' : '#d97706';

  return `<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8" />
  <title>ደረሰኝ - ${safe(receipt.receiptNumber || '')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: "Noto Sans Ethiopic", "Abyssinica SIL", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 13px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 22px 24px;
      background: #ffffff;
      break-inside: avoid;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f172a;
    }
    .brand-title {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #475569;
      margin-top: 3px;
    }
    .doc-meta {
      text-align: right;
    }
    .receipt-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      font-weight: 700;
      color: #1d4ed8;
      background: #eff6ff;
      padding: 4px 10px;
      border-radius: 7px;
      display: inline-block;
      border: 1px solid #bfdbfe;
    }
    .pill-row {
      margin-top: 6px;
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 999px;
      display: inline-block;
    }
    .pill-status {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 16px;
    }
    .box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .box-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0;
      font-size: 12.5px;
    }
    .kv .k {
      color: #64748b;
      flex-shrink: 0;
    }
    .kv .v {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
      word-break: break-word;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .item-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 12.5px;
    }
    .item-table th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 9px 12px;
      font-weight: 600;
      font-size: 11.5px;
    }
    .item-table th.num,
    .item-table td.num {
      text-align: right;
    }
    .item-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: top;
    }
    .summary-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-top: 16px;
      break-inside: avoid;
    }
    .progress-box {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .progress-head {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    .progress-track {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      width: ${paidRatio}%;
      height: 100%;
      background: ${barColor};
    }
    .progress-dates {
      margin-top: 10px;
      font-size: 11.5px;
      color: #475569;
    }
    .progress-dates div {
      display: flex;
      justify-content: space-between;
      margin-top: 3px;
    }
    .totals-box {
      width: 270px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 13px;
    }
    .tot-row.grand {
      border-top: 1.5px solid #0f172a;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 800;
    }
    .paid-val { color: #15803d; font-weight: 700; }
    .due-val { color: ${remaining > 0 ? '#dc2626' : '#15803d'}; font-weight: 800; }
    .note {
      margin-top: 14px;
      padding: 10px 14px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 9px;
      font-size: 12px;
      color: #78350f;
      break-inside: avoid;
    }
    .footer {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
      .sheet { border: 1px solid #cbd5e1; padding: 16px 18px; }
    }
    @media (max-width: 600px) {
      .grid-2 { grid-template-columns: 1fr; }
      .summary-wrap { flex-direction: column; }
      .totals-box { width: 100%; }
      .topbar { flex-direction: column; }
      .doc-meta { text-align: left; }
      .pill-row { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar">
      <div>
        <h1 class="brand-title">የክፍያ ደረሰኝ</h1>
        <div class="brand-sub">ቅርንጫፍ: <strong>${safe(branchName + branchCode)}</strong></div>
      </div>
      <div class="doc-meta">
        <div class="receipt-code">${safe(receipt.receiptNumber || '—')}</div>
        <div class="pill-row">
          <span class="pill pill-status">${safe(statusObj.label)}</span>
          <span class="pill" style="background:${paymentBadgeBg};color:${paymentBadgeColor};">${safe(paymentBadgeLabel)}</span>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="box">
        <div class="box-title">የደንበኛ መረጃ · Customer</div>
        <div class="kv"><span class="k">ስም:</span><span class="v">${safe(receipt.customerName || '—')}</span></div>
        <div class="kv"><span class="k">ስልክ:</span><span class="v mono">${safe(receipt.customerPhone || '—')}</span></div>
      </div>
      <div class="box">
        <div class="box-title">የትዕዛዝ ዝርዝር · Reference</div>
        <div class="kv"><span class="k">የትዕዛዝ ቁጥር:</span><span class="v mono">${safe(orderNum)}</span></div>
        <div class="kv"><span class="k">የምርት ኮድ:</span><span class="v mono">${safe(receipt.productCode || '—')}</span></div>
        <div class="kv"><span class="k">ያወጣው ሰራተኛ:</span><span class="v">${safe(issuedByName)}</span></div>
      </div>
    </div>

    <table class="item-table">
      <thead>
        <tr>
          <th>የዕቃ ዓይነት (Item)</th>
          <th>የምርት ኮድ</th>
          <th class="num">ጠቅላላ ዋጋ</th>
          <th class="num">ቅድመ ክፍያ</th>
          <th class="num">ቀሪ ክፍያ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${safe(receipt.itemType || '—')}</strong></td>
          <td class="mono">${safe(receipt.productCode || '—')}</td>
          <td class="num">${safe(formatETB(total))}</td>
          <td class="num paid-val">${safe(formatETB(prepaid))}</td>
          <td class="num due-val">${safe(formatETB(remaining))}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-wrap">
      <div class="progress-box">
        <div class="progress-head">
          <span>የክፍያ ሁኔታ (${paidRatio}%)</span>
          <span>${safe(formatETB(prepaid))} / ${safe(formatETB(total))}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-dates">
          <div><span>የትዕዛዝ ቀን:</span><strong>${safe(orderDateEth)}</strong></div>
          <div><span>ቀጠሮ ቀን:</span><strong>${safe(apptDateEth)}</strong></div>
          <div><span>የታተመበት ቀን:</span><strong>${safe(issuedDateEth)}</strong></div>
        </div>
      </div>

      <div class="totals-box">
        <div class="tot-row"><span>ጠቅላላ ዋጋ:</span><span>${safe(formatETB(total))}</span></div>
        <div class="tot-row"><span>ቅድመ ክፍያ:</span><span class="paid-val">- ${safe(formatETB(prepaid))}</span></div>
        <div class="tot-row grand"><span>ቀሪ ክፍያ:</span><span class="due-val">${safe(formatETB(remaining))}</span></div>
      </div>
    </div>

    ${receipt.note ? `<div class="note"><strong>ማስታወሻ:</strong> ${safe(receipt.note)}</div>` : ''}

    <div class="footer">
      <span>${safe(branchName)} · የክፍያ ማረጋገጫ ደረሰኝ</span>
      <span>${safe(receipt.receiptNumber || '')}</span>
    </div>
  </div>
</body>
</html>`;
}

function ReceiptView({ receipt, onPrint, onDownload }) {
  const status = RECEIPT_STATUS[receipt.status] || { label: receipt.status, color: 'gray' };
  const remaining = Number(receipt.remainingPayment) || 0;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between pb-3 border-b border-gray-100">
        <div>
          <p className="font-mono text-xs text-brand font-semibold">{receipt.receiptNumber}</p>
          <p className="font-bold text-gray-900 text-lg mt-0.5">{receipt.customerName}</p>
          {receipt.customerPhone && (
            <p className="text-xs text-gray-500">{receipt.customerPhone}</p>
          )}
        </div>
        <Badge color={status.color}>{status.label}</Badge>
      </div>

      <div className="space-y-2.5">
        <Row label="የዕቃ ዓይነት" value={receipt.itemType} bold />
        {receipt.productCode && <Row label="የምርት ኮድ" value={receipt.productCode} mono />}
        {receipt.order?.orderNumber && <Row label="የትዕዛዝ ቁጥር" value={receipt.order.orderNumber} mono />}
        <Row label="ጠቅላላ ዋጋ" value={formatETB(receipt.totalPrice || 0)} bold />
        <Row label="ቅድመ ክፍያ" value={formatETB(receipt.prepayment || 0)} color="text-emerald-600" bold />
        <Row label="ቀሪ ክፍያ" value={formatETB(remaining)} color={remaining > 0 ? 'text-red-600' : 'text-emerald-600'} bold />
        <Row label="ቀጠሮ ቀን" value={formatEthiopianDate(receipt.appointmentDate)} />
        <Row label="የተፈጠረበት ቀን" value={formatEthiopianDate(receipt.createdAt)} />
        <Row label="ቅርንጫፍ" value={receipt.branch?.name || '—'} />
      </div>

      {receipt.note && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70 text-xs text-amber-900">
          {receipt.note}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onPrint} className="flex-1 justify-center">
          <Printer size={16} /> አትም
        </Button>
        <Button type="button" onClick={onDownload} className="flex-1 justify-center">
          <Download size={16} /> PDF አውርድ
        </Button>
      </div>
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
      <span
        className={`text-right ${bold ? 'font-semibold' : ''} ${
          mono ? 'font-mono text-xs' : ''
        } ${color || 'text-gray-800'}`}
      >
        {value}
      </span>
    </div>
  );
}