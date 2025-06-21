'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';

interface AppleStyleLayoutProps {
  children: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  hasImage?: boolean;
  onNewImage: () => void;
}

const AppleStyleLayout: React.FC<AppleStyleLayoutProps> = ({
  children,
  leftSidebar,
  rightSidebar,
  hasImage = false,
  onNewImage,
}) => {
  const [leftCollapsed, setLeftCollapsed] = useState(!hasImage);
  const [rightCollapsed, setRightCollapsed] = useState(!hasImage);

  // Show sidebars when image is loaded
  useEffect(() => {
    if (hasImage) {
      setLeftCollapsed(false);
      setRightCollapsed(false);
    } else {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [hasImage]);

  return (
    <div className="h-screen flex">
      {/* Left Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: leftCollapsed ? 0 : 280 }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="glass-panel border-r flex-shrink-0 overflow-hidden"
      >
        <div className="w-[280px] h-full">
          {React.cloneElement(leftSidebar as React.ReactElement<any>, {
            onNewImage: onNewImage,
          })}
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <motion.div
          className="h-14 glass-panel border-b flex items-center justify-between px-4 flex-shrink-0"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="w-8 h-8 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all duration-200 rounded-lg"
              aria-label={leftCollapsed ? 'Expand effects panel' : 'Collapse effects panel'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </motion.button>
          </div>

          <div className="flex items-center space-x-3">
            {hasImage && (
              <motion.div
                className="flex items-center space-x-2 text-sm text-white/70"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_6px_rgba(0,255,0,0.5)]"></div>
                <span className="uppercase tracking-wide font-mono text-xs">Ready</span>
              </motion.div>
            )}

            <ThemeToggle />

            <motion.button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="w-8 h-8 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all duration-200 rounded-lg"
              aria-label={rightCollapsed ? 'Expand controls panel' : 'Collapse controls panel'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </motion.button>
          </div>
        </motion.div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">{children}</div>
      </div>

      {/* Right Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: rightCollapsed ? 0 : 320 }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="glass-panel border-l flex-shrink-0 overflow-hidden"
      >
        <div className="w-[320px] h-full">{rightSidebar}</div>
      </motion.div>
    </div>
  );
};

export default AppleStyleLayout;
