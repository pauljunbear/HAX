import {
  applyExposure,
  buildExposureLUT,
  EXPOSURE_DEFAULTS,
  EXPOSURE_EFFECT,
} from '../pro/exposure';

/** Solid RGBA image of one gray level (alpha 200 to prove it's preserved). */
function solid(w: number, h: number, gray: number, alpha = 200): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = gray;
    d[i + 3] = alpha;
  }
  return d;
}

/** Map a single mid-gray byte through the effect and return the output byte. */
function mapGray(gray: number, params: Record<string, number>): number {
  const d = solid(2, 2, gray);
  applyExposure(d, 2, 2, params);
  return d[0];
}

describe('Exposure + Gamma + Levels', () => {
  describe('identity / no-op', () => {
    it('neutral defaults are an exact no-op', () => {
      const d = solid(8, 8, 137);
      // scatter a few distinct values so it isn't just one level
      d[0] = 0;
      d[4] = 255;
      d[8] = 64;
      d[12] = 191;
      const before = Uint8Array.from(d);
      applyExposure(d, 8, 8, { ...EXPOSURE_DEFAULTS });
      expect(Array.from(d)).toEqual(Array.from(before));
    });

    it('the neutral LUT is the identity for all 256 inputs', () => {
      const lut = buildExposureLUT(EXPOSURE_DEFAULTS);
      for (let c = 0; c < 256; c++) expect(lut[c]).toBe(c);
    });

    it('passing no params behaves as defaults (no-op)', () => {
      const d = solid(4, 4, 90);
      const before = Uint8Array.from(d);
      applyExposure(d, 4, 4);
      expect(Array.from(d)).toEqual(Array.from(before));
    });
  });

  describe('exposure (main slider) — linear-light multiply', () => {
    it('+1 stop maps mid-gray 128 → ~176 (not clipped white)', () => {
      const out = mapGray(128, { exposure: 100 }); // 100/100 = +1 stop
      expect(out).toBeGreaterThanOrEqual(174);
      expect(out).toBeLessThanOrEqual(178);
    });

    it('is monotonic non-decreasing in the exposure slider', () => {
      const stops = [-300, -200, -100, -50, 0, 50, 100, 200, 300];
      const outs = stops.map(exposure => mapGray(128, { exposure }));
      for (let i = 1; i < outs.length; i++) {
        expect(outs[i]).toBeGreaterThanOrEqual(outs[i - 1]);
      }
      // and strictly brighter at the extremes
      expect(outs[outs.length - 1]).toBeGreaterThan(outs[0]);
    });

    it('negative exposure darkens, positive brightens', () => {
      expect(mapGray(128, { exposure: -100 })).toBeLessThan(128);
      expect(mapGray(128, { exposure: 100 })).toBeGreaterThan(128);
    });
  });

  describe('gamma — display-space midtone curve', () => {
    it('gamma > 1 lifts midtones, gamma < 1 deepens them, 1.0 is neutral', () => {
      const dark = mapGray(128, { gamma: 50 }); // 0.5
      const neutral = mapGray(128, { gamma: 100 }); // 1.0
      const bright = mapGray(128, { gamma: 200 }); // 2.0
      expect(neutral).toBe(128);
      expect(dark).toBeLessThan(neutral);
      expect(bright).toBeGreaterThan(neutral);
    });

    it('is monotonic in the gamma slider at a midtone', () => {
      const gammas = [20, 50, 100, 150, 200, 300];
      const outs = gammas.map(gamma => mapGray(100, { gamma }));
      for (let i = 1; i < outs.length; i++) {
        expect(outs[i]).toBeGreaterThanOrEqual(outs[i - 1]);
      }
    });

    it('leaves pure black and pure white fixed', () => {
      expect(mapGray(0, { gamma: 250 })).toBe(0);
      expect(mapGray(255, { gamma: 30 })).toBe(255);
    });
  });

  describe('levels — black/white point remap', () => {
    it('inputs at/below the black point clamp to 0', () => {
      expect(mapGray(40, { blackPoint: 50 })).toBe(0);
      expect(mapGray(50, { blackPoint: 50 })).toBe(0);
    });

    it('inputs at/above the white point clamp to 255', () => {
      expect(mapGray(220, { whitePoint: 200 })).toBe(255);
      expect(mapGray(200, { whitePoint: 200 })).toBe(255);
    });

    it('the white point sits exactly at the top of the stretch', () => {
      // With whitePoint=200, input 200 → 255; a value just under stays under 255.
      expect(mapGray(199, { whitePoint: 200 })).toBeLessThan(255);
    });

    it('raising the black point increases contrast (darkens a low midtone)', () => {
      const base = mapGray(96, {});
      const lifted = mapGray(96, { blackPoint: 40 });
      expect(lifted).toBeLessThan(base);
    });

    it('lowering the white point lifts a high midtone toward white', () => {
      const base = mapGray(180, {});
      const stretched = mapGray(180, { whitePoint: 210 });
      expect(stretched).toBeGreaterThan(base);
    });
  });

  describe('determinism', () => {
    it('produces byte-identical output across runs (no hidden randomness)', () => {
      const a = solid(16, 16, 73);
      const b = solid(16, 16, 73);
      const params = { exposure: 80, gamma: 140, blackPoint: 12, whitePoint: 240 };
      applyExposure(a, 16, 16, params);
      applyExposure(b, 16, 16, params);
      expect(Array.from(a)).toEqual(Array.from(b));
    });
  });

  describe('edge safety', () => {
    it('preserves the alpha channel', () => {
      const d = solid(4, 4, 128, 173);
      applyExposure(d, 4, 4, { exposure: 150, gamma: 60, blackPoint: 10, whitePoint: 240 });
      for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(173);
    });

    it('never emits NaN/Infinity and stays in [0,255] across the full range', () => {
      const lut = buildExposureLUT({
        exposure: 300,
        gamma: 20,
        blackPoint: 100,
        whitePoint: 155,
      });
      for (let c = 0; c < 256; c++) {
        const v = lut[c];
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    });

    it('handles a 1x1 image without throwing', () => {
      const d = new Uint8ClampedArray([100, 150, 200, 255]);
      expect(() => applyExposure(d, 1, 1, { exposure: 100 })).not.toThrow();
      expect(d[3]).toBe(255);
    });

    it('tolerates degenerate (inverted) black/white points without div-by-zero', () => {
      const lut = buildExposureLUT({ blackPoint: 100, whitePoint: 100 });
      for (let c = 0; c < 256; c++) expect(Number.isFinite(lut[c])).toBe(true);
    });
  });

  describe('descriptor contract', () => {
    it('exposes id/label/category and one setting per Params field', () => {
      expect(EXPOSURE_EFFECT.id).toBe('exposure');
      expect(EXPOSURE_EFFECT.category).toBe('Adjust');
      const ids = EXPOSURE_EFFECT.settings.map(s => s.id).sort();
      expect(ids).toEqual(['blackPoint', 'exposure', 'gamma', 'whitePoint']);
    });

    it('setting defaults match EXPOSURE_DEFAULTS', () => {
      for (const s of EXPOSURE_EFFECT.settings) {
        expect(s.default).toBe(EXPOSURE_DEFAULTS[s.id as keyof typeof EXPOSURE_DEFAULTS]);
      }
    });

    it('every default sits within its declared min/max', () => {
      for (const s of EXPOSURE_EFFECT.settings) {
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
      }
    });
  });
});
