'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Activity, Shield, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ROLE_LABELS, cn } from '@/lib/utils';
import { EVENT_META, ROLE_GROUPS } from '@/lib/activity';
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import ActivityFilters from '@/components/activity/ActivityFilters';
import toast from 'react-hot-toast';

const GROUP_LABELS = {
  orders:    'ትዕዛዞች',
  payments:  'ክፍያዎች',
  inventory: 'ክምችት',
  receipts:  'ደረሰኞች',
  users:     'ተጠቃሚዎች',
  branches:  'ቅርንጫፎች',
  auth:      'መግቢያ',
  system:    'ስርዓት',
};

const FALLBACK_GROUPS = ['orders', 'payments', 'inventory', 'receipts', 'users', 'branches', 'system'];

function getEventGroup(type) {
  return EVENT_META?.[type]?.group || 'system';
}

export default function ActivityPage() {
  const { user, token } = useAuth();
  const params = useParams();
  const locale = params?.locale;

  const role = (user?.role || 'customer').toLowerCase();
  const roleLabel = ROLE_LABELS[role] || 'ተጠቃሚ';

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const localizeHref = useCallback(
    (path) => {
      if (!path) return undefined;
      if (!locale) return path;
      if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path;
      return `/${locale}${path.startsWith('/') ? '' : '/'}${path}`;
    },
    [locale]
  );

  const fetchActivity = useCallback(
    async ({ isManualRefresh = false } = {}) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch('/api/activity', {
          headers,
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error('Failed to load activity');
        }

        const data = await res.json();
        const rawList = Array.isArray(data) ? data : data.events || [];
        const normalized = rawList.map((item) => ({
          ...item,
          link: item.link ? localizeHref(item.link) : undefined,
        }));

        setEvents(normalized);
      } catch {
        if (isManualRefresh) {
          toast.error('እንቅስቃሴዎችን ማደስ አልተቻለም');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, localizeHref]
  );

  useEffect(() => {
    fetchActivity({ isManualRefresh: false });
  }, [fetchActivity, role]);

  const allowedGroups = useMemo(() => {
    const groups = ROLE_GROUPS?.[role];
    return Array.isArray(groups) && groups.length > 0 ? groups : FALLBACK_GROUPS;
  }, [role]);

  const visibleGroups = useMemo(() => {
    const present = new Set(events.map((e) => getEventGroup(e.type)));
    return allowedGroups.filter((g) => present.has(g));
  }, [events, allowedGroups]);

  useEffect(() => {
    if (group !== 'all' && !allowedGroups.includes(group)) {
      setGroup('all');
    }
  }, [allowedGroups, group]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const grp = getEventGroup(e.type);
      if (!allowedGroups.includes(grp)) return false;
      if (group !== 'all' && grp !== group) return false;

      if (!q) return true;
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.actor?.name || '').toLowerCase().includes(q) ||
        (e.target || '').toLowerCase().includes(q)
      );
    });
  }, [events, allowedGroups, group, search]);

  const hasFilters = search.trim() !== '' || group !== 'all';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Activity size={25} className="text-amber-700" />
            እንቅስቃሴ
          </h1>
          <p className="text-sm text-stone-500 mt-1 flex items-center gap-1.5">
            <Shield size={13} className="text-amber-700" />
            የእርስዎ ሚና: <span className="font-medium text-stone-700">{roleLabel}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchActivity({ isManualRefresh: true })}
          disabled={refreshing || loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-stone-200 bg-white text-stone-700',
            'hover:border-amber-600 hover:text-amber-800 hover:bg-amber-50/50 transition disabled:opacity-40'
          )}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin text-amber-700' : ''} />
          አድስ
        </button>
      </div>

      <ActivityFilters
        search={search}
        onSearch={setSearch}
        activeGroup={group}
        onGroup={setGroup}
        groups={visibleGroups}
        labels={GROUP_LABELS}
        onReset={() => {
          setSearch('');
          setGroup('all');
        }}
        hasFilters={hasFilters}
      />

      <p className="text-xs text-stone-500 pl-1">
        {loading
          ? 'እንቅስቃሴዎች በመጫን ላይ...'
          : `${filtered.length} እንቅስቃሴ${filtered.length !== 1 ? 'ዎች' : ''} ታይተዋል`}
      </p>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/80 bg-white text-stone-500">
          <Loader2 size={22} className="animate-spin text-amber-700" />
          <p className="text-xs sm:text-sm">ከዳታቤዝ በመጫን ላይ...</p>
        </div>
      ) : (
        <ActivityTimeline events={filtered} />
      )}
    </div>
  );
}