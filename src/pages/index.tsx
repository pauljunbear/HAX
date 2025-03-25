'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import styles from '../styles/Home.module.css';

// Import ControlPanel normally since it doesn't use canvas
import ControlPanel from '../components/ControlPanel';

// Dynamically import ImageEditor with SSR disabled
const ImageEditor = dynamic(
  () => import('../components/ImageEditor'),
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
    <div className={styles.container}>
      <Header />
      <div className="flex flex-col md:flex-row flex-1 p-4 gap-4 min-h-[80vh]">
        <div className="w-full md:w-3/4 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
          <ImageEditor 
            selectedImage={selectedImage}
            activeEffect={activeEffect}
            effectSettings={effectSettings}
            onImageUpload={handleImageUpload}
          />
        </div>
        <div className="w-full md:w-1/4">
          <ControlPanel 
            activeEffect={activeEffect}
            effectSettings={effectSettings}
            onEffectChange={handleEffectChange}
            onSettingChange={handleSettingChange}
            hasImage={!!selectedImage}
          />
        </div>
      </div>
      <footer className={styles.footer}>
        <a
          href="https://github.com/pauljunbear/imager2"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
} 