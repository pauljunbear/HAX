import { applyClarity, CLARITY_DEFAULTS, CLARITY_EFFECT, ClarityParams } from '../pro/clarity';
import { SRGB_TO_LINEAR } from '../color-space';

/** Vertical step edge of GREY (R=G=B): x < w/2 → left, else right. Opaque. */
function greyEdge(w: number, h: number, left: number, right: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const mid = w >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x < mid ? left : right;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

/** Vertical step edge of a single hue (channels proportional both sides). Opaque. */
function colorEdge(
  w: number,
  h: number,
  lo: [number, number, number],
  hi: [number, number, number]
): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const mid = w >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = x < mid ? lo : hi;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  return d;
}

const W = 96;
const H = 6;
const MID = W >> 1;
const sampleRow = 3;
const brightIdx = (sampleRow * W + MID) * 4; // first bright column, on the edge
const darkIdx = (sampleRow * W + (MID - 1)) * 4; // last dark column, on the edge

describe('clarity — descriptor', () => {
  it('exposes one setting per ClarityParams field with matching ids and defaults', () => {
    expect(CLARITY_EFFECT.id).toBe('clarity');
    expect(CLARITY_EFFECT.category).toBe('Adjust');
    const ids = CLARITY_EFFECT.settings.map(s => s.id).sort();
    expect(ids).toEqual(['amount', 'protectTones', 'radius']);
    for (const s of CLARITY_EFFECT.settings) {
      const key = s.id as keyof ClarityParams;
      expect(s.default).toBe(CLARITY_DEFAULTS[key]);
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
    }
  });

  it('default params match the stated ranges', () => {
    expect(CLARITY_DEFAULTS).toEqual({ amount: 0, radius: 40, protectTones: 50 });
  });
});

describe('clarity — identity / no-op', () => {
  it('amount = 0 is a bit-exact no-op (default)', () => {
    const a = greyEdge(W, H, 100, 160);
    const b = Uint8ClampedArray.from(a);
    applyClarity(a, W, H); // defaults → amount 0
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('amount = 0 is a no-op even with a large radius set', () => {
    const a = greyEdge(W, H, 80, 180);
    const b = Uint8ClampedArray.from(a);
    applyClarity(a, W, H, { amount: 0, radius: 120, protectTones: 100 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('clarity — defining transform (unsharp on luminance)', () => {
  it('positive amount raises the bright side and lowers the dark side of an edge', () => {
    const orig = greyEdge(W, H, 100, 160);
    const out = Uint8ClampedArray.from(orig);
    applyClarity(out, W, H, { amount: 70, radius: 24, protectTones: 50 });
    // bright-near-edge goes UP, dark-near-edge goes DOWN — the classic over/undershoot.
    expect(out[brightIdx]).toBeGreaterThan(orig[brightIdx]);
    expect(out[darkIdx]).toBeLessThan(orig[darkIdx]);
  });

  it('increases local edge contrast (bright − dark gap widens)', () => {
    const orig = greyEdge(W, H, 100, 160);
    const out = Uint8ClampedArray.from(orig);
    applyClarity(out, W, H, { amount: 70, radius: 24, protectTones: 50 });
    const before = orig[brightIdx] - orig[darkIdx];
    const after = out[brightIdx] - out[darkIdx];
    expect(after).toBeGreaterThan(before);
  });

  it('negative amount softens local contrast (gap narrows)', () => {
    const orig = greyEdge(W, H, 100, 160);
    const out = Uint8ClampedArray.from(orig);
    applyClarity(out, W, H, { amount: -70, radius: 24, protectTones: 50 });
    const before = orig[brightIdx] - orig[darkIdx];
    const after = out[brightIdx] - out[darkIdx];
    expect(after).toBeLessThan(before);
  });

  it('is monotonic in amount on the bright side of an edge', () => {
    const base = greyEdge(W, H, 100, 160);
    const vals: number[] = [];
    for (const amount of [0, 25, 50, 100]) {
      const d = Uint8ClampedArray.from(base);
      applyClarity(d, W, H, { amount, radius: 24, protectTones: 50 });
      vals.push(d[brightIdx]);
    }
    for (let k = 1; k < vals.length; k++) {
      expect(vals[k]).toBeGreaterThan(vals[k - 1]);
    }
  });
});

describe('clarity — luminance only (no hue shift)', () => {
  it('keeps a grey image neutral (R == G == B) after a strong boost', () => {
    const d = greyEdge(W, H, 90, 170);
    applyClarity(d, W, H, { amount: 90, radius: 24, protectTones: 40 });
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
    }
  });

  it('preserves chromaticity (linear channel ratios) on a coloured edge', () => {
    // Same hue both sides (120:80:50 ≈ 180:120:75), brightness step only.
    const lo: [number, number, number] = [120, 80, 50];
    const hi: [number, number, number] = [180, 120, 75];
    const d = colorEdge(W, H, lo, hi);
    applyClarity(d, W, H, { amount: 80, radius: 24, protectTones: 40 });

    // The bright-near-edge pixel was hi=(180,120,75); ratios must survive.
    const inRG = SRGB_TO_LINEAR[180] / SRGB_TO_LINEAR[120];
    const inRB = SRGB_TO_LINEAR[180] / SRGB_TO_LINEAR[75];
    const outR = SRGB_TO_LINEAR[d[brightIdx]];
    const outG = SRGB_TO_LINEAR[d[brightIdx + 1]];
    const outB = SRGB_TO_LINEAR[d[brightIdx + 2]];
    // The pixel actually changed (effect ran), but hue (ratios) held.
    expect(d[brightIdx]).not.toBe(180);
    expect(Math.abs(outR / outG - inRG)).toBeLessThan(0.1);
    expect(Math.abs(outR / outB - inRB)).toBeLessThan(0.2);
  });
});

describe('clarity — midtone mask protects highlights', () => {
  it('a highlight edge changes less with high protectTones than low', () => {
    const make = () => colorEdge(W, H, [185, 185, 185], [225, 225, 225]); // bright greys
    const orig = 225;

    const low = make();
    applyClarity(low, W, H, { amount: 80, radius: 24, protectTones: 10 });
    const lowChange = Math.abs(low[brightIdx] - orig);

    const high = make();
    applyClarity(high, W, H, { amount: 80, radius: 24, protectTones: 90 });
    const highChange = Math.abs(high[brightIdx] - orig);

    expect(lowChange).toBeGreaterThan(0);
    expect(highChange).toBeLessThan(lowChange);
  });
});

describe('clarity — determinism', () => {
  it('produces identical output across runs (no randomness)', () => {
    const a = greyEdge(W, H, 100, 160);
    const b = Uint8ClampedArray.from(a);
    applyClarity(a, W, H, { amount: 65, radius: 33, protectTones: 55 });
    applyClarity(b, W, H, { amount: 65, radius: 33, protectTones: 55 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('clarity — edge safety', () => {
  it('handles a 1x1 image with extreme params (finite, in range, alpha kept)', () => {
    const d = new Uint8ClampedArray([128, 64, 200, 177]);
    applyClarity(d, 1, 1, { amount: 100, radius: 150, protectTones: 0 });
    for (let i = 0; i < 3; i++) {
      expect(Number.isFinite(d[i])).toBe(true);
      expect(d[i]).toBeGreaterThanOrEqual(0);
      expect(d[i]).toBeLessThanOrEqual(255);
    }
    expect(d[3]).toBe(177); // alpha untouched
  });

  it('handles a thin 1xN strip and produces only finite bytes', () => {
    const w = 40;
    const d = greyEdge(w, 1, 20, 230);
    applyClarity(d, w, 1, { amount: -100, radius: 150, protectTones: 100 });
    for (let i = 0; i < d.length; i++) {
      expect(Number.isFinite(d[i])).toBe(true);
      expect(d[i]).toBeGreaterThanOrEqual(0);
      expect(d[i]).toBeLessThanOrEqual(255);
    }
  });

  it('zero-area image is a safe no-op (no throw)', () => {
    const d = new Uint8ClampedArray(0);
    expect(() => applyClarity(d, 0, 0, { amount: 80 })).not.toThrow();
  });

  it('does not push a near-black pixel negative or NaN', () => {
    // black field with one bright pixel → strong negative detail around it
    const w = 32;
    const h = 32;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
    const c = ((h >> 1) * w + (w >> 1)) * 4;
    d[c] = d[c + 1] = d[c + 2] = 255;
    applyClarity(d, w, h, { amount: 100, radius: 20, protectTones: 0 });
    for (let i = 0; i < d.length; i++) {
      expect(Number.isFinite(d[i])).toBe(true);
      expect(d[i]).toBeGreaterThanOrEqual(0);
      expect(d[i]).toBeLessThanOrEqual(255);
    }
  });
});
