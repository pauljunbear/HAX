/**
 * LayerPipeline - prefix-cached effect-stack renderer.
 *
 * The live editor previously handed the whole filter chain to Konva's
 * node.cache(), which re-runs EVERY layer's pixel loop on every slider tick.
 * This pipeline runs the stack as a single composite filter and caches the
 * cumulative ImageData after each layer, keyed by the signature of the layers
 * applied so far (plus the buffer dimensions). Editing layer k then reuses the
 * cached result of layers [0..k-1] and only recomputes [k..N].
 *
 * Correctness is byte-identical by construction: reusing a cached prefix is the
 * same bytes as recomputing it (proven by the cached == uncached test). Konva
 * still owns rasterisation and display, so this is a contained change.
 */

export interface PipelineImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// A filter mutates the image in place. Custom effects are closures (ignore
// `this`); Konva built-ins read params via getter functions on `this`.
export type PipelineFilter = (img: PipelineImage) => void;

export interface LayerSpec {
  /** Stable identity of this layer (effectId + serialized settings). */
  sig: string;
  /** Effect id, used to route a layer to the GPU path when supported. */
  effectId?: string;
  filter: PipelineFilter;
  /** Params for Konva built-in filters (empty for custom closures). */
  params: Record<string, number>;
}

/**
 * A `this` for Konva built-in filters, exposing each param as a getter
 * function (e.g. this.brightness()). Missing params default to 0, matching the
 * old behaviour where node filter props were reset to 0 before each render.
 */
export function filterThis(params: Record<string, number>): unknown {
  return new Proxy(
    {},
    {
      get: (_t, prop) => () => (typeof prop === 'string' ? (params[prop] ?? 0) : 0),
    }
  );
}

/** Apply one layer's filter to the image in place. */
export function applyLayer(img: PipelineImage, spec: LayerSpec): void {
  spec.filter.call(filterThis(spec.params), img);
}

function cloneImage(img: PipelineImage): PipelineImage {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
}

export class PrefixRenderCache {
  private cache = new Map<string, PipelineImage>();
  private readonly max: number;

  constructor(max = 12) {
    this.max = max;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // LRU touch: re-insert so most-recently-used is last; evict oldest over cap.
  private touch(key: string, val: PipelineImage): void {
    this.cache.delete(key);
    this.cache.set(key, val);
    while (this.cache.size > this.max) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  /**
   * Apply `specs` to `source` IN PLACE (Konva expects the passed ImageData to
   * be mutated), reusing the longest cached matching prefix. Returns the number
   * of layers actually recomputed (0 == fully cached) for tests/metrics.
   */
  render(source: PipelineImage, specs: LayerSpec[]): number {
    const dimsKey = `${source.width}x${source.height}`;

    // Walk forward while each next prefix is cached.
    let prefixSig = dimsKey;
    let start = 0;
    let startImage: PipelineImage | null = null;
    for (let k = 0; k < specs.length; k++) {
      const sig = `${prefixSig}|${specs[k].sig}`;
      const hit = this.cache.get(sig);
      if (!hit) break;
      prefixSig = sig;
      start = k + 1;
      startImage = hit;
      this.touch(sig, hit);
    }

    // Start from the cached prefix (if any), else from the raw source.
    if (startImage) source.data.set(startImage.data);

    let recomputed = 0;
    for (let k = start; k < specs.length; k++) {
      applyLayer(source, specs[k]);
      recomputed++;
      prefixSig = `${prefixSig}|${specs[k].sig}`;
      this.touch(prefixSig, cloneImage(source));
    }
    return recomputed;
  }

  /** Full recompute with no caching - for equivalence testing. */
  renderUncached(source: PipelineImage, specs: LayerSpec[]): void {
    for (const spec of specs) applyLayer(source, spec);
  }
}
