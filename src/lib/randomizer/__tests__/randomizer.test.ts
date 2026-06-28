import { compose, type RecipeLayer } from '../compose';
import { EFFECT_META, RANDOMIZER_EFFECT_IDS, MOOD_IDS, SLOT_ORDER } from '../effectMeta';
import { makePalette } from '../palette';
import { makeRng } from '../seed';
import { effectsConfig } from '@/lib/effects';

type Cfg = { settings?: Array<{ id: string }> };
const cfg = effectsConfig as Record<string, Cfg>;
const settingIds = (id: string): Set<string> => new Set((cfg[id]?.settings || []).map(s => s.id));

describe('randomizer effect metadata validity', () => {
  test('every tagged effect exists in the real catalog', () => {
    for (const id of RANDOMIZER_EFFECT_IDS) {
      expect(cfg[id]).toBeDefined();
    }
  });

  test('every generated setting key is read by its effect (config setting or known runtime key)', () => {
    const P = makePalette(40, 'analogous', makeRng('x'));
    const rng = makeRng('y');
    // Runtime-only keys: read by the effect dispatch but not exposed as a UI
    // slider in effectsConfig (e.g. glitchArt reads settings.seed for a
    // deterministic, non-user-facing pattern seed).
    const RUNTIME_KEYS = new Set(['seed']);
    const offenders: string[] = [];
    for (const id of RANDOMIZER_EFFECT_IDS) {
      const valid = settingIds(id);
      for (const t of [0, 0.5, 1]) {
        const produced = EFFECT_META[id].settings(t, P, rng);
        for (const key of Object.keys(produced)) {
          if (!valid.has(key) && !RUNTIME_KEYS.has(key)) offenders.push(`${id}.${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('compose()', () => {
  test('produces a sparse, canonically-ordered, valid recipe for every mood', () => {
    for (const mood of MOOD_IDS) {
      for (const seed of ['AAA111', 'ZZZ999', 'MID500']) {
        const { layers } = compose(seed, mood, [], 0.5);
        expect(layers.length).toBeGreaterThanOrEqual(1);
        expect(layers.length).toBeLessThanOrEqual(7);
        let lastSlot = -1;
        for (const L of layers) {
          expect(cfg[L.effectId]).toBeDefined();
          expect(L.opacity).toBeGreaterThan(0);
          expect(L.opacity).toBeLessThanOrEqual(1);
          const slotIdx = SLOT_ORDER.indexOf(EFFECT_META[L.effectId].slot);
          expect(slotIdx).toBeGreaterThanOrEqual(lastSlot); // canonical order
          lastSlot = slotIdx;
          // never two effects in the same slot
        }
        const slots = layers.map(L => EFFECT_META[L.effectId].slot);
        expect(new Set(slots).size).toBe(slots.length);
      }
    }
  });

  test('is deterministic for a fixed seed/mood/wildness', () => {
    const a = compose('SEED42', 'neon', [], 0.6);
    const b = compose('SEED42', 'neon', [], 0.6);
    expect(JSON.stringify(a.layers)).toBe(JSON.stringify(b.layers));
  });

  test('respects locked layers absolutely and never reuses their slot', () => {
    const locked: RecipeLayer[] = [
      {
        effectId: 'duotone',
        settings: { color1: 123, color2: 456, opacity: 0.8 },
        opacity: 1,
        locked: true,
      },
    ];
    const { layers } = compose('LOCK01', 'riso', locked, 0.7);
    const dt = layers.find(L => L.effectId === 'duotone');
    expect(dt).toBeDefined();
    expect(dt!.settings.color1).toBe(123); // unchanged
    // only one 'grade' slot effect (the locked duotone)
    const grades = layers.filter(L => EFFECT_META[L.effectId].slot === 'grade');
    expect(grades.length).toBe(1);
  });

  test('wildness grows the stack', () => {
    let calm = 0;
    let wild = 0;
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
      calm += compose(s, 'faded', [], 0.0).layers.length;
      wild += compose(s, 'faded', [], 1.0).layers.length;
    }
    expect(wild).toBeGreaterThan(calm);
  });
});
