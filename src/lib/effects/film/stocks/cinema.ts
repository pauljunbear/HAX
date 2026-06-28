/**
 * Cinema / Cinestill film-stock recipes for the HAX film substrate.
 *
 * Pure data: each entry is a `FilmRecipe` consumed by `applyFilmStock`
 * (see ../substrate.ts). The values are translated faithfully from
 *   docs/effects-research/research/r4-cinema-halation.md
 * with that file's confidence convention preserved:
 *   - Stock IDENTITY and WHITE BALANCE are MEASURED (datasheet 3200K/5500K,
 *     remjet-removal physics, the red-halation mechanism).
 *   - Every concrete gain / curve / halation / grain NUMBER is ESTIMATED:
 *     an art-directed fit grounded in the documented behaviour, not a
 *     measured constant (datasheets give curves as plots, not closed form).
 *
 * Conventions (from substrate.ts):
 *   - `gain` / `matrix` operate in LINEAR light (white balance / dye crosstalk).
 *   - `curve*` are DISPLAY-space (0..1) characteristic curves: monotonic,
 *     endpoints near x=0 / x=1, with a lifted toe (negative-film black) and a
 *     soft shoulder (no hard highlight clip). A channel without its own curve
 *     falls back to `curve`.
 *   - `halation` / `grain` are the reusable linear / display passes; we only set
 *     per-stock parameters here. Halation core/rim tints + sigmas are the
 *     r4-recommended values (ORANGE hot core → RED outer rim, in linear).
 */

import type { FilmRecipe } from '../substrate';

/**
 * Cinestill 800T — THE priority look. Kodak Vision3 500T (tungsten 3200K, EI 800)
 * with the remjet anti-halation backing stripped for C-41, so back-reflected
 * red light is free to halo every bright source. The four documented tells:
 *   1. RED HALATION around point lights (the hero — intensity 0.72).
 *   2. Cool / teal shadows: tungsten film shot in mixed night light skews blue
 *      (linear gain B>R) — split-toned cool in the toe via curveB lift / curveR dip.
 *   3. Warm amber highlights: curveB rolls off in the shoulder while curveR holds,
 *      so speculars go warm — the split-tone counterpart to the cool shadows.
 *   4. Lifted blacks (toe ≈ 0.04, negative latitude) + moderate ISO-800 grain
 *      with a touch of chroma, weighted slightly toward the shadows.
 */
const cinestill800t: FilmRecipe = {
  name: 'cinestill800t',
  displayName: 'Cinestill 800T',
  blurb: 'Tungsten night film: red halation, teal shadows, amber highlights.',
  // Tungsten-balanced stock under daylight/mixed light → cool. (MEASURED balance, ESTIMATED gains)
  gain: [0.9, 1.0, 1.15],
  saturation: 1.05,
  // Split-tone: shadows cool/teal, highlights warm/amber; toe lifted ~0.04.
  curveR: [
    [0, 0.04],
    [0.25, 0.235],
    [0.5, 0.5],
    [0.75, 0.78],
    [1, 1.0],
  ],
  curveG: [
    [0, 0.05],
    [0.5, 0.5],
    [1, 0.97],
  ],
  curveB: [
    [0, 0.1],
    [0.25, 0.28],
    [0.5, 0.5],
    [0.75, 0.7],
    [1, 0.92],
  ],
  // The hero. r4 Part-1 algorithm, Cinestill-strong: T≈0.5 so most light sources
  // halo; ORANGE hot core → RED outer rim; tight ring (0.004·maxDim) inside a
  // wide bloom (0.025·maxDim).
  halation: {
    intensity: 0.72,
    threshold: 0.5,
    knee: 0.25,
    power: 1.6,
    sigmaCore: 0.004,
    sigmaBloom: 0.025,
    weightCore: 0.7,
    weightBloom: 0.45,
    core: [1.0, 0.32, 0.1],
    rim: [1.0, 0.07, 0.05],
  },
  // Moderate ISO-800 grain, faint chroma, pushed slightly into the shadows.
  grain: {
    intensity: 0.022,
    grainSize: 2,
    roughness: 0.22,
    shadowWeight: 0.8,
    midWeight: 1.0,
    highWeight: 0.45,
    colorAmount: 0.12,
  },
};

/**
 * Cinestill 50D — Vision3 50D (daylight 5500K, EI 50) sans remjet. Daylight-
 * balanced, exceptionally fine grain, pastel palette, and the LEAST halation of
 * the line (daylight scenes lack the dark backgrounds red halos read against, and
 * the slow speed means little energy survives the round trip). Neutral-warm: no
 * cast, just a faint warm-highlight tint and a raised black point.
 */
const cinestill50d: FilmRecipe = {
  name: 'cinestill50d',
  displayName: 'Cinestill 50D',
  blurb: 'Daylight pastel: clean, neutral-warm, fine grain, a whisper of halation.',
  // Neutral WB (no cast — the warmth lives in the highlight curve, not a gain).
  saturation: 0.85,
  // Pastel lift (raised black point ~0.06, gentle shoulder) + faint warm highs
  // (R shoulder above B).
  curveR: [
    [0, 0.06],
    [0.5, 0.52],
    [1, 0.97],
  ],
  curveG: [
    [0, 0.06],
    [0.5, 0.51],
    [1, 0.95],
  ],
  curveB: [
    [0, 0.06],
    [0.5, 0.5],
    [1, 0.93],
  ],
  // Subtle: high threshold so only true speculars glow, faintly red.
  halation: {
    intensity: 0.28,
    threshold: 0.7,
    knee: 0.2,
    power: 1.8,
  },
  // Exceptionally fine, clean (mono) grain.
  grain: {
    intensity: 0.01,
    grainSize: 1.5,
    roughness: 0.15,
    colorAmount: 0,
  },
};

/**
 * Kodak Vision3 250D / 5207 — daylight-balanced cine negative (5500K, EI 250),
 * processed ECN-2. ~10-stop latitude, the everyday "cinematic daylight negative":
 * gentle S-curve, neutral-slightly-warm, low saturation, fine grain, and only a
 * slight halation (the remjet is intact on real 5207 — this is the faint residual).
 */
const vision3_250d: FilmRecipe = {
  name: 'vision3_250d',
  displayName: 'Kodak Vision3 250D',
  blurb: 'Daylight cine negative: gentle S-curve, wide latitude, neutral-warm.',
  saturation: 1.0,
  // Gentle cinematic S-curve (slight toe lift, soft shoulder), neutral-warm
  // (R highs sit a touch above B).
  curveR: [
    [0, 0.03],
    [0.2, 0.17],
    [0.5, 0.5],
    [0.8, 0.83],
    [1, 0.97],
  ],
  curveG: [
    [0, 0.03],
    [0.2, 0.17],
    [0.5, 0.5],
    [0.8, 0.82],
    [1, 0.95],
  ],
  curveB: [
    [0, 0.035],
    [0.2, 0.18],
    [0.5, 0.5],
    [0.8, 0.8],
    [1, 0.93],
  ],
  halation: {
    intensity: 0.15,
    threshold: 0.6,
  },
  grain: {
    intensity: 0.012,
    grainSize: 2,
    roughness: 0.2,
    colorAmount: 0,
  },
};

/**
 * Kodak Vision3 500T / 5219 — tungsten-balanced cine negative (3200K, EI 500),
 * ECN-2. The negative inside Cinestill 800T, but WITH its anti-halation backing:
 * low contrast, wide latitude, and — shot uncorrected in daylight/mixed light —
 * the cool cast that underwrites the night-cinema look. Only a slight halation.
 */
const vision3_500t: FilmRecipe = {
  name: 'vision3_500t',
  displayName: 'Kodak Vision3 500T',
  blurb: 'Tungsten cine negative: cool when uncorrected, low contrast.',
  // Tungsten balance under uncorrected light → cool (B>R). (MEASURED balance.)
  gain: [0.92, 1.0, 1.12],
  saturation: 0.98,
  // Low-contrast curve: lifted toe, soft shoulder, compressed highs. Cast comes
  // from the gain, so the curve stays neutral (master applied to all channels).
  curve: [
    [0, 0.045],
    [0.25, 0.27],
    [0.5, 0.5],
    [0.75, 0.72],
    [1, 0.93],
  ],
  halation: {
    intensity: 0.18,
    threshold: 0.55,
  },
  grain: {
    intensity: 0.018,
    grainSize: 2.5,
    roughness: 0.2,
    shadowWeight: 0.7,
    colorAmount: 0.06,
  },
};

/**
 * Cross-process — the iconic E-6 slide film developed in C-41. Extreme contrast
 * with a hard shoulder (highlights clip to white, shadows crush), heavy
 * saturation (+~40%), and the signature COLOR CROSSOVER: shadows shift
 * cyan-green, highlights shift yellow (the Fuji flavour). No halation — this is a
 * processing artefact, not an anti-halation effect.
 */
const crossProcess: FilmRecipe = {
  name: 'crossProcess',
  displayName: 'Cross-Process (E-6 in C-41)',
  blurb: 'Bleached xpro: steep contrast, cyan-green shadows, yellow highlights.',
  // Global green/yellow bias (diagonal of r4's suggested 3×3): boost G, cut B.
  gain: [1.05, 1.08, 0.92],
  saturation: 1.32,
  // Steep S with a hard shoulder. Crossover: R/G drive highlights toward yellow
  // (B held low in the shoulder); G/B lifted in the toe → cyan-green shadows.
  curveR: [
    [0, 0.0],
    [0.25, 0.12],
    [0.5, 0.52],
    [0.75, 0.9],
    [1, 1.0],
  ],
  curveG: [
    [0, 0.04],
    [0.25, 0.18],
    [0.5, 0.55],
    [0.75, 0.9],
    [1, 1.0],
  ],
  curveB: [
    [0, 0.08],
    [0.25, 0.22],
    [0.5, 0.48],
    [0.75, 0.62],
    [1, 0.8],
  ],
  // No halation (omitted by design).
  grain: {
    intensity: 0.018,
    grainSize: 2,
    roughness: 0.2,
    colorAmount: 0.1,
  },
};

export const CINEMA_STOCKS: FilmRecipe[] = [
  cinestill800t,
  cinestill50d,
  vision3_250d,
  vision3_500t,
  crossProcess,
];
