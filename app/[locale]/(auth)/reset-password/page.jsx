'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const router = useRouter();
  const params = useSearchParams();
  const email = (params.get('email') || '').trim().toLowerCase();
  const token = params.get('token') || '';

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email || !token) {
      router.replace('/forgot-password');
    }
  }, [email, token, router]);

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('error'));
      }
      toast.success(t('success'));
      router.push('/login');
    } catch (err) {
      toast.error(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
      <p className="text-sm text-stone-500 mt-1">{t('subtitle')}</p>
      {email && (
        <p className="text-xs text-stone-500 mt-1">✉️ {email}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 text-sm"
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
          className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 text-sm"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition disabled:opacity-50"
        >
          {loading ? t('submitting') : t('submit')}
          <ArrowRight size={16} />
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-stone-600 text-sm hover:text-amber-800 transition"
      >
        <ArrowLeft size={14} />
        {t('backToLogin')}
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}