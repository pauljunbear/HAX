'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

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
  onNewImage
}) => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Left Sidebar - Effects Browser */}
      <motion.div
        initial={false}
        animate={{ width: leftCollapsed ? 0 : 280 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm relative"
      >
        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="w-6 h-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
            aria-label={leftCollapsed ? "Expand effects panel" : "Collapse effects panel"}
          >
            <svg className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${leftCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="w-[280px] h-full overflow-hidden">
          {React.cloneElement(leftSidebar as React.ReactElement<any>, { 
            onNewImage: onNewImage,
          })}
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Imager
            </h1>
            {hasImage && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
          {children}
        </div>
      </div>

      {/* Right Sidebar - Active Controls */}
      <motion.div
        initial={false}
        animate={{ width: rightCollapsed ? 0 : 320 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm relative"
      >
        <div className="absolute inset-y-0 left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="w-6 h-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
            aria-label={rightCollapsed ? "Expand controls panel" : "Collapse controls panel"}
          >
            <svg className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${rightCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="w-[320px] h-full overflow-hidden">
          {rightSidebar}
        </div>
      </motion.div>
    </div>
  );
};

export default AppleStyleLayout; 