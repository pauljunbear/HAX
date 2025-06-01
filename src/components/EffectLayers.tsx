'use client';

import React from 'react';
import { effectsConfig } from '@/lib/effects';

export interface EffectLayer {
  id: string;
  effectId: string;
  settings: Record<string, number>;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

interface EffectLayersProps {
  layers: EffectLayer[];
  activeLayerId: string | null;
  onAddLayer: (effectId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<EffectLayer>) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onSetActiveLayer: (layerId: string) => void;
}

const EffectLayers: React.FC<EffectLayersProps> = ({
  layers,
  activeLayerId,
  onAddLayer,
  onRemoveLayer,
  onUpdateLayer,
  onReorderLayers,
  onSetActiveLayer,
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderLayers(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="border-t border-dark-border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-text flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Effect Stack
          </h3>
          <span className="text-xs text-dark-textMuted">
            {layers.length} effect{layers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {layers.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-dark-textMuted mb-2">No effects applied</p>
            <p className="text-[10px] text-dark-textMuted">
              Add effects from the panel above
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {layers.map((layer, index) => {
              const effect = effectsConfig[layer.effectId];
              if (!effect) return null;

              return (
                <div
                  key={layer.id}
                  draggable={!layer.locked}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => onSetActiveLayer(layer.id)}
                  className={`
                    group relative p-2 rounded-md border transition-all cursor-pointer
                    ${activeLayerId === layer.id 
                      ? 'bg-primary-accent/10 border-primary-accent/30' 
                      : 'bg-dark-bg border-dark-border hover:bg-dark-surface'
                    }
                    ${!layer.visible ? 'opacity-50' : ''}
                    ${draggedIndex === index ? 'opacity-30' : ''}
                  `}
                >
                  <div className="flex items-center">
                    {/* Drag Handle */}
                    <div className="mr-2 text-dark-textMuted opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {/* Visibility Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateLayer(layer.id, { visible: !layer.visible });
                      }}
                      className="mr-2 text-dark-textMuted hover:text-dark-text transition-colors"
                    >
                      {layer.visible ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>

                    {/* Effect Name */}
                    <div className="flex-1">
                      <div className="text-xs font-medium text-dark-text">
                        {effect.label}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div className="flex items-center mr-2">
                      <span className="text-[10px] text-dark-textMuted mr-1">
                        {Math.round(layer.opacity * 100)}%
                      </span>
                    </div>

                    {/* Lock Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateLayer(layer.id, { locked: !layer.locked });
                      }}
                      className="mr-2 text-dark-textMuted hover:text-dark-text transition-colors"
                    >
                      {layer.locked ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLayer(layer.id);
                      }}
                      className="text-dark-textMuted hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Opacity Slider (shown when active) */}
                  {activeLayerId === layer.id && (
                    <div className="mt-2 px-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layer.opacity * 100}
                        onChange={(e) => onUpdateLayer(layer.id, { opacity: parseFloat(e.target.value) / 100 })}
                        className="w-full h-0.5 bg-dark-border rounded-full appearance-none cursor-pointer
                                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 
                                 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-primary-accent 
                                 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Layer Hint */}
        {layers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-border">
            <p className="text-[10px] text-dark-textMuted text-center">
              Click an effect above to add it as a layer
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EffectLayers; 