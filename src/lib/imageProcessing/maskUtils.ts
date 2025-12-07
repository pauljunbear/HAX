/**
 * Mask Utilities for background removal and image extraction
 */

export interface MaskData {
  mask: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Apply a mask to an image, making unselected areas transparent
 * @param imageData - Source image data
 * @param mask - Selection mask (255 = selected, 0 = not selected)
 * @param keepSelected - If true, keep selected areas; if false, remove selected areas
 * @returns New ImageData with transparency applied
 */
export function applyMaskToImage(
  imageData: ImageData,
  mask: Uint8ClampedArray,
  keepSelected: boolean = true
): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;

  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    const isSelected = mask[i] > 127;
    const shouldKeep = keepSelected ? isSelected : !isSelected;

    if (shouldKeep) {
      // Copy pixel
      resultData[idx] = data[idx];
      resultData[idx + 1] = data[idx + 1];
      resultData[idx + 2] = data[idx + 2];
      resultData[idx + 3] = data[idx + 3];
    } else {
      // Make transparent
      resultData[idx] = 0;
      resultData[idx + 1] = 0;
      resultData[idx + 2] = 0;
      resultData[idx + 3] = 0;
    }
  }

  return result;
}

/**
 * Invert a mask (swap selected and unselected areas)
 */
export function invertMask(mask: Uint8ClampedArray): Uint8ClampedArray {
  const result = new Uint8ClampedArray(mask.length);
  for (let i = 0; i < mask.length; i++) {
    result[i] = mask[i] > 127 ? 0 : 255;
  }
  return result;
}

/**
 * Combine two masks using different operations
 */
export function combineMasks(
  mask1: Uint8ClampedArray,
  mask2: Uint8ClampedArray,
  operation: 'union' | 'intersect' | 'subtract' | 'xor'
): Uint8ClampedArray {
  if (mask1.length !== mask2.length) {
    throw new Error('Masks must be the same size');
  }

  const result = new Uint8ClampedArray(mask1.length);

  for (let i = 0; i < mask1.length; i++) {
    const a = mask1[i] > 127;
    const b = mask2[i] > 127;
    let selected = false;

    switch (operation) {
      case 'union':
        selected = a || b;
        break;
      case 'intersect':
        selected = a && b;
        break;
      case 'subtract':
        selected = a && !b;
        break;
      case 'xor':
        selected = a !== b;
        break;
    }

    result[i] = selected ? 255 : 0;
  }

  return result;
}

/**
 * Refine mask edges with feathering (smooth transition)
 * @param mask - Input mask
 * @param width - Mask width
 * @param height - Mask height
 * @param featherRadius - Radius of feather effect (in pixels)
 * @returns Feathered mask with smooth edges
 */
export function refineMaskEdges(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  featherRadius: number
): Uint8ClampedArray {
  if (featherRadius <= 0) return new Uint8ClampedArray(mask);

  const result = new Uint8ClampedArray(mask.length);
  const radius = Math.ceil(featherRadius);

  // Pre-compute gaussian kernel
  const kernelSize = radius * 2 + 1;
  const kernel: number[] = [];
  const sigma = featherRadius / 3;
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    const g = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(g);
    sum += g;
  }

  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  // Apply separable gaussian blur
  // First pass: horizontal
  const temp = new Float32Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const nx = Math.max(0, Math.min(width - 1, x + k));
        value += mask[y * width + nx] * kernel[k + radius];
      }
      temp[y * width + x] = value;
    }
  }

  // Second pass: vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = -radius; k <= radius; k++) {
        const ny = Math.max(0, Math.min(height - 1, y + k));
        value += temp[ny * width + x] * kernel[k + radius];
      }
      result[y * width + x] = Math.round(Math.max(0, Math.min(255, value)));
    }
  }

  return result;
}

/**
 * Expand or contract mask by a number of pixels (morphological operation)
 */
export function morphMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  pixels: number
): Uint8ClampedArray {
  if (pixels === 0) return new Uint8ClampedArray(mask);

  const isExpand = pixels > 0;
  const iterations = Math.abs(pixels);
  let current = mask;

  for (let i = 0; i < iterations; i++) {
    const next = new Uint8ClampedArray(current.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (isExpand) {
          // Dilate: if any neighbor is selected, select this pixel
          let hasNeighbor = current[idx] > 127;
          if (!hasNeighbor && x > 0) hasNeighbor = current[idx - 1] > 127;
          if (!hasNeighbor && x < width - 1) hasNeighbor = current[idx + 1] > 127;
          if (!hasNeighbor && y > 0) hasNeighbor = current[idx - width] > 127;
          if (!hasNeighbor && y < height - 1) hasNeighbor = current[idx + width] > 127;
          next[idx] = hasNeighbor ? 255 : 0;
        } else {
          // Erode: only keep if all neighbors are selected
          let allNeighbors = current[idx] > 127;
          if (allNeighbors && x > 0) allNeighbors = current[idx - 1] > 127;
          if (allNeighbors && x < width - 1) allNeighbors = current[idx + 1] > 127;
          if (allNeighbors && y > 0) allNeighbors = current[idx - width] > 127;
          if (allNeighbors && y < height - 1) allNeighbors = current[idx + width] > 127;
          next[idx] = allNeighbors ? 255 : 0;
        }
      }
    }

    current = next;
  }

  return current;
}

/**
 * Remove small isolated areas from mask (noise removal)
 * @param minAreaPixels - Minimum area in pixels to keep
 */
export function removeSmallAreas(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  minAreaPixels: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(mask.length);
  const visited = new Uint8Array(mask.length);

  // Flood fill to find connected components
  const floodFill = (startX: number, startY: number, value: number): number[] => {
    const pixels: number[] = [];
    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (visited[idx] || (mask[idx] > 127) !== (value > 127)) continue;
      visited[idx] = 1;
      pixels.push(idx);

      if (x > 0) stack.push([x - 1, y]);
      if (x < width - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < height - 1) stack.push([x, y + 1]);
    }

    return pixels;
  };

  // Find all connected components
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && mask[idx] > 127) {
        const component = floodFill(x, y, 255);
        
        // Keep component if it's large enough
        if (component.length >= minAreaPixels) {
          for (const pixelIdx of component) {
            result[pixelIdx] = 255;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Create a mask from ImageData based on alpha channel
 */
export function maskFromAlpha(imageData: ImageData): MaskData {
  const { width, height, data } = imageData;
  const mask = new Uint8ClampedArray(width * height);

  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 3]; // Alpha channel
  }

  return { mask, width, height };
}

/**
 * Create ImageData with mask overlay for visualization
 */
export function createMaskOverlay(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  color: [number, number, number] = [0, 150, 255],
  opacity: number = 0.5
): ImageData {
  const result = new ImageData(width, height);
  const data = result.data;
  const alpha = Math.round(opacity * 255);

  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    if (mask[i] > 127) {
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = alpha;
    }
  }

  return result;
}

/**
 * Get bounding box of selected area in mask
 */
export function getMaskBounds(
  mask: Uint8ClampedArray,
  width: number,
  height: number
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasSelection = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 127) {
        hasSelection = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return hasSelection ? { minX, minY, maxX, maxY } : null;
}

/**
 * Crop image data to mask bounds
 */
export function cropToMask(
  imageData: ImageData,
  mask: Uint8ClampedArray
): { imageData: ImageData; offsetX: number; offsetY: number } | null {
  const bounds = getMaskBounds(mask, imageData.width, imageData.height);
  if (!bounds) return null;

  const cropWidth = bounds.maxX - bounds.minX + 1;
  const cropHeight = bounds.maxY - bounds.minY + 1;
  const result = new ImageData(cropWidth, cropHeight);

  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const srcX = x + bounds.minX;
      const srcY = y + bounds.minY;
      const srcIdx = (srcY * imageData.width + srcX) * 4;
      const dstIdx = (y * cropWidth + x) * 4;
      const maskIdx = srcY * imageData.width + srcX;

      if (mask[maskIdx] > 127) {
        result.data[dstIdx] = imageData.data[srcIdx];
        result.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        result.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        result.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
  }

  return {
    imageData: result,
    offsetX: bounds.minX,
    offsetY: bounds.minY,
  };
}
