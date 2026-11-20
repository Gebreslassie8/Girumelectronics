'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-stone-200/90 bg-stone-100 h-72 flex items-center justify-center text-stone-500 text-sm">
      <Loader2 size={20} className="animate-spin text-amber-700 mr-2" />
      ካርታ በመጫን ላይ...
    </div>
  ),
});
const CONTACT_CARDS = [
  {
    key: 'phone',
    icon: Phone,
    lines: ['0924 254 988', '0903 284 493'],
    isTranslation: false,
  },
  {
    key: 'email',
    icon: Mail,
    lines: ['info@grumstove.com', 'sales@grumstove.com'],
    isTranslation: false,
  },
  {
    key: 'address',
    icon: MapPin,
    lines: ['addressValue', 'addressDetail'],
    isTranslation: true,
  },
  {
    key: 'hours',
    icon: Clock,
    lines: ['hoursValue', 'hoursDetail'],
    isTranslation: true,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

export default function ContactPage() {
  const t = useTranslations('contact');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'መልዕክት መላክ አልተቻለም');
      }

      setSent(true);
      setForm({ name: '', phone: '', email: '', message: '' });
      toast.success(t('form.successTitle'));
      setTimeout(() => setSent(false), 6000);
    } catch (err) {
      toast.error(err.message || 'ስህተት ተፈጥሯል');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-stone-50/40 min-h-screen">
      {/* HEADER */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-amber-900 to-amber-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-4xl md:text-5xl font-bold mb-4 tracking-tight"
          >
            {t('title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-amber-100/90 text-lg max-w-2xl mx-auto"
          >
            {t('subtitle')}
          </motion.p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-amber-500/10 pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      </section>

      {/* CONTACT INFO + FORM */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Info Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-1 space-y-4"
          >
            {CONTACT_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.key}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs hover:border-amber-400/70 hover:shadow-sm transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100/80 flex items-center justify-center mb-3">
                    <Icon size={19} className="text-amber-800" />
                  </div>
                  <h3 className="font-bold text-stone-900 mb-1.5">{t(card.key)}</h3>
                  {card.lines.map((line, idx) => (
                    <p key={idx} className="text-stone-600 text-sm leading-relaxed">
                      {card.isTranslation ? t(line) : line}
                    </p>
                  ))}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-xs">
              <h2 className="text-2xl font-bold text-stone-900 mb-1.5">{t('formTitle')}</h2>
              <p className="text-stone-500 text-sm mb-6">{t('formDesc')}</p>

              <AnimatePresence>
                {sent && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.99 }}
                    transition={{ duration: 0.25 }}
                    className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3"
                  >
                    <CheckCircle2 size={20} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900 text-sm">
                        {t('form.successTitle')}
                      </p>
                      <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                        {t('form.successDesc')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t('form.name')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={form.name}
                      onChange={onChange}
                      placeholder={t('form.namePlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      {t('form.phone')} <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={form.phone}
                      onChange={onChange}
                      placeholder={t('form.phonePlaceholder')}
                      className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {t('form.email')}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder={t('form.emailPlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {t('form.message')} <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={onChange}
                    placeholder={t('form.messagePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition resize-none text-sm"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
                    'bg-amber-700 text-white font-semibold hover:bg-amber-800 transition shadow-xs disabled:opacity-50 text-sm'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      በመላክ ላይ...
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      {t('form.submit')}
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* INTERACTIVE MAP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.35 }}
        >
          <LocationMap
            title="Grum Stove & Manufacturing"
            address={`${t('addressValue')} — ${t('addressDetail')}`}
          />
        </motion.div>
      </section>
    </div>
  );
}