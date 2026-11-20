'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    const cleaned = phone.replace(/\s+/g, '');
    if (!/^(\+?251|0)?9\d{8}$/.test(cleaned)) {
      setError('ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ለምሳሌ 0912345678)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'ኮድ መላክ አልተሳካም');
      }

      // Dev convenience — show OTP in toast if backend returned it (dev mode only)
      if (data.devOtp) {
        toast.success(`[DEV] OTP: ${data.devOtp}`, { duration: 15000 });
      } else {
        toast.success(t('success'));
      }

      router.push(`/verify-otp?phone=${encodeURIComponent(cleaned)}`);
    } catch (err) {
      setError(err.message || t('error'));
      toast.error(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-xs font-medium text-gray-600">
          {t('phone')}
        </label>
        <div className="relative">
          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phonePlaceholder')}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            required
            disabled={loading}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? t('submitting') : t('submit')}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>

      <div className="mt-4">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-gray-600 text-sm hover:text-brand transition"
        >
          <ArrowLeft size={14} />
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
}