'use client';

/**
 * Legacy Effect Mappings
 * Effects that have been unified into studio effects but remain for backwards compatibility
 */

import type { LegacyEffectAlias } from './types';

// ============================================================================
// LEGACY/DUPLICATE EFFECTS - Hidden from UI but still functional
// ============================================================================
// These effects are presets within unified Studios. They remain in effectsConfig
// for backwards compatibility but should NOT appear in the UI.
export const hiddenLegacyEffects = new Set([
  // Covered by unifiedBlur
  'blur',
  'bokeh',
  'depthBlur',
  'tiltShiftMiniature',
  // Covered by unifiedGlow
  'bloom',
  'bioluminescence',
  'neonGlowEdges',
  'orton',
  // Covered by unifiedSketch
  'pencilSketch',
  'crosshatch',
  // Covered by unifiedPattern
  'halftone',
  'dotScreen',
  'stippling',
  'halftonePattern',
  // Covered by unifiedGlitch
  'rgbShift',
  'chromaticAberration',
  'scanLines',
  'glitchArt',
  'databending',
  'pixelSort',
  'chromaticGlitch',
  // Covered by unifiedVintage
  'sepia',
  'oldPhoto',
  'scratchedFilm',
  // Covered by unifiedWarp
  'pixelate',
  'swirl',
  'kaleidoscope',
  'kaleidoscopeFracture',
  'fisheyeWarp',
  'dispersionShatter',
  'mosaic',
  // Covered by unifiedMono
  'grayscale',
  'blackAndWhite',
  'duotone',
  // Covered by advancedDithering
  'atkinsonDithering',
  'orderedDithering',
  'blueNoiseDithering',
  'retroDithering',
  'retroPalette',
]);

// ============================================================================
// LEGACY EFFECT ALIASES
// ============================================================================
// These effects are now part of unified effects but kept for backwards compatibility.
// They won't appear in the UI but will still work if called directly.
export const legacyEffectAliases: Record<string, LegacyEffectAlias> = {
  // Blur aliases → unifiedBlur
  blur: { unified: 'unifiedBlur', preset: 0 }, // Gaussian
  bokeh: { unified: 'unifiedBlur', preset: 1 }, // Bokeh
  depthBlur: { unified: 'unifiedBlur', preset: 2 }, // Tilt-Shift
  tiltShiftMiniature: { unified: 'unifiedBlur', preset: 2 },

  // Glow aliases → unifiedGlow
  bloom: { unified: 'unifiedGlow', preset: 0 },
  neonGlowEdges: { unified: 'unifiedGlow', preset: 2 },
  halationGlow: { unified: 'unifiedGlow', preset: 4 },
  bioluminescence: { unified: 'unifiedGlow', preset: 3 },

  // Sketch aliases → unifiedSketch
  pencilSketch: { unified: 'unifiedSketch', preset: 0 },
  crosshatch: { unified: 'unifiedSketch', preset: 1 },
  etchedLines: { unified: 'unifiedSketch', preset: 2 },
  inkWash: { unified: 'unifiedSketch', preset: 3 },
  inkOutlinePop: { unified: 'unifiedSketch', preset: 4 },

  // Pattern aliases → unifiedPattern
  halftone: { unified: 'unifiedPattern', preset: 0 },
  dotScreen: { unified: 'unifiedPattern', preset: 1 },
  stippling: { unified: 'unifiedPattern', preset: 3 },

  // Glitch aliases → unifiedGlitch
  rgbShift: { unified: 'unifiedGlitch', preset: 0 },
  chromaticAberration: { unified: 'unifiedGlitch', preset: 1 },
  scanLines: { unified: 'unifiedGlitch', preset: 2 },
  glitchArt: { unified: 'unifiedGlitch', preset: 4 },
  chromaticGlitch: { unified: 'unifiedGlitch', preset: 4 },
  databending: { unified: 'unifiedGlitch', preset: 5 },
  pixelSort: { unified: 'unifiedGlitch', preset: 6 },

  // Vintage aliases → unifiedVintage
  sepia: { unified: 'unifiedVintage', preset: 0 },
  oldPhoto: { unified: 'unifiedVintage', preset: 1 },
  scratchedFilm: { unified: 'unifiedVintage', preset: 4 },
  retroRaster: { unified: 'unifiedVintage', preset: 2 },

  // Warp aliases → unifiedWarp
  pixelate: { unified: 'unifiedWarp', preset: 0 },
  swirl: { unified: 'unifiedWarp', preset: 1 },
  kaleidoscope: { unified: 'unifiedWarp', preset: 2 },
  kaleidoscopeFracture: { unified: 'unifiedWarp', preset: 2 },
  fisheyeWarp: { unified: 'unifiedWarp', preset: 3 },
  pixelExplosion: { unified: 'unifiedWarp', preset: 7 },
  dispersionShatter: { unified: 'unifiedWarp', preset: 7 },
  geometric: { unified: 'unifiedWarp', preset: 6 },

  // Mono aliases → unifiedMono
  grayscale: { unified: 'unifiedMono', preset: 0 },
  blackAndWhite: { unified: 'unifiedMono', preset: 1 },
  duotone: { unified: 'unifiedMono', preset: 2 },
  gradientMap: { unified: 'unifiedMono', preset: 4 },

  // Dithering aliases → advancedDithering
  retroDithering: { unified: 'advancedDithering', preset: 0 },
  atkinsonDithering: { unified: 'advancedDithering', preset: 1 },
  orderedDithering: { unified: 'advancedDithering', preset: 2 },
  blueNoiseDithering: { unified: 'advancedDithering', preset: 5 },
  halftonePattern: { unified: 'advancedDithering', preset: 2 },
  retroPalette: { unified: 'advancedDithering', preset: 1 },
  colorQuantization: { unified: 'advancedDithering', preset: 0 },
};

/**
 * Check if an effect is a legacy effect that's been unified
 */
export const isLegacyEffect = (effectId: string): boolean => {
  return hiddenLegacyEffects.has(effectId);
};

/**
 * Get the unified effect for a legacy effect
 */
export const getUnifiedEffect = (effectId: string): { unified: string; preset: number } | null => {
  return legacyEffectAliases[effectId] || null;
};

/**
 * Check if an effect should be hidden from the UI
 */
export const shouldHideFromUI = (effectId: string): boolean => {
  return hiddenLegacyEffects.has(effectId);
};
