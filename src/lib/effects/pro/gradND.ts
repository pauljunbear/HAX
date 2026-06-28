/**
 * Graduated ND / Sky filter — a directional linear gradient that applies an
 * exposure change (and an optional colour tint) across the frame, the way a
 * physical graduated neutral-density filter darkens a bright sky while leaving
 * the foreground untouched.
 *
 * Why LINEAR light: a real ND filter attenuates *radiance* — it multiplies the
 * light hitting the sensor by a transmission factor. Exposure in stops is
 * out = in * 2^stops, and that multiply is only physically correct on linear
 * radiance, not on the gamma-encoded bytes the canvas stores. Doing it on bytes
 * crushes/over-lifts midtones and shifts hue. So we decode to linear with the
 * shared SRGB_TO_LINEAR LUT, scale, then re-encode. The colour tint is modelled
 * the same way: a subtractive (multiplicative) transmission filter in linear
 * light, so a blue grad passes blue and attenuates red/green — exactly what
 * coloured glass does.
 *
 * Geometry: a single soft transition line sweeps the frame.
 *   t      — normalised position along the gradient axis, 0..1 across the frame.
 *            angle rotates the axis: 0° = vertical (effect full at TOP, the sky),
 *            90° = horizontal (effect full at the LEFT).
 *   position — where the centre of the transition sits (0..100 → 0..1).
 *   softness — width of the smoothstep band (0 = hard edge, 100 = whole frame).
 * weight = 1 − smoothstep(band) is 1 on the "full effect" side, ramps smoothly
 * through the band, and is exactly 0 on the far side (true identity there — the
 * foreground is left byte-for-byte untouched).
 *
 * Banding: a smooth exposure ramp quantised to 8-bit bands badly in flat areas.
 * We break it with a deterministic 4×4 ordered (Bayer) dither of <±0.5 LSB added
 * before rounding. It is positional, so preview === export with no PRNG/seed.
 */

import { SRGB_TO_LINEAR, clampByteRound } from '../color-space';

export interface GradNDParams {
  /** Exposure of the filtered region. -100..100 maps to -2..+2 stops; <0 darkens (sky), >0 brightens. */
  exposure: number;
  /** Gradient axis rotation in degrees. 0 = vertical (top), 90 = horizontal (left). */
  angle: number;
  /** Centre of the transition along the axis, 0..100 (0..1 of the frame). */
  position: number;
  /** Width of the smoothstep transition band, 0..100 (0 = hard edge, 100 = whole frame). */
  softness: number;
  /** Tint hue in degrees (0..360). 210 ≈ sky-blue. Only visible when tintStrength > 0. */
  tintHue: number;
  /** Tint strength 0..100 — how strongly the filtered region is pushed toward the hue. */
  tintStrength: number;
}

export const GRADND_DEFAULTS: GradNDParams = {
  exposure: -40,
  angle: 0,
  position: 50,
  softness: 50,
  tintHue: 210,
  tintStrength: 0,
};

/** Smoothstep with a safe degenerate (a >= b ⇒ hard step at b). */
function smoothstep(a: number, b: number, x: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  let t = (x - a) / (b - a);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

/** Fully-saturated hue (s=1,v=1) → RGB in [0,1]. Used as a linear transmission tint. */
function hueToRgb(hueDeg: number): [number, number, number] {
  const hp = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((hp % 2) - 1);
  if (hp < 1) return [1, x, 0];
  if (hp < 2) return [x, 1, 0];
  if (hp < 3) return [0, 1, x];
  if (hp < 4) return [0, x, 1];
  if (hp < 5) return [x, 0, 1];
  return [1, 0, x];
}

/** Encode a linear value to an sRGB byte, with a sub-LSB dither added before rounding. */
function encodeDithered(lin: number, dither: number): number {
  const l = lin < 0 ? 0 : lin > 1 ? 1 : lin;
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clampByteRound(s * 255 + dither);
}

// 4×4 Bayer matrix (0..15). offset = (M+0.5)/16 − 0.5 → [-0.469, +0.469] LSB.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Apply the graduated ND / sky filter in place. `data` is RGBA bytes (display
 * sRGB). Mutates `data`. Out-of-band pixels are left exactly unchanged.
 */
export function applyGradND(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<GradNDParams> = {}
): void {
  const p = { ...GRADND_DEFAULTS, ...params };

  // Map slider → physics. exposure -100..100 → -2..+2 stops → linear factor.
  const stops = (p.exposure / 100) * 2;
  const factor = Math.pow(2, stops);
  const tintBase = p.tintStrength / 100; // 0..1, scaled per-pixel by weight
  const neutralExposure = stops === 0;
  const neutralTint = tintBase <= 0;

  // Nothing to do — true no-op, leaves bytes identical.
  if (neutralExposure && neutralTint) return;
  if (width <= 0 || height <= 0) return;

  // Tinted transmission coefficients (1 = pass, <1 = attenuate this channel).
  const [hr, hg, hb] = hueToRgb(p.tintHue);

  // Gradient axis: 0° vertical (top), 90° horizontal (left).
  const a = (p.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  const span = Math.abs(dx) + Math.abs(dy); // projection extent over the unit rect; ∈[1, √2]
  const invSpan = span > 0 ? 1 / span : 0;

  const center = p.position / 100;
  const halfBand = (p.softness / 100) * 0.5;
  const edge0 = center - halfBand;
  const edge1 = center + halfBand;

  // Guard 1px dimensions (avoid /0 → NaN); a 1px axis collapses to centre.
  const invW = width > 1 ? 1 / (width - 1) : 0;
  const invH = height > 1 ? 1 / (height - 1) : 0;

  for (let y = 0; y < height; y++) {
    const v = height > 1 ? y * invH - 0.5 : 0;
    const rowB = (y & 3) * 4;
    for (let x = 0; x < width; x++) {
      const u = width > 1 ? x * invW - 0.5 : 0;
      const proj = u * dx + v * dy;
      const t = proj * invSpan + 0.5; // 0..1 across the frame along the axis
      const weight = 1 - smoothstep(edge0, edge1, t);

      const j = (y * width + x) * 4;
      if (weight <= 0) continue; // far side of the gradient: untouched identity

      // Per-pixel exposure factor (lerp the linear factor toward 1 across the band).
      const eff = 1 + (factor - 1) * weight;
      // Per-pixel tint transmission (lerp white → hue across the band).
      const amt = tintBase * weight;
      const mr = 1 - amt * (1 - hr);
      const mg = 1 - amt * (1 - hg);
      const mb = 1 - amt * (1 - hb);

      const dither = (BAYER4[rowB + (x & 3)] + 0.5) / 16 - 0.5;
      data[j] = encodeDithered(SRGB_TO_LINEAR[data[j]] * eff * mr, dither);
      data[j + 1] = encodeDithered(SRGB_TO_LINEAR[data[j + 1]] * eff * mg, dither);
      data[j + 2] = encodeDithered(SRGB_TO_LINEAR[data[j + 2]] * eff * mb, dither);
      // alpha (data[j+3]) untouched
    }
  }
}

export const GRADND_EFFECT = {
  id: 'gradND',
  label: 'Graduated ND / Sky',
  category: 'Effects',
  settings: [
    {
      id: 'exposure',
      label: 'Exposure',
      min: -100,
      max: 100,
      default: -40,
      step: 1,
      description: 'Exposure of the filtered region (-2..+2 stops). Negative darkens the sky.',
    },
    {
      id: 'angle',
      label: 'Angle',
      min: 0,
      max: 360,
      default: 0,
      step: 1,
      description: 'Rotation of the gradient axis (0° = top, 90° = left).',
    },
    {
      id: 'position',
      label: 'Position',
      min: 0,
      max: 100,
      default: 50,
      step: 1,
      description: 'Where the transition line sits across the frame.',
    },
    {
      id: 'softness',
      label: 'Softness',
      min: 0,
      max: 100,
      default: 50,
      step: 1,
      description: 'Width of the transition band (0 = hard edge, 100 = whole frame).',
    },
    {
      id: 'tintHue',
      label: 'Tint Hue',
      min: 0,
      max: 360,
      default: 210,
      step: 1,
      description: 'Hue of the optional colour tint (210 ≈ sky blue).',
    },
    {
      id: 'tintStrength',
      label: 'Tint Strength',
      min: 0,
      max: 100,
      default: 0,
      step: 1,
      description: 'How strongly the filtered region is tinted toward the hue.',
    },
  ],
} as const;
