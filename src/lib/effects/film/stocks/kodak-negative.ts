/**
 * Kodak C-41 colour-negative stocks — parametric FilmRecipes.
 *
 * Translated from docs/effects-research/research/r1-kodak-negative.md. The
 * MEASURED anchors (ISO, per-layer density slopes, Status-M red aims, PGI grain
 * ordering, blue-steepest layer) drive the relative shape of every knob; the
 * absolute tone-curve control points and look params are r1's ESTIMATED
 * reverse-engineering, reproduced verbatim where r1 gives them and interpolated
 * from r1's deltas where it gives a "start-from-Portra-400 + these changes" list
 * (Portra 160 / 800).
 *
 * Two C-41 truths shape every curve here (r1 §0):
 *   1. Low capture gamma ⇒ gentle midtone slope, lifted (toe) blacks.
 *   2. Highlight latitude >> shadow latitude ⇒ soft shoulder, never a hard 1.0.
 * The Portra split-tone (warm highlights / cool shadows) is baked into the
 * per-channel curves: the BLUE black is lifted MOST (cool shadows) and the BLUE
 * highlight is pulled DOWN most vs red (warm highlights). That crossover is the
 * whole Portra signature — see r1 §1.2.
 *
 * Curves are DISPLAY-space (sRGB-gamma) control points; gains are LINEAR-light
 * white balance. No dye-crosstalk matrix is used — r1's recipes specify WB gains
 * only, so gains suffice and `matrix` is omitted (see substrate.ts semantics).
 * Grain `intensity` is on the substrate's RMS-like 0–0.06 scale (NOT r1's 0–1
 * "engine amount"); the values below are ordered strictly by r1's measured PGI.
 */

import type { FilmRecipe } from '../substrate';

export const KODAK_NEGATIVE_STOCKS: FilmRecipe[] = [
  {
    name: 'portra160',
    displayName: 'Portra 160',
    blurb:
      'The cleanest Portra — natural skin, low contrast, the faintest warm-highlight/cool-shadow split, near-zero grain.',
    gain: [1.03, 1.0, 0.98],
    // r1 §2: Portra 400 base, shadows cleaner (less lift), highlights a touch higher.
    curveR: [
      [0, 0.035],
      [0.25, 0.255],
      [0.5, 0.52],
      [0.75, 0.785],
      [1, 0.97],
    ],
    curveG: [
      [0, 0.035],
      [0.25, 0.245],
      [0.5, 0.5],
      [0.75, 0.765],
      [1, 0.955],
    ],
    curveB: [
      [0, 0.05],
      [0.25, 0.245],
      [0.5, 0.49],
      [0.75, 0.745],
      [1, 0.94],
    ],
    saturation: 0.96,
    grain: { intensity: 0.01, grainSize: 1.2, colorAmount: 0.03, seed: 1601 },
    halation: { intensity: 0.08, threshold: 0.62 },
  },
  {
    name: 'portra400',
    displayName: 'Portra 400',
    blurb:
      'The default "natural film" stock — warm-highlight/cool-shadow split-tone via the curveR/curveB crossover, low contrast, creamy highlight roll-off.',
    gain: [1.03, 1.0, 0.98],
    // r1 §1.2 verbatim. Blue black lifted most → teal shadows; blue highlight
    // pulled most (0.93 vs R 0.965) → warm highlights. Midtone slope ≈ 1.04.
    curveR: [
      [0, 0.045],
      [0.25, 0.26],
      [0.5, 0.52],
      [0.75, 0.78],
      [1, 0.965],
    ],
    curveG: [
      [0, 0.04],
      [0.25, 0.25],
      [0.5, 0.5],
      [0.75, 0.76],
      [1, 0.95],
    ],
    curveB: [
      [0, 0.06],
      [0.25, 0.25],
      [0.5, 0.49],
      [0.75, 0.74],
      [1, 0.93],
    ],
    saturation: 0.93,
    grain: { intensity: 0.013, grainSize: 1.4, colorAmount: 0.05, seed: 4001 },
    halation: { intensity: 0.12, threshold: 0.6 },
  },
  {
    name: 'portra800',
    displayName: 'Portra 800',
    blurb:
      'The low-light Portra — open, lifted, low-contrast shadows for deep shadow detail, warmer cast, and visible high-speed grain.',
    gain: [1.05, 1.0, 0.96],
    // r1 §3: more shadow lift (open shadows), slightly higher midtone contrast
    // (0.25→0.75 slope ≈ 1.08), warm cast preserved. Split crossover kept.
    curveR: [
      [0, 0.065],
      [0.25, 0.255],
      [0.5, 0.52],
      [0.75, 0.79],
      [1, 0.96],
    ],
    curveG: [
      [0, 0.065],
      [0.25, 0.245],
      [0.5, 0.5],
      [0.75, 0.77],
      [1, 0.945],
    ],
    curveB: [
      [0, 0.075],
      [0.25, 0.25],
      [0.5, 0.49],
      [0.75, 0.74],
      [1, 0.925],
    ],
    saturation: 0.95,
    // Coarsest of the set in 135; shadow-weighted, more visible chroma grain.
    grain: { intensity: 0.02, grainSize: 2, colorAmount: 0.12, shadowWeight: 0.8, seed: 8001 },
    halation: { intensity: 0.18 },
  },
  {
    name: 'ektar100',
    displayName: 'Ektar 100',
    blurb:
      'The vivid, ultra-clean slide-film analog — high saturation (blues/greens), steeper contrast, minimal split-tone, near-grainless.',
    gain: [1.0, 1.0, 1.02],
    // r1 §4 verbatim: steeper S, minimal black lift, strong highlight contrast,
    // almost no channel divergence (0.25→0.75 slope ≈ 1.14).
    curveR: [
      [0, 0.02],
      [0.25, 0.23],
      [0.5, 0.5],
      [0.75, 0.8],
      [1, 0.99],
    ],
    curveG: [
      [0, 0.02],
      [0.25, 0.235],
      [0.5, 0.5],
      [0.75, 0.8],
      [1, 0.99],
    ],
    curveB: [
      [0, 0.03],
      [0.25, 0.235],
      [0.5, 0.5],
      [0.75, 0.79],
      [1, 0.98],
    ],
    saturation: 1.2,
    grain: { intensity: 0.008, grainSize: 1.1, colorAmount: 0, seed: 1001 },
    halation: { intensity: 0.06, threshold: 0.65 },
  },
  {
    name: 'gold200',
    displayName: 'Gold 200',
    blurb:
      'Golden-hour-in-a-box — warm/yellow cast baked into the channel divergence, higher contrast and saturation than Portra, muted skies.',
    gain: [1.06, 1.0, 0.93],
    // r1 §5 verbatim: red lifted across (warmth), blue pulled across (golden
    // cast), medium contrast, moderate black lift.
    curveR: [
      [0, 0.05],
      [0.25, 0.27],
      [0.5, 0.54],
      [0.75, 0.8],
      [1, 0.98],
    ],
    curveG: [
      [0, 0.045],
      [0.25, 0.25],
      [0.5, 0.51],
      [0.75, 0.77],
      [1, 0.95],
    ],
    curveB: [
      [0, 0.04],
      [0.25, 0.22],
      [0.5, 0.46],
      [0.75, 0.7],
      [1, 0.9],
    ],
    saturation: 1.1,
    grain: { intensity: 0.016, grainSize: 1.7, colorAmount: 0.06, seed: 2001 },
    halation: { intensity: 0.12, threshold: 0.58 },
  },
];
