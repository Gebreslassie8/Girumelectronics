'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Menu, X, Phone, Mail, MapPin } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';

function TelegramIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.944 4.668a1.5 1.5 0 0 0-1.643-.26L3.168 11.01a1.5 1.5 0 0 0 .105 2.83l4.18 1.325 1.622 5.188a1.5 1.5 0 0 0 2.617.515l2.34-2.77 4.356 3.218a1.5 1.5 0 0 0 2.37-.937l2.536-14.122a1.5 1.5 0 0 0-.37-1.247ZM9.45 14.374l8.867-5.588-6.98 6.847-.273 3.47-1.614-4.73Z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.453 3.484 1.313 5L2 22l5.156-1.344c1.469.797 3.125 1.219 4.875 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2Zm5.813 14.109c-.25.703-1.438 1.344-1.969 1.422-.531.078-1.188.109-1.922-.125-.438-.141-1-.328-1.766-.656-3.109-1.344-5.141-4.484-5.297-4.688-.156-.203-1.266-1.688-1.266-3.219 0-1.531.797-2.281 1.078-2.594.281-.313.625-.391.828-.391.203 0 .406.016.578.016.188 0 .438-.078.688.516.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.109.203-.156.328-.313.5-.156.172-.328.391-.469.516-.156.141-.313.297-.141.594.172.297.781 1.281 1.672 2.078 1.156 1.031 2.125 1.359 2.422 1.516.297.156.469.125.641-.078.172-.203.734-.859.938-1.156.203-.297.391-.25.672-.141.281.109 1.797.844 2.109 1 .313.156.516.234.594.359.078.141.078.797-.172 1.5Z" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.56V6.79a4.85 4.85 0 0 1-1.07-.1Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    name: 'Telegram',
    href: 'https://t.me/grumstove',
    icon: TelegramIcon,
    bgClass: 'bg-[#26A5E4] hover:bg-[#1e93ce] text-white',
  },
  {
    name: 'WhatsApp',
    href: 'https://wa.me/251924254988',
    icon: WhatsAppIcon,
    bgClass: 'bg-[#25D366] hover:bg-[#1fb858] text-white',
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@grumstove',
    icon: TikTokIcon,
    bgClass: 'bg-[#010101] hover:bg-stone-800 text-[#25F4EE] ring-1 ring-[#FE2C55]/70',
  },
];

export default function PublicLayout({ children }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();

  const links = [
    { href: '/',        label: t('nav.home') },
    { href: '/about',   label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
  ];

  const brandName =
    t('footer.tagline').split(' ')[0] === 'ዘመናዊ' ? 'ግሩም ምጣድ' : 'Grum Stove';

  return (
    <div className="min-h-screen flex flex-col bg-stone-50/40 text-stone-800">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-amber-700 group-hover:bg-amber-800 flex items-center justify-center text-white font-bold text-lg shadow-xs transition">
                ግ
              </div>
              <div>
                <p className="font-bold text-stone-900 leading-tight">{brandName}</p>
                <p className="text-xs text-stone-500">Electric & Energy Saving</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-stone-700 hover:text-amber-800 font-medium text-sm transition"
                >
                  {l.label}
                </Link>
              ))}
              <LanguageSwitcher />
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition shadow-xs"
              >
                {t('nav.login')}
              </Link>
            </nav>

            <button
              type="button"
              aria-label="Toggle Menu"
              className="md:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100 transition"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>

          {open && (
            <div className="md:hidden py-4 border-t border-stone-200 space-y-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 px-2 rounded-lg text-stone-700 hover:text-amber-800 hover:bg-amber-50/60 font-medium transition"
                >
                  {l.label}
                </Link>
              ))}
              <div className="py-2 px-2">
                <LanguageSwitcher />
              </div>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block mt-2 px-4 py-2.5 rounded-xl bg-amber-700 text-white text-center font-semibold hover:bg-amber-800 transition"
              >
                {t('nav.login')}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">{children}</main>

      {/* FOOTER */}
      <footer className="bg-stone-950 text-stone-300 mt-16 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white text-lg font-bold mb-3">ግሩም ምጣድ / Grum Stove</h3>
              <p className="text-sm leading-relaxed text-stone-400">{t('footer.tagline')}</p>

              {/* Owner Social Links */}
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wider text-stone-400 font-semibold mb-2.5">
                  Follow Us
                </p>
                <div className="flex items-center gap-2.5">
                  {SOCIAL_LINKS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.name}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={item.name}
                        title={item.name}
                        className={cn(
                          'w-9 h-9 rounded-xl inline-flex items-center justify-center shadow-xs transition-transform hover:-translate-y-0.5',
                          item.bgClass
                        )}
                      >
                        <Icon size={18} />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white text-lg font-bold mb-3">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/" className="text-stone-400 hover:text-amber-300 transition">
                    {t('nav.home')}
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-stone-400 hover:text-amber-300 transition">
                    {t('nav.about')}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-stone-400 hover:text-amber-300 transition">
                    {t('nav.contact')}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-stone-400 hover:text-amber-300 transition">
                    {t('nav.login')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white text-lg font-bold mb-3">{t('footer.contactUs')}</h3>
              <ul className="space-y-2.5 text-sm text-stone-400">
                <li className="flex items-center gap-2.5">
                  <Phone size={15} className="text-amber-400 shrink-0" />
                  <span>0924 254 988</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone size={15} className="text-amber-400 shrink-0" />
                  <span>0903 284 493</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail size={15} className="text-amber-400 shrink-0" />
                  <span>info@grumstove.com</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin size={15} className="text-amber-400 shrink-0" />
                  <span>{t('contact.addressValue')}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-stone-800/90 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-xs sm:text-sm text-stone-500">
            <p>
              © {new Date().getFullYear()} ግሩም ምጣድ. {t('footer.rights')}
            </p>
            <p className="text-stone-400">
              Developed by <span className="font-semibold text-amber-400">Gebreslassie</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}