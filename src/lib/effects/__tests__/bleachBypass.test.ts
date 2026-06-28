import { applyBleachBypass, BLEACHBYPASS_DEFAULTS, BLEACHBYPASS_EFFECT } from '../pro/bleachBypass';

/** Flat RGBA image of one colour, opaque. */
function flat(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  return d;
}

/** A varied image so determinism/edge tests exercise many input values. */
function varied(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    d[i] = (p * 37) & 255;
    d[i + 1] = (p * 91 + 11) & 255;
    d[i + 2] = (p * 53 + 200) & 255;
    d[i + 3] = 255;
  }
  return d;
}

const NEUTRAL = { strength: 0, contrast: 50, saturation: 100 };

/** Sum of absolute RGB deltas between two arrays at pixel index `p`. */
function dist(a: Uint8ClampedArray, b: Uint8ClampedArray, p = 0): number {
  const i = p * 4;
  return Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
}

describe('bleach bypass — descriptor contract', () => {
  it('exposes one setting per Params field, ids and defaults aligned', () => {
    const keys = Object.keys(BLEACHBYPASS_DEFAULTS).sort();
    const ids = BLEACHBYPASS_EFFECT.settings.map(s => s.id).sort();
    expect(ids).toEqual(keys);
    for (const s of BLEACHBYPASS_EFFECT.settings) {
      expect(s.default).toBe(BLEACHBYPASS_DEFAULTS[s.id as keyof typeof BLEACHBYPASS_DEFAULTS]);
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
    }
    expect(BLEACHBYPASS_EFFECT.category).toBe('Effects');
    expect(BLEACHBYPASS_EFFECT.id).toBe('bleachBypass');
  });
});

describe('bleach bypass — algorithm properties', () => {
  it('is an exact identity at neutral params (strength 0, contrast 50, saturation 100)', () => {
    const d = varied(16, 16);
    const before = Uint8Array.from(d);
    applyBleachBypass(d, 16, 16, NEUTRAL);
    expect(Array.from(d)).toEqual(Array.from(before));
  });

  it('is deterministic — preview equals export (no RNG)', () => {
    const a = varied(20, 12);
    const b = Uint8ClampedArray.from(a);
    applyBleachBypass(a, 20, 12, BLEACHBYPASS_DEFAULTS);
    applyBleachBypass(b, 20, 12, BLEACHBYPASS_DEFAULTS);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('strength is monotonic — more strength moves further from the original', () => {
    const W = 8;
    const H = 8;
    const orig = flat(W, H, 240, 240, 20); // bright yellow → strong overlay swing
    const at = (s: number) => {
      const d = Uint8ClampedArray.from(orig);
      applyBleachBypass(d, W, H, { strength: s, contrast: 50, saturation: 100 });
      return dist(d, orig);
    };
    const d0 = at(0);
    const d30 = at(30);
    const d80 = at(80);
    expect(d0).toBe(0); // strength 0 with neutral contrast/sat = identity
    expect(d30).toBeGreaterThan(d0);
    expect(d80).toBeGreaterThan(d30);
  });

  it('default look is desaturated — channel spread shrinks (the metallic/bleached property)', () => {
    const W = 4;
    const H = 4;
    const orig = flat(W, H, 220, 120, 40);
    const spreadOrig = 220 - 40;
    const d = Uint8ClampedArray.from(orig);
    applyBleachBypass(d, W, H, BLEACHBYPASS_DEFAULTS);
    const spreadOut = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
    expect(spreadOut).toBeLessThan(spreadOrig);
  });

  it('the overlay-of-luminance step boosts contrast (the silver-retention defining property)', () => {
    // Isolate the bleach overlay: full strength, neutral contrast, full colour.
    // Overlaying a pixel with its own luminance must darken the darks and
    // brighten the lights even with the contrast/saturation sliders neutral —
    // that is the bleach-bypass look, not the sat slider doing the work.
    const W = 4;
    const H = 4;
    const overlayOnly = (v: number) => {
      const d = flat(W, H, v, v, v);
      applyBleachBypass(d, W, H, { strength: 100, contrast: 50, saturation: 100 });
      return d[0];
    };
    expect(overlayOnly(60)).toBeLessThan(60); // dark gets darker
    expect(overlayOnly(200)).toBeGreaterThan(200); // bright gets brighter
  });

  it('contrast slider is monotonic about mid-grey (brights brighten, darks darken)', () => {
    const W = 4;
    const H = 4;
    const bright = flat(W, H, 180, 180, 180);
    const dark = flat(W, H, 60, 60, 60);
    const contrastTo = (img: Uint8ClampedArray, c: number) => {
      const d = Uint8ClampedArray.from(img);
      applyBleachBypass(d, W, H, { strength: 0, contrast: c, saturation: 100 });
      return d[0];
    };
    // Bright pixel: higher contrast pushes it brighter.
    expect(contrastTo(bright, 80)).toBeGreaterThan(contrastTo(bright, 20));
    // Dark pixel: higher contrast pushes it darker.
    expect(contrastTo(dark, 80)).toBeLessThan(contrastTo(dark, 20));
  });

  it('saturation slider is monotonic — more saturation, more colour spread', () => {
    const W = 4;
    const H = 4;
    const orig = flat(W, H, 200, 100, 40);
    const spreadAt = (sat: number) => {
      const d = Uint8ClampedArray.from(orig);
      applyBleachBypass(d, W, H, { strength: 0, contrast: 50, saturation: sat });
      return Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
    };
    expect(spreadAt(20)).toBeLessThan(spreadAt(90));
    // saturation 0 → fully greyscale: all channels equal.
    const grey = Uint8ClampedArray.from(orig);
    applyBleachBypass(grey, W, H, { strength: 0, contrast: 50, saturation: 0 });
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
  });

  it('preserves alpha', () => {
    const d = new Uint8ClampedArray([10, 20, 30, 7, 200, 150, 100, 222]);
    applyBleachBypass(d, 2, 1, BLEACHBYPASS_DEFAULTS);
    expect(d[3]).toBe(7);
    expect(d[7]).toBe(222);
  });

  it('is edge-safe — 1x1 image and extreme params produce valid bytes, no throw', () => {
    const one = flat(1, 1, 130, 70, 200);
    expect(() => applyBleachBypass(one, 1, 1, BLEACHBYPASS_DEFAULTS)).not.toThrow();
    expect(one[3]).toBe(255);

    const extremes = [
      { strength: 100, contrast: 100, saturation: 0 },
      { strength: 100, contrast: 0, saturation: 100 },
      { strength: 50, contrast: 100, saturation: 100 },
    ];
    for (const params of extremes) {
      const d = varied(6, 5);
      applyBleachBypass(d, 6, 5, params);
      for (let k = 0; k < d.length; k++) {
        expect(Number.isInteger(d[k])).toBe(true);
        expect(d[k]).toBeGreaterThanOrEqual(0);
        expect(d[k]).toBeLessThanOrEqual(255);
      }
    }
  });
});
