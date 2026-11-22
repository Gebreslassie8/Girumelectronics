'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  ShieldCheck, Search, AlertCircle, Plus,
  Calendar, CheckCircle2, XCircle, AlertTriangle,
  Package, User, FileText, Building2, FileDown,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
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

const WARRANTY_STATUS = {
  active:   { label: 'በስራ ላይ',   color: 'green'  },
  expiring: { label: 'የሚያልቅ',   color: 'yellow' },
  expired:  { label: 'አልቋል',     color: 'red'    },
  claimed:  { label: 'ተጠቅሷል',   color: 'blue'   },
  voided:   { label: 'ተሰርዟል',   color: 'gray'   },
};

const DEFAULT_WARRANTY_MONTHS = 24;

// Used on the certificate only when no branch has an address
const FALLBACK_ADDRESS = ['ቀ 1 አየርጤና ግራር', 'ቀ 2 ጎሮ አደባባይ'];

// Company phones (hard-coded) – shown to everyone except the owner
const COMPANY_PHONES = ['0924254988', '0903284493'];

// Owner role – phones for this role come from the database
const OWNER_ROLES = ['owner'];

// Escape text before placing it inside the printed HTML
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Format Date to Ethiopian Calendar
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
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-gray-300 focus:border-brand focus:outline-none text-sm text-gray-800 flex items-center justify-between gap-2 text-left transition"
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

export default function WarrantyPage() {
  const { user } = useAuth();

  const [warranties, setWarranties] = useState([]);
  const [orders, setOrders]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [branches, setBranches]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const [showModal, setShowModal]       = useState(false);
  const [editingItem, setEditingItem]   = useState(null);
  const [viewItem, setViewItem]         = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const isOwner    = OWNER_ROLES.includes(user?.role);
  const isSeller   = user?.role === 'seller';
  const isCustomer = user?.role === 'customer';
  const isCashier  = user?.role === 'cashier';
  const canManage  = user?.role === 'admin' || isSeller || isOwner || isCashier;
  const canView    = ['owner', 'admin', 'seller', 'cashier', 'storekeeper', 'customer'].includes(user?.role);

  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return typeof user.branch === 'object' ? user.branch._id : user.branch;
  }, [user]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [wRes, oRes, pRes, bRes] = await Promise.all([
          apiFetch('/warranties').catch(() => []),
          apiFetch('/orders').catch(() => []),
          apiFetch('/products').catch(() => []),
          apiFetch('/branches').catch(() => []),
        ]);
        if (!alive) return;
        setWarranties(Array.isArray(wRes) ? wRes : wRes?.data ?? []);
        setOrders(Array.isArray(oRes) ? oRes : oRes?.data ?? []);
        setProducts(Array.isArray(pRes) ? pRes : pRes?.data ?? []);
        setBranches(Array.isArray(bRes) ? bRes : bRes?.data ?? []);
      } catch (err) {
        if (alive) setError(err?.message || 'ውሂብ ማምጣት አልተቻለም');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const productMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      if (p._id)  m.set(String(p._id), p);
      if (p.code) m.set(String(p.code), p);
    });
    return m;
  }, [products]);

  const orderMap = useMemo(() => {
    const m = new Map();
    orders.forEach((o) => m.set(String(o._id), o));
    return m;
  }, [orders]);

  const branchMap = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(String(b._id), b));
    return m;
  }, [branches]);

  const scopedWarranties = useMemo(() => {
    if (isCustomer) {
      return warranties.filter((w) => {
        const phone = w.customerPhone || w._customerPhone
          || orderMap.get(String(w.order?._id ?? w.order ?? ''))?.customerPhone
          || '';
        return String(phone) === String(user?.phone || '');
      });
    }
    if ((isSeller || isCashier) && userBranchId) {
      return warranties.filter((w) => {
        const order = orderMap.get(String(w.order?._id ?? w.order ?? ''));
        const bid = order?.branch?._id ?? order?.branch ?? w.branch?._id ?? w.branch;
        return String(bid) === String(userBranchId);
      });
    }
    return warranties;
  }, [warranties, isCustomer, isSeller, userBranchId, user, orderMap]);

  const enriched = useMemo(() => {
    return scopedWarranties.map((w) => {
      const order   = orderMap.get(String(w.order?._id ?? w.order ?? '')) ?? w.order;
      const product = productMap.get(String(w.product?._id ?? w.product ?? '')) ?? w.product;

      const now       = new Date();
      const startDate = w.startDate ? new Date(w.startDate) : (order?.orderDate ? new Date(order.orderDate) : null);
      const endDate   = w.endDate   ? new Date(w.endDate)   : (startDate ? new Date(startDate.getTime() + (w.durationMonths || DEFAULT_WARRANTY_MONTHS) * 30 * 864e5) : null);

      const daysLeft = endDate ? Math.ceil((endDate - now) / 864e5) : null;
      let computedStatus = w.status || 'active';
      if (!w.status) {
        if (daysLeft === null) computedStatus = 'active';
        else if (daysLeft < 0) computedStatus = 'expired';
        else if (daysLeft <= 30) computedStatus = 'expiring';
      }

      const bId = order?.branch?._id ?? order?.branch ?? w.branch?._id ?? w.branch;
      const branchRecord =
        branchMap.get(String(bId)) ||
        (order?.branch && typeof order.branch === 'object' ? order.branch : null) ||
        (w.branch && typeof w.branch === 'object' ? w.branch : null);

      const branchName    = branchRecord?.name || '—';
      const branchAddress = branchRecord?.address || branchRecord?.location || '';

      return {
        ...w,
        _code: w.warrantyNumber || `WRN-${String(w._id).slice(-6).toUpperCase()}`,
        _order: order,
        _product: product,
        _productName: product?.name || order?.itemType || w.itemType || 'Unknown',
        _category:    product?.category || order?.category || '—',
        _customerName:  order?.customerName  || w.customerName  || '—',
        _customerPhone: order?.customerPhone || w.customerPhone || '—',
        _branch: branchName,
        _branchAddress: branchAddress,
        _startDate: startDate,
        _endDate:   endDate,
        _daysLeft:  daysLeft,
        _durationMonths: w.durationMonths || DEFAULT_WARRANTY_MONTHS,
        _price: w.price ?? w.purchasePrice ?? order?.totalPrice ?? order?.total ?? product?.price ?? null,
        _status: computedStatus,
        _statusLabel: WARRANTY_STATUS[computedStatus]?.label || computedStatus,
        _statusColor: WARRANTY_STATUS[computedStatus]?.color || 'gray',
      };
    });
  }, [scopedWarranties, productMap, orderMap, branchMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((w) => {
      if (q) {
        const hay = [w._code, w._productName, w._customerName, w._customerPhone, w._category].map((v) => String(v || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && w._status !== statusFilter) return false;
      if (branchFilter !== 'all' && (w._order?.branch?._id ?? w._order?.branch) !== branchFilter) return false;
      return true;
    });
  }, [enriched, search, statusFilter, branchFilter]);

  const stats = useMemo(() => {
    const total    = filtered.length;
    const active   = filtered.filter((w) => w._status === 'active').length;
    const expiring = filtered.filter((w) => w._status === 'expiring').length;
    const expired  = filtered.filter((w) => w._status === 'expired').length;
    return { total, active, expiring, expired };
  }, [filtered]);

  function exportPdf() {
    if (filtered.length === 0) {
      toast.error('ምንም ዋስትና የለም');
      return;
    }

    const rows = filtered.map((w) => `
      <tr>
        <td>${esc(w._code)}</td>
        <td>${esc(w._productName)}</td>
        <td>${esc(w._customerName)}<br/><small>${esc(w._customerPhone)}</small></td>
        <td>${esc(w._branch)}</td>
        <td>${formatEthiopianDate(w._startDate)}</td>
        <td>${formatEthiopianDate(w._endDate)}</td>
        <td>${esc(w._statusLabel)}</td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="utf-8" />
  <title>የዋስትና ሪፖርት - ${formatEthiopianDate(new Date())}</title>
  <style>
    body { font-family: 'Segoe UI', 'Noto Sans Ethiopic', Arial, sans-serif; padding: 24px; color: #111; }
    h1 { text-align: center; font-size: 22px; color: #15803d; margin-bottom: 4px; }
    .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f0fdf4; color: #166534; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #9ca3af; }
    .no-print { text-align: center; margin-bottom: 16px; }
    .no-print button { padding: 8px 24px; background: #15803d; color: white; border: none; border-radius: 6px; cursor: pointer; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">🖨️ አትም / PDF አውርድ</button></div>
  <h1>🛡️ የዋስትና ሪፖርት</h1>
  <p class="sub">ግሩም ዘመናዊ ኤሌትሪክና ማገዶ ቆጣቢ ምጣድ</p>
  <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:16px;">
    <span><strong>ቀን:</strong> ${formatEthiopianDate(new Date())}</span>
    <span><strong>ጠቅላላ:</strong> ${filtered.length} ዋስትናዎች</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>ኮድ</th><th>ምርት</th><th>ደንበኛ</th><th>ቅርንጫፍ</th>
        <th>የጀመረበት</th><th>የሚያልቅበት</th><th>ሁኔታ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">© ${new Date().getFullYear()} ግሩም ኤሌክትሮኒክስ · ሁሉም መብቶች የተጠበቁ ናቸው</p>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup ታግዷል — እባክዎ popup ይፍቀዱ'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    toast.success('PDF ተዘጋጅቷል — ለማውረድ Ctrl+P ይጫኑ');
  }

  function downloadSinglePdf(w) {
    const branchLines = branches
      .map((b) => ({ name: b.name, addr: b.address || b.location }))
      .filter((b) => b.addr);

    const addressHtml = branchLines.length
      ? branchLines.map((b) => `<div><b>${esc(b.name)}፡</b> ${esc(b.addr)}</div>`).join('')
      : FALLBACK_ADDRESS.map((l) => `<div>${esc(l)}</div>`).join('');

    let phones = COMPANY_PHONES;
    if (isOwner) {
      const dbPhones = [
        user?.phone,
        user?.phone2,
        ...(Array.isArray(user?.phones) ? user.phones : []),
        ...branches.flatMap((b) => [b.phone, b.phone2, ...(Array.isArray(b.phones) ? b.phones : [])]),
      ].filter(Boolean);
      phones = dbPhones.length ? [...new Set(dbPhones.map(String))] : COMPANY_PHONES;
    }

    const phoneIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    const phoneHtml = phones.map((p) => `<div class="phone-num">${esc(p)}</div>`).join('');

    const html = `
<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="utf-8" />
  <title>የዋስትና ሰርተፊኬት - ${esc(w._code)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Ethiopic', 'Nyala', 'Segoe UI', Arial, sans-serif;
      padding: 30px;
      color: #333;
      background: #e5e7eb;
    }
    .cert {
      position: relative;
      max-width: 760px;
      min-height: 1020px;
      margin: 0 auto;
      background: #dbe6f2;
      border: 1px solid #c3cfdd;
      padding: 40px 48px 36px;
      display: flex;
      flex-direction: column;
    }
    .stamp {
      position: absolute;
      top: 26px;
      left: 26px;
      width: 92px;
      height: 92px;
      background: #15803d;
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(-18deg);
      clip-path: polygon(50% 0%, 61% 10%, 75% 6%, 80% 20%, 94% 25%, 90% 39%, 100% 50%, 90% 61%, 94% 75%, 80% 80%, 75% 94%, 61% 90%, 50% 100%, 39% 90%, 25% 94%, 20% 80%, 6% 75%, 10% 61%, 0% 50%, 10% 39%, 6% 25%, 20% 20%, 25% 6%, 39% 10%);
    }
    .logo-wrap {
      position: absolute;
      top: 24px;
      right: 28px;
      width: 110px;
      text-align: center;
    }
    .logo {
      width: 96px;
      height: 96px;
      object-fit: contain;
      background: #15803d;
      display: block;
      margin: 0 auto;
    }
    .logo-fallback {
      width: 96px;
      height: 96px;
      margin: 0 auto;
      background: #15803d;
      color: #facc15;
      border: 2px solid #facc15;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 44px;
      font-weight: 900;
      line-height: 1;
    }
    .logo-fallback small { font-size: 12px; letter-spacing: 1px; margin-top: 4px; }
    .logo-caption { margin-top: 4px; font-size: 9px; font-weight: 700; color: #333; line-height: 1.2; }

    .brand { text-align: center; margin: 0 120px 34px; }
    .brand div { font-size: 26px; font-weight: 800; color: #333; line-height: 1.35; }

    .fields { margin: 0 0 26px 60px; }
    .field-row { display: flex; align-items: flex-end; margin-bottom: 18px; font-size: 18px; font-weight: 800; color: #333; }
    .field-label { white-space: nowrap; }
    .field-line {
      flex: 1;
      margin: 0 40px 0 6px;
      border-bottom: 2px dashed #555;
      padding: 0 6px 1px;
      font-weight: 600;
      min-height: 22px;
    }

    .terms-title { text-align: center; font-size: 22px; font-weight: 800; margin: 14px 0 18px; }
    .terms-text { text-align: center; font-size: 16px; font-weight: 700; line-height: 2; margin: 0 10px 26px; }

    .nc-title { text-align: center; font-size: 22px; font-weight: 800; margin: 14px 0 18px; }
    .nc-list { margin: 0 0 26px 170px; font-size: 18px; font-weight: 800; line-height: 2; }

    .warning { text-align: center; font-size: 21px; font-weight: 800; margin: 20px 0 0; }

    .footer {
      margin-top: auto;
      padding-top: 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font-weight: 800;
      color: #333;
    }
    .address { display: flex; align-items: flex-start; gap: 20px; font-size: 15px; line-height: 1.6; max-width: 55%; }
    .phones { display: flex; align-items: center; gap: 14px; }
    .phone-icon { width: 54px; height: 54px; background: #15803d; color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .phone-num { font-size: 26px; line-height: 1.3; }

    .print-btn { text-align: center; margin-bottom: 20px; }
    .print-btn button { padding: 10px 32px; background: #15803d; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }

    @media print {
      @page { size: A4; margin: 0; }
      body { padding: 0; background: #fff; }
      .cert { max-width: none; width: 100%; min-height: 100vh; border: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-btn"><button onclick="window.print()">🖨️ አትም / PDF አውርድ</button></div>

  <div class="cert">
    <div class="stamp">WARRANTY</div>

    <div class="logo-wrap">
      <img class="logo" id="gurum-logo" src="${window.location.origin}/logo.png" alt="GURUM" />
      <div class="logo-caption">ከኤሌትሪክ ንክኪ ነፃ</div>
    </div>

    <div class="brand">
      <div>ግሩም ዘመናዊ ኤሌትሪክና</div>
      <div>ማገዶ ቆጣቢ ምጣድ</div>
    </div>

    <div class="fields">
      <div class="field-row">
        <span class="field-label">የዕቃው አይነት</span>
        <span class="field-line">${esc(w._productName || '')}</span>
      </div>
      <div class="field-row">
        <span class="field-label">የተገዛበት ቀን</span>
        <span class="field-line">${formatEthiopianDate(w._startDate)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">የተገዛበት ዋጋ</span>
        <span class="field-line">${w._price != null ? esc(formatETB(w._price)) : ''}</span>
      </div>
      <div class="field-row">
        <span class="field-label">የዋስትና ጊዜ</span>
        <span class="field-line">${esc(w._durationMonths)} ወራት</span>
      </div>
      <div class="field-row">
        <span class="field-label">የገዢው ስም</span>
        <span class="field-line">${esc(w._customerName === '—' ? '' : w._customerName)}</span>
      </div>
    </div>

    <div class="terms-title">የዋስትና ደንቦችና ሁኔታዎች</div>
    <div class="terms-text">
      ይህ ዋስትና የሚያገለግለው በምርቱ የአሰራር ጉድለት ወይም በዕቃው ጥራት ጉድለት በሚመጣው ብልሽት ብቻ ነው።
      ምርቱ ከተገዛበት ቀን ጀምሮ ብልሽት ካጋጠመው በነፃ ጥገና ይደረግለታል።
    </div>

    <div class="nc-title">በሚከተሉት ነገሮች ድርጅቱ የማይሸፍናቸው</div>
    <div class="nc-list">
      *በኤሌትሪክ መዋዠቅ<br/>
      *በበረሮና በተለያዩ ነብሳቶች<br/>
      *በመሰበር
    </div>

    <div class="warning">ከድርጅቱ ውጪ ለተነካካው እቃ ድርጅቱ ሃላፊነት አይወስድም።</div>

    <div class="footer">
      <div class="address">
        <span style="white-space:nowrap">አድራሻ፡</span>
        <div>${addressHtml}</div>
      </div>
      <div class="phones">
        <div class="phone-icon">${phoneIcon}</div>
        <div>${phoneHtml}</div>
      </div>
    </div>
  </div>

  <script>
    var logo = document.getElementById('gurum-logo');
    logo.addEventListener('error', function () {
      var d = document.createElement('div');
      d.className = 'logo-fallback';
      d.innerHTML = 'G<small>GURUM</small>';
      logo.replaceWith(d);
    });
  </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup ታግዷል — እባክዎ popup ይፍቀዱ'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    toast.success('የዋስትና ሰርተፊኬት ተዘጋጅቷል — Ctrl+P ይጫኑ');
  }

  async function handleSave(data) {
    try {
      if (editingItem) {
        const updated = await apiFetch(`/warranties/${editingItem._id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setWarranties((prev) => prev.map((w) => (w._id === editingItem._id ? { ...w, ...updated } : w)));
        toast.success('ዋስትና ተስተካክሏል');
      } else {
        const created = await apiFetch('/warranties', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setWarranties((prev) => [created, ...prev]);
        toast.success('ዋስትና ተመዝግቧል');
      }
      setShowModal(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/warranties/${deleteTarget._id}`, { method: 'DELETE' });
      setWarranties((prev) => prev.filter((w) => w._id !== deleteTarget._id));
      toast.success('ዋስትና ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ShieldCheck size={40} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ፍቃድ የለዎትም</h1>
        <p className="text-gray-600">ይህ ገጽ ለተፈቀደላቸው ተጠቃሚዎች ብቻ ነው።</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={26} className="text-brand" />
            ዋስትና
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCustomer
              ? `${filtered.length} የእርስዎ ዋስትናዎች`
              : `${filtered.length} ዋስትናዎች · ${stats.active} በስራ ላይ · ${stats.expiring} የሚያልቁ`}
          </p>
          {isCustomer && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <User size={12} />
              {user?.fullName || user?.phone}
            </p>
          )}
          {isSeller && userBranchId && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportPdf} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-40">
            <FileDown size={13} /> PDF
          </button>
          {canManage && (
            <Button onClick={() => { setEditingItem(null); setShowModal(true); }}>
              <Plus size={16} /> አዲስ ዋስትና
            </Button>
          )}
        </div>
      </div>

      {/* Stats — hidden for customers */}
      {!isCustomer && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="ጠቅላላ ዋስትናዎች" value={stats.total}    icon={ShieldCheck}   color="bg-blue-500" />
          <StatCard label="በስራ ላይ"        value={stats.active}      icon={CheckCircle2}  color="bg-green-500" />
          <StatCard label="የሚያልቁ"         value={stats.expiring} icon={AlertTriangle} color="bg-yellow-500" />
          <StatCard label="አልቀው"         value={stats.expired}  icon={XCircle}       color="bg-red-500" />
        </div>
      )}

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ፍለጋ</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ኮድ፣ ምርት፣ ደንበኛ…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ሁኔታ</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand focus:outline-none">
              <option value="all">ሁሉም ሁኔታዎች</option>
              {Object.entries(WARRANTY_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ቅርንጫፍ</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-brand focus:outline-none">
              <option value="all">ሁሉም ቅርንጫፎች</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-gray-500">በመጫን ላይ…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex items-center justify-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">ምንም ዋስትና አልተገኘም</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">ኮድ</th>
                  <th className="py-3 px-4 text-left font-semibold">ምርት</th>
                  <th className="py-3 px-4 text-left font-semibold">ደንበኛ</th>
                  <th className="py-3 px-4 text-left font-semibold">የጀመረበት</th>
                  <th className="py-3 px-4 text-left font-semibold">የሚያልቅበት</th>
                  <th className="py-3 px-4 text-left font-semibold">የቀረ ቀን</th>
                  <th className="py-3 px-4 text-left font-semibold">ሁኔታ</th>
                  <th className="py-3 px-4 text-center font-semibold">ተግባር</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">
                      {w._code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{w._productName}</div>
                      {w._category && w._category !== '—' && (
                        <div className="text-xs text-gray-500">{w._category}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{w._customerName}</div>
                      <div className="text-xs text-gray-500">{w._customerPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                      {formatEthiopianDate(w._startDate)}
                    </td>
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                      {formatEthiopianDate(w._endDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-gray-800">
                      {w._daysLeft != null ? ${w._daysLeft} ቀን : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge color={w._statusColor}>{w._statusLabel}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <ActionButtons
                        onView={() => setViewItem(w)}
                        onEdit={() => { setEditingItem(w); setShowModal(true); }}
                        onDelete={() => setDeleteTarget(w)}
                        canEdit={canManage}
                        canDelete={canManage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View Modal */}
      <Modal
        isOpen={Boolean(viewItem)}
        onClose={() => setViewItem(null)}
        title={viewItem ? የዋስትና ዝርዝር —  : 'የዋስትና ዝርዝር'}
      >
        {viewItem && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500 block">ኮድ</span>
                <span className="font-mono font-semibold text-gray-800">{viewItem._code}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">ሁኔታ</span>
                <Badge color={viewItem._statusColor}>{viewItem._statusLabel}</Badge>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">ምርት</span>
                <span className="font-medium text-gray-800">{viewItem._productName}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">ቅርንጫፍ</span>
                <span className="font-medium text-gray-800">{viewItem._branch}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">ደንበኛ</span>
                <span className="font-medium text-gray-800">{viewItem._customerName}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">ስልክ</span>
                <span className="font-medium text-gray-800">{viewItem._customerPhone}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">የጀመረበት</span>
                <span className="font-medium text-gray-800">{formatEthiopianDate(viewItem._startDate)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">የሚያልቅበት</span>
                <span className="font-medium text-gray-800">{formatEthiopianDate(viewItem._endDate)}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => downloadSinglePdf(viewItem)}>ሰርተፊኬት</Button>
              <Button variant="secondary" onClick={() => setViewItem(null)}>ዝጋ</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        title={editingItem ? 'ዋስትና አስተካክል' : 'አዲስ ዋስትና'}
      >
        <WarrantyForm
          initialData={editingItem}
          products={products}
          orders={orders}
          branches={branches}
          onSubmit={handleSave}
          onCancel={() => { setShowModal(false); setEditingItem(null); }}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="ዋስትና ይሰረዝ?"
        message="ይህን ዋስትና መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?._customerName}
        itemType={(deleteTarget?._code || '') + ' · ' + (deleteTarget?._productName || '')}
        confirmLabel="አዎ፣ ሰርዝ"
        cancelLabel="ተወው"
        variant="danger"
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{value}</div>
        </div>
        <div className={w-10 h-10 rounded-lg  text-white flex items-center justify-center}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function WarrantyForm({ initialData, products, orders, branches, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    warrantyNumber: initialData?.warrantyNumber || '',
    product: initialData?.product?._id ?? initialData?.product ?? '',
    order: initialData?.order?._id ?? initialData?.order ?? '',
    branch: initialData?.branch?._id ?? initialData?.branch ?? '',
    customerName: initialData?.customerName || '',
    customerPhone: initialData?.customerPhone || '',
    durationMonths: initialData?.durationMonths || DEFAULT_WARRANTY_MONTHS,
    startDate: initialData?.startDate
      ? toIsoDateFromUtc(new Date(initialData.startDate))
      : toIsoDateFromUtc(new Date()),
    status: initialData?.status || 'active',
    notes: initialData?.notes || '',
  }));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        durationMonths: Number(form.durationMonths) || DEFAULT_WARRANTY_MONTHS,
        product: form.product || undefined,
        order: form.order || undefined,
        branch: form.branch || undefined,
      };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">የዋስትና ቁጥር</label>
          <input
            type="text"
            value={form.warrantyNumber}
            onChange={(e) => setForm((f) => ({ ...f, warrantyNumber: e.target.value }))}
            placeholder="WRN-2026-0001"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ሁኔታ</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-brand focus:outline-none"
          >
            {Object.entries(WARRANTY_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ምርት</label>
          <select
            value={form.product}
            onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-brand focus:outline-none"
          >
            <option value="">ምርት ይምረጡ</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ቅርንጫፍ</label>
          <select
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-brand focus:outline-none"
          >
            <option value="">ቅርንጫፍ ይምረጡ</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">የደንበኛ ስም</label>
          <input
            type="text"
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">ስልክ ቁጥር</label>
          <input
            type="text"
            value={form.customerPhone}
            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">የጀመረበት ቀን</label>
          <EthiopianDateInput
            value={form.startDate}
            onChange={(iso) => setForm((f) => ({ ...f, startDate: iso }))}
            required
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">የዋስትና ጊዜ (ወራት)</label>
          <input
            type="number"
            min="1"
            value={form.durationMonths}
            onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">ማስታወሻ</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onCancel}>ሰርዝ</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'በማስቀመጥ ላይ…' : 'አስቀምጥ'}
        </Button>
      </div>
    </form>
  );
}