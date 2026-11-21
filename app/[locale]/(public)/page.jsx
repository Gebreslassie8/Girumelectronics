'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import {
  Zap,
  Flame,
  ShieldCheck,
  Truck,
  Award,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: Zap, key: 'electric' },
  { icon: Flame, key: 'firewood' },
  { icon: ShieldCheck, key: 'safe' },
  { icon: Truck, key: 'delivery' },
];

const PRODUCT_SURFACES = [
  { surface: 'from-amber-100/80 via-stone-100 to-amber-50/60', tagColor: 'bg-amber-700', icon: Zap },
  { surface: 'from-stone-200/80 via-amber-50/70 to-stone-100', tagColor: 'bg-stone-800', icon: Flame },
  { surface: 'from-amber-50 via-stone-100 to-emerald-50/60', tagColor: 'bg-emerald-700', icon: Award },
];

const FALLBACK_PRODUCT_KEYS = ['electricStove', 'firewoodStove', 'halfStove'];

const WHY_KEYS = ['local', 'warranty', 'quality', 'afterSales', 'affordable', 'expert'];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

export default function HomePage() {
  const t = useTranslations('home');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchProducts() {
      try {
        const res = await fetch('/api/products?public=true');
        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.data || [];
          setProducts(list);
        }
      } catch (error) {
        console.error('Failed to load products', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProducts();
    return () => {
      active = false;
    };
  }, []);

  const fallbackProducts = FALLBACK_PRODUCT_KEYS.map((key) => ({
    id: key,
    name: t(`products.${key}.name`),
    category: t(`products.${key}.tag`),
    description: t(`products.${key}.desc`),
    displayPrice: t(`products.${key}.price`),
  }));

  const displayProducts = products.length > 0 ? products.slice(0, 6) : fallbackProducts;

  const handleBuyDirect = (product) => {
    toast.success(`በቀጥታ ለመግዛት ተመርጧል: ${product.name}`);
  };

  const stats = [
    { value: '5,000+', label: t('stats.customers') },
    { value: '10+', label: t('stats.years') },
    { value: '4', label: t('stats.branches') },
    { value: '99%', label: t('stats.satisfaction') },
  ];

  return (
    <div className="bg-stone-50/40 min-h-screen">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-amber-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.span
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs sm:text-sm font-medium mb-5"
              >
                <Sparkles size={14} className="text-amber-300" />
                {t('heroBadge')}
              </motion.span>

              <motion.h1
                variants={fadeUp}
                className="text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight"
              >
                {t('heroTitle1')}
                <br />
                <span className="text-amber-300">{t('heroTitle2')}</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-stone-300 text-base md:text-lg mb-8 leading-relaxed max-w-xl"
              >
                {t('heroDesc')}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-500 transition shadow-sm text-sm sm:text-base"
                >
                  {t('orderNow')} <ArrowRight size={18} />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-stone-600 bg-white/5 text-stone-100 font-semibold hover:bg-white/10 transition text-sm sm:text-base"
                >
                  {t('learnMore')}
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="hidden md:flex justify-center"
            >
              <div className="relative w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/20 to-stone-800/60 flex items-center justify-center border border-amber-400/25 shadow-xl">
                <div className="w-60 h-60 rounded-full bg-amber-950/50 border border-amber-300/15 flex items-center justify-center">
                  <Flame size={132} className="text-amber-300 drop-shadow-sm" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-300/5 blur-2xl pointer-events-none" />
      </section>

      {/* STATS BAR */}
      <section className="bg-white border-b border-stone-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
          >
            {stats.map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70"
              >
                <p className="text-3xl font-bold text-amber-800">{s.value}</p>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-stone-900">{t('featuresTitle')}</h2>
          <p className="text-stone-600 mt-2 max-w-2xl mx-auto">{t('featuresSubtitle')}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.key}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl border border-stone-200/90 bg-white shadow-xs hover:shadow-md hover:border-amber-400/80 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100/80 flex items-center justify-center mb-4">
                  <Icon size={23} className="text-amber-800" />
                </div>
                <h3 className="font-bold text-stone-900 mb-2">{t(`features.${f.key}.title`)}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {t(`features.${f.key}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* FEATURED PRODUCTS - DYNAMIC FROM DB WITH TRANSLATED FALLBACK */}
      <section className="bg-stone-100/70 border-y border-stone-200/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-stone-900">{t('productsTitle')}</h2>
            <p className="text-stone-600 mt-2 max-w-2xl mx-auto">{t('productsSubtitle')}</p>
          </motion.div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {displayProducts.map((p, index) => {
                const styleIdx = index % PRODUCT_SURFACES.length;
                const visual = PRODUCT_SURFACES[styleIdx];
                const Icon = visual.icon;
                const formattedPrice = p.sellingPrice
                  ? `ብር ${Number(p.sellingPrice).toLocaleString()}`
                  : p.displayPrice || 'ዋጋ አልተገኘም';

                return (
                  <motion.div
                    key={p._id || p.id || index}
                    variants={fadeUp}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-2xl overflow-hidden border border-stone-200/90 shadow-xs hover:shadow-md hover:border-amber-400/70 transition flex flex-col"
                  >
                    <div
                      className={cn(
                        'h-48 bg-gradient-to-br flex items-center justify-center relative border-b border-stone-200/60',
                        visual.surface
                      )}
                    >
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-white/80 border border-stone-200/80 flex items-center justify-center shadow-xs">
                          <Icon size={48} className="text-amber-800" />
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute top-3.5 right-3.5 px-3 py-1 rounded-full text-white text-xs font-semibold shadow-xs',
                          visual.tagColor
                        )}
                      >
                        {p.category || 'አዲስ'}
                      </span>
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-stone-900 mb-1.5">
                          {p.name}
                        </h3>
                        <p className="text-sm text-stone-600 mb-5 leading-relaxed line-clamp-2">
                          {p.description || 'ዘመናዊ እና ቀልጣፋ ምድጃ።'}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-stone-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-stone-500">ዋጋ</span>
                          <span className="text-lg font-bold text-amber-800">
                            {formattedPrice}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-600 text-amber-800 text-sm font-semibold hover:bg-amber-50 transition"
                          >
                            <Package size={16} />
                            ይዘዙ
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleBuyDirect(p)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition"
                          >
                            <ShoppingCart size={16} />
                            ግዛ
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>

      {/* WHY CHOOSE US + CTA CARD */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-stone-900 mb-6">
              {t('whyTitle')}
            </motion.h2>
            <ul className="space-y-3.5">
              {WHY_KEYS.map((k) => (
                <motion.li
                  key={k}
                  variants={fadeUp}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-white border border-stone-200/70"
                >
                  <CheckCircle2
                    size={20}
                    className="text-emerald-700 flex-shrink-0 mt-0.5"
                  />
                  <span className="text-stone-700 text-sm sm:text-base">
                    {t(`whyItems.${k}`)}
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45 }}
            className="bg-gradient-to-br from-stone-900 via-amber-900 to-amber-800 rounded-3xl p-8 md:p-10 text-white shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5">
              <Clock size={26} className="text-amber-300" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{t('ctaTitle')}</h3>
            <p className="text-amber-100/90 mb-7 leading-relaxed text-sm sm:text-base">
              {t('ctaDesc')}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-stone-950 font-bold hover:bg-amber-400 transition text-sm sm:text-base"
            >
              {t('ctaButton')} <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="bg-gradient-to-r from-amber-800 via-amber-700 to-stone-900 text-white py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
          className="max-w-4xl mx-auto px-4 text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">
            {t('finalTitle')}
          </motion.h2>
          <motion.p variants={fadeUp} className="text-amber-100/90 text-base sm:text-lg mb-8">
            {t('finalDesc')}
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-amber-950 font-bold hover:bg-amber-50 transition shadow-sm"
            >
              {t('finalButton')} <ArrowRight size={20} />
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}