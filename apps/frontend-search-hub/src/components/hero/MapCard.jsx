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
      className="absolute right-[15%] top-[12%] cyber-panel p-5 rounded-2xl w-64 shadow-2xl hidden lg:block" // Hidden on smaller screens to save space
    >
      <h3 className="text-teal-500 font-semibold mb-4 text-base">{t('mapCard.title')}</h3>
      
      <div className="space-y-4">
        <MapStatRow 
          icon={<Home size={16} />} 
          color="text-teal-400" 
          label={t('flatRental')} 
          count={t('mapCard.counts.flat')} 
        />
        <MapStatRow 
          icon={<Pill size={16} />} 
          color="text-accent-orange" 
          label={t('pharmacy')} 
          count={t('mapCard.counts.pharmacy')} 
        />
        <MapStatRow 
          icon={<PlusSquare size={16} />} 
          color="text-accent-red" 
          label={t('hospital')} 
          count={t('mapCard.counts.hospital')} 
        />
        <MapStatRow 
          icon={<ShoppingBag size={16} />} 
          color="text-accent-purple" 
          label={t('fashion')} 
          count={t('mapCard.counts.fashion')} 
        />
      </div>
    </motion.div>
  );
};

const MapStatRow = ({ icon, color, label, count }) => (
  <div className="flex items-center justify-between text-sm p-2.5 -mx-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
    <div className="flex items-center gap-3">
      <span className={`${color} group-hover:scale-110 transition-transform duration-300`}>{icon}</span>
      <span className="text-gray-400 group-hover:text-white transition-colors duration-300">{label}</span>
    </div>
    <span className={`font-mono font-medium ${color} group-hover:drop-shadow-[0_0_8px_currentColor] transition-all duration-300`}>{count}</span>
  </div>
);

export default MapCard;
