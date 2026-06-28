/**
 * Black-and-white film stocks — typed recipes translated from documented film
 * science, not vibes. See docs/effects-research/research/r5-bw.md.
 *
 * What makes a B&W emulation real (and what the old grayscale effect lacked):
 *
 *   1. Per-stock CHANNEL MIXING in linear light. A panchromatic film converts a
 *      colored scene to gray through its spectral-sensitivity curve, NOT Rec.709
 *      luma. Classic cubic films (Tri-X / HP5 / FP4) are blue-heavy → pale skies,
 *      light glowy skin; modern tabular films (T-Max / Acros) were tuned flatter /
 *      eye-like (Kodak states T-Max's blue is deliberately reduced — r5 §0). The
 *      `bw` weights below are those documented RGB→gray splits, applied in LINEAR
 *      light by the substrate (r5 §1b, §4.1). Each row sums ≈ 1.
 *
 *   2. The Wratten CONTRAST-FILTER control (BW_CONTRAST_FILTERS + applyBwFilter):
 *      glass filters work by attenuation — "like colours lightened, complementary
 *      darkened." Modeled as per-channel multipliers on the stock weights, then
 *      renormalized so overall midtone exposure is preserved and only the balance
 *      shifts (r5 §2a). This is the control that turns a blue sky black (red) or
 *      white (blue), the heart of B&W shooting.
 *
 * Contrast CHARACTER lives in `curve` (display-space D-logE shapes, r5 §4.2):
 * Tri-X's soft long shoulder, HP5's low-contrast lifted toe, T-Max's straight
 * line / minimal shoulder, Acros's graceful highlight shoulder, Delta 3200's
 * veiled lifted shadows. Grain maps MEASURED RMS granularity → intensity, cubic
 * stocks clumpier (bigger grainSize) than fine tabular ones (r5 §3, §4.3);
 * colorAmount is 0 because at grain scale the eye is achromatic.
 */

import type { FilmRecipe } from '../substrate';

/**
 * Wratten contrast filters as per-channel weight multipliers (r5 §2a, anchored to
 * the documented daylight filter factors). Multiply the stock's `bw` weights by
 * these, then renormalize to ΣW = 1 (see applyBwFilter). The yellowGreen (#11)
 * row is the documented sky-down + foliage/skin-balance filter from the same table.
 */
export const BW_CONTRAST_FILTERS: Record<string, [number, number, number]> = {
  none: [1.0, 1.0, 1.0], // panchromatic — stock's native rendering
  yellow: [1.25, 1.1, 0.55], // #8 — mild sky/cloud separation (portrait/landscape default)
  yellowGreen: [0.95, 1.4, 0.55], // #11 — sky down + foliage/skin balance
  orange: [1.6, 1.0, 0.25], // #21 — strong sky darken, haze cut
  red: [2.4, 0.55, 0.08], // #25 — dramatic near-black sky, hard contrast
  green: [0.55, 1.7, 0.55], // #58 — foliage up; skin/lips down
  blue: [0.4, 0.7, 2.1], // #47 — haze/atmosphere, light sky
};

/**
 * Apply a contrast filter to a stock's base weights: multiply per channel, then
 * renormalize to ΣW = 1 so the midtone exposure is preserved and only the channel
 * balance shifts (r5 §2a). Falls back to an even split if a stock somehow zeroes
 * out (never happens for the shipped stocks). Pseudo: w' = normalize(w * m).
 */
export function applyBwFilter(
  weights: [number, number, number],
  filter: [number, number, number]
): [number, number, number] {
  const r = weights[0] * filter[0];
  const g = weights[1] * filter[1];
  const b = weights[2] * filter[2];
  const sum = r + g + b;
  if (sum <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [r / sum, g / sum, b / sum];
}

/**
 * The seven shipped B&W stocks. `bw` = documented RGB→gray weights (r5 §1b);
 * `curve` = documented characteristic-curve shape (r5 §4.2); `grain` = MEASURED
 * RMS → intensity with cubic vs. tabular grain size (r5 §3/§4.3). colorAmount 0.
 */
export const BW_STOCKS: FilmRecipe[] = [
  {
    name: 'trix400',
    displayName: 'Tri-X 400',
    blurb:
      'Kodak Tri-X 400 — the gritty news/street benchmark. Cubic grain, blue-heavy mix (pale skies, glowy skin), medium contrast with a soft long shoulder that protects highlights.',
    bw: [0.25, 0.35, 0.4], // r5 §1b: red-extended + blue-heavy
    curve: [
      [0, 0],
      [0.1, 0.055],
      [0.25, 0.2],
      [0.5, 0.52],
      [0.75, 0.8],
      [0.9, 0.93],
      [1, 1],
    ], // mild S, soft long shoulder
    grain: {
      intensity: 0.02, // RMS 17 [M]
      grainSize: 3, // cubic — signature clumpy grit
      roughness: 0.15,
      colorAmount: 0,
      seed: 11,
    },
  },
  {
    name: 'hp5',
    displayName: 'HP5+ 400',
    blurb:
      'Ilford HP5 Plus — the forgiving classic pan. Near-Tri-X blue-heavy mix, a touch grittier cubic grain, lower contrast with a lifted toe and flat easily-printed mids (wide latitude).',
    bw: [0.23, 0.37, 0.4], // r5 §1b: near-Tri-X, very slightly less red
    curve: [
      [0, 0.02],
      [0.12, 0.1],
      [0.3, 0.28],
      [0.5, 0.49],
      [0.72, 0.71],
      [0.9, 0.9],
      [1, 0.99],
    ], // low-contrast, lifted toe, forgiving
    grain: {
      intensity: 0.022, // RMS ~18 [E] — a touch grittier than Tri-X
      grainSize: 3, // cubic
      roughness: 0.15,
      colorAmount: 0,
      seed: 12,
    },
  },
  {
    name: 'fp4',
    displayName: 'FP4 125',
    blurb:
      'Ilford FP4 Plus — medium-speed fine-grain classic. Less blue than HP5 so skies render a touch darker / more "drawn"; medium-high contrast, long tonal scale, fuller blacks.',
    bw: [0.28, 0.41, 0.31], // r5 §1b: less blue → darker skies
    curve: [
      [0, 0],
      [0.12, 0.07],
      [0.28, 0.22],
      [0.5, 0.52],
      [0.74, 0.8],
      [0.92, 0.95],
      [1, 1],
    ], // medium-high, full blacks, long scale
    grain: {
      intensity: 0.013, // RMS ~10–12 [E] — fine, slightly clumpier cubic
      grainSize: 2,
      roughness: 0.2,
      colorAmount: 0,
      seed: 13,
    },
  },
  {
    name: 'tmax100',
    displayName: 'T-Max 100',
    blurb:
      'Kodak T-Max 100 — clean, modern, clinical. Tabular T-grain, high acutance, a long straight line with minimal shoulder. Reduced-blue / +green per Kodak for an eye-like, natural-sky rendition.',
    bw: [0.25, 0.4, 0.35], // r5 §1b: nudged −blue / +green per Kodak's documented note
    curve: [
      [0, 0],
      [0.1, 0.06],
      [0.3, 0.27],
      [0.5, 0.51],
      [0.7, 0.75],
      [0.88, 0.92],
      [1, 1],
    ], // straight line, little shoulder, crisp
    grain: {
      intensity: 0.009, // RMS 8 [M] — very fine T-grain
      grainSize: 2, // tabular — fine, tight
      roughness: 0.25,
      colorAmount: 0,
      seed: 14,
    },
  },
  {
    name: 'tmax400',
    displayName: 'T-Max 400',
    blurb:
      'Kodak T-Max 400 — like the 100, a hair softer. Sharp fine tabular T-grain, straight line. Documented reduced-blue mix gives more natural, slightly darker skies.',
    bw: [0.27, 0.41, 0.32], // r5 §1b: nudged −blue / +green per same Kodak note
    curve: [
      [0, 0],
      [0.1, 0.06],
      [0.3, 0.26],
      [0.5, 0.5],
      [0.7, 0.74],
      [0.9, 0.93],
      [1, 1],
    ], // straight, a hair softer than 100
    grain: {
      intensity: 0.012, // RMS 10 [M] — fine T-grain
      grainSize: 2, // tabular
      roughness: 0.25,
      colorAmount: 0,
      seed: 15,
    },
  },
  {
    name: 'acros100',
    displayName: 'Acros 100',
    blurb:
      'Fujifilm Neopan 100 Acros II — the finest grain here. Super Fine-Σ tabular, smooth rich gradation, excellent highlight retention with a graceful shoulder; very neutral, eye-like skin.',
    bw: [0.25, 0.4, 0.35], // r5 §1b [E]: even/neutral pan, slightly green-weighted
    curve: [
      [0, 0],
      [0.12, 0.06],
      [0.28, 0.22],
      [0.5, 0.52],
      [0.74, 0.81],
      [0.92, 0.96],
      [1, 1],
    ], // clean, deep blacks, graceful highlight shoulder
    grain: {
      intensity: 0.008, // RMS 7 [M] — barely-there, tightest
      grainSize: 2, // Σ tabular — finest
      roughness: 0.25,
      colorAmount: 0,
      seed: 16,
    },
  },
  {
    name: 'delta3200',
    displayName: 'Delta 3200',
    blurb:
      'Ilford Delta 3200 — the heavy-grain stock (true ISO 1000, box EI 3200). Flattest/most-even mix; dominant coarse core-shell grain; veiled lifted shadows and soft, compressed highlights.',
    bw: [0.31, 0.36, 0.33], // r5 §1b: flattest / most-even response (highest red)
    curve: [
      [0, 0.05],
      [0.15, 0.15],
      [0.35, 0.33],
      [0.55, 0.53],
      [0.78, 0.74],
      [0.92, 0.9],
      [1, 0.98],
    ], // veiled/lifted shadows, soft, compressed highs
    grain: {
      intensity: 0.04, // coarse [E] — dominant, large grain
      grainSize: 3, // the heavy-grain look
      roughness: 0.1,
      shadowWeight: 0.9, // veiled, lifted shadows (base fog + push)
      colorAmount: 0,
      seed: 17,
    },
  },
];
