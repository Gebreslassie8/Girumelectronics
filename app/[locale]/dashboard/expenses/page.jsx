'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Plus, Search, Wallet, DollarSign, Calendar, CreditCard,
  Banknote, Building2, User, Loader2,
} from 'lucide-react';
import { formatETB, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ActionButtons from '@/components/ui/ActionButtons';
import toast from 'react-hot-toast';

const T = {
  expenses:        '\u12C8\u132A\u12CE\u127D',
  total:           '\u1320\u1245\u120B\u120B',
  totalAmount:     '\u1320\u1245\u120B\u120B \u12C8\u132A',
  newExpense:      '\u12A0\u12F2\u1235 \u12C8\u132A',
  cash:            '\u1325\u122C \u1308\u1295\u12D8\u1265',
  nonCash:         '\u12EB\u120D\u1206\u1290 \u1325\u122C',
  search:          '\u1348\u120D\u130D (\u1218\u130D\u1208\u132B)...',
  allCategories:   '\u1201\u1209\u121D \u121D\u12F5\u1266\u127D',
  allPayments:     '\u1201\u1209\u121D \u12E8\u12AD\u134D\u12EB \u12D8\u12F4\u12CE\u127D',
  allBranches:     '\u1201\u1209\u121D \u1245\u122D\u1295\u132B\u134E\u127D',
  branch:          '\u1245\u122D\u1295\u132B\u134D',
  description:     '\u1218\u130D\u1208\u132B',
  paidTo:          '\u12E8\u1270\u12A8\u1348\u1208\u1260\u1275 \u1230\u12CD',
  category:        '\u121D\u12F5\u1265',
  amount:          '\u1218\u1320\u1295',
  paymentMethod:   '\u12E8\u12AD\u134D\u12EB \u12D8\u12F4',
  date:            '\u1240\u1295',
  action:          '\u1270\u130D\u1263\u122D',
  noData:          '\u121D\u1295\u121D \u12C8\u132A \u12A0\u120D\u1270\u1308\u1298\u121D',
  loading:         '\u1260\u1218\u132B\u1295 \u120B\u12ED...',
  error:           '\u1235\u1205\u1270\u1275 \u1270\u1348\u1325\u122F\u120D',
  retry:           '\u12A5\u1295\u12F0\u1308\u1293 \u121E\u12AD\u122D',
  required:        '\u12A0\u1235\u1348\u120D\u130B\u120D',
  amountLabel:     '\u1218\u1320\u1295:',
  optional:        '\u121B\u1323\u1240\u122B',
  refPlaceholder:  '\u121D\u1233\u120C: \u12F0\u1228\u1230\u129D \u1241\u1325\u122D',
  descPlaceholder: '\u121D\u1233\u120C: \u12E8\u1262\u122E \u12AA\u122B\u12ED',
  paidPlaceholder: '\u121D\u1233\u120C: \u12A0\u1260\u1260 \u12A8\u1260\u12F0',
  cancel:          '\u1230\u122D\u12DD',
  save:            '\u1308\u121D\u122D',
  update:          '\u12A0\u1235\u1270\u12AB\u12AD\u120D',
  deleteTitle:     '\u12C8\u132A \u12ED\u1230\u1228\u12DD?',
  deleteMsg:       '\u12ED\u1205\u1295 \u12C8\u132A \u1218\u1230\u1228\u12DD \u12ED\u1348\u120D\u130B\u1209?',
  confirmDelete:   '\u12A0\u12CE\u1363 \u1230\u122D\u12DD',
  keep:            '\u1270\u12C8\u12CD',
  branchReq:       '\u1245\u122D\u1295\u132B\u134D \u12ED\u121D\u1228\u1321',
  successAdd:      '\u12C8\u132A \u1270\u1328\u121D\u122F\u120D',
  successUpdate:   '\u12C8\u132A \u1270\u1235\u1270\u12AB\u12AD\u120F\u120D',
  successDelete:   '\u12C8\u132A \u1270\u1230\u122D\u12DF\u120D',
  createErr:       '\u1235\u1205\u1270\u1275 \u1270\u1348\u1325\u122F\u120D',
  branchNotFound:  '\u1245\u122D\u1295\u132B\u134D \u12DD\u122D\u12DD\u120D \u12A0\u120D\u1270\u1308\u1298\u121D \u2014 /api/branches \u12EB\u1235\u1348\u120D\u130B\u120D',
};

const CATEGORIES = [
  { value: 'purchase',    label: '\u130D\u12DA' },
  { value: 'salary',      label: '\u12F0\u1218\u12C8\u12DD' },
  { value: 'rent',        label: '\u12AA\u122B\u12ED' },
  { value: 'utilities',   label: '\u1218\u1308\u120D\u1308\u120B' },
  { value: 'transport',   label: '\u1275\u122B\u1295\u1235\u133E\u122D\u1275' },
  { value: 'maintenance', label: '\u1325\u1308\u1293' },
  { value: 'marketing',   label: '\u121B\u122D\u12AC\u1272\u1295\u130D' },
  { value: 'other',       label: '\u120C\u120B' },
];

const PAYMENT_METHODS = {
  cash:     { label: '\u1325\u122C \u1308\u1295\u12D8\u1265', color: 'green' },
  bank:     { label: '\u1263\u1295\u12AD',       color: 'blue' },
  telebirr: { label: '\u1274\u120C\u1265\u122D',    color: 'purple' },
  cbe_birr: { label: '\u1232\u1262\u12A2 \u1265\u122D', color: 'purple' },
  other:    { label: '\u120C\u120B',             color: 'gray' },
};

const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = ['admin', 'owner', 'seller'].includes(user?.role);
  const canDelete = ['admin', 'owner'].includes(user?.role);
  const userBranchId = useMemo(() => {
    if (!user?.branch) return null;
    return typeof user.branch === 'object' ? user.branch._id : user.branch;
  }, [user]);

  const loadExpenses = async () => {
    setLoading(true); setFetchError(null);
    try {
      const data = await apiFetch('/expenses');
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err?.message || T.error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadExpenses(); }, []);
  useEffect(() => {
    apiFetch('/branches').then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => setBranches([]));
  }, []);

  const roleFiltered = useMemo(() => {
    if (user?.role !== 'seller' || !userBranchId) return expenses;
    return expenses.filter((e) => {
      const bid = typeof e.branch === 'object' ? e.branch?._id : e.branch;
      return String(bid) === String(userBranchId);
    });
  }, [expenses, user, userBranchId]);

  const filtered = useMemo(() => {
    return roleFiltered.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = (e.description || '').toLowerCase().includes(q)
        || (e.paidTo || '').toLowerCase().includes(q)
        || (e.reference || '').toLowerCase().includes(q);
      const matchPayment = paymentFilter === 'all' || e.paymentMethod === paymentFilter;
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const bid = typeof e.branch === 'object' ? e.branch?._id : e.branch;
      const matchBranch = branchFilter === 'all' || String(bid) === String(branchFilter);
      return matchSearch && matchPayment && matchCategory && matchBranch;
    });
  }, [roleFiltered, search, paymentFilter, categoryFilter, branchFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const totalAmount = roleFiltered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const cashTotal = roleFiltered.filter((e) => e.paymentMethod === 'cash').reduce((s, e) => s + Number(e.amount || 0), 0);
    return { total, totalAmount, cashTotal, nonCashTotal: totalAmount - cashTotal };
  }, [roleFiltered]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingExpense) {
        const updated = await apiFetch(`/expenses/${editingExpense._id}`, { method: 'PATCH', body: JSON.stringify(data) });
        setExpenses((prev) => prev.map((e) => (e._id === editingExpense._id ? { ...e, ...updated } : e)));
        toast.success(T.successUpdate);
      } else {
        const created = await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) });
        setExpenses((prev) => [created, ...prev]);
        toast.success(T.successAdd);
      }
      setShowModal(false); setEditingExpense(null);
    } catch (err) {
      toast.error(err?.message || T.createErr);
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/expenses/${deleteTarget._id}`, { method: 'DELETE' });
      setExpenses((prev) => prev.filter((e) => e._id !== deleteTarget._id));
      toast.success(T.successDelete);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.message || T.createErr);
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{T.expenses}</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} {T.expenses} · {formatETB(stats.totalAmount)} {T.total}</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingExpense(null); setShowModal(true); }}>
            <Plus size={18} /> {T.newExpense}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={T.total} value={stats.total} icon={Wallet} color="bg-blue-500" />
        <StatCard label={T.totalAmount} value={formatETB(stats.totalAmount)} icon={DollarSign} color="bg-red-500" />
        <StatCard label={T.cash} value={formatETB(stats.cashTotal)} icon={Banknote} color="bg-green-500" />
        <StatCard label={T.nonCash} value={formatETB(stats.nonCashTotal)} icon={CreditCard} color="bg-purple-500" />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder={T.search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">{T.allCategories}</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">{T.allPayments}</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {['admin', 'owner'].includes(user?.role) ? (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="all">{T.allBranches}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
              <Building2 size={14} />
              <span className="font-medium truncate">
                {user?.branch ? (typeof user.branch === 'object' ? user.branch.name : T.branch) : T.branch}
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.description}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.paidTo}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{T.category}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{T.amount} (ETB)</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{T.paymentMethod}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.branch}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{T.date}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{T.action}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <Loader2 size={28} className="animate-spin text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{T.loading}</p>
                </td></tr>
              ) : fetchError ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <p className="text-sm text-red-600 font-medium">{T.error}</p>
                  <p className="text-xs text-gray-500 mt-1">{fetchError}</p>
                  <button onClick={loadExpenses} className="mt-3 px-3 py-1.5 text-xs bg-brand text-white rounded-lg">{T.retry}</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <Wallet size={28} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">{T.noData}</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map((expense) => {
                  const payment = PAYMENT_METHODS[expense.paymentMethod] || { label: expense.paymentMethod, color: 'gray' };
                  return (
                    <tr key={expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{expense.description || '-'}</p>
                        {expense.reference && <p className="text-xs text-gray-400 mt-0.5">#{expense.reference}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{expense.paidTo || '-'}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600">{categoryLabel(expense.category)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatETB(expense.amount)}</td>
                      <td className="px-4 py-3 text-center"><Badge color={payment.color}>{payment.label}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{expense.branch?.name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(expense.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => setViewExpense(expense)}
                          onEdit={() => { setEditingExpense(expense); setShowModal(true); }}
                          onDelete={() => setDeleteTarget(expense)}
                          canEdit={canManage}
                          canDelete={canDelete}
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingExpense(null); }}
        title={editingExpense ? T.update : T.newExpense} size="md">
        <ExpenseForm expense={editingExpense} onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingExpense(null); }}
          currentUser={user} branches={branches} saving={saving} />
      </Modal>

      <Modal isOpen={!!viewExpense} onClose={() => setViewExpense(null)} title={T.expenses}>
        {viewExpense && <ExpenseView expense={viewExpense} />}
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} title={T.deleteTitle} message={T.deleteMsg}
        itemName={deleteTarget?.description}
        itemType={`${deleteTarget ? formatETB(deleteTarget.amount) : ''}`}
        confirmLabel={T.confirmDelete} cancelLabel={T.keep}
        loading={deleting} variant="danger" />
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

function ExpenseForm({ expense, onSave, onCancel, currentUser, branches, saving }) {
  const isSeller = currentUser?.role === 'seller';
  const userBranchId = isSeller && currentUser?.branch
    ? (typeof currentUser.branch === 'object' ? currentUser.branch._id : currentUser.branch)
    : null;
  const defaultBranch = userBranchId
    || (expense?.branch && (typeof expense.branch === 'object' ? expense.branch._id : expense.branch))
    || branches[0]?._id || '';

  const [form, setForm] = useState({
    description: expense?.description || '',
    paidTo: expense?.paidTo || '',
    amount: expense?.amount ?? '',
    category: expense?.category || 'other',
    paymentMethod: expense?.paymentMethod || 'cash',
    expenseDate: expense?.expenseDate ? String(expense.expenseDate).slice(0, 10) : new Date().toISOString().split('T')[0],
    reference: expense?.reference || '',
    branch: defaultBranch,
  });

  const onChange = (e) => { const { name, value } = e.target; setForm((f) => ({ ...f, [name]: value })); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.branch) { toast.error(T.branchReq); return; }
    onSave({
      description: form.description.trim(),
      paidTo: form.paidTo.trim(),
      amount: Number(form.amount),
      category: form.category,
      paymentMethod: form.paymentMethod,
      expenseDate: form.expenseDate,
      reference: form.reference || undefined,
      branch: form.branch,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label={T.description + ' *'}>
        <input name="description" value={form.description} onChange={onChange} required placeholder={T.descPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </FormField>
      <FormField label={T.paidTo + ' *'}>
        <input name="paidTo" value={form.paidTo} onChange={onChange} required placeholder={T.paidPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </FormField>
      <FormField label={T.amount + ' (ETB) *'}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">ETB</span>
          <input type="number" name="amount" value={form.amount} onChange={onChange}
            required min={0} step="0.01" placeholder="0.00"
            className="w-full pl-14 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" />
        </div>
      </FormField>
      <FormField label={T.category + ' *'}>
        <select name="category" value={form.category} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </FormField>
      <FormField label={T.paymentMethod + ' *'}>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
            <button key={key} type="button" onClick={() => setForm((f) => ({ ...f, paymentMethod: key }))}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                form.paymentMethod === key ? 'border-brand bg-brand/10 text-brand' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}>
              {key === 'cash' ? <Banknote size={16} /> : <CreditCard size={16} />}
              {val.label}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label={T.date + ' *'}>
        <input type="date" name="expenseDate" value={form.expenseDate} onChange={onChange} required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </FormField>
      <FormField label={T.branch + ' *'}>
        {isSeller ? (
          <div className="w-full px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
            {typeof currentUser.branch === 'object' ? currentUser.branch?.name : T.branch}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-xs text-red-600">{T.branchNotFound}</div>
        ) : (
          <select name="branch" value={form.branch} onChange={onChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
      </FormField>
      <FormField label={T.optional}>
        <input name="reference" value={form.reference} onChange={onChange} placeholder={T.refPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </FormField>
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button type="button" onClick={onCancel} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">{T.cancel}</button>
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {expense ? T.update : T.save}
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

function ExpenseView({ expense }) {
  const payment = PAYMENT_METHODS[expense.paymentMethod] || { label: expense.paymentMethod };
  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center">
          <Wallet size={28} className="text-red-600" />
        </div>
        <div>
          <p className="font-bold text-gray-800 text-lg">{expense.description}</p>
          <p className="text-sm text-red-600 font-semibold">{formatETB(expense.amount)}</p>
        </div>
      </div>
      <div className="space-y-3 pt-3 text-sm">
        <Row label={T.paidTo} value={expense.paidTo || '-'} icon={User} />
        <Row label={T.category} value={categoryLabel(expense.category)} />
        <Row label={T.amount} value={formatETB(expense.amount)} icon={DollarSign} bold color="text-red-600" />
        <Row label={T.date} value={formatDate(expense.expenseDate)} icon={Calendar} />
        <Row label={T.branch} value={expense.branch?.name || '-'} icon={Building2} />
        {expense.reference && <Row label={T.optional} value={expense.reference} />}
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon, bold, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 flex-shrink-0 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}:
      </span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}