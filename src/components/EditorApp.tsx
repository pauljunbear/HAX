'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useAppStore } from '@/lib/store';
import ImageEditor from '@/components/ImageEditor';
import IntroScreen from '@/components/IntroScreen';
import { motion } from 'framer-motion';

// Import new components
import AppleStyleLayout from '@/components/AppleStyleLayout';
import useHistory from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';
import type { ImageEditorHandle } from './ImageEditor';

export default function EditorApp() {
  const selectedImage = useAppStore(state => state.selectedImage);
  const setSelectedImage = useAppStore(state => state.setSelectedImage);

  // This prevents the intro screen from flashing on page load if an image is already selected
  const [isReady, setIsReady] = useState(false);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageEditorRef = useRef<ImageEditorHandle | null>(null);

  // Initialize history with empty state
  const { clearHistory } = useHistory({
    activeEffect: null,
    effectSettings: {},
  });

  // Initialize effect layers
  const {
    layers: effectLayers,
    activeLayerId: activeEffectLayerId,
    activeLayer: activeEffectLayer,
    addLayer: addEffectLayer,
    removeLayer: removeEffectLayer,
    updateLayer,
    reorderLayers,
    setActiveLayer: setActiveEffectLayer,
    updateLayerSettings,
    clearLayers: clearEffectLayers,
  } = useEffectLayers();

  // Extract effectSettings from the active effect layer
  const effectSettings = activeEffectLayer?.settings || {};

  useEffect(() => {
    setIsReady(true);
  }, []);

  const handleImageUpload = useCallback(
    (file: File) => {
      // Reset error state
      setImageError(null);
      setImageLoading(true);

      // Reset active effect and clear history when a new image is uploaded
      clearHistory({ activeEffect: null, effectSettings: {} });
      clearEffectLayers();

      const reader = new FileReader();
      reader.onload = e => {
        const imageDataUrl = e.target?.result as string;

        // Validate the image data
        if (!imageDataUrl.startsWith('data:image/')) {
          console.error('Invalid image data format:', imageDataUrl.substring(0, 50));
          setImageError('Invalid image data format');
          setImageLoading(false);
          return;
        }

        // Test load the image first
        const testImage = new Image();
        testImage.onload = () => {
          setSelectedImage(imageDataUrl);
          setImageLoading(false);
        };

        testImage.onerror = error => {
          console.error('Failed to load test image in Home component:', error);
          setImageError('Failed to load image. Please try another file.');
          setImageLoading(false);
        };

        // Set the source to trigger loading
        testImage.src = imageDataUrl;
      };

      reader.onerror = () => {
        setImageError('Failed to read file. Please try another file.');
        setImageLoading(false);
      };

      reader.readAsDataURL(file);
    },
    [clearHistory, clearEffectLayers, setSelectedImage]
  );

  const handleImageSelect = useCallback(() => {
    // This will be called by the AppleStyleLayout
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  }, [handleImageUpload]);

  const handleEffectChange = useCallback(
    (effectName: string | null) => {
      if (effectName) {
        // Add as a new effect layer
        addEffectLayer(effectName);
      } else if (activeEffectLayerId) {
        // Remove the active layer
        removeEffectLayer(activeEffectLayerId);
      }
    },
    [addEffectLayer, removeEffectLayer, activeEffectLayerId]
  );

  const handleSettingChange = useCallback(
    (settingName: string, value: number) => {
      if (activeEffectLayerId) {
        updateLayerSettings(activeEffectLayerId, settingName, value);
      }
    },
    [activeEffectLayerId, updateLayerSettings]
  );

  const handleResetSettings = useCallback(() => {
    if (!activeEffectLayerId || !activeEffectLayer) {
      return;
    }

    const effect = effectLayers.find(layer => layer.id === activeEffectLayerId);
    if (!effect) {
      return;
    }

    const defaultSettings = Object.fromEntries(
      Object.entries(effect.settings).map(([key, value]) => [key, value])
    );

    Object.entries(defaultSettings).forEach(([key, value]) => {
      updateLayerSettings(activeEffectLayerId, key, value as number);
    });
  }, [activeEffectLayerId, activeEffectLayer, effectLayers, updateLayerSettings]);

  const handleClearAllEffects = useCallback(() => {
    clearEffectLayers();
  }, [clearEffectLayers]);

  const handleRemoveEffect = useCallback(
    (layerId: string) => {
      removeEffectLayer(layerId);
    },
    [removeEffectLayer]
  );

  const handleToggleLayerVisibility = useCallback(
    (layerId: string) => {
      // This assumes your useEffectLayers hook has a function like toggleLayerVisibility
      // If not, you'll need to implement it. For now, let's add it to the hook.
      const layer = effectLayers.find(l => l.id === layerId);
      if (layer) {
        updateLayer(layerId, { ...layer, visible: !layer.visible });
      }
    },
    [effectLayers, updateLayer]
  );

  const handleExport = useCallback((format: string, quality?: number) => {
    if (!imageEditorRef.current) {
      return;
    }

    try {
      // Use the new options format if quality is provided
      if (quality !== undefined) {
        imageEditorRef.current.exportImage({
          format:
            format.toLowerCase() === 'jpg' ? 'jpeg' : (format.toLowerCase() as 'png' | 'jpeg'),
          quality,
        });
      } else {
        imageEditorRef.current.exportImage(format);
      }
    } catch (error) {
      console.error('exportImage failed', error);
    }
  }, []);

  const handleEstimateFileSize = useCallback(
    async (format: 'png' | 'jpeg', quality?: number): Promise<number> => {
      if (!imageEditorRef.current) {
        return 0;
      }

      try {
        return await imageEditorRef.current.estimateFileSize(format, quality);
      } catch (error) {
        console.error('estimateFileSize failed', error);
        return 0;
      }
    },
    []
  );

  if (!isReady) {
    return null; // Or a very minimal loader
  }

  return (
    <>
      <Head>
        <title>HAX - Real-time Image Effects</title>
        <meta
          name="description"
          content="A React-based image editing app with real-time artistic effects."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        {selectedImage ? (
          <AppleStyleLayout
            selectedImage={selectedImage}
            onImageSelect={handleImageSelect}
            onImageUpload={handleImageUpload}
            // Effect-related props
            effectLayers={effectLayers}
            activeEffect={activeEffectLayerId}
            effectSettings={effectSettings}
            onEffectChange={handleEffectChange}
            onSettingChange={handleSettingChange}
            onResetSettings={handleResetSettings}
            onClearAllEffects={handleClearAllEffects}
            onRemoveEffect={handleRemoveEffect}
            onSetActiveLayer={setActiveEffectLayer}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            onReorderLayers={reorderLayers}
            onExport={handleExport}
            onEstimateFileSize={handleEstimateFileSize}
          >
            <div id="main-content" className="w-full h-full">
              {imageLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-emerald-500 border-gray-200"></div>
                  <span className="ml-3 text-gray-600">Loading image...</span>
                </div>
              ) : (
                <ImageEditor
                  ref={imageEditorRef}
                  selectedImage={selectedImage}
                  effectLayers={effectLayers}
                />
              )}
              {imageError && (
                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg"
                  role="alert"
                >
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{imageError}</span>
                </div>
              )}
            </div>
          </AppleStyleLayout>
        ) : (
          <IntroScreen onImageSelect={handleImageSelect} />
        )}
      </motion.div>
    </>
  );
}
