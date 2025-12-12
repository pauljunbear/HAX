'use client';

import React, { useState, useRef } from 'react';
import { Sun, Moon, Menu } from 'lucide-react';
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
  // State for mobile side-panel draw ers
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);

  const nextTheme =
    theme === 'light' ? 'instrument' : theme === 'instrument' ? 'terminal' : 'light';
  const nextThemeLabel =
    nextTheme === 'instrument' ? 'Instrument' : nextTheme === 'terminal' ? 'Terminal' : 'Light';

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
    <div className="h-screen w-screen overflow-hidden layout-bg flex md:gap-4 md:p-4">
      {/* Mobile Toggle Buttons */}
      <div className="absolute top-4 left-4 flex items-center gap-2 md:hidden z-50">
        <button
          aria-label="Open Effects Panel"
          className="p-2 rounded-full glass-button"
          onClick={() => setIsLeftOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2 md:hidden z-50">
        <button
          aria-label="Open Controls Panel"
          className="p-2 rounded-full glass-button"
          onClick={() => setIsRightOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Left Effects Panel */}
      {/* Desktop mode */}
      <div className="hidden md:block w-64 lg:w-80 h-full sidebar-panel flex-shrink-0 left-panel relative z-10 glass-container">
        <div className="glass-filter" />
        <div className="glass-overlay" />
        <div className="glass-specular" />
        <div className="glass-content h-full w-full">
          <AppleEffectsBrowser
            activeEffect={activeEffect}
            onEffectChange={onEffectChange}
            hasImage={!!selectedImage}
            onNewImage={handleImageSelect}
            onHidePanel={() => {}}
          />
        </div>
      </div>
      {/* Mobile overlay */}
      {isLeftOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsLeftOpen(false)} />
          <div className="relative w-4/5 max-w-xs h-full glass-container overflow-auto">
            <div className="glass-filter" />
            <div className="glass-overlay" />
            <div className="glass-specular" />
            <div className="glass-content h-full w-full">
              <AppleEffectsBrowser
                activeEffect={activeEffect}
                onEffectChange={e => {
                  onEffectChange?.(e);
                  setIsLeftOpen(false);
                }}
                hasImage={!!selectedImage}
                onNewImage={() => {
                  handleImageSelect();
                  setIsLeftOpen(false);
                }}
                onHidePanel={() => setIsLeftOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Center Canvas Area */}
      <div className="flex-1 h-full canvas-area min-w-0 glass-container">
        <div className="glass-filter" />
        <div className="glass-overlay" />
        <div className="glass-specular" />
        <div className="glass-content h-full w-full">{children}</div>
      </div>

      {/* Right Controls Panel (desktop) */}
      <div className="hidden md:block w-64 lg:w-80 h-full sidebar-panel flex-shrink-0 right-panel relative z-10 glass-container">
        <div className="glass-filter" />
        <div className="glass-overlay" />
        <div className="glass-specular" />
        <div className="glass-content h-full w-full">
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
            onNewImage={handleImageSelect}
            hasImage={!!selectedImage}
          />
        </div>
      </div>
      {/* Right Controls Panel mobile overlay */}
      {isRightOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsRightOpen(false)} />
          <div className="relative w-4/5 max-w-xs h-full glass-container overflow-auto">
            <div className="glass-filter" />
            <div className="glass-overlay" />
            <div className="glass-specular" />
            <div className="glass-content h-full w-full">
              <AppleControlsPanel
                isCollapsed={false}
                onToggle={() => setIsRightOpen(false)}
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
                onNewImage={handleImageSelect}
                hasImage={!!selectedImage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Theme Toggle - Bottom Right (move up on mobile) */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 md:w-12 md:h-12 theme-toggle-button rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          title={`Switch to ${nextThemeLabel} theme`}
        >
          {nextTheme === 'terminal' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
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
