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
  
  // Get unique categories from effects without using Set
  const allCategories = Object.values(effectsConfig).map(effect => effect.category);
  const categories = allCategories.filter((category, index) => {
    return allCategories.indexOf(category) === index;
  });
  
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
      <div className="p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 mb-5 rounded-full bg-gray-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-800 mb-2">No Image Selected</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload an image to start applying effects and filters
        </p>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Effects</h2>
        
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeCategory === category
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Effect buttons */}
        <div className="grid grid-cols-2 gap-2">
          {categoryEffects.map(effect => (
            <button
              key={effect.id}
              onClick={() => onEffectChange?.(effect.id)}
              className={`px-4 py-2.5 text-sm rounded-md transition-all ${
                activeEffect === effect.id
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Settings sliders */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Adjust Settings</h3>
          {currentEffectSettings.map(setting => (
            <div key={setting.id} className="mb-5">
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-gray-600 font-medium">{setting.label}</label>
                <span className="text-xs text-gray-500 font-mono">{setting.currentValue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={setting.min}
                max={setting.max}
                step={setting.step}
                value={setting.currentValue}
                onChange={e => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Reset button */}
      {activeEffect && (
        <div className="p-5">
          <button
            onClick={() => {
              console.log("Resetting effect:", activeEffect);
              // Reset the settings to defaults before triggering effect change
              const defaultSettings: Record<string, number> = {};
              if (effectsConfig[activeEffect]?.settings) {
                Object.entries(effectsConfig[activeEffect].settings).forEach(([key, setting]) => {
                  defaultSettings[key] = (setting as any).default;
                });
              }
              
              // First reset settings to default values
              Object.entries(defaultSettings).forEach(([key, value]) => {
                onSettingChange?.(key, value);
              });
              
              // Then re-apply the effect with default settings
              setTimeout(() => {
                onEffectChange?.(activeEffect);
              }, 50);
            }}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
          >
            Reset Settings
          </button>
          
          <button
            onClick={() => {
              console.log("Clearing effect completely");
              onEffectChange?.(null);
            }}
            className="w-full mt-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
          >
            Clear Effect
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlPanel; 