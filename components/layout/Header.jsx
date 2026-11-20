'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, Bell, ChevronDown } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { notificationsStore } from '@/lib/notificationsStore';
import { useAuth } from '@/components/providers/AuthProvider';
import { useProfile } from '@/components/providers/ProfileProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationMenu from './NotificationMenu';
import ProfileMenu from './ProfileMenu';
import ProfileModal from './ProfileModal';
import { cn, getRoleLabel, getRoleColor, getFirstLetter } from '@/lib/utils';

export default function Header({ onMenuClick, title }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const t = useTranslations('nav');
  const locale = useLocale();
  const { user, token } = useAuth();
  const { profile, refresh } = useProfile();

  // ----- Live unread badge (store + live /api/notifications sync) -----
  const [unread, setUnread] = useState(() => notificationsStore.get()?.unread ?? 0);

  const syncUnreadFromApi = useCallback(async () => {
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
      setUnread(count);

      if (typeof notificationsStore.setUnread === 'function') {
        notificationsStore.setUnread(count);
      }
    } catch {
      // keep current badge count on transient network issues
    }
  }, [token]);

  useEffect(() => {
    const unsub =
      typeof notificationsStore.subscribe === 'function'
        ? notificationsStore.subscribe((s) => {
            if (typeof s?.unread === 'number') {
              setUnread(s.unread);
            }
          })
        : null;

    if (typeof notificationsStore.get === 'function') {
      const current = notificationsStore.get();
      if (typeof current?.unread === 'number') {
        setUnread(current.unread);
      }
    }

    syncUnreadFromApi();
    const timer = setInterval(syncUnreadFromApi, 30000);

    return () => {
      if (typeof unsub === 'function') unsub();
      clearInterval(timer);
    };
  }, [syncUnreadFromApi, locale]);

  // ----- Re-fetch profile when language changes -----
  useEffect(() => {
    if (typeof refresh === 'function') {
      refresh();
    }
  }, [locale, refresh]);

  // ----- Derived values -----
  const displayName = profile?.fullName || user?.fullName || 'ተጠቃሚ';
  const displayAvatar = profile?.avatar || user?.avatar || null;
  const initial = getFirstLetter(displayName);
  const roleLabel = getRoleLabel(user?.role);
  const roleColor = getRoleColor(user?.role);

  return (
    <>
      <header className="bg-white border-b border-stone-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            className="md:hidden text-stone-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-stone-100 transition"
            onClick={onMenuClick}
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
          <h2 className="text-lg font-semibold text-stone-800 truncate">{title}</h2>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                setShowProfile(false);
                if (next) syncUnreadFromApi();
              }}
              className="relative p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-amber-800 transition"
              aria-label={unread > 0 ? unread + ' አዲስ ማሳወቂያዎች' : 'ማሳወቂያዎች'}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-amber-700 text-white text-[10px] font-bold rounded-full ring-2 ring-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationMenu
                onClose={() => {
                  setShowNotifications(false);
                  syncUnreadFromApi();
                }}
              />
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfile(!showProfile);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 p-1 pl-1 pr-2.5 rounded-full hover:bg-stone-100 transition"
              aria-label="Profile menu"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white overflow-hidden',
                  displayAvatar ? 'bg-stone-200' : roleColor.solid
                )}
              >
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>

              <div className="hidden md:block text-left">
                <p
                  key={'name-' + locale}
                  className="text-sm font-medium text-stone-800 leading-tight truncate max-w-[120px]"
                >
                  {displayName}
                </p>
                <p
                  key={'role-' + locale}
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    roleColor.text
                  )}
                >
                  {roleLabel}
                </p>
              </div>

              <ChevronDown size={14} className="hidden md:block text-stone-400" />
            </button>

            {showProfile && (
              <ProfileMenu
                onClose={() => setShowProfile(false)}
                onOpenProfileModal={() => {
                  setShowProfile(false);
                  setShowProfileModal(true);
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* Profile modal at header level */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}