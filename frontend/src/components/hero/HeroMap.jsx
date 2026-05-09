import React from 'react';
import { motion } from 'framer-motion';
import bdmapImg from '../../assets/bdmap.png';

const HeroMap = () => {
  return (
    <div className="relative w-[300%] sm:w-[200%] md:w-[150%] lg:w-[180%] xl:w-[200%] max-w-[1400px] aspect-square flex items-center justify-center lg:-translate-x-20 xl:-translate-x-32">
      
      {/* Background glow layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent opacity-60 pointer-events-none"></div>
      
      {/* Starburst central glow */}
      <div className="absolute top-[48%] left-[48%] w-32 h-32 bg-yellow-200/20 blur-[40px] rounded-full mix-blend-screen pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1.4 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-full h-full relative flex items-center justify-center pointer-events-none"
      >
        <img 
          src={bdmapImg} 
          alt="Bangladesh Map" 
          className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(0,209,178,0.4)]"
        />
        
      </motion.div>
    </div>
  );
};

export default HeroMap;
