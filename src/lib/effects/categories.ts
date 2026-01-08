'use client';

/**
 * Effect Categories
 * Defines the UI organization of effects by category
 */

import type { EffectCategory } from './types';

export const effectCategories: Record<string, EffectCategory> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // BASIC ADJUSTMENTS - Keep these separate for quick access
  // ─────────────────────────────────────────────────────────────────────────────
  Adjust: {
    icon: '⚙️',
    description: 'Basic image adjustments',
    effects: [
      'brightness',
      'contrast',
      'saturation',
      'hue',
      'colorTemperature',
      'dehaze',
      'relight',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIFIED STUDIOS - Rich preset-based effects with multiple variations
  // Each studio contains multiple presets accessible via a single control
  // ─────────────────────────────────────────────────────────────────────────────
  Studios: {
    icon: '🎨',
    description: 'Effect studios with multiple style presets',
    effects: [
      'unifiedBlur', // Gaussian, Bokeh, Tilt-Shift, Motion, Radial
      'unifiedGlow', // Bloom, Dreamy, Neon, Bioluminescence, Halation
      'unifiedSketch', // Pencil, Crosshatch, Etched, Ink Wash, Bold Outline
      'unifiedPattern', // Halftone, Dots, Screen, Dither, Stipple
      'unifiedGlitch', // RGB Shift, Chromatic, Scanlines, VHS, Databend, Pixel Sort
      'unifiedVintage', // Sepia, Old Photo, Faded, Cross Process, Scratched, Polaroid
      'unifiedWarp', // Pixelate, Swirl, Kaleidoscope, Fisheye, Spherize, Wave, Shatter
      'unifiedMono', // Grayscale, B&W, Duotone, Gradient Map
      'advancedDithering', // Floyd-Steinberg, Atkinson, Ordered, + Retro Palettes
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STYLIZE - Artistic painting and drawing effects
  // ─────────────────────────────────────────────────────────────────────────────
  Stylize: {
    icon: '🖌️',
    description: 'Artistic painting and stylization',
    effects: [
      'watercolor',
      'oilPainting',
      'toon',
      'posterEdges',
      'cutout',
      'stainedGlass',
      'crystallize',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // COLOR - Color grading and manipulation
  // ─────────────────────────────────────────────────────────────────────────────
  Color: {
    icon: '🎨',
    description: 'Color grading and manipulation',
    effects: [
      'invert',
      'toneCurve',
      'gradientMap',
      'cinematicLut',
      'selectiveColor',
      'colorQuantization',
      'heatmap',
      'thermalPalette',
      'holographicInterference',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXTURE - Overlays, patterns, and texture effects
  // ─────────────────────────────────────────────────────────────────────────────
  Texture: {
    icon: '📐',
    description: 'Textures, patterns, and noise',
    effects: [
      'noise',
      'fractalNoise',
      'chromaticGrain',
      'paperRelief',
      'weavePattern',
      'topographicContours',
      'cellular',
      'geometric',
      'voronoi',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SPECIAL FX - Unique simulation and experimental effects
  // ─────────────────────────────────────────────────────────────────────────────
  'Special FX': {
    icon: '✨',
    description: 'Special effects and simulations',
    effects: [
      'doubleExposure',
      'liquidMetal',
      'neuralDream',
      'magneticField',
      'inkBleed',
      'anaglyph',
      'asciiArt',
      'circuitBoard',
      'iridescentSheen',
      'crystalFacet',
      'paperCutArt',
      'pixelExplosion',
      'temporalEcho',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY - Edge detection, thresholds, etc.
  // ─────────────────────────────────────────────────────────────────────────────
  Utility: {
    icon: '🔧',
    description: 'Utility effects and edge detection',
    effects: ['threshold', 'posterize', 'edgeDetection', 'sharpen', 'vignette', 'lensFlare'],
  },
};

/**
 * Helper function to get category for an effect
 */
export const getEffectCategory = (effectId: string): string | null => {
  for (const [category, data] of Object.entries(effectCategories)) {
    if (data.effects.includes(effectId)) {
      return category;
    }
  }
  return null;
};

/**
 * Get all effects as a flat list
 */
export const getAllEffects = (): string[] => {
  const effects: string[] = [];
  for (const category of Object.values(effectCategories)) {
    effects.push(...category.effects);
  }
  return effects;
};

/**
 * Get effects for a specific category
 */
export const getEffectsForCategory = (categoryName: string): string[] => {
  return effectCategories[categoryName]?.effects || [];
};
