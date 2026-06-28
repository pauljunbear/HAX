import {
  applyChannelMixer,
  CHANNELMIXER_DEFAULTS,
  CHANNELMIXER_EFFECT,
  ChannelMixerParams,
} from '../pro/channelMixer';

/** Fill an RGBA buffer with a flat colour (constant per channel). */
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

describe('Channel Mixer', () => {
  it('is an exact no-op at neutral defaults', () => {
    const a = flat(16, 16, 40, 130, 210);
    const b = Uint8Array.from(a);
    applyChannelMixer(a, 16, 16, {});
    expect(Array.from(a)).toEqual(Array.from(b));
    // explicit defaults round-trip identically too
    const c = flat(16, 16, 7, 99, 251);
    const cBefore = Uint8Array.from(c);
    applyChannelMixer(c, 16, 16, { ...CHANNELMIXER_DEFAULTS });
    expect(Array.from(c)).toEqual(Array.from(cBefore));
  });

  it('output R is monotonic in the rFromR slider', () => {
    const outR = (w: number): number => {
      const d = flat(8, 8, 128, 128, 128);
      applyChannelMixer(d, 8, 8, { rFromR: w, rFromG: 0, rFromB: 0 });
      return d[0];
    };
    const a = outR(25);
    const b = outR(75);
    const c = outR(150);
    const e = outR(200);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(e).toBeGreaterThan(c);
  });

  it('performs a clean channel swap (R↔G)', () => {
    // swap: outR takes G, outG takes R, outB unchanged
    const d = flat(8, 8, 20, 200, 90);
    applyChannelMixer(d, 8, 8, {
      rFromR: 0,
      rFromG: 100,
      rFromB: 0,
      gFromR: 100,
      gFromG: 0,
      gFromB: 0,
    });
    // outR should now equal the original green (200), outG the original red (20).
    expect(d[0]).toBe(200);
    expect(d[1]).toBe(20);
    expect(d[2]).toBe(90); // blue row left at default 0/0/100
  });

  it('mixes in LINEAR light, not display space', () => {
    // A 50/50 mix of a full channel (255) and an empty channel (0).
    // Half the LIGHT re-encodes to ~188, NOT the display midpoint 128.
    const d = flat(4, 4, 255, 0, 0);
    applyChannelMixer(d, 4, 4, { rFromR: 50, rFromG: 50, rFromB: 0 });
    expect(d[0]).toBeGreaterThan(180);
    expect(d[0]).toBeLessThan(195);
    // A naive display-space average would have produced ~128.
    expect(d[0]).toBeGreaterThan(150);
  });

  it('monochrome mode yields equal R=G=B using the red-row weights', () => {
    const d = flat(8, 8, 60, 180, 120);
    applyChannelMixer(d, 8, 8, {
      monochrome: 1,
      rFromR: 30,
      rFromG: 59,
      rFromB: 11,
    });
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
    }
    // The gray must be a real weighted mix, not pinned to an extreme.
    expect(d[0]).toBeGreaterThan(0);
    expect(d[0]).toBeLessThan(255);
  });

  it('monochrome ignores the green/blue rows (only red-row matters)', () => {
    const base = {
      monochrome: 1,
      rFromR: 30,
      rFromG: 59,
      rFromB: 11,
    } as Partial<ChannelMixerParams>;
    const d1 = flat(6, 6, 80, 160, 200);
    const d2 = flat(6, 6, 80, 160, 200);
    applyChannelMixer(d1, 6, 6, base);
    applyChannelMixer(d2, 6, 6, { ...base, gFromR: -200, gFromB: 175, bFromG: 200 });
    expect(Array.from(d1)).toEqual(Array.from(d2));
  });

  it('is deterministic (preview == export) across repeated runs', () => {
    const p: Partial<ChannelMixerParams> = {
      rFromR: 60,
      rFromG: 40,
      gFromB: 120,
      bFromR: -50,
    };
    const a = flat(20, 20, 33, 144, 222);
    const b = flat(20, 20, 33, 144, 222);
    applyChannelMixer(a, 20, 20, p);
    applyChannelMixer(b, 20, 20, p);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('clamps extreme weights without overflow, NaN, or alpha damage', () => {
    const d = flat(8, 8, 255, 255, 255, 137);
    applyChannelMixer(d, 8, 8, {
      rFromR: 200,
      rFromG: 200,
      rFromB: 200, // way over white → clamps high
      gFromR: -200,
      gFromG: -200,
      gFromB: -200, // way under black → clamps low
      bFromR: 0,
      bFromG: 0,
      bFromB: 100,
    });
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(255);
      expect(d[i + 1]).toBe(0);
      expect(d[i + 2]).toBe(255);
      expect(Number.isFinite(d[i])).toBe(true);
      expect(d[i + 3]).toBe(137); // alpha preserved
    }
  });

  it('handles a 1x1 image without throwing', () => {
    const d = flat(1, 1, 12, 34, 56);
    expect(() => applyChannelMixer(d, 1, 1, { rFromG: 100 })).not.toThrow();
  });

  it('ignores undefined partial fields (falls back to defaults)', () => {
    const d = flat(4, 4, 90, 90, 90);
    const ref = flat(4, 4, 90, 90, 90);
    applyChannelMixer(d, 4, 4, {
      rFromR: undefined,
      monochrome: undefined,
    } as Partial<ChannelMixerParams>);
    applyChannelMixer(ref, 4, 4, {});
    expect(Array.from(d)).toEqual(Array.from(ref));
  });

  describe('descriptor integrity', () => {
    it('exposes id/label/category and 10 settings, one per Params field', () => {
      expect(CHANNELMIXER_EFFECT.id).toBe('channelMixer');
      expect(CHANNELMIXER_EFFECT.label).toBe('Channel Mixer');
      expect(CHANNELMIXER_EFFECT.category).toBe('Color');
      const paramKeys = Object.keys(CHANNELMIXER_DEFAULTS).sort();
      const settingIds = CHANNELMIXER_EFFECT.settings.map(s => s.id).sort();
      expect(settingIds).toEqual(paramKeys);
      expect(CHANNELMIXER_EFFECT.settings).toHaveLength(paramKeys.length);
    });

    it('every setting default matches CHANNELMIXER_DEFAULTS and sits within range', () => {
      for (const s of CHANNELMIXER_EFFECT.settings) {
        const key = s.id as keyof ChannelMixerParams;
        expect(s.default).toBe(CHANNELMIXER_DEFAULTS[key]);
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
        expect(s.step).toBe(1);
      }
    });
  });
});
