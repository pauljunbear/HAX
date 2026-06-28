import { EFFECT_META, RANDOMIZER_EFFECT_IDS, MOODS, MOOD_IDS } from '../effectMeta';
import { makePalette } from '../palette';
import { makeRng } from '../seed';
import { effectsConfig } from '@/lib/effects';

type Setting = { id: string; min: number; max: number };
type Cfg = { settings?: Setting[] };
const cfg = effectsConfig as Record<string, Cfg>;

/** settingId -> {min,max} for one effect. */
const rangeOf = (id: string): Map<string, { min: number; max: number }> => {
  const m = new Map<string, { min: number; max: number }>();
  for (const s of cfg[id]?.settings || []) m.set(s.id, { min: s.min, max: s.max });
  return m;
};

// Keys an effect's dispatch reads at runtime but does not expose as a config
// slider (e.g. glitchArt's non-user-facing pattern seed). Not range-checked.
const RUNTIME_KEYS = new Set(['seed']);

describe('EFFECT_META referential integrity', () => {
  test('every referenced effectId exists in effectsConfig', () => {
    for (const id of RANDOMIZER_EFFECT_IDS) {
      expect(cfg[id]).toBeDefined();
    }
  });

  test('the high-value effects from Task 1 are present with the right slot', () => {
    const expected: Record<string, string> = {
      unifiedFilm: 'grade',
      splitTone: 'grade',
      bleachBypass: 'grade',
      channelMixer: 'grade',
      colorBalance: 'tone',
      clarity: 'tone',
      proMist: 'glow',
      gradND: 'frame',
      oilPainting: 'stylize',
      watercolor: 'stylize',
      unifiedPrint: 'stylize',
      toon: 'stylize',
    };
    for (const [id, slot] of Object.entries(expected)) {
      expect(EFFECT_META[id]).toBeDefined();
      expect(EFFECT_META[id].slot).toBe(slot);
    }
  });
});

describe('EFFECT_META settings stay within effectsConfig ranges', () => {
  const palette = makePalette(40, 'analogous', makeRng('palette-seed'));
  const ts = [0, 0.12, 0.25, 0.5, 0.75, 0.95, 1];

  test('every produced numeric value is in range across t and many rng draws', () => {
    const offenders: string[] = [];
    for (const id of RANDOMIZER_EFFECT_IDS) {
      const ranges = rangeOf(id);
      // Fresh rng stream per effect; sample enough draws to exercise rng-driven
      // settings (preset, seed, hue, angle, algorithm...).
      const rng = makeRng(`range-${id}`);
      for (let iter = 0; iter < 64; iter++) {
        for (const t of ts) {
          const produced = EFFECT_META[id].settings(t, palette, rng);
          for (const [key, value] of Object.entries(produced)) {
            expect(typeof value).toBe('number');
            expect(Number.isFinite(value)).toBe(true);
            const r = ranges.get(key);
            if (!r) {
              // Not a config slider: must be a known runtime-only key, else typo.
              if (!RUNTIME_KEYS.has(key)) offenders.push(`${id}.${key} (unknown key)`);
              continue;
            }
            if (value < r.min || value > r.max) {
              offenders.push(`${id}.${key}=${value} out of [${r.min},${r.max}]`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('MOODS integrity', () => {
  test('every mood prefers only real EFFECT_META effects', () => {
    const offenders: string[] = [];
    for (const moodId of MOOD_IDS) {
      for (const id of Object.keys(MOODS[moodId].prefer)) {
        if (!EFFECT_META[id]) offenders.push(`${moodId}.prefer.${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the original 8 moods plus the 3 new moods are all present', () => {
    for (const m of ['faded', 'neon', 'riso', 'dreamy', 'noir', 'acid', 'sun', 'cyber']) {
      expect(MOODS[m]).toBeDefined();
    }
    for (const m of ['cinematic', 'print', 'mono']) {
      expect(MOODS[m]).toBeDefined();
    }
  });
});
