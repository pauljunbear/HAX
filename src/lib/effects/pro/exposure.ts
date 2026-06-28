/**
 * Exposure + Gamma + Levels — a single pro-grade tonal control built as ONE
 * composed 256-entry byte→byte LUT, applied per channel.
 *
 * The engine already had a linear-light exposure buried in a helper
 * (makeExposureLUT); this promotes it to a real, physically-correct effect and
 * stacks the two other tone primitives a photographer expects:
 *
 *   1. LEVELS (black/white point) — an input remap on the *display-encoded*
 *      bytes: blackPoint→0, whitePoint→255, linear stretch between, clamped.
 *      This is the conventional Photoshop "Levels" input-slider behaviour, which
 *      by definition operates on encoded values (not radiance), so it is done in
 *      display space on purpose.
 *
 *   2. EXPOSURE — a multiply of scene radiance, so it MUST happen in LINEAR
 *      light: decode → ×2^stops → encode. +1 stop maps mid-gray (128) to ~176,
 *      not to clipped white. This is exactly makeExposureLUT's transfer; we
 *      inline it continuously (see below) instead of calling the byte LUT.
 *
 *   3. GAMMA — the Levels midtone slider: a display-space power curve
 *      out = in^(1/gamma). gamma>1 lifts midtones, gamma<1 deepens them. It is a
 *      tone-curve tweak on encoded values, so display space is correct here too.
 *
 * Chain order (per spec): levels → exposure(linear) → gamma(display).
 *
 * Quantization: we evaluate the whole chain CONTINUOUSLY in float and round
 * ONCE at the end (via makeByteLUT/clampByteRound). Calling makeExposureLUT
 * mid-chain would force an intermediate 8-bit round between levels and gamma and
 * add avoidable banding — hence the inline (mathematically identical) exposure.
 * The result is a single monotone 256-LUT, so applying it to 8-bit data adds no
 * quantization beyond the input's own 8 bits (no per-pixel dither needed).
 */

import { srgbByteToLinear, makeByteLUT } from '../color-space';

export interface ExposureParams {
  /** Exposure in hundredths of a stop: -300..300 → -3..+3 stops (linear multiply). */
  exposure: number;
  /** Gamma in hundredths: 20..300 → 0.2..3.0 (display-space midtone curve, 100 = 1.0 identity). */
  gamma: number;
  /** Levels black point (input byte mapped to 0): 0..100. */
  blackPoint: number;
  /** Levels white point (input byte mapped to 255): 155..255. */
  whitePoint: number;
}

export const EXPOSURE_DEFAULTS: ExposureParams = {
  exposure: 0,
  gamma: 100,
  blackPoint: 0,
  whitePoint: 255,
};

/**
 * Continuous linear-light (0..1) → sRGB display-encoded (0..1).
 * Mirrors the transfer in linearToSrgbByte; the helper only offers the
 * byte-rounding variant, but the mid-chain needs an un-rounded encode so the
 * gamma curve sees a continuous value.
 */
function srgbEncodeNorm(lin: number): number {
  const l = lin < 0 ? 0 : lin > 1 ? 1 : lin;
  return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

/** True when params leave the image untouched (exact no-op fast path). */
function isNeutral(p: ExposureParams): boolean {
  return p.exposure === 0 && p.gamma === 100 && p.blackPoint === 0 && p.whitePoint === 255;
}

/**
 * Build the composed levels→exposure→gamma byte→byte LUT for the given params.
 * Exposed for testing the curve directly.
 */
export function buildExposureLUT(params: Partial<ExposureParams> = {}): Uint8ClampedArray {
  const p = { ...EXPOSURE_DEFAULTS, ...params };

  const factor = Math.pow(2, p.exposure / 100); // 2^stops, linear-light multiply
  const invGamma = 100 / p.gamma; // out = in^(1/gamma); gamma=100 → 1.0
  const bp = p.blackPoint;
  const wp = p.whitePoint;
  const span = Math.max(1, wp - bp); // guard divide-by-zero / inverted points

  return makeByteLUT(c => {
    // 1. LEVELS: remap [bp,wp] → [0,1] on the encoded byte, clamp.
    let v = (c - bp) / span;
    if (v < 0) v = 0;
    else if (v > 1) v = 1;

    // 2. EXPOSURE: multiply radiance in LINEAR light, then re-encode.
    //    (srgbByteToLinear takes value/255 internally, so v*255 decodes v.)
    let lin = srgbByteToLinear(v * 255) * factor;
    if (lin > 1) lin = 1;
    else if (lin < 0) lin = 0;
    v = srgbEncodeNorm(lin);

    // 3. GAMMA: display-space midtone power curve.
    if (v > 0 && invGamma !== 1) v = Math.pow(v, invGamma);

    return v * 255; // makeByteLUT applies clampByteRound (round-half-up, [0,255]).
  });
}

/**
 * Apply Exposure + Gamma + Levels in place. `data` is RGBA bytes; alpha is
 * untouched. One composed LUT, three table reads per pixel.
 */
export function applyExposure(
  data: Uint8ClampedArray,
  _width: number,
  _height: number,
  params: Partial<ExposureParams> = {}
): void {
  const p = { ...EXPOSURE_DEFAULTS, ...params };
  if (isNeutral(p)) return; // exact no-op

  const lut = buildExposureLUT(p);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
    // data[i + 3] (alpha) left as-is
  }
}

export const EXPOSURE_EFFECT = {
  id: 'exposure',
  label: 'Exposure',
  category: 'Adjust',
  settings: [
    {
      id: 'exposure',
      label: 'Exposure',
      min: -300,
      max: 300,
      default: 0,
      step: 1,
      description: 'Linear-light exposure in stops (−3 to +3). +1 stop ≈ doubles radiance.',
    },
    {
      id: 'gamma',
      label: 'Gamma',
      min: 20,
      max: 300,
      default: 100,
      step: 1,
      description:
        'Midtone gamma 0.2–3.0 (100 = neutral). Higher lifts midtones, lower deepens them.',
    },
    {
      id: 'blackPoint',
      label: 'Black Point',
      min: 0,
      max: 100,
      default: 0,
      step: 1,
      description: 'Input level mapped to pure black. Raising it crushes shadows.',
    },
    {
      id: 'whitePoint',
      label: 'White Point',
      min: 155,
      max: 255,
      default: 255,
      step: 1,
      description: 'Input level mapped to pure white. Lowering it lifts highlights.',
    },
  ],
} as const;
