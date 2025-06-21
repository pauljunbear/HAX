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
    const newTheme = currentTheme === 'apple' ? 'terminal' : 'apple';
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
            : 'bg-gray-900 hover:bg-gray-800 text-green-500 border border-gray-700'
        }
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${currentTheme === 'apple' ? 'Terminal' : 'Apple'} theme`}
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {isHovered && <span className="text-xs font-mono">TERMINAL</span>}
          </>
        )}
      </div>
    </motion.button>
  );
};
