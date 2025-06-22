'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sun, Moon, Zap } from 'lucide-react';
import AppleEffectsBrowser from './AppleEffectsBrowser';
import AppleControlsPanel from './AppleControlsPanel';
import { useTheme } from '@/lib/themes';

interface AppleStyleLayoutProps {
  children: React.ReactNode;
  selectedImage: string | null;
  onImageSelect: () => void;
  onImageUpload: (file: File) => void;
}

const AppleStyleLayout: React.FC<AppleStyleLayoutProps> = ({
  children,
  selectedImage,
  onImageSelect,
  onImageUpload,
}) => {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="h-14 glass-panel border-b flex items-center justify-between px-4">
        {/* Left Section */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            className="w-8 h-8 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
            title={leftPanelCollapsed ? 'Show Effects Panel' : 'Hide Effects Panel'}
          >
            {leftPanelCollapsed ? (
              <ChevronRight className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            )}
          </button>
        </div>

        {/* Center Section */}
        <div className="flex items-center space-x-2 text-sm text-white/70">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Ready</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="theme-toggle flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
            <span className="text-xs font-medium">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>

          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="w-8 h-8 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
            title={rightPanelCollapsed ? 'Show Controls Panel' : 'Hide Controls Panel'}
          >
            {rightPanelCollapsed ? (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/70" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Panel - Effects Browser */}
        <AnimatePresence mode="wait">
          {!leftPanelCollapsed && (
            <motion.div
              key="left-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full overflow-hidden"
            >
              <AppleEffectsBrowser onImageSelect={handleImageSelect} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center - Canvas */}
        <div className="flex-1 relative overflow-hidden">{children}</div>

        {/* Right Panel - Controls */}
        <AnimatePresence mode="wait">
          {!rightPanelCollapsed && (
            <motion.div
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full overflow-hidden"
            >
              <AppleControlsPanel
                isCollapsed={false}
                onToggle={() => setRightPanelCollapsed(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default AppleStyleLayout;
