/// <reference lib="webworker" />
/**
 * renderWorker — runs the effect stack OFF the main thread.
 *
 * It imports the SAME `renderStack` module the main thread uses, so its output
 * is byte-identical (verified by /devtest/worker). It owns the rasterized
 * source plus a PrefixRenderCache, so editing layer k recomputes only [k..N],
 * and returns the processed pixels as a TRANSFERABLE ArrayBuffer (zero-copy).
 *
 * Konva's filter functions run without a DOM (Konva.isBrowser === false), so
 * Konva built-ins (contrast/HSL/blur/…) work here too. Custom seeded effects
 * (film, grain, pro) are deterministic from settings.seed.
 */

import { renderStackInto } from '../lib/effects/renderStack';
import type { SerializableLayer, ClosureResult } from '../lib/effects/renderStack';
import { PrefixRenderCache } from '../lib/performance/LayerPipeline';

type SetSourceMsg = { type: 'setSource'; width: number; height: number; buffer: ArrayBuffer };
type RenderMsg = { type: 'render'; id: number; layers: SerializableLayer[] };
type InMsg = SetSourceMsg | RenderMsg;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let source: { data: Uint8ClampedArray; width: number; height: number } | null = null;
const prefixCache = new PrefixRenderCache();
const closureCache = new Map<string, ClosureResult>();

ctx.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  if (msg.type === 'setSource') {
    source = {
      data: new Uint8ClampedArray(msg.buffer),
      width: msg.width,
      height: msg.height,
    };
    prefixCache.clear();
    ctx.postMessage({ type: 'sourceSet', width: msg.width, height: msg.height });
    return;
  }

  if (msg.type === 'render') {
    if (!source) {
      ctx.postMessage({ type: 'error', id: msg.id, error: 'render before setSource' });
      return;
    }
    try {
      // Render into a COPY so the source survives for the next edit.
      const data = new Uint8ClampedArray(source.data);
      const img = { data, width: source.width, height: source.height };
      const recomputed = await renderStackInto(img, msg.layers, prefixCache, closureCache);
      ctx.postMessage(
        {
          type: 'rendered',
          id: msg.id,
          width: img.width,
          height: img.height,
          recomputed,
          buffer: data.buffer,
        },
        [data.buffer]
      );
    } catch (err) {
      ctx.postMessage({
        type: 'error',
        id: msg.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
