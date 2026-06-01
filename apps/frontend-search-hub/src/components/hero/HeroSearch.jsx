import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Sparkles, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchModeStore } from '../../store';

const HeroSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { mode, setMode } = useSearchModeStore();

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error(t("Please enter a search query"));
      return;
    }
    if (mode === "ai") {
      navigate(`/map?ai_q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate(`/map?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handlePopularAreaClick = (areaName) => {
    if (mode === "ai") {
      navigate(`/map?ai_q=${encodeURIComponent(areaName)}`);
    } else {
      navigate(`/map?q=${encodeURIComponent(areaName)}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-2xl mt-6"
    >

      {/* Mode Selector Pills */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          type="button"
          onClick={() => setMode("ai")}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 ${
            mode === "ai"
              ? "bg-teal-500 text-navy-900 border-teal-500 shadow-[0_0_15px_rgba(0,209,178,0.4)]"
              : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          <Sparkles size={12} className={mode === "ai" ? "animate-pulse" : ""} />
          <span>{t('aiMode')}</span>
        </button>
        <button 
          type="button"
          onClick={() => setMode("standard")}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 ${
            mode === "standard"
              ? "bg-teal-500/15 text-teal-400 border-teal-500/40"
              : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          <Compass size={12} />
          <span>{t('standardMode')}</span>
        </button>
      </div>

      {/* Hint Text */}
      <p className="text-gray-500 text-[11px] font-medium mb-3 ml-1 transition-all duration-300">
        {mode === "ai" ? t('aiModeHint') : t('standardModeHint')}
      </p>

      {/* Search Input Container */}
      <form onSubmit={handleSearch} className={`relative flex items-center w-full bg-[#11161C] border rounded-full p-2 pl-4 sm:pl-6 shadow-2xl transition-colors focus-within:ring-1 ${
        mode === "ai"
          ? "border-teal-500/40 hover:border-teal-500/50 focus-within:border-teal-500/60 focus-within:ring-teal-500/20"
          : "border-gray-700/60 hover:border-teal-500/30 focus-within:border-teal-500/50 focus-within:ring-teal-500/20"
      }`}>
        <div className={`flex-shrink-0 transition-colors ${mode === "ai" ? "text-teal-400 animate-pulse" : "text-teal-500"}`}>
          {mode === "ai" ? <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" /> : <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "ai"
            ? (t('hero.searchPlaceholder') || "Describe what you are looking for (e.g. 2-bed flat Dhanmondi)...")
            : "Search area, thana or landmark..."
          }
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
