import Konva from 'konva';

/**
 * Orton Effect - Creates a dreamy, ethereal glow
 * Named after photographer Michael Orton, this effect combines:
 * 1. A sharp, high-contrast version of the image
 * 2. A heavily blurred, overexposed version
 * The result is a dreamy, glowing appearance popular in landscape photography
 */

interface OrtonSettings {
  intensity: number; // Overall effect intensity (0-1)
  blurRadius: number; // Blur amount for the glow layer (0-50)
  contrast: number; // Contrast boost for sharp layer (0-2)
  saturation: number; // Color saturation boost (0-2)
  exposure: number; // Exposure adjustment for glow layer (0-2)
  blend: number; // Blend ratio between sharp and glow (0-1)
}

// Gaussian blur implementation for the glow layer
function gaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(data);

  const result = new Uint8ClampedArray(data.length);
  const sigma = radius / 3;
  const kernel = createGaussianKernel(radius, sigma);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);

  // Horizontal pass
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const sampleX = x + i - halfKernel;
          if (sampleX >= 0 && sampleX < width) {
            const idx = (y * width + sampleX) * 4 + c;
            const weight = kernel[i];
            sum += data[idx] * weight;
            weightSum += weight;
          }
        }

        const idx = (y * width + x) * 4 + c;
        temp[idx] = weightSum > 0 ? sum / weightSum : data[idx];
      }
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const sampleY = y + i - halfKernel;
          if (sampleY >= 0 && sampleY < height) {
            const idx = (sampleY * width + x) * 4 + c;
            const weight = kernel[i];
            sum += temp[idx] * weight;
            weightSum += weight;
          }
        }

        const idx = (y * width + x) * 4 + c;
        result[idx] = weightSum > 0 ? sum / weightSum : temp[idx];
      }
    }
  }

  return result;
}

function createGaussianKernel(radius: number, sigma: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = value;
    sum += value;
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

// Apply contrast adjustment
function adjustContrast(value: number, contrast: number): number {
  return Math.max(0, Math.min(255, (value - 128) * contrast + 128));
}

// Apply saturation adjustment
function adjustSaturation(
  r: number,
  g: number,
  b: number,
  saturation: number
): [number, number, number] {
  // Convert to HSL
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const diff = max - min;
  const sum = max + min;

  let h = 0,
    s = 0;
  const l = sum / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - sum) : diff / sum;

    switch (max) {
      case r / 255:
        h = (g - b) / 255 / diff + (g < b ? 6 : 0);
        break;
      case g / 255:
        h = (b - r) / 255 / diff + 2;
        break;
      case b / 255:
        h = (r - g) / 255 / diff + 4;
        break;
    }
    h /= 6;
  }

  // Adjust saturation
  s = Math.max(0, Math.min(1, s * saturation));

  // Convert back to RGB
  if (s === 0) {
    return [l * 255, l * 255, l * 255];
  }

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

  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

// Apply exposure adjustment
function adjustExposure(value: number, exposure: number): number {
  return Math.max(0, Math.min(255, value * exposure));
}

// Main Orton Effect filter
export const OrtonFilter = function (this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Get settings from Konva node
  const intensity = this.ortonIntensity?.() || 0.7;
  const blurRadius = this.ortonBlurRadius?.() || 15;
  const contrast = this.ortonContrast?.() || 1.3;
  const saturation = this.ortonSaturation?.() || 1.2;
  const exposure = this.ortonExposure?.() || 1.4;
  const blend = this.ortonBlend?.() || 0.6;

  // Create copies for processing
  const originalData = new Uint8ClampedArray(data);
  const sharpData = new Uint8ClampedArray(data);
  const glowData = new Uint8ClampedArray(data);

  // Process sharp layer: increase contrast and saturation
  for (let i = 0; i < sharpData.length; i += 4) {
    const r = sharpData[i];
    const g = sharpData[i + 1];
    const b = sharpData[i + 2];

    // Apply contrast
    const contrastR = adjustContrast(r, contrast);
    const contrastG = adjustContrast(g, contrast);
    const contrastB = adjustContrast(b, contrast);

    // Apply saturation
    const [satR, satG, satB] = adjustSaturation(contrastR, contrastG, contrastB, saturation);

    sharpData[i] = Math.max(0, Math.min(255, satR));
    sharpData[i + 1] = Math.max(0, Math.min(255, satG));
    sharpData[i + 2] = Math.max(0, Math.min(255, satB));
  }

  // Process glow layer: blur and overexpose
  const blurredData = gaussianBlur(glowData, width, height, Math.floor(blurRadius));

  for (let i = 0; i < blurredData.length; i += 4) {
    glowData[i] = adjustExposure(blurredData[i], exposure);
    glowData[i + 1] = adjustExposure(blurredData[i + 1], exposure);
    glowData[i + 2] = adjustExposure(blurredData[i + 2], exposure);
  }

  // Blend the layers using screen blend mode for the glow
  for (let i = 0; i < data.length; i += 4) {
    const sharpR = sharpData[i];
    const sharpG = sharpData[i + 1];
    const sharpB = sharpData[i + 2];

    const glowR = glowData[i];
    const glowG = glowData[i + 1];
    const glowB = glowData[i + 2];

    // Screen blend mode: 1 - (1 - a) * (1 - b)
    const screenR = 255 - ((255 - sharpR) * (255 - glowR)) / 255;
    const screenG = 255 - ((255 - sharpG) * (255 - glowG)) / 255;
    const screenB = 255 - ((255 - sharpB) * (255 - glowB)) / 255;

    // Blend with original based on blend ratio
    const finalR = sharpR * (1 - blend) + screenR * blend;
    const finalG = sharpG * (1 - blend) + screenG * blend;
    const finalB = sharpB * (1 - blend) + screenB * blend;

    // Apply overall intensity
    data[i] = originalData[i] * (1 - intensity) + finalR * intensity;
    data[i + 1] = originalData[i + 1] * (1 - intensity) + finalG * intensity;
    data[i + 2] = originalData[i + 2] * (1 - intensity) + finalB * intensity;
  }
};

// Register with Konva
if (typeof window !== 'undefined' && window.Konva) {
  Konva.Filters.Orton = OrtonFilter;
}

export default OrtonFilter;
