import {
  applyColorBalance,
  COLORBALANCE_DEFAULTS,
  COLORBALANCE_EFFECT,
  type ColorBalanceParams,
} from '../pro/colorBalance';

/** Flat W×H image of one RGBA color. */
function flat(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = a;
  }
  return d;
}

/** Horizontal black→white gray gradient (varied luma across the row). */
function gradient(w: number, h: number): Uint8ClampedArray {
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

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('colorBalance', () => {
  it('is a no-op at neutral params (all zero shifts)', () => {
    const d = gradient(16, 4);
    const before = Uint8Array.from(d);
    applyColorBalance(d, 16, 4, {}); // defaults: all shifts 0, preserve on
    expect(Array.from(d)).toEqual(Array.from(before));

    // Explicit full defaults: still a no-op.
    const d2 = gradient(16, 4);
    const before2 = Uint8Array.from(d2);
    applyColorBalance(d2, 16, 4, { ...COLORBALANCE_DEFAULTS });
    expect(Array.from(d2)).toEqual(Array.from(before2));
  });

  it('preserveLuminosity alone (no shifts) changes nothing', () => {
    const d = gradient(16, 4);
    const before = Uint8Array.from(d);
    applyColorBalance(d, 16, 4, { preserveLuminosity: 1 });
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it('maps cr→+R, mg→+G, yb→+B independently at midtones', () => {
    // CR pushes only red; G and B stay put (their sliders are 0).
    const cr = flat(4, 4, 128, 128, 128);
    applyColorBalance(cr, 4, 4, { midCR: 100, preserveLuminosity: 0 });
    expect(cr[0]).toBeGreaterThan(128);
    expect(cr[1]).toBe(128);
    expect(cr[2]).toBe(128);

    // MG pushes only green.
    const mg = flat(4, 4, 128, 128, 128);
    applyColorBalance(mg, 4, 4, { midMG: 100, preserveLuminosity: 0 });
    expect(mg[1]).toBeGreaterThan(128);
    expect(mg[0]).toBe(128);
    expect(mg[2]).toBe(128);

    // YB pushes only blue.
    const yb = flat(4, 4, 128, 128, 128);
    applyColorBalance(yb, 4, 4, { midYB: 100, preserveLuminosity: 0 });
    expect(yb[2]).toBeGreaterThan(128);
    expect(yb[0]).toBe(128);
    expect(yb[1]).toBe(128);
  });

  it('responds monotonically to the slider magnitude', () => {
    let prev = -1;
    for (const v of [0, 25, 50, 75, 100]) {
      const d = flat(2, 2, 128, 128, 128);
      applyColorBalance(d, 2, 2, { midCR: v, preserveLuminosity: 0 });
      expect(d[0]).toBeGreaterThanOrEqual(prev);
      prev = d[0];
    }
    expect(prev).toBeGreaterThan(128); // and ends meaningfully above neutral
  });

  it('a negative shift moves the channel the other way', () => {
    const d = flat(4, 4, 128, 128, 128);
    applyColorBalance(d, 4, 4, { midCR: -100, preserveLuminosity: 0 });
    expect(d[0]).toBeLessThan(128);
  });

  it('targets its tonal range: shadow push affects darks more than brights', () => {
    const dark = flat(4, 4, 30, 30, 30);
    const bright = flat(4, 4, 225, 225, 225);
    applyColorBalance(dark, 4, 4, { shadowCR: 100, preserveLuminosity: 0 });
    applyColorBalance(bright, 4, 4, { shadowCR: 100, preserveLuminosity: 0 });
    const deltaDark = dark[0] - 30;
    const deltaBright = bright[0] - 225;
    expect(deltaDark).toBeGreaterThan(deltaBright);
    expect(deltaDark).toBeGreaterThan(5); // shadows actually moved
    expect(deltaBright).toBeLessThanOrEqual(1); // highlights ~untouched by a shadow push
  });

  it('highlight push affects brights more than darks (symmetry of the masks)', () => {
    const dark = flat(4, 4, 30, 30, 30);
    const bright = flat(4, 4, 225, 225, 225);
    applyColorBalance(dark, 4, 4, { highYB: 100, preserveLuminosity: 0 });
    applyColorBalance(bright, 4, 4, { highYB: 100, preserveLuminosity: 0 });
    expect(bright[2] - 225).toBeGreaterThan(dark[2] - 30);
  });

  it('preserveLuminosity restores luma while keeping the chroma push', () => {
    const orig = luma(128, 128, 128);

    const on = flat(4, 4, 128, 128, 128);
    applyColorBalance(on, 4, 4, { midCR: 100, preserveLuminosity: 1 });
    const lOn = luma(on[0], on[1], on[2]);

    const off = flat(4, 4, 128, 128, 128);
    applyColorBalance(off, 4, 4, { midCR: 100, preserveLuminosity: 0 });
    const lOff = luma(off[0], off[1], off[2]);

    // With preserve on, luma is held essentially constant…
    expect(Math.abs(lOn - orig)).toBeLessThan(1.5);
    // …and much closer to the original than with preserve off.
    expect(Math.abs(lOn - orig)).toBeLessThan(Math.abs(lOff - orig));
    // …yet the red push survives (it's a colour shift, not a brightness change).
    expect(on[0]).toBeGreaterThan(128);
  });

  it('leaves the alpha channel untouched', () => {
    const d = flat(4, 4, 100, 100, 100, 173);
    applyColorBalance(d, 4, 4, { shadowCR: 80, midMG: -40, highYB: 60 });
    for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(173);
  });

  it('is deterministic (preview === export): identical runs match byte-for-byte', () => {
    const params: Partial<ColorBalanceParams> = {
      shadowCR: -40,
      shadowYB: 60,
      midMG: 20,
      highCR: 70,
      highYB: -50,
      preserveLuminosity: 1,
    };
    const a = gradient(20, 6);
    const b = gradient(20, 6);
    applyColorBalance(a, 20, 6, params);
    applyColorBalance(b, 20, 6, params);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is edge-safe: extreme params produce finite, in-range bytes (incl. 1×1 and pure black/white)', () => {
    const extreme: Partial<ColorBalanceParams> = {
      shadowCR: 100,
      shadowMG: -100,
      shadowYB: 100,
      midCR: -100,
      midMG: 100,
      midYB: -100,
      highCR: 100,
      highMG: -100,
      highYB: 100,
      preserveLuminosity: 1,
    };

    // A gradient (every tone), pure black, pure white, and a 1×1 image.
    const cases: Array<[Uint8ClampedArray, number, number]> = [
      [gradient(32, 8), 32, 8],
      [flat(8, 8, 0, 0, 0), 8, 8],
      [flat(8, 8, 255, 255, 255), 8, 8],
      [flat(1, 1, 137, 64, 200), 1, 1],
    ];
    for (const [d, w, h] of cases) {
      applyColorBalance(d, w, h, extreme);
      for (let i = 0; i < d.length; i++) {
        expect(Number.isFinite(d[i])).toBe(true);
        expect(d[i]).toBeGreaterThanOrEqual(0);
        expect(d[i]).toBeLessThanOrEqual(255);
      }
    }
  });

  describe('COLORBALANCE_EFFECT descriptor', () => {
    it('declares the expected identity and category', () => {
      expect(COLORBALANCE_EFFECT.id).toBe('colorBalance');
      expect(COLORBALANCE_EFFECT.label).toBe('Color Balance');
      expect(COLORBALANCE_EFFECT.category).toBe('Color');
    });

    it('has one setting per Params field, with ids and defaults matching DEFAULTS', () => {
      const keys = Object.keys(COLORBALANCE_DEFAULTS).sort();
      const ids = COLORBALANCE_EFFECT.settings.map(s => s.id).sort();
      expect(ids).toEqual(keys);

      for (const s of COLORBALANCE_EFFECT.settings) {
        const key = s.id as keyof ColorBalanceParams;
        expect(COLORBALANCE_DEFAULTS[key]).toBe(s.default);
        // default must sit within the declared range.
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
      }
    });

    it('uses the spec ranges (±100/step 1 for shifts; 0..1/step 1 for preserve)', () => {
      for (const s of COLORBALANCE_EFFECT.settings) {
        if (s.id === 'preserveLuminosity') {
          expect([s.min, s.max, s.default, s.step]).toEqual([0, 1, 1, 1]);
        } else {
          expect([s.min, s.max, s.default, s.step]).toEqual([-100, 100, 0, 1]);
        }
      }
    });
  });
});
