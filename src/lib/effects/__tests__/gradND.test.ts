import { applyGradND, GRADND_DEFAULTS, GRADND_EFFECT, type GradNDParams } from '../pro/gradND';

/** Flat, fully-opaque image of a single gray value. */
function flat(w: number, h: number, gray = 128): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = gray;
    d[i + 3] = 255;
  }
  return d;
}

/** Average of one channel across a horizontal row band [y0,y1). angle=0 ⇒ rows = gradient. */
function rowAvg(d: Uint8ClampedArray, w: number, y0: number, y1: number, ch = 0): number {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      sum += d[(y * w + x) * 4 + ch];
      n++;
    }
  }
  return sum / n;
}

const W = 64;
const H = 64;

describe('Graduated ND / Sky filter', () => {
  it('is an exact no-op at neutral params (exposure 0, no tint)', () => {
    const a = flat(W, H);
    const b = Uint8ClampedArray.from(a);
    // Other geometry settings must not matter when there is no exposure/tint change.
    applyGradND(a, W, H, { exposure: 0, tintStrength: 0, position: 30, softness: 80, angle: 137 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('darkens the top (sky) and leaves the bottom an exact identity at defaults', () => {
    const d = flat(W, H);
    const orig = Uint8ClampedArray.from(d);
    applyGradND(d, W, H); // defaults: exposure -40, angle 0, position 50, softness 50

    // Top band is fully inside the effect (t < edge0) → darkened below the mid-gray.
    expect(rowAvg(d, W, 0, 4)).toBeLessThan(128);

    // Bottom band is past the band (weight == 0) → byte-for-byte unchanged.
    for (let y = H - 4; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4;
        expect(d[j]).toBe(orig[j]);
        expect(d[j + 1]).toBe(orig[j + 1]);
        expect(d[j + 2]).toBe(orig[j + 2]);
      }
    }
  });

  it('responds monotonically to the exposure slider (more negative → darker)', () => {
    const mk = (exposure: number) => {
      const d = flat(W, H);
      applyGradND(d, W, H, { exposure });
      return rowAvg(d, W, 0, 4); // fully-affected top band
    };
    const e20 = mk(-20);
    const e40 = mk(-40);
    const e80 = mk(-80);
    expect(e40).toBeLessThan(e20);
    expect(e80).toBeLessThan(e40);
    expect(e80).toBeGreaterThanOrEqual(0);
  });

  it('applies exposure in LINEAR light, not on the gamma-encoded bytes', () => {
    // exposure -50 → exactly -1 stop → linear transmission factor 0.5 at full weight.
    const d = flat(W, H, 128);
    applyGradND(d, W, H, { exposure: -50, softness: 50, position: 50, tintStrength: 0 });
    const top = rowAvg(d, W, 0, 4); // top band: t < edge0 ⇒ weight == 1 (full effect)

    // Correct physics: decode the byte to linear radiance, halve it, re-encode.
    const lin = ((128 / 255 + 0.055) / 1.055) ** 2.4;
    const expected = (1.055 * (lin * 0.5) ** (1 / 2.4) - 0.055) * 255; // ≈ 92.4

    // The defining property: the result must match the LINEAR-light answer (~92),
    // NOT a naive gamma-space multiply 128 * 0.5 = 64. The two are ~28 LSB apart,
    // so this assertion fails loudly if the multiply ever moves out of linear light.
    expect(top).toBeCloseTo(expected, 0); // within ~0.5 LSB of the physical answer
    expect(top - 128 * 0.5).toBeGreaterThan(20); // unmistakably not gamma-space
  });

  it('brightens the filtered region for positive exposure', () => {
    const d = flat(W, H);
    applyGradND(d, W, H, { exposure: 60 });
    expect(rowAvg(d, W, 0, 4)).toBeGreaterThan(128);
  });

  it('ramps monotonically through the soft band (top darker than middle darker than bottom)', () => {
    const d = flat(W, H);
    applyGradND(d, W, H); // position 50, softness 50 ⇒ band over t∈[0.25,0.75]
    const top = rowAvg(d, W, 0, 4);
    const mid = rowAvg(d, W, 30, 34);
    const bottom = rowAvg(d, W, H - 4, H);
    expect(top).toBeLessThan(mid);
    expect(mid).toBeLessThan(bottom);
    expect(bottom).toBeCloseTo(128, 0); // identity at the clear edge
  });

  it('angle rotates the gradient axis (90° darkens the left, not the top)', () => {
    const d = flat(W, H);
    applyGradND(d, W, H, { angle: 90 });
    // Column averages: left column band vs right column band.
    const colAvg = (x0: number, x1: number) => {
      let s = 0;
      let n = 0;
      for (let y = 0; y < H; y++)
        for (let x = x0; x < x1; x++) {
          s += d[(y * W + x) * 4];
          n++;
        }
      return s / n;
    };
    expect(colAvg(0, 4)).toBeLessThan(128); // left darkened
    expect(colAvg(W - 4, W)).toBeCloseTo(128, 0); // right ≈ identity
  });

  it('applies a colour tint toward the hue in the filtered region', () => {
    const d = flat(W, H);
    // hue 210 ≈ sky blue; with tint the blue channel should survive over red.
    applyGradND(d, W, H, { exposure: 0, tintHue: 210, tintStrength: 80 });
    const rTop = rowAvg(d, W, 0, 4, 0);
    const bTop = rowAvg(d, W, 0, 4, 2);
    expect(bTop).toBeGreaterThan(rTop); // blue-dominant under a blue grad
  });

  it('is deterministic: identical params produce identical output (preview == export)', () => {
    const a = flat(W, H);
    const b = flat(W, H);
    const params: Partial<GradNDParams> = {
      exposure: -55,
      tintHue: 30,
      tintStrength: 40,
      angle: 45,
    };
    applyGradND(a, W, H, params);
    applyGradND(b, W, H, params);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is edge-safe: tiny / non-square images and extreme params produce finite, in-range bytes', () => {
    const cases: Array<[number, number]> = [
      [1, 1],
      [2, 2],
      [1, 5],
      [5, 1],
      [3, 2],
    ];
    for (const [w, h] of cases) {
      const d = flat(w, h);
      expect(() =>
        applyGradND(d, w, h, {
          exposure: -100,
          angle: 360,
          position: 0,
          softness: 0,
          tintHue: 360,
          tintStrength: 100,
        })
      ).not.toThrow();
      for (let i = 0; i < d.length; i++) {
        expect(Number.isFinite(d[i])).toBe(true);
        expect(d[i]).toBeGreaterThanOrEqual(0);
        expect(d[i]).toBeLessThanOrEqual(255);
      }
    }
    // 1×1 at defaults gets a partial-weight darken — finite, darker than gray, not crushed to 0.
    const one = flat(1, 1);
    applyGradND(one, 1, 1);
    expect(one[0]).toBeGreaterThan(0);
    expect(one[0]).toBeLessThan(128);
  });

  it('descriptor settings match the params shape and defaults', () => {
    expect(GRADND_EFFECT.id).toBe('gradND');
    expect(GRADND_EFFECT.category).toBe('Effects');

    const fields = Object.keys(GRADND_DEFAULTS) as Array<keyof GradNDParams>;
    const settingIds = GRADND_EFFECT.settings.map(s => s.id);

    // One setting per Params field, exact set match.
    expect(new Set(settingIds)).toEqual(new Set(fields));
    expect(settingIds.length).toBe(fields.length);

    for (const s of GRADND_EFFECT.settings) {
      const key = s.id as keyof GradNDParams;
      expect(GRADND_DEFAULTS[key]).toBe(s.default); // default mirrors DEFAULTS
      expect(s.default).toBeGreaterThanOrEqual(s.min); // default within range
      expect(s.default).toBeLessThanOrEqual(s.max);
      expect(s.step).toBeGreaterThan(0);
    }
  });
});
