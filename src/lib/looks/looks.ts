/**
 * Curated "Looks" library — named, one-click, fully-editable recipes.
 *
 * Where the Smart Randomizer *explores* the effect space, a Look is a fixed,
 * hand-tuned destination: an explicit stack of real effect layers with real
 * settings. Each layer is a plain {effectId, settings, opacity} so it drops
 * straight onto the existing layer stack via `lookToStackLayers` (which adds the
 * `locked` field to match compose.ts's RecipeLayer).
 *
 * Every effectId and every settings key here is a real entry in effectsConfig
 * (src/lib/effects.ts) — validated by src/lib/looks/__tests__/looks.test.ts so
 * a typo can never ship silently.
 */

export interface LookLayer {
  effectId: string;
  /** Subset of the effect's real settings (effectsConfig). Defaults fill the rest. */
  settings: Record<string, number>;
  /** Layer blend 0..1. */
  opacity: number;
}

export interface Look {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  layers: LookLayer[];
}

/**
 * `unifiedFilm` preset indices = position in FILM_STOCKS (src/lib/effects.ts):
 * kodak-negative → kodak-slide → fuji → cinema → bw. Named here so the recipes
 * below read as stocks, not magic numbers. (Source order verified against
 * src/lib/effects/film/stocks/*.ts.)
 */
const FILM = {
  portra160: 0,
  portra400: 1,
  portra800: 2,
  ektar100: 3,
  gold200: 4,
  kodachrome64: 5,
  kodachrome25: 6,
  kodachrome200: 7,
  ektachrome100: 8,
  ektachrome100vs: 9,
  velvia50: 10,
  velvia100: 11,
  provia100f: 12,
  astia100f: 13,
  pro400h: 14,
  superia400: 15,
  cinestill800t: 16,
  cinestill50d: 17,
  vision3_250d: 18,
  vision3_500t: 19,
  crossProcess: 20,
  trix400: 21,
  hp5: 22,
  fp4: 23,
  tmax100: 24,
  tmax400: 25,
  acros100: 26,
  delta3200: 27,
} as const;

/** unifiedVintage preset indices (effectsConfig.unifiedVintage.presetNames). */
const VINTAGE = {
  sepia: 0,
  oldPhoto: 1,
  faded: 2,
  crossProcess: 3,
  scratched: 4,
  polaroid: 5,
} as const;

export const LOOKS: Look[] = [
  {
    id: 'kodachrome-summer',
    name: 'Kodachrome Summer',
    blurb: 'Vivid Kodachrome reds and deep skies with a crisp local-contrast snap.',
    tags: ['film', 'warm', 'vivid', 'summer'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.kodachrome64,
          strength: 90,
          grain: 90,
          halation: 80,
          exposure: 0,
          fade: 0,
          seed: 64,
        },
        opacity: 1,
      },
      { effectId: 'clarity', settings: { amount: 25, radius: 60, protectTones: 60 }, opacity: 1 },
    ],
  },
  {
    id: 'portra-soft',
    name: 'Portra Soft',
    blurb: 'Natural Portra 400 skin tones under a gentle pro-mist diffusion veil.',
    tags: ['film', 'portrait', 'soft', 'pastel'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.portra400,
          strength: 85,
          grain: 80,
          halation: 100,
          exposure: 0,
          fade: 10,
          seed: 400,
        },
        opacity: 1,
      },
      {
        effectId: 'proMist',
        settings: { strength: 35, size: 50, blackRetention: 60, threshold: 55 },
        opacity: 1,
      },
    ],
  },
  {
    id: 'cinestill-night',
    name: 'Cinestill Night',
    blurb: 'CineStill 800T after dark — blooming red halation and cool teal shadows.',
    tags: ['film', 'cinematic', 'night', 'neon'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.cinestill800t,
          strength: 90,
          grain: 110,
          halation: 180,
          exposure: 0,
          fade: 0,
          seed: 800,
        },
        opacity: 1,
      },
      {
        effectId: 'colorBalance',
        settings: { shadowCR: -20, shadowYB: 30, midYB: 10, highCR: 10, preserveLuminosity: 1 },
        opacity: 1,
      },
    ],
  },
  {
    id: 'velvia-landscape',
    name: 'Velvia Landscape',
    blurb: 'Velvia 50 saturation for big skies and foliage, with a clarity boost.',
    tags: ['film', 'landscape', 'vivid', 'saturated'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.velvia50,
          strength: 95,
          grain: 60,
          halation: 70,
          exposure: 0,
          fade: 0,
          seed: 50,
        },
        opacity: 1,
      },
      { effectId: 'clarity', settings: { amount: 40, radius: 70, protectTones: 50 }, opacity: 1 },
    ],
  },
  {
    id: 'trix-street',
    name: 'Tri-X Street',
    blurb: 'Gritty Tri-X 400 black & white with grain and punchy mid-contrast.',
    tags: ['film', 'bw', 'mono', 'street', 'documentary'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.trix400,
          strength: 100,
          grain: 130,
          halation: 60,
          exposure: 0,
          fade: 0,
          seed: 400,
        },
        opacity: 1,
      },
      { effectId: 'clarity', settings: { amount: 45, radius: 50, protectTones: 40 }, opacity: 1 },
    ],
  },
  {
    id: 'faded-polaroid',
    name: 'Faded Polaroid',
    blurb: 'Sun-aged instant film — lifted blacks, warm fade, grain and a soft vignette.',
    tags: ['vintage', 'faded', 'instant', 'soft'],
    layers: [
      {
        effectId: 'unifiedVintage',
        settings: {
          preset: VINTAGE.polaroid,
          intensity: 0.6,
          vignette: 0.4,
          grain: 0.4,
          scratches: 0.05,
          fade: 0.5,
          warmth: 0.6,
          opacity: 1,
        },
        opacity: 1,
      },
      { effectId: 'noise', settings: { value: 0.25, opacity: 0.5 }, opacity: 0.6 },
      { effectId: 'vignette', settings: { amount: 0.4, falloff: 0.5 }, opacity: 1 },
    ],
  },
  {
    id: 'teal-and-orange',
    name: 'Teal & Orange',
    blurb: 'The blockbuster grade: cool shadows, warm skin, split-toned highlights.',
    tags: ['cinematic', 'color', 'blockbuster'],
    layers: [
      {
        effectId: 'colorBalance',
        settings: {
          shadowCR: -25,
          shadowMG: -5,
          shadowYB: 35,
          midCR: 8,
          highCR: 25,
          highYB: -25,
          preserveLuminosity: 1,
        },
        opacity: 1,
      },
      {
        effectId: 'splitTone',
        settings: { shadowHue: 200, shadowSat: 35, highlightHue: 45, highlightSat: 30, balance: 0 },
        opacity: 0.8,
      },
    ],
  },
  {
    id: 'bleach-noir',
    name: 'Bleach Noir',
    blurb: 'Silver-retention bleach bypass over a near-monochrome channel mix.',
    tags: ['cinematic', 'bw', 'contrast', 'gritty'],
    layers: [
      {
        effectId: 'bleachBypass',
        settings: { strength: 75, contrast: 65, saturation: 15 },
        opacity: 1,
      },
      {
        effectId: 'channelMixer',
        settings: { rFromR: 50, rFromG: 40, rFromB: 10, monochrome: 1 },
        opacity: 0.5,
      },
    ],
  },
  {
    id: 'riso-poster',
    name: 'Riso Poster',
    blurb: 'Two-ink risograph print with registration drift and a duotone wash.',
    tags: ['print', 'riso', 'graphic', 'duotone'],
    layers: [
      {
        effectId: 'unifiedPrint',
        settings: {
          preset: 0,
          intensity: 80,
          colorCount: 2,
          dotSize: 8,
          registration: 4,
          paperTexture: 60,
          inkBleed: 40,
          opacity: 1,
        },
        opacity: 1,
      },
      {
        effectId: 'duotone',
        settings: { color1: 0x1a1a40, color2: 0xff5a5f, opacity: 0.5 },
        opacity: 0.6,
      },
    ],
  },
  {
    id: 'dreamy-pastel',
    name: 'Dreamy Pastel',
    blurb: 'Pro 400H pastels, a diffusion bloom, and a whisper of split-tone.',
    tags: ['soft', 'pastel', 'dreamy', 'portrait'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.pro400h,
          strength: 80,
          grain: 70,
          halation: 110,
          exposure: 0,
          fade: 15,
          seed: 400,
        },
        opacity: 1,
      },
      {
        effectId: 'proMist',
        settings: { strength: 45, size: 60, blackRetention: 50, threshold: 50 },
        opacity: 1,
      },
      {
        effectId: 'splitTone',
        settings: {
          shadowHue: 220,
          shadowSat: 20,
          highlightHue: 50,
          highlightSat: 25,
          balance: 10,
        },
        opacity: 0.7,
      },
    ],
  },
  {
    id: 'cross-process-punk',
    name: 'Cross-Process Punk',
    blurb: 'C-41-in-E6 colour twists and crunchy clarity for a defiant edge.',
    tags: ['film', 'crossprocess', 'punk', 'vivid'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.crossProcess,
          strength: 95,
          grain: 110,
          halation: 90,
          exposure: 0,
          fade: 0,
          seed: 20,
        },
        opacity: 1,
      },
      { effectId: 'clarity', settings: { amount: 50, radius: 55, protectTones: 30 }, opacity: 1 },
    ],
  },
  {
    id: 'infrared-dream',
    name: 'Infrared Dream',
    blurb: 'Red↔green channel swap for surreal foliage, lifted by a soft bloom.',
    tags: ['surreal', 'infrared', 'glow', 'experimental'],
    layers: [
      {
        effectId: 'channelMixer',
        settings: {
          rFromR: 0,
          rFromG: 100,
          rFromB: 0,
          gFromR: 100,
          gFromG: 0,
          gFromB: 0,
          bFromR: 0,
          bFromG: 0,
          bFromB: 100,
          monochrome: 0,
        },
        opacity: 1,
      },
      { effectId: 'bloom', settings: { strength: 60, radius: 40, opacity: 1 }, opacity: 1 },
    ],
  },
  {
    id: 'sun-bleached',
    name: 'Sun-bleached',
    blurb: 'Golden Gold 200 warmth, a darkened sky gradient, and dusty grain.',
    tags: ['vintage', 'warm', 'faded', 'summer'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.gold200,
          strength: 80,
          grain: 120,
          halation: 100,
          exposure: 0,
          fade: 30,
          seed: 200,
        },
        opacity: 1,
      },
      {
        effectId: 'gradND',
        settings: {
          exposure: -45,
          angle: 0,
          position: 45,
          softness: 60,
          tintHue: 40,
          tintStrength: 15,
        },
        opacity: 1,
      },
      { effectId: 'noise', settings: { value: 0.3, opacity: 0.5 }, opacity: 0.5 },
    ],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    blurb: 'Datamosh glitch, a magenta-cyan gradient map, and neon bloom.',
    tags: ['glitch', 'neon', 'cyber', 'futuristic'],
    layers: [
      {
        effectId: 'unifiedGlitch',
        settings: {
          preset: 0,
          intensity: 0.5,
          amount: 18,
          direction: 0,
          blockSize: 12,
          randomness: 0.6,
          opacity: 0.8,
        },
        opacity: 0.8,
      },
      {
        effectId: 'gradientMap',
        settings: {
          shadowColor: 0x0a0a2a,
          midColor: 0xff2e88,
          highlightColor: 0x18e0ff,
          midpoint: 0.5,
          strength: 0.6,
        },
        opacity: 0.7,
      },
      { effectId: 'bloom', settings: { strength: 55, radius: 30, opacity: 1 }, opacity: 1 },
    ],
  },
  {
    id: 'editorial-clean',
    name: 'Editorial Clean',
    blurb: 'A near-invisible polish: local-contrast clarity and a subtle colour balance.',
    tags: ['clean', 'editorial', 'minimal', 'natural'],
    layers: [
      { effectId: 'clarity', settings: { amount: 30, radius: 60, protectTones: 70 }, opacity: 1 },
      {
        effectId: 'colorBalance',
        settings: {
          shadowCR: -5,
          shadowYB: 5,
          midCR: 3,
          highCR: 5,
          highYB: -5,
          preserveLuminosity: 1,
        },
        opacity: 0.8,
      },
    ],
  },
  {
    id: 'darkroom',
    name: 'Darkroom',
    blurb: 'Acros 100 black & white with darkroom clarity and a printed-in vignette.',
    tags: ['bw', 'mono', 'film', 'classic', 'moody'],
    layers: [
      {
        effectId: 'unifiedFilm',
        settings: {
          preset: FILM.acros100,
          strength: 100,
          grain: 80,
          halation: 50,
          exposure: 0,
          fade: 0,
          seed: 100,
        },
        opacity: 1,
      },
      { effectId: 'clarity', settings: { amount: 35, radius: 55, protectTones: 50 }, opacity: 1 },
      { effectId: 'vignette', settings: { amount: 0.5, falloff: 0.5 }, opacity: 1 },
    ],
  },
];

export const LOOK_IDS: string[] = LOOKS.map(l => l.id);

/** Looks grouped by tag (a Look appears under each of its tags). */
export const looksByTag: Record<string, Look[]> = (() => {
  const out: Record<string, Look[]> = {};
  for (const look of LOOKS) {
    for (const tag of look.tags) {
      (out[tag] ||= []).push(look);
    }
  }
  return out;
})();

/** Find a Look by id. */
export function getLook(id: string): Look | undefined {
  return LOOKS.find(l => l.id === id);
}

/**
 * Convert a Look into stack layers shaped like compose.ts's RecipeLayer
 * ({ effectId, settings, opacity, locked }) so a Look can be dropped onto the
 * existing layer stack. Pure — clones settings so callers can mutate freely.
 */
export function lookToStackLayers(
  look: Look
): Array<{ effectId: string; settings: Record<string, number>; opacity: number; locked: boolean }> {
  return look.layers.map(layer => ({
    effectId: layer.effectId,
    settings: { ...layer.settings },
    opacity: layer.opacity,
    locked: false,
  }));
}
