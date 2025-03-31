'use client';

import React, { useState } from 'react';
import { Layer, BlendMode } from '@/hooks/useLayers';

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (layerId: string) => void;
  onMoveLayer: (layerId: string, newIndex: number) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  onToggleLock: (layerId: string) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onSetActiveLayer,
  onToggleVisibility,
  onRemoveLayer,
  onAddLayer,
  onDuplicateLayer,
  onMoveLayer,
  onUpdateLayer,
  onToggleLock
}) => {
  const [editLayerId, setEditLayerId] = useState<string | null>(null);
  const [layerName, setLayerName] = useState<string>('');
  const [layerOpacity, setLayerOpacity] = useState<number>(1);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  
  // Start editing a layer name
  const startEditingName = (layer: Layer) => {
    setEditLayerId(layer.id);
    setLayerName(layer.name);
  };
  
  // Handle saving a layer name
  const handleSaveName = () => {
    if (editLayerId && layerName.trim()) {
      onUpdateLayer(editLayerId, { name: layerName.trim() });
      setEditLayerId(null);
    }
  };
  
  // Handle opacity change
  const handleOpacityChange = (layerId: string, opacity: number) => {
    onUpdateLayer(layerId, { opacity });
  };
  
  // Handle blend mode change
  const handleBlendModeChange = (layerId: string, blendMode: BlendMode) => {
    onUpdateLayer(layerId, { blendMode });
  };
  
  // Handle drag start
  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.setData('text/plain', layerId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  // Handle drag over
  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLayerId(layerId);
  };
  
  // Handle drop
  const handleDrop = (e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    if (!draggedLayerId) return;
    
    // Find indices for reordering
    const layerIndex = layers.findIndex(l => l.id === draggedLayerId);
    const targetIndex = layers.findIndex(l => l.id === targetLayerId);
    
    // Move the layer
    if (layerIndex !== targetIndex) {
      onMoveLayer(draggedLayerId, targetIndex);
    }
    
    // Reset drag state
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  // Render blend mode options
  const blendModeOptions: BlendMode[] = [
    'normal', 'multiply', 'screen', 'overlay', 
    'darken', 'lighten', 'color-dodge', 'color-burn', 
    'difference', 'exclusion'
  ];
  
  return (
    <div className="p-6 border-b border-[rgb(var(--apple-gray-100))]">
      <h3 className="text-sm font-medium text-[rgb(var(--apple-gray-700))] mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Layers
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onAddLayer}
            title="Add Layer"
            className="w-6 h-6 rounded hover:bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-600))] flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={() => activeLayerId && onDuplicateLayer(activeLayerId)}
            disabled={!activeLayerId}
            title="Duplicate Layer"
            className={`w-6 h-6 rounded flex items-center justify-center ${
              activeLayerId
                ? 'hover:bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-600))]'
                : 'text-[rgb(var(--apple-gray-300))] cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => activeLayerId && onRemoveLayer(activeLayerId)}
            disabled={!activeLayerId || layers.length <= 1}
            title="Delete Layer"
            className={`w-6 h-6 rounded flex items-center justify-center ${
              activeLayerId && layers.length > 1
                ? 'hover:bg-red-100 text-red-500'
                : 'text-[rgb(var(--apple-gray-300))] cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </h3>
      
      {/* Layers list */}
      <div className="mt-3 border border-[rgb(var(--apple-gray-200))] rounded-lg overflow-hidden">
        {layers.length === 0 ? (
          <div className="p-4 text-sm text-[rgb(var(--apple-gray-500))] text-center">
            No layers
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {layers.map((layer) => (
              <li 
                key={layer.id}
                className={`
                  px-3 py-2 text-sm border-b border-[rgb(var(--apple-gray-200))] last:border-b-0
                  transition-colors relative
                  ${dragOverLayerId === layer.id ? 'bg-[rgb(var(--primary-50))]' : ''}
                  ${layer.id === activeLayerId 
                    ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))]' 
                    : 'text-[rgb(var(--apple-gray-700))] hover:bg-[rgb(var(--apple-gray-50))]'
                  }
                `}
                onClick={() => onSetActiveLayer(layer.id)}
                draggable
                onDragStart={(e) => handleDragStart(e, layer.id)}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDrop={(e) => handleDrop(e, layer.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    {/* Visibility toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                      className="mr-2 text-[rgb(var(--apple-gray-500))] hover:text-[rgb(var(--apple-gray-700))]"
                    >
                      {layer.visible ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Lock toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                      className="mr-2 text-[rgb(var(--apple-gray-500))] hover:text-[rgb(var(--apple-gray-700))]"
                    >
                      {layer.locked ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Layer name - editable on double click */}
                    {editLayerId === layer.id ? (
                      <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={layerName}
                          onChange={(e) => setLayerName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          onBlur={handleSaveName}
                          className="w-full px-1 py-0.5 text-sm border border-[rgb(var(--primary-300))] rounded"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div 
                        onDoubleClick={() => startEditingName(layer)} 
                        className="flex-1 truncate"
                        title={layer.name}
                      >
                        {layer.name}
                      </div>
                    )}
                  </div>
                  
                  {/* Layer type indicator */}
                  <div className="ml-2 flex-shrink-0">
                    {layer.type === 'image' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[rgb(var(--apple-gray-500))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {layer.type === 'text' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[rgb(var(--apple-gray-500))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    )}
                    {layer.type === 'shape' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[rgb(var(--apple-gray-500))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    )}
                    {layer.type === 'adjustment' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[rgb(var(--apple-gray-500))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    )}
                  </div>
                </div>
                
                {/* Layer settings - only show for active layer */}
                {layer.id === activeLayerId && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[rgb(var(--apple-gray-500))]">Opacity</label>
                      <div className="flex items-center mt-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={layer.opacity}
                          onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-[rgb(var(--apple-gray-200))] rounded appearance-none"
                        />
                        <span className="ml-2 text-xs w-8 text-[rgb(var(--apple-gray-600))]">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[rgb(var(--apple-gray-500))]">Blend</label>
                      <select
                        value={layer.blendMode}
                        onChange={(e) => handleBlendModeChange(layer.id, e.target.value as BlendMode)}
                        className="w-full mt-1 text-xs p-1 border border-[rgb(var(--apple-gray-200))] rounded"
                      >
                        {blendModeOptions.map(mode => (
                          <option key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LayersPanel; 