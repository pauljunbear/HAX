'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface IntroScreenProps {
  onImageSelect: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onImageSelect }) => {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50/80 via-white/60 to-gray-100/80 dark:from-gray-900 dark:to-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center max-w-md mx-auto px-8"
      >
        {/* App Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-500/90 to-blue-600/90 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-sm"
        >
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-4xl font-bold text-gray-900 dark:text-white mb-4"
        >
          Imager
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-lg text-gray-600 dark:text-gray-300 mb-12 leading-relaxed"
        >
          Transform your images with beautiful, real-time artistic effects
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onImageSelect}
          className="inline-flex items-center px-8 py-4 bg-blue-600/90 hover:bg-blue-700/90 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 space-x-3 backdrop-blur-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Choose Image</span>
        </motion.button>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-16 grid grid-cols-3 gap-8 text-center"
        >
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-sm">⚡</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Real-time</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 dark:text-purple-400 text-sm">🎨</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Artistic</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-sm">📱</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Modern</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default IntroScreen;
