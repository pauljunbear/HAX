import { sampleBilinear, warpImage } from '../sampling';

// 2x2: (0,0)=red (1,0)=green (0,1)=blue (1,1)=white
function img2x2(): Uint8ClampedArray {
  return new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
  ]);
}

describe('sampleBilinear', () => {
  it('returns the exact pixel at integer coords', () => {
    const d = img2x2();
    const out = new Uint8ClampedArray(4);
    sampleBilinear(d, 2, 2, 1, 0, out);
    expect(Array.from(out)).toEqual([0, 255, 0, 255]); // green
  });

  it('averages the four corners at the center', () => {
    const d = img2x2();
    const out = new Uint8ClampedArray(4);
    sampleBilinear(d, 2, 2, 0.5, 0.5, out);
    expect(out[0]).toBe(128);
    expect(out[1]).toBe(128);
    expect(out[2]).toBe(128);
    expect(out[3]).toBe(255);
  });

  it('clamps out-of-bounds coords to the edge', () => {
    const d = img2x2();
    const out = new Uint8ClampedArray(4);
    sampleBilinear(d, 2, 2, -5, -5, out);
    expect(Array.from(out)).toEqual([255, 0, 0, 255]); // top-left red
  });

  it('interpolates linearly along an edge', () => {
    const d = img2x2();
    const out = new Uint8ClampedArray(4);
    sampleBilinear(d, 2, 2, 0.5, 0, out); // halfway red→green
    expect(out[0]).toBe(128);
    expect(out[1]).toBe(128);
    expect(out[2]).toBe(0);
  });
});

describe('warpImage', () => {
  it('identity map reproduces the image', () => {
    const d = img2x2();
    const out = warpImage(d, 2, 2, (x, y) => [x, y]);
    expect(Array.from(out)).toEqual(Array.from(d));
  });

  it('transparent mode zeroes alpha for out-of-bounds source', () => {
    const d = img2x2();
    // map everything off-image
    const out = warpImage(d, 2, 2, () => [-10, -10], 'transparent');
    for (let i = 0; i < out.length; i += 4) expect(out[i + 3]).toBe(0);
  });
});
