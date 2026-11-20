'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import {
  ShoppingBag, Search, RefreshCw, AlertCircle, Building2, Package,
  Download, Plus, Receipt, Wallet, TrendingUp, Phone,
  ClipboardList, Box, CheckCircle2, Eye,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatETB, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

// ---------- Helpers ----------
const getBuyPrice = (p) => Number(
  p?.costPrice ?? p?.purchasePrice ?? p?.buyingPrice ??
  p?.cost ?? p?.capital ?? p?.wholesalePrice ??
  p?.unitPrice ?? 0
) || 0;

const getSellPrice = (p) => Number(
  p?.sellingPrice ?? p?.price ?? p?.salePrice ??
  p?.retailPrice ?? p?.unitPrice ?? 0
) || 0;

const FINISHED_STATUSES = ['picked_up', 'delivered', 'completed', 'paid'];

const isSoldOrder = (o) => {
  if (!o) return false;
  if (FINISHED_STATUSES.includes(o.status)) return true;
  const total = Number(o.totalPrice) || 0;
  const paid  = Number(o.prepayment) || 0;
  const rem   = Number(o.remainingPayment);
  if (total > 0 && paid >= total) return true;
  if (Number.isFinite(rem) && rem === 0 && total > 0) return true;
  return false;
};

// ---------- Origin detection ----------
// An order originated from a product if `product` is set.
const isFromProduct = (row) =>
  Boolean(row?._productId || row?.product?._id || row?.product);

const ORDER_STATUS = {
  pending:       { label: 'በመጠባበቅ', color: 'yellow' },
  in_production: { label: 'በምርት ላይ', color: 'blue'   },
  ready:         { label: 'ዝግጁ',     color: 'green'  },
  picked_up:     { label: 'ተነስቷል',   color: 'green'  },
  delivered:     { label: 'ተላልፏል',   color: 'green'  },
  completed:     { label: 'ተጠናቅቋል', color: 'green'  },
  paid:          { label: 'ተከፍሏል',   color: 'green'  },
  cancelled:     { label: 'ተሰርዟል',   color: 'red'    },
};

export default function SoldItemsPage() {
  const { user } = useAuth();

  const [orders, setOrders]     = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch]             = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // ---- Modal states: separate for ADD, EDIT (product), EDIT (order), VIEW ----
  const [showAdd, setShowAdd]         = useState(false);
  const [editProduct, setEditProduct] = useState(null);   // row with product origin
  const [editOrder, setEditOrder]     = useState(null);   // row with order origin
  const [viewRow, setViewRow]         = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  const isSeller   = user?.role === 'seller';
  const canManage  = user?.role === 'admin' || isSeller;
  const canView    = user?.role === 'admin' || isSeller;

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
        const [oRes, pRes, bRes] = await Promise.all([
          apiFetch('/orders').catch(() => []),
          apiFetch('/products').catch(() => []),
          apiFetch('/branches').catch(() => []),
        ]);
        if (!alive) return;
        setOrders(Array.isArray(oRes) ? oRes : oRes?.data ?? []);
        setProducts(Array.isArray(pRes) ? pRes : pRes?.data ?? []);
        setBranches(Array.isArray(bRes) ? bRes : bRes?.data ?? []);
      } catch (err) {
        if (alive) { setOrders([]); setError(err?.message || 'ውሂብ ማምጣት አልተቻለም'); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const productMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      if (p._id)  m.set(String(p._id), p);
      if (p.id)   m.set(String(p.id), p);
      if (p.code) m.set(String(p.code), p);
    });
    return m;
  }, [products]);

  const soldOrders = useMemo(() => {
    const sold = orders.filter(isSoldOrder);
    return isSeller && userBranchId
      ? sold.filter((o) => {
          const bid = o?.branch?._id ?? o?.branch ?? o?.branchId;
          return bid === userBranchId;
        })
      : sold;
  }, [orders, isSeller, userBranchId]);

  const enriched = useMemo(() => {
    return soldOrders.map((o) => {
      const candidateIds = [o?.product?._id, o?.product, o?.productId, o?.productCode]
        .filter(Boolean).map(String);

      let product = null;
      for (const id of candidateIds) {
        const hit = productMap.get(id);
        if (hit) { product = hit; break; }
      }

      const costPrice = getBuyPrice(product);
      const sellFromProduct = getSellPrice(product);
      const qty       = Number(o.quantity) || 1;
      const unitPrice = Number(
        o.unitPrice || o.price || sellFromProduct ||
        (o.totalPrice ? o.totalPrice / (qty || 1) : 0)
      ) || 0;
      const revenue   = Number(o.totalPrice) || unitPrice * qty;
      const cost      = costPrice * qty;
      const profit    = revenue - cost;

      return {
        ...o,
        _code:        o.orderNumber || o.code || `#${String(o._id).slice(-8)}`,
        _productId:   product?._id || '',
        _product:     product,
        _productName: product?.name || o.itemType || 'Unknown',
        _category:    product?.category || o.category || '—',
        _costPrice:   costPrice,
        _costTotal:   cost,
        _profit:      profit,
        _statusLabel: ORDER_STATUS[o.status]?.label || o.status || '—',
        _statusColor: ORDER_STATUS[o.status]?.color || 'gray',
        _origin:      (product?._id || o?.product) ? 'product' : 'order',
      };
    });
  }, [soldOrders, productMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo)   : null;
    if (to) to.setHours(23, 59, 59, 999);

    return enriched.filter((o) => {
      if (q) {
        const hay = [
          o._code, o.customerName, o.customerPhone,
          o._productName, o._category, o.address,
        ].map((v) => String(v || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      const bid = o?.branch?._id ?? o?.branch ?? o?.branchId;
      if (branchFilter !== 'all' && bid !== branchFilter) return false;
      if (from || to) {
        const d0 = o.orderDate || o.createdAt;
        const d = d0 ? new Date(d0) : null;
        if (!d) return false;
        if (from && d < from) return false;
        if (to   && d > to)   return false;
      }
      return true;
    });
  }, [enriched, search, branchFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const totalRevenue = filtered.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
    const totalCost    = filtered.reduce((s, o) => s + (Number(o._costTotal) || 0), 0);
    const totalProfit  = totalRevenue - totalCost;
    return { totalRevenue, totalCost, totalProfit, count: filtered.length };
  }, [filtered]);

  function exportCsv() {
    const headers = [
      'ኮድ', 'ቀን', 'ስም', 'ስልክ', 'ምድብ',
      'ብዛት', 'የመግዣ', 'የመሸጫ', 'ጠቅላላ', 'ትርፍ',
      'ቅርንጫፍ', 'አድራሻ', 'ማስታወሻ',
    ];
    const lines = [headers.join(',')];
    filtered.forEach((o) => {
      const d0 = o.orderDate || o.createdAt;
      const d  = d0 ? new Date(d0).toISOString().slice(0, 10) : '';
      const row = [
        o._code, d, o.customerName, o.customerPhone, o._category,
        o.quantity, o._costPrice, o.unitPrice, o.totalPrice, o._profit,
        o.branch?.name, o.address, o.note,
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      lines.push(row);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `sold-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV ተወርዷል');
  }

  // ---- Save: create / edit product / edit order ----
  async function handleCreate(payload) {
    try {
      const created = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setOrders((prev) => [created, ...prev]);
      toast.success('ሽያጭ ተመዝግቧል');
      setShowAdd(false);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  }

  async function handleEditProduct(rowId, payload) {
    try {
      const updated = await apiFetch(`/orders/${rowId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setOrders((prev) => prev.map((o) => (o._id === rowId ? { ...o, ...updated } : o)));
      toast.success('ሽያጭ ተስተካክሏል');
      setEditProduct(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  }

  async function handleEditOrder(rowId, payload) {
    try {
      const updated = await apiFetch(`/orders/${rowId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setOrders((prev) => prev.map((o) => (o._id === rowId ? { ...o, ...updated } : o)));
      toast.success('ትዕዛዝ ተስተካክሏል');
      setEditOrder(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/orders/${deleteTarget._id}`, { method: 'DELETE' });
      setOrders((prev) => prev.filter((o) => o._id !== deleteTarget._id));
      toast.success('ሽያጭ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  }

  function onEditClick(row) {
    if (isFromProduct(row)) {
      setEditProduct(row);
    } else {
      setEditOrder(row);
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ShoppingBag size={40} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ፍቃድ የለዎትም</h1>
        <p className="text-gray-600">ይህ ገጽ ለአስተዳዳሪ እና ሻጭ ብቻ ነው።</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">የተሸጡ እቃዎች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSeller ? 'የእርስዎ ቅርንጫፍ ሽያጮች' : 'ሁሉም ሽያጮች'} · {filtered.length} ትዕዛዞች
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'በመጫን ላይ…' : 'አድስ'}
          </button>
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-40">
            <Download size={13} /> CSV
          </button>
          {canManage && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} /> አዲስ ሽያጭ
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="ጠቅላላ ገቢ"  value={formatETB(summary.totalRevenue)} icon={Receipt}    color="bg-green-500" />
        <SummaryCard label="ጠቅላላ ወጪ"  value={formatETB(summary.totalCost)}    icon={Wallet}     color="bg-red-500" />
        <SummaryCard label="ጠቅላላ ትርፍ" value={formatETB(summary.totalProfit)}  icon={TrendingUp} color="bg-brand" />
      </div>

      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ፍለጋ</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ኮድ፣ ስም፣ ስልክ፣ ምድብ…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand focus:outline-none" />
            </div>
          </div>
          {!isSeller && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ቅርንጫፍ</label>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand focus:outline-none bg-white">
                <option value="all">ሁሉም</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ከ</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">እስከ</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs focus:border-brand focus:outline-none" />
            </div>
          </div>
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

      <Card padding="none">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">በመጫን ላይ…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={26} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">ምንም ሽያጭ አልተገኘም</p>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              ሽያጭ ለመመዝገብ <strong>አዲስ ሽያጭ</strong> ይጫኑ ወይም ትዕዛዞችን ያጠናቅቁ።
            </p>
            {canManage && (
              <Button onClick={() => setShowAdd(true)}>
                <Plus size={14} /> የመጀመሪያውን ሽያጭ ይመዝግቡ
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">ኮድ</th>
                  <th className="px-4 py-3 font-medium">ስም</th>
                  <th className="px-4 py-3 font-medium">ምድብ</th>
                  <th className="px-4 py-3 font-medium text-right">ብዛት</th>
                  <th className="px-4 py-3 font-medium text-right">የመግዣ</th>
                  <th className="px-4 py-3 font-medium text-right">የመሸጫ</th>
                  <th className="px-4 py-3 font-medium text-right">ትርፍ</th>
                  <th className="px-4 py-3 font-medium">ሁኔታ</th>
                  {canManage && <th className="px-4 py-3 font-medium text-center">ተግባር</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{o._code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{o._productName}</p>
                      <p className="text-xs text-gray-500">{o.customerName} · {o.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{o._category}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{o.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatETB(o._costPrice || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">{formatETB(o.unitPrice || 0)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${o._profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatETB(o._profit)}
                    </td>
                    <td className="px-4 py-3"><Badge color={o._statusColor}>{o._statusLabel}</Badge></td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewRow(o)}
                          onEdit={() => onEditClick(o)}
                          onDelete={() => setDeleteTarget(o)}
                          canEdit={true}
                          canDelete={true}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ============ ADD MODAL ============ */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="አዲስ ሽያጭ መዝግብ"
        size="lg"
      >
        <AddSaleForm
          orders={orders}
          products={products}
          branches={branches}
          userBranchId={userBranchId}
          isSeller={isSeller}
          onCreate={handleCreate}
          onCompleteOrder={(orderId) => handleEditOrder(orderId, { status: 'completed' })}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* ============ EDIT — FROM PRODUCT ============ */}
      <Modal
        isOpen={!!editProduct}
        onClose={() => setEditProduct(null)}
        title="ሽያጭ አስተካክል (ከምርት)"
        size="lg"
      >
        {editProduct && (
          <EditProductForm
            row={editProduct}
            products={products}
            branches={branches}
            userBranchId={userBranchId}
            isSeller={isSeller}
            onSave={(payload) => handleEditProduct(editProduct._id, payload)}
            onCancel={() => setEditProduct(null)}
          />
        )}
      </Modal>

      {/* ============ EDIT — FROM ORDER ============ */}
      <Modal
        isOpen={!!editOrder}
        onClose={() => setEditOrder(null)}
        title="ትዕዛዝ አስተካክል (ከትዕዛዝ)"
      >
        {editOrder && (
          <EditOrderForm
            row={editOrder}
            onSave={(payload) => handleEditOrder(editOrder._id, payload)}
            onCancel={() => setEditOrder(null)}
          />
        )}
      </Modal>

      {/* ============ VIEW ============ */}
      <Modal isOpen={!!viewRow} onClose={() => setViewRow(null)} title="የሽያጭ ዝርዝር">
        {viewRow && <SoldItemView row={viewRow} />}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ሽያጭ ይሰርዝ?"
        message="ይህ የሽያጭ መዝገብ በቋሚነት ይሰረዛል። ይህ እርምጃ መመለስ አይቻልም።"
        itemName={deleteTarget?._productName}
        itemType={`${deleteTarget?.quantity || 0} × ${formatETB(deleteTarget?.unitPrice || 0)}`}
        confirmLabel="አዎ፣ ሰርዝ"
        cancelLabel="ተወው"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl md:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </Card>
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

// ============================================================
// ADD FORM — 2 tabs: from product / from order
// ============================================================

function AddSaleForm({ orders, products, branches, userBranchId, isSeller, onCreate, onCompleteOrder, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState('product');

  const [form, setForm] = useState({
    productId:     '',
    customerName:  '',
    customerPhone: '',
    address:       '',
    quantity:      1,
    orderDate:     today,
    branch:        userBranchId || '',
    note:          '',
  });

  const selectedProduct = products.find((p) => String(p._id) === String(form.productId));
  const unitPrice = getSellPrice(selectedProduct);
  const costPrice = getBuyPrice(selectedProduct);

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'quantity') {
      setForm((f) => ({ ...f, quantity: value === '' ? '' : Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.productId) { toast.error('ምርት ይምረጡ'); return; }
    if (!form.customerName.trim()) { toast.error('የደንበኛ ስም ያስፈልጋል'); return; }
    if (!form.customerPhone.trim()) { toast.error('የደንበኛ ስልክ ያስፈልጋል'); return; }
    if (!form.branch) { toast.error('ቅርንጫፍ ይምረጡ'); return; }

    const qty = Number(form.quantity) || 1;
    const totalPrice = qty * unitPrice;

    onCreate({
      product:       form.productId,
      itemType:      selectedProduct?.name || form.productId,
      category:      selectedProduct?.category || '',
      customerName:  form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      address:       form.address.trim(),
      quantity:      qty,
      unitPrice:     unitPrice,
      totalPrice:    totalPrice,
      prepayment:    0,
      remainingPayment: totalPrice,
      status:        'completed',
      orderDate:     form.orderDate,
      appointmentDate: form.orderDate,
      branch:        form.branch,
      note:          form.note.trim(),
    });
  };

  const openOrders = useMemo(() => {
    return orders.filter((o) => {
      if (FINISHED_STATUSES.includes(o.status)) return false;
      if (o.status === 'cancelled') return false;
      if (isSeller && userBranchId) {
        const bid = o?.branch?._id ?? o?.branch ?? o?.branchId;
        return bid === userBranchId;
      }
      return true;
    });
  }, [orders, isSeller, userBranchId]);

  const productByOrder = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      if (p._id)  m.set(String(p._id), p);
      if (p.id)   m.set(String(p.id), p);
      if (p.code) m.set(String(p.code), p);
    });
    return m;
  }, [products]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 rounded-lg bg-gray-100">
        <button type="button" onClick={() => setMode('product')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
            mode === 'product' ? 'bg-white text-brand shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}>
          <Box size={14} /> ከሱቅ እቃዎች
        </button>
        <button type="button" onClick={() => setMode('order')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
            mode === 'order' ? 'bg-white text-brand shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}>
          <ClipboardList size={14} /> ከትዕዛዝ
          {openOrders.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold">
              {openOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* From product */}
      {mode === 'product' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="ምርት ይምረጡ *" full>
            <select name="productId" value={form.productId} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
              <option value="">— ከተመዘገቡ ምርቶች ይምረጡ —</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </FormField>

          {selectedProduct && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">ምድብ</p>
                <p className="text-sm font-semibold text-gray-800">{selectedProduct.category || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">የመግዣ</p>
                <p className="text-sm font-semibold text-gray-800">{formatETB(costPrice)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">የመሸጫ</p>
                <p className="text-sm font-semibold text-brand">{formatETB(unitPrice)}</p>
              </div>
            </div>
          )}

          <FormField label="ብዛት *">
            <input type="number" name="quantity" value={form.quantity} onChange={onChange} required min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="የደንበኛ ስም *">
              <input name="customerName" value={form.customerName} onChange={onChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            </FormField>
            <FormField label="ስልክ *">
              <input name="customerPhone" value={form.customerPhone} onChange={onChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            </FormField>
            <FormField label="አድራሻ" full>
              <input name="address" value={form.address} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="ቀን *">
              <input type="date" name="orderDate" value={form.orderDate} onChange={onChange} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
            </FormField>
            <FormField label="ቅርንጫፍ *">
              <select name="branch" value={form.branch} onChange={onChange} required
                disabled={isSeller && !!userBranchId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 disabled:opacity-60">
                <option value="">— ይምረጡ —</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="ማስታወሻ">
            <textarea name="note" value={form.note} onChange={onChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white resize-none" />
          </FormField>

          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
              ሰርዝ
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
              ሽያጭ መዝግብ
            </button>
          </div>
        </form>
      )}

      {/* From order */}
      {mode === 'order' && (
        <div className="space-y-3">
          {openOrders.length === 0 ? (
            <div className="p-8 text-center rounded-lg bg-yellow-50 border border-yellow-200">
              <CheckCircle2 size={32} className="text-yellow-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-yellow-800">ምንም ያልተጠናቀቀ ትዕዛዝ የለም</p>
              <p className="text-xs text-yellow-700 mt-1">
                ትዕዛዞችን በ<Link href="/dashboard/orders" className="text-brand underline mx-1">ትዕዛዞች ገጽ</Link>ይፍጠሩ።
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-3 py-2 font-medium">ኮድ</th>
                    <th className="px-3 py-2 font-medium">ስም</th>
                    <th className="px-3 py-2 font-medium">ምድብ</th>
                    <th className="px-3 py-2 font-medium text-right">ብዛት</th>
                    <th className="px-3 py-2 font-medium text-right">የመግዣ</th>
                    <th className="px-3 py-2 font-medium text-right">የመሸጫ</th>
                    <th className="px-3 py-2 font-medium text-right">ትርፍ</th>
                    <th className="px-3 py-2 font-medium">ሁኔታ</th>
                    <th className="px-3 py-2 font-medium">ተግባር</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {openOrders.map((o) => {
                    const product = productByOrder.get(String(o?.product?._id ?? o?.product ?? ''));
                    const costPrice = getBuyPrice(product);
                    const qty = Number(o.quantity) || 1;
                    const unit = Number(o.unitPrice) || getSellPrice(product) || 0;
                    const revenue = Number(o.totalPrice) || unit * qty;
                    const profit = revenue - costPrice * qty;
                    const status = ORDER_STATUS[o.status] || { label: o.status || '—', color: 'gray' };
                    return (
                      <tr key={o._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-brand">
                          {o.orderNumber || `#${String(o._id).slice(-8)}`}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800 text-xs">{product?.name || o.itemType || '—'}</p>
                          <p className="text-[10px] text-gray-500">{o.customerName}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{product?.category || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-800 text-xs">{qty}</td>
                        <td className="px-3 py-2 text-right text-gray-600 text-xs">{formatETB(costPrice)}</td>
                        <td className="px-3 py-2 text-right text-brand font-semibold text-xs">{formatETB(unit)}</td>
                        <td className={`px-3 py-2 text-right font-semibold text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatETB(profit)}
                        </td>
                        <td className="px-3 py-2"><Badge color={status.color}>{status.label}</Badge></td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => { onCompleteOrder(o._id); onCancel(); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-brand text-white hover:bg-brand-dark">
                            <CheckCircle2 size={11} /> ጨርስ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
              ዝጋ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EDIT FORM — FROM PRODUCT (shows product picker)
// ============================================================
function EditProductForm({ row, products, branches, userBranchId, isSeller, onSave, onCancel }) {
  const [form, setForm] = useState({
    productId:     row?._productId || '',
    customerName:  row?.customerName || '',
    customerPhone: row?.customerPhone || '',
    address:       row?.address || '',
    quantity:      row?.quantity || 1,
    orderDate:     row?.orderDate ? new Date(row.orderDate).toISOString().slice(0, 10) : '',
    branch:        row?.branch?._id || row?.branch || userBranchId || '',
    note:          row?.note || '',
  });

  const selectedProduct = products.find((p) => String(p._id) === String(form.productId));
  const unitPrice = getSellPrice(selectedProduct) || Number(row?.unitPrice) || 0;

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'quantity') {
      setForm((f) => ({ ...f, quantity: value === '' ? '' : Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.productId) { toast.error('ምርት ይምረጡ'); return; }
    if (!form.customerName.trim()) { toast.error('የደንበኛ ስም ያስፈልጋል'); return; }
    if (!form.customerPhone.trim()) { toast.error('የደንበኛ ስልክ ያስፈልጋል'); return; }

    const qty = Number(form.quantity) || 1;
    const totalPrice = qty * unitPrice;

    onSave({
      product:       form.productId,
      itemType:      selectedProduct?.name || form.productId,
      category:      selectedProduct?.category || '',
      customerName:  form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      address:       form.address.trim(),
      quantity:      qty,
      unitPrice:     unitPrice,
      totalPrice:    totalPrice,
      prepayment:    0,
      remainingPayment: totalPrice,
      status:        'completed',
      orderDate:     form.orderDate,
      branch:        form.branch,
      note:          form.note.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="ምርት ይምረጡ *" full>
        <select name="productId" value={form.productId} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
          <option value="">— ከተመዘገቡ ምርቶች ይምረጡ —</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </FormField>

      <FormField label="ብዛት *">
        <input type="number" name="quantity" value={form.quantity} onChange={onChange} required min={1}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="የደንበኛ ስም *">
          <input name="customerName" value={form.customerName} onChange={onChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
        </FormField>
        <FormField label="ስልክ *">
          <input name="customerPhone" value={form.customerPhone} onChange={onChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
        </FormField>
        <FormField label="አድራሻ" full>
          <input name="address" value={form.address} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ቀን *">
          <input type="date" name="orderDate" value={form.orderDate} onChange={onChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white" />
        </FormField>
        <FormField label="ቅርንጫፍ *">
          <select name="branch" value={form.branch} onChange={onChange} required
            disabled={isSeller && !!userBranchId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 disabled:opacity-60">
            <option value="">— ይምረጡ —</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="ማስታወሻ">
        <textarea name="note" value={form.note} onChange={onChange} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white resize-none" />
      </FormField>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          አስተካክል
        </button>
      </div>
    </form>
  );
}

// ============================================================
// EDIT FORM — FROM ORDER (read-only order details + status change)
// ============================================================
function EditOrderForm({ row, onSave, onCancel }) {
  const [status, setStatus] = useState(row?.status || 'completed');
  const [note, setNote] = useState(row?.note || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ status, note: note.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2 text-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase">የትዕዛዝ መረጃ (አንባቢ ብቻ)</p>
        <Row label="ኮድ"      value={row._code} mono />
        <Row label="ደንበኛ"   value={row.customerName} />
        <Row label="ስልክ"      value={row.customerPhone} />
        <Row label="ዕቃ"      value={`${row.itemType} × ${row.quantity}`} />
        <Row label="ጠቅላላ"    value={formatETB(row.totalPrice || 0)} bold color="text-brand" />
        <Row label="ቅድሚያ"   value={formatETB(row.prepayment || 0)} />
        <Row label="ቀሪ"      value={formatETB(row.remainingPayment || 0)} color="text-orange-600" />
      </div>

      <FormField label="ሁኔታ">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800">
          <option value="pending">በመጠባበቅ</option>
          <option value="in_production">በምርት ላይ</option>
          <option value="ready">ዝግጁ</option>
          <option value="picked_up">ተነስቷል</option>
          <option value="delivered">ተላልፏል</option>
          <option value="completed">ተጠናቅቋል</option>
          <option value="paid">ተከፍሏል</option>
          <option value="cancelled">ተሰርዟል</option>
        </select>
      </FormField>

      <FormField label="ማስታወሻ">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white resize-none" />
      </FormField>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          አስተካክል
        </button>
      </div>
    </form>
  );
}

// ============================================================
// VIEW — shows the details (includes origin note)
// ============================================================
function SoldItemView({ row }) {
  const revenue = Number(row.totalPrice) || 0;
  const cost    = Number(row._costTotal) || 0;
  const profit  = revenue - cost;
  const originLabel = row._origin === 'product' ? 'ከምርት' : 'ከትዕዛዝ';

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-lg bg-brand text-white flex items-center justify-center">
          <Package size={26} />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{row._productName}</p>
          <p className="text-sm text-gray-500 font-mono">{row._code}</p>
        </div>
        <div className="ml-auto"><Badge color={row._statusColor}>{row._statusLabel}</Badge></div>
      </div>
      <div className="space-y-3 pt-4 text-sm">
        <Section title="የሽያጭ ዝርዝር">
          <Row label="ምንጭ"    value={originLabel} />
          <Row label="ቀን"      value={formatDate(row.orderDate || row.createdAt)} />
          <Row label="ምድብ"    value={row._category || '—'} />
          <Row label="ብዛት"      value={row.quantity ?? 0} />
          <Row label="የመሸጫ"   value={formatETB(row.unitPrice || 0)} />
          <Row label="የመግዣ"   value={formatETB(row._costPrice || 0)} />
          <Row label="ጠቅላላ ገቢ" value={formatETB(revenue)} bold color="text-brand" />
          <Row label="ጠቅላላ ወጪ" value={formatETB(cost)} />
          <Row label="ትርፍ"     value={formatETB(profit)} bold color={profit >= 0 ? 'text-green-600' : 'text-red-600'} />
        </Section>
        <Section title="ደንበኛ">
          <Row label="ስም"       value={row.customerName || '—'} />
          <Row label="ስልክ"       value={row.customerPhone || '—'} />
          <Row label="አድራሻ"     value={row.address || '—'} />
        </Section>
        <Section title="ቦታ">
          <Row label="ቅርንጫፍ"  value={row.branch?.name || '—'} />
          <Row label="የፈጠረው" value={row.createdBy?.fullName || '—'} />
        </Section>
        {row.note && (
          <Section title="ማስታወሻ">
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2">{row.note}</p>
          </Section>
        )}
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

function Row({ label, value, bold, color, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''} ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}