import {
  fastBoxBlur,
  stackBlur,
  separableGaussianBlur,
  gaussianBlurLinear,
} from '../OptimizedBlur';

function flat(w: number, h: number, val: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
    d[i + 3] = 255;
  }
  return d;
}

function meanCh(d: Uint8ClampedArray, ch = 0): number {
  let s = 0;
  let n = 0;
  for (let i = ch; i < d.length; i += 4) {
    s += d[i];
    n++;
  }
  return s / n;
}

describe('OptimizedBlur boundary correctness', () => {
  // Regression test for the fastBoxBlur boundary-guard bug: a correct box
  // blur of a constant image is the constant everywhere. The pre-fix code
  // produced a uniform brightness bias and failed this.
  test('fastBoxBlur of a constant field returns the constant (no brightness bias)', () => {
    const w = 20;
    const h = 16;
    const val = 120;
    const d = flat(w, h, val);
    fastBoxBlur(d, w, h, 5);
    for (let i = 0; i < d.length; i += 4) {
      expect(Math.abs(d[i] - val)).toBeLessThanOrEqual(1);
    }
  });

  test('stackBlur of a constant field returns the constant', () => {
    const w = 24;
    const h = 24;
    const val = 200;
    const d = flat(w, h, val);
    stackBlur(d, w, h, 15);
    for (let i = 0; i < d.length; i += 4) {
      expect(Math.abs(d[i] - val)).toBeLessThanOrEqual(1);
    }
  });

  test('separableGaussianBlur of a constant field returns the constant', () => {
    const w = 18;
    const h = 18;
    const val = 77;
    const d = flat(w, h, val);
    separableGaussianBlur(d, w, h, 4);
    for (let i = 0; i < d.length; i += 4) {
      expect(Math.abs(d[i] - val)).toBeLessThanOrEqual(1);
    }
  });

  test('gaussianBlurLinear of a constant field returns the constant (round-trip safe)', () => {
    const w = 18;
    const h = 18;
    const val = 90;
    const d = flat(w, h, val);
    gaussianBlurLinear(d, w, h, 4);
    for (let i = 0; i < d.length; i += 4) {
      expect(Math.abs(d[i] - val)).toBeLessThanOrEqual(1);
    }
  });

  test('linear blur blends a black/white edge to ~188 (energy-correct), gamma blur darkens to ~127', () => {
    // A heavily-blurred 50/50 black/white field should approach the energy
    // midpoint: encode(0.5 linear) ~= 188, NOT the gamma average 127.5.
    const make = (): Uint8ClampedArray => {
      const w = 8;
      const h = 8;
      const d = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = x < w / 2 ? 0 : 255;
          const i = (y * w + x) * 4;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
          d[i + 3] = 255;
        }
      }
      return d;
    };
    const lin = make();
    gaussianBlurLinear(lin, 8, 8, 30);
    const gamma = make();
    stackBlur(gamma, 8, 8, 30);
    const center = (3 * 8 + 4) * 4; // a pixel near the seam
    expect(lin[center]).toBeGreaterThan(165); // linear stays bright
    expect(gamma[center]).toBeLessThan(150); // gamma muddies/darkens
    expect(lin[center]).toBeGreaterThan(gamma[center] + 20);
  });

  test('fastBoxBlur roughly conserves mean brightness on a ramp', () => {
    const w = 40;
    const h = 1;
    const d = new Uint8ClampedArray(w * 4);
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255);
      const i = x * 4;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    const before = meanCh(d);
    fastBoxBlur(d, w, h, 4);
    const after = meanCh(d);
    // extend-boundary adds a tiny symmetric edge bias; mean should be stable
    expect(Math.abs(after - before)).toBeLessThan(3);
  });
});
