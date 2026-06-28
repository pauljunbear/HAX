/**
 * Film substrate — the shared, physically-ordered pipeline every emulated stock
 * runs through. This is the piece the old engine lacked entirely: there was no
 * per-channel tone curve and no colour matrix, so the six "film" looks were just
 * ad-hoc channel multiplies on gamma bytes (no toe/shoulder, hard-clipped
 * highlights, casts baked in by feel rather than from the stock's characteristic
 * curve). See docs/EFFECTS_AUDIT_AND_ROADMAP.md §3.1.
 *
 * Pipeline (a FilmRecipe declares each stage; all optional):
 *   sRGB byte → linear
 *     → white-balance gains + 3×3 matrix        (the cast / dye crosstalk)        [linear]
 *     → optional B&W channel mix                 (panchromatic gray)               [linear]
 *   → back to display
 *     → per-channel characteristic curve         (toe + shoulder + crossover)      [display]
 *     → saturation (luma-preserving)             (the colour signature)           [display]
 *   → halation pass (reusable, linear)
 *   → seeded grain pass (reusable, display)
 *   → blend with original by `strength`          (the effect's intensity slider)
 *
 * Tone curves are authored as display-space control points (matching how the
 * research recipes were derived) and prebaked to 256-entry LUTs. A real shoulder
 * (the top control point rolling off below 1.0, or a gentle slope) is what stops
 * the flat clipped highlights the audit flagged.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte, clampByteRound } from '../color-space';
import { applyHalation, type HalationParams } from './halation';
import { applyGrain, type GrainParams } from './grain';

export type CurvePoint = [number, number];

export interface FilmRecipe {
  name: string;
  /** User-facing label (may differ from the trademarked stock name). */
  displayName?: string;
  /** Short description of the signature look. */
  blurb?: string;
  /** Linear-light per-channel white-balance gains. */
  gain?: [number, number, number];
  /** Optional 3×3 colour matrix (row-major), applied in linear after gain. */
  matrix?: number[];
  /** Black/white channel-mix weights (linear). If set, the look is monochrome. */
  bw?: [number, number, number];
  /** Per-channel display-space characteristic curves (control points 0..1). */
  curveR?: CurvePoint[];
  curveG?: CurvePoint[];
  curveB?: CurvePoint[];
  /** Master curve, used for any channel without its own. */
  curve?: CurvePoint[];
  /** Global saturation multiplier (display, luma-preserving). 1 = unchanged. */
  saturation?: number;
  /** Halation defaults for this stock (omit ⇒ no halation). */
  halation?: Partial<HalationParams>;
  /** Grain defaults for this stock (omit ⇒ no grain). */
  grain?: Partial<GrainParams>;
}

export interface ApplyOptions {
  /** 0..1 blend with the original (the effect intensity). Default 1. */
  strength?: number;
  /** Run the halation pass if the recipe defines one. Default true. */
  halation?: boolean;
  /** Run the grain pass if the recipe defines one. Default true. */
  grain?: boolean;
  /** Grain seed (preview==export). Overrides recipe.grain.seed. */
  grainSeed?: number;
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolant through control points, clamped
 * flat outside the x-range. Guarantees no overshoot — essential for tone curves
 * (an overshooting spline would create false contrast reversals).
 */
export function monotoneCubic(points: CurvePoint[]): (t: number) => number {
  const pts = points
    .map(p => [Math.min(1, Math.max(0, p[0])), Math.min(1, Math.max(0, p[1]))] as CurvePoint)
    .sort((a, b) => a[0] - b[0]);
  // de-dupe identical x
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of pts) {
    if (xs.length && Math.abs(x - xs[xs.length - 1]) < 1e-9) {
      ys[ys.length - 1] = y;
    } else {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n === 0) return (t: number) => t;
  if (n === 1) return () => ys[0];

  const d = new Array(n - 1);
  for (let k = 0; k < n - 1; k++) d[k] = (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const a = m[k] / d[k];
      const b = m[k + 1] / d[k];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[k] = tau * a * d[k];
        m[k + 1] = tau * b * d[k];
      }
    }
  }

  return (t: number): number => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (k < n - 1 && t > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k];
    const s = (t - xs[k]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const v = h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1];
    return v < 0 ? 0 : v > 1 ? 1 : v;
  };
}

/** Build a 256-entry byte→byte LUT from display-space control points. */
export function buildCurveLUT(points?: CurvePoint[]): Uint8ClampedArray | null {
  if (!points || points.length === 0) return null;
  const f = monotoneCubic(points);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = clampByteRound(f(i / 255) * 255);
  return lut;
}

/** Apply a full film recipe in place over RGBA bytes. */
export function applyFilmStock(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  recipe: FilmRecipe,
  opts: ApplyOptions = {}
): void {
  const strength = opts.strength ?? 1;
  if (strength <= 0) return;

  const original = strength < 1 ? Uint8ClampedArray.from(data) : null;

  const gain = recipe.gain ?? [1, 1, 1];
  const m = recipe.matrix;
  const bw = recipe.bw;

  // ---- linear stage: gains + matrix + optional B&W mix ----
  if (recipe.gain || m || bw) {
    for (let i = 0; i < data.length; i += 4) {
      let lr = SRGB_TO_LINEAR[data[i]] * gain[0];
      let lg = SRGB_TO_LINEAR[data[i + 1]] * gain[1];
      let lb = SRGB_TO_LINEAR[data[i + 2]] * gain[2];
      if (m) {
        const nr = m[0] * lr + m[1] * lg + m[2] * lb;
        const ng = m[3] * lr + m[4] * lg + m[5] * lb;
        const nb = m[6] * lr + m[7] * lg + m[8] * lb;
        lr = nr;
        lg = ng;
        lb = nb;
      }
      if (bw) {
        const gray = bw[0] * lr + bw[1] * lg + bw[2] * lb;
        lr = lg = lb = gray;
      }
      data[i] = linearToSrgbByte(lr);
      data[i + 1] = linearToSrgbByte(lg);
      data[i + 2] = linearToSrgbByte(lb);
    }
  }

  // ---- display stage: per-channel characteristic curves ----
  const lutR = buildCurveLUT(recipe.curveR ?? recipe.curve);
  const lutG = buildCurveLUT(recipe.curveG ?? recipe.curve);
  const lutB = buildCurveLUT(recipe.curveB ?? recipe.curve);
  if (lutR || lutG || lutB) {
    for (let i = 0; i < data.length; i += 4) {
      if (lutR) data[i] = lutR[data[i]];
      if (lutG) data[i + 1] = lutG[data[i + 1]];
      if (lutB) data[i + 2] = lutB[data[i + 2]];
    }
  }

  // ---- display stage: saturation (luma-preserving) ----
  const sat = recipe.saturation ?? 1;
  if (sat !== 1 && !bw) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clampByteRound(luma + (r - luma) * sat);
      data[i + 1] = clampByteRound(luma + (g - luma) * sat);
      data[i + 2] = clampByteRound(luma + (b - luma) * sat);
    }
  }

  // ---- reusable passes ----
  if (recipe.halation && opts.halation !== false) {
    applyHalation(data, width, height, recipe.halation);
  }
  if (recipe.grain && opts.grain !== false) {
    const seed = opts.grainSeed ?? recipe.grain.seed ?? 1;
    applyGrain(data, width, height, { ...recipe.grain, seed });
  }

  // ---- strength blend with the untouched original ----
  if (original) {
    const a = strength;
    const ia = 1 - a;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByteRound(data[i] * a + original[i] * ia);
      data[i + 1] = clampByteRound(data[i + 1] * a + original[i + 1] * ia);
      data[i + 2] = clampByteRound(data[i + 2] * a + original[i + 2] * ia);
    }
  }
}
