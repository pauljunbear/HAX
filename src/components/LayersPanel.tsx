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
  const [isExpanded, setIsExpanded] = useState(false);
  const [editLayerId, setEditLayerId] = useState<string | null>(null);
  const [editLayerName, setEditLayerName] = useState<string>('');
  const [layerOpacity, setLayerOpacity] = useState<number>(1);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  
  // Start renaming a layer
  const startRenaming = (layer: Layer) => {
    setEditLayerId(layer.id);
    setEditLayerName(layer.name);
  };
  
  // Finish renaming a layer
  const finishRenaming = () => {
    if (editLayerId && editLayerName.trim()) {
      onUpdateLayer(editLayerId, { name: editLayerName.trim() });
      setEditLayerId(null);
    }
  };
  
  // Cancel renaming
  const cancelRenaming = () => {
    setEditLayerId(null);
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
    <div className="border-t border-apple-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80">
      <div className="py-3 px-5 border-b border-apple-gray-100 dark:border-dark-border">
        <div 
          className="flex items-center justify-between cursor-pointer" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h2 className="text-sm font-medium text-apple-gray-800 dark:text-dark-text flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary dark:text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Layers
          </h2>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 text-apple-gray-500 dark:text-dark-textMuted transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Add Layer button - Increased margin-top */}
        <div className="flex justify-between mt-3">
          <button
            onClick={onAddLayer}
            className="btn-apple-secondary dark:bg-dark-surface dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-border py-1 px-3 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Layer
          </button>
        </div>
      </div>

      {/* Collapsible layers list - Increased padding */}
      {isExpanded && (
        <div className="max-h-40 overflow-y-auto p-3">
          {layers.length === 0 ? (
            <div className="text-center text-apple-gray-400 dark:text-dark-textMuted py-2">
              <p className="text-xs">No layers yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => onSetActiveLayer(layer.id)}
                  className={`
                    border rounded-md overflow-hidden transition-colors
                    ${layer.id === activeLayerId 
                      ? 'border-primary dark:border-primary-accent' 
                      : 'border-apple-gray-200 dark:border-dark-border'
                    }
                    ${layer.locked ? 'opacity-60' : 'hover:border-primary/50 dark:hover:border-primary-accent/50'}
                    cursor-pointer text-xs
                  `}
                >
                  <div className={`
                    p-2 flex items-center justify-between
                    ${layer.id === activeLayerId ? 'bg-primary-50 dark:bg-primary-accent/10' : 'bg-white dark:bg-dark-surface'}
                  `}>
                    <div className="flex items-center min-w-0 flex-1">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onToggleVisibility(layer.id); 
                        }}
                        className="mr-1.5 text-apple-gray-600 dark:text-dark-textMuted hover:text-apple-gray-800 dark:hover:text-dark-text"
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
                      
                      {editLayerId === layer.id ? (
                        <input
                          type="text"
                          value={editLayerName}
                          onChange={(e) => setEditLayerName(e.target.value)}
                          onBlur={finishRenaming}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRenaming();
                            if (e.key === 'Escape') cancelRenaming();
                          }}
                          className="w-full text-xs border border-apple-gray-300 dark:border-dark-border dark:bg-dark-bg rounded px-1 py-0.5"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-xs font-medium text-apple-gray-800 dark:text-dark-text truncate block flex-1"
                          onDoubleClick={() => startRenaming(layer)}
                        >
                          {layer.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center ml-1">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          onToggleLock(layer.id); 
                        }}
                        className={`
                          p-0.5 rounded-sm hover:bg-apple-gray-100 dark:hover:bg-dark-border
                          ${layer.locked ? 'text-primary dark:text-primary-accent' : 'text-apple-gray-500 dark:text-dark-textMuted'}
                        `}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </button>
                      
                      <div className="relative ml-1">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (editLayerId === layer.id) {
                              setEditLayerId(null);
                            } else {
                              setEditLayerId(layer.id);
                            }
                          }}
                          className="p-0.5 rounded-sm text-apple-gray-500 dark:text-dark-textMuted hover:bg-apple-gray-100 dark:hover:bg-dark-border"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                        </button>
                        
                        {editLayerId === layer.id && (
                          <div 
                            className="absolute right-0 mt-1 z-10 bg-white dark:bg-dark-surface rounded-md shadow-lg border border-apple-gray-200 dark:border-dark-border py-1 w-36"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                onDuplicateLayer(layer.id);
                                setEditLayerId(null);
                              }}
                              className="w-full text-left px-2 py-1 text-xs text-apple-gray-700 dark:text-dark-text hover:bg-apple-gray-100 dark:hover:bg-dark-border"
                            >
                              Duplicate Layer
                            </button>
                            <button 
                              onClick={() => startRenaming(layer)}
                              className="w-full text-left px-2 py-1 text-xs text-apple-gray-700 dark:text-dark-text hover:bg-apple-gray-100 dark:hover:bg-dark-border"
                            >
                              Rename Layer
                            </button>
                            <div className="border-t border-apple-gray-200 dark:border-dark-border my-0.5"></div>
                            <button 
                              onClick={() => {
                                onRemoveLayer(layer.id);
                                setEditLayerId(null);
                              }}
                              className="w-full text-left px-2 py-1 text-xs text-red-600 dark:text-apple-red hover:bg-red-50 dark:hover:bg-red-900/50"
                            >
                              Delete Layer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LayersPanel; 