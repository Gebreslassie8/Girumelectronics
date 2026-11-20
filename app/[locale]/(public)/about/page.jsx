'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Target, Eye, Heart, Users, Award, TrendingUp,
  Quote, Linkedin, Mail, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const FOUNDER_PHOTOS = [
  { src: '/images/1.jpg', alt: 'Eshetu Teshager', label: 'Founder',  note: 'Since 2014' },
  { src: '/images/2.jpg', alt: 'Our workshop',    label: 'Workshop', note: 'Our roots'  },
  { src: '/images/3.jpg', alt: 'Our showroom',    label: 'Showroom', note: 'Our future' },
];

const VALUES = [
  { icon: Heart,      key: 'quality' },
  { icon: Users,      key: 'customer' },
  { icon: Award,      key: 'honesty' },
  { icon: TrendingUp, key: 'innovation' },
];

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09 } },
};

export default function AboutPage() {
  const t = useTranslations('about');

  const [photoIdx, setPhotoIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setPhotoIdx((i) => (i + 1) % FOUNDER_PHOTOS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [paused]);

  const STATS = [
    { value: '2014',   label: t('stats.founded') },
    { value: '5,000+', label: t('stats.customers') },
    { value: '4',      label: t('stats.branches') },
    { value: '30+',    label: t('stats.employees') },
  ];

  const active = FOUNDER_PHOTOS[photoIdx];

  return (
    <div className="bg-stone-50/40 min-h-screen">
      {/* HEADER */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-amber-900 to-amber-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-4xl md:text-5xl font-bold mb-4 tracking-tight"
          >
            {t('title')}
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.12 }}
            className="text-amber-100/90 text-lg max-w-2xl mx-auto"
          >
            {t('subtitle')}
          </motion.p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-amber-500/10 pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      </section>

      {/* STORY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-stone-900 mb-4">
              {t('storyTitle')}
            </motion.h2>
            <div className="space-y-4 text-stone-700 leading-relaxed">
              <motion.p variants={fadeUp}>{t('storyP1')}</motion.p>
              <motion.p variants={fadeUp}>{t('storyP2')}</motion.p>
              <motion.p variants={fadeUp}>{t('storyP3')}</motion.p>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={stagger}
            className="grid grid-cols-2 gap-4"
          >
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -3, scale: 1.015 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-6 text-center border border-stone-200/90 shadow-xs hover:border-amber-400/70 hover:shadow-sm transition"
              >
                <p className="text-3xl font-bold text-amber-800">{s.value}</p>
                <p className="text-sm text-stone-600 mt-1">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* MISSION / VISION */}
      <section className="bg-stone-100/70 border-y border-stone-200/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-8 border border-stone-200/90 shadow-xs hover:border-amber-400/70 hover:shadow-sm transition"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100/80 flex items-center justify-center mb-4">
                <Target size={24} className="text-amber-800" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-3">{t('mission')}</h3>
              <p className="text-stone-700 leading-relaxed">{t('missionDesc')}</p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-8 border border-stone-200/90 shadow-xs hover:border-amber-400/70 hover:shadow-sm transition"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100/80 flex items-center justify-center mb-4">
                <Eye size={24} className="text-amber-800" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-3">{t('vision')}</h3>
              <p className="text-stone-700 leading-relaxed">{t('visionDesc')}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOUNDER SECTION */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-b from-white to-stone-50/70">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-stone-400/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-4">
              <Sparkles size={12} className="text-amber-700" />
              {t('founderSubtitle')}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900">
              {t('founderTitle')}
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
              {/* Photo Carousel */}
              <div className="md:col-span-2 relative aspect-square md:aspect-auto md:min-h-[480px] bg-stone-900 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.src}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.75, ease: 'easeOut' }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={active.src}
                      alt={active.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      priority
                      className="object-cover"
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-stone-950/75 via-stone-950/30 to-transparent pointer-events-none" />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={'label-' + active.src}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="absolute bottom-4 left-4 text-white z-10"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-amber-200/90 font-medium">
                      {active.label}
                    </p>
                    <p className="text-sm font-semibold">{active.note}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Dot indicators */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                  {FOUNDER_PHOTOS.map((photo, i) => (
                    <button
                      key={photo.src}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      aria-label={'Show photo ' + (i + 1)}
                      className={cn(
                        'h-2 rounded-full transition-all',
                        i === photoIdx
                          ? 'bg-amber-400 w-5'
                          : 'w-2 bg-white/50 hover:bg-white/85'
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Text */}
              <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                >
                  <Quote size={32} className="text-amber-700/25 mb-4" />

                  <blockquote className="text-lg md:text-xl italic text-stone-700 leading-relaxed mb-6">
                    “{t('founderQuote')}”
                  </blockquote>

                  <div className="border-t border-stone-200/80 pt-6">
                    <h3 className="text-2xl font-bold text-stone-900">
                      {t('founderName')}
                    </h3>
                    <p className="text-sm font-semibold text-amber-800 mt-1">
                      {t('founderRole')}
                    </p>
                  </div>

                  <p className="text-sm text-stone-600 leading-relaxed mt-5">
                    {t('founderBio')}
                  </p>

                  <div className="flex items-center gap-2.5 mt-6">
                    <motion.a
                      href="mailto:eshetu@example.com"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 transition shadow-xs"
                    >
                      <Mail size={14} />
                      አግኙኝ
                    </motion.a>
                    <motion.a
                      href="https://linkedin.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 text-sm font-medium hover:border-amber-600 hover:text-amber-900 hover:bg-amber-50/40 transition"
                    >
                      <Linkedin size={14} />
                      LinkedIn
                    </motion.a>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* VALUES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-stone-900">{t('valuesTitle')}</h2>
          <p className="text-stone-600 mt-2">{t('valuesSubtitle')}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.key}
                variants={fadeUp}
                whileHover={{ y: -4, scale: 1.015 }}
                transition={{ duration: 0.2 }}
                className="text-center p-6 rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:border-amber-400/70 hover:shadow-sm transition"
              >
                <motion.div
                  whileHover={{ rotate: 5 }}
                  transition={{ duration: 0.2 }}
                  className="w-14 h-14 rounded-2xl bg-amber-100/80 flex items-center justify-center mx-auto mb-4"
                >
                  <Icon size={25} className="text-amber-800" />
                </motion.div>
                <h3 className="font-bold text-stone-900 mb-2">
                  {t(`values.${v.key}.title`)}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {t(`values.${v.key}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    </div>
  );
}