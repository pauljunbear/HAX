/**
 * BufferPool - Reusable buffer management for image processing
 *
 * Prevents excessive garbage collection by reusing Uint8ClampedArray buffers
 * during effect processing operations.
 */

interface PooledBuffer {
  buffer: Uint8ClampedArray;
  lastUsed: number;
}

export class BufferPool {
  private pools = new Map<number, PooledBuffer[]>();
  private maxPoolSize = 4; // Max buffers per size
  private maxIdleTime = 30000; // 30 seconds before cleanup

  /**
   * Acquire a buffer of the specified size
   * Returns a recycled buffer if available, otherwise creates a new one
   */
  acquire(size: number): Uint8ClampedArray {
    const pool = this.pools.get(size);

    if (pool && pool.length > 0) {
      const pooledBuffer = pool.pop()!;
      // Zero out the buffer for clean state
      pooledBuffer.buffer.fill(0);
      return pooledBuffer.buffer;
    }

    return new Uint8ClampedArray(size);
  }

  /**
   * Release a buffer back to the pool for reuse
   */
  release(buffer: Uint8ClampedArray): void {
    const size = buffer.length;

    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    const pool = this.pools.get(size)!;

    // Only keep up to maxPoolSize buffers per size
    if (pool.length < this.maxPoolSize) {
      pool.push({
        buffer,
        lastUsed: Date.now(),
      });
    }
    // Otherwise, let garbage collector handle it
  }

  /**
   * Acquire a buffer and copy data from source
   */
  acquireFrom(source: Uint8ClampedArray): Uint8ClampedArray {
    const buffer = this.acquire(source.length);
    buffer.set(source);
    return buffer;
  }

  /**
   * Clean up old unused buffers
   */
  cleanup(): void {
    const now = Date.now();

    for (const [size, pool] of this.pools.entries()) {
      const filtered = pool.filter(pb => now - pb.lastUsed < this.maxIdleTime);

      if (filtered.length === 0) {
        this.pools.delete(size);
      } else {
        this.pools.set(size, filtered);
      }
    }
  }

  /**
   * Clear all pooled buffers
   */
  clear(): void {
    this.pools.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): { totalBuffers: number; totalMemory: number; poolSizes: number[] } {
    let totalBuffers = 0;
    let totalMemory = 0;
    const poolSizes: number[] = [];

    for (const [size, pool] of this.pools.entries()) {
      totalBuffers += pool.length;
      totalMemory += size * pool.length;
      poolSizes.push(size);
    }

    return { totalBuffers, totalMemory, poolSizes };
  }
}

// Singleton instance
let bufferPoolInstance: BufferPool | null = null;

export function getBufferPool(): BufferPool {
  if (!bufferPoolInstance) {
    bufferPoolInstance = new BufferPool();

    // Set up periodic cleanup (every 60 seconds)
    if (typeof window !== 'undefined') {
      setInterval(() => {
        bufferPoolInstance?.cleanup();
      }, 60000);
    }
  }
  return bufferPoolInstance;
}

/**
 * Helper function to run an effect with pooled buffers
 */
export function withPooledBuffer<T>(size: number, callback: (buffer: Uint8ClampedArray) => T): T {
  const pool = getBufferPool();
  const buffer = pool.acquire(size);

  try {
    return callback(buffer);
  } finally {
    pool.release(buffer);
  }
}

/**
 * Helper to copy data using pooled buffer
 */
export function copyWithPool(source: Uint8ClampedArray): {
  copy: Uint8ClampedArray;
  release: () => void;
} {
  const pool = getBufferPool();
  const copy = pool.acquireFrom(source);

  return {
    copy,
    release: () => pool.release(copy),
  };
}
