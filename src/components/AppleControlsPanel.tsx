'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';

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
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'layers', label: 'Layers', icon: '📚' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'history', label: 'History', icon: '🕐' },
  ];

  return (
    <div className="w-80 h-full flex flex-col">
      {/* Theme Toggle Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider font-mono">
          Controls
        </h2>
      </div>

      {/* Compact Tab Navigation */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 font-mono uppercase tracking-wide ${
              activeTab === tab.id
                ? 'text-green-400 bg-green-400/10 border-b-2 border-green-400'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex flex-col items-center space-y-1">
              <span className="text-xs">{tab.label}</span>
            </div>
          </button>
        ))}
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
              className="p-4"
            >
              {!activeLayer ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-black border border-green-400/30 flex items-center justify-center">
                    <span className="text-lg text-green-400">⚙</span>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 font-mono uppercase tracking-wide">
                    No Effect Selected
                  </h3>
                  <p className="text-xs text-white/70 font-mono">
                    Select an effect to adjust settings
                  </p>
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
              className="p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wide">
                  Effect Stack
                </h3>
                <button
                  onClick={onClearAllEffects}
                  disabled={effectLayers.length === 0}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 hover:text-green-300 border border-green-400/30 transition-all duration-200 disabled:bg-black/20 disabled:text-white/30 disabled:border-white/10 disabled:cursor-not-allowed font-mono uppercase tracking-wide"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-2">
                {effectLayers.length > 0 ? (
                  effectLayers.map(layer => {
                    const layerEffectConfig = effectsConfig[layer.effectId];
                    return (
                      <div
                        key={layer.id}
                        onClick={() => onSetActiveLayer?.(layer.id)}
                        className={`p-3 cursor-pointer transition-all duration-200 border ${
                          activeEffect === layer.id
                            ? 'bg-green-600/20 border-green-400/60'
                            : 'bg-black/60 border-white/20 hover:bg-green-600/10 hover:border-green-400/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div>
                              <h4 className="text-sm font-medium text-white font-mono uppercase tracking-wide">
                                {layerEffectConfig?.label}
                              </h4>
                              <p className="text-xs text-white/70 font-mono">
                                {layerEffectConfig?.category}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onToggleLayerVisibility?.(layer.id);
                              }}
                              className="w-5 h-5 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                              <svg
                                className={`w-3 h-3 ${layer.visible ? 'text-green-400' : 'text-white/40'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                {layer.visible ? (
                                  <>
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
                                  </>
                                ) : (
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .946-3.11 3.586-5.442 6.834-6.175m5.444-1.122a.75.75 0 01.133.417v.465a.75.75 0 01-.416.685c-1.33.56-2.535 1.34-3.566 2.37A9.97 9.97 0 0012 15a9.97 9.97 0 00-2.37-3.566c-1.03-1.03-2.235-1.81-3.565-2.37a.75.75 0 01-.416-.684V6.417a.75.75 0 01.133-.417L4.175 4.175m15.65 15.65l-1.06-1.06M4.175 4.175L3.115 3.115"
                                  />
                                )}
                              </svg>
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveEffect?.(layer.id);
                              }}
                              className="w-5 h-5 flex items-center justify-center hover:bg-red-600/20 transition-colors"
                            >
                              <svg
                                className="w-3 h-3 text-white/70 hover:text-red-400 transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-black border border-green-400/30 flex items-center justify-center">
                      <span className="text-lg text-green-400">📚</span>
                    </div>
                    <h3 className="text-sm font-medium text-white mb-1 font-mono uppercase tracking-wide">
                      No Effects Applied
                    </h3>
                    <p className="text-xs text-white/70 font-mono">
                      Effects will appear here as you apply them
                    </p>
                  </div>
                )}
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
              className="p-4"
            >
              <h3 className="text-sm font-semibold text-white mb-4 font-mono uppercase tracking-wide">
                Export Options
              </h3>

              {!hasImage ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-black border border-green-400/30 flex items-center justify-center">
                    <span className="text-lg text-green-400">📤</span>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 font-mono uppercase tracking-wide">
                    No Image to Export
                  </h3>
                  <p className="text-xs text-white/70 font-mono">
                    Upload an image to enable export options
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick Export Buttons */}
                  <div className="space-y-2 mb-4">
                    <button
                      onClick={() => {
                        console.log('🖱️ PNG button clicked in AppleControlsPanel');
                        console.log('🖱️ onExport function exists:', !!onExport);
                        onExport?.('png');
                      }}
                      className="w-full p-3 bg-black/60 border border-white/20 hover:bg-green-600/10 hover:border-green-400/40 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-blue-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="text-left">
                            <h4 className="text-sm font-medium text-white font-mono uppercase tracking-wide">
                              PNG Export
                            </h4>
                            <p className="text-xs text-white/70 font-mono">
                              High quality, lossless
                            </p>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2 py-1 font-mono">
                          PNG
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        console.log('🖱️ JPEG button clicked in AppleControlsPanel');
                        console.log('🖱️ onExport function exists:', !!onExport);
                        onExport?.('jpeg');
                      }}
                      className="w-full p-3 bg-black/60 border border-white/20 hover:bg-green-600/10 hover:border-green-400/40 transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500/20 border border-green-400/30 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="text-left">
                            <h4 className="text-sm font-medium text-white font-mono uppercase tracking-wide">
                              JPEG Export
                            </h4>
                            <p className="text-xs text-white/70 font-mono">
                              High quality, web-optimized
                            </p>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-1 font-mono">
                          JPG
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Animated Export */}
                  <div className="border-t border-white/20 pt-3">
                    <h4 className="text-sm font-medium text-white mb-3 font-mono uppercase tracking-wide">
                      Animated Export
                    </h4>
                    <div className="space-y-2">
                      {[
                        {
                          format: 'gif',
                          label: 'GIF Export',
                          description: 'Universal animated format',
                          iconColor: 'text-purple-400',
                          bgColor: 'bg-purple-500/20',
                          borderColor: 'border-purple-400/30',
                          badgeBgColor: 'bg-purple-400/10',
                          badgeTextColor: 'text-purple-400',
                          badgeBorderColor: 'border-purple-400/30',
                        },
                        {
                          format: 'webm',
                          label: 'WebM Export',
                          description: 'High quality video',
                          iconColor: 'text-orange-400',
                          bgColor: 'bg-orange-500/20',
                          borderColor: 'border-orange-400/30',
                          badgeBgColor: 'bg-orange-400/10',
                          badgeTextColor: 'text-orange-400',
                          badgeBorderColor: 'border-orange-400/30',
                        },
                      ].map(option => (
                        <button
                          key={option.format}
                          onClick={() => onExport?.(option.format)}
                          className="w-full p-3 bg-black/60 border border-white/20 hover:bg-green-600/10 hover:border-green-400/40 transition-all duration-200 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 ${option.bgColor} ${option.borderColor} border flex items-center justify-center`}
                              >
                                <svg
                                  className={`w-4 h-4 ${option.iconColor}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-7 4h12a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                              <div className="text-left">
                                <h4 className="text-sm font-medium text-white font-mono uppercase tracking-wide">
                                  {option.label}
                                </h4>
                                <p className="text-xs text-white/70 font-mono">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`text-xs font-semibold ${option.badgeTextColor} ${option.badgeBgColor} ${option.badgeBorderColor} border px-2 py-1 font-mono`}
                            >
                              {option.format.toUpperCase()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <h3 className="text-sm font-semibold text-white mb-4 font-mono uppercase tracking-wide">
                Edit History
              </h3>

              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 bg-black border border-green-400/30 flex items-center justify-center">
                  <span className="text-lg text-green-400">🕐</span>
                </div>
                <h3 className="text-sm font-medium text-white mb-1 font-mono uppercase tracking-wide">
                  History Coming Soon
                </h3>
                <p className="text-xs text-white/70 font-mono">
                  Undo/redo functionality will be available here
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AppleControlsPanel;
