'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, Edit, Trash2, Eye, Users, DollarSign,
  UserCheck, UserX, Phone, Mail, Building2, Shield, Briefcase, EyeOff,
} from 'lucide-react';
import { formatETB } from '@/lib/utils';
import {
  EMPLOYEE_STATUS, POSITIONS, DEPARTMENTS, PERMISSIONS_LIST,
} from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

const ETHIOPIAN_TIME_ZONE = 'Africa/Addis_Ababa';

function formatEthiopianDate(input, options = {}) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);

  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleDateString('am-ET', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    });
  }
}

function normalizeKey(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizePermissionsObject(raw) {
  if (!raw) return {};
  if (raw instanceof Map) {
    return Object.fromEntries(raw.entries());
  }
  if (typeof raw === 'object') {
    return { ...raw };
  }
  return {};
}

function getPermissionValue(permissions, key) {
  const obj = normalizePermissionsObject(permissions);
  if (obj[key] !== undefined) return Boolean(obj[key]);

  const targetNorm = normalizeKey(key);
  for (const [k, v] of Object.entries(obj)) {
    if (normalizeKey(k) === targetNorm) {
      return Boolean(v);
    }
  }
  return false;
}

function isStorekeeperPosition(position = '') {
  const val = String(position).trim().toLowerCase();
  return val.includes('መጋዘን') || val.includes('store');
}

function buildInitialPermissions(employeePermissions, position = '') {
  const existing = normalizePermissionsObject(employeePermissions);
  const storekeeperDefault = isStorekeeperPosition(position);

  const base = {
    canSell: !storekeeperDefault,
    canManageInventory: storekeeperDefault,
    canManageOrders: !storekeeperDefault,
    canIssueReceipts: !storekeeperDefault,
    canViewAnalytics: false,
    canManageEmployees: false,
  };

  for (const perm of PERMISSIONS_LIST) {
    if (perm?.key && base[perm.key] === undefined) {
      const existingVal = getPermissionValue(existing, perm.key);
      if (existingVal) {
        base[perm.key] = true;
      } else if (storekeeperDefault && perm.key.toLowerCase().includes('inventory')) {
        base[perm.key] = true;
      } else {
        base[perm.key] = false;
      }
    }
  }

  return {
    ...base,
    ...existing,
  };
}

export default function EmployeesPage() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/employees').catch(() => []),
      apiFetch('/branches').catch(() => []),
    ])
      .then(([emps, brs]) => {
        if (!cancelled) {
          setEmployees(Array.isArray(emps) ? emps : []);
          setBranches(Array.isArray(brs) ? brs : []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const name = e.user?.fullName || e.fullName || '';
      const code = e.employeeCode || '';
      const phone = e.user?.phone || e.phone || '';
      const pos = e.position || '';
      const matchSearch =
        name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        phone.includes(q) ||
        pos.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchBranch = branchFilter === 'all' || e.branch?._id === branchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [employees, search, statusFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'active').length;
    const onLeave = employees.filter((e) => e.status === 'on_leave').length;
    const totalSalary = employees
      .filter((e) => e.status === 'active')
      .reduce((s, e) => s + (e.salary || 0), 0);
    return { total, active, onLeave, totalSalary };
  }, [employees]);

  const handleDeleteClick = (employee) => setDeleteTarget(employee);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch('/employees/' + deleteTarget._id, { method: 'DELETE' });
      setEmployees((prev) => prev.filter((e) => e._id !== deleteTarget._id));
      toast.success('ሠራተኛ ተሰርዟል');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data) => {
    try {
      const sentPerms = normalizePermissionsObject(data.permissions);

      if (editingEmployee) {
        const res = await apiFetch('/employees/' + editingEmployee._id, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        const serverEmp = res?.employee || res || {};
        const merged = {
          ...editingEmployee,
          ...serverEmp,
          permissions: {
            ...normalizePermissionsObject(editingEmployee.permissions),
            ...normalizePermissionsObject(serverEmp.permissions),
            ...sentPerms,
          },
        };
        setEmployees((prev) => prev.map((e) => (e._id === editingEmployee._id ? merged : e)));
        if (viewEmployee?._id === editingEmployee._id) {
          setViewEmployee(merged);
        }
        toast.success('ሠራተኛ ተስተካክሏል');
      } else {
        const res = await apiFetch('/employees', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        const createdEmp = res?.employee || res || {};
        const created = {
          ...createdEmp,
          permissions: {
            ...normalizePermissionsObject(createdEmp.permissions),
            ...sentPerms,
          },
        };
        setEmployees((prev) => [created, ...prev]);
        toast.success('ሠራተኛ ተጨምሯል');
      }
      setShowModal(false);
      setEditingEmployee(null);
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
          <h1 className="text-2xl font-bold text-gray-800">ሠራተኞች</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ሠራተኞች · ጠቅላላ ደመወዝ {formatETB(stats.totalSalary)}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingEmployee(null); setShowModal(true); }}>
            <Plus size={18} /> አዲስ ሠራተኛ
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ጠቅላላ ሠራተኞች" value={stats.total} icon={Users} color="bg-blue-500" />
        <StatCard label="ንቁ" value={stats.active} icon={UserCheck} color="bg-green-500" />
        <StatCard label="ፈቃድ ላይ" value={stats.onLeave} icon={UserX} color="bg-yellow-500" />
        <StatCard label="ጠቅላላ ደመወዝ" value={formatETB(stats.totalSalary)} icon={DollarSign} color="bg-purple-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ፈልግ (ስም፣ ኮድ፣ ስልክ፣ የስራ መደብ)..."
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
            {Object.entries(EMPLOYEE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label || v}</option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
          >
            <option value="all">ሁሉም ቅርንጫፎች</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ኮድ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ስም</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ስልክ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">የስራ መደብ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ክፍል</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">ደመወዝ</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ቅርንጫፍ</th>
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
                        <Users size={28} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">ምንም ሠራተኛ አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const status = EMPLOYEE_STATUS[emp.status] || { label: emp.status, color: 'gray' };
                  const fullName = emp.user?.fullName || emp.fullName || '';
                  const email = emp.user?.email || emp.email || '';
                  const phone = emp.user?.phone || emp.phone || '';
                  return (
                    <tr key={emp._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand font-medium">{emp.employeeCode}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">
                            {fullName.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{fullName}</p>
                            <p className="text-xs text-gray-500">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{phone}</td>
                      <td className="px-4 py-3 text-gray-800">{emp.position}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {emp.department}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatETB(emp.salary || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                          {emp.branch?.name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewEmployee(emp)}
                          onEdit={() => { setEditingEmployee(emp); setShowModal(true); }}
                          onDelete={() => handleDeleteClick(emp)}
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
        onClose={() => { setShowModal(false); setEditingEmployee(null); }}
        title={editingEmployee ? 'ሠራተኛ አስተካክል' : 'አዲስ ሠራተኛ'}
        size="lg"
      >
        <EmployeeForm
          employee={editingEmployee}
          branches={branches}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingEmployee(null); }}
        />
      </Modal>

      <Modal
        isOpen={!!viewEmployee}
        onClose={() => setViewEmployee(null)}
        title="የሠራተኛ ዝርዝር"
      >
        {viewEmployee && <EmployeeView employee={viewEmployee} />}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="ሠራተኛ ይሰረዝ?"
        message="ይህን ሠራተኛ መሰረዝ ይፈልጋሉ?"
        itemName={deleteTarget?.user?.fullName || deleteTarget?.fullName}
        itemType={(deleteTarget?.position || '') + ' · ' + (deleteTarget?.employeeCode || '')}
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

function EmployeeForm({ employee, branches, onSave, onCancel }) {
  const [showPassword, setShowPassword] = useState(false);
  const initialPosition = employee?.position || 'ሻጭ';
  const [form, setForm] = useState({
    fullName: employee?.user?.fullName || employee?.fullName || '',
    phone: employee?.user?.phone || employee?.phone || '',
    email: employee?.user?.email || employee?.email || '',
    password: '',
    position: initialPosition,
    department: employee?.department || 'ሽያጭ',
    salary: employee?.salary || 0,
    status: employee?.status || 'active',
    branch: employee?.branch?._id || '',
    emergencyName: employee?.emergencyContact?.name || '',
    emergencyPhone: employee?.emergencyContact?.phone || '',
    permissions: buildInitialPermissions(employee?.permissions, initialPosition),
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: name === 'salary' ? Number(value) : value,
      };

      if (name === 'position' && isStorekeeperPosition(value)) {
        const invKeys = {};
        for (const p of PERMISSIONS_LIST) {
          if (p?.key && p.key.toLowerCase().includes('inventory')) {
            invKeys[p.key] = true;
          }
        }
        next.permissions = {
          ...prev.permissions,
          canManageInventory: true,
          ...invKeys,
        };
      }

      return next;
    });
  };

  const togglePermission = (key) => {
    setForm((prev) => {
      const current = getPermissionValue(prev.permissions, key);
      return {
        ...prev,
        permissions: {
          ...normalizePermissionsObject(prev.permissions),
          [key]: !current,
        },
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const userPayload = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
    };
    if (form.password.trim()) {
      userPayload.password = form.password;
    }

    onSave({
      user: userPayload,
      ...(form.password.trim() ? { password: form.password } : {}),
      position: form.position,
      department: form.department,
      salary: form.salary,
      status: form.status,
      branch: form.branch || null,
      emergencyContact: { name: form.emergencyName, phone: form.emergencyPhone },
      permissions: form.permissions,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Users size={14} /> የግል መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ሙሉ ስም *">
            <input name="fullName" value={form.fullName} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ስልክ *">
            <input name="phone" value={form.phone} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ኢሜይል *">
            <input type="email" name="email" value={form.email} onChange={onChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label={employee ? 'አዲስ ፓስወርድ (ካልተቀየረ ባዶ ይተዉ)' : 'ፓስወርድ *'}>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={onChange}
                required={!employee}
                minLength={6}
                placeholder={employee ? '••••••••' : 'ቢያንስ 6 ፊደላት/ቁጥሮች'}
                className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Briefcase size={14} /> የስራ መረጃ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="የስራ መደብ *">
            <select name="position" value={form.position} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
            >
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
          <FormField label="ክፍል">
            <select name="department" value={form.department} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
            >
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="ደመወዝ (ETB) *">
            <input type="number" name="salary" value={form.salary} onChange={onChange} required min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ቅርንጫፍ *">
            <select name="branch" value={form.branch} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
            >
              <option value="">— ይምረጡ —</option>
              {branches.length === 0 ? (
                <option value="" disabled>ቅርንጫፍ በመጫን ላይ...</option>
              ) : (
                branches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))
              )}
            </select>
          </FormField>
          <FormField label="ሁኔታ" full>
            <select name="status" value={form.status} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm bg-white text-gray-800"
            >
              {Object.entries(EMPLOYEE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label || v}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Shield size={14} /> ፈቃዶች
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-lg bg-gray-50">
          {PERMISSIONS_LIST.map((perm) => (
            <label key={perm.key} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={getPermissionValue(form.permissions, perm.key)}
                onChange={() => togglePermission(perm.key)}
                className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              <span className="text-gray-700">{perm.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Phone size={14} /> የአደጋ ጊዜ እውቂያ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="ስም">
            <input name="emergencyName" value={form.emergencyName} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
          <FormField label="ስልክ">
            <input name="emergencyPhone" value={form.emergencyPhone} onChange={onChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm text-gray-800 bg-white"
            />
          </FormField>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          ሰርዝ
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition"
        >
          {employee ? 'አስተካክል' : 'ጨምር'}
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

function EmployeeView({ employee }) {
  const status = EMPLOYEE_STATUS[employee.status] || { label: employee.status, color: 'gray' };
  const fullName = employee.user?.fullName || employee.fullName || '';
  const phone = employee.user?.phone || employee.phone || '';
  const email = employee.user?.email || employee.email || '';
  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xl">
          {fullName.charAt(0) || '?'}
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{fullName}</p>
          <p className="text-sm text-gray-500">{employee.position}</p>
        </div>
      </div>

      <div className="space-y-3 pt-4 text-sm">
        <Row label="ኮድ" value={employee.employeeCode} mono />
        <Row label="ስልክ" value={phone} />
        <Row label="ኢሜይል" value={email || '-'} />
        <Row label="ክፍል" value={employee.department} />
        <Row label="ደመወዝ" value={formatETB(employee.salary || 0)} bold color="text-brand" />
        <Row label="ቅርንጫፍ" value={employee.branch?.name || '-'} />
        <Row label="ተቀጠረ" value={formatEthiopianDate(employee.hireDate)} />
        <div className="flex justify-between items-center">
          <span className="text-gray-500">ሁኔታ:</span>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
      </div>

      {employee.emergencyContact?.name && (
        <div className="pt-4 border-t border-gray-100 mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">የአደጋ ጊዜ እውቂያ</p>
          <Row label="ስም" value={employee.emergencyContact.name} />
          <Row label="ስልክ" value={employee.emergencyContact.phone} />
        </div>
      )}

      {employee.permissions && (
        <div className="pt-4 border-t border-gray-100 mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">ፈቃዶች</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PERMISSIONS_LIST.map((perm) => {
              const allowed = getPermissionValue(employee.permissions, perm.key);
              return (
                <div key={perm.key} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    allowed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {allowed ? '✓' : '✕'}
                  </span>
                  <span className={allowed ? 'text-gray-700' : 'text-gray-400'}>
                    {perm.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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