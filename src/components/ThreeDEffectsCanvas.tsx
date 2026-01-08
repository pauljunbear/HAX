'use client';

import dynamic from 'next/dynamic';

// Re-export the props interface for consumers
export type { ThreeDEffectsCanvasProps } from './ThreeDEffectsCanvasInner';

// Loading placeholder shown while Three.js loads (~900KB)
const LoadingFallback = ({
  width = 800,
  height = 600,
  className = '',
  zIndex = 10,
}: {
  width?: number;
  height?: number;
  className?: string;
  zIndex?: number;
}) => (
  <div
    className={`relative flex items-center justify-center bg-gray-900/50 ${className}`}
    style={{ width, height, zIndex }}
  >
    <div className="text-center">
      <div className="animate-pulse">
        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-700" />
        <div className="text-sm text-gray-400">Loading 3D...</div>
      </div>
    </div>
  </div>
);

// Dynamically import the Three.js-heavy component
// This saves ~900KB from the initial bundle
const ThreeDEffectsCanvas = dynamic(() => import('./ThreeDEffectsCanvasInner'), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

export default ThreeDEffectsCanvas;
