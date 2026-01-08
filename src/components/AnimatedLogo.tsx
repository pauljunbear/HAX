'use client';

import React, { useEffect, useRef } from 'react';

// Interface for Unicorn Studio scene
interface UnicornScene {
  destroy: () => void;
}

// Interface for Unicorn Studio SDK
interface UnicornStudioSDK {
  addScene: (options: {
    elementId: string;
    fps: number;
    scale: number;
    dpi: number;
    filePath: string;
    lazyLoad: boolean;
    altText: string;
    ariaLabel: string;
  }) => Promise<UnicornScene>;
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioSDK;
  }
}

interface AnimatedLogoProps {
  className?: string;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UnicornScene | null>(null);

  useEffect(() => {
    // Load Unicorn Studio SDK
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.25/dist/unicornStudio.umd.js';
    script.async = true;

    script.onload = () => {
      if (window.UnicornStudio && containerRef.current) {
        // Add the scene dynamically
        window.UnicornStudio.addScene({
          elementId: 'unicorn-logo-bg',
          fps: 60,
          scale: 1,
          dpi: 1.5,
          filePath: '/imhax-logo.json',
          lazyLoad: false,
          altText: 'HAX animated background',
          ariaLabel: 'Animated background for HAX',
        })
          .then((scene: UnicornScene) => {
            sceneRef.current = scene;
          })
          .catch((err: unknown) => {
            console.error('Failed to load Unicorn Studio scene:', err);
          });
      }
    };

    document.head.appendChild(script);

    // Cleanup
    return () => {
      if (sceneRef.current) {
        sceneRef.current.destroy();
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="unicorn-logo-bg"
      className={`absolute inset-0 w-full h-full ${className}`}
    />
  );
};

export default AnimatedLogo;
