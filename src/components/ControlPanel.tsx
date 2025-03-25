'use client';

import React, { useState } from 'react';
import { effectsConfig } from '@/lib/effects';

interface ControlPanelProps {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  hasImage?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffect,
  effectSettings = {},
  onEffectChange,
  onSettingChange,
  hasImage = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>('Basic');
  
  // Get unique categories from effects
  const categories = [...new Set(
    Object.values(effectsConfig).map(effect => effect.category)
  )];
  
  // Get effects for the active category
  const categoryEffects = Object.entries(effectsConfig)
    .filter(([_, effect]) => effect.category === activeCategory)
    .map(([key, effect]) => ({
      id: key,
      label: effect.label,
    }));
  
  // Get settings for the active effect
  const currentEffectSettings = activeEffect && effectsConfig[activeEffect]?.settings
    ? Object.entries(effectsConfig[activeEffect].settings).map(([key, setting]) => ({
        id: key,
        ...(setting as any),
        currentValue: effectSettings[key] !== undefined 
          ? effectSettings[key] 
          : (setting as any).default,
      }))
    : [];
  
  if (!hasImage) {
    return (
      <div className="controls-panel h-full">
        <h2 className="text-xl font-bold mb-4">Effects Panel</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Upload an image to access editing controls
        </p>
      </div>
    );
  }
  
  return (
    <div className="controls-panel h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Effects</h2>
      
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              activeCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      
      {/* Effect buttons */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {categoryEffects.map(effect => (
          <button
            key={effect.id}
            onClick={() => onEffectChange?.(effect.id)}
            className={`px-3 py-2 text-sm rounded-md ${
              activeEffect === effect.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {effect.label}
          </button>
        ))}
      </div>
      
      {/* Settings sliders */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Settings</h3>
          {currentEffectSettings.map(setting => (
            <div key={setting.id} className="mb-4">
              <div className="flex justify-between mb-1">
                <label className="text-sm">{setting.label}</label>
                <span className="text-sm font-mono">{setting.currentValue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={setting.min}
                max={setting.max}
                step={setting.step}
                value={setting.currentValue}
                onChange={e => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                className="slider-control"
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Reset button */}
      {activeEffect && (
        <button
          onClick={() => onEffectChange?.(activeEffect)}
          className="mt-2 w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md"
        >
          Reset Settings
        </button>
      )}
    </div>
  );
};

export default ControlPanel; 