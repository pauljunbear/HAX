import { LOOKS, LOOK_IDS, looksByTag, getLook, lookToStackLayers, type Look } from '../looks';
import { effectsConfig } from '@/lib/effects';

type Setting = { id: string; min: number; max: number };
type Cfg = { settings?: Setting[] };
const cfg = effectsConfig as Record<string, Cfg>;

const rangeOf = (id: string): Map<string, { min: number; max: number }> => {
  const m = new Map<string, { min: number; max: number }>();
  for (const s of cfg[id]?.settings || []) m.set(s.id, { min: s.min, max: s.max });
  return m;
};

describe('Looks library shape', () => {
  test('there are at least 16 curated looks', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(16);
  });

  test('look ids are unique and LOOK_IDS mirrors them', () => {
    const ids = LOOKS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LOOK_IDS).toEqual(ids);
  });

  test('every look has a name, blurb, at least one tag and at least one layer', () => {
    for (const look of LOOKS) {
      expect(look.name.length).toBeGreaterThan(0);
      expect(look.blurb.length).toBeGreaterThan(0);
      expect(look.tags.length).toBeGreaterThan(0);
      expect(look.layers.length).toBeGreaterThan(0);
    }
  });
});

describe('Looks reference only real effects + valid in-range settings', () => {
  test('every layer effectId exists and every setting key/value is valid', () => {
    const offenders: string[] = [];
    for (const look of LOOKS) {
      for (const layer of look.layers) {
        if (!cfg[layer.effectId]) {
          offenders.push(`${look.id}: unknown effect "${layer.effectId}"`);
          continue;
        }
        const ranges = rangeOf(layer.effectId);
        for (const [key, value] of Object.entries(layer.settings)) {
          const r = ranges.get(key);
          if (!r) {
            offenders.push(`${look.id}/${layer.effectId}.${key} (not a real setting)`);
            continue;
          }
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            offenders.push(`${look.id}/${layer.effectId}.${key} not finite`);
            continue;
          }
          if (value < r.min || value > r.max) {
            offenders.push(
              `${look.id}/${layer.effectId}.${key}=${value} out of [${r.min},${r.max}]`
            );
          }
        }
        expect(layer.opacity).toBeGreaterThan(0);
        expect(layer.opacity).toBeLessThanOrEqual(1);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('looksByTag grouping', () => {
  test('each look appears under every one of its tags', () => {
    for (const look of LOOKS) {
      for (const tag of look.tags) {
        expect(looksByTag[tag]).toBeDefined();
        expect(looksByTag[tag].map(l => l.id)).toContain(look.id);
      }
    }
  });

  test('no tag bucket contains a look that lacks that tag', () => {
    for (const [tag, looks] of Object.entries(looksByTag)) {
      for (const look of looks) {
        expect(look.tags).toContain(tag);
      }
    }
  });
});

describe('getLook + lookToStackLayers', () => {
  test('getLook resolves by id and misses return undefined', () => {
    expect(getLook(LOOKS[0].id)?.id).toBe(LOOKS[0].id);
    expect(getLook('does-not-exist')).toBeUndefined();
  });

  test('lookToStackLayers matches the RecipeLayer shape and clones settings', () => {
    const look: Look = LOOKS[0];
    const stack = lookToStackLayers(look);
    expect(stack.length).toBe(look.layers.length);
    for (let i = 0; i < stack.length; i++) {
      expect(stack[i].effectId).toBe(look.layers[i].effectId);
      expect(stack[i].opacity).toBe(look.layers[i].opacity);
      expect(stack[i].locked).toBe(false);
      expect(stack[i].settings).toEqual(look.layers[i].settings);
    }
    // Mutating the produced settings must not touch the source Look.
    const firstKey = Object.keys(stack[0].settings)[0];
    const original = look.layers[0].settings[firstKey];
    stack[0].settings[firstKey] = original + 999;
    expect(look.layers[0].settings[firstKey]).toBe(original);
  });
});
