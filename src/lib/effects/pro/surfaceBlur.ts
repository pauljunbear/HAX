/**
 * Surface Blur — an edge-preserving (bilateral) filter. It smooths flat regions
 * (skin, sky, paper) while leaving real edges crisp, which is exactly the tool
 * skin-retouch and frequency-separation workflows are built on.
 *
 * Algorithm — the bilateral filter (Tomasi & Manduchi 1998). For each output
 * pixel we average its neighbours inside a radius, but every neighbour's weight
 * is the PRODUCT of two Gaussians:
 *
 *   w(p,q) = exp(-‖p−q‖² / 2σ_s²)          // SPATIAL: closer pixels matter more
 *          · exp(-(Y_q − Y_p)² / 2σ_r²)    // RANGE:  similar-tone pixels matter more
 *
 * The range term is the whole trick: a neighbour whose tone differs by more than
 * ~threshold gets a near-zero weight, so the average never reaches across an
 * edge — flat areas blend, contours survive.
 *
 * Quality choices (per the engine's linear-light mandate):
 *   • COLOUR AVERAGING is done in LINEAR light. The blur is a spreading of
 *     radiance (additive light); averaging gamma-encoded bytes darkens and
 *     hue-shifts a blend of two colours. We decode through SRGB_TO_LINEAR once,
 *     accumulate the weighted mean in linear, and re-encode with linearToSrgbByte.
 *   • The RANGE (edge-stop) weight is computed from PERCEPTUAL display-space luma,
 *     not linear. The threshold is a user-facing "how different is an edge" knob;
 *     edge perception and Photoshop's own Surface Blur "Threshold" live in display
 *     levels (0..255), so the knee is defined there. σ_r is set equal to the
 *     threshold in luma levels, which makes the docstring literally true: a
 *     neighbour differing by `threshold` keeps weight e^-0.5 ≈ 0.61, by 2·thr
 *     ≈ 0.14, by 3·thr ≈ 0.01 — "more than ~threshold ⇒ contributes little".
 *
 * Determinism: the filter is fully deterministic (no randomness), so the live
 * preview and the export are bit-identical without needing a seed setting.
 *
 * Cost: the range weight couples the two axes, so a bilateral filter is NOT
 * separable — it is a true 2-D gather, O(W·H·(2r+1)²). At the r=20 cap that is
 * 41×41 = 1681 taps/pixel, which is why radius is held to ≤20. The hot loop is
 * kept cheap: the spatial kernel is precomputed once into a Float32 table and the
 * range term is a 256-entry exp() LUT indexed by |ΔY|, so each tap is two table
 * reads and three multiply-accumulates.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte } from '../color-space';

export interface SurfaceBlurParams {
  /** Neighbourhood half-size in px (1..20). Larger = smoother, quadratically costlier. */
  radius: number;
  /** Edge-stop in display luma levels (1..100). Neighbours differing by more than
   *  ~threshold are excluded from the average, so edges are preserved. */
  threshold: number;
}

export const SURFACEBLUR_DEFAULTS: SurfaceBlurParams = {
  radius: 6,
  threshold: 25,
};

/** Rec.601 luma on display-space (gamma-encoded) bytes, 0..255. The range weight
 *  is a PERCEPTUAL edge stop, so it is measured on the encoded signal, not linear. */
function displayLuma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply an edge-preserving surface blur in place. `data` is RGBA bytes (display
 * sRGB); RGB is filtered, alpha is passed through untouched. Mutates `data`.
 */
export function applySurfaceBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<SurfaceBlurParams> = {}
): void {
  const p = { ...SURFACEBLUR_DEFAULTS, ...params };
  const radius = Math.max(0, Math.min(20, Math.floor(p.radius)));
  if (radius < 1 || width < 1 || height < 1) return; // nothing to gather

  const n = width * height;

  // --- precompute the spatial Gaussian kernel (resolution of the gather) ---
  // σ_s = radius/2 → the kernel edge (d = radius) still carries e^-2 ≈ 0.135,
  // keeping the full radius meaningfully involved in the smoothing.
  const sigmaS = radius / 2;
  const inv2ss = 1 / (2 * sigmaS * sigmaS);
  const ksize = radius * 2 + 1;
  const spatial = new Float32Array(ksize * ksize);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      spatial[(dy + radius) * ksize + (dx + radius)] = Math.exp(-(dx * dx + dy * dy) * inv2ss);
    }
  }

  // --- precompute the range (edge-stop) weight as a 256-entry LUT over |ΔY| ---
  // σ_r = threshold (in luma levels). Clamp ≥1 so the Gaussian never divides by 0.
  const sigmaR = Math.max(1, p.threshold);
  const inv2sr = 1 / (2 * sigmaR * sigmaR);
  const rangeLUT = new Float32Array(256);
  for (let d = 0; d < 256; d++) rangeLUT[d] = Math.exp(-(d * d) * inv2sr);

  // --- decode RGB to linear once (energy-correct averaging) + a display-luma plane
  // for the range term. Reading from these planes keeps the tap loop branch-light. ---
  const linR = new Float32Array(n);
  const linG = new Float32Array(n);
  const linB = new Float32Array(n);
  const luma = new Float32Array(n); // display-space, 0..255
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const r = data[j];
    const g = data[j + 1];
    const b = data[j + 2];
    linR[i] = SRGB_TO_LINEAR[r];
    linG[i] = SRGB_TO_LINEAR[g];
    linB[i] = SRGB_TO_LINEAR[b];
    luma[i] = displayLuma(r, g, b);
  }

  // --- the bilateral gather ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = y * width + x;
      const Yc = luma[ci];

      let accR = 0;
      let accG = 0;
      let accB = 0;
      let wsum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        let sy = y + dy;
        if (sy < 0)
          sy = 0; // clamp edges
        else if (sy >= height) sy = height - 1;
        const rowK = (dy + radius) * ksize + radius;
        const rowI = sy * width;
        for (let dx = -radius; dx <= radius; dx++) {
          let sx = x + dx;
          if (sx < 0) sx = 0;
          else if (sx >= width) sx = width - 1;

          const si = rowI + sx;
          // |ΔY| → range weight (round + clamp the index into the LUT)
          let d = luma[si] - Yc;
          if (d < 0) d = -d;
          const di = d >= 255 ? 255 : (d + 0.5) | 0;
          const w = spatial[rowK + dx] * rangeLUT[di];

          accR += linR[si] * w;
          accG += linG[si] * w;
          accB += linB[si] * w;
          wsum += w;
        }
      }

      // wsum >= spatial(center)*range(0) = 1 > 0, so the divide is always safe.
      const inv = 1 / wsum;
      const j = ci * 4;
      data[j] = linearToSrgbByte(accR * inv);
      data[j + 1] = linearToSrgbByte(accG * inv);
      data[j + 2] = linearToSrgbByte(accB * inv);
      // alpha (data[j + 3]) left untouched
    }
  }
}

/**
 * HAX effect descriptor. settings[].id mirrors the SurfaceBlurParams fields and
 * each `default` mirrors SURFACEBLUR_DEFAULTS so the UI and the algorithm agree.
 */
export const SURFACEBLUR_EFFECT = {
  id: 'surfaceBlur',
  label: 'Surface Blur',
  category: 'Blur',
  settings: [
    {
      id: 'radius',
      label: 'Radius',
      min: 1,
      max: 20,
      default: SURFACEBLUR_DEFAULTS.radius,
      step: 1,
      description:
        'Neighbourhood size in px. Larger smooths more; cost grows ~quadratically (O((2r+1)²) taps/px), so it is capped at 20.',
    },
    {
      id: 'threshold',
      label: 'Threshold',
      min: 1,
      max: 100,
      default: SURFACEBLUR_DEFAULTS.threshold,
      step: 1,
      description:
        'Edge stop, in luma levels. Neighbours whose tone differs by more than ~threshold are excluded from the average, so edges stay sharp. Higher = more aggressive smoothing across contrast.',
    },
  ],
};
