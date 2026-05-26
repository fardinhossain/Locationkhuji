import React from 'react';
import { motion } from 'framer-motion';
import bdmapImg from '../../assets/bdmap.png';

const HeroMap = () => {
  return (
    /*
     * The map fills most of the right column on desktop.
     * No horizontal translate — keeping Bangladesh centred so the
     * image's transparent north-east corner naturally accommodates
     * the MapCard that is now positioned at the section level.
     */
    <div className="relative w-[85%] sm:w-[90%] md:w-[80%] lg:w-full xl:w-full max-w-[550px] aspect-square flex items-center justify-center">

      {/* Radial glow behind the map */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />

      {/* Warm starburst at the Dhaka / Chittagong centroid */}
      <div className="absolute top-[48%] left-[46%] w-32 h-32 bg-yellow-200/20 blur-[40px] rounded-full mix-blend-screen pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1.08 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="w-full h-full relative flex items-center justify-center pointer-events-none"
      >
        <img
          src={bdmapImg}
          alt="Bangladesh Map"
          className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(0,209,178,0.45)]"
        />
      </motion.div>
    </div>
  );
};

export default HeroMap;
