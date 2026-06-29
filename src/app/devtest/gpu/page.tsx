'use client';

// GPU verification harness: runs each GPU-shader effect and its CPU counterpart
// on the same image and reports the per-channel maxDiff. Driven by headless
// Chrome (--use-gl=angle --use-angle=swiftshader) in the verify script. A GPU
// effect is trusted only when its maxDiff is within tolerance of the CPU output.
import { useEffect, useState } from 'react';
import { applyEffect } from '@/lib/effects';
import { getWebGL2Renderer } from '@/lib/webgl/WebGL2Renderer';
import { buildGpuPass, gpuEffectIds } from '@/lib/webgl/gpuEffects';
import { filterThis } from '@/lib/performance/LayerPipeline';

const SETTINGS: Record<string, Record<string, number>> = {
  invert: {},
  grayscale: {},
  sepia: {},
  brightness: { value: 40 },
  contrast: { value: 30 },
  saturation: { value: 40 },
  hue: { value: 90 },
  exposure: { exposure: 100, gamma: 120, blackPoint: 10, whitePoint: 245 },
};

function makeImage(w = 64, h = 64): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = Math.round((x * 255) / (w - 1));
      d[i + 1] = Math.round((y * 255) / (h - 1));
      d[i + 2] = Math.round(((x + y) * 255) / (w + h - 2));
      d[i + 3] = 255;
    }
  }
  return new ImageData(d, w, h);
}
function clone(im: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
}
function maxDiff(a: ImageData, b: ImageData): number {
  let m = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (i % 4 === 3) continue;
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d > m) m = d;
  }
  return m;
}

export default function GpuVerifyPage() {
  const [out, setOut] = useState('running...');
  useEffect(() => {
    (async () => {
      try {
        const base = makeImage();
        const r = getWebGL2Renderer();
        const supported = r.isSupported();
        const results: Record<string, number | string> = {};
        let overall = 0;
        for (const id of gpuEffectIds()) {
          try {
            const [filter, params] = await applyEffect(id, SETTINGS[id] || {});
            const cpu = clone(base);
            // Built-in Konva filters read params from `this`; apply via the same
            // proxy the live pipeline uses so the CPU reference is faithful.
            if (filter)
              (filter as (im: ImageData) => void).call(
                filterThis((params || {}) as Record<string, number>),
                cpu
              );
            const pass = buildGpuPass(id, (params || {}) as Record<string, number>, SETTINGS[id]);
            const gpu = pass ? r.render(clone(base), [pass]) : null;
            if (!gpu) {
              results[id] = 'no-gpu';
              continue;
            }
            const md = maxDiff(cpu, gpu);
            results[id] = md;
            overall = Math.max(overall, md);
          } catch (e) {
            results[id] = 'ERR:' + (e as Error).message;
          }
        }
        const summary = `GPU-VERIFY supported=${supported} overallMaxDiff=${overall} ${JSON.stringify(results)}`;
        document.title = summary;
        setOut(summary);
      } catch (e) {
        const msg = 'GPU-VERIFY FATAL ' + (e as Error).message;
        document.title = msg;
        setOut(msg);
      }
    })();
  }, []);
  return <pre id="result">{out}</pre>;
}
