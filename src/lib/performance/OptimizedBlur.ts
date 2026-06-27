/**
 * OptimizedBlur - High-performance separable Gaussian blur
 *
 * Uses separable convolution (2D blur = horizontal 1D + vertical 1D)
 * This reduces complexity from O(n² × r²) to O(n² × 2r)
 * For a 50px radius: ~2500x operations → ~100x operations per pixel
 */

import { getBufferPool } from './BufferPool';
import { SRGB_TO_LINEAR, linearToSrgbByte } from '../effects/color-space';

/**
 * Pre-computed Gaussian kernel cache
 */
const kernelCache = new Map<string, Float32Array>();

/**
 * Create a 1D Gaussian kernel
 */
function createGaussianKernel(radius: number, sigma?: number): Float32Array {
  const key = `${radius}-${sigma ?? 'auto'}`;

  if (kernelCache.has(key)) {
    return kernelCache.get(key)!;
  }

  const actualSigma = sigma ?? radius / 3;
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const value = Math.exp(-(x * x) / (2 * actualSigma * actualSigma));
    kernel[i] = value;
    sum += value;
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  // Cache (limit cache size)
  if (kernelCache.size > 50) {
    const firstKey = kernelCache.keys().next().value;
    if (firstKey) kernelCache.delete(firstKey);
  }
  kernelCache.set(key, kernel);

  return kernel;
}

/**
 * Apply separable Gaussian blur (in-place capable)
 *
 * @param data - Source image data (will be modified)
 * @param width - Image width
 * @param height - Image height
 * @param radius - Blur radius (1-100)
 * @param sigma - Optional sigma value (defaults to radius/3)
 */
export function separableGaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  sigma?: number
): void {
  if (radius <= 0 || width === 0 || height === 0) return;

  // Clamp radius to reasonable bounds
  const clampedRadius = Math.min(Math.max(1, Math.floor(radius)), 100);
  const kernel = createGaussianKernel(clampedRadius, sigma);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);

  const pool = getBufferPool();
  const temp = pool.acquire(data.length, false); // horizontal pass fills temp fully before the vertical pass reads it

  try {
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const sampleX = Math.min(width - 1, Math.max(0, x + i - halfKernel));
          const idx = (y * width + sampleX) * 4;
          const weight = kernel[i];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
          a += data[idx + 3] * weight;
          weightSum += weight;
        }

        const outIdx = (y * width + x) * 4;
        temp[outIdx] = r / weightSum;
        temp[outIdx + 1] = g / weightSum;
        temp[outIdx + 2] = b / weightSum;
        temp[outIdx + 3] = a / weightSum;
      }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const sampleY = Math.min(height - 1, Math.max(0, y + i - halfKernel));
          const idx = (sampleY * width + x) * 4;
          const weight = kernel[i];

          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
          weightSum += weight;
        }

        const outIdx = (y * width + x) * 4;
        data[outIdx] = r / weightSum;
        data[outIdx + 1] = g / weightSum;
        data[outIdx + 2] = b / weightSum;
        data[outIdx + 3] = a / weightSum;
      }
    }
  } finally {
    pool.release(temp);
  }
}

/**
 * Apply separable Gaussian blur returning new buffer
 */
export function separableGaussianBlurCopy(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  sigma?: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data);
  separableGaussianBlur(result, width, height, radius, sigma);
  return result;
}

/**
 * Fast box blur (even faster, lower quality)
 * Uses running sum technique for O(1) per pixel regardless of radius
 */
export function fastBoxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  if (radius <= 0 || width === 0 || height === 0) return;

  const clampedRadius = Math.min(Math.max(1, Math.floor(radius)), 100);
  const pool = getBufferPool();
  const temp = pool.acquire(data.length, false); // horizontal pass fills temp fully before the vertical pass reads it

  try {
    // Horizontal pass using running sum
    for (let y = 0; y < height; y++) {
      // Initialize running sums for first pixel
      let sumR = 0,
        sumG = 0,
        sumB = 0,
        sumA = 0;
      let count = 0;

      // Fill initial window
      for (let i = -clampedRadius; i <= clampedRadius; i++) {
        const x = Math.max(0, Math.min(width - 1, i));
        const idx = (y * width + x) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        sumA += data[idx + 3];
        count++;
      }

      // Process each pixel
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;
        temp[outIdx] = sumR / count;
        temp[outIdx + 1] = sumG / count;
        temp[outIdx + 2] = sumB / count;
        temp[outIdx + 3] = sumA / count;

        // Slide window. removeX/addX are already clamped to the edges
        // (extend-boundary), so the shed/add must ALWAYS run to keep the
        // window at exactly `count` = 2r+1 samples. The previous `if`
        // guards skipped the shed at the left edge and the add at the right
        // edge while count stayed fixed, leaving r duplicate copies of the
        // first pixel permanently in the running sum -> a uniform additive
        // brightness bias of +r*p0/(2r+1) across the whole row/column.
        const removeX = Math.max(0, x - clampedRadius);
        const addX = Math.min(width - 1, x + clampedRadius + 1);

        const removeIdx = (y * width + removeX) * 4;
        sumR -= data[removeIdx];
        sumG -= data[removeIdx + 1];
        sumB -= data[removeIdx + 2];
        sumA -= data[removeIdx + 3];

        const addIdx = (y * width + addX) * 4;
        sumR += data[addIdx];
        sumG += data[addIdx + 1];
        sumB += data[addIdx + 2];
        sumA += data[addIdx + 3];
      }
    }

    // Vertical pass using running sum
    for (let x = 0; x < width; x++) {
      let sumR = 0,
        sumG = 0,
        sumB = 0,
        sumA = 0;
      let count = 0;

      // Fill initial window
      for (let i = -clampedRadius; i <= clampedRadius; i++) {
        const y = Math.max(0, Math.min(height - 1, i));
        const idx = (y * width + x) * 4;
        sumR += temp[idx];
        sumG += temp[idx + 1];
        sumB += temp[idx + 2];
        sumA += temp[idx + 3];
        count++;
      }

      // Process each pixel
      for (let y = 0; y < height; y++) {
        const outIdx = (y * width + x) * 4;
        data[outIdx] = sumR / count;
        data[outIdx + 1] = sumG / count;
        data[outIdx + 2] = sumB / count;
        data[outIdx + 3] = sumA / count;

        // Slide window. Always shed/add the clamped (extend-boundary)
        // samples so the window stays at `count` = 2r+1 - see the
        // horizontal pass for why the guards were a bug.
        const removeY = Math.max(0, y - clampedRadius);
        const removeIdx = (removeY * width + x) * 4;
        sumR -= temp[removeIdx];
        sumG -= temp[removeIdx + 1];
        sumB -= temp[removeIdx + 2];
        sumA -= temp[removeIdx + 3];

        const addY = Math.min(height - 1, y + clampedRadius + 1);
        const addIdx = (addY * width + x) * 4;
        sumR += temp[addIdx];
        sumG += temp[addIdx + 1];
        sumB += temp[addIdx + 2];
        sumA += temp[addIdx + 3];
      }
    }
  } finally {
    pool.release(temp);
  }
}

/**
 * Stack blur - fast approximation of Gaussian blur
 * Quality between box blur and true Gaussian
 */
export function stackBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  // For small radii, use true Gaussian
  if (radius <= 3) {
    separableGaussianBlur(data, width, height, radius);
    return;
  }

  // For larger radii, use multiple box blur passes (3 passes ≈ Gaussian).
  // Derive the box radius from the SAME target sigma the Gaussian path uses
  // (sigma = radius/3). Kovesi/Wells: ideal box width w = sqrt(12*sigma^2/n + 1),
  // boxRadius = (w-1)/2. The old radius/sqrt(3) over-blurred ~1.7x and jumped
  // discontinuously the moment radius crossed 3.
  const passes = 3;
  const sigma = radius / 3;
  const idealWidth = Math.sqrt((12 * sigma * sigma) / passes + 1);
  const boxRadius = Math.max(1, Math.round((idealWidth - 1) / 2));

  for (let i = 0; i < passes; i++) {
    fastBoxBlur(data, width, height, boxRadius);
  }
}

/**
 * Separable Gaussian blur over a Float32 RGBA buffer (in-place).
 * Used by the linear-light blur path; identical structure to the byte version
 * but keeps full precision so linear values aren't crushed into 8 bits.
 */
export function separableGaussianBlurF32(
  data: Float32Array,
  width: number,
  height: number,
  radius: number,
  sigma?: number
): void {
  if (radius <= 0 || width === 0 || height === 0) return;
  const clampedRadius = Math.min(Math.max(1, Math.floor(radius)), 100);
  const kernel = createGaussianKernel(clampedRadius, sigma);
  const k = kernel.length;
  const half = k >> 1;
  const temp = new Float32Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        ws = 0;
      for (let i = 0; i < k; i++) {
        const sx = Math.min(width - 1, Math.max(0, x + i - half));
        const idx = (y * width + sx) * 4;
        const w = kernel[i];
        r += data[idx] * w;
        g += data[idx + 1] * w;
        b += data[idx + 2] * w;
        a += data[idx + 3] * w;
        ws += w;
      }
      const o = (y * width + x) * 4;
      temp[o] = r / ws;
      temp[o + 1] = g / ws;
      temp[o + 2] = b / ws;
      temp[o + 3] = a / ws;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        ws = 0;
      for (let i = 0; i < k; i++) {
        const sy = Math.min(height - 1, Math.max(0, y + i - half));
        const idx = (sy * width + x) * 4;
        const w = kernel[i];
        r += temp[idx] * w;
        g += temp[idx + 1] * w;
        b += temp[idx + 2] * w;
        a += temp[idx + 3] * w;
        ws += w;
      }
      const o = (y * width + x) * 4;
      data[o] = r / ws;
      data[o + 1] = g / ws;
      data[o + 2] = b / ws;
      data[o + 3] = a / ws;
    }
  }
}

/**
 * Gaussian blur performed in LINEAR light, in place on an sRGB byte buffer.
 * Decodes RGB to linear, blurs (energy-correct spreading), re-encodes. This is
 * the physically-correct way to spread light for bloom / glow / halation: a
 * gamma-space blur darkens bright spreads and produces muddy halos.
 * Allocates one transient Float32 buffer; freed on return.
 */
export function gaussianBlurLinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  sigma?: number
): void {
  if (radius <= 0 || width === 0 || height === 0) return;
  const lin = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    lin[i] = SRGB_TO_LINEAR[data[i]];
    lin[i + 1] = SRGB_TO_LINEAR[data[i + 1]];
    lin[i + 2] = SRGB_TO_LINEAR[data[i + 2]];
    lin[i + 3] = data[i + 3] / 255;
  }
  separableGaussianBlurF32(lin, width, height, radius, sigma);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = linearToSrgbByte(lin[i]);
    data[i + 1] = linearToSrgbByte(lin[i + 1]);
    data[i + 2] = linearToSrgbByte(lin[i + 2]);
    data[i + 3] = Math.round(lin[i + 3] * 255);
  }
}

/**
 * Selective blur - only blur pixels that meet a condition
 * Useful for edge-preserving blur
 */
export function selectiveBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  condition: (r: number, g: number, b: number, x: number, y: number) => boolean
): void {
  const pool = getBufferPool();
  const original = pool.acquireFrom(data);

  try {
    separableGaussianBlur(data, width, height, radius);

    // Restore pixels that don't meet condition
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        if (!condition(original[idx], original[idx + 1], original[idx + 2], x, y)) {
          data[idx] = original[idx];
          data[idx + 1] = original[idx + 1];
          data[idx + 2] = original[idx + 2];
          data[idx + 3] = original[idx + 3];
        }
      }
    }
  } finally {
    pool.release(original);
  }
}
