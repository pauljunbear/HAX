/**
 * Color Balance (3-way, Photoshop-style) — independent Cyan-Red / Magenta-Green
 * / Yellow-Blue pushes for shadows, midtones and highlights, with an optional
 * preserve-luminosity restore. This is the workhorse behind teal-orange and
 * day-for-night grades: cool the shadows, warm the highlights, leave the
 * midtones (or push them whichever way the look wants).
 *
 * WHY DISPLAY SPACE (not linear light). Most tonal/energy math in this engine is
 * done in linear light because it's additive radiance (exposure, blur, bloom,
 * halation). Color Balance is deliberately a DISPLAY-SPACE colour/curve tweak,
 * for two reasons:
 *   1. The shadow/mid/highlight ZONES are perceptual. A colourist means
 *      "the dark third of the gamma-encoded image" by shadows, and "mid-gray"
 *      (byte ~128) by midtones. Linear 0.5 is display byte ~188 — defining the
 *      zone masks in linear light would slide every zone far brighter than the
 *      operator expects and break the teal-orange muscle memory.
 *   2. The colour PUSH is the established Photoshop / DaVinci convention: an
 *      additive nudge of the gamma-encoded channels. Adding the same nudge in
 *      linear light makes a shadow tint perceptually explosive (a tiny linear
 *      add to a near-black pixel is a huge visible jump) and a highlight tint
 *      vanish. Display-space additive matches what every grading tool does.
 * So: zones AND push live in display space, on purpose. No light is being
 * spread or integrated here — it's a per-pixel curve, so this is correct.
 *
 * ALGORITHM (per pixel):
 *   1. lumaByte = round(0.2126R + 0.7152G + 0.0722B) on the display bytes.
 *   2. Three smooth zone masks from a raised-cosine partition of unity centred
 *      at black / mid-gray / white (each peaks at 1.0, the three SUM TO EXACTLY
 *      1 at every luma — cos^2 windows at 50% overlap, the classic Hann tiling).
 *      Precomputed once into 256-entry LUTs, so the hot loop is table reads.
 *   3. dR = (sCR*shadowW + mCR*midW + hCR*highW), likewise dG from the MG sliders
 *      and dB from the YB sliders. cr->+R, mg->+G, yb->+B; sliders are -100..100
 *      scaled by SHIFT_SCALE.
 *   4. Optional preserve-luminosity: restore the original display luma by adding
 *      the luma deficit equally to all three channels. Because the luma weights
 *      sum to 1, an equal add of d raises luma by exactly d, so this restores
 *      luma EXACTLY while keeping the chroma of the colour push intact.
 *
 * Banding: the push is a low-frequency, sub-byte add, and every write rounds
 * (not truncates) via clampByteRound — which removes the systematic downward
 * bias that would otherwise contour smooth gradients — so ordered dither isn't
 * needed here and is skipped to keep preview byte-identical to export.
 */

import { clampByteRound } from '../color-space';

export interface ColorBalanceParams {
  /** Shadows Cyan(-)..Red(+) push. */
  shadowCR: number;
  /** Shadows Magenta(-)..Green(+) push. */
  shadowMG: number;
  /** Shadows Yellow(-)..Blue(+) push. */
  shadowYB: number;
  /** Midtones Cyan(-)..Red(+) push. */
  midCR: number;
  /** Midtones Magenta(-)..Green(+) push. */
  midMG: number;
  /** Midtones Yellow(-)..Blue(+) push. */
  midYB: number;
  /** Highlights Cyan(-)..Red(+) push. */
  highCR: number;
  /** Highlights Magenta(-)..Green(+) push. */
  highMG: number;
  /** Highlights Yellow(-)..Blue(+) push. */
  highYB: number;
  /** Restore original luma after the push (>=0.5 = on). 0 = off, 1 = on. */
  preserveLuminosity: number;
}

export const COLORBALANCE_DEFAULTS: ColorBalanceParams = {
  shadowCR: 0,
  shadowMG: 0,
  shadowYB: 0,
  midCR: 0,
  midMG: 0,
  midYB: 0,
  highCR: 0,
  highMG: 0,
  highYB: 0,
  preserveLuminosity: 1,
};

/** Rec.709 luma weights (display-space, as Photoshop's Color Balance uses). */
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/**
 * Maximum normalized channel push at a full (+/-100) slider and full (1.0) zone
 * mask. 0.2 => a full midtone slider shifts mid-gray by ~51 bytes: strong but
 * not clipping, in the Photoshop/DaVinci range. Operators dial down from there.
 */
const SHIFT_SCALE = 0.2;

/**
 * Raised-cosine partition of unity over luma L in [0,1], centred at 0 / 0.5 / 1
 * with half-width 0.5. cos^2 windows at 50% overlap sum to exactly 1 (Hann
 * tiling): shadowW = cos^2(pi*L) and midW = sin^2(pi*L) for L<=0.5;
 * midW = cos^2(pi*(L-0.5)) and highW = sin^2(pi*(L-0.5)) for L>=0.5. Each lobe
 * peaks at 1.0 at its centre and is smooth (zero slope at the seam at L=0.5).
 */
const SHADOW_LUT = new Float32Array(256);
const MID_LUT = new Float32Array(256);
const HIGH_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const L = i / 255;
  if (L <= 0.5) {
    const c = Math.cos(Math.PI * L);
    const s = Math.sin(Math.PI * L);
    SHADOW_LUT[i] = c * c;
    MID_LUT[i] = s * s;
    HIGH_LUT[i] = 0;
  } else {
    const u = L - 0.5;
    const c = Math.cos(Math.PI * u);
    const s = Math.sin(Math.PI * u);
    SHADOW_LUT[i] = 0;
    MID_LUT[i] = c * c;
    HIGH_LUT[i] = s * s;
  }
}

/**
 * Apply 3-way color balance in place. `data` is RGBA bytes (display sRGB);
 * alpha is left untouched. Mutates `data`.
 */
export function applyColorBalance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<ColorBalanceParams> = {}
): void {
  const p = { ...COLORBALANCE_DEFAULTS, ...params };

  // No-op when nothing is pushed (preserve-luminosity alone changes nothing).
  if (
    !(
      p.shadowCR ||
      p.shadowMG ||
      p.shadowYB ||
      p.midCR ||
      p.midMG ||
      p.midYB ||
      p.highCR ||
      p.highMG ||
      p.highYB
    )
  ) {
    return;
  }

  const preserve = p.preserveLuminosity >= 0.5;
  const k = SHIFT_SCALE / 100; // slider (-100..100) -> normalized push

  const sCR = p.shadowCR * k;
  const sMG = p.shadowMG * k;
  const sYB = p.shadowYB * k;
  const mCR = p.midCR * k;
  const mMG = p.midMG * k;
  const mYB = p.midYB * k;
  const hCR = p.highCR * k;
  const hMG = p.highMG * k;
  const hYB = p.highYB * k;

  const n = width * height * 4;
  for (let i = 0; i < n; i += 4) {
    const R = data[i];
    const G = data[i + 1];
    const B = data[i + 2];

    // Zone weights from the input tone (display-space luma).
    const lb = (LR * R + LG * G + LB * B + 0.5) | 0;
    const sW = SHADOW_LUT[lb];
    const mW = MID_LUT[lb];
    const hW = HIGH_LUT[lb];

    const dR = sCR * sW + mCR * mW + hCR * hW;
    const dG = sMG * sW + mMG * mW + hMG * hW;
    const dB = sYB * sW + mYB * mW + hYB * hW;

    let r = R / 255 + dR;
    let g = G / 255 + dG;
    let b = B / 255 + dB;

    if (preserve) {
      const before = (LR * R + LG * G + LB * B) / 255;
      const after = LR * r + LG * g + LB * b;
      const d = before - after; // equal add restores luma exactly
      r += d;
      g += d;
      b += d;
    }

    data[i] = clampByteRound(r * 255);
    data[i + 1] = clampByteRound(g * 255);
    data[i + 2] = clampByteRound(b * 255);
    // alpha (data[i + 3]) untouched
  }
}

export const COLORBALANCE_EFFECT = {
  id: 'colorBalance',
  label: 'Color Balance',
  category: 'Color',
  settings: [
    {
      id: 'shadowCR',
      label: 'Shadows Cyan–Red',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push shadows toward cyan (−) or red (+).',
    },
    {
      id: 'shadowMG',
      label: 'Shadows Magenta–Green',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push shadows toward magenta (−) or green (+).',
    },
    {
      id: 'shadowYB',
      label: 'Shadows Yellow–Blue',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push shadows toward yellow (−) or blue (+).',
    },
    {
      id: 'midCR',
      label: 'Midtones Cyan–Red',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push midtones toward cyan (−) or red (+).',
    },
    {
      id: 'midMG',
      label: 'Midtones Magenta–Green',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push midtones toward magenta (−) or green (+).',
    },
    {
      id: 'midYB',
      label: 'Midtones Yellow–Blue',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push midtones toward yellow (−) or blue (+).',
    },
    {
      id: 'highCR',
      label: 'Highlights Cyan–Red',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push highlights toward cyan (−) or red (+).',
    },
    {
      id: 'highMG',
      label: 'Highlights Magenta–Green',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push highlights toward magenta (−) or green (+).',
    },
    {
      id: 'highYB',
      label: 'Highlights Yellow–Blue',
      min: -100,
      max: 100,
      default: 0,
      step: 1,
      description: 'Push highlights toward yellow (−) or blue (+).',
    },
    {
      id: 'preserveLuminosity',
      label: 'Preserve Luminosity',
      min: 0,
      max: 1,
      default: 1,
      step: 1,
      description: 'Restore original brightness after the colour push.',
    },
  ],
} as const;
