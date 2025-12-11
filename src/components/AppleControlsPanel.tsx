'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
import { Settings, Download, Layers, FileImage, Film, Monitor, X } from 'lucide-react';
import { useTheme } from '@/lib/themes';

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
  onExport?: (format: string) => void;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
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
    <div className="p-3 border border-gray-200/20">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-800 font-mono uppercase tracking-wide">
          {label}
        </label>
        <span className="text-xs text-green-400 font-mono bg-black/50 px-2 py-0.5 border border-green-400/30">
          {hexValue.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="color"
          value={hexValue}
          onChange={e => handleColorChange(e.target.value)}
          className="w-12 h-8 border-2 border-green-400/30 cursor-pointer overflow-hidden bg-black"
        />
        <input
          type="text"
          value={hexValue}
          onChange={e => handleTextInputChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200/20 bg-black/50 text-gray-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors font-mono"
        />
      </div>

      <div className="mt-2 text-xs text-gray-500 font-mono">Click color box or enter hex code</div>
    </div>
  );
};

const AppleControlsPanel: React.FC<AppleControlsPanelProps> = ({
  activeEffect,
  effectLayers = [],
  effectSettings = {},
  onSettingChange,
  onExport,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  onSetActiveLayer,
  onToggleLayerVisibility,
  onNewImage,
  hasImage = false,
  isCollapsed,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'settings' | 'layers' | 'export'>('settings');

  // Get the active layer with null checking
  const activeLayer = effectLayers?.find(layer => layer.id === activeEffect);
  const activeEffectConfig = activeLayer ? effectsConfig[activeLayer.effectId] : null;

  // Get current effect settings with proper fallbacks
  const currentEffectSettings =
    activeEffectConfig?.settings?.map(setting => ({
      ...setting,
      currentValue: effectSettings[setting.id] ?? setting.defaultValue,
    })) || [];

  const tabs: Array<{
    id: 'settings' | 'layers' | 'export' | 'new';
    label: string;
    icon: React.ComponentType<{ className?: string }> | (() => JSX.Element);
  }> = [
    { id: 'settings', label: 'Effects', icon: Settings },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'export', label: 'Export', icon: Download },
    {
      id: 'new',
      label: '+',
      icon: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

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
        <h2 className="text-sm font-semibold">Controls</h2>
      </div>

      {/* Tabs */}
      <div className="px-3 pb-3 mb-4">
        <div className="flex gap-1 w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'new') {
                  onNewImage?.();
                  // Don't change active tab for action buttons
                } else {
                  setActiveTab(tab.id as 'settings' | 'layers' | 'export');
                }
              }}
              className={`
                glass-button ${tab.id === 'new' ? 'px-2 py-1.5 flex-shrink-0' : 'px-2.5 py-1.5 flex-1 min-w-0'} text-xs font-medium transition-all rounded-lg
                ${activeTab === (tab.id as 'settings' | 'layers' | 'export') && tab.id !== 'new' ? 'glass-active' : ''}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - with scroll edge effects */}
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
                <div className="text-center text-xs text-gray-500 py-12">
                  Effect controls will appear here when an effect is selected
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Effect Header */}
                  <div className="glass-card rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate control-panel-title">
                          {activeEffectConfig?.label}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 control-panel-category">
                          {activeEffectConfig?.category}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveEffect?.(activeLayer.id)}
                        className="ml-3 p-2 rounded-lg transition-all duration-200 flex-shrink-0 glass-button"
                        title="Remove effect"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onResetSettings?.()}
                        className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 glass-button"
                      >
                        Reset Values
                      </button>
                    </div>
                  </div>

                  {/* Settings Controls */}
                  <div className="space-y-6">
                    {currentEffectSettings.map(setting => {
                      // Check if this is a color setting (hex color)
                      const isColorSetting =
                        setting.label.toLowerCase().includes('color') &&
                        setting.label.toLowerCase().includes('hex');

                      if (isColorSetting) {
                        return (
                          <div key={setting.id} className="glass-card rounded-xl p-4">
                            <HexColorInput
                              label={setting.label}
                              value={setting.currentValue}
                              onChange={value => onSettingChange?.(setting.id, value)}
                            />
                          </div>
                        );
                      }

                      const percentage =
                        ((setting.currentValue - setting.min) / (setting.max - setting.min)) * 100;
                      const lightTrack = `linear-gradient(to right, #007aff 0%, #007aff ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`;
                      const terminalTrack = `linear-gradient(to right, var(--text-accent) 0%, var(--text-accent) ${percentage}%, var(--panel-border) ${percentage}%, var(--panel-border) 100%)`;

                      // Regular slider for non-color settings
                      return (
                        <div key={setting.id} className="glass-card rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium control-panel-label">
                              {setting.label}
                            </label>
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded-md">
                              {setting.currentValue.toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <input
                              type="range"
                              min={setting.min}
                              max={setting.max}
                              step={setting.step}
                              value={setting.currentValue}
                              onChange={e =>
                                onSettingChange?.(setting.id, parseFloat(e.target.value))
                              }
                              className="w-full appearance-none cursor-pointer slider"
                              style={{
                                background: theme === 'light' ? lightTrack : terminalTrack,
                              }}
                            />

                            {/* Range markers */}
                            <div className="flex justify-between text-xs text-gray-500">
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
                <div className="text-center text-xs text-gray-500 py-12">
                  Upload an image to manage layers
                </div>
              ) : effectLayers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl flex items-center justify-center liquid-material">
                    <Layers className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm mb-1">No effect layers yet</p>
                  <p className="text-xs text-gray-500">Apply an effect to create a layer</p>
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
                        className={`
                          p-3 rounded-xl cursor-pointer transition-all glass-effect-button
                          ${isActive ? 'glass-active' : ''}
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
                              className="transition-colors glass-button"
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
                              <h4 className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>
                                {effectConfig?.label || 'Unknown Effect'}
                              </h4>
                              <p
                                className={`text-[11px] ${isActive ? 'text-white/80' : 'text-gray-600'}`}
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
                      className="w-full mt-2 px-3 py-2 text-xs font-medium text-red-600 rounded-xl glass-button"
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
              className="p-4 space-y-4"
            >
              <div className="space-y-1.5">
                {exportOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.format}
                      onClick={() => onExport?.(option.format)}
                      className="w-full p-2 rounded-xl transition-all text-left group glass-effect-button"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded flex items-center justify-center mr-3 liquid-material">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium">{option.type}</div>
                          <div className="text-[10px] text-gray-600">{option.description}</div>
                        </div>
                        <div className="text-[10px] font-medium px-2 py-0.5 rounded ml-3 glass-badge">
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
