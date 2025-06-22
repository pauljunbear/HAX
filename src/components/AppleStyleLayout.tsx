'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sun, Moon, Zap, Menu, X, Settings } from 'lucide-react';
import AppleEffectsBrowser from './AppleEffectsBrowser';
import AppleControlsPanel from './AppleControlsPanel';
import { useTheme } from '@/lib/themes';

interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  visible: boolean;
}

interface AppleStyleLayoutProps {
  children: React.ReactNode;
  selectedImage: string | null;
  onImageSelect: () => void;
  onImageUpload: (file: File) => void;
  // Effect-related props
  effectLayers?: EffectLayer[];
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
  onExport?: (format: string) => void;
}

const AppleStyleLayout: React.FC<AppleStyleLayoutProps> = ({
  children,
  selectedImage,
  onImageSelect,
  onImageUpload,
  // Effect-related props
  effectLayers,
  activeEffect,
  effectSettings,
  onEffectChange,
  onSettingChange,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  onSetActiveLayer,
  onToggleLayerVisibility,
  onExport,
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
              transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
              className="h-full overflow-hidden"
            >
              <AppleEffectsBrowser
                onImageSelect={handleImageSelect}
                activeEffect={activeEffect}
                onEffectChange={onEffectChange}
                hasImage={!!selectedImage}
                onNewImage={() => {
                  // Reset effects when getting new image
                  onClearAllEffects?.();
                }}
                onHidePanel={() => setLeftPanelCollapsed(true)}
              />
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
              transition={{ duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
              className="h-full overflow-hidden"
            >
              <AppleControlsPanel
                isCollapsed={false}
                onToggle={() => setRightPanelCollapsed(true)}
                activeEffect={activeEffect}
                effectLayers={effectLayers}
                effectSettings={effectSettings}
                onSettingChange={onSettingChange}
                onResetSettings={onResetSettings}
                onClearAllEffects={onClearAllEffects}
                onRemoveEffect={onRemoveEffect}
                onSetActiveLayer={onSetActiveLayer}
                onToggleLayerVisibility={onToggleLayerVisibility}
                onExport={onExport}
                hasImage={!!selectedImage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Theme Toggle - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:bg-white/20"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Panel Toggle Buttons */}
      {leftPanelCollapsed && (
        <div className="fixed top-4 left-4 z-40">
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="w-8 h-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:bg-white/20"
            title="Show Effects Panel"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {rightPanelCollapsed && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="w-8 h-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:bg-white/20"
            title="Show Controls Panel"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        </div>
      )}

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
