/**
 * SVG Export utilities
 * - Traced SVG: Converts bitmap to vector paths (best for simple graphics)
 * - Embedded PNG: Wraps transparent PNG in SVG (preserves all detail)
 */

import { getMaskBounds, applyMaskToImage } from './maskUtils';

export interface SVGExportOptions {
  /** Simplify paths by reducing point count (0-1, higher = simpler) */
  simplifyTolerance?: number;
  /** Threshold for black/white conversion in tracing (0-255) */
  threshold?: number;
  /** Color mode for traced SVG */
  colorMode?: 'black' | 'white' | 'auto' | 'color';
  /** Include image dimensions in SVG */
  includeDimensions?: boolean;
  /** Optimize SVG output */
  optimize?: boolean;
}

/**
 * Convert ImageData to a data URL (PNG)
 */
function imageDataToDataURL(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Export image as embedded PNG in SVG format
 * This preserves full image quality and transparency
 */
export function exportAsEmbeddedSVG(
  imageData: ImageData,
  mask?: Uint8ClampedArray,
  options: SVGExportOptions = {}
): string {
  const { includeDimensions = true } = options;

  // Apply mask if provided
  let processedImage = imageData;
  if (mask) {
    processedImage = applyMaskToImage(imageData, mask, true);
  }

  // Get bounds if mask provided
  let width = processedImage.width;
  let height = processedImage.height;

  if (mask) {
    const bounds = getMaskBounds(mask, imageData.width, imageData.height);
    if (bounds) {
      // Crop to bounds
      const croppedWidth = bounds.maxX - bounds.minX + 1;
      const croppedHeight = bounds.maxY - bounds.minY + 1;
      const croppedData = new ImageData(croppedWidth, croppedHeight);

      for (let cy = 0; cy < croppedHeight; cy++) {
        for (let cx = 0; cx < croppedWidth; cx++) {
          const srcIdx = ((cy + bounds.minY) * imageData.width + (cx + bounds.minX)) * 4;
          const dstIdx = (cy * croppedWidth + cx) * 4;
          croppedData.data[dstIdx] = processedImage.data[srcIdx];
          croppedData.data[dstIdx + 1] = processedImage.data[srcIdx + 1];
          croppedData.data[dstIdx + 2] = processedImage.data[srcIdx + 2];
          croppedData.data[dstIdx + 3] = processedImage.data[srcIdx + 3];
        }
      }

      processedImage = croppedData;
      width = croppedWidth;
      height = croppedHeight;
    }
  }

  const dataURL = imageDataToDataURL(processedImage);
  
  const dimensionAttrs = includeDimensions 
    ? `width="${width}" height="${height}"` 
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     viewBox="0 0 ${width} ${height}" ${dimensionAttrs}>
  <image x="0" y="0" width="${width}" height="${height}" 
         xlink:href="${dataURL}" 
         preserveAspectRatio="none"/>
</svg>`;
}

/**
 * Trace bitmap to SVG paths using marching squares algorithm
 * Best for simple illustrations, icons, and line art
 */
export function exportAsTracedSVG(
  imageData: ImageData,
  mask?: Uint8ClampedArray,
  options: SVGExportOptions = {}
): string {
  const {
    threshold = 128,
    colorMode = 'auto',
    simplifyTolerance = 0.5,
    includeDimensions = true,
    optimize = true,
  } = options;

  // Apply mask if provided
  let processedImage = imageData;
  if (mask) {
    processedImage = applyMaskToImage(imageData, mask, true);
  }

  const { width, height, data } = processedImage;

  // Determine colors to trace
  const colors = colorMode === 'color' 
    ? extractDominantColors(processedImage, 8)
    : [colorMode === 'white' ? '#FFFFFF' : '#000000'];

  // Convert to grayscale for tracing
  const grayscale = new Uint8Array(width * height);
  for (let i = 0; i < grayscale.length; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    
    // Skip fully transparent pixels
    if (a < 128) {
      grayscale[i] = 255; // Treat as background
    } else {
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }

  // Trace contours using marching squares
  const paths = traceContours(grayscale, width, height, threshold);

  // Simplify paths if requested
  const simplifiedPaths = optimize 
    ? paths.map(path => simplifyPath(path, simplifyTolerance * 2))
    : paths;

  // Convert paths to SVG path strings
  const svgPaths = simplifiedPaths
    .filter(path => path.length >= 6)
    .map((path, index) => {
      const color = colors[index % colors.length];
      const d = pathToSVGPath(path);
      return `  <path d="${d}" fill="${color}" fill-rule="evenodd"/>`;
    })
    .join('\n');

  const dimensionAttrs = includeDimensions 
    ? `width="${width}" height="${height}"` 
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${dimensionAttrs}>
${svgPaths}
</svg>`;
}

/**
 * Marching squares algorithm to find contours
 */
function traceContours(
  grayscale: Uint8Array,
  width: number,
  height: number,
  threshold: number
): number[][] {
  const contours: number[][] = [];
  const visited = new Uint8Array(width * height);

  // Create binary image
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < grayscale.length; i++) {
    binary[i] = grayscale[i] < threshold ? 1 : 0;
  }

  // Find starting points and trace contours
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Look for edge transitions
      if (binary[idx] === 1 && !visited[idx]) {
        // Check if this is a border pixel
        const hasBackground = 
          (x === 0 || binary[idx - 1] === 0) ||
          (x === width - 1 || binary[idx + 1] === 0) ||
          (y === 0 || binary[idx - width] === 0) ||
          (y === height - 1 || binary[idx + width] === 0);

        if (hasBackground) {
          const contour = traceContour(binary, width, height, x, y, visited);
          if (contour.length >= 6) {
            contours.push(contour);
          }
        }
      }
    }
  }

  return contours;
}

/**
 * Trace a single contour starting from a point
 */
function traceContour(
  binary: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array
): number[] {
  const contour: number[] = [];
  const directions = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1]
  ];

  let x = startX;
  let y = startY;
  let dir = 0;
  const maxIterations = width * height;
  let iterations = 0;

  do {
    contour.push(x, y);
    visited[y * width + x] = 1;

    // Find next edge pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const newDir = (dir + 6 + i) % 8; // Start from dir - 2
      const [dx, dy] = directions[newDir];
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (binary[nidx] === 1) {
          // Check if it's still a border pixel
          const hasBackground = 
            (nx === 0 || binary[nidx - 1] === 0) ||
            (nx === width - 1 || binary[nidx + 1] === 0) ||
            (ny === 0 || binary[nidx - width] === 0) ||
            (ny === height - 1 || binary[nidx + width] === 0);

          if (hasBackground) {
            x = nx;
            y = ny;
            dir = newDir;
            found = true;
            break;
          }
        }
      }
    }

    if (!found) break;
    iterations++;
  } while ((x !== startX || y !== startY) && iterations < maxIterations);

  // Close the contour
  if (contour.length >= 4) {
    contour.push(contour[0], contour[1]);
  }

  return contour;
}

/**
 * Simplify path using Ramer-Douglas-Peucker algorithm
 */
function simplifyPath(points: number[], tolerance: number): number[] {
  if (points.length <= 4) return points;

  const sqTolerance = tolerance * tolerance;
  
  function getSqDist(p1x: number, p1y: number, p2x: number, p2y: number): number {
    const dx = p1x - p2x;
    const dy = p1y - p2y;
    return dx * dx + dy * dy;
  }

  function getSqSegDist(px: number, py: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
    let x = p1x;
    let y = p1y;
    let dx = p2x - p1x;
    let dy = p2y - p1y;

    if (dx !== 0 || dy !== 0) {
      const t = ((px - p1x) * dx + (py - p1y) * dy) / (dx * dx + dy * dy);

      if (t > 1) {
        x = p2x;
        y = p2y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    return getSqDist(px, py, x, y);
  }

  function simplifyDPStep(
    points: number[],
    first: number,
    last: number,
    sqTolerance: number,
    simplified: number[]
  ): void {
    let maxSqDist = sqTolerance;
    let index = 0;

    for (let i = first + 2; i < last; i += 2) {
      const sqDist = getSqSegDist(
        points[i], points[i + 1],
        points[first], points[first + 1],
        points[last], points[last + 1]
      );

      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      if (index - first > 2) simplifyDPStep(points, first, index, sqTolerance, simplified);
      simplified.push(points[index], points[index + 1]);
      if (last - index > 2) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
  }

  const last = points.length - 2;
  const simplified = [points[0], points[1]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last], points[last + 1]);

  return simplified;
}

/**
 * Convert point array to SVG path string
 */
function pathToSVGPath(points: number[]): string {
  if (points.length < 2) return '';

  let d = `M${points[0]},${points[1]}`;
  
  for (let i = 2; i < points.length; i += 2) {
    d += `L${points[i]},${points[i + 1]}`;
  }
  
  d += 'Z';
  return d;
}

/**
 * Extract dominant colors from image for color tracing
 */
function extractDominantColors(imageData: ImageData, maxColors: number): string[] {
  const { data } = imageData;
  const colorCounts = new Map<string, number>();

  // Sample pixels (skip some for performance)
  const step = Math.max(1, Math.floor(data.length / 4 / 10000));
  
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue; // Skip transparent

    // Quantize colors
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;

    const key = `${qr},${qg},${qb}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  // Sort by frequency
  const sorted = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors);

  return sorted.map(([key]) => {
    const [r, g, b] = key.split(',').map(Number);
    return `rgb(${r},${g},${b})`;
  });
}

/**
 * Download SVG as file
 */
export function downloadSVG(svgContent: string, filename: string = 'export.svg'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Copy SVG to clipboard (for pasting into Figma, etc.)
 */
export async function copySVGToClipboard(svgContent: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(svgContent);
    return true;
  } catch (err) {
    console.error('Failed to copy SVG to clipboard:', err);
    
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = svgContent;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Export selection as SVG with options
 */
export interface ExportResult {
  svg: string;
  width: number;
  height: number;
  type: 'traced' | 'embedded';
}

export function exportToSVG(
  imageData: ImageData,
  mask: Uint8ClampedArray | undefined,
  type: 'traced' | 'embedded',
  options: SVGExportOptions = {}
): ExportResult {
  let width = imageData.width;
  let height = imageData.height;

  // Get cropped dimensions if mask provided
  if (mask) {
    const bounds = getMaskBounds(mask, imageData.width, imageData.height);
    if (bounds) {
      width = bounds.maxX - bounds.minX + 1;
      height = bounds.maxY - bounds.minY + 1;
    }
  }

  const svg = type === 'traced'
    ? exportAsTracedSVG(imageData, mask, options)
    : exportAsEmbeddedSVG(imageData, mask, options);

  return { svg, width, height, type };
}
