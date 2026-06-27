import { BufferPool } from '../BufferPool';

describe('BufferPool clear semantics', () => {
  test('recycled buffer is zeroed when clear=true (default)', () => {
    const pool = new BufferPool();
    const a = pool.acquire(16);
    a.fill(200);
    pool.release(a);
    const b = pool.acquire(16); // same size -> recycled
    expect(b).toBe(a); // reused instance
    expect(Array.from(b)).toEqual(new Array(16).fill(0));
  });

  test('recycled buffer is NOT zeroed when clear=false (caller overwrites)', () => {
    const pool = new BufferPool();
    const a = pool.acquire(16);
    a.fill(200);
    pool.release(a);
    const b = pool.acquire(16, false);
    expect(b).toBe(a);
    expect(b[0]).toBe(200); // dirty, as intended (cheaper)
  });

  test('acquireFrom copies source exactly and reuses the pool', () => {
    const pool = new BufferPool();
    const scratch = pool.acquire(8);
    scratch.fill(255);
    pool.release(scratch);
    const src = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
    const got = pool.acquireFrom(src);
    expect(got).toBe(scratch); // reused, not freshly allocated
    expect(Array.from(got)).toEqual(Array.from(src)); // overwritten, no stale 255s
  });
});
