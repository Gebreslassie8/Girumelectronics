'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  User, Settings, LogOut, ChevronRight,
  HelpCircle, Wallet, FileText, Package,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useProfile } from '@/components/providers/ProfileProvider';
import { getInitials, getRoleLabel } from '@/lib/utils';

export default function ProfileMenu({ onClose, onOpenProfileModal }) {
  const ref = useRef(null);
  const params = useParams();
  const locale = params?.locale;
  const { user, logout } = useAuth();
  const { profile } = useProfile();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const localizeHref = (path) => {
    if (!locale) return path;
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return path;
    return `/${locale}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const displayName = profile?.fullName || user?.fullName || 'ተጠቃሚ';
  const displayPhone = profile?.phone || user?.phone || '';
  const displayAvatar = profile?.avatar || null;
  const initials = getInitials(displayName);
  const roleLabel = getRoleLabel(user?.role);
  const role = (user?.role || 'customer').toLowerCase();

  const handleOpenProfile = () => {
    if (onOpenProfileModal) {
      onOpenProfileModal();
    }
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 mt-2.5 w-72 bg-white rounded-2xl shadow-xl border border-stone-200/90 overflow-hidden z-[60]"
    >
      {/* Header Banner (Warm Amber/Stone Gradient, No Blue) */}
      <div className="p-4 bg-gradient-to-br from-amber-800 via-amber-700 to-stone-800 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center font-bold text-base ring-2 ring-amber-200/40 overflow-hidden shrink-0">
            {displayAvatar ? (
              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{displayName}</p>
            {displayPhone && (
              <p className="text-xs text-amber-100/90 truncate mt-0.5">{displayPhone}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-medium text-amber-50">
            {roleLabel}
          </span>
          {user?.branch && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-stone-950/25 text-[11px] font-medium text-stone-100">
              {typeof user.branch === 'object' ? user.branch.name : 'ቅርንጫፍ'}
            </span>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2 max-h-80 overflow-y-auto space-y-0.5">
        <button
          type="button"
          onClick={handleOpenProfile}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group text-left"
        >
          <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
            <User size={15} />
          </span>
          <span className="flex-1 truncate">የእኔ መገለጫ</span>
          <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
        </button>

        {role === 'admin' && (
          <Link
            href={localizeHref('/dashboard/settings')}
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group"
          >
            <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
              <Settings size={15} />
            </span>
            <span className="flex-1 truncate">ቅንብሮች</span>
            <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
          </Link>
        )}

        {role === 'seller' && (
          <Link
            href={localizeHref('/dashboard/expenses')}
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group"
          >
            <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
              <Wallet size={15} />
            </span>
            <span className="flex-1 truncate">ወጪዎች</span>
            <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
          </Link>
        )}

        {role === 'customer' && (
          <>
            <Link
              href={localizeHref('/dashboard/orders')}
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group"
            >
              <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
                <FileText size={15} />
              </span>
              <span className="flex-1 truncate">የእኔ ትዕዛዞች</span>
              <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
            </Link>
            <Link
              href={localizeHref('/dashboard/my-products')}
              onClick={onClose}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group"
            >
              <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
                <Package size={15} />
              </span>
              <span className="flex-1 truncate">የገዙት ምርቶች</span>
              <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
            </Link>
          </>
        )}

        <Link
          href={localizeHref('/dashboard/help')}
          onClick={onClose}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-700 hover:bg-amber-50/80 hover:text-amber-900 transition group"
        >
          <span className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-800 flex items-center justify-center transition shrink-0">
            <HelpCircle size={15} />
          </span>
          <span className="flex-1 truncate">እርዳታ</span>
          <ChevronRight size={14} className="text-stone-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition" />
        </Link>
      </div>

      {/* Sign Out */}
      <div className="p-2 border-t border-stone-100 bg-stone-50/40">
        <button
          type="button"
          onClick={() => {
            logout();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-50 transition"
        >
          <span className="w-8 h-8 rounded-lg bg-red-100/70 text-red-700 flex items-center justify-center shrink-0">
            <LogOut size={15} />
          </span>
          <span className="flex-1 text-left">ውጣ</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-center">
        <p className="text-[10px] text-stone-400 font-medium">ግሩም ምጣድ v1.0.0</p>
      </div>
    </div>
  );
}