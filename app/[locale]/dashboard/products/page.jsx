'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, ShoppingCart, Package, TrendingUp, AlertTriangle,
  DollarSign, Building2, User, Calendar,
} from 'lucide-react';
import { formatETB, formatDate } from '@/lib/utils';
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'seller';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/products').catch(() => []),
      apiFetch('/branches').catch(() => []),
    ])
      .then(([prods, brs]) => {
        if (!cancelled) {
          setProducts(Array.isArray(prods) ? prods : []);
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
    let result = products;
    if (user?.role === 'seller' && userBranchId) {
      result = result.filter((p) => (p.branch?._id || p.branch) === userBranchId);
    }
    return result;
  }, [products, user, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchBranch = branchFilter === 'all' ||
        (p.branch?._id || p.branch) === branchFilter;
      return matchSearch && matchCategory && matchStatus && matchBranch;
    });
  }, [roleFiltered, search, categoryFilter, statusFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const totalValue = roleFiltered.reduce((s, p) => s + (p.quantity || 0) * (p.sellingPrice || 0), 0);
    const lowStock = roleFiltered.filter((p) => (p.quantity || 0) > 0 && (p.quantity || 0) < 10).length;
    const outOfStock = roleFiltered.filter((p) => (p.quantity || 0) === 0).length;
    return { total, totalValue, lowStock, outOfStock };
  }, [roleFiltered]);

  const handleDeleteClick = (product) => setDeleteTarget(product);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/products/' + deleteTarget._id, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      toast.success('ምርት ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingProduct) {
        const updated = await apiFetch('/products/' + editingProduct._id, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setProducts((prev) => prev.map((p) => (p._id === editingProduct._id ? updated : p)));
        toast.success('ምርት ተስተካክሏል');
      } else {
        const created = await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        setProducts((prev) => [created, ...prev]);
        toast.success('ምርት ተጨምሯል');
      }
      setShowModal(false);
      setEditingProduct(null);
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
          <h1 className="text-2xl font-bold text-gray-800">ምርቶች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ምርቶች · {formatETB(stats.totalValue)} ጠቅላላ ዋጋ
          </p>
          {user?.role === 'seller' && userBranchId && (
            <p className="text-xs text-brand font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={() => { setEditingProduct(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ምርት
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ምርቶች" value={stats.total} icon={ShoppingCart} color="bg-blue-500" />
        <StatCard label="ጠቅላላ ዋጋ" value={formatETB(stats.totalValue)} icon={DollarSign} color="bg-green-500" />
        <StatCard label="ዝቅተኛ ክምችት" value={stats.lowStock} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard label="ከክምችት ውጪ" value={stats.outOfStock} icon={Package} color="bg-red-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ስም ወይም ኮድ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
          >
            <option value="all">ሁሉም ምድቦች</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
          >
            <option value="all">ሁሉም ሁኔታዎች</option>
            {Object.entries(PRODUCT_STATUS).map(([k, v]) => (
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ስም</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ምድብ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ብዛት</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">የመግዣ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">የመሸጫ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ትርፍ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ሁኔታ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <ShoppingCart size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">ምንም ምርት አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const status = PRODUCT_STATUS[product.status] || { label: product.status, color: 'gray' };
                  const profit = (product.sellingPrice || 0) - (product.unitPrice || 0);
                  return (
                    <tr key={product._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{product.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{product.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={'font-semibold ' + (
                          product.quantity === 0 ? 'text-red-600' :
                          product.quantity < 10 ? 'text-yellow-600' : 'text-gray-800'
                        )}>
                          {product.quantity} {product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatETB(product.unitPrice || 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatETB(product.sellingPrice || 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-600 font-semibold">+{formatETB(profit)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewProduct(product)}
                          onEdit={() => { setEditingProduct(product); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(product)}
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
        onClose={() => { setShowModal(false); setEditingProduct(null); }}
        title={editingProduct ? 'ምርት አስተካክል' : 'አዲስ ምርት'}
        size="md"
      >
        <ProductForm
          product={editingProduct}
          branches={branches}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingProduct(null); }}
          currentUser={user}
        />
      </Modal>

      <Modal
        isOpen={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title="የምርት ዝርዝር"
      >
        {viewProduct && <ProductView product={viewProduct} />}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ምርት ይሰረዝ?"
        message="ይህን ምርት መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.name}
        itemType={(deleteTarget?.code || '') + ' · ' + (deleteTarget?.category || '')}
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

function ProductForm({ product, branches, onSave, onCancel, currentUser }) {
  const isSeller = currentUser?.role === 'seller';

  const defaultBranch = isSeller && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : (product?.branch?._id || product?.branch || '');

  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'ምጣድ',
    description: product?.description || '',
    quantity: product?.quantity || 0,
    unit: product?.unit || 'pcs',
    unitPrice: product?.unitPrice || 0,
    sellingPrice: product?.sellingPrice || 0,
    status: product?.status || 'in_stock',
    branch: defaultBranch,
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: ['quantity', 'unitPrice', 'sellingPrice'].includes(name) ? Number(value) : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.sellingPrice < form.unitPrice) {
      toast.error('የመሸጫ ዋጋ ከመግዣ ዋጋ መቀነስ አይችልም');
      return;
    }
    onSave({
      name: form.name,
      category: form.category,
      description: form.description || undefined,
      quantity: form.quantity,
      unit: form.unit,
      unitPrice: form.unitPrice,
      sellingPrice: form.sellingPrice,
      status: form.status,
      branch: form.branch || null,
    });
  };

  const profit = form.sellingPrice - form.unitPrice;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="ስም *">
        <input name="name" value={form.name} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="ምድብ">
          <select name="category" value={form.category} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="ሁኔታ">
          <select name="status" value={form.status} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800">
            {Object.entries(PRODUCT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="መግለጫ">
        <textarea name="description" value={form.description} onChange={onChange} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm resize-none text-gray-800 bg-white"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="ብዛት *">
          <input type="number" name="quantity" value={form.quantity} onChange={onChange} required min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="መለኪያ">
          <input name="unit" value={form.unit} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="የመግዣ ዋጋ *">
          <input type="number" name="unitPrice" value={form.unitPrice} onChange={onChange} required min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="የመሸጫ ዋጋ *">
          <input type="number" name="sellingPrice" value={form.sellingPrice} onChange={onChange} required min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
      </div>

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

      <div className={'rounded-lg p-3 text-sm ' + (profit < 0 ? 'bg-red-50' : 'bg-green-50')}>
        <div className="flex justify-between">
          <span className="text-gray-600">ትርፍ: </span>
          <span className={'font-bold ' + (profit < 0 ? 'text-red-600' : 'text-green-600')}>
            {profit < 0 ? '-' : '+'}{formatETB(Math.abs(profit))}
          </span>
        </div>
        {form.unitPrice > 0 && (
          <div className="flex justify-between mt-1 text-xs">
            <span className="text-gray-500">ትርፍ መጠን:</span>
            <span className={profit < 0 ? 'text-red-600' : 'text-green-600'}>
              {((profit / form.unitPrice) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition">
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition">
          {product ? 'አስተካክል' : 'ጨምር'}
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

function ProductView({ product }) {
  const status = PRODUCT_STATUS[product.status] || { label: product.status, color: 'gray' };
  const profit = (product.sellingPrice || 0) - (product.unitPrice || 0);
  const profitMargin = (product.unitPrice || 0) > 0
    ? ((profit / product.unitPrice) * 100).toFixed(1)
    : 0;

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center">
          <ShoppingCart size={28} className="text-brand" />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{product.name}</p>
          <p className="text-sm text-gray-500 font-mono">{product.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-4">
        <StatBox label="ብዛት" value={(product.quantity || 0) + ' ' + (product.unit || 'pcs')} icon={Package} color="text-purple-600 bg-purple-50" />
        <StatBox label="የመሸጫ" value={formatETB(product.sellingPrice || 0)} icon={DollarSign} color="text-blue-600 bg-blue-50" />
        <StatBox label="ትርፍ" value={formatETB(profit)} icon={TrendingUp} color="text-green-600 bg-green-50" />
      </div>

      <div className="space-y-3 pt-3 border-t border-gray-100 text-sm">
        <Row label="ምድብ" value={product.category} />
        <Row label="መግለጫ" value={product.description || '-'} />
        <Row label="የመግዣ ዋጋ" value={formatETB(product.unitPrice || 0)} />
        <Row label="ትርፍ መጠን" value={profitMargin + '%'} bold color={profit < 0 ? 'text-red-600' : 'text-green-600'} />
        <Row label="ቅርንጫፍ" value={product.branch?.name || '-'} icon={Building2} />
        <Row label="የተፈጠረ" value={formatDate(product.createdAt)} icon={Calendar} />
        <Row label="የፈጠረ" value={product.createdBy?.fullName || '-'} icon={User} />
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ሁኔታ:</span>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
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

function Row({ label, value, icon: Icon, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}:
      </span>
      <span className={'text-right ' + (bold ? 'font-semibold ' : '') + (color || 'text-gray-800')}>{value}</span>
    </div>
  );
}