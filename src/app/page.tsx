'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import new components
import ControlPanelV2 from '@/components/ControlPanelV2';
import HistoryPanel from '@/components/HistoryPanel';
import EffectLayers from '@/components/EffectLayers';
import useHistory, { HistoryState } from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';

// Dynamically import ImageEditor with SSR disabled
const ImageEditor = dynamic(
  () => import('@/components/ImageEditor'),
  { ssr: false }
);

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageEditorRef, setImageEditorRef] = useState<any>(null);

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
      setImageLoading(false);
    };
    
    testImage.onerror = (error) => {
      console.error("Failed to load test image in Home component:", error);
      setImageError("Failed to load image. Please try another file.");
      setImageLoading(false);
    };
    
    // Set the source to trigger loading
    testImage.src = imageDataUrl;
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

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  const handleJumpToState = (index: number) => {
    jumpToState(index);
  };

  // Callback to get the ref from ImageEditor
  const handleEditorReady = (editorInstance: any) => {
    console.log("ImageEditor instance received in Home component:", editorInstance);
    // Store the instance (which has the exportImage method)
    setImageEditorRef(editorInstance);
  };

  const handleExportClick = () => {
    // Now imageEditorRef directly holds the object with the method
    if (imageEditorRef && typeof imageEditorRef.exportImage === 'function') {
      console.log("Triggering export via stored editor instance");
      imageEditorRef.exportImage();
    } else {
      console.error("ImageEditor instance or exportImage method not available.", {
        refExists: !!imageEditorRef, // Should now be true if handleEditorReady was called
        isFunction: typeof imageEditorRef?.exportImage
      });
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg font-sans text-dark-text">
      {/* Header - Use darkest background, ensure border is subtle */}
      <header className="h-16 border-b border-dark-border bg-dark-bg sticky top-0 z-10 flex items-center justify-between px-6">
        <div className="flex items-center">
          {/* Ensure text uses dark theme colors */}
          <h1 className="text-xl font-semibold text-dark-text">
            <span className="text-primary-accent">Imager</span>
          </h1>
          <div className="ml-3 text-xs font-medium bg-dark-border text-dark-textMuted px-2.5 py-1 rounded-full">Real-time Effects</div>
        </div>
        <div className="flex gap-4">
          {/* Ensure link uses dark theme text colors */}
          <a 
            href="https://github.com/pauljunbear/imager2" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm text-dark-textMuted hover:text-dark-text flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>
      
      <main className="flex h-[calc(100vh-4rem)]">
        {/* Left sidebar - Use slightly lighter surface, remove backdrop blur/opacity */}
        <div className="w-80 border-r border-dark-border bg-dark-surface overflow-y-auto flex flex-col">
          {/* Export button section - use surface bg, subtle border */}
          <div className="p-5 border-b border-dark-border">
            {/* Export button - Accent background */}
            <button 
              onClick={handleExportClick} 
              disabled={!selectedImage || imageLoading}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-primary-accent hover:bg-opacity-90 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export Image
            </button>
          </div>
          
          {/* New Control Panel */}
          <ControlPanelV2
            activeEffect={activeEffect}
            effectSettings={effectSettings}
            onEffectChange={handleEffectChange}
            onSettingChange={handleSettingChange}
            hasImage={!!selectedImage}
          />
          
          {/* Effect Layers panel */}
          {selectedImage && (
            <EffectLayers
              layers={effectLayers}
              activeLayerId={activeEffectLayerId}
              onAddLayer={addEffectLayer}
              onRemoveLayer={removeEffectLayer}
              onUpdateLayer={updateEffectLayer}
              onReorderLayers={reorderEffectLayers}
              onSetActiveLayer={setActiveEffectLayer}
            />
          )}
          
          {/* History panel */}
          {selectedImage && (
            <HistoryPanel
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              history={history}
              currentIndex={currentIndex}
              onJumpToState={handleJumpToState}
            />
          )}
        </div>
        
        {/* Main editor area - Use darkest background */}
        <div className="flex-1 relative overflow-hidden bg-dark-bg">
          {imageLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-textMuted">
              <svg className="animate-spin h-12 w-12 text-primary-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 text-sm font-medium">Loading Image...</p>
            </div>
          ) : imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-apple-red">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-3 text-sm font-medium">{imageError}</p>
            </div>
          ) : !selectedImage ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-textMuted">
              <div className="w-32 h-32 mb-8 rounded-2xl bg-dark-surface flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-dark-text mb-3">Drop Image or Click to Upload</h2>
              <p className="text-sm text-dark-textMuted mb-8 max-w-md text-center">
                Supported formats: JPG, PNG, GIF, WebP
              </p>
              <label className="bg-primary-accent hover:bg-opacity-90 cursor-pointer px-4 py-2 text-white text-sm font-medium rounded-md transition-colors">
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
            </div>
          ) : (
            <ImageEditor
              selectedImage={selectedImage}
              activeEffect={activeEffect}
              effectSettings={effectSettings}
              onImageUpload={handleImageUpload}
              onReady={handleEditorReady}
            />
          )}
        </div>
      </main>
    </div>
  );
} 