/**
 * Bleach Bypass — the silver-retention cinematic look.
 *
 * In a real bleach-bypass (a.k.a. skip-bleach / ENR) process the silver halides
 * are NOT washed out of the emulsion after development, so a black-and-white
 * silver image is retained ON TOP of the colour dyes. The visual result is
 * exactly what an OVERLAY blend of the image's own luminance over the colour
 * image produces: crushed, high local contrast, muted/metallic colour, and
 * gleaming highlights.
 *
 * Algorithm (per-pixel, no spatial term — the "silver layer" is co-sited):
 *   1. Decode to LINEAR light and compute luminance
 *        Y = 0.2126 R + 0.7152 G + 0.0722 B
 *      Luminance is a linear-light (radiometric) quantity, so it must be summed
 *      in linear light — averaging gamma-encoded bytes would mis-place the grey.
 *   2. Re-encode Y to a display-space grey. The silver/overlay recombination is
 *      a photographic *tone* operation defined on the print (gamma) signal, so
 *      from here on we work in display sRGB (the task's "overlay is display-space").
 *   3. Bleached = overlayBlend(colour, grey) per channel. Overlay screens the
 *      lights and multiplies the darks against the common grey layer, which is
 *      what boosts contrast and pulls the channels toward a shared (metallic)
 *      response.
 *   4. Mix original → bleached by `strength`.
 *   5. `contrast` — an S-curve around mid-grey (a perceptual tone tweak, so it
 *      lives in display space; it is not additive light).
 *   6. `saturation` — lerp each channel toward the pixel's perceptual luma
 *      (a colour tweak; display space, the conventional place for a sat slider).
 *      Default < 100 gives the desaturated bleach look.
 *
 * Determinism: the transform is a pure tone/colour curve with no randomness, so
 * preview === export bit-for-bit. We quantise with clampByteRound (round-to-
 * nearest, not the truncating `| 0`); we deliberately add NO stochastic dither
 * because the spec fixes exactly three numeric settings and prohibits unseeded
 * randomness — an RNG/seed for TPDF dither would be out of scope, and for an
 * 8-bit→8-bit curve over already-quantised input the residual banding from
 * correct rounding is negligible.
 */

import { SRGB_TO_LINEAR } from '../color-space';

export interface BleachBypassParams {
  /** Mix between the original and the bleached overlay result. 0 = off, 100 = full. */
  strength: number;
  /** Tone contrast around mid-grey. 50 = neutral; <50 flattens, >50 crushes. */
  contrast: number;
  /** Colour retained. 100 = full original colour, 0 = greyscale. Low = bleached. */
  saturation: number;
}

export const BLEACHBYPASS_DEFAULTS: BleachBypassParams = {
  strength: 60,
  contrast: 50,
  saturation: 40,
};

/** Encode a linear-light value (0..1) to a display sRGB value (0..1, float). */
function linearToSrgbFloat(lin: number): number {
  const l = lin < 0 ? 0 : lin > 1 ? 1 : lin;
  return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

/** Photoshop "Overlay" blend on display-space operands in [0,1]. */
function overlay(base: number, blend: number): number {
  return base < 0.5 ? 2 * base * blend : 1 - 2 * (1 - base) * (1 - blend);
}

/** Round-then-clamp a 0..1 display value to a byte, matching clampByteRound. */
function toByte(v: number): number {
  const s = v * 255;
  if (s <= 0) return 0;
  if (s >= 255) return 255;
  return (s + 0.5) | 0;
}

/**
 * Apply bleach bypass in place. `data` is RGBA bytes (display sRGB). Alpha is
 * preserved. Edges need no handling — this is a per-pixel point operation.
 */
export function applyBleachBypass(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<BleachBypassParams> = {}
): void {
  const p = { ...BLEACHBYPASS_DEFAULTS, ...params };

  const strength = Math.max(0, Math.min(100, p.strength)) / 100; // 0..1 mix
  const contrastF = Math.max(0, Math.min(100, p.contrast)) / 50; // 0..2, 1 = neutral
  const satRetain = Math.max(0, Math.min(100, p.saturation)) / 100; // 0..1

  // Exact-neutral fast path → guarantees a true identity no-op.
  if (strength === 0 && contrastF === 1 && satRetain === 1) return;

  const n = width * height;
  for (let i = 0; i < n; i++) {
    const j = i * 4;

    // Display-space channels in [0,1].
    const br = data[j] / 255;
    const bg = data[j + 1] / 255;
    const bb = data[j + 2] / 255;

    // 1+2: linear luminance → display grey (the retained "silver" layer).
    const Y =
      0.2126 * SRGB_TO_LINEAR[data[j]] +
      0.7152 * SRGB_TO_LINEAR[data[j + 1]] +
      0.0722 * SRGB_TO_LINEAR[data[j + 2]];
    const grey = linearToSrgbFloat(Y);

    // 3: overlay the grey silver layer onto the colour.
    const oR = overlay(br, grey);
    const oG = overlay(bg, grey);
    const oB = overlay(bb, grey);

    // 4: mix original → bleached.
    let r = br + (oR - br) * strength;
    let g = bg + (oG - bg) * strength;
    let b = bb + (oB - bb) * strength;

    // 5: contrast S-curve about mid-grey (display-space tone tweak).
    if (contrastF !== 1) {
      r = (r - 0.5) * contrastF + 0.5;
      g = (g - 0.5) * contrastF + 0.5;
      b = (b - 0.5) * contrastF + 0.5;
    }

    // 6: desaturate toward perceptual luma (display-space colour tweak).
    if (satRetain !== 1) {
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = L + (r - L) * satRetain;
      g = L + (g - L) * satRetain;
      b = L + (b - L) * satRetain;
    }

    data[j] = toByte(r);
    data[j + 1] = toByte(g);
    data[j + 2] = toByte(b);
    // alpha (data[j + 3]) untouched
  }
}

export const BLEACHBYPASS_EFFECT = {
  id: 'bleachBypass',
  label: 'Bleach Bypass',
  category: 'Effects',
  settings: [
    {
      id: 'strength',
      label: 'Strength',
      min: 0,
      max: 100,
      default: 60,
      step: 1,
      description: 'Mix between the original and the bleached silver-retention look.',
    },
    {
      id: 'contrast',
      label: 'Contrast',
      min: 0,
      max: 100,
      default: 50,
      step: 1,
      description: 'Tone contrast around mid-grey (50 = neutral).',
    },
    {
      id: 'saturation',
      label: 'Saturation',
      min: 0,
      max: 100,
      default: 40,
      step: 1,
      description: 'Colour retained (100 = full colour, 0 = greyscale). Low = bleached.',
    },
  ],
} as const;
