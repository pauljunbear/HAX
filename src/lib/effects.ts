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
import { SelectionData } from '@/components/SelectionTool';

// Define interface for filter region
interface FilterRegion {
  selection: SelectionData;
  mode: 'selection' | 'inverse';
}

// Helper function to check if a point is inside a selection
const isPointInSelection = (x: number, y: number, selection: SelectionData): boolean => {
  if (!selection) return false;
  
  if (selection.type === 'rectangle') {
    return (
      x >= (selection.x || 0) &&
      x <= (selection.x || 0) + (selection.width || 0) &&
      y >= (selection.y || 0) &&
      y <= (selection.y || 0) + (selection.height || 0)
    );
  }
  
  if (selection.type === 'ellipse') {
    const centerX = (selection.x || 0) + (selection.width || 0) / 2;
    const centerY = (selection.y || 0) + (selection.height || 0) / 2;
    const radiusX = (selection.width || 0) / 2;
    const radiusY = (selection.height || 0) / 2;
    
    if (radiusX <= 0 || radiusY <= 0) return false;
    
    // Check if point is inside ellipse: (x-h)²/a² + (y-k)²/b² <= 1
    return Math.pow(x - centerX, 2) / Math.pow(radiusX, 2) + 
           Math.pow(y - centerY, 2) / Math.pow(radiusY, 2) <= 1;
  }
  
  if (selection.type === 'freehand' && selection.points) {
    // Point-in-polygon algorithm
    const points = selection.points;
    let inside = false;
    
    for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
      const xi = points[i];
      const yi = points[i + 1];
      const xj = points[j];
      const yj = points[j + 1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
      
      j = i;
    }
    
    return inside;
  }
  
  return false;
};

// Modify the function creation for custom brightness to handle masking
// Add this inside the applyEffect switch statement case 'brightness':
const createBrightnessFilter = (settings: Record<string, number>, filterRegion?: FilterRegion) => {
  return function(imageData: KonvaImageData) {
    const brightness = settings.value || 0;
    const data = imageData.data;
    const width = imageData.width;
    
    // Check if we have a filter region
    const hasRegion = !!filterRegion && !!filterRegion.selection;
    
    // Apply brightness filter
    for (let i = 0; i < data.length; i += 4) {
      // Calculate x,y position for this pixel
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      // Check if this pixel should be affected
      if (hasRegion) {
        const inSelection = isPointInSelection(x, y, filterRegion.selection);
        // Skip this pixel based on the filter mode
        if ((filterRegion.mode === 'selection' && !inSelection) || 
            (filterRegion.mode === 'inverse' && inSelection)) {
          continue;
        }
      }
      
      // Apply the brightness effect
      data[i] = Math.min(255, Math.max(0, data[i] + brightness * 255));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness * 255));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness * 255));
    }
  };
};

// Note: The brightness case will be used in the applyEffect function switch statement below

// Modify the createContrastFilter function to handle masking (adding below createBrightnessFilter)
const createContrastFilter = (settings: Record<string, number>, filterRegion?: FilterRegion) => {
  return function(imageData: KonvaImageData) {
    // Fix the contrast calculation - the original formula had issues
    const contrast = settings.value || 0; // Get contrast value directly, not divided by 100
    
    // Use a better formula for contrast adjustment
    // For a range of -100 to 100, this formula provides better results
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    const data = imageData.data;
    const width = imageData.width;
    
    // Check if we have a filter region
    const hasRegion = !!filterRegion && !!filterRegion.selection;
    
    for (let i = 0; i < data.length; i += 4) {
      // Calculate x,y position for this pixel
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      // Check if this pixel should be affected
      if (hasRegion) {
        const inSelection = isPointInSelection(x, y, filterRegion.selection);
        // Skip this pixel based on the filter mode
        if ((filterRegion.mode === 'selection' && !inSelection) || 
            (filterRegion.mode === 'inverse' && inSelection)) {
          continue;
        }
      }
      
      // Apply the contrast effect
      data[i] = Math.min(255, Math.max(0, Math.round(factor * (data[i] - 128) + 128)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 1] - 128) + 128)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(factor * (data[i + 2] - 128) + 128)));
    }
  };
};

// Note: The contrast case will be used in the applyEffect function switch statement below

// Update createSaturationFilter function to handle masking
const createSaturationFilter = (settings: Record<string, number>, filterRegion?: FilterRegion) => {
  return function(imageData: KonvaImageData) {
    const saturation = settings.value || 0;
    const data = imageData.data;
    const width = imageData.width;
    
    // Check if we have a filter region
    const hasRegion = !!filterRegion && !!filterRegion.selection;
    
    for (let i = 0; i < data.length; i += 4) {
      // Calculate x,y position for this pixel
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      // Check if this pixel should be affected
      if (hasRegion) {
        const inSelection = isPointInSelection(x, y, filterRegion.selection);
        // Skip this pixel based on the filter mode
        if ((filterRegion.mode === 'selection' && !inSelection) || 
            (filterRegion.mode === 'inverse' && inSelection)) {
          continue;
        }
      }
      
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert RGB to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        
        h /= 6;
      }
      
      // Adjust saturation
      s = Math.min(1, Math.max(0, s + saturation / 10)); // Scale saturation adjustment
      
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
  settings: Record<string, number>,
  filterRegion?: FilterRegion
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
        // Use the filter with masking if provided
        return [createBrightnessFilter(settings, filterRegion)];
      
      case 'contrast':
        // Use the filter with masking if provided
        return [createContrastFilter(settings, filterRegion)];
      
      case 'saturation':
        // Scale saturation value for better effect handling
        const scaledSaturation = settings.value ? settings.value / 10 : 0;
        
        // Use Konva's HSL filter if available and no masking
        if (Konva.Filters.HSL && !filterRegion) {
          return [Konva.Filters.HSL, { saturation: scaledSaturation }];
        }
        
        // Otherwise use our custom implementation with masking support
        return [createSaturationFilter({ ...settings, value: scaledSaturation }, filterRegion)];
      
      case 'hue':
        // Use Konva's HSL filter if available
        if (Konva.Filters.HSL) {
          return [Konva.Filters.HSL, { hue: settings.value || 0 }];
        }
        
        // Custom hue implementation
        return [
          function(imageData: KonvaImageData) {
            const hueAdjust = (settings.value || 0) / 360;
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Convert RGB to HSL
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              let h, s, l = (max + min) / 2;
              
              if (max === min) {
                h = s = 0; // achromatic
              } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                
                switch (max) {
                  case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                  case g: h = (b - r) / d + 2; break;
                  case b: h = (r - g) / d + 4; break;
                  default: h = 0;
                }
                
                h /= 6;
              }
              
              // Adjust hue
              h = (h + hueAdjust) % 1;
              
              // Convert back to RGB
              const adjustedColor = hslToRgb(h, s, l);
              data[i] = adjustedColor[0];
              data[i + 1] = adjustedColor[1];
              data[i + 2] = adjustedColor[2];
            }
          }
        ];
      
      case 'blur':
        // Optimized blur implementation with debouncing for better performance
        const blurRadius = Math.max(0, Math.min(20, settings.radius || 0));
        console.log("Applying blur with radius:", blurRadius);
        
        // Use a simpler and more efficient blur algorithm
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            // Create temporary copy of image data
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            // Optimize by using a smaller sample size for the blur effect
            // This significantly improves performance for larger radius values
            const sampleSize = Math.min(blurRadius, 5); // Limit the sample grid size
            const passes = Math.ceil(blurRadius / 5); // Apply multiple passes for larger blur radius
            
            // Apply multiple passes of a smaller blur for better performance with large radius values
            for (let pass = 0; pass < passes; pass++) {
              // Horizontal pass - much more efficient than a box blur
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
              
              // Update tempData for next pass
              tempData.set(data);
              
              // Vertical pass
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
              
              // Update tempData for next pass
              if (pass < passes - 1) {
                tempData.set(data);
              }
            }
          }
        ];
      
      case 'sharpen':
        const sharpenAmount = Math.max(0, Math.min(5, settings.amount || 0));
        console.log("Applying sharpen with amount:", sharpenAmount);
        
        // Custom sharpen implementation
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            const amount = sharpenAmount * 0.5;
            
            // Create temporary copy of image data
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            // Apply sharpening kernel
            for (let y = 1; y < height - 1; y++) {
              for (let x = 1; x < width - 1; x++) {
                const centerIndex = (y * width + x) * 4;
                
                for (let c = 0; c < 3; c++) {
                  // Apply kernel: [0,-1,0; -1,5,-1; 0,-1,0] * amount
                  const center = tempData[centerIndex + c];
                  const top = tempData[centerIndex - width * 4 + c];
                  const left = tempData[centerIndex - 4 + c];
                  const right = tempData[centerIndex + 4 + c];
                  const bottom = tempData[centerIndex + width * 4 + c];
                  
                  // Apply sharpening formula
                  const result = center * (1 + 4 * amount) - (top + left + right + bottom) * amount;
                  
                  // Clamp to valid range
                  data[centerIndex + c] = Math.min(255, Math.max(0, result));
                }
              }
            }
          }
        ];
      
      case 'pixelate':
        const pixelSize = Math.max(1, Math.min(32, settings.pixelSize || 8));
        console.log("Applying pixelate with size:", pixelSize);
        
        // Custom pixelate implementation
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            // Process blocks of pixels
            for (let y = 0; y < height; y += pixelSize) {
              for (let x = 0; x < width; x += pixelSize) {
                // Get the color of the top-left pixel in the block
                const sourceIndex = (y * width + x) * 4;
                const r = data[sourceIndex];
                const g = data[sourceIndex + 1];
                const b = data[sourceIndex + 2];
                
                // Apply this color to all pixels in the block
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
        
        // Custom noise implementation
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
        
        // Custom threshold implementation
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
        
        // Custom posterize implementation
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
        // Custom grayscale implementation
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
        // Custom sepia implementation
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
        // Custom invert implementation
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
      
      // Implement proper duotone effect based on color mapping
      case 'duotone':
        const darkHue = settings.darkColor / 360 || 0.67;
        const lightHue = settings.lightColor / 360 || 0.17;
        const duotoneIntensity = settings.intensity || 0.5;
        
        console.log("Applying duotone with dark:", settings.darkColor, "light:", settings.lightColor, "intensity:", duotoneIntensity);
        
        return [
          function(imageData: KonvaImageData) {
            if (!imageData || !imageData.data) return;
            
            const data = imageData.data;
            
            // First convert to grayscale
            for (let i = 0; i < data.length; i += 4) {
              // Use proper luminance formula for grayscale
              const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              
              // Normalize to 0-1 range for mapping
              const normalizedGray = gray / 255;
              
              // Get the dark and light colors from hue
              const darkColor = hslToRgb(darkHue, 0.8, 0.2);
              const lightColor = hslToRgb(lightHue, 0.8, 0.8);
              
              // Map grayscale to gradient between dark and light colors
              // based on the duotone algorithm from Simeon Nortey's approach
              data[i] = lerp(darkColor[0], lightColor[0], normalizedGray * duotoneIntensity + (1 - duotoneIntensity) * normalizedGray);
              data[i + 1] = lerp(darkColor[1], lightColor[1], normalizedGray * duotoneIntensity + (1 - duotoneIntensity) * normalizedGray);
              data[i + 2] = lerp(darkColor[2], lightColor[2], normalizedGray * duotoneIntensity + (1 - duotoneIntensity) * normalizedGray);
            }
          }
        ];
      
      // Implement proper halftone effect
      case 'halftone':
        const dotSize = Math.max(1, Math.min(20, settings.size || 4));
        const spacing = Math.max(1, Math.min(20, settings.spacing || 5));
        
        console.log("Applying halftone with dotSize:", dotSize, "spacing:", spacing);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            // Create a temporary copy of the image data
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            // Clear the original data to white
            for (let i = 0; i < data.length; i += 4) {
              data[i] = data[i + 1] = data[i + 2] = 255;
            }
            
            // Calculate cell size (spacing + dotSize)
            const cellSize = spacing + dotSize;
            
            // Draw halftone dots
            for (let y = 0; y < height; y += cellSize) {
              for (let x = 0; x < width; x += cellSize) {
                // Average the brightness in this cell
                let totalBrightness = 0;
                let count = 0;
                
                // Sample pixels in this cell
                for (let cy = 0; cy < cellSize && y + cy < height; cy++) {
                  for (let cx = 0; cx < cellSize && x + cx < width; cx++) {
                    const index = ((y + cy) * width + (x + cx)) * 4;
                    const r = tempData[index];
                    const g = tempData[index + 1];
                    const b = tempData[index + 2];
                    totalBrightness += (r + g + b) / 3;
                    count++;
                  }
                }
                
                if (count === 0) continue;
                
                // Calculate average brightness
                const avgBrightness = totalBrightness / count;
                
                // Scale dot radius based on brightness (invert so darker areas have bigger dots)
                const radius = (255 - avgBrightness) / 255 * dotSize;
                
                if (radius <= 0) continue;
                
                // Draw a dot centered in the cell
                const centerX = x + cellSize / 2;
                const centerY = y + cellSize / 2;
                
                // Draw filled circle
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    // Check if point is in circle
                    if (dx * dx + dy * dy <= radius * radius) {
                      const pixelX = Math.floor(centerX + dx);
                      const pixelY = Math.floor(centerY + dy);
                      
                      // Check bounds
                      if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                        const index = (pixelY * width + pixelX) * 4;
                        // Set to black
                        data[index] = data[index + 1] = data[index + 2] = 0;
                      }
                    }
                  }
                }
              }
            }
          }
        ];
        
      // Implement proper dithering effect based on Floyd-Steinberg algorithm
      case 'dithering':
        const ditherThreshold = Math.max(0, Math.min(1, settings.threshold || 0.5)) * 255;
        
        console.log("Applying dithering with threshold:", ditherThreshold);
        
        return [
          function(imageData: KonvaImageData) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            
            // Convert to grayscale and create a copy for processing
            const grayscale = new Uint8ClampedArray(width * height);
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Use proper luminance formula
              grayscale[i / 4] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
            
            // Apply Floyd-Steinberg dithering algorithm
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const oldPixel = grayscale[index];
                const newPixel = oldPixel < ditherThreshold ? 0 : 255;
                
                // Set the pixel in the output
                data[index * 4] = data[index * 4 + 1] = data[index * 4 + 2] = newPixel;
                
                // Calculate error
                const error = oldPixel - newPixel;
                
                // Distribute error to neighboring pixels
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
export const effectsConfig: Record<string, any> = {
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
      darkColor: {
        label: 'Dark Tone',
        min: 0,
        max: 360,
        default: 240,
        step: 1,
      },
      lightColor: {
        label: 'Light Tone',
        min: 0,
        max: 360,
        default: 60,
        step: 1,
      },
      intensity: {
        label: 'Intensity',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
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
      amount: {
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
      noise: {
        label: 'Amount',
        min: 0,
        max: 1,
        default: 0.2,
        step: 0.01,
      },
    },
  },
  
  // Artistic
  threshold: {
    label: 'Threshold',
    category: 'Artistic',
    settings: {
      threshold: {
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
  halftone: {
    label: 'Halftone',
    category: 'Artistic',
    settings: {
      size: {
        label: 'Dot Size',
        min: 1,
        max: 20,
        default: 4,
        step: 1,
      },
      spacing: {
        label: 'Spacing',
        min: 1,
        max: 20,
        default: 5,
        step: 1,
      },
    },
  },
  dithering: {
    label: 'Dithering',
    category: 'Artistic',
    settings: {
      threshold: {
        label: 'Threshold',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
    },
  },
}; 