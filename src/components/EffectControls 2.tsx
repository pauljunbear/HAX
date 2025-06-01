'use client';

import React, { useState, useEffect } from 'react';
import { effectsConfig } from '@/lib/effects';

interface EffectControlsProps {
  activeEffect: string | null;
  effectSettings: Record<string, number>;
  onSettingsChange: (settings: Record<string, number>) => void;
}

const EffectControls: React.FC<EffectControlsProps> = ({
  activeEffect,
  effectSettings,
  onSettingsChange,
}) => {
  const [localSettings, setLocalSettings] = useState<Record<string, number>>({});
  const [isChanging, setIsChanging] = useState(false);
  
  // Initialize local settings when active effect changes
  useEffect(() => {
    if (activeEffect && effectsConfig[activeEffect]?.settings) {
      // Start with current settings or defaults
      const initialSettings: Record<string, number> = {};
      
      // Get all settings for the effect
      Object.entries(effectsConfig[activeEffect].settings || {}).forEach(([key, setting]) => {
        // Use current setting if available, otherwise use default
        initialSettings[key] = effectSettings[key] !== undefined 
          ? effectSettings[key] 
          : setting.default;
      });
      
      setLocalSettings(initialSettings);
    } else {
      setLocalSettings({});
    }
  }, [activeEffect, effectSettings]);
  
  // Handle slider change
  const handleSettingChange = (key: string, value: number) => {
    // Show the changing indicator
    setIsChanging(true);
    
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    
    // Update parent component with new settings
    onSettingsChange(newSettings);
    
    // Hide the indicator after a short delay
    setTimeout(() => {
      setIsChanging(false);
    }, 300);
  };
  
  if (!activeEffect || !effectsConfig[activeEffect]) {
    return null;
  }
  
  const effectConfig = effectsConfig[activeEffect];
  
  return (
    <div className="w-full p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-[rgb(var(--apple-gray-200))]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-[rgb(var(--apple-gray-700))]">
          {effectConfig.label} Settings
        </h3>
        
        {/* Live update indicator */}
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-1.5 ${isChanging ? 'bg-[rgb(var(--apple-green-500))]' : 'bg-[rgb(var(--apple-gray-400))]'}`}></div>
          <span className="text-xs text-[rgb(var(--apple-gray-500))]">Live Preview</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {Object.entries(effectConfig.settings || {}).map(([key, setting]) => (
          <div key={key} className="w-full">
            <div className="flex justify-between mb-1">
              <label className="text-xs text-[rgb(var(--apple-gray-600))]">
                {setting.label}
              </label>
              <span className="text-xs text-[rgb(var(--apple-gray-600))]">
                {Math.round(localSettings[key] * 100) / 100}
              </span>
            </div>
            
            <input
              type="range"
              min={setting.min}
              max={setting.max}
              step={setting.step}
              value={localSettings[key] || setting.default}
              onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
              className="w-full h-2 bg-[rgb(var(--apple-gray-200))] rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EffectControls; 