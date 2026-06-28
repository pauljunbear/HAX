/**
 * Halation — the red/orange glow that blooms around bright highlights on film
 * whose anti-halation backing is absent (Cinestill 800T is the famous case;
 * every film has some). The look is a real optical effect, so we model it the
 * real way, entirely in LINEAR light (light scatter is additive — blurring or
 * screening in gamma space looks muddy and hue-shifts).
 *
 * Algorithm (docs/effects-research/research/r4-cinema-halation.md):
 *   1. Linearise; linear luma Y = 0.2126R + 0.7152G + 0.0722B.
 *   2. Soft highlight mask with a super-linear knee:
 *        e = smoothstep(T, T+knee, Y);  energy = e^P     (P>1 ⇒ bright sources halate disproportionately)
 *   3. Tint by energy, RED outer-rim → ORANGE hot-core:  tint = mix(RED, ORANGE, energy)
 *   4. TWO summed blurs — a tight halation ring + a wide bloom — at sigmas that
 *      are fractions of the image's max dimension (resolution-independent).
 *   5. Recombine via SCREEN:  out = 1 − (1−base)(1−halo·intensity).
 *
 * Why red: film layer order is blue→green→red(deepest); light penetrates,
 * reflects off the camera pressure plate, returns with blue/green already
 * absorbed and re-exposes mainly the red layer.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte } from '../color-space';

export interface HalationParams {
  /** Overall strength of the screened-back glow. 0 = off, ~0.3 subtle, ~0.8 Cinestill. */
  intensity: number;
  /** Luma threshold where highlights start to halate (linear). */
  threshold: number;
  /** Soft-knee width above the threshold. */
  knee: number;
  /** Highlight-mask exponent (>1 = super-linear; brighter sources bloom more). */
  power: number;
  /** Tight halation-ring blur, as a fraction of max(width,height). */
  sigmaCore: number;
  /** Wide bloom blur, as a fraction of max(width,height). */
  sigmaBloom: number;
  /** Weights of the two blurs in the summed halo. */
  weightCore: number;
  weightBloom: number;
  /** Hot-core tint (linear RGB 0..1). */
  core: [number, number, number];
  /** Outer-rim tint (linear RGB 0..1). */
  rim: [number, number, number];
}

export const DEFAULT_HALATION: HalationParams = {
  intensity: 0.5,
  threshold: 0.55,
  knee: 0.25,
  power: 1.6,
  sigmaCore: 0.004,
  sigmaBloom: 0.025,
  weightCore: 0.7,
  weightBloom: 0.45,
  core: [1.0, 0.32, 0.1],
  rim: [1.0, 0.07, 0.05],
};

function smoothstep(a: number, b: number, x: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  let t = (x - a) / (b - a);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

/** Separable Gaussian blur of a single-channel Float32 plane (clamp edges). */
function blurPlane(src: Float32Array, width: number, height: number, sigma: number): Float32Array {
  if (sigma <= 0.5) return Float32Array.from(src);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  const inv2s2 = 1 / (2 * sigma * sigma);
  for (let k = -radius; k <= radius; k++) {
    const v = Math.exp(-(k * k) * inv2s2);
    kernel[k + radius] = v;
    sum += v;
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;

  const tmp = new Float32Array(width * height);
  // horizontal
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
  // vertical
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
 * Apply halation in place. `data` is RGBA bytes (display sRGB). Mutates `data`.
 */
export function applyHalation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<HalationParams> = {}
): void {
  const p = { ...DEFAULT_HALATION, ...params };
  if (p.intensity <= 0) return;

  const n = width * height;
  const maxDim = Math.max(width, height);
  const sigmaCore = p.sigmaCore * maxDim;
  const sigmaBloom = p.sigmaBloom * maxDim;

  // Base linear planes + the tinted halo source.
  const baseR = new Float32Array(n);
  const baseG = new Float32Array(n);
  const baseB = new Float32Array(n);
  const haloR = new Float32Array(n);
  const haloG = new Float32Array(n);
  const haloB = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const lr = SRGB_TO_LINEAR[data[j]];
    const lg = SRGB_TO_LINEAR[data[j + 1]];
    const lb = SRGB_TO_LINEAR[data[j + 2]];
    baseR[i] = lr;
    baseG[i] = lg;
    baseB[i] = lb;
    const Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    const e = smoothstep(p.threshold, p.threshold + p.knee, Y);
    const energy = e <= 0 ? 0 : Math.pow(e, p.power);
    if (energy > 0) {
      // RED rim → ORANGE core as energy rises.
      const tr = p.rim[0] + (p.core[0] - p.rim[0]) * energy;
      const tg = p.rim[1] + (p.core[1] - p.rim[1]) * energy;
      const tb = p.rim[2] + (p.core[2] - p.rim[2]) * energy;
      haloR[i] = tr * energy;
      haloG[i] = tg * energy;
      haloB[i] = tb * energy;
    }
  }

  const cR = blurPlane(haloR, width, height, sigmaCore);
  const cG = blurPlane(haloG, width, height, sigmaCore);
  const cB = blurPlane(haloB, width, height, sigmaCore);
  const bR = blurPlane(haloR, width, height, sigmaBloom);
  const bG = blurPlane(haloG, width, height, sigmaBloom);
  const bB = blurPlane(haloB, width, height, sigmaBloom);

  const wC = p.weightCore;
  const wB = p.weightBloom;
  const I = p.intensity;
  for (let i = 0; i < n; i++) {
    const hr = (wC * cR[i] + wB * bR[i]) * I;
    const hg = (wC * cG[i] + wB * bG[i]) * I;
    const hb = (wC * cB[i] + wB * bB[i]) * I;
    // screen in linear light
    const outR = 1 - (1 - baseR[i]) * (1 - Math.min(1, hr));
    const outG = 1 - (1 - baseG[i]) * (1 - Math.min(1, hg));
    const outB = 1 - (1 - baseB[i]) * (1 - Math.min(1, hb));
    const j = i * 4;
    data[j] = linearToSrgbByte(outR);
    data[j + 1] = linearToSrgbByte(outG);
    data[j + 2] = linearToSrgbByte(outB);
  }
}
