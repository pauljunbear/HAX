import { rgbToOklab, oklabToRgb, oklabLerp, type Triplet } from '../color-space';

describe('OKLab helpers', () => {
  const samples: Triplet[] = [
    [0, 0, 0],
    [255, 255, 255],
    [128, 128, 128],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [64, 128, 192],
    [200, 50, 150],
    [10, 240, 30],
    [33, 33, 33],
    [199, 201, 198],
  ];

  test('rgb -> oklab -> rgb round-trips to identity (within +/-2)', () => {
    for (const rgb of samples) {
      const back = oklabToRgb(rgbToOklab(rgb));
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(back[c] - rgb[c])).toBeLessThanOrEqual(2);
      }
    }
  });

  test('a neutral gray maps to a*=b*=0 and stays achromatic on the way back', () => {
    const [L, a, b] = rgbToOklab([128, 128, 128]);
    expect(Math.abs(a)).toBeLessThan(1e-6);
    expect(Math.abs(b)).toBeLessThan(1e-6);
    expect(L).toBeGreaterThan(0);
    expect(L).toBeLessThan(1);
    // Reconstructing from [L, 0, 0] yields three identical channels (true gray).
    const [r, g, bb] = oklabToRgb([L, 0, 0]);
    expect(r).toBe(g);
    expect(g).toBe(bb);
  });

  test('oklabLerp endpoints are exact', () => {
    const black: Triplet = [0, 0, 0];
    const white: Triplet = [255, 255, 255];
    expect(oklabLerp(black, white, 0)).toEqual(black);
    expect(oklabLerp(black, white, 1)).toEqual(white);

    const blue: Triplet = [0, 0, 255];
    const yellow: Triplet = [255, 255, 0];
    expect(oklabLerp(blue, yellow, 0)).toEqual(blue);
    expect(oklabLerp(blue, yellow, 1)).toEqual(yellow);
  });

  test('oklabLerp(black, white, 0.5) is a perceptual mid-gray in a sane range', () => {
    const mid = oklabLerp([0, 0, 0], [255, 255, 255], 0.5);
    // Achromatic (a = b = 0 throughout a black<->white ramp).
    expect(mid[0]).toBe(mid[1]);
    expect(mid[1]).toBe(mid[2]);
    // The OKLab lightness midpoint (L = 0.5) decodes to ~99 -- a real mid-gray,
    // distinct from a naive sRGB byte average (0.5 * 255 = 128). It is NOT a
    // crushed/blown endpoint: it sits comfortably between black and white.
    expect(mid[0]).toBeGreaterThan(32);
    expect(mid[0]).toBeLessThan(224);
    expect(mid[0]).not.toBe(128);
  });

  test('interpolating two saturated colours stays vivid (no muddy gray midtone)', () => {
    // Naive per-channel sRGB average of blue and yellow collapses to a dead
    // gray [128,128,128] (zero chroma). OKLab keeps the path saturated.
    const blue: Triplet = [0, 0, 255];
    const yellow: Triplet = [255, 255, 0];
    const naive: Triplet = [
      Math.round((blue[0] + yellow[0]) / 2),
      Math.round((blue[1] + yellow[1]) / 2),
      Math.round((blue[2] + yellow[2]) / 2),
    ];
    const naiveSpread = Math.max(...naive) - Math.min(...naive);
    const mid = oklabLerp(blue, yellow, 0.5);
    const oklabSpread = Math.max(...mid) - Math.min(...mid);

    expect(naiveSpread).toBe(0); // proves the naive midtone is a flat gray
    expect(oklabSpread).toBeGreaterThan(naiveSpread);
    expect(oklabSpread).toBeGreaterThan(20); // visibly chromatic, not muddy
  });
});
