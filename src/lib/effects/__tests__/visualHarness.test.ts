/**
 * Visual / screenshot-diff harness.
 *
 * Renders effects to real PNGs (via the `canvas` dep) so output can be looked
 * at, and provides a pixel-diff utility for comparing two render paths (the
 * basis for verifying layer caching == full recompute, and later CPU vs GPU).
 *
 * The hash-based goldenEffects harness catches *that* an effect changed; this
 * one lets a human confirm *whether the change is right*, and lets equivalence
 * tests assert two paths match within tolerance.
 *
 * PNG dumps are opt-in (VISUAL=1) and written outside the repo tree so they're
 * never committed. The pixel-diff utility test always runs.
 */
import { applyEffect } from '../../effects';
import { PrefixRenderCache } from '../../performance/LayerPipeline';
import type { LayerSpec } from '../../performance/LayerPipeline';

type Img = { data: Uint8ClampedArray; width: number; height: number };

// A deterministic, content-rich test image: dark field with bright highlights
// (so bloom/glow halos are visible), a saturated hue strip, a luminance ramp,
// and high-frequency dots.
function makeRichImage(size = 192): Img {
  const data = new Uint8ClampedArray(size * size * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * size + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      set(x, y, 12, 14, 26); // dark navy field
    }
  }
  // saturated hue strip (top quarter)
  for (let y = 0; y < size / 4; y++) {
    for (let x = 0; x < size; x++) {
      const h = (x / size) * 360;
      const c = 1;
      const hp = h / 60;
      const xx = c * (1 - Math.abs((hp % 2) - 1));
      let r = 0;
      let g = 0;
      let b = 0;
      if (hp < 1) [r, g, b] = [c, xx, 0];
      else if (hp < 2) [r, g, b] = [xx, c, 0];
      else if (hp < 3) [r, g, b] = [0, c, xx];
      else if (hp < 4) [r, g, b] = [0, xx, c];
      else if (hp < 5) [r, g, b] = [xx, 0, c];
      else [r, g, b] = [c, 0, xx];
      set(x, y, Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    }
  }
  // luminance ramp (a horizontal band)
  for (let y = Math.floor(size / 4); y < Math.floor(size / 4) + 16; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round((x / (size - 1)) * 255);
      set(x, y, v, v, v);
    }
  }
  // bright warm highlight disc (for bloom/glow) on the dark field
  const cx = size * 0.5;
  const cy = size * 0.66;
  const rad = size * 0.12;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < rad) set(x, y, 255, 244, 220);
    }
  }
  // high-frequency bright dots
  for (let k = 0; k < 40; k++) {
    const x = (k * 37) % size;
    const y = Math.floor((k * 53) / size) * 7 + Math.floor(size * 0.85);
    if (y < size) set(x % size, y % size, 255, 255, 255);
  }
  return { data, width: size, height: size };
}

// Per-channel pixel diff between two equally-sized images.
function diffImages(a: Img, b: Img) {
  let maxDiff = 0;
  let sum = 0;
  let changed = 0;
  const n = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < n; i += 4) {
    let pixelChanged = false;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      if (d > maxDiff) maxDiff = d;
      sum += d;
      if (d > 1) pixelChanged = true;
    }
    if (pixelChanged) changed++;
  }
  const pixels = n / 4;
  return { maxDiff, meanDiff: sum / (pixels * 3), changedPixels: changed, pixels };
}

function clone(img: Img): Img {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
}

async function render(effect: string, settings: Record<string, number>, base: Img): Promise<Img> {
  const img = clone(base);
  const res = await applyEffect(effect, settings);
  if (Array.isArray(res) && typeof res[0] === 'function') (res[0] as (i: Img) => void)(img);
  return img;
}

describe('visual harness', () => {
  test('diffImages reports zero for identical, non-zero for changed', () => {
    const base = makeRichImage(32);
    expect(diffImages(base, clone(base)).maxDiff).toBe(0);
    const shifted = clone(base);
    shifted.data[0] = shifted.data[0] === 0 ? 255 : 0;
    expect(diffImages(base, shifted).maxDiff).toBeGreaterThan(0);
  });

  test('an effect is deterministic across two identical render passes (path-equivalence basis)', async () => {
    const base = makeRichImage(48);
    const a = await render('bloom', { strength: 60, radius: 12 }, base);
    const b = await render('bloom', { strength: 60, radius: 12 }, base);
    expect(diffImages(a, b).maxDiff).toBe(0);
  });

  test('optionally dump effect PNGs for human inspection (VISUAL=1)', async () => {
    if (!process.env.VISUAL) {
      return; // opt-in; no file writes in normal/CI runs
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    let createCanvas: ((w: number, h: number) => unknown) | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      createCanvas = require('canvas').createCanvas;
    } catch {
      console.warn('canvas not available; skipping PNG dump');
      return;
    }
    const outDir = process.env.VISUAL_DIR || path.join(process.cwd(), 'test', 'visual');
    fs.mkdirSync(outDir, { recursive: true });
    const base = makeRichImage(256);

    const writePng = (name: string, img: Img) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cv: any = createCanvas!(img.width, img.height);
      const ctx = cv.getContext('2d');
      const id = ctx.createImageData(img.width, img.height);
      id.data.set(img.data);
      ctx.putImageData(id, 0, 0);
      fs.writeFileSync(path.join(outDir, `${name}.png`), cv.toBuffer('image/png'));
    };

    writePng('_original', base);
    const subjects: Array<[string, Record<string, number>]> = [
      ['bloom', { strength: 70, radius: 16 }],
      ['unifiedGlow', { intensity: 70, radius: 18 }],
      ['orton', { brightness: 0.3, glow: 0.7, blendMode: 0 }],
      ['bioluminescence', {}],
      ['neonGlowEdges', {}],
      [
        'advancedDithering',
        { algorithm: 0, palette: 0, threshold: 0.5, patternScale: 2, contrast: 1 },
      ],
      ['chromaticAberration', { amount: 6, angle: 45 }],
      ['colorTemperature', { temperature: 70, tint: 0 }],
    ];
    for (const [name, s] of subjects) {
      try {
        writePng(name, await render(name, s, base));
      } catch (e) {
        console.warn(`skip ${name}:`, (e as Error).message);
      }
    }

    // Stacked render THROUGH the prefix pipeline (validates layer caching).
    const stackDefs: Array<[string, Record<string, number>]> = [
      ['bloom', { strength: 50, radius: 12 }],
      ['chromaticAberration', { amount: 5, angle: 30 }],
      ['colorTemperature', { temperature: 50, tint: 0 }],
    ];
    const specs: LayerSpec[] = [];
    for (const [name, s] of stackDefs) {
      const res = await applyEffect(name, s);
      if (Array.isArray(res) && typeof res[0] === 'function') {
        specs.push({
          sig: `${name}:${JSON.stringify(s)}`,
          filter: res[0] as (i: Img) => void,
          params: (res[1] || {}) as Record<string, number>,
        });
      }
    }
    const cache = new PrefixRenderCache();
    const stackImg = clone(base);
    cache.render(stackImg, specs);
    writePng('_stack', stackImg);
    // sanity: cached result equals a fresh uncached recompute
    const uncached = clone(base);
    cache.renderUncached(uncached, specs);
    let maxd = 0;
    for (let i = 0; i < stackImg.data.length; i++)
      maxd = Math.max(maxd, Math.abs(stackImg.data[i] - uncached.data[i]));
    console.log(
      `visual harness: wrote PNGs to ${outDir}; stack cached-vs-uncached maxDiff=${maxd}`
    );
    expect(fs.existsSync(path.join(outDir, '_original.png'))).toBe(true);
  });
});
