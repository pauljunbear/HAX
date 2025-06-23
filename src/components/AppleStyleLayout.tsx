'use client';

import React, { useState, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
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
        {/* Effects Panel - Fixed width with proper glass effect */}
        <div className="w-80 h-full glass-material border-r border-white/10">
          <AppleEffectsBrowser
            activeEffect={activeEffect}
            onEffectChange={onEffectChange}
            hasImage={!!selectedImage}
            onNewImage={handleImageSelect}
            onHidePanel={() => {}}
          />
        </div>

        {/* Center Canvas - no extra background or padding */}
        <div className="flex-1 canvas-area">{children}</div>

        {/* Controls Panel - Fixed width with proper glass effect */}
        <div className="w-80 h-full glass-material border-l border-white/10">
          <AppleControlsPanel
            isCollapsed={false}
            onToggle={() => {}}
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
        </div>
      </div>

      {/* Floating Theme Toggle - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 glass-material rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
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
