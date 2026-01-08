'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig, getEffectCategory } from '@/lib/effects';
import { Layers, FileImage, Film, Monitor, X, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  visible: boolean;
}

interface AppleControlsPanelProps {
  activeEffect?: string | null;
  effectLayers?: EffectLayer[];
  effectSettings?: Record<string, number>;
  onSettingChange?: (settingName: string, value: number) => void;
  onExport?: (format: string, quality?: number) => void;
  onEstimateFileSize?: (format: 'png' | 'jpeg', quality?: number) => Promise<number>;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
  onReorderLayers?: (fromIndex: number, toIndex: number) => void;
  onNewImage?: () => void;
  hasImage?: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}

// Custom Hex Color Input Component
const HexColorInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => {
  // Convert decimal to hex
  const decimalToHex = (decimal: number): string => {
    return '#' + decimal.toString(16).padStart(6, '0');
  };

  // Convert hex to decimal
  const hexToDecimal = (hex: string): number => {
    const cleanHex = hex.replace('#', '');
    return parseInt(cleanHex, 16);
  };

  const [hexValue, setHexValue] = useState(decimalToHex(value));

  // Sync with prop changes
  useEffect(() => {
    setHexValue(decimalToHex(value));
  }, [value]);

  const handleColorChange = (newHex: string) => {
    setHexValue(newHex);
    const decimal = hexToDecimal(newHex);
    onChange(decimal);
  };

  const handleTextInputChange = (newValue: string) => {
    setHexValue(newValue);
    // Only update the parent if it's a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(hexToDecimal(newValue));
    }
  };

  return (
    <div className="p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium control-panel-label">{label}</label>
        <span className="text-xs font-mono bg-muted px-2 py-0.5">{hexValue.toUpperCase()}</span>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="color"
          value={hexValue}
          onChange={e => handleColorChange(e.target.value)}
          className="w-12 h-8 border-2 border-border cursor-pointer overflow-hidden bg-background"
        />
        <input
          type="text"
          value={hexValue}
          onChange={e => handleTextInputChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-1.5 text-sm border border-border bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors font-mono"
        />
      </div>

      <div className="mt-2 text-xs text-muted-foreground font-mono">
        Click color box or enter hex code
      </div>
    </div>
  );
};

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const AppleControlsPanel: React.FC<AppleControlsPanelProps> = ({
  activeEffect,
  effectLayers = [],
  effectSettings = {},
  onSettingChange,
  onExport,
  onEstimateFileSize,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  onSetActiveLayer,
  onToggleLayerVisibility,
  onReorderLayers,
  onNewImage,
  hasImage = false,
  isCollapsed,
}) => {
  const [activeTab, setActiveTab] = useState<string>('settings');
  const dragFromIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // JPEG quality state (1-100)
  const [jpegQuality, setJpegQuality] = useState(95);
  const [estimatedJpegSize, setEstimatedJpegSize] = useState<number | null>(null);
  const [estimatedPngSize, setEstimatedPngSize] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Estimate file sizes when export tab is active
  useEffect(() => {
    if (activeTab !== 'export' || !hasImage || !onEstimateFileSize) return;

    let cancelled = false;
    const estimate = async () => {
      setIsEstimating(true);
      try {
        const [pngSize, jpegSize] = await Promise.all([
          onEstimateFileSize('png'),
          onEstimateFileSize('jpeg', jpegQuality),
        ]);
        if (!cancelled) {
          setEstimatedPngSize(pngSize);
          setEstimatedJpegSize(jpegSize);
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) setIsEstimating(false);
      }
    };

    estimate();
    return () => {
      cancelled = true;
    };
  }, [activeTab, hasImage, onEstimateFileSize, jpegQuality]);

  // Get the active layer with null checking
  const activeLayer = effectLayers?.find(layer => layer.id === activeEffect);
  const activeEffectConfig = activeLayer ? effectsConfig[activeLayer.effectId] : null;
  const activeEffectCategory = activeLayer
    ? (getEffectCategory(activeLayer.effectId) ?? activeEffectConfig?.category)
    : null;

  // Get current effect settings with proper fallbacks
  const currentEffectSettings =
    activeEffectConfig?.settings?.map(setting => ({
      ...setting,
      currentValue: effectSettings[setting.id] ?? setting.defaultValue,
    })) || [];

  const exportOptions = [
    {
      type: 'PNG EXPORT',
      description: 'High quality, lossless',
      format: 'PNG',
      icon: FileImage,
      color: 'blue',
    },
    {
      type: 'JPEG EXPORT',
      description: 'High quality, web-optimized',
      format: 'JPG',
      icon: FileImage,
      color: 'blue',
    },
    {
      type: 'GIF EXPORT',
      description: 'Universal animated format',
      format: 'GIF',
      icon: Film,
      color: 'purple',
    },
    {
      type: 'WEBM EXPORT',
      description: 'High quality video',
      format: 'WEBM',
      icon: Monitor,
      color: 'orange',
    },
  ];

  if (isCollapsed) {
    return null; // Panel is hidden when collapsed
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Controls</h2>
      </div>

      {/* Tabs using shadcn */}
      <div className="px-3 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="settings">Effects</TabsTrigger>
            <TabsTrigger value="layers">Layers</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="new" onClick={() => onNewImage?.()} className="px-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {!activeLayer ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  Effect controls will appear here when an effect is selected
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Effect Header */}
                  <div className="glass-card p-4 mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate control-panel-title">
                          {activeEffectConfig?.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 control-panel-category">
                          {activeEffectCategory}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveEffect?.(activeLayer.id)}
                        className="ml-3 p-2 transition-all duration-200 flex-shrink-0 glass-button"
                        title="Remove effect"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onResetSettings?.()}
                        className="flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 glass-button"
                      >
                        Reset Values
                      </button>
                    </div>
                  </div>

                  {/* Settings Controls with shadcn Slider */}
                  <div className="space-y-6">
                    {currentEffectSettings.map(setting => {
                      // Check if this is a color setting (hex color)
                      const isColorSetting =
                        setting.label.toLowerCase().includes('color') &&
                        setting.label.toLowerCase().includes('hex');

                      if (isColorSetting) {
                        return (
                          <div key={setting.id} className="glass-card p-4">
                            <HexColorInput
                              label={setting.label}
                              value={setting.currentValue}
                              onChange={value => onSettingChange?.(setting.id, value)}
                            />
                          </div>
                        );
                      }

                      // Check if this is a preset/style setting with named presets
                      const isPresetSetting =
                        (setting.id === 'preset' || setting.id === 'style') &&
                        activeEffectConfig?.presetNames &&
                        activeEffectConfig.presetNames.length > 0;

                      if (isPresetSetting) {
                        const presetNames = activeEffectConfig!.presetNames!;
                        return (
                          <div key={setting.id} className="glass-card p-4">
                            <label className="text-sm font-medium control-panel-label block mb-3">
                              {setting.label}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {presetNames.map((name, index) => (
                                <button
                                  key={name}
                                  onClick={() => onSettingChange?.(setting.id, index)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                                    Math.round(setting.currentValue) === index
                                      ? 'bg-primary text-primary-foreground shadow-md'
                                      : 'glass-button hover:bg-muted'
                                  }`}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // Regular slider for non-color settings
                      return (
                        <div key={setting.id} className="glass-card p-4">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium control-panel-label">
                              {setting.label}
                            </label>
                            <span className="text-xs font-mono bg-muted px-2 py-1 slider-value">
                              {setting.currentValue.toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <Slider
                              min={setting.min}
                              max={setting.max}
                              step={setting.step}
                              value={[setting.currentValue]}
                              onValueChange={values => onSettingChange?.(setting.id, values[0])}
                              className="w-full"
                            />

                            {/* Range markers */}
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{setting.min}</span>
                              <span>{setting.max}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'layers' && (
            <motion.div
              key="layers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {!hasImage ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  Upload an image to manage layers
                </div>
              ) : effectLayers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center liquid-material">
                    <Layers className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm mb-1">No effect layers yet</p>
                  <p className="text-xs text-muted-foreground">Apply an effect to create a layer</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {effectLayers.map((layer, index) => {
                    const effectConfig = effectsConfig[layer.effectId];
                    const isActive = layer.id === activeEffect;

                    return (
                      <div
                        key={layer.id}
                        onClick={() => onSetActiveLayer?.(layer.id)}
                        draggable={!!onReorderLayers}
                        onDragStart={e => {
                          if (!onReorderLayers) return;
                          dragFromIndexRef.current = index;
                          setDragOverIndex(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', layer.id);
                        }}
                        onDragOver={e => {
                          if (!onReorderLayers) return;
                          e.preventDefault();
                          if (dragOverIndex !== index) {
                            setDragOverIndex(index);
                          }
                        }}
                        onDragLeave={() => {
                          if (!onReorderLayers) return;
                          if (dragOverIndex === index) {
                            setDragOverIndex(null);
                          }
                        }}
                        onDrop={e => {
                          if (!onReorderLayers) return;
                          e.preventDefault();
                          const fromIndex = dragFromIndexRef.current;
                          dragFromIndexRef.current = null;
                          setDragOverIndex(null);
                          if (fromIndex === null || fromIndex === index) return;
                          onReorderLayers(fromIndex, index);
                        }}
                        onDragEnd={() => {
                          dragFromIndexRef.current = null;
                          setDragOverIndex(null);
                        }}
                        className={`
                          p-3 cursor-pointer transition-all glass-effect-button
                          ${isActive ? 'glass-active' : ''}
                          ${dragOverIndex === index ? 'ring-2 ring-primary/30' : ''}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            {/* Visibility Toggle */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onToggleLayerVisibility?.(layer.id);
                              }}
                              className="transition-colors glass-button p-1"
                            >
                              {layer.visible ? (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                  />
                                </svg>
                              )}
                            </button>

                            {/* Layer Info */}
                            <div className="flex-1">
                              <h4
                                className={`text-sm font-medium ${isActive ? 'text-primary-foreground' : ''}`}
                              >
                                {effectConfig?.label || 'Unknown Effect'}
                              </h4>
                              <p
                                className={`text-[11px] ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                              >
                                Layer {effectLayers.length - index}
                              </p>
                            </div>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onRemoveEffect?.(layer.id);
                            }}
                            className="p-1 glass-button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {effectLayers.length > 1 && (
                    <button
                      onClick={() => onClearAllEffects?.()}
                      className="w-full mt-2 px-3 py-2 text-xs font-medium text-destructive glass-button"
                    >
                      Clear All Layers
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'export' && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* PNG Export */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                      <FileImage className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">PNG EXPORT</div>
                      <div className="text-[10px] text-muted-foreground">
                        Lossless, best quality
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium px-2 py-0.5 glass-badge">PNG</div>
                </div>
                {estimatedPngSize !== null && (
                  <div className="text-[10px] text-muted-foreground mb-2">
                    Estimated size: {isEstimating ? '...' : formatFileSize(estimatedPngSize)}
                  </div>
                )}
                <button
                  onClick={() => onExport?.('PNG')}
                  disabled={!hasImage}
                  className="w-full py-2 text-xs font-medium glass-button disabled:opacity-50"
                >
                  Export PNG
                </button>
              </div>

              {/* JPEG Export with Quality Slider */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                      <FileImage className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium">JPEG EXPORT</div>
                      <div className="text-[10px] text-muted-foreground">Adjustable quality</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium px-2 py-0.5 glass-badge">JPG</div>
                </div>

                {/* Quality Slider */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-muted-foreground">Quality</label>
                    <span className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">
                      {jpegQuality}%
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={100}
                    step={5}
                    value={[jpegQuality]}
                    onValueChange={values => setJpegQuality(values[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>

                {estimatedJpegSize !== null && (
                  <div className="text-[10px] text-muted-foreground mb-2">
                    Estimated size: {isEstimating ? '...' : formatFileSize(estimatedJpegSize)}
                    {estimatedPngSize !== null && estimatedPngSize > 0 && (
                      <span className="ml-1 text-green-500">
                        ({Math.round((1 - estimatedJpegSize / estimatedPngSize) * 100)}% smaller
                        than PNG)
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => onExport?.('JPG', jpegQuality)}
                  disabled={!hasImage}
                  className="w-full py-2 text-xs font-medium glass-button disabled:opacity-50"
                >
                  Export JPEG
                </button>
              </div>

              {/* GIF & Video Exports */}
              <div className="space-y-2">
                {exportOptions
                  .filter(opt => opt.format === 'GIF' || opt.format === 'WEBM')
                  .map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.format}
                        onClick={() => onExport?.(option.format)}
                        disabled={!hasImage}
                        className="w-full p-3 transition-all text-left group glass-effect-button disabled:opacity-50"
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 flex items-center justify-center mr-3 liquid-material">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium">{option.type}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                          <div className="text-[10px] font-medium px-2 py-0.5 ml-3 glass-badge">
                            {option.format}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AppleControlsPanel;
