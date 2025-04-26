'use client';

// Define the structure for effect settings
interface EffectSetting {
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

// Define the structure for effect configuration
interface EffectConfig {
  label: string;
  category: string;
  settings?: Record<string, EffectSetting>;
}

// Define interface for image data
interface KonvaImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Use a dynamic import approach for Konva to avoid SSR issues
// Import Konva only in browser environment
let Konva: any = null;

let konvaInitialized = false;
let konvaInitPromise: Promise<any> | null = null;

// Function to ensure Konva is properly initialized
const initKonva = async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (konvaInitialized && Konva) {
    return Konva;
  }
  
  if (!konvaInitPromise) {
    console.log("Starting Konva initialization");
    konvaInitPromise = import('konva')
      .then((module) => {
        Konva = module.default;
        konvaInitialized = true;
        console.log("Konva initialization complete");
        
        // Log available filters
        if (Konva.Filters) {
          console.log("Available Konva filters:", Object.keys(Konva.Filters));
          
          // Register any custom filters if needed
          if (!Konva.Filters.Threshold) {
            console.warn("Threshold filter not available, implementing custom version");
            Konva.Filters.Threshold = function(imageData: ImageData) {
              const threshold = this.threshold || 0.5;
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const v = (r + g + b) / 3;
                const value = v < threshold * 255 ? 0 : 255;
                data[i] = data[i + 1] = data[i + 2] = value;
              }
            };
          }
          
          if (!Konva.Filters.Posterize) {
            console.warn("Posterize filter not available, implementing custom version");
            Konva.Filters.Posterize = function(imageData: ImageData) {
              const levels = this.levels || 4;
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.floor(data[i] / 255 * levels) / levels * 255;
                data[i + 1] = Math.floor(data[i + 1] / 255 * levels) / levels * 255;
                data[i + 2] = Math.floor(data[i + 2] / 255 * levels) / levels * 255;
              }
            };
          }
        } else {
          console.error("Konva filters not available");
        }
        
        return Konva;
      })
      .catch((err) => {
        console.error("Error initializing Konva:", err);
        throw err;
      });
  }
  
  return konvaInitPromise;
};

// Add these imports and interfaces at the top of the file, after existing interfaces
// import { SelectionData } from '@/components/SelectionTool';

// Define interface for filter region
// interface FilterRegion {
//   selection: SelectionData;
//   mode: 'selection' | 'inverse';
// }

// Helper function to check if a point is inside a selection
// const isPointInSelection = (x: number, y: number, selection: SelectionData): boolean => {
//   if (!selection) return false;
//   
//   if (selection.type === 'rectangle') {
//     return (
//       x >= (selection.x || 0) &&
//       x <= (selection.x || 0) + (selection.width || 0) &&
//       y >= (selection.y || 0) &&
//       y <= (selection.y || 0) + (selection.height || 0)
//     );
//   }
//   
//   if (selection.type === 'ellipse') {
//     const centerX = (selection.x || 0) + (selection.width || 0) / 2;
//     const centerY = (selection.y || 0) + (selection.height || 0) / 2;
//     const radiusX = (selection.width || 0) / 2;
//     const radiusY = (selection.height || 0) / 2;
//     
//     if (radiusX <= 0 || radiusY <= 0) return false;
//     
//     // Check if point is inside ellipse: (x-h)²/a² + (y-k)²/b² <= 1
//     return Math.pow(x - centerX, 2) / Math.pow(radiusX, 2) + 
//            Math.pow(y - centerY, 2) / Math.pow(radiusY, 2) <= 1;
//   }
//   
//   if (selection.type === 'freehand' && selection.points) {
//     // Point-in-polygon algorithm
//     const points = selection.points;
//     let inside = false;
//     
//     for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
//       const xi = points[i];
//       const yi = points[i + 1];
//       const xj = points[j];
//       const yj = points[j + 1];
//       
//       const intersect = ((yi > y) !== (yj > y)) &&
//         (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
//       
//       if (intersect) inside = !inside;
//       
//       j = i;
//     }
//     
//     return inside;
//   }
//   
//   return false;
// };

// Helper function to calculate average brightness of an area
function getBrightness(imageData: ImageData, x: number, y: number, size: number, width: number, height: number) {
  let totalBrightness = 0;
  let pixelCount = 0;
  
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width, x + size);
  const endY = Math.min(height, y + size);
  
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const i = (py * width + px) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }
  }
  
  return pixelCount > 0 ? totalBrightness / pixelCount : 0;
}

// Helper function to interpolate between two values
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Define the expected return type for an effect function
type KonvaFilterFunction = (imageData: KonvaImageData) => void;
// Type for filter parameters to be set on the node
type FilterParams = Record<string, any>;

// Update applyEffect signature and logic
export const applyEffect = async (
  effectName: string | null, 
  settings: Record<string, number>
// Return the Konva Filter function and parameters object
): Promise<[KonvaFilterFunction | null, FilterParams | null]> => {
  if (!effectName || typeof window === 'undefined') {
    console.log("Cannot apply effect: No effect name or not in browser");
    return [null, null];
  }
  
  // Ensure Konva is initialized
  if (!Konva) {
    try { await initKonva(); } catch (err) { return [null, null]; }
    if (!Konva) { return [null, null]; }
  }
  
  console.log(`Getting Konva filter for: ${effectName} with settings:`, settings);
  
  try {
    switch (effectName) {
      case 'brightness':
        return [Konva.Filters.Brighten, { brightness: settings.value ?? 0 }];
      
      case 'contrast':
        return [Konva.Filters.Contrast, { contrast: settings.value ?? 0 }];
      
      case 'saturation': { 
        const scaledSaturation = settings.value !== undefined ? settings.value / 10 : 0;
        return [Konva.Filters.HSL, { saturation: scaledSaturation }];
      }
      
      case 'hue': { 
        const hueDegrees = settings.value !== undefined ? settings.value : 0;
        return [Konva.Filters.HSL, { hue: hueDegrees }];
      }

      case 'blur': 
        return [Konva.Filters.Blur, { blurRadius: settings.radius ?? 0 }];

      case 'sharpen':
        return [Konva.Filters.Enhance, { enhance: (settings.amount ?? 0) * 0.5 }]; // Enhance seems closer to sharpen

      case 'pixelate':
        return [Konva.Filters.Pixelate, { pixelSize: settings.pixelSize ?? 8 }];

      case 'noise':
        return [Konva.Filters.Noise, { noise: settings.noise ?? 0.2 }];

      case 'threshold':
        return [Konva.Filters.Threshold, { threshold: settings.threshold ?? 0.5 }];

      case 'posterize':
        return [Konva.Filters.Posterize, { levels: settings.levels ?? 4 }];
        
      case 'grayscale':
        return [Konva.Filters.Grayscale, {}];
        
      case 'sepia':
        return [Konva.Filters.Sepia, {}];
        
      case 'invert':
        return [Konva.Filters.Invert, {}];

      // Keep custom filters for ones Konva doesn't have built-in
      case 'pencilSketch':
        return [createPencilSketchEffect(settings), {}];
      case 'halftone':
        return [createHalftoneEffect(settings), {}];
      case 'duotone':
        return [createDuotoneEffect(settings), {}];
      case 'bloom':
        return [createBloomEffect(settings), {}];
      case 'oilPainting': // Kuwahara
        return [createKuwaharaEffect(settings), {}];
      case 'geometric':
        return [createGeometricAbstraction(settings), {}];
      case 'stippling':
        return [createStipplingEffect(settings), {}];
      case 'cellular':
        return [createCellularAutomataEffect(settings), {}];
      case 'reaction-diffusion':
        return [createReactionDiffusionEffect(settings), {}];
      case 'vignette':
        return [createVignetteEffect(settings), {}];
      case 'chromaticAberration':
        return [createChromaticAberrationEffect(settings), {}];
      case 'scanLines':
        return [createScanLinesEffect(settings), {}];
        
      // Add cases for the newly added effects
      case 'crosshatch':
        return [createCrosshatchEffect(settings), {}];
      case 'dotScreen':
        return [createDotScreenEffect(settings), {}];
      case 'oldPhoto':
        return [createOldPhotoEffect(settings), {}];
      case 'pixelSort':
        return [createPixelSortEffect(settings), {}];
      case 'rgbShift':
        return [createRgbShiftEffect(settings), {}];
      case 'flowField':
        return [createFlowFieldEffect(settings), {}];

      // --- Add cases for NEW effects ---
      case 'glitchArt':
        return [createGlitchArtEffect(settings), {}];
      case 'colorQuantization':
        return [createColorQuantizationEffect(settings), {}];
      case 'asciiArt':
        return [createAsciiArtEffect(settings), {}];
      case 'edgeDetection':
        return [createEdgeDetectionEffect(settings), {}];
      case 'swirl':
        return [createSwirlEffect(settings), {}];
      case 'lensFlare':
        return [createLensFlareEffect(settings), {}];
      case 'colorTemperature':
        return [createColorTemperatureEffect(settings), {}];
      case 'mosaic':
        return [createMosaicEffect(settings), {}];
      case 'selectiveColor':
        return [createSelectiveColorEffect(settings), {}];
      case 'fractalNoise':
        return [createFractalNoiseEffect(settings), {}];
      // --- END NEW effects cases ---

      // --- Add cases for MORE UNIQUE effects ---
      case 'voronoi':
        return [createVoronoiEffect(settings), {}];
      case 'kaleidoscope':
        return [createKaleidoscopeEffect(settings), {}];
      case 'inkBleed':
        return [createInkBleedEffect(settings), {}];
      case 'heatmap':
        return [createHeatmapEffect(settings), {}];
      case 'anaglyph':
        return [createAnaglyphEffect(settings), {}];
      case 'scratchedFilm':
        return [createScratchedFilmEffect(settings), {}];
      case 'circuitBoard':
        return [createCircuitBoardEffect(settings), {}];
      case 'pixelExplosion':
        return [createPixelExplosionEffect(settings), {}];
      case 'fisheyeWarp':
        return [createFisheyeWarpEffect(settings), {}];
      case 'procTexture':
        return [createProcTextureEffect(settings), {}];
      // --- END MORE UNIQUE effects cases ---

      default:
        console.warn(`Unknown effect or no Konva filter: ${effectName}`);
        return [null, null];
    }
  } catch (error) {
    console.error(`Error getting filter for ${effectName}:`, error);
    return [null, null];
  }
};

// Implementation of geometric abstraction effect
const createGeometricAbstraction = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    
    const gridSize = Math.max(1, Math.min(64, settings.gridSize || 16));
    const complexity = Math.max(0, Math.min(1, settings.complexity || 0.5));
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
    
    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
          for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
            const index = ((y + cy) * width + (x + cx)) * 4;
            r += tempData[index];
            g += tempData[index + 1];
            b += tempData[index + 2];
            count++;
          }
        }
        
        if (count === 0) continue;
        
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        
        const brightness = (r + g + b) / 3 / 255;
        const rand = Math.random();
        
        switch (Math.floor(rand / (1 - complexity) * 4) % 4) {
          case 0:
            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const index = ((y + cy) * width + (x + cx)) * 4;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
              }
            }
            break;
            
          case 1:
            const radius = gridSize / 2 * (0.5 + brightness * 0.5);
            const centerX = x + gridSize / 2;
            const centerY = y + gridSize / 2;
            
            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const dx = x + cx - centerX;
                const dy = y + cy - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= radius) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;
            
          case 2:
            const halfGrid = gridSize / 2;
            
            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              const rowY = cy / gridSize;
              const rowWidth = gridSize * rowY;
              
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                if (cx >= halfGrid - rowWidth / 2 && cx <= halfGrid + rowWidth / 2) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;
            
          case 3:
            const mid = gridSize / 2;
            
            for (let cy = 0; cy < gridSize && y + cy < height; cy++) {
              for (let cx = 0; cx < gridSize && x + cx < width; cx++) {
                const dx = Math.abs(cx - mid);
                const dy = Math.abs(cy - mid);
                
                if (dx + dy <= mid * (0.5 + brightness * 0.5)) {
                  const index = ((y + cy) * width + (x + cx)) * 4;
                  data[index] = r;
                  data[index + 1] = g;
                  data[index + 2] = b;
                }
              }
            }
            break;
        }
      }
    }
  };
};

// Implementation of stippling effect
const createStipplingEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    
    const density = Math.max(0.1, Math.min(10, settings.density || 1));
    const dotSize = Math.max(0.5, Math.min(5, settings.dotSize || 1));
    const useHatching = settings.useHatching || 0;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
    
    const baseSpacing = 10 / density;
    const maxDots = Math.ceil(width * height / (baseSpacing * baseSpacing) * 5);
    
    for (let i = 0; i < maxDots; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      const index = (y * width + x) * 4;
      const r = tempData[index];
      const g = tempData[index + 1];
      const b = tempData[index + 2];
      const brightness = (r + g + b) / 3 / 255;
      
      if (Math.random() > (1 - brightness) * density) continue;
      
      if (useHatching > 0.5) {
        const lineLength = Math.floor(5 + 10 * (1 - brightness));
        const angle = Math.PI * (brightness < 0.5 ? 0.25 : -0.25);
        
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        for (let j = -lineLength / 2; j < lineLength / 2; j++) {
          const px = Math.floor(x + j * dx);
          const py = Math.floor(y + j * dy);
          
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          
          const pixelIndex = (py * width + px) * 4;
          data[pixelIndex] = data[pixelIndex + 1] = data[pixelIndex + 2] = 0;
        }
      } else {
        const radius = dotSize * (1 - brightness) + 0.5;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              const px = Math.floor(x + dx);
              const py = Math.floor(y + dy);
              
              if (px < 0 || px >= width || py < 0 || py >= height) continue;
              
              const pixelIndex = (py * width + px) * 4;
              data[pixelIndex] = data[pixelIndex + 1] = data[pixelIndex + 2] = 0;
            }
          }
        }
      }
    }
  };
};

// Implementation of cellular automata effect (Conway's Game of Life)
const createCellularAutomataEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    
    const threshold = Math.max(0.1, Math.min(0.9, settings.threshold || 0.5));
    const iterations = Math.max(1, Math.min(10, Math.floor(settings.iterations || 3)));
    const cellSize = Math.max(1, Math.min(8, Math.floor(settings.cellSize || 2)));
    
    const cellWidth = Math.ceil(width / cellSize);
    const cellHeight = Math.ceil(height / cellSize);
    let grid = new Uint8Array(cellWidth * cellHeight);
    
    for (let cy = 0; cy < cellHeight; cy++) {
      for (let cx = 0; cx < cellWidth; cx++) {
        let totalBrightness = 0;
        let count = 0;
        
        for (let y = 0; y < cellSize && cy * cellSize + y < height; y++) {
          for (let x = 0; x < cellSize && cx * cellSize + x < width; x++) {
            const imgX = cx * cellSize + x;
            const imgY = cy * cellSize + y;
            const index = (imgY * width + imgX) * 4;
            
            const r = tempData[index];
            const g = tempData[index + 1];
            const b = tempData[index + 2];
            const brightness = (r + g + b) / 3 / 255;
            
            totalBrightness += brightness;
            count++;
          }
        }
        
        const avgBrightness = count > 0 ? totalBrightness / count : 0;
        grid[cy * cellWidth + cx] = avgBrightness < threshold ? 1 : 0;
      }
    }
    
    for (let iter = 0; iter < iterations; iter++) {
      const newGrid = new Uint8Array(cellWidth * cellHeight);
      
      for (let cy = 0; cy < cellHeight; cy++) {
        for (let cx = 0; cx < cellWidth; cx++) {
          const idx = cy * cellWidth + cx;
          const cell = grid[idx];
          
          let liveNeighbors = 0;
          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue;
              
              const ncy = (cy + ny + cellHeight) % cellHeight;
              const ncx = (cx + nx + cellWidth) % cellWidth;
              
              if (grid[ncy * cellWidth + ncx] === 1) {
                liveNeighbors++;
              }
            }
          }
          
          if (cell === 1) {
            newGrid[idx] = (liveNeighbors === 2 || liveNeighbors === 3) ? 1 : 0;
          } else {
            newGrid[idx] = (liveNeighbors === 3) ? 1 : 0;
          }
        }
      }
      
      grid = newGrid;
    }
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
    
    for (let cy = 0; cy < cellHeight; cy++) {
      for (let cx = 0; cx < cellWidth; cx++) {
        const cell = grid[cy * cellWidth + cx];
        
        if (cell === 1) {
          for (let y = 0; y < cellSize && cy * cellSize + y < height; y++) {
            for (let x = 0; x < cellSize && cx * cellSize + x < width; x++) {
              const imgX = cx * cellSize + x;
              const imgY = cy * cellSize + y;
              const index = (imgY * width + imgX) * 4;
              
              data[index] = data[index + 1] = data[index + 2] = 0;
            }
          }
        }
      }
    }
  };
};

// Implementation of reaction-diffusion effect (Gray-Scott model)
const createReactionDiffusionEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);
    
    const iterations = Math.max(1, Math.min(20, Math.floor(settings.iterations || 10)));
    const scale = Math.max(1, Math.min(8, Math.floor(settings.scale || 4)));
    const feedRate = Math.max(0.01, Math.min(0.1, settings.feedRate || 0.055));
    const killRate = Math.max(0.01, Math.min(0.1, settings.killRate || 0.062));
    
    const simWidth = Math.ceil(width / scale);
    const simHeight = Math.ceil(height / scale);
    
    let gridA = new Float32Array(simWidth * simHeight);
    let gridB = new Float32Array(simWidth * simHeight);
    
    for (let y = 0; y < simHeight; y++) {
      for (let x = 0; x < simWidth; x++) {
        let totalBrightness = 0;
        let count = 0;
        
        for (let sy = 0; sy < scale && y * scale + sy < height; sy++) {
          for (let sx = 0; sx < scale && x * scale + sx < width; sx++) {
            const imgX = x * scale + sx;
            const imgY = y * scale + sy;
            const index = (imgY * width + imgX) * 4;
            
            const r = tempData[index];
            const g = tempData[index + 1];
            const b = tempData[index + 2];
            const brightness = (r + g + b) / 3 / 255;
            
            totalBrightness += brightness;
            count++;
          }
        }
        
        const avgBrightness = count > 0 ? totalBrightness / count : 0;
        
        const idx = y * simWidth + x;
        gridA[idx] = avgBrightness < 0.4 ? 0.5 : 1.0;
        gridB[idx] = avgBrightness < 0.4 ? 0.25 : 0.0;
      }
    }
    
    const centerX = Math.floor(simWidth / 2);
    const centerY = Math.floor(simHeight / 2);
    const seedSize = Math.floor(Math.min(simWidth, simHeight) / 10);
    
    for (let y = -seedSize; y <= seedSize; y++) {
      for (let x = -seedSize; x <= seedSize; x++) {
        const sx = (centerX + x + simWidth) % simWidth;
        const sy = (centerY + y + simHeight) % simHeight;
        
        if (x*x + y*y <= seedSize*seedSize) {
          gridA[sy * simWidth + sx] = 0.5;
          gridB[sy * simWidth + sx] = 0.25;
        }
      }
    }
    
    const dA = 1.0;
    const dB = 0.5;
    const dt = 1.0;
    
    let nextA = new Float32Array(simWidth * simHeight);
    let nextB = new Float32Array(simWidth * simHeight);
    
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 0; y < simHeight; y++) {
        for (let x = 0; x < simWidth; x++) {
          const idx = y * simWidth + x;
          
          const a = gridA[idx];
          const b = gridB[idx];
          
          let laplA = 0;
          let laplB = 0;
          
          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue;
              
              const weight = (nx === 0 || ny === 0) ? 0.2 : 0.05;
              const nidx = ((y + ny + simHeight) % simHeight) * simWidth + ((x + nx + simWidth) % simWidth);
              
              laplA += weight * gridA[nidx];
              laplB += weight * gridB[nidx];
            }
          }
          
          laplA -= 0.95 * a;
          laplB -= 0.95 * b;
          
          const abb = a * b * b;
          const reaction = abb - (feedRate + killRate) * b;
          
          nextA[idx] = a + dt * (dA * laplA - abb + feedRate * (1 - a));
          nextB[idx] = b + dt * (dB * laplB + reaction);
          
          nextA[idx] = Math.max(0, Math.min(1, nextA[idx]));
          nextB[idx] = Math.max(0, Math.min(1, nextB[idx]));
        }
      }
      
      [gridA, nextA] = [nextA, gridA];
      [gridB, nextB] = [nextB, gridB];
    }
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const simX = Math.min(simWidth - 1, Math.floor(x / scale));
        const simY = Math.min(simHeight - 1, Math.floor(y / scale));
        const simIdx = simY * simWidth + simX;
        
        const a = gridA[simIdx];
        const b = gridB[simIdx];
        
        const index = (y * width + x) * 4;
        
        const val = Math.round(255 * (1 - b));
        
        data[index] = val;
        data[index + 1] = val;
        data[index + 2] = val;
      }
    }
  };
};

// Add new effect function for Pencil Sketch
const createPencilSketchEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const strength = settings.strength || 1.0;

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        continue;
      }

      const kernelX = [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
      ];
      const kernelY = [
        -1, -2, -1,
         0,  0,  0,
         1,  2,  1
      ];

      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          const neighborIndex = ((y + ky) * width + (x + kx)) * 4;
          const pixelValue = tempData[neighborIndex];
          
          gx += pixelValue * kernelX[kernelIndex];
          gy += pixelValue * kernelY[kernelIndex];
        }
      }

      const magnitude = 255 - Math.sqrt(gx * gx + gy * gy);
      const edgeValue = Math.min(255, Math.max(0, magnitude * strength));

      data[i] = data[i + 1] = data[i + 2] = edgeValue;
    }
  };
};

// Add new effect function for Halftone
const createHalftoneEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    const dotSize = settings.dotSize || 4;
    const spacing = settings.spacing || 5;
    const angle = (settings.angle || 45) * (Math.PI / 180);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    for (let y = 0; y < height; y += spacing) {
      for (let x = 0; x < width; x += spacing) {
        const rotatedX = x * cosAngle - y * sinAngle;
        const rotatedY = x * sinAngle + y * cosAngle;

        const centerX = Math.round(rotatedX / spacing) * spacing * cosAngle + Math.round(rotatedY / spacing) * spacing * sinAngle;
        const centerY = Math.round(rotatedY / spacing) * spacing * cosAngle - Math.round(rotatedX / spacing) * spacing * sinAngle;
        
        if (centerX < 0 || centerX >= width || centerY < 0 || centerY >= height) continue;

        const originalIndex = (Math.floor(centerY) * width + Math.floor(centerX)) * 4;
        const r = imageData.data[originalIndex];
        const g = imageData.data[originalIndex + 1];
        const b = imageData.data[originalIndex + 2];
        const brightness = (r + g + b) / (3 * 255);

        const radius = (1 - brightness) * dotSize;

        if (radius > 0.5) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = 'black';
          ctx.fill();
        }
      }
    }

    const halftoneData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = halftoneData[i];
      data[i + 1] = halftoneData[i + 1];
      data[i + 2] = halftoneData[i + 2];
      data[i + 3] = halftoneData[i + 3];
    }
  };
};

// Add new effect function for Duotone
const createDuotoneEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const color1 = settings.color1 ? hexToRgb(settings.color1) : { r: 0, g: 0, b: 255 }; 
    const color2 = settings.color2 ? hexToRgb(settings.color2) : { r: 255, g: 255, b: 0 };
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      const newR = color1.r * (1 - brightness) + color2.r * brightness;
      const newG = color1.g * (1 - brightness) + color2.g * brightness;
      const newB = color1.b * (1 - brightness) + color2.b * brightness;

      data[i] = Math.round(newR);
      data[i + 1] = Math.round(newG);
      data[i + 2] = Math.round(newB);
    }
  };
};

// Helper function to convert hex color (as number) to RGB object
const hexToRgb = (hex: number) => {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return { r, g, b };
};

// Add new effect function for Bloom
const createBloomEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const strength = settings.strength || 0.5;
    const radius = Math.round(settings.radius || 10);

    const originalData = new Uint8ClampedArray(data.length);
    originalData.set(data);

    const blurData = new Uint8ClampedArray(data.length);
    blurData.set(data);

    const kernelSize = radius * 2 + 1;
    const kernelArea = kernelSize * kernelSize;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const index = (py * width + px) * 4;
            
            sumR += blurData[index];
            sumG += blurData[index + 1];
            sumB += blurData[index + 2];
            count++;
          }
        }
        
        const pixelIndex = (y * width + x) * 4;
        data[pixelIndex] = sumR / count;
        data[pixelIndex + 1] = sumG / count;
        data[pixelIndex + 2] = sumB / count;
      }
    }
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      data[i] = Math.min(255, originalData[i] + data[i] * strength);
      data[i + 1] = Math.min(255, originalData[i + 1] + data[i + 1] * strength);
      data[i + 2] = Math.min(255, originalData[i + 2] + data[i + 2] * strength);
      data[i + 3] = originalData[i + 3];
    }
  };
};

// Add Kuwahara filter implementation
// Adapted from https://github.com/ogus/kuwahara
const createKuwaharaEffect = (settings: Record<string, number>) => {
  const radius = Math.round(settings.radius || 5); // Radius for the filter kernel

  // Helper function to calculate mean and variance for a region
  const calculateMeanVariance = (imageData: KonvaImageData, x: number, y: number, radius: number, quadrant: number) => {
    const { data, width, height } = imageData;
    let meanR = 0, meanG = 0, meanB = 0;
    let varianceR = 0, varianceG = 0, varianceB = 0;
    let count = 0;

    let startX = x - radius, startY = y - radius;
    let endX = x + radius, endY = y + radius;

    // Adjust start/end based on quadrant (0: TL, 1: TR, 2: BL, 3: BR)
    if (quadrant === 0) { endX = x; endY = y; }
    if (quadrant === 1) { startX = x; endY = y; }
    if (quadrant === 2) { endX = x; startY = y; }
    if (quadrant === 3) { startX = x; startY = y; }

    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const px = Math.min(width - 1, Math.max(0, cx));
        const py = Math.min(height - 1, Math.max(0, cy));
        const index = (py * width + px) * 4;

        meanR += data[index];
        meanG += data[index + 1];
        meanB += data[index + 2];
        count++;
      }
    }

    if (count === 0) return { mean: { r: 0, g: 0, b: 0 }, variance: Infinity };

    meanR /= count;
    meanG /= count;
    meanB /= count;

    // Calculate variance
    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const px = Math.min(width - 1, Math.max(0, cx));
        const py = Math.min(height - 1, Math.max(0, cy));
        const index = (py * width + px) * 4;

        varianceR += Math.pow(data[index] - meanR, 2);
        varianceG += Math.pow(data[index + 1] - meanG, 2);
        varianceB += Math.pow(data[index + 2] - meanB, 2);
      }
    }
    
    // Use combined variance (or just luminance variance for simplicity/performance)
    const totalVariance = (varianceR + varianceG + varianceB) / count; 

    return { mean: { r: meanR, g: meanG, b: meanB }, variance: totalVariance };
  };

  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVariance = Infinity;
        let bestMean = { r: 0, g: 0, b: 0 };

        // Calculate mean and variance for each quadrant
        for (let quadrant = 0; quadrant < 4; quadrant++) {
          const { mean, variance } = calculateMeanVariance({ data: tempData, width, height }, x, y, radius, quadrant);
          if (variance < minVariance) {
            minVariance = variance;
            bestMean = mean;
          }
        }

        // Set the pixel color to the mean of the quadrant with the minimum variance
        const index = (y * width + x) * 4;
        data[index] = Math.round(bestMean.r);
        data[index + 1] = Math.round(bestMean.g);
        data[index + 2] = Math.round(bestMean.b);
      }
    }
  };
};

// Add improved Vignette effect function
const createVignetteEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const amount = settings.amount ?? 0.5; // 0 to 1
    const falloff = settings.falloff ?? 0.5; // 0.1 to 1 (controls hardness)
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    // Pre-calculate for efficiency
    const scale = maxDist * falloff;
    const invAmount = 1.0 - amount;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate vignette factor (0 at edge, 1 at center)
        const factor = Math.max(0, Math.min(1, 1.0 - dist / scale));
        // Apply vignette: lerp between original color and black based on factor and amount
        const multiplier = factor * amount + invAmount;

        const index = (y * width + x) * 4;
        data[index] *= multiplier;
        data[index + 1] *= multiplier;
        data[index + 2] *= multiplier;
      }
    }
  };
};

// Add improved Chromatic Aberration effect function
const createChromaticAberrationEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const amount = settings.amount ?? 5;
    const angleRad = (settings.angle ?? 45) * (Math.PI / 180);
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Calculate offsets for R and B channels based on angle and amount
        const rOffsetX = Math.round(amount * cosAngle);
        const rOffsetY = Math.round(amount * sinAngle);
        const bOffsetX = -Math.round(amount * cosAngle);
        const bOffsetY = -Math.round(amount * sinAngle);

        // Sample Red channel from offset position
        const rX = Math.min(width - 1, Math.max(0, x + rOffsetX));
        const rY = Math.min(height - 1, Math.max(0, y + rOffsetY));
        const rIndex = (rY * width + rX) * 4;
        data[index] = tempData[rIndex]; // Red

        // Green channel remains at original position
        data[index + 1] = tempData[index + 1]; // Green

        // Sample Blue channel from offset position
        const bX = Math.min(width - 1, Math.max(0, x + bOffsetX));
        const bY = Math.min(height - 1, Math.max(0, y + bOffsetY));
        const bIndex = (bY * width + bX) * 4;
        data[index + 2] = tempData[bIndex + 2]; // Blue
        
        data[index + 3] = tempData[index + 3]; // Alpha
      }
    }
  };
};

// Add improved Scan Lines effect function
const createScanLinesEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const frequency = Math.max(1, settings.frequency ?? 5);
    const opacity = settings.opacity ?? 0.3;
    const multiplier = 1.0 - opacity; // How much to darken

    for (let y = 0; y < height; y++) {
      if (y % frequency === 0) { // Apply darkening every `frequency` pixels
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          data[index] *= multiplier;
          data[index + 1] *= multiplier;
          data[index + 2] *= multiplier;
        }
      }
    }
  };
};

// Crosshatch Effect
const createCrosshatchEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const spacing = settings.spacing ?? 5;
    const strength = settings.strength ?? 0.5;
    const lineOpacity = 1 - strength; // Darker lines for higher strength

    // Create a white background copy
    const outputData = new Uint8ClampedArray(data.length);
    for(let i=0; i<outputData.length; i+=4) {
      outputData[i] = outputData[i+1] = outputData[i+2] = 255;
      outputData[i+3] = data[i+3]; // Preserve alpha
    }

    // Draw diagonal lines based on original brightness
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index], g = data[index+1], b = data[index+2];
        const brightness = (r + g + b) / (3 * 255); // 0 (black) to 1 (white)
        const darkness = 1 - brightness;

        const angle1 = 45 * (Math.PI / 180);
        const angle2 = 135 * (Math.PI / 180);
        
        // Check if pixel falls on a line for angle 1
        if (Math.abs((x * Math.cos(angle1) + y * Math.sin(angle1))) % spacing < darkness * (spacing / 2)) {
          outputData[index] = outputData[index+1] = outputData[index+2] = 0; // Draw black line segment
        }
        // Check if pixel falls on a line for angle 2 (crosshatch)
        if (darkness > 0.5 && Math.abs((x * Math.cos(angle2) + y * Math.sin(angle2))) % spacing < (darkness - 0.5) * (spacing)) { 
          outputData[index] = outputData[index+1] = outputData[index+2] = 0; // Draw second set of lines for darker areas
        }
      }
    }
    // Copy result back
    data.set(outputData);
  };
};

// Dot Screen Effect
const createDotScreenEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const scale = settings.scale ?? 5;
    const angle = (settings.angle ?? 25) * (Math.PI / 180);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const outputData = new Uint8ClampedArray(data.length);
    for(let i=0; i<outputData.length; i+=4) {
      outputData[i] = outputData[i+1] = outputData[i+2] = 255;
      outputData[i+3] = data[i+3]; // Preserve alpha
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index], g = data[index+1], b = data[index+2];
        const avg = (r + g + b) / 3;
        
        // Rotate coordinate system
        const rotatedX = x * cosA - y * sinA;
        const rotatedY = x * sinA + y * cosA;
        
        // Calculate distance to nearest grid center & dot size
        const cellX = Math.round(rotatedX / scale);
        const cellY = Math.round(rotatedY / scale);
        const distToCenter = Math.sqrt(Math.pow(rotatedX - cellX * scale, 2) + Math.pow(rotatedY - cellY * scale, 2));
        const dotRadius = (1 - avg / 255) * (scale * 0.6); // Max dot size related to scale

        if (distToCenter <= dotRadius) {
          outputData[index] = outputData[index+1] = outputData[index+2] = 0; // Draw dot pixel
        }
      }
    }
    data.set(outputData);
  };
};

// Old Photo Effect (Sepia + Noise + Vignette)
const createOldPhotoEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const sepiaAmount = settings.sepia ?? 0.6;
    const noiseAmount = settings.noise ?? 0.1;
    const vignetteAmount = settings.vignette ?? 0.4;
    
    // 1. Apply Sepia (Custom implementation)
    if (sepiaAmount > 0) {
       for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const tr = 0.393 * r + 0.769 * g + 0.189 * b;
          const tg = 0.349 * r + 0.686 * g + 0.168 * b;
          const tb = 0.272 * r + 0.534 * g + 0.131 * b;

          // Lerp between original and sepia based on amount
          data[i] = r * (1 - sepiaAmount) + tr * sepiaAmount;
          data[i + 1] = g * (1 - sepiaAmount) + tg * sepiaAmount;
          data[i + 2] = b * (1 - sepiaAmount) + tb * sepiaAmount;
          
          // Clamp values
          data[i] = Math.min(255, data[i]);
          data[i + 1] = Math.min(255, data[i + 1]);
          data[i + 2] = Math.min(255, data[i + 2]);
       }
    }

    // 2. Apply Noise (Custom implementation)
    if (noiseAmount > 0) {
        const noiseFactor = noiseAmount * 255 * 0.5; // Scale noise
        for (let i = 0; i < data.length; i += 4) {
            const rand = (Math.random() - 0.5) * noiseFactor;
            data[i] = Math.min(255, Math.max(0, data[i] + rand));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + rand));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + rand));
        }
    }

    // 3. Apply Vignette (using the existing vignette function logic)
    if (vignetteAmount > 0) {
        const vignetteFunc = createVignetteEffect({ amount: vignetteAmount, falloff: 0.6 });
        vignetteFunc(imageData); // Apply vignette to the already modified data
    }
  };
};

// Pixel Sort Effect
const createPixelSortEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const threshold = (settings.threshold ?? 0.3) * 255;
    const axis = settings.axis ?? 0; // 0 for X, 1 for Y

    const getBrightness = (r:number, g:number, b:number) => 0.299 * r + 0.587 * g + 0.114 * b;

    if (axis === 0) { // Sort horizontally
      for (let y = 0; y < height; y++) {
        let sortStart = -1;
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const brightness = getBrightness(data[index], data[index+1], data[index+2]);
          if (brightness < threshold && sortStart === -1) {
            sortStart = x;
          } else if (brightness >= threshold && sortStart !== -1) {
            // Sort the segment
            const segment = [];
            for (let sx = sortStart; sx < x; sx++) {
              const sIndex = (y * width + sx) * 4;
              segment.push({ r: data[sIndex], g: data[sIndex+1], b: data[sIndex+2], brightness: getBrightness(data[sIndex], data[sIndex+1], data[sIndex+2]) });
            }
            segment.sort((a, b) => a.brightness - b.brightness);
            // Write back sorted segment
            for (let sx = sortStart; sx < x; sx++) {
              const sIndex = (y * width + sx) * 4;
              const sortedPixel = segment[sx - sortStart];
              data[sIndex] = sortedPixel.r; data[sIndex+1] = sortedPixel.g; data[sIndex+2] = sortedPixel.b;
            }
            sortStart = -1;
          }
        }
         // Handle segment reaching end of row
         if (sortStart !== -1) {
           const segment = [];
           for (let sx = sortStart; sx < width; sx++) {
             const sIndex = (y * width + sx) * 4;
             segment.push({ r: data[sIndex], g: data[sIndex+1], b: data[sIndex+2], brightness: getBrightness(data[sIndex], data[sIndex+1], data[sIndex+2]) });
           }
           segment.sort((a, b) => a.brightness - b.brightness);
           for (let sx = sortStart; sx < width; sx++) {
             const sIndex = (y * width + sx) * 4;
             const sortedPixel = segment[sx - sortStart];
             data[sIndex] = sortedPixel.r; data[sIndex+1] = sortedPixel.g; data[sIndex+2] = sortedPixel.b;
           }
         }
      }
    } else { // Sort vertically
      for (let x = 0; x < width; x++) {
        let sortStart = -1;
        for (let y = 0; y < height; y++) {
          const index = (y * width + x) * 4;
          const brightness = getBrightness(data[index], data[index+1], data[index+2]);
          if (brightness < threshold && sortStart === -1) {
            sortStart = y;
          } else if (brightness >= threshold && sortStart !== -1) {
            const segment = [];
            for (let sy = sortStart; sy < y; sy++) {
              const sIndex = (sy * width + x) * 4;
              segment.push({ r: data[sIndex], g: data[sIndex+1], b: data[sIndex+2], brightness: getBrightness(data[sIndex], data[sIndex+1], data[sIndex+2]) });
            }
            segment.sort((a, b) => a.brightness - b.brightness);
            for (let sy = sortStart; sy < y; sy++) {
              const sIndex = (sy * width + x) * 4;
              const sortedPixel = segment[sy - sortStart];
              data[sIndex] = sortedPixel.r; data[sIndex+1] = sortedPixel.g; data[sIndex+2] = sortedPixel.b;
            }
            sortStart = -1;
          }
        }
         if (sortStart !== -1) {
          const segment = [];
          for (let sy = sortStart; sy < height; sy++) {
            const sIndex = (sy * width + x) * 4;
            segment.push({ r: data[sIndex], g: data[sIndex+1], b: data[sIndex+2], brightness: getBrightness(data[sIndex], data[sIndex+1], data[sIndex+2]) });
          }
          segment.sort((a, b) => a.brightness - b.brightness);
          for (let sy = sortStart; sy < height; sy++) {
            const sIndex = (sy * width + x) * 4;
            const sortedPixel = segment[sy - sortStart];
            data[sIndex] = sortedPixel.r; data[sIndex+1] = sortedPixel.g; data[sIndex+2] = sortedPixel.b;
          }
        }
      }
    }
  };
};

// RGB Channel Shift Effect
const createRgbShiftEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const rOffset = Math.round(settings.rOffset ?? 4);
    const gOffset = Math.round(settings.gOffset ?? 0);
    const bOffset = Math.round(settings.bOffset ?? -4);

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Sample Red from offset
        const rX = Math.min(width - 1, Math.max(0, x + rOffset));
        const rIndex = (y * width + rX) * 4;
        data[index] = tempData[rIndex];

        // Sample Green from offset
        const gX = Math.min(width - 1, Math.max(0, x + gOffset));
        const gIndex = (y * width + gX) * 4;
        data[index + 1] = tempData[gIndex + 1];

        // Sample Blue from offset
        const bX = Math.min(width - 1, Math.max(0, x + bOffset));
        const bIndex = (y * width + bX) * 4;
        data[index + 2] = tempData[bIndex + 2];
        
        data[index + 3] = tempData[index + 3]; // Alpha
      }
    }
  };
};

// Flow Field Distortion (Simplified - displace based on noise angle)
// Requires a noise function (e.g., Perlin/Simplex). Placeholder for now.
// Simple random angle displacement:
const createFlowFieldEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    // const scale = settings.scale ?? 0.05; // Noise scale - not used in random version
    const strength = settings.strength ?? 5;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Read source pixels from tempData

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const destIndex = (y * width + x) * 4;
        
        // Simplified random displacement
        const angle = Math.random() * Math.PI * 2; 
        const displaceX = Math.round(Math.cos(angle) * strength);
        const displaceY = Math.round(Math.sin(angle) * strength);

        const sourceX = Math.min(width - 1, Math.max(0, x + displaceX));
        const sourceY = Math.min(height - 1, Math.max(0, y + displaceY));
        const sourceIndex = (sourceY * width + sourceX) * 4;

        // Write to destination pixel (data) from source pixel (tempData)
        data[destIndex] = tempData[sourceIndex];
        data[destIndex + 1] = tempData[sourceIndex + 1];
        data[destIndex + 2] = tempData[sourceIndex + 2];
        data[destIndex + 3] = tempData[sourceIndex + 3];
      }
    }
  };
};

// --- PLACEHOLDER FUNCTIONS FOR NEW EFFECTS ---

// 1. Glitch Art Implementation
const createGlitchArtEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const blockiness = settings.blockiness ?? 0.05;
    const colorShift = Math.round(settings.colorShift ?? 5);

    const blockHeight = Math.max(1, Math.floor(height * blockiness * Math.random()));
    const numBlocks = Math.floor(height / blockHeight);

    for (let block = 0; block < numBlocks; block++) {
      if (Math.random() < 0.3) { // Chance to glitch this block
        const startY = block * blockHeight;
        const endY = Math.min(height, startY + blockHeight);
        const shiftX = Math.floor((Math.random() - 0.5) * width * 0.1); // Max 10% shift
        
        // Horizontal shift
        const tempRow = new Uint8ClampedArray(width * blockHeight * 4);
        let tempIdx = 0;
        for(let y = startY; y < endY; y++) {
            for(let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                tempRow[tempIdx++] = data[idx];
                tempRow[tempIdx++] = data[idx+1];
                tempRow[tempIdx++] = data[idx+2];
                tempRow[tempIdx++] = data[idx+3];
            }
        }
        tempIdx = 0;
        for(let y = startY; y < endY; y++) {
            for(let x = 0; x < width; x++) {
                const targetX = (x - shiftX + width) % width; // Wrap around
                const idx = (y * width + x) * 4;
                const srcIdx = ((y - startY) * width + targetX) * 4; 
                data[idx] = tempRow[srcIdx];
                data[idx+1] = tempRow[srcIdx+1];
                data[idx+2] = tempRow[srcIdx+2];
                data[idx+3] = tempRow[srcIdx+3];
            }
        }
        
        // Color channel shift within the block
        if (colorShift > 0 && Math.random() < 0.5) {
            const rOffset = Math.floor((Math.random() - 0.5) * colorShift);
            const gOffset = Math.floor((Math.random() - 0.5) * colorShift);
            const bOffset = Math.floor((Math.random() - 0.5) * colorShift);
            
            for (let y = startY; y < endY; y++) {
              for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const rX = Math.min(width - 1, Math.max(0, x + rOffset));
                const gX = Math.min(width - 1, Math.max(0, x + gOffset));
                const bX = Math.min(width - 1, Math.max(0, x + bOffset));
                
                const rIdx = (y * width + rX) * 4;
                const gIdx = (y * width + gX) * 4;
                const bIdx = (y * width + bX) * 4;
                
                // Only copy shifted channels, keep original alpha
                data[index] = tempRow[rIdx]; // Shifted Red
                data[index + 1] = tempRow[gIdx + 1]; // Shifted Green
                data[index + 2] = tempRow[bIdx + 2]; // Shifted Blue
              }
            }
        }
      }
    }
  };
};

// 2. Color Quantization Implementation (Placeholder - Complex)
const createColorQuantizationEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) { 
      // TODO: Implement proper quantization (e.g., k-means) and dithering.
      // This is complex and potentially slow. Using Posterize as a fallback for now.
      const levels = Math.max(2, Math.floor(settings.numColors ?? 16));
      Konva.Filters.Posterize.call({ levels }, imageData);
  };
};

// 3. ASCII Art Implementation (Visual Approximation)
const createAsciiArtEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const scale = Math.max(1, Math.floor(settings.scale ?? 5)); // Size of the 'character' block
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    // Simple character set based on brightness (dark to light)
    const chars = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']; 
    const numChars = chars.length;

    for (let y = 0; y < height; y += scale) {
      for (let x = 0; x < width; x += scale) {
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;

        // Average color in the block
        for (let sy = 0; sy < scale && y + sy < height; sy++) {
          for (let sx = 0; sx < scale && x + sx < width; sx++) {
            const index = ((y + sy) * width + (x + sx)) * 4;
            sumR += tempData[index];
            sumG += tempData[index + 1];
            sumB += tempData[index + 2];
            count++;
          }
        }

        if (count > 0) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          const brightness = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
          
          // Map brightness to a character index (crude)
          const charIndex = Math.min(numChars - 1, Math.floor(brightness * numChars));
          
          // Instead of drawing char, use brightness to determine fill level (dither-like)
          const fillLevel = charIndex / (numChars - 1);
          const threshold = 0.5; // Dither threshold 

          for (let sy = 0; sy < scale && y + sy < height; sy++) {
            for (let sx = 0; sx < scale && x + sx < width; sx++) {
              const index = ((y + sy) * width + (x + sx)) * 4;
              // Basic dither pattern or just block color based on 'char brightness'
              const pixelVal = fillLevel > threshold ? 255 : 0; // Simple thresholding for now
              // A better approach might involve actual dither patterns based on charIndex
              data[index] = pixelVal;
              data[index + 1] = pixelVal;
              data[index + 2] = pixelVal;
              // Keep original alpha maybe? data[index + 3] = tempData[index + 3];
            }
          }
        }
      }
    }
  };
};

// 4. Edge Detection Implementation (Sobel)
const createEdgeDetectionEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const threshold = settings.threshold ?? 50;
    const shouldInvert = (settings.invert ?? 0) > 0.5;

    // First, convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }

    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
            const pixelValue = tempData[pixelIndex]; // Use grayscale value
            gx += pixelValue * kernelX[kernelIndex];
            gy += pixelValue * kernelY[kernelIndex];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edgeValue = magnitude > threshold ? 255 : 0;
        const finalValue = shouldInvert ? (255 - edgeValue) : edgeValue;
        
        const index = (y * width + x) * 4;
        data[index] = data[index + 1] = data[index + 2] = finalValue;
      }
    }
    // Handle borders (optional, set to black/white)
  };
};

// Implementation of Swirl Distortion (FIXED ANGLE LOGIC)
const createSwirlEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const radius = settings.radius ?? Math.min(width, height) / 2;
    const strength = settings.strength ?? 3;
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const index = (y * width + x) * 4;

        if (distance < radius) {
          const percent = distance / radius;
          // Angle adjustment based on distance and strength
          const angleOffset = strength * (1.0 - percent); // More twist closer to center
          const originalAngle = Math.atan2(dy, dx);
          const newAngle = originalAngle + angleOffset;
          
          const srcX = Math.round(centerX + Math.cos(newAngle) * distance);
          const srcY = Math.round(centerY + Math.sin(newAngle) * distance);

          if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
            const srcIndex = (srcY * width + srcX) * 4;
            data[index] = tempData[srcIndex];
            data[index + 1] = tempData[srcIndex + 1];
            data[index + 2] = tempData[srcIndex + 2];
            data[index + 3] = tempData[srcIndex + 3];
          } else {
             data[index + 3] = 0; // Make out-of-bounds pixels transparent
          }
        } 
        // Pixels outside radius are untouched (already copied by tempData)
      }
    }
  };
};

// Implementation of Mosaic (Adding data.set)
const createMosaicEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const tileSize = Math.max(1, Math.floor(settings.tileSize ?? 10));
    const outputData = new Uint8ClampedArray(data.length); // Write to output, read from original data

    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
        let count = 0;

        // Calculate average color within the tile (reading from original `data`)
        const endY = Math.min(y + tileSize, height);
        const endX = Math.min(x + tileSize, width);
        for (let ty = y; ty < endY; ty++) {
          for (let tx = x; tx < endX; tx++) {
            const index = (ty * width + tx) * 4;
            sumR += data[index];
            sumG += data[index + 1];
            sumB += data[index + 2];
            sumA += data[index + 3];
            count++;
          }
        }

        if (count > 0) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          const avgA = sumA / count;

          // Fill the tile in the outputData with the average color
          for (let ty = y; ty < endY; ty++) {
            for (let tx = x; tx < endX; tx++) {
              const index = (ty * width + tx) * 4;
              outputData[index] = avgR;
              outputData[index + 1] = avgG;
              outputData[index + 2] = avgB;
              outputData[index + 3] = avgA;
            }
          }
        }
      }
    }
    // Copy the result back to the original data array
    data.set(outputData);
  };
};

// 12. Kaleidoscope Implementation (REWRITTEN for clarity/safety)
const createKaleidoscopeEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const segments = Math.max(2, Math.floor(settings.segments ?? 6));
    const centerX = (settings.centerX ?? 0.5) * width;
    const centerY = (settings.centerY ?? 0.5) * height;
    const anglePerSegment = (Math.PI * 2) / segments;
    
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Use temp for reading source pixels
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        let angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Map angle to the first segment, reflecting if needed
        let segmentAngle = ((angle % anglePerSegment) + anglePerSegment) % anglePerSegment;
        if (segmentAngle > anglePerSegment / 2) {
            segmentAngle = anglePerSegment - segmentAngle;
        }
        
        // Calculate source coordinates
        const srcX = Math.round(centerX + Math.cos(segmentAngle) * distance);
        const srcY = Math.round(centerY + Math.sin(segmentAngle) * distance);
        const destIndex = (y * width + x) * 4;

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
            const srcIndex = (srcY * width + srcX) * 4;
            data[destIndex] = tempData[srcIndex];
            data[destIndex + 1] = tempData[srcIndex + 1];
            data[destIndex + 2] = tempData[srcIndex + 2];
            data[destIndex + 3] = tempData[srcIndex + 3];
        } else {
            data[destIndex] = 0;
            data[destIndex + 1] = 0;
            data[destIndex + 2] = 0;
            data[destIndex + 3] = 0; // Make out-of-bounds transparent black
        }
      }
    }
  };
};

// 15. Anaglyph 3D Implementation (REWRITTEN for clarity/safety)
const createAnaglyphEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const shift = Math.round(settings.shift ?? 5);
    const tempData = new Uint8ClampedArray(data.length);
    tempData.set(data); // Read source pixels from tempData

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const destIndex = (y * width + x) * 4;
        
        // Left eye pixel (for Red channel)
        const leftX = Math.min(width - 1, Math.max(0, x - shift));
        const leftIndex = (y * width + leftX) * 4;
        const leftR = tempData[leftIndex];
        const leftG = tempData[leftIndex + 1];
        const leftB = tempData[leftIndex + 2];
        const redValue = 0.299 * leftR + 0.587 * leftG + 0.114 * leftB; // Luminance

        // Right eye pixel (for Green, Blue channels)
        const rightX = Math.min(width - 1, Math.max(0, x + shift));
        const rightIndex = (y * width + rightX) * 4;
        const rightG = tempData[rightIndex + 1];
        const rightB = tempData[rightIndex + 2];
        const originalAlpha = tempData[destIndex + 3]; // Use original alpha

        // Combine into destination pixel (writing to `data`)
        data[destIndex] = Math.round(redValue);
        data[destIndex + 1] = rightG;
        data[destIndex + 2] = rightB;
        data[destIndex + 3] = originalAlpha; 
      }
    }
  };
};

// 14. Heatmap Implementation (REVISED)
const createHeatmapEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const gradientType = Math.floor(settings.gradientType ?? 0);

    // Define color gradients (example: [position, r, g, b])
    const gradients = [
      // Classic Rainbow (0)
      [[0, 0, 0, 255], [0.25, 0, 255, 255], [0.5, 0, 255, 0], [0.75, 255, 255, 0], [1, 255, 0, 0]],
      // Inferno (1) (perceptually uniform)
      [[0, 0, 0, 4], [0.25, 59, 18, 77], [0.5, 144, 41, 49], [0.75, 218, 87, 4], [1, 252, 175, 62]],
      // Grayscale (2)
      [[0, 0, 0, 0], [1, 255, 255, 255]],
      // Viridis (3) (perceptually uniform)
      [[0, 68, 1, 84], [0.25, 59, 82, 139], [0.5, 33, 145, 140], [0.75, 94, 201, 98], [1, 253, 231, 37]]
    ];
    const selectedGradient = gradients[gradientType % gradients.length];

    // Ensure lerp handles edge cases correctly
    const safeLerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

    const getColorFromGradient = (value: number) => {
        value = Math.max(0, Math.min(1, value)); // Clamp value to 0-1
        for (let i = 1; i < selectedGradient.length; i++) {
            const [prevPos, prevR, prevG, prevB] = selectedGradient[i - 1];
            const [currPos, currR, currG, currB] = selectedGradient[i];
            if (value <= currPos) {
                const range = currPos - prevPos;
                // Handle potential division by zero if positions are identical
                const t = (range === 0) ? 0 : (value - prevPos) / range;
                return [
                    Math.round(safeLerp(prevR, currR, t)),
                    Math.round(safeLerp(prevG, currG, t)),
                    Math.round(safeLerp(prevB, currB, t))
                ];
            }
        }
        // Should only reach here if value > 1 (handled by clamp), return last color
        const lastColor = selectedGradient[selectedGradient.length - 1];
        return [lastColor[1], lastColor[2], lastColor[3]]; 
    };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Calculate luminance (brightness)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      const [newR, newG, newB] = getColorFromGradient(brightness);
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
      // Keep original alpha: data[i + 3] stays the same
    }
  };
};

// Implementation of Color Temperature/Tint (REVISED for accuracy)
const createColorTemperatureEffect = (settings: Record<string, number>) => {
    return function(imageData: KonvaImageData) {
        const data = imageData.data;
        const temperature = settings.temperature ?? 0; // -100 to 100 (Cool to Warm)
        const tint = settings.tint ?? 0;           // -100 to 100 (Green to Magenta)
        
        // Convert temperature/tint sliders to approximate RGB multipliers
        // These are simplified approximations
        const tempFactor = temperature / 200.0; // Range -0.5 to 0.5
        const tintFactor = tint / 200.0;     // Range -0.5 to 0.5
        
        // Temperature affects Red and Blue inversely
        const redTempMultiplier = 1.0 + tempFactor; 
        const blueTempMultiplier = 1.0 - tempFactor;
        
        // Tint affects Green and Red/Blue inversely
        const greenTintMultiplier = 1.0 - tintFactor;
        const redBlueTintMultiplier = 1.0 + tintFactor;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Apply Temperature Shift
            r *= redTempMultiplier;
            b *= blueTempMultiplier;

            // Apply Tint Shift (affecting R/B and G)
            r *= redBlueTintMultiplier;
            g *= greenTintMultiplier;
            b *= redBlueTintMultiplier;
            
            // Clamp values
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
    };
};

// Initialize Konva when in browser environment
if (typeof window !== 'undefined') {
  console.log("Browser environment detected, initializing Konva");
  initKonva().catch(err => console.error("Failed to initialize Konva on module load:", err));
}

// Export helper for explicit initialization
export const ensureKonvaInitialized = initKonva;

// Export the configured effects
export const getFilterConfig = () => effectsConfig;

// Define all available effects with their settings
export const effectsConfig: Record<string, EffectConfig> = {
  // Basic Adjustments
  brightness: {
    label: 'Brightness',
    category: 'Basic',
    settings: {
      value: {
        label: 'Amount',
        min: -1,
        max: 1,
        default: 0,
        step: 0.01,
      },
    },
  },
  contrast: {
    label: 'Contrast',
    category: 'Basic',
    settings: {
      value: {
        label: 'Amount',
        min: -100,
        max: 100,
        default: 0,
        step: 1,
      },
    },
  },
  saturation: {
    label: 'Saturation',
    category: 'Basic',
    settings: {
      value: {
        label: 'Amount',
        min: -10,
        max: 10,
        default: 0,
        step: 0.1,
      },
    },
  },
  hue: {
    label: 'Hue Rotation',
    category: 'Basic',
    settings: {
      value: {
        label: 'Degrees',
        min: 0,
        max: 360,
        default: 0,
        step: 1,
      },
    },
  },
  
  // Filters
  grayscale: {
    label: 'Grayscale',
    category: 'Filters',
  },
  sepia: {
    label: 'Sepia',
    category: 'Filters',
  },
  invert: {
    label: 'Invert',
    category: 'Filters',
  },
  
  // Color Effects
  duotone: {
    label: 'Duotone',
    category: 'Color Effects',
    settings: {
      color1: { label: 'Color 1 (Hex#)', default: 0x0000ff },
      color2: { label: 'Color 2 (Hex#)', default: 0xffff00 },
    },
  },
  
  // Blur & Sharpen
  blur: {
    label: 'Blur',
    category: 'Blur & Sharpen',
    settings: {
      radius: {
        label: 'Radius',
        min: 0,
        max: 20,
        default: 5,
        step: 1,
      },
    },
  },
  sharpen: {
    label: 'Sharpen',
    category: 'Blur & Sharpen',
    settings: {
      value: {
        label: 'Amount',
        min: 0,
        max: 5,
        default: 0.5,
        step: 0.1,
      },
    },
  },
  
  // Distortion
  pixelate: {
    label: 'Pixelate',
    category: 'Distortion',
    settings: {
      pixelSize: {
        label: 'Pixel Size',
        min: 1,
        max: 32,
        default: 8,
        step: 1,
      },
    },
  },
  noise: {
    label: 'Noise',
    category: 'Distortion',
    settings: {
      value: {
        label: 'Amount',
        min: 0,
        max: 1,
        default: 0.2,
        step: 0.01,
      },
    },
  },
  
  // Updated Artistic Category
  threshold: {
    label: 'Threshold',
    category: 'Artistic',
    settings: {
      value: {
        label: 'Level',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
    },
  },
  posterize: {
    label: 'Posterize',
    category: 'Artistic',
    settings: {
      levels: {
        label: 'Levels',
        min: 2,
        max: 8,
        default: 4,
        step: 1,
      },
    },
  },
  pencilSketch: {
    label: 'Pencil Sketch',
    category: 'Artistic',
  },
  halftone: {
    label: 'Halftone',
    category: 'Artistic',
    settings: {
      dotSize: { label: 'Dot Size', min: 1, max: 10, default: 4, step: 1 },
      spacing: { label: 'Spacing', min: 1, max: 15, default: 5, step: 1 },
      angle: { label: 'Angle', min: 0, max: 180, default: 45, step: 5 },
    },
  },
  bloom: {
    label: 'Bloom',
    category: 'Artistic',
    settings: {
      strength: { label: 'Strength', min: 0, max: 2, default: 0.5, step: 0.1 },
      radius: { label: 'Radius', min: 0, max: 20, default: 10, step: 1 },
    },
  },
  oilPainting: {
    label: 'Oil Painting',
    category: 'Artistic',
    settings: {
      radius: { label: 'Brush Size', min: 1, max: 10, default: 5, step: 1 },
    },
  },
  vignette: {
    label: 'Vignette',
    category: 'Artistic',
    settings: {
      amount: { label: 'Amount', min: 0, max: 1, default: 0.5, step: 0.05 },
      falloff: { label: 'Falloff', min: 0.1, max: 1, default: 0.5, step: 0.05 },
    },
  },
  chromaticAberration: {
    label: 'Chromatic Aberration',
    category: 'Artistic',
    settings: {
      amount: { label: 'Amount', min: 0, max: 20, default: 5, step: 1 },
      angle: { label: 'Angle', min: 0, max: 360, default: 45, step: 5 },
    },
  },
  scanLines: {
    label: 'Scan Lines',
    category: 'Artistic',
    settings: {
      frequency: { label: 'Frequency', min: 1, max: 20, default: 5, step: 1 },
      opacity: { label: 'Opacity', min: 0, max: 1, default: 0.3, step: 0.05 },
    },
  },
  
  // Generative
  geometric: {
    label: 'Geometric',
    category: 'Generative',
    settings: {
      gridSize: {
        label: 'Grid Size',
        min: 4,
        max: 64,
        default: 16,
        step: 4,
      },
      complexity: {
        label: 'Complexity',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.1,
      },
    },
  },
  stippling: {
    label: 'Stippling',
    category: 'Generative',
    settings: {
      density: {
        label: 'Density',
        min: 0.1,
        max: 5,
        default: 1,
        step: 0.1,
      },
      dotSize: {
        label: 'Dot Size',
        min: 0.5,
        max: 3,
        default: 1,
        step: 0.1,
      },
      useHatching: {
        label: 'Use Hatching',
        min: 0,
        max: 1,
        default: 0,
        step: 1,
      },
    },
  },
  cellular: {
    label: 'Cellular',
    category: 'Generative',
    settings: {
      threshold: {
        label: 'Threshold',
        min: 0.1,
        max: 0.9,
        default: 0.5,
        step: 0.05,
      },
      iterations: {
        label: 'Iterations',
        min: 1,
        max: 10,
        default: 3,
        step: 1,
      },
      cellSize: {
        label: 'Cell Size',
        min: 1,
        max: 8,
        default: 2,
        step: 1,
      },
    },
  },
  'reaction-diffusion': {
    label: 'Reaction-Diffusion',
    category: 'Generative',
    settings: {
      iterations: {
        label: 'Iterations',
        min: 1,
        max: 20,
        default: 10,
        step: 1,
      },
      scale: {
        label: 'Scale',
        min: 1,
        max: 8,
        default: 4,
        step: 1,
      },
      feedRate: {
        label: 'Feed Rate',
        min: 0.01,
        max: 0.1,
        default: 0.055,
        step: 0.001,
      },
      killRate: {
        label: 'Kill Rate',
        min: 0.01,
        max: 0.1,
        default: 0.062,
        step: 0.001,
      },
    },
  },
  crosshatch: {
    label: 'Crosshatch',
    category: 'Artistic',
    settings: {
      spacing: { label: 'Line Spacing', min: 2, max: 10, default: 5, step: 1 },
      strength: { label: 'Line Strength', min: 0.1, max: 1, default: 0.5, step: 0.05 },
    },
  },
  dotScreen: {
    label: 'Dot Screen',
    category: 'Artistic',
    settings: {
      scale: { label: 'Scale', min: 1, max: 15, default: 5, step: 1 }, // Size/density relationship
      angle: { label: 'Angle', min: 0, max: 180, default: 25, step: 5 },
    },
  },
  oldPhoto: {
    label: 'Old Photo',
    category: 'Filters', // Changed category
    settings: {
      sepia: { label: 'Sepia', min: 0, max: 1, default: 0.6, step: 0.05 },
      noise: { label: 'Noise', min: 0, max: 0.3, default: 0.1, step: 0.01 },
      vignette: { label: 'Vignette', min: 0, max: 0.8, default: 0.4, step: 0.05 },
    },
  },
  pixelSort: {
    label: 'Pixel Sort',
    category: 'Distortion',
    settings: {
      threshold: { label: 'Brightness Threshold', min: 0, max: 1, default: 0.3, step: 0.01 },
      axis: { label: 'Axis (0=X, 1=Y)', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  rgbShift: {
    label: 'RGB Shift',
    category: 'Distortion',
    settings: {
      rOffset: { label: 'Red Offset X', min: -20, max: 20, default: 4, step: 1 },
      gOffset: { label: 'Green Offset X', min: -20, max: 20, default: 0, step: 1 },
      bOffset: { label: 'Blue Offset X', min: -20, max: 20, default: -4, step: 1 },
    },
  },
  flowField: {
    label: 'Flow Field',
    category: 'Generative',
    settings: {
      scale: { label: 'Noise Scale', min: 0.01, max: 0.2, default: 0.05, step: 0.005 },
      strength: { label: 'Distortion Strength', min: 1, max: 20, default: 5, step: 1 },
    },
  },
  
  // --- NEW EFFECTS START HERE ---
  
  // 1. Glitch Art
  glitchArt: {
    label: 'Glitch Art',
    category: 'Distortion', // Or maybe Artistic?
    settings: {
      blockiness: { label: 'Blockiness', min: 0, max: 0.3, default: 0.05, step: 0.01 },
      colorShift: { label: 'Color Shift', min: 0, max: 15, default: 5, step: 1 },
    },
  },
  
  // 2. Color Quantization
  colorQuantization: {
    label: 'Quantize Colors',
    category: 'Color Effects',
    settings: {
      numColors: { label: 'Number of Colors', min: 2, max: 64, default: 16, step: 1 },
      dithering: { label: 'Dithering (0=No, 1=Yes)', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  
  // 3. ASCII Art Conversion
  asciiArt: {
    label: 'ASCII Art',
    category: 'Artistic',
    settings: {
      // ASCII settings might be complex (charset, scale), placeholder for now
      scale: { label: 'Scale', min: 1, max: 10, default: 5, step: 1 }, 
    },
  },
  
  // 4. Edge Detection (Sobel)
  edgeDetection: {
    label: 'Edge Detection',
    category: 'Filters',
    settings: {
      threshold: { label: 'Threshold', min: 10, max: 150, default: 50, step: 5 },
      invert: { label: 'Invert Output (0=No, 1=Yes)', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  
  // 5. Swirl Distortion
  swirl: {
    label: 'Swirl',
    category: 'Distortion',
    settings: {
      radius: { label: 'Radius', min: 10, max: 500, default: 150, step: 10 },
      strength: { label: 'Strength', min: -10, max: 10, default: 3, step: 0.5 },
      centerX: { label: 'Center X (0-1)', min: 0, max: 1, default: 0.5, step: 0.01 },
      centerY: { label: 'Center Y (0-1)', min: 0, max: 1, default: 0.5, step: 0.01 },
    },
  },
  
  // 6. Lens Flare Simulation
  lensFlare: {
    label: 'Lens Flare',
    category: 'Filters',
    settings: {
      x: { label: 'Position X (0-1)', min: 0, max: 1, default: 0.2, step: 0.01 },
      y: { label: 'Position Y (0-1)', min: 0, max: 1, default: 0.2, step: 0.01 },
      strength: { label: 'Strength', min: 0.1, max: 2, default: 0.8, step: 0.05 },
    },
  },
  
  // 7. Color Temperature/Tint
  colorTemperature: {
    label: 'Temperature/Tint',
    category: 'Color Effects',
    settings: {
      temperature: { label: 'Temperature (Warm/Cool)', min: -100, max: 100, default: 0, step: 1 },
      tint: { label: 'Tint (Green/Magenta)', min: -100, max: 100, default: 0, step: 1 },
    },
  },
  
  // 8. Mosaic
  mosaic: {
    label: 'Mosaic',
    category: 'Artistic',
    settings: {
      tileSize: { label: 'Tile Size', min: 2, max: 50, default: 10, step: 1 },
      // shape: { label: 'Shape (0=Square, 1=Hex)', min: 0, max: 1, default: 0, step: 1 }, // Hex is more complex
    },
  },
  
  // 9. Selective Color
  selectiveColor: {
    label: 'Selective Color',
    category: 'Color Effects',
    settings: {
      // Needs a color picker UI. Placeholder settings.
      hue: { label: 'Target Hue (0-360)', min: 0, max: 360, default: 0, step: 1 },
      range: { label: 'Hue Range', min: 5, max: 90, default: 30, step: 1 },
      saturation: { label: 'Saturation Boost', min: 1, max: 5, default: 1.5, step: 0.1 },
    },
  },
  
  // 10. Fractal Noise Texture
  fractalNoise: {
    label: 'Fractal Noise',
    category: 'Filters',
    settings: {
      scale: { label: 'Scale', min: 0.01, max: 0.5, default: 0.1, step: 0.01 },
      opacity: { label: 'Opacity', min: 0, max: 1, default: 0.3, step: 0.05 },
      blendMode: { label: 'Blend (0=Overlay, 1=Multiply, ...)', min: 0, max: 5, default: 0, step: 1 }, // Needs mapping
    },
  },
  // --- NEW EFFECTS END HERE ---
  
  // --- MORE UNIQUE EFFECTS START HERE ---
  
  // 11. Voronoi Diagram Pattern
  voronoi: {
    label: 'Voronoi Pattern',
    category: 'Generative',
    settings: {
      numPoints: { label: 'Number of Points', min: 10, max: 500, default: 100, step: 10 },
      showLines: { label: 'Show Lines (0=No, 1=Yes)', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  
  // 12. Kaleidoscope Effect
  kaleidoscope: {
    label: 'Kaleidoscope',
    category: 'Distortion',
    settings: {
      segments: { label: 'Segments', min: 2, max: 20, default: 6, step: 1 },
      centerX: { label: 'Center X (0-1)', min: 0, max: 1, default: 0.5, step: 0.01 },
      centerY: { label: 'Center Y (0-1)', min: 0, max: 1, default: 0.5, step: 0.01 },
    },
  },
  
  // 13. Liquid Distortion / Ink Bleed
  inkBleed: {
    label: 'Ink Bleed',
    category: 'Artistic Simulation',
    settings: {
      amount: { label: 'Bleed Amount', min: 1, max: 15, default: 5, step: 1 },
      intensity: { label: 'Intensity Threshold', min: 0, max: 1, default: 0.3, step: 0.05 }, // Darker pixels bleed more
    },
  },
  
  // 14. Heatmap / False Color
  heatmap: {
    label: 'Heatmap',
    category: 'Color Effects',
    settings: {
      gradientType: { label: 'Gradient (0=Classic, 1=Inferno, ...)', min: 0, max: 3, default: 0, step: 1 }, // Needs mapping
    },
  },
  
  // 15. Anaglyph 3D (Red/Cyan)
  anaglyph: {
    label: 'Anaglyph 3D',
    category: 'Distortion',
    settings: {
      shift: { label: 'Horizontal Shift', min: 1, max: 20, default: 5, step: 1 },
    },
  },
  
  // 16. Scratched Film / CRT
  scratchedFilm: {
    label: 'Scratched Film',
    category: 'Filters',
    settings: {
      scratchDensity: { label: 'Scratch Density', min: 0, max: 0.1, default: 0.02, step: 0.005 },
      dustOpacity: { label: 'Dust Opacity', min: 0, max: 0.5, default: 0.1, step: 0.02 },
      flicker: { label: 'Flicker Amount', min: 0, max: 0.1, default: 0.03, step: 0.01 },
    },
  },
  
  // 17. Circuit Board Trace
  circuitBoard: {
    label: 'Circuit Board',
    category: 'Artistic',
    settings: {
      threshold: { label: 'Edge Threshold', min: 20, max: 150, default: 60, step: 5 },
      glow: { label: 'Glow Amount', min: 0, max: 5, default: 2, step: 0.5 },
    },
  },
  
  // 18. Pixel Explosion/Shatter
  pixelExplosion: {
    label: 'Pixel Explosion',
    category: 'Distortion',
    settings: {
      strength: { label: 'Explosion Strength', min: 5, max: 100, default: 30, step: 5 },
      numPoints: { label: 'Number of Centers', min: 1, max: 20, default: 5, step: 1 },
    },
  },
  
  // 19. Non-Linear Warp (Fisheye)
  fisheyeWarp: {
    label: 'Fisheye Warp',
    category: 'Distortion',
    settings: {
      strength: { label: 'Distortion Strength', min: -1, max: 1, default: 0.3, step: 0.05 },
    },
  },
  
  // 20. Procedural Texture Overlay
  procTexture: {
    label: 'Procedural Texture',
    category: 'Filters',
    settings: {
      textureType: { label: 'Texture (0=Wood, 1=Marble, ...)', min: 0, max: 2, default: 0, step: 1 }, // Needs mapping
      scale: { label: 'Texture Scale', min: 0.01, max: 0.5, default: 0.05, step: 0.01 },
      opacity: { label: 'Opacity', min: 0, max: 1, default: 0.4, step: 0.05 },
    },
  },
  // --- MORE UNIQUE EFFECTS END HERE ---
}; 

// 16. Scratched Film Implementation
const createScratchedFilmEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const scratchDensity = settings.scratchDensity ?? 0.02;
    const dustOpacity = settings.dustOpacity ?? 0.1;
    const flicker = settings.flicker ?? 0.03;

    // Apply flicker (slight random brightness change per frame)
    const flickerAmount = (Math.random() - 0.5) * flicker * 2;
    const brightnessMultiplier = 1.0 + flickerAmount;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * brightnessMultiplier);
        data[i+1] = Math.min(255, data[i+1] * brightnessMultiplier);
        data[i+2] = Math.min(255, data[i+2] * brightnessMultiplier);
    }

    // Add scratches
    const numScratches = Math.floor(width * height * scratchDensity * 0.01); // Adjust density scaling
    for (let i = 0; i < numScratches; i++) {
        const startX = Math.random() * width;
        const scratchLength = height * (0.2 + Math.random() * 0.8);
        const scratchColor = Math.random() * 50 + 20; // Darkish gray scratches
        for (let y = 0; y < scratchLength; y++) {
            const currentY = Math.floor(y + Math.random() * (height - scratchLength));
            if (currentY < 0 || currentY >= height) continue;
            const currentX = Math.floor(startX + (Math.random() - 0.5) * 2); // Slight horizontal jitter
             if (currentX < 0 || currentX >= width) continue;
            
            const index = (currentY * width + currentX) * 4;
            data[index] = scratchColor;
            data[index + 1] = scratchColor;
            data[index + 2] = scratchColor;
        }
    }
    
    // Add dust
    const numDust = Math.floor(width * height * 0.01); // Fixed dust amount for now
    for (let i = 0; i < numDust; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const index = (y * width + x) * 4;
        const dustValue = Math.random() * 50; // Dark dust
        const alpha = dustOpacity * 255;
        // Simple blend (could be improved)
        data[index] = data[index] * (1 - dustOpacity) + dustValue * dustOpacity;
        data[index+1] = data[index+1] * (1 - dustOpacity) + dustValue * dustOpacity;
        data[index+2] = data[index+2] * (1 - dustOpacity) + dustValue * dustOpacity;
    }
  };
};

// 10. Fractal Noise Implementation (Using Simple Random Noise as Placeholder)
const createFractalNoiseEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) { 
      const { data, width, height } = imageData;
      const opacity = settings.opacity ?? 0.3;
      // const scale = settings.scale ?? 0.1; // Scale not used in simple random noise

      for (let i = 0; i < data.length; i += 4) {
        // Generate simple random gray noise value
        const noiseVal = Math.random() * 255;
        // Blend with original pixel based on opacity (Overlay-like blend approx)
        data[i] = lerp(data[i], noiseVal, opacity);
        data[i+1] = lerp(data[i+1], noiseVal, opacity);
        data[i+2] = lerp(data[i+2], noiseVal, opacity);
      }
  };
};

// 20. Procedural Texture Implementation (Simple Wood Grain Placeholder)
const createProcTextureEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const scale = settings.scale ?? 0.05;
    const opacity = settings.opacity ?? 0.4;
    // textureType setting is ignored for this simple version

    // Basic pseudo-random function (replace with Perlin/Simplex if available)
    const pseudoRandom = (seed: number) => {
        let t = seed + 0.5;
        t = Math.sin(t * 12.9898);
        return t - Math.floor(t); 
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        // Simulate wood grain: noise influenced strongly by Y coordinate
        const noiseInput = (x * scale * 0.2) + (pseudoRandom(y * scale * 5.0) * 0.5); // Distort x based on y noise
        const noiseVal = (Math.sin(noiseInput * Math.PI * 2) + 1) / 2; // Create bands
        const woodColor = 100 + noiseVal * 80; // Brownish tones

        // Blend texture (Multiply blend approx)
        data[index] = data[index] * (1 - opacity) + data[index] * (woodColor / 255) * opacity;
        data[index + 1] = data[index + 1] * (1 - opacity) + data[index + 1] * (woodColor / 255) * 0.8 * opacity; // Slightly less green
        data[index + 2] = data[index + 2] * (1 - opacity) + data[index + 2] * (woodColor / 255) * 0.6 * opacity; // Even less blue
      }
    }
  };
};

// 17. Circuit Board Trace Implementation (REWRITTEN for clarity/safety)
const createCircuitBoardEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const threshold = settings.threshold ?? 60;
    const glowAmount = settings.glow ?? 2;

    // Create intermediate buffers
    const grayData = new Uint8ClampedArray(data.length);
    const edgeMap = new Uint8ClampedArray(width * height); // Store edge magnitudes
    const outputData = new Uint8ClampedArray(data.length); // Final output buffer

    // --- Edge Detection (Sobel) --- 
    // Grayscale conversion (read from `data`, write to `grayData`)
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      grayData[i] = grayData[i + 1] = grayData[i + 2] = avg;
      grayData[i + 3] = data[i + 3];
    }
    
    // Apply Sobel operator (read from `grayData`, store magnitude in `edgeMap`)
    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    let maxMagnitude = 0; // For potential normalization later if needed
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kIdx = (ky + 1) * 3 + (kx + 1);
            const pIdx = ((y + ky) * width + (x + kx)) * 4;
            gx += grayData[pIdx] * kernelX[kIdx];
            gy += grayData[pIdx] * kernelY[kIdx];
          }
        }
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude > threshold) {
          edgeMap[y * width + x] = Math.min(255, magnitude); // Store magnitude
          if(magnitude > maxMagnitude) maxMagnitude = magnitude;
        }
      }
    }
    // --- End Edge Detection ---

    // Set background in outputData
    const bgColor = [5, 10, 5, 255]; // Dark green background
    for (let i = 0; i < outputData.length; i += 4) {
        outputData[i]   = bgColor[0];
        outputData[i+1] = bgColor[1];
        outputData[i+2] = bgColor[2];
        outputData[i+3] = bgColor[3];
    }
    
    // Draw circuit lines with glow onto outputData
    const traceColor = [100, 255, 100, 255]; // Light green for traces (RGBA)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edgeMagnitude = edgeMap[y * width + x];
        if (edgeMagnitude > 0) { // If it's an edge pixel
          const index = (y * width + x) * 4;
          // Draw the main trace directly
          outputData[index]   = traceColor[0];
          outputData[index+1] = traceColor[1];
          outputData[index+2] = traceColor[2];
          outputData[index+3] = traceColor[3];
        }
      }
    }
    
    // Apply glow (reading edgeMap, writing to outputData)
    if (glowAmount > 0) {
        const glowRadius = Math.ceil(glowAmount);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                 // If current pixel is NOT an edge, check neighbors for glow
                 if (edgeMap[y * width + x] === 0) { 
                     let glowAccum = [0, 0, 0];
                     let totalWeight = 0;
                     for (let dy = -glowRadius; dy <= glowRadius; dy++) {
                         for (let dx = -glowRadius; dx <= glowRadius; dx++) {
                             if (dx === 0 && dy === 0) continue;
                             const nx = x + dx;
                             const ny = y + dy;
                             if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                 const neighborEdge = edgeMap[ny * width + nx];
                                 if (neighborEdge > 0) { // If neighbor is an edge
                                    const distSq = dx*dx + dy*dy;
                                    if (distSq <= glowRadius * glowRadius) {
                                        const weight = 1.0 - Math.sqrt(distSq) / glowRadius;
                                        glowAccum[0] += traceColor[0] * weight;
                                        glowAccum[1] += traceColor[1] * weight;
                                        glowAccum[2] += traceColor[2] * weight;
                                        totalWeight += weight;
                                    }
                                 }
                             }
                         }
                     }
                     if (totalWeight > 0) {
                         const index = (y * width + x) * 4;
                         const factor = 0.6 / totalWeight; // Adjust glow intensity/spread
                         outputData[index]   = Math.min(255, outputData[index] + glowAccum[0] * factor);
                         outputData[index+1] = Math.min(255, outputData[index+1] + glowAccum[1] * factor);
                         outputData[index+2] = Math.min(255, outputData[index+2] + glowAccum[2] * factor);
                     }
                 }
            }
        }
    }

    // Copy the final result back to the original data array
    data.set(outputData);
  };
};

// Implementation of Voronoi Pattern (Simplified - Nearest Point Color)
const createVoronoiEffect = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const { data, width, height } = imageData;
    const numPoints = Math.max(2, Math.floor(settings.numPoints ?? 100));
    const showLines = (settings.showLines ?? 0) > 0.5;
    const tempData = new Uint8ClampedArray(data.length); 
    tempData.set(data); // Keep original for color sampling

    // Generate random points
    const points: {x: number, y: number, r: number, g: number, b: number, a: number}[] = [];
    for (let i = 0; i < numPoints; i++) {
      const px = Math.floor(Math.random() * width);
      const py = Math.floor(Math.random() * height);
      const pIndex = (py * width + px) * 4;
      points.push({ 
          x: px, 
          y: py, 
          r: tempData[pIndex], 
          g: tempData[pIndex + 1], 
          b: tempData[pIndex + 2],
          a: tempData[pIndex + 3]
      });
    }

    // For each pixel, find the nearest point and assign its color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minDistSq = Infinity;
        let nearestPoint = points[0];
        for (const p of points) {
          const dx = x - p.x;
          const dy = y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nearestPoint = p;
          }
        }
        const index = (y * width + x) * 4;
        data[index] = nearestPoint.r;
        data[index + 1] = nearestPoint.g;
        data[index + 2] = nearestPoint.b;
        data[index + 3] = nearestPoint.a;
      }
    }

    // Optional: Draw lines (simple check for neighbor difference)
    if (showLines) {
        const lineColor = [0,0,0,255];
        const outputData = new Uint8ClampedArray(data.length); 
        outputData.set(data); // Draw lines on top of colored cells
         for (let y = 1; y < height-1; y++) {
           for (let x = 1; x < width-1; x++) {
              const index = (y * width + x) * 4;
              const r = data[index]; const g = data[index+1]; const b = data[index+2];
              // Check immediate neighbors
              const neighbors = [
                 (y * width + (x+1)) * 4, (y * width + (x-1)) * 4,
                 ((y+1) * width + x) * 4, ((y-1) * width + x) * 4
              ];
              let isBoundary = false;
              for(const nIndex of neighbors) {
                  if(data[nIndex] !== r || data[nIndex+1] !== g || data[nIndex+2] !== b) {
                     isBoundary = true; break;
                  }
              }
              if (isBoundary) {
                  outputData[index]   = lineColor[0];
                  outputData[index+1] = lineColor[1];
                  outputData[index+2] = lineColor[2];
                  outputData[index+3] = lineColor[3];
              }
           }
        }
        data.set(outputData);
    }
  };
};

// Placeholders remain for: Voronoi, InkBleed
const createVoronoiEffect = (settings: Record<string, number>) => { /* ... */ };
const createInkBleedEffect = (settings: Record<string, number>) => { /* ... */ };