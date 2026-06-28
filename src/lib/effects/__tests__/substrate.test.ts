import { monotoneCubic, buildCurveLUT, applyFilmStock, type FilmRecipe } from '../film/substrate';

function gray(w: number, h: number, v: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return d;
}

describe('monotone cubic curve', () => {
  it('reproduces the identity line', () => {
    const f = monotoneCubic([
      [0, 0],
      [1, 1],
    ]);
    for (const t of [0, 0.1, 0.37, 0.5, 0.83, 1]) expect(f(t)).toBeCloseTo(t, 5);
  });

  it('is monotonic and never overshoots [0,1]', () => {
    const f = monotoneCubic([
      [0, 0],
      [0.4, 0.1],
      [0.6, 0.95],
      [1, 1],
    ]);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = f(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9); // non-decreasing
      prev = v;
    }
  });

  it('clamps flat outside the control range (shoulder/toe)', () => {
    const f = monotoneCubic([
      [0.05, 0.02],
      [1, 0.9],
    ]);
    expect(f(0)).toBeCloseTo(0.02, 5); // lifted toe
    expect(f(1)).toBeCloseTo(0.9, 5); // rolled-off shoulder (no hard clip to 1)
  });
});

describe('buildCurveLUT', () => {
  it('linear curve ≈ identity LUT', () => {
    const lut = buildCurveLUT([
      [0, 0],
      [1, 1],
    ])!;
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
    expect(Math.abs(lut[128] - 128)).toBeLessThanOrEqual(1);
  });

  it('S-curve increases contrast (darkens shadows, brightens highlights)', () => {
    const lut = buildCurveLUT([
      [0, 0],
      [0.25, 0.15],
      [0.75, 0.85],
      [1, 1],
    ])!;
    expect(lut[64]).toBeLessThan(64);
    expect(lut[192]).toBeGreaterThan(192);
  });

  it('shoulder curve keeps highlights below clipping', () => {
    const lut = buildCurveLUT([
      [0, 0],
      [1, 0.9],
    ])!;
    expect(lut[255]).toBeLessThan(255);
    expect(lut[255]).toBeGreaterThan(220);
  });
});

describe('applyFilmStock', () => {
  it('strength = 0 is a no-op', () => {
    const recipe: FilmRecipe = { name: 't', gain: [1.5, 1, 0.5], saturation: 2 };
    const a = gray(8, 8, 128);
    const b = Uint8Array.from(a);
    applyFilmStock(a, 8, 8, recipe, { strength: 0 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('linear gains warm/cool the image', () => {
    const recipe: FilmRecipe = { name: 't', gain: [1.2, 1, 0.8] };
    const d = gray(8, 8, 128);
    applyFilmStock(d, 8, 8, recipe);
    expect(d[0]).toBeGreaterThan(128); // red up
    expect(d[2]).toBeLessThan(128); // blue down
  });

  it('B&W channel mix yields a true neutral gray', () => {
    const recipe: FilmRecipe = { name: 'bw', bw: [0.25, 0.55, 0.2] };
    // a colourful pixel field
    const d = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 200;
      d[i + 1] = 90;
      d[i + 2] = 40;
      d[i + 3] = 255;
    }
    applyFilmStock(d, 4, 4, recipe);
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
    }
  });

  it('strength blends between original and full effect', () => {
    const recipe: FilmRecipe = { name: 't', gain: [1.4, 1, 1] };
    const full = gray(8, 8, 100);
    const half = gray(8, 8, 100);
    applyFilmStock(full, 8, 8, recipe, { strength: 1 });
    applyFilmStock(half, 8, 8, recipe, { strength: 0.5 });
    expect(half[0]).toBeGreaterThan(100);
    expect(half[0]).toBeLessThan(full[0]);
  });
});
