'use client';

import { useState, useCallback } from 'react';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  type: 'image' | 'text' | 'shape' | 'adjustment';
  data: any; // This will store layer-specific data (image data, text content, etc.)
  blendMode: BlendMode;
  locked: boolean;
}

export type BlendMode = 
  'normal' | 
  'multiply' | 
  'screen' | 
  'overlay' | 
  'darken' | 
  'lighten' | 
  'color-dodge' | 
  'color-burn' | 
  'difference' | 
  'exclusion';

const useLayers = (initialLayer?: Partial<Layer>) => {
  const defaultLayer: Layer = {
    id: `layer-${Date.now()}`,
    name: 'Background Layer',
    visible: true,
    opacity: 1,
    type: 'image',
    data: null,
    blendMode: 'normal',
    locked: false,
    ...initialLayer
  };

  const [layers, setLayers] = useState<Layer[]>([defaultLayer]);
  const [activeLayerId, setActiveLayerId] = useState<string>(defaultLayer.id);

  // Add a new layer
  const addLayer = useCallback((layer: Partial<Layer>) => {
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      type: 'image',
      data: null,
      blendMode: 'normal',
      locked: false,
      ...layer
    };
    
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    return newLayer.id;
  }, [layers]);

  // Remove a layer
  const removeLayer = useCallback((layerId: string) => {
    setLayers(prev => {
      const filtered = prev.filter(layer => layer.id !== layerId);
      
      // If the active layer is being removed, set a new active layer
      if (activeLayerId === layerId && filtered.length > 0) {
        setActiveLayerId(filtered[filtered.length - 1].id);
      }
      
      return filtered;
    });
  }, [activeLayerId]);

  // Update a layer
  const updateLayer = useCallback((layerId: string, updates: Partial<Layer>) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, ...updates } : layer
      )
    );
  }, []);

  // Change layer order
  const moveLayer = useCallback((layerId: string, newIndex: number) => {
    setLayers(prev => {
      const layer = prev.find(l => l.id === layerId);
      if (!layer) return prev;
      
      const filtered = prev.filter(l => l.id !== layerId);
      const clampedIndex = Math.max(0, Math.min(newIndex, filtered.length));
      
      return [
        ...filtered.slice(0, clampedIndex),
        layer,
        ...filtered.slice(clampedIndex)
      ];
    });
  }, []);

  // Set active layer
  const setActiveLayer = useCallback((layerId: string) => {
    if (layers.some(layer => layer.id === layerId)) {
      setActiveLayerId(layerId);
    }
  }, [layers]);

  // Get active layer
  const getActiveLayer = useCallback(() => {
    return layers.find(layer => layer.id === activeLayerId);
  }, [layers, activeLayerId]);

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }, []);

  // Set layer opacity
  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, opacity: clampedOpacity } : layer
      )
    );
  }, []);

  // Set layer blend mode
  const setLayerBlendMode = useCallback((layerId: string, blendMode: BlendMode) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, blendMode } : layer
      )
    );
  }, []);

  // Toggle layer lock
  const toggleLayerLock = useCallback((layerId: string) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
      )
    );
  }, []);

  // Duplicate a layer
  const duplicateLayer = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const duplicatedLayer: Layer = {
      ...layer,
      id: `layer-${Date.now()}`,
      name: `${layer.name} Copy`
    };
    
    setLayers(prev => [...prev, duplicatedLayer]);
    setActiveLayerId(duplicatedLayer.id);
    return duplicatedLayer.id;
  }, [layers]);

  return {
    layers,
    activeLayerId,
    addLayer,
    removeLayer,
    updateLayer,
    moveLayer,
    setActiveLayer,
    getActiveLayer,
    toggleLayerVisibility,
    setLayerOpacity,
    setLayerBlendMode,
    toggleLayerLock,
    duplicateLayer
  };
};

export default useLayers; 