import {
  srgbByteToLinear,
  linearToSrgbByte,
  SRGB_TO_LINEAR,
  makeExposureLUT,
  makeByteLUT,
  clampByteRound,
  mulberry32,
} from '../color-space';

describe('color-space', () => {
  test('sRGB<->linear round-trip is within 1 LSB for every byte', () => {
    for (let c = 0; c < 256; c++) {
      expect(Math.abs(linearToSrgbByte(SRGB_TO_LINEAR[c]) - c)).toBeLessThanOrEqual(1);
    }
  });

  test('linear LUT endpoints and mid-gray', () => {
    expect(SRGB_TO_LINEAR[0]).toBeCloseTo(0, 6);
    expect(SRGB_TO_LINEAR[255]).toBeCloseTo(1, 6);
    // sRGB 128 decodes to ~0.2159 linear (the classic mid-gray)
    expect(SRGB_TO_LINEAR[128]).toBeCloseTo(0.2159, 3);
    expect(srgbByteToLinear(128)).toBeCloseTo(SRGB_TO_LINEAR[128], 6);
  });

  test('clampByteRound rounds half-up and clamps to [0,255]', () => {
    expect(clampByteRound(127.4)).toBe(127);
    expect(clampByteRound(127.5)).toBe(128);
    expect(clampByteRound(254.9)).toBe(255);
    expect(clampByteRound(-5)).toBe(0);
    expect(clampByteRound(300)).toBe(255);
  });

  test('exposure +1 stop maps mid-gray to ~176, not to clipped white', () => {
    const lut = makeExposureLUT(1);
    expect(lut[128]).toBeGreaterThanOrEqual(172);
    expect(lut[128]).toBeLessThanOrEqual(180);
    expect(lut[0]).toBe(0);
    expect(lut[100]).toBeLessThan(255); // does not blow lower-mids to white
  });

  test('exposure 0 stops is identity (within 1 LSB)', () => {
    const lut = makeExposureLUT(0);
    for (let c = 0; c < 256; c++) expect(Math.abs(lut[c] - c)).toBeLessThanOrEqual(1);
  });

  test('makeByteLUT applies and clamps a transfer function', () => {
    const invert = makeByteLUT(c => 255 - c);
    expect(invert[0]).toBe(255);
    expect(invert[255]).toBe(0);
    expect(invert[100]).toBe(155);
  });

  test('mulberry32 is deterministic per seed and ranges [0,1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a(), a()];
    expect([b(), b(), b(), b()]).toEqual(seqA);
    const c = mulberry32(124);
    expect([c(), c(), c()]).not.toEqual(seqA.slice(0, 3));
    seqA.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });
});
