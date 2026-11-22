'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, ShoppingCart, Package, TrendingUp,
  DollarSign, Building2, User, Calendar, Receipt,
} from 'lucide-react';
import { formatETB } from '@/lib/utils';
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

// ---------- Ethiopian Calendar Helpers (Ethiopian Calendar Only) ----------
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
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('am-ET-u-ca-ethiopic', {
      timeZone: ETHIOPIAN_TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
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
  } catch {
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

function EthiopianDateInput({ value, onChange, required = false, placeholder = 'የኢትዮጵያ ቀን ይምረጡ' }) {
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
        className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white hover:border-amber-400 hover:bg-amber-50/40 focus:border-amber-600 focus:outline-none text-xs sm:text-sm text-stone-800 flex items-center justify-between gap-2 text-left transition"
      >
        <span className={value ? 'text-stone-800 font-medium truncate' : 'text-stone-400 truncate'}>
          {value ? formatEthiopianDate(`${value}T12:00:00`) : placeholder}
        </span>
        <Calendar size={15} className="text-stone-400 flex-shrink-0" />
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
        <div className="absolute z-30 mt-1.5 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="px-2.5 py-1 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-amber-600"
            >
              {ETHIOPIAN_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value) || 2019)}
              className="w-20 px-2 py-1 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 bg-stone-50 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-stone-400 mb-1">
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
                      ? 'bg-amber-700 text-white font-bold shadow-sm'
                      : 'text-stone-700 hover:bg-amber-50 hover:text-amber-900'
                  }`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-100 text-xs">
            <button
              type="button"
              onClick={() => selectDate(toIsoDateFromUtc(new Date()))}
              className="text-amber-700 font-semibold hover:underline"
            >
              ዛሬ
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-stone-400 hover:text-stone-600 font-medium"
            >
              አጽዳ
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-stone-500 hover:text-stone-700 font-medium"
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

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isAdminActor = user?.role === 'admin' || user?.role === 'owner';
  const isStaffActor = STAFF_ROLES.includes(user?.role);
  const canManage = isAdminActor || isStaffActor;

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
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return String(typeof user.branch === 'object' ? user.branch._id : user.branch);
  }, [user]);

  const roleFiltered = useMemo(() => {
    let result = products;
    if (isStaffActor && userBranchId) {
      result = result.filter((p) => String(p.branch?._id || p.branch) === userBranchId);
    }
    return result;
  }, [products, isStaffActor, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchBranch =
        branchFilter === 'all' || (p.branch?._id || p.branch) === branchFilter;

      let matchDate = true;
      if (dateFilter) {
        const rawDate = p.createdAt || p.updatedAt;
        const prodIso = rawDate ? toIsoDateFromUtc(toUtcNoonDate(rawDate)) : '';
        matchDate = prodIso === dateFilter;
      }

      return matchSearch && matchCategory && matchBranch && matchDate;
    });
  }, [roleFiltered, search, categoryFilter, branchFilter, dateFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const totalSellingValue = roleFiltered.reduce(
      (s, p) => s + (p.quantity || 0) * (p.sellingPrice || 0),
      0
    );
    const totalPurchaseCost = roleFiltered.reduce(
      (s, p) => s + (p.quantity || 0) * (p.unitPrice || 0),
      0
    );
    const totalProfit = totalSellingValue - totalPurchaseCost;
    return { total, totalSellingValue, totalPurchaseCost, totalProfit };
  }, [roleFiltered]);

  const canActorModifyProduct = (product) => {
    if (!product) return canManage;
    if (isAdminActor) return true;
    if (!isStaffActor) return false;
    const productBranchId = product.branch?._id
      ? String(product.branch._id)
      : product.branch
      ? String(product.branch)
      : null;
    if (userBranchId && productBranchId) {
      return productBranchId === userBranchId;
    }
    return true;
  };

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
        setProducts((prev) =>
          prev.map((p) => (p._id === editingProduct._id ? updated : p))
        );
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
      <div className="p-8 text-center text-stone-500">
        <div className="w-10 h-10 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">በመጫን ላይ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">ስህተት ተፈጥሯል</p>
        <p className="text-sm text-stone-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">ምርቶች</h1>
          <p className="text-sm text-stone-500 mt-1">
            {filtered.length} ምርቶች · {formatETB(stats.totalSellingValue)} ጠቅላላ የሽያጭ ዋጋ
          </p>
          {isStaffActor && userBranchId && (
            <p className="text-xs text-amber-800 font-medium mt-1 flex items-center gap-1">
              <Building2 size={12} />
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </p>
          )}
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
          >
            <Plus size={18} /> አዲስ ምርት
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ጠቅላላ ምርቶች"
          value={stats.total}
          icon={ShoppingCart}
          color="bg-amber-700"
        />
        <StatCard
          label="ጠቅላላ የሽያጭ ዋጋ"
          value={formatETB(stats.totalSellingValue)}
          icon={DollarSign}
          color="bg-emerald-700"
        />
        <StatCard
          label="ጠቅላላ የግዥ ወጪ"
          value={formatETB(stats.totalPurchaseCost)}
          icon={Receipt}
          color="bg-blue-700"
        />
        <StatCard
          label="ጠቅላላ ትርፍ"
          value={formatETB(stats.totalProfit)}
          icon={TrendingUp}
          color={stats.totalProfit < 0 ? 'bg-red-600' : 'bg-teal-700'}
        />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ፈልግ (ስም ወይም ኮድ)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm bg-white text-stone-800"
          >
            <option value="all">ሁሉም ምድቦች</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {isAdminActor ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm bg-white text-stone-800"
            >
              <option value="all">ሁሉም ቅርንጫፎች</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/70 text-sm flex items-center gap-2">
              <Building2 size={14} />
              <span className="font-medium truncate">
                {user?.branch
                  ? typeof user.branch === 'object'
                    ? user.branch.name
                    : 'ቅርንጫፍ'
                  : 'ቅርንጫፍ'}
              </span>
            </div>
          )}
          <EthiopianDateInput
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="በኢትዮጵያ ቀን አጣራ"
          />
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-100/80 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">ኮድ</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">የእቃ አይነት</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">ብዛት</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">የመግዣ</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">የመሸጫ</th>
                <th className="px-4 py-3 text-right font-semibold text-stone-700">ትርፍ</th>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">ቀን</th>
                <th className="px-4 py-3 text-center font-semibold text-stone-700">ተግባር</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                        <ShoppingCart size={28} className="text-stone-400" />
                      </div>
                      <p className="text-stone-500 text-sm">ምንም ምርት አልተገኘም</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const profit = (product.sellingPrice || 0) - (product.unitPrice || 0);
                  const rowCanModify = canActorModifyProduct(product);
                  return (
                    <tr
                      key={product._id}
                      className="border-b border-stone-100 hover:bg-amber-50/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-amber-800 font-semibold">
                        {product.code}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900">{product.name}</p>
                        <p className="text-xs text-stone-500 truncate max-w-xs">
                          {product.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            'font-semibold ' +
                            (product.quantity === 0
                              ? 'text-red-600'
                              : product.quantity < 10
                              ? 'text-amber-700'
                              : 'text-stone-800')
                          }
                        >
                          {product.quantity} {product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {formatETB(product.unitPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-900">
                        {formatETB(product.sellingPrice || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-emerald-700 font-semibold">
                          +{formatETB(profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatEthiopianDate(product.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewProduct(product)}
                          onEdit={() => {
                            setEditingProduct(product);
                            setShowModal(true);
                          }}
                          onDelete={() => handleDeleteClick(product)}
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
        onClose={() => {
          setShowModal(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? 'ምርት አስተካክል' : 'አዲስ ምርት'}
        size="md"
      >
        <ProductForm
          product={editingProduct}
          branches={branches}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
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
          <p className="text-xs text-stone-500">{label}</p>
          <p className="text-xl font-bold text-stone-900 mt-1">{value}</p>
        </div>
        <div className={'p-2.5 rounded-lg ' + color}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </Card>
  );
}

function ProductForm({ product, branches, onSave, onCancel, currentUser }) {
  const isStaff = STAFF_ROLES.includes(currentUser?.role);

  const defaultBranch =
    isStaff && currentUser?.branch
      ? typeof currentUser.branch === 'object'
        ? currentUser.branch._id
        : currentUser.branch
      : product?.branch?._id || product?.branch || '';

  const defaultCreatedDate = product?.createdAt
    ? toIsoDateFromUtc(toUtcNoonDate(product.createdAt))
    : toIsoDateFromUtc(new Date());

  const [form, setForm] = useState({
    name: product?.name || 'ግሩም ኤሌክትሪክ ምጣድ',
    category: product?.category || 'ምጣድ',
    description: product?.description || '',
    quantity: product?.quantity ?? 0,
    unit: product?.unit || 'pcs',
    unitPrice: product?.unitPrice ?? 3600,
    sellingPrice: product?.sellingPrice ?? 4500,
    status: product?.status || 'in_stock',
    branch: defaultBranch,
    createdAt: defaultCreatedDate,
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: ['quantity', 'unitPrice', 'sellingPrice'].includes(name)
        ? Number(value)
        : value,
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
      createdAt: form.createdAt || undefined,
    });
  };

  const profit = form.sellingPrice - form.unitPrice;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="የእቃ አይነት *">
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          required
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800 bg-white"
        />
      </FormField>

      <FormField label="መግለጫ">
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          rows={2}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm resize-none text-stone-800 bg-white"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="ብዛት *">
          <input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={onChange}
            required
            min={0}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800 bg-white"
          />
        </FormField>
        <FormField label="መለኪያ">
          <input
            name="unit"
            value={form.unit}
            onChange={onChange}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800 bg-white"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="የመግዣ ዋጋ *">
          <input
            type="number"
            name="unitPrice"
            value={form.unitPrice}
            onChange={onChange}
            required
            min={0}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800 bg-white"
          />
        </FormField>
        <FormField label="የመሸጫ ዋጋ *">
          <input
            type="number"
            name="sellingPrice"
            value={form.sellingPrice}
            onChange={onChange}
            required
            min={0}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800 bg-white"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="ቅርንጫፍ *">
          {isStaff ? (
            <div className="w-full px-3 py-2 rounded-lg bg-amber-50 text-amber-900 text-sm font-medium">
              {typeof currentUser.branch === 'object'
                ? currentUser.branch?.name
                : 'ቅርንጫፍ'}
            </div>
          ) : (
            <select
              name="branch"
              value={form.branch}
              onChange={onChange}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 text-sm text-stone-800"
            >
              <option value="">— ይምረጡ —</option>
              {branches.length === 0 ? (
                <option value="" disabled>
                  ቅርንጫፍ በመጫን ላይ...
                </option>
              ) : (
                branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          )}
        </FormField>

        <FormField label="ቀን (የኢትዮጵያ)">
          <EthiopianDateInput
            value={form.createdAt}
            onChange={(val) => setForm((f) => ({ ...f, createdAt: val }))}
          />
        </FormField>
      </div>

      <div
        className={
          'rounded-lg p-3 text-sm ' + (profit < 0 ? 'bg-red-50' : 'bg-emerald-50')
        }
      >
        <div className="flex justify-between">
          <span className="text-stone-600">ትርፍ: </span>
          <span
            className={
              'font-bold ' + (profit < 0 ? 'text-red-600' : 'text-emerald-700')
            }
          >
            {profit < 0 ? '-' : '+'}
            {formatETB(Math.abs(profit))}
          </span>
        </div>
        {form.unitPrice > 0 && (
          <div className="flex justify-between mt-1 text-xs">
            <span className="text-stone-500">ትርፍ መጠን:</span>
            <span className={profit < 0 ? 'text-red-600' : 'text-emerald-700'}>
              {((profit / form.unitPrice) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-stone-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium hover:bg-stone-50 transition"
        >
          ሰርዝ
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition"
        >
          {product ? 'አስተካክል' : 'ጨምር'}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ProductView({ product }) {
  const status = PRODUCT_STATUS[product.status] || {
    label: product.status,
    color: 'gray',
  };
  const profit = (product.sellingPrice || 0) - (product.unitPrice || 0);
  const profitMargin =
    (product.unitPrice || 0) > 0
      ? ((profit / product.unitPrice) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between pb-3 border-b border-stone-100">
        <div>
          <p className="font-mono text-xs text-amber-800 font-semibold">{product.code}</p>
          <p className="font-bold text-stone-900 text-lg mt-0.5">{product.name}</p>
          {product.category && (
            <p className="text-xs text-stone-500 mt-0.5">{product.category}</p>
          )}
        </div>
        <Badge color={status.color}>{status.label}</Badge>
      </div>

      {product.description && (
        <p className="text-stone-600 bg-stone-50 p-3 rounded-lg">{product.description}</p>
      )}

      <div className="space-y-2.5">
        <Row label="ብዛት" value={`${product.quantity} ${product.unit || 'pcs'}`} bold />
        <Row label="የመግዣ ዋጋ" value={formatETB(product.unitPrice || 0)} />
        <Row label="የመሸጫ ዋጋ" value={formatETB(product.sellingPrice || 0)} bold />
        <Row
          label="ትርፍ (በአንዱ)"
          value={`${profit < 0 ? '-' : '+'}${formatETB(Math.abs(profit))} (${profitMargin}%)`}
          color={profit < 0 ? 'text-red-600' : 'text-emerald-700'}
          bold
        />
        <Row label="ቅርንጫፍ" value={product.branch?.name || '-'} />
        <Row label="ቀን" value={formatEthiopianDate(product.createdAt)} />
      </div>
    </div>
  );
}

function Row({ label, value, mono, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500 flex-shrink-0">{label}:</span>
      <span
        className={`text-right ${bold ? 'font-semibold' : ''} ${
          mono ? 'font-mono text-xs' : ''
        } ${color || 'text-stone-800'}`}
      >
        {value}
      </span>
    </div>
  );
}