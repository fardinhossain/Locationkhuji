import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Home, Pill, PlusSquare, ShoppingBag } from 'lucide-react';

const MapCard = () => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.8 }}
      /*
       * Positioned relative to the <section> (position:relative).
       * top-[13%]  → sits well below the navbar, in the transparent
       *              north-east corner of the Bangladesh map image.
       * right-4    → 16 px gap from the section's right edge at lg.
       * z-20       → renders above the map layer (z-10).
       * Hidden on mobile / md to save space.
       */
      className="absolute right-4 xl:right-6 top-[13%] lg:top-[14%] xl:top-[13%] z-20 cyber-panel p-5 rounded-2xl w-[200px] xl:w-[220px] shadow-2xl hidden lg:block"
    >
      <h3 className="text-teal-500 font-semibold mb-4 text-sm xl:text-base">{t('mapCard.title')}</h3>

      <div className="space-y-3 xl:space-y-4">
        <MapStatRow
          icon={<Home size={15} />}
          color="text-teal-400"
          label={t('flatRental')}
          count={t('mapCard.counts.flat')}
        />
        <MapStatRow
          icon={<Pill size={15} />}
          color="text-accent-orange"
          label={t('pharmacy')}
          count={t('mapCard.counts.pharmacy')}
        />
        <MapStatRow
          icon={<PlusSquare size={15} />}
          color="text-accent-red"
          label={t('hospital')}
          count={t('mapCard.counts.hospital')}
        />
        <MapStatRow
          icon={<ShoppingBag size={15} />}
          color="text-accent-purple"
          label={t('fashion')}
          count={t('mapCard.counts.fashion')}
        />
      </div>
    </motion.div>
  );
};

const MapStatRow = ({ icon, color, label, count }) => (
  <div className="flex items-center justify-between text-sm p-2 -mx-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
    <div className="flex items-center gap-2.5">
      <span className={`${color} group-hover:scale-110 transition-transform duration-300`}>{icon}</span>
      <span className="text-gray-400 group-hover:text-white transition-colors duration-300 text-xs xl:text-sm">{label}</span>
    </div>
    <span className={`font-mono font-medium text-xs xl:text-sm ${color} group-hover:drop-shadow-[0_0_8px_currentColor] transition-all duration-300`}>{count}</span>
  </div>
);

export default MapCard;
