'use client';

import React, { useState, useRef, useEffect } from 'react';
import { effectsConfig } from '@/lib/effects';

// Debounce helper function
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

interface ControlPanelProps {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
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
  const [localSliderValues, setLocalSliderValues] = useState<Record<string, number>>({});
  
  // Reset local slider values when active effect changes
  useEffect(() => {
    setLocalSliderValues({});
  }, [activeEffect]);
  
  // Get unique categories from effects
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
      hasSettings: !!effect.settings && Object.keys(effect.settings).length > 0,
    }));
  
  // Get settings for the active effect
  const currentEffectSettings = activeEffect && effectsConfig[activeEffect]?.settings
    ? Object.entries(effectsConfig[activeEffect].settings).map(([key, setting]) => ({
        id: key,
        ...(setting as any), // Cast to any to handle potential type issues for now
        currentValue: effectSettings && effectSettings[key] !== undefined 
          ? effectSettings[key] 
          : (setting as any).default,
      }))
    : [];
  
  // Handle slider change with debouncing for high-computation effects
  const handleSliderChange = (settingId: string, value: number) => {
    setLocalSliderValues(prev => ({
      ...prev,
      [settingId]: value
    }));
    
    // Apply immediately for most effects, except blur which is debounced
    if (activeEffect !== 'blur') {
      // Remove the special scaling for contrast
      // if (activeEffect === 'contrast' && settingId === 'value') {
      //   const scaledValue = value / 100;
      //   onSettingChange?.(settingId, scaledValue);
      // } else {
        onSettingChange?.(settingId, value);
      // }
    }
  };
  
  // Process debounced blur effect changes
  const debouncedBlurValue = useDebounce(
    activeEffect === 'blur' && localSliderValues.radius !== undefined ? localSliderValues.radius : null, 
    200
  );
  
  // Apply debounced blur effect
  useEffect(() => {
    if (activeEffect === 'blur' && debouncedBlurValue !== null && onSettingChange) {
      onSettingChange('radius', debouncedBlurValue);
    }
  }, [debouncedBlurValue, activeEffect, onSettingChange]);
  
  if (!hasImage) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-apple-gray-100 dark:bg-dark-surface flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-apple-gray-400 dark:text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-apple-gray-800 dark:text-dark-text mb-3">No Image Selected</h2>
        <p className="text-sm text-apple-gray-500 dark:text-dark-textMuted mb-6 max-w-xs">
          Upload an image to start applying effects and filters
        </p>
        <div className="w-10 h-10 border-2 border-apple-gray-200 dark:border-dark-border rounded-full flex items-center justify-center animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-apple-gray-400 dark:text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="py-4 px-5 border-b border-apple-gray-100 dark:border-dark-border">
        <h2 className="text-sm font-medium text-apple-gray-800 dark:text-dark-text mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary dark:text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Effects
        </h2>
        
        {/* Primary Category tabs - Use dark:bg-dark-border for background, dark:text-dark-textMuted for inactive, dark:bg-dark-surface dark:text-dark-text for active */}
        <div className="flex flex-wrap bg-apple-gray-100 dark:bg-dark-border p-0.5 rounded-lg mb-4">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                activeCategory === category
                  ? 'bg-white text-apple-gray-800 shadow-sm dark:bg-dark-surface dark:text-dark-text' 
                  : 'text-apple-gray-600 dark:text-dark-textMuted hover:text-apple-gray-800 dark:hover:text-dark-text'
              }`}
            >
              {category}
              {category === 'Artistic' && (
                <div className="w-1.5 h-1.5 bg-primary dark:bg-primary-accent rounded-full ml-1 inline-block"></div>
              )}
            </button>
          ))}
        </div>
        
        {/* Effect buttons - Update for dark mode */}
        <div className="grid grid-cols-2 gap-2">
          {categoryEffects.map(effect => (
            <button
              key={effect.id}
              onClick={() => onEffectChange?.(effect.id)}
              title={effect.label}
              className={`px-2 py-2 text-xs rounded-lg transition-all truncate text-center ${
                activeEffect === effect.id
                  ? 'bg-primary dark:bg-primary-accent text-white font-medium shadow-sm' // Active state
                  : 'bg-white dark:bg-dark-surface border border-apple-gray-200 dark:border-dark-border text-apple-gray-700 dark:text-dark-text hover:bg-apple-gray-50 dark:hover:bg-dark-border' // Inactive state
              }`}
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Settings sliders */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div className="py-4 px-5 border-b border-apple-gray-100 dark:border-dark-border">
          <h3 className="text-xs font-medium text-apple-gray-700 dark:text-dark-text mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-primary dark:text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Adjust Settings
          </h3>
          {currentEffectSettings.map(setting => {
            if (setting.type === 'color') {
              return (
                <div key={setting.id} className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700/50 rounded-md">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">Color settings for '{setting.label}' require a color picker UI (not implemented yet).</p>
                </div>
              );
            }

            const displayValue = (
              localSliderValues[setting.id] !== undefined ? 
              localSliderValues[setting.id] :
              setting.currentValue
            ) ?? setting.default;
              
            return (
              <div key={setting.id} className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs text-apple-gray-600 dark:text-dark-textMuted font-medium">{setting.label}</label>
                  <span className="text-xs text-apple-gray-500 dark:text-dark-textMuted font-mono bg-apple-gray-100 dark:bg-dark-border px-1.5 py-0.5 rounded-full">
                    {typeof displayValue === 'number' ? displayValue.toFixed(setting.step >= 0.1 ? 1 : 0) : 'N/A'}
                  </span>
                </div>
                {/* Style the slider track and thumb for dark mode - using accent color */}
                <input
                  type="range"
                  min={setting.min}
                  max={setting.max}
                  step={setting.step}
                  value={typeof displayValue === 'number' ? displayValue : setting.default}
                  onChange={e => handleSliderChange(setting.id, parseFloat(e.target.value))}
                  className={`w-full appearance-none cursor-pointer h-1.5 rounded-full bg-apple-gray-200 dark:bg-dark-border 
                             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-accent/50
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full 
                             [&::-webkit-slider-thumb]:bg-primary dark:[&::-webkit-slider-thumb]:bg-primary-accent
                             [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full 
                             [&::-moz-range-thumb]:bg-primary dark:[&::-moz-range-thumb]:bg-primary-accent 
                             [&::-moz-range-thumb]:border-none`}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {/* Action buttons - Update for dark mode */}
      {activeEffect && (
        <div className="py-4 px-5 space-y-3">
          <button
            onClick={() => {
              console.log("Resetting effect:", activeEffect);
              const defaultSettings: Record<string, number> = {};
              if (effectsConfig[activeEffect]?.settings) {
                Object.entries(effectsConfig[activeEffect].settings).forEach(([key, setting]) => {
                  defaultSettings[key] = (setting as any).default;
                });
              }
              setLocalSliderValues({});
              Object.entries(defaultSettings).forEach(([key, value]) => {
                onSettingChange?.(key, value);
              });
              setTimeout(() => {
                onEffectChange?.(activeEffect);
              }, 50);
            }}
            className="btn-apple-secondary dark:bg-dark-surface dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-border w-full py-1.5 text-xs flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Defaults
          </button>
          
          <button
            onClick={() => {
              console.log("Clearing effect completely");
              onEffectChange?.(null);
            }}
            className="btn-apple-ghost dark:text-dark-textMuted dark:hover:bg-dark-border dark:hover:text-dark-text w-full py-1.5 text-xs flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Remove Effect
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlPanel; 