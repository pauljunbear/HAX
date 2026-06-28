import { applyHalation } from '../film/halation';

/** Black canvas with a bright white square in the center. */
function spot(w: number, h: number, size: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
  const x0 = (w - size) >> 1;
  const y0 = (h - size) >> 1;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
  }
  return d;
}

describe('halation', () => {
  it('intensity = 0 is a no-op', () => {
    const a = spot(64, 64, 16);
    const b = Uint8Array.from(a);
    applyHalation(a, 64, 64, { intensity: 0 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('leaves a highlight-free (all black) image unchanged', () => {
    const d = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
    const before = Uint8Array.from(d);
    applyHalation(d, 32, 32, { intensity: 0.8 });
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it('blooms a red/orange glow into the dark area around a highlight', () => {
    const W = 80;
    const H = 80;
    const d = spot(W, H, 20);
    applyHalation(d, W, H, { intensity: 0.8 });
    // Sample a pixel in the black region a few px outside the white block edge.
    // block spans [30,50); test at x=54 (4px right of the edge), mid-height.
    const i = (40 * W + 54) * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    expect(r).toBeGreaterThan(5); // glow reached here
    expect(r).toBeGreaterThan(g); // red-dominant
    expect(r).toBeGreaterThan(b);
  });

  it('stronger intensity produces a stronger glow', () => {
    const W = 80;
    const H = 80;
    const lo = spot(W, H, 20);
    const hi = spot(W, H, 20);
    applyHalation(lo, W, H, { intensity: 0.3 });
    applyHalation(hi, W, H, { intensity: 0.9 });
    const i = (40 * W + 54) * 4;
    expect(hi[i]).toBeGreaterThan(lo[i]);
  });
});
