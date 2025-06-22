'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
import { Settings, Download, Layers, FileImage, FileText, Film, Monitor } from 'lucide-react';

interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  visible: boolean;
}

interface AppleControlsPanelProps {
  activeEffect?: string | null;
  effectLayers: EffectLayer[];
  effectSettings?: Record<string, number>;
  onSettingChange?: (settingName: string, value: number) => void;
  onExport?: (format: string) => void;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: (layerId: string) => void;
  onSetActiveLayer?: (layerId: string) => void;
  onToggleLayerVisibility?: (layerId: string) => void;
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
    <div className="p-3 border border-white/20">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-white font-mono uppercase tracking-wide">
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
          className="flex-1 px-3 py-1.5 text-sm border border-white/20 bg-black/50 text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors font-mono"
        />
      </div>

      <div className="mt-2 text-xs text-white/50 font-mono">Click color box or enter hex code</div>
    </div>
  );
};

const AppleControlsPanel: React.FC<AppleControlsPanelProps> = ({
  activeEffect,
  effectLayers,
  effectSettings = {},
  onSettingChange,
  onExport,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  onSetActiveLayer,
  onToggleLayerVisibility,
  hasImage = false,
  isCollapsed,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'layers' | 'export' | 'history'>(
    'settings'
  );

  // Get the active layer
  const activeLayer = effectLayers.find(layer => layer.id === activeEffect);
  const activeEffectConfig = activeLayer ? effectsConfig[activeLayer.effectId] : null;

  // Get current effect settings with proper fallbacks
  const currentEffectSettings =
    activeEffectConfig?.settings?.map(setting => ({
      ...setting,
      currentValue: effectSettings[setting.id] ?? setting.defaultValue,
    })) || [];

  const tabs = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'export', label: 'Export', icon: Download },
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
    return (
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 48 }}
        transition={{ duration: 0.3 }}
        className="h-full flex flex-col items-center py-4 glass-panel border-l"
      >
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4 text-white/70" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ width: 48 }}
      animate={{ width: 320 }}
      transition={{ duration: 0.3 }}
      className="h-full glass-panel border-l flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white/90">Controls</h2>
        <button
          onClick={onToggle}
          className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
        >
          <Settings className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 text-xs font-medium transition-colors relative ${
                activeTab === tab.id ? 'text-green-400' : 'text-white/60 hover:text-white/80'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </div>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-4"
            >
              {!activeLayer ? (
                <div className="text-center text-white/50 text-sm py-8">
                  Effect controls will appear here when an effect is selected
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Effect Header */}
                  <div className="p-3 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wide">
                          {activeEffectConfig?.label}
                        </h3>
                        <p className="text-xs text-white/70 font-mono">
                          {activeEffectConfig?.category}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={onResetSettings}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 hover:text-green-300 border border-green-400/30 transition-all duration-200 font-mono uppercase tracking-wide"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => activeLayer && onRemoveEffect?.(activeLayer.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 hover:text-red-300 border border-red-400/30 transition-all duration-200 font-mono uppercase tracking-wide"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Settings Controls */}
                  <div className="space-y-4">
                    {currentEffectSettings.map(setting => {
                      // Check if this is a color setting (hex color)
                      const isColorSetting =
                        setting.label.toLowerCase().includes('color') &&
                        setting.label.toLowerCase().includes('hex');

                      if (isColorSetting) {
                        return (
                          <HexColorInput
                            key={setting.id}
                            label={setting.label}
                            value={setting.currentValue}
                            onChange={value => onSettingChange?.(setting.id, value)}
                          />
                        );
                      }

                      // Regular slider for non-color settings
                      return (
                        <div key={setting.id} className="p-3 border border-white/20">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-white font-mono uppercase tracking-wide">
                              {setting.label}
                            </label>
                            <span className="text-xs text-green-400 font-mono bg-black/50 px-2 py-0.5 border border-green-400/30">
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
                              className="w-full"
                            />

                            {/* Range markers */}
                            <div className="flex justify-between text-xs text-white/50 font-mono">
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
              className="p-4 space-y-4"
            >
              <div className="text-center text-white/50 text-sm py-8">
                Layer controls coming soon
              </div>
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
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white/90 uppercase tracking-wide">
                  EXPORT OPTIONS
                </h3>

                {exportOptions.slice(0, 2).map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.format}
                      className="w-full p-3 bg-black/60 hover:bg-black/80 rounded-lg transition-colors text-left group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                          <Icon className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{option.type}</div>
                          <div className="text-xs text-white/70">{option.description}</div>
                        </div>
                        <div className="text-xs font-mono text-green-400 bg-green-400/20 px-2 py-1 rounded">
                          {option.format}
                        </div>
                      </div>
                    </button>
                  );
                })}

                <div className="pt-4">
                  <h3 className="text-sm font-medium text-white/90 uppercase tracking-wide mb-3">
                    ANIMATED EXPORT
                  </h3>

                  {exportOptions.slice(2).map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.format}
                        className="w-full p-3 bg-black/60 hover:bg-black/80 rounded-lg transition-colors text-left group mb-3"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                            <Icon className="w-4 h-4 text-white/70" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{option.type}</div>
                            <div className="text-xs text-white/70">{option.description}</div>
                          </div>
                          <div className="text-xs font-mono text-green-400 bg-green-400/20 px-2 py-1 rounded">
                            {option.format}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AppleControlsPanel;
