'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings, Building2, Bell, Shield, Palette, Globe, Save, Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS, cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

import GeneralTab from '@/components/settings/GeneralTab';
import BranchTab from '@/components/settings/BranchTab';
import NotificationsTab from '@/components/settings/NotificationsTab';
import SecurityTab from '@/components/settings/SecurityTab';
import AppearanceTab from '@/components/settings/AppearanceTab';
import LocalizationTab from '@/components/settings/LocalizationTab';

const TABS = [
  { key: 'general',       label: 'አጠቃላይ',    icon: Settings,  roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'branch',        label: 'ቅርንጫፍ',    icon: Building2, roles: ['admin', 'owner', 'seller'] },
  { key: 'notifications', label: 'ማሳወቂያዎች', icon: Bell,      roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'security',      label: 'ደህንነት',    icon: Shield,    roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'appearance',    label: 'አቀራረብ',   icon: Palette,   roles: ['admin', 'owner', 'seller', 'customer'] },
  { key: 'localization',  label: 'ቋንቋ',      icon: Globe,     roles: ['admin', 'owner', 'seller', 'customer'] },
];

const DEFAULT_SETTINGS = {
  general: {},
  branch: {},
  notifications: {
    orders: true,
    stock: true,
    payments: true,
    users: true,
    branches: true,
    system: true,
  },
  security: {},
  appearance: {
    theme: 'warm-stone',
    compactMode: false,
  },
  localization: {
    locale: 'am',
    currency: 'ETB',
  },
};

export default function SettingsPage() {
  const { user, token } = useAuth();
  const role = (user?.role || 'customer').toLowerCase();
  const roleLabel = ROLE_LABELS[role] || 'ተጠቃሚ';

  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.roles.includes(role)),
    [role]
  );

  const [active, setActive] = useState(visibleTabs[0]?.key || 'general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === active)) {
      setActive(visibleTabs[0]?.key || 'general');
    }
  }, [visibleTabs, active]);

  const authHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

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
        notifications: { ...prev.notifications, ...(serverSettings.notifications || {}) },
        appearance: { ...prev.appearance, ...(serverSettings.appearance || {}) },
        localization: { ...prev.localization, ...(serverSettings.localization || {}) },
      }));
    } catch {
      try {
        const cached = localStorage.getItem('girum_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore storage errors
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateTabSettings = useCallback((tabKey, patchOrUpdater) => {
    setSettings((prev) => {
      const currentTab = prev[tabKey] || {};
      const nextTab =
        typeof patchOrUpdater === 'function'
          ? patchOrUpdater(currentTab)
          : { ...currentTab, ...patchOrUpdater };
      return { ...prev, [tabKey]: nextTab };
    });
  }, []);

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
        throw new Error(data.message || 'ቅንብሮችን ማስቀመጥ አልተቻለም');
      }

      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }

      try {
        localStorage.setItem('girum_settings', JSON.stringify(settings));
      } catch {
        // ignore storage errors
      }

      toast.success('ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል');
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Settings size={25} className="text-amber-700" />
            ቅንብሮች
          </h1>
          <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5">
            <Shield size={13} className="text-amber-700" />
            የእርስዎ ሚና: <span className="font-medium text-stone-700">{roleLabel}</span>
          </p>
        </div>

        <Button
          onClick={handleSave}
          loading={saving}
          disabled={loading || saving}
          className="bg-amber-700 hover:bg-amber-800 text-white border-amber-700"
        >
          <Save size={16} />
          አስቀምጥ
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden border border-stone-200 bg-white rounded-2xl">
        <div className="flex overflow-x-auto border-b border-stone-200/80 bg-stone-50/60">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px',
                  isActive
                    ? 'border-amber-700 text-amber-900 bg-amber-50/70'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/70'
                )}
              >
                <Icon size={16} className={isActive ? 'text-amber-700' : 'text-stone-400'} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-500">
              <Loader2 size={22} className="animate-spin text-amber-700" />
              <p className="text-xs sm:text-sm">ቅንብሮች በመጫን ላይ...</p>
            </div>
          ) : (
            <>
              {active === 'general' && (
                <GeneralTab
                  user={user}
                  role={role}
                  data={settings.general}
                  onChange={(patch) => updateTabSettings('general', patch)}
                />
              )}
              {active === 'branch' && (
                <BranchTab
                  user={user}
                  role={role}
                  data={settings.branch}
                  onChange={(patch) => updateTabSettings('branch', patch)}
                />
              )}
              {active === 'notifications' && (
                <NotificationsTab
                  user={user}
                  data={settings.notifications}
                  onChange={(patch) => updateTabSettings('notifications', patch)}
                />
              )}
              {active === 'security' && (
                <SecurityTab
                  user={user}
                  data={settings.security}
                  onChange={(patch) => updateTabSettings('security', patch)}
                />
              )}
              {active === 'appearance' && (
                <AppearanceTab
                  data={settings.appearance}
                  onChange={(patch) => updateTabSettings('appearance', patch)}
                />
              )}
              {active === 'localization' && (
                <LocalizationTab
                  data={settings.localization}
                  onChange={(patch) => updateTabSettings('localization', patch)}
                />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}