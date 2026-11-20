'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, FileText, Clock, Package, CheckCircle2,
  DollarSign, Calendar, User, Phone, MapPin, Building2,
  Play, Truck, Wallet,
} from 'lucide-react';
import { formatETB, formatDate } from '@/lib/utils';
import { ORDER_STATUS, ORDER_ITEM_TYPES } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

// Minimum prepayment amount
const MIN_PREPAYMENT = 1000;

const NEXT_STATUS = {
  pending:        'in_production',
  in_production:  'ready',
  ready:          'picked_up',
};

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

  const canManage = user?.role === 'admin' || user?.role === 'seller';

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
    if (user?.role === 'seller' && user?.branch) {
      const branchId = typeof user.branch === 'object' ? user.branch._id : user.branch;
      result = result.filter((o) => (o.branch?._id || o.branch) === branchId);
    }
    if (user?.role === 'customer') {
      result = result.filter((o) => o.customerPhone === user.phone);
    }
    return result;
  }, [orders, user]);

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
          {user?.role === 'seller' && user?.branch && (
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

          {user?.role === 'admin' ? (
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
                        {formatDate(order.appointmentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewOrder(order)}
                          onEdit={() => { setEditingOrder(order); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(order)}
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
            canManage={canManage}
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
        className="px-1 py-1 rounded text-gray-400 hover:text-gray-600 text-xs"
        title="ሰርዝ"
      >✕</button>
    </div>
  );
}

// ============================================================
// Order form — with MANDATORY prepayment, minimum 1000 ETB
// ============================================================
function OrderForm({ order, branches, onSave, onCancel, currentUser }) {
  const isSeller = currentUser?.role === 'seller';

  const sellerBranch = isSeller && currentUser?.branch
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
    branch: order?.branch?._id || order?.branch || sellerBranch,
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
      itemType: form.itemType,
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
            <select name="itemType" value={form.itemType} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
              {ORDER_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="ብዛት *">
            <input type="number" name="quantity" value={form.quantity} onChange={onChange} required min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="የአንድ ዋጋ (ETB) *">
            <input type="number" name="unitPrice" value={form.unitPrice} onChange={onChange} required min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="የትዕዛዝ ቀን *">
            <input type="date" name="orderDate" value={form.orderDate} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ቀጠሮ ቀን *">
            <input type="date" name="appointmentDate" value={form.appointmentDate} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>

          <FormField label="ቅርንጫፍ *">
            {isSeller ? (
              <div className="w-full px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                {typeof currentUser.branch === 'object' ? currentUser.branch?.name : 'ቅርንጫፍ'}
              </div>
            ) : (
              <select name="branch" value={form.branch} onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
                <option value="">— ይምረጡ —</option>
                {branches.length === 0 ? (
                  <option value="" disabled>ቅርንጫፍ በመጫን ላይ...</option>
                ) : (
                  branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)
                )}
              </select>
            )}
          </FormField>

          <FormField label="ሁኔታ">
            <select name="status" value={form.status} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label || v}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* Measurements */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">ልኬት</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="ስፋት">
            <input type="number" name="width" value={form.measurements.width} onChange={onMeasurementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ቁመት">
            <input type="number" name="height" value={form.measurements.height} onChange={onMeasurementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ጥልቀት">
            <input type="number" name="depth" value={form.measurements.depth} onChange={onMeasurementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="መለኪያ">
            <input name="unit" value={form.measurements.unit} onChange={onMeasurementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
        </div>
      </div>

      {/* Payment — prepayment is REQUIRED, min 1000 ETB */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <DollarSign size={14} /> ክፍያ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label={`ቅድመ ክፍያ (ETB) * (ቢያንስ ${MIN_PREPAYMENT.toLocaleString()})`}>
            <input
              type="number"
              name="prepayment"
              value={form.prepayment}
              onChange={onChange}
              min={MIN_PREPAYMENT}
              step="1"
              required
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white ${
                prepaymentError ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-300'
              }`}
            />
            {prepaymentError && (
              <p className="text-[11px] text-red-600 mt-1">{prepaymentError}</p>
            )}
            {!prepaymentError && form.prepayment > 0 && (
              <p className="text-[11px] text-green-600 mt-1">✓ ትክክል</p>
            )}
          </FormField>
          <FormField label="ቀሪ ክፍያ (በራስ-ሰር)">
            <input type="number" value={remainingPayment} readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-orange-600 font-semibold cursor-not-allowed"
            />
          </FormField>
        </div>
      </div>

      <FormField label="ማስታወሻ">
        <textarea name="note" value={form.note} onChange={onChange} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm resize-none text-gray-800 bg-white"
        />
      </FormField>

      <div className="bg-blue-50 rounded-lg p-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">ጠቅላላ ዋጋ:</span>
          <span className="font-semibold text-gray-800">{formatETB(totalPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">ቅድመ ክፍያ:</span>
          <span className={`font-semibold ${form.prepayment >= MIN_PREPAYMENT ? 'text-green-600' : 'text-red-600'}`}>
            {formatETB(form.prepayment)}
          </span>
        </div>
        <div className="flex justify-between pt-1.5 border-t border-blue-200">
          <span className="text-gray-600 font-medium">ቀሪ ክፍያ:</span>
          <span className="font-bold text-brand">{formatETB(remainingPayment)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button
          type="submit"
          disabled={Boolean(prepaymentError)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed">
          {order ? 'አስተካክል' : 'ጨምር'}
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

// ============================================================
// Order view
// ============================================================
function OrderView({ order, onAdvanceStatus, onAddPayment, canManage }) {
  const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' };
  const next = NEXT_STATUS[order.status];
  const nextLabel = next ? (ORDER_STATUS[next]?.label || next) : null;

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const remaining = Number(order.remainingPayment) || 0;

  const handleAdd = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('መጠን ያስገቡ'); return; }
    if (amt > remaining) { toast.error('ከቀሪ መብለጥ አይችልም'); return; }
    setBusy(true);
    try { await onAddPayment(amt); setAmount(''); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center">
          <FileText size={28} className="text-brand" />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{order.customerName}</p>
          <p className="text-sm text-gray-500 font-mono">{order.orderNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-4">
        <StatBox label="ጠቅላላ" value={formatETB(order.totalPrice || 0)} icon={DollarSign} color="text-blue-600 bg-blue-50" />
        <StatBox label="ቅድመ" value={formatETB(order.prepayment || 0)} icon={CheckCircle2} color="text-green-600 bg-green-50" />
        <StatBox label="ቀሪ" value={formatETB(remaining)} icon={Clock} color="text-red-600 bg-red-50" />
      </div>

      {canManage && remaining > 0 && (
        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
          <p className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1">
            <Wallet size={12} /> ክፍያ መዝግብ
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`ቀሪ ${formatETB(remaining)}`}
              min={0}
              max={remaining}
              step="0.01"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand bg-white"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? '...' : 'መዝግብ'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-3 border-t border-gray-100 text-sm mt-3">
        <Row label="ዕቃ" value={order.itemType + ' × ' + order.quantity} icon={Package} />
        <Row label="ስልክ" value={order.customerPhone} icon={Phone} />
        <Row label="አድራሻ" value={order.address} icon={MapPin} />
        <Row label="ቅርንጫፍ" value={order.branch?.name || '-'} icon={Building2} />
        <Row label="የትዕዛዝ ቀን" value={formatDate(order.orderDate || order.createdAt)} icon={Calendar} />
        <Row label="ቀጠሮ" value={formatDate(order.appointmentDate)} icon={Calendar} />
        {order.measurements?.width && (
          <Row label="ልኬት" value={order.measurements.width + ' × ' + order.measurements.height + ' ' + order.measurements.unit} />
        )}
        {order.note && <Row label="ማስታወሻ" value={order.note} />}
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ሁኔታ:</span>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
        <Row label="የተፈጠረ" value={formatDate(order.createdAt)} />
      </div>

      {canManage && next && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onAdvanceStatus}
            className="w-full px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition inline-flex items-center justify-center gap-2"
          >
            <Truck size={16} />
            ወደ "{nextLabel}" አሻግር
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  const parts = color.split(' ');
  return (
    <div className={'rounded-lg p-2.5 text-center ' + parts[1]}>
      <div className="flex items-center justify-center mb-1">
        <Icon size={16} className={parts[0]} />
      </div>
      <p className="text-xs font-bold text-gray-800">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}:
      </span>
      <span className="text-right text-gray-800">{value}</span>
    </div>
  );
}