'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Phone, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tv = useTranslations('auth.validation');
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── SCHEMA ──
  // Strip ALL non-digits and non-+ first, then validate.
  // This handles: leading spaces, pasted text, autofill, non-breaking spaces.
  const schema = z.object({
    phone: z
      .string()
      .min(1, tv('phoneRequired'))
      .transform((v) => v.replace(/[^\d+]/g, ''))
      .refine((v) => /^(\+251|0)9\d{8}$/.test(v), {
        message: tv('phoneInvalid'),
      }),
    password: z.string().min(6, tv('passwordMin')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  // ── SUBMIT ──
  const onSubmit = async (data) => {
    console.log('[LoginPage] valid submit:', data);
    setErrorMsg('');
    setLoading(true);

    try {
      if (typeof login !== 'function') {
        throw new Error('login function is not available from useAuth()');
      }
      // data.phone has been transformed to digits only
      const result = await login(data.phone, data.password);
      console.log('[LoginPage] login success:', result);
    } catch (err) {
      console.error('[LoginPage] login error:', err);
      setErrorMsg(err.message || 'መግቢያ አልተሳካም');
    } finally {
      setLoading(false);
    }
  };

  // ── INVALID — show which field failed ──
  const onInvalid = (errs) => {
    console.log('[LoginPage] form invalid:', errs);
    const firstErr = Object.entries(errs)[0];
    if (firstErr) {
      const [field, err] = firstErr;
      setErrorMsg(`${field}: ${err.message}`);
    } else {
      setErrorMsg('እባክዎ ትክክለኛ መረጃ ያስገቡ');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">{t('title')}</h1>
        <p className="text-stone-600">{t('subtitle')}</p>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="space-y-5"
      >
        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-stone-700 mb-2"
          >
            {t('phone')}
          </label>
          <div className="relative">
            <Phone
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={t('phonePlaceholder')}
              {...register('phone', {
                onChange: (e) => {
                  // Strip all non-digits as the user types/pastes
                  e.target.value = e.target.value.replace(/[^\d+]/g, '');
                },
              })}
              className={`w-full pl-10 pr-3 py-3 border rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 transition ${
                errors.phone ? 'border-red-500' : 'border-stone-300'
              }`}
            />
          </div>
          {errors.phone && (
            <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700"
            >
              {t('password')}
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-amber-800 font-medium hover:text-amber-950 hover:underline transition"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
              {...register('password')}
              className={`w-full pl-10 pr-10 py-3 border rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 transition ${
                errors.password ? 'border-red-500' : 'border-stone-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-stone-300 text-amber-700 accent-amber-700 focus:ring-amber-600"
          />
          <span className="text-sm text-stone-600">{t('rememberMe')}</span>
        </label>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.985 }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
              {t('submitting')}
            </>
          ) : (
            <>
              <LogIn size={18} /> {t('submit')}
            </>
          )}
        </motion.button>

        {/* Register link */}
        <p className="text-center text-sm text-stone-600">
          {t('noAccount')}{' '}
          <Link href="/register" className="text-amber-800 font-semibold hover:text-amber-950 hover:underline transition">
            {t('register')}
          </Link>
        </p>
      </form>
    </motion.div>
  );
}