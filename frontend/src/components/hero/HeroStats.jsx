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
      className="mt-12 sm:mt-16 lg:mt-24 w-full max-w-3xl"
    >
      <div className="cyber-panel rounded-2xl grid grid-cols-2 lg:grid-cols-4 items-center py-5 px-4 sm:px-6 gap-y-6 gap-x-4 lg:gap-0 lg:divide-x divide-transparent lg:divide-white/10">
        
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

const StatItem = ({ icon, count, label }) => (
  <div className="flex items-center gap-3 sm:gap-4 justify-center sm:justify-start lg:justify-center xl:justify-start lg:pl-6 xl:pl-8 first:pl-0">
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <div className="text-lg sm:text-xl font-bold text-white leading-tight">{count}</div>
      <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  </div>
);

export default HeroStats;
