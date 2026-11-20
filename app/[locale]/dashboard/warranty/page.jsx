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
  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch (e) {
    return new Date(date).toLocaleDateString('am-ET');
  }
};

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
  const canManage  = user?.role === 'admin' || isSeller || isOwner;
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
    if (isSeller && userBranchId) {
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

      // Branch record (works whether branch is an id or already populated)
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

  // ---- PDF Export (Report) ----
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

  // ---- Single Certificate PDF ----
  function downloadSinglePdf(w) {
    // ALL registered branches' addresses
    const branchLines = branches
      .map((b) => ({ name: b.name, addr: b.address || b.location }))
      .filter((b) => b.addr);

    const addressHtml = branchLines.length
      ? branchLines.map((b) => `<div><b>${esc(b.name)}፡</b> ${esc(b.addr)}</div>`).join('')
      : FALLBACK_ADDRESS.map((l) => `<div>${esc(l)}</div>`).join('');

    // Phones: owner -> from database, everyone else -> hard-coded company phones
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
    // If /logo.png is missing, show a simple GURUM badge instead
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
          <StatCard label="በስራ ላይ"        value={stats.active}   icon={CheckCircle2}  color="bg-green-500" />
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
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand focus:outline-none bg-white">
              <option value="all">ሁሉም</option>
              {Object.entries(WARRANTY_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {!isSeller && !isCustomer && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ቅርንጫፍ</label>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand focus:outline-none bg-white">
                <option value="all">ሁሉም</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <Card padding="md">
          <div className="flex items-start gap-3 text-red-600">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">ውሂብ ማምጣት አልተቻለም</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">በመጫን ላይ…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={26} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {isCustomer ? 'የእርስዎ ዋስትና የለም' : 'ምንም ዋስትና አልተገኘም'}
            </p>
            {canManage && (
              <Button className="mt-3" onClick={() => { setEditingItem(null); setShowModal(true); }}>
                <Plus size={14} /> የመጀመሪያውን ዋስትና ይመዝግቡ
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">ኮድ</th>
                  <th className="px-4 py-3 font-medium">ምርት</th>
                  {!isCustomer && <th className="px-4 py-3 font-medium">ደንበኛ</th>}
                  <th className="px-4 py-3 font-medium">የጀመረበት</th>
                  <th className="px-4 py-3 font-medium">የሚያልቅበት</th>
                  <th className="px-4 py-3 font-medium text-center">የቀረ ቀን</th>
                  <th className="px-4 py-3 font-medium">ሁኔታ</th>
                  {canManage && <th className="px-4 py-3 font-medium text-center">ተግባር</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{w._code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-xs">{w._productName}</p>
                      <p className="text-[10px] text-gray-400">{w._category}</p>
                    </td>
                    {!isCustomer && (
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{w._customerName}</p>
                        <p className="text-xs text-gray-500">{w._customerPhone}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {formatEthiopianDate(w._startDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {formatEthiopianDate(w._endDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {w._daysLeft === null ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : w._daysLeft < 0 ? (
                        <span className="text-xs font-semibold text-red-600">{Math.abs(w._daysLeft)} ቀን አልፏል</span>
                      ) : w._daysLeft <= 30 ? (
                        <span className="text-xs font-semibold text-yellow-600">{w._daysLeft} ቀን</span>
                      ) : (
                        <span className="text-xs font-semibold text-green-600">{w._daysLeft} ቀን</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={w._statusColor}>{w._statusLabel}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => downloadSinglePdf(w)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition"
                            title="የዋስትና ሰርተፊኬት አውርድ"
                          >
                            <FileDown size={14} />
                          </button>
                          <ActionButtons
                            onView={() => setViewItem(w)}
                            onEdit={() => { setEditingItem(w); setShowModal(true); }}
                            onDelete={() => setDeleteTarget(w)}
                            canEdit={true}
                            canDelete={true}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        title={editingItem ? 'ዋስትና አስተካክል' : 'አዲስ ዋስትና መዝግብ'}
        size="lg"
      >
        <WarrantyForm
          item={editingItem}
          orders={orders}
          products={products}
          branches={branches}
          userBranchId={userBranchId}
          isSeller={isSeller}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingItem(null); }}
        />
      </Modal>

      <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="የዋስትና ዝርዝር">
        {viewItem && <WarrantyView item={viewItem} onDownload={() => downloadSinglePdf(viewItem)} />}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ዋስትና ይሰረዝ?"
        message="ይህ የዋስትና መዝገብ በቋሚነት ይሰረዛል።"
        itemName={deleteTarget?._productName}
        itemType={deleteTarget?._code}
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

function WarrantyForm({ item, orders, products, branches, userBranchId, isSeller, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    order: item?._order?._id || item?.order || '',
    product: item?._product?._id || item?.product || '',
    itemType: item?.itemType || '',
    price: item?.price ?? item?._price ?? '',
    customerName: item?._customerName || '',
    customerPhone: item?._customerPhone || '',
    startDate: item?._startDate ? new Date(item._startDate).toISOString().slice(0, 10) : today,
    durationMonths: item?._durationMonths || DEFAULT_WARRANTY_MONTHS,
    status: item?._status || 'active',
    branch: item?._order?.branch?._id || item?._order?.branch || item?.branch?._id || item?.branch || userBranchId || '',
    notes: item?.notes || '',
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'durationMonths') {
      setForm((f) => ({ ...f, [name]: value === '' ? '' : Number(value) }));
    } else if (name === 'order') {
      const o = orders.find((x) => String(x._id) === String(value));
      setForm((f) => ({
        ...f,
        order: value,
        itemType: o?.itemType || f.itemType,
        customerName: o?.customerName || f.customerName,
        customerPhone: o?.customerPhone || f.customerPhone,
        branch: o?.branch?._id || o?.branch || f.branch,
        price: o?.totalPrice ?? o?.total ?? f.price,
      }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const endDate = useMemo(() => {
    if (!form.startDate || !form.durationMonths) return null;
    const d = new Date(form.startDate);
    d.setMonth(d.getMonth() + Number(form.durationMonths));
    return d;
  }, [form.startDate, form.durationMonths]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customerName.trim()) { toast.error('የደንበኛ ስም ያስፈልጋል'); return; }
    if (!form.customerPhone.trim()) { toast.error('የደንበኛ ስልክ ያስፈልጋል'); return; }
    if (!form.itemType.trim()) { toast.error('የዕቃ ዓይነት ያስፈልጋል'); return; }
    if (!form.durationMonths || form.durationMonths < 1) { toast.error('የዋስትና ጊዜ ቢያንስ 1 ወር መሆን አለበት'); return; }

    onSave({
      order: form.order || null,
      product: form.product || null,
      itemType: form.itemType.trim(),
      price: form.price === '' ? null : Number(form.price),
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      startDate: form.startDate,
      endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
      durationMonths: Number(form.durationMonths),
      status: form.status,
      branch: form.branch || null,
      notes: form.notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <FileText size={14} /> የትዕዛዝ ማገናኛ (አማራጭ)
        </h4>
        <FormField label="ትዕዛዝ ይምረጡ">
          <select name="order" value={form.order} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
            <option value="">— ያልተገናኘ —</option>
            {orders.map((o) => (
              <option key={o._id} value={o._id}>
                {o.orderNumber || `#${String(o._id).slice(-8)}`} — {o.customerName} — {o.itemType}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Package size={14} /> የዕቃ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ምርት ይምረጡ (አማራጭ)">
            <select name="product" value={form.product} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
              <option value="">— ያልተገናኘ —</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="የዕቃ ዓይነት *">
            <input name="itemType" value={form.itemType} onChange={onChange} required
              placeholder="ለምሳሌ: ኤሌክትሪክ ምጣድ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
          <FormField label="የተገዛበት ዋጋ (ብር)">
            <input type="number" name="price" min={0} value={form.price} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <User size={14} /> የደንበኛ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ስም *">
            <input name="customerName" value={form.customerName} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
          <FormField label="ስልክ *">
            <input name="customerPhone" value={form.customerPhone} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Calendar size={14} /> የዋስትና ጊዜ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="የጀመረበት ቀን *">
            <input type="date" name="startDate" value={form.startDate} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
          <FormField label="የዋስትና ጊዜ (ወራት) *">
            <input type="number" name="durationMonths" value={form.durationMonths} onChange={onChange} required min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>
          <FormField label="የሚያልቅበት ቀን (በራስ-ሰር)">
            <input type="text" value={endDate ? formatEthiopianDate(endDate) : '—'} readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ሁኔታ">
          <select name="status" value={form.status} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
            {Object.entries(WARRANTY_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="ቅርንጫፍ">
          <select name="branch" value={form.branch} onChange={onChange}
            disabled={isSeller && !!userBranchId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 disabled:opacity-60">
            <option value="">— ይምረጡ —</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="ማስታወሻ">
        <textarea name="notes" value={form.notes} onChange={onChange} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white resize-none" />
      </FormField>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          {item ? 'አስተካክል' : 'መዝግብ'}
        </button>
      </div>
    </form>
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

function WarrantyView({ item, onDownload }) {
  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-lg bg-brand text-white flex items-center justify-center">
          <ShieldCheck size={26} />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{item._productName}</p>
          <p className="text-sm text-gray-500 font-mono">{item._code}</p>
        </div>
        <div className="ml-auto">
          <Badge color={item._statusColor}>{item._statusLabel}</Badge>
        </div>
      </div>
      <div className="space-y-3 pt-4 text-sm">
        <Section title="የዋስትና ዝርዝር">
          <Row label="የጀመረበት" value={formatEthiopianDate(item._startDate)} />
          <Row label="የሚያልቅበት" value={formatEthiopianDate(item._endDate)} />
          <Row label="ጊዜ" value={`${item._durationMonths} ወራት`} />
          <Row label="የተገዛበት ዋጋ" value={item._price != null ? formatETB(item._price) : '—'} />
          <Row label="የቀረ ቀን"
            value={item._daysLeft === null ? '—' : item._daysLeft < 0 ? `${Math.abs(item._daysLeft)} ቀን አልፏል` : `${item._daysLeft} ቀን`}
            bold
            color={item._daysLeft === null ? 'text-gray-800' : item._daysLeft < 0 ? 'text-red-600' : item._daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'}
          />
        </Section>
        <Section title="ደንበኛ">
          <Row label="ስም" value={item._customerName} />
          <Row label="ስልክ" value={item._customerPhone} />
        </Section>
        <Section title="ቦታ">
          <Row label="ቅርንጫፍ" value={item._branch} />
          <Row label="አድራሻ" value={item._branchAddress || '—'} />
        </Section>
        {item.notes && (
          <Section title="ማስታወሻ">
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{item.notes}</p>
          </Section>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
        <button type="button" onClick={onDownload}
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition flex justify-center items-center gap-2">
          <FileDown size={18} /> ሰርተፊኬት አውርድ
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}