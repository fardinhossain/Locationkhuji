import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Map, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroSearch from './HeroSearch';
import HeroStats from './HeroStats';
import HeroMap from './HeroMap';
import MapCard from './MapCard';

const HeroSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative w-full min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] lg:max-h-[860px] flex flex-col lg:flex-row px-6 lg:px-12 pb-8 pt-4 sm:pt-6 lg:pt-8 overflow-hidden">

      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[60%] rounded-full bg-teal-500/10 blur-[150px]" />
      </div>

      {/* ── Left Content Area (47%) ─────────────────────────────────────────── */}
      <div className="w-full lg:w-[47%] flex flex-col justify-between relative z-10 lg:pr-4 xl:pr-6">

        {/* Top group: badge → title → description → search → buttons */}
        <div className="flex flex-col">

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/5 text-teal-400 text-xs font-medium mb-5 backdrop-blur-sm self-start"
          >
            {t('hero.badge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[32px] sm:text-[38px] md:text-[48px] xl:text-[54px] font-bold leading-[1.15] tracking-tight mb-4 sm:mb-5 text-white"
          >
            <span className="block glow-text-teal opacity-95">{t('hero.titleLine1')}</span>
            <span className="block text-teal-500">{t('hero.titleLine2')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-sm sm:text-[15px] max-w-[460px] mb-1 leading-relaxed"
          >
            {t('hero.description')}
          </motion.p>

          <HeroSearch />

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-6"
          >
            <Link
              to="/map"
              className="bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold px-6 sm:px-8 py-3.5 rounded-full flex items-center justify-center gap-2 transition-colors glow-teal-strong shadow-lg w-full sm:w-auto text-sm sm:text-base"
            >
              <Map className="w-5 h-5" />
              {t('hero.openMap')}
            </Link>
            <Link
              to="/list"
              className="bg-transparent hover:bg-white/5 border border-gray-600 text-white font-medium px-6 sm:px-8 py-3.5 rounded-full flex items-center justify-center gap-2 transition-colors w-full sm:w-auto text-sm sm:text-base"
            >
              <List className="w-5 h-5 text-teal-500" />
              {t('hero.viewList')}
            </Link>
          </motion.div>

        </div>

        {/* Bottom: stats bar, anchored by justify-between */}
        <HeroStats />

      </div>

      {/* ── Right Map Area (53%) — map only, no card here ─────────────────── */}
      <div className="w-full lg:w-[53%] mt-8 lg:mt-0 relative flex items-center justify-center z-10">
        <HeroMap />
      </div>

      {/* ── MapCard: section-level absolute — sits in the transparent         */}
      {/*    north-east corner of the Bangladesh map image (no overlap)       */}
      <MapCard />

    </section>
  );
};

export default HeroSection;
