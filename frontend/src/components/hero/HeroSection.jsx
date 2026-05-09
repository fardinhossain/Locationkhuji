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
    <section className="relative w-full min-h-[calc(100vh-88px)] flex flex-col lg:flex-row px-6 lg:px-12 pb-12 pt-6 overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top left glow */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/5 blur-[120px]" />
        {/* Map back glow */}
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[60%] rounded-full bg-teal-500/10 blur-[150px]" />
      </div>

      {/* Left Content Area */}
      <div className="w-full lg:w-[55%] flex flex-col justify-center relative z-10 lg:pr-10 xl:pr-20">
        
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/5 text-teal-400 text-xs font-medium mb-6 backdrop-blur-sm self-start"
        >
          {t('hero.badge')}
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[36px] sm:text-[44px] md:text-[56px] xl:text-[72px] font-bold leading-[1.1] tracking-tight mb-6 sm:mb-8 text-white"
        >
          <span className="block glow-text-teal opacity-95">{t('hero.titleLine1')}</span>
          <span className="block text-teal-500">{t('hero.titleLine2')}</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 text-lg md:text-xl max-w-xl mb-2 leading-relaxed"
        >
          {t('hero.description')}
        </motion.p>

        <HeroSearch />

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-8"
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

        <HeroStats />

      </div>

      {/* Right Map Area */}
      <div className="w-full lg:w-[45%] aspect-square md:h-[600px] lg:h-auto lg:min-h-[750px] mt-8 lg:mt-0 relative flex items-center justify-center z-10 overflow-visible">
        <HeroMap />
        <MapCard />
      </div>

    </section>
  );
};

export default HeroSection;
