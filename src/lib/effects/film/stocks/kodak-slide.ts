/**
 * Kodak reversal / slide film recipes for the film substrate.
 *
 * Source: docs/effects-research/research/r2-kodachrome-ektachrome.md. Numbers are
 * the research's [ESTIMATED] engine values that reproduce the [MEASURED] /
 * [DOCUMENTED-QUAL] behaviour of each stock. Per the substrate contract:
 *   - gain / matrix are LINEAR (white-balance + dye crosstalk),
 *   - curves are DISPLAY-space (sRGB 0..1), monotonic, with a real toe + shoulder,
 *   - saturation is display luma-preserving (1 = none),
 *   - grain.intensity is RMS-anchored (ISO100 ≈ 0.010), grainSize in px.
 *
 * KODACHROME is NOT a neon / wide-gamut film — its reconstructed gamut fits inside
 * sRGB (Kinograph, 2025). The naive emulation ("global +40% saturation + lifted
 * blacks") is wrong on every axis. The real signature is FOUR things:
 *   1. Deep, dense, shadow-weighted blacks (crushed toe, steep lower-mid slope).
 *   2. A warm/cool CROSSOVER split-tone, baked into per-channel curves — NOT a
 *      global tint: shadows lean blue/cool (curveB lifted low end), highlights lean
 *      warm/yellow (curveR lifted, curveB lowered up top). G stays the contrast spine.
 *   3. SELECTIVE red purity via gain + a near-identity matrix (reds pure, greens
 *      darkened) with only ~+10% GLOBAL saturation — not a big sat number.
 *   4. Fine grain (RMS 10 ⇒ intensity ~0.010), and essentially NO halation
 *      (Kodachrome had good anti-halation), so the halation field is omitted.
 *
 * Reversal stocks are higher-contrast than negative and clip harder at both ends;
 * the curve top points still roll off below 1.0 so highlights don't hard-clip.
 *
 * Ektachrome E100 is the clean opposite: cool-neutral balance, no crossover, an
 * open low-contrast S with whiter whites (low D-min, no toe lift), faithful (not
 * darkened) greens/skies. E100VS is the saturated E-6 ("Velvia competitor") — the
 * film most fake "Kodachrome" presets are actually imitating.
 */

import type { FilmRecipe } from '../substrate';

// RMS granularity → grain intensity (RMS: E100 8, K25 9, K64 10, E100VS 11, K200 16).
// Finer film = lower intensity; only K200 should read as notably grainy.

const kodachrome64: FilmRecipe = {
  name: 'kodachrome64',
  displayName: 'Kodachrome 64',
  blurb:
    'The iconic K-14 slide: dense shadow-weighted blacks, cool shadows, warm/red highlights, selective red purity — not global oversaturation.',
  // LINEAR: gentle warm midtone bias; the cool lean returns via the shadow curve split.
  gain: [1.05, 1.0, 0.95],
  // LINEAR, near-identity: keeps reds PURE and lets greens darken slightly; row-sums ≈ 1 to hold neutrals.
  matrix: [1.08, -0.05, -0.03, -0.04, 1.04, 0.0, -0.02, -0.06, 1.08],
  // G = the shared shadow-weighted S-curve spine (crushed toe 0.06→0.030, steep lower mids, rolled shoulder).
  curveG: [
    [0, 0],
    [0.06, 0.03],
    [0.22, 0.165],
    [0.5, 0.52],
    [0.78, 0.84],
    [0.93, 0.96],
    [1, 1],
  ],
  // R: same spine, lifted in the highlights → warm/yellow top end.
  curveR: [
    [0, 0],
    [0.06, 0.03],
    [0.22, 0.17],
    [0.5, 0.525],
    [0.78, 0.855],
    [0.93, 0.975],
    [1, 1],
  ],
  // B: lifted in shadows (cool/blue low end), lowered in highlights → completes the crossover.
  curveB: [
    [0, 0],
    [0.06, 0.045],
    [0.22, 0.2],
    [0.5, 0.52],
    [0.78, 0.82],
    [0.93, 0.94],
    [1, 1],
  ],
  saturation: 1.1, // modest; the red punch comes from gain+matrix, not this.
  grain: { intensity: 0.01, grainSize: 1, roughness: 0.2, midWeight: 1.1 }, // RMS 10, fine.
  // No halation — Kodachrome had good anti-halation backing.
};

const kodachrome25: FilmRecipe = {
  name: 'kodachrome25',
  displayName: 'Kodachrome 25',
  blurb:
    'Finest-grain Kodachrome: same crossover signature as the 64, gentler contrast and lighter saturation.',
  gain: [1.04, 1.0, 0.96],
  matrix: [1.06, -0.04, -0.02, -0.03, 1.03, 0.0, -0.02, -0.05, 1.07],
  curveG: [
    [0, 0],
    [0.06, 0.035],
    [0.22, 0.17],
    [0.5, 0.52],
    [0.78, 0.835],
    [0.93, 0.958],
    [1, 1],
  ],
  curveR: [
    [0, 0],
    [0.06, 0.035],
    [0.22, 0.173],
    [0.5, 0.523],
    [0.78, 0.846],
    [0.93, 0.968],
    [1, 1],
  ],
  curveB: [
    [0, 0],
    [0.06, 0.046],
    [0.22, 0.193],
    [0.5, 0.52],
    [0.78, 0.822],
    [0.93, 0.945],
    [1, 1],
  ],
  saturation: 1.08,
  grain: { intensity: 0.009, grainSize: 1, roughness: 0.2 }, // RMS 9.
};

const kodachrome200: FilmRecipe = {
  name: 'kodachrome200',
  displayName: 'Kodachrome 200',
  blurb:
    'Available-light Kodachrome: same DNA, grainier and a touch muted/warmer, with the documented magenta-red push lean.',
  gain: [1.06, 1.0, 0.95],
  // Slightly less red purity (muted); small G→B pull adds the magenta-red push character.
  matrix: [1.06, -0.04, -0.02, -0.04, 1.05, -0.01, -0.02, -0.06, 1.08],
  // G nudged down in the shadows for the magenta-red push.
  curveG: [
    [0, 0],
    [0.06, 0.028],
    [0.22, 0.158],
    [0.5, 0.518],
    [0.78, 0.84],
    [0.93, 0.96],
    [1, 1],
  ],
  curveR: [
    [0, 0],
    [0.06, 0.032],
    [0.22, 0.172],
    [0.5, 0.525],
    [0.78, 0.852],
    [0.93, 0.972],
    [1, 1],
  ],
  // Warmer overall ⇒ a less aggressive blue-shadow lift than the 64.
  curveB: [
    [0, 0],
    [0.06, 0.04],
    [0.22, 0.188],
    [0.5, 0.518],
    [0.78, 0.822],
    [0.93, 0.942],
    [1, 1],
  ],
  saturation: 1.05, // ~5% lower than K64; reds still lead.
  grain: { intensity: 0.02, grainSize: 2, roughness: 0.25, colorAmount: 0.1, midWeight: 1.1 }, // RMS 16, slightly chromatic.
};

const ektachrome100: FilmRecipe = {
  name: 'ektachrome100',
  displayName: 'Ektachrome E100',
  blurb:
    'The clean E-6 opposite of Kodachrome: cool-neutral balance, whiter whites, open low-contrast shadows, faithful greens and skies.',
  gain: [0.99, 1.0, 1.02], // faintly cool; no matrix — neutral dye set.
  // Master curve: gentle S, OPEN shadows (no crush), near-white lifted (0.95→0.975) for low-D-min whiter whites.
  curve: [
    [0, 0],
    [0.08, 0.06],
    [0.25, 0.235],
    [0.5, 0.515],
    [0.75, 0.785],
    [0.92, 0.955],
    [0.95, 0.975],
    [1, 1],
  ],
  // Only deviation: a faint cool-shadow lift in blue; no crossover otherwise.
  curveB: [
    [0, 0],
    [0.08, 0.072],
    [0.25, 0.248],
    [0.5, 0.515],
    [0.75, 0.785],
    [0.92, 0.953],
    [0.95, 0.973],
    [1, 1],
  ],
  saturation: 1.05, // moderately enhanced, not wild.
  grain: { intensity: 0.008, grainSize: 1, roughness: 0.2 }, // RMS 8, extremely fine.
};

const ektachrome100vs: FilmRecipe = {
  name: 'ektachrome100vs',
  displayName: 'Ektachrome E100VS',
  blurb:
    'The saturated E-6 (Color Amplifying Tech) — punchy, vivid colour on a neutral gray scale. The real "neon slide" most fake Kodachrome presets imitate.',
  gain: [1.0, 1.0, 1.0], // neutral balance — NOT a crossover.
  // Higher-contrast S (more than E100, less shadow-weighted than Kodachrome); neutral, so one master curve.
  curve: [
    [0, 0],
    [0.07, 0.045],
    [0.25, 0.205],
    [0.5, 0.515],
    [0.75, 0.815],
    [0.93, 0.965],
    [1, 1],
  ],
  saturation: 1.3, // the headline trait.
  grain: { intensity: 0.011, grainSize: 1, roughness: 0.2 }, // RMS 11.
};

export const KODAK_SLIDE_STOCKS: FilmRecipe[] = [
  kodachrome25,
  kodachrome64,
  kodachrome200,
  ektachrome100,
  ektachrome100vs,
];
