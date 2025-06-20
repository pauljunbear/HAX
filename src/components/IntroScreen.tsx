'use client';

import React from 'react';
import { motion } from 'framer-motion';
import AnimatedLogo from './AnimatedLogo';
import { Upload, ChevronRight } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface IntroScreenProps {
  onImageSelect: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onImageSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Animated Background */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
        <div className="w-[50%] h-[50%] relative overflow-hidden">
          <AnimatedLogo className="w-full h-full" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <div className="flex flex-col items-center justify-center gap-8">
          {/* Title above orb */}
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-4xl md:text-5xl font-bold text-white"
          >
            HAX
          </motion.h1>

          {/* Spacer for orb matching orb height to avoid tagline overlap */}
          <div className="h-[50vh]" />

          {/* Tagline below orb */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-base md:text-lg text-gray-300"
          >
            Add interesting effects to an image. A fun side project by Paul Jun.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8"
          >
            <button
              onClick={onImageSelect}
              className="group relative inline-flex items-center gap-3 px-6 py-3 bg-[#F53001] hover:bg-[#d42801] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm">Choose Image</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default IntroScreen;
