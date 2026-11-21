'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const RESEND_COOLDOWN = 60; // seconds

function VerifyOtpForm() {
  const t = useTranslations('auth.verifyOtp');
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim().toLowerCase();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const inputs = useRef([]);

  useEffect(() => {
    if (!email) router.replace('/forgot-password');
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      inputs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const code = digits.join('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError('እባክዎ 6 አሃዞችን ያስገቡ');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ኮድ ማረጋገጥ አልተሳካም');

      toast.success('ኮድ ተረጋግጧል');
      router.push(
        `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(data.resetToken || '')}`
      );
    } catch (err) {
      setError(err.message || 'ኮድ ማረጋገጥ አልተሳካም');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResending(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ኮድ መላክ አልተሳካም');

      setCooldown(RESEND_COOLDOWN);
      if (data.devOtp) {
        toast.success(`[DEV] OTP: ${data.devOtp}`, { duration: 15000 });
      } else {
        toast.success('አዲስ ኮድ ወደ ኢሜይልዎ ተልኳል');
      }
    } catch (err) {
      toast.error(err.message || 'ኮድ መላክ አልተሳካም');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-stone-900">ኮድ ያረጋግጡ</h1>
      <p className="text-sm text-stone-500 mt-1">
        6 አሃዝ ኮድ ወደ <span className="font-medium text-stone-800">{email}</span> ተልኳል
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex items-center justify-center gap-2 py-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className="w-12 h-14 text-center text-xl font-bold border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 disabled:opacity-50"
              disabled={loading}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition disabled:opacity-50"
        >
          {loading ? 'በማረጋገጥ ላይ…' : 'አረጋግጥ'}
          {!loading && <ShieldCheck size={16} />}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="inline-flex items-center gap-1.5 text-stone-600 hover:text-amber-800 transition disabled:opacity-50"
        >
          <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
          {resending
            ? 'በመላክ ላይ…'
            : cooldown > 0
            ? `እንደገና ላክ (${cooldown}s)`
            : 'እንደገና ላክ'}
        </button>

        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1 text-stone-600 hover:text-amber-800 transition"
        >
          <ArrowLeft size={12} />
          ኢሜይል ቀይር
        </Link>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}