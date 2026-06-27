import { PrefixRenderCache, applyLayer, filterThis } from '../LayerPipeline';
import type { PipelineImage, LayerSpec } from '../LayerPipeline';
import { applyEffect } from '@/lib/effects';

function img(w: number, h: number, fill = 0): PipelineImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 255 : fill;
  return { data, width: w, height: h };
}

// A custom-closure filter that adds n to RGB (clamped) - ignores `this`.
function add(n: number): (im: PipelineImage) => void {
  return im => {
    for (let i = 0; i < im.data.length; i++)
      if (i % 4 !== 3) im.data[i] = Math.min(255, im.data[i] + n);
  };
}
const L = (sig: string, n: number): LayerSpec => ({ sig, filter: add(n), params: {} });

describe('LayerPipeline correctness', () => {
  test('cached render == uncached render (byte-identical)', () => {
    const specs = [L('a', 10), L('b', 20), L('c', 5)];
    const cache = new PrefixRenderCache();
    const a = img(8, 8);
    cache.render(a, specs);
    const b = img(8, 8);
    cache.renderUncached(b, specs);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    // sanity: 10+20+5 = 35
    expect(a.data[0]).toBe(35);
  });

  test('prefix reuse: cold=all, change-last=1, change-first=all; results stay correct', () => {
    const cache = new PrefixRenderCache();
    const s1 = [L('a', 10), L('b', 20), L('c', 5)];
    expect(cache.render(img(8, 8), s1)).toBe(3); // cold: recompute all

    const s2 = [L('a', 10), L('b', 20), L('c2', 7)]; // only last layer changed
    const r2 = img(8, 8);
    expect(cache.render(r2, s2)).toBe(1); // reused [a,b], recomputed only c2
    expect(r2.data[0]).toBe(37); // 10+20+7 - still correct

    const s3 = [L('a3', 1), L('b', 20), L('c2', 7)]; // first layer changed
    expect(cache.render(img(8, 8), s3)).toBe(3); // prefix invalid -> recompute all

    // re-rendering an already-cached stack reuses everything (0 recompute)
    expect(cache.render(img(8, 8), s3)).toBe(0);
  });

  test('different buffer dimensions never reuse each other (keyed by dims)', () => {
    const cache = new PrefixRenderCache();
    const specs = [L('a', 10), L('b', 20)];
    expect(cache.render(img(8, 8), specs)).toBe(2);
    expect(cache.render(img(16, 16), specs)).toBe(2); // different dims -> cold
    expect(cache.render(img(8, 8), specs)).toBe(0); // original dims still cached
  });

  test('filterThis exposes params as getter functions (Konva built-in style), default 0', () => {
    const builtin = function (
      this: { brightness(): number; saturation(): number },
      im: PipelineImage
    ) {
      const b = this.brightness();
      const s = this.saturation(); // not provided -> should be 0
      for (let i = 0; i < im.data.length; i++)
        if (i % 4 !== 3) im.data[i] = Math.min(255, im.data[i] + b + s);
    };
    const spec: LayerSpec = {
      sig: 'x',
      filter: builtin as unknown as (im: PipelineImage) => void,
      params: { brightness: 30 },
    };
    const im = img(4, 4);
    applyLayer(im, spec);
    expect(im.data[0]).toBe(30); // 30 + 0
  });

  test('real-effect stack (custom + built-in via applyEffect): cached == uncached', async () => {
    const [bloomFilter, bloomParams] = await applyEffect('bloom', { strength: 50, radius: 8 });
    const [satFilter, satParams] = await applyEffect('saturation', { value: 40 }); // Konva HSL built-in
    const specs: LayerSpec[] = [
      {
        sig: 'bloom:1',
        filter: bloomFilter as (i: PipelineImage) => void,
        params: (bloomParams || {}) as Record<string, number>,
      },
      {
        sig: 'sat:1',
        filter: satFilter as (i: PipelineImage) => void,
        params: (satParams || {}) as Record<string, number>,
      },
    ];
    const cache = new PrefixRenderCache();
    const a = img(24, 24, 90);
    cache.render(a, specs);
    const b = img(24, 24, 90);
    cache.renderUncached(b, specs);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
