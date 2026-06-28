/**
 * Determinism + correctness gate for the shared renderStack module — the ONE
 * pipeline both the main thread and the render worker call. If these pass, a
 * worker that imports the same module produces byte-identical pixels.
 *
 * Stack is deliberately deterministic: unifiedFilm (seeded grain via
 * settings.seed), contrast (Konva built-in, no RNG), proMist (pure pro effect).
 * `noise`/`fractalNoise`-via-Konva are intentionally excluded — Konva's Noise
 * reads Math.random at apply time, so it is non-deterministic by design.
 */

import { buildSpecs, renderStackInto } from '../renderStack';
import type { SerializableLayer } from '../renderStack';
import { PrefixRenderCache, applyLayer } from '../../performance/LayerPipeline';
import type { PipelineImage } from '../../performance/LayerPipeline';
import { mulberry32 } from '../color-space';

function makeImage(w = 24, h = 24): PipelineImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 10) % 256;
      data[i + 1] = (y * 10) % 256;
      data[i + 2] = ((x + y) * 5) % 256;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const STACK: SerializableLayer[] = [
  { effectId: 'unifiedFilm', settings: { seed: 7 } },
  { effectId: 'contrast', settings: { contrast: 25 } },
  { effectId: 'proMist', settings: {} },
];

// Pin Math.random exactly like goldenEffects so any incidental RNG is stable.
let origRandom: () => number;
beforeEach(() => {
  origRandom = Math.random;
  const r = mulberry32(0xc0ffee);
  Math.random = () => r();
});
afterEach(() => {
  Math.random = origRandom;
});

describe('renderStack — shared main/worker pipeline', () => {
  it('builds one spec per visible layer', async () => {
    const specs = await buildSpecs(STACK);
    expect(specs.length).toBe(3);
    expect(specs.map(s => s.effectId)).toEqual(['unifiedFilm', 'contrast', 'proMist']);
  });

  it('prefix-cached render is byte-identical to uncached (no cache drift)', async () => {
    const specs = await buildSpecs(STACK);
    const cached = makeImage();
    const uncached = makeImage();

    new PrefixRenderCache().render(cached, specs);
    for (const s of specs) applyLayer(uncached, s);

    expect(Array.from(cached.data)).toEqual(Array.from(uncached.data));
  });

  it('is deterministic across independent renders (same seed → same bytes)', async () => {
    const a = makeImage();
    await renderStackInto(a, STACK, new PrefixRenderCache());

    // fresh RNG + fresh caches: a second independent render must match the first
    const r = mulberry32(0xc0ffee);
    Math.random = () => r();
    const b = makeImage();
    await renderStackInto(b, STACK, new PrefixRenderCache());

    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('skips invisible layers', async () => {
    const specs = await buildSpecs([
      { effectId: 'unifiedFilm', settings: { seed: 7 } },
      { effectId: 'contrast', settings: { contrast: 25 }, visible: false },
    ]);
    expect(specs.map(s => s.effectId)).toEqual(['unifiedFilm']);
  });
});
