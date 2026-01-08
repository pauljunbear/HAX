'use client';

/**
 * Effects Module Entry Point
 *
 * This module provides the modular effects system for imHAX.
 * It re-exports from the main effects.ts file and provides additional
 * modular utilities and custom filters.
 */

import Konva from 'konva';
import OrtonFilter from './ortonEffect';
import LightLeakFilter from './lightLeakEffect';
import SmartSharpenFilter from './smartSharpenEffect';
import { effectsConfig, effectCategories } from './effectsConfig';
import {
  applyEffect,
  getFilterConfig,
  ensureKonvaInitialized,
  getEffectSettings,
  validateSettings,
  type EffectSettings,
} from './effectsUtils';

// Re-export types
export type {
  EffectSetting,
  EffectConfig,
  KonvaImageData,
  KonvaFilterFunction,
  FilterParams,
  EffectCategory,
  LegacyEffectAlias,
} from './types';

// Re-export utilities
export {
  clamp,
  clampByte,
  lerp,
  getLuminance,
  getNormalizedLuminance,
  hslToRgb,
  rgbToHsl,
  screenBlend,
  overlayBlend,
  softLightBlend,
  multiplyBlend,
  addBlend,
  acquireBuffer,
  releaseBuffer,
  acquireBufferCopy,
  iteratePixels,
  iteratePixelsXY,
  getPixelIndex,
  getPixelSafe,
  applyKernel3x3,
  SOBEL_X,
  SOBEL_Y,
  SHARPEN_KERNEL,
  EDGE_DETECT_KERNEL,
  EMBOSS_KERNEL,
} from './utils';

// Re-export Konva loader
export {
  loadKonva,
  getKonva,
  isKonvaLoaded,
  getKonvaFilter,
  ensureKonvaFiltersLoaded,
} from './konvaLoader';

// Re-export categories (modular version)
export {
  effectCategories as moduleCategories,
  getEffectCategory as moduleGetEffectCategory,
  getAllEffects,
  getEffectsForCategory,
} from './categories';

// Re-export legacy mappings
export {
  hiddenLegacyEffects,
  legacyEffectAliases,
  isLegacyEffect,
  getUnifiedEffect,
  shouldHideFromUI,
} from './legacy';

// Custom Konva filter effects
export const effects = {
  orton: async (imageNode: Konva.Image, settings: Record<string, number> = {}) => {
    imageNode.filters([OrtonFilter as Konva.Filter]);
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).ortonIntensity?.(
      settings.intensity ?? 0.7
    );
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).ortonBlurRadius?.(settings.radius ?? 15);
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).ortonContrast?.(
      settings.contrast ?? 1.3
    );
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).ortonSaturation?.(settings.saturation ?? 1.2);
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).ortonExposure?.(
      settings.exposure ?? 1.4
    );
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).ortonBlend?.(
      settings.blend ?? 0.6
    );
  },
  lightLeak: async (imageNode: Konva.Image, settings: Record<string, number> = {}) => {
    imageNode.filters([LightLeakFilter as Konva.Filter]);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakIntensity?.(settings.intensity ?? 0.6);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakColorR?.(settings.colorR ?? 255);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakColorG?.(settings.colorG ?? 200);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakColorB?.(settings.colorB ?? 100);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakPositionX?.(settings.posX ?? 0.8);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakPositionY?.(settings.posY ?? 0.2);
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).lightLeakSize?.(
      settings.size ?? 0.4
    );
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakSpread?.(settings.spread ?? 0.6);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakSoftness?.(settings.softness ?? 0.7);
    (imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>).lightLeakAngle?.(
      settings.angle ?? Math.PI / 4
    );
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).lightLeakOpacity?.(settings.opacity ?? 0.8);
    (
      imageNode as Konva.Image & Record<string, ((v: string) => void) | undefined>
    ).lightLeakBlendMode?.((settings.blendMode as unknown as string) ?? 'screen');
  },
  smartSharpen: async (
    imageNode: Konva.Image,
    settings: Record<string, number | string | boolean> = {}
  ) => {
    imageNode.filters([SmartSharpenFilter as Konva.Filter]);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).smartSharpenAmount?.((settings.amount as number) ?? 1.0);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).smartSharpenRadius?.((settings.radius as number) ?? 1.0);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).smartSharpenThreshold?.((settings.threshold as number) ?? 10);
    (
      imageNode as Konva.Image & Record<string, ((v: number) => void) | undefined>
    ).smartSharpenNoiseReduction?.((settings.noiseReduction as number) ?? 0.3);
    (
      imageNode as Konva.Image & Record<string, ((v: string) => void) | undefined>
    ).smartSharpenEdgeMode?.((settings.edgeMode as string) ?? 'sobel');
    (
      imageNode as Konva.Image & Record<string, ((v: boolean) => void) | undefined>
    ).smartSharpenPreserveDetails?.((settings.preserveDetails as boolean) ?? true);
  },
};

// Re-export from effectsUtils
export {
  effectsConfig,
  effectCategories,
  applyEffect,
  getFilterConfig,
  ensureKonvaInitialized,
  getEffectSettings,
  validateSettings,
  type EffectSettings,
};
