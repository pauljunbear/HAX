'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface BeforeAfterSplitViewProps {
  // Back-compat props expected by tests
  beforeImage?: string | HTMLImageElement | null;
  afterImage?: string | HTMLCanvasElement | null;
  initialPosition?: number;
  onPositionChange?: (pos: number) => void;
  // Current props
  width?: number;
  height?: number;
  isActive?: boolean;
  onClose?: () => void;
}

export const BeforeAfterSplitView: React.FC<BeforeAfterSplitViewProps> = ({
  beforeImage,
  afterImage,
  initialPosition = 50,
  onPositionChange,
  width = 800,
  height = 600,
  isActive = true,
  onClose,
}) => {
  const [dividerPosition, setDividerPosition] = useState(initialPosition); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the before image on canvas (supports src string or HTMLImageElement)
  useEffect(() => {
    if (!beforeImage || !beforeCanvasRef.current) return;

    const ctx = beforeCanvasRef.current.getContext('2d');
    if (!ctx) return;

    beforeCanvasRef.current.width = width;
    beforeCanvasRef.current.height = height;

    ctx.clearRect(0, 0, width, height);
    if (typeof beforeImage === 'string') {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = beforeImage;
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(beforeImage as HTMLImageElement, 0, 0, width, height);
    }
  }, [beforeImage, width, height]);

  // Copy the after image/canvas content
  useEffect(() => {
    if (!afterImage || !afterCanvasRef.current) return;

    const ctx = afterCanvasRef.current.getContext('2d');
    if (!ctx) return;

    afterCanvasRef.current.width = width;
    afterCanvasRef.current.height = height;

    ctx.clearRect(0, 0, width, height);
    if (typeof afterImage === 'string') {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = afterImage;
    } else {
      ctx.drawImage(afterImage as HTMLCanvasElement, 0, 0, width, height);
    }
  }, [afterImage, width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let clientX: number;

      if ('touches' in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setDividerPosition(percentage);
      onPositionChange?.(percentage);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Haptic feedback on touch devices
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Vibration not supported
      }
    }
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard controls
  useEffect(() => {
    if (!isActive) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setDividerPosition(prev => {
          const next = Math.max(0, prev - 5);
          onPositionChange?.(next);
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        setDividerPosition(prev => {
          const next = Math.min(100, prev + 5);
          onPositionChange?.(next);
          return next;
        });
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, onClose]);

  if (!isActive || !beforeImage || !afterImage) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center"
      onClick={e => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="relative max-w-full max-h-full p-4">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-0 right-0 -mt-10 text-white hover:text-gray-300 transition-colors z-50"
            aria-label="Close split view"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Labels */}
        <div className="absolute top-0 left-0 right-0 flex justify-between px-4 -mt-8 text-white text-sm font-medium">
          <span className="bg-black/50 px-3 py-1 rounded">Original</span>
          <span className="bg-black/50 px-3 py-1 rounded">Edited</span>
        </div>

        {/* Container */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg shadow-2xl cursor-ew-resize"
          style={{ width, height }}
          data-testid="split-view-container"
        >
          {/* Before image */}
          <img
            src={typeof beforeImage === 'string' ? beforeImage : undefined}
            alt="Before"
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', clipPath: `inset(0 0 0 0)` }}
            data-testid="before-image"
          />
          <canvas
            ref={beforeCanvasRef}
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
          />

          {/* After image with clip */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: `polygon(${dividerPosition}% 0, 100% 0, 100% 100%, ${dividerPosition}% 100%)`,
            }}
          >
            <img
              src={typeof afterImage === 'string' ? afterImage : undefined}
              alt="After"
              className="absolute inset-0 object-cover"
              style={{ width: '100%', height: '100%' }}
              data-testid="after-image"
            />
            <canvas
              ref={afterCanvasRef}
              className="absolute inset-0"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Divider line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
            style={{ left: `${dividerPosition}%`, transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            data-testid="divider"
          >
            {/* Handle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-white rounded-full p-2 shadow-lg">
                <svg
                  className="w-4 h-4 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-0 left-0 right-0 text-center text-white text-xs -mb-8">
          <span className="bg-black/50 px-3 py-1 rounded">Drag the divider or use arrow keys</span>
        </div>
      </div>
    </motion.div>
  );
};
