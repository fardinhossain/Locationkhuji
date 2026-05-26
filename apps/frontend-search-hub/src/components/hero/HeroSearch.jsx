import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Sparkles } from 'lucide-react';

const HeroSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/map?ai_q=${encodeURIComponent(query.trim())}`);
  };

  const handlePopularAreaClick = (areaName) => {
    navigate(`/map?ai_q=${encodeURIComponent(areaName)}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-2xl mt-6"
    >

      {/* Search Input Container */}
      <form onSubmit={handleSearch} className="relative flex items-center w-full bg-[#11161C] border border-gray-700/60 rounded-full p-2 pl-4 sm:pl-6 shadow-2xl hover:border-teal-500/30 transition-colors focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/20">
        <MapPin className="text-teal-500 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('hero.searchPlaceholder') || "Describe what you are looking for (e.g. 2-bed flat Dhanmondi)..."}
          className="flex-grow bg-transparent border-none outline-none text-white px-2 sm:px-4 placeholder:text-gray-500 text-[13px] sm:text-[15px] lg:text-base w-full min-w-0"
        />
        <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-navy-900 font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full flex items-center gap-1.5 sm:gap-2 transition-colors shadow-[0_0_15px_rgba(0,209,178,0.4)] whitespace-nowrap text-sm sm:text-base flex-shrink-0">
          <Search size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">{t('hero.searchBtn')}</span>
        </button>
      </form>

      {/* Popular Areas */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <span className="text-teal-400 text-sm font-medium">
          {t('hero.popularPrefix')}
        </span>
        {(t('hero.popularAreas', { returnObjects: true }) || []).map((area, idx) => (
          <button 
            key={idx}
            onClick={() => handlePopularAreaClick(area)}
            className="px-4 py-1.5 rounded-full border border-gray-700 text-gray-300 text-xs hover:border-teal-500 hover:text-white transition-all bg-navy-800/40 active:scale-95 duration-100"
          >
            {area}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default HeroSearch;
