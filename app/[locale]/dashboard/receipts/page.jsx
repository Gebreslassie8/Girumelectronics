'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, FileText, CheckCircle2, Clock, AlertTriangle,
  User, Phone, Calendar, Building2, DollarSign,
  Printer, Download, MapPin, Hash, Package,
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

// ✅ Ethiopian calendar date formatter (replaces formatDate everywhere in this file)
const formatEthiopianDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch (e) {
    return d.toLocaleDateString('am-ET');
  }
};

// Shows the Ethiopian date under a Gregorian <input type="date">
function EthDatePreview({ value }) {
  if (!value) return null;
  // noon avoids timezone shifting the day
  const eth = formatEthiopianDate(`${value}T12:00:00`);
  return (
    <p className="text-[11px] text-brand font-medium mt-1 flex items-center gap-1">
      <Calendar size={10} /> {eth}
    </p>
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

    // Create a hidden iframe with the receipt
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

        // Copy fonts from parent for Amharic
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

        // Trigger native print dialog (browser renders to PDF perfectly)
        iframeWindow.focus();
        iframeWindow.print();

        // Cleanup after a delay
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
          <h1 className="text-2xl font-bold text-gray-800">ደረሰኞች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ደረሰኞች · {formatETB(stats.totalPrepaid)} የተከፈለ
          </p>
          {user?.role === 'seller' && userBranchId && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
          {user?.role === 'customer' && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <User size={12} />
              የእኔ ደረሰኞች
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={() => { setEditingReceipt(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ደረሰኝ
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ደረሰኞች" value={stats.total} icon={FileText} color="bg-blue-500" />
        <StatCard label="ንቁ" value={stats.active} icon={Clock} color="bg-green-500" />
        <StatCard label="ተጠናቋል" value={stats.completed} icon={CheckCircle2} color="bg-purple-500" />
        <StatCard label="የተከፈለ" value={formatETB(stats.totalPrepaid)} icon={DollarSign} color="bg-orange-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ደረሰኝ፣ ደንበኛ፣ ስልክ፣ ትዕዛዝ)..."
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
            {Object.entries(RECEIPT_STATUS).map(([k, v]) => (
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
              <span className="font-medium truncate">
                {user?.branch
                  ? (typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ')
                  : 'ሁሉም ቅርንጫፎች'}
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ደረሰኝ ቁጥር</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ደንበኛ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ዕቃ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ጠቅላላ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ቅድመ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ቀሪ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ሁኔታ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ቀን</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <FileText size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">
                        {user?.role === 'customer' ? 'የእርስዎ ደረሰኝ የለም' : 'ምንም ደረሰኝ አልተገኘም'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((receipt) => {
                  const status = RECEIPT_STATUS[receipt.status] || { label: receipt.status, color: 'gray' };
                  return (
                    <tr key={receipt._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-medium">
                        {receipt.receiptNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{receipt.customerName}</p>
                        <p className="text-xs text-gray-500">{receipt.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {receipt.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatETB(receipt.totalPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {formatETB(receipt.prepayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        {formatETB(receipt.remainingPayment || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <FormField label="ስልክ">
            <input name="customerPhone" value={form.customerPhone} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <FileText size={14} /> የትዕዛዝ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="የትዕዛዝ ቁጥር">
            <input name="orderNumber" value={form.orderNumber} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="የምርት ኮድ">
            <input name="productCode" value={form.productCode} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="የዕቃ ዓይነት *">
            <input name="itemType" value={form.itemType} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="የትዕዛዝ ቀን *">
            <input type="date" name="orderDate" value={form.orderDate} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
            <EthDatePreview value={form.orderDate} />
          </FormField>
          <FormField label="ቀጠሮ ቀን *" full>
            <input type="date" name="appointmentDate" value={form.appointmentDate} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
            <EthDatePreview value={form.appointmentDate} />
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <DollarSign size={14} /> ክፍያ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ጠቅላላ ዋጋ *">
            <input type="number" name="totalPrice" value={form.totalPrice} onChange={onChange} required min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ቅድመ ክፍያ *">
            <input type="number" name="prepayment" value={form.prepayment} onChange={onChange} required min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
        </div>

        <div className="mt-3 bg-blue-50 rounded-lg p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 font-medium">ቀሪ ክፍያ (auto):</span>
            <span className={'font-bold text-lg ' + (remaining <= 0 ? 'text-green-600' : 'text-red-600')}>
              {formatETB(remaining)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ሁኔታ">
          <select name="status" value={form.status} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
            {Object.entries(RECEIPT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>
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
      </div>

      <FormField label="ማስታወሻ">
        <textarea name="note" value={form.note} onChange={onChange} rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm resize-none text-gray-800 bg-white"
        />
      </FormField>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          {receipt ? 'አስተካክል' : 'ፍጠር'}
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

function ReceiptView({ receipt, onPrint, onDownload }) {
  const status = RECEIPT_STATUS[receipt.status] || { label: receipt.status, color: 'gray' };

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-brand to-brand-dark text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">ግሩም ምጣድ</h2>
              <p className="text-xs text-blue-100">Grum Stove</p>
              <p className="text-xs text-blue-100 mt-1">አዲስ አበባ, ኢትዮጵያ</p>
              <p className="text-xs text-blue-100">0924 254 988 · 0903 284 493</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-100 uppercase tracking-wider">ደረሰኝ ቁጥር</p>
              <p className="font-mono font-bold text-lg">{receipt.receiptNumber}</p>
              <p className="text-xs text-blue-100 mt-1">{formatEthiopianDate(receipt.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">ደንበኛ</p>
              <p className="font-semibold text-gray-800">{receipt.customerName}</p>
              {receipt.customerPhone && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Phone size={10} /> {receipt.customerPhone}
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">ሁኔታ</p>
              <Badge color={status.color}>{status.label}</Badge>
              {receipt.branch?.name && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Building2 size={10} /> {receipt.branch.name}
                </p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-600 uppercase">ዕቃ</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-600 uppercase">መጠን</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 text-gray-800">
                    {receipt.itemType}
                    {receipt.productCode && (
                      <p className="text-xs text-gray-500 font-mono">ኮድ: {receipt.productCode}</p>
                    )}
                    {receipt.order?.orderNumber && (
                      <p className="text-xs text-gray-500 font-mono">ትዕዛዝ: {receipt.order.orderNumber}</p>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-800 font-medium">
                    {formatETB(receipt.totalPrice || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">ጠቅላላ ዋጋ</span>
              <span className="font-semibold text-gray-800">{formatETB(receipt.totalPrice || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ቅድመ ክፍያ</span>
              <span className="font-semibold text-green-600">{formatETB(receipt.prepayment || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-700">ቀሪ ክፍያ</span>
              <span className="font-bold text-red-600 text-lg">{formatETB(receipt.remainingPayment || 0)}</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 space-y-0.5 border-t border-gray-100 pt-3">
            {receipt.orderDate && <p>የትዕዛዝ ቀን: {formatEthiopianDate(receipt.orderDate)}</p>}
            <p>ቀጠሮ ቀን: {formatEthiopianDate(receipt.appointmentDate)}</p>
            <p>ቅርንጫፍ: {receipt.branch?.name || '-'}</p>
            <p>ያዘጋጀው: {receipt.issuedBy?.fullName || '-'}</p>
          </div>

          {receipt.note && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
              ⚠️ {receipt.note}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onDownload}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
        >
          <Download size={16} /> አውርድ PDF
        </button>
        <button
          onClick={onPrint}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition"
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
      .replace(/>/g, '&gt;');

  const money = (n) =>
    (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  const status = esc(RECEIPT_STATUS[receipt.status]?.label || receipt.status || '-');
  const createdAt = formatEthiopianDate(receipt.createdAt);
  const orderDate = formatEthiopianDate(receipt.orderDate || receipt.createdAt);
  const appointmentDate = formatEthiopianDate(receipt.appointmentDate);
  const total = money(receipt.totalPrice);
  const prepay = money(receipt.prepayment);
  const remaining = money(receipt.remainingPayment);
  const branch = esc(receipt.branch?.name || '-');
  const customer = esc(receipt.customerName || '-');
  const phone = esc(receipt.customerPhone || '-');
  const itemType = esc(receipt.itemType || '-');
  const productCode = esc(receipt.productCode || '-');
  const note = esc(receipt.note || '');
  const receiptNum = esc(receipt.receiptNumber || '-');

  return `<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${receiptNum}</title>
  <style>
    /* margin: 0 removes the browser's own date / title / file path / page number */
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      font-family: 'Noto Sans Ethiopic', 'Nyala', 'Abyssinica SIL', 'Segoe UI', Arial, sans-serif;
      background: #fff;
      color: #111827;
      font-size: 14px;
      line-height: 1.45;
    }
    body { padding: 10mm; }
    .receipt { width: 100%; max-width: 190mm; margin: 0 auto; page-break-inside: avoid; break-inside: avoid; }

    /* Barcode */
    .barcode-wrap { text-align: center; padding: 3mm 0 2mm; border-bottom: 1px dashed #d1d5db; }
    .barcode { font-family: 'Libre Barcode 128', 'Courier New', monospace; font-size: 30px; line-height: 1; letter-spacing: 1.5px; }

    /* Header */
    .header { text-align: center; padding: 3mm 0; border-bottom: 1px solid #d1d5db; }
    .brand-am { font-size: 15px; font-weight: 800; color: #0f766e; }
    .brand-en { font-size: 14px; font-weight: 700; color: #0f766e; letter-spacing: 1.5px; margin: 0.5mm 0; }
    .brand-addr, .brand-contact { font-size: 13px; color: #4b5563; }

    /* Meta */
    .meta { padding: 3mm 0; border-bottom: 1px dashed #d1d5db; display: flex; justify-content: space-between; align-items: flex-start; }
    .meta-line { margin: 0.5mm 0; }
    .meta-line strong { color: #111827; }
    .status { display: inline-block; background: #10b981; color: #fff; font-size: 13px; font-weight: 800; padding: 0.8mm 3mm; border-radius: 1mm; margin-top: 1mm; }

    /* Sections */
    .sec { padding: 3mm 0; border-bottom: 1px dashed #d1d5db; }
    .sec-title { font-size: 14px; font-weight: 800; margin-bottom: 1mm; }
    .sec-line { margin: 0.8mm 0; padding-left: 2mm; }
    .sec-line strong { color: #111827; }

    /* Item list = the only table */
    .items { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
    .items th { background: #f3f4f6; padding: 2mm 3mm; text-align: left; font-size: 13px; font-weight: 700; border: 1px solid #d1d5db; }
    .items td { padding: 2.5mm 3mm; border: 1px solid #d1d5db; font-size: 14px; }
    .items .c { text-align: center; }
    .items .r { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
    .items .mono { font-family: 'Courier New', monospace; }

    /* Payment with dotted leaders */
    .pay-row { display: flex; align-items: baseline; margin: 1.2mm 0; }
    .pay-row .dots { flex: 1; border-bottom: 1px dotted #9ca3af; margin: 0 1.5mm; height: 1px; }
    .pay-row .val { font-family: 'Courier New', monospace; font-weight: 700; }
    .pay-row.prepaid .val { color: #059669; }
    .pay-row.remaining .val { color: #dc2626; font-weight: 800; }

    /* Notes */
    .note, .notice { margin-top: 3mm; padding: 3mm 4mm; font-size: 13px; line-height: 1.5; border-left: 3px solid; }
    .note { background: #fef3c7; border-color: #f59e0b; color: #78350f; }
    .notice { background: #fef2f2; border-color: #dc2626; color: #7f1d1d; }
    .notice .phone { margin-top: 1.5mm; padding-top: 1mm; border-top: 1px dashed #fca5a5; font-weight: 700; }

    .thanks { text-align: center; margin-top: 4mm; font-size: 14px; font-weight: 800; }
  </style>
</head>
<body>
  <div class="receipt">

    <!-- Barcode -->
    <div class="barcode-wrap">
      <div class="barcode">*${receiptNum}*</div>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="brand-am">ግሩም ዘመናዊ የኤሌክትሪክ እና ማገዶ ቆጣቢ ምጣድ</div>
      <div class="brand-en">GRUM STOVE &amp; MANUFACTURING</div>
      <div class="brand-addr">📍 አዲስ አበባ · ቦሌ ክ/ከተማ</div>
      <div class="brand-contact">📞 0924 254 988 · 0903 284 493</div>
    </div>

    <!-- Meta -->
    <div class="meta">
      <div>
        <div class="meta-line">ደረሰኝ ቁጥር: <strong>${receiptNum}</strong></div>
        <div class="meta-line">የተሰጠ ቀን: <strong>${createdAt}</strong></div>
        <div class="status">${status}</div>
      </div>
      <div class="meta-line">ቅርንጫፍ: <strong>${branch}</strong></div>
    </div>

    <!-- Customer -->
    <div class="sec">
      <div class="sec-title">👤 የደንበኛ መረጃ:</div>
      <div class="sec-line">• ስም: <strong>${customer}</strong></div>
      <div class="sec-line">• ስልክ: <strong>${phone}</strong></div>
    </div>

    <!-- Items (table) -->
    <div class="sec">
      <div class="sec-title">📦 የዕቃ ዝርዝር:</div>
      <table class="items">
        <thead>
          <tr>
            <th>የዕቃ ዓይነት</th>
            <th>ኮድ</th>
            <th class="c">ብዛት</th>
            <th style="text-align:right">ዋጋ (ETB)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${itemType}</td>
            <td class="mono">${productCode}</td>
            <td class="c">1</td>
            <td class="r">${total}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Payment -->
    <div class="sec">
      <div class="sec-title">💰 የክፍያ ማጠቃለያ:</div>
      <div class="pay-row"><span>• ጠቅላላ ዋጋ:</span><span class="dots"></span><span class="val">ብር ${total}</span></div>
      <div class="pay-row prepaid"><span>• ቅድመ ክፍያ (ከፍለው):</span><span class="dots"></span><span class="val">ብር ${prepay}</span></div>
      <div class="pay-row remaining"><span>• ቀሪ ክፍያ:</span><span class="dots"></span><span class="val">ብር ${remaining}</span></div>
    </div>

    <!-- Schedule -->
    <div class="sec">
      <div class="sec-title">📅 የቀጠሮ እና የጊዜ ሰሌዳ:</div>
      <div class="sec-line">• የትዕዛዝ ቀን: <strong>${orderDate}</strong></div>
      <div class="sec-line">• የቀጠሮ ቀን: <strong>${appointmentDate}</strong></div>
      <div class="sec-line">• የተሰጠ ቀን: <strong>${createdAt}</strong></div>
    </div>

    ${note ? `<div class="note"><b>⚠️ ማስታወሻ:</b> ${note}</div>` : ''}

    <div class="notice">
      <b>⚠️ ማሳሰቢያ:</b>
      የተከፈለው ቅድመ ክፍያ (ክብድ) የቆይታ ጊዜው <b>2 ወር</b> ነው። በዚሁ ጊዜ ውስጥ ዕቃውን ካልተረከቡ ወይም የጥሬ ዕቃ ዋጋ ጭማሪ ካጋጠመ፣ የዋጋው ልዩነት ታስቦ የሚስተካከል መሆኑን እንገልጻለን።
      <div class="phone">📞 ስልክ ቁጥር: 0924254988 / 0903284493</div>
    </div>

    <div class="thanks">ስለመረጡን እናመሰግናለን! 🙏</div>
  </div>
</body>
</html>`;
}