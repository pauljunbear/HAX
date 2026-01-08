'use client';

/**
 * Effect Utilities
 * Shared helper functions for pixel manipulation and math operations
 */

import { getBufferPool } from '../performance';

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Generic clamp function
 */
export const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

/**
 * Fast byte clamping (0-255) - optimized for hot paths
 * Uses bitwise operations for speed when possible
 */
export const clampByte = (value: number): number => {
  return value < 0 ? 0 : value > 255 ? 255 : value | 0;
};

/**
 * Linear interpolation
 */
export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Luminance calculation using standard coefficients (ITU-R BT.601)
 */
export const getLuminance = (r: number, g: number, b: number): number => {
  return r * 0.299 + g * 0.587 + b * 0.114;
};

/**
 * Normalized luminance (0-1)
 */
export const getNormalizedLuminance = (r: number, g: number, b: number): number => {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
};

/**
 * Convert HSL to RGB
 */
export const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

/**
 * Convert RGB to HSL
 */
export const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
};

// ============================================================================
// BLEND MODES
// ============================================================================

/**
 * Screen blend mode
 */
export const screenBlend = (base: number, overlay: number): number =>
  255 - ((255 - base) * (255 - overlay)) / 255;

/**
 * Overlay blend mode
 */
export const overlayBlend = (base: number, overlay: number): number =>
  base < 128 ? (2 * base * overlay) / 255 : 255 - (2 * (255 - base) * (255 - overlay)) / 255;

/**
 * Soft light blend mode
 */
export const softLightBlend = (base: number, overlay: number): number => {
  const normalizedOverlay = overlay / 255;
  return Math.round(
    base * (1 - normalizedOverlay) +
      (base < 128
        ? (2 * normalizedOverlay - 1) * (base / 255) * base + base
        : (2 * normalizedOverlay - 1) * (Math.sqrt(base / 255) - base / 255) * 255 + base)
  );
};

/**
 * Multiply blend mode
 */
export const multiplyBlend = (base: number, overlay: number): number => (base * overlay) / 255;

/**
 * Add blend mode (linear dodge)
 */
export const addBlend = (base: number, overlay: number): number => Math.min(255, base + overlay);

// ============================================================================
// BUFFER UTILITIES
// ============================================================================

/**
 * Get buffer from pool or create new one
 * Always use this instead of `new Uint8ClampedArray(size)`
 */
export const acquireBuffer = (size: number): Uint8ClampedArray => {
  return getBufferPool().acquire(size);
};

/**
 * Return buffer to pool for reuse
 */
export const releaseBuffer = (buffer: Uint8ClampedArray): void => {
  getBufferPool().release(buffer);
};

/**
 * Acquire buffer and copy source data into it
 */
export const acquireBufferCopy = (source: Uint8ClampedArray): Uint8ClampedArray => {
  const buffer = getBufferPool().acquire(source.length);
  buffer.set(source);
  return buffer;
};

// ============================================================================
// PIXEL ITERATION HELPERS
// ============================================================================

/**
 * Helper to iterate over all pixels in an image
 */
export const iteratePixels = (
  data: Uint8ClampedArray,
  callback: (i: number, r: number, g: number, b: number, a: number) => void
): void => {
  for (let i = 0; i < data.length; i += 4) {
    callback(i, data[i], data[i + 1], data[i + 2], data[i + 3]);
  }
};

/**
 * Helper to iterate over pixels with x,y coordinates
 */
export const iteratePixelsXY = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  callback: (i: number, x: number, y: number, r: number, g: number, b: number, a: number) => void
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      callback(i, x, y, data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
  }
};

/**
 * Helper to get pixel index from x,y coordinates
 */
export const getPixelIndex = (x: number, y: number, width: number): number => {
  return (y * width + x) * 4;
};

/**
 * Helper to safely get pixel value with bounds checking
 */
export const getPixelSafe = (
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number
): { r: number; g: number; b: number; a: number } | null => {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return null;
  }
  const i = (y * width + x) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  };
};

// ============================================================================
// CONVOLUTION HELPERS
// ============================================================================

/**
 * Apply a 3x3 convolution kernel to a pixel
 */
export const applyKernel3x3 = (
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  kernel: number[][]
): { r: number; g: number; b: number } => {
  let r = 0,
    g = 0,
    b = 0;

  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const px = Math.min(width - 1, Math.max(0, x + kx));
      const py = Math.min(height - 1, Math.max(0, y + ky));
      const idx = (py * width + px) * 4;
      const weight = kernel[ky + 1][kx + 1];

      r += data[idx] * weight;
      g += data[idx + 1] * weight;
      b += data[idx + 2] * weight;
    }
  }

  return { r, g, b };
};

// ============================================================================
// COMMON KERNELS
// ============================================================================

export const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

export const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

export const SHARPEN_KERNEL = [
  [0, -1, 0],
  [-1, 5, -1],
  [0, -1, 0],
];

export const EDGE_DETECT_KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

export const EMBOSS_KERNEL = [
  [-2, -1, 0],
  [-1, 1, 1],
  [0, 1, 2],
];
