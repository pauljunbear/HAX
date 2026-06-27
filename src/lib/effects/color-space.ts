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
