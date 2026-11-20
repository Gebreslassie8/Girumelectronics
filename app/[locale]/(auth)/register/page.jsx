'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { User, Phone, Mail, Lock, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const tv = useTranslations('auth.validation');

  // ✅ FIXED: useAuth exposes `signup`, not `register`
  const { signup } = useAuth();
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      fullName: z.string().min(2, tv('nameMin')),
      phone: z.string().regex(/^(\+251|0)9\d{8}$/, tv('phoneInvalid')),
      email: z.string().email(tv('emailInvalid')).optional().or(z.literal('')),
      password: z.string().min(6, tv('passwordMin')),
      confirmPassword: z.string(),
      agreeTerms: z.boolean().refine((v) => v, { message: t('termsRequired') }),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('passwordMismatch'),
      path: ['confirmPassword'],
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { agreeTerms: false },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const { confirmPassword, agreeTerms, ...rest } = data;
      await signup(rest);
      // AuthProvider navigates, or fallback here:
      router.push('/dashboard');
    } catch (err) {
      console.error('[register]', err);
      alert(err.message || 'ምዝገባ አልተሳካም');
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errs) => {
    console.log('[register] validation failed:', errs);
    const first = Object.values(errs)[0];
    if (first?.message) alert(first.message);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('title')}</h1>
        <p className="text-gray-600">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
            {t('fullName')}
          </label>
          <div className="relative">
            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder={t('fullNamePlaceholder')}
              {...register('fullName')}
              className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition ${
                errors.fullName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="text-sm text-red-600 mt-1">{errors.fullName.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            {t('phone')}
          </label>
          <div className="relative">
            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder={t('phonePlaceholder')}
              {...register('phone')}
              className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            {t('email')}
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              {...register('email')}
              className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            {t('password')}
          </label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              {...register('password')}
              className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            {t('confirmPassword')}
          </label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t('confirmPasswordPlaceholder')}
              {...register('confirmPassword')}
              className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand transition ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Terms */}
        <div>
          <label htmlFor="agreeTerms" className="flex items-start gap-2 cursor-pointer">
            <input
              id="agreeTerms"
              type="checkbox"
              {...register('agreeTerms')}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <span className="text-sm text-gray-600">{t('agreeTerms')}</span>
          </label>
          {errors.agreeTerms && (
            <p className="text-sm text-red-600 mt-1">{errors.agreeTerms.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
              {t('submitting')}
            </>
          ) : (
            <>
              <UserPlus size={18} /> {t('submit')}
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-600">
          {t('haveAccount')}{' '}
          <Link href="/login" className="text-brand font-semibold hover:underline">
            {t('login')}
          </Link>
        </p>
      </form>
    </div>
  );
}