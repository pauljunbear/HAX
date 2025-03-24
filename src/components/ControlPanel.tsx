'use client';

import React from 'react';

interface ControlPanelProps {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  hasImage?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeEffect,
  effectSettings,
  onEffectChange,
  onSettingChange,
  hasImage,
}) => {
  return (
    <div className="controls-panel h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Effects Panel</h2>
      <p>Coming soon!</p>
    </div>
  );
};

export default ControlPanel; 