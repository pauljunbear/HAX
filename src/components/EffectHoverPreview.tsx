'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffectPreview } from '@/hooks/useEffectPreview';
import { effectsConfig } from '@/lib/effects';

interface EffectHoverPreviewProps {
  effectId: string;
  imageUrl: string;
  position: { x: number; y: number };
}

const PREVIEW_SIZE = 150;

export const EffectHoverPreview: React.FC<EffectHoverPreviewProps> = ({
  effectId,
  imageUrl,
  position
}) => {
  const [previewSize, setPreviewSize] = useState({ width: PREVIEW_SIZE, height: PREVIEW_SIZE });
  const { canvas, isLoading, error } = useEffectPreview(effectId, imageUrl, previewSize);
  const effect = effectsConfig[effectId] as any;

  if (!effect) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="effect-preview"
        style={{
          left: position.x,
          top: position.y
        }}
      >
        <div className="w-40 h-40 relative">
          {canvas ? (
            <img
              src={canvas.toDataURL()}
              alt={`${effect.label} preview`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-dark-bg">
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-accent border-t-transparent" />
              ) : error ? (
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">⚠️</div>
                  <p className="text-xs text-dark-textMuted">Failed to load preview</p>
                </div>
              ) : (
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">✨</div>
                  <p className="text-xs text-dark-textMuted">{effect.label}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-3 py-2 bg-dark-bg border-t border-dark-border">
          <p className="text-xs font-medium text-dark-text">{effect.label}</p>
          <p className="text-[10px] text-dark-textMuted">{effect.description}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}; 