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

// Modify the function creation for custom brightness to handle masking
// Add this inside the applyEffect switch statement case 'brightness':
const createBrightnessFilter = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const brightness = settings.value || 0;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + brightness * 255));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness * 255));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness * 255));
    }
  };
};

// Note: The brightness case will be used in the applyEffect function switch statement below

// Modify the createContrastFilter function to handle masking (adding below createBrightnessFilter)
const createContrastFilter = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const contrast = settings.value || 0;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, Math.round(factor * (data[i] - 128) + 128)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 1] - 128) + 128)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 2] - 128) + 128)));
    }
  };
};

// Note: The contrast case will be used in the applyEffect function switch statement below

// Update createSaturationFilter function to handle masking
const createSaturationFilter = (settings: Record<string, number>) => {
  return function(imageData: KonvaImageData) {
    const saturation = settings.value || 0; // This value is already scaled -1 to 1
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Correct RGB to HSL conversion (normalize first)
      const r_norm = r / 255, g_norm = g / 255, b_norm = b / 255;
      const max_norm = Math.max(r_norm, g_norm, b_norm);
      const min_norm = Math.min(r_norm, g_norm, b_norm);
      let h = 0, s = 0, l = (max_norm + min_norm) / 2;

      if (max_norm !== min_norm) {
        const d = max_norm - min_norm;
        s = l > 0.5 ? d / (2 - max_norm - min_norm) : d / (max_norm + min_norm);
        switch (max_norm) {
          case r_norm: h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
          case g_norm: h = (b_norm - r_norm) / d + 2; break;
          case b_norm: h = (r_norm - g_norm) / d + 4; break;
        }
        h /= 6; // h is now 0-1
      }
      
      // Adjust saturation (remove the extra division by 10)
      s = Math.min(1, Math.max(0, s + saturation)); // Use the scaled value directly
      
      // Convert back to RGB
      const adjustedColor = hslToRgb(h, s, l);
      data[i] = adjustedColor[0];
      data[i + 1] = adjustedColor[1];
      data[i + 2] = adjustedColor[2];
    }
  };
};

// Note: The saturation case will be used in the applyEffect function switch statement below

// Modify the applyEffect function signature to accept a filterRegion parameter
export const applyEffect = async (
  effectName: string | null, 
  settings: Record<string, number>
) => {
  if (!effectName || typeof window === 'undefined') {
    console.log("Cannot apply effect: No effect name or not in browser");
    return [];
  }
  
  // Ensure Konva is initialized
  if (!Konva) {
    console.log("Konva not initialized yet, initializing now");
    try {
      await initKonva();
    } catch (err) {
      console.error("Failed to initialize Konva:", err);
      return [];
    }
    
    if (!Konva) {
      console.error("Konva still not initialized after attempt");
      return [];
    }
  }
  
  console.log(`Applying effect: ${effectName} with settings:`, settings);
  
  try {
    // Apply the specific effect
    switch (effectName) {
      case 'brightness':
        return [createBrightnessFilter(settings)];
      
      case 'contrast':
        return [createContrastFilter(settings)];
      
      case 'saturation':
        // Scale saturation value from UI range (-10 to 10) to effect range (-1 to 1)
        const scaledSaturation = settings.value ? settings.value / 10 : 0;
        // Use Konva's HSL filter if available
        if (Konva.Filters.HSL) {
          return [Konva.Filters.HSL, { saturation: scaledSaturation }];
        }
        // Otherwise use our custom implementation
        // Pass the already scaled value
        return [createSaturationFilter({ ...settings, value: scaledSaturation })];
      
      case 'hue':
        // Use Konva's HSL filter if available
        if (Konva.Filters.HSL) {
          return [Konva.Filters.HSL, { hue: settings.value || 0 }];
        }
        
        // Custom hue implementation with corrected HSL conversion
        return [
          function(imageData: KonvaImageData) {
            const hueAdjust = (settings.value || 0) / 360; // Hue is 0-360
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Correct RGB to HSL conversion
              const r_norm = r / 255, g_norm = g / 255, b_norm = b / 255;
              const max_norm = Math.max(r_norm, g_norm, b_norm);
              const min_norm = Math.min(r_norm, g_norm, b_norm);
              let h = 0, s = 0, l = (max_norm + min_norm) / 2;

              if (max_norm !== min_norm) {
                const d = max_norm - min_norm;
                s = l > 0.5 ? d / (2 - max_norm - min_norm) : d / (max_norm + min_norm);
                switch (max_norm) {
                  case r_norm: h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
                  case g_norm: h = (b_norm - r_norm) / d + 2; break;
                  case b_norm: h = (r_norm - g_norm) / d + 4; break;
                }
                h /= 6;
              }
              
              // Adjust hue
              h = (h + hueAdjust + 1) % 1; // Ensure positive modulo
              
              // Convert back to RGB
              const adjustedColor = hslToRgb(h, s, l);
              data[i] = adjustedColor[0];
              data[i + 1] = adjustedColor[1];
              data[i + 2] = adjustedColor[2];
            }
          }
        ];
      
      case 'blur':
        const blurRadius = Math.max(0, Math.min(20, settings.radius || 0));
        console.log("Applying blur with radius:", blurRadius);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            const sampleSize = Math.min(blurRadius, 5);
            const passes = Math.ceil(blurRadius / 5);
            
            for (let pass = 0; pass < passes; pass++) {
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  let r = 0, g = 0, b = 0, count = 0;
                  
                  for (let kx = -sampleSize; kx <= sampleSize; kx++) {
                    const px = Math.min(width - 1, Math.max(0, x + kx));
                    const index = (y * width + px) * 4;
                    
                    r += tempData[index];
                    g += tempData[index + 1];
                    b += tempData[index + 2];
                    count++;
                  }
                  
                  const pixelIndex = (y * width + x) * 4;
                  data[pixelIndex] = r / count;
                  data[pixelIndex + 1] = g / count;
                  data[pixelIndex + 2] = b / count;
                }
              }
              
              tempData.set(data);
              
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  let r = 0, g = 0, b = 0, count = 0;
                  
                  for (let ky = -sampleSize; ky <= sampleSize; ky++) {
                    const py = Math.min(height - 1, Math.max(0, y + ky));
                    const index = (py * width + x) * 4;
                    
                    r += tempData[index];
                    g += tempData[index + 1];
                    b += tempData[index + 2];
                    count++;
                  }
                  
                  const pixelIndex = (y * width + x) * 4;
                  data[pixelIndex] = r / count;
                  data[pixelIndex + 1] = g / count;
                  data[pixelIndex + 2] = b / count;
                }
              }
              
              if (pass < passes - 1) {
                tempData.set(data);
              }
            }
          }
        ];
      
      case 'sharpen':
        const sharpenAmount = Math.max(0, Math.min(5, settings.amount || 0));
        console.log("Applying sharpen with amount:", sharpenAmount);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            const amount = sharpenAmount * 0.5;
            
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            for (let y = 1; y < height - 1; y++) {
              for (let x = 1; x < width - 1; x++) {
                const centerIndex = (y * width + x) * 4;
                
                for (let c = 0; c < 3; c++) {
                  const center = tempData[centerIndex + c];
                  const top = tempData[centerIndex - width * 4 + c];
                  const left = tempData[centerIndex - 4 + c];
                  const right = tempData[centerIndex + 4 + c];
                  const bottom = tempData[centerIndex + width * 4 + c];
                  
                  const result = center * (1 + 4 * amount) - (top + left + right + bottom) * amount;
                  
                  data[centerIndex + c] = Math.min(255, Math.max(0, result));
                }
              }
            }
          }
        ];
      
      case 'pixelate':
        const pixelSize = Math.max(1, Math.min(32, settings.pixelSize || 8));
        console.log("Applying pixelate with size:", pixelSize);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            for (let y = 0; y < height; y += pixelSize) {
              for (let x = 0; x < width; x += pixelSize) {
                const sourceIndex = (y * width + x) * 4;
                const r = data[sourceIndex];
                const g = data[sourceIndex + 1];
                const b = data[sourceIndex + 2];
                
                for (let blockY = 0; blockY < pixelSize && y + blockY < height; blockY++) {
                  for (let blockX = 0; blockX < pixelSize && x + blockX < width; blockX++) {
                    const targetIndex = ((y + blockY) * width + (x + blockX)) * 4;
                    data[targetIndex] = r;
                    data[targetIndex + 1] = g;
                    data[targetIndex + 2] = b;
                  }
                }
              }
            }
          }
        ];
      
      case 'noise':
        const noise = Math.max(0, Math.min(1, settings.noise || 0.2));
        console.log("Applying noise with amount:", noise);
        
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            const amount = noise * 255;
            
            for (let i = 0; i < data.length; i += 4) {
              const random = (Math.random() * 2 - 1) * amount;
              
              data[i] = Math.min(255, Math.max(0, data[i] + random));
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + random));
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + random));
            }
          }
        ];
      
      case 'threshold':
        const threshold = Math.max(0, Math.min(1, settings.threshold || 0.5));
        console.log("Applying threshold with level:", threshold);
        
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            const thresholdValue = threshold * 255;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const v = (r + g + b) / 3;
              const value = v < thresholdValue ? 0 : 255;
              
              data[i] = data[i + 1] = data[i + 2] = value;
            }
          }
        ];
      
      case 'posterize':
        const levels = Math.max(2, Math.min(8, settings.levels || 4));
        console.log("Applying posterize with levels:", levels);
        
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            const step = 255 / (levels - 1);
            
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.round(Math.round(data[i] / step) * step);
              data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
              data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
            }
          }
        ];
      
      case 'grayscale':
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              
              data[i] = data[i + 1] = data[i + 2] = gray;
            }
          }
        ];
      
      case 'sepia':
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
              data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
              data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
            }
          }
        ];
      
      case 'invert':
        return [
          function(imageData: KonvaImageData) {
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
          }
        ];
      
      case 'duotone':
        return [createDuotoneEffect(settings)];
      
      case 'halftone':
        return [createHalftoneEffect(settings)];
      
      case 'dithering':
        const ditherThreshold = Math.max(0, Math.min(1, settings.threshold || 0.5)) * 255;
        
        console.log("Applying dithering with threshold:", ditherThreshold);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            const grayscale = new Uint8ClampedArray(width * height);
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              grayscale[i / 4] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const oldPixel = grayscale[index];
                const newPixel = oldPixel < ditherThreshold ? 0 : 255;
                
                data[index * 4] = data[index * 4 + 1] = data[index * 4 + 2] = newPixel;
                
                const error = oldPixel - newPixel;
                
                if (x + 1 < width) {
                  grayscale[index + 1] += error * 7 / 16;
                }
                if (y + 1 < height) {
                  if (x > 0) {
                    grayscale[(y + 1) * width + (x - 1)] += error * 3 / 16;
                  }
                  grayscale[(y + 1) * width + x] += error * 5 / 16;
                  if (x + 1 < width) {
                    grayscale[(y + 1) * width + (x + 1)] += error * 1 / 16;
                  }
                }
              }
            }
          }
        ];
      
      case 'geometric':
        return [createGeometricAbstraction(settings)];
      
      case 'stippling':
        return [createStipplingEffect(settings)];
      
      case 'cellular':
        return [createCellularAutomataEffect(settings)];
      
      case 'reaction-diffusion':
        return [createReactionDiffusionEffect(settings)];
      
      case 'pencilSketch':
        return [createPencilSketchEffect(settings)];
      
      case 'oilPainting':
        return [createKuwaharaEffect(settings)];
      
      case 'bloom':
        return [createBloomEffect(settings)];
      
      default:
        console.warn(`Unknown effect: ${effectName}`);
        return [];
    }
  } catch (error) {
    console.error(`Error applying effect ${effectName}:`, error);
    return [];
  }
};

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

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

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
      value: {
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
}; 