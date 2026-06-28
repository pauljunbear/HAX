'use client';

import React, { useState, useRef } from 'react';
import { Menu, ImagePlus, SlidersHorizontal, Eye } from 'lucide-react';
import AppleEffectsBrowser from './AppleEffectsBrowser';
import AppleControlsPanel from './AppleControlsPanel';
import { BeforeAfterSplitView } from './BeforeAfterSplitView';

interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  visible: boolean;
  opacity?: number;
  locked?: boolean;
}

interface AppleStyleLayoutProps {
  children: React.ReactNode;
  selectedImage: string | null;
  onImageSelect: () => void;
  onImageUpload: (file: File) => void;
  // Effect-related props
  effectLayers?: EffectLayer[];
  activeEffect?: string | null;
  appliedEffectIds?: Set<string>;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  onLayerSettingChange?: (layerId: string, settingName: string, value: number) => void;
  onLayerOpacityChange?: (layerId: string, opacity: number) => void;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onToggleLayerLock?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
  onReorderLayers?: (fromIndex: number, toIndex: number) => void;
  onExport?: (format: string, quality?: number) => void;
  onEstimateFileSize?: (format: 'png' | 'jpeg', quality?: number) => Promise<number>;
  showBeforeAfter?: boolean;
  onToggleBeforeAfter?: () => void;
  capturedEffectedUrl?: string | null;
}

const AppleStyleLayout: React.FC<AppleStyleLayoutProps> = ({
  children,
  selectedImage,
  onImageUpload,
  // Effect-related props
  effectLayers,
  activeEffect,
  appliedEffectIds,
  effectSettings,
  onEffectChange,
  onSettingChange,
  onLayerSettingChange,
  onLayerOpacityChange,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  onToggleLayerLock,
  onSetActiveLayer,
  onToggleLayerVisibility,
  onReorderLayers,
  onExport,
  onEstimateFileSize,
  showBeforeAfter,
  onToggleBeforeAfter,
  capturedEffectedUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State for mobile side-panel drawers
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);

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
    <div className="h-screen w-screen overflow-hidden layout-bg flex flex-col">
      {/* ===== Top chrome ===== */}
      <header className="hx-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <button
            aria-label="Open Effects"
            className="hx-topbar-btn md:hidden"
            style={{ padding: '0 10px' }}
            onClick={() => setIsLeftOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="hx-wordmark">
            HAX<span className="pt">.</span>
          </span>
          <span className="hx-tagline hidden sm:inline">image effects, played not configured</span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleBeforeAfter && (
            <button
              className="hx-topbar-btn"
              onClick={onToggleBeforeAfter}
              disabled={!selectedImage}
              aria-label="Toggle before/after comparison"
              aria-pressed={!!showBeforeAfter}
              title="Before / After (Ctrl+B)"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Compare</span>
            </button>
          )}
          <button className="hx-topbar-btn" onClick={handleImageSelect}>
            <ImagePlus className="w-4 h-4" />
            <span className="hidden sm:inline">New image</span>
          </button>
          <button
            aria-label="Open Controls"
            className="hx-topbar-btn md:hidden"
            style={{ padding: '0 10px' }}
            onClick={() => setIsRightOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ===== Workspace: three columns ===== */}
      <div className="flex-1 flex min-h-0">
        {/* Left Effects Panel — desktop */}
        <div className="hidden md:block w-72 lg:w-80 h-full sidebar-panel flex-shrink-0 left-panel relative z-10 glass-container">
          <div className="glass-content h-full w-full">
            <AppleEffectsBrowser
              activeEffect={activeEffect}
              appliedEffectIds={appliedEffectIds}
              onEffectChange={onEffectChange}
              hasImage={!!selectedImage}
              imageUrl={selectedImage}
              onNewImage={handleImageSelect}
              onHidePanel={() => {}}
            />
          </div>
        </div>
        {/* Left — mobile overlay */}
        {isLeftOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsLeftOpen(false)} />
            <div className="relative w-4/5 max-w-xs h-full glass-container left-panel overflow-auto">
              <div className="glass-content h-full w-full">
                <AppleEffectsBrowser
                  activeEffect={activeEffect}
                  appliedEffectIds={appliedEffectIds}
                  onEffectChange={e => {
                    onEffectChange?.(e);
                    setIsLeftOpen(false);
                  }}
                  hasImage={!!selectedImage}
                  imageUrl={selectedImage}
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
        <div className="flex-1 h-full canvas-area min-w-0 glass-container relative">
          <div className="glass-content h-full w-full">{children}</div>
          {showBeforeAfter && capturedEffectedUrl && selectedImage && (
            <BeforeAfterSplitView
              beforeImage={selectedImage}
              afterImage={capturedEffectedUrl}
              width={900}
              height={600}
              isActive={!!showBeforeAfter}
              onClose={() => onToggleBeforeAfter?.()}
            />
          )}
        </div>

        {/* Right Controls Panel — desktop */}
        <div className="hidden md:block w-72 lg:w-80 h-full sidebar-panel flex-shrink-0 right-panel relative z-10 glass-container">
          <div className="glass-content h-full w-full">
            <AppleControlsPanel
              isCollapsed={false}
              onToggle={() => {}}
              activeEffect={activeEffect}
              effectLayers={effectLayers}
              effectSettings={effectSettings}
              onSettingChange={onSettingChange}
              onLayerSettingChange={onLayerSettingChange}
              onLayerOpacityChange={onLayerOpacityChange}
              onResetSettings={onResetSettings}
              onClearAllEffects={onClearAllEffects}
              onRemoveEffect={onRemoveEffect}
              onToggleLayerLock={onToggleLayerLock}
              onSetActiveLayer={onSetActiveLayer}
              onToggleLayerVisibility={onToggleLayerVisibility}
              onReorderLayers={onReorderLayers}
              onExport={onExport}
              onEstimateFileSize={onEstimateFileSize}
              onNewImage={handleImageSelect}
              hasImage={!!selectedImage}
            />
          </div>
        </div>
        {/* Right — mobile overlay */}
        {isRightOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsRightOpen(false)} />
            <div className="relative w-4/5 max-w-xs h-full glass-container right-panel overflow-auto">
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
                  onToggleLayerLock={onToggleLayerLock}
                  onSetActiveLayer={onSetActiveLayer}
                  onToggleLayerVisibility={onToggleLayerVisibility}
                  onReorderLayers={onReorderLayers}
                  onExport={onExport}
                  onEstimateFileSize={onEstimateFileSize}
                  onNewImage={handleImageSelect}
                  hasImage={!!selectedImage}
                />
              </div>
            </div>
          </div>
        )}
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
