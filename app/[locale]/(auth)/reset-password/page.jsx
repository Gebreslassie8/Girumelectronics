'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!phone || !token) {
      router.replace('/forgot-password');
    }
  }, [phone, token, router]);

  // Password strength: 8+ chars, at least one letter and one digit
  const pwChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    digit:  /[0-9]/.test(password),
  };
  const pwValid = pwChecks.length && pwChecks.letter && pwChecks.digit;
  const match  = password.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!pwValid) {
      setError('የይለፍ ቃል ቢያንስ 8 ፊደሎች፣ አንድ ፊደል እና አንድ አሃዝ መያዝ አለበት');
      return;
    }
    if (!match) {
      setError(t('passwordMismatch') || 'የይለፍ ቃሎች አይመሳሰሉም');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'የይለፍ ቃል መቀየር አልተሳካም');

      toast.success(t('success') || 'የይለፍ ቃል ተቀይሯል');
      router.push('/login');
    } catch (err) {
      setError(err.message || t('error'));
      toast.error(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">{t('title') || 'አዲስ የይለፍ ቃል'}</h1>
      <p className="text-sm text-gray-500 mt-1">{t('subtitle') || 'አዲስ የይለፍ ቃል ይምረጡ'}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('newPassword') || 'አዲስ የይለፍ ቃል'}
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder') || 'ቢያንስ 8 ፊደሎች'}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength checklist */}
          <div className="mt-2 space-y-1">
            {[
              { ok: pwChecks.length, label: 'ቢያንስ 8 ፊደሎች' },
              { ok: pwChecks.letter, label: 'ቢያንስ አንድ ፊደል' },
              { ok: pwChecks.digit,  label: 'ቢያንስ አንድ አሃዝ' },
            ].map((c) => (
              <p key={c.label} className={`text-[11px] flex items-center gap-1 ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
                <CheckCircle2 size={11} />
                {c.label}
              </p>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('confirmPassword') || 'የይለፍ ቃል ያረጋግጡ'}
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder') || 'የይለፍ ቃሉን እንደገና ያስገቡ'}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirm.length > 0 && !match && (
            <p className="text-[11px] text-red-600 mt-1">{t('passwordMismatch') || 'የይለፍ ቃሎች አይመሳሰሉም'}</p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pwValid || !match}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? t('submitting') || 'በመቀየር ላይ…' : (t('submit') || 'የይለፍ ቃል ቀይር')}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>

      <div className="mt-4">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-gray-600 text-sm hover:text-brand transition"
        >
          <ArrowLeft size={14} />
          {t('backToLogin') || 'ወደ መግቢያ ተመለስ'}
        </Link>
      </div>
    </div>
  );
}