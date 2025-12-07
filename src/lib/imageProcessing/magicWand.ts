/**
 * Magic Wand Tool - Flood-fill based color selection
 * Selects contiguous pixels within a color tolerance threshold
 */

export interface MagicWandResult {
  mask: Uint8ClampedArray;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  width: number;
  height: number;
}

/**
 * Calculate color distance between two RGBA pixels
 */
function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  a1: number,
  r2: number,
  g2: number,
  b2: number,
  a2: number
): number {
  // Use weighted Euclidean distance for better perceptual matching
  const rDiff = r1 - r2;
  const gDiff = g1 - g2;
  const bDiff = b1 - b2;
  const aDiff = a1 - a2;

  // Weight green more heavily (human eye is more sensitive to green)
  return Math.sqrt(rDiff * rDiff * 0.3 + gDiff * gDiff * 0.59 + bDiff * bDiff * 0.11 + aDiff * aDiff * 0.1);
}

/**
 * Perform flood-fill selection starting from a seed point
 * @param imageData - The image data from canvas
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param tolerance - Color tolerance (0-255, higher = more lenient)
 * @param contiguous - If true, only select connected pixels; if false, select all matching pixels
 */
export function magicWandSelect(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 32,
  contiguous: boolean = true
): MagicWandResult {
  const { width, height, data } = imageData;
  const mask = new Uint8ClampedArray(width * height);

  // Clamp coordinates
  startX = Math.floor(Math.max(0, Math.min(width - 1, startX)));
  startY = Math.floor(Math.max(0, Math.min(height - 1, startY)));

  // Get seed color
  const seedIdx = (startY * width + startX) * 4;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];
  const seedA = data[seedIdx + 3];

  // Track bounds
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  if (contiguous) {
    // Flood-fill algorithm using a stack (iterative to avoid stack overflow)
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const pixelIndex = y * width + x;

      // Skip if already visited
      if (visited[pixelIndex]) continue;
      visited[pixelIndex] = 1;

      // Get pixel color
      const idx = pixelIndex * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Check if within tolerance
      const distance = colorDistance(r, g, b, a, seedR, seedG, seedB, seedA);
      if (distance <= tolerance) {
        // Mark as selected
        mask[pixelIndex] = 255;

        // Update bounds
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        // Add neighbors to stack (4-connected)
        if (x > 0 && !visited[pixelIndex - 1]) stack.push([x - 1, y]);
        if (x < width - 1 && !visited[pixelIndex + 1]) stack.push([x + 1, y]);
        if (y > 0 && !visited[pixelIndex - width]) stack.push([x, y - 1]);
        if (y < height - 1 && !visited[pixelIndex + width]) stack.push([x, y + 1]);
      }
    }
  } else {
    // Select all pixels matching the color (non-contiguous)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const idx = pixelIndex * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        const distance = colorDistance(r, g, b, a, seedR, seedG, seedB, seedA);
        if (distance <= tolerance) {
          mask[pixelIndex] = 255;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }

  // Handle case where nothing was selected
  if (minX > maxX) {
    minX = startX;
    maxX = startX;
    minY = startY;
    maxY = startY;
  }

  return {
    mask,
    bounds: { minX, minY, maxX, maxY },
    width,
    height,
  };
}

/**
 * Expand or contract selection by a number of pixels
 */
export function expandSelection(mask: Uint8ClampedArray, width: number, height: number, pixels: number): Uint8ClampedArray {
  if (pixels === 0) return mask;

  const result = new Uint8ClampedArray(mask.length);
  const isExpand = pixels > 0;
  const iterations = Math.abs(pixels);

  let current = mask;

  for (let i = 0; i < iterations; i++) {
    const next = new Uint8ClampedArray(current.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (isExpand) {
          // Expand: if any neighbor is selected, select this pixel
          if (
            current[idx] > 0 ||
            (x > 0 && current[idx - 1] > 0) ||
            (x < width - 1 && current[idx + 1] > 0) ||
            (y > 0 && current[idx - width] > 0) ||
            (y < height - 1 && current[idx + width] > 0)
          ) {
            next[idx] = 255;
          }
        } else {
          // Contract: only keep if all neighbors are selected
          if (
            current[idx] > 0 &&
            (x === 0 || current[idx - 1] > 0) &&
            (x === width - 1 || current[idx + 1] > 0) &&
            (y === 0 || current[idx - width] > 0) &&
            (y === height - 1 || current[idx + width] > 0)
          ) {
            next[idx] = 255;
          }
        }
      }
    }

    current = next;
  }

  result.set(current);
  return result;
}

/**
 * Convert mask to canvas-compatible ImageData with marching ants visualization
 */
export function maskToOverlay(mask: Uint8ClampedArray, width: number, height: number, color: [number, number, number, number] = [0, 150, 255, 100]): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    if (mask[i] > 0) {
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }
  }

  return imageData;
}

/**
 * Get selection outline points for rendering (marching squares simplified)
 */
export function getMaskOutline(mask: Uint8ClampedArray, width: number, height: number): number[][] {
  const outlines: number[][] = [];
  const visited = new Uint8Array(mask.length);

  // Find edge pixels and trace outlines
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0 && !visited[idx]) {
        // Check if this is an edge pixel
        const isEdge =
          x === 0 ||
          x === width - 1 ||
          y === 0 ||
          y === height - 1 ||
          mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0;

        if (isEdge) {
          // Simple outline tracing
          const outline = traceOutline(mask, width, height, x, y, visited);
          if (outline.length > 4) {
            outlines.push(outline);
          }
        }
      }
    }
  }

  return outlines;
}

/**
 * Trace outline starting from a point
 */
function traceOutline(mask: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, visited: Uint8Array): number[] {
  const outline: number[] = [];
  const directions = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  let x = startX;
  let y = startY;
  let dir = 0;
  const maxIterations = width * height;
  let iterations = 0;

  do {
    outline.push(x, y);
    visited[y * width + x] = 1;

    // Find next edge pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const newDir = (dir + i) % 8;
      const [dx, dy] = directions[newDir];
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (mask[nidx] > 0) {
          // Check if it's an edge
          const isEdge =
            nx === 0 ||
            nx === width - 1 ||
            ny === 0 ||
            ny === height - 1 ||
            (nx > 0 && mask[nidx - 1] === 0) ||
            (nx < width - 1 && mask[nidx + 1] === 0) ||
            (ny > 0 && mask[nidx - width] === 0) ||
            (ny < height - 1 && mask[nidx + width] === 0);

          if (isEdge) {
            x = nx;
            y = ny;
            dir = (newDir + 5) % 8; // Turn back
            found = true;
            break;
          }
        }
      }
    }

    if (!found) break;
    iterations++;
  } while ((x !== startX || y !== startY) && iterations < maxIterations);

  return outline;
}
