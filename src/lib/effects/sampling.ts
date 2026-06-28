/**
 * Bilinear sampling for geometric warps. The audit found the engine has NO
 * bilinear sampler — every warp (swirl, kaleidoscope, fisheye, spherize, wave,
 * shatter, dispersion) point-samples with Math.round/floor, which stair-steps
 * edges and visibly "damages" the image. Backward-mapping each warp through this
 * sampler removes the jaggies for a localized, shared cost.
 *
 * Convention: warps are BACKWARD-mapped — for each destination pixel you compute
 * the source coordinate it pulls from, then bilinearly sample there. (Forward
 * mapping, which the old pixelExplosion used, leaves holes.)
 */

/** Bilinearly sample RGBA at fractional (x,y) into out[outOffset..+3]. Edges clamp. */
export function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  out: Uint8ClampedArray,
  outOffset = 0
): void {
  if (x < 0) x = 0;
  else if (x > width - 1) x = width - 1;
  if (y < 0) y = 0;
  else if (y > height - 1) y = height - 1;

  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < width ? x0 + 1 : x0;
  const y1 = y0 + 1 < height ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  for (let c = 0; c < 4; c++) {
    out[outOffset + c] =
      data[i00 + c] * w00 + data[i10 + c] * w10 + data[i01 + c] * w01 + data[i11 + c] * w11 + 0.5;
  }
}

/**
 * Backward-map an RGBA image through `map(dx,dy) -> [sx,sy]` with bilinear
 * sampling. Returns a NEW buffer (does not mutate src). `outside` decides what a
 * source coordinate beyond the image yields: 'clamp' (default) samples the edge,
 * 'transparent' leaves the pixel transparent (alpha 0).
 */
export function warpImage(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  map: (dx: number, dy: number) => [number, number],
  outside: 'clamp' | 'transparent' = 'clamp'
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const di = (dy * width + dx) * 4;
      const [sx, sy] = map(dx, dy);
      if (outside === 'transparent' && (sx < 0 || sx > width - 1 || sy < 0 || sy > height - 1)) {
        dst[di + 3] = 0;
        continue;
      }
      sampleBilinear(src, width, height, sx, sy, dst, di);
    }
  }
  return dst;
}
