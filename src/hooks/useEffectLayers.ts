import { useState, useCallback } from 'react';
import { EffectLayer } from '@/components/EffectLayers';
import { effectsConfig } from '@/lib/effects';

const generateLayerId = () => `effect-layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const useEffectLayers = () => {
  const [layers, setLayers] = useState<EffectLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Add a new effect layer
  const addLayer = useCallback((effectId: string) => {
    const effect = effectsConfig[effectId];
    if (!effect) return;

    // Initialize settings with default values
    const defaultSettings: Record<string, number> = {};
    if (effect.settings) {
      Object.entries(effect.settings).forEach(([key, setting]) => {
        defaultSettings[key] = setting.default;
      });
    }

    const newLayer: EffectLayer = {
      id: generateLayerId(),
      effectId,
      settings: defaultSettings,
      opacity: 1,
      visible: true,
      locked: false,
    };

    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }, []);

  // Remove a layer
  const removeLayer = useCallback((layerId: string) => {
    setLayers(prev => {
      const filtered = prev.filter(layer => layer.id !== layerId);
      
      // Update active layer if needed
      if (activeLayerId === layerId && filtered.length > 0) {
        setActiveLayerId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveLayerId(null);
      }
      
      return filtered;
    });
  }, [activeLayerId]);

  // Update a layer
  const updateLayer = useCallback((layerId: string, updates: Partial<EffectLayer>) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId ? { ...layer, ...updates } : layer
      )
    );
  }, []);

  // Reorder layers
  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    setLayers(prev => {
      const result = [...prev];
      const [movedItem] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, movedItem);
      return result;
    });
  }, []);

  // Set active layer
  const setActiveLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
  }, []);

  // Update settings for a specific layer
  const updateLayerSettings = useCallback((layerId: string, settingName: string, value: number) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === layerId
          ? { ...layer, settings: { ...layer.settings, [settingName]: value } }
          : layer
      )
    );
  }, []);

  // Get the combined effect result from all visible layers
  const getCombinedEffect = useCallback(() => {
    const visibleLayers = layers.filter(layer => layer.visible);
    if (visibleLayers.length === 0) return null;
    
    // For now, just return the first visible layer
    // In a real implementation, you'd composite multiple effects
    return visibleLayers[0];
  }, [layers]);

  // Clear all layers
  const clearLayers = useCallback(() => {
    setLayers([]);
    setActiveLayerId(null);
  }, []);

  // Duplicate a layer
  const duplicateLayer = useCallback((layerId: string) => {
    const layerToDuplicate = layers.find(l => l.id === layerId);
    if (!layerToDuplicate) return;

    const newLayer: EffectLayer = {
      ...layerToDuplicate,
      id: generateLayerId(),
      settings: { ...layerToDuplicate.settings },
    };

    const index = layers.findIndex(l => l.id === layerId);
    setLayers(prev => [
      ...prev.slice(0, index + 1),
      newLayer,
      ...prev.slice(index + 1)
    ]);
    setActiveLayerId(newLayer.id);
  }, [layers]);

  return {
    layers,
    activeLayerId,
    activeLayer: layers.find(l => l.id === activeLayerId),
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    setActiveLayer,
    updateLayerSettings,
    getCombinedEffect,
    clearLayers,
    duplicateLayer,
  };
};

export default useEffectLayers; 