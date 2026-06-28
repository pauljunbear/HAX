/**
 * Shared colour-space + math helpers for the effects engine.
 *
 * One source of truth for sRGB <-> linear light, byte clamping, and
 * deterministic pseudo-randomness. Several effects are only mathematically
 * correct when their arithmetic happens in LINEAR light rather than on the
 * gamma-encoded bytes the canvas stores: exposure (a multiply of radiance),
 * blur/bloom (energy spreading), and dithering/quantization (perceived
 * midtone placement). These helpers make linear-light work cheap via
 * 256-entry lookup tables, so the per-pixel hot loops stay table reads.
 */

/** Decode a single sRGB-encoded byte (0-255) to linear light (0-1). */
export function srgbByteToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Round-then-clamp to a byte [0,255]. Replaces the truncating `| 0`, which
 *  biased every channel write downward by ~0.5 LSB. */
export function clampByteRound(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return (value + 0.5) | 0;
}

/** Encode a linear-light value (0-1) to an sRGB byte (0-255), rounded & clamped. */
export function linearToSrgbByte(lin: number): number {
  const l = lin < 0 ? 0 : lin > 1 ? 1 : lin;
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clampByteRound(s * 255);
}

/** 256-entry LUT: sRGB byte -> linear light (0-1). */
export const SRGB_TO_LINEAR: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) t[i] = srgbByteToLinear(i);
  return t;
})();

/**
 * Build a byte->byte lookup table from a continuous transfer function.
 * Use when a per-pixel op has a constant transfer curve (e.g. exposure) so
 * the hot loop becomes a single table read instead of pow()/branches.
 */
export function makeByteLUT(fn: (inputByte: number) => number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = clampByteRound(fn(i));
  return lut;
}

/**
 * Exposure-in-stops as a byte->byte LUT, applied in LINEAR light:
 *   out = encode( decode(in) * 2^stops )
 * A +1 stop boost maps mid-gray (byte 128) to ~176, not to clipped white.
 */
export function makeExposureLUT(stops: number): Uint8ClampedArray {
  const factor = Math.pow(2, stops);
  return makeByteLUT(c => linearToSrgbByte(SRGB_TO_LINEAR[c] * factor));
}

/**
 * A red/green/blue triplet. Used both for 8-bit sRGB bytes ([0,255]) and, in
 * the OKLab helpers below, for the [L, a, b] perceptual coordinates.
 */
export type Triplet = [number, number, number];

/**
 * 8-bit sRGB byte triple -> OKLab [L, a, b].
 *
 * OKLab is a perceptual colour space: equal numeric steps look like equal
 * perceived steps, and a straight line between two colours stays vivid instead
 * of dipping through a muddy gray. Interpolating gradients/duotones/tints there
 * (rather than on the gamma-encoded sRGB bytes) is the correct way to ramp
 * colour. The transform goes through LINEAR light, then the standard Bjorn
 * Ottosson M1 (linear sRGB -> LMS), a cube-root non-linearity, and M2
 * (LMS' -> Lab). It is the exact inverse of `oklabToRgb` / palette.ts oklch2rgb.
 */
export function rgbToOklab([r, g, b]: Triplet): Triplet {
  const lr = srgbByteToLinear(r);
  const lg = srgbByteToLinear(g);
  const lb = srgbByteToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/**
 * OKLab [L, a, b] -> 8-bit sRGB byte triple (rounded, clamped, gamut-clipped).
 * Mirrors palette.ts oklch2rgb's OKLab->sRGB stage and inverts `rgbToOklab`.
 */
export function oklabToRgb([L, a, b]: Triplet): Triplet {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [linearToSrgbByte(lr), linearToSrgbByte(lg), linearToSrgbByte(lb)];
}

/**
 * Interpolate two sRGB byte colours in OKLab and return sRGB bytes.
 * `t` in [0,1]: 0 -> rgbA, 1 -> rgbB. Endpoints are returned exactly (no
 * round-trip drift) so a gradient's stops land on the chosen colours; interior
 * samples stay perceptually even and keep their chroma.
 */
export function oklabLerp(rgbA: Triplet, rgbB: Triplet, t: number): Triplet {
  if (t <= 0) return [clampByteRound(rgbA[0]), clampByteRound(rgbA[1]), clampByteRound(rgbA[2])];
  if (t >= 1) return [clampByteRound(rgbB[0]), clampByteRound(rgbB[1]), clampByteRound(rgbB[2])];
  const A = rgbToOklab(rgbA);
  const B = rgbToOklab(rgbB);
  return oklabToRgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/**
 * mulberry32 - tiny, fast, well-distributed seeded PRNG. Returns a function
 * yielding floats in [0,1). Use to make stochastic effects (glitch, VHS,
 * grain) deterministic so the live preview matches the exported result.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
