'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import new components
import ControlPanelV3 from '@/components/ControlPanelV3';
import HistoryPanel from '@/components/HistoryPanel';
import EffectLayers from '@/components/EffectLayers';
import useHistory, { HistoryState } from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';

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

  return (
    <div className="min-h-screen bg-dark-bg font-sans text-dark-text">
      {/* Header - Use darkest background, ensure border is subtle */}
      <header className="h-14 border-b border-dark-border bg-dark-bg sticky top-0 z-10 flex items-center justify-between px-6">
        <div className="flex items-center">
          {/* Ensure text uses dark theme colors */}
          <h1 className="text-lg font-semibold text-dark-text">
            <span className="text-primary-accent">Imager</span>
          </h1>
          <div className="ml-3 text-[10px] font-medium bg-dark-border text-dark-textMuted px-2 py-0.5 rounded-full">Real-time Effects</div>
        </div>
        
        {/* Center controls */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          {selectedImage && (
            <>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to load a new image? Current edits will be lost.')) {
                    setSelectedImage(null);
                    clearHistory({ activeEffect: null, effectSettings: {} });
                    clearEffectLayers();
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-all duration-200 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                New Image
              </button>
              
              <button
                onClick={handleExportClick}
                className="px-3 py-1.5 bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-medium rounded-lg transition-all duration-200 flex items-center shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </>
          )}
        </div>
        
        <div className="flex gap-4">
          {/* Ensure link uses dark theme text colors */}
          <a 
            href="https://github.com/pauljunbear/imager2" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-dark-textMuted hover:text-dark-text flex items-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>
      
      <main className="flex h-[calc(100vh-3.5rem)]">
        {/* Left sidebar - Use slightly lighter surface, remove backdrop blur/opacity */}
        <div className="w-80 border-r border-dark-border bg-dark-surface overflow-y-auto flex flex-col">
          {/* New Control Panel */}
          <ControlPanelV3
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
              <svg className="animate-spin h-10 w-10 text-primary-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-3 text-xs font-medium">Loading Image...</p>
            </div>
          ) : imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-apple-red">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-3 text-xs font-medium">{imageError}</p>
            </div>
          ) : !selectedImage ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-textMuted">
              <div className="w-28 h-28 mb-6 rounded-2xl bg-dark-surface flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-dark-text mb-2">Drop Image or Click to Upload</h2>
              <p className="text-xs text-dark-textMuted mb-6 max-w-md text-center">
                Supported formats: JPG, PNG, GIF, WebP
              </p>
              <label className="bg-primary-accent hover:bg-opacity-90 cursor-pointer px-4 py-2 text-white text-xs font-medium rounded-md transition-colors">
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
              ref={imageEditorRef}
              selectedImage={selectedImage}
              effectLayers={effectLayers.filter(layer => layer.visible)}
              onImageUpload={handleImageUpload}
              exportTrigger={exportTrigger}
              onExportComplete={() => setExportTrigger(0)}
            />
          )}
        </div>
      </main>
    </div>
  );
} 