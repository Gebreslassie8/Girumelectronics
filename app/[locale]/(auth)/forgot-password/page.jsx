'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setError('ትክክለኛ የኢሜይል አድራሻ ያስገቡ (ለምሳሌ name@example.com)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'ኮድ መላክ አልተሳካም');
      }

      if (data.devOtp) {
        toast.success(`[DEV] OTP: ${data.devOtp}`, { duration: 15000 });
      } else {
        toast.success(t('success'));
      }

      router.push(`/verify-otp?email=${encodeURIComponent(cleaned)}`);
    } catch (err) {
      setError(err.message || t('error'));
      toast.error(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
      <p className="text-sm text-stone-500 mt-1">{t('subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-xs font-medium text-stone-600">
          {t('email')}
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 text-sm"
            required
            disabled={loading}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition disabled:opacity-50"
        >
          {loading ? t('submitting') : t('submit')}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>

      <div className="mt-4">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-stone-600 text-sm hover:text-amber-800 transition"
        >
          <ArrowLeft size={14} />
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
}