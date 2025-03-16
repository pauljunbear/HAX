'use client';

import React from 'react';
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

  return (
    <div className="controls-panel h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Effects</h2>
      
      {!hasImage && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded mb-4">
          <p className="text-sm">Upload an image to apply effects</p>
        </div>
      )}
      
      <div className={`space-y-6 ${!hasImage ? 'opacity-50 pointer-events-none' : ''}`}>
        {Object.entries(effectsByCategory).map(([category, effects]) => (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold mb-2">{category}</h3>
            <div className="grid grid-cols-2 gap-2">
              {effects.map((effect) => (
                <button
                  key={effect.name}
                  className={`p-2 rounded text-sm ${
                    activeEffect === effect.name
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  onClick={() => onEffectChange(effect.name)}
                >
                  {effect.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {activeEffect && effectsConfig[activeEffect]?.settings && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <div className="space-y-4">
              {Object.entries(effectsConfig[activeEffect].settings).map(
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
      </div>
    </div>
  );
};

export default ControlPanel; 