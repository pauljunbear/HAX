'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

// Import optimized blur utilities for performance
import { separableGaussianBlur, stackBlur, getBufferPool } from './performance';

// Define the structure for effect settings
interface EffectSetting {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
}

// Define the structure for effect configuration
interface EffectConfig {
  label: string;
  category: string;
  presetNames?: string[];
  settings?: EffectSetting[];
}

// Define interface for image data
interface KonvaImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type KonvaFilterFunction = (imageData: KonvaImageData) => void;
type FilterParams = Record<string, unknown>;

// Use a dynamic import approach for Konva to avoid SSR issues
// Import Konva only in browser environment
type KonvaModule = typeof import('konva') & { Filters: Record<string, KonvaFilterFunction> };
let Konva: KonvaModule | null = null;
let konvaInitPromise: Promise<typeof import('konva')> | null = null;
let filtersInitPromise: Promise<void> | null = null;

const ensureKonvaFiltersLoaded = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (filtersInitPromise) {
    return filtersInitPromise;
  }

  filtersInitPromise = (async () => {
    try {
      await Promise.all([
        import('konva/lib/filters/Blur'),
        import('konva/lib/filters/Brighten'),
        import('konva/lib/filters/Contrast'),
        import('konva/lib/filters/HSL'),
        import('konva/lib/filters/Pixelate'),
        import('konva/lib/filters/Noise'),
        import('konva/lib/filters/Grayscale'),
        import('konva/lib/filters/Sepia'),
        import('konva/lib/filters/Invert'),
        import('konva/lib/filters/Enhance'),
      ]);
    } catch (error) {
      console.warn('Some Konva filters failed to load.', error);
    }
  })();

  return filtersInitPromise;
};

const loadKonva = async () => {
  if (!konvaInitPromise) {
    konvaInitPromise = import('konva');
  }

  Konva = (await konvaInitPromise) as unknown as KonvaModule;
  await ensureKonvaFiltersLoaded();

  if (Konva && Konva.Filters) {
    // Register custom filters if needed
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (Konva as unknown as Record<string, unknown>).noop = () => {};
  }
};

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Generic clamp function
 */
const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

/**
 * Fast byte clamping (0-255) - optimized for hot paths
 * Uses bitwise operations for speed when possible
 */
const clampByte = (value: number): number => {
  return value < 0 ? 0 : value > 255 ? 255 : value | 0;
};

/**
 * Luminance calculation using standard coefficients (ITU-R BT.601)
 */
const getLuminance = (r: number, g: number, b: number): number => {
  return r * 0.299 + g * 0.587 + b * 0.114;
};

/**
 * Normalized luminance (0-1)
 */
const getNormalizedLuminance = (r: number, g: number, b: number): number => {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
};

/**
 * Linear interpolation
 */
const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

// Helper to blend effect result with original based on opacity
const applyOpacityBlend = (
  data: Uint8ClampedArray,
  original: Uint8ClampedArray,
  opacity: number
): void => {
  if (opacity >= 1) return; // No blending needed
  const blend = opacity;
  const invBlend = 1 - blend;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(original[i] * invBlend + data[i] * blend);
    data[i + 1] = Math.round(original[i + 1] * invBlend + data[i + 1] * blend);
    data[i + 2] = Math.round(original[i + 2] * invBlend + data[i + 2] * blend);
    // Alpha stays unchanged
  }
};

/**
 * Get buffer from pool or create new one
 * Always use this instead of `new Uint8ClampedArray(size)`
 */
const acquireBuffer = (size: number): Uint8ClampedArray => {
  return getBufferPool().acquire(size);
};

/**
 * Return buffer to pool for reuse
 */
const releaseBuffer = (buffer: Uint8ClampedArray): void => {
  getBufferPool().release(buffer);
};

/**
 * Acquire buffer and copy source data into it
 */
const acquireBufferCopy = (source: Uint8ClampedArray): Uint8ClampedArray => {
  const buffer = getBufferPool().acquire(source.length);
  buffer.set(source);
  return buffer;
};

const createPosterizeFallback = (levels: number, opacity: number = 1): KonvaFilterFunction => {
  const normalizedLevels = clamp(Math.floor(levels), 2, 32);
  const step = 255 / (normalizedLevels - 1);

  return imageData => {
    const { data } = imageData;
    const pool = getBufferPool();
    const original = opacity < 1 ? pool.acquire(data.length) : null;

    try {
      if (original) {
        original.set(data);
      }

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(Math.round(data[i] / step) * step);
        data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
        data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
      }

      if (original) {
        applyOpacityBlend(data, original, opacity);
      }
    } finally {
      if (original) {
        pool.release(original);
      }
    }
  };
};

const createThresholdFallback = (threshold: number): KonvaFilterFunction => {
  const level = clamp(threshold, 0, 1);

  return imageData => {
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const value = brightness >= level ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  };
};

const createBlurFallback = (radius: number): KonvaFilterFunction => {
  const clampedRadius = clamp(Math.round(radius), 1, 100);

  return imageData => {
    const { data, width, height } = imageData;
    if (clampedRadius <= 0 || width === 0 || height === 0) {
      return;
    }

    // Use optimized separable blur for better performance
    // This is O(n²×2r) instead of O(n²×r²)
    stackBlur(data, width, height, clampedRadius);
  };
};

const screenBlend = (base: number, overlay: number) => 255 - ((255 - base) * (255 - overlay)) / 255;

const overlayBlend = (base: number, overlay: number) =>
  base < 128 ? (2 * base * overlay) / 255 : 255 - (2 * (255 - base) * (255 - overlay)) / 255;

const softLightBlend = (base: number, overlay: number) => {
  const normalizedOverlay = overlay / 255;
  return Math.round(
    base * (1 - normalizedOverlay) +
      (base < 128
        ? (2 * normalizedOverlay - 1) * (base / 255) * base + base
        : (2 * normalizedOverlay - 1) * (Math.sqrt(base / 255) - base / 255) * 255 + base)
  );
};

const createOrtonFallback = (settings: Record<string, number>): KonvaFilterFunction => {
  const blurRadius = clamp(settings.blur ?? 5, 1, 100);
  const brightness = clamp(settings.brightness ?? 0.2, 0, 1);
  const glow = clamp(settings.glow ?? 0.5, 0, 1);
  const blendMode = Math.round(clamp(settings.blendMode ?? 0, 0, 2));

  return imageData => {
    const { data, width, height } = imageData;
    if (width === 0 || height === 0) {
      return;
    }

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      // Use optimized separable blur
      stackBlur(blurred, width, height, blurRadius);

      const blendChannel = (base: number, overlay: number) => {
        switch (blendMode) {
          case 1:
            return overlayBlend(base, overlay);
          case 2:
            return softLightBlend(base, overlay);
          default:
            return screenBlend(base, overlay);
        }
      };

      const brightnessMultiplier = 1 + brightness * 0.8;

      for (let i = 0; i < data.length; i += 4) {
        const r = original[i];
        const g = original[i + 1];
        const b = original[i + 2];
        const a = original[i + 3];

        const blurredR = blurred[i];
        const blurredG = blurred[i + 1];
        const blurredB = blurred[i + 2];

        const glowR = blendChannel(r, blurredR);
        const glowG = blendChannel(g, blurredG);
        const glowB = blendChannel(b, blurredB);

        const mixedR = clamp(Math.round(r * (1 - glow) + glowR * glow), 0, 255);
        const mixedG = clamp(Math.round(g * (1 - glow) + glowG * glow), 0, 255);
        const mixedB = clamp(Math.round(b * (1 - glow) + glowB * glow), 0, 255);

        data[i] = clamp(Math.round(mixedR * brightnessMultiplier), 0, 255);
        data[i + 1] = clamp(Math.round(mixedG * brightnessMultiplier), 0, 255);
        data[i + 2] = clamp(Math.round(mixedB * brightnessMultiplier), 0, 255);
        data[i + 3] = a;
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};

// Helper function to calculate average brightness of an area
function getBrightness(
  imageData: ImageData,
  x: number,
  y: number,
  size: number,
  width: number,
  height: number
) {
  let totalBrightness = 0;
  let pixelCount = 0;

  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width, x + size);
  const endY = Math.min(height, y + size);

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const i = (py * width + px) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }
  }

  return pixelCount > 0 ? totalBrightness / pixelCount : 0;
}

// lerp function defined in utilities section above

// Update applyEffect signature and logic
export const applyEffect = async (
  effectName: string | null,
  settings: Record<string, number>
  // Return the Konva Filter function and parameters object
): Promise<[KonvaFilterFunction | null, FilterParams | null]> => {
  if (!effectName || typeof window === 'undefined') {
    return [null, null];
  }

  // Ensure Konva is initialized
  if (!Konva) {
    try {
      await loadKonva();
    } catch (err) {
      return [null, null];
    }
    if (!Konva) {
      return [null, null];
    }
  }

  try {
    switch (effectName) {
      case 'brightness': {
        // Convert from percentage (-100 to 100) to Konva range (-1 to 1)
        const brightnessValue = (settings.value ?? 0) / 100;
        return [Konva.Filters.Brighten, { brightness: brightnessValue }];
      }

      case 'contrast': {
        // Contrast already uses -100 to 100 range
        const contrastValue = settings.value ?? 0;
        return [Konva.Filters.Contrast, { contrast: contrastValue }];
      }

      case 'saturation': {
        // Convert from percentage (-100 to 100) to Konva range (-10 to 10)
        const scaledSaturation = (settings.value ?? 0) / 10;
        return [Konva.Filters.HSL, { saturation: scaledSaturation }];
      }

      case 'hue': {
        const hueDegrees = settings.value !== undefined ? settings.value : 0;
        return [Konva.Filters.HSL, { hue: hueDegrees }];
      }

      case 'blur': {
        const radius = settings.radius ?? settings.value ?? 5;
        const konvaBlur = Konva.Filters?.Blur;
        if (konvaBlur) {
          return [konvaBlur, { blurRadius: radius }];
        }
        return [createBlurFallback(radius), null];
      }

      case 'sharpen':
        return [Konva.Filters.Enhance, { enhance: (settings.value ?? 0) * 0.5 }]; // Enhance seems closer to sharpen

      case 'pixelate':
        return [Konva.Filters.Pixelate, { pixelSize: settings.pixelSize ?? 8 }];

      case 'noise':
        return [Konva.Filters.Noise, { noise: settings.value ?? 0.2 }];

      case 'threshold': {
        const value = settings.value ?? 0.5;
        return [createThresholdFallback(value), null];
      }

      case 'posterize': {
        const levels = settings.levels ?? 4;
        const opacity = settings.opacity ?? 1;
        return [createPosterizeFallback(levels, opacity), null];
      }

      case 'grayscale':
        return [Konva.Filters.Grayscale, {}];

      case 'blackAndWhite':
        return [createBlackAndWhiteEffect(settings), {}];

      case 'sepia':
        return [Konva.Filters.Sepia, {}];

      case 'unifiedMono':
        return [createUnifiedMonoEffect(settings), {}];

      case 'invert':
        return [Konva.Filters.Invert, {}];

      // Keep custom filters for ones Konva doesn't have built-in
      case 'pencilSketch':
        return [createPencilSketchEffect(settings), {}];
      case 'unifiedSketch':
        return [createUnifiedSketchEffect(settings), {}];
      case 'halftone':
        return [createHalftoneEffect(settings), {}];
      case 'unifiedPattern':
        return [createUnifiedPatternEffect(settings), {}];
      case 'duotone':
        return [createDuotoneEffect(settings), {}];
      case 'bloom':
        return [createBloomEffect(settings), {}];
      case 'unifiedGlow':
        return [createUnifiedGlowEffect(settings), {}];
      case 'oilPainting': // Kuwahara
        return [createKuwaharaEffect(settings), {}];
      case 'geometric':
        return [createGeometricAbstraction(settings), {}];
      case 'stippling':
        return [createStipplingEffect(settings), {}];
      case 'cellular':
        return [createCellularAutomataEffect(settings), {}];
      case 'vignette':
        return [createVignetteEffect(settings), {}];
      case 'chromaticAberration':
        return [createChromaticAberrationEffect(settings), {}];
      case 'scanLines':
        return [createScanLinesEffect(settings), {}];

      // Add cases for the newly added effects
      case 'crosshatch':
        return [createCrosshatchEffect(settings), {}];
      case 'dotScreen':
        return [createDotScreenEffect(settings), {}];
      case 'oldPhoto':
        return [createOldPhotoEffect(settings), {}];
      case 'pixelSort':
        return [createPixelSortEffect(settings), {}];
      case 'rgbShift':
        return [createRgbShiftEffect(settings), {}];

      // --- Add cases for NEW effects ---
      case 'glitchArt':
        return [createGlitchArtEffect(settings), {}];
      case 'colorQuantization':
        return [createColorQuantizationEffect(settings), {}];
      case 'asciiArt':
        return [createAsciiArtEffect(settings), {}];
      case 'edgeDetection':
        return [createEdgeDetectionEffect(settings), {}];
      case 'swirl':
        return [createSwirlEffect(settings), {}];
      case 'lensFlare':
        return [createLensFlareEffect(settings), {}];
      case 'colorTemperature':
        return [createColorTemperatureEffect(settings), {}];
      case 'mosaic':
        return [createMosaicEffect(settings), {}];
      case 'selectiveColor':
        return [createSelectiveColorEffect(settings), {}];
      case 'fractalNoise':
        return [createFractalNoiseEffect(settings), {}];
      // --- END NEW effects cases ---

      // --- Add cases for MORE UNIQUE effects ---
      case 'voronoi':
        return [createVoronoiEffect(settings), {}];

      case 'kaleidoscope':
        return [createKaleidoscopeEffect(settings), {}];
      case 'inkBleed':
        return [createInkBleedEffect(settings), {}];
      case 'heatmap':
        return [createHeatmapEffect(settings), {}];
      case 'anaglyph':
        return [createAnaglyphEffect(settings), {}];
      case 'iridescentSheen':
        return [createIridescentSheenEffect(settings), {}];
      case 'chromaticGrain':
        return [createChromaticGrainEffect(settings), {}];
      case 'halationGlow':
        return [createHalationGlowEffect(settings), {}];
      case 'etchedLines':
        return [createEtchedLinesEffect(settings), {}];
      case 'inkWash':
        return [createInkWashEffect(settings), {}];
      case 'retroRaster':
        return [createRetroRasterEffect(settings), {}];
      case 'crystalFacet':
        return [createCrystalFacetEffect(settings), {}];
      case 'thermalPalette':
        return [createThermalPaletteEffect(settings), {}];
      case 'paperRelief':
        return [createPaperReliefEffect(settings), {}];
      case 'inkOutlinePop':
        return [createInkOutlinePopEffect(settings), {}];
      case 'scratchedFilm':
        return [createScratchedFilmEffect(settings), {}];
      case 'circuitBoard':
        return [createCircuitBoardEffect(settings), {}];
      case 'pixelExplosion':
        return [createPixelExplosionEffect(settings), {}];
      case 'fisheyeWarp':
        return [createFisheyeWarpEffect(settings), {}];

      // --- MORE UNIQUE EFFECTS END HERE ---

      // --- NEW UNIQUE EFFECTS ---
      case 'chromaticGlitch':
        return [createChromaticGlitchEffect(settings), {}];
      case 'liquidMetal':
        return [createLiquidMetalEffect(settings), {}];
      case 'temporalEcho':
        return [createTemporalEchoEffect(settings), {}];
      case 'kaleidoscopeFracture':
        return [createKaleidoscopeFractureEffect(settings), {}];
      case 'neuralDream':
        return [createNeuralDreamEffect(settings), {}];
      case 'holographicInterference':
        return [createHolographicInterferenceEffect(settings), {}];
      case 'magneticField':
        return [createMagneticFieldEffect(settings), {}];
      case 'databending':
        return [createDatabendingEffect(settings), {}];

      // --- NEW 10 EFFECTS ---
      case 'paperCutArt':
        return [createPaperCutArtEffect(settings), {}];
      case 'tiltShiftMiniature':
        return [createTiltShiftMiniatureEffect(settings), {}];
      case 'neonGlowEdges':
        return [createNeonGlowEdgesEffect(settings), {}];
      case 'dispersionShatter':
        return [createDispersionShatterEffect(settings), {}];
      case 'retroDithering':
        return [createRetroDitheringEffect(settings), {}];
      case 'advancedDithering':
        return [createAdvancedDitheringEffect(settings), {}];
      case 'atkinsonDithering':
        return [createAtkinsonDitheringEffect(settings), {}];
      case 'orderedDithering':
        return [createOrderedDitheringEffect(settings), {}];
      case 'blueNoiseDithering':
        return [createBlueNoiseDitheringEffect(settings), {}];
      case 'halftonePattern':
        return [createHalftonePatternEffect(settings), {}];
      case 'retroPalette':
        return [createRetroPaletteEffect(settings), {}];
      case 'topographicContours':
        return [createTopographicContoursEffect(settings), {}];
      case 'weavePattern':
        return [createWeavePatternEffect(settings), {}];
      case 'bioluminescence':
        return [createBioluminescenceEffect(settings), {}];

      // --- NEW UNIFIED EFFECTS ---
      case 'unifiedGlitch':
        return [createUnifiedGlitchEffect(settings), {}];
      case 'unifiedVintage':
        return [createUnifiedVintageEffect(settings), {}];
      case 'unifiedWarp':
        return [createUnifiedWarpEffect(settings), {}];
      case 'unifiedBlur':
        return [createUnifiedBlurEffect(settings), {}];

      // --- NEW POPULAR EFFECTS ---
      case 'watercolor':
        return [createWatercolorEffect(settings), {}];
      case 'cutout':
        return [createCutoutEffect(settings), {}];
      case 'stainedGlass':
        return [createStainedGlassEffect(settings), {}];
      case 'posterEdges':
        return [createPosterEdgesEffect(settings), {}];
      case 'toon':
        return [createToonEffect(settings), {}];
      case 'gradientMap':
        return [createGradientMapEffect(settings), {}];
      case 'bokeh':
        return [createBokehEffect(settings), {}];
      case 'doubleExposure':
        return [createDoubleExposureEffect(settings), {}];
      case 'toneCurve':
        return [createToneCurveEffect(settings), {}];
      case 'cinematicLut':
        return [createCinematicLutEffect(settings), {}];
      case 'dehaze':
        return [createDehazeEffect(settings), {}];
      case 'depthBlur':
        return [createDepthBlurEffect(settings), {}];
      case 'relight':
        return [createRelightEffect(settings), {}];

      // 3D Effects - DISABLED due to poor user experience
      case 'threeDPlane':
      case 'threeDCube':
      case 'threeDTilt':
      case 'threeDParallax':
        console.warn(`3D effect '${effectName}' has been disabled due to poor user experience`);
        return [null, null];

      // Orton Effect Implementation
      case 'orton':
        return [
          Konva?.Filters?.Orton ?? createOrtonFallback(settings),
          Konva?.Filters?.Orton ? {} : null,
        ];

      default:
        console.warn(`Unknown effect or no Konva filter: ${effectName}`);
        return [null, null];
    }
  } catch (error) {
    console.error(`Error getting filter for ${effectName}:`, error);
    return [null, null];
  }
};

// Implementation of geometric abstraction effect
const createGeometricAbstraction = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const gridSize = Math.max(1, Math.min(64, settings.gridSize || 16));
    const complexity = Math.max(0, Math.min(1, settings.complexity || 0.5));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
          for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            r += tempData[index];
            g += tempData[index + 1];
            b += tempData[index + 2];
            count++;
          }
        }

        if (count === 0) continue;

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const brightness = (r + g + b) / 3 / 255;
        const rand = Math.random();

        switch (Math.floor((rand / (1 - complexity)) * 4) % 4) {
          case 0:
            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const index = ((y + cy) * width + (x + cx)) * 4;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
              }
            }
            break;

          case 1:
            const radius = (gridSize / 2) * (0.5 + brightness * 0.5);
            const centerX = x + gridSize / 2;
            const centerY = y + gridSize / 2;

            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const dx = x + cx - centerX;
                const dy = y + cy - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= radius) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;

          case 2:
            const halfGrid = gridSize / 2;

            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              const rowY = cy / gridSize;
              const rowWidth = gridSize * rowY;

              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                if (cx >= halfGrid - rowWidth / 2 && cx <= halfGrid + rowWidth / 2) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;

          case 3:
            const mid = gridSize / 2;

            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const dx = Math.abs(cx - mid);
                const dy = Math.abs(cy - mid);

                if (dx + dy <= mid * (0.5 + brightness * 0.5)) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;
        }
      }
    }
  };
};
// Implementation of stippling effect
const createStipplingEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const density = Math.max(0.1, Math.min(10, settings.density || 1));
    const dotSize = Math.max(0.5, Math.min(5, settings.dotSize || 1));
    const useHatching = settings.useHatching || 0;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }

    const baseSpacing = 10 / density;
    const maxDots = Math.ceil(((width * height) / (baseSpacing * baseSpacing)) * 5);

    for (let i = 0; i < maxDots; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      const index = (y * width + x) * 4;
      const r = tempData[index];
      const g = tempData[index + 1];
      const b = tempData[index + 2];
      const brightness = (r + g + b) / 3 / 255;

      if (Math.random() > (1 - brightness) * density) continue;

      if (useHatching > 0.5) {
        const lineLength = Math.floor(5 + 10 * (1 - brightness));
        const angle = Math.PI * (brightness < 0.5 ? 0.25 : -0.25);

        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        for (let j = -lineLength / 2; j < lineLength / 2; j++) {
          const px = Math.floor(x + j * dx);
          const py = Math.floor(y + j * dy);

          if (px < 0 || px >= width || py < 0 || py >= height) continue;

          const pixelIndex = (py * width + px) * 4;
          data[pixelIndex] = data[pixelIndex + 1] = data[pixelIndex + 2] = 0;
        }
      } else {
        const radius = dotSize * (1 - brightness) + 0.5;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              const px = Math.floor(x + dx);
              const py = Math.floor(y + dy);

              if (px < 0 || px >= width || py < 0 || py >= height) continue;

              const pixelIndex = (py * width + px) * 4;
              data[pixelIndex] = data[pixelIndex + 1] = data[pixelIndex + 2] = 0;
            }
          }
        }
      }
    }
  };
};
// Implementation of cellular automata effect (Conway's Game of Life)
const createCellularAutomataEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const threshold = Math.max(0.1, Math.min(0.9, settings.threshold || 0.5));
    const iterations = Math.max(1, Math.min(10, Math.floor(settings.iterations || 3)));
    const cellSize = Math.max(1, Math.min(8, Math.floor(settings.cellSize || 2)));

    const cellWidth = Math.ceil(width / cellSize);
    const cellHeight = Math.ceil(height / cellSize);
    let grid = new Uint8Array(cellWidth * cellHeight);

    for (let cy = 0; cy < cellHeight; cy++) {
      for (let cx = 0; cx < cellWidth; cx++) {
        let totalBrightness = 0;
        let count = 0;

        for (let y = 0; y < cellSize && cy * cellSize + y < height; y++) {
          for (let x = 0; x < cellSize && cx * cellSize + x < width; x++) {
            const imgX = cx * cellSize + x;
            const imgY = cy * cellSize + y;
            const index = (imgY * width + imgX) * 4;

            const r = tempData[index];
            const g = tempData[index + 1];
            const b = tempData[index + 2];
            const brightness = (r + g + b) / 3 / 255;

            totalBrightness += brightness;
            count++;
          }
        }

        const avgBrightness = count > 0 ? totalBrightness / count : 0;
        grid[cy * cellWidth + cx] = avgBrightness < threshold ? 1 : 0;
      }
    }

    for (let iter = 0; iter < iterations; iter++) {
      const newGrid = new Uint8Array(cellWidth * cellHeight);

      for (let cy = 0; cy < cellHeight; cy++) {
        for (let cx = 0; cx < cellWidth; cx++) {
          const idx = cy * cellWidth + cx;
          const cell = grid[idx];

          let liveNeighbors = 0;
          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue;

              const ncy = (cy + ny + cellHeight) % cellHeight;
              const ncx = (cx + nx + cellWidth) % cellWidth;

              if (grid[ncy * cellWidth + ncx] === 1) {
                liveNeighbors++;
              }
            }
          }

          if (cell === 1) {
            newGrid[idx] = liveNeighbors === 2 || liveNeighbors === 3 ? 1 : 0;
          } else {
            newGrid[idx] = liveNeighbors === 3 ? 1 : 0;
          }
        }
      }

      grid = newGrid;
    }

    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }

    for (let cy = 0; cy < cellHeight; cy++) {
      for (let cx = 0; cx < cellWidth; cx++) {
        const cell = grid[cy * cellWidth + cx];

        if (cell === 1) {
          for (let y = 0; y < cellSize && cy * cellSize + y < height; y++) {
            for (let x = 0; x < cellSize && cx * cellSize + x < width; x++) {
              const imgX = cx * cellSize + x;
              const imgY = cy * cellSize + y;
              const index = (imgY * width + imgX) * 4;

              data[index] = data[index + 1] = data[index + 2] = 0;
            }
          }
        }
      }
    }
  };
};

// Implementation of reaction-diffusion effect (Gray-Scott model)
// Note: This basic implementation is kept for fallback purposes.
// The advanced implementation is in ./effects/reactionDiffusionEffect.ts
// REMOVED: createReactionDiffusionEffect - unused dead code

// Add new effect function for Pencil Sketch
const createPencilSketchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;

    const intensity = clamp(settings.intensity ?? 1.0, 0.1, 2.0);
    const lineWeight = clamp(settings.lineWeight ?? 2, 1, 5);
    const contrast = clamp(settings.contrast ?? 1.2, 0.5, 2.0);

    // Map intensity's 0.1–2 range into a stable 0–1 blend.
    const mix = clamp((intensity - 0.1) / 1.9, 0, 1);
    const blurRadius = Math.max(1, Math.round(1 + lineWeight * 2));

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const gray = pool.acquire(data.length);
    const inverted = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);

      // Grayscale (preserve alpha)
      for (let i = 0; i < data.length; i += 4) {
        const a = original[i + 3];
        if (a === 0) {
          gray[i] = 0;
          gray[i + 1] = 0;
          gray[i + 2] = 0;
          gray[i + 3] = 0;
          continue;
        }

        const g = original[i] * 0.299 + original[i + 1] * 0.587 + original[i + 2] * 0.114;
        gray[i] = gray[i + 1] = gray[i + 2] = g;
        gray[i + 3] = a;
      }

      // Invert the grayscale image
      for (let i = 0; i < data.length; i += 4) {
        const a = gray[i + 3];
        if (a === 0) {
          inverted[i] = 0;
          inverted[i + 1] = 0;
          inverted[i + 2] = 0;
          inverted[i + 3] = 0;
          continue;
        }

        inverted[i] = 255 - gray[i];
        inverted[i + 1] = 255 - gray[i + 1];
        inverted[i + 2] = 255 - gray[i + 2];
        inverted[i + 3] = a;
      }

      // Blur the inverted image; lineWeight controls blur radius -> perceived line thickness
      blurred.set(inverted);
      stackBlur(blurred, width, height, blurRadius);

      // Color dodge blend (classic pencil sketch technique)
      for (let i = 0; i < data.length; i += 4) {
        const a = original[i + 3];
        if (a === 0) continue;

        const base = gray[i];
        const blend = blurred[i];
        const denom = Math.max(1, 255 - blend);
        const dodge = clamp((base * 255) / denom, 0, 255);

        let out = lerp(base, dodge, mix);
        out = (out - 128) * contrast + 128;
        out = clamp(out, 0, 255);

        data[i] = out;
        data[i + 1] = out;
        data[i + 2] = out;
        data[i + 3] = a;
      }
    } finally {
      pool.release(original);
      pool.release(gray);
      pool.release(inverted);
      pool.release(blurred);
    }
  };
};

/**
 * Unified Sketch Effect - Combines multiple sketch styles into one configurable effect
 * Styles: 0=Pencil, 1=Crosshatch, 2=Etched Lines, 3=Ink Wash, 4=Bold Outline
 */
const createUnifiedSketchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const style = Math.floor(settings.style ?? 0);
    const lineWeight = settings.lineWeight ?? 2;
    const density = (settings.density ?? 60) / 100;
    const contrast = (settings.contrast ?? 120) / 100;
    const invert = (settings.invert ?? 0) === 1;
    const opacity = settings.opacity ?? 1;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const originalForBlend = opacity < 1 ? pool.acquire(data.length) : null;

    try {
      original.set(data);
      if (originalForBlend) originalForBlend.set(data);

      // Convert to grayscale first
      for (let i = 0; i < data.length; i += 4) {
        const gray = original[i] * 0.299 + original[i + 1] * 0.587 + original[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }

      // Sobel kernels for edge detection
      const sobelX = [-1, 0, 1, -2 * lineWeight, 0, 2 * lineWeight, -1, 0, 1];
      const sobelY = [-1, -2 * lineWeight, -1, 0, 0, 0, 1, 2 * lineWeight, 1];

      // Apply style-specific processing
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0,
            gy = 0;

          // Edge detection
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              gx += data[idx] * sobelX[kernelIdx];
              gy += data[idx] * sobelY[kernelIdx];
            }
          }

          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const angle = Math.atan2(gy, gx);
          const idx = (y * width + x) * 4;
          let value = 255;

          switch (style) {
            case 0: // Pencil
              value = 255 - magnitude * density;
              break;

            case 1: // Crosshatch
              const hatchAngle1 = Math.PI / 4;
              const hatchAngle2 = -Math.PI / 4;
              const hatch1 = Math.sin((x + y) * density * 0.5);
              const hatch2 = Math.sin((x - y) * density * 0.5);
              const hatchValue =
                magnitude > 30 * density ? (hatch1 > 0 || hatch2 > 0 ? 0 : 255) : 255;
              value = hatchValue;
              break;

            case 2: // Etched Lines
              const lineAngle = Math.sin(angle * 3) * 0.5 + 0.5;
              value = (255 - magnitude * lineAngle * density) * contrast;
              break;

            case 3: // Ink Wash
              const gray =
                original[idx] * 0.299 + original[idx + 1] * 0.587 + original[idx + 2] * 0.114;
              const inkFactor = (gray / 255) * density;
              const bleed = (Math.random() - 0.5) * 30 * (1 - density);
              value = gray * inkFactor + bleed;
              break;

            case 4: // Bold Outline
              value = magnitude > 40 * density ? 0 : 255;
              break;
          }

          // Apply contrast
          value = (value - 128) * contrast + 128;
          value = clampByte(value);

          // Invert if requested
          if (invert) value = 255 - value;

          data[idx] = data[idx + 1] = data[idx + 2] = value;
        }
      }

      // Apply opacity blending with original
      if (originalForBlend) {
        applyOpacityBlend(data, originalForBlend, opacity);
      }
    } finally {
      pool.release(original);
      if (originalForBlend) pool.release(originalForBlend);
    }
  };
};

// Add new effect function for Halftone
const createHalftoneEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Map 1-10 to more dramatic ranges: dotSize 2-20, spacing 4-30
    const dotSizeInput = settings.dotSize || 4;
    const spacingInput = settings.spacing || 5;
    const opacity = settings.opacity ?? 1;

    const dotSize = Math.floor(2 + ((dotSizeInput - 1) / 9) * 18); // 2 to 20
    const spacing = Math.floor(4 + ((spacingInput - 1) / 14) * 26); // 4 to 30
    const angle = (settings.angle || 45) * (Math.PI / 180);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Keep canvas transparent - don't fill with background color
    // This preserves PNG transparency

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Store original data for color sampling, alpha preservation, and opacity blending
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    const originalForBlend = opacity < 1 ? new Uint8ClampedArray(data) : null;

    // Create an alpha mask canvas to track which pixels should be visible
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = width;
    alphaCanvas.height = height;
    const alphaCtx = alphaCanvas.getContext('2d');
    if (!alphaCtx) return;

    for (let y = 0; y < height; y += spacing) {
      for (let x = 0; x < width; x += spacing) {
        const rotatedX = x * cosAngle - y * sinAngle;
        const rotatedY = x * sinAngle + y * cosAngle;

        const centerX =
          Math.round(rotatedX / spacing) * spacing * cosAngle +
          Math.round(rotatedY / spacing) * spacing * sinAngle;
        const centerY =
          Math.round(rotatedY / spacing) * spacing * cosAngle -
          Math.round(rotatedX / spacing) * spacing * sinAngle;

        if (centerX < 0 || centerX >= width || centerY < 0 || centerY >= height) continue;

        const originalIndex = (Math.floor(centerY) * width + Math.floor(centerX)) * 4;
        const r = tempData[originalIndex];
        const g = tempData[originalIndex + 1];
        const b = tempData[originalIndex + 2];
        const alpha = tempData[originalIndex + 3];

        // Skip fully transparent pixels - preserve PNG transparency
        if (alpha === 0) continue;

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const radius = (1 - brightness) * dotSize;

        if (radius > 0.8) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
          // Ink color - very dark blue-black for newspaper look
          // Use the original alpha value to preserve transparency
          ctx.fillStyle = `rgba(10, 10, 18, ${alpha / 255})`;
          ctx.fill();
        }

        // Draw cream/paper color in the alpha mask for visible areas
        // This creates the paper background only where the image exists
        alphaCtx.beginPath();
        alphaCtx.arc(centerX, centerY, spacing / 2, 0, 2 * Math.PI, false);
        alphaCtx.fillStyle = `rgba(250, 248, 245, ${alpha / 255})`;
        alphaCtx.fill();
      }
    }

    // Get the paper background data
    const paperData = alphaCtx.getImageData(0, 0, width, height).data;
    const halftoneData = ctx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < data.length; i += 4) {
      const originalAlpha = tempData[i + 3];

      // Only apply effect where original image had content
      if (originalAlpha > 0) {
        // Blend paper background with halftone dots
        const paperR = paperData[i];
        const paperG = paperData[i + 1];
        const paperB = paperData[i + 2];
        const paperA = paperData[i + 3];

        const dotR = halftoneData[i];
        const dotG = halftoneData[i + 1];
        const dotB = halftoneData[i + 2];
        const dotA = halftoneData[i + 3];

        // If there's a dot, use dot color, otherwise use paper color
        if (dotA > 0) {
          data[i] = dotR;
          data[i + 1] = dotG;
          data[i + 2] = dotB;
          data[i + 3] = originalAlpha;
        } else if (paperA > 0) {
          data[i] = paperR;
          data[i + 1] = paperG;
          data[i + 2] = paperB;
          data[i + 3] = originalAlpha;
        } else {
          // Fallback to cream paper color for visible pixels
          data[i] = 250;
          data[i + 1] = 248;
          data[i + 2] = 245;
          data[i + 3] = originalAlpha;
        }
      }
      // Transparent pixels (originalAlpha === 0) are left unchanged
    }

    // Apply opacity blending with original
    if (originalForBlend) {
      applyOpacityBlend(data, originalForBlend, opacity);
    }
  };
};

/**
 * Unified Pattern Effect - Combines multiple pattern styles
 * Patterns: 0=Dots (Halftone), 1=Screen, 2=Dither, 3=Stipple
 */
const createUnifiedPatternEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const pattern = Math.floor(settings.pattern ?? 0);
    const size = Math.max(2, Math.min(100, settings.size ?? 8));
    const density = (settings.density ?? 50) / 100;
    const angle = ((settings.angle ?? 45) * Math.PI) / 180;
    const colorMode = Math.floor(settings.colorMode ?? 0);
    const opacity = settings.opacity ?? 1;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);

    try {
      original.set(data);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Clear to white/paper color for B&W mode
      if (colorMode === 0) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i + 1] = data[i + 2] = 255;
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = original[idx];
          const g = original[idx + 1];
          const b = original[idx + 2];
          const alpha = original[idx + 3];

          if (alpha === 0) continue;

          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

          // Rotate coordinates for angled patterns
          const rx = x * cos + y * sin;
          const ry = -x * sin + y * cos;

          let shouldDraw = false;

          switch (pattern) {
            case 0: // Dots (Halftone)
              const cellX = Math.floor(rx / size);
              const cellY = Math.floor(ry / size);
              const centerX = (cellX + 0.5) * size;
              const centerY = (cellY + 0.5) * size;
              const dist = Math.sqrt(Math.pow(rx - centerX, 2) + Math.pow(ry - centerY, 2));
              const maxRadius = (size / 2) * (1 - brightness) * density;
              shouldDraw = dist < maxRadius;
              break;

            case 1: // Screen
              const screenX = (rx % size) / size;
              const screenY = (ry % size) / size;
              shouldDraw = screenX + screenY < (2 - brightness * 2) * density;
              break;

            case 2: // Dither (Bayer matrix approximation)
              const ditherX = Math.floor(rx) % 4;
              const ditherY = Math.floor(ry) % 4;
              const bayerValue = ((ditherX + ditherY * 4) * 17) % 255;
              shouldDraw = (1 - brightness) * 255 * density > bayerValue;
              break;

            case 3: // Stipple
              const randomValue = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
              const rand = randomValue - Math.floor(randomValue);
              shouldDraw = rand < (1 - brightness) * density;
              break;
          }

          if (shouldDraw) {
            if (colorMode === 0) {
              // B&W mode - draw black
              data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
              // Color mode - keep original but darken
              data[idx] = r * 0.2;
              data[idx + 1] = g * 0.2;
              data[idx + 2] = b * 0.2;
            }
          } else if (colorMode === 1) {
            // Color mode - lighten non-drawn areas
            data[idx] = Math.min(255, r + (255 - r) * 0.8);
            data[idx + 1] = Math.min(255, g + (255 - g) * 0.8);
            data[idx + 2] = Math.min(255, b + (255 - b) * 0.8);
          }
          data[idx + 3] = alpha;
        }
      }

      // Apply opacity blending with original
      if (opacity < 1) {
        applyOpacityBlend(data, original, opacity);
      }
    } finally {
      pool.release(original);
    }
  };
};

// Black & White effect with adjustable contrast and brightness
const createBlackAndWhiteEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const contrast = settings.contrast ?? 1.2;
    const brightness = settings.brightness ?? 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale using luminance formula
      let gray = r * 0.299 + g * 0.587 + b * 0.114;

      // Apply brightness adjustment
      gray = gray + brightness * 255;

      // Apply contrast adjustment (centered at 128)
      gray = (gray - 128) * contrast + 128;

      // Clamp to valid range
      gray = clampByte(gray);

      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      // Preserve alpha channel
    }
  };
};

/**
 * Unified Monochrome Effect - Combines multiple monochrome styles
 * Tones: 0=Gray, 1=Sepia, 2=Cyanotype, 3=Cool Blue, 4=Warm
 */
const createUnifiedMonoEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const tone = Math.floor(settings.tone ?? 0);
    const intensity = (settings.intensity ?? 100) / 100;
    const contrast = (settings.contrast ?? 100) / 100;
    const brightness = (settings.brightness ?? 0) / 100;

    // Tone color mappings (for highlights and shadows)
    const toneColors = [
      { h: [1.0, 1.0, 1.0], s: [0.0, 0.0, 0.0] }, // Gray: neutral
      { h: [1.1, 0.95, 0.7], s: [0.3, 0.2, 0.1] }, // Sepia: warm brown
      { h: [0.7, 0.9, 1.1], s: [0.05, 0.1, 0.25] }, // Cyanotype: blue
      { h: [0.85, 0.95, 1.15], s: [0.1, 0.15, 0.2] }, // Cool: slight blue
      { h: [1.15, 1.05, 0.85], s: [0.15, 0.1, 0.05] }, // Warm: orange/red
    ];

    const toneConfig = toneColors[tone] || toneColors[0];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale using luminance formula
      let gray = r * 0.299 + g * 0.587 + b * 0.114;

      // Apply brightness
      gray = gray + brightness * 255;

      // Apply contrast (centered at 128)
      gray = (gray - 128) * contrast + 128;

      // Clamp
      gray = clampByte(gray);

      // Apply tone coloring based on brightness
      const t = gray / 255; // 0 = shadow, 1 = highlight

      const outR = gray * (toneConfig.h[0] * t + toneConfig.s[0] * (1 - t));
      const outG = gray * (toneConfig.h[1] * t + toneConfig.s[1] * (1 - t));
      const outB = gray * (toneConfig.h[2] * t + toneConfig.s[2] * (1 - t));

      // Blend with original based on intensity
      data[i] = clampByte(r * (1 - intensity) + outR * intensity);
      data[i + 1] = clampByte(g * (1 - intensity) + outG * intensity);
      data[i + 2] = clampByte(b * (1 - intensity) + outB * intensity);
    }
  };
};

// Add new effect function for Duotone
const createDuotoneEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const color1 = settings.color1 ? hexToRgb(settings.color1) : { r: 0, g: 0, b: 255 };
    const color2 = settings.color2 ? hexToRgb(settings.color2) : { r: 255, g: 255, b: 0 };

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      const newR = color1.r * (1 - brightness) + color2.r * brightness;
      const newG = color1.g * (1 - brightness) + color2.g * brightness;
      const newB = color1.b * (1 - brightness) + color2.b * brightness;

      data[i] = Math.round(newR);
      data[i + 1] = Math.round(newG);
      data[i + 2] = Math.round(newB);
    }
  };
};

// Helper function to convert hex color (as number) to RGB object
const hexToRgb = (hex: number) => {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return { r, g, b };
};

// Add new effect function for Bloom
const createBloomEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    // Convert percentage (0-100) to internal range (0-2)
    const strength = ((settings.strength ?? 50) / 100) * 2;
    const radius = Math.round(settings.radius || 15);

    const pool = getBufferPool();
    const originalData = pool.acquire(data.length);
    const blurData = pool.acquire(data.length);

    try {
      originalData.set(data);
      blurData.set(data);

      // Use optimized separable blur instead of O(n² × r²) box blur
      stackBlur(blurData, width, height, radius);

      // Apply bloom: add blurred highlights to original
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, originalData[i] + blurData[i] * strength);
        data[i + 1] = Math.min(255, originalData[i + 1] + blurData[i + 1] * strength);
        data[i + 2] = Math.min(255, originalData[i + 2] + blurData[i + 2] * strength);
        data[i + 3] = originalData[i + 3];
      }
    } finally {
      pool.release(originalData);
      pool.release(blurData);
    }
  };
};

/**
 * Unified Glow Effect - Combines multiple glow styles into one configurable effect
 * Presets: 0=Bloom, 1=Dreamy (Orton), 2=Neon Edges, 3=Bioluminescence, 4=Halation
 */
const createUnifiedGlowEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const intensity = (settings.intensity ?? 50) / 100;
    const radius = Math.max(1, Math.min(100, settings.radius ?? 20));
    const threshold = (settings.threshold ?? 50) / 100;
    const colorShift = (settings.colorShift ?? 0) / 100;
    const darkenBg = (settings.darkenBg ?? 0) / 100;
    const opacity = settings.opacity ?? 1;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const glowLayer = pool.acquire(data.length);
    const originalForBlend = opacity < 1 ? pool.acquire(data.length) : null;

    try {
      original.set(data);
      if (originalForBlend) originalForBlend.set(data);

      // Threshold extraction varies by preset
      const thresholdValue = threshold * 255;

      for (let i = 0; i < data.length; i += 4) {
        const r = original[i];
        const g = original[i + 1];
        const b = original[i + 2];
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;

        let glowR = 0,
          glowG = 0,
          glowB = 0;

        if (brightness > thresholdValue) {
          const factor = (brightness - thresholdValue) / (255 - thresholdValue);

          switch (preset) {
            case 0: // Bloom - additive white glow
              glowR = r * factor;
              glowG = g * factor;
              glowB = b * factor;
              break;

            case 1: // Dreamy (Orton) - soft warm glow
              glowR = Math.min(255, r * factor * (1 + colorShift * 0.3));
              glowG = g * factor;
              glowB = b * factor * (1 - colorShift * 0.2);
              break;

            case 2: // Neon - saturated edge colors
              const hue = Math.atan2(g - b, r - (g + b) / 2) / (Math.PI * 2) + 0.5;
              const shiftedHue = (hue + colorShift) % 1;
              const neonColor = hslToRgb(shiftedHue, 1, 0.5);
              glowR = neonColor.r * 255 * factor;
              glowG = neonColor.g * 255 * factor;
              glowB = neonColor.b * 255 * factor;
              break;

            case 3: // Bioluminescence - cyan/blue-green shift
              glowR = (r * 0.3 + 20) * factor;
              glowG = (g * 0.8 + b * 0.3 + 80 * colorShift) * factor;
              glowB = (b * 0.7 + g * 0.4 + 60) * factor;
              break;

            case 4: // Halation - film highlight bloom
              const halationFactor = factor * (1 + colorShift * 0.5);
              glowR = r * halationFactor;
              glowG = g * halationFactor * 0.95;
              glowB = b * halationFactor * 0.9;
              break;

            default:
              glowR = r * factor;
              glowG = g * factor;
              glowB = b * factor;
          }
        }

        glowLayer[i] = glowR;
        glowLayer[i + 1] = glowG;
        glowLayer[i + 2] = glowB;
        glowLayer[i + 3] = 255;
      }

      // Apply blur to glow layer
      stackBlur(glowLayer, width, height, radius);

      // Composite glow with original
      const bgMultiplier = 1 - darkenBg;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, original[i] * bgMultiplier + glowLayer[i] * intensity * 2);
        data[i + 1] = Math.min(
          255,
          original[i + 1] * bgMultiplier + glowLayer[i + 1] * intensity * 2
        );
        data[i + 2] = Math.min(
          255,
          original[i + 2] * bgMultiplier + glowLayer[i + 2] * intensity * 2
        );
        data[i + 3] = original[i + 3];
      }

      // Apply opacity blending with original
      if (originalForBlend) {
        applyOpacityBlend(data, originalForBlend, opacity);
      }
    } finally {
      pool.release(original);
      pool.release(glowLayer);
      if (originalForBlend) pool.release(originalForBlend);
    }
  };
};

// Add Kuwahara filter implementation
// Adapted from https://github.com/ogus/kuwahara
const createKuwaharaEffect = (settings: Record<string, number>) => {
  const radius = Math.round(settings.radius || 5); // Radius for the filter kernel
  const opacity = settings.opacity ?? 1;

  // Helper function to calculate mean and variance for a region
  const calculateMeanVariance = (
    imageData: KonvaImageData,
    x: number,
    y: number,
    radius: number,
    quadrant: number
  ) => {
    const { data, width, height } = imageData;
    let meanR = 0,
      meanG = 0,
      meanB = 0;
    let varianceR = 0,
      varianceG = 0,
      varianceB = 0;
    let count = 0;

    let startX = x - radius,
      startY = y - radius;
    let endX = x + radius,
      endY = y + radius;

    // Adjust start/end based on quadrant (0: TL, 1: TR, 2: BL, 3: BR)
    if (quadrant === 0) {
      endX = x;
      endY = y;
    }
    if (quadrant === 1) {
      startX = x;
      endY = y;
    }
    if (quadrant === 2) {
      endX = x;
      startY = y;
    }
    if (quadrant === 3) {
      startX = x;
      startY = y;
    }

    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const px = Math.min(width - 1, Math.max(0, cx));
        const py = Math.min(height - 1, Math.max(0, cy));
        const index = (py * width + px) * 4;

        meanR += data[index];
        meanG += data[index + 1];
        meanB += data[index + 2];
        count++;
      }
    }

    if (count === 0) return { mean: { r: 0, g: 0, b: 0 }, variance: Infinity };

    meanR /= count;
    meanG /= count;
    meanB /= count;

    // Calculate variance
    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const px = Math.min(width - 1, Math.max(0, cx));
        const py = Math.min(height - 1, Math.max(0, cy));
        const index = (py * width + px) * 4;

        varianceR += Math.pow(data[index] - meanR, 2);
        varianceG += Math.pow(data[index + 1] - meanG, 2);
        varianceB += Math.pow(data[index + 2] - meanB, 2);
      }
    }

    // Use combined variance (or just luminance variance for simplicity/performance)
    const totalVariance = (varianceR + varianceG + varianceB) / count;

    return { mean: { r: meanR, g: meanG, b: meanB }, variance: totalVariance };
  };

  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVariance = Infinity;
        let bestMean = { r: 0, g: 0, b: 0 };

        // Calculate mean and variance for each quadrant
        for (let quadrant = 0; quadrant < 4; quadrant++) {
          const { mean, variance } = calculateMeanVariance(
            { data: tempData, width, height },
            x,
            y,
            radius,
            quadrant
          );
          if (variance < minVariance) {
            minVariance = variance;
            bestMean = mean;
          }
        }

        // Set the pixel color to the mean of the quadrant with the minimum variance
        const index = (y * width + x) * 4;
        data[index] = Math.round(bestMean.r);
        data[index + 1] = Math.round(bestMean.g);
        data[index + 2] = Math.round(bestMean.b);
      }
    }

    // Apply opacity blending with original (tempData contains original)
    if (opacity < 1) {
      applyOpacityBlend(data, tempData, opacity);
    }
  };
};

// Add improved Vignette effect function
const createVignetteEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const amount = settings.amount ?? 0.5; // 0 to 1
    const falloff = settings.falloff ?? 0.5; // 0.1 to 1 (controls hardness)
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    // Pre-calculate for efficiency
    const scale = maxDist * falloff;
    const invAmount = 1.0 - amount;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Calculate vignette factor (0 at edge, 1 at center)
        const factor = Math.max(0, Math.min(1, 1.0 - dist / scale));
        // Apply vignette: lerp between original color and black based on factor and amount
        const multiplier = factor * amount + invAmount;

        const index = (y * width + x) * 4;
        data[index] *= multiplier;
        data[index + 1] *= multiplier;
        data[index + 2] *= multiplier;
      }
    }
  };
};

// Add improved Chromatic Aberration effect function
const createChromaticAberrationEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const amount = settings.amount ?? 5;
    const angleRad = (settings.angle ?? 45) * (Math.PI / 180);
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Calculate offsets for R and B channels based on angle and amount
        const rOffsetX = Math.round(amount * cosAngle);
        const rOffsetY = Math.round(amount * sinAngle);
        const bOffsetX = -Math.round(amount * cosAngle);
        const bOffsetY = -Math.round(amount * sinAngle);

        // Sample Red channel from offset position
        const rX = Math.min(width - 1, Math.max(0, x + rOffsetX));
        const rY = Math.min(height - 1, Math.max(0, y + rOffsetY));
        const rIndex = (rY * width + rX) * 4;
        data[index] = tempData[rIndex]; // Red

        // Green channel remains at original position
        data[index + 1] = tempData[index + 1]; // Green

        // Sample Blue channel from offset position
        const bX = Math.min(width - 1, Math.max(0, x + bOffsetX));
        const bY = Math.min(height - 1, Math.max(0, y + bOffsetY));
        const bIndex = (bY * width + bX) * 4;
        data[index + 2] = tempData[bIndex + 2]; // Blue

        data[index + 3] = tempData[index + 3]; // Alpha
      }
    }
  };
};

// Add improved Scan Lines effect function
const createScanLinesEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const frequency = Math.max(1, settings.frequency ?? 5);
    const opacity = settings.opacity ?? 0.3;
    const multiplier = 1.0 - opacity; // How much to darken

    for (let y = 0; y < height; y++) {
      if (y % frequency === 0) {
        // Apply darkening every `frequency` pixels
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          data[index] *= multiplier;
          data[index + 1] *= multiplier;
          data[index + 2] *= multiplier;
        }
      }
    }
  };
};

// Crosshatch Effect
const createCrosshatchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    // Map 2-10 to actual spacing of 3-25 pixels
    const spacingInput = settings.spacing ?? 5;
    const spacing = Math.floor(3 + ((spacingInput - 2) / 8) * 22); // 3 to 25
    const strength = settings.strength ?? 0.5;

    // Create output with paper-colored background
    const outputData = new Uint8ClampedArray(data.length);
    const paperR = 252,
      paperG = 250,
      paperB = 245; // Warm paper color

    for (let i = 0; i < outputData.length; i += 4) {
      outputData[i] = paperR;
      outputData[i + 1] = paperG;
      outputData[i + 2] = paperB;
      outputData[i + 3] = data[i + 3];
    }

    // Line thickness based on strength
    const lineThickness = 0.5 + strength * 1.5; // 0.5 to 2.0 pixels

    // Four hatch angles for rich crosshatching
    const angles = [
      45 * (Math.PI / 180), // Main diagonal
      135 * (Math.PI / 180), // Cross diagonal
      90 * (Math.PI / 180), // Vertical (for very dark areas)
      0 * (Math.PI / 180), // Horizontal (for very dark areas)
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index],
          g = data[index + 1],
          b = data[index + 2];
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const darkness = 1 - brightness;

        // Ink color varies slightly with original color (subtle sepia/blue tones)
        const inkR = Math.floor(20 + (1 - r / 255) * 15);
        const inkG = Math.floor(15 + (1 - g / 255) * 10);
        const inkB = Math.floor(30 + (1 - b / 255) * 20);

        let totalInk = 0;

        // First angle: appears for darkness > 0.15
        if (darkness > 0.15) {
          const lineVal = Math.abs(x * Math.cos(angles[0]) + y * Math.sin(angles[0])) % spacing;
          if (lineVal < lineThickness * (darkness - 0.15) * 2) {
            totalInk += 0.8;
          }
        }

        // Second angle (crosshatch): appears for darkness > 0.35
        if (darkness > 0.35) {
          const lineVal = Math.abs(x * Math.cos(angles[1]) + y * Math.sin(angles[1])) % spacing;
          if (lineVal < lineThickness * (darkness - 0.35) * 2.5) {
            totalInk += 0.7;
          }
        }

        // Third angle: appears for darkness > 0.55
        if (darkness > 0.55) {
          const lineVal =
            Math.abs(x * Math.cos(angles[2]) + y * Math.sin(angles[2])) % (spacing * 0.7);
          if (lineVal < lineThickness * (darkness - 0.55) * 2) {
            totalInk += 0.6;
          }
        }

        // Fourth angle: appears for darkness > 0.75 (very dark areas)
        if (darkness > 0.75) {
          const lineVal =
            Math.abs(x * Math.cos(angles[3]) + y * Math.sin(angles[3])) % (spacing * 0.7);
          if (lineVal < lineThickness * (darkness - 0.75) * 3) {
            totalInk += 0.5;
          }
        }

        // Apply ink with strength modulation
        if (totalInk > 0) {
          const inkAmount = Math.min(1, totalInk * strength * 1.5);
          outputData[index] = Math.floor(paperR * (1 - inkAmount) + inkR * inkAmount);
          outputData[index + 1] = Math.floor(paperG * (1 - inkAmount) + inkG * inkAmount);
          outputData[index + 2] = Math.floor(paperB * (1 - inkAmount) + inkB * inkAmount);
        }

        // Add subtle paper texture
        const noise = (Math.random() - 0.5) * 6;
        outputData[index] = clampByte(outputData[index] + noise);
        outputData[index + 1] = clampByte(outputData[index + 1] + noise);
        outputData[index + 2] = clampByte(outputData[index + 2] + noise);
      }
    }

    data.set(outputData);
  };
};
// Dot Screen Effect
const createDotScreenEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const scale = settings.scale ?? 5;
    const angle = (settings.angle ?? 25) * (Math.PI / 180);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const outputData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < outputData.length; i += 4) {
      outputData[i] = outputData[i + 1] = outputData[i + 2] = 255;
      outputData[i + 3] = data[i + 3]; // Preserve alpha
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index],
          g = data[index + 1],
          b = data[index + 2];
        const avg = (r + g + b) / 3;

        // Rotate coordinate system
        const rotatedX = x * cosA - y * sinA;
        const rotatedY = x * sinA + y * cosA;

        // Calculate distance to nearest grid center & dot size
        const cellX = Math.round(rotatedX / scale);
        const cellY = Math.round(rotatedY / scale);
        const distToCenter = Math.sqrt(
          Math.pow(rotatedX - cellX * scale, 2) + Math.pow(rotatedY - cellY * scale, 2)
        );
        const dotRadius = (1 - avg / 255) * (scale * 0.6); // Max dot size related to scale

        if (distToCenter <= dotRadius) {
          outputData[index] = outputData[index + 1] = outputData[index + 2] = 0; // Draw dot pixel
        }
      }
    }
    data.set(outputData);
  };
};
// Old Photo Effect (Sepia + Noise + Vignette)
const createOldPhotoEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const sepiaAmount = settings.sepia ?? 0.6;
    const noiseAmount = settings.noise ?? 0.1;
    const vignetteAmount = settings.vignette ?? 0.4;

    // 1. Apply Sepia (Custom implementation)
    if (sepiaAmount > 0) {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;

        // Lerp between original and sepia based on amount
        data[i] = r * (1 - sepiaAmount) + tr * sepiaAmount;
        data[i + 1] = g * (1 - sepiaAmount) + tg * sepiaAmount;
        data[i + 2] = b * (1 - sepiaAmount) + tb * sepiaAmount;

        // Clamp values
        data[i] = Math.min(255, data[i]);
        data[i + 1] = Math.min(255, data[i + 1]);
        data[i + 2] = Math.min(255, data[i + 2]);
      }
    }

    // 2. Apply Noise (Custom implementation)
    if (noiseAmount > 0) {
      const noiseFactor = noiseAmount * 255 * 0.5; // Scale noise
      for (let i = 0; i < data.length; i += 4) {
        const rand = (Math.random() - 0.5) * noiseFactor;
        data[i] = Math.min(255, Math.max(0, data[i] + rand));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + rand));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + rand));
      }
    }

    // 3. Apply Vignette (using the existing vignette function logic)
    if (vignetteAmount > 0) {
      const vignetteFunc = createVignetteEffect({ amount: vignetteAmount, falloff: 0.6 });
      vignetteFunc(imageData); // Apply vignette to the already modified data
    }
  };
};

// Pixel Sort Effect
const createPixelSortEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const threshold = (settings.threshold ?? 0.3) * 255;
    const axis = settings.axis ?? 0; // 0 for X, 1 for Y

    const getBrightness = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

    if (axis === 0) {
      // Sort horizontally
      for (let y = 0; y < height; y++) {
        let sortStart = -1;
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const brightness = getBrightness(data[index], data[index + 1], data[index + 2]);
          if (brightness < threshold && sortStart === -1) {
            sortStart = x;
          } else if (brightness >= threshold && sortStart !== -1) {
            // Sort the segment
            const segment = [];
            for (let sx = sortStart; sx < x; sx++) {
              const sIndex = (y * width + sx) * 4;
              segment.push({
                r: data[sIndex],
                g: data[sIndex + 1],
                b: data[sIndex + 2],
                brightness: getBrightness(data[sIndex], data[sIndex + 1], data[sIndex + 2]),
              });
            }
            segment.sort((a, b) => a.brightness - b.brightness);
            // Write back sorted segment
            for (let sx = sortStart; sx < x; sx++) {
              const sIndex = (y * width + sx) * 4;
              const sortedPixel = segment[sx - sortStart];
              data[sIndex] = sortedPixel.r;
              data[sIndex + 1] = sortedPixel.g;
              data[sIndex + 2] = sortedPixel.b;
            }
            sortStart = -1;
          }
        }
        // Handle segment reaching end of row
        if (sortStart !== -1) {
          const segment = [];
          for (let sx = sortStart; sx < width; sx++) {
            const sIndex = (y * width + sx) * 4;
            segment.push({
              r: data[sIndex],
              g: data[sIndex + 1],
              b: data[sIndex + 2],
              brightness: getBrightness(data[sIndex], data[sIndex + 1], data[sIndex + 2]),
            });
          }
          segment.sort((a, b) => a.brightness - b.brightness);
          for (let sx = sortStart; sx < width; sx++) {
            const sIndex = (y * width + sx) * 4;
            const sortedPixel = segment[sx - sortStart];
            data[sIndex] = sortedPixel.r;
            data[sIndex + 1] = sortedPixel.g;
            data[sIndex + 2] = sortedPixel.b;
          }
        }
      }
    } else {
      // Sort vertically
      for (let x = 0; x < width; x++) {
        let sortStart = -1;
        for (let y = 0; y < height; y++) {
          const index = (y * width + x) * 4;
          const brightness = getBrightness(data[index], data[index + 1], data[index + 2]);
          if (brightness < threshold && sortStart === -1) {
            sortStart = y;
          } else if (brightness >= threshold && sortStart !== -1) {
            const segment = [];
            for (let sy = sortStart; sy < y; sy++) {
              const sIndex = (sy * width + x) * 4;
              segment.push({
                r: data[sIndex],
                g: data[sIndex + 1],
                b: data[sIndex + 2],
                brightness: getBrightness(data[sIndex], data[sIndex + 1], data[sIndex + 2]),
              });
            }
            segment.sort((a, b) => a.brightness - b.brightness);
            for (let sy = sortStart; sy < y; sy++) {
              const sIndex = (sy * width + x) * 4;
              const sortedPixel = segment[sy - sortStart];
              data[sIndex] = sortedPixel.r;
              data[sIndex + 1] = sortedPixel.g;
              data[sIndex + 2] = sortedPixel.b;
            }
            sortStart = -1;
          }
        }
        if (sortStart !== -1) {
          const segment = [];
          for (let sy = sortStart; sy < height; sy++) {
            const sIndex = (sy * width + x) * 4;
            segment.push({
              r: data[sIndex],
              g: data[sIndex + 1],
              b: data[sIndex + 2],
              brightness: getBrightness(data[sIndex], data[sIndex + 1], data[sIndex + 2]),
            });
          }
          segment.sort((a, b) => a.brightness - b.brightness);
          for (let sy = sortStart; sy < height; sy++) {
            const sIndex = (sy * width + x) * 4;
            const sortedPixel = segment[sy - sortStart];
            data[sIndex] = sortedPixel.r;
            data[sIndex + 1] = sortedPixel.g;
            data[sIndex + 2] = sortedPixel.b;
          }
        }
      }
    }
  };
};

// RGB Channel Shift Effect
const createRgbShiftEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const rOffset = Math.round(settings.rOffset ?? 4);
    const gOffset = Math.round(settings.gOffset ?? 0);
    const bOffset = Math.round(settings.bOffset ?? -4);

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Sample Red from offset
        const rX = Math.min(width - 1, Math.max(0, x + rOffset));
        const rIndex = (y * width + rX) * 4;
        data[index] = tempData[rIndex];

        // Sample Green from offset
        const gX = Math.min(width - 1, Math.max(0, x + gOffset));
        const gIndex = (y * width + gX) * 4;
        data[index + 1] = tempData[gIndex + 1];

        // Sample Blue from offset
        const bX = Math.min(width - 1, Math.max(0, x + bOffset));
        const bIndex = (y * width + bX) * 4;
        data[index + 2] = tempData[bIndex + 2];

        data[index + 3] = tempData[index + 3]; // Alpha
      }
    }
  };
};

// Flow Field Distortion (Simplified - displace based on noise angle)
// Requires a noise function (e.g., Perlin/Simplex). Placeholder for now.
// Simple random angle displacement:
// REMOVED: createFlowFieldEffect - unused dead code

// --- PLACEHOLDER FUNCTIONS FOR NEW EFFECTS ---

// 1. Glitch Art Implementation
const createGlitchArtEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const blockiness = settings.blockiness ?? 0.05;
    const colorShift = Math.round(settings.colorShift ?? 5);

    const blockHeight = Math.max(1, Math.floor(height * blockiness * Math.random()));
    const numBlocks = Math.floor(height / blockHeight);

    for (let block = 0; block < numBlocks; block++) {
      if (Math.random() < 0.3) {
        // Chance to glitch this block
        const startY = block * blockHeight;
        const endY = Math.min(height, startY + blockHeight);
        const shiftX = Math.floor((Math.random() - 0.5) * width * 0.1); // Max 10% shift

        // Horizontal shift
        const tempRow = new Uint8ClampedArray(width * blockHeight * 4);
        let tempIdx = 0;
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            tempRow[tempIdx++] = data[idx];
            tempRow[tempIdx++] = data[idx + 1];
            tempRow[tempIdx++] = data[idx + 2];
            tempRow[tempIdx++] = data[idx + 3];
          }
        }
        tempIdx = 0;
        for (let y = startY; y < endY; y++) {
          for (let x = 0; x < width; x++) {
            const targetX = (x - shiftX + width) % width; // Wrap around
            const idx = (y * width + x) * 4;
            const srcIdx = ((y - startY) * width + targetX) * 4;
            data[idx] = tempRow[srcIdx];
            data[idx + 1] = tempRow[srcIdx + 1];
            data[idx + 2] = tempRow[srcIdx + 2];
            data[idx + 3] = tempRow[srcIdx + 3];
          }
        }

        // Color channel shift within the block
        if (colorShift > 0 && Math.random() < 0.5) {
          const rOffset = Math.floor((Math.random() - 0.5) * colorShift);
          const gOffset = Math.floor((Math.random() - 0.5) * colorShift);
          const bOffset = Math.floor((Math.random() - 0.5) * colorShift);

          for (let y = startY; y < endY; y++) {
            for (let x = 0; x < width; x++) {
              const index = (y * width + x) * 4;
              const rX = Math.min(width - 1, Math.max(0, x + rOffset));
              const gX = Math.min(width - 1, Math.max(0, x + gOffset));
              const bX = Math.min(width - 1, Math.max(0, x + bOffset));

              const rIdx = (y * width + rX) * 4;
              const gIdx = (y * width + gX) * 4;
              const bIdx = (y * width + bX) * 4;

              // Only copy shifted channels, keep original alpha
              data[index] = tempRow[rIdx]; // Shifted Red
              data[index + 1] = tempRow[gIdx + 1]; // Shifted Green
              data[index + 2] = tempRow[bIdx + 2]; // Shifted Blue
            }
          }
        }
      }
    }
  };
};

// 2. Color Quantization Implementation
const createColorQuantizationEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const numColors = Math.max(2, Math.floor(settings.numColors ?? 16));
    const dithering = (settings.dithering ?? 0) > 0.5;

    // Calculate quantization step
    const step = 256 / numColors;

    if (dithering) {
      // Floyd-Steinberg dithering
      const tempData = new Uint8ClampedArray(data.length);
      tempData.set(data);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          for (let channel = 0; channel < 3; channel++) {
            const oldPixel = tempData[index + channel];
            const newPixel = Math.round(oldPixel / step) * step;
            const error = oldPixel - newPixel;

            data[index + channel] = clampByte(newPixel);

            // Distribute error to neighboring pixels
            if (x + 1 < width) {
              tempData[index + 4 + channel] += (error * 7) / 16;
            }
            if (y + 1 < height) {
              if (x > 0) {
                tempData[index + (width - 1) * 4 + channel] += (error * 3) / 16;
              }
              tempData[index + width * 4 + channel] += (error * 5) / 16;
              if (x + 1 < width) {
                tempData[index + (width + 1) * 4 + channel] += (error * 1) / 16;
              }
            }
          }
        }
      }
    } else {
      // Simple quantization without dithering
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step; // Red
        data[i + 1] = Math.round(data[i + 1] / step) * step; // Green
        data[i + 2] = Math.round(data[i + 2] / step) * step; // Blue
        // Alpha channel remains unchanged
      }
    }
  };
};

// 3. ASCII Art Implementation (Visual Approximation)
const createAsciiArtEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // Map scale 1-10 to actual cell sizes 3-40 for more dramatic range
    const scaleInput = settings.scale ?? 5;
    const cellSize = Math.max(3, Math.floor(3 + (scaleInput - 1) * 4.1)); // 3 to ~40 pixels

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Dither patterns that simulate ASCII character density (from sparse to dense)
    // Each pattern is an 8x8 matrix representing fill percentage
    const patterns = [
      // 0: Empty (space) - ~0% fill
      [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
      // 1: Dot pattern (.) - ~6% fill
      [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
      // 2: Colon pattern (:) - ~12% fill
      [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
      // 3: Dash pattern (-) - ~18% fill
      [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
      // 4: Plus pattern (+) - ~28% fill
      [
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
      ],
      // 5: Asterisk pattern (*) - ~38% fill
      [
        [0, 0, 0, 1, 1, 0, 0, 0],
        [1, 0, 0, 1, 1, 0, 0, 1],
        [0, 1, 0, 1, 1, 0, 1, 0],
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 0, 1, 1, 0, 1, 0],
        [1, 0, 0, 1, 1, 0, 0, 1],
        [0, 0, 0, 1, 1, 0, 0, 0],
      ],
      // 6: Hash pattern (#) - ~50% fill
      [
        [0, 1, 1, 0, 0, 1, 1, 0],
        [0, 1, 1, 0, 0, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 0, 0, 1, 1, 0],
        [0, 1, 1, 0, 0, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 0, 0, 1, 1, 0],
        [0, 1, 1, 0, 0, 1, 1, 0],
      ],
      // 7: Percent pattern (%) - ~62% fill
      [
        [1, 1, 1, 0, 0, 0, 1, 1],
        [1, 1, 1, 0, 0, 1, 1, 0],
        [1, 1, 1, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 1, 0],
        [1, 1, 0, 0, 1, 1, 1, 0],
        [1, 0, 0, 0, 1, 1, 1, 0],
      ],
      // 8: At pattern (@) - ~75% fill
      [
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 0, 1, 1, 1, 0, 1, 1],
        [1, 0, 1, 0, 1, 0, 1, 1],
        [1, 0, 1, 1, 1, 1, 1, 1],
        [1, 0, 1, 1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0, 0],
      ],
      // 9: Block pattern (█) - ~95% fill
      [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 0, 0, 1, 1, 1],
      ],
    ];
    const numPatterns = patterns.length;

    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        let sumBrightness = 0;
        let count = 0;

        // Calculate average brightness in the cell
        for (let sy = 0; sy < cellSize && y + sy < height; sy++) {
          for (let sx = 0; sx < cellSize && x + sx < width; sx++) {
            const index = ((y + sy) * width + (x + sx)) * 4;
            const brightness =
              0.299 * tempData[index] + 0.587 * tempData[index + 1] + 0.114 * tempData[index + 2];
            sumBrightness += brightness;
            count++;
          }
        }

        if (count > 0) {
          const avgBrightness = sumBrightness / count / 255;
          // Map brightness to pattern index (inverted: dark = more fill)
          const patternIndex = Math.min(
            numPatterns - 1,
            Math.floor((1 - avgBrightness) * numPatterns)
          );
          const pattern = patterns[patternIndex];

          // Apply pattern to each pixel in the cell
          for (let sy = 0; sy < cellSize && y + sy < height; sy++) {
            for (let sx = 0; sx < cellSize && x + sx < width; sx++) {
              const index = ((y + sy) * width + (x + sx)) * 4;
              // Map cell position to 8x8 pattern
              const patternY = Math.floor((sy / cellSize) * 8) % 8;
              const patternX = Math.floor((sx / cellSize) * 8) % 8;
              const filled = pattern[patternY][patternX];

              // Black on white for classic ASCII look
              const pixelVal = filled ? 0 : 255;
              data[index] = pixelVal;
              data[index + 1] = pixelVal;
              data[index + 2] = pixelVal;
            }
          }
        }
      }
    }
  };
};

// 4. Edge Detection Implementation (Sobel)
const createEdgeDetectionEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const threshold = settings.threshold ?? 50;
    const shouldInvert = (settings.invert ?? 0) > 0.5;

    // First, convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
            const pixelValue = tempData[pixelIndex]; // Use grayscale value
            gx += pixelValue * kernelX[kernelIndex];
            gy += pixelValue * kernelY[kernelIndex];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edgeValue = magnitude > threshold ? 255 : 0;
        const finalValue = shouldInvert ? 255 - edgeValue : edgeValue;

        const index = (y * width + x) * 4;
        data[index] = data[index + 1] = data[index + 2] = finalValue;
      }
    }
    // Handle borders (optional, set to black/white)
  };
};

// Implementation of Swirl Distortion (FIXED ANGLE LOGIC)
const createSwirlEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // Convert percentage-based values to actual pixel values
    const radiusPercent = (settings.radius ?? 50) / 100;
    const radius = radiusPercent * Math.min(width, height);
    const strength = settings.strength ?? 5;
    const centerX = ((settings.centerX ?? 50) / 100) * width;
    const centerY = ((settings.centerY ?? 50) / 100) * height;

    const pool = getBufferPool();
    const tempData = pool.acquire(data.length);

    try {
      tempData.set(data);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const index = (y * width + x) * 4;

          if (distance < radius) {
            const percent = distance / radius;
            // Angle adjustment based on distance and strength
            const angleOffset = strength * (1.0 - percent); // More twist closer to center
            const originalAngle = Math.atan2(dy, dx);
            const newAngle = originalAngle + angleOffset;

            const srcX = Math.round(centerX + Math.cos(newAngle) * distance);
            const srcY = Math.round(centerY + Math.sin(newAngle) * distance);

            if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
              const srcIndex = (srcY * width + srcX) * 4;
              data[index] = tempData[srcIndex];
              data[index + 1] = tempData[srcIndex + 1];
              data[index + 2] = tempData[srcIndex + 2];
              data[index + 3] = tempData[srcIndex + 3];
            } else {
              data[index + 3] = 0; // Make out-of-bounds pixels transparent
            }
          }
          // Pixels outside radius are untouched
        }
      }
    } finally {
      pool.release(tempData);
    }
  };
};

// Implementation of Mosaic (Adding data.set)
const createMosaicEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const tileSize = Math.max(1, Math.floor(settings.tileSize ?? 10));
    const outputData = new Uint8ClampedArray(data.length); // Write to output, read from original data

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        let sumR = 0,
          sumG = 0,
          sumB = 0,
          sumA = 0;
        let count = 0;

        // Calculate average color within the tile (reading from original `data`)
        const endY = Math.min(y + tileSize, height);
        const endX = Math.min(x + tileSize, width);
        for (let ty = y; ty < endY; ty++) {
          for (let tx = x; tx < endX; tx++) {
            const index = (ty * width + tx) * 4;
            sumR += data[index];
            sumG += data[index + 1];
            sumB += data[index + 2];
            sumA += data[index + 3];
            count++;
          }
        }

        if (count > 0) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          const avgA = sumA / count;

          // Fill the tile in the outputData with the average color
          for (let ty = y; ty < endY; ty++) {
            for (let tx = x; tx < endX; tx++) {
              const index = (ty * width + tx) * 4;
              outputData[index] = avgR;
              outputData[index + 1] = avgG;
              outputData[index + 2] = avgB;
              outputData[index + 3] = avgA;
            }
          }
        }
      }
    }
    // Copy the result back to the original data array
    data.set(outputData);
  };
};

// 12. Kaleidoscope Implementation (REWRITTEN for clarity/safety)
const createKaleidoscopeEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const segments = Math.max(2, Math.floor(settings.segments ?? 6));
    // Convert percentage-based center values
    const centerX = ((settings.centerX ?? 50) / 100) * width;
    const centerY = ((settings.centerY ?? 50) / 100) * height;
    const anglePerSegment = (Math.PI * 2) / segments;

    const pool = getBufferPool();
    const tempData = pool.acquire(data.length);
    tempData.set(data); // Use temp for reading source pixels

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Map angle to the first segment, reflecting if needed
        let segmentAngle = ((angle % anglePerSegment) + anglePerSegment) % anglePerSegment;
        if (segmentAngle > anglePerSegment / 2) {
          segmentAngle = anglePerSegment - segmentAngle;
        }

        // Calculate source coordinates
        const srcX = Math.round(centerX + Math.cos(segmentAngle) * distance);
        const srcY = Math.round(centerY + Math.sin(segmentAngle) * distance);
        const destIndex = (y * width + x) * 4;

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIndex = (srcY * width + srcX) * 4;
          data[destIndex] = tempData[srcIndex];
          data[destIndex + 1] = tempData[srcIndex + 1];
          data[destIndex + 2] = tempData[srcIndex + 2];
          data[destIndex + 3] = tempData[srcIndex + 3];
        } else {
          data[destIndex] = 0;
          data[destIndex + 1] = 0;
          data[destIndex + 2] = 0;
          data[destIndex + 3] = 0; // Make out-of-bounds transparent black
        }
      }
    }
  };
};

// 15. Anaglyph 3D Implementation (REWRITTEN for clarity/safety)
const createAnaglyphEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const shift = Math.round(settings.shift ?? 5);
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Read source pixels from tempData

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const destIndex = (y * width + x) * 4;

        // Left eye pixel (for Red channel)
        const leftX = Math.min(width - 1, Math.max(0, x - shift));
        const leftIndex = (y * width + leftX) * 4;
        const leftR = tempData[leftIndex];
        const leftG = tempData[leftIndex + 1];
        const leftB = tempData[leftIndex + 2];
        const redValue = 0.299 * leftR + 0.587 * leftG + 0.114 * leftB; // Luminance

        // Right eye pixel (for Green, Blue channels)
        const rightX = Math.min(width - 1, Math.max(0, x + shift));
        const rightIndex = (y * width + rightX) * 4;
        const rightG = tempData[rightIndex + 1];
        const rightB = tempData[rightIndex + 2];
        const originalAlpha = tempData[destIndex + 3]; // Use original alpha

        // Combine into destination pixel (writing to `data`)
        data[destIndex] = Math.round(redValue);
        data[destIndex + 1] = rightG;
        data[destIndex + 2] = rightB;
        data[destIndex + 3] = originalAlpha;
      }
    }
  };
};

// 14. Heatmap Implementation (REVISED)
const createHeatmapEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const gradientType = Math.floor(settings.gradientType ?? 0);

    // Define color gradients (example: [position, r, g, b])
    const gradients = [
      // Classic Rainbow (0)
      [
        [0, 0, 0, 255],
        [0.25, 0, 255, 255],
        [0.5, 0, 255, 0],
        [0.75, 255, 255, 0],
        [1, 255, 0, 0],
      ],
      // Inferno (1) (perceptually uniform)
      [
        [0, 0, 0, 4],
        [0.25, 59, 18, 77],
        [0.5, 144, 41, 49],
        [0.75, 218, 87, 4],
        [1, 252, 175, 62],
      ],
      // Grayscale (2)
      [
        [0, 0, 0, 0],
        [1, 255, 255, 255],
      ],
      // Viridis (3) (perceptually uniform)
      [
        [0, 68, 1, 84],
        [0.25, 59, 82, 139],
        [0.5, 33, 145, 140],
        [0.75, 94, 201, 98],
        [1, 253, 231, 37],
      ],
    ];
    const selectedGradient = gradients[gradientType % gradients.length];

    // Ensure lerp handles edge cases correctly
    const safeLerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

    const getColorFromGradient = (value: number) => {
      value = Math.max(0, Math.min(1, value)); // Clamp value to 0-1
      for (let i = 1; i < selectedGradient.length; i++) {
        const [prevPos, prevR, prevG, prevB] = selectedGradient[i - 1];
        const [currPos, currR, currG, currB] = selectedGradient[i];
        if (value <= currPos) {
          const range = currPos - prevPos;
          // Handle potential division by zero if positions are identical
          const t = range === 0 ? 0 : (value - prevPos) / range;
          return [
            Math.round(safeLerp(prevR, currR, t)),
            Math.round(safeLerp(prevG, currG, t)),
            Math.round(safeLerp(prevB, currB, t)),
          ];
        }
      }
      // Should only reach here if value > 1 (handled by clamp), return last color
      const lastColor = selectedGradient[selectedGradient.length - 1];
      return [lastColor[1], lastColor[2], lastColor[3]];
    };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Calculate luminance (brightness)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const [newR, newG, newB] = getColorFromGradient(brightness);
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
      // Keep original alpha: data[i + 3] stays the same
    }
  };
};
// Implementation of Color Temperature/Tint (REVISED for accuracy)
const createColorTemperatureEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const temperature = settings.temperature ?? 0; // -100 to 100 (Cool to Warm)
    const tint = settings.tint ?? 0; // -100 to 100 (Green to Magenta)

    // Convert temperature/tint sliders to approximate RGB multipliers
    // These are simplified approximations
    const tempFactor = temperature / 200.0; // Range -0.5 to 0.5
    const tintFactor = tint / 200.0; // Range -0.5 to 0.5

    // Temperature affects Red and Blue inversely
    const redTempMultiplier = 1.0 + tempFactor;
    const blueTempMultiplier = 1.0 - tempFactor;

    // Tint affects Green and Red/Blue inversely
    const greenTintMultiplier = 1.0 - tintFactor;
    const redBlueTintMultiplier = 1.0 + tintFactor;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Apply Temperature Shift
      r *= redTempMultiplier;
      b *= blueTempMultiplier;

      // Apply Tint Shift (affecting R/B and G)
      r *= redBlueTintMultiplier;
      g *= greenTintMultiplier;
      b *= redBlueTintMultiplier;

      // Clamp values
      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }
  };
};

// Initialize Konva when in browser environment
if (typeof window !== 'undefined') {
  loadKonva().catch(err => console.error('Failed to initialize Konva on module load:', err));
}
// Export helper for explicit initialization
export const ensureKonvaInitialized = loadKonva;
// Export the configured effects
export const getFilterConfig = () => effectsConfig;

// Add missing getEffectSettings function
export const getEffectSettings = (effectId: string | null): EffectSetting[] => {
  if (!effectId || !effectsConfig[effectId]) {
    return [];
  }
  return effectsConfig[effectId].settings || [];
};
// ============================================================================
// NEW UNIFIED EFFECTS - Consolidated from multiple similar effects
// ============================================================================

/**
 * Unified Glitch Effect - Combines RGB Shift, Chromatic Aberration, Scanlines,
 * Digital Glitch, VHS, Databend, and Pixel Sort into one configurable effect.
 *
 * Presets: 0=RGB Shift, 1=Chromatic Aberration, 2=Scanlines, 3=VHS/Analog,
 *          4=Digital Corruption, 5=Databend, 6=Pixel Sort
 */
const createUnifiedGlitchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const intensity = settings.intensity ?? 0.5;
    const amount = Math.floor((settings.amount ?? 10) * intensity);
    const direction = Math.floor(settings.direction ?? 0); // 0=horizontal, 1=vertical, 2=both
    const blockSize = Math.floor(settings.blockSize ?? 8);
    const randomness = settings.randomness ?? 0.5;
    const opacity = settings.opacity ?? 1;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Store original for opacity blending
    const originalForBlend = opacity < 1 ? new Uint8ClampedArray(data) : null;

    switch (preset) {
      case 0: // RGB Shift
        applyRgbShift(data, tempData, width, height, amount, direction);
        break;
      case 1: // Chromatic Aberration
        applyChromaticAberration(data, tempData, width, height, amount);
        break;
      case 2: // Scanlines
        applyScanlines(data, width, height, intensity, blockSize);
        break;
      case 3: // VHS/Analog
        applyVhsEffect(data, tempData, width, height, intensity, randomness);
        break;
      case 4: // Digital Corruption
        applyDigitalCorruption(data, tempData, width, height, intensity, blockSize, randomness);
        break;
      case 5: // Databend
        applyDatabend(data, width, height, intensity, blockSize);
        break;
      case 6: // Pixel Sort
        applyPixelSort(data, width, height, intensity, direction);
        break;
    }

    // Apply opacity blending with original
    if (originalForBlend) {
      applyOpacityBlend(data, originalForBlend, opacity);
    }
  };
};

// Helper functions for Unified Glitch
const applyRgbShift = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  direction: number
) => {
  const shiftX = direction !== 1 ? amount : 0;
  const shiftY = direction !== 0 ? amount : 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Red channel - shift one direction
      const rX = Math.min(width - 1, Math.max(0, x + shiftX));
      const rY = Math.min(height - 1, Math.max(0, y + shiftY));
      const rIdx = (rY * width + rX) * 4;

      // Blue channel - shift opposite direction
      const bX = Math.min(width - 1, Math.max(0, x - shiftX));
      const bY = Math.min(height - 1, Math.max(0, y - shiftY));
      const bIdx = (bY * width + bX) * 4;

      data[idx] = tempData[rIdx]; // Red from shifted position
      data[idx + 1] = tempData[idx + 1]; // Green stays
      data[idx + 2] = tempData[bIdx + 2]; // Blue from opposite shift
    }
  }
};

const applyChromaticAberration = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
) => {
  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Calculate radial distance from center
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
      const factor = (dist / maxDist) * amount;

      // Shift channels radially
      const angle = Math.atan2(dy, dx);
      const rX = Math.round(x + Math.cos(angle) * factor);
      const rY = Math.round(y + Math.sin(angle) * factor);
      const bX = Math.round(x - Math.cos(angle) * factor);
      const bY = Math.round(y - Math.sin(angle) * factor);

      const rIdx =
        (Math.max(0, Math.min(height - 1, rY)) * width + Math.max(0, Math.min(width - 1, rX))) * 4;
      const bIdx =
        (Math.max(0, Math.min(height - 1, bY)) * width + Math.max(0, Math.min(width - 1, bX))) * 4;

      data[idx] = tempData[rIdx];
      data[idx + 2] = tempData[bIdx + 2];
    }
  }
};

const applyScanlines = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  spacing: number
) => {
  const darkness = intensity * 0.8;

  for (let y = 0; y < height; y++) {
    const isScanline = y % spacing < spacing / 2;
    if (isScanline) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] *= 1 - darkness;
        data[idx + 1] *= 1 - darkness;
        data[idx + 2] *= 1 - darkness;
      }
    }
  }
};

const applyVhsEffect = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  randomness: number
) => {
  // Horizontal line shifts
  for (let y = 0; y < height; y++) {
    if (Math.random() < randomness * 0.1) {
      const shift = Math.floor((Math.random() - 0.5) * width * intensity * 0.1);
      for (let x = 0; x < width; x++) {
        const srcX = (x + shift + width) % width;
        const idx = (y * width + x) * 4;
        const srcIdx = (y * width + srcX) * 4;
        data[idx] = tempData[srcIdx];
        data[idx + 1] = tempData[srcIdx + 1];
        data[idx + 2] = tempData[srcIdx + 2];
      }
    }
  }

  // Color bleeding
  const bleed = Math.floor(intensity * 5);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - bleed; x++) {
      const idx = (y * width + x) * 4;
      const nextIdx = (y * width + x + bleed) * 4;
      data[idx] = Math.round(data[idx] * 0.9 + data[nextIdx] * 0.1);
    }
  }

  // Add noise
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity * 30;
    data[i] = clampByte(data[i] + noise);
    data[i + 1] = clampByte(data[i + 1] + noise);
    data[i + 2] = clampByte(data[i + 2] + noise);
  }
};

const applyDigitalCorruption = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  blockSize: number,
  randomness: number
) => {
  const blockHeight = Math.max(1, blockSize);
  const numBlocks = Math.ceil(height / blockHeight);

  for (let block = 0; block < numBlocks; block++) {
    if (Math.random() < randomness * intensity) {
      const startY = block * blockHeight;
      const endY = Math.min(height, startY + blockHeight);
      const shiftX = Math.floor((Math.random() - 0.5) * width * intensity * 0.2);

      for (let y = startY; y < endY; y++) {
        for (let x = 0; x < width; x++) {
          const srcX = (x + shiftX + width) % width;
          const idx = (y * width + x) * 4;
          const srcIdx = (y * width + srcX) * 4;

          // Random channel corruption
          if (Math.random() < intensity * 0.3) {
            data[idx] = tempData[srcIdx];
            data[idx + 1] = tempData[(y * width + ((x + 2) % width)) * 4 + 1];
            data[idx + 2] = tempData[(y * width + ((x - 2 + width) % width)) * 4 + 2];
          } else {
            data[idx] = tempData[srcIdx];
            data[idx + 1] = tempData[srcIdx + 1];
            data[idx + 2] = tempData[srcIdx + 2];
          }
        }
      }
    }
  }
};

const applyDatabend = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  blockSize: number
) => {
  const bendAmount = Math.floor(intensity * 50);

  for (let y = 0; y < height; y++) {
    // Create wave distortion
    const offset = Math.floor(Math.sin(y / blockSize) * bendAmount * intensity);

    if (offset !== 0) {
      const row = new Uint8ClampedArray(width * 4);
      for (let x = 0; x < width; x++) {
        const srcX = (x + offset + width) % width;
        const idx = x * 4;
        const srcIdx = (y * width + srcX) * 4;
        row[idx] = data[srcIdx];
        row[idx + 1] = data[srcIdx + 1];
        row[idx + 2] = data[srcIdx + 2];
        row[idx + 3] = data[srcIdx + 3];
      }

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = row[x * 4];
        data[idx + 1] = row[x * 4 + 1];
        data[idx + 2] = row[x * 4 + 2];
        data[idx + 3] = row[x * 4 + 3];
      }
    }
  }
};

const applyPixelSort = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  direction: number
) => {
  const threshold = (1 - intensity) * 255;

  if (direction === 0 || direction === 2) {
    // Horizontal sort
    for (let y = 0; y < height; y++) {
      let sortStart = -1;

      for (let x = 0; x <= width; x++) {
        const idx = (y * width + Math.min(x, width - 1)) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (brightness > threshold && sortStart === -1) {
          sortStart = x;
        } else if ((brightness <= threshold || x === width) && sortStart !== -1) {
          // Sort this segment
          const segment: number[][] = [];
          for (let sx = sortStart; sx < x; sx++) {
            const sIdx = (y * width + sx) * 4;
            segment.push([data[sIdx], data[sIdx + 1], data[sIdx + 2], data[sIdx + 3]]);
          }

          segment.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));

          for (let sx = sortStart; sx < x; sx++) {
            const sIdx = (y * width + sx) * 4;
            const pixel = segment[sx - sortStart];
            data[sIdx] = pixel[0];
            data[sIdx + 1] = pixel[1];
            data[sIdx + 2] = pixel[2];
            data[sIdx + 3] = pixel[3];
          }

          sortStart = -1;
        }
      }
    }
  }

  if (direction === 1 || direction === 2) {
    // Vertical sort
    for (let x = 0; x < width; x++) {
      let sortStart = -1;

      for (let y = 0; y <= height; y++) {
        const idx = (Math.min(y, height - 1) * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (brightness > threshold && sortStart === -1) {
          sortStart = y;
        } else if ((brightness <= threshold || y === height) && sortStart !== -1) {
          const segment: number[][] = [];
          for (let sy = sortStart; sy < y; sy++) {
            const sIdx = (sy * width + x) * 4;
            segment.push([data[sIdx], data[sIdx + 1], data[sIdx + 2], data[sIdx + 3]]);
          }

          segment.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));

          for (let sy = sortStart; sy < y; sy++) {
            const sIdx = (sy * width + x) * 4;
            const pixel = segment[sy - sortStart];
            data[sIdx] = pixel[0];
            data[sIdx + 1] = pixel[1];
            data[sIdx + 2] = pixel[2];
            data[sIdx + 3] = pixel[3];
          }

          sortStart = -1;
        }
      }
    }
  }
};

/**
 * Unified Vintage Effect - Combines Sepia, Old Photo, Faded Film,
 * Cross Process, Scratched Film, and Instant/Polaroid into one effect.
 *
 * Presets: 0=Sepia, 1=Old Photo, 2=Faded Film, 3=Cross Process,
 *          4=Scratched Film, 5=Instant/Polaroid
 */
const createUnifiedVintageEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const intensity = settings.intensity ?? 0.7;
    const vignette = settings.vignette ?? 0.5;
    const grain = settings.grain ?? 0.3;
    const scratches = settings.scratches ?? 0;
    const fade = settings.fade ?? 0;
    const warmth = (settings.warmth ?? 0.5) - 0.5; // -0.5 to 0.5
    const opacity = settings.opacity ?? 1;

    const pool = getBufferPool();
    const original = opacity < 1 ? pool.acquire(data.length) : null;

    try {
      if (original) {
        original.set(data);
      }

      // Apply base color transformation based on preset
      switch (preset) {
        case 0: // Sepia
          applySepiaTone(data, intensity);
          break;
        case 1: // Old Photo
          applyOldPhotoTone(data, intensity, fade);
          break;
        case 2: // Faded Film
          applyFadedFilm(data, intensity, fade);
          break;
        case 3: // Cross Process
          applyCrossProcess(data, intensity);
          break;
        case 4: // Scratched Film
          applyScratchedFilm(data, width, height, intensity, scratches);
          break;
        case 5: // Instant/Polaroid
          applyPolaroid(data, intensity, warmth);
          break;
      }

      // Apply common vintage effects
      if (warmth !== 0) {
        applyWarmth(data, warmth);
      }

      if (grain > 0) {
        applyFilmGrain(data, grain);
      }

      if (vignette > 0) {
        applyVintageVignette(data, width, height, vignette);
      }

      // Apply opacity blending with original
      if (original) {
        applyOpacityBlend(data, original, opacity);
      }
    } finally {
      if (original) {
        pool.release(original);
      }
    }
  };
};

// Helper functions for Unified Vintage
const applySepiaTone = (data: Uint8ClampedArray, intensity: number) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;

    const sepiaR = gray * 1.2;
    const sepiaG = gray * 0.9;
    const sepiaB = gray * 0.6;

    data[i] = Math.min(255, r * (1 - intensity) + sepiaR * intensity);
    data[i + 1] = Math.min(255, g * (1 - intensity) + sepiaG * intensity);
    data[i + 2] = Math.min(255, b * (1 - intensity) + sepiaB * intensity);
  }
};

const applyOldPhotoTone = (data: Uint8ClampedArray, intensity: number, fade: number) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;

    // Warm sepia with slight fade
    let newR = gray * 1.1 + 20;
    let newG = gray * 0.95 + 10;
    let newB = gray * 0.7;

    // Apply fade (lift blacks)
    const fadeAmount = fade * 50;
    newR = Math.min(255, newR + fadeAmount);
    newG = Math.min(255, newG + fadeAmount);
    newB = Math.min(255, newB + fadeAmount);

    data[i] = Math.min(255, r * (1 - intensity) + newR * intensity);
    data[i + 1] = Math.min(255, g * (1 - intensity) + newG * intensity);
    data[i + 2] = Math.min(255, b * (1 - intensity) + newB * intensity);
  }
};

const applyFadedFilm = (data: Uint8ClampedArray, intensity: number, fade: number) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    // Reduce contrast and shift colors
    const contrast = 1 - intensity * 0.3;
    const fadeAmount = (fade + intensity * 0.3) * 30;

    let newR = (r - 128) * contrast + 128 + fadeAmount;
    const newG = (g - 128) * contrast + 128 + fadeAmount * 0.9;
    let newB = (b - 128) * contrast + 128 + fadeAmount * 0.8;

    // Slight cyan shadows, yellow highlights
    if (newR < 128) newB += intensity * 10;
    else newR += intensity * 10;

    data[i] = clampByte(newR);
    data[i + 1] = clampByte(newG);
    data[i + 2] = clampByte(newB);
  }
};

const applyCrossProcess = (data: Uint8ClampedArray, intensity: number) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    // Cross-process: boost contrast, shift colors
    const newR = r * 1.1 + (r > 128 ? 20 : -10);
    const newG = g * 0.9;
    const newB = b * 1.2 + (b < 128 ? 30 : 0);

    data[i] = clampByte(r * (1 - intensity) + newR * intensity);
    data[i + 1] = clampByte(g * (1 - intensity) + newG * intensity);
    data[i + 2] = clampByte(b * (1 - intensity) + newB * intensity);
  }
};

const applyScratchedFilm = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  scratchAmount: number
) => {
  // Apply base sepia
  applySepiaTone(data, intensity * 0.7);

  // Add scratches
  const numScratches = Math.floor(scratchAmount * 20);
  for (let s = 0; s < numScratches; s++) {
    const scratchX = Math.floor(Math.random() * width);
    const scratchWidth = Math.random() < 0.5 ? 1 : 2;

    for (let y = 0; y < height; y++) {
      if (Math.random() < 0.95) {
        // Make scratches slightly discontinuous
        for (let dx = 0; dx < scratchWidth; dx++) {
          const x = scratchX + dx;
          if (x >= 0 && x < width) {
            const idx = (y * width + x) * 4;
            const brightness = 200 + Math.floor(Math.random() * 55);
            data[idx] = Math.min(255, data[idx] + (brightness - data[idx]) * 0.5);
            data[idx + 1] = Math.min(255, data[idx + 1] + (brightness - data[idx + 1]) * 0.5);
            data[idx + 2] = Math.min(255, data[idx + 2] + (brightness - data[idx + 2]) * 0.5);
          }
        }
      }
    }
  }
};

const applyPolaroid = (data: Uint8ClampedArray, intensity: number, warmth: number) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    // Polaroid look: slightly faded, warm tones, reduced contrast
    const contrast = 0.9;
    let newR = (r - 128) * contrast + 128 + 10;
    const newG = (g - 128) * contrast + 128 + 5;
    let newB = (b - 128) * contrast + 128 - 10;

    // Add warmth
    newR += warmth * 30;
    newB -= warmth * 20;

    data[i] = clampByte(r * (1 - intensity) + newR * intensity);
    data[i + 1] = clampByte(g * (1 - intensity) + newG * intensity);
    data[i + 2] = clampByte(b * (1 - intensity) + newB * intensity);
  }
};

const applyWarmth = (data: Uint8ClampedArray, warmth: number) => {
  const shift = warmth * 30;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(data[i] + shift);
    data[i + 2] = clampByte(data[i + 2] - shift * 0.5);
  }
};

const applyFilmGrain = (data: Uint8ClampedArray, amount: number) => {
  const grainStrength = amount * 40;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * grainStrength;
    data[i] = clampByte(data[i] + noise);
    data[i + 1] = clampByte(data[i + 1] + noise);
    data[i + 2] = clampByte(data[i + 2] + noise);
  }
};

const applyVintageVignette = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = 1 - (dist / maxDist) * amount;

      const idx = (y * width + x) * 4;
      data[idx] *= factor;
      data[idx + 1] *= factor;
      data[idx + 2] *= factor;
    }
  }
};

/**
 * Unified Warp Effect - Combines Pixelate, Swirl, Kaleidoscope, Fisheye,
 * Spherize, Pinch/Bulge, Wave/Ripple, and Shatter into one effect.
 *
 * Presets: 0=Pixelate, 1=Swirl, 2=Kaleidoscope, 3=Fisheye, 4=Spherize,
 *          5=Pinch/Bulge, 6=Wave/Ripple, 7=Shatter
 */
const createUnifiedWarpEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const amount = settings.amount ?? 0.5;
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;
    const segments = Math.floor(settings.segments ?? 6);
    const radius = (settings.radius ?? 0.5) * Math.min(width, height);
    const opacity = settings.opacity ?? 1;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    switch (preset) {
      case 0: // Pixelate
        applyPixelateWarp(data, tempData, width, height, Math.floor(amount * 50) + 2);
        break;
      case 1: // Swirl
        applySwirlWarp(data, tempData, width, height, amount * 10, centerX, centerY, radius);
        break;
      case 2: // Kaleidoscope
        applyKaleidoscopeWarp(data, tempData, width, height, segments, centerX, centerY);
        break;
      case 3: // Fisheye
        applyFisheyeWarp(data, tempData, width, height, amount * 2, centerX, centerY);
        break;
      case 4: // Spherize
        applySpherizeWarp(data, tempData, width, height, amount, centerX, centerY, radius);
        break;
      case 5: // Pinch/Bulge
        applyPinchBulgeWarp(
          data,
          tempData,
          width,
          height,
          (amount - 0.5) * 2,
          centerX,
          centerY,
          radius
        );
        break;
      case 6: // Wave/Ripple
        applyWaveWarp(data, tempData, width, height, amount * 30, settings.frequency ?? 10);
        break;
      case 7: // Shatter
        applyShatterWarp(data, tempData, width, height, amount);
        break;
    }

    // Apply opacity blending with original (tempData contains original)
    if (opacity < 1) {
      applyOpacityBlend(data, tempData, opacity);
    }
  };
};

// Helper functions for Unified Warp
const applyPixelateWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number
) => {
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      // Calculate average color of block
      for (let y = by; y < Math.min(by + blockSize, height); y++) {
        for (let x = bx; x < Math.min(bx + blockSize, width); x++) {
          const idx = (y * width + x) * 4;
          r += tempData[idx];
          g += tempData[idx + 1];
          b += tempData[idx + 2];
          count++;
        }
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      // Apply average to all pixels in block
      for (let y = by; y < Math.min(by + blockSize, height); y++) {
        for (let x = bx; x < Math.min(bx + blockSize, width); x++) {
          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        }
      }
    }
  }
};

const applySwirlWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  cx: number,
  cy: number,
  radius: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const factor = 1 - dist / radius;
        const angle = factor * factor * amount;

        const srcX = Math.round(cx + dx * Math.cos(angle) - dy * Math.sin(angle));
        const srcY = Math.round(cy + dx * Math.sin(angle) + dy * Math.cos(angle));

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const idx = (y * width + x) * 4;
          const srcIdx = (srcY * width + srcX) * 4;
          data[idx] = tempData[srcIdx];
          data[idx + 1] = tempData[srcIdx + 1];
          data[idx + 2] = tempData[srcIdx + 2];
        }
      }
    }
  }
};

const applyKaleidoscopeWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  segments: number,
  cx: number,
  cy: number
) => {
  const segmentAngle = (2 * Math.PI) / segments;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);

      if (angle < 0) angle += 2 * Math.PI;

      // Map to first segment, reflecting if needed
      const segmentIndex = Math.floor(angle / segmentAngle);
      let localAngle = angle - segmentIndex * segmentAngle;

      if (segmentIndex % 2 === 1) {
        localAngle = segmentAngle - localAngle;
      }

      const srcX = Math.round(cx + dist * Math.cos(localAngle));
      const srcY = Math.round(cy + dist * Math.sin(localAngle));

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const idx = (y * width + x) * 4;
        const srcIdx = (srcY * width + srcX) * 4;
        data[idx] = tempData[srcIdx];
        data[idx + 1] = tempData[srcIdx + 1];
        data[idx + 2] = tempData[srcIdx + 2];
      }
    }
  }
};

const applyFisheyeWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  cx: number,
  cy: number
) => {
  const maxRadius = Math.min(width, height) / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / maxRadius;
      const dy = (y - cy) / maxRadius;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        const factor = Math.pow(dist, amount) / dist;
        const srcX = Math.round(cx + dx * factor * maxRadius);
        const srcY = Math.round(cy + dy * factor * maxRadius);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const idx = (y * width + x) * 4;
          const srcIdx = (srcY * width + srcX) * 4;
          data[idx] = tempData[srcIdx];
          data[idx + 1] = tempData[srcIdx + 1];
          data[idx + 2] = tempData[srcIdx + 2];
        }
      }
    }
  }
};

const applySpherizeWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  cx: number,
  cy: number,
  radius: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const factor = dist / radius;
        const sphereFactor = Math.sqrt(1 - factor * factor) * amount + (1 - amount);

        const srcX = Math.round(cx + dx * sphereFactor);
        const srcY = Math.round(cy + dy * sphereFactor);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const idx = (y * width + x) * 4;
          const srcIdx = (srcY * width + srcX) * 4;
          data[idx] = tempData[srcIdx];
          data[idx + 1] = tempData[srcIdx + 1];
          data[idx + 2] = tempData[srcIdx + 2];
        }
      }
    }
  }
};

const applyPinchBulgeWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number, // negative = pinch, positive = bulge
  cx: number,
  cy: number,
  radius: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const factor = dist / radius;
        const warpFactor = Math.pow(factor, 1 - amount);

        const srcX = Math.round(cx + (dx * warpFactor) / factor);
        const srcY = Math.round(cy + (dy * warpFactor) / factor);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const idx = (y * width + x) * 4;
          const srcIdx = (srcY * width + srcX) * 4;
          data[idx] = tempData[srcIdx];
          data[idx + 1] = tempData[srcIdx + 1];
          data[idx + 2] = tempData[srcIdx + 2];
        }
      }
    }
  }
};

const applyWaveWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amplitude: number,
  frequency: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offsetX = Math.sin(y / frequency) * amplitude;
      const offsetY = Math.cos(x / frequency) * amplitude;

      const srcX = Math.round(x + offsetX);
      const srcY = Math.round(y + offsetY);

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const idx = (y * width + x) * 4;
        const srcIdx = (srcY * width + srcX) * 4;
        data[idx] = tempData[srcIdx];
        data[idx + 1] = tempData[srcIdx + 1];
        data[idx + 2] = tempData[srcIdx + 2];
      }
    }
  }
};

const applyShatterWarp = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
) => {
  const numShards = Math.floor(5 + amount * 20);
  const shardCenters: { x: number; y: number; offsetX: number; offsetY: number }[] = [];

  // Generate random shard centers with offsets
  for (let i = 0; i < numShards; i++) {
    shardCenters.push({
      x: Math.random() * width,
      y: Math.random() * height,
      offsetX: (Math.random() - 0.5) * amount * 50,
      offsetY: (Math.random() - 0.5) * amount * 50,
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Find nearest shard center
      let nearestDist = Infinity;
      let nearestShard = shardCenters[0];

      for (const shard of shardCenters) {
        const dist = Math.sqrt(Math.pow(x - shard.x, 2) + Math.pow(y - shard.y, 2));
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestShard = shard;
        }
      }

      // Apply offset from that shard
      const srcX = Math.round(x + nearestShard.offsetX);
      const srcY = Math.round(y + nearestShard.offsetY);

      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const idx = (y * width + x) * 4;
        const srcIdx = (srcY * width + srcX) * 4;
        data[idx] = tempData[srcIdx];
        data[idx + 1] = tempData[srcIdx + 1];
        data[idx + 2] = tempData[srcIdx + 2];
      }
    }
  }
};

/**
 * Unified Blur Effect - Combines Gaussian, Bokeh, Depth/Tilt-Shift,
 * Motion, and Radial blur into one effect.
 *
 * Presets: 0=Gaussian, 1=Bokeh, 2=Tilt-Shift, 3=Motion, 4=Radial/Zoom
 */
const createUnifiedBlurEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const radius = Math.floor(settings.radius ?? 10);
    const focusX = (settings.focusX ?? 0.5) * width;
    const focusY = (settings.focusY ?? 0.5) * height;
    const focusSize = (settings.focusSize ?? 0.3) * Math.min(width, height);
    const angle = (settings.angle ?? 0) * (Math.PI / 180);
    const opacity = settings.opacity ?? 1;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    switch (preset) {
      case 0: // Gaussian
        stackBlur(data, width, height, radius);
        break;
      case 1: // Bokeh (simulated with multi-pass)
        applyBokehBlur(data, tempData, width, height, radius);
        break;
      case 2: // Tilt-Shift
        applyTiltShiftBlur(data, tempData, width, height, radius, focusY, focusSize);
        break;
      case 3: // Motion
        applyMotionBlur(data, tempData, width, height, radius, angle);
        break;
      case 4: // Radial/Zoom
        applyRadialBlur(data, tempData, width, height, radius, focusX, focusY);
        break;
    }

    // Apply opacity blending with original (tempData contains original)
    if (opacity < 1) {
      applyOpacityBlend(data, tempData, opacity);
    }
  };
};

// Helper functions for Unified Blur
const applyBokehBlur = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
) => {
  // Simulate bokeh with hexagonal averaging
  const points = 6;
  const angleStep = (Math.PI * 2) / points;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      // Sample in hexagonal pattern
      for (let ring = 0; ring <= radius; ring++) {
        for (let p = 0; p < points; p++) {
          const angle = p * angleStep;
          const sampleX = Math.round(x + ring * Math.cos(angle));
          const sampleY = Math.round(y + ring * Math.sin(angle));

          if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
            const idx = (sampleY * width + sampleX) * 4;
            // Weight brighter pixels more for bokeh effect
            const brightness = (tempData[idx] + tempData[idx + 1] + tempData[idx + 2]) / 765;
            const weight = 1 + brightness * 2;
            r += tempData[idx] * weight;
            g += tempData[idx + 1] * weight;
            b += tempData[idx + 2] * weight;
            count += weight;
          }
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / count);
      data[idx + 1] = Math.round(g / count);
      data[idx + 2] = Math.round(b / count);
    }
  }
};

const applyTiltShiftBlur = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  maxRadius: number,
  focusY: number,
  focusSize: number
) => {
  // Create blurred version
  const blurred = new Uint8ClampedArray(data.length);
  blurred.set(tempData);
  stackBlur(blurred, width, height, maxRadius);

  // Blend based on distance from focus band
  for (let y = 0; y < height; y++) {
    const distFromFocus = Math.abs(y - focusY);
    const blurAmount = Math.max(0, Math.min(1, (distFromFocus - focusSize / 2) / (focusSize / 2)));

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(tempData[idx] * (1 - blurAmount) + blurred[idx] * blurAmount);
      data[idx + 1] = Math.round(
        tempData[idx + 1] * (1 - blurAmount) + blurred[idx + 1] * blurAmount
      );
      data[idx + 2] = Math.round(
        tempData[idx + 2] * (1 - blurAmount) + blurred[idx + 2] * blurAmount
      );
    }
  }
};

const applyMotionBlur = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  angle: number
) => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let i = -radius; i <= radius; i++) {
        const sampleX = Math.round(x + i * dx);
        const sampleY = Math.round(y + i * dy);

        if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
          const idx = (sampleY * width + sampleX) * 4;
          r += tempData[idx];
          g += tempData[idx + 1];
          b += tempData[idx + 2];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / count);
      data[idx + 1] = Math.round(g / count);
      data[idx + 2] = Math.round(b / count);
    }
  }
};

const applyRadialBlur = (
  data: Uint8ClampedArray,
  tempData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  cx: number,
  cy: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      // Sample along the radial direction
      for (let i = -radius; i <= radius; i++) {
        const sampleDist = dist + i;
        const sampleX = Math.round(cx + sampleDist * Math.cos(angle));
        const sampleY = Math.round(cy + sampleDist * Math.sin(angle));

        if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
          const idx = (sampleY * width + sampleX) * 4;
          r += tempData[idx];
          g += tempData[idx + 1];
          b += tempData[idx + 2];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / count);
      data[idx + 1] = Math.round(g / count);
      data[idx + 2] = Math.round(b / count);
    }
  }
};

// Define all available effects with their settings
export const effectsConfig: Record<string, EffectConfig> = {
  // Basic Adjustments - Standardized to intuitive percentage-based ranges
  brightness: {
    label: 'Brightness',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Amount (%)',
        min: -100,
        max: 100,
        defaultValue: 0,
        step: 1,
      },
    ],
  },
  contrast: {
    label: 'Contrast',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Amount (%)',
        min: -100,
        max: 100,
        defaultValue: 0,
        step: 1,
      },
    ],
  },
  saturation: {
    label: 'Saturation',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Amount (%)',
        min: -100,
        max: 100,
        defaultValue: 0,
        step: 1,
      },
    ],
  },
  hue: {
    label: 'Hue Rotation',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Degrees',
        min: 0,
        max: 360,
        defaultValue: 0,
        step: 1,
      },
    ],
  },

  dehaze: {
    label: 'Dehaze',
    category: 'Adjust',
    settings: [
      {
        id: 'amount',
        label: 'Amount',
        min: 0,
        max: 1,
        defaultValue: 0.35,
        step: 0.05,
      },
    ],
  },
  relight: {
    label: 'Relight',
    category: 'Adjust',
    settings: [
      {
        id: 'angle',
        label: 'Light Angle (Degrees)',
        min: 0,
        max: 360,
        defaultValue: 45,
        step: 1,
      },
      {
        id: 'strength',
        label: 'Strength',
        min: 0,
        max: 1,
        defaultValue: 0.4,
        step: 0.05,
      },
      {
        id: 'ambient',
        label: 'Ambient',
        min: 0,
        max: 1,
        defaultValue: 0.2,
        step: 0.05,
      },
    ],
  },

  // Filters
  grayscale: {
    label: 'Grayscale',
    category: 'Filters',
  },
  blackAndWhite: {
    label: 'Black & White',
    category: 'Filters',
    settings: [
      { id: 'contrast', label: 'Contrast', min: 0.5, max: 2, defaultValue: 1.2, step: 0.1 },
      { id: 'brightness', label: 'Brightness', min: -0.3, max: 0.3, defaultValue: 0, step: 0.05 },
    ],
  },
  sepia: {
    label: 'Sepia',
    category: 'Filters',
  },
  // UNIFIED MONOCHROME - Combines B&W, Grayscale, Sepia, Cyanotype, etc.
  unifiedMono: {
    label: 'Monochrome',
    category: 'Filters',
    settings: [
      {
        id: 'tone',
        label: 'Tone (0=Gray, 1=Sepia, 2=Cyan, 3=Cool, 4=Warm)',
        min: 0,
        max: 4,
        defaultValue: 0,
        step: 1,
      },
      { id: 'intensity', label: 'Intensity (%)', min: 0, max: 100, defaultValue: 100, step: 5 },
      { id: 'contrast', label: 'Contrast (%)', min: 50, max: 200, defaultValue: 100, step: 5 },
      { id: 'brightness', label: 'Brightness (%)', min: -50, max: 50, defaultValue: 0, step: 5 },
    ],
  },
  invert: {
    label: 'Invert',
    category: 'Filters',
  },

  // Color Effects
  duotone: {
    label: 'Duotone',
    category: 'Color Effects',
    settings: [
      {
        id: 'color1',
        label: 'Color 1 (Hex#)',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0x0000ff,
        step: 1,
      },
      {
        id: 'color2',
        label: 'Color 2 (Hex#)',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffff00,
        step: 1,
      },
    ],
  },

  gradientMap: {
    label: 'Gradient Map',
    category: 'Color Effects',
    settings: [
      {
        id: 'shadowColor',
        label: 'Shadow Color (Hex#)',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0x1b1f3a,
        step: 1,
      },
      {
        id: 'midColor',
        label: 'Mid Color (Hex#)',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xb9c6d3,
        step: 1,
      },
      {
        id: 'highlightColor',
        label: 'Highlight Color (Hex#)',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffd6a5,
        step: 1,
      },
      {
        id: 'midpoint',
        label: 'Midpoint',
        min: 0.1,
        max: 0.9,
        defaultValue: 0.5,
        step: 0.01,
      },
      {
        id: 'strength',
        label: 'Strength',
        min: 0,
        max: 1,
        defaultValue: 1,
        step: 0.05,
      },
    ],
  },
  toneCurve: {
    label: 'Tone Curve',
    category: 'Color Effects',
    settings: [
      {
        id: 'amount',
        label: 'Curve',
        min: -1,
        max: 1,
        defaultValue: 0.25,
        step: 0.05,
      },
    ],
  },
  cinematicLut: {
    label: 'Cinematic LUT',
    category: 'Color Effects',
    presetNames: ['Teal/Orange', 'Bleach', 'Film Fade', 'Pastel'],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'strength',
        label: 'Strength',
        min: 0,
        max: 1,
        defaultValue: 0.75,
        step: 0.05,
      },
    ],
  },

  // Blur & Focus - Expanded ranges for more control
  blur: {
    label: 'Blur',
    category: 'Blur & Focus',
    settings: [
      {
        id: 'radius',
        label: 'Radius',
        min: 0,
        max: 100,
        defaultValue: 5,
        step: 0.5,
      },
    ],
  },
  sharpen: {
    label: 'Sharpen',
    category: 'Blur & Focus',
    settings: [
      {
        id: 'value',
        label: 'Amount',
        min: 0,
        max: 10,
        defaultValue: 1,
        step: 0.5,
      },
    ],
  },

  bokeh: {
    label: 'Bokeh',
    category: 'Blur & Focus',
    settings: [
      { id: 'radius', label: 'Blur Radius', min: 0, max: 30, defaultValue: 10, step: 1 },
      {
        id: 'threshold',
        label: 'Highlight Threshold',
        min: 0.4,
        max: 0.98,
        defaultValue: 0.78,
        step: 0.005,
      },
      { id: 'strength', label: 'Blur Mix', min: 0, max: 1, defaultValue: 0.65, step: 0.05 },
      { id: 'highlights', label: 'Highlight Boost', min: 0, max: 2, defaultValue: 0.9, step: 0.05 },
    ],
  },
  depthBlur: {
    label: 'Depth Blur',
    category: 'Blur & Focus',
    settings: [
      { id: 'focusY', label: 'Focus Y', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      { id: 'range', label: 'Focus Range', min: 0, max: 0.5, defaultValue: 0.18, step: 0.01 },
      { id: 'radius', label: 'Max Blur', min: 0, max: 30, defaultValue: 14, step: 1 },
    ],
  },

  // Distortion
  pixelate: {
    label: 'Pixelate',
    category: 'Distortion',
    settings: [
      {
        id: 'pixelSize',
        label: 'Pixel Size',
        min: 1,
        max: 128,
        defaultValue: 8,
        step: 1,
      },
    ],
  },
  noise: {
    label: 'Noise',
    category: 'Distortion',
    settings: [
      {
        id: 'value',
        label: 'Amount',
        min: 0,
        max: 2,
        defaultValue: 0.2,
        step: 0.01,
      },
    ],
  },

  // Updated Artistic Category
  threshold: {
    label: 'Threshold',
    category: 'Artistic',
    settings: [
      {
        id: 'value',
        label: 'Level',
        min: 0,
        max: 1,
        defaultValue: 0.5,
        step: 0.01,
      },
    ],
  },
  posterize: {
    label: 'Posterize',
    category: 'Artistic',
    settings: [
      {
        id: 'levels',
        label: 'Levels',
        min: 2,
        max: 32,
        defaultValue: 4,
        step: 1,
      },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  pencilSketch: {
    label: 'Pencil Sketch',
    category: 'Artistic',
    settings: [
      { id: 'intensity', label: 'Intensity', min: 0.1, max: 2.0, defaultValue: 1.0, step: 0.1 },
      { id: 'lineWeight', label: 'Line Weight', min: 1, max: 5, defaultValue: 2, step: 1 },
      { id: 'contrast', label: 'Contrast', min: 0.5, max: 2.0, defaultValue: 1.2, step: 0.1 },
    ],
  },
  // UNIFIED SKETCH - Combines pencilSketch, crosshatch, etchedLines, inkWash, inkOutlinePop
  unifiedSketch: {
    label: 'Sketch',
    category: 'Artistic',
    presetNames: ['Pencil', 'Crosshatch', 'Etched', 'Ink Wash', 'Bold Ink'],
    settings: [
      {
        id: 'style',
        label: 'Style',
        min: 0,
        max: 4,
        defaultValue: 0,
        step: 1,
      },
      { id: 'lineWeight', label: 'Line Weight', min: 1, max: 10, defaultValue: 2, step: 1 },
      { id: 'density', label: 'Line Density (%)', min: 10, max: 100, defaultValue: 60, step: 5 },
      { id: 'contrast', label: 'Contrast (%)', min: 50, max: 200, defaultValue: 120, step: 10 },
      { id: 'invert', label: 'Invert (0=No, 1=Yes)', min: 0, max: 1, defaultValue: 0, step: 1 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  halftone: {
    label: 'Halftone',
    category: 'Artistic',
    settings: [
      { id: 'dotSize', label: 'Dot Size', min: 1, max: 100, defaultValue: 5, step: 1 },
      { id: 'spacing', label: 'Spacing', min: 2, max: 100, defaultValue: 8, step: 1 },
      { id: 'angle', label: 'Angle', min: 0, max: 180, defaultValue: 45, step: 5 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  // UNIFIED PATTERN - Combines halftone, dotScreen, dithering, stippling
  unifiedPattern: {
    label: 'Pattern',
    category: 'Artistic',
    settings: [
      {
        id: 'pattern',
        label: 'Pattern (0=Dots, 1=Screen, 2=Dither, 3=Stipple)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      { id: 'size', label: 'Size', min: 2, max: 100, defaultValue: 8, step: 1 },
      { id: 'density', label: 'Density (%)', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'angle', label: 'Angle', min: 0, max: 180, defaultValue: 45, step: 5 },
      {
        id: 'colorMode',
        label: 'Color (0=B&W, 1=Original)',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  bloom: {
    label: 'Bloom',
    category: 'Blur & Focus',
    settings: [
      { id: 'strength', label: 'Strength (%)', min: 0, max: 100, defaultValue: 50, step: 5 },
      { id: 'radius', label: 'Radius', min: 1, max: 100, defaultValue: 15, step: 1 },
    ],
  },
  // UNIFIED GLOW - Combines bloom, halation, bioluminescence, neon edges, orton
  unifiedGlow: {
    label: 'Glow',
    category: 'Blur & Focus',
    presetNames: ['Bloom', 'Dreamy', 'Neon', 'Bioluminescent', 'Halation'],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 4,
        defaultValue: 0,
        step: 1,
      },
      { id: 'intensity', label: 'Intensity (%)', min: 0, max: 100, defaultValue: 50, step: 5 },
      { id: 'radius', label: 'Glow Radius', min: 1, max: 100, defaultValue: 20, step: 1 },
      { id: 'threshold', label: 'Threshold (%)', min: 0, max: 100, defaultValue: 50, step: 5 },
      { id: 'colorShift', label: 'Color Shift', min: 0, max: 100, defaultValue: 0, step: 5 },
      {
        id: 'darkenBg',
        label: 'Darken Background (%)',
        min: 0,
        max: 100,
        defaultValue: 0,
        step: 5,
      },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },

  // ============================================================================
  // NEW UNIFIED EFFECTS
  // ============================================================================

  unifiedGlitch: {
    label: 'Glitch',
    category: 'Distort',
    presetNames: [
      'RGB Split',
      'Chromatic',
      'Scanlines',
      'VHS',
      'Corrupt',
      'Databend',
      'Pixel Sort',
    ],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 6,
        defaultValue: 0,
        step: 1,
      },
      { id: 'intensity', label: 'Intensity', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'amount', label: 'Amount', min: 1, max: 50, defaultValue: 10, step: 1 },
      {
        id: 'direction',
        label: 'Direction (0=Horiz, 1=Vert, 2=Both)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      { id: 'blockSize', label: 'Block Size', min: 2, max: 32, defaultValue: 8, step: 1 },
      { id: 'randomness', label: 'Randomness', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  unifiedVintage: {
    label: 'Vintage',
    category: 'Color',
    presetNames: ['Sepia', 'Old Photo', 'Faded', 'Cross Process', 'Scratched', 'Polaroid'],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 5,
        defaultValue: 0,
        step: 1,
      },
      { id: 'intensity', label: 'Intensity', min: 0, max: 1, defaultValue: 0.7, step: 0.05 },
      { id: 'vignette', label: 'Vignette', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'grain', label: 'Grain', min: 0, max: 1, defaultValue: 0.3, step: 0.05 },
      { id: 'scratches', label: 'Scratches', min: 0, max: 1, defaultValue: 0, step: 0.05 },
      { id: 'fade', label: 'Fade', min: 0, max: 1, defaultValue: 0, step: 0.05 },
      { id: 'warmth', label: 'Warmth', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  unifiedWarp: {
    label: 'Warp',
    category: 'Distort',
    presetNames: [
      'Pixelate',
      'Swirl',
      'Kaleidoscope',
      'Fisheye',
      'Sphere',
      'Pinch',
      'Wave',
      'Shatter',
    ],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 7,
        defaultValue: 1,
        step: 1,
      },
      { id: 'amount', label: 'Amount', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'centerX', label: 'Center X', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'centerY', label: 'Center Y', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      {
        id: 'segments',
        label: 'Segments (Kaleidoscope)',
        min: 2,
        max: 16,
        defaultValue: 6,
        step: 1,
      },
      { id: 'radius', label: 'Radius', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'frequency', label: 'Frequency (Wave)', min: 5, max: 50, defaultValue: 10, step: 1 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  unifiedBlur: {
    label: 'Blur',
    category: 'Blur & Focus',
    presetNames: ['Gaussian', 'Bokeh', 'Tilt Shift', 'Motion', 'Radial'],
    settings: [
      {
        id: 'preset',
        label: 'Style',
        min: 0,
        max: 4,
        defaultValue: 0,
        step: 1,
      },
      { id: 'radius', label: 'Blur Radius', min: 1, max: 50, defaultValue: 10, step: 1 },
      { id: 'focusX', label: 'Focus X', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'focusY', label: 'Focus Y', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'focusSize', label: 'Focus Size', min: 0.1, max: 1, defaultValue: 0.3, step: 0.05 },
      { id: 'angle', label: 'Angle (Motion)', min: 0, max: 360, defaultValue: 0, step: 15 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },

  oilPainting: {
    label: 'Oil Painting',
    category: 'Artistic',
    settings: [
      { id: 'radius', label: 'Brush Size', min: 1, max: 10, defaultValue: 4, step: 1 },
      { id: 'intensity', label: 'Intensity', min: 0.1, max: 2.0, defaultValue: 1.0, step: 0.1 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  watercolor: {
    label: 'Watercolor',
    category: 'Artistic',
    settings: [
      { id: 'intensity', label: 'Wash', min: 0, max: 1, defaultValue: 0.7, step: 0.05 },
      { id: 'edges', label: 'Edge Ink', min: 0, max: 1, defaultValue: 0.35, step: 0.05 },
      { id: 'texture', label: 'Paper Texture', min: 0, max: 1, defaultValue: 0.25, step: 0.05 },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  toon: {
    label: 'Toon',
    category: 'Artistic',
    settings: [
      { id: 'smoothness', label: 'Smoothness', min: 0, max: 20, defaultValue: 8, step: 1 },
      { id: 'levels', label: 'Color Levels', min: 2, max: 64, defaultValue: 6, step: 1 },
      {
        id: 'edgeThreshold',
        label: 'Edge Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.25,
        step: 0.01,
      },
      {
        id: 'edgeStrength',
        label: 'Edge Strength',
        min: 0,
        max: 1,
        defaultValue: 0.85,
        step: 0.05,
      },
      { id: 'opacity', label: 'Effect Opacity', min: 0, max: 1, defaultValue: 1, step: 0.05 },
    ],
  },
  posterEdges: {
    label: 'Poster Edges',
    category: 'Artistic',
    settings: [
      { id: 'levels', label: 'Poster Levels', min: 2, max: 32, defaultValue: 5, step: 1 },
      {
        id: 'edgeThreshold',
        label: 'Edge Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.2,
        step: 0.01,
      },
      { id: 'edgeStrength', label: 'Edge Strength', min: 0, max: 1, defaultValue: 0.9, step: 0.05 },
    ],
  },
  cutout: {
    label: 'Cutout',
    category: 'Artistic',
    settings: [
      { id: 'levels', label: 'Levels', min: 2, max: 32, defaultValue: 6, step: 1 },
      { id: 'edgeStrength', label: 'Edge Strength', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'soften', label: 'Soften', min: 0, max: 1, defaultValue: 0.2, step: 0.05 },
    ],
  },
  stainedGlass: {
    label: 'Stained Glass',
    category: 'Artistic',
    settings: [
      { id: 'cellSize', label: 'Cell Size', min: 4, max: 64, defaultValue: 18, step: 1 },
      {
        id: 'borderThickness',
        label: 'Border Thickness',
        min: 0,
        max: 8,
        defaultValue: 2,
        step: 1,
      },
      {
        id: 'borderDarkness',
        label: 'Lead Darkness',
        min: 0,
        max: 1,
        defaultValue: 0.85,
        step: 0.05,
      },
    ],
  },
  doubleExposure: {
    label: 'Double Exposure',
    category: 'Artistic',
    settings: [
      { id: 'offsetX', label: 'Offset X', min: -1, max: 1, defaultValue: 0.15, step: 0.05 },
      { id: 'offsetY', label: 'Offset Y', min: -1, max: 1, defaultValue: -0.1, step: 0.05 },
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      {
        id: 'blendMode',
        label: 'Blend (0=Screen, 1=Multiply, 2=Overlay)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
    ],
  },
  vignette: {
    label: 'Vignette',
    category: 'Artistic',
    settings: [
      { id: 'amount', label: 'Amount', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'falloff', label: 'Falloff', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
    ],
  },
  chromaticAberration: {
    label: 'Chromatic Aberration',
    category: 'Artistic',
    settings: [
      { id: 'amount', label: 'Amount', min: 0, max: 20, defaultValue: 5, step: 1 },
      { id: 'angle', label: 'Angle', min: 0, max: 360, defaultValue: 45, step: 5 },
    ],
  },
  scanLines: {
    label: 'Scan Lines',
    category: 'Artistic',
    settings: [
      { id: 'frequency', label: 'Frequency', min: 1, max: 20, defaultValue: 5, step: 1 },
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.3, step: 0.05 },
    ],
  },

  // Generative
  geometric: {
    label: 'Geometric',
    category: 'Generative',
    settings: [
      {
        id: 'gridSize',
        label: 'Grid Size',
        min: 4,
        max: 64,
        defaultValue: 16,
        step: 4,
      },
      {
        id: 'complexity',
        label: 'Complexity',
        min: 0,
        max: 1,
        defaultValue: 0.5,
        step: 0.1,
      },
    ],
  },
  stippling: {
    label: 'Stippling',
    category: 'Artistic',
    settings: [
      {
        id: 'density',
        label: 'Density',
        min: 0.1,
        max: 5,
        defaultValue: 1,
        step: 0.1,
      },
      {
        id: 'dotSize',
        label: 'Dot Size',
        min: 0.5,
        max: 3,
        defaultValue: 1,
        step: 0.1,
      },
      {
        id: 'useHatching',
        label: 'Use Hatching',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
    ],
  },
  cellular: {
    label: 'Cellular',
    category: 'Generative',
    settings: [
      {
        id: 'threshold',
        label: 'Threshold',
        min: 0.1,
        max: 0.9,
        defaultValue: 0.5,
        step: 0.05,
      },
      {
        id: 'iterations',
        label: 'Iterations',
        min: 1,
        max: 10,
        defaultValue: 3,
        step: 1,
      },
      {
        id: 'cellSize',
        label: 'Cell Size',
        min: 1,
        max: 8,
        defaultValue: 2,
        step: 1,
      },
    ],
  },
  crosshatch: {
    label: 'Crosshatch',
    category: 'Artistic',
    settings: [
      {
        id: 'spacing',
        label: 'Line Spacing',
        min: 2,
        max: 10,
        defaultValue: 4,
        step: 1,
      },
      {
        id: 'strength',
        label: 'Line Density',
        min: 0.2,
        max: 1,
        defaultValue: 0.6,
        step: 0.05,
      },
    ],
  },
  dotScreen: {
    label: 'Dot Screen',
    category: 'Artistic',
    settings: [
      {
        id: 'scale',
        label: 'Scale',
        min: 1,
        max: 15,
        defaultValue: 5,
        step: 1, // Size/density relationship
      },
      {
        id: 'angle',
        label: 'Angle',
        min: 0,
        max: 180,
        defaultValue: 25,
        step: 5,
      },
    ],
  },
  oldPhoto: {
    label: 'Old Photo',
    category: 'Artistic',
    settings: [
      { id: 'sepia', label: 'Sepia', min: 0, max: 1, defaultValue: 0.9, step: 0.1 },
      { id: 'noise', label: 'Noise', min: 0, max: 0.3, defaultValue: 0.1, step: 0.01 },
      { id: 'vignette', label: 'Vignette', min: 0, max: 0.8, defaultValue: 0.4, step: 0.1 },
    ],
  },
  pixelSort: {
    label: 'Pixel Sort',
    category: 'Distortion',
    settings: [
      {
        id: 'threshold',
        label: 'Brightness Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.3,
        step: 0.01,
      },
      { id: 'axis', label: 'Axis (0=X, 1=Y)', min: 0, max: 1, defaultValue: 0, step: 1 },
    ],
  },
  rgbShift: {
    label: 'RGB Shift',
    category: 'Distortion',
    settings: [
      { id: 'rOffset', label: 'Red Offset X', min: -20, max: 20, defaultValue: 4, step: 1 },
      { id: 'gOffset', label: 'Green Offset X', min: -20, max: 20, defaultValue: 0, step: 1 },
      { id: 'bOffset', label: 'Blue Offset X', min: -20, max: 20, defaultValue: -4, step: 1 },
    ],
  },

  // --- NEW EFFECTS START HERE ---

  // 1. Glitch Art
  glitchArt: {
    label: 'Glitch Art',
    category: 'Distortion', // Or maybe Artistic?
    settings: [
      { id: 'blockiness', label: 'Blockiness', min: 0, max: 0.3, defaultValue: 0.05, step: 0.01 },
      { id: 'colorShift', label: 'Color Shift', min: 0, max: 15, defaultValue: 5, step: 1 },
    ],
  },

  // 2. Color Quantization
  colorQuantization: {
    label: 'Quantize Colors',
    category: 'Color Effects',
    settings: [
      { id: 'numColors', label: 'Number of Colors', min: 2, max: 64, defaultValue: 16, step: 1 },
      {
        id: 'dithering',
        label: 'Dithering (0=No, 1=Yes)',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
    ],
  },

  // 3. ASCII Art Conversion
  asciiArt: {
    label: 'ASCII Art',
    category: 'Artistic',
    settings: [{ id: 'scale', label: 'Cell Size', min: 1, max: 10, defaultValue: 3, step: 1 }],
  },

  // 4. Edge Detection (Sobel)
  edgeDetection: {
    label: 'Edge Detection',
    category: 'Filters',
    settings: [
      { id: 'threshold', label: 'Threshold', min: 10, max: 150, defaultValue: 50, step: 5 },
      {
        id: 'invert',
        label: 'Invert Output (0=No, 1=Yes)',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
    ],
  },

  // 5. Swirl Distortion - Extended strength for more dramatic effects
  swirl: {
    label: 'Swirl',
    category: 'Distortion',
    settings: [
      { id: 'radius', label: 'Radius (%)', min: 5, max: 100, defaultValue: 50, step: 5 },
      { id: 'strength', label: 'Strength', min: -20, max: 20, defaultValue: 5, step: 1 },
      { id: 'centerX', label: 'Center X (%)', min: 0, max: 100, defaultValue: 50, step: 1 },
      { id: 'centerY', label: 'Center Y (%)', min: 0, max: 100, defaultValue: 50, step: 1 },
    ],
  },

  // 6. Lens Flare Simulation
  lensFlare: {
    label: 'Lens Flare',
    category: 'Filters',
    settings: [
      { id: 'x', label: 'Position X (0-1)', min: 0, max: 1, defaultValue: 0.2, step: 0.01 },
      { id: 'y', label: 'Position Y (0-1)', min: 0, max: 1, defaultValue: 0.2, step: 0.01 },
      { id: 'strength', label: 'Strength', min: 0.1, max: 2, defaultValue: 0.8, step: 0.05 },
    ],
  },

  // 7. Color Temperature/Tint
  colorTemperature: {
    label: 'Temperature/Tint',
    category: 'Color Effects',
    settings: [
      {
        id: 'temperature',
        label: 'Temperature (Warm/Cool)',
        min: -100,
        max: 100,
        defaultValue: 0,
        step: 1,
      },
      { id: 'tint', label: 'Tint (Green/Magenta)', min: -100, max: 100, defaultValue: 0, step: 1 },
    ],
  },

  // 8. Mosaic
  mosaic: {
    label: 'Mosaic',
    category: 'Artistic',
    settings: [
      { id: 'tileSize', label: 'Tile Size', min: 2, max: 50, defaultValue: 10, step: 1 },
      // shape: { label: 'Shape (0=Square, 1=Hex)', min: 0, max: 1, default: 0, step: 1 }, // Hex is more complex
    ],
  },

  // 9. Selective Color
  selectiveColor: {
    label: 'Selective Color',
    category: 'Color Effects',
    settings: [
      // Needs a color picker UI. Placeholder settings.
      { id: 'hue', label: 'Target Hue (0-360)', min: 0, max: 360, defaultValue: 0, step: 1 },
      { id: 'range', label: 'Hue Range', min: 5, max: 90, defaultValue: 30, step: 1 },
      { id: 'saturation', label: 'Saturation Boost', min: 1, max: 5, defaultValue: 1.5, step: 0.1 },
    ],
  },

  // 10. Fractal Noise Texture
  fractalNoise: {
    label: 'Fractal Noise',
    category: 'Filters',
    settings: [
      { id: 'scale', label: 'Scale', min: 0.01, max: 0.5, defaultValue: 0.1, step: 0.01 },
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.3, step: 0.05 },
      {
        id: 'blendMode',
        label: 'Blend (0=Overlay, 1=Multiply, ...)',
        min: 0,
        max: 5,
        defaultValue: 0,
        step: 1,
      }, // Needs mapping
    ],
  },
  // --- NEW EFFECTS END HERE ---
  // --- MORE UNIQUE EFFECTS START HERE ---
  // 11. Voronoi Diagram Pattern - Expanded range for artistic control
  voronoi: {
    label: 'Voronoi Pattern',
    category: 'Generative',
    settings: [
      {
        id: 'numPoints',
        label: 'Number of Points',
        min: 3,
        max: 1000,
        defaultValue: 100,
        step: 5,
      },
      {
        id: 'showLines',
        label: 'Show Lines (0=No, 1=Yes)',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
    ],
  },

  // 12. Kaleidoscope Effect - Expanded segments
  kaleidoscope: {
    label: 'Kaleidoscope',
    category: 'Distortion',
    settings: [
      { id: 'segments', label: 'Segments', min: 2, max: 32, defaultValue: 6, step: 1 },
      { id: 'centerX', label: 'Center X (%)', min: 0, max: 100, defaultValue: 50, step: 1 },
      { id: 'centerY', label: 'Center Y (%)', min: 0, max: 100, defaultValue: 50, step: 1 },
    ],
  },

  // 13. Liquid Distortion / Ink Bleed
  inkBleed: {
    label: 'Ink Bleed',
    category: 'Artistic Simulation',
    settings: [
      { id: 'amount', label: 'Bleed Amount', min: 1, max: 15, defaultValue: 5, step: 1 },
      {
        id: 'intensity',
        label: 'Intensity Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.3,
        step: 0.05,
      }, // Darker pixels bleed more
    ],
  },

  // 14. Heatmap / False Color
  heatmap: {
    label: 'Heatmap',
    category: 'Color Effects',
    settings: [
      {
        id: 'gradientType',
        label: 'Gradient (0=Classic, 1=Inferno, ...)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      }, // Needs mapping
    ],
  },

  // 15. Anaglyph 3D (Red/Cyan)
  anaglyph: {
    label: 'Anaglyph 3D',
    category: 'Distortion',
    settings: [
      { id: 'shift', label: 'Horizontal Shift', min: 1, max: 20, defaultValue: 5, step: 1 },
    ],
  },

  // 16. Scratched Film / CRT
  scratchedFilm: {
    label: 'Scratched Film',
    category: 'Filters',
    settings: [
      {
        id: 'scratchDensity',
        label: 'Scratch Density',
        min: 0,
        max: 0.5,
        defaultValue: 0.02,
        step: 0.005,
      },
      { id: 'dustOpacity', label: 'Dust Opacity', min: 0, max: 0.5, defaultValue: 0.1, step: 0.02 },
      { id: 'flicker', label: 'Flicker Amount', min: 0, max: 0.1, defaultValue: 0.03, step: 0.01 },
    ],
  },

  // 17. Circuit Board Trace
  circuitBoard: {
    label: 'Circuit Board',
    category: 'Artistic',
    settings: [
      { id: 'threshold', label: 'Edge Threshold', min: 20, max: 150, defaultValue: 60, step: 5 },
      { id: 'glow', label: 'Glow Amount', min: 0, max: 5, defaultValue: 2, step: 0.5 },
    ],
  },

  // 18. Pixel Explosion/Shatter
  pixelExplosion: {
    label: 'Pixel Explosion',
    category: 'Distortion',
    settings: [
      { id: 'strength', label: 'Explosion Strength', min: 5, max: 100, defaultValue: 30, step: 5 },
      { id: 'numPoints', label: 'Number of Centers', min: 1, max: 20, defaultValue: 5, step: 1 },
    ],
  },

  // 19. Non-Linear Warp (Fisheye)
  fisheyeWarp: {
    label: 'Fisheye Warp',
    category: 'Distortion',
    settings: [
      {
        id: 'strength',
        label: 'Distortion Strength',
        min: -1,
        max: 1,
        defaultValue: 0.3,
        step: 0.05,
      },
    ],
  },

  // --- MORE UNIQUE EFFECTS END HERE ---

  // --- NEW UNIQUE EFFECTS ---
  chromaticGlitch: {
    label: 'Chromatic Glitch',
    category: 'Distortion',
    settings: [
      { id: 'amount', label: 'Glitch Intensity', min: 0, max: 20, defaultValue: 5, step: 1 },
      { id: 'frequency', label: 'Band Frequency', min: 2, max: 50, defaultValue: 10, step: 1 },
    ],
  },
  liquidMetal: {
    label: 'Liquid Metal',
    category: 'Artistic Simulation',
    settings: [
      { id: 'intensity', label: 'Intensity', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'flicker', label: 'Shimmer', min: 0, max: 0.1, defaultValue: 0.03, step: 0.01 },
    ],
  },
  temporalEcho: {
    label: 'Temporal Echo',
    category: 'Blur & Focus',
    settings: [
      { id: 'echoes', label: 'Echo Count', min: 2, max: 10, defaultValue: 5, step: 1 },
      { id: 'decay', label: 'Decay', min: 0.1, max: 0.9, defaultValue: 0.7, step: 0.1 },
      { id: 'offset', label: 'Offset', min: 1, max: 20, defaultValue: 5, step: 1 },
    ],
  },
  kaleidoscopeFracture: {
    label: 'Kaleidoscope Fracture',
    category: 'Distortion',
    settings: [
      { id: 'segments', label: 'Segments', min: 3, max: 24, defaultValue: 8, step: 1 },
      { id: 'centerX', label: 'Center X (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      { id: 'centerY', label: 'Center Y (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
    ],
  },
  neuralDream: {
    label: 'Neural Dream',
    category: 'Artistic Simulation',
    settings: [
      { id: 'style', label: 'Style Intensity', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'noise', label: 'Dream Noise', min: 0, max: 0.5, defaultValue: 0.2, step: 0.02 },
    ],
  },
  holographicInterference: {
    label: 'Holographic Interference',
    category: 'Color Effects',
    settings: [
      { id: 'frequency', label: 'Pattern Frequency', min: 1, max: 20, defaultValue: 5, step: 1 },
      { id: 'phaseShift', label: 'Phase Shift', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
    ],
  },
  magneticField: {
    label: 'Magnetic Field',
    category: 'Artistic Simulation',
    settings: [
      { id: 'strength', label: 'Field Strength', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'direction', label: 'Field Direction', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
    ],
  },
  databending: {
    label: 'Databending',
    category: 'Distortion',
    settings: [
      { id: 'amount', label: 'Corruption Amount', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
      {
        id: 'distortion',
        label: 'Distortion Level',
        min: 0.1,
        max: 1,
        defaultValue: 0.3,
        step: 0.05,
      },
    ],
  },
  // --- NEW 10 EFFECTS ---
  paperCutArt: {
    label: 'Paper Cut Art',
    category: 'Artistic',
    settings: [{ id: 'layers', label: 'Paper Layers', min: 3, max: 8, defaultValue: 5, step: 1 }],
  },
  tiltShiftMiniature: {
    label: 'Tilt-Shift Miniature',
    category: 'Distortion',
    settings: [
      { id: 'focusY', label: 'Focus Position', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      {
        id: 'focusHeight',
        label: 'Focus Height',
        min: 0.1,
        max: 0.8,
        defaultValue: 0.3,
        step: 0.01,
      },
      { id: 'blurStrength', label: 'Blur Strength', min: 1, max: 20, defaultValue: 10, step: 1 },
      { id: 'saturation', label: 'Saturation Boost', min: 1, max: 3, defaultValue: 1.5, step: 0.1 },
    ],
  },
  neonGlowEdges: {
    label: 'Neon Glow Edges',
    category: 'Artistic',
    settings: [
      { id: 'glowWidth', label: 'Glow Size', min: 1, max: 10, defaultValue: 4, step: 1 },
      {
        id: 'glowIntensity',
        label: 'Glow Brightness',
        min: 0.2,
        max: 1,
        defaultValue: 0.6,
        step: 0.05,
      },
    ],
  },
  dispersionShatter: {
    label: 'Dispersion Shatter',
    category: 'Distortion',
    settings: [
      {
        id: 'dispersionAmount',
        label: 'Dispersion Force',
        min: 0.05,
        max: 0.5,
        defaultValue: 0.2,
        step: 0.05,
      },
      {
        id: 'shatterIntensity',
        label: 'Shatter Points',
        min: 0.1,
        max: 1,
        defaultValue: 0.5,
        step: 0.05,
      },
    ],
  },
  retroDithering: {
    label: 'Retro Dithering',
    category: 'Artistic',
    settings: [{ id: 'levels', label: 'Color Levels', min: 2, max: 8, defaultValue: 4, step: 1 }],
  },
  advancedDithering: {
    label: 'Dithering',
    category: 'Artistic',
    settings: [
      {
        id: 'algorithm',
        label:
          'Algorithm (0=Floyd-Steinberg, 1=Atkinson, 2=Ordered, 3=Stucki, 4=Sierra, 5=Blue Noise)',
        min: 0,
        max: 5,
        defaultValue: 1,
        step: 1,
      },
      {
        id: 'palette',
        label: 'Palette (0=B&W, 1=4-Color, 2=8-Color, 3=16-Color, 4=GameBoy, 5=CGA)',
        min: 0,
        max: 5,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'threshold',
        label: 'Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.5,
        step: 0.01,
      },
      {
        id: 'patternScale',
        label: 'Pattern Scale',
        min: 1,
        max: 8,
        defaultValue: 2,
        step: 1,
      },
      {
        id: 'contrast',
        label: 'Contrast Boost',
        min: 0,
        max: 2,
        defaultValue: 1,
        step: 0.05,
      },
    ],
  },
  atkinsonDithering: {
    label: 'Atkinson Dithering',
    category: 'Artistic',
    settings: [
      {
        id: 'colorMode',
        label: 'Color Mode (0=B&W, 1=Grayscale, 2=Color)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'levels',
        label: 'Color Levels',
        min: 2,
        max: 16,
        defaultValue: 2,
        step: 1,
      },
      {
        id: 'threshold',
        label: 'Threshold',
        min: 0,
        max: 1,
        defaultValue: 0.5,
        step: 0.01,
      },
    ],
  },
  orderedDithering: {
    label: 'Ordered (Bayer) Dithering',
    category: 'Artistic',
    settings: [
      {
        id: 'matrixSize',
        label: 'Matrix Size (2, 4, or 8)',
        min: 2,
        max: 8,
        defaultValue: 4,
        step: 2,
      },
      {
        id: 'colorMode',
        label: 'Color Mode (0=B&W, 1=Grayscale, 2=Color)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'levels',
        label: 'Color Levels',
        min: 2,
        max: 16,
        defaultValue: 2,
        step: 1,
      },
      {
        id: 'spread',
        label: 'Spread',
        min: 0,
        max: 1,
        defaultValue: 0.5,
        step: 0.01,
      },
    ],
  },
  blueNoiseDithering: {
    label: 'Blue Noise Dithering',
    category: 'Artistic',
    settings: [
      {
        id: 'colorMode',
        label: 'Color Mode (0=B&W, 1=Grayscale, 2=Color)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'levels',
        label: 'Color Levels',
        min: 2,
        max: 16,
        defaultValue: 2,
        step: 1,
      },
      {
        id: 'noiseScale',
        label: 'Noise Scale',
        min: 0.5,
        max: 4,
        defaultValue: 1,
        step: 0.1,
      },
    ],
  },
  halftonePattern: {
    label: 'Halftone Pattern',
    category: 'Artistic',
    settings: [
      {
        id: 'dotSize',
        label: 'Dot Size',
        min: 2,
        max: 20,
        defaultValue: 6,
        step: 1,
      },
      {
        id: 'angle',
        label: 'Angle',
        min: 0,
        max: 90,
        defaultValue: 45,
        step: 5,
      },
      {
        id: 'colorMode',
        label: 'Color Mode (0=B&W, 1=CMYK)',
        min: 0,
        max: 1,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'contrast',
        label: 'Contrast',
        min: 0.5,
        max: 2,
        defaultValue: 1,
        step: 0.05,
      },
    ],
  },
  retroPalette: {
    label: 'Retro Palette',
    category: 'Artistic',
    settings: [
      {
        id: 'palette',
        label: 'Palette (0=GameBoy, 1=CGA, 2=EGA, 3=C64, 4=NES, 5=Macintosh)',
        min: 0,
        max: 5,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'dithering',
        label: 'Dithering (0=None, 1=Atkinson, 2=Ordered)',
        min: 0,
        max: 2,
        defaultValue: 1,
        step: 1,
      },
      {
        id: 'ditherStrength',
        label: 'Dither Strength',
        min: 0,
        max: 1,
        defaultValue: 0.8,
        step: 0.05,
      },
    ],
  },
  topographicContours: {
    label: 'Topographic Contours',
    category: 'Artistic',
    settings: [
      { id: 'contourLevels', label: 'Contour Lines', min: 5, max: 20, defaultValue: 10, step: 1 },
    ],
  },
  weavePattern: {
    label: 'Weave Pattern',
    category: 'Artistic',
    settings: [
      { id: 'weaveSize', label: 'Thread Size', min: 4, max: 16, defaultValue: 8, step: 1 },
    ],
  },
  bioluminescence: {
    label: 'Bioluminescence',
    category: 'Artistic',
    settings: [
      {
        id: 'glowIntensity',
        label: 'Glow Intensity',
        min: 0.2,
        max: 1,
        defaultValue: 0.6,
        step: 0.05,
      },
      { id: 'glowSpread', label: 'Glow Spread', min: 0.1, max: 1, defaultValue: 0.4, step: 0.05 },
    ],
  },

  // Note: Mathematical/Fractal effects have been removed as they were not working properly

  // Orton Effect Implementation
  orton: {
    label: 'Orton Effect',
    category: 'Artistic',
    settings: [
      { id: 'blur', label: 'Blur', min: 1, max: 20, defaultValue: 5, step: 1 },
      { id: 'brightness', label: 'Brightness', min: 0, max: 1, defaultValue: 0.2, step: 0.01 },
      { id: 'glow', label: 'Glow', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      { id: 'blendMode', label: 'Blend Mode', min: 0, max: 2, defaultValue: 0, step: 1 }, // 0=Screen, 1=Overlay, 2=Soft Light
    ],
  },
};

// 16. Scratched Film Implementation
const createScratchedFilmEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const scratchDensity = settings.scratchDensity ?? 0.02;
    const dustOpacity = settings.dustOpacity ?? 0.1;
    const flicker = settings.flicker ?? 0.03;

    // Apply flicker (slight random brightness change per frame)
    const flickerAmount = (Math.random() - 0.5) * flicker * 2;
    const brightnessMultiplier = 1.0 + flickerAmount;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * brightnessMultiplier);
      data[i + 1] = Math.min(255, data[i + 1] * brightnessMultiplier);
      data[i + 2] = Math.min(255, data[i + 2] * brightnessMultiplier);
    }

    // Add scratches
    const numScratches = Math.floor(width * height * scratchDensity * 0.01); // Adjust density scaling
    for (let i = 0; i < numScratches; i++) {
      const startX = Math.random() * width;
      const scratchLength = height * (0.2 + Math.random() * 0.8);
      const scratchColor = Math.random() * 50 + 20; // Darkish gray scratches
      for (let y = 0; y < scratchLength; y++) {
        const currentY = Math.floor(y + Math.random() * (height - scratchLength));
        if (currentY < 0 || currentY >= height) continue;
        const currentX = Math.floor(startX + (Math.random() - 0.5) * 2); // Slight horizontal jitter
        if (currentX < 0 || currentX >= width) continue;

        const index = (currentY * width + currentX) * 4;
        data[index] = scratchColor;
        data[index + 1] = scratchColor;
        data[index + 2] = scratchColor;
      }
    }

    // Add dust
    const numDust = Math.floor(width * height * 0.01); // Fixed dust amount for now
    for (let i = 0; i < numDust; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const index = (y * width + x) * 4;
      const dustValue = Math.random() * 50; // Dark dust
      const alpha = dustOpacity * 255;
      // Simple blend (could be improved)
      data[index] = data[index] * (1 - dustOpacity) + dustValue * dustOpacity;
      data[index + 1] = data[index + 1] * (1 - dustOpacity) + dustValue * dustOpacity;
      data[index + 2] = data[index + 2] * (1 - dustOpacity) + dustValue * dustOpacity;
    }
  };
};

// 10. Fractal Noise Implementation (Using Simple Random Noise as Placeholder)
const createFractalNoiseEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const opacity = settings.opacity ?? 0.3;
    // const scale = settings.scale ?? 0.1; // Scale not used in simple random noise

    for (let i = 0; i < data.length; i += 4) {
      // Generate simple random gray noise value
      const noiseVal = Math.random() * 255;
      // Blend with original pixel based on opacity (Overlay-like blend approx)
      data[i] = lerp(data[i], noiseVal, opacity);
      data[i + 1] = lerp(data[i + 1], noiseVal, opacity);
      data[i + 2] = lerp(data[i + 2], noiseVal, opacity);
    }
  };
};

// 17. Circuit Board Trace Implementation (REWRITTEN for clarity/safety)
const createCircuitBoardEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const threshold = settings.threshold ?? 60;
    const glowAmount = settings.glow ?? 2;

    // Create intermediate buffers
    const grayData = new Uint8ClampedArray(data.length);
    const edgeMap = new Uint8ClampedArray(width * height); // Store edge magnitudes
    const outputData = new Uint8ClampedArray(data.length); // Final output buffer

    // --- Edge Detection (Sobel) ---
    // Grayscale conversion (read from `data`, write to `grayData`)
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      grayData[i] = grayData[i + 1] = grayData[i + 2] = avg;
      grayData[i + 3] = data[i + 3];
    }

    // Apply Sobel operator (read from `grayData`, store magnitude in `edgeMap`)
    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    let maxMagnitude = 0; // For potential normalization later if needed
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0,
          gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kIdx = (ky + 1) * 3 + (kx + 1);
            const pIdx = ((y + ky) * width + (x + kx)) * 4;
            gx += grayData[pIdx] * kernelX[kIdx];
            gy += grayData[pIdx] * kernelY[kIdx];
          }
        }
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude > threshold) {
          edgeMap[y * width + x] = Math.min(255, magnitude); // Store magnitude
          if (magnitude > maxMagnitude) maxMagnitude = magnitude;
        }
      }
    }
    // --- End Edge Detection ---

    // Copy original image data to outputData (preserves background/transparency)
    outputData.set(data);

    // Draw circuit lines with glow onto outputData
    const traceColor = [100, 255, 100, 255]; // Light green for traces (RGBA)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edgeMagnitude = edgeMap[y * width + x];
        if (edgeMagnitude > 0) {
          // If it's an edge pixel
          const index = (y * width + x) * 4;
          // Draw the main trace directly
          outputData[index] = traceColor[0];
          outputData[index + 1] = traceColor[1];
          outputData[index + 2] = traceColor[2];
          outputData[index + 3] = traceColor[3];
        }
      }
    }

    // Apply glow (reading edgeMap, writing to outputData)
    if (glowAmount > 0) {
      const glowRadius = Math.ceil(glowAmount);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // If current pixel is NOT an edge, check neighbors for glow
          if (edgeMap[y * width + x] === 0) {
            const glowAccum = [0, 0, 0];
            let totalWeight = 0;
            for (let dy = -glowRadius; dy <= glowRadius; dy++) {
              for (let dx = -glowRadius; dx <= glowRadius; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const neighborEdge = edgeMap[ny * width + nx];
                  if (neighborEdge > 0) {
                    // If neighbor is an edge
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= glowRadius * glowRadius) {
                      const weight = 1.0 - Math.sqrt(distSq) / glowRadius;
                      glowAccum[0] += traceColor[0] * weight;
                      glowAccum[1] += traceColor[1] * weight;
                      glowAccum[2] += traceColor[2] * weight;
                      totalWeight += weight;
                    }
                  }
                }
              }
            }
            if (totalWeight > 0) {
              const index = (y * width + x) * 4;
              const factor = 0.6 / totalWeight; // Adjust glow intensity/spread
              outputData[index] = Math.min(255, outputData[index] + glowAccum[0] * factor);
              outputData[index + 1] = Math.min(255, outputData[index + 1] + glowAccum[1] * factor);
              outputData[index + 2] = Math.min(255, outputData[index + 2] + glowAccum[2] * factor);
            }
          }
        }
      }
    }

    // Copy the final result back to the original data array
    data.set(outputData);
  };
};

// Implementation of Voronoi Pattern (Simplified - Nearest Point Color)
const createVoronoiEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const numPoints = Math.max(2, Math.floor(settings.numPoints ?? 100));
    const showLines = (settings.showLines ?? 0) > 0.5;
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Keep original for color sampling

    // Generate random points
    const points: { x: number; y: number; r: number; g: number; b: number; a: number }[] = [];
    for (let i = 0; i < numPoints; i++) {
      const px = Math.floor(Math.random() * width);
      const py = Math.floor(Math.random() * height);
      const pIndex = (py * width + px) * 4;
      points.push({
        x: px,
        y: py,
        r: tempData[pIndex],
        g: tempData[pIndex + 1],
        b: tempData[pIndex + 2],
        a: tempData[pIndex + 3],
      });
    }

    // For each pixel, find the nearest point and assign its color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minDistSq = Infinity;
        let nearestPoint = points[0];
        for (const p of points) {
          const dx = x - p.x;
          const dy = y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nearestPoint = p;
          }
        }
        const index = (y * width + x) * 4;
        data[index] = nearestPoint.r;
        data[index + 1] = nearestPoint.g;
        data[index + 2] = nearestPoint.b;
        data[index + 3] = nearestPoint.a;
      }
    }

    // Optional: Draw lines (simple check for neighbor difference)
    if (showLines) {
      const lineColor = [0, 0, 0, 255];
      const outputData = new Uint8ClampedArray(data.length);
      outputData.set(data); // Draw lines on top of colored cells
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          // Check immediate neighbors
          const neighbors = [
            (y * width + (x + 1)) * 4,
            (y * width + (x - 1)) * 4,
            ((y + 1) * width + x) * 4,
            ((y - 1) * width + x) * 4,
          ];
          let isBoundary = false;
          for (const nIndex of neighbors) {
            if (data[nIndex] !== r || data[nIndex + 1] !== g || data[nIndex + 2] !== b) {
              isBoundary = true;
              break;
            }
          }
          if (isBoundary) {
            outputData[index] = lineColor[0];
            outputData[index + 1] = lineColor[1];
            outputData[index + 2] = lineColor[2];
            outputData[index + 3] = lineColor[3];
          }
        }
      }
      data.set(outputData);
    }
  };
};
// 13. Ink Bleed Implementation (Enhanced)
const createInkBleedEffect = (settings: Record<string, number>) => {
  const baseRadius = clamp(settings.amount ?? 6, 1, 12);
  const intensityThreshold = clamp(settings.intensity ?? 0.45, 0.05, 0.95);
  const bleedStrength = clamp(settings.strength ?? 0.65, 0.1, 0.95);
  const softness = clamp(settings.softness ?? 0.35, 0, 1);

  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    if (width === 0 || height === 0) {
      return;
    }

    const source = new Uint8ClampedArray(data);
    const output = new Uint8ClampedArray(data.length);
    output.set(source);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = source[index];
        const g = source[index + 1];
        const b = source[index + 2];
        const a = source[index + 3];

        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        if (brightness < intensityThreshold) {
          const strength = (intensityThreshold - brightness) / intensityThreshold;
          const localRadius = Math.max(1, Math.round(baseRadius * (0.5 + strength)));

          for (let dy = -localRadius; dy <= localRadius; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;

            for (let dx = -localRadius; dx <= localRadius; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;

              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > localRadius) continue;

              const falloff = 1 - distance / (localRadius + 0.0001);
              const weight = bleedStrength * strength * falloff;
              if (weight <= 0) continue;

              const neighborIndex = (ny * width + nx) * 4;
              output[neighborIndex] = clamp(
                output[neighborIndex] * (1 - weight) + r * weight,
                0,
                255
              );
              output[neighborIndex + 1] = clamp(
                output[neighborIndex + 1] * (1 - weight) + g * weight,
                0,
                255
              );
              output[neighborIndex + 2] = clamp(
                output[neighborIndex + 2] * (1 - weight) + b * weight,
                0,
                255
              );
              output[neighborIndex + 3] = a;
            }
          }

          const soften = softness * strength;
          output[index] = clamp(output[index] * (1 - soften) + r * (1 + soften * 0.6), 0, 255);
          output[index + 1] = clamp(
            output[index + 1] * (1 - soften) + g * (1 + soften * 0.6),
            0,
            255
          );
          output[index + 2] = clamp(
            output[index + 2] * (1 - soften) + b * (1 + soften * 0.6),
            0,
            255
          );
          output[index + 3] = a;
        }
      }
    }

    data.set(output);
  };
};
// 18. Pixel Explosion Implementation (Revised output buffer handling)
const createPixelExplosionEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const strength = settings.strength ?? 30;
    const numPoints = Math.max(1, Math.floor(settings.numPoints ?? 5));
    const seed = settings.seed ?? 0; // Use seed for consistent previews

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    const outputData = new Uint8ClampedArray(data.length);
    outputData.set(tempData); // Initialize output with original image

    // Simple pseudo-random number generator with seed
    let rng = seed || 12345;
    const random = () => {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      return rng / 4294967296;
    };

    // Generate explosion centers with seeded random
    const centers: { x: number; y: number }[] = [];
    for (let i = 0; i < numPoints; i++) {
      centers.push({ x: random() * width, y: random() * height });
    }

    // For preview, use a small strength value if strength is 0
    const effectiveStrength = strength || 15;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * 4;

        // Find nearest center
        let nearestDistSq = Infinity;
        let nearestCenter = centers[0];
        for (const center of centers) {
          const dx = x - center.x;
          const dy = y - center.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestCenter = center;
          }
        }

        // Calculate displacement (ensure dist is not zero)
        const dist = Math.sqrt(nearestDistSq) || 1;
        const dx = x - nearestCenter.x;
        const dy = y - nearestCenter.y;
        // Normalize distance for consistent displacement feel across image sizes
        const normalizedDist = dist / Math.max(width, height);
        const displacement = normalizedDist * effectiveStrength;

        // Calculate target coords, clamping to bounds
        const targetX = Math.round(
          Math.min(width - 1, Math.max(0, x + (dx / dist) * displacement))
        );
        const targetY = Math.round(
          Math.min(height - 1, Math.max(0, y + (dy / dist) * displacement))
        );

        const targetIndex = (targetY * width + targetX) * 4;

        // Copy pixel data from original (tempData) to the new location in output buffer
        outputData[targetIndex] = tempData[srcIndex];
        outputData[targetIndex + 1] = tempData[srcIndex + 1];
        outputData[targetIndex + 2] = tempData[srcIndex + 2];
        outputData[targetIndex + 3] = tempData[srcIndex + 3];
      }
    }
    // Copy the result back to the original data array
    data.set(outputData);
  };
};

// 19. Fisheye Warp Implementation (Ensuring tempData read)
const createFisheyeWarpEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const strength = settings.strength ?? 0.3; // -1 to 1
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY);

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const index = (y * width + x) * 4;

        let srcX = x;
        let srcY = y;

        if (dist < radius && strength !== 0) {
          // Check strength to avoid division by zero implicitly
          const normalizedDist = dist / radius;
          const factor = 1.0 + strength;
          const adjustedFactor =
            Math.abs(factor) < 0.0001 ? (factor > 0 ? 0.0001 : -0.0001) : factor; // Avoid zero
          const newDist =
            (Math.atan(normalizedDist * adjustedFactor * 2) / (adjustedFactor * 2)) * radius;

          const angle = Math.atan2(dy, dx);

          srcX = centerX + Math.cos(angle) * newDist;
          srcY = centerY + Math.sin(angle) * newDist;
        }

        // Clamp source coordinates and handle potential floating point issues
        const clampedSrcX = Math.round(Math.min(width - 1, Math.max(0, srcX)));
        const clampedSrcY = Math.round(Math.min(height - 1, Math.max(0, srcY)));
        const srcIndex = (clampedSrcY * width + clampedSrcX) * 4;

        // Copy pixel from tempData to data
        data[index] = tempData[srcIndex];
        data[index + 1] = tempData[srcIndex + 1];
        data[index + 2] = tempData[srcIndex + 2];
        data[index + 3] = tempData[srcIndex + 3];
      }
    }
  };
};

// --- NEW UNIQUE EFFECTS IMPLEMENTATIONS ---

// Chromatic Aberration Glitch - Different from regular chromatic aberration with glitch aesthetics
const createChromaticGlitchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const amount = Math.max(0, settings.amount ?? 5);
    const frequency = Math.max(1, settings.frequency ?? 5);

    // For preview, ensure we have visible effect
    const effectiveAmount = amount || 8;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Create glitch bands
    const bandHeight = Math.max(1, Math.floor(height / frequency));

    for (let y = 0; y < height; y++) {
      // Determine if this row is in a glitch band
      const bandIndex = Math.floor(y / bandHeight);
      const isGlitchBand = bandIndex % 2 === 0;

      if (isGlitchBand) {
        // Apply different offsets for each color channel
        const rOffset = Math.floor((Math.random() - 0.5) * effectiveAmount * 2);
        const gOffset = Math.floor((Math.random() - 0.5) * effectiveAmount);
        const bOffset = Math.floor((Math.random() - 0.5) * effectiveAmount * 2);

        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          // Red channel with horizontal offset
          const rX = Math.min(width - 1, Math.max(0, x + rOffset));
          const rIndex = (y * width + rX) * 4;
          data[index] = tempData[rIndex];

          // Green channel with different offset
          const gX = Math.min(width - 1, Math.max(0, x + gOffset));
          const gIndex = (y * width + gX) * 4;
          data[index + 1] = tempData[gIndex + 1];

          // Blue channel with opposite offset
          const bX = Math.min(width - 1, Math.max(0, x + bOffset));
          const bIndex = (y * width + bX) * 4;
          data[index + 2] = tempData[bIndex + 2];

          // Add random noise to glitch bands
          if (Math.random() < 0.1) {
            data[index] = Math.random() * 255;
            data[index + 1] = Math.random() * 255;
            data[index + 2] = Math.random() * 255;
          }
        }
      }
    }
  };
};

// Liquid Metal Morph Effect
const createLiquidMetalEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const intensity = settings.intensity ?? 0.5;
    const flicker = settings.flicker ?? 0.03;

    // For preview, ensure we have visible effect
    const effectiveIntensity = intensity || 0.3;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Create metallic reflection map based on brightness
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Calculate brightness
        const brightness = (tempData[index] + tempData[index + 1] + tempData[index + 2]) / 3;

        // Create wave-like distortion for liquid effect
        const waveX = Math.sin(y * 0.05 + x * 0.02) * effectiveIntensity * 10;
        const waveY = Math.cos(x * 0.05 + y * 0.02) * effectiveIntensity * 10;

        // Sample from distorted position
        const srcX = Math.min(width - 1, Math.max(0, Math.floor(x + waveX)));
        const srcY = Math.min(height - 1, Math.max(0, Math.floor(y + waveY)));
        const srcIndex = (srcY * width + srcX) * 4;

        // Apply metallic coloring based on brightness
        const metalFactor = 1 + Math.sin(brightness * 0.05) * effectiveIntensity;

        // Silver/mercury colors
        data[index] = Math.min(255, tempData[srcIndex] * metalFactor * 0.9);
        data[index + 1] = Math.min(255, tempData[srcIndex + 1] * metalFactor * 0.95);
        data[index + 2] = Math.min(255, tempData[srcIndex + 2] * metalFactor);

        // Add shimmer
        const shimmer = Math.random() * flicker * 255;
        data[index] = Math.min(255, data[index] + shimmer);
        data[index + 1] = Math.min(255, data[index + 1] + shimmer);
        data[index + 2] = Math.min(255, data[index + 2] + shimmer);
      }
    }
  };
};

const createIridescentSheenEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const hueShift = settings.hueShift ?? 30;
    const intensity = settings.intensity ?? 0.5;
    const contrast = settings.contrast ?? 0.4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luminance = (max + min) / 510;
      const sheen = Math.sin(luminance * Math.PI) * intensity;

      const hueOffset = (Math.sin(luminance * Math.PI * 2) * hueShift) / 180;

      const q =
        luminance < 0.5 ? luminance * (1 + contrast) : luminance + contrast - luminance * contrast;
      const p = 2 * luminance - q;

      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      data[i] = Math.min(255, data[i] + sheen * 255 + hue2rgb(hueOffset + 1 / 3) * 20);
      data[i + 1] = Math.min(255, data[i + 1] + sheen * 255 + hue2rgb(hueOffset) * 20);
      data[i + 2] = Math.min(255, data[i + 2] + sheen * 255 + hue2rgb(hueOffset - 1 / 3) * 20);
    }
  };
};

const createChromaticGrainEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const grainAmount = settings.grain ?? 0.2;
    const chroma = settings.chroma ?? 0.5;

    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * grainAmount * 255;
      const chromaShift = (Math.random() - 0.5) * chroma * 8;

      data[i] = Math.min(255, Math.max(0, data[i] + grain + chromaShift));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain - chromaShift));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain + chromaShift * 0.5));
    }
  };
};

const createHalationGlowEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const radius = Math.max(1, Math.min(100, settings.radius ?? 8));
    const strength = settings.strength ?? 0.6;
    const bias = settings.bias ?? 0.8;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const highlights = pool.acquire(data.length);

    try {
      original.set(data);

      // Extract highlights above bias threshold
      const biasThreshold = bias * 255;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (original[i] + original[i + 1] + original[i + 2]) / 3;
        if (brightness > biasThreshold) {
          const factor = (brightness - biasThreshold) / (255 - biasThreshold);
          highlights[i] = original[i] * factor;
          highlights[i + 1] = original[i + 1] * factor;
          highlights[i + 2] = original[i + 2] * factor;
          highlights[i + 3] = 255;
        } else {
          highlights[i] = 0;
          highlights[i + 1] = 0;
          highlights[i + 2] = 0;
          highlights[i + 3] = 255;
        }
      }

      // Blur the highlights using optimized blur
      stackBlur(highlights, width, height, radius);

      // Add blurred highlights back to original
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, original[i] + highlights[i] * strength);
        data[i + 1] = Math.min(255, original[i + 1] + highlights[i + 1] * strength);
        data[i + 2] = Math.min(255, original[i + 2] + highlights[i + 2] * strength);
      }
    } finally {
      pool.release(original);
      pool.release(highlights);
    }
  };
};

const createEtchedLinesEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const detail = settings.detail ?? 0.6;
    const depth = settings.depth ?? 0.7;

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (temp[idx] + temp[idx + 1] + temp[idx + 2]) / 3;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIndex];
            gy += gray * sobelY[kernelIndex];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const angle = Math.atan2(gy, gx);
        const etchedIndex = (y * width + x) * 4;
        const line = Math.sin(angle * detail) * depth;

        const base = (temp[etchedIndex] + temp[etchedIndex + 1] + temp[etchedIndex + 2]) / 3;
        const etched = base * (0.5 + line * 0.5) + magnitude * 0.2;

        data[etchedIndex] = data[etchedIndex + 1] = data[etchedIndex + 2] = clampByte(etched);
      }
    }
  };
};

const createInkWashEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const softness = settings.softness ?? 0.7;
    const bleed = settings.bleed ?? 0.5;
    const density = settings.density ?? 0.6;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const ink = brightness * density;
      const bleedFactor = (Math.random() - 0.5) * bleed * 255;

      data[i] = clampByte(ink + bleedFactor);
      data[i + 1] = clampByte(ink + bleedFactor * softness);
      data[i + 2] = clampByte(ink + bleedFactor * (1 - softness));
    }
  };
};

const createRetroRasterEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const cellSize = Math.max(1, settings.cellSize ?? 5);
    const angle = (settings.angle ?? 15) * (Math.PI / 180);
    const contrast = settings.contrast ?? 0.8;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rotatedX = Math.floor((x * cos + y * sin) / cellSize) * cellSize;
        const rotatedY = Math.floor((-x * sin + y * cos) / cellSize) * cellSize;

        const baseX = Math.min(width - 1, Math.max(0, rotatedX));
        const baseY = Math.min(height - 1, Math.max(0, rotatedY));
        const srcIndex = (baseY * width + baseX) * 4;
        const dstIndex = (y * width + x) * 4;

        const luminance = (temp[srcIndex] + temp[srcIndex + 1] + temp[srcIndex + 2]) / 3;
        const tinted = luminance * contrast + temp[srcIndex] * (1 - contrast);

        data[dstIndex] = data[dstIndex + 1] = data[dstIndex + 2] = clampByte(tinted);
      }
    }
  };
};

const createCrystalFacetEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const cellSize = Math.max(2, settings.cellSize ?? 20);
    const shine = settings.shine ?? 0.4;

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let cy = 0; cy < cellSize && y + cy < height; cy++) {
          for (let cx = 0; cx < cellSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            r += temp[index];
            g += temp[index + 1];
            b += temp[index + 2];
            count++;
          }
        }

        if (count === 0) continue;

        r = r / count;
        g = g / count;
        b = b / count;

        const highlight = Math.sqrt(r * r + g * g + b * b) * shine;

        for (let cy = 0; cy < cellSize && y + cy < height; cy++) {
          for (let cx = 0; cx < cellSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            const gradient = (cx + cy) / (cellSize * 2);

            data[index] = Math.min(255, r + gradient * highlight);
            data[index + 1] = Math.min(255, g + gradient * highlight);
            data[index + 2] = Math.min(255, b + gradient * highlight);
          }
        }
      }
    }
  };
};

const createPaperReliefEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const depth = settings.depth ?? 3;
    const texture = settings.texture ?? 0.4;

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        const leftIndex = (y * width + Math.max(0, x - 1)) * 4;
        const topIndex = (Math.max(0, y - 1) * width + x) * 4;

        const dx = temp[index] - temp[leftIndex];
        const dy = temp[index] - temp[topIndex];

        const relief = Math.min(255, Math.max(0, temp[index] + dx * depth + dy * depth));

        const noise = (Math.random() - 0.5) * texture * 255;

        data[index] =
          data[index + 1] =
          data[index + 2] =
            Math.min(255, Math.max(0, relief + noise));
      }
    }
  };
};

const createInkOutlinePopEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const lineWeight = Math.max(1, settings.lineWeight ?? 2);
    const blockiness = settings.blockiness ?? 0.5;
    const saturationBoost = settings.saturation ?? 0.4;

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    const blockSize = Math.max(1, Math.floor(3 * blockiness));

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let cy = 0; cy < blockSize && y + cy < height; cy++) {
          for (let cx = 0; cx < blockSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            r += temp[index];
            g += temp[index + 1];
            b += temp[index + 2];
            count++;
          }
        }

        if (count === 0) continue;

        r = (r / count) * (1 + saturationBoost * 0.5);
        g = (g / count) * (1 + saturationBoost * 0.5);
        b = (b / count) * (1 + saturationBoost * 0.5);

        for (let cy = 0; cy < blockSize && y + cy < height; cy++) {
          for (let cx = 0; cx < blockSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            data[index] = Math.min(255, r);
            data[index + 1] = Math.min(255, g);
            data[index + 2] = Math.min(255, b);
          }
        }
      }
    }

    const sobelX = [-1, 0, 1, -lineWeight, 0, lineWeight, -1, 0, 1];
    const sobelY = [-1, -lineWeight, -1, 0, 0, 0, 1, lineWeight, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = 0.299 * temp[idx] + 0.587 * temp[idx + 1] + 0.114 * temp[idx + 2];
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIndex];
            gy += gray * sobelY[kernelIndex];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edgeIndex = (y * width + x) * 4;

        const outline = Math.max(0, 255 - magnitude * 0.5);
        data[edgeIndex] = Math.min(
          255,
          data[edgeIndex] * (1 - saturationBoost) + outline * saturationBoost
        );
        data[edgeIndex + 1] = Math.min(
          255,
          data[edgeIndex + 1] * (1 - saturationBoost) + outline * saturationBoost
        );
        data[edgeIndex + 2] = Math.min(
          255,
          data[edgeIndex + 2] * (1 - saturationBoost) + outline * saturationBoost
        );
      }
    }
  };
};

// Temporal Echo Trails Effect
const createTemporalEchoEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const delay = settings.delay ?? 0.2;
    const decay = settings.decay ?? 0.8;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Simulate multiple time-shifted versions
    const numEchoes = 5;

    for (let echo = 0; echo < numEchoes; echo++) {
      const offset = Math.floor(delay * (echo + 1) * Math.min(width, height) * 0.1);
      const opacity = Math.pow(decay, echo + 1);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          // Create directional echo based on brightness gradient
          const srcX = Math.min(width - 1, Math.max(0, x - offset));
          const srcY = Math.min(height - 1, Math.max(0, y - offset / 2));
          const srcIndex = (srcY * width + srcX) * 4;

          // Blend echo with current pixel
          data[index] = data[index] * (1 - opacity) + tempData[srcIndex] * opacity;
          data[index + 1] = data[index + 1] * (1 - opacity) + tempData[srcIndex + 1] * opacity;
          data[index + 2] = data[index + 2] * (1 - opacity) + tempData[srcIndex + 2] * opacity;
        }
      }
    }
  };
};

// Kaleidoscope Fracture Effect - Different from regular kaleidoscope
const createKaleidoscopeFractureEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const segments = Math.max(2, Math.floor(settings.segments ?? 6));
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const angleStep = (Math.PI * 2) / segments;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        let angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Create fracture effect by quantizing angles
        angle = Math.floor(angle / angleStep) * angleStep;

        // Add fractal-like distortion
        const fractalOffset = Math.sin(distance * 0.05) * 10;
        angle += fractalOffset * 0.01;

        // Mirror and rotate for kaleidoscope effect
        if (Math.floor((angle + Math.PI) / angleStep) % 2 === 1) {
          angle = -angle;
        }

        // Calculate source position
        const srcX = Math.floor(centerX + Math.cos(angle) * distance);
        const srcY = Math.floor(centerY + Math.sin(angle) * distance);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIndex = (srcY * width + srcX) * 4;
          const dstIndex = (y * width + x) * 4;

          data[dstIndex] = tempData[srcIndex];
          data[dstIndex + 1] = tempData[srcIndex + 1];
          data[dstIndex + 2] = tempData[srcIndex + 2];
          data[dstIndex + 3] = tempData[srcIndex + 3];
        }
      }
    }
  };
};
// Neural Style Dream Effect
const createNeuralDreamEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const style = settings.style ?? 0.5;
    const noise = settings.noise ?? 0.2;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Simulate neural style transfer with perlin-like noise
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Create dream-like distortion
        const noiseScale = 0.01;
        const noiseX = x * noiseScale;
        const noiseY = y * noiseScale;

        // Multi-octave noise for organic patterns
        const noise1 = Math.sin(noiseX * 10) * Math.cos(noiseY * 10);
        const noise2 = Math.sin(noiseX * 20) * Math.cos(noiseY * 20) * 0.5;
        const noise3 = Math.sin(noiseX * 40) * Math.cos(noiseY * 40) * 0.25;

        const totalNoise = (noise1 + noise2 + noise3) * noise;

        // Style transfer simulation - blend between photo and artistic interpretation
        const r = tempData[index];
        const g = tempData[index + 1];
        const b = tempData[index + 2];

        // Create impressionistic color shifts
        const hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
        const shifted_hue = hue + totalNoise * Math.PI;

        // Convert back to RGB with style influence
        const intensity = (r + g + b) / 3;
        const saturation =
          Math.sqrt((r - intensity) ** 2 + (g - intensity) ** 2 + (b - intensity) ** 2) / intensity;

        const stylizedIntensity = intensity * (1 + totalNoise);
        const stylizedSaturation = saturation * (1 + style);

        // Apply stylized colors
        data[index] = Math.min(
          255,
          Math.max(0, stylizedIntensity + stylizedSaturation * Math.cos(shifted_hue) * intensity)
        );
        data[index + 1] = Math.min(
          255,
          Math.max(
            0,
            stylizedIntensity + stylizedSaturation * Math.cos(shifted_hue - 2.094) * intensity
          )
        );
        data[index + 2] = Math.min(
          255,
          Math.max(
            0,
            stylizedIntensity + stylizedSaturation * Math.cos(shifted_hue + 2.094) * intensity
          )
        );
      }
    }
  };
};
// Holographic Interference Effect
const createHolographicInterferenceEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const frequency = settings.frequency ?? 5;
    const phaseShift = settings.phaseShift ?? 0.5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Get original brightness
        const brightness = (tempData[index] + tempData[index + 1] + tempData[index + 2]) / 3 / 255;

        // Create interference pattern
        const pattern1 = Math.sin(x * frequency * 0.05 + phaseShift * Math.PI);
        const pattern2 = Math.sin(y * frequency * 0.05 + phaseShift * Math.PI * 1.5);
        const interference = (pattern1 + pattern2) * 0.5;

        // Create rainbow effect based on interference and brightness
        const hue = (interference + brightness) * Math.PI * 2;

        // HSL to RGB conversion for rainbow colors
        const c = brightness * 0.8; // Chroma
        const hp = hue / (Math.PI / 3);
        const x2 = c * (1 - Math.abs((hp % 2) - 1));

        let r = 0,
          g = 0,
          b = 0;
        if (hp >= 0 && hp < 1) {
          r = c;
          g = x2;
          b = 0;
        } else if (hp >= 1 && hp < 2) {
          r = x2;
          g = c;
          b = 0;
        } else if (hp >= 2 && hp < 3) {
          r = 0;
          g = c;
          b = x2;
        } else if (hp >= 3 && hp < 4) {
          r = 0;
          g = x2;
          b = c;
        } else if (hp >= 4 && hp < 5) {
          r = x2;
          g = 0;
          b = c;
        } else if (hp >= 5 && hp < 6) {
          r = c;
          g = 0;
          b = x2;
        }

        const m = brightness - c * 0.5;

        // Blend holographic colors with original
        const blend = 0.6;
        data[index] = Math.min(255, tempData[index] * (1 - blend) + (r + m) * 255 * blend);
        data[index + 1] = Math.min(255, tempData[index + 1] * (1 - blend) + (g + m) * 255 * blend);
        data[index + 2] = Math.min(255, tempData[index + 2] * (1 - blend) + (b + m) * 255 * blend);
      }
    }
  };
};

// Magnetic Field Visualization Effect
const createMagneticFieldEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const strength = settings.strength ?? 0.5;
    const direction = settings.direction ?? 0.5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Convert to grayscale first for edge detection
    const edges = new Float32Array(width * height);

    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0,
          gy = 0;

        // Sobel X kernel
        const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const gray = (tempData[idx] + tempData[idx + 1] + tempData[idx + 2]) / 3;
            gx += gray * kernelX[k];
            gy += gray * kernelY[k];
            k++;
          }
        }

        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Create field lines based on edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const edgeStrength = edges[y * width + x] / 255;

        if (edgeStrength > 0.1) {
          // Create flowing field lines
          const angle = Math.atan2(y - height / 2, x - width / 2) + direction * Math.PI;
          const flow = Math.sin(angle * 10 + edgeStrength * 20) * strength;

          // Field line colors (blue to red gradient)
          const fieldIntensity = (flow + 1) * 0.5;

          data[index] = Math.min(255, tempData[index] * 0.3 + fieldIntensity * 255);
          data[index + 1] = Math.min(255, tempData[index + 1] * 0.3 + (1 - fieldIntensity) * 100);
          data[index + 2] = Math.min(255, tempData[index + 2] * 0.3 + (1 - fieldIntensity) * 255);
        } else {
          // Darken non-field areas
          data[index] = tempData[index] * 0.3;
          data[index + 1] = tempData[index + 1] * 0.3;
          data[index + 2] = tempData[index + 2] * 0.3;
        }
      }
    }
  };
};

// Databending Corruption Effect
const createDatabendingEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const amount = settings.amount ?? 0.5;
    const distortion = settings.distortion ?? 0.3;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Simulate data corruption patterns
    const corruptionTypes = ['byteshift', 'channelswap', 'compression', 'interlace'];
    const blockSize = Math.floor(32 + (1 - amount) * 96); // Smaller blocks = more corruption

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        if (Math.random() < amount) {
          const corruption = corruptionTypes[Math.floor(Math.random() * corruptionTypes.length)];

          for (let by = 0; by < blockSize && y + by < height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
              const px = x + bx;
              const py = y + by;
              const index = (py * width + px) * 4;

              switch (corruption) {
                case 'byteshift':
                  // Shift bytes creating color artifacts
                  const shift = Math.floor(distortion * 8);
                  data[index] = tempData[index + shift] || tempData[index];
                  data[index + 1] = tempData[index + 1 + shift] || tempData[index + 1];
                  data[index + 2] = tempData[index + 2 + shift] || tempData[index + 2];
                  break;

                case 'channelswap':
                  // Swap color channels
                  data[index] = tempData[index + 2]; // R = B
                  data[index + 1] = tempData[index]; // G = R
                  data[index + 2] = tempData[index + 1]; // B = G
                  break;

                case 'compression':
                  // Simulate JPEG compression artifacts
                  const quality = 1 - distortion;
                  const quantized = Math.floor(tempData[index] / (quality * 32)) * (quality * 32);
                  data[index] = quantized;
                  data[index + 1] = quantized;
                  data[index + 2] = quantized;
                  break;

                case 'interlace':
                  // Create interlacing effect
                  if (py % 2 === 0) {
                    const offset = Math.floor(distortion * 10);
                    const srcX = Math.min(width - 1, Math.max(0, px + offset));
                    const srcIndex = (py * width + srcX) * 4;
                    data[index] = tempData[srcIndex];
                    data[index + 1] = tempData[srcIndex + 1];
                    data[index + 2] = tempData[srcIndex + 2];
                  }
                  break;
              }
            }
          }
        }
      }
    }
  };
};

// Lens Flare Effect Implementation
const createLensFlareEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const flareX = (settings.x ?? 0.2) * width;
    const flareY = (settings.y ?? 0.2) * height;
    const strength = settings.strength ?? 0.8;

    // Create lens flare components
    const numFlares = 5;
    const flareColors = [
      { r: 1.0, g: 0.9, b: 0.7 }, // Main bright flare
      { r: 0.9, g: 0.7, b: 0.9 }, // Purple tint
      { r: 0.7, g: 0.9, b: 0.7 }, // Green tint
      { r: 0.9, g: 0.8, b: 0.5 }, // Orange
      { r: 0.6, g: 0.7, b: 0.9 }, // Blue
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        let flareIntensity = 0;
        let flareR = 0,
          flareG = 0,
          flareB = 0;

        // Calculate contribution from each flare component
        for (let i = 0; i < numFlares; i++) {
          const flareFactor = 1 - i * 0.15;
          const flareRadius = (50 + i * 20) * strength;

          // Position flares along the line from light source to center
          const centerX = width / 2;
          const centerY = height / 2;
          const t = 0.5 + (i - numFlares / 2) * 0.2;
          const currentFlareX = flareX + (centerX - flareX) * t;
          const currentFlareY = flareY + (centerY - flareY) * t;

          const dx = x - currentFlareX;
          const dy = y - currentFlareY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < flareRadius) {
            const intensity = Math.pow(1 - dist / flareRadius, 2) * flareFactor;
            flareIntensity += intensity;
            flareR += flareColors[i].r * intensity;
            flareG += flareColors[i].g * intensity;
            flareB += flareColors[i].b * intensity;
          }
        }

        // Add rays from main flare
        const mainDx = x - flareX;
        const mainDy = y - flareY;
        const mainDist = Math.sqrt(mainDx * mainDx + mainDy * mainDy);
        const angle = Math.atan2(mainDy, mainDx);

        // Star pattern rays
        const rayIntensity =
          Math.pow(Math.max(0, Math.cos(angle * 4) * 0.5 + Math.cos(angle * 8) * 0.3 + 0.2), 2) *
          Math.exp(-mainDist / (width * 0.5)) *
          strength;

        flareIntensity += rayIntensity;
        flareR += rayIntensity;
        flareG += rayIntensity * 0.9;
        flareB += rayIntensity * 0.7;

        // Blend with original image
        data[index] = Math.min(255, data[index] + flareR * 255 * strength);
        data[index + 1] = Math.min(255, data[index + 1] + flareG * 255 * strength);
        data[index + 2] = Math.min(255, data[index + 2] + flareB * 255 * strength);
      }
    }
  };
};

// Selective Color Effect Implementation
const createSelectiveColorEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const targetHue = settings.hue ?? 0; // Target hue in degrees
    const range = settings.range ?? 30; // Hue range in degrees
    const saturationBoost = settings.saturation ?? 1.5;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Convert RGB to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0;
      let s = 0;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      h *= 360; // Convert to degrees

      // Check if color is within target range
      let hueDiff = Math.abs(h - targetHue);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      if (hueDiff <= range) {
        // Color is within range - keep it and boost saturation
        s = Math.min(1, s * saturationBoost);

        // Convert back to RGB
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hNorm = h / 360;

        data[i] = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
        data[i + 1] = Math.round(hue2rgb(p, q, hNorm) * 255);
        data[i + 2] = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);
      } else {
        // Color is outside range - desaturate it
        const gray = Math.round(l * 255);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
    }
  };
};

// clampByte already defined above

const computeGrayscale = (data: Uint8ClampedArray, width: number, height: number): Uint8Array => {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    if (a === 0) {
      gray[p] = 255;
      continue;
    }
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
};

const sobelMagnitude01 = (gray: Uint8Array, width: number, x: number, y: number): number => {
  const idx = y * width + x;
  const a00 = gray[idx - width - 1];
  const a01 = gray[idx - width];
  const a02 = gray[idx - width + 1];
  const a10 = gray[idx - 1];
  const a12 = gray[idx + 1];
  const a20 = gray[idx + width - 1];
  const a21 = gray[idx + width];
  const a22 = gray[idx + width + 1];

  const gx = -a00 - 2 * a10 - a20 + a02 + 2 * a12 + a22;
  const gy = -a00 - 2 * a01 - a02 + a20 + 2 * a21 + a22;

  const mag = (Math.abs(gx) + Math.abs(gy)) / 2040;
  return Math.min(1, Math.max(0, mag));
};

const pseudoNoise01 = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const toneCurve01 = (t: number, k: number) => {
  const lo = sigmoid(-k / 2);
  const hi = sigmoid(k / 2);
  const v = sigmoid(k * (t - 0.5));
  return (v - lo) / (hi - lo);
};

const blendScreen = (base: number, overlay: number) => 255 - ((255 - base) * (255 - overlay)) / 255;
const blendMultiply = (base: number, overlay: number) => (base * overlay) / 255;
const blendOverlay = (base: number, overlay: number) =>
  base < 128 ? (2 * base * overlay) / 255 : 255 - (2 * (255 - base) * (255 - overlay)) / 255;

const createDehazeEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const amount = clamp(settings.amount ?? 0.35, 0, 1);
    const k = 1 + amount * 6;
    const sat = 1 + amount * 0.5;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const l2 = toneCurve01(l, k);
      const ratio = l > 0 ? l2 / l : 0;

      let nr = r * ratio;
      let ng = g * ratio;
      let nb = b * ratio;

      const gray = l2 * 255;
      nr = gray + (nr - gray) * sat;
      ng = gray + (ng - gray) * sat;
      nb = gray + (nb - gray) * sat;

      const darken = amount * 10;
      data[i] = clampByte(nr - darken);
      data[i + 1] = clampByte(ng - darken);
      data[i + 2] = clampByte(nb - darken);
      data[i + 3] = a;
    }
  };
};

const createToneCurveEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const amount = clamp(settings.amount ?? 0.25, -1, 1);
    const k = Math.exp(amount * 1.8);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      data[i] = clampByte(toneCurve01(data[i] / 255, k) * 255);
      data[i + 1] = clampByte(toneCurve01(data[i + 1] / 255, k) * 255);
      data[i + 2] = clampByte(toneCurve01(data[i + 2] / 255, k) * 255);
      data[i + 3] = a;
    }
  };
};

const createGradientMapEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const shadow = settings.shadowColor ? hexToRgb(settings.shadowColor) : { r: 27, g: 31, b: 58 };
    const mid = settings.midColor ? hexToRgb(settings.midColor) : { r: 185, g: 198, b: 211 };
    const highlight = settings.highlightColor
      ? hexToRgb(settings.highlightColor)
      : { r: 255, g: 214, b: 165 };

    const midpoint = clamp(settings.midpoint ?? 0.5, 0.1, 0.9);
    const strength = clamp(settings.strength ?? 1, 0, 1);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const t = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255;

      let mr = 0;
      let mg = 0;
      let mb = 0;

      if (t <= midpoint) {
        const u = t / midpoint;
        mr = lerp(shadow.r, mid.r, u);
        mg = lerp(shadow.g, mid.g, u);
        mb = lerp(shadow.b, mid.b, u);
      } else {
        const u = (t - midpoint) / (1 - midpoint);
        mr = lerp(mid.r, highlight.r, u);
        mg = lerp(mid.g, highlight.g, u);
        mb = lerp(mid.b, highlight.b, u);
      }

      data[i] = clampByte(lerp(r0, mr, strength));
      data[i + 1] = clampByte(lerp(g0, mg, strength));
      data[i + 2] = clampByte(lerp(b0, mb, strength));
      data[i + 3] = a;
    }
  };
};

const createCinematicLutEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data } = imageData;
    const preset = Math.floor(settings.preset ?? 0);
    const strength = clamp(settings.strength ?? 0.75, 0, 1);

    const applyPreset = (r: number, g: number, b: number): [number, number, number] => {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const t = l / 255;

      switch (preset) {
        case 1: {
          const k = 1 + 5 * strength;
          const l2 = toneCurve01(t, k) * 255;
          const desat = 0.65 * strength;
          const rr = lerp(r, l2, desat);
          const gg = lerp(g, l2, desat);
          const bb = lerp(b, l2, desat);
          return [rr, gg, bb];
        }
        case 2: {
          const lift = 18 * strength;
          const fade = 1 - 0.15 * strength;
          const rr = r * fade + lift + (t > 0.6 ? 10 * strength : 0);
          const gg = g * fade + lift;
          const bb = b * fade + lift - (t > 0.6 ? 8 * strength : 0);
          return [rr, gg, bb];
        }
        case 3: {
          const k = Math.max(0.2, 1 - 0.6 * strength);
          const l2 = toneCurve01(t, k) * 255;
          const sat = 1 - 0.35 * strength;
          let rr = l2 + (r - l2) * sat;
          let gg = l2 + (g - l2) * sat;
          const bb = l2 + (b - l2) * sat;
          rr += 10 * strength;
          gg += 4 * strength;
          return [rr, gg, bb];
        }
        default: {
          const shadow = clamp((0.55 - t) / 0.55, 0, 1);
          const highlight = clamp((t - 0.35) / 0.65, 0, 1);

          let rr = r;
          let gg = g;
          let bb = b;

          rr *= 1 - 0.12 * strength * shadow;
          gg += 18 * strength * shadow;
          bb += 28 * strength * shadow;

          rr += 34 * strength * highlight;
          gg += 14 * strength * highlight;
          bb *= 1 - 0.12 * strength * highlight;

          return [rr, gg, bb];
        }
      }
    };

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const [rr, gg, bb] = applyPreset(r0, g0, b0);

      data[i] = clampByte(lerp(r0, rr, strength));
      data[i + 1] = clampByte(lerp(g0, gg, strength));
      data[i + 2] = clampByte(lerp(b0, bb, strength));
      data[i + 3] = a;
    }
  };
};

const createRelightEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const angle = ((settings.angle ?? 45) * Math.PI) / 180;
    const strength = clamp(settings.strength ?? 0.4, 0, 1);
    const ambient = clamp(settings.ambient ?? 0.2, 0, 1);

    const lx = Math.cos(angle);
    const ly = Math.sin(angle);

    for (let y = 0; y < height; y++) {
      const ny = height > 1 ? (y / (height - 1)) * 2 - 1 : 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a === 0) continue;

        const nx = width > 1 ? (x / (width - 1)) * 2 - 1 : 0;
        const dot = clamp(nx * lx + ny * ly, -1, 1);
        const light = ambient + dot * strength * 0.35;
        const mult = clamp(1 + light, 0, 2);

        data[idx] = clampByte(data[idx] * mult);
        data[idx + 1] = clampByte(data[idx + 1] * mult);
        data[idx + 2] = clampByte(data[idx + 2] * mult);
        data[idx + 3] = a;
      }
    }
  };
};

const createDoubleExposureEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const offsetX = clamp(settings.offsetX ?? 0.15, -1, 1);
    const offsetY = clamp(settings.offsetY ?? -0.1, -1, 1);
    const opacity = clamp(settings.opacity ?? 0.6, 0, 1);
    const blendMode = Math.floor(settings.blendMode ?? 0);

    const dx = Math.round(offsetX * width * 0.25);
    const dy = Math.round(offsetY * height * 0.25);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);

    try {
      original.set(data);

      const blend = (base: number, overlay: number) => {
        switch (blendMode) {
          case 1:
            return blendMultiply(base, overlay);
          case 2:
            return blendOverlay(base, overlay);
          default:
            return blendScreen(base, overlay);
        }
      };

      for (let y = 0; y < height; y++) {
        const sy = Math.min(height - 1, Math.max(0, y - dy));
        for (let x = 0; x < width; x++) {
          const sx = Math.min(width - 1, Math.max(0, x - dx));
          const i = (y * width + x) * 4;
          const si = (sy * width + sx) * 4;

          const a = original[i + 3];
          if (a === 0) continue;

          const r0 = original[i];
          const g0 = original[i + 1];
          const b0 = original[i + 2];

          const r1 = original[si];
          const g1 = original[si + 1];
          const b1 = original[si + 2];

          const br = blend(r0, r1);
          const bg = blend(g0, g1);
          const bb = blend(b0, b1);

          data[i] = clampByte(lerp(r0, br, opacity));
          data[i + 1] = clampByte(lerp(g0, bg, opacity));
          data[i + 2] = clampByte(lerp(b0, bb, opacity));
          data[i + 3] = a;
        }
      }
    } finally {
      pool.release(original);
    }
  };
};

const createPosterEdgesEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const levels = Math.max(2, Math.min(10, Math.floor(settings.levels ?? 5)));
    const edgeThreshold = clamp(settings.edgeThreshold ?? 0.2, 0, 1);
    const edgeStrength = clamp(settings.edgeStrength ?? 0.9, 0, 1);
    const step = 255 / (levels - 1);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);

    try {
      original.set(data);
      const gray = computeGrayscale(original, width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          const i = p * 4;
          const a = original[i + 3];
          if (a === 0) continue;

          const r = Math.round(Math.round(original[i] / step) * step);
          const g = Math.round(Math.round(original[i + 1] / step) * step);
          const b = Math.round(Math.round(original[i + 2] / step) * step);

          let edge = 0;
          if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
            edge = sobelMagnitude01(gray, width, x, y);
          }

          const line =
            edge > edgeThreshold
              ? ((edge - edgeThreshold) / (1 - edgeThreshold)) * edgeStrength
              : 0;

          data[i] = clampByte(lerp(r, 0, line));
          data[i + 1] = clampByte(lerp(g, 0, line));
          data[i + 2] = clampByte(lerp(b, 0, line));
          data[i + 3] = a;
        }
      }
    } finally {
      pool.release(original);
    }
  };
};

const createCutoutEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const levels = Math.max(2, Math.min(12, Math.floor(settings.levels ?? 6)));
    const edgeStrength = clamp(settings.edgeStrength ?? 0.6, 0, 1);
    const soften = clamp(settings.soften ?? 0.2, 0, 1);
    const step = 255 / (levels - 1);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const softened = pool.acquire(data.length);

    try {
      original.set(data);
      softened.set(data);

      const blurRadius = Math.round(soften * 6);
      if (blurRadius > 0) {
        stackBlur(softened, width, height, blurRadius);
      }

      const gray = computeGrayscale(original, width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          const i = p * 4;
          const a = original[i + 3];
          if (a === 0) continue;

          let r = Math.round(Math.round(softened[i] / step) * step);
          let g = Math.round(Math.round(softened[i + 1] / step) * step);
          let b = Math.round(Math.round(softened[i + 2] / step) * step);

          if (edgeStrength > 0 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
            const edge = sobelMagnitude01(gray, width, x, y);
            const darken = 1 - edge * edgeStrength * 0.9;
            r *= darken;
            g *= darken;
            b *= darken;
          }

          data[i] = clampByte(r);
          data[i + 1] = clampByte(g);
          data[i + 2] = clampByte(b);
          data[i + 3] = a;
        }
      }
    } finally {
      pool.release(original);
      pool.release(softened);
    }
  };
};

const createToonEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const smoothness = Math.max(0, Math.min(20, Math.round(settings.smoothness ?? 8)));
    const levels = Math.max(2, Math.min(64, Math.floor(settings.levels ?? 6)));
    const edgeThreshold = clamp(settings.edgeThreshold ?? 0.25, 0, 1);
    const edgeStrength = clamp(settings.edgeStrength ?? 0.85, 0, 1);
    const opacity = settings.opacity ?? 1;
    const step = 255 / (levels - 1);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      if (smoothness > 0) {
        stackBlur(blurred, width, height, smoothness);
      }

      const gray = computeGrayscale(original, width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          const i = p * 4;
          const a = original[i + 3];
          if (a === 0) continue;

          let r = Math.round(Math.round(blurred[i] / step) * step);
          let g = Math.round(Math.round(blurred[i + 1] / step) * step);
          let b = Math.round(Math.round(blurred[i + 2] / step) * step);

          let edge = 0;
          if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
            edge = sobelMagnitude01(gray, width, x, y);
          }

          const line =
            edge > edgeThreshold
              ? ((edge - edgeThreshold) / (1 - edgeThreshold)) * edgeStrength
              : 0;

          r = lerp(r, 0, line);
          g = lerp(g, 0, line);
          b = lerp(b, 0, line);

          data[i] = clampByte(r);
          data[i + 1] = clampByte(g);
          data[i + 2] = clampByte(b);
          data[i + 3] = a;
        }
      }

      // Apply opacity blending with original
      if (opacity < 1) {
        applyOpacityBlend(data, original, opacity);
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};

const createWatercolorEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const intensity = clamp(settings.intensity ?? 0.7, 0, 1);
    const edges = clamp(settings.edges ?? 0.35, 0, 1);
    const texture = clamp(settings.texture ?? 0.25, 0, 1);
    const opacity = settings.opacity ?? 1;

    const radius = Math.round(2 + intensity * 8);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      if (radius > 0) {
        stackBlur(blurred, width, height, radius);
      }

      const gray = computeGrayscale(original, width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          const i = p * 4;
          const a = original[i + 3];
          if (a === 0) continue;

          let r = lerp(original[i], blurred[i], intensity);
          let g = lerp(original[i + 1], blurred[i + 1], intensity);
          let b = lerp(original[i + 2], blurred[i + 2], intensity);

          if (edges > 0 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
            const mag = sobelMagnitude01(gray, width, x, y);
            const darken = 1 - mag * edges * 0.9;
            r *= darken;
            g *= darken;
            b *= darken;
          }

          if (texture > 0) {
            const n = (pseudoNoise01(x, y) - 0.5) * texture * 30;
            r += n;
            g += n;
            b += n;
          }

          data[i] = clampByte(r);
          data[i + 1] = clampByte(g);
          data[i + 2] = clampByte(b);
          data[i + 3] = a;
        }
      }

      // Apply opacity blending with original
      if (opacity < 1) {
        applyOpacityBlend(data, original, opacity);
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};

const createStainedGlassEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const cellSize = Math.max(4, Math.min(64, Math.round(settings.cellSize ?? 18)));
    const borderThickness = Math.max(0, Math.min(8, Math.round(settings.borderThickness ?? 2)));
    const borderDarkness = clamp(settings.borderDarkness ?? 0.85, 0, 1);
    const borderScale = 1 - borderDarkness;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);

    try {
      original.set(data);

      for (let ty = 0; ty < height; ty += cellSize) {
        for (let tx = 0; tx < width; tx += cellSize) {
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let count = 0;

          const yMax = Math.min(height, ty + cellSize);
          const xMax = Math.min(width, tx + cellSize);

          for (let y = ty; y < yMax; y++) {
            for (let x = tx; x < xMax; x++) {
              const i = (y * width + x) * 4;
              const a = original[i + 3];
              if (a === 0) continue;
              sumR += original[i];
              sumG += original[i + 1];
              sumB += original[i + 2];
              count++;
            }
          }

          if (count === 0) continue;

          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;

          for (let y = ty; y < yMax; y++) {
            for (let x = tx; x < xMax; x++) {
              const i = (y * width + x) * 4;
              const a = original[i + 3];
              if (a === 0) continue;

              const isBorder =
                borderThickness > 0 &&
                (x - tx < borderThickness ||
                  xMax - 1 - x < borderThickness ||
                  y - ty < borderThickness ||
                  yMax - 1 - y < borderThickness);

              const scale = isBorder ? borderScale : 1;

              data[i] = clampByte(avgR * scale);
              data[i + 1] = clampByte(avgG * scale);
              data[i + 2] = clampByte(avgB * scale);
              data[i + 3] = a;
            }
          }
        }
      }
    } finally {
      pool.release(original);
    }
  };
};

const createBokehEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const radius = Math.max(0, Math.min(30, Math.round(settings.radius ?? 10)));
    const threshold = clamp(settings.threshold ?? 0.78, 0.4, 0.98);
    const strength = clamp(settings.strength ?? 0.65, 0, 1);
    const highlights = clamp(settings.highlights ?? 0.9, 0, 2);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      if (radius > 0) {
        stackBlur(blurred, width, height, radius);
      }

      for (let i = 0; i < data.length; i += 4) {
        const a = original[i + 3];
        if (a === 0) continue;

        const r0 = original[i];
        const g0 = original[i + 1];
        const b0 = original[i + 2];

        let r = lerp(r0, blurred[i], strength);
        let g = lerp(g0, blurred[i + 1], strength);
        let b = lerp(b0, blurred[i + 2], strength);

        const l = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255;
        if (l > threshold) {
          const mask = (l - threshold) / (1 - threshold);
          const boost = mask * highlights;
          r += blurred[i] * boost * 0.5;
          g += blurred[i + 1] * boost * 0.5;
          b += blurred[i + 2] * boost * 0.5;
        }

        data[i] = clampByte(r);
        data[i + 1] = clampByte(g);
        data[i + 2] = clampByte(b);
        data[i + 3] = a;
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};

const createDepthBlurEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const focusY = clamp(settings.focusY ?? 0.5, 0, 1);
    const range = clamp(settings.range ?? 0.18, 0, 0.5);
    const radius = Math.max(0, Math.min(30, Math.round(settings.radius ?? 14)));

    const denom = Math.max(0.0001, 0.5 - range);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      if (radius > 0) {
        stackBlur(blurred, width, height, radius);
      }

      for (let y = 0; y < height; y++) {
        const t = height > 1 ? y / (height - 1) : 0.5;
        const dy = Math.abs(t - focusY);
        const blurFactor = clamp((dy - range) / denom, 0, 1);

        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const a = original[i + 3];
          if (a === 0) continue;

          data[i] = clampByte(lerp(original[i], blurred[i], blurFactor));
          data[i + 1] = clampByte(lerp(original[i + 1], blurred[i + 1], blurFactor));
          data[i + 2] = clampByte(lerp(original[i + 2], blurred[i + 2], blurFactor));
          data[i + 3] = a;
        }
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};

// ============================================================================
// CONSOLIDATED EFFECT CATEGORIES
// ============================================================================
// Phase 2: Redundant effects removed from UI, unified effects featured prominently
// Legacy effects still work via applyEffect() for backwards compatibility

export const effectCategories = {
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
export const legacyEffectAliases: Record<string, { unified: string; preset: number }> = {
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

// Helper function to get category for an effect
export const getEffectCategory = (effectId: string): string | null => {
  for (const [category, data] of Object.entries(effectCategories)) {
    if (data.effects.includes(effectId)) {
      return category;
    }
  }
  return null;
};

// --- NEW 10 EFFECTS IMPLEMENTATIONS ---

// Crystallize Effect
const createCrystallizeEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const crystalSize = Math.max(5, Math.floor((settings.crystalSize ?? 5) * 5));
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Create crystal centers
    const crystals: { x: number; y: number; r: number; g: number; b: number }[] = [];
    for (let y = 0; y < height; y += crystalSize) {
      for (let x = 0; x < width; x += crystalSize) {
        const cx = x + Math.floor(Math.random() * crystalSize);
        const cy = y + Math.floor(Math.random() * crystalSize);
        if (cx < width && cy < height) {
          const idx = (cy * width + cx) * 4;
          crystals.push({
            x: cx,
            y: cy,
            r: tempData[idx],
            g: tempData[idx + 1],
            b: tempData[idx + 2],
          });
        }
      }
    }

    // Apply Voronoi-like crystallization
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minDist = Infinity;
        let nearestCrystal = crystals[0];

        for (const crystal of crystals) {
          const dist = Math.sqrt((x - crystal.x) ** 2 + (y - crystal.y) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestCrystal = crystal;
          }
        }

        const index = (y * width + x) * 4;
        data[index] = nearestCrystal.r;
        data[index + 1] = nearestCrystal.g;
        data[index + 2] = nearestCrystal.b;
      }
    }
  };
};

// Thermal Palette Effect
const createThermalPaletteEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const sensitivity = settings.sensitivity ?? 0.5;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate brightness as "temperature"
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const temp = brightness * sensitivity + (1 - sensitivity) * 0.5;

      // Map to thermal colors (cold=blue, warm=red, hot=white)
      if (temp < 0.25) {
        // Cold - Black to Blue
        const t = temp * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = Math.floor(255 * t);
      } else if (temp < 0.5) {
        // Cool - Blue to Cyan
        const t = (temp - 0.25) * 4;
        data[i] = 0;
        data[i + 1] = Math.floor(255 * t);
        data[i + 2] = 255;
      } else if (temp < 0.75) {
        // Warm - Cyan to Yellow
        const t = (temp - 0.5) * 4;
        data[i] = Math.floor(255 * t);
        data[i + 1] = 255;
        data[i + 2] = Math.floor(255 * (1 - t));
      } else {
        // Hot - Yellow to White
        const t = (temp - 0.75) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = Math.floor(255 * t);
      }
    }
  };
};

// Paper Cut Art Effect
const createPaperCutArtEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // Map 3-8 to actual 3-12 layers for more range
    const layersInput = Math.floor(settings.layers ?? 5);
    const layers = Math.floor(3 + ((layersInput - 3) / 5) * 9); // 3 to 12

    const tempData = new Uint8ClampedArray(data.length);

    // Define paper layer colors (from light to dark, warm paper tones)
    const paperColors = [
      { r: 255, g: 252, b: 245 }, // Lightest cream
      { r: 245, g: 235, b: 220 },
      { r: 230, g: 215, b: 195 },
      { r: 210, g: 190, b: 165 },
      { r: 185, g: 160, b: 135 },
      { r: 160, g: 130, b: 105 },
      { r: 135, g: 100, b: 75 },
      { r: 110, g: 75, b: 55 },
      { r: 85, g: 55, b: 40 },
      { r: 65, g: 40, b: 30 },
      { r: 45, g: 28, b: 22 },
      { r: 30, g: 18, b: 15 }, // Darkest
    ];

    // First pass: assign layers (only for non-transparent pixels)
    const layerMap = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent pixels
      if (a === 0) {
        layerMap[i / 4] = 255; // Mark as transparent
        continue;
      }

      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const layerIdx = Math.min(layers - 1, Math.floor((1 - brightness) * layers));
      layerMap[i / 4] = layerIdx;
    }

    // Second pass: apply colors and detect edges for shadow effect
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const originalAlpha = data[i + 3];

        // Preserve transparency - skip fully transparent pixels
        if (originalAlpha === 0) {
          tempData[i] = 0;
          tempData[i + 1] = 0;
          tempData[i + 2] = 0;
          tempData[i + 3] = 0;
          continue;
        }

        const currentLayer = layerMap[y * width + x];

        // Get paper color for this layer
        const colorIdx = Math.floor((currentLayer / layers) * (paperColors.length - 1));
        const color = paperColors[colorIdx];

        // Check for layer edge (shadow detection)
        let isShadowEdge = false;
        let shadowIntensity = 0;

        // Look at neighbors to detect if we're at a layer boundary
        for (let dy = -2; dy <= 0; dy++) {
          for (let dx = -2; dx <= 0; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborLayer = layerMap[ny * width + nx];
              // Skip transparent neighbors in shadow calculation
              if (neighborLayer !== 255 && neighborLayer < currentLayer) {
                isShadowEdge = true;
                shadowIntensity = Math.max(
                  shadowIntensity,
                  (currentLayer - neighborLayer) / layers
                );
              }
            }
          }
        }

        // Apply color with shadow
        const shadowDarken = isShadowEdge ? 1 - shadowIntensity * 0.4 : 1;
        tempData[i] = Math.floor(color.r * shadowDarken);
        tempData[i + 1] = Math.floor(color.g * shadowDarken);
        tempData[i + 2] = Math.floor(color.b * shadowDarken);
        // Preserve original alpha channel
        tempData[i + 3] = originalAlpha;
      }
    }

    // Add paper fiber texture (only to non-transparent pixels)
    for (let i = 0; i < tempData.length; i += 4) {
      if (tempData[i + 3] > 0) {
        const noise = (Math.random() - 0.5) * 12;
        tempData[i] = clampByte(tempData[i] + noise);
        tempData[i + 1] = clampByte(tempData[i + 1] + noise);
        tempData[i + 2] = clampByte(tempData[i + 2] + noise);
      }
    }

    data.set(tempData);
  };
};

// Tilt-Shift Miniature Effect
const createTiltShiftMiniatureEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const focalPoint = height / 2;
    const focalRange = (settings.focalLength ?? 50) * 2;
    const blurStrength = 16 / (settings.aperture ?? 5.6);

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const blurred = pool.acquire(data.length);

    try {
      original.set(data);
      blurred.set(data);

      // Apply a single blur pass at max strength
      const maxBlur = Math.ceil(blurStrength);
      if (maxBlur > 0) {
        stackBlur(blurred, width, height, maxBlur);
      }

      // Blend based on distance from focal point
      for (let y = 0; y < height; y++) {
        const distance = Math.abs(y - focalPoint);
        const blendFactor = Math.max(0, Math.min(1, (distance - focalRange) / (height * 0.3)));

        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;

          // Blend between original and blurred based on distance
          data[index] = original[index] * (1 - blendFactor) + blurred[index] * blendFactor;
          data[index + 1] =
            original[index + 1] * (1 - blendFactor) + blurred[index + 1] * blendFactor;
          data[index + 2] =
            original[index + 2] * (1 - blendFactor) + blurred[index + 2] * blendFactor;
        }
      }

      // Add slight saturation boost for toy-like appearance
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const avg = (r + g + b) / 3;

        data[i] = Math.min(255, Math.max(0, avg + (r - avg) * 1.3));
        data[i + 1] = Math.min(255, Math.max(0, avg + (g - avg) * 1.3));
        data[i + 2] = Math.min(255, Math.max(0, avg + (b - avg) * 1.3));
      }
    } finally {
      pool.release(original);
      pool.release(blurred);
    }
  };
};
// Neon Glow Edges Effect
const createNeonGlowEdgesEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // Map 1-10 to actual glow radius of 5-50 pixels
    const glowInput = settings.glowWidth ?? 5;
    const glowRadius = Math.floor(5 + (glowInput - 1) * 5); // 5 to 50
    const glowIntensity = settings.glowIntensity ?? 0.5;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const glowLayer = pool.acquire(data.length);

    try {
      original.set(data);

      // Edge detection with Sobel
      const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      // Create colored edge glow layer
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0,
            gy = 0;
          let avgR = 0,
            avgG = 0,
            avgB = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              const val =
                original[idx] * 0.299 + original[idx + 1] * 0.587 + original[idx + 2] * 0.114;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              gx += val * kernelX[kernelIdx];
              gy += val * kernelY[kernelIdx];
              avgR += original[idx];
              avgG += original[idx + 1];
              avgB += original[idx + 2];
            }
          }

          const edgeVal = Math.min(255, Math.sqrt(gx * gx + gy * gy));
          const idx = (y * width + x) * 4;

          if (edgeVal > 20) {
            // Calculate hue from original colors for neon tinting
            avgR /= 9;
            avgG /= 9;
            avgB /= 9;
            const max = Math.max(avgR, avgG, avgB);
            const min = Math.min(avgR, avgG, avgB);
            let h = 0;
            if (max !== min) {
              const d = max - min;
              if (max === avgR) h = ((avgG - avgB) / d + (avgG < avgB ? 6 : 0)) / 6;
              else if (max === avgG) h = ((avgB - avgR) / d + 2) / 6;
              else h = ((avgR - avgG) / d + 4) / 6;
            }

            // Neon color based on hue with variation
            const hue = (h + (x * 0.001 + y * 0.001)) % 1;
            const { r, g, b } = hslToRgb(hue, 1, 0.55);
            const normalizedEdge = edgeVal / 255;

            glowLayer[idx] = r * normalizedEdge * 255;
            glowLayer[idx + 1] = g * normalizedEdge * 255;
            glowLayer[idx + 2] = b * normalizedEdge * 255;
            glowLayer[idx + 3] = 255;
          } else {
            glowLayer[idx] = 0;
            glowLayer[idx + 1] = 0;
            glowLayer[idx + 2] = 0;
            glowLayer[idx + 3] = 255;
          }
        }
      }

      // Blur the glow layer using optimized blur
      stackBlur(glowLayer, width, height, glowRadius);

      // Composite: dark background + blurred neon glow
      const bgFactor = 0.08;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, original[i] * bgFactor + glowLayer[i] * glowIntensity * 2.5);
        data[i + 1] = Math.min(
          255,
          original[i + 1] * bgFactor + glowLayer[i + 1] * glowIntensity * 2.5
        );
        data[i + 2] = Math.min(
          255,
          original[i + 2] * bgFactor + glowLayer[i + 2] * glowIntensity * 2.5
        );
      }
    } finally {
      pool.release(original);
      pool.release(glowLayer);
    }
  };
};
// Dispersion Shatter Effect
const createDispersionShatterEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const amount = settings.dispersionAmount ?? 0.3;
    const intensity = settings.shatterIntensity ?? 0.5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Create shatter points
    const numPoints = Math.floor(20 * intensity);
    const shatterPoints: { x: number; y: number; force: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      shatterPoints.push({
        x: Math.random() * width,
        y: Math.random() * height,
        force: Math.random() * 100 * amount,
      });
    }

    // Apply dispersion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let totalForceX = 0;
        let totalForceY = 0;

        for (const point of shatterPoints) {
          const dx = x - point.x;
          const dy = y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;

          const force = point.force / (dist * dist);
          totalForceX += (dx / dist) * force;
          totalForceY += (dy / dist) * force;
        }

        const sourceX = Math.max(0, Math.min(width - 1, Math.floor(x - totalForceX)));
        const sourceY = Math.max(0, Math.min(height - 1, Math.floor(y - totalForceY)));

        const targetIdx = (y * width + x) * 4;
        const sourceIdx = (sourceY * width + sourceX) * 4;

        data[targetIdx] = tempData[sourceIdx];
        data[targetIdx + 1] = tempData[sourceIdx + 1];
        data[targetIdx + 2] = tempData[sourceIdx + 2];
        data[targetIdx + 3] = tempData[sourceIdx + 3];
      }
    }
  };
};

// Retro Dithering Effect
const createRetroDitheringEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const levels = Math.floor(settings.levels ?? 4); // Retro color depth

    // Floyd-Steinberg dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          const oldVal = data[idx + c];
          const newVal = Math.round((oldVal / 255) * (levels - 1)) * (255 / (levels - 1));
          data[idx + c] = newVal;

          const error = oldVal - newVal;

          // Distribute error to neighbors
          if (x < width - 1) {
            data[idx + 4 + c] += (error * 7) / 16;
          }
          if (y < height - 1) {
            if (x > 0) {
              data[idx + (width - 1) * 4 + c] += (error * 3) / 16;
            }
            data[idx + width * 4 + c] += (error * 5) / 16;
            if (x < width - 1) {
              data[idx + (width + 1) * 4 + c] += (error * 1) / 16;
            }
          }
        }
      }
    }
  };
};

// ============================================================================
// ADVANCED DITHERING EFFECTS
// ============================================================================

// Bayer matrices for ordered dithering
const BAYER_2x2 = [
  [0, 2],
  [3, 1],
];

const BAYER_4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER_8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

// Retro palette definitions
const PALETTES = {
  // Game Boy - 4 shades of green
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],
  // CGA Palette (mode 4, high intensity)
  cga: [
    [0, 0, 0],
    [85, 255, 255],
    [255, 85, 255],
    [255, 255, 255],
  ],
  // EGA 16-color palette
  ega: [
    [0, 0, 0],
    [0, 0, 170],
    [0, 170, 0],
    [0, 170, 170],
    [170, 0, 0],
    [170, 0, 170],
    [170, 85, 0],
    [170, 170, 170],
    [85, 85, 85],
    [85, 85, 255],
    [85, 255, 85],
    [85, 255, 255],
    [255, 85, 85],
    [255, 85, 255],
    [255, 255, 85],
    [255, 255, 255],
  ],
  // Commodore 64 palette
  c64: [
    [0, 0, 0],
    [255, 255, 255],
    [136, 57, 50],
    [103, 182, 189],
    [139, 63, 150],
    [85, 160, 73],
    [64, 49, 141],
    [191, 206, 114],
    [139, 84, 41],
    [87, 66, 0],
    [184, 105, 98],
    [80, 80, 80],
    [120, 120, 120],
    [148, 224, 137],
    [120, 105, 196],
    [159, 159, 159],
  ],
  // NES palette (simplified)
  nes: [
    [0, 0, 0],
    [252, 252, 252],
    [248, 56, 0],
    [0, 88, 248],
    [68, 40, 188],
    [148, 0, 132],
    [168, 0, 32],
    [0, 120, 0],
    [0, 168, 0],
    [0, 168, 68],
    [0, 136, 136],
    [248, 184, 0],
    [188, 188, 188],
    [124, 124, 124],
    [168, 228, 252],
    [216, 248, 120],
  ],
  // Original Macintosh 1-bit palette
  macintosh: [
    [0, 0, 0],
    [255, 255, 255],
  ],
};

// Find nearest color in palette
const findNearestColor = (r: number, g: number, b: number, palette: number[][]): number[] => {
  let minDist = Infinity;
  let nearest = palette[0];

  for (const color of palette) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const dist = dr * dr + dg * dg + db * db;

    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }

  return nearest;
};

// Quantize to N levels
const quantize = (value: number, levels: number): number => {
  return Math.round((value / 255) * (levels - 1)) * (255 / (levels - 1));
};

// Advanced Dithering Effect - Multiple algorithms in one
const createAdvancedDitheringEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const algorithm = Math.floor(settings.algorithm ?? 1);
    const paletteType = Math.floor(settings.palette ?? 0);
    const threshold = settings.threshold ?? 0.5;
    const patternScale = Math.floor(settings.patternScale ?? 2);
    const contrast = settings.contrast ?? 1;

    // Pre-apply contrast
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(
          0,
          Math.min(255, ((data[i + c] / 255 - 0.5) * contrast + 0.5) * 255)
        );
      }
    }

    // Determine color levels based on palette
    let levels: number;
    switch (paletteType) {
      case 0:
        levels = 2;
        break; // B&W
      case 1:
        levels = 4;
        break;
      case 2:
        levels = 8;
        break;
      case 3:
        levels = 16;
        break;
      case 4:
        levels = 4;
        break; // GameBoy
      case 5:
        levels = 4;
        break; // CGA
      default:
        levels = 2;
    }

    // Apply selected algorithm
    switch (algorithm) {
      case 0: // Floyd-Steinberg
        applyFloydSteinberg(data, width, height, levels);
        break;
      case 1: // Atkinson
        applyAtkinson(data, width, height, levels);
        break;
      case 2: // Ordered (Bayer)
        applyOrdered(data, width, height, levels, patternScale, threshold);
        break;
      case 3: // Stucki
        applyStucki(data, width, height, levels);
        break;
      case 4: // Sierra
        applySierra(data, width, height, levels);
        break;
      case 5: // Blue Noise
        applyBlueNoise(data, width, height, levels, 1);
        break;
    }
  };
};

// Floyd-Steinberg dithering algorithm
const applyFloydSteinberg = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  levels: number
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c];
        const newVal = quantize(oldVal, levels);
        data[idx + c] = newVal;
        const error = oldVal - newVal;

        if (x < width - 1) {
          data[idx + 4 + c] = clampByte(data[idx + 4 + c] + (error * 7) / 16);
        }
        if (y < height - 1) {
          if (x > 0) {
            data[idx + (width - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 1) * 4 + c] + (error * 3) / 16)
            );
          }
          data[idx + width * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 4 + c] + (error * 5) / 16)
          );
          if (x < width - 1) {
            data[idx + (width + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 1) * 4 + c] + (error * 1) / 16)
            );
          }
        }
      }
    }
  }
};

// Atkinson dithering - Classic Mac look, only diffuses 6/8 of error
const applyAtkinson = (data: Uint8ClampedArray, width: number, height: number, levels: number) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c];
        const newVal = quantize(oldVal, levels);
        data[idx + c] = newVal;
        const error = (oldVal - newVal) / 8; // Only 6/8 of error is distributed

        // Distribute error to 6 neighbors (Atkinson pattern)
        if (x < width - 1) {
          data[idx + 4 + c] = clampByte(data[idx + 4 + c] + error);
        }
        if (x < width - 2) {
          data[idx + 8 + c] = clampByte(data[idx + 8 + c] + error);
        }
        if (y < height - 1) {
          if (x > 0) {
            data[idx + (width - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 1) * 4 + c] + error)
            );
          }
          data[idx + width * 4 + c] = clampByte(data[idx + width * 4 + c] + error);
          if (x < width - 1) {
            data[idx + (width + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 1) * 4 + c] + error)
            );
          }
        }
        if (y < height - 2) {
          data[idx + width * 2 * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 2 * 4 + c] + error)
          );
        }
      }
    }
  }
};

// Ordered (Bayer) dithering
const applyOrdered = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  levels: number,
  scale: number,
  threshold: number
) => {
  const matrix = scale <= 2 ? BAYER_2x2 : scale <= 4 ? BAYER_4x4 : BAYER_8x8;
  const matrixSize = matrix.length;
  const maxMatrixValue = matrixSize * matrixSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const mx = x % matrixSize;
      const my = y % matrixSize;
      const bayerValue = matrix[my][mx] / maxMatrixValue;

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c] / 255;
        const thresholdOffset = (bayerValue - 0.5) * threshold;
        const newVal = quantize((oldVal + thresholdOffset) * 255, levels);
        data[idx + c] = newVal;
      }
    }
  }
};

// Stucki dithering - Higher quality, larger diffusion kernel
const applyStucki = (data: Uint8ClampedArray, width: number, height: number, levels: number) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c];
        const newVal = quantize(oldVal, levels);
        data[idx + c] = newVal;
        const error = oldVal - newVal;

        // Stucki kernel (42 divisor)
        // Current row
        if (x < width - 1) data[idx + 4 + c] = clampByte(data[idx + 4 + c] + (error * 8) / 42);
        if (x < width - 2) data[idx + 8 + c] = clampByte(data[idx + 8 + c] + (error * 4) / 42);

        // Next row
        if (y < height - 1) {
          if (x > 1)
            data[idx + (width - 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 2) * 4 + c] + (error * 2) / 42)
            );
          if (x > 0)
            data[idx + (width - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 1) * 4 + c] + (error * 4) / 42)
            );
          data[idx + width * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 4 + c] + (error * 8) / 42)
          );
          if (x < width - 1)
            data[idx + (width + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 1) * 4 + c] + (error * 4) / 42)
            );
          if (x < width - 2)
            data[idx + (width + 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 2) * 4 + c] + (error * 2) / 42)
            );
        }

        // Two rows down
        if (y < height - 2) {
          if (x > 1)
            data[idx + (width * 2 - 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 - 2) * 4 + c] + (error * 1) / 42)
            );
          if (x > 0)
            data[idx + (width * 2 - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 - 1) * 4 + c] + (error * 2) / 42)
            );
          data[idx + width * 2 * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 2 * 4 + c] + (error * 4) / 42)
          );
          if (x < width - 1)
            data[idx + (width * 2 + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 + 1) * 4 + c] + (error * 2) / 42)
            );
          if (x < width - 2)
            data[idx + (width * 2 + 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 + 2) * 4 + c] + (error * 1) / 42)
            );
        }
      }
    }
  }
};

// Sierra dithering - Good balance between quality and speed
const applySierra = (data: Uint8ClampedArray, width: number, height: number, levels: number) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c];
        const newVal = quantize(oldVal, levels);
        data[idx + c] = newVal;
        const error = oldVal - newVal;

        // Sierra kernel (32 divisor)
        if (x < width - 1) data[idx + 4 + c] = clampByte(data[idx + 4 + c] + (error * 5) / 32);
        if (x < width - 2) data[idx + 8 + c] = clampByte(data[idx + 8 + c] + (error * 3) / 32);

        if (y < height - 1) {
          if (x > 1)
            data[idx + (width - 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 2) * 4 + c] + (error * 2) / 32)
            );
          if (x > 0)
            data[idx + (width - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width - 1) * 4 + c] + (error * 4) / 32)
            );
          data[idx + width * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 4 + c] + (error * 5) / 32)
          );
          if (x < width - 1)
            data[idx + (width + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 1) * 4 + c] + (error * 4) / 32)
            );
          if (x < width - 2)
            data[idx + (width + 2) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width + 2) * 4 + c] + (error * 2) / 32)
            );
        }

        if (y < height - 2) {
          if (x > 0)
            data[idx + (width * 2 - 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 - 1) * 4 + c] + (error * 2) / 32)
            );
          data[idx + width * 2 * 4 + c] = Math.max(
            0,
            Math.min(255, data[idx + width * 2 * 4 + c] + (error * 3) / 32)
          );
          if (x < width - 1)
            data[idx + (width * 2 + 1) * 4 + c] = Math.max(
              0,
              Math.min(255, data[idx + (width * 2 + 1) * 4 + c] + (error * 2) / 32)
            );
        }
      }
    }
  }
};

// Blue noise dithering - Organic, visually pleasing patterns
const applyBlueNoise = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  levels: number,
  scale: number
) => {
  // Generate blue noise using void and cluster algorithm approximation
  const blueNoise = generateBlueNoise(width, height, scale);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const noiseIdx = y * width + x;
      const noiseValue = blueNoise[noiseIdx];

      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c] / 255;
        const threshold = (noiseValue - 0.5) * (1 / levels);
        const newVal = quantize((oldVal + threshold) * 255, levels);
        data[idx + c] = newVal;
      }
    }
  }
};

// Generate blue noise texture
const generateBlueNoise = (width: number, height: number, scale: number): Float32Array => {
  const noise = new Float32Array(width * height);

  // Use interleaved gradient noise as approximation of blue noise
  // This creates a more organic pattern than Bayer
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // Interleaved gradient noise formula
      const fx = (x / scale) * 0.06711056;
      const fy = (y / scale) * 0.00583715;
      noise[idx] = (52.9829189 * ((fx + fy) % 1)) % 1;
    }
  }

  return noise;
};

// Standalone Atkinson Dithering Effect
const createAtkinsonDitheringEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const colorMode = Math.floor(settings.colorMode ?? 0);
    const levels = Math.floor(settings.levels ?? 2);
    const threshold = settings.threshold ?? 0.5;

    // Convert to grayscale first if B&W mode
    if (colorMode === 0 || colorMode === 1) {
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // Apply threshold adjustment
        const adjusted = Math.max(
          0,
          Math.min(255, ((gray / 255 - 0.5) * (1 + threshold) + 0.5) * 255)
        );
        data[i] = data[i + 1] = data[i + 2] = adjusted;
      }
    }

    const effectiveLevels = colorMode === 0 ? 2 : levels;
    applyAtkinson(data, width, height, effectiveLevels);
  };
};

// Standalone Ordered Dithering Effect
const createOrderedDitheringEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const matrixSize = Math.floor(settings.matrixSize ?? 4);
    const colorMode = Math.floor(settings.colorMode ?? 0);
    const levels = Math.floor(settings.levels ?? 2);
    const spread = settings.spread ?? 0.5;

    // Convert to grayscale first if B&W mode
    if (colorMode === 0 || colorMode === 1) {
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
    }

    const effectiveLevels = colorMode === 0 ? 2 : levels;
    applyOrdered(data, width, height, effectiveLevels, matrixSize, spread);
  };
};

// Standalone Blue Noise Dithering Effect
const createBlueNoiseDitheringEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const colorMode = Math.floor(settings.colorMode ?? 0);
    const levels = Math.floor(settings.levels ?? 2);
    const noiseScale = settings.noiseScale ?? 1;

    // Convert to grayscale first if B&W mode
    if (colorMode === 0 || colorMode === 1) {
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
    }

    const effectiveLevels = colorMode === 0 ? 2 : levels;
    applyBlueNoise(data, width, height, effectiveLevels, noiseScale);
  };
};

// Halftone Pattern Effect
const createHalftonePatternEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const dotSize = Math.floor(settings.dotSize ?? 6);
    const angle = ((settings.angle ?? 45) * Math.PI) / 180;
    const colorMode = Math.floor(settings.colorMode ?? 0);
    const contrast = settings.contrast ?? 1;

    // Create temporary buffer
    const tempData = new Uint8ClampedArray(data.length);

    // Fill with white background
    for (let i = 0; i < tempData.length; i += 4) {
      tempData[i] = tempData[i + 1] = tempData[i + 2] = 255;
      tempData[i + 3] = data[i + 3];
    }

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    if (colorMode === 0) {
      // B&W halftone
      for (let cellY = 0; cellY < Math.ceil(height / dotSize) + 1; cellY++) {
        for (let cellX = 0; cellX < Math.ceil(width / dotSize) + 1; cellX++) {
          const cx = cellX * dotSize;
          const cy = cellY * dotSize;

          // Rotate grid
          const rcx = cx * cosAngle - cy * sinAngle;
          const rcy = cx * sinAngle + cy * cosAngle;

          // Get average brightness in cell
          let totalBrightness = 0;
          let count = 0;

          for (let dy = 0; dy < dotSize; dy++) {
            for (let dx = 0; dx < dotSize; dx++) {
              const px = Math.floor(rcx + dx);
              const py = Math.floor(rcy + dy);

              if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                const brightness =
                  (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
                totalBrightness += brightness;
                count++;
              }
            }
          }

          if (count === 0) continue;

          const avgBrightness = totalBrightness / count;
          const adjustedBrightness = Math.pow(avgBrightness, 1 / contrast);
          const radius = (dotSize / 2) * (1 - adjustedBrightness);

          // Draw dot
          for (let dy = -dotSize; dy <= dotSize; dy++) {
            for (let dx = -dotSize; dx <= dotSize; dx++) {
              const px = Math.floor(rcx + dotSize / 2 + dx);
              const py = Math.floor(rcy + dotSize / 2 + dy);

              if (px >= 0 && px < width && py >= 0 && py < height) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius) {
                  const idx = (py * width + px) * 4;
                  tempData[idx] = tempData[idx + 1] = tempData[idx + 2] = 0;
                }
              }
            }
          }
        }
      }
    } else {
      // CMYK halftone
      const channels = [
        { offset: 0, color: [0, 255, 255], angle: 15 }, // Cyan
        { offset: 1, color: [255, 0, 255], angle: 75 }, // Magenta
        { offset: 2, color: [255, 255, 0], angle: 0 }, // Yellow
        { offset: 3, color: [0, 0, 0], angle: 45 }, // Black
      ];

      for (const channel of channels) {
        const chAngle = ((channel.angle + (settings.angle ?? 0)) * Math.PI) / 180;
        const chCos = Math.cos(chAngle);
        const chSin = Math.sin(chAngle);

        for (let cellY = 0; cellY < Math.ceil(height / dotSize) + 1; cellY++) {
          for (let cellX = 0; cellX < Math.ceil(width / dotSize) + 1; cellX++) {
            const cx = cellX * dotSize;
            const cy = cellY * dotSize;

            const rcx = cx * chCos - cy * chSin;
            const rcy = cx * chSin + cy * chCos;

            let totalValue = 0;
            let count = 0;

            for (let dy = 0; dy < dotSize; dy++) {
              for (let dx = 0; dx < dotSize; dx++) {
                const px = Math.floor(rcx + dx);
                const py = Math.floor(rcy + dy);

                if (px >= 0 && px < width && py >= 0 && py < height) {
                  const idx = (py * width + px) * 4;
                  if (channel.offset < 3) {
                    totalValue += 255 - data[idx + channel.offset];
                  } else {
                    const minRGB = Math.min(data[idx], data[idx + 1], data[idx + 2]);
                    totalValue += 255 - minRGB;
                  }
                  count++;
                }
              }
            }

            if (count === 0) continue;

            const avgValue = totalValue / count / 255;
            const radius = (dotSize / 2) * avgValue;

            for (let dy = -dotSize; dy <= dotSize; dy++) {
              for (let dx = -dotSize; dx <= dotSize; dx++) {
                const px = Math.floor(rcx + dotSize / 2 + dx);
                const py = Math.floor(rcy + dotSize / 2 + dy);

                if (px >= 0 && px < width && py >= 0 && py < height) {
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist <= radius) {
                    const idx = (py * width + px) * 4;
                    tempData[idx] = Math.min(tempData[idx], channel.color[0]);
                    tempData[idx + 1] = Math.min(tempData[idx + 1], channel.color[1]);
                    tempData[idx + 2] = Math.min(tempData[idx + 2], channel.color[2]);
                  }
                }
              }
            }
          }
        }
      }
    }

    data.set(tempData);
  };
};

// Retro Palette Effect - Apply classic gaming palettes with dithering
const createRetroPaletteEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const paletteType = Math.floor(settings.palette ?? 0);
    const ditheringType = Math.floor(settings.dithering ?? 1);
    const ditherStrength = settings.ditherStrength ?? 0.8;

    // Select palette
    const paletteNames: (keyof typeof PALETTES)[] = [
      'gameboy',
      'cga',
      'ega',
      'c64',
      'nes',
      'macintosh',
    ];
    const palette = PALETTES[paletteNames[paletteType]] || PALETTES.gameboy;

    if (ditheringType === 0) {
      // No dithering - simple nearest color
      for (let i = 0; i < data.length; i += 4) {
        const nearest = findNearestColor(data[i], data[i + 1], data[i + 2], palette);
        data[i] = nearest[0];
        data[i + 1] = nearest[1];
        data[i + 2] = nearest[2];
      }
    } else if (ditheringType === 1) {
      // Atkinson dithering with palette
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;

          const oldR = data[idx];
          const oldG = data[idx + 1];
          const oldB = data[idx + 2];

          const nearest = findNearestColor(oldR, oldG, oldB, palette);
          data[idx] = nearest[0];
          data[idx + 1] = nearest[1];
          data[idx + 2] = nearest[2];

          const errorR = ((oldR - nearest[0]) * ditherStrength) / 8;
          const errorG = ((oldG - nearest[1]) * ditherStrength) / 8;
          const errorB = ((oldB - nearest[2]) * ditherStrength) / 8;

          // Atkinson diffusion pattern
          const diffuse = (offset: number) => {
            if (idx + offset >= 0 && idx + offset < data.length - 3) {
              data[idx + offset] = clampByte(data[idx + offset] + errorR);
              data[idx + offset + 1] = clampByte(data[idx + offset + 1] + errorG);
              data[idx + offset + 2] = clampByte(data[idx + offset + 2] + errorB);
            }
          };

          if (x < width - 1) diffuse(4);
          if (x < width - 2) diffuse(8);
          if (y < height - 1) {
            if (x > 0) diffuse((width - 1) * 4);
            diffuse(width * 4);
            if (x < width - 1) diffuse((width + 1) * 4);
          }
          if (y < height - 2) diffuse(width * 2 * 4);
        }
      }
    } else {
      // Ordered dithering with palette
      const matrix = BAYER_4x4;
      const matrixSize = 4;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const mx = x % matrixSize;
          const my = y % matrixSize;
          const bayerValue = (matrix[my][mx] / 16 - 0.5) * ditherStrength * 64;

          const r = clampByte(data[idx] + bayerValue);
          const g = clampByte(data[idx + 1] + bayerValue);
          const b = clampByte(data[idx + 2] + bayerValue);

          const nearest = findNearestColor(r, g, b, palette);
          data[idx] = nearest[0];
          data[idx + 1] = nearest[1];
          data[idx + 2] = nearest[2];
        }
      }
    }
  };
};

// Topographic Contours Effect
const createTopographicContoursEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const contourLevels = Math.floor(settings.contourLevels ?? 10);

    const tempData = new Uint8ClampedArray(data.length);

    // Convert to elevation map based on brightness
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      const level = Math.floor(brightness * contourLevels) / contourLevels;

      // Create contour lines
      const nextPixelIdx = i + 4;
      const belowPixelIdx = i + width * 4;

      let isContour = false;

      if (nextPixelIdx < data.length) {
        const nextBrightness =
          (data[nextPixelIdx] * 0.299 +
            data[nextPixelIdx + 1] * 0.587 +
            data[nextPixelIdx + 2] * 0.114) /
          255;
        const nextLevel = Math.floor(nextBrightness * contourLevels) / contourLevels;
        if (Math.abs(level - nextLevel) > 0.01) isContour = true;
      }

      if (belowPixelIdx < data.length) {
        const belowBrightness =
          (data[belowPixelIdx] * 0.299 +
            data[belowPixelIdx + 1] * 0.587 +
            data[belowPixelIdx + 2] * 0.114) /
          255;
        const belowLevel = Math.floor(belowBrightness * contourLevels) / contourLevels;
        if (Math.abs(level - belowLevel) > 0.01) isContour = true;
      }

      if (isContour) {
        // Draw contour lines in dark color
        tempData[i] = 0;
        tempData[i + 1] = 0;
        tempData[i + 2] = 0;
        tempData[i + 3] = data[i + 3]; // Preserve original alpha
      } else {
        // Preserve original image colors with subtle tint based on elevation
        const tintStrength = 0.3;
        const elevationTint = level * 40; // Subtle warm tint based on elevation
        tempData[i] = Math.min(255, data[i] + elevationTint * tintStrength);
        tempData[i + 1] = Math.min(255, data[i + 1] + elevationTint * 0.5 * tintStrength);
        tempData[i + 2] = data[i + 2];
        tempData[i + 3] = data[i + 3]; // Preserve original alpha
      }
    }

    data.set(tempData);
  };
};

// Weave Pattern Effect
const createWeavePatternEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // Map 4-16 input to 8-60 pixel weave size
    const sizeInput = settings.weaveSize ?? 8;
    const weaveSize = Math.floor(8 + ((sizeInput - 4) / 12) * 52); // 8 to 60

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Position within current weave cell
        const cellX = x % weaveSize;
        const cellY = y % weaveSize;

        // Which thread are we on?
        const xThread = Math.floor(x / weaveSize) % 2;
        const yThread = Math.floor(y / weaveSize) % 2;
        const isWarp = (xThread + yThread) % 2 === 0;

        // Create thread edge darkening (simulate 3D thread overlap)
        const edgeDist = Math.min(cellX, weaveSize - cellX - 1, cellY, weaveSize - cellY - 1);
        const edgeFactor = Math.min(1, edgeDist / (weaveSize * 0.3));

        // Thread highlight/shadow based on weave direction
        let brightness: number;
        if (isWarp) {
          // Warp threads (horizontal) - lit from top-left
          const highlight = (cellX / weaveSize) * 0.3 + 0.85;
          brightness = highlight * edgeFactor + (1 - edgeFactor) * 0.5;
        } else {
          // Weft threads (vertical) - slightly darker, different angle
          const shadow = 1 - (cellY / weaveSize) * 0.25;
          brightness = shadow * 0.85 * edgeFactor + (1 - edgeFactor) * 0.4;
        }

        // Add thread texture lines
        const threadLine = isWarp
          ? Math.sin((cellY / weaveSize) * Math.PI * 4) * 0.1
          : Math.sin((cellX / weaveSize) * Math.PI * 4) * 0.1;

        brightness = brightness + threadLine;

        // Apply color with fabric desaturation
        const r = tempData[idx];
        const g = tempData[idx + 1];
        const b = tempData[idx + 2];

        // Slight desaturation for fabric look
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        const saturation = 0.7;

        data[idx] = Math.min(
          255,
          Math.max(0, (r * saturation + gray * (1 - saturation)) * brightness)
        );
        data[idx + 1] = Math.min(
          255,
          Math.max(0, (g * saturation + gray * (1 - saturation)) * brightness)
        );
        data[idx + 2] = Math.min(
          255,
          Math.max(0, (b * saturation + gray * (1 - saturation)) * brightness)
        );

        // Subtle fabric grain noise
        const noise = (Math.random() - 0.5) * 8;
        data[idx] = clampByte(data[idx] + noise);
        data[idx + 1] = clampByte(data[idx + 1] + noise);
        data[idx + 2] = clampByte(data[idx + 2] + noise);
      }
    }
  };
};

// Bioluminescence Effect
const createBioluminescenceEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const glowIntensity = settings.glowIntensity ?? 0.5;
    const glowSpread = settings.glowSpread ?? 0.5;

    const pool = getBufferPool();
    const original = pool.acquire(data.length);
    const glowLayer = pool.acquire(data.length);

    try {
      original.set(data);

      // Brightness threshold scales with intensity
      const brightnessThreshold = 0.3 + (1 - glowIntensity) * 0.4;

      // Extract glow sources - bright/saturated areas with bioluminescent color shift
      for (let i = 0; i < data.length; i += 4) {
        const r = original[i];
        const g = original[i + 1];
        const b = original[i + 2];
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

        const glowFactor =
          brightness > brightnessThreshold
            ? (brightness - brightnessThreshold) / (1 - brightnessThreshold)
            : 0;
        const satGlow = saturation > 0.3 ? saturation * 0.5 : 0;
        const combinedGlow = Math.min(1, glowFactor + satGlow);

        if (combinedGlow > 0.1) {
          // Bioluminescent color shift - push towards cyan/blue-green
          glowLayer[i] = (r * 0.3 + 20) * combinedGlow;
          glowLayer[i + 1] = (g * 0.8 + b * 0.3 + 100) * combinedGlow;
          glowLayer[i + 2] = (b * 0.7 + g * 0.4 + 80) * combinedGlow;
          glowLayer[i + 3] = 255;
        } else {
          glowLayer[i] = 0;
          glowLayer[i + 1] = 0;
          glowLayer[i + 2] = 0;
          glowLayer[i + 3] = 255;
        }
      }

      // Blur the glow layer using optimized separable blur
      const glowRadius = Math.ceil(5 + glowSpread * 55);
      stackBlur(glowLayer, width, height, Math.min(glowRadius, 60));

      // Darkness factor for background
      const darknessFactor = 0.05 + (1 - glowSpread) * 0.15;

      // Composite: dark background + blurred glow
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, original[i] * darknessFactor + glowLayer[i] * glowIntensity * 2);
        data[i + 1] = Math.min(
          255,
          original[i + 1] * darknessFactor + glowLayer[i + 1] * glowIntensity * 2
        );
        data[i + 2] = Math.min(
          255,
          original[i + 2] * (darknessFactor + 0.03) + glowLayer[i + 2] * glowIntensity * 2
        );
      }

      // Add sparkle particles at high intensity
      if (glowIntensity > 0.6) {
        const particleCount = Math.floor((glowIntensity - 0.6) * 300);
        for (let i = 0; i < particleCount; i++) {
          const px = Math.floor(Math.random() * width);
          const py = Math.floor(Math.random() * height);
          const idx = (py * width + px) * 4;

          // Only sparkle where there's glow
          if (glowLayer[idx] > 20 || glowLayer[idx + 1] > 20) {
            const sparkle = 50 + Math.random() * 100;
            data[idx] = Math.min(255, data[idx] + sparkle * 0.3);
            data[idx + 1] = Math.min(255, data[idx + 1] + sparkle);
            data[idx + 2] = Math.min(255, data[idx + 2] + sparkle * 0.8);
          }
        }
      }
    } finally {
      pool.release(original);
      pool.release(glowLayer);
    }
  };
};

// Helper function for HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

// 13. Ink Bleed Implementation (Simplified)
