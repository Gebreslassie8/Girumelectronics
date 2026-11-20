'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard, Users, UserCog, Warehouse, Package, ShoppingCart,
  Receipt, Building2, Wallet, TrendingDown, BarChart3, ShoppingBag,
  Bell, Activity, Settings, X, ShieldCheck,
} from 'lucide-react';

// =====================================================================
// MENU STRUCTURE
// =====================================================================
const MENU = [
  { href: '/dashboard', key: 'dashboard', fallback: 'ዳሽቦርድ', icon: LayoutDashboard,
    roles: ['admin', 'seller', 'cashier', 'storekeeper', 'customer'] },
  { href: '/dashboard/users', key: 'users', fallback: 'ተጠቃሚዎች', icon: Users, roles: ['admin'] },
  { href: '/dashboard/employees', key: 'employees', fallback: 'ሠራተኞች', icon: UserCog, roles: ['admin'] },
  { href: '/dashboard/inventory', key: 'warehouse', fallback: 'መጋዘን', icon: Warehouse,
    roles: ['admin', 'storekeeper'] },
  { href: '/dashboard/products', key: 'products', fallback: 'የሱቅ እቃዎች', icon: Package,
    roles: ['admin', 'seller', 'storekeeper'] },
  { href: '/dashboard/orders', key: 'orders', fallback: 'ትዕዛዞች', icon: ShoppingCart,
    roles: ['admin', 'seller', 'cashier', 'customer'] },
  { href: '/dashboard/receipts', key: 'receipts', fallback: 'ደረሰኞች', icon: Receipt,
    roles: ['admin', 'seller', 'cashier', 'customer'] },
  { href: '/dashboard/branches', key: 'branches', fallback: 'ቅርንጫፎች', icon: Building2, roles: ['admin'] },
  { href: '/dashboard/warranty', key: 'warranty', fallback: 'ዋስትና', icon: ShieldCheck,
    roles: ['admin', 'seller', 'cashier', 'storekeeper', 'customer'] },
  {
    key: 'finance', fallback: 'ፋይናንስ', icon: Wallet, roles: ['admin', 'seller'],
    children: [
      { href: '/dashboard/expenses', key: 'expenses', fallback: 'ወጪዎች', icon: TrendingDown, roles: ['admin', 'seller'] },
      { href: '/dashboard/analytics', key: 'analytics', fallback: 'ትንተና', icon: BarChart3, roles: ['admin', 'seller'] },
      { href: '/dashboard/sold-items', key: 'soldItems', fallback: 'የተሸጡ እቃዎች', icon: ShoppingBag, roles: ['admin', 'seller'] },
    ],
  },
  {
    key: 'more', fallback: 'ሌላ', icon: Settings,
    roles: ['admin', 'seller', 'cashier', 'storekeeper', 'customer'],
    children: [
      { href: '/dashboard/notifications', key: 'notifications', fallback: 'ማሳወቂያዎች', icon: Bell,
        roles: ['admin', 'seller', 'cashier', 'storekeeper', 'customer'] },
      { href: '/dashboard/activity', key: 'activity', fallback: 'እንቅስቃሴ', icon: Activity, roles: ['admin'] },
      { href: '/dashboard/settings', key: 'settings', fallback: 'ቅንብሮች', icon: Settings, roles: ['admin'] },
    ],
  },
];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();
  const { user, token } = useAuth();
  const t = useTranslations('nav');
  const role = user?.role || 'admin';
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/notifications', {
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.notifications || [];
      const count = list.filter((item) => !(item.read ?? item.isRead)).length;
      setUnreadCount(count);
    } catch {
      // keep existing count on transient network error
    }
  }, [token]);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount, pathname]);

  const tr = (key, fallback) => {
    try {
      const v = t(key);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };

  const canSee = (item) => !item.roles || item.roles.includes(role);
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');
  const parentIsActive = (item) => item.children?.some((c) => isActive(c.href)) || false;

  const renderNavIcon = (item, active) => {
    const IconComp = item.icon;
    if (item.key !== 'notifications') {
      return <IconComp size={16} className={active ? '' : 'text-gray-500'} />;
    }

    return (
      <span className="relative inline-flex items-center justify-center shrink-0">
        <IconComp size={16} className={active ? '' : 'text-gray-500'} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full ring-2 ${
              active ? 'bg-amber-300 ring-brand' : 'bg-amber-700 ring-white'
            }`}
          />
        )}
      </span>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed md:sticky top-0 z-50 md:z-0 h-screen w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 h-16 border-b border-gray-100 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-bold text-lg text-brand rounded-md px-1 -mx-1
              focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-1"
          >
            {tr('brand', 'ግሩም ኤሌክትሮኒክስ')}
          </Link>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md text-gray-600
              focus:outline-none focus:bg-green-600 focus:text-white
              focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-1"
            aria-label="close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {MENU.filter(canSee).map((item) => {
            const label = tr(item.key, item.fallback);

            if (item.children) {
              const childVisible = item.children.filter(canSee);
              if (childVisible.length === 0) return null;
              const groupActive = parentIsActive(item);
              const groupHasUnread =
                item.key === 'more' &&
                childVisible.some((c) => c.key === 'notifications') &&
                unreadCount > 0;

              return (
                <div key={item.key} className="mb-1">
                  <div
                    className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between ${
                      groupActive ? 'text-green-700' : 'text-gray-500'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon size={14} />
                      {label}
                    </span>
                    {groupHasUnread && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <ul>
                    {childVisible.map((c) => {
                      const active = isActive(c.href);
                      const showBadge = c.key === 'notifications' && unreadCount > 0;

                      return (
                        <li key={c.key}>
                          <Link
                            href={c.href}
                            onClick={onClose}
                            className={`flex items-center justify-between gap-2 mx-2 px-3 py-2 rounded-lg text-sm
                              focus:outline-none
                              focus:bg-green-600 focus:text-white
                              focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-1
                              ${
                              active
                                ? 'bg-brand text-white shadow-sm'
                                : 'text-gray-700'
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              {renderNavIcon(c, active)}
                              <span className="truncate">{tr(c.key, c.fallback)}</span>
                            </span>
                            {showBadge && (
                              <span
                                className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${
                                  active
                                    ? 'bg-white text-brand'
                                    : 'bg-amber-700 text-white'
                                }`}
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }

            const active = isActive(item.href);
            const showBadge = item.key === 'notifications' && unreadCount > 0;

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between gap-2 mx-2 px-3 py-2 rounded-lg text-sm
                  focus:outline-none
                  focus:bg-green-600 focus:text-white
                  focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-1
                  ${
                  active
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-gray-700'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {renderNavIcon(item, active)}
                  <span className="truncate">{label}</span>
                </span>
                {showBadge && (
                  <span
                    className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${
                      active
                        ? 'bg-white text-brand'
                        : 'bg-amber-700 text-white'
                    }`}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 text-xs text-gray-400">
          © {new Date().getFullYear()} {tr('brand', 'ግሩም ኤሌክትሮኒክስ')}
        </div>
      </aside>
    </>
  );
}