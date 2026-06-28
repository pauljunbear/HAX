/**
 * Clarity — midtone-masked local contrast (the pro "Clarity" slider).
 *
 * Clarity is a large-radius UNSHARP MASK applied to LUMINANCE only, so it adds
 * "punch" / micro-contrast without shifting hue or saturation. It is masked to
 * the midtones so blown highlights and crushed shadows are protected (the
 * Lightroom behaviour). Negative amount runs the mask in reverse, softening
 * local contrast for a dreamy / "Orton-lite" feel.
 *
 * Algorithm
 *   1. Decode to LINEAR light and compute linear luminance
 *        Y = 0.2126R + 0.7152G + 0.0722B.
 *   2. Blur the luminance plane with a large-radius separable Gaussian — IN
 *      LINEAR LIGHT, because a blur spreads optical energy and is only
 *      physically correct (no muddy / darkened halos) in linear. This is the
 *      low-frequency base.
 *   3. detail = Y − Yblur  (the high/mid-frequency local contrast, in linear).
 *   4. newY = Y + gain · detail · midtoneMask.
 *   5. Rescale each linear RGB channel by newY / Y. Multiplying all three
 *      channels by the same ratio scales luminance to exactly newY while
 *      leaving the channel RATIOS — i.e. hue and saturation — untouched. That
 *      is what makes Clarity a luminance-only operator.
 *   6. Re-encode to sRGB bytes (clamped, rounded).
 *
 * Why the mask is computed in DISPLAY (gamma) space while the detail/blur are
 * computed in LINEAR space: "midtone" is a perceptual notion — perceptual
 * mid-grey is byte 128, i.e. display-normalised 0.5, which maps to linear
 * ~0.215. A tent built on linear luma would peak at linear 0.5 (byte ~188) and
 * wrongly treat bright pixels as "midtones." So the protection tent is built on
 * the gamma-encoded luma Y' (the perceptual quantity), while the energy math
 * (blur + high-pass + rescale) stays in linear where it is physically correct.
 *
 * Determinism: this effect uses NO randomness — output is a pure function of the
 * input pixels and params — so there is no `seed` setting. Preview == export.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte } from '../color-space';

export interface ClarityParams {
  /** -100..100. Local-contrast strength. 0 = no-op, + = punch, − = soften. */
  amount: number;
  /** 5..150. Unsharp blur radius (px). Larger = broader, more "structural" contrast. */
  radius: number;
  /** 0..100. How strongly highlights & shadows are protected (midtone-only at 100). */
  protectTones: number;
}

export const CLARITY_DEFAULTS: ClarityParams = {
  amount: 0,
  radius: 40,
  protectTones: 50,
};

/** amount=±100 maps to this peak high-pass gain. Visible punch without destroying tone. */
const MAX_GAIN = 1.5;
/** Luma below this (linear) is treated as black: scale multiplicatively is undefined, add instead. */
const EPS = 1e-6;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Separable Gaussian blur of a single-channel Float32 plane, in place-safe
 * (returns a new buffer). Edges clamp (extend). sigma = radius / 3 to match the
 * engine's separableGaussianBlur convention; kernel half-width = round(radius).
 */
function blurLumaPlane(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const half = Math.max(1, Math.round(radius));
  const sigma = Math.max(1e-3, half / 3);
  const inv2s2 = 1 / (2 * sigma * sigma);

  const kernel = new Float32Array(half * 2 + 1);
  let sum = 0;
  for (let k = -half; k <= half; k++) {
    const v = Math.exp(-(k * k) * inv2s2);
    kernel[k + half] = v;
    sum += v;
  }
  const invSum = 1 / sum;
  for (let k = 0; k < kernel.length; k++) kernel[k] *= invSum;

  const tmp = new Float32Array(width * height);
  // Horizontal pass.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        let sx = x + k;
        if (sx < 0) sx = 0;
        else if (sx >= width) sx = width - 1;
        acc += src[row + sx] * kernel[k + half];
      }
      tmp[row + x] = acc;
    }
  }
  // Vertical pass.
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -half; k <= half; k++) {
        let sy = y + k;
        if (sy < 0) sy = 0;
        else if (sy >= height) sy = height - 1;
        acc += tmp[sy * width + x] * kernel[k + half];
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

/**
 * Apply Clarity in place. `data` is RGBA bytes (display sRGB). Alpha untouched.
 */
export function applyClarity(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<ClarityParams> = {}
): void {
  if (width <= 0 || height <= 0) return;

  const p = { ...CLARITY_DEFAULTS, ...params };
  const amountNorm = clamp(p.amount, -100, 100) / 100;
  // amount 0 is an exact no-op — return before any decode/encode round-trip so
  // the neutral identity is bit-exact (and to skip the blur cost).
  if (amountNorm === 0) return;

  const radius = clamp(p.radius, 5, 150);
  const protect = clamp(p.protectTones, 0, 100) / 100;
  const gain = amountNorm * MAX_GAIN;

  const n = width * height;

  // Pass 1 — linear luminance plane (input to the blur).
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const lr = SRGB_TO_LINEAR[data[j]];
    const lg = SRGB_TO_LINEAR[data[j + 1]];
    const lb = SRGB_TO_LINEAR[data[j + 2]];
    luma[i] = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  }

  // Low-frequency base (linear-light blur).
  const blurred = blurLumaPlane(luma, width, height, radius);

  // Pass 2 — recombine. Read each original byte BEFORE overwriting it, so the
  // display-luma mask sees the untouched pixel.
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const r = data[j];
    const g = data[j + 1];
    const b = data[j + 2];

    const Y = luma[i];
    const detail = Y - blurred[i];

    // Perceptual midtone tent on gamma luma Y' (display-normalised 0..1).
    const Yd = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const tent = 1 - Math.abs(2 * Yd - 1); // 0 at black/white, 1 at mid-grey
    const bump = tent * tent * (3 - 2 * tent); // smoothstep → rounded shoulders
    // protect=0 → mask≡1 (affect all tones); protect=1 → mask=bump (midtones only).
    const mask = 1 - protect * (1 - bump);

    let newY = Y + gain * detail * mask;
    if (newY < 0) newY = 0;

    let outR: number;
    let outG: number;
    let outB: number;
    if (Y > EPS) {
      // Multiplicative luminance rescale — preserves hue & saturation exactly.
      const ratio = newY / Y;
      outR = SRGB_TO_LINEAR[r] * ratio;
      outG = SRGB_TO_LINEAR[g] * ratio;
      outB = SRGB_TO_LINEAR[b] * ratio;
    } else {
      // Near-black: no hue to preserve. Add the luminance delta neutrally.
      const add = newY; // Y ≈ 0
      outR = SRGB_TO_LINEAR[r] + add;
      outG = SRGB_TO_LINEAR[g] + add;
      outB = SRGB_TO_LINEAR[b] + add;
    }

    data[j] = linearToSrgbByte(outR);
    data[j + 1] = linearToSrgbByte(outG);
    data[j + 2] = linearToSrgbByte(outB);
    // alpha (data[j + 3]) untouched.
  }
}

/** HAX effect descriptor (one setting per ClarityParams field; defaults mirror CLARITY_DEFAULTS). */
export const CLARITY_EFFECT = {
  id: 'clarity',
  label: 'Clarity',
  category: 'Adjust',
  settings: [
    {
      id: 'amount',
      label: 'Amount',
      min: -100,
      max: 100,
      default: CLARITY_DEFAULTS.amount,
      step: 1,
      description: 'Local-contrast strength. Positive adds midtone punch; negative softens.',
    },
    {
      id: 'radius',
      label: 'Radius',
      min: 5,
      max: 150,
      default: CLARITY_DEFAULTS.radius,
      step: 1,
      description: 'Unsharp blur radius in pixels. Larger = broader, more structural contrast.',
    },
    {
      id: 'protectTones',
      label: 'Protect Tones',
      min: 0,
      max: 100,
      default: CLARITY_DEFAULTS.protectTones,
      step: 1,
      description: 'How strongly highlights and shadows are shielded (midtones-only at 100).',
    },
  ],
} as const;
