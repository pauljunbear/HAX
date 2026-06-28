'use client';

/**
 * RenderWorkerClient — main-thread handle to the render worker.
 *
 * Off by default: enable at runtime with localStorage.setItem('hax:worker','1').
 * The worker runs the SAME renderStack module as the main thread (byte-identical,
 * verified at /devtest/worker), so turning it on cannot change a pixel — it only
 * moves the CPU pixel work off the main thread so heavy stacks don't freeze the UI.
 *
 * The worker holds the rasterized source; setSource re-sends only when the source
 * key (image + dimensions) changes, so a stack edit reuses the worker's prefix
 * cache. Any failure is surfaced so the caller can fall back to the main thread.
 */

import type { SerializableLayer } from './renderStack';

export function workerEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('hax:worker') === '1';
  } catch {
    return false;
  }
}

export interface RenderResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  recomputed: number;
}

export class RenderWorkerClient {
  private worker: Worker | null = null;
  private broken = false;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (r: RenderResult) => void; reject: (e: Error) => void }
  >();
  private sourceKey = '';
  private sourceReady: Promise<void> | null = null;
  private sourceResolve: (() => void) | null = null;

  private ensure(): Worker | null {
    if (this.broken) return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('../../worker/renderWorker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (!m) return;
        if (m.type === 'sourceSet') {
          this.sourceResolve?.();
          this.sourceResolve = null;
        } else if (m.type === 'rendered') {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            p.resolve({
              data: new Uint8ClampedArray(m.buffer),
              width: m.width,
              height: m.height,
              recomputed: m.recomputed,
            });
          }
        } else if (m.type === 'error' && m.id != null) {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            p.reject(new Error(m.error || 'worker error'));
          }
        }
      };
      w.onerror = () => {
        this.broken = true;
        this.failAll(new Error('worker crashed'));
      };
      this.worker = w;
      return w;
    } catch {
      this.broken = true;
      return null;
    }
  }

  private failAll(e: Error) {
    for (const p of this.pending.values()) p.reject(e);
    this.pending.clear();
  }

  isBroken(): boolean {
    return this.broken;
  }

  /** Ensure the worker holds `source` for `key`; only re-sends when the key changes. */
  setSource(key: string, source: ImageData): Promise<void> {
    const w = this.ensure();
    if (!w) return Promise.reject(new Error('no worker'));
    if (key === this.sourceKey && this.sourceReady) return this.sourceReady;
    this.sourceKey = key;
    const copy = source.data.slice(); // transfer a copy so the caller keeps its ImageData
    this.sourceReady = new Promise<void>(resolve => {
      this.sourceResolve = resolve;
    });
    w.postMessage(
      { type: 'setSource', width: source.width, height: source.height, buffer: copy.buffer },
      [copy.buffer]
    );
    return this.sourceReady;
  }

  async render(layers: SerializableLayer[]): Promise<RenderResult> {
    const w = this.ensure();
    if (!w) throw new Error('no worker');
    if (this.sourceReady) await this.sourceReady;
    const id = this.nextId++;
    return new Promise<RenderResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ type: 'render', id, layers });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new Error('terminated'));
    this.sourceKey = '';
    this.sourceReady = null;
    this.sourceResolve = null;
  }
}
