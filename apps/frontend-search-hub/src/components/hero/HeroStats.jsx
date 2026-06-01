import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, LayoutGrid, MapPin, ShieldCheck } from 'lucide-react';

const HeroStats = () => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="hero-stats-wrapper mt-6 sm:mt-8 lg:mt-4 w-full"
    >
      <div className="hero-stats-panel cyber-panel rounded-2xl grid grid-cols-2 lg:grid-cols-4 items-center py-5 px-4 sm:px-6 gap-y-6 gap-x-4 lg:gap-1 lg:divide-x divide-transparent lg:divide-white/10">

        <StatItem
          icon={<BookOpen className="text-teal-500 w-6 h-6" />}
          count={t('stats.listingCount')}
          label={t('stats.listingLabel')}
        />

        <StatItem
          icon={<LayoutGrid className="text-teal-500 w-6 h-6" />}
          count={t('stats.categoryCount')}
          label={t('stats.categoryLabel')}
        />

        <StatItem
          icon={<MapPin className="text-[#A855F7] w-6 h-6" />}
          count={t('stats.radiusCount')}
          label={t('stats.radiusLabel')}
        />

        <StatItem
          icon={<ShieldCheck className="text-[#3B82F6] w-6 h-6" />}
          count={t('stats.focusCount')}
          label={t('stats.focusLabel')}
        />

      </div>
    </motion.div>
  );
};

const StatItem = ({ icon, count, label }) => {
  const { i18n } = useTranslation();
  const isBn = i18n.language === 'bn';

  return (
    <div className="flex items-center gap-3 sm:gap-4 justify-start lg:pl-4 xl:pl-8 first:pl-0">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className={`text-lg sm:text-xl font-bold text-white leading-tight ${isBn ? 'font-bengali' : 'font-space'}`}>{count}</div>
        <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
};

export default HeroStats;
