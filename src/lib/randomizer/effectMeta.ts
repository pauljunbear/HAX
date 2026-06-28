/**
 * Effect metadata — the taste layer for the Smart Randomizer.
 *
 * A curated subset of the real effect catalog, each tagged with a render slot,
 * a base weight, colour-awareness, cross-slot exclusions, and a `settings(t)`
 * map from a single 0..1 intensity to that effect's REAL settings (within the
 * ranges in effectsConfig). Moods are named probability distributions over
 * these effects. This is where the curation lives — the composer is generic.
 */
import { type Palette, rgbToInt } from './palette';

export type Slot = 'warp' | 'tone' | 'grade' | 'stylize' | 'texture' | 'glow' | 'glitch' | 'frame';
export const SLOT_ORDER: Slot[] = [
  'warp',
  'tone',
  'grade',
  'stylize',
  'texture',
  'glow',
  'glitch',
  'frame',
];
export const SLOT_LABEL: Record<Slot, string> = {
  warp: 'warp',
  tone: 'tone',
  grade: 'color',
  stylize: 'stylize',
  texture: 'texture',
  glow: 'glow',
  glitch: 'glitch',
  frame: 'frame',
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface EffectMeta {
  slot: Slot;
  weight: number;
  colorAware?: boolean;
  excl?: string[];
  settings: (t: number, P: Palette, rng: () => number) => Record<string, number>;
}

export const EFFECT_META: Record<string, EffectMeta> = {
  /* ---- tone ---- */
  brightness: { slot: 'tone', weight: 0.5, settings: t => ({ value: Math.round((t - 0.5) * 36) }) },
  contrast: { slot: 'tone', weight: 0.8, settings: t => ({ value: Math.round(t * 50) }) },
  saturation: {
    slot: 'tone',
    weight: 0.7,
    settings: t => ({ value: Math.round((t - 0.35) * 90) }),
  },
  colorTemperature: {
    slot: 'tone',
    weight: 0.6,
    settings: (t, _P, rng) => ({
      temperature: Math.round((t - 0.5) * 110),
      tint: Math.round((rng() - 0.5) * 18),
    }),
  },
  toneCurve: { slot: 'tone', weight: 0.4, settings: t => ({ amount: r2((t - 0.5) * 1.0) }) },
  // Local-contrast "punch" — a structural mid-frequency boost. Tasteful positive
  // range; protectTones holds skin/sky from going crunchy.
  clarity: {
    slot: 'tone',
    weight: 0.5,
    settings: t => ({
      amount: Math.round(t * 60),
      radius: Math.round(40 + t * 40),
      protectTones: 50,
    }),
  },
  // Per-zone CMY push. Lives in 'tone' (not 'grade') on purpose so it can stack
  // with a 'grade' split-tone for the full teal-orange recipe. Cool shadows,
  // warm highlights — the cinematic default.
  colorBalance: {
    slot: 'tone',
    weight: 0.6,
    settings: t => ({
      shadowCR: -Math.round(t * 30),
      shadowYB: Math.round(t * 30),
      midCR: Math.round(t * 12),
      highCR: Math.round(t * 30),
      highYB: -Math.round(t * 30),
      preserveLuminosity: 1,
    }),
  },

  /* ---- grade (one per stack via slot) ---- */
  duotone: {
    slot: 'grade',
    weight: 0.9,
    colorAware: true,
    settings: (t, P) => ({
      color1: rgbToInt(P.shadow),
      color2: rgbToInt(P.highlight),
      opacity: r2(clamp(0.45 + t * 0.55, 0, 1)),
    }),
  },
  gradientMap: {
    slot: 'grade',
    weight: 0.8,
    colorAware: true,
    settings: (t, P) => ({
      shadowColor: rgbToInt(P.shadow),
      midColor: rgbToInt(P.mid),
      highlightColor: rgbToInt(P.highlight),
      midpoint: 0.5,
      strength: r2(clamp(0.4 + t * 0.6, 0, 1)),
    }),
  },
  cinematicLut: {
    slot: 'grade',
    weight: 0.7,
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 4),
      strength: r2(clamp(0.4 + t * 0.5, 0, 1)),
    }),
  },
  unifiedVintage: {
    slot: 'grade',
    weight: 0.7,
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 6),
      intensity: r2(0.3 + t * 0.5),
      vignette: r2(0.3 * t),
      grain: r2(0.3 * t),
      scratches: 0,
      fade: r2(0.4 * t),
      warmth: 0.5,
      opacity: 1,
    }),
  },
  oldPhoto: {
    slot: 'grade',
    weight: 0.5,
    settings: t => ({ sepia: r2(0.5 + t * 0.4), noise: r2(0.1 * t), vignette: r2(0.4 * t) }),
  },
  // Real documented film emulation. `preset` indexes FILM_STOCKS (28 stocks:
  // kodak-negative, kodak-slide, fuji, cinema, bw — see src/lib/effects.ts).
  // This is the single biggest unlock: film stocks can now appear in Surprise me.
  // It carries its own grain + halation, so it excludes the extra grain effects.
  unifiedFilm: {
    slot: 'grade',
    weight: 0.9,
    excl: ['noise', 'scratchedFilm'],
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 28),
      strength: Math.round(60 + t * 40),
      grain: Math.round(70 + t * 60),
      halation: Math.round(70 + t * 60),
      exposure: 0,
      fade: 0,
      seed: Math.floor(rng() * 9999) + 1,
    }),
  },
  // Hue into shadows + highlights. Teal shadows / warm highlights by default.
  splitTone: {
    slot: 'grade',
    weight: 0.6,
    settings: (t, _P, rng) => ({
      shadowHue: Math.round(195 + rng() * 30),
      shadowSat: Math.round(15 + t * 35),
      highlightHue: Math.round(35 + rng() * 20),
      highlightSat: Math.round(15 + t * 35),
      balance: 0,
    }),
  },
  // Silver-retention "bleach bypass" — crushed, desaturated, high local contrast.
  bleachBypass: {
    slot: 'grade',
    weight: 0.5,
    settings: t => ({
      strength: Math.round(30 + t * 50),
      contrast: Math.round(30 + t * 40),
      saturation: Math.round(50 - t * 40),
    }),
  },
  // Monochrome converter (R-row mix, exposure-neutral). Low base weight so it
  // never surprises a colour mood; the 'mono' mood prefers it heavily for true B&W.
  channelMixer: {
    slot: 'grade',
    weight: 0.3,
    settings: t => {
      const rFromR = Math.round(30 + t * 40);
      const rFromG = Math.round(60 - t * 30);
      return { rFromR, rFromG, rFromB: 100 - rFromR - rFromG, monochrome: 1 };
    },
  },

  /* ---- stylize ---- */
  posterize: {
    slot: 'stylize',
    weight: 0.6,
    settings: t => ({ levels: Math.round(10 - t * 7), opacity: 1 }),
  },
  halftone: {
    slot: 'stylize',
    weight: 0.8,
    settings: (t, _P, rng) => ({
      dotSize: Math.round(2 + t * 8),
      spacing: Math.round(6 + t * 8),
      angle: Math.round(rng() * 180),
      opacity: r2(0.5 + t * 0.5),
    }),
  },
  advancedDithering: {
    slot: 'stylize',
    weight: 0.7,
    settings: (t, _P, rng) => ({
      algorithm: Math.floor(rng() * 6),
      palette: 0,
      threshold: 0.5,
      patternScale: 2,
      contrast: r2(0.8 + t * 0.6),
    }),
  },
  crosshatch: {
    slot: 'stylize',
    weight: 0.5,
    settings: t => ({
      spacing: Math.round(3 + t * 5),
      strength: r2(0.4 + t * 0.5),
      opacity: r2(0.5 + t * 0.5),
    }),
  },
  dotScreen: {
    slot: 'stylize',
    weight: 0.5,
    settings: (t, _P, rng) => ({
      scale: Math.round(3 + t * 8),
      angle: Math.round(rng() * 180),
      opacity: 1,
    }),
  },
  pixelate: {
    slot: 'stylize',
    weight: 0.4,
    settings: t => ({ pixelSize: Math.round(3 + t * 16), opacity: 1 }),
  },
  oilPainting: {
    slot: 'stylize',
    weight: 0.4,
    settings: t => ({
      radius: Math.round(2 + t * 5),
      intensity: r2(0.6 + t * 1.0),
      opacity: 1,
    }),
  },
  watercolor: {
    slot: 'stylize',
    weight: 0.4,
    settings: t => ({
      intensity: r2(0.4 + t * 0.5),
      edges: r2(0.2 + t * 0.4),
      texture: r2(0.15 + t * 0.3),
      opacity: 1,
    }),
  },
  // Print emulation (riso / newsprint / linocut / screen-print / letterpress).
  unifiedPrint: {
    slot: 'stylize',
    weight: 0.7,
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 5),
      intensity: Math.round(50 + t * 40),
      colorCount: Math.round(2 + t * 2),
      dotSize: Math.round(4 + t * 8),
      registration: Math.round(t * 6),
      paperTexture: Math.round(30 + t * 40),
      inkBleed: Math.round(20 + t * 30),
      opacity: 1,
    }),
  },
  toon: {
    slot: 'stylize',
    weight: 0.4,
    settings: t => ({
      smoothness: Math.round(4 + t * 10),
      levels: Math.round(8 - t * 4),
      edgeThreshold: r2(0.15 + t * 0.2),
      edgeStrength: r2(0.6 + t * 0.35),
      opacity: 1,
    }),
  },

  /* ---- texture ---- */
  noise: {
    slot: 'texture',
    weight: 0.6,
    settings: t => ({ value: r2(t * 0.6), opacity: r2(0.5 + t * 0.5) }),
  },
  scanLines: {
    slot: 'texture',
    weight: 0.5,
    settings: t => ({ frequency: Math.round(3 + t * 10), opacity: r2(t * 0.5) }),
  },
  scratchedFilm: {
    slot: 'texture',
    weight: 0.4,
    settings: t => ({ scratchDensity: r2(t * 0.1), dustOpacity: r2(t * 0.2), flicker: 0.02 }),
  },

  /* ---- glow ---- */
  bloom: {
    slot: 'glow',
    weight: 0.7,
    settings: t => ({ strength: Math.round(t * 70), radius: Math.round(10 + t * 20), opacity: 1 }),
  },
  unifiedGlow: {
    slot: 'glow',
    weight: 0.6,
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 5),
      intensity: Math.round(t * 70),
      radius: 20,
      threshold: 50,
      colorShift: 0,
      darkenBg: 0,
      opacity: 1,
    }),
  },
  bioluminescence: {
    slot: 'glow',
    weight: 0.4,
    settings: t => ({ glowIntensity: r2(0.3 + t * 0.6), glowSpread: r2(0.2 + t * 0.5) }),
  },
  // Pro-Mist diffusion — blooms highlights into a soft veil while holding blacks.
  proMist: {
    slot: 'glow',
    weight: 0.6,
    settings: t => ({
      strength: Math.round(20 + t * 50),
      size: Math.round(30 + t * 40),
      blackRetention: 50,
      threshold: Math.round(40 + t * 30),
    }),
  },

  /* ---- glitch ---- */
  rgbShift: {
    slot: 'glitch',
    weight: 0.6,
    settings: t => ({ rOffset: Math.round(t * 12), gOffset: 0, bOffset: -Math.round(t * 12) }),
  },
  chromaticAberration: {
    slot: 'glitch',
    weight: 0.6,
    settings: (t, _P, rng) => ({
      amount: Math.round(t * 14),
      angle: Math.round(rng() * 360),
      opacity: r2(0.5 + t * 0.5),
    }),
  },
  glitchArt: {
    slot: 'glitch',
    weight: 0.5,
    settings: (t, _P, rng) => ({
      blockiness: r2(t * 0.25),
      colorShift: Math.round(t * 12),
      seed: Math.floor(rng() * 1e9),
    }),
  },
  unifiedGlitch: {
    slot: 'glitch',
    weight: 0.5,
    settings: (t, _P, rng) => ({
      preset: Math.floor(rng() * 7),
      intensity: r2(t),
      amount: Math.round(5 + t * 30),
      direction: Math.floor(rng() * 3),
      blockSize: 8,
      randomness: 0.5,
      opacity: r2(0.6 + t * 0.4),
    }),
  },

  /* ---- frame ---- */
  vignette: { slot: 'frame', weight: 0.6, settings: t => ({ amount: r2(t * 0.7), falloff: 0.5 }) },
  // Graduated ND — darkens the top of the frame (skies) with an optional cool tint.
  gradND: {
    slot: 'frame',
    weight: 0.4,
    settings: t => ({
      exposure: -Math.round(20 + t * 50),
      angle: 0,
      position: 50,
      softness: Math.round(40 + t * 40),
      tintHue: 210,
      tintStrength: Math.round(t * 30),
    }),
  },

  /* ---- warp (low odds, wild moods) ---- */
  swirl: {
    slot: 'warp',
    weight: 0.4,
    settings: (t, _P, rng) => ({
      radius: Math.round(30 + t * 60),
      strength: Math.round((rng() - 0.5) * 2 * (5 + t * 12)),
      centerX: 50,
      centerY: 50,
      opacity: 1,
    }),
  },
  kaleidoscope: {
    slot: 'warp',
    weight: 0.3,
    settings: t => ({ segments: Math.round(4 + t * 10), centerX: 50, centerY: 50 }),
  },
  fisheyeWarp: { slot: 'warp', weight: 0.3, settings: t => ({ strength: r2((t - 0.3) * 0.8) }) },
};

export const RANDOMIZER_EFFECT_IDS = Object.keys(EFFECT_META);

export interface Mood {
  name: string;
  hue: [number, number];
  scheme: 'analogous' | 'complementary' | 'triadic';
  mean: number;
  sigma: number;
  prefer: Record<string, number>;
}

export const MOODS: Record<string, Mood> = {
  faded: {
    name: 'Faded Film',
    hue: [28, 46],
    scheme: 'analogous',
    mean: 0.34,
    sigma: 0.12,
    prefer: {
      unifiedVintage: 3,
      noise: 3,
      colorTemperature: 2,
      contrast: 1.5,
      vignette: 2,
      duotone: 1,
      gradientMap: 1.2,
      bloom: 1,
      oldPhoto: 1.5,
    },
  },
  neon: {
    name: 'Neon Night',
    hue: [265, 320],
    scheme: 'complementary',
    mean: 0.5,
    sigma: 0.16,
    prefer: {
      gradientMap: 3,
      unifiedGlow: 3,
      bloom: 2.5,
      contrast: 2,
      saturation: 2,
      chromaticAberration: 1.5,
      vignette: 1.5,
      duotone: 1.5,
    },
  },
  riso: {
    name: 'Risograph',
    hue: [10, 210],
    scheme: 'complementary',
    mean: 0.6,
    sigma: 0.14,
    prefer: {
      duotone: 3,
      halftone: 3,
      posterize: 2.5,
      dotScreen: 2,
      contrast: 1.5,
      noise: 1,
      crosshatch: 1.5,
    },
  },
  dreamy: {
    name: 'Dreamy',
    hue: [300, 350],
    scheme: 'analogous',
    mean: 0.4,
    sigma: 0.12,
    prefer: {
      bloom: 3,
      unifiedGlow: 2.5,
      colorTemperature: 2,
      saturation: 1.2,
      vignette: 1,
      gradientMap: 1.5,
      bioluminescence: 1.5,
    },
  },
  noir: {
    name: 'Noir',
    hue: [210, 240],
    scheme: 'analogous',
    mean: 0.55,
    sigma: 0.14,
    prefer: { contrast: 3, duotone: 2, noise: 2.5, vignette: 3, crosshatch: 1.5, oldPhoto: 1.5 },
  },
  acid: {
    name: 'Acid',
    hue: [80, 160],
    scheme: 'triadic',
    mean: 0.7,
    sigma: 0.18,
    prefer: {
      gradientMap: 3,
      saturation: 3,
      posterize: 2,
      chromaticAberration: 2,
      glitchArt: 2,
      bloom: 1.5,
      swirl: 1,
      kaleidoscope: 1,
    },
  },
  sun: {
    name: 'Sun-bleached',
    hue: [35, 55],
    scheme: 'analogous',
    mean: 0.42,
    sigma: 0.12,
    prefer: {
      unifiedVintage: 2.5,
      colorTemperature: 3,
      noise: 1.5,
      bloom: 1.5,
      saturation: 1.5,
      vignette: 1,
      oldPhoto: 2,
    },
  },
  cyber: {
    name: 'Cyber-Glitch',
    hue: [180, 210],
    scheme: 'complementary',
    mean: 0.62,
    sigma: 0.18,
    prefer: {
      rgbShift: 3,
      glitchArt: 2.5,
      unifiedGlitch: 2.5,
      scanLines: 2.5,
      gradientMap: 2,
      contrast: 2,
      bloom: 1.5,
      chromaticAberration: 2,
    },
  },
  // Teal-orange blockbuster grade: colour-balance (tone) + split-tone (grade) +
  // pro-mist veil, on a cinema-stock base.
  cinematic: {
    name: 'Cinematic',
    hue: [195, 225],
    scheme: 'complementary',
    mean: 0.5,
    sigma: 0.14,
    prefer: {
      colorBalance: 3,
      splitTone: 3,
      proMist: 2.5,
      contrast: 2,
      unifiedFilm: 1.5,
      clarity: 1.5,
      vignette: 1.5,
      bloom: 1,
    },
  },
  // Ink-on-paper: print emulation + halftone + duotone, punchy and limited-palette.
  print: {
    name: 'Print Shop',
    hue: [15, 210],
    scheme: 'complementary',
    mean: 0.6,
    sigma: 0.14,
    prefer: {
      unifiedPrint: 3,
      halftone: 3,
      duotone: 2.5,
      posterize: 2,
      dotScreen: 1.5,
      contrast: 1.5,
      crosshatch: 1,
      noise: 1,
    },
  },
  // True black & white: channel-mixer mono conversion + clarity + grit.
  mono: {
    name: 'Monochrome',
    hue: [200, 240],
    scheme: 'analogous',
    mean: 0.55,
    sigma: 0.14,
    prefer: {
      channelMixer: 4,
      clarity: 3,
      contrast: 3,
      vignette: 2.5,
      noise: 2,
      bleachBypass: 1.5,
      scanLines: 0.5,
    },
  },
};

export const MOOD_IDS = Object.keys(MOODS);
