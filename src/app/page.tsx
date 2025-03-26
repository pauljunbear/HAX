'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import ControlPanel normally since it doesn't use canvas
import ControlPanel from '@/components/ControlPanel';

// Dynamically import ImageEditor with SSR disabled
const ImageEditor = dynamic(
  () => import('@/components/ImageEditor'),
  { ssr: false }
);

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [effectSettings, setEffectSettings] = useState<Record<string, number>>({});
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

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

    // Reset active effect when a new image is uploaded
    if (activeEffect) {
      setActiveEffect(null);
      setEffectSettings({});
    }

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
    setActiveEffect(effectName);
  };

  const handleSettingChange = (settingName: string, value: number) => {
    console.log(`Setting ${settingName} changed to:`, value);
    setEffectSettings((prev) => ({
      ...prev,
      [settingName]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-800">
            <span className="text-emerald-600">Imager</span>
          </h1>
          <span className="ml-2 text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">Real-time Image Effects</span>
        </div>
        <div className="flex gap-3">
          <a href="https://github.com/pauljunbear/imager2" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
            View on GitHub
          </a>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex h-[calc(100vh-3.5rem)]">
        {/* Left sidebar */}
        <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
          <ControlPanel 
            activeEffect={activeEffect}
            effectSettings={effectSettings}
            onEffectChange={handleEffectChange}
            onSettingChange={handleSettingChange}
            hasImage={!!selectedImage}
          />
        </div>
        
        {/* Main editor area */}
        <div className="flex-1 p-6 bg-gray-50 overflow-hidden">
          <div className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {imageLoading && (
              <div className="absolute inset-0 z-20 bg-white bg-opacity-80 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-emerald-500 border-gray-200 mb-2"></div>
                  <span className="text-gray-600">Processing image...</span>
                </div>
              </div>
            )}
            {imageError && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-red-50 text-red-700 px-4 py-3 rounded-md shadow-md text-sm">
                {imageError}
              </div>
            )}
            <ImageEditor 
              selectedImage={selectedImage}
              activeEffect={activeEffect}
              effectSettings={effectSettings}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 