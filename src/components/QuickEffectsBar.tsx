'use client';

import React from 'react';
import { effectsConfig } from '@/lib/effects';

interface QuickEffectsBarProps {
  activeEffect?: string | null;
  onEffectChange?: (effectName: string | null) => void;
  hasImage?: boolean;
}

// Quick access effects for the bar
const QUICK_EFFECTS = ['brightness', 'contrast', 'saturation', 'blur', 'sharpen'];

const QuickEffectsBar: React.FC<QuickEffectsBarProps> = ({
  activeEffect,
  onEffectChange,
  hasImage = false,
}) => {
  if (!hasImage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20
                    bg-dark-surface/95 backdrop-blur-md border border-dark-border
                    rounded-full shadow-2xl px-4 py-2 flex items-center gap-2">
      <span className="text-[10px] text-dark-textMuted uppercase tracking-wide mr-2">
        Quick Effects
      </span>
      
      {QUICK_EFFECTS.map(effectId => {
        const effect = effectsConfig[effectId];
        if (!effect) return null;
        
        return (
          <button
            key={effectId}
            onClick={() => onEffectChange?.(effectId === activeEffect ? null : effectId)}
            className={`px-3 py-1.5 text-xs rounded-full transition-all ${
              activeEffect === effectId
                ? 'bg-primary-accent text-white'
                : 'bg-dark-bg/50 text-dark-textMuted hover:text-dark-text hover:bg-dark-bg'
            }`}
            title={effect.label}
          >
            {effect.label}
          </button>
        );
      })}
      
      <div className="w-px h-6 bg-dark-border mx-1" />
      
      <button
        onClick={() => onEffectChange?.(null)}
        className="px-3 py-1.5 text-xs rounded-full bg-dark-bg/50 text-dark-textMuted 
                   hover:text-apple-red hover:bg-dark-bg transition-all"
        title="Clear all effects"
      >
        Clear
      </button>
    </div>
  );
};

export default QuickEffectsBar; 