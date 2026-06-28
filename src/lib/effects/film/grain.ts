/**
 * Seeded, structured film grain — a CPU-cheap distillation of the Newson et al.
 * inhomogeneous Boolean grain model (IPOL 2017) that keeps the four properties
 * that actually make grain read as film rather than digital sensor noise:
 *
 *   1. Spatial correlation (a real grain SIZE) — value noise on a lattice of
 *      spacing `grainSize`, bilinearly upsampled, 2 octaves. Per-pixel white
 *      noise has none of this and reads as TV static.
 *   2. Midtone-peaked variance — amplitude scales by sqrt(Y·(1−Y)), the exact
 *      Bernoulli variance envelope of the Boolean coverage field. Grain dies at
 *      pure black/white and peaks in the midtones, matching Kodak's own
 *      observation ("mid-tones … appear more grainy").
 *   3. Gaussian distribution with signal-dependent variance (Box–Muller samples).
 *   4. SEEDED reproducibility — driven by `mulberry32` keyed off lattice coords +
 *      a user seed, so the low-res live preview and the full-res export get the
 *      SAME grain. The old engine used unseeded Math.random() per pixel, so
 *      preview never matched export and grain re-rolled on every slider nudge.
 *
 * Grain is applied as LUMINANCE (R=G=B) by default — at grain scale the eye is
 * achromatic (Kodak H-1) — with an optional small independent per-channel chroma
 * component for fast colour-neg / cross-process shadow grain. Works in
 * display/gamma space (where the midtone envelope is defined) and is meant to be
 * applied AFTER the colour look. See docs/effects-research/research/r6-*.md.
 */

import { mulberry32 } from '../color-space';

export interface GrainParams {
  /** Master strength. Maps loosely to Kodak RMS granularity σ_D (ISO100≈0.012). 0–0.06. */
  intensity: number;
  /** Correlation length / grain size in px at the reference resolution. 1–6. */
  grainSize: number;
  /** Fine-octave mix for a more band-pass (film-like) spectrum. 0–0.4. */
  roughness: number;
  /** Tonal weighting bumps over the sqrt(Y(1−Y)) base envelope. */
  shadowWeight: number;
  midWeight: number;
  highWeight: number;
  /** Independent per-channel chroma grain. 0 = pure mono (recommended default). 0–0.5. */
  colorAmount: number;
  /** Integer seed → preview==export. */
  seed: number;
}

export const DEFAULT_GRAIN: GrainParams = {
  intensity: 0.012,
  grainSize: 2,
  roughness: 0.2,
  shadowWeight: 0.6,
  midWeight: 1.0,
  highWeight: 0.5,
  colorAmount: 0.0,
  seed: 1,
};

/** Hash integer lattice coords + a per-field seed into a 32-bit state. */
function hashNode(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) ^ Math.imul(seed, 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/**
 * One standard-normal sample for a lattice node, deterministic in (ix,iy,seed).
 * Box–Muller from two mulberry32 draws off the hashed state.
 */
function gaussianNode(ix: number, iy: number, seed: number): number {
  const rng = mulberry32(hashNode(ix, iy, seed));
  let u = rng();
  let v = rng();
  if (u < 1e-7) u = 1e-7;
  if (v < 1e-7) v = 1e-7;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Build a coarse lattice of standard-normal node values for a given cell size,
 * then return a per-pixel sampler that bilinearly interpolates it. Keying the
 * lattice in IMAGE coordinates (not pixel index) keeps grain resolution-stable.
 */
function makeNoiseField(
  width: number,
  height: number,
  cell: number,
  seed: number
): (x: number, y: number) => number {
  const s = Math.max(1, cell);
  const cols = Math.ceil(width / s) + 2;
  const rows = Math.ceil(height / s) + 2;
  const grid = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grid[j * cols + i] = gaussianNode(i, j, seed);
    }
  }
  return (x: number, y: number): number => {
    const fx = x / s;
    const fy = y / s;
    const ix = fx | 0;
    const iy = fy | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const i00 = iy * cols + ix;
    const a = grid[i00];
    const b = grid[i00 + 1];
    const c = grid[i00 + cols];
    const d = grid[i00 + cols + 1];
    const top = a + (b - a) * tx;
    const bot = c + (d - c) * tx;
    return top + (bot - top) * ty;
  };
}

/** Smooth bump centered at `c` with half-width `w` (for shadow/mid/high shaping). */
function bump(y: number, c: number, w: number): number {
  const d = (y - c) / w;
  return Math.exp(-d * d);
}

/**
 * Apply seeded structured grain in place. `data` is RGBA bytes in display space;
 * grain is added AFTER the colour look. Returns nothing (mutates `data`).
 */
export function applyGrain(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<GrainParams> = {}
): void {
  const p = { ...DEFAULT_GRAIN, ...params };
  if (p.intensity <= 0) return;

  const s = Math.max(1, p.grainSize);
  // Octave 1 dominant clump size; octave 2 a touch of fine structure.
  const lum1 = makeNoiseField(width, height, s, p.seed);
  const lum2 =
    p.roughness > 0 ? makeNoiseField(width, height, Math.max(1, s / 2), p.seed ^ 0x9e37) : null;
  // Normalise the 2-octave mix so Var(n) ≈ 1 (variances add for independent fields).
  const w2 = p.roughness;
  const octNorm = 1 / Math.sqrt((1 - w2) * (1 - w2) + w2 * w2);

  const useChroma = p.colorAmount > 0;
  const cR = useChroma ? makeNoiseField(width, height, s, p.seed ^ 0x1111) : null;
  const cG = useChroma ? makeNoiseField(width, height, s, p.seed ^ 0x2222) : null;
  const cB = useChroma ? makeNoiseField(width, height, s, p.seed ^ 0x3333) : null;

  const amp = p.intensity * 255;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Display luminance, normalised.
      const Y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Boolean-model variance envelope: peaks at mid, →0 at black/white.
      const base = Math.sqrt(Y * (1 - Y)) * 2;
      const shape =
        p.shadowWeight * bump(Y, 0.22, 0.25) +
        p.midWeight * bump(Y, 0.5, 0.3) +
        p.highWeight * bump(Y, 0.8, 0.25);
      const w = base * shape;
      if (w <= 0) continue;

      let n = lum1(x, y);
      if (lum2) n = (1 - w2) * n + w2 * lum2(x, y);
      n *= octNorm;

      const gLum = n * w * amp;
      if (useChroma && cR && cG && cB) {
        data[idx] = r + gLum + p.colorAmount * cR(x, y) * w * amp;
        data[idx + 1] = g + gLum + p.colorAmount * cG(x, y) * w * amp;
        data[idx + 2] = b + gLum + p.colorAmount * cB(x, y) * w * amp;
      } else {
        data[idx] = r + gLum;
        data[idx + 1] = g + gLum;
        data[idx + 2] = b + gLum;
      }
    }
  }
}

/**
 * Map a friendly 0..100 UI "amount" + an ISO-like film speed to an `intensity`.
 * Anchored to Kodak RMS granularity shape: ISO50≈0.008, 100≈0.010, 400≈0.018,
 * 1600≈0.035, 3200≈0.05. Approximate calibration, honest to the spec's shape.
 */
export function isoToGrainIntensity(iso: number): number {
  const i = Math.max(25, Math.min(6400, iso));
  // log-linear between the anchor points
  return 0.006 + 0.012 * (Math.log2(i / 50) / Math.log2(3200 / 50)) * 3.5;
}
