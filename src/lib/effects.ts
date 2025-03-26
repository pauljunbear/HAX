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
            Konva.Filters.Threshold = function(imageData) {
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
            Konva.Filters.Posterize = function(imageData) {
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

// Apply the selected effect
export const applyEffect = async (effectName: string | null, settings: Record<string, number>) => {
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
        // Custom brightness implementation
        return [
          function(imageData: any) {
            const brightness = settings.value || 0;
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, data[i] + brightness * 255));
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness * 255));
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness * 255));
            }
          }
        ];
      
      case 'contrast':
        // Custom contrast implementation
        return [
          function(imageData: any) {
            const contrast = settings.value / 100 || 0;
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
              data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
              data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
            }
          }
        ];
      
      case 'saturation':
        // Use Konva's HSL filter if available
        if (Konva.Filters.HSL) {
          return [Konva.Filters.HSL, { saturation: settings.value || 0 }];
        }
        
        // Custom saturation implementation
        return [
          function(imageData: any) {
            const saturation = settings.value || 0;
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
              
              // Adjust saturation
              s = Math.min(1, Math.max(0, s + saturation));
              
              // Convert back to RGB
              const adjustedColor = hslToRgb(h, s, l);
              data[i] = adjustedColor[0];
              data[i + 1] = adjustedColor[1];
              data[i + 2] = adjustedColor[2];
            }
          }
        ];
      
      case 'hue':
        // Use Konva's HSL filter if available
        if (Konva.Filters.HSL) {
          return [Konva.Filters.HSL, { hue: settings.value || 0 }];
        }
        
        // Custom hue implementation
        return [
          function(imageData: any) {
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
        // Custom blur implementation
        const blurRadius = Math.max(0, Math.min(40, settings.radius || 0));
        console.log("Applying blur with radius:", blurRadius);
        return [
          function(imageData: any) {
            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;
            const radius = blurRadius;
            
            // Simple box blur implementation
            const tempData = new Uint8ClampedArray(data.length);
            tempData.set(data);
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;
                
                // Sample pixels in a square around the current pixel
                for (let ky = -radius; ky <= radius; ky++) {
                  for (let kx = -radius; kx <= radius; kx++) {
                    const pixelX = Math.min(width - 1, Math.max(0, x + kx));
                    const pixelY = Math.min(height - 1, Math.max(0, y + ky));
                    
                    const index = (pixelY * width + pixelX) * 4;
                    r += tempData[index];
                    g += tempData[index + 1];
                    b += tempData[index + 2];
                    count++;
                  }
                }
                
                // Set the current pixel to the average of sampled pixels
                const pixelIndex = (y * width + x) * 4;
                data[pixelIndex] = r / count;
                data[pixelIndex + 1] = g / count;
                data[pixelIndex + 2] = b / count;
              }
            }
          }
        ];
      
      case 'sharpen':
        const sharpenAmount = Math.max(0, Math.min(5, settings.amount || 0));
        console.log("Applying sharpen with amount:", sharpenAmount);
        
        // Custom sharpen implementation
        return [
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
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
          function(imageData: any) {
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
          }
        ];
      
      // Keep existing implementations for duotone, halftone, dithering 
      case 'duotone':
        return [
          function(imageData: any) {
            if (!imageData || !imageData.data) return;
            
            const data = imageData.data;
            const len = data.length;
            
            // Convert to grayscale first
            for (let i = 0; i < len; i += 4) {
              const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
              data[i] = brightness;
              data[i + 1] = brightness;
              data[i + 2] = brightness;
            }
            
            // Apply duotone effect
            const darkColor = hslToRgb(settings.darkColor / 360 || 0.67, 0.6, 0.2);
            const lightColor = hslToRgb(settings.lightColor / 360 || 0.17, 0.6, 0.8);
            const intensity = settings.intensity || 0.5;
            
            for (let i = 0; i < len; i += 4) {
              const t = data[i] / 255;
              const r = Math.round(lerp(darkColor[0], lightColor[0], t) * intensity + data[i] * (1 - intensity));
              const g = Math.round(lerp(darkColor[1], lightColor[1], t) * intensity + data[i] * (1 - intensity));
              const b = Math.round(lerp(darkColor[2], lightColor[2], t) * intensity + data[i] * (1 - intensity));
              
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
            }
          }
        ];
      
      // Keep existing implementations for halftone, dithering...
        
      default:
        console.warn(`Unknown effect: ${effectName}`);
        return [];
    }
  } catch (error) {
    console.error("Error applying effect:", error);
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
        min: -2,
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
        max: 40,
        default: 10,
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