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
  onNewImage,
}) => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: leftCollapsed ? 0 : 280 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden"
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
        <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="w-7 h-7 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors"
              aria-label={leftCollapsed ? "Expand effects panel" : "Collapse effects panel"}
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Imager
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {hasImage && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Ready</span>
              </div>
            )}
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="w-7 h-7 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg flex items-center justify-center transition-colors"
              aria-label={rightCollapsed ? "Expand controls panel" : "Collapse controls panel"}
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
          {children}
        </div>
      </div>

      {/* Right Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: rightCollapsed ? 0 : 320 }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden"
      >
        <div className="w-[320px] h-full">
          {rightSidebar}
        </div>
      </motion.div>
    </div>
  );
};

export default AppleStyleLayout; 