import { applyGrain, isoToGrainIntensity, DEFAULT_GRAIN } from '../film/grain';

/** Fill an RGBA buffer with a flat gray. */
function flat(w: number, h: number, v: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return d;
}

/** Std-dev of (channel - reference) over all pixels. */
function sigma(d: Uint8ClampedArray, ref: number, ch = 0): number {
  let n = 0;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const e = d[i + ch] - ref;
    s += e;
    s2 += e * e;
    n++;
  }
  const mean = s / n;
  return Math.sqrt(s2 / n - mean * mean);
}

describe('seeded film grain', () => {
  it('intensity = 0 is a no-op', () => {
    const a = flat(32, 32, 128);
    const b = Uint8Array.from(a);
    applyGrain(a, 32, 32, { intensity: 0 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is deterministic for a fixed seed (preview == export)', () => {
    const a = flat(48, 48, 128);
    const b = flat(48, 48, 128);
    applyGrain(a, 48, 48, { seed: 42, intensity: 0.03 });
    applyGrain(b, 48, 48, { seed: 42, intensity: 0.03 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('different seeds produce different grain', () => {
    const a = flat(48, 48, 128);
    const b = flat(48, 48, 128);
    applyGrain(a, 48, 48, { seed: 1, intensity: 0.03 });
    applyGrain(b, 48, 48, { seed: 2, intensity: 0.03 });
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('produces visible variance on a mid-gray patch, scaling with intensity', () => {
    const lo = flat(64, 64, 128);
    const hi = flat(64, 64, 128);
    applyGrain(lo, 64, 64, { seed: 7, intensity: 0.01 });
    applyGrain(hi, 64, 64, { seed: 7, intensity: 0.04 });
    const sLo = sigma(lo, 128);
    const sHi = sigma(hi, 128);
    expect(sLo).toBeGreaterThan(0.3);
    expect(sHi).toBeGreaterThan(sLo * 2); // ~4x intensity → meaningfully more grain
  });

  it('variance peaks in the midtones and vanishes at the extremes (Boolean envelope)', () => {
    const W = 256;
    const H = 64;
    // column x has constant gray = x
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = x;
        d[i + 3] = 255;
      }
    }
    applyGrain(d, W, H, { seed: 11, intensity: 0.05, grainSize: 1 });
    // per-column sigma vs the column's reference gray
    const colSigma = (x: number): number => {
      let s = 0;
      let s2 = 0;
      for (let y = 0; y < H; y++) {
        const e = d[(y * W + x) * 4] - x;
        s += e;
        s2 += e * e;
      }
      const m = s / H;
      return Math.sqrt(s2 / H - m * m);
    };
    const mid = colSigma(128);
    const dark = colSigma(6);
    const light = colSigma(250);
    expect(mid).toBeGreaterThan(dark * 3);
    expect(mid).toBeGreaterThan(light * 3);
  });

  it('is monochrome by default (equal R=G=B delta) and adds chroma when asked', () => {
    const mono = flat(40, 40, 130);
    applyGrain(mono, 40, 40, { seed: 5, intensity: 0.04, colorAmount: 0 });
    // luminance grain => identical deltas across channels
    for (let i = 0; i < mono.length; i += 4) {
      expect(mono[i]).toBe(mono[i + 1]);
      expect(mono[i + 1]).toBe(mono[i + 2]);
    }
    const chroma = flat(40, 40, 130);
    applyGrain(chroma, 40, 40, { seed: 5, intensity: 0.04, colorAmount: 0.5 });
    let differs = false;
    for (let i = 0; i < chroma.length; i += 4) {
      if (chroma[i] !== chroma[i + 1] || chroma[i + 1] !== chroma[i + 2]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('isoToGrainIntensity is monotonic in film speed', () => {
    expect(isoToGrainIntensity(100)).toBeGreaterThan(isoToGrainIntensity(50));
    expect(isoToGrainIntensity(1600)).toBeGreaterThan(isoToGrainIntensity(400));
    expect(DEFAULT_GRAIN.colorAmount).toBe(0);
  });
});
