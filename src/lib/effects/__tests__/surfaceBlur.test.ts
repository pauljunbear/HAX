import {
  applySurfaceBlur,
  SURFACEBLUR_DEFAULTS,
  SURFACEBLUR_EFFECT,
  type SurfaceBlurParams,
} from '../pro/surfaceBlur';

/** Opaque RGBA buffer of size w*h filled with a per-pixel painter. */
function makeImage(
  w: number,
  h: number,
  paint: (x: number, y: number) => [number, number, number, number?]
): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = paint(x, y);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a ?? 255;
    }
  }
  return d;
}

/** Left half = lo, right half = hi: a hard vertical step edge at x = w/2. */
function stepEdge(w: number, h: number, lo: number, hi: number): Uint8ClampedArray {
  return makeImage(w, h, x => {
    const v = x < w / 2 ? lo : hi;
    return [v, v, v, 255];
  });
}

const px = (d: Uint8ClampedArray, w: number, x: number, y: number, c = 0) => d[(y * w + x) * 4 + c];

describe('surfaceBlur — bilateral edge-preserving filter', () => {
  describe('descriptor contract', () => {
    it('settings ids/defaults mirror SURFACEBLUR_DEFAULTS', () => {
      expect(SURFACEBLUR_EFFECT.id).toBe('surfaceBlur');
      expect(SURFACEBLUR_EFFECT.category).toBe('Blur');
      const byId = Object.fromEntries(SURFACEBLUR_EFFECT.settings.map(s => [s.id, s]));
      const keys = Object.keys(SURFACEBLUR_DEFAULTS) as (keyof SurfaceBlurParams)[];
      // one setting per Params field, no extras
      expect(SURFACEBLUR_EFFECT.settings).toHaveLength(keys.length);
      for (const k of keys) {
        expect(byId[k]).toBeDefined();
        expect(byId[k].default).toBe(SURFACEBLUR_DEFAULTS[k]);
        expect(byId[k].min).toBeLessThanOrEqual(byId[k].default);
        expect(byId[k].max).toBeGreaterThanOrEqual(byId[k].default);
      }
    });

    it('matches the briefed ranges (radius 1..20/6, threshold 1..100/25)', () => {
      const byId = Object.fromEntries(SURFACEBLUR_EFFECT.settings.map(s => [s.id, s]));
      expect(byId.radius).toMatchObject({ min: 1, max: 20, default: 6, step: 1 });
      expect(byId.threshold).toMatchObject({ min: 1, max: 100, default: 25, step: 1 });
    });
  });

  describe('identity / no-op properties', () => {
    it('leaves a perfectly flat field unchanged (averaging identical pixels is exact)', () => {
      const d = makeImage(40, 30, () => [123, 77, 200, 255]);
      const before = Uint8Array.from(d);
      applySurfaceBlur(d, 40, 30, { radius: 8, threshold: 40 });
      expect(Array.from(d)).toEqual(Array.from(before));
    });

    it('radius < 1 is a no-op', () => {
      const d = stepEdge(20, 20, 10, 240);
      const before = Uint8Array.from(d);
      applySurfaceBlur(d, 20, 20, { radius: 0, threshold: 50 });
      expect(Array.from(d)).toEqual(Array.from(before));
    });

    it('preserves the alpha channel', () => {
      const d = makeImage(24, 24, (x, y) => [x * 8, y * 8, 128, (x + y) % 256]);
      const alphaBefore = Array.from({ length: 24 * 24 }, (_, i) => d[i * 4 + 3]);
      applySurfaceBlur(d, 24, 24, { radius: 5, threshold: 30 });
      const alphaAfter = Array.from({ length: 24 * 24 }, (_, i) => d[i * 4 + 3]);
      expect(alphaAfter).toEqual(alphaBefore);
    });
  });

  describe('the defining transform: edge preservation vs. flat smoothing', () => {
    it('keeps a hard edge crisp while a plain blur would smear it', () => {
      const W = 40;
      const H = 8;
      const lo = 20;
      const hi = 235;
      // threshold (12) << edge contrast (215) ⇒ the edge must survive.
      const d = stepEdge(W, H, lo, hi);
      applySurfaceBlur(d, W, H, { radius: 6, threshold: 12 });

      const mid = W / 2; // edge sits between x=mid-1 (lo) and x=mid (hi)
      const y = H >> 1;
      const darkSide = px(d, W, mid - 1, y);
      const brightSide = px(d, W, mid, y);

      // Edge-adjacent pixels stay on their own side of the contrast...
      expect(darkSide).toBeLessThan(lo + 20);
      expect(brightSide).toBeGreaterThan(hi - 20);
      // ...so the step across the edge is still nearly the full contrast,
      // whereas a Gaussian blur of the same radius would collapse it toward grey.
      expect(brightSide - darkSide).toBeGreaterThan(170);
    });

    it('smooths low-contrast texture in a flat region (variance drops, mean holds)', () => {
      const W = 48;
      const H = 48;
      const baseY = 128;
      // Deterministic small ripple (±~10 levels) — a "flat" patch with fine texture,
      // all differences well under the threshold so the filter should smooth it.
      const ripple = (x: number, y: number) =>
        Math.round(8 * Math.sin(x * 1.3) + 7 * Math.cos(y * 1.1));
      const make = () =>
        makeImage(W, H, (x, y) => {
          const v = baseY + ripple(x, y);
          return [v, v, v, 255];
        });

      const before = make();
      const after = make();
      applySurfaceBlur(after, W, H, { radius: 6, threshold: 50 });

      // measure interior only (avoid edge-clamp bias)
      const stats = (d: Uint8ClampedArray) => {
        let sum = 0;
        let n = 0;
        const vals: number[] = [];
        for (let y = 8; y < H - 8; y++) {
          for (let x = 8; x < W - 8; x++) {
            const v = px(d, W, x, y);
            vals.push(v);
            sum += v;
            n++;
          }
        }
        const mean = sum / n;
        const variance = vals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
        return { mean, variance };
      };

      const b = stats(before);
      const a = stats(after);
      expect(a.variance).toBeLessThan(b.variance * 0.5); // clearly smoothed
      expect(Math.abs(a.mean - b.mean)).toBeLessThan(2); // energy-preserving, no darkening
    });
  });

  describe('monotonic response to the threshold slider', () => {
    it('higher threshold lets more tone bleed across an edge', () => {
      const W = 40;
      const H = 8;
      // Moderate-contrast edge (60 levels): low threshold fully preserves it,
      // high threshold treats it as smooth and blurs across — so the sweep is
      // expressive. (A 200+ level edge survives even max threshold, by design.)
      const lo = 100;
      const hi = 160;
      const y = H >> 1;
      const mid = W / 2;

      // Bright pixel adjacent to the edge: as threshold rises, the dark side is
      // allowed to pull it down further. Its value must fall monotonically.
      const thresholds = [4, 15, 40, 100];
      const values = thresholds.map(t => {
        const d = stepEdge(W, H, lo, hi);
        applySurfaceBlur(d, W, H, { radius: 6, threshold: t });
        return px(d, W, mid, y);
      });

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
      // and the extremes are meaningfully different (low thr preserves, high thr blurs)
      expect(values[0] - values[values.length - 1]).toBeGreaterThan(15);
    });
  });

  describe('determinism', () => {
    it('is bit-identical across runs (no unseeded randomness)', () => {
      const mk = () =>
        makeImage(32, 32, (x, y) => [(x * 7) % 256, (y * 11) % 256, (x * y) % 256, 255]);
      const a = mk();
      const b = mk();
      applySurfaceBlur(a, 32, 32, { radius: 5, threshold: 33 });
      applySurfaceBlur(b, 32, 32, { radius: 5, threshold: 33 });
      expect(Array.from(a)).toEqual(Array.from(b));
    });
  });

  describe('edge / numeric safety', () => {
    it('produces no NaN and stays in [0,255] on a noisy image incl. extreme params', () => {
      const W = 33;
      const H = 17;
      const d = makeImage(W, H, (x, y) => [
        (x * 13 + y * 7) % 256,
        (x * 3 + y * 29) % 256,
        (x * 17 + y * 5) % 256,
        255,
      ]);
      applySurfaceBlur(d, W, H, { radius: 20, threshold: 100 });
      for (let i = 0; i < d.length; i++) {
        expect(Number.isNaN(d[i])).toBe(false);
        expect(d[i]).toBeGreaterThanOrEqual(0);
        expect(d[i]).toBeLessThanOrEqual(255);
      }
    });

    it('handles a 1x1 image and a single-row image without throwing', () => {
      const one = makeImage(1, 1, () => [90, 160, 30, 255]);
      expect(() => applySurfaceBlur(one, 1, 1, {})).not.toThrow();
      expect(Array.from(one)).toEqual([90, 160, 30, 255]); // nothing to average

      const row = makeImage(10, 1, x => [x * 25, 0, 0, 255]);
      expect(() => applySurfaceBlur(row, 10, 1, { radius: 4, threshold: 40 })).not.toThrow();
    });

    it('clamps an out-of-range radius (radius>20 behaves like radius 20)', () => {
      const W = 24;
      const H = 24;
      const a = makeImage(W, H, (x, y) => [(x * 9) % 256, (y * 9) % 256, 64, 255]);
      const b = Uint8ClampedArray.from(a);
      applySurfaceBlur(a, W, H, { radius: 999, threshold: 40 });
      applySurfaceBlur(b, W, H, { radius: 20, threshold: 40 });
      expect(Array.from(a)).toEqual(Array.from(b));
    });
  });
});
