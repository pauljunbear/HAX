'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';

interface AppleControlsPanelProps {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onSettingChange?: (settingName: string, value: number) => void;
  onExport?: (format: string) => void;
  onResetSettings?: () => void;
  onClearAllEffects?: () => void;
  onRemoveEffect?: () => void;
  hasImage?: boolean;
}

const AppleControlsPanel: React.FC<AppleControlsPanelProps> = ({
  activeEffect,
  effectSettings = {},
  onSettingChange,
  onExport,
  onResetSettings,
  onClearAllEffects,
  onRemoveEffect,
  hasImage = false
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'layers' | 'export' | 'history'>('settings');

  const currentEffectConfig = activeEffect ? effectsConfig[activeEffect] : null;
  const currentEffectSettings = currentEffectConfig?.settings ? 
    Object.entries(currentEffectConfig.settings).map(([key, setting]) => ({
      id: key,
      ...setting,
      currentValue: effectSettings[key] ?? setting.default
    })) : [];

  const tabs = [
    { id: 'settings', label: 'Settings', icon: '⚙️', disabled: !activeEffect },
    { id: 'layers', label: 'Layers', icon: '📚', disabled: false },
    { id: 'export', label: 'Export', icon: '📤', disabled: !hasImage },
    { id: 'history', label: 'History', icon: '↩️', disabled: false }
  ] as const;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Tab Navigation */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex-1 px-4 py-3 text-xs font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400'
                  : tab.disabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex flex-col items-center space-y-1">
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
              
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                />
              )}
            </button>
          ))}
        </div>
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
              className="p-6"
            >
              {!activeEffect ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">⚙️</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Effect Selected
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose an effect to adjust its settings
                  </p>
                </div>
              ) : currentEffectSettings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl text-blue-600 dark:text-blue-400">✨</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {currentEffectConfig?.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This effect has no adjustable settings
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {currentEffectConfig?.label}
                    </h3>
                    <button
                      onClick={onResetSettings}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      Reset
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {currentEffectSettings.map(setting => (
                      <div key={setting.id}>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-900 dark:text-white">
                            {setting.label}
                          </label>
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {setting.currentValue}
                          </span>
                        </div>
                        
                        <div className="relative">
                          <input
                            type="range"
                            min={setting.min}
                            max={setting.max}
                            step={setting.step}
                            value={setting.currentValue}
                            onChange={(e) => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                          />
                          
                          {/* Range markers */}
                          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                            <span>{setting.min}</span>
                            <span>{setting.max}</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Effect Stack
                </h3>
                <button 
                  onClick={onClearAllEffects}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Clear All
                </button>
              </div>
              
              <div className="space-y-3">
                {activeEffect ? (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 text-xs">✨</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {currentEffectConfig?.label}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {currentEffectConfig?.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                          <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button 
                          onClick={onRemoveEffect}
                          className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <svg className="w-3 h-3 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                      <span className="text-2xl">📚</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Effects Applied
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
              className="p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Export Options
              </h3>
              
              {!hasImage ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">📤</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Image to Export
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload an image to enable export options
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick Export Buttons */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => onExport?.('png')}
                      className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors border border-blue-200 dark:border-blue-800"
                    >
                      <div className="text-center">
                        <div className="w-8 h-8 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold">PNG</span>
                        </div>
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          High Quality
                        </h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Best for editing
                        </p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => onExport?.('jpeg')}
                      className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-xl transition-colors border border-green-200 dark:border-green-800"
                    >
                      <div className="text-center">
                        <div className="w-8 h-8 mx-auto mb-2 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 text-sm font-semibold">JPG</span>
                        </div>
                        <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                          Smaller Size
                        </h4>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Best for sharing
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Animated Export */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Animated Export
                    </h4>
                    <div className="space-y-2">
                      {[
                        { format: 'gif', label: 'GIF', description: 'Universal animated format', color: 'purple' },
                        { format: 'webm', label: 'WebM', description: 'High quality video', color: 'orange' }
                      ].map((option) => (
                        <button
                          key={option.format}
                          onClick={() => onExport?.(option.format)}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold ${
                                option.color === 'purple' 
                                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                                  : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                              }`}>
                                {option.format.toUpperCase()}
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                  {option.label}
                                </h5>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                            </svg>
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
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  History
                </h3>
                <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                  Clear
                </button>
              </div>
              
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">↩️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No History Yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your editing history will appear here
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