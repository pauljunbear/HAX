'use client';

import React, { useState, useMemo } from 'react';
import { effectsConfig, effectCategories } from '@/lib/effects';

interface ControlPanelV2Props {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  hasImage?: boolean;
}

const ControlPanelV2: React.FC<ControlPanelV2Props> = ({
  activeEffect,
  effectSettings = {},
  onEffectChange,
  onSettingChange,
  hasImage = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('Adjust');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(true);

  // Filter effects based on search query
  const filteredEffects = useMemo(() => {
    if (!searchQuery) {
      return effectCategories[activeCategory]?.effects || [];
    }
    
    // Search across all categories
    const results: { id: string; category: string }[] = [];
    Object.entries(effectCategories).forEach(([category, data]) => {
      data.effects.forEach(effectId => {
        const effect = effectsConfig[effectId];
        if (effect && effect.label.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ id: effectId, category });
        }
      });
    });
    
    return results.map(r => r.id);
  }, [activeCategory, searchQuery]);

  // Get settings for the active effect
  const currentEffectSettings = activeEffect && effectsConfig[activeEffect]?.settings
    ? Object.entries(effectsConfig[activeEffect].settings).map(([key, setting]) => ({
        id: key,
        ...(setting as any),
        currentValue: effectSettings[key] ?? (setting as any).default,
      }))
    : [];

  if (!hasImage) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-dark-surface flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-dark-text mb-3">No Image Selected</h2>
        <p className="text-sm text-dark-textMuted mb-6 max-w-xs">
          Upload an image to start applying effects
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Effects Header */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-dark-text flex items-center">
            <span className="text-primary-accent mr-2">✨</span>
            Effects
          </h2>
          {activeEffect && (
            <button
              onClick={() => onEffectChange?.(null)}
              className="text-xs text-dark-textMuted hover:text-dark-text transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search effects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 pl-8 text-xs bg-dark-bg border border-dark-border rounded-md
                     text-dark-text placeholder-dark-textMuted focus:outline-none focus:ring-1 
                     focus:ring-primary-accent focus:border-primary-accent"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-2 text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex flex-col space-y-1">
            {Object.entries(effectCategories).map(([category, data]) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`flex items-center px-3 py-2 text-xs rounded-md transition-all ${
                  activeCategory === category
                    ? 'bg-primary-accent/10 text-primary-accent border border-primary-accent/20'
                    : 'text-dark-textMuted hover:text-dark-text hover:bg-dark-bg'
                }`}
              >
                <span className="mr-2">{data.icon}</span>
                <span className="font-medium">{category}</span>
                <span className="ml-auto text-[10px] opacity-60">
                  {data.effects.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Effects Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchQuery && filteredEffects.length === 0 ? (
          <p className="text-xs text-dark-textMuted text-center py-8">
            No effects found for "{searchQuery}"
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredEffects.map(effectId => {
              const effect = effectsConfig[effectId];
              if (!effect) return null;
              
              return (
                <button
                  key={effectId}
                  onClick={() => onEffectChange?.(effectId)}
                  className={`px-3 py-2.5 text-xs rounded-lg transition-all text-left ${
                    activeEffect === effectId
                      ? 'bg-primary-accent text-white shadow-sm'
                      : 'bg-dark-bg hover:bg-dark-surface text-dark-textMuted hover:text-dark-text border border-dark-border'
                  }`}
                >
                  <div className="font-medium truncate">{effect.label}</div>
                  {searchQuery && (
                    <div className="text-[10px] opacity-60 mt-0.5">
                      {Object.entries(effectCategories).find(([_, data]) => 
                        data.effects.includes(effectId)
                      )?.[0]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Effect Settings */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div className="border-t border-dark-border">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium
                     text-dark-text hover:bg-dark-bg transition-colors"
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Settings
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSettings && (
            <div className="p-4 space-y-3">
              {currentEffectSettings.map(setting => (
                <div key={setting.id}>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-dark-textMuted">{setting.label}</label>
                    <span className="text-xs text-dark-textMuted font-mono">
                      {setting.currentValue.toFixed(setting.step >= 0.1 ? 1 : 0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    value={setting.currentValue}
                    onChange={e => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-dark-border rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                             [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-accent 
                             [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ControlPanelV2; 