import { applyProMist, PROMIST_DEFAULTS, PROMIST_EFFECT, type ProMistParams } from '../pro/proMist';

/** Opaque black canvas with a bright white square in the centre. */
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

/** Opaque horizontal grey ramp 0..255. */
function ramp(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255);
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

const W = 96;
const H = 96;
// White block spans [40,56); sample a black pixel 4px right of its edge.
const SHADOW_I = (48 * W + 60) * 4;

describe('proMist diffusion', () => {
  it('strength = 0 is an exact no-op (even on a non-trivial image)', () => {
    const a = ramp(W, H);
    const b = Uint8Array.from(a);
    applyProMist(a, W, H, { strength: 0 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('leaves a highlight-free (all black) image unchanged', () => {
    const d = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
    const before = Uint8Array.from(d);
    applyProMist(d, 32, 32, { strength: 80, threshold: 55 });
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it('never darkens any pixel (diffusion is additive light)', () => {
    const before = ramp(W, H);
    const after = Uint8Array.from(before);
    applyProMist(after, W, H, {}); // defaults
    for (let i = 0; i < before.length; i += 4) {
      expect(after[i]).toBeGreaterThanOrEqual(before[i]);
      expect(after[i + 1]).toBeGreaterThanOrEqual(before[i + 1]);
      expect(after[i + 2]).toBeGreaterThanOrEqual(before[i + 2]);
    }
  });

  it('blooms a glow into the dark area around a highlight', () => {
    const d = spot(W, H, 16);
    applyProMist(d, W, H, {}); // defaults
    expect(d[SHADOW_I]).toBeGreaterThan(0);
  });

  it('responds monotonically to strength', () => {
    const lo = spot(W, H, 16);
    const hi = spot(W, H, 16);
    applyProMist(lo, W, H, { strength: 10 });
    applyProMist(hi, W, H, { strength: 90 });
    expect(hi[SHADOW_I]).toBeGreaterThan(lo[SHADOW_I]);
  });

  it('responds monotonically (wider) to size', () => {
    // Farther from the highlight, a wider spread reaches more glow.
    const far = (48 * W + 70) * 4; // ~14px from the block edge
    const small = spot(W, H, 16);
    const big = spot(W, H, 16);
    applyProMist(small, W, H, { size: 15, blackRetention: 0 });
    applyProMist(big, W, H, { size: 90, blackRetention: 0 });
    expect(big[far]).toBeGreaterThan(small[far]);
  });

  it('black retention holds the blacks: higher retention => crisper (darker) shadow', () => {
    const proMist = spot(W, H, 16); // low retention = veiled, lifted blacks
    const blackMist = spot(W, H, 16); // high retention = crisp blacks
    applyProMist(proMist, W, H, { strength: 100, size: 80, blackRetention: 0 });
    applyProMist(blackMist, W, H, { strength: 100, size: 80, blackRetention: 100 });
    // Both still get the tight highlight bloom; the WIDE veil is what retention cuts.
    expect(proMist[SHADOW_I]).toBeGreaterThan(blackMist[SHADOW_I]);
  });

  it('threshold gates the glow: a higher threshold lets less bloom through', () => {
    // A mid-bright field: more of it qualifies as "highlight" at a low threshold.
    const w = 64;
    const h = 64;
    const mid = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < mid.length; i += 4) {
      mid[i] = mid[i + 1] = mid[i + 2] = 210;
      mid[i + 3] = 255;
    }
    const low = new Uint8ClampedArray(mid);
    const high = new Uint8ClampedArray(mid);
    applyProMist(low, w, h, { threshold: 20, blackRetention: 0 });
    applyProMist(high, w, h, { threshold: 95, blackRetention: 0 });
    // Sum the lift over the whole field; lower threshold => more total bloom.
    let sumLow = 0;
    let sumHigh = 0;
    for (let i = 0; i < mid.length; i += 4) {
      sumLow += low[i];
      sumHigh += high[i];
    }
    expect(sumLow).toBeGreaterThan(sumHigh);
  });

  it('is deterministic (preview == export): two runs are byte-identical', () => {
    const a = spot(W, H, 16);
    const b = spot(W, H, 16);
    const params: Partial<ProMistParams> = {
      strength: 73,
      size: 51,
      blackRetention: 37,
      threshold: 44,
    };
    applyProMist(a, W, H, params);
    applyProMist(b, W, H, params);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is edge-safe on tiny images and extreme params (no NaN, valid bytes)', () => {
    const sizes: Array<[number, number]> = [
      [1, 1],
      [2, 2],
      [1, 5],
      [5, 1],
    ];
    const extremes: Array<Partial<ProMistParams>> = [
      { strength: 100, size: 100, blackRetention: 0, threshold: 0 },
      { strength: 100, size: 100, blackRetention: 100, threshold: 100 },
      { strength: 50, size: 0, blackRetention: 50, threshold: 50 },
    ];
    for (const [w, h] of sizes) {
      for (const params of extremes) {
        const d = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < d.length; i++) d[i] = (i * 37) % 256; // arbitrary content + alpha
        expect(() => applyProMist(d, w, h, params)).not.toThrow();
        for (let i = 0; i < d.length; i++) {
          expect(Number.isFinite(d[i])).toBe(true);
          expect(d[i]).toBeGreaterThanOrEqual(0);
          expect(d[i]).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('leaves the alpha channel untouched', () => {
    const d = spot(W, H, 16);
    // Make alpha a varying pattern.
    for (let i = 3; i < d.length; i += 4) d[i] = (i * 13) % 256;
    const alphaBefore = [];
    for (let i = 3; i < d.length; i += 4) alphaBefore.push(d[i]);
    applyProMist(d, W, H, { strength: 100 });
    let k = 0;
    for (let i = 3; i < d.length; i += 4) {
      expect(d[i]).toBe(alphaBefore[k++]);
    }
  });

  describe('PROMIST_EFFECT descriptor integrity', () => {
    it('has the right identity and category', () => {
      expect(PROMIST_EFFECT.id).toBe('proMist');
      expect(PROMIST_EFFECT.category).toBe('Effects');
      expect(typeof PROMIST_EFFECT.label).toBe('string');
    });

    it('has one setting per Params field, ids and defaults matching', () => {
      const paramKeys = Object.keys(PROMIST_DEFAULTS).sort();
      const settingIds = PROMIST_EFFECT.settings.map(s => s.id).sort();
      expect(settingIds).toEqual(paramKeys);

      for (const s of PROMIST_EFFECT.settings) {
        const key = s.id as keyof ProMistParams;
        expect(s.default).toBe(PROMIST_DEFAULTS[key]);
        expect(s.min).toBeLessThan(s.max);
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
        expect(s.step).toBeGreaterThan(0);
      }
    });
  });
});
