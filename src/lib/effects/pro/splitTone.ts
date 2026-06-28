/**
 * Split Toning — tint the shadows one hue and the highlights another, while
 * preserving each pixel's luminance. Tiny code, enormous stylistic range: the
 * classic teal-shadow / warm-highlight cinema grade, faded-film duotones,
 * cross-process looks, all from five sliders.
 *
 * Why display space (not linear): split toning is a *tonal colour grade*. The
 * photographer's "shadows" and "highlights" are regions of the DISPLAYED tone
 * curve (the zone-system / Lightroom sense), and "luma-preserving" here means
 * the grade must not change the picture's *perceived* exposure. So both the
 * shadow/highlight masks and the luminance we restore use Rec.601 display luma
 * (0.299/0.587/0.114) — the same convention the engine's saturation and grain
 * passes use. The quality bar permits display-space colour/curve tweaks when
 * justified; this is one (it is chroma redistribution, not additive light).
 *
 * Per-pixel algorithm:
 *   1. luma = Rec.601 display luma, normalised 0..1.
 *   2. Remap luma so the crossover sits at `pivot` (driven by `balance`); a
 *      positive balance lowers the pivot so more of the image reads as
 *      highlight (favouring the highlight colour), matching Lightroom's slider.
 *   3. shadowWeight = smoothstep(1 − lumaRemapped), highWeight = smoothstep(lumaRemapped).
 *   4. tint amount per band = weight × (sat/100); lerp the pixel toward the
 *      band's pure-hue colour by that amount (shadows then highlights).
 *   5. Restore luma: add (origLuma − newLuma) to all three channels. Equal
 *      offsets preserve the chroma differences (R−G, G−B) exactly while forcing
 *      luminance back to the original — the defining luma-preserving move.
 *   6. Quantise with clampByteRound, plus a sub-LSB ordered (Bayer) dither
 *      scaled by tint activity so smooth graded skies don't band. The dither is
 *      a fixed positional pattern (no RNG), so preview == export, and it is
 *      gated to zero where no tint is applied — defaults are an exact no-op.
 *
 * Single O(n) pass; no allocations beyond the constant Bayer table. Alpha is
 * passed through untouched.
 */

import { clampByteRound } from '../color-space';

export interface SplitToneParams {
  /** Hue applied to the shadows, degrees 0..360. */
  shadowHue: number;
  /** Saturation / strength of the shadow tint, 0..100 (0 = no shadow tint). */
  shadowSat: number;
  /** Hue applied to the highlights, degrees 0..360. */
  highlightHue: number;
  /** Saturation / strength of the highlight tint, 0..100 (0 = no highlight tint). */
  highlightSat: number;
  /** Crossover bias, −100..100. >0 favours the highlight colour, <0 the shadow colour. */
  balance: number;
}

export const SPLITTONE_DEFAULTS: SplitToneParams = {
  shadowHue: 220,
  shadowSat: 0,
  highlightHue: 45,
  highlightSat: 0,
  balance: 0,
};

/** Clamp a smoothstep input to [0,1] and apply the cubic smoothstep. */
function smooth01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/**
 * Pure-hue RGB (HSL with S=1, L=0.5) for a hue in degrees, components 0..1.
 * hue 0 = red, 120 = green, 240 = blue. Chroma C = 1, lightness offset m = 0.
 */
function hueToRgb(hueDeg: number): [number, number, number] {
  let h = hueDeg % 360;
  if (h < 0) h += 360;
  const hp = h / 60;
  const x = 1 - Math.abs((hp % 2) - 1);
  if (hp < 1) return [1, x, 0];
  if (hp < 2) return [x, 1, 0];
  if (hp < 3) return [0, 1, x];
  if (hp < 4) return [0, x, 1];
  if (hp < 5) return [x, 0, 1];
  return [1, 0, x];
}

/**
 * Piecewise-linear monotonic remap of luma so that `pivot` maps to 0.5,
 * keeping 0→0 and 1→1. Moving the pivot slides the shadow/highlight crossover.
 */
function remapPivot(luma: number, pivot: number): number {
  if (luma <= 0) return 0;
  if (luma >= 1) return 1;
  if (luma < pivot) return 0.5 * (luma / pivot);
  return 0.5 + 0.5 * ((luma - pivot) / (1 - pivot));
}

// 4×4 Bayer matrix (values 0..15) for deterministic ordered dithering.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const R_LUMA = 0.299;
const G_LUMA = 0.587;
const B_LUMA = 0.114;

/**
 * Apply Split Toning in place over RGBA bytes (display sRGB). Mutates `data`.
 */
export function applySplitTone(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<SplitToneParams>
): void {
  const p = { ...SPLITTONE_DEFAULTS, ...params };

  const sSat = Math.max(0, Math.min(100, p.shadowSat)) / 100;
  const hSat = Math.max(0, Math.min(100, p.highlightSat)) / 100;

  // Nothing to do — keep it an exact no-op (defaults land here).
  if (sSat <= 0 && hSat <= 0) return;

  const [sr, sg, sb] = hueToRgb(p.shadowHue);
  const [hr, hg, hb] = hueToRgb(p.highlightHue);

  // balance −100..100 → pivot 0.8..0.2. >0 lowers pivot ⇒ more "highlight".
  const b = Math.max(-100, Math.min(100, p.balance)) / 100;
  let pivot = 0.5 - 0.3 * b;
  if (pivot < 0.05) pivot = 0.05;
  else if (pivot > 0.95) pivot = 0.95;

  for (let y = 0; y < height; y++) {
    const bayerRow = (y & 3) * 4;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const bch = data[i + 2] / 255;

      const luma = R_LUMA * r + G_LUMA * g + B_LUMA * bch;

      const lr = remapPivot(luma, pivot);
      const shadowW = smooth01(1 - lr);
      const highW = smooth01(lr);

      const sa = shadowW * sSat;
      const ha = highW * hSat;

      // Lerp toward each band's hue colour (shadows first, then highlights).
      let nr = r + (sr - r) * sa;
      let ng = g + (sg - g) * sa;
      let nb = bch + (sb - bch) * sa;
      nr = nr + (hr - nr) * ha;
      ng = ng + (hg - ng) * ha;
      nb = nb + (hb - nb) * ha;

      // Luma-preserving restore: equal offset keeps chroma, forces luma back.
      const newLuma = R_LUMA * nr + G_LUMA * ng + B_LUMA * nb;
      const d = luma - newLuma;
      nr += d;
      ng += d;
      nb += d;

      // Sub-LSB ordered dither, scaled by how much tint this pixel received,
      // so untouched pixels stay exact. Deterministic (no RNG): preview==export.
      const activity = sa + ha > 1 ? 1 : sa + ha;
      const dith = ((BAYER4[bayerRow + (x & 3)] + 0.5) / 16 - 0.5) * activity;

      data[i] = clampByteRound(nr * 255 + dith);
      data[i + 1] = clampByteRound(ng * 255 + dith);
      data[i + 2] = clampByteRound(nb * 255 + dith);
      // alpha (data[i + 3]) untouched
    }
  }
}

export const SPLITTONE_EFFECT = {
  id: 'splitTone',
  label: 'Split Toning',
  category: 'Color',
  settings: [
    {
      id: 'shadowHue',
      label: 'Shadow Hue',
      min: 0,
      max: 360,
      default: SPLITTONE_DEFAULTS.shadowHue,
      step: 1,
      description: 'Hue tinted into the shadows (degrees).',
    },
    {
      id: 'shadowSat',
      label: 'Shadow Saturation',
      min: 0,
      max: 100,
      default: SPLITTONE_DEFAULTS.shadowSat,
      step: 1,
      description: 'Strength of the shadow tint. 0 leaves shadows untinted.',
    },
    {
      id: 'highlightHue',
      label: 'Highlight Hue',
      min: 0,
      max: 360,
      default: SPLITTONE_DEFAULTS.highlightHue,
      step: 1,
      description: 'Hue tinted into the highlights (degrees).',
    },
    {
      id: 'highlightSat',
      label: 'Highlight Saturation',
      min: 0,
      max: 100,
      default: SPLITTONE_DEFAULTS.highlightSat,
      step: 1,
      description: 'Strength of the highlight tint. 0 leaves highlights untinted.',
    },
    {
      id: 'balance',
      label: 'Balance',
      min: -100,
      max: 100,
      default: SPLITTONE_DEFAULTS.balance,
      step: 1,
      description: 'Shifts the shadow/highlight crossover. >0 favours highlights, <0 shadows.',
    },
  ],
} as const;
