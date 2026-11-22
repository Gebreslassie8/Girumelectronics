'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings, Building2, Bell, Shield, Palette, Globe, Save, Loader2,
  UserX, Trash2, Ban, CheckCircle2, Search, AlertTriangle, Languages,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS, formatETB, cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const COPY = {
  am: {
    settings: 'ቅንብሮች',
    yourRole: 'የእርስዎ ሚና',
    defaultUser: 'ተጠቃሚ',
    save: 'አስቀምጥ',
    loading: 'ቅንብሮች በመጫን ላይ...',
    savedSuccess: 'ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል',
    saveError: 'ቅንብሮችን ማስቀመጥ አልተቻለም',
    genericError: 'ስህተት ተፈጥሯል',
    tabs: {
      general: 'አጠቃላይ',
      branch: 'ቅርንጫፍ',
      notifications: 'ማሳወቂያዎች',
      security: 'ደህንነት እና መለያ',
      appearance: 'አቀራረብ',
      localization: 'ቋንቋ (Amharic / English)',
    },
    general: {
      title: 'አጠቃላይ መረጃ',
      subtitle: 'የመለያዎን መሰረታዊ መረጃ ያስተዳድሩ።',
      fullName: 'ሙሉ ስም',
      email: 'ኢሜይል',
      phone: 'ስልክ ቁጥር',
      role: 'ሚና',
      assignedBranch: 'የተመደበ ቅርንጫፍ',
    },
    branch: {
      title: 'የቅርንጫፍ ቅንብሮች',
      subtitle: 'ከዳታቤዝ የተገኙ ቅርንጫፎችን ይምረጡ እና መረጃቸውን ያስተዳድሩ።',
      selectBranch: 'ቅርንጫፍ ይምረጡ',
      branchName: 'የቅርንጫፍ ስም',
      branchCode: 'ኮድ',
      address: 'አድራሻ',
      phone: 'ስልክ',
      workingHours: 'የስራ ሰዓት',
      revenue: 'ገቢ',
      orders: 'ትዕዛዞች',
      users: 'ተጠቃሚዎች',
      noBranch: 'ምንም ቅርንጫፍ አልተመደበም',
      updateBranchSuccess: 'የቅርንጫፍ መረጃ ተዘምኗል',
    },
    notifications: {
      title: 'የማሳወቂያ ቅንብሮች',
      subtitle: 'የትኞቹን ማሳወቂያዎች መቀበል እንደሚፈልጉ ይምረጡ።',
      orders: 'የትዕዛዝ ማሳወቂያዎች',
      stock: 'የክምችት ማነስ ማንቂያዎች',
      payments: 'የክፍያ ማሳወቂያዎች',
      users: 'የተጠቃሚ መለያ ማሳወቂያዎች',
      branches: 'የቅርንጫፍ ማሳወቂያዎች',
      system: 'የስርዓት ማሳወቂያዎች',
    },
    security: {
      title: 'ደህንነት፣ መለያ ማገድ እና መሰረዝ',
      subtitle: 'የመለያ ደህንነት፣ የተጠቃሚ መለያዎችን ማገድ እና መለያ መሰረዝ ያስተዳድሩ።',
      sessionTimeout: 'ራስ-ሰር መውጫ ጊዜ (ደቂቃ)',
      twoFactor: 'ተጨማሪ የደህንነት ማረጋገጫ (2FA)',
      userManagementTitle: 'የተጠቃሚ መለያዎችን አስተዳድር (አግድ / ክፈት / ሰርዝ)',
      userManagementDesc: 'ተጠቃሚዎችን ለጊዜው ማገድ፣ መክፈት ወይም መለያቸውን በቋሚነት መሰረዝ ይችላሉ።',
      searchUsers: 'በስም፣ በኢሜይል ወይም በሚና ይፈልጉ...',
      loadingUsers: 'ተጠቃሚዎች በመጫን ላይ...',
      noUsers: 'ምንም ተጠቃሚ አልተገኘም',
      blocked: 'ታግዷል',
      active: 'ንቁ',
      blockBtn: 'አግድ',
      unblockBtn: 'ክፈት',
      deleteUserBtn: 'ሰርዝ',
      cannotModifySelf: 'የራስዎን መለያ እዚህ ማገድ ወይም መሰረዝ አይችሉም',
      blockSuccess: 'የተጠቃሚ መለያ ታግዷል',
      unblockSuccess: 'የተጠቃሚ መለያ ተከፍቷል',
      blockModalTitle: 'የተጠቃሚ መለያ ይታገድ?',
      blockModalMsg: 'ይህ ተጠቃሚ ወደ ስርዓቱ እንዳይገባ ይታገዳል።',
      confirmBlock: 'አዎ፣ አግድ',
      deleteUserModalTitle: 'የተጠቃሚ መለያ ይሰረዝ?',
      deleteUserModalMsg: 'ይህ የተጠቃሚ መለያ በቋሚነት ይሰረዛል። ይህንን እርምጃ መመለስ አይቻልም።',
      confirmDelete: 'አዎ፣ በቋሚነት ሰርዝ',
      cancel: 'ሰርዝ',
      deleteSuccess: 'መለያ በተሳካ ሁኔታ ተሰርዟል',
      dangerZoneTitle: 'የራስዎን መለያ በቋሚነት መሰረዝ',
      dangerZoneDesc: 'መለያዎን ከሰረዙ በኋላ ውሂብዎ መልሶ አይገኝም። እባክዎን ለማረጋገጥ DELETE ብለው ይጻፉ።',
      typeDeletePlaceholder: 'DELETE ብለው ያስገቡ',
      deleteMyAccountBtn: 'የእኔን መለያ ሰርዝ',
    },
    appearance: {
      title: 'የአቀራረብ ቅንብሮች',
      subtitle: 'የገጹን የጀርባ ቀለም (Background Color) እና የአቀማመጥ ጥግግት ይምረጡ።',
      theme: 'የጀርባ ቀለም / ጭብጥ (Background Theme)',
      warmStone: 'ሞቅ ያለ ድንጋይ (Warm Stone)',
      skySlate: 'ሰማያዊና ስሌት (Sky Slate)',
      emeraldMist: 'ኤመራልድ (Emerald Mist)',
      compactMode: 'የታመቀ አቀማመጥ (Compact Mode)',
      activePreview: 'አሁን የተመረጠ የጀርባ ቀለም',
    },
    localization: {
      title: 'ቋንቋ እና ምንዛሪ (Language & Currency)',
      subtitle: 'የስርዓቱን ቋንቋ በአማርኛ (Amharic) ወይም በእንግሊዝኛ (English) ይምረጡ።',
      languageLabel: 'የስርዓት ቋንቋ',
      amharic: 'አማርኛ (Amharic)',
      english: 'English (እንግሊዝኛ)',
      currencyLabel: 'ምንዛሪ (Currency)',
    },
  },
  en: {
    settings: 'Settings',
    yourRole: 'Your Role',
    defaultUser: 'User',
    save: 'Save Changes',
    loading: 'Loading settings...',
    savedSuccess: 'Settings saved successfully',
    saveError: 'Failed to save settings',
    genericError: 'Something went wrong',
    tabs: {
      general: 'General',
      branch: 'Branch',
      notifications: 'Notifications',
      security: 'Security & Accounts',
      appearance: 'Appearance',
      localization: 'Language (Amharic / English)',
    },
    general: {
      title: 'General Information',
      subtitle: 'Manage your basic account details.',
      fullName: 'Full Name',
      email: 'Email',
      phone: 'Phone Number',
      role: 'Role',
      assignedBranch: 'Assigned Branch',
    },
    branch: {
      title: 'Branch Settings',
      subtitle: 'Select a branch from your database and manage its details.',
      selectBranch: 'Select Branch',
      branchName: 'Branch Name',
      branchCode: 'Code',
      address: 'Address',
      phone: 'Phone',
      workingHours: 'Working Hours',
      revenue: 'Revenue',
      orders: 'Orders',
      users: 'Users',
      noBranch: 'No branch assigned',
      updateBranchSuccess: 'Branch details updated',
    },
    notifications: {
      title: 'Notification Preferences',
      subtitle: 'Choose which notifications you want to receive.',
      orders: 'Order Notifications',
      stock: 'Low Stock Alerts',
      payments: 'Payment Notifications',
      users: 'User Account Notifications',
      branches: 'Branch Notifications',
      system: 'System Notifications',
    },
    security: {
      title: 'Security, Block Account & Delete Account',
      subtitle: 'Manage security settings, block/unblock user accounts, and delete accounts.',
      sessionTimeout: 'Session Timeout (minutes)',
      twoFactor: 'Two-Factor Authentication (2FA)',
      userManagementTitle: 'User Account Controls (Block / Unblock / Delete)',
      userManagementDesc: 'Block or unblock user accounts, or permanently delete a user account.',
      searchUsers: 'Search by name, email, or role...',
      loadingUsers: 'Loading users...',
      noUsers: 'No users found',
      blocked: 'Blocked',
      active: 'Active',
      blockBtn: 'Block',
      unblockBtn: 'Unblock',
      deleteUserBtn: 'Delete',
      cannotModifySelf: 'You cannot block or delete your own account here',
      blockSuccess: 'User account blocked',
      unblockSuccess: 'User account unblocked',
      blockModalTitle: 'Block User Account?',
      blockModalMsg: 'This user will be blocked from signing in and accessing the system.',
      confirmBlock: 'Yes, Block Account',
      deleteUserModalTitle: 'Delete User Account?',
      deleteUserModalMsg: 'This user account will be permanently deleted. This action cannot be undone.',
      confirmDelete: 'Yes, Permanently Delete',
      cancel: 'Cancel',
      deleteSuccess: 'Account deleted successfully',
      dangerZoneTitle: 'Delete Your Own Account',
      dangerZoneDesc: 'Deleting your account is permanent and cannot be undone. Type DELETE to confirm.',
      typeDeletePlaceholder: 'Type DELETE to confirm',
      deleteMyAccountBtn: 'Delete My Account',
    },
    appearance: {
      title: 'Appearance Settings',
      subtitle: 'Change page background color and layout density.',
      theme: 'Background Color Theme',
      warmStone: 'Warm Stone',
      skySlate: 'Sky Slate',
      emeraldMist: 'Emerald Mist',
      compactMode: 'Compact Mode',
      activePreview: 'Active Background Theme',
    },
    localization: {
      title: 'Language & Currency',
      subtitle: 'Switch the interface language between Amharic and English.',
      languageLabel: 'Interface Language',
      amharic: 'አማርኛ (Amharic)',
      english: 'English (እንግሊዝኛ)',
      currencyLabel: 'Currency',
    },
  },
};

const TABS_CONFIG = [
  { key: 'general',       icon: Settings,  roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'branch',        icon: Building2, roles: ['admin', 'owner', 'seller'] },
  { key: 'notifications', icon: Bell,      roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'security',      icon: Shield,    roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'appearance',    icon: Palette,   roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'localization',  icon: Globe,     roles: ['admin', 'owner', 'seller', 'customer'] },
];

const THEME_BG_MAP = {
  'warm-stone':   { wrapperBg: 'bg-stone-100',   hex: '#f5f5f4', swatch: 'bg-amber-700' },
  'sky-slate':    { wrapperBg: 'bg-sky-100',     hex: '#e0f2fe', swatch: 'bg-sky-600' },
  'emerald-mist': { wrapperBg: 'bg-emerald-100', hex: '#d1fae5', swatch: 'bg-emerald-600' },
};

const DEFAULT_SETTINGS = {
  general: {
    fullName: '',
    email: '',
    phone: '',
  },
  branch: {
    branchId: '',
    name: '',
    code: '',
    address: '',
    phone: '',
    workingHours: '08:00 - 18:00',
  },
  notifications: {
    orders: true,
    stock: true,
    payments: true,
    users: true,
    branches: true,
    system: true,
  },
  security: {
    sessionTimeout: 60,
    twoFactor: false,
  },
  appearance: {
    theme: 'warm-stone',
    compactMode: false,
  },
  localization: {
    locale: 'am',
    currency: 'ETB',
  },
};

function applyAppearanceToDom(appearance) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = appearance?.theme || 'warm-stone';
  const compact = Boolean(appearance?.compactMode);
  const bgHex = THEME_BG_MAP[theme]?.hex || '#f5f5f4';

  root.dataset.theme = theme;
  root.classList.toggle('compact-ui', compact);
  if (document.body) {
    document.body.dataset.theme = theme;
    document.body.classList.toggle('compact-ui', compact);
    document.body.style.backgroundColor = bgHex;
  }
}

function getEntityBranchId(record) {
  if (!record) return '';
  const raw = record.branch?._id ?? record.branch?.id ?? record.branch ?? record.branchId ?? '';
  return String(raw);
}

export default function SettingsPage() {
  const { user, token, logout } = useAuth();
  const role = (user?.role || 'customer').toLowerCase();
  const roleLabel = ROLE_LABELS?.[role] || user?.role || 'ተጠቃሚ';

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [branches, setBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const locale = settings?.localization?.locale === 'en' ? 'en' : 'am';
  const t = COPY[locale];

  const visibleTabs = useMemo(
    () =>
      TABS_CONFIG.filter((tab) => tab.roles.includes(role)).map((tab) => ({
        ...tab,
        label: t.tabs[tab.key],
      })),
    [role, t]
  );

  const [active, setActive] = useState('general');

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === active)) {
      setActive(visibleTabs[0]?.key || 'general');
    }
  }, [visibleTabs, active]);

  useEffect(() => {
    applyAppearanceToDom(settings.appearance);
  }, [settings.appearance]);

  const authHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadDbData = useCallback(async () => {
    try {
      const [bRes, oRes, uRes] = await Promise.all([
        apiFetch('/branches').catch(() => []),
        apiFetch('/orders').catch(() => []),
        apiFetch('/users').catch(() => []),
      ]);
      const bList = Array.isArray(bRes) ? bRes : bRes?.branches || bRes?.data || [];
      const oList = Array.isArray(oRes) ? oRes : oRes?.orders || oRes?.data || [];
      const uList = Array.isArray(uRes) ? uRes : uRes?.users || uRes?.data || [];

      setBranches(bList);
      setOrders(oList);
      setDbUsers(uList);

      if (bList.length > 0) {
        setSettings((prev) => {
          const currentId = String(prev.branch.branchId || '');
          const matched = bList.find((b) => String(b._id || b.id) === currentId) || bList[0];
          const bid = String(matched._id || matched.id || '');
          return {
            ...prev,
            branch: {
              ...prev.branch,
              branchId: bid,
              name: prev.branch.branchId ? prev.branch.name : matched.name || '',
              code: prev.branch.branchId ? prev.branch.code : matched.code || '',
              address: prev.branch.branchId ? prev.branch.address : matched.address || '',
              phone: prev.branch.branchId ? prev.branch.phone : matched.phone || '',
            },
          };
        });
      }
    } catch {
      // keep existing state
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: authHeaders,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      const serverSettings = data.settings || data || {};
      setSettings((prev) => ({
        ...prev,
        ...serverSettings,
        general: {
          fullName: user?.name || user?.fullName || prev.general.fullName,
          email: user?.email || prev.general.email,
          phone: user?.phone || prev.general.phone,
          ...(serverSettings.general || {}),
        },
        branch: {
          ...prev.branch,
          ...(serverSettings.branch || {}),
        },
        notifications: { ...prev.notifications, ...(serverSettings.notifications || {}) },
        security: { ...prev.security, ...(serverSettings.security || {}) },
        appearance: { ...prev.appearance, ...(serverSettings.appearance || {}) },
        localization: { ...prev.localization, ...(serverSettings.localization || {}) },
      }));
    } catch {
      try {
        const cached = localStorage.getItem('girum_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            general: {
              fullName: user?.name || user?.fullName || prev.general.fullName,
              email: user?.email || prev.general.email,
              phone: user?.phone || prev.general.phone,
              ...(parsed.general || {}),
            },
            branch: {
              ...prev.branch,
              ...(parsed.branch || {}),
            },
            notifications: { ...prev.notifications, ...(parsed.notifications || {}) },
            security: { ...prev.security, ...(parsed.security || {}) },
            appearance: { ...prev.appearance, ...(parsed.appearance || {}) },
            localization: { ...prev.localization, ...(parsed.localization || {}) },
          }));
        } else {
          setSettings((prev) => ({
            ...prev,
            general: {
              ...prev.general,
              fullName: user?.name || user?.fullName || '',
              email: user?.email || '',
              phone: user?.phone || '',
            },
          }));
        }
      } catch {
        // ignore storage errors
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, user]);

  useEffect(() => {
    loadSettings();
    loadDbData();
  }, [loadSettings, loadDbData]);

  const updateTabSettings = useCallback((tabKey, patchOrUpdater) => {
    setSettings((prev) => {
      const currentTab = prev[tabKey] || {};
      const nextTab =
        typeof patchOrUpdater === 'function'
          ? patchOrUpdater(currentTab)
          : { ...currentTab, ...patchOrUpdater };
      const updated = { ...prev, [tabKey]: nextTab };
      try {
        localStorage.setItem('girum_settings', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  }, []);

  const setLanguage = useCallback(
    (nextLocale) => {
      updateTabSettings('localization', { locale: nextLocale });
    },
    [updateTabSettings]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          tab: active,
          settings,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || t.saveError);
      }

      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }

      try {
        localStorage.setItem('girum_settings', JSON.stringify(settings));
      } catch {
        // ignore storage errors
      }

      toast.success(t.savedSuccess);
    } catch (err) {
      toast.error(err?.message || t.genericError);
    } finally {
      setSaving(false);
    }
  };

  const isCompact = Boolean(settings?.appearance?.compactMode);
  const currentThemeKey = settings?.appearance?.theme || 'warm-stone';
  const themeConfig = THEME_BG_MAP[currentThemeKey] || THEME_BG_MAP['warm-stone'];

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-200 px-4 py-6 rounded-2xl',
        themeConfig.wrapperBg
      )}
    >
      <div className={cn('max-w-5xl mx-auto', isCompact ? 'space-y-4 text-[13px]' : 'space-y-6')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
              <Settings size={25} className="text-amber-700" />
              {t.settings}
            </h1>
            <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <Shield size={13} className="text-amber-700" />
              {t.yourRole}: <span className="font-medium text-stone-700">{roleLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-semibold transition',
                  locale === 'am'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                )}
              >
                አማርኛ
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-semibold transition',
                  locale === 'en'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                )}
              >
                English
              </button>
            </div>

            <Button
              onClick={handleSave}
              loading={saving}
              disabled={loading || saving}
              className="bg-amber-700 hover:bg-amber-800 text-white border-amber-700"
            >
              <Save size={16} />
              {t.save}
            </Button>
          </div>
        </div>

        <Card padding="none" className="overflow-hidden border border-stone-200 bg-white rounded-2xl shadow-xs">
          <div className="flex overflow-x-auto border-b border-stone-200/80 bg-stone-50/60">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px',
                    isCompact ? 'px-4 py-2.5' : 'px-5 py-3.5',
                    isActive
                      ? 'border-amber-700 text-amber-900 bg-amber-50/70'
                      : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/70'
                  )}
                >
                  <Icon size={16} className={isActive ? 'text-amber-700' : 'text-stone-400'} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className={isCompact ? 'p-4' : 'p-6'}>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-500">
                <Loader2 size={22} className="animate-spin text-amber-700" />
                <p className="text-xs sm:text-sm">{t.loading}</p>
              </div>
            ) : (
              <>
                {active === 'general' && (
                  <GeneralTab
                    t={t}
                    roleLabel={roleLabel}
                    data={settings.general}
                    branchData={settings.branch}
                    onChange={(patch) => updateTabSettings('general', patch)}
                  />
                )}
                {active === 'branch' && (
                  <BranchTab
                    t={t}
                    branches={branches}
                    setBranches={setBranches}
                    orders={orders}
                    dbUsers={dbUsers}
                    authHeaders={authHeaders}
                    data={settings.branch}
                    onChange={(patch) => updateTabSettings('branch', patch)}
                  />
                )}
                {active === 'notifications' && (
                  <NotificationsTab
                    t={t}
                    data={settings.notifications}
                    onChange={(patch) => updateTabSettings('notifications', patch)}
                  />
                )}
                {active === 'security' && (
                  <SecurityTab
                    t={t}
                    role={role}
                    user={user}
                    users={dbUsers}
                    setUsers={setDbUsers}
                    authHeaders={authHeaders}
                    logout={logout}
                    data={settings.security}
                    onChange={(patch) => updateTabSettings('security', patch)}
                  />
                )}
                {active === 'appearance' && (
                  <AppearanceTab
                    t={t}
                    data={settings.appearance}
                    onChange={(patch) => updateTabSettings('appearance', patch)}
                  />
                )}
                {active === 'localization' && (
                  <LocalizationTab
                    t={t}
                    data={settings.localization}
                    onChange={(patch) => updateTabSettings('localization', patch)}
                  />
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function GeneralTab({ t, roleLabel, data, branchData, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-900">{t.general.title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{t.general.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.general.fullName}</label>
          <input
            type="text"
            value={data.fullName ?? ''}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.general.email}</label>
          <input
            type="email"
            value={data.email ?? ''}
            onChange={(e) => onChange({ email: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.general.phone}</label>
          <input
            type="text"
            value={data.phone ?? ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.general.role}</label>
          <div className="px-3 py-2 rounded-lg bg-stone-100 text-sm font-medium text-stone-700">
            {roleLabel}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.general.assignedBranch}</label>
          <div className="px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-800 flex items-center justify-between flex-wrap gap-2">
            <span className="font-semibold">{branchData?.name || t.branch.noBranch}</span>
            <span className="text-xs text-stone-500">
              {branchData?.code ? `${branchData.code} · ` : ''}
              {branchData?.address || ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchTab({ t, branches, setBranches, orders, dbUsers, authHeaders, data, onChange }) {
  const [updatingBranch, setUpdatingBranch] = useState(false);

  const selectedBranchObj = useMemo(
    () =>
      branches.find(
        (b) =>
          String(b._id || b.id) === String(data.branchId) ||
          (data.code && String(b.code) === String(data.code)) ||
          (data.name && String(b.name) === String(data.name))
      ) || branches[0] || null,
    [branches, data.branchId, data.code, data.name]
  );

  const dbMetrics = useMemo(() => {
    const branchId = String(selectedBranchObj?._id || selectedBranchObj?.id || data.branchId || '');
    const branchName = String(selectedBranchObj?.name || data.name || '').trim().toLowerCase();

    const matchingOrders = orders.filter((o) => {
      if (o?.status === 'cancelled') return false;
      const oid = getEntityBranchId(o);
      if (branchId && oid === branchId) return true;
      const oname = String(o?.branch?.name || o?.branchName || '').trim().toLowerCase();
      return branchName && oname === branchName;
    });

    const matchingUsers = dbUsers.filter((u) => {
      const uid = getEntityBranchId(u);
      if (branchId && uid === branchId) return true;
      const uname = String(u?.branch?.name || u?.branchName || '').trim().toLowerCase();
      return branchName && uname === branchName;
    });

    const computedRevenue = matchingOrders.reduce(
      (sum, o) => sum + (Number(o.totalPrice ?? o.revenue ?? o.amount) || 0),
      0
    );

    const revenue =
      typeof selectedBranchObj?.revenue === 'number'
        ? selectedBranchObj.revenue
        : computedRevenue;

    const ordersCount =
      typeof selectedBranchObj?.ordersCount === 'number'
        ? selectedBranchObj.ordersCount
        : matchingOrders.length;

    const usersCount =
      typeof selectedBranchObj?.usersCount === 'number'
        ? selectedBranchObj.usersCount
        : matchingUsers.length;

    return { revenue, ordersCount, usersCount };
  }, [selectedBranchObj, data.branchId, data.name, orders, dbUsers]);

  const handleSelectBranch = (branchId) => {
    const found = branches.find((b) => String(b._id || b.id) === String(branchId));
    if (!found) return;
    onChange({
      branchId: String(found._id || found.id || ''),
      name: found.name || '',
      code: found.code || '',
      address: found.address || '',
      phone: found.phone || '',
    });
  };

  const handleSaveBranchToDb = async () => {
    const targetId = data.branchId || selectedBranchObj?._id || selectedBranchObj?.id;
    if (!targetId) return;
    setUpdatingBranch(true);
    try {
      const res = await fetch(`/api/branches/${targetId}`, {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          code: data.code,
          address: data.address,
          phone: data.phone,
          workingHours: data.workingHours,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || t.genericError);
      }
      setBranches((prev) =>
        prev.map((b) =>
          String(b._id || b.id) === String(targetId)
            ? {
                ...b,
                ...payload.branch,
                name: data.name,
                code: data.code,
                address: data.address,
                phone: data.phone,
              }
            : b
        )
      );
      toast.success(t.branch.updateBranchSuccess);
    } catch (err) {
      toast.error(err?.message || t.genericError);
    } finally {
      setUpdatingBranch(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-stone-900">{t.branch.title}</h2>
          <p className="text-xs text-stone-500 mt-0.5">{t.branch.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={updatingBranch || !selectedBranchObj}
          onClick={handleSaveBranchToDb}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50"
        >
          {updatingBranch && <Loader2 size={13} className="animate-spin" />}
          {t.save} ({data.name || selectedBranchObj?.name || ''})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.selectBranch}</label>
          <select
            value={data.branchId || selectedBranchObj?._id || selectedBranchObj?.id || ''}
            onChange={(e) => handleSelectBranch(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-700"
          >
            {branches.length === 0 ? (
              <option value="">{t.branch.noBranch}</option>
            ) : (
              branches.map((b) => {
                const id = String(b._id || b.id);
                return (
                  <option key={id} value={id}>
                    {b.name} {b.code ? `(${b.code})` : ''} {b.address ? `— ${b.address}` : ''}
                  </option>
                );
              })
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.branchName}</label>
          <input
            type="text"
            value={data.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.branchCode}</label>
          <input
            type="text"
            value={data.code ?? ''}
            onChange={(e) => onChange({ code: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.address}</label>
          <input
            type="text"
            value={data.address ?? ''}
            onChange={(e) => onChange({ address: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.phone}</label>
          <input
            type="text"
            value={data.phone ?? ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.branch.workingHours}</label>
          <input
            type="text"
            value={data.workingHours ?? '08:00 - 18:00'}
            onChange={(e) => onChange({ workingHours: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs">
        <div>
          <p className="text-stone-500">{t.branch.revenue}</p>
          <p className="font-bold text-stone-900 mt-0.5">{formatETB(dbMetrics.revenue)}</p>
        </div>
        <div>
          <p className="text-stone-500">{t.branch.orders}</p>
          <p className="font-bold text-stone-900 mt-0.5">{dbMetrics.ordersCount}</p>
        </div>
        <div>
          <p className="text-stone-500">{t.branch.users}</p>
          <p className="font-bold text-stone-900 mt-0.5">{dbMetrics.usersCount}</p>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({ t, data, onChange }) {
  const items = [
    { key: 'orders', label: t.notifications.orders },
    { key: 'stock', label: t.notifications.stock },
    { key: 'payments', label: t.notifications.payments },
    { key: 'users', label: t.notifications.users },
    { key: 'branches', label: t.notifications.branches },
    { key: 'system', label: t.notifications.system },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-900">{t.notifications.title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{t.notifications.subtitle}</p>
      </div>
      <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
        {items.map((item) => {
          const checked = Boolean(data[item.key]);
          return (
            <label
              key={item.key}
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-stone-50"
            >
              <span className="text-sm font-medium text-stone-800">{item.label}</span>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange({ [item.key]: e.target.checked })}
                className="h-4 w-4 accent-amber-700 rounded cursor-pointer"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SecurityTab({ t, role, user, users, setUsers, authHeaders, logout, data, onChange }) {
  const canManageUsers = ['admin', 'owner'].includes(role);
  const currentUserId = String(user?._id || user?.id || '');

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [actionBusyId, setActionBusyId] = useState(null);

  const [blockTarget, setBlockTarget] = useState(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  const [selfDeleteOpen, setSelfDeleteOpen] = useState(false);
  const [selfConfirmText, setSelfConfirmText] = useState('');
  const [deletingSelf, setDeletingSelf] = useState(false);

  const refreshUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users', {
        headers: authHeaders,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load users');
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.users || json.data || [];
      setUsers(list);
    } catch {
      // keep current users
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageUsers, authHeaders, setUsers]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.name, u.fullName, u.email, u.phone, u.role]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [users, userSearch]);

  const handleToggleBlock = async (targetUser) => {
    if (!targetUser?._id) return;
    const nextBlocked = !(targetUser.isBlocked || targetUser.blocked || targetUser.status === 'blocked');
    setActionBusyId(targetUser._id);
    try {
      let res = await fetch(`/api/users/${targetUser._id}/block`, {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ blocked: nextBlocked, isBlocked: nextBlocked }),
      });

      if (!res.ok) {
        res = await fetch(`/api/users/${targetUser._id}`, {
          method: 'PATCH',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            blocked: nextBlocked,
            isBlocked: nextBlocked,
            status: nextBlocked ? 'blocked' : 'active',
          }),
        });
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || t.genericError);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id
            ? {
                ...u,
                ...payload.user,
                blocked: nextBlocked,
                isBlocked: nextBlocked,
                status: nextBlocked ? 'blocked' : 'active',
              }
            : u
        )
      );
      toast.success(nextBlocked ? t.security.blockSuccess : t.security.unblockSuccess);
      setBlockTarget(null);
    } catch (err) {
      toast.error(err?.message || t.genericError);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!targetUser?._id) return;
    setActionBusyId(targetUser._id);
    try {
      const res = await fetch(`/api/users/${targetUser._id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || t.genericError);
      }
      setUsers((prev) => prev.filter((u) => u._id !== targetUser._id));
      toast.success(t.security.deleteSuccess);
      setDeleteUserTarget(null);
    } catch (err) {
      toast.error(err?.message || t.genericError);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteSelf = async () => {
    if (selfConfirmText !== 'DELETE') return;
    setDeletingSelf(true);
    try {
      let res = await fetch('/api/account', {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok && currentUserId) {
        res = await fetch(`/api/users/${currentUserId}`, {
          method: 'DELETE',
          headers: authHeaders,
          credentials: 'include',
        });
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || t.genericError);
      }
      toast.success(t.security.deleteSuccess);
      setSelfDeleteOpen(false);
      if (typeof logout === 'function') {
        await logout();
      }
    } catch (err) {
      toast.error(err?.message || t.genericError);
    } finally {
      setDeletingSelf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-stone-900">{t.security.title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{t.security.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            {t.security.sessionTimeout}
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={data.sessionTimeout ?? 60}
            onChange={(e) => onChange({ sessionTimeout: Number(e.target.value) || 60 })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-800"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center justify-between w-full px-3.5 py-2 border border-stone-200 rounded-lg cursor-pointer">
            <span className="text-sm font-medium text-stone-800">{t.security.twoFactor}</span>
            <input
              type="checkbox"
              checked={Boolean(data.twoFactor)}
              onChange={(e) => onChange({ twoFactor: e.target.checked })}
              className="h-4 w-4 accent-amber-700 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {canManageUsers && (
        <div className="border border-stone-200 rounded-xl p-4 space-y-4 bg-stone-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <Ban size={15} className="text-amber-700" />
                {t.security.userManagementTitle}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">{t.security.userManagementDesc}</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t.security.searchUsers}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-800"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin text-amber-700" />
              {t.security.loadingUsers}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-6 text-center text-xs text-stone-500">{t.security.noUsers}</div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-xs text-stone-500">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left font-medium">{t.general.fullName}</th>
                    <th className="px-3.5 py-2.5 text-left font-medium">{t.general.email}</th>
                    <th className="px-3.5 py-2.5 text-left font-medium">{t.general.role}</th>
                    <th className="px-3.5 py-2.5 text-center font-medium">Status</th>
                    <th className="px-3.5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => {
                    const isSelf = String(u._id || u.id) === currentUserId;
                    const blocked = Boolean(u.isBlocked || u.blocked || u.status === 'blocked');
                    const busy = actionBusyId === u._id;

                    return (
                      <tr key={u._id || u.email} className="hover:bg-stone-50/70">
                        <td className="px-3.5 py-2.5 font-medium text-stone-800">
                          {u.name || u.fullName || '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs text-stone-600">{u.email || '—'}</td>
                        <td className="px-3.5 py-2.5 text-xs text-stone-700">{u.role || '—'}</td>
                        <td className="px-3.5 py-2.5 text-center">
                          <Badge color={blocked ? 'red' : 'green'}>
                            {blocked ? t.security.blocked : t.security.active}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {isSelf ? (
                            <span className="text-[11px] text-stone-400">{t.security.cannotModifySelf}</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  blocked ? handleToggleBlock(u) : setBlockTarget(u)
                                }
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition disabled:opacity-50',
                                  blocked
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                )}
                              >
                                {blocked ? (
                                  <>
                                    <CheckCircle2 size={12} /> {t.security.unblockBtn}
                                  </>
                                ) : (
                                  <>
                                    <UserX size={12} /> {t.security.blockBtn}
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setDeleteUserTarget(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                              >
                                <Trash2 size={12} /> {t.security.deleteUserBtn}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900">{t.security.dangerZoneTitle}</h3>
            <p className="text-xs text-red-700/85 mt-0.5">{t.security.dangerZoneDesc}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelfConfirmText('');
            setSelfDeleteOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition flex-shrink-0"
        >
          <Trash2 size={14} />
          {t.security.deleteMyAccountBtn}
        </button>
      </div>

      <ConfirmModal
        isOpen={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={() => handleToggleBlock(blockTarget)}
        title={t.security.blockModalTitle}
        message={t.security.blockModalMsg}
        itemName={blockTarget?.name || blockTarget?.fullName || blockTarget?.email}
        confirmLabel={t.security.confirmBlock}
        cancelLabel={t.security.cancel}
        loading={actionBusyId === blockTarget?._id}
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={() => handleDeleteUser(deleteUserTarget)}
        title={t.security.deleteUserModalTitle}
        message={t.security.deleteUserModalMsg}
        itemName={deleteUserTarget?.name || deleteUserTarget?.fullName || deleteUserTarget?.email}
        confirmLabel={t.security.confirmDelete}
        cancelLabel={t.security.cancel}
        loading={actionBusyId === deleteUserTarget?._id}
        variant="danger"
      />

      <Modal
        isOpen={selfDeleteOpen}
        onClose={() => setSelfDeleteOpen(false)}
        title={t.security.dangerZoneTitle}
      >
        <div className="space-y-4 text-sm">
          <p className="text-stone-700">{t.security.dangerZoneDesc}</p>
          <input
            type="text"
            value={selfConfirmText}
            onChange={(e) => setSelfConfirmText(e.target.value)}
            placeholder={t.security.typeDeletePlaceholder}
            className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
          <div className="flex gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setSelfDeleteOpen(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-stone-300 text-stone-700 font-medium hover:bg-stone-50"
            >
              {t.security.cancel}
            </button>
            <button
              type="button"
              disabled={selfConfirmText !== 'DELETE' || deletingSelf}
              onClick={handleDeleteSelf}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              {deletingSelf && <Loader2 size={14} className="animate-spin" />}
              {t.security.confirmDelete}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AppearanceTab({ t, data, onChange }) {
  const themes = [
    { value: 'warm-stone', label: t.appearance.warmStone, swatch: 'bg-amber-700', bgChip: 'bg-stone-100' },
    { value: 'sky-slate', label: t.appearance.skySlate, swatch: 'bg-sky-600', bgChip: 'bg-sky-100' },
    { value: 'emerald-mist', label: t.appearance.emeraldMist, swatch: 'bg-emerald-600', bgChip: 'bg-emerald-100' },
  ];

  const currentTheme = themes.find((th) => th.value === (data.theme || 'warm-stone')) || themes[0];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-900">{t.appearance.title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{t.appearance.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{t.appearance.theme}</label>
          <select
            value={data.theme || 'warm-stone'}
            onChange={(e) => onChange({ theme: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-700"
          >
            {themes.map((th) => (
              <option key={th.value} value={th.value}>
                {th.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center justify-between w-full px-3.5 py-2 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50">
            <span className="text-sm font-medium text-stone-800">{t.appearance.compactMode}</span>
            <input
              type="checkbox"
              checked={Boolean(data.compactMode)}
              onChange={(e) => onChange({ compactMode: e.target.checked })}
              className="h-4 w-4 accent-amber-700 cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div className={cn('flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs text-stone-700', currentTheme.bgChip)}>
        <div className="flex items-center gap-2">
          <span className={cn('w-3 h-3 rounded-full', currentTheme.swatch)} />
          <span>
            {t.appearance.activePreview}: <strong>{currentTheme.label}</strong>
            {data.compactMode ? ` · ${t.appearance.compactMode}` : ''}
          </span>
        </div>
        <span className="font-mono text-[11px] text-stone-600">{THEME_BG_MAP[currentTheme.value]?.hex}</span>
      </div>
    </div>
  );
}

function LocalizationTab({ t, data, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
          <Languages size={17} className="text-amber-700" />
          {t.localization.title}
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">{t.localization.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            {t.localization.languageLabel}
          </label>
          <select
            value={data.locale || 'am'}
            onChange={(e) => onChange({ locale: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-800"
          >
            <option value="am">{t.localization.amharic}</option>
            <option value="en">{t.localization.english}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            {t.localization.currencyLabel}
          </label>
          <select
            value={data.currency || 'ETB'}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-800"
          >
            <option value="ETB">ETB (ብር / Birr)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>
    </div>
  );
}