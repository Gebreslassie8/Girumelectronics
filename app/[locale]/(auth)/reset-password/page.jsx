'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get('phone') || '';

  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error(t('passwordMismatch'));
      return;
    }
    if (next.length < 6) {
      toast.error(t('passwordMin'));
      return;
    }
    setLoading(true);
    try {
      // TODO: real API
      await new Promise((r) => setTimeout(r, 600));
      toast.success(t('success'));
      router.push('/login');
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      {phone && (
        <p className="text-xs text-gray-400 mt-1">📱 {phone}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('codePlaceholder')}
          maxLength={6}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm tracking-widest text-center"
          required
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? t('submitting') : t('submit')}
          <ArrowRight size={16} />
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-gray-600 text-sm hover:text-brand transition"
      >
        <ArrowLeft size={14} />
        {t('backToLogin')}
      </Link>
    </div>
  );
}

// useSearchParams needs Suspense
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}