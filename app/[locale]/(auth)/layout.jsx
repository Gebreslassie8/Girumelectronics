import Link from 'next/link';
import { Flame, Zap, ShieldCheck } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getTranslations } from 'next-intl/server';

const HIGHLIGHTS = [
  { icon: Zap, key: 'electric' },
  { icon: Flame, key: 'firewood' },
  { icon: ShieldCheck, key: 'safe' },
];

export default async function AuthLayout({ children, params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="min-h-screen flex bg-stone-50/50 text-stone-800">
      {/* Left Side — Brand Panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-12 group">
            <div className="w-12 h-12 rounded-xl bg-amber-700 group-hover:bg-amber-600 flex items-center justify-center text-2xl font-bold text-white shadow-xs transition">
              ግ
            </div>
            <div>
              <p className="font-bold text-xl leading-tight text-white">ግሩም ምጣድ</p>
              <p className="text-sm text-amber-200/85">Grum Stove</p>
            </div>
          </Link>

          <h1 className="text-4xl font-bold mb-4 leading-tight text-white">
            {t('heroTitle1')}<br />
            <span className="text-amber-300">{t('heroTitle2')}</span>
          </h1>
          <p className="text-stone-300 text-lg leading-relaxed max-w-md">
            {t('heroDesc')}
          </p>

          <div className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-amber-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{t(`features.${item.key}.title`)}</p>
                    <p className="text-sm text-stone-300">{t(`features.${item.key}.desc`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-amber-200/75 relative z-10 border-t border-white/10 pt-5">
          © {new Date().getFullYear()} ግሩም ምጣድ. All rights reserved.
        </p>

        {/* Decorative circles */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-amber-500/10 pointer-events-none" />
        <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-amber-300/5 pointer-events-none" />
      </div>

      {/* Right Side — Form */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with language switcher */}
        <div className="flex justify-end p-4 lg:p-6">
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="w-12 h-12 rounded-xl bg-amber-700 flex items-center justify-center text-white text-2xl font-bold shadow-xs">
                  ግ
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg text-stone-900 leading-tight">ግሩም ምጣድ</p>
                  <p className="text-xs text-stone-500">Grum Stove</p>
                </div>
              </Link>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}