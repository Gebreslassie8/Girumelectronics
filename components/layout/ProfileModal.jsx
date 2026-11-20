'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  User, Mail, Phone, MapPin, Building2, Shield, Calendar,
  Save, X, Camera, Lock, Eye, EyeOff,
  LogOut, Edit, BadgeCheck, KeyRound, Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useProfile } from '@/components/providers/ProfileProvider';
import { formatDate, ROLE_LABELS, ROLE_COLORS, getInitials, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, token, logout } = useAuth();
  const { updateProfile, refresh } = useProfile();

  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);
  const hasLoadedRef = useRef(false);

  const [meta, setMeta] = useState({
    role: '',
    branch: null,
    createdAt: '',
  });

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    avatar: null,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const authHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const applyRecord = useCallback((record) => {
    if (!record) return;
    setForm({
      fullName: record.fullName || '',
      phone: record.phone || '',
      email: record.email || '',
      address: record.address || '',
      avatar: record.avatar || null,
    });
    setMeta({
      role: record.role || '',
      branch: record.branch || null,
      createdAt: record.createdAt || '',
    });
  }, []);

  const loadProfileFromDb = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/profile', {
        headers: authHeaders,
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await res.json();
      const record = data.user || data.profile || data;
      applyRecord(record);
    } catch {
      // keep current state if fetch fails
    } finally {
      setFetching(false);
    }
  }, [authHeaders, applyRecord]);

  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }

    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    setEditMode(false);
    setShowPasswordForm(false);
    loadProfileFromDb();
  }, [isOpen, loadProfileFromDb]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeRole = meta.role || user?.role || 'customer';
  const activeBranch = meta.branch ?? user?.branch;
  const activeCreatedAt = meta.createdAt || user?.createdAt;
  const roleLabel = ROLE_LABELS[activeRole] || 'ተጠቃሚ';
  const roleColor = ROLE_COLORS[activeRole] || ROLE_COLORS.customer;
  const initials = getInitials(form.fullName);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('ፋይሉ ከ2MB መብለጥ የለበትም');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, avatar: reader.result }));
      toast.success('ፎቶ ተመርጧል');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'መገለጫ ማስቀመጥ አልተቻለም');
      }

      const updated = data.user || data.profile || data || form;
      applyRecord(updated);
      if (typeof updateProfile === 'function') {
        updateProfile(updated);
      }
      if (typeof refresh === 'function') {
        refresh();
      }

      toast.success('መገለጫ ተስተካክሏል');
      setEditMode(false);
      onClose();
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('አዲሶቹ ፓስወርዶች አይመሳሰሉም');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('ፓስወርድ ቢያንስ 6 ፊደል መሆን አለበት');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'ፓስወርድ መቀየር አልተቻለም');
      }

      toast.success('ፓስወርድ ተቀይሯል');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      onClose();
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/25 backdrop-blur-[2px] p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-3xl max-h-[88vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ዝጋ"
          className="absolute top-3.5 right-3.5 z-30 w-8 h-8 rounded-lg bg-stone-100 text-stone-600 hover:bg-red-50 hover:text-red-700 transition flex items-center justify-center"
        >
          <X size={17} />
        </button>

        {fetching ? (
          <div className="p-14 flex flex-col items-center justify-center gap-2.5 text-stone-500">
            <Loader2 size={24} className="animate-spin text-amber-700" />
            <p className="text-xs sm:text-sm font-medium">መረጃ ከዳታቤዝ በመጫን ላይ...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5">
            {/* LEFT — Warm Profile Summary */}
            <div className="md:col-span-2 bg-gradient-to-br from-amber-800 via-amber-700 to-stone-800 p-6 text-white flex flex-col justify-between">
              <div>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <div
                      className={cn(
                        'w-24 h-24 rounded-full ring-2 ring-amber-200/50 shadow-md flex items-center justify-center text-white text-2xl font-bold overflow-hidden bg-white/15',
                        !form.avatar && roleColor.solid
                      )}
                    >
                      {form.avatar ? (
                        <img src={form.avatar} alt={form.fullName} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    {editMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          aria-label="ፎቶ ቀይር"
                          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white text-amber-800 flex items-center justify-center shadow hover:bg-amber-50 transition"
                        >
                          <Camera size={14} />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>

                  <h2 className="text-lg font-bold leading-snug">
                    {form.fullName || 'ተጠቃሚ'}
                  </h2>

                  <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-medium text-amber-50">
                    <BadgeCheck size={13} />
                    {roleLabel}
                  </div>

                  {activeBranch && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-100/85">
                      <Building2 size={12} />
                      {typeof activeBranch === 'object' ? activeBranch.name : 'ቅርንጫፍ'}
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/15 my-4" />

                <div className="space-y-2.5 text-xs">
                  <MetaRow icon={Phone} label="ስልክ" value={form.phone} />
                  <MetaRow icon={Mail} label="ኢሜይል" value={form.email} />
                  <MetaRow icon={MapPin} label="አድራሻ" value={form.address} />
                  <MetaRow
                    icon={Calendar}
                    label="የተቀላቀሉበት"
                    value={activeCreatedAt ? formatDate(activeCreatedAt) : ''}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
              >
                <LogOut size={15} />
                ውጣ
              </button>
            </div>

            {/* RIGHT — Profile Form & Password Security */}
            <div className="md:col-span-3 bg-stone-50/70 p-6 overflow-y-auto max-h-[88vh]">
              <div className="flex items-center justify-between gap-2 pr-8 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">የግል መረጃ</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {editMode ? 'መረጃዎን ያስተካክሉ' : 'የመለያ ዝርዝሮች'}
                  </p>
                </div>

                {!editMode ? (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition"
                  >
                    <Edit size={14} />
                    አስተካክል
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      loadProfileFromDb();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-medium hover:bg-stone-100 transition"
                  >
                    <X size={14} />
                    ሰርዝ
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <FieldRow
                  label="ሙሉ ስም"
                  icon={User}
                  value={form.fullName}
                  editMode={editMode}
                  onChange={(v) => setForm((prev) => ({ ...prev, fullName: v }))}
                  required
                />
                <FieldRow
                  label="ስልክ ቁጥር"
                  icon={Phone}
                  value={form.phone}
                  editMode={editMode}
                  onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))}
                  required
                  type="tel"
                />
                <FieldRow
                  label="ኢሜይል"
                  icon={Mail}
                  value={form.email}
                  editMode={editMode}
                  onChange={(v) => setForm((prev) => ({ ...prev, email: v }))}
                  type="email"
                />
                <FieldRow
                  label="አድራሻ"
                  icon={MapPin}
                  value={form.address}
                  editMode={editMode}
                  onChange={(v) => setForm((prev) => ({ ...prev, address: v }))}
                />

                {editMode && (
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition disabled:opacity-50"
                    >
                      <Save size={16} />
                      {saving ? 'በማስቀመጥ ላይ...' : 'አስቀምጥ'}
                    </button>
                  </div>
                )}
              </form>

              {/* Password Section */}
              <div className="mt-6 pt-5 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowPasswordForm((prev) => !prev)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white hover:border-amber-400 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <KeyRound size={15} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs sm:text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                        <Shield size={13} className="text-amber-700" />
                        ፓስወርድ ቀይር
                      </p>
                      <p className="text-[11px] text-stone-500">የመለያ ደህንነት ፓስወርድ ያዘምኑ</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-800">
                    {showPasswordForm ? 'ዝጋ' : 'ክፈት'}
                  </span>
                </button>

                {showPasswordForm && (
                  <form
                    onSubmit={handleChangePassword}
                    className="mt-3 space-y-3 p-3.5 rounded-xl bg-white border border-stone-200"
                  >
                    <PasswordRow
                      label="የአሁኑ ፓስወርድ"
                      value={passwordForm.currentPassword}
                      onChange={(v) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: v }))
                      }
                      show={showPasswords.current}
                      onToggle={() =>
                        setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                      }
                    />
                    <PasswordRow
                      label="አዲስ ፓስወርድ"
                      value={passwordForm.newPassword}
                      onChange={(v) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: v }))
                      }
                      show={showPasswords.new}
                      onToggle={() =>
                        setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                      }
                    />
                    <PasswordRow
                      label="አዲሱን ያረጋግጡ"
                      value={passwordForm.confirmPassword}
                      onChange={(v) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: v }))
                      }
                      show={showPasswords.confirm}
                      onToggle={() =>
                        setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                      }
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs sm:text-sm font-semibold hover:bg-stone-800 transition disabled:opacity-50"
                    >
                      <Save size={15} />
                      {saving ? 'በመቀየር ላይ...' : 'ፓስወርድ አስቀምጥ'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-amber-100" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-amber-100/75">{label}</p>
        <p className="text-xs font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function FieldRow({ label, icon: Icon, value, onChange, editMode, type = 'text', required }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="relative">
        <Icon
          size={15}
          className="text-amber-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        {editMode ? (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-amber-600 text-sm text-stone-800 bg-white transition"
          />
        ) : (
          <div className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-stone-200/80 text-sm text-stone-800 min-h-[38px] flex items-center">
            {value || <span className="text-stone-400">—</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordRow({ label, value, onChange, show, onToggle }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
        {label}
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="text-amber-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          className="w-full pl-9 pr-9 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-amber-600 text-sm text-stone-800 bg-white transition"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label="ፓስወርድ አሳይ/ደብቅ"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}