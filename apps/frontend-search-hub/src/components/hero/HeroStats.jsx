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
      <div className="hero-stats-panel cyber-panel rounded-2xl grid grid-cols-2 sm:grid-cols-4 items-center py-4 px-3 sm:px-6 gap-y-4 gap-x-2 sm:gap-x-4 sm:divide-x divide-transparent sm:divide-white/10">

        <StatItem
          icon={<BookOpen className="text-[#00C9A7] w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00C9A7' }} />}
          count={t('stats.listingsCount') || t('stats.listingCount') || '5,000+'}
          label={t('stats.listingLabel') || 'Listings'}
        />

        <StatItem
          icon={<LayoutGrid className="text-[#00C9A7] w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00C9A7' }} />}
          count={t('stats.categoriesCount') || t('stats.categoryCount') || '4'}
          label={t('stats.categoryLabel') || 'Categories'}
        />

        <StatItem
          icon={<MapPin className="text-[#A855F7] w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#A855F7' }} />}
          count={t('stats.radiusDistance') || t('stats.radiusCount') || '5km'}
          label={t('stats.radiusLabel') || 'Search Radius'}
        />

        <StatItem
          icon={<ShieldCheck className="text-[#3B82F6] w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#3B82F6' }} />}
          count={t('stats.realtime') || t('stats.focusCount') || 'Real-time'}
          label={t('stats.focusLabel') || 'Bangladesh Focused'}
        />

      </div>
    </motion.div>
  );
};

const StatItem = ({ icon, count, label }) => {
  const { i18n } = useTranslation();
  const isBn = i18n.language === 'bn';

  return (
    <div className="flex items-center gap-2 sm:gap-3 justify-start sm:pl-3 lg:pl-4 first:pl-0 min-w-0">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-base sm:text-lg lg:text-xl font-bold text-white leading-tight whitespace-nowrap ${isBn ? 'font-bengali' : 'font-space'}`}>{count}</div>
        <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5 leading-tight">{label}</div>
      </div>
    </div>
  );
};

export default HeroStats;
