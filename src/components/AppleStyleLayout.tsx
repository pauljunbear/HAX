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
      <div className="flex-1 flex relative">
        {/* Effects Panel - Liquid Glass material with inset */}
        {!leftPanelCollapsed && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.1] }}
            className="w-80 relative liquid-material shape-fixed-lg"
            style={{ '--parent-radius': '16px', '--padding': '8px' } as React.CSSProperties}
          >
            <AppleEffectsBrowser
              activeEffect={activeEffect}
              onEffectChange={onEffectChange}
              hasImage={!!selectedImage}
              onNewImage={handleImageSelect}
              onHidePanel={() => setLeftPanelCollapsed(true)}
            />
          </motion.div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex items-center justify-center bg-[var(--bg-canvas)]">
          {children}
        </div>

        {/* Controls Panel - Liquid Glass material with inset */}
        {!rightPanelCollapsed && (
          <motion.div
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.1] }}
            className="w-80 relative liquid-material shape-fixed-lg"
            style={{ '--parent-radius': '16px', '--padding': '8px' } as React.CSSProperties}
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
