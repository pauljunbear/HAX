/**
 * Channel Mixer — each output channel is a weighted sum of the input R/G/B
 * channels, with an optional monochrome mode. This is the engine behind proper
 * black-and-white film mixes (e.g. a "red filter" sky-darkening B&W), clean
 * channel swaps, and infrared-ish looks where one channel borrows another's
 * energy.
 *
 *   outR = rR·R + rG·G + rB·B
 *   outG = gR·R + gG·G + gB·B
 *   outB = bR·R + bG·G + bB·B
 *
 * In monochrome mode every output channel uses the R-row weights:
 *   gray = rR·R + rG·G + rB·B  →  outR = outG = outB = gray
 *
 * WHY LINEAR LIGHT. Channel mixing is the addition and scaling of light — a
 * weighted sum of radiance. Adding radiances is only physically meaningful in
 * LINEAR light, not on the gamma-encoded bytes the canvas stores. A 50/50 mix
 * of a black channel (0) and a white channel (255) is half the *light*, which
 * re-encodes to byte ~188, not the display-space midpoint 128. So we decode each
 * channel to linear via the SRGB_TO_LINEAR LUT, take the weighted sum there, and
 * re-encode with linearToSrgbByte (which clamps to [0,1] and rounds). The matrix
 * coefficients themselves are unitless ratios, so a percentage UI (−200..200 →
 * −2..2) maps cleanly onto the linear math.
 *
 * Slider values are PERCENTAGES (−200..200) so the neutral identity matrix is a
 * readable 100/0/0, 0/100/0, 0/0/100. At those defaults the op is an exact
 * no-op (fast-pathed below). Alpha is never touched.
 *
 * No randomness is used, so the result is fully deterministic — preview always
 * equals export without needing a seed. No dithering is applied because nothing
 * here reduces bit depth; output is a smooth per-pixel remap rounded once with
 * clampByteRound inside linearToSrgbByte.
 *
 * One linear pass, O(pixels). Per pixel: 3 LUT reads, 9 multiply-adds, 3 encodes
 * (1 in mono). No spatial sampling, so there are no image-edge cases.
 */

import { SRGB_TO_LINEAR, linearToSrgbByte } from '../color-space';

export interface ChannelMixerParams {
  /** Output RED  = (rFromR·R + rFromG·G + rFromB·B), each a percentage. */
  rFromR: number;
  rFromG: number;
  rFromB: number;
  /** Output GREEN = (gFromR·R + gFromG·G + gFromB·B). */
  gFromR: number;
  gFromG: number;
  gFromB: number;
  /** Output BLUE  = (bFromR·R + bFromG·G + bFromB·B). */
  bFromR: number;
  bFromG: number;
  bFromB: number;
  /** ≥ 0.5 → monochrome: all channels = the R-row mix. 0/1 toggle. */
  monochrome: number;
}

export const CHANNELMIXER_DEFAULTS: ChannelMixerParams = {
  rFromR: 100,
  rFromG: 0,
  rFromB: 0,
  gFromR: 0,
  gFromG: 100,
  gFromB: 0,
  bFromR: 0,
  bFromG: 0,
  bFromB: 100,
  monochrome: 0,
};

/** Coerce a partial/untrusted value to a finite number, else the default. */
function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function applyChannelMixer(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: Partial<ChannelMixerParams>
): void {
  void width;
  void height;

  const d = CHANNELMIXER_DEFAULTS;
  // Percentages → unitless coefficients (100 → 1.0).
  const rR = num(params.rFromR, d.rFromR) / 100;
  const rG = num(params.rFromG, d.rFromG) / 100;
  const rB = num(params.rFromB, d.rFromB) / 100;
  const gR = num(params.gFromR, d.gFromR) / 100;
  const gG = num(params.gFromG, d.gFromG) / 100;
  const gB = num(params.gFromB, d.gFromB) / 100;
  const bR = num(params.bFromR, d.bFromR) / 100;
  const bG = num(params.bFromG, d.bFromG) / 100;
  const bB = num(params.bFromB, d.bFromB) / 100;
  const mono = num(params.monochrome, d.monochrome) >= 0.5;

  // Fast path: neutral identity matrix in colour mode is an exact no-op.
  // Guarantees a byte-exact pass-through (a linear round-trip could otherwise
  // drift a value by 1 LSB) and skips the per-pixel work entirely.
  if (
    !mono &&
    rR === 1 &&
    rG === 0 &&
    rB === 0 &&
    gR === 0 &&
    gG === 1 &&
    gB === 0 &&
    bR === 0 &&
    bG === 0 &&
    bB === 1
  ) {
    return;
  }

  for (let i = 0; i < data.length; i += 4) {
    const lr = SRGB_TO_LINEAR[data[i]];
    const lg = SRGB_TO_LINEAR[data[i + 1]];
    const lb = SRGB_TO_LINEAR[data[i + 2]];

    if (mono) {
      const gray = linearToSrgbByte(rR * lr + rG * lg + rB * lb);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    } else {
      data[i] = linearToSrgbByte(rR * lr + rG * lg + rB * lb);
      data[i + 1] = linearToSrgbByte(gR * lr + gG * lg + gB * lb);
      data[i + 2] = linearToSrgbByte(bR * lr + bG * lg + bB * lb);
    }
    // data[i + 3] (alpha) is left untouched.
  }
}

export const CHANNELMIXER_EFFECT = {
  id: 'channelMixer',
  label: 'Channel Mixer',
  category: 'Color',
  settings: [
    {
      id: 'rFromR',
      label: 'Red ← Red',
      min: -200,
      max: 200,
      default: 100,
      step: 1,
      description: 'Percent of the input red that contributes to output red.',
    },
    {
      id: 'rFromG',
      label: 'Red ← Green',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input green that contributes to output red.',
    },
    {
      id: 'rFromB',
      label: 'Red ← Blue',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input blue that contributes to output red.',
    },
    {
      id: 'gFromR',
      label: 'Green ← Red',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input red that contributes to output green.',
    },
    {
      id: 'gFromG',
      label: 'Green ← Green',
      min: -200,
      max: 200,
      default: 100,
      step: 1,
      description: 'Percent of the input green that contributes to output green.',
    },
    {
      id: 'gFromB',
      label: 'Green ← Blue',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input blue that contributes to output green.',
    },
    {
      id: 'bFromR',
      label: 'Blue ← Red',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input red that contributes to output blue.',
    },
    {
      id: 'bFromG',
      label: 'Blue ← Green',
      min: -200,
      max: 200,
      default: 0,
      step: 1,
      description: 'Percent of the input green that contributes to output blue.',
    },
    {
      id: 'bFromB',
      label: 'Blue ← Blue',
      min: -200,
      max: 200,
      default: 100,
      step: 1,
      description: 'Percent of the input blue that contributes to output blue.',
    },
    {
      id: 'monochrome',
      label: 'Monochrome',
      min: 0,
      max: 1,
      default: 0,
      step: 1,
      description: 'When on, every channel uses the red-row mix for a B&W result.',
    },
  ],
} as const;
