/**
 * HSL Secondary qualifier — a maskless, hue-targeted recolor in the spirit of a
 * colorist's secondary (the "qualifier" in DaVinci Resolve / Lightroom's HSL
 * targeted adjust). You pick a hue band on the color wheel, feather its edge,
 * and push that band's hue / saturation / lightness — so you can turn the sky
 * teal or pop the reds without painting a mask.
 *
 * Per pixel: RGB -> HSL, compute a feathered SELECTION WEIGHT from how close the
 * pixel's hue is to `targetHue` (a smooth plateau out to ±range/2, then a
 * softness-controlled feather to zero), apply hueShift / satShift / lumShift
 * SCALED BY that weight, then HSL -> RGB. Hue wraps at 360.
 *
 * COLOR SPACE — deliberately DISPLAY (gamma) space, not linear light. HSL is
 * defined on the gamma-encoded RGB signal, and hue qualifiers are a chroma/hue
 * manipulation that colorists perform on the encoded image; the hue wheel and
 * the perceptual "lightness" of HSL only mean what users expect when computed on
 * the display-encoded bytes. This is the contract's sanctioned display-space case
 * (a color/curve tweak), not an additive-light operation — there is no energy
 * spreading or exposure math here that would require linearization.
 *
 * QUALITY NOTES
 *  - Near-gray pixels (S -> 0) have a numerically meaningless / noisy hue, so a
 *    gentle saturation gate softly excludes them from the selection. This stops
 *    the effect from recoloring neutrals (a classic qualifier artifact).
 *  - Pixels with zero selection weight are left BYTE-IDENTICAL (early skip), and
 *    the whole pass early-returns when all three shifts are 0, so neutral params
 *    are an exact no-op (no lossy HSL round-trip on untouched pixels).
 *  - Rounding uses clampByteRound to avoid the downward ~0.5 LSB bias of `| 0`.
 *  - Deterministic: no randomness is used, so the live preview always equals the
 *    export and no `seed` setting is needed.
 */

import { clampByteRound } from '../color-space';

export interface HslSecondaryParams {
  /** Center hue of the selection, degrees on the color wheel. 0..360. */
  targetHue: number;
  /** Full width of the selected hue band, degrees. The 50% point sits at ±range/2. 5..180. */
  range: number;
  /** Feather amount for the selection edge. 0 = hard, 100 = fully gradual. 0..100. */
  softness: number;
  /** Hue rotation applied to the selection, degrees, scaled by weight. -180..180. */
  hueShift: number;
  /** Saturation push within the selection (additive in S, /100), scaled by weight. -100..100. */
  satShift: number;
  /** Lightness push within the selection (additive in L, /100), scaled by weight. -100..100. */
  lumShift: number;
}

export const HSLSECONDARY_DEFAULTS: HslSecondaryParams = {
  targetHue: 210,
  range: 40,
  softness: 40,
  hueShift: 0,
  satShift: 0,
  lumShift: 0,
};

/** Saturation below which hue is treated as meaningless; below this the selection feathers out. */
const SAT_GATE = 0.06;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Hermite smoothstep over [e0,e1]; returns 0 below e0, 1 above e1, smooth between. */
function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** RGB (0..1) -> HSL with H in degrees [0,360), S and L in [0,1]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l]; // achromatic
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  else if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** HSL (H degrees, S,L in [0,1]) -> RGB (0..1). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s <= 0) return [l, l, l]; // achromatic
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [hue2rgb(p, q, hk + 1 / 3), hue2rgb(p, q, hk), hue2rgb(p, q, hk - 1 / 3)];
}

/**
 * Apply the HSL secondary qualifier in place. `data` is RGBA bytes in display
 * space. Mutates `data`; returns nothing.
 */
export function applyHslSecondary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<HslSecondaryParams> = {}
): void {
  const p = { ...HSLSECONDARY_DEFAULTS, ...params };

  // Neutral params -> exact no-op (skip the lossy HSL round-trip entirely).
  if (p.hueShift === 0 && p.satShift === 0 && p.lumShift === 0) return;

  const target = ((p.targetHue % 360) + 360) % 360;
  const range = Math.max(0, p.range);
  const half = range / 2;
  const feather = (Math.max(0, Math.min(100, p.softness)) / 100) * half;
  const inner = half - feather / 2;
  const outer = half + feather / 2;

  const dHue = p.hueShift;
  const dSat = p.satShift / 100;
  const dLum = p.lumShift / 100;

  const n = width * height;
  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;

    const [h, s, l] = rgbToHsl(r, g, b);

    // Circular hue distance in [0,180].
    let d = Math.abs(h - target);
    if (d > 180) d = 360 - d;

    // Feathered membership of the hue band.
    let w: number;
    if (outer - inner < 1e-9) {
      w = d <= half ? 1 : 0; // softness 0 -> hard edge
    } else if (d <= inner) {
      w = 1;
    } else if (d >= outer) {
      w = 0;
    } else {
      w = 1 - smoothstep(inner, outer, d);
    }

    // Gate out near-gray pixels whose hue is meaningless.
    w *= smoothstep(0, SAT_GATE, s);

    if (w <= 0) continue; // untouched pixels stay byte-identical

    let hn = h + dHue * w;
    hn = ((hn % 360) + 360) % 360; // wrap at 360
    const sn = clamp01(s + dSat * w);
    const ln = clamp01(l + dLum * w);

    const [nr, ng, nb] = hslToRgb(hn, sn, ln);
    data[idx] = clampByteRound(nr * 255);
    data[idx + 1] = clampByteRound(ng * 255);
    data[idx + 2] = clampByteRound(nb * 255);
    // alpha (idx+3) untouched
  }
}

export const HSLSECONDARY_EFFECT = {
  id: 'hslSecondary',
  label: 'HSL Secondary',
  category: 'Color',
  settings: [
    {
      id: 'targetHue',
      label: 'Target Hue',
      min: 0,
      max: 360,
      default: 210,
      step: 1,
      description: 'Center hue of the selection (degrees on the color wheel).',
    },
    {
      id: 'range',
      label: 'Range',
      min: 5,
      max: 180,
      default: 40,
      step: 1,
      description: 'Width of the selected hue band (degrees); the 50% point sits at ±range/2.',
    },
    {
      id: 'softness',
      label: 'Softness',
      min: 0,
      max: 100,
      default: 40,
      step: 1,
      description: 'Feathers the selection edge. 0 = hard edge, 100 = fully gradual.',
    },
    {
      id: 'hueShift',
      label: 'Hue Shift',
      min: -180,
      max: 180,
      default: 0,
      step: 1,
      description: 'Rotate the selected hues (degrees), scaled by selection weight.',
    },
    {
      id: 'satShift',
      label: 'Saturation',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Boost or cut saturation within the selection.',
    },
    {
      id: 'lumShift',
      label: 'Lightness',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Lighten or darken within the selection.',
    },
  ],
} as const;
