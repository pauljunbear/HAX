import {
  applySplitTone,
  SPLITTONE_DEFAULTS,
  SPLITTONE_EFFECT,
  type SplitToneParams,
} from '../pro/splitTone';

const R_LUMA = 0.299;
const G_LUMA = 0.587;
const B_LUMA = 0.114;

/** Solid w×h image of one RGB colour, opaque. */
function solid(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  return d;
}

/** A horizontal black→white luma ramp. */
function ramp(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.round((x / (w - 1)) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

function lumaByte(d: Uint8ClampedArray, i: number): number {
  return R_LUMA * d[i] + G_LUMA * d[i + 1] + B_LUMA * d[i + 2];
}

function run(d: Uint8ClampedArray, w: number, h: number, params: Partial<SplitToneParams>) {
  applySplitTone(d, w, h, params);
  return d;
}

describe('Split Toning', () => {
  // ---- identity / no-op ----
  it('is an exact no-op at the defaults (both saturations 0)', () => {
    const a = ramp(33, 4);
    const b = Uint8ClampedArray.from(a);
    applySplitTone(a, 33, 4, SPLITTONE_DEFAULTS);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is an exact no-op when both saturations are 0 regardless of hue/balance', () => {
    const a = ramp(20, 2);
    const b = Uint8ClampedArray.from(a);
    applySplitTone(a, 20, 2, {
      shadowHue: 300,
      shadowSat: 0,
      highlightHue: 90,
      highlightSat: 0,
      balance: 75,
    });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  // ---- the defining transform: correct band gets the correct hue ----
  it('tints shadows toward the shadow hue (red shifts a dark pixel toward red)', () => {
    // dark grey pixel — strongly in the shadow band
    const d = run(solid(1, 1, 50, 50, 50), 1, 1, {
      shadowHue: 0, // red
      shadowSat: 80,
      highlightSat: 0,
      balance: 0,
    });
    expect(d[0]).toBeGreaterThan(d[1]); // R > G
    expect(d[0]).toBeGreaterThan(d[2]); // R > B
  });

  it('tints highlights toward the highlight hue (blue shifts a bright pixel toward blue)', () => {
    const d = run(solid(1, 1, 205, 205, 205), 1, 1, {
      shadowSat: 0,
      highlightHue: 240, // blue
      highlightSat: 80,
      balance: 0,
    });
    expect(d[2]).toBeGreaterThan(d[0]); // B > R
    expect(d[2]).toBeGreaterThan(d[1]); // B > G
  });

  it('leaves the opposite band largely alone (a bright pixel barely sees the shadow tint)', () => {
    const before = solid(1, 1, 235, 235, 235);
    const d = run(Uint8ClampedArray.from(before), 1, 1, {
      shadowHue: 0,
      shadowSat: 100,
      highlightSat: 0,
      balance: 0,
    });
    // Highlight pixel, shadow-only tint → channel spread should stay small.
    const spread = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
    expect(spread).toBeLessThan(20);
  });

  // ---- monotonic response to the main strength sliders ----
  it('shadow chroma increases monotonically with shadowSat', () => {
    let prev = -1;
    for (const sat of [0, 20, 40, 60, 80, 100]) {
      const d = run(solid(1, 1, 60, 60, 60), 1, 1, {
        shadowHue: 0,
        shadowSat: sat,
        highlightSat: 0,
        balance: 0,
      });
      const chroma = d[0] - d[1]; // red tint ⇒ R pulls above G
      expect(chroma).toBeGreaterThanOrEqual(prev);
      prev = chroma;
    }
    expect(prev).toBeGreaterThan(0); // at sat=100 there is real chroma
  });

  it('highlight chroma increases monotonically with highlightSat', () => {
    let prev = -1;
    for (const sat of [0, 25, 50, 75, 100]) {
      const d = run(solid(1, 1, 200, 200, 200), 1, 1, {
        shadowSat: 0,
        highlightHue: 240,
        highlightSat: sat,
        balance: 0,
      });
      const chroma = d[2] - d[0];
      expect(chroma).toBeGreaterThanOrEqual(prev);
      prev = chroma;
    }
    expect(prev).toBeGreaterThan(0);
  });

  // ---- balance shifts the crossover ----
  it('positive balance favours the highlight colour on a midtone; negative favours the shadow colour', () => {
    const make = (balance: number) =>
      run(solid(1, 1, 128, 128, 128), 1, 1, {
        shadowHue: 0, // red shadows
        shadowSat: 80,
        highlightHue: 240, // blue highlights
        highlightSat: 80,
        balance,
      });
    const pos = make(60); // favour highlights → bluer
    const neg = make(-60); // favour shadows → redder
    expect(pos[2]).toBeGreaterThan(neg[2]); // more blue when balance>0
    expect(neg[0]).toBeGreaterThan(pos[0]); // more red when balance<0
  });

  // ---- luma preservation ----
  it('preserves perceived luma on a midtone (no exposure shift from the grade)', () => {
    const before = solid(1, 1, 128, 128, 128);
    const beforeLuma = lumaByte(before, 0);
    const d = run(Uint8ClampedArray.from(before), 1, 1, {
      shadowHue: 30,
      shadowSat: 90,
      highlightHue: 210,
      highlightSat: 90,
      balance: 10,
    });
    expect(Math.abs(lumaByte(d, 0) - beforeLuma)).toBeLessThanOrEqual(2);
  });

  it('keeps the whole ramp close to its original luma', () => {
    const before = ramp(64, 1);
    const after = Uint8ClampedArray.from(before);
    applySplitTone(after, 64, 1, {
      shadowHue: 220,
      shadowSat: 70,
      highlightHue: 45,
      highlightSat: 70,
      balance: 0,
    });
    // Restrict to the in-gamut midtone band: adding strong chroma to a
    // near-black/near-white pixel must clip a channel, which is the only place
    // luma can drift. In-gamut, the equal-offset restore is exact (±dither).
    for (let x = 20; x < 44; x++) {
      const i = x * 4;
      expect(Math.abs(lumaByte(after, i) - lumaByte(before, i))).toBeLessThanOrEqual(3);
    }
  });

  // ---- determinism (positional dither, no RNG) ----
  it('is deterministic across runs (preview == export)', () => {
    const params = {
      shadowHue: 265,
      shadowSat: 65,
      highlightHue: 50,
      highlightSat: 55,
      balance: -20,
    };
    const a = ramp(40, 5);
    const b = ramp(40, 5);
    applySplitTone(a, 40, 5, params);
    applySplitTone(b, 40, 5, params);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  // ---- edge safety ----
  it('handles a 1×1 image and produces no NaN / out-of-range bytes', () => {
    const d = run(solid(1, 1, 0, 0, 0), 1, 1, {
      shadowHue: 180,
      shadowSat: 100,
      highlightHue: 0,
      highlightSat: 100,
      balance: 100,
    });
    for (let k = 0; k < 4; k++) {
      expect(Number.isFinite(d[k])).toBe(true);
      expect(d[k]).toBeGreaterThanOrEqual(0);
      expect(d[k]).toBeLessThanOrEqual(255);
    }
  });

  it('preserves the alpha channel', () => {
    const d = new Uint8ClampedArray([10, 20, 30, 123, 200, 210, 220, 77]);
    applySplitTone(d, 2, 1, { shadowSat: 80, highlightSat: 80 });
    expect(d[3]).toBe(123);
    expect(d[7]).toBe(77);
  });

  it('stays in gamut across many random colours and extreme params', () => {
    const w = 50;
    const h = 50;
    const d = new Uint8ClampedArray(w * h * 4);
    let s = 12345;
    const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.floor(rand() * 256);
      d[i + 1] = Math.floor(rand() * 256);
      d[i + 2] = Math.floor(rand() * 256);
      d[i + 3] = 255;
    }
    applySplitTone(d, w, h, {
      shadowHue: 300,
      shadowSat: 100,
      highlightHue: 60,
      highlightSat: 100,
      balance: -100,
    });
    for (let k = 0; k < d.length; k++) {
      expect(Number.isFinite(d[k])).toBe(true);
      expect(d[k]).toBeGreaterThanOrEqual(0);
      expect(d[k]).toBeLessThanOrEqual(255);
    }
  });

  // ---- descriptor contract ----
  it('descriptor settings match the Params fields and defaults', () => {
    expect(SPLITTONE_EFFECT.id).toBe('splitTone');
    expect(SPLITTONE_EFFECT.category).toBe('Color');
    const ids = SPLITTONE_EFFECT.settings.map(s => s.id).sort();
    expect(ids).toEqual(Object.keys(SPLITTONE_DEFAULTS).sort());
    for (const s of SPLITTONE_EFFECT.settings) {
      expect(s.default).toBe(SPLITTONE_DEFAULTS[s.id as keyof SplitToneParams]);
      expect(s.min).toBeLessThanOrEqual(s.default);
      expect(s.max).toBeGreaterThanOrEqual(s.default);
    }
  });
});
