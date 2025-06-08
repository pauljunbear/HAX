'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppleStyleLayoutProps {
  children: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  hasImage?: boolean;
}

const AppleStyleLayout: React.FC<AppleStyleLayoutProps> = ({
  children,
  leftSidebar,
  rightSidebar,
  hasImage = false
}) => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Left Sidebar - Effects Browser */}
      <motion.div
        initial={false}
        animate={{ 
          width: leftCollapsed ? 60 : 280,
          opacity: leftCollapsed ? 0.8 : 1
        }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 200,
          duration: 0.3
        }}
        className="relative bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm"
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="absolute top-4 right-3 z-10 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
          aria-label={leftCollapsed ? "Expand effects panel" : "Collapse effects panel"}
        >
          <svg 
            className={`w-3 h-3 text-gray-600 dark:text-gray-400 transition-transform ${leftCollapsed ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Sidebar Content */}
        <div className="h-full overflow-hidden">
          {!leftCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              {leftSidebar}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 pt-16"
            >
              {/* Collapsed state icons */}
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm">✨</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">🔍</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">⭐</span>
                </div>
              </div>
            </motion.div>
          )}
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
          
          <div className="flex items-center space-x-3">
            {/* Global Actions - Only show when image is loaded */}
            {hasImage && (
              <>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  New Image
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Use Export tab →
                </span>
              </>
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
        animate={{ 
          width: rightCollapsed ? 60 : 320,
          opacity: rightCollapsed ? 0.8 : 1
        }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 200,
          duration: 0.3
        }}
        className="relative bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm"
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="absolute top-4 left-3 z-10 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
          aria-label={rightCollapsed ? "Expand controls panel" : "Collapse controls panel"}
        >
          <svg 
            className={`w-3 h-3 text-gray-600 dark:text-gray-400 transition-transform ${rightCollapsed ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Sidebar Content */}
        <div className="h-full overflow-hidden">
          {!rightCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              {rightSidebar}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 pt-16"
            >
              {/* Collapsed state icons */}
              <div className="space-y-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 text-sm">⚙️</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">📚</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">↩️</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AppleStyleLayout; 