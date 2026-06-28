'use client';

/**
 * /devtest/worker — determinism gate for the render worker.
 *
 * Renders the SAME stack on the main thread and inside the render worker, then
 * diffs the bytes. maxDiff 0 == the worker is byte-identical to the main thread
 * (so wiring it in cannot change a single pixel). Mirrors /devtest/gpu.
 *
 * The stack is deliberately deterministic (seeded film grain + a Konva built-in
 * + pure pro effects); `noise`/Konva.Noise is excluded as it reads Math.random
 * at apply time.
 */

import { useEffect, useRef, useState } from 'react';
import { buildSpecs } from '@/lib/effects/renderStack';
import type { SerializableLayer } from '@/lib/effects/renderStack';
import { PrefixRenderCache } from '@/lib/performance/LayerPipeline';

const STACK: SerializableLayer[] = [
  { effectId: 'unifiedFilm', settings: { seed: 7 } },
  { effectId: 'contrast', settings: { contrast: 25 } }, // Konva built-in
  { effectId: 'proMist', settings: {} },
  { effectId: 'clarity', settings: {} },
];

type Report = {
  status: string;
  maxDiff?: number;
  diffCount?: number;
  totalBytes?: number;
  mainMs?: number;
  workerMs?: number;
  workerRecomputed?: number;
  dims?: string;
  error?: string;
};

async function loadSourceImageData(url: string): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('sample image load failed'));
    img.src = url;
  });
  const maxW = 512;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');
  cx.drawImage(img, 0, 0, w, h);
  return cx.getImageData(0, 0, w, h);
}

function renderInWorker(
  source: ImageData,
  stack: SerializableLayer[]
): Promise<{ data: Uint8ClampedArray; recomputed: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../../worker/renderWorker.ts', import.meta.url));
    let settled = false;
    const fail = (m: string) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error(m));
    };
    worker.onerror = e => fail('worker.onerror: ' + (e.message || 'unknown'));
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'sourceSet') {
        worker.postMessage({ type: 'render', id: 1, layers: stack });
      } else if (m.type === 'rendered') {
        settled = true;
        const data = new Uint8ClampedArray(m.buffer);
        worker.terminate();
        resolve({ data, recomputed: m.recomputed });
      } else if (m.type === 'error') {
        fail('worker reported: ' + m.error);
      }
    };
    const copy = source.data.slice();
    worker.postMessage(
      { type: 'setSource', width: source.width, height: source.height, buffer: copy.buffer },
      [copy.buffer]
    );
  });
}

export default function WorkerDevtest() {
  const [report, setReport] = useState<Report>({ status: 'running…' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const source = await loadSourceImageData('/studio-sample.jpg');

        // Main thread
        const mainImg = new ImageData(
          new Uint8ClampedArray(source.data),
          source.width,
          source.height
        );
        const t0 = performance.now();
        const specs = await buildSpecs(STACK);
        new PrefixRenderCache().render(mainImg, specs);
        const mainMs = performance.now() - t0;

        // Worker
        const t1 = performance.now();
        const { data: workerData, recomputed } = await renderInWorker(source, STACK);
        const workerMs = performance.now() - t1;

        const a = mainImg.data;
        const b = workerData;
        let maxDiff = 0;
        let diffCount = 0;
        for (let i = 0; i < a.length; i++) {
          const d = Math.abs(a[i] - b[i]);
          if (d > 0) {
            diffCount++;
            if (d > maxDiff) maxDiff = d;
          }
        }
        setReport({
          status: maxDiff === 0 ? 'PASS — byte-identical' : 'FAIL — diverged',
          maxDiff,
          diffCount,
          totalBytes: a.length,
          dims: `${source.width}x${source.height}`,
          mainMs: Math.round(mainMs),
          workerMs: Math.round(workerMs),
          workerRecomputed: recomputed,
        });
      } catch (e) {
        setReport({ status: 'ERROR', error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  const color = report.status.startsWith('PASS')
    ? '#5fd17a'
    : report.status.startsWith('running')
      ? '#eceae3'
      : '#f53001';

  return (
    <div
      style={{
        fontFamily: 'monospace',
        padding: 24,
        color: '#eceae3',
        background: '#0b0b0c',
        minHeight: '100vh',
      }}
    >
      <h1 data-testid="status" style={{ color }}>
        worker == main: {report.status}
      </h1>
      <pre data-testid="report">{JSON.stringify(report, null, 2)}</pre>
      <p style={{ color: '#8b8780', maxWidth: 640 }}>
        Renders {STACK.map(s => s.effectId).join(' → ')} on the main thread and in the render
        worker, then diffs the bytes. maxDiff 0 = the worker is byte-identical, so wiring it into
        the live path cannot change a pixel.
      </p>
    </div>
  );
}
