import { applyEffect } from '../../effects';
import { SRGB_TO_LINEAR } from '../color-space';

type Img = { data: Uint8ClampedArray; width: number; height: number };

function grayImage(w: number, h: number, v: number): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

function linearLuminance(data: Uint8ClampedArray): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    s +=
      0.2126 * SRGB_TO_LINEAR[data[i]] +
      0.7152 * SRGB_TO_LINEAR[data[i + 1]] +
      0.0722 * SRGB_TO_LINEAR[data[i + 2]];
    n++;
  }
  return s / n;
}

describe('effect correctness fixes (live dispatch path)', () => {
  test('colorTemperature warms without changing (linear) luminance', async () => {
    const img = grayImage(8, 8, 128);
    const before = linearLuminance(img.data);
    const [fn] = await applyEffect('colorTemperature', { temperature: 80, tint: 0 });
    fn(img);
    const after = linearLuminance(img.data);
    // Luminance is preserved per-pixel by construction
    expect(Math.abs(after - before)).toBeLessThan(0.01);
    // ...and it actually warms: red rises above blue
    expect(img.data[0]).toBeGreaterThan(img.data[2]);
  });

  test('glitchArt is deterministic for a fixed seed (preview == export)', async () => {
    const mk = (): Img => {
      const d = new Uint8ClampedArray(32 * 32 * 4);
      for (let i = 0; i < d.length; i++) d[i] = (i * 37) % 256;
      return { data: d, width: 32, height: 32 };
    };
    const a = mk();
    const b = mk();
    const [fa] = await applyEffect('glitchArt', { blockiness: 0.25, colorShift: 8, seed: 7 });
    fa(a);
    const [fb] = await applyEffect('glitchArt', { blockiness: 0.25, colorShift: 8, seed: 7 });
    fb(b);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  test('error-diffusion dithering conserves mean brightness (float buffer, no clamp loss)', async () => {
    // A flat mid-gray field dithered to 2 levels should average back to the
    // input brightness; the float error buffer keeps that true near 0/255.
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    const val = 100;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    const img: Img = { data, width: w, height: h };
    const [fn] = await applyEffect('advancedDithering', {
      algorithm: 0, // Floyd-Steinberg
      palette: 0, // 2-level B&W
      threshold: 0.5,
      patternScale: 2,
      contrast: 1,
    });
    fn(img);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i];
      n++;
    }
    expect(Math.abs(sum / n - val)).toBeLessThan(8);
    // and it actually dithered to two levels (not left flat)
    const distinct = new Set<number>();
    for (let i = 0; i < data.length; i += 4) distinct.add(data[i]);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  test('chromatic aberration sub-pixel amount shifts channels (dead lower slider fixed)', async () => {
    const w = 16;
    const h = 4;
    const mk = (): Img => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const v = Math.round((x * 255) / (w - 1));
          d[i] = v; // R ramp →
          d[i + 1] = 128;
          d[i + 2] = 255 - v; // B ramp ←
          d[i + 3] = 255;
        }
      }
      return { data: d, width: w, height: h };
    };
    const before = mk();
    const img = mk();
    const [fn] = await applyEffect('chromaticAberration', { amount: 0.3, angle: 0 });
    fn(img);
    // Old integer-rounding made amount 0.3 a no-op; bilinear sampling shifts it.
    expect(Array.from(img.data)).not.toEqual(Array.from(before.data));
  });
});
