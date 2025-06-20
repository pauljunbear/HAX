'use client';

import React, { useEffect, useState } from 'react';
import { Theme, getTheme, setTheme } from '@/lib/themes';
import { motion } from 'framer-motion';

export const ThemeToggle: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>('apple');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Initialize theme on mount
    const theme = getTheme();
    setCurrentTheme(theme);
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'apple' ? 'cyberpunk' : 'apple';
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  return (
    <motion.button
      onClick={toggleTheme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative p-2 rounded-lg transition-all duration-300
        ${
          currentTheme === 'apple'
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-red-900/20 hover:bg-red-900/30 text-red-500 border border-red-500/30'
        }
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${currentTheme === 'apple' ? 'Cyberpunk' : 'Apple'} theme`}
    >
      <div className="flex items-center gap-2">
        {currentTheme === 'apple' ? (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {isHovered && <span className="text-xs font-medium">Apple</span>}
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                filter: 'drop-shadow(0 0 4px rgba(255, 0, 60, 0.6))',
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            {isHovered && <span className="text-xs font-bold tracking-wider uppercase">CYBER</span>}
          </>
        )}
      </div>

      {/* Cyberpunk glow effect */}
      {currentTheme === 'cyberpunk' && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 0, 60, 0.2), transparent)',
            filter: 'blur(8px)',
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.button>
  );
};
