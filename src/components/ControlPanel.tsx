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
  
  // Handle slider change with debouncing for high-computation effects
  const handleSliderChange = (settingId: string, value: number) => {
    setLocalSliderValues(prev => ({
      ...prev,
      [settingId]: value
    }));
    
    // Apply immediately for most effects
    if (activeEffect !== 'blur') {
      // Special handling for contrast - scale the value for better UI experience
      if (activeEffect === 'contrast' && settingId === 'value') {
        // Transform contrast from UI range (-100 to 100) to effect range
        const scaledValue = value / 100;
        onSettingChange?.(settingId, scaledValue);
      } else {
        onSettingChange?.(settingId, value);
      }
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
        <div className="w-24 h-24 mb-6 rounded-full bg-[rgb(var(--apple-gray-100))] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[rgb(var(--apple-gray-400))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-[rgb(var(--apple-gray-800))] mb-3">No Image Selected</h2>
        <p className="text-sm text-[rgb(var(--apple-gray-500))] mb-6 max-w-xs">
          Upload an image to start applying effects and filters
        </p>
        <div className="w-10 h-10 border-2 border-[rgb(var(--apple-gray-200))] rounded-full flex items-center justify-center animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[rgb(var(--apple-gray-400))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="py-3 px-4 border-b border-[rgb(var(--apple-gray-100))]">
        <h2 className="text-sm font-medium text-[rgb(var(--apple-gray-800))] mb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Effects
        </h2>
        
        {/* Primary Category tabs */}
        <div className="flex flex-wrap bg-[rgb(var(--apple-gray-100))] p-0.5 rounded-lg mb-3">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                activeCategory === category
                  ? 'tab-apple-active'
                  : 'tab-apple-inactive'
              }`}
            >
              {category}
              {category === 'Artistic' && (
                <div className="w-1.5 h-1.5 bg-[rgb(var(--primary))] rounded-full ml-1 inline-block"></div>
              )}
            </button>
          ))}
        </div>
        
        {/* Effect buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          {categoryEffects.map(effect => (
            <button
              key={effect.id}
              onClick={() => onEffectChange?.(effect.id)}
              className={`px-2 py-2 text-xs rounded-lg transition-all ${
                activeEffect === effect.id
                  ? 'bg-[rgb(var(--primary))] text-white font-medium shadow-sm'
                  : 'bg-white border border-[rgb(var(--apple-gray-200))] text-[rgb(var(--apple-gray-700))] hover:bg-[rgb(var(--apple-gray-50))] hover:shadow-sm'
              }`}
            >
              {effect.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Settings sliders */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div className="py-3 px-4 border-b border-[rgb(var(--apple-gray-100))]">
          <h3 className="text-xs font-medium text-[rgb(var(--apple-gray-700))] mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Adjust Settings
          </h3>
          {currentEffectSettings.map(setting => {
            const displayValue = activeEffect === 'blur' && setting.id === 'radius' && localSliderValues.radius !== undefined 
              ? localSliderValues.radius 
              : setting.currentValue;
              
            return (
              <div key={setting.id} className="mb-3">
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-[rgb(var(--apple-gray-600))] font-medium">{setting.label}</label>
                  <span className="text-xs text-[rgb(var(--apple-gray-500))] font-mono bg-[rgb(var(--apple-gray-100))] px-1.5 py-0.5 rounded-full">
                    {displayValue.toFixed(1)}
                    {activeEffect === 'blur' && setting.id === 'radius' && (
                      localSliderValues.radius !== undefined && localSliderValues.radius !== setting.currentValue 
                        ? ' (adjusting...)'
                        : ''
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={setting.min}
                  max={setting.max}
                  step={setting.step}
                  value={displayValue}
                  onChange={e => handleSliderChange(setting.id, parseFloat(e.target.value))}
                  className={`w-full appearance-none cursor-pointer h-1.5 ${activeEffect === 'blur' ? 'accent-[rgb(var(--primary))]' : ''}`}
                />
                {activeEffect === 'blur' && setting.id === 'radius' && (
                  <div className="mt-0.5 text-[10px] text-[rgb(var(--apple-gray-500))]">
                    <span className="opacity-75">Adjustments applied after sliding</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Action buttons */}
      {activeEffect && (
        <div className="py-3 px-4 space-y-2">
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
              
              // Reset local slider values
              setLocalSliderValues({});
              
              // First reset settings to default values
              Object.entries(defaultSettings).forEach(([key, value]) => {
                onSettingChange?.(key, value);
              });
              
              // Then re-apply the effect with default settings
              setTimeout(() => {
                onEffectChange?.(activeEffect);
              }, 50);
            }}
            className="btn-apple-secondary w-full py-1.5 text-xs flex items-center justify-center"
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
            className="btn-apple-ghost w-full py-1.5 text-xs flex items-center justify-center"
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