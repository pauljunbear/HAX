'use client';

import React, { useState, useEffect, useRef, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useAppStore } from '@/lib/store';
import ImageEditor from '@/components/ImageEditor';
import IntroScreen from '@/components/IntroScreen';
import BootScreen from '@/components/BootScreen';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';

// Import new components
import AppleStyleLayout from '@/components/AppleStyleLayout';
import AppleEffectsBrowser from '@/components/AppleEffectsBrowser';
import AppleControlsPanel from '@/components/AppleControlsPanel';
import SkipToContent from '@/components/SkipToContent';
import useHistory, { HistoryState } from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';
import { resetPerformance, usePerformanceMonitor } from '@/lib/performanceUtils';
import { ARIA_LABELS, focusRingClass } from '@/lib/accessibility';

export default function Home() {
  const selectedImage = useAppStore(state => state.selectedImage);
  const setSelectedImage = useAppStore(state => state.setSelectedImage);
  const [booting, setBooting] = useState(true);

  // This prevents the intro screen from flashing on page load if an image is already selected
  const [isReady, setIsReady] = useState(false);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageEditorRef = useRef<any>(null);

  // Debug ref connection
  useEffect(() => {
    console.log('🔗 imageEditorRef.current updated:', !!imageEditorRef.current);
    if (imageEditorRef.current) {
      console.log('🔗 Available methods:', Object.keys(imageEditorRef.current));
    }
  }, [selectedImage]);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'effects' | 'layers' | 'history'>('effects');

  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  // Performance monitoring (with error handling)
  const performanceMonitor = usePerformanceMonitor();
  const {
    pauseEffects,
    resumeEffects,
    resetPerformance: resetPerf,
    isDegraded,
  } = performanceMonitor;

  // Initialize history with empty state
  const {
    currentState,
    history,
    currentIndex,
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    jumpToState,
  } = useHistory({
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
    updateLayer: updateEffectLayer,
    reorderLayers: reorderEffectLayers,
    setActiveLayer: setActiveEffectLayer,
    updateLayerSettings,
    getCombinedEffect,
    clearLayers: clearEffectLayers,
  } = useEffectLayers();

  // Extract activeEffect and effectSettings from the active effect layer
  const activeEffect = activeEffectLayer?.effectId || null;
  const effectSettings = activeEffectLayer?.settings || {};

  // Add debugging on component mount
  useEffect(() => {
    console.log('Home component mounted');
  }, []);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const handleBootComplete = () => {
    setBooting(false);
  };

  const handleImageUpload = (imageDataUrl: string) => {
    // Reset error state
    setImageError(null);
    setImageLoading(true);

    console.log('handleImageUpload called with data length:', imageDataUrl.length);
    // Debug the data format
    console.log('Image data format:', imageDataUrl.substring(0, 50) + '...');

    // Reset active effect and clear history when a new image is uploaded
    clearHistory({ activeEffect: null, effectSettings: {} });
    clearEffectLayers();

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
      console.log('Test image loaded successfully in Home component, setting selectedImage');
      console.log('Dimensions:', testImage.width, 'x', testImage.height);
      setSelectedImage(imageDataUrl);
      setOriginalImage(testImage); // Store the original image
      setImageLoading(false);
      setMobileMenuOpen(false); // Close mobile menu after upload
    };

    testImage.onerror = error => {
      console.error('Failed to load test image in Home component:', error);
      setImageError('Failed to load image. Please try another file.');
      setImageLoading(false);
    };

    // Set the source to trigger loading
    testImage.src = imageDataUrl;
  };

  const handleNewImage = () => {
    setSelectedImage(null);
    setOriginalImage(null);
    clearEffectLayers();
    clearHistory({ activeEffect: null, effectSettings: {} });
    setImageError(null);
    if (imageEditorRef.current?.reset) {
      imageEditorRef.current.reset();
    }
  };

  const handleEffectChange = (effectName: string | null) => {
    console.log('Effect changed to:', effectName);

    if (effectName) {
      // Add as a new effect layer
      addEffectLayer(effectName);
    } else if (activeEffectLayerId) {
      // Remove the active layer
      removeEffectLayer(activeEffectLayerId);
    }
  };

  const handleSettingChange = (settingName: string, value: number) => {
    console.log(`Setting ${settingName} changed to:`, value);

    if (activeEffectLayerId) {
      updateLayerSettings(activeEffectLayerId, settingName, value);
    }
  };

  const handleResetSettings = () => {
    console.log('Resetting settings for active effect');
    if (activeEffectLayerId && activeEffectLayer) {
      // Reset all settings to their default values
      const effectConfig = require('@/lib/effects').effectsConfig[activeEffectLayer.effectId];
      if (effectConfig?.settings) {
        Object.entries(effectConfig.settings).forEach(([key, setting]: [string, any]) => {
          updateLayerSettings(activeEffectLayerId, key, setting.defaultValue);
        });
      }
    }
  };

  const handleClearAllEffects = () => {
    console.log('Clearing all effects');
    clearEffectLayers();
  };

  const handleRemoveEffect = (layerId: string) => {
    console.log(`Removing effect layer: ${layerId}`);
    removeEffectLayer(layerId);
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    console.log(`Toggling visibility for layer: ${layerId}`);
    // This assumes your useEffectLayers hook has a function like toggleLayerVisibility
    // If not, you'll need to implement it. For now, let's add it to the hook.
    const layer = effectLayers.find(l => l.id === layerId);
    if (layer) {
      updateEffectLayer(layerId, { ...layer, visible: !layer.visible });
    }
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  const handleJumpToState = (index: number) => {
    jumpToState(index);
  };

  const handleExportClick = () => {
    console.log('Export button clicked');
    console.log('imageEditorRef:', imageEditorRef);
    console.log('imageEditorRef.current:', imageEditorRef.current);

    if (imageEditorRef.current) {
      console.log('Calling export on ImageEditor');
      try {
        imageEditorRef.current.exportImage(); // Call without format to show dialog
      } catch (error) {
        console.error('Error calling exportImage:', error);
      }
    } else {
      console.log('ImageEditor ref not available, using trigger');
      // Fallback: trigger export using state change
      setExportTrigger(prev => prev + 1);
    }
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        mobileMenuOpen &&
        !target.closest('.mobile-menu') &&
        !target.closest('.mobile-menu-button')
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);

  // Function to get the current canvas from ImageEditor
  const getCurrentCanvas = () => {
    if (imageEditorRef.current?.getStage) {
      const stage = imageEditorRef.current.getStage();
      if (stage) {
        return stage.toCanvas();
      }
    }
    return null;
  };

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
      <AnimatePresence>
        {booting && <BootScreen onBootComplete={handleBootComplete} />}
      </AnimatePresence>
      {!booting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {selectedImage ? (
            <AppleStyleLayout
              hasImage={!!selectedImage}
              onNewImage={handleNewImage}
              leftSidebar={
                <AppleEffectsBrowser
                  activeEffect={activeEffectLayer?.effectId || null}
                  onEffectChange={handleEffectChange}
                  hasImage={!!selectedImage}
                  onNewImage={handleNewImage}
                />
              }
              rightSidebar={
                <AppleControlsPanel
                  activeEffect={activeEffectLayerId}
                  effectLayers={effectLayers}
                  effectSettings={effectSettings}
                  onSettingChange={handleSettingChange}
                  onResetSettings={handleResetSettings}
                  onClearAllEffects={handleClearAllEffects}
                  onRemoveEffect={handleRemoveEffect}
                  onSetActiveLayer={setActiveEffectLayer}
                  onToggleLayerVisibility={handleToggleLayerVisibility}
                  onExport={format => {
                    console.log('📤 Export handler called in page.tsx with format:', format);
                    console.log('📤 imageEditorRef exists:', !!imageEditorRef);
                    console.log('📤 imageEditorRef.current exists:', !!imageEditorRef.current);
                    console.log(
                      '📤 exportImage method exists:',
                      !!imageEditorRef.current?.exportImage
                    );

                    // Handle export
                    if (imageEditorRef.current) {
                      try {
                        console.log(
                          '📤 Calling imageEditorRef.current.exportImage with format:',
                          format
                        );
                        imageEditorRef.current.exportImage(format);
                        console.log('📤 exportImage call completed');
                      } catch (error) {
                        console.error('❌ Error calling exportImage:', error);
                      }
                    } else {
                      console.error('❌ imageEditorRef.current is null - cannot export');
                    }
                  }}
                  hasImage={!!selectedImage}
                />
              }
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
                    onImageUpload={handleImageUpload}
                    exportTrigger={exportTrigger}
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
            <IntroScreen
              onImageSelect={() => {
                // Trigger file input
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = e => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = e => {
                      const result = e.target?.result as string;
                      handleImageUpload(result);
                    };
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
            />
          )}
        </motion.div>
      )}
    </>
  );
}
