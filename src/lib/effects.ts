'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

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
let Konva: typeof import('konva') | null = null;
let konvaInitPromise: Promise<typeof import('konva')> | null = null;
let filtersInitialized = false;

const ensureKonvaFiltersLoaded = async () => {
  if (filtersInitialized || typeof window === 'undefined') {
    return;
  }

  filtersInitialized = true;

  try {
    await Promise.all([
      import('konva/lib/filters/Blur'),
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
};

const loadKonva = async () => {
  if (!konvaInitPromise) {
    konvaInitPromise = import('konva');
  }

  Konva = await konvaInitPromise;
  await ensureKonvaFiltersLoaded();

  if (Konva && Konva.Filters) {
    // Register custom filters if needed
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (Konva as unknown as Record<string, unknown>).noop = () => {};
  }
};

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const createPosterizeFallback = (levels: number): KonvaFilterFunction => {
  const normalizedLevels = clamp(Math.floor(levels), 2, 16);
  const step = 255 / (normalizedLevels - 1);

  return imageData => {
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(Math.round(data[i] / step) * step);
      data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
      data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
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
  const iterations = clamp(Math.round(radius), 1, 8);

  return imageData => {
    const { data, width, height } = imageData;
    if (iterations <= 0 || width === 0 || height === 0) {
      return;
    }

    const temp = new Uint8ClampedArray(data);

    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;

          let rSum = temp[idx];
          let gSum = temp[idx + 1];
          let bSum = temp[idx + 2];
          let aSum = temp[idx + 3];
          let count = 1;

          const leftIdx = x > 0 ? idx - 4 : -1;
          const rightIdx = x < width - 1 ? idx + 4 : -1;
          const upIdx = y > 0 ? idx - width * 4 : -1;
          const downIdx = y < height - 1 ? idx + width * 4 : -1;

          if (leftIdx >= 0) {
            rSum += temp[leftIdx];
            gSum += temp[leftIdx + 1];
            bSum += temp[leftIdx + 2];
            aSum += temp[leftIdx + 3];
            count++;
          }

          if (rightIdx >= 0) {
            rSum += temp[rightIdx];
            gSum += temp[rightIdx + 1];
            bSum += temp[rightIdx + 2];
            aSum += temp[rightIdx + 3];
            count++;
          }

          if (upIdx >= 0) {
            rSum += temp[upIdx];
            gSum += temp[upIdx + 1];
            bSum += temp[upIdx + 2];
            aSum += temp[upIdx + 3];
            count++;
          }

          if (downIdx >= 0) {
            rSum += temp[downIdx];
            gSum += temp[downIdx + 1];
            bSum += temp[downIdx + 2];
            aSum += temp[downIdx + 3];
            count++;
          }

          data[idx] = Math.round(rSum / count);
          data[idx + 1] = Math.round(gSum / count);
          data[idx + 2] = Math.round(bSum / count);
          data[idx + 3] = Math.round(aSum / count);
        }
      }

      temp.set(data);
    }
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
  const blurRadius = clamp(settings.blur ?? 5, 1, 12);
  const brightness = clamp(settings.brightness ?? 0.2, 0, 1);
  const glow = clamp(settings.glow ?? 0.5, 0, 1);
  const blendMode = Math.round(clamp(settings.blendMode ?? 0, 0, 2));
  const blurFilter = createBlurFallback(blurRadius);

  return imageData => {
    const { data, width, height } = imageData;
    if (width === 0 || height === 0) {
      return;
    }

    const original = new Uint8ClampedArray(data);
    const blurred = new Uint8ClampedArray(data.length);
    blurred.set(original);

    blurFilter({ data: blurred, width, height });

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

// Helper function to interpolate between two values
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Update applyEffect signature and logic
export const applyEffect = async (
  effectName: string | null,
  settings: Record<string, number>
  // Return the Konva Filter function and parameters object
): Promise<[KonvaFilterFunction | null, FilterParams | null]> => {
  if (!effectName || typeof window === 'undefined') {
    console.log('Cannot apply effect: No effect name or not in browser');
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

  console.log(`Getting Konva filter for: ${effectName} with settings:`, settings);

  try {
    switch (effectName) {
      case 'brightness': {
        const brightnessValue = settings.value ?? 0;
        console.log(`Applying brightness: ${brightnessValue}`);
        return [Konva.Filters.Brighten, { brightness: brightnessValue }];
      }

      case 'contrast': {
        const contrastValue = settings.value ?? 0;
        console.log(`Applying contrast: ${contrastValue}`);
        return [Konva.Filters.Contrast, { contrast: contrastValue }];
      }

      case 'saturation': {
        const scaledSaturation = settings.value !== undefined ? settings.value : 0;
        console.log(`Applying saturation: ${scaledSaturation}`);
        return [Konva.Filters.HSL, { saturation: scaledSaturation }];
      }

      case 'hue': {
        const hueDegrees = settings.value !== undefined ? settings.value : 0;
        console.log(`Applying hue: ${hueDegrees}`);
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
        return [createPosterizeFallback(levels), null];
      }

      case 'grayscale':
        return [Konva.Filters.Grayscale, {}];

      case 'sepia':
        return [Konva.Filters.Sepia, {}];

      case 'invert':
        return [Konva.Filters.Invert, {}];

      // Keep custom filters for ones Konva doesn't have built-in
      case 'pencilSketch':
        return [createPencilSketchEffect(settings), {}];
      case 'halftone':
        return [createHalftoneEffect(settings), {}];
      case 'duotone':
        return [createDuotoneEffect(settings), {}];
      case 'bloom':
        return [createBloomEffect(settings), {}];
      case 'oilPainting': // Kuwahara
        return [createKuwaharaEffect(settings), {}];
      case 'geometric':
        return [createGeometricAbstraction(settings), {}];
      case 'stippling':
        return [createStipplingEffect(settings), {}];
      case 'cellular':
        return [createCellularAutomataEffect(settings), {}];
      case 'reaction-diffusion':
        await import('./effects/reactionDiffusionEffect');
        return [
          Konva.Filters.ReactionDiffusion,
          {
            reactionFeedRate: settings.feedRate ?? 0.055,
            reactionKillRate: settings.killRate ?? 0.062,
            reactionDiffusionA: settings.diffusionA ?? 1.0,
            reactionDiffusionB: settings.diffusionB ?? 0.5,
            reactionIterations: settings.iterations ?? 100,
            reactionPattern: settings.pattern ?? 0,
            reactionColorScheme: settings.colorScheme ?? 0,
            reactionOpacity: settings.opacity ?? 0.8,
          },
        ];
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
      case 'flowField':
        await import('./effects/flowFieldEffect');
        return [
          Konva.Filters.FlowField,
          {
            flowFieldScale: settings.scale ?? 0.01,
            flowFieldStrength: settings.strength ?? 10,
            flowFieldParticles: settings.particles ?? 1000,
            flowFieldType: settings.type ?? 0,
            flowFieldBlend: settings.blend ?? 0.7,
            flowFieldSeed: settings.seed ?? 42,
          },
        ];

      case 'vectorField':
        await import('./effects/flowFieldEffect');
        return [
          Konva.Filters.VectorField,
          {
            vectorFieldScale: settings.scale ?? 0.02,
            vectorFieldSpacing: settings.spacing ?? 20,
            vectorFieldLength: settings.length ?? 15,
            vectorFieldThickness: settings.thickness ?? 2,
            vectorFieldColorMode: settings.colorMode ?? 0,
          },
        ];

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
      case 'topographicContours':
        return [createTopographicContoursEffect(settings), {}];
      case 'weavePattern':
        return [createWeavePatternEffect(settings), {}];
      case 'bioluminescence':
        return [createBioluminescenceEffect(settings), {}];

      // Fractal Effects
      case 'mandelbrot': {
        const fractalModule = await import('./effects/fractalEffects');

        // Create a direct filter function
        const mandelbrotFilter = function (imageData: KonvaImageData) {
          const { generateMandelbrot } = fractalModule;

          // Map numeric values to expected types
          const colorSchemeMap = ['rainbow', 'fire', 'ocean', 'psychedelic'] as const;
          const blendModeMap = ['overlay', 'multiply', 'screen'] as const;

          const fractalSettings = {
            centerX: settings.centerX ?? 0,
            centerY: settings.centerY ?? 0,
            zoom: settings.zoom ?? 1,
            maxIterations: Math.floor(settings.iterations ?? 100),
            colorScheme: colorSchemeMap[Math.floor(settings.colorScheme ?? 0)] || 'rainbow',
          };

          // Generate fractal
          const fractalData = generateMandelbrot(
            imageData.width,
            imageData.height,
            fractalSettings
          );

          // Blend with original image
          const blendMode = blendModeMap[Math.floor(settings.blendMode ?? 0)] || 'overlay';
          const opacity = settings.opacity ?? 0.5;

          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            const fr = fractalData.data[i];
            const fg = fractalData.data[i + 1];
            const fb = fractalData.data[i + 2];

            // Apply blend mode
            let newR = r,
              newG = g,
              newB = b;

            switch (blendMode) {
              case 'overlay':
                newR = r < 128 ? (2 * r * fr) / 255 : 255 - (2 * (255 - r) * (255 - fr)) / 255;
                newG = g < 128 ? (2 * g * fg) / 255 : 255 - (2 * (255 - g) * (255 - fg)) / 255;
                newB = b < 128 ? (2 * b * fb) / 255 : 255 - (2 * (255 - b) * (255 - fb)) / 255;
                break;
              case 'multiply':
                newR = (r * fr) / 255;
                newG = (g * fg) / 255;
                newB = (b * fb) / 255;
                break;
              case 'screen':
                newR = 255 - ((255 - r) * (255 - fr)) / 255;
                newG = 255 - ((255 - g) * (255 - fg)) / 255;
                newB = 255 - ((255 - b) * (255 - fb)) / 255;
                break;
            }

            // Apply opacity
            imageData.data[i] = Math.round(r * (1 - opacity) + newR * opacity);
            imageData.data[i + 1] = Math.round(g * (1 - opacity) + newG * opacity);
            imageData.data[i + 2] = Math.round(b * (1 - opacity) + newB * opacity);
          }
        };

        return [mandelbrotFilter, {}];
      }

      case 'juliaSet': {
        const fractalModule2 = await import('./effects/fractalEffects');

        // Create a direct filter function
        const juliaSetFilter = function (imageData: KonvaImageData) {
          const { generateJuliaSet } = fractalModule2;

          // Map numeric values to expected types
          const colorSchemeMap = ['rainbow', 'fire', 'ocean', 'psychedelic'] as const;
          const blendModeMap = ['overlay', 'multiply', 'screen'] as const;

          const fractalSettings = {
            cReal: settings.cReal ?? -0.7,
            cImag: settings.cImag ?? 0.27,
            zoom: settings.zoom ?? 1,
            maxIterations: Math.floor(settings.iterations ?? 100),
            colorScheme: colorSchemeMap[Math.floor(settings.colorScheme ?? 0)] || 'psychedelic',
          };

          // Generate fractal
          const fractalData = generateJuliaSet(imageData.width, imageData.height, fractalSettings);

          // Blend with original image
          const blendMode = blendModeMap[Math.floor(settings.blendMode ?? 0)] || 'overlay';
          const opacity = settings.opacity ?? 0.5;

          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            const fr = fractalData.data[i];
            const fg = fractalData.data[i + 1];
            const fb = fractalData.data[i + 2];

            // Apply blend mode
            let newR = r,
              newG = g,
              newB = b;

            switch (blendMode) {
              case 'overlay':
                newR = r < 128 ? (2 * r * fr) / 255 : 255 - (2 * (255 - r) * (255 - fr)) / 255;
                newG = g < 128 ? (2 * g * fg) / 255 : 255 - (2 * (255 - g) * (255 - fg)) / 255;
                newB = b < 128 ? (2 * b * fb) / 255 : 255 - (2 * (255 - b) * (255 - fb)) / 255;
                break;
              case 'multiply':
                newR = (r * fr) / 255;
                newG = (g * fg) / 255;
                newB = (b * fb) / 255;
                break;
              case 'screen':
                newR = 255 - ((255 - r) * (255 - fr)) / 255;
                newG = 255 - ((255 - g) * (255 - fg)) / 255;
                newB = 255 - ((255 - b) * (255 - fb)) / 255;
                break;
            }

            // Apply opacity
            imageData.data[i] = Math.round(r * (1 - opacity) + newR * opacity);
            imageData.data[i + 1] = Math.round(g * (1 - opacity) + newG * opacity);
            imageData.data[i + 2] = Math.round(b * (1 - opacity) + newB * opacity);
          }
        };

        return [juliaSetFilter, {}];
      }

      case 'fractalDisplacement':
        return [createFractalDisplacementEffect(settings), {}];

      case 'psychedelicKaleidoscope':
        return [createPsychedelicKaleidoscopeEffect(settings), {}];

      case 'fractalMirror':
        return [createFractalMirrorEffect(settings), {}];

      // Generative Overlay Effects - return overlay marker for orchestrator
      case 'generativeStars':
      case 'generativeBubbles':
      case 'generativeNetwork':
      case 'generativeSnow':
      case 'generativeConfetti':
      case 'generativeFireflies': {
        const overlayType = (effectName.replace('generative', '') || '').toLowerCase();
        const overlayResult: GenerativeOverlayResult = { overlayType, settings };
        return [null, overlayResult];
      }

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
const createReactionDiffusionEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const iterations = Math.max(1, Math.min(20, Math.floor(settings.iterations || 10)));
    const scale = Math.max(1, Math.min(8, Math.floor(settings.scale || 4)));
    const feedRate = Math.max(0.01, Math.min(0.1, settings.feedRate || 0.055));
    const killRate = Math.max(0.01, Math.min(0.1, settings.killRate || 0.062));

    const simWidth = Math.ceil(width / scale);
    const simHeight = Math.ceil(height / scale);

    let gridA = new Float32Array(simWidth * simHeight);
    let gridB = new Float32Array(simWidth * simHeight);

    for (let y = 0; y < simHeight; y++) {
      for (let x = 0; x < simWidth; x++) {
        let totalBrightness = 0;
        let count = 0;

        for (let sy = 0; sy < scale && y * scale + sy < height; sy++) {
          for (let sx = 0; sx < scale && x * scale + sx < width; sx++) {
            const imgX = x * scale + sx;
            const imgY = y * scale + sy;
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

        const idx = y * simWidth + x;
        gridA[idx] = avgBrightness < 0.4 ? 0.5 : 1.0;
        gridB[idx] = avgBrightness < 0.4 ? 0.25 : 0.0;
      }
    }

    const centerX = Math.floor(simWidth / 2);
    const centerY = Math.floor(simHeight / 2);
    const seedSize = Math.floor(Math.min(simWidth, simHeight) / 10);

    for (let y = -seedSize; y <= seedSize; y++) {
      for (let x = -seedSize; x <= seedSize; x++) {
        const sx = (centerX + x + simWidth) % simWidth;
        const sy = (centerY + y + simHeight) % simHeight;

        if (x * x + y * y <= seedSize * seedSize) {
          gridA[sy * simWidth + sx] = 0.5;
          gridB[sy * simWidth + sx] = 0.25;
        }
      }
    }

    const dA = 1.0;
    const dB = 0.5;
    const dt = 1.0;

    let nextA = new Float32Array(simWidth * simHeight);
    let nextB = new Float32Array(simWidth * simHeight);

    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 0; y < simHeight; y++) {
        for (let x = 0; x < simWidth; x++) {
          const idx = y * simWidth + x;

          const a = gridA[idx];
          const b = gridB[idx];

          let laplA = 0;
          let laplB = 0;

          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue;

              const weight = nx === 0 || ny === 0 ? 0.2 : 0.05;
              const nidx =
                ((y + ny + simHeight) % simHeight) * simWidth + ((x + nx + simWidth) % simWidth);

              laplA += weight * gridA[nidx];
              laplB += weight * gridB[nidx];
            }
          }

          laplA -= 0.95 * a;
          laplB -= 0.95 * b;

          const abb = a * b * b;
          const reaction = abb - (feedRate + killRate) * b;

          nextA[idx] = a + dt * (dA * laplA - abb + feedRate * (1 - a));
          nextB[idx] = b + dt * (dB * laplB + reaction);

          nextA[idx] = Math.max(0, Math.min(1, nextA[idx]));
          nextB[idx] = Math.max(0, Math.min(1, nextB[idx]));
        }
      }

      [gridA, nextA] = [nextA, gridA];
      [gridB, nextB] = [nextB, gridB];
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const simX = Math.min(simWidth - 1, Math.floor(x / scale));
        const simY = Math.min(simHeight - 1, Math.floor(y / scale));
        const simIdx = simY * simWidth + simX;

        const a = gridA[simIdx];
        const b = gridB[simIdx];

        const index = (y * width + x) * 4;

        const val = Math.round(255 * (1 - b));

        data[index] = val;
        data[index + 1] = val;
        data[index + 2] = val;
      }
    }
  };
};

// Add new effect function for Pencil Sketch
const createPencilSketchEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const strength = settings.strength || 1.0;

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        continue;
      }

      const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          const neighborIndex = ((y + ky) * width + (x + kx)) * 4;
          const pixelValue = tempData[neighborIndex];

          gx += pixelValue * kernelX[kernelIndex];
          gy += pixelValue * kernelY[kernelIndex];
        }
      }

      const magnitude = 255 - Math.sqrt(gx * gx + gy * gy);
      const edgeValue = Math.min(255, Math.max(0, magnitude * strength));

      data[i] = data[i + 1] = data[i + 2] = edgeValue;
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

    const dotSize = Math.floor(2 + ((dotSizeInput - 1) / 9) * 18); // 2 to 20
    const spacing = Math.floor(4 + ((spacingInput - 1) / 14) * 26); // 4 to 30
    const angle = (settings.angle || 45) * (Math.PI / 180);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Cream paper background instead of pure white
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Store original data for color sampling
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

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
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        const radius = (1 - brightness) * dotSize;

        if (radius > 0.8) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
          // Ink color - very dark blue-black for newspaper look
          ctx.fillStyle = '#0a0a12';
          ctx.fill();
        }
      }
    }

    const halftoneData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = halftoneData[i];
      data[i + 1] = halftoneData[i + 1];
      data[i + 2] = halftoneData[i + 2];
      data[i + 3] = halftoneData[i + 3];
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
    const strength = settings.strength || 0.5;
    const radius = Math.round(settings.radius || 10);

    const originalData = new Uint8ClampedArray(data.length);
    originalData.set(data);

    const blurData = new Uint8ClampedArray(data.length);
    blurData.set(data);

    const kernelSize = radius * 2 + 1;
    const kernelArea = kernelSize * kernelSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0,
          sumG = 0,
          sumB = 0;
        let count = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const index = (py * width + px) * 4;

            sumR += blurData[index];
            sumG += blurData[index + 1];
            sumB += blurData[index + 2];
            count++;
          }
        }

        const pixelIndex = (y * width + x) * 4;
        data[pixelIndex] = sumR / count;
        data[pixelIndex + 1] = sumG / count;
        data[pixelIndex + 2] = sumB / count;
      }
    }

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      data[i] = Math.min(255, originalData[i] + data[i] * strength);
      data[i + 1] = Math.min(255, originalData[i + 1] + data[i + 1] * strength);
      data[i + 2] = Math.min(255, originalData[i + 2] + data[i + 2] * strength);
      data[i + 3] = originalData[i + 3];
    }
  };
};

// Add Kuwahara filter implementation
// Adapted from https://github.com/ogus/kuwahara
const createKuwaharaEffect = (settings: Record<string, number>) => {
  const radius = Math.round(settings.radius || 5); // Radius for the filter kernel

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
        outputData[index] = Math.max(0, Math.min(255, outputData[index] + noise));
        outputData[index + 1] = Math.max(0, Math.min(255, outputData[index + 1] + noise));
        outputData[index + 2] = Math.max(0, Math.min(255, outputData[index + 2] + noise));
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
const createFlowFieldEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // const scale = settings.scale ?? 0.05; // Noise scale - not used in random version
    const strength = settings.strength ?? 5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Read source pixels from tempData

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const destIndex = (y * width + x) * 4;

        // Simplified random displacement
        const angle = Math.random() * Math.PI * 2;
        const displaceX = Math.round(Math.cos(angle) * strength);
        const displaceY = Math.round(Math.sin(angle) * strength);

        const sourceX = Math.min(width - 1, Math.max(0, x + displaceX));
        const sourceY = Math.min(height - 1, Math.max(0, y + displaceY));
        const sourceIndex = (sourceY * width + sourceX) * 4;

        // Write to destination pixel (data) from source pixel (tempData)
        data[destIndex] = tempData[sourceIndex];
        data[destIndex + 1] = tempData[sourceIndex + 1];
        data[destIndex + 2] = tempData[sourceIndex + 2];
        data[destIndex + 3] = tempData[sourceIndex + 3];
      }
    }
  };
};

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

            data[index + channel] = Math.max(0, Math.min(255, newPixel));

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
              0.299 * tempData[index] +
              0.587 * tempData[index + 1] +
              0.114 * tempData[index + 2];
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
    const radius = settings.radius ?? Math.min(width, height) / 2;
    const strength = settings.strength ?? 3;
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;

    const tempData = new Uint8ClampedArray(data.length);
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
        // Pixels outside radius are untouched (already copied by tempData)
      }
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
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;
    const anglePerSegment = (Math.PI * 2) / segments;

    const tempData = new Uint8ClampedArray(data.length);
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
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  };
};

// Initialize Konva when in browser environment
if (typeof window !== 'undefined') {
  console.log('Browser environment detected, initializing Konva');
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
// Define all available effects with their settings
export const effectsConfig: Record<string, EffectConfig> = {
  // Generative overlays for Particles orchestrator
  generativeStars: {
    label: 'Stars',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 1, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  generativeBubbles: {
    label: 'Bubbles',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 1.5, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  generativeNetwork: {
    label: 'Network',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 1, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  generativeSnow: {
    label: 'Snow',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 2, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  generativeConfetti: {
    label: 'Confetti',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 3, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  generativeFireflies: {
    label: 'Fireflies',
    category: 'Generative Overlay',
    settings: [
      { id: 'opacity', label: 'Opacity', min: 0, max: 1, defaultValue: 0.6, step: 0.05 },
      { id: 'particleCount', label: 'Particles', min: 10, max: 100, defaultValue: 50, step: 5 },
      { id: 'speed', label: 'Speed', min: 0.5, max: 3, defaultValue: 1, step: 0.1 },
      {
        id: 'color',
        label: 'Color',
        min: 0x000000,
        max: 0xffffff,
        defaultValue: 0xffffff,
        step: 1,
      },
      { id: 'interactive', label: 'Interactive', min: 0, max: 1, defaultValue: 1, step: 1 },
    ],
  },
  // Basic Adjustments
  brightness: {
    label: 'Brightness',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Amount',
        min: -1,
        max: 1,
        defaultValue: 0,
        step: 0.01,
      },
    ],
  },
  contrast: {
    label: 'Contrast',
    category: 'Adjust',
    settings: [
      {
        id: 'value',
        label: 'Amount',
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
        label: 'Amount',
        min: -10,
        max: 10,
        defaultValue: 0,
        step: 0.1,
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

  // Filters
  grayscale: {
    label: 'Grayscale',
    category: 'Filters',
  },
  sepia: {
    label: 'Sepia',
    category: 'Filters',
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

  // Blur & Focus
  blur: {
    label: 'Blur',
    category: 'Blur & Focus',
    settings: [
      {
        id: 'radius',
        label: 'Radius',
        min: 0,
        max: 20,
        defaultValue: 5,
        step: 1,
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
        max: 5,
        defaultValue: 0.5,
        step: 0.1,
      },
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
        max: 32,
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
        max: 1,
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
        max: 8,
        defaultValue: 4,
        step: 1,
      },
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
  halftone: {
    label: 'Halftone',
    category: 'Artistic',
    settings: [
      { id: 'dotSize', label: 'Dot Size', min: 1, max: 10, defaultValue: 3, step: 1 },
      { id: 'spacing', label: 'Spacing', min: 1, max: 10, defaultValue: 4, step: 1 },
      { id: 'angle', label: 'Angle', min: 0, max: 180, defaultValue: 45, step: 5 },
    ],
  },
  bloom: {
    label: 'Bloom',
    category: 'Blur & Focus',
    settings: [
      { id: 'strength', label: 'Strength', min: 0, max: 2, defaultValue: 0.5, step: 0.1 },
      { id: 'radius', label: 'Radius', min: 0, max: 20, defaultValue: 10, step: 1 },
    ],
  },
  oilPainting: {
    label: 'Oil Painting',
    category: 'Artistic',
    settings: [
      { id: 'radius', label: 'Brush Size', min: 1, max: 10, defaultValue: 4, step: 1 },
      { id: 'intensity', label: 'Intensity', min: 0.1, max: 2.0, defaultValue: 1.0, step: 0.1 },
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
    category: 'Generative',
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
  'reaction-diffusion': {
    label: 'Reaction-Diffusion',
    category: 'Mathematical',
    settings: [
      {
        id: 'feedRate',
        label: 'Feed Rate',
        min: 0.01,
        max: 0.1,
        defaultValue: 0.055,
        step: 0.001,
      },
      {
        id: 'killRate',
        label: 'Kill Rate',
        min: 0.04,
        max: 0.08,
        defaultValue: 0.062,
        step: 0.001,
      },
      {
        id: 'diffusionA',
        label: 'Diffusion A',
        min: 0.5,
        max: 1.5,
        defaultValue: 1.0,
        step: 0.1,
      },
      {
        id: 'diffusionB',
        label: 'Diffusion B',
        min: 0.1,
        max: 1.0,
        defaultValue: 0.5,
        step: 0.1,
      },
      {
        id: 'iterations',
        label: 'Iterations',
        min: 10,
        max: 200,
        defaultValue: 100,
        step: 10,
      },
      {
        id: 'pattern',
        label: 'Pattern (0=Random, 1=Center, 2=Stripes, 3=Spots)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'colorScheme',
        label: 'Colors (0=Organic, 1=Fire, 2=Zebra, 3=Psychedelic)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'opacity',
        label: 'Opacity',
        min: 0,
        max: 1,
        defaultValue: 0.8,
        step: 0.1,
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
  flowField: {
    label: 'Flow Field',
    category: 'Mathematical',
    settings: [
      {
        id: 'scale',
        label: 'Field Scale',
        min: 0.001,
        max: 0.05,
        defaultValue: 0.01,
        step: 0.001,
      },
      {
        id: 'strength',
        label: 'Flow Strength',
        min: 1,
        max: 30,
        defaultValue: 10,
        step: 1,
      },
      {
        id: 'particles',
        label: 'Particle Count',
        min: 100,
        max: 5000,
        defaultValue: 1000,
        step: 100,
      },
      {
        id: 'type',
        label: 'Field Type (0=Swirl, 1=Turbulence, 2=Wave, 3=Radial)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'blend',
        label: 'Effect Blend',
        min: 0,
        max: 1,
        defaultValue: 0.7,
        step: 0.1,
      },
      {
        id: 'seed',
        label: 'Random Seed',
        min: 0,
        max: 100,
        defaultValue: 42,
        step: 1,
      },
    ],
  },
  vectorField: {
    label: 'Vector Field',
    category: 'Mathematical',
    settings: [
      {
        id: 'scale',
        label: 'Field Scale',
        min: 0.001,
        max: 0.1,
        defaultValue: 0.02,
        step: 0.001,
      },
      {
        id: 'spacing',
        label: 'Vector Spacing',
        min: 10,
        max: 50,
        defaultValue: 20,
        step: 2,
      },
      {
        id: 'length',
        label: 'Vector Length',
        min: 5,
        max: 30,
        defaultValue: 15,
        step: 1,
      },
      {
        id: 'thickness',
        label: 'Vector Thickness',
        min: 1,
        max: 5,
        defaultValue: 2,
        step: 0.5,
      },
      {
        id: 'colorMode',
        label: 'Color Mode (0=Direction, 1=Magnitude, 2=Original)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
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
    settings: [
      { id: 'scale', label: 'Cell Size', min: 1, max: 10, defaultValue: 3, step: 1 },
    ],
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

  // 5. Swirl Distortion
  swirl: {
    label: 'Swirl',
    category: 'Distortion',
    settings: [
      { id: 'radius', label: 'Radius', min: 10, max: 500, defaultValue: 150, step: 10 },
      { id: 'strength', label: 'Strength', min: -10, max: 10, defaultValue: 3, step: 0.5 },
      { id: 'centerX', label: 'Center X (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      { id: 'centerY', label: 'Center Y (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
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
  // 11. Voronoi Diagram Pattern
  voronoi: {
    label: 'Voronoi Pattern',
    category: 'Generative',
    settings: [
      {
        id: 'numPoints',
        label: 'Number of Points',
        min: 10,
        max: 500,
        defaultValue: 100,
        step: 10,
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

  // 12. Kaleidoscope Effect
  kaleidoscope: {
    label: 'Kaleidoscope',
    category: 'Distortion',
    settings: [
      { id: 'segments', label: 'Segments', min: 2, max: 20, defaultValue: 6, step: 1 },
      { id: 'centerX', label: 'Center X (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
      { id: 'centerY', label: 'Center Y (0-1)', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
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
        max: 0.1,
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

  // Mathematical & Fractal Effects
  mandelbrot: {
    label: 'Mandelbrot Fractal',
    category: 'Mathematical',
    settings: [
      { id: 'centerX', label: 'Center X', min: -2, max: 2, defaultValue: 0, step: 0.01 },
      { id: 'centerY', label: 'Center Y', min: -2, max: 2, defaultValue: 0, step: 0.01 },
      { id: 'zoom', label: 'Zoom', min: 0.1, max: 10, defaultValue: 1, step: 0.1 },
      { id: 'iterations', label: 'Iterations', min: 10, max: 500, defaultValue: 100, step: 10 },
      {
        id: 'colorScheme',
        label: 'Color (0=Rainbow, 1=Fire, 2=Ocean, 3=Psychedelic)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'blendMode',
        label: 'Blend (0=Overlay, 1=Multiply, 2=Screen)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      { id: 'opacity', label: 'Opacity', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
    ],
  },
  juliaSet: {
    label: 'Julia Set Fractal',
    category: 'Mathematical',
    settings: [
      { id: 'cReal', label: 'Constant Real', min: -2, max: 2, defaultValue: -0.7, step: 0.01 },
      { id: 'cImag', label: 'Constant Imaginary', min: -2, max: 2, defaultValue: 0.27, step: 0.01 },
      { id: 'zoom', label: 'Zoom', min: 0.1, max: 10, defaultValue: 1, step: 0.1 },
      { id: 'iterations', label: 'Iterations', min: 10, max: 500, defaultValue: 100, step: 10 },
      {
        id: 'colorScheme',
        label: 'Color (0=Rainbow, 1=Fire, 2=Ocean, 3=Psychedelic)',
        min: 0,
        max: 3,
        defaultValue: 3,
        step: 1,
      },
      {
        id: 'blendMode',
        label: 'Blend (0=Overlay, 1=Multiply, 2=Screen)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      { id: 'opacity', label: 'Opacity', min: 0.1, max: 1, defaultValue: 0.5, step: 0.05 },
    ],
  },
  fractalDisplacement: {
    label: 'Fractal Displacement',
    category: 'Mathematical',
    settings: [
      {
        id: 'type',
        label: 'Fractal Type (0=Newton, 1=Burning Ship, 2=Tricorn, 3=Phoenix)',
        min: 0,
        max: 3,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'scale',
        label: 'Fractal Scale',
        min: 0.0001,
        max: 0.01,
        defaultValue: 0.002,
        step: 0.0001,
      },
      {
        id: 'strength',
        label: 'Displacement Strength',
        min: 10,
        max: 200,
        defaultValue: 50,
        step: 5,
      },
      { id: 'iterations', label: 'Iterations', min: 5, max: 50, defaultValue: 20, step: 1 },
      { id: 'centerX', label: 'Center X', min: -2, max: 2, defaultValue: 0, step: 0.01 },
      { id: 'centerY', label: 'Center Y', min: -2, max: 2, defaultValue: 0, step: 0.01 },
      {
        id: 'colorMode',
        label: 'Color Mode (0=Displacement, 1=Blend, 2=Psychedelic)',
        min: 0,
        max: 2,
        defaultValue: 0,
        step: 1,
      },
      {
        id: 'phoenixP',
        label: 'Phoenix P (for type 3)',
        min: -1,
        max: 1,
        defaultValue: 0.5626,
        step: 0.001,
      },
      {
        id: 'phoenixQ',
        label: 'Phoenix Q (for type 3)',
        min: -1,
        max: 1,
        defaultValue: -0.5,
        step: 0.001,
      },
    ],
  },
  psychedelicKaleidoscope: {
    label: 'Psychedelic Kaleidoscope',
    category: 'Mathematical',
    settings: [
      { id: 'segments', label: 'Segments', min: 3, max: 16, defaultValue: 6, step: 1 },
      { id: 'twist', label: 'Twist Amount', min: 0, max: 5, defaultValue: 1, step: 0.1 },
      { id: 'zoom', label: 'Zoom', min: 0.5, max: 3, defaultValue: 1.5, step: 0.1 },
      { id: 'time', label: 'Animation Time', min: 0, max: 10, defaultValue: 0, step: 0.1 },
      { id: 'colorShift', label: 'Color Shift', min: 0, max: 2, defaultValue: 0.5, step: 0.1 },
    ],
  },
  fractalMirror: {
    label: 'Fractal Mirror',
    category: 'Mathematical',
    settings: [
      { id: 'divisions', label: 'Mirror Divisions', min: 2, max: 8, defaultValue: 4, step: 1 },
      { id: 'offset', label: 'Pattern Offset', min: 0.01, max: 0.5, defaultValue: 0.1, step: 0.01 },
      { id: 'recursion', label: 'Recursion Levels', min: 1, max: 5, defaultValue: 3, step: 1 },
      { id: 'blend', label: 'Blend Amount', min: 0, max: 1, defaultValue: 0.5, step: 0.1 },
    ],
  },

  // Note: Generative overlay effects have been removed due to performance issues
  // They caused browser freezing and poor user experience on personal computers

  // 3D Effects - REMOVED due to poor user experience and lack of practical value

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

    // Set background in outputData
    const bgColor = [5, 10, 5, 255]; // Dark green background
    for (let i = 0; i < outputData.length; i += 4) {
      outputData[i] = bgColor[0];
      outputData[i + 1] = bgColor[1];
      outputData[i + 2] = bgColor[2];
      outputData[i + 3] = bgColor[3];
    }

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

    // Debug logging
    console.log('Chromatic glitch effect applied with settings:', {
      amount,
      frequency,
      width,
      height,
    });

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
    const radius = Math.max(1, settings.radius ?? 8);
    const strength = settings.strength ?? 0.6;
    const bias = settings.bias ?? 0.8;

    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const brightness = (temp[index] + temp[index + 1] + temp[index + 2]) / 3;

        if (brightness > bias * 255) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > radius) continue;

              const targetX = x + dx;
              const targetY = y + dy;

              if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

              const targetIndex = (targetY * width + targetX) * 4;
              const falloff = (1 - distance / radius) * strength;

              data[targetIndex] = Math.min(255, data[targetIndex] + temp[index] * falloff);
              data[targetIndex + 1] = Math.min(
                255,
                data[targetIndex + 1] + temp[index + 1] * falloff
              );
              data[targetIndex + 2] = Math.min(
                255,
                data[targetIndex + 2] + temp[index + 2] * falloff
              );
            }
          }
        }
      }
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

        data[etchedIndex] =
          data[etchedIndex + 1] =
          data[etchedIndex + 2] =
            Math.max(0, Math.min(255, etched));
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

      data[i] = Math.max(0, Math.min(255, ink + bleedFactor));
      data[i + 1] = Math.max(0, Math.min(255, ink + bleedFactor * softness));
      data[i + 2] = Math.max(0, Math.min(255, ink + bleedFactor * (1 - softness)));
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

        data[dstIndex] =
          data[dstIndex + 1] =
          data[dstIndex + 2] =
            Math.max(0, Math.min(255, tinted));
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

// Reorganized effects categories for better UX
export const effectCategories = {
  Adjust: {
    icon: '',
    description: 'Basic image adjustments',
    effects: ['brightness', 'contrast', 'saturation', 'hue', 'colorTemperature'],
  },
  'Blur & Focus': {
    icon: '',
    description: 'Blur and sharpening effects',
    effects: ['blur', 'sharpen', 'temporalEcho', 'bloom', 'tiltShiftMiniature'],
  },
  Style: {
    icon: '',
    description: 'Artistic transformations',
    effects: [
      'pencilSketch',
      'oilPainting',
      'halftone',
      'crosshatch',
      'dotScreen',
      'stippling',
      'geometric',
      'cellular',
      'reaction-diffusion',
      'flowField',
      'crystallize',
      'paperCutArt',
      'retroDithering',
      'topographicContours',
      'weavePattern',
      'neonGlowEdges',
      'iridescentSheen',
      'chromaticGrain',
      'halationGlow',
      'etchedLines',
      'inkWash',
      'retroRaster',
      'crystalFacet',
      'thermalPalette',
      'paperRelief',
      'inkOutlinePop',
    ],
  },
  Color: {
    icon: '',
    description: 'Color grading and effects',
    effects: [
      'grayscale',
      'sepia',
      'invert',
      'duotone',
      'holographicInterference',
      'selectiveColor',
      'colorQuantization',
      'heatmap',
    ],
  },
  Distort: {
    icon: '',
    description: 'Warping and distortion',
    effects: [
      'pixelate',
      'swirl',
      'kaleidoscope',
      'kaleidoscopeFracture',
      'fisheyeWarp',
      'pixelExplosion',
      'chromaticGlitch',
      'databending',
      'dispersionShatter',
    ],
  },
  Simulate: {
    icon: '',
    description: 'Real-world simulations',
    effects: [
      'liquidMetal',
      'neuralDream',
      'magneticField',
      'inkBleed',
      'vignette',
      'chromaticAberration',
      'scanLines',
      'scratchedFilm',
      'anaglyph',
      'bioluminescence',
    ],
  },
  Overlay: {
    icon: '',
    description: 'Overlays and filters',
    effects: [
      'noise',
      'threshold',
      'posterize',
      'oldPhoto',
      'lensFlare',
      'edgeDetection',
      'fractalNoise',
      'circuitBoard',
    ],
  },
  Mathematical: {
    icon: '',
    description: 'Mathematical and fractal patterns',
    effects: ['mandelbrot', 'juliaSet', 'voronoi'],
  },
  'Generative Overlay': {
    icon: '✨',
    description: 'Animated particle overlays',
    effects: [
      'generativeStars',
      'generativeBubbles',
      'generativeNetwork',
      'generativeSnow',
      'generativeConfetti',
      'generativeFireflies',
    ],
  },
  // 3D Effects category intentionally omitted in UI categories for now
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

    // First pass: assign layers
    const layerMap = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const layerIdx = Math.min(layers - 1, Math.floor((1 - brightness) * layers));
      layerMap[i / 4] = layerIdx;
    }

    // Second pass: apply colors and detect edges for shadow effect
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
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
              if (neighborLayer < currentLayer) {
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
        tempData[i + 3] = 255;
      }
    }

    // Add paper fiber texture
    for (let i = 0; i < tempData.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12;
      tempData[i] = Math.max(0, Math.min(255, tempData[i] + noise));
      tempData[i + 1] = Math.max(0, Math.min(255, tempData[i + 1] + noise));
      tempData[i + 2] = Math.max(0, Math.min(255, tempData[i + 2] + noise));
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

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      const distance = Math.abs(y - focalPoint);
      const blurAmount = Math.max(0, (distance - focalRange) / height) * blurStrength;

      if (blurAmount > 0) {
        const radius = Math.ceil(blurAmount);

        for (let x = 0; x < width; x++) {
          let r = 0,
            g = 0,
            b = 0,
            count = 0;

          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const ny = Math.max(0, Math.min(height - 1, y + dy));
              const nx = Math.max(0, Math.min(width - 1, x + dx));
              const idx = (ny * width + nx) * 4;

              r += tempData[idx];
              g += tempData[idx + 1];
              b += tempData[idx + 2];
              count++;
            }
          }

          const index = (y * width + x) * 4;
          data[index] = r / count;
          data[index + 1] = g / count;
          data[index + 2] = b / count;
        }
      }
    }

    // Add slight saturation boost for toy-like appearance
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;

      data[i] = avg + (r - avg) * 1.3;
      data[i + 1] = avg + (g - avg) * 1.3;
      data[i + 2] = avg + (b - avg) * 1.3;
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

    // Edge detection with Sobel
    const edges = new Uint8ClampedArray(width * height);
    const edgeHue = new Float32Array(width * height); // Store hue from original color
    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

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
            const val = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += val * kernelX[kernelIdx];
            gy += val * kernelY[kernelIdx];
            avgR += data[idx];
            avgG += data[idx + 1];
            avgB += data[idx + 2];
          }
        }

        const edgeVal = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        edges[y * width + x] = edgeVal;

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
        edgeHue[y * width + x] = h;
      }
    }

    // Create glow accumulator
    const glowAccum = new Float32Array(width * height * 3);
    const step = glowRadius > 25 ? 2 : 1;

    // Apply glow from edges
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const edgeStrength = edges[y * width + x];

        if (edgeStrength > 20) {
          // Neon color based on original image hue + some variation
          const baseHue = edgeHue[y * width + x];
          const hue = (baseHue + (x * 0.001 + y * 0.001)) % 1;
          const { r, g, b } = hslToRgb(hue, 1, 0.55);

          const normalizedEdge = edgeStrength / 255;

          for (let dy = -glowRadius; dy <= glowRadius; dy += step) {
            for (let dx = -glowRadius; dx <= glowRadius; dx += step) {
              const ny = y + dy;
              const nx = x + dx;

              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= glowRadius) {
                  // Gaussian falloff for softer glow
                  const sigma = glowRadius * 0.35;
                  const falloff = Math.exp(-(dist * dist) / (2 * sigma * sigma));
                  const intensity = falloff * glowIntensity * normalizedEdge * 2.5;

                  const accIdx = (ny * width + nx) * 3;
                  glowAccum[accIdx] += r * intensity;
                  glowAccum[accIdx + 1] += g * intensity;
                  glowAccum[accIdx + 2] += b * intensity;
                }
              }
            }
          }
        }
      }
    }

    // Darken background and apply accumulated glow
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const accIdx = (y * width + x) * 3;

        // Dark background with slight original image tint
        const bgFactor = 0.08;
        data[idx] = data[idx] * bgFactor + glowAccum[accIdx] * 255;
        data[idx + 1] = data[idx + 1] * bgFactor + glowAccum[accIdx + 1] * 255;
        data[idx + 2] = data[idx + 2] * bgFactor + glowAccum[accIdx + 2] * 255;

        // Clamp
        data[idx] = Math.min(255, data[idx]);
        data[idx + 1] = Math.min(255, data[idx + 1]);
        data[idx + 2] = Math.min(255, data[idx + 2]);
      }
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
        tempData[i] = 0;
        tempData[i + 1] = 0;
        tempData[i + 2] = 0;
        tempData[i + 3] = 255;
      } else {
        const color = 255 - level * 200;
        tempData[i] = color;
        tempData[i + 1] = color - 20;
        tempData[i + 2] = color - 40;
        tempData[i + 3] = 255;
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

        data[idx] = Math.min(255, Math.max(0, (r * saturation + gray * (1 - saturation)) * brightness));
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
        data[idx] = Math.max(0, Math.min(255, data[idx] + noise));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + noise));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + noise));
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

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // First pass: identify bright/saturated regions that will glow
    const glowMap = new Float32Array(width * height);
    const colorMap: Array<{ r: number; g: number; b: number }> = new Array(width * height);

    // Brightness threshold scales with intensity - lower intensity = more selective glow
    const brightnessThreshold = 0.3 + (1 - glowIntensity) * 0.4; // 0.3 to 0.7

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = tempData[idx];
        const g = tempData[idx + 1];
        const b = tempData[idx + 2];
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        // Calculate color saturation - saturated colors also glow
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;

        // Areas glow based on brightness OR saturation
        const glowFactor =
          brightness > brightnessThreshold
            ? (brightness - brightnessThreshold) / (1 - brightnessThreshold)
            : 0;
        const satGlow = saturation > 0.3 ? saturation * 0.5 : 0;

        const combinedGlow = Math.min(1, glowFactor + satGlow);
        glowMap[y * width + x] = combinedGlow;

        // Store original color for the glow tint
        colorMap[y * width + x] = { r, g, b };
      }
    }

    // Darkness factor - more spread = darker background for more contrast
    const darknessFactor = 0.05 + (1 - glowSpread) * 0.15; // 0.05 to 0.2

    // Create dark background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = tempData[i] * darknessFactor;
      data[i + 1] = tempData[i + 1] * darknessFactor;
      data[i + 2] = tempData[i + 2] * (darknessFactor + 0.03); // Slight blue tint
    }

    // Map spread 0-1 to actual radius 5-60 pixels
    const glowRadius = Math.ceil(5 + glowSpread * 55);
    // Use step size for performance on large radii
    const step = glowRadius > 30 ? 2 : 1;

    // Create a glow accumulator for additive blending
    const glowAccum = new Float32Array(width * height * 3);

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const glowValue = glowMap[y * width + x];

        if (glowValue > 0.1) {
          const srcColor = colorMap[y * width + x];

          // Create bioluminescent color shift - push towards cyan/blue-green
          const glowR = srcColor.r * 0.3 + 20;
          const glowG = srcColor.g * 0.8 + srcColor.b * 0.3 + 100;
          const glowB = srcColor.b * 0.7 + srcColor.g * 0.4 + 80;

          for (let dy = -glowRadius; dy <= glowRadius; dy += step) {
            for (let dx = -glowRadius; dx <= glowRadius; dx += step) {
              const ny = y + dy;
              const nx = x + dx;

              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= glowRadius) {
                  // Gaussian falloff
                  const sigma = glowRadius * 0.4;
                  const falloff = Math.exp(-(dist * dist) / (2 * sigma * sigma));
                  const glowAmount = glowValue * falloff * glowIntensity * 2;

                  const accIdx = (ny * width + nx) * 3;
                  glowAccum[accIdx] += glowR * glowAmount;
                  glowAccum[accIdx + 1] += glowG * glowAmount;
                  glowAccum[accIdx + 2] += glowB * glowAmount;
                }
              }
            }
          }
        }
      }
    }

    // Apply accumulated glow
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const accIdx = (y * width + x) * 3;

        data[idx] = Math.min(255, data[idx] + glowAccum[accIdx]);
        data[idx + 1] = Math.min(255, data[idx + 1] + glowAccum[accIdx + 1]);
        data[idx + 2] = Math.min(255, data[idx + 2] + glowAccum[accIdx + 2]);
      }
    }

    // Add subtle pulsing particles effect at high intensity
    if (glowIntensity > 0.6) {
      const particleCount = Math.floor((glowIntensity - 0.6) * 500);
      for (let i = 0; i < particleCount; i++) {
        const px = Math.floor(Math.random() * width);
        const py = Math.floor(Math.random() * height);
        const glowVal = glowMap[py * width + px];

        if (glowVal > 0.2) {
          const idx = (py * width + px) * 4;
          const sparkle = 50 + Math.random() * 100;
          data[idx] = Math.min(255, data[idx] + sparkle * 0.3);
          data[idx + 1] = Math.min(255, data[idx + 1] + sparkle);
          data[idx + 2] = Math.min(255, data[idx + 2] + sparkle * 0.8);
        }
      }
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

// Missing Effect Implementations

// Fractal Displacement Effect
const createFractalDisplacementEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const type = Math.floor(settings.type ?? 0);
    const scale = settings.scale ?? 0.002;
    const strength = settings.strength ?? 50;
    const iterations = Math.floor(settings.iterations ?? 20);
    const centerX = settings.centerX ?? 0;
    const centerY = settings.centerY ?? 0;
    const colorMode = Math.floor(settings.colorMode ?? 0);

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Map pixel coordinates to fractal space
        const fx = (x - width / 2) * scale + centerX;
        const fy = (y - height / 2) * scale + centerY;

        // Calculate fractal displacement
        let displacement = 0;

        switch (type) {
          case 0: // Newton fractal
            displacement = calculateNewtonFractal(fx, fy, iterations);
            break;
          case 1: // Burning Ship
            displacement = calculateBurningShip(fx, fy, iterations);
            break;
          case 2: // Tricorn
            displacement = calculateTricorn(fx, fy, iterations);
            break;
          case 3: // Phoenix
            displacement = calculatePhoenix(
              fx,
              fy,
              iterations,
              settings.phoenixP ?? 0.5626,
              settings.phoenixQ ?? -0.5
            );
            break;
        }

        // Apply displacement
        const displacementX = Math.floor(
          displacement * strength * Math.cos(displacement * Math.PI * 2)
        );
        const displacementY = Math.floor(
          displacement * strength * Math.sin(displacement * Math.PI * 2)
        );

        const sourceX = Math.max(0, Math.min(width - 1, x + displacementX));
        const sourceY = Math.max(0, Math.min(height - 1, y + displacementY));

        const targetIndex = (y * width + x) * 4;
        const sourceIndex = (sourceY * width + sourceX) * 4;

        if (colorMode === 2) {
          // Psychedelic mode
          const hue = (displacement * 360) % 360;
          const rgb = hslToRgb(hue / 360, 1, 0.5);
          data[targetIndex] = Math.floor(rgb.r * 255);
          data[targetIndex + 1] = Math.floor(rgb.g * 255);
          data[targetIndex + 2] = Math.floor(rgb.b * 255);
        } else {
          data[targetIndex] = tempData[sourceIndex];
          data[targetIndex + 1] = tempData[sourceIndex + 1];
          data[targetIndex + 2] = tempData[sourceIndex + 2];
        }
      }
    }
  };

  function calculateNewtonFractal(x: number, y: number, maxIter: number): number {
    let zx = x,
      zy = y;
    for (let i = 0; i < maxIter; i++) {
      const zx2 = zx * zx,
        zy2 = zy * zy;
      const zx3 = zx2 * zx,
        zy3 = zy2 * zy;
      const denominator = 9 * (zx2 + zy2) * (zx2 + zy2);
      if (denominator < 1e-10) break;

      const newZx = (2 * zx3 - 6 * zx * zy2 + 3) / (3 * denominator);
      const newZy = (6 * zx2 * zy - 2 * zy3) / (3 * denominator);
      zx = newZx;
      zy = newZy;
    }
    return Math.sqrt(zx * zx + zy * zy);
  }

  function calculateBurningShip(x: number, y: number, maxIter: number): number {
    let zx = 0,
      zy = 0;
    for (let i = 0; i < maxIter; i++) {
      const zx2 = zx * zx,
        zy2 = zy * zy;
      if (zx2 + zy2 > 4) return i / maxIter;
      const newZx = zx2 - zy2 + x;
      const newZy = 2 * Math.abs(zx * zy) + y;
      zx = newZx;
      zy = newZy;
    }
    return 1;
  }

  function calculateTricorn(x: number, y: number, maxIter: number): number {
    let zx = 0,
      zy = 0;
    for (let i = 0; i < maxIter; i++) {
      const zx2 = zx * zx,
        zy2 = zy * zy;
      if (zx2 + zy2 > 4) return i / maxIter;
      const newZx = zx2 - zy2 + x;
      const newZy = -2 * zx * zy + y;
      zx = newZx;
      zy = newZy;
    }
    return 1;
  }

  function calculatePhoenix(x: number, y: number, maxIter: number, p: number, q: number): number {
    let zx = 0,
      zy = 0,
      px = 0,
      py = 0;
    for (let i = 0; i < maxIter; i++) {
      const zx2 = zx * zx,
        zy2 = zy * zy;
      if (zx2 + zy2 > 4) return i / maxIter;
      const newZx = zx2 - zy2 + p * px + x;
      const newZy = 2 * zx * zy + q * py + y;
      px = zx;
      py = zy;
      zx = newZx;
      zy = newZy;
    }
    return 1;
  }
};

// Psychedelic Kaleidoscope Effect
const createPsychedelicKaleidoscopeEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const segments = Math.max(3, Math.floor(settings.segments ?? 6));
    const twist = settings.twist ?? 1;
    const zoom = settings.zoom ?? 1.5;
    const time = settings.time ?? 0;
    const colorShift = settings.colorShift ?? 0.5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const centerX = width / 2;
    const centerY = height / 2;
    const angleStep = (Math.PI * 2) / segments;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);

        // Apply twist based on distance and time
        angle += twist * distance * 0.01 + time;

        // Map to kaleidoscope segment
        angle = angle % angleStep;
        if (Math.floor((Math.atan2(dy, dx) + Math.PI) / angleStep) % 2 === 1) {
          angle = angleStep - angle;
        }

        // Apply zoom
        const scaledDistance = distance / zoom;

        // Calculate source coordinates
        const sourceX = Math.floor(centerX + Math.cos(angle) * scaledDistance);
        const sourceY = Math.floor(centerY + Math.sin(angle) * scaledDistance);

        const targetIndex = (y * width + x) * 4;

        if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) {
          const sourceIndex = (sourceY * width + sourceX) * 4;

          // Apply psychedelic color shift
          const hueShift = (colorShift * distance * 0.01 + time) % 1;
          const rgb = shiftHue(
            tempData[sourceIndex],
            tempData[sourceIndex + 1],
            tempData[sourceIndex + 2],
            hueShift
          );

          data[targetIndex] = rgb.r;
          data[targetIndex + 1] = rgb.g;
          data[targetIndex + 2] = rgb.b;
        } else {
          // Fill with psychedelic color based on position
          const hue = ((angle / angleStep + time) % 1) * 360;
          const rgb = hslToRgb(hue / 360, 1, 0.5);
          data[targetIndex] = Math.floor(rgb.r * 255);
          data[targetIndex + 1] = Math.floor(rgb.g * 255);
          data[targetIndex + 2] = Math.floor(rgb.b * 255);
        }
      }
    }
  };

  function shiftHue(r: number, g: number, b: number, shift: number) {
    // Convert RGB to HSL
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    // Shift hue
    h = (h + shift) % 1;

    // Convert back to RGB
    const rgb = hslToRgb(h, s, l);
    return {
      r: Math.floor(rgb.r * 255),
      g: Math.floor(rgb.g * 255),
      b: Math.floor(rgb.b * 255),
    };
  }
};

// Fractal Mirror Effect
const createFractalMirrorEffect = (settings: Record<string, number>) => {
  return function (imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const divisions = Math.max(2, Math.floor(settings.divisions ?? 4));
    const offset = settings.offset ?? 0.1;
    const recursion = Math.max(1, Math.floor(settings.recursion ?? 3));
    const blend = settings.blend ?? 0.5;

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Apply recursive mirroring
    for (let level = 0; level < recursion; level++) {
      const scale = Math.pow(0.5, level);
      const levelOffset = offset * level;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const centerX = width / 2;
          const centerY = height / 2;

          const dx = (x - centerX) * scale;
          const dy = (y - centerY) * scale;

          // Apply fractal mirroring based on divisions
          const angle = Math.atan2(dy, dx);
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Map to mirror segment
          const segmentAngle = (Math.PI * 2) / divisions;
          let mappedAngle = ((angle + Math.PI) % segmentAngle) - Math.PI / 2;

          // Add fractal offset
          mappedAngle += levelOffset * Math.sin(distance * 0.1 + level);

          // Calculate mirrored coordinates
          const mirroredX = Math.floor(centerX + Math.cos(mappedAngle) * distance);
          const mirroredY = Math.floor(centerY + Math.sin(mappedAngle) * distance);

          const targetIndex = (y * width + x) * 4;

          if (mirroredX >= 0 && mirroredX < width && mirroredY >= 0 && mirroredY < height) {
            const sourceIndex = (mirroredY * width + mirroredX) * 4;

            // Blend with existing pixel
            const blendFactor = blend / recursion;
            data[targetIndex] = Math.floor(
              data[targetIndex] * (1 - blendFactor) + tempData[sourceIndex] * blendFactor
            );
            data[targetIndex + 1] = Math.floor(
              data[targetIndex + 1] * (1 - blendFactor) + tempData[sourceIndex + 1] * blendFactor
            );
            data[targetIndex + 2] = Math.floor(
              data[targetIndex + 2] * (1 - blendFactor) + tempData[sourceIndex + 2] * blendFactor
            );
          }
        }
      }

      // Update temp data for next iteration
      tempData.set(data);
    }
  };
};
