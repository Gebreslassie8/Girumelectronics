'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, Package, DollarSign, TrendingUp, AlertTriangle,
  Calendar, Phone, MapPin, User, Building2, X,
} from 'lucide-react';
import { formatETB, formatDate } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'seller';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/inventory').catch(() => []),
      apiFetch('/branches').catch(() => []),
    ])
      .then(([inv, brs]) => {
        if (!cancelled) {
          setItems(Array.isArray(inv) ? inv : []);
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
    let result = items;
    if (user?.role === 'seller' && userBranchId) {
      result = result.filter((i) => (i.branch?._id || i.branch) === userBranchId);
    }
    return result;
  }, [items, user, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((i) => {
      const q = search.toLowerCase();
      const matchSearch =
        (i.itemType || '').toLowerCase().includes(q) ||
        (i.itemCode || '').toLowerCase().includes(q) ||
        (i.supplier || '').toLowerCase().includes(q);
      const matchBranch = branchFilter === 'all' ||
        (i.branch?._id || i.branch) === branchFilter;
      return matchSearch && matchBranch;
    });
  }, [roleFiltered, search, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const totalValue = roleFiltered.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const totalQuantity = roleFiltered.reduce((s, i) => s + (i.quantity || 0), 0);
    const lowStock = roleFiltered.filter((i) => (i.quantity || 0) < 10).length;
    return { total, totalValue, totalQuantity, lowStock };
  }, [roleFiltered]);

  const handleDeleteClick = (item) => setDeleteTarget(item);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/inventory/' + deleteTarget._id, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i._id !== deleteTarget._id));
      toast.success('ዕቃ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        const updated = await apiFetch('/inventory/' + editingItem._id, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setItems((prev) => prev.map((i) => (i._id === editingItem._id ? updated : i)));
        toast.success('ዕቃ ተስተካክሏል');
      } else {
        const created = await apiFetch('/inventory', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setItems((prev) => [created, ...prev]);
        toast.success('ዕቃ ተቀብሏል');
      }
      setShowModal(false);
      setEditingItem(null);
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
          <h1 className="text-2xl font-bold text-gray-800">መጋዘን</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ዕቃዎች · {formatETB(stats.totalValue)} ጠቅላላ ዋጋ
          </p>
          {user?.role === 'seller' && userBranchId && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={() => { setEditingItem(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ዕቃ ተቀበል
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ዕቃዎች" value={stats.total} icon={Package} color="bg-blue-500" />
        <StatCard label="ጠቅላላ ዋጋ" value={formatETB(stats.totalValue)} icon={DollarSign} color="bg-green-500" />
        <StatCard label="ጠቅላላ ብዛት" value={stats.totalQuantity} icon={TrendingUp} color="bg-purple-500" />
        <StatCard label="ዝቅተኛ ክምችት" value={stats.lowStock} icon={AlertTriangle} color="bg-yellow-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ዕቃ፣ ኮድ፣ አቅራቢ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </div>

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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ኮድ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ዕቃ ዓይነት</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ብዛት</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">የመግዣ ዋጋ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ጠቅላላ ዋጋ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">አቅራቢ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ቅርንጫፍ</th>
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
                        <Package size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">ምንም ዕቃ አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const branchName = item.branch?.name || '-';
                  const createdName = item.createdBy?.fullName || '-';
                  return (
                    <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{item.itemCode}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{item.itemType}</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{item.description}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={'font-semibold ' + ((item.quantity || 0) < 10 ? 'text-red-600' : 'text-gray-800')}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatETB(item.unitPrice || 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatETB(item.totalPrice || 0)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.supplier || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                          {branchName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.receivedDate)}</td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewItem(item)}
                          onEdit={() => { setEditingItem(item); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(item)}
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
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        title={editingItem ? 'ዕቃ አስተካክል' : 'አዲስ ዕቃ ተቀበል'}
        size="md"
      >
        <ItemForm
          item={editingItem}
          branches={branches}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingItem(null); }}
          currentUser={user}
        />
      </Modal>

      <Modal
        isOpen={!!viewItem}
        onClose={() => setViewItem(null)}
        title="የዕቃ ዝርዝር"
      >
        {viewItem && <ItemView item={viewItem} />}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ዕቃ ይሰረዝ?"
        message="ይህን የመጋዘን ዕቃ መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.itemType}
        itemType={(deleteTarget?.itemCode || '') + ' · ' + (deleteTarget?.quantity || 0) + ' pcs'}
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

function ItemForm({ item, branches, onSave, onCancel, currentUser }) {
  const isSeller = currentUser?.role === 'seller';

  const defaultBranch = isSeller && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : (item?.branch?._id || item?.branch || '');

  const [form, setForm] = useState({
    itemType: item?.itemType || '',
    quantity: item?.quantity || 0,
    unitPrice: item?.unitPrice || 0,
    supplier: item?.supplier || '',
    description: item?.description || '',
    branch: defaultBranch,
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: ['quantity', 'unitPrice'].includes(name) ? Number(value) : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      itemType: form.itemType,
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      totalPrice: form.quantity * form.unitPrice,
      supplier: form.supplier || undefined,
      description: form.description || undefined,
      branch: form.branch || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="የዕቃ ዓይነት *">
        <input name="itemType" value={form.itemType} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="ብዛት *">
          <input type="number" name="quantity" value={form.quantity} onChange={onChange} required min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="የመግዣ ዋጋ *">
          <input type="number" name="unitPrice" value={form.unitPrice} onChange={onChange} required min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
      </div>

      <FormField label="አቅራቢ">
        <input name="supplier" value={form.supplier} onChange={onChange}
          placeholder="የአቅራቢ ስም"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
        />
      </FormField>

      <FormField label="ቅርንጫፍ">
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

      <FormField label="መግለጫ">
        <textarea name="description" value={form.description} onChange={onChange} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm resize-none text-gray-800 bg-white"
        />
      </FormField>

      <div className="bg-blue-50 rounded-lg p-3 text-sm">
        <span className="text-gray-600">ጠቅላላ ዋጋ: </span>
        <span className="font-bold text-brand">{formatETB(form.quantity * form.unitPrice)}</span>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          {item ? 'አስተካክል' : 'ተቀበል'}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ItemView({ item }) {
  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center">
          <Package size={28} className="text-brand" />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{item.itemType}</p>
          <p className="text-sm text-gray-500 font-mono">{item.itemCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-4">
        <StatBox label="ብዛት" value={item.quantity} icon={Package} color="text-purple-600 bg-purple-50" />
        <StatBox label="የመግዣ" value={formatETB(item.unitPrice || 0)} icon={DollarSign} color="text-blue-600 bg-blue-50" />
        <StatBox label="ጠቅላላ" value={formatETB(item.totalPrice || 0)} icon={TrendingUp} color="text-green-600 bg-green-50" />
      </div>

      <div className="space-y-3 pt-3 border-t border-gray-100 text-sm">
        <Row label="አቅራቢ" value={item.supplier || '-'} icon={User} />
        <Row label="ቅርንጫፍ" value={item.branch?.name || '-'} icon={Building2} />
        <Row label="መግለጫ" value={item.description || '-'} />
        <Row label="ቀን" value={formatDate(item.receivedDate)} icon={Calendar} />
        <Row label="የተቀበለ" value={item.createdBy?.fullName || '-'} icon={User} />
      </div>
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