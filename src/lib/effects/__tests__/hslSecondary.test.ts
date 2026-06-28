import {
  applyHslSecondary,
  HSLSECONDARY_DEFAULTS,
  HSLSECONDARY_EFFECT,
  HslSecondaryParams,
} from '../pro/hslSecondary';

// --- independent HSL helpers (do NOT reuse the module's private converters) ---

/** Synthesize one RGBA pixel at a known hue(deg)/sat/lum. Returns a 1x1 buffer. */
function hslPixel(h: number, s: number, l: number): Uint8ClampedArray {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1: number, g1: number, b1: number;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return new Uint8ClampedArray([
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
    255,
  ]);
}

/** Measure HSL (h deg, s, l) of the first pixel of an RGBA buffer. */
function measureHsl(d: Uint8ClampedArray): { h: number; s: number; l: number } {
  const r = d[0] / 255;
  const g = d[1] / 255;
  const b = d[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const dd = max - min;
  const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
  let h: number;
  if (max === r) h = (g - b) / dd + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / dd + 2;
  else h = (r - g) / dd + 4;
  return { h: h * 60, s, l };
}

/** Run the effect on a single synthesized pixel and return the measured HSL out. */
function run(
  inHsl: [number, number, number],
  params: Partial<HslSecondaryParams>
): { h: number; s: number; l: number; raw: Uint8ClampedArray } {
  const d = hslPixel(inHsl[0], inHsl[1], inHsl[2]);
  applyHslSecondary(d, 1, 1, params);
  return { ...measureHsl(d), raw: d };
}

describe('HSL Secondary qualifier', () => {
  it('descriptor is internally consistent (ids ↔ Params, defaults match)', () => {
    expect(HSLSECONDARY_EFFECT.id).toBe('hslSecondary');
    expect(HSLSECONDARY_EFFECT.category).toBe('Color');
    const ids = HSLSECONDARY_EFFECT.settings.map(s => s.id).sort();
    expect(ids).toEqual(Object.keys(HSLSECONDARY_DEFAULTS).sort());
    for (const s of HSLSECONDARY_EFFECT.settings) {
      expect(s.default).toBe((HSLSECONDARY_DEFAULTS as Record<string, number>)[s.id]);
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
    }
  });

  it('neutral params (all shifts 0) are an exact no-op', () => {
    const d = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = (i * 7) & 255;
      d[i + 1] = (i * 13) & 255;
      d[i + 2] = (i * 29) & 255;
      d[i + 3] = 255;
    }
    const before = Array.from(d);
    applyHslSecondary(d, 8, 8, { ...HSLSECONDARY_DEFAULTS });
    expect(Array.from(d)).toEqual(before);
  });

  it('selects the target hue and leaves far hues byte-identical', () => {
    // Two pixels: one at the target (210), one far away (30).
    const d = new Uint8ClampedArray(2 * 4);
    d.set(hslPixel(210, 0.8, 0.5), 0);
    d.set(hslPixel(30, 0.8, 0.5), 4);
    const farBefore = [d[4], d[5], d[6], d[7]];

    applyHslSecondary(d, 2, 1, { targetHue: 210, range: 40, hueShift: 40 });

    // far pixel untouched (weight 0 -> skipped)
    expect([d[4], d[5], d[6], d[7]]).toEqual(farBefore);
    // target pixel rotated ~+40 deg
    const m = measureHsl(d.subarray(0, 4));
    expect(Math.abs(m.h - 250)).toBeLessThan(4);
  });

  it('hue response is monotonic in hueShift for a selected pixel', () => {
    const base = 210;
    const h10 = run([base, 0.8, 0.5], { targetHue: base, hueShift: 10 }).h;
    const h20 = run([base, 0.8, 0.5], { targetHue: base, hueShift: 20 }).h;
    const h40 = run([base, 0.8, 0.5], { targetHue: base, hueShift: 40 }).h;
    expect(h10).toBeGreaterThan(base - 1);
    expect(h20).toBeGreaterThan(h10 + 5);
    expect(h40).toBeGreaterThan(h20 + 5);
    // full selection (w=1) => shift lands ~exactly
    expect(Math.abs(h40 - 250)).toBeLessThan(4);
  });

  it('widening range pulls an off-target pixel into the selection (monotonic weight)', () => {
    // pixel 30deg off target; fixed hueShift; larger range => larger applied shift.
    const off: [number, number, number] = [240, 0.8, 0.5];
    const params = (range: number) => ({ targetHue: 210, range, softness: 40, hueShift: 20 });
    const d40 = run(off, params(40)).h; // outside band -> ~unchanged (240)
    const d60 = run(off, params(60)).h; // partially feathered in
    const d80 = run(off, params(80)).h; // fully selected -> 240+20
    expect(Math.abs(d40 - 240)).toBeLessThan(2);
    expect(d60).toBeGreaterThan(d40 + 3);
    expect(d80).toBeGreaterThan(d60 + 3);
    expect(Math.abs(d80 - 260)).toBeLessThan(4);
  });

  it('softness feathers the selection edge (more softness => more edge weight)', () => {
    // pixel just outside the hard half-range (half=20, d=22).
    const edge: [number, number, number] = [232, 0.8, 0.5];
    const params = (softness: number) => ({
      targetHue: 210,
      range: 40,
      softness,
      hueShift: 30,
    });
    const s0 = run(edge, params(0)).h; // hard edge -> unchanged (232)
    const s50 = run(edge, params(50)).h;
    const s100 = run(edge, params(100)).h;
    expect(Math.abs(s0 - 232)).toBeLessThan(2);
    expect(s50).toBeGreaterThan(s0 + 2);
    expect(s100).toBeGreaterThan(s50 + 2);
  });

  it('satShift and lumShift push in the correct direction within the selection', () => {
    const px: [number, number, number] = [210, 0.5, 0.5];
    const satUp = run(px, { targetHue: 210, satShift: 30 });
    const satDn = run(px, { targetHue: 210, satShift: -30 });
    expect(satUp.s).toBeGreaterThan(0.7);
    expect(satDn.s).toBeLessThan(0.3);

    const lumUp = run(px, { targetHue: 210, lumShift: 30 });
    const lumDn = run(px, { targetHue: 210, lumShift: -30 });
    expect(lumUp.l).toBeGreaterThan(0.65);
    expect(lumDn.l).toBeLessThan(0.35);
  });

  it('hue wraps around 360 (does not clamp)', () => {
    // hue 5, shift -20 => -15 -> 345
    const out = run([5, 0.8, 0.5], { targetHue: 5, range: 40, hueShift: -20 });
    expect(out.h).toBeGreaterThan(330);
    expect(out.h).toBeLessThan(360);
    expect(Math.abs(out.h - 345)).toBeLessThan(4);
  });

  it('excludes near-gray pixels (meaningless hue) from the recolor', () => {
    const d = hslPixel(0, 0, 0.5); // pure gray, S=0
    const before = Array.from(d);
    // even with target=0 (gray maps to hue 0) and big shifts, gray is gated out
    applyHslSecondary(d, 1, 1, { targetHue: 0, range: 180, hueShift: 120, satShift: 80 });
    expect(Array.from(d)).toEqual(before);
  });

  it('is deterministic across runs (preview == export)', () => {
    const make = () => {
      const d = new Uint8ClampedArray(16 * 4);
      for (let i = 0; i < 16; i++) d.set(hslPixel(i * 22, 0.7, 0.5), i * 4);
      return d;
    };
    const a = make();
    const b = make();
    const params = {
      targetHue: 120,
      range: 90,
      softness: 60,
      hueShift: 35,
      satShift: 20,
      lumShift: 10,
    };
    applyHslSecondary(a, 16, 1, params);
    applyHslSecondary(b, 16, 1, params);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('edge-safe: 1x1, black, white, and extreme params stay valid and preserve alpha', () => {
    const extreme = {
      targetHue: 360,
      range: 180,
      softness: 100,
      hueShift: 180,
      satShift: 100,
      lumShift: 100,
    };
    for (const px of [
      hslPixel(210, 0.9, 0.5),
      new Uint8ClampedArray([0, 0, 0, 255]),
      new Uint8ClampedArray([255, 255, 255, 200]),
    ]) {
      const alpha = px[3];
      expect(() => applyHslSecondary(px, 1, 1, extreme)).not.toThrow();
      for (let c = 0; c < 3; c++) {
        expect(Number.isFinite(px[c])).toBe(true);
        expect(px[c]).toBeGreaterThanOrEqual(0);
        expect(px[c]).toBeLessThanOrEqual(255);
      }
      expect(px[3]).toBe(alpha); // alpha preserved
    }
  });
});
