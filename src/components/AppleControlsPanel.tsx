'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
import {
  Settings,
  Download,
  Layers,
  FileImage,
  Film,
  Monitor,
  X,
  ChevronRight,
} from 'lucide-react';

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
  effectLayers = [],
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

  // Get the active layer with null checking
  const activeLayer = effectLayers?.find(layer => layer.id === activeEffect);
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
    return null; // Panel is hidden when collapsed
  }

  return (
    <div className="h-full w-full flex flex-col glass-material">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 glass-header">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider">Controls</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 px-4 py-2 mb-4">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'settings' | 'layers' | 'export' | 'history')}
              className={`
                px-4 py-2 text-sm font-medium transition-all rounded-lg
                ${
                  activeTab === tab.id
                    ? 'glass-active text-white shadow-sm'
                    : 'glass-button text-white/80 hover:text-white'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - with scroll edge effects */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden glass-scroll px-4 pb-4">
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
                <div className="text-center text-xs opacity-70 py-12">
                  Effect controls will appear here when an effect is selected
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Effect Header */}
                  <div className="p-4 bg-black/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{activeEffectConfig?.label}</h3>
                        <p className="text-[11px] opacity-60 mt-0.5">
                          {activeEffectConfig?.category}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onResetSettings?.()}
                          className="px-3 py-1.5 text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white rounded transition-all"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => onRemoveEffect?.(activeLayer.id)}
                          className="px-3 py-1.5 text-[11px] font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all"
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
                        <div key={setting.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium">{setting.label}</label>
                            <span className="text-[11px] font-mono bg-black/5 px-2 py-0.5 rounded">
                              {setting.currentValue.toFixed(2)}
                            </span>
                          </div>

                          <div className="relative">
                            <input
                              type="range"
                              min={setting.min}
                              max={setting.max}
                              step={setting.step}
                              value={setting.currentValue}
                              onChange={e =>
                                onSettingChange?.(setting.id, parseFloat(e.target.value))
                              }
                              className="w-full h-5 bg-transparent cursor-pointer appearance-none slider"
                              style={{
                                background: `linear-gradient(to right, #007aff 0%, #007aff ${((setting.currentValue - setting.min) / (setting.max - setting.min)) * 100}%, rgba(0,0,0,0.1) ${((setting.currentValue - setting.min) / (setting.max - setting.min)) * 100}%, rgba(0,0,0,0.1) 100%)`,
                              }}
                            />

                            {/* Range markers */}
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] opacity-50 font-mono">{setting.min}</span>
                              <span className="text-[9px] opacity-50 font-mono">{setting.max}</span>
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
              <div className="text-center text-gray-500 text-sm py-12">
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
              <div className="space-y-1.5">
                {exportOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.format}
                      onClick={() => onExport?.(option.format)}
                      className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded transition-all text-left group"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center mr-3">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium">{option.type}</div>
                          <div className="text-[10px] opacity-70">{option.description}</div>
                        </div>
                        <div className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded ml-3">
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
