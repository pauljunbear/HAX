'use client';

import React, { useState } from 'react';
import { effectsConfig } from '@/lib/effects';

interface ControlPanelProps {
  activeEffect: string | null;
  effectSettings: Record<string, number>;
  onEffectChange: (effectName: string) => void;
  onSettingChange: (settingName: string, value: number) => void;
  hasImage: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffect,
  effectSettings,
  onEffectChange,
  onSettingChange,
  hasImage,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>('Basic');
  
  // Group effects by category
  const effectsByCategory = Object.entries(effectsConfig).reduce(
    (acc, [effectName, config]) => {
      const category = config.category || 'Basic';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ name: effectName, ...config });
      return acc;
    },
    {} as Record<string, Array<{ name: string; [key: string]: any }>>
  );
  
  // Get all categories
  const categories = Object.keys(effectsByCategory);

  // Handle tab click
  const handleTabClick = (category: string) => {
    setActiveCategory(category);
  };

  return (
    <div className="controls-panel h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Effects</h2>
      
      {!hasImage && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded mb-4">
          <p className="text-sm">Upload an image to apply effects</p>
        </div>
      )}
      
      <div className={`space-y-6 ${!hasImage ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Category tabs */}
        <div className="flex overflow-x-auto space-x-1 pb-2 border-b border-gray-200 dark:border-gray-700">
          {categories.map((category) => (
            <button
              key={category}
              className={`px-3 py-2 text-sm whitespace-nowrap ${
                activeCategory === category
                  ? 'bg-primary text-white rounded-t'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded'
              }`}
              onClick={() => handleTabClick(category)}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Effects for active category */}
        {activeCategory && effectsByCategory[activeCategory] && (
          <div className="grid grid-cols-2 gap-2">
            {effectsByCategory[activeCategory].map((effect) => (
              <button
                key={effect.name}
                className={`p-2 rounded text-sm transition-colors ${
                  activeEffect === effect.name
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                onClick={() => onEffectChange(effect.name)}
              >
                {effect.label}
              </button>
            ))}
          </div>
        )}

        {/* Settings for active effect */}
        {activeEffect && effectsConfig[activeEffect]?.settings && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <div className="space-y-4">
              {Object.entries(effectsConfig[activeEffect].settings!).map(
                ([settingName, setting]) => (
                  <div key={settingName} className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-sm">{setting.label}</label>
                      <span className="text-sm">
                        {effectSettings[settingName] ?? setting.default}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                      value={effectSettings[settingName] ?? setting.default}
                      onChange={(e) =>
                        onSettingChange(settingName, parseFloat(e.target.value))
                      }
                      className="slider-control"
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}
        
        {/* Reset button */}
        {activeEffect && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              className="w-full py-2 text-sm text-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => onEffectChange(activeEffect)}
            >
              Reset Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel; 