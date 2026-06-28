/**
 * renderStack — the ONE source of truth for turning a serializable effect stack
 * into pixels. Imported by BOTH the main thread (ImageEditor) and the render
 * worker, so the two produce byte-identical output by construction (the
 * preview == export + goldenEffects determinism invariants depend on this).
 *
 * Worker-safety: this module imports only `../effects` (which lazy-loads Konva —
 * Konva's filter functions run without a DOM, verified) plus the pure
 * PrefixRenderCache. It does NOT touch the DOM at module load, so it can be
 * imported inside a Web Worker.
 */

import { applyEffect } from '../effects';
import { PrefixRenderCache } from '../performance/LayerPipeline';
import type { LayerSpec, PipelineImage, PipelineFilter } from '../performance/LayerPipeline';

/** A layer as it crosses a postMessage boundary — no closures, fully serializable. */
export interface SerializableLayer {
  effectId: string;
  settings: Record<string, number>;
  opacity?: number;
  visible?: boolean;
}

export type ClosureResult = [PipelineFilter | null, Record<string, number> | null];

/**
 * Reconstruct each layer's filter closure via applyEffect and assemble the
 * LayerSpec array. `closureCache` (optional) memoizes built closures keyed by
 * effectId+settings, exactly like ImageEditor's effectCacheRef did.
 *
 * The spec `sig` matches ImageEditor's previous inline format
 * (`${effectId}:${JSON.stringify(settings)}|o${opacity}`) so prefix-cache keys
 * are identical whichever caller built them.
 */
export async function buildSpecs(
  layers: SerializableLayer[],
  closureCache?: Map<string, ClosureResult>
): Promise<LayerSpec[]> {
  const specs: LayerSpec[] = [];
  for (const layer of layers) {
    if (layer.visible === false || !layer.effectId) continue;
    const settings = (layer.settings || {}) as Record<string, number>;
    const cacheKey = `${layer.effectId}:${JSON.stringify(settings)}`;

    let cached = closureCache?.get(cacheKey);
    if (!cached) {
      cached = (await applyEffect(layer.effectId, settings)) as unknown as ClosureResult;
      closureCache?.set(cacheKey, cached);
    }

    const [filter, params] = cached;
    if (!filter) continue;
    const opacity = layer.opacity ?? 1;
    specs.push({
      sig: `${cacheKey}|o${opacity}`,
      effectId: layer.effectId,
      filter,
      params: (params || {}) as Record<string, number>,
      opacity,
    });
  }
  return specs;
}

/**
 * Render `layers` into `img` IN PLACE through a prefix cache, reusing the
 * longest cached prefix. Returns the number of layers actually recomputed.
 */
export async function renderStackInto(
  img: PipelineImage,
  layers: SerializableLayer[],
  prefixCache: PrefixRenderCache,
  closureCache?: Map<string, ClosureResult>
): Promise<number> {
  const specs = await buildSpecs(layers, closureCache);
  return prefixCache.render(img, specs);
}
