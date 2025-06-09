'use client';

import React, { useState, useEffect } from 'react';
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
    <div className="h-screen apple-surface-primary flex">
      {/* Left Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: leftCollapsed ? 0 : 280 }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="apple-surface-elevated apple-glass border-r apple-border flex-shrink-0 overflow-hidden shadow-sm"
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
        <div className="h-14 apple-surface-elevated apple-glass border-b apple-border flex items-center justify-between px-4 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="w-7 h-7 apple-button apple-text-secondary hover:apple-text-primary rounded-lg flex items-center justify-center transition-all duration-200"
              aria-label={leftCollapsed ? 'Expand effects panel' : 'Collapse effects panel'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {hasImage && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Ready</span>
              </div>
            )}
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="w-7 h-7 apple-button apple-text-secondary hover:apple-text-primary rounded-lg flex items-center justify-center transition-all duration-200"
              aria-label={rightCollapsed ? 'Expand controls panel' : 'Collapse controls panel'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-50 relative overflow-hidden">{children}</div>
      </div>

      {/* Right Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: rightCollapsed ? 0 : 320 }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="apple-surface-elevated apple-glass border-l apple-border flex-shrink-0 overflow-hidden shadow-sm"
      >
        <div className="w-[320px] h-full">{rightSidebar}</div>
      </motion.div>
    </div>
  );
};

export default AppleStyleLayout;
