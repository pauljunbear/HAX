'use client';

import { useState } from 'react';
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

  const handleImageUpload = (imageDataUrl: string) => {
    setSelectedImage(imageDataUrl);
  };

  const handleEffectChange = (effectName: string) => {
    setActiveEffect(effectName);
  };

  const handleSettingChange = (settingName: string, value: number) => {
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