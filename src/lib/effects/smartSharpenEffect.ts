import Konva from 'konva';

/**
 * Smart Sharpen Effect - Intelligent edge detection and sharpening
 * Uses edge detection to selectively sharpen areas with high contrast
 * while preserving smooth areas and avoiding noise amplification
 */

export interface SmartSharpenSettings {
  amount: number; // Sharpening strength (0-3)
  radius: number; // Sharpening radius (0.5-5)
  threshold: number; // Edge detection threshold (0-255)
  noiseReduction: number; // Noise reduction strength (0-1)
  edgeMode: 'sobel' | 'laplacian' | 'unsharp'; // Edge detection method
  preserveDetails: boolean; // Whether to preserve fine details
}

// Sobel edge detection kernels
const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

// Laplacian edge detection kernel
const LAPLACIAN = [
  [0, -1, 0],
  [-1, 4, -1],
  [0, -1, 0],
];

// Gaussian blur kernel for noise reduction
function createGaussianKernel(radius: number): number[][] {
  const size = Math.ceil(radius * 2) * 2 + 1;
  const kernel: number[][] = [];
  const sigma = radius / 3;
  let sum = 0;

  const center = Math.floor(size / 2);

  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      sum += value;
    }
  }

  // Normalize
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

// Apply convolution with a kernel
function applyKernel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[][],
  channel: number = 0
): Float32Array {
  const result = new Float32Array(width * height);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = Math.max(0, Math.min(width - 1, x + kx - halfKernel));
          const py = Math.max(0, Math.min(height - 1, y + ky - halfKernel));
          const idx = (py * width + px) * 4 + channel;
          sum += data[idx] * kernel[ky][kx];
        }
      }

      result[y * width + x] = sum;
    }
  }

  return result;
}

// Convert RGB to luminance for edge detection
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Detect edges using Sobel operator
function detectEdgesSobel(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const luminance = new Uint8ClampedArray(width * height);

  // Convert to luminance
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    luminance[i] = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
  }

  // Apply Sobel operators
  // Luminance array is compatible with Uint8ClampedArray for kernel application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gradX = applyKernel(luminance as unknown as Uint8ClampedArray, width, height, SOBEL_X);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gradY = applyKernel(luminance as unknown as Uint8ClampedArray, width, height, SOBEL_Y);

  const edges = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    edges[i] = Math.sqrt(gradX[i] * gradX[i] + gradY[i] * gradY[i]);
  }

  return edges;
}

// Detect edges using Laplacian operator
function detectEdgesLaplacian(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const luminance = new Uint8ClampedArray(width * height);

  // Convert to luminance
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    luminance[i] = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return applyKernel(luminance as unknown as Uint8ClampedArray, width, height, LAPLACIAN);
}

// Apply unsharp mask
function unsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  amount: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const blurKernel = createGaussianKernel(radius);

  // Apply blur to each channel
  for (let c = 0; c < 3; c++) {
    const blurred = applyKernel(data, width, height, blurKernel, c);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4 + c;
      const original = data[idx];
      const blurredValue = blurred[i];
      const sharpened = original + amount * (original - blurredValue);
      result[idx] = Math.max(0, Math.min(255, sharpened));
    }
  }

  // Copy alpha channel
  for (let i = 0; i < width * height; i++) {
    result[i * 4 + 3] = data[i * 4 + 3];
  }

  return result;
}

// Apply noise reduction using bilateral filter approximation
function reduceNoise(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number
): Uint8ClampedArray {
  if (strength <= 0) return new Uint8ClampedArray(data);

  const result = new Uint8ClampedArray(data.length);
  const radius = Math.ceil(strength * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let weightSum = 0;
        const centerValue = data[centerIdx + c];

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nIdx = (ny * width + nx) * 4 + c;
            const neighborValue = data[nIdx];

            // Spatial weight (Gaussian)
            const spatialWeight = Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));

            // Intensity weight (preserve edges)
            const intensityDiff = Math.abs(centerValue - neighborValue);
            const intensityWeight = Math.exp(-(intensityDiff * intensityDiff) / (2 * 30 * 30));

            const weight = spatialWeight * intensityWeight * strength;
            sum += neighborValue * weight;
            weightSum += weight;
          }
        }

        result[centerIdx + c] =
          weightSum > 0 ? Math.max(0, Math.min(255, sum / weightSum)) : centerValue;
      }

      result[centerIdx + 3] = data[centerIdx + 3]; // Alpha
    }
  }

  return result;
}

// Main Smart Sharpen filter
export const SmartSharpenFilter = function (this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Get settings from Konva node
  const amount = this.smartSharpenAmount?.() || 1.0;
  const radius = this.smartSharpenRadius?.() || 1.0;
  const threshold = this.smartSharpenThreshold?.() || 10;
  const noiseReduction = this.smartSharpenNoiseReduction?.() || 0.45;
  const edgeMode = this.smartSharpenEdgeMode?.() || 'sobel';
  const preserveDetails = this.smartSharpenPreserveDetails?.() || true;
  const noiseFactor = Math.pow(Math.max(0, 1 - noiseReduction), 4);

  // Create working copy
  let workingData = new Uint8ClampedArray(data);

  // Step 1: Apply noise reduction if requested
  if (noiseReduction > 0) {
    workingData = reduceNoise(workingData, width, height, noiseReduction);
  }

  // Step 2: Detect edges
  let edges: Float32Array;
  switch (edgeMode) {
    case 'laplacian':
      edges = detectEdgesLaplacian(workingData, width, height);
      // Boost laplacian contrast to differentiate from sobel
      for (let i = 0; i < edges.length; i++) edges[i] *= 8.0;
      break;
    case 'unsharp':
      // For unsharp mask, we'll use a simple threshold
      edges = new Float32Array(width * height);
      edges.fill(1); // Apply sharpening everywhere for unsharp mask
      break;
    default: // sobel
      edges = detectEdgesSobel(workingData, width, height);
  }

  // Step 3: Apply sharpening based on edge detection
  if (edgeMode === 'unsharp') {
    // Use traditional unsharp mask
    const amountEffective = Math.max(0, amount * (0.5 + 0.5 * noiseFactor));
    const sharpened = unsharpMask(workingData, width, height, radius, amountEffective);
    data.set(sharpened);
  } else {
    // Apply selective sharpening based on edge map
    const originalData = new Uint8ClampedArray(data);
    const modeBoost = edgeMode === 'laplacian' ? 9.0 : 0.6;
    const amountEffective = Math.max(0, amount * modeBoost * (0.5 + 0.5 * noiseFactor));
    const sharpened = unsharpMask(workingData, width, height, radius, amountEffective);

    // Normalize edge values
    let maxEdge = 0;
    for (let i = 0; i < edges.length; i++) {
      maxEdge = Math.max(maxEdge, Math.abs(edges[i]));
    }

    if (maxEdge > 0) {
      for (let i = 0; i < edges.length; i++) {
        let e = Math.min(1, Math.abs(edges[i]) / maxEdge);
        // Apply gamma to separate modes: compress Sobel, expand Laplacian
        e = edgeMode === 'laplacian' ? Math.pow(e, 0.5) : Math.pow(e, 2.0);
        edges[i] = e;
      }
    }

    // Blend based on edge strength and threshold
    for (let i = 0; i < width * height; i++) {
      const edgeStrength = edges[i];
      const effectiveThreshold = edgeMode === 'laplacian' ? threshold * 0.2 : threshold * 2.0;
      const shouldSharpen = edgeStrength * 255 > effectiveThreshold;

      if (shouldSharpen) {
        const modeBlendMultiplier = edgeMode === 'laplacian' ? 9.0 : 0.6;
        const blendBase = preserveDetails
          ? Math.min(1, edgeStrength * modeBlendMultiplier)
          : edgeStrength > effectiveThreshold / 255
            ? 1
            : 0; // Binary threshold
        const blendFactor = Math.min(1, blendBase * (0.5 + 0.5 * noiseFactor));

        const idx = i * 4;
        for (let c = 0; c < 3; c++) {
          data[idx + c] =
            originalData[idx + c] * (1 - blendFactor) + sharpened[idx + c] * blendFactor;
        }
      }
    }
  }
};

// Preset configurations for different use cases
export const SmartSharpenPresets = {
  subtle: {
    amount: 0.5,
    radius: 0.8,
    threshold: 15,
    noiseReduction: 0.4,
    edgeMode: 'sobel' as const,
    preserveDetails: true,
  },

  moderate: {
    amount: 1.0,
    radius: 1.0,
    threshold: 10,
    noiseReduction: 0.3,
    edgeMode: 'sobel' as const,
    preserveDetails: true,
  },

  strong: {
    amount: 1.5,
    radius: 1.2,
    threshold: 8,
    noiseReduction: 0.2,
    edgeMode: 'laplacian' as const,
    preserveDetails: true,
  },

  portrait: {
    amount: 0.8,
    radius: 0.6,
    threshold: 20,
    noiseReduction: 0.5,
    edgeMode: 'sobel' as const,
    preserveDetails: true,
  },

  landscape: {
    amount: 1.2,
    radius: 1.5,
    threshold: 5,
    noiseReduction: 0.1,
    edgeMode: 'laplacian' as const,
    preserveDetails: false,
  },

  unsharpMask: {
    amount: 1.0,
    radius: 1.0,
    threshold: 0,
    noiseReduction: 0,
    edgeMode: 'unsharp' as const,
    preserveDetails: false,
  },
};

// Register with Konva
if (typeof window !== 'undefined' && window.Konva) {
  Konva.Filters.SmartSharpen = SmartSharpenFilter;
}

export default SmartSharpenFilter;
