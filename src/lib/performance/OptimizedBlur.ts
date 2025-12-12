/**
 * OptimizedBlur - High-performance separable Gaussian blur
 *
 * Uses separable convolution (2D blur = horizontal 1D + vertical 1D)
 * This reduces complexity from O(n² × r²) to O(n² × 2r)
 * For a 50px radius: ~2500x operations → ~100x operations per pixel
 */

import { getBufferPool } from './BufferPool';

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
    kernelCache.delete(firstKey);
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
  const temp = pool.acquire(data.length);

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
  const temp = pool.acquire(data.length);

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

        // Slide window
        const removeX = Math.max(0, x - clampedRadius);
        const addX = Math.min(width - 1, x + clampedRadius + 1);

        if (x - clampedRadius >= 0) {
          const removeIdx = (y * width + removeX) * 4;
          sumR -= data[removeIdx];
          sumG -= data[removeIdx + 1];
          sumB -= data[removeIdx + 2];
          sumA -= data[removeIdx + 3];
        }

        if (x + clampedRadius + 1 < width) {
          const addIdx = (y * width + addX) * 4;
          sumR += data[addIdx];
          sumG += data[addIdx + 1];
          sumB += data[addIdx + 2];
          sumA += data[addIdx + 3];
        }
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

        // Slide window
        if (y - clampedRadius >= 0) {
          const removeY = y - clampedRadius;
          const removeIdx = (removeY * width + x) * 4;
          sumR -= temp[removeIdx];
          sumG -= temp[removeIdx + 1];
          sumB -= temp[removeIdx + 2];
          sumA -= temp[removeIdx + 3];
        }

        if (y + clampedRadius + 1 < height) {
          const addY = y + clampedRadius + 1;
          const addIdx = (addY * width + x) * 4;
          sumR += temp[addIdx];
          sumG += temp[addIdx + 1];
          sumB += temp[addIdx + 2];
          sumA += temp[addIdx + 3];
        }
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

  // For larger radii, use multiple box blur passes (3 passes ≈ Gaussian)
  const passes = 3;
  const boxRadius = Math.round(radius / Math.sqrt(passes));

  for (let i = 0; i < passes; i++) {
    fastBoxBlur(data, width, height, boxRadius);
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
