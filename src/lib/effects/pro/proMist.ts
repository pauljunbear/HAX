/**
 * Pro-Mist / Black-Mist diffusion — the cinematic diffusion filter.
 *
 * A diffusion filter (Tiffen Pro-Mist / Black Pro-Mist) physically scatters a
 * fraction of the light passing through it. Bright sources spread a soft glow
 * (bloom / atmosphere) into their surroundings, and on a plain Pro-Mist that
 * scatter also settles a low, near-uniform veil across the frame that LIFTS the
 * blacks and lowers contrast — the classic hazy, "milky shadows" look.
 *
 * The Black-Mist (Black Pro-Mist) variant uses a diffusion material that
 * suppresses that shadow veil: highlights still bloom, but the blacks stay
 * crisp. The `blackRetention` control is exactly that axis — at 0 you get a full
 * Pro-Mist (lifted, veiled blacks); at 100 you get a Black-Mist (blacks held).
 *
 * Because scatter is additive LIGHT, every step is done in LINEAR light. The
 * highlight extraction, the energy-spreading blur, and the screen recombine are
 * all radiance math; doing them on gamma-encoded bytes muddies the bloom and
 * shifts its hue. We decode through the SRGB_TO_LINEAR LUT and re-encode with
 * linearToSrgbByte (which rounds + clamps, so no truncation banding).
 *
 * Algorithm:
 *   1. Linearise; linear luma Y = 0.2126R + 0.7152G + 0.0722B.
 *   2. Soft highlight mask m = smoothstep(T, T+knee, Y); highlight SOURCE keeps
 *      the pixel's own colour: src = linearRGB * m (a coloured light glows in
 *      its colour).
 *   3. TWO summed linear blurs of the source:
 *        - a TIGHT bloom  (the halo that hugs each highlight) — always kept,
 *          so point-lights still flare even against a dark field;
 *        - a WIDE veil    (the far-spreading glare) — this is what fogs the
 *          shadows, so it is GATED by blackRetention.
 *   4. Gate the WIDE veil by where the underlying pixel actually is lit:
 *        lit  = smoothstep(0, T, baseY)          // 1 in highlights, 0 in deep shadow
 *        gate = lit + (1 - retention)*(1 - lit)  // shadows keep only (1-retention) of the veil
 *      retention=0 → gate=1 everywhere (full veil, lifted blacks = Pro-Mist);
 *      retention=1 → gate=lit (veil only where already lit = crisp blacks = Black-Mist).
 *   5. Recombine via SCREEN in linear light:
 *        glow = I*(wTight*tight + wWide*wide*gate)
 *        out  = 1 - (1 - base)*(1 - clamp01(glow))
 *   6. Re-encode to sRGB bytes.
 *
 * No randomness is used, so the live preview is byte-identical to the export.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte } from '../color-space';

export interface ProMistParams {
  /** Overall diffusion strength (0..100). Scales the screened-back glow. */
  strength: number;
  /** Diffusion spread (0..100). Maps to the blur sigmas as a fraction of the image. */
  size: number;
  /** Black retention (0..100). 0 = Pro-Mist (veiled, lifted blacks); 100 = Black-Mist (crisp blacks). */
  blackRetention: number;
  /** Highlight threshold (0..100). Where (in linear luma) pixels start to bloom. */
  threshold: number;
}

export const PROMIST_DEFAULTS: ProMistParams = {
  strength: 40,
  size: 40,
  blackRetention: 60,
  threshold: 55,
};

/** Internal, non-exposed tuning constants. */
const KNEE = 0.22; // soft-knee width above the highlight threshold (linear luma)
const STRENGTH_GAIN = 1.5; // strength=100 → intensity 1.5 (screen saturates, so headroom is fine)
const SIZE_FRACTION = 0.06; // size=100 → wide sigma ≈ 6% of max(width,height)
const SIGMA_BASE = 0.5; // floor so size=0 is "no spread", not undefined
const TIGHT_RATIO = 0.35; // tight bloom sigma = wide sigma * this
const W_TIGHT = 0.6; // weight of the tight bloom in the summed glow
const W_WIDE = 1.0; // weight of the wide veil in the summed glow

function smoothstep(a: number, b: number, x: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  let t = (x - a) / (b - a);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

/**
 * Separable Gaussian blur of a single-channel Float32 plane, edges clamped.
 * Operates in linear light (caller passes linear values), which is the
 * physically correct space to spread light energy.
 */
function blurPlane(src: Float32Array, width: number, height: number, sigma: number): Float32Array {
  if (sigma <= SIGMA_BASE) return Float32Array.from(src);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  const inv2s2 = 1 / (2 * sigma * sigma);
  let sum = 0;
  for (let k = -radius; k <= radius; k++) {
    const v = Math.exp(-(k * k) * inv2s2);
    kernel[k + radius] = v;
    sum += v;
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;

  const tmp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        let sx = x + k;
        if (sx < 0) sx = 0;
        else if (sx >= width) sx = width - 1;
        acc += src[row + sx] * kernel[k + radius];
      }
      tmp[row + x] = acc;
    }
  }

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        let sy = y + k;
        if (sy < 0) sy = 0;
        else if (sy >= height) sy = height - 1;
        acc += tmp[sy * width + x] * kernel[k + radius];
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

/**
 * Apply Pro-Mist / Black-Mist diffusion in place. `data` is RGBA bytes
 * (display sRGB). Mutates `data`; alpha is left untouched.
 */
export function applyProMist(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<ProMistParams> = {}
): void {
  const p = { ...PROMIST_DEFAULTS, ...params };
  if (!width || !height) return;

  const strength = Math.max(0, Math.min(100, p.strength));
  if (strength <= 0) return; // exact no-op

  const size = Math.max(0, Math.min(100, p.size));
  const retention = Math.max(0, Math.min(100, p.blackRetention)) / 100;
  const T = Math.max(0, Math.min(100, p.threshold)) / 100;

  const I = (strength / 100) * STRENGTH_GAIN;
  const maxDim = Math.max(width, height);
  const sigmaWide = SIGMA_BASE + (size / 100) * SIZE_FRACTION * maxDim;
  const sigmaTight = Math.max(SIGMA_BASE, sigmaWide * TIGHT_RATIO);

  const n = width * height;
  const baseR = new Float32Array(n);
  const baseG = new Float32Array(n);
  const baseB = new Float32Array(n);
  const baseY = new Float32Array(n);
  const srcR = new Float32Array(n);
  const srcG = new Float32Array(n);
  const srcB = new Float32Array(n);

  const knee = Math.min(1 - T, KNEE) || KNEE; // keep a usable knee even at high T

  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const lr = SRGB_TO_LINEAR[data[j]];
    const lg = SRGB_TO_LINEAR[data[j + 1]];
    const lb = SRGB_TO_LINEAR[data[j + 2]];
    baseR[i] = lr;
    baseG[i] = lg;
    baseB[i] = lb;
    const Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    baseY[i] = Y;
    const m = smoothstep(T, T + knee, Y);
    if (m > 0) {
      // Highlight source keeps the pixel's own colour, scaled by the mask.
      srcR[i] = lr * m;
      srcG[i] = lg * m;
      srcB[i] = lb * m;
    }
  }

  const tR = blurPlane(srcR, width, height, sigmaTight);
  const tG = blurPlane(srcG, width, height, sigmaTight);
  const tB = blurPlane(srcB, width, height, sigmaTight);
  const wR = blurPlane(srcR, width, height, sigmaWide);
  const wG = blurPlane(srcG, width, height, sigmaWide);
  const wB = blurPlane(srcB, width, height, sigmaWide);

  for (let i = 0; i < n; i++) {
    // How "lit" the underlying pixel is: 1 in highlights, 0 in deep shadow.
    const lit = smoothstep(0, T > 0 ? T : 1e-4, baseY[i]);
    // Black retention gates only the WIDE veil in the shadows.
    const gate = lit + (1 - retention) * (1 - lit);

    let gr = I * (W_TIGHT * tR[i] + W_WIDE * wR[i] * gate);
    let gg = I * (W_TIGHT * tG[i] + W_WIDE * wG[i] * gate);
    let gb = I * (W_TIGHT * tB[i] + W_WIDE * wB[i] * gate);
    if (gr > 1) gr = 1;
    else if (gr < 0) gr = 0;
    if (gg > 1) gg = 1;
    else if (gg < 0) gg = 0;
    if (gb > 1) gb = 1;
    else if (gb < 0) gb = 0;

    // Screen the glow over the base, in linear light.
    const outR = 1 - (1 - baseR[i]) * (1 - gr);
    const outG = 1 - (1 - baseG[i]) * (1 - gg);
    const outB = 1 - (1 - baseB[i]) * (1 - gb);

    const j = i * 4;
    data[j] = linearToSrgbByte(outR);
    data[j + 1] = linearToSrgbByte(outG);
    data[j + 2] = linearToSrgbByte(outB);
  }
}

/** HAX effect descriptor. settings[].id matches ProMistParams; defaults match PROMIST_DEFAULTS. */
export const PROMIST_EFFECT = {
  id: 'proMist',
  label: 'Pro-Mist',
  category: 'Effects',
  settings: [
    {
      id: 'strength',
      label: 'Strength',
      min: 0,
      max: 100,
      default: PROMIST_DEFAULTS.strength,
      step: 1,
      description: 'Overall diffusion strength of the screened-back glow.',
    },
    {
      id: 'size',
      label: 'Size',
      min: 0,
      max: 100,
      default: PROMIST_DEFAULTS.size,
      step: 1,
      description: 'How far the bloom spreads (blur radius as a fraction of the image).',
    },
    {
      id: 'blackRetention',
      label: 'Black Retention',
      min: 0,
      max: 100,
      default: PROMIST_DEFAULTS.blackRetention,
      step: 1,
      description: '0 = Pro-Mist (lifted, veiled blacks); 100 = Black-Mist (crisp blacks).',
    },
    {
      id: 'threshold',
      label: 'Threshold',
      min: 0,
      max: 100,
      default: PROMIST_DEFAULTS.threshold,
      step: 1,
      description: 'Highlight level (linear luma) where pixels start to bloom.',
    },
  ],
} as const;
