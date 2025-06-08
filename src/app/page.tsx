'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import new components
import AppleStyleLayout from '@/components/AppleStyleLayout';
import AppleEffectsBrowser from '@/components/AppleEffectsBrowser';
import AppleControlsPanel from '@/components/AppleControlsPanel';
import SkipToContent from '@/components/SkipToContent';
import useHistory, { HistoryState } from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';
import { resetPerformance, usePerformanceMonitor } from '@/lib/performanceUtils';
import { ARIA_LABELS, focusRingClass } from '@/lib/accessibility';

// Dynamically import ImageEditor with SSR disabled and proper ref forwarding
const ImageEditor = dynamic(
  () => import('@/components/ImageEditor').then(mod => {
    // Explicitly handle the forwardRef component
    return mod.default || mod;
  }),
  { 
    ssr: false,
    // Add loading component
    loading: () => (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-emerald-500 border-gray-200"></div>
        <span className="ml-3 text-gray-600">Loading editor...</span>
      </div>
    )
  }
);

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageEditorRef = useRef<any>(null);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'effects' | 'layers' | 'history'>('effects');

  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  // Performance monitoring (with error handling)
  const performanceMonitor = usePerformanceMonitor();
  const { pauseEffects, resumeEffects, resetPerformance: resetPerf, isDegraded } = performanceMonitor;

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
    jumpToState
  } = useHistory({
    activeEffect: null,
    effectSettings: {}
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
    console.log("Home component mounted");
  }, []);

  const handleImageUpload = (imageDataUrl: string) => {
    // Reset error state
    setImageError(null);
    setImageLoading(true);
    
    console.log("handleImageUpload called with data length:", imageDataUrl.length);
    // Debug the data format
    console.log("Image data format:", imageDataUrl.substring(0, 50) + "...");

    // Reset active effect and clear history when a new image is uploaded
    clearHistory({ activeEffect: null, effectSettings: {} });
    clearEffectLayers();


    // Validate the image data
    if (!imageDataUrl.startsWith('data:image/')) {
      console.error("Invalid image data format:", imageDataUrl.substring(0, 50));
      setImageError("Invalid image data format");
      setImageLoading(false);
      return;
    }
    
    // Test load the image first
    const testImage = new Image();
    testImage.onload = () => {
      console.log("Test image loaded successfully in Home component, setting selectedImage");
      console.log("Dimensions:", testImage.width, "x", testImage.height);
      setSelectedImage(imageDataUrl);
      setOriginalImage(testImage); // Store the original image
      setImageLoading(false);
      setMobileMenuOpen(false); // Close mobile menu after upload
    };
    
    testImage.onerror = (error) => {
      console.error("Failed to load test image in Home component:", error);
      setImageError("Failed to load image. Please try another file.");
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
    console.log("Effect changed to:", effectName);
    
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
    console.log("Resetting settings for active effect");
    if (activeEffectLayerId && activeEffectLayer) {
      // Reset all settings to their default values
      const effectConfig = require('@/lib/effects').effectsConfig[activeEffectLayer.effectId];
      if (effectConfig?.settings) {
        Object.entries(effectConfig.settings).forEach(([key, setting]: [string, any]) => {
          updateLayerSettings(activeEffectLayerId, key, setting.default);
        });
      }
    }
  };

  const handleClearAllEffects = () => {
    console.log("Clearing all effects");
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
    console.log("Export button clicked");
    console.log("imageEditorRef:", imageEditorRef);
    console.log("imageEditorRef.current:", imageEditorRef.current);
    
    if (imageEditorRef.current) {
      console.log("Calling export on ImageEditor");
      try {
        imageEditorRef.current.exportImage(); // Call without format to show dialog
      } catch (error) {
        console.error("Error calling exportImage:", error);
      }
    } else {
      console.log("ImageEditor ref not available, using trigger");
      // Fallback: trigger export using state change
      setExportTrigger(prev => prev + 1);
    }
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
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

  return (
    <div className="min-h-screen">
      <SkipToContent />
      
      <AppleStyleLayout
        hasImage={!!selectedImage}
        onNewImage={handleNewImage}
        leftSidebar={
          <AppleEffectsBrowser
            activeEffect={activeEffectLayerId}
            onEffectChange={handleEffectChange}
            hasImage={!!selectedImage}
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
            onExport={(format) => {
              // Handle export
              if (imageEditorRef.current) {
                try {
                  imageEditorRef.current.exportImage(format);
                } catch (error) {
                  console.error("Error calling exportImage:", error);
                }
              }
            }}
            hasImage={!!selectedImage}
          />
        }
      >
        {/* Main Canvas Content */}
        {imageLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading Image...</p>
          </div>
        ) : imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Image</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{imageError}</p>
          </div>
        ) : !selectedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-3xl flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Welcome to Imager
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-center max-w-md">
              Upload an image to start applying beautiful real-time effects
            </p>
            <label className="bg-blue-600 hover:bg-blue-700 cursor-pointer px-6 py-3 text-white font-medium rounded-xl transition-colors shadow-sm">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        handleImageUpload(event.target.result as string);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              Choose Image
            </label>
            <p className="text-xs text-gray-400 mt-4">
              Supports JPG, PNG, GIF, WebP • Max 10MB
            </p>
          </div>
        ) : (
          <ImageEditor
            ref={imageEditorRef}
            selectedImage={selectedImage}
            effectLayers={effectLayers.filter(layer => layer.visible)}
            onImageUpload={handleImageUpload}
            exportTrigger={exportTrigger}
            onExportComplete={() => setExportTrigger(0)}
          />
        )}
      </AppleStyleLayout>
    </div>
  );
} 