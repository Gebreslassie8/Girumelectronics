'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, Edit, Trash2, Eye, Building2,
  Users, MapPin, Phone, CheckCircle2, XCircle, DollarSign,
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

export default function BranchesPage() {
  const { user } = useAuth();

  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [viewBranch, setViewBranch] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'owner';

  // ---- Load branches + orders + employees (for per-branch stats) ----
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/branches').catch(() => []),
      apiFetch('/orders').catch(() => []),
      apiFetch('/employees').catch(() => []),
    ])
      .then(([brs, ords, emps]) => {
        if (!cancelled) {
          setBranches(Array.isArray(brs) ? brs : brs?.data ?? []);
          setOrders(Array.isArray(ords) ? ords : ords?.data ?? []);
          setEmployees(Array.isArray(emps) ? emps : emps?.data ?? []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ---- Aggregate per-branch stats (revenue, orders, employees) ----
  const enriched = useMemo(() => {
    const map = new Map();

    branches.forEach((b) => {
      map.set(String(b._id), { ...b, revenue: 0, orderCount: 0, employeeCount: 0 });
    });

    orders.forEach((o) => {
      const bid = String(o?.branch?._id ?? o?.branch ?? o?.branchId ?? '');
      const entry = map.get(bid);
      if (!entry) return;
      entry.revenue += Number(o.totalPrice ?? o.total ?? 0) || 0;
      entry.orderCount += 1;
    });

    employees.forEach((e) => {
      const bid = String(e?.branch?._id ?? e?.branch ?? '');
      const entry = map.get(bid);
      if (!entry) return;
      entry.employeeCount += 1;
    });

    return Array.from(map.values());
  }, [branches, orders, employees]);

  // ---- Filter ----
  const filtered = useMemo(() => {
    return enriched.filter((b) => {
      const q = search.toLowerCase();
      const name = b.name || '';
      const address = b.address || b.location || '';
      const phone = b.phone || '';
      const code = b.code || b.branchCode || '';
      const matchSearch =
        name.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q) ||
        phone.includes(q) ||
        code.toLowerCase().includes(q);
      const isActive = b.isActive !== false;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive);
      return matchSearch && matchStatus;
    });
  }, [enriched, search, statusFilter]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.isActive !== false).length;
    const totalRevenue = enriched.reduce((s, b) => s + b.revenue, 0);
    const totalOrders = enriched.reduce((s, b) => s + b.orderCount, 0);
    return { total, active, totalRevenue, totalOrders };
  }, [branches, enriched]);

  // ---- Delete ----
  const handleDeleteClick = (branch) => setDeleteTarget(branch);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/branches/' + deleteTarget._id, { method: 'DELETE' });
      setBranches((prev) => prev.filter((b) => b._id !== deleteTarget._id));
      toast.success('ቅርንጫፍ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  // ---- Save (create / edit) ----
  const handleSave = async (data) => {
    try {
      // ✅ Ensure manager is a valid ObjectId string or null — never a name
      const payload = {
        ...data,
        manager:
          data.manager && typeof data.manager === 'object'
            ? data.manager._id ?? null
            : data.manager || null,
      };

      if (editingBranch) {
        const updated = await apiFetch('/branches/' + editingBranch._id, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setBranches((prev) =>
          prev.map((b) => (b._id === editingBranch._id ? { ...b, ...updated } : b))
        );
        toast.success('ቅርንጫፍ ተስተካክሏል');
      } else {
        const created = await apiFetch('/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setBranches((prev) => [created, ...prev]);
        toast.success('ቅርንጫፍ ተጨምሯል');
      }
      setShowModal(false);
      setEditingBranch(null);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ቅርንጫፎች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ቅርንጫፎች · ጠቅላላ ገቢ {formatETB(stats.totalRevenue)}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingBranch(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ቅርንጫፍ
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ቅርንጫፎች" value={stats.total} icon={Building2} color="bg-blue-500" />
        <StatCard label="ንቁ" value={stats.active} icon={CheckCircle2} color="bg-green-500" />
        <StatCard label="ጠቅላላ ገቢ" value={formatETB(stats.totalRevenue)} icon={DollarSign} color="bg-purple-500" />
        <StatCard label="ትዕዛዞች" value={stats.totalOrders} icon={Users} color="bg-orange-500" />
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ስም፣ አድራሻ፣ ስልክ)..."
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
            <option value="active">ንቁ</option>
            <option value="inactive">ተዘግቷል</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ስም</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">አድራሻ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ስልክ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ገቢ</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ትዕዛዞች</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ሠራተኞች</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ሁኔታ</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <Building2 size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">ምንም ቅርንጫፍ አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((branch) => {
                  const isActive = branch.isActive !== false;
                  return (
                    <tr key={branch._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center flex-shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{branch.name}</p>
                            {branch.code && (
                              <p className="text-xs text-gray-500 font-mono">{branch.code}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-gray-400" />
                          {branch.address || branch.location || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {branch.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} className="text-gray-400" />
                            {branch.phone}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand">
                        {formatETB(branch.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-medium">
                        {branch.orderCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {branch.employeeCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={isActive ? 'green' : 'red'}>
                          {isActive ? 'ንቁ' : 'ተዘግቷል'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewBranch(branch)}
                          onEdit={() => { setEditingBranch(branch); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(branch)}
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

      {/* Create / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingBranch(null); }}
        title={editingBranch ? 'ቅርንጫፍ አስተካክል' : 'አዲስ ቅርንጫፍ'}
        size="md"
      >
        <BranchForm
          branch={editingBranch}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingBranch(null); }}
        />
      </Modal>

      {/* View modal */}
      <Modal
        isOpen={!!viewBranch}
        onClose={() => setViewBranch(null)}
        title="የቅርንጫፍ ዝርዝር"
      >
        {viewBranch && <BranchView branch={viewBranch} />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ቅርንጫፍ ይሰረዝ?"
        message="ይህን ቅርንጫፍ መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.name}
        itemType={deleteTarget?.address || deleteTarget?.phone || ''}
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
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

// =====================================================================
// BranchForm — manager is now a dropdown of REGISTERED USERS
// =====================================================================
function BranchForm({ branch, onSave, onCancel }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // ✅ Initialize manager with the _id only (never the display name)
  const initialManager =
    branch?.manager == null
      ? ''
      : typeof branch.manager === 'object'
        ? branch.manager._id || ''
        : branch.manager || '';

  const [form, setForm] = useState({
    name: branch?.name || '',
    code: branch?.code || branch?.branchCode || '',
    phone: branch?.phone || '',
    address: branch?.address || branch?.location || '',
    manager: initialManager,          // ✅ ObjectId string or ''
    isActive: branch?.isActive !== false,
  });

  // ---- Load registered users for the manager dropdown ----
  useEffect(() => {
    let cancelled = false;
    setLoadingUsers(true);
    apiFetch('/users')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data ?? res?.users ?? [];
        if (!cancelled) setUsers(list);
      })
      .catch(() => { if (!cancelled) setUsers([]); })
      .finally(() => { if (!cancelled) setLoadingUsers(false); });
    return () => { cancelled = true; };
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: form.name.trim(),
      code: form.code.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      // ✅ Empty string → null (default = no manager)
      manager: form.manager || null,
      isActive: form.isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ስም *" full>
          <input name="name" value={form.name} onChange={onChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="ኮድ">
          <input name="code" value={form.code} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="ስልክ">
          <input name="phone" value={form.phone} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>
        <FormField label="አድራሻ" full>
          <input name="address" value={form.address} onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
          />
        </FormField>

        {/* ✅ Manager is now a select of registered users */}
        <FormField label="ኃላፊ" full>
          <select
            name="manager"
            value={form.manager}
            onChange={onChange}
            disabled={loadingUsers}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">
              {loadingUsers ? 'ተጠቃሚዎች በመጫን ላይ...' : '— ኃላፊ የለም (ነባሪ) —'}
            </option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.fullName || u.name || u.phone || u.email}
                {u.role ? ` (${u.role})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            ከተመዘገቡ ተጠቃሚዎች ይምረጡ። ባዶ ከሆነ ቅርንጫፉ ኃላፊ አይኖረውም።
          </p>
        </FormField>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          name="isActive"
          checked={form.isActive}
          onChange={onChange}
          className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <span className="text-gray-700">ንቁ ቅርንጫፍ</span>
      </label>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition"
        >
          {branch ? 'አስተካክል' : 'ጨምር'}
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

function BranchView({ branch }) {
  const isActive = branch.isActive !== false;
  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-lg bg-brand text-white flex items-center justify-center">
          <Building2 size={26} />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{branch.name}</p>
          <p className="text-sm text-gray-500">{branch.code || '—'}</p>
        </div>
      </div>

      <div className="space-y-3 pt-4 text-sm">
        <Row label="አድራሻ" value={branch.address || branch.location || '—'} />
        <Row label="ስልክ" value={branch.phone || '—'} />
        <Row label="ኃላፊ" value={managerLabel(branch)} />
        <Row label="ገቢ" value={formatETB(branch.revenue || 0)} bold color="text-brand" />
        <Row label="ትዕዛዞች" value={branch.orderCount || 0} />
        <Row label="ሠራተኞች" value={branch.employeeCount || 0} />
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ሁኔታ:</span>
          <Badge color={isActive ? 'green' : 'red'}>
            {isActive ? 'ንቁ' : 'ተዘግቷል'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''} ${color || 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function managerLabel(branch) {
  const m = branch?.manager;
  if (!m) return '—';
  if (typeof m === 'string') return m;
  if (typeof m === 'object') {
    if (m.fullName) return m.fullName;
    if (m.name) return m.name;
    if (m.phone) return m.phone;
  }
  return '—';
}