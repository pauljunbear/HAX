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
        
        // Explicitly enable all filters we need
        if (!Konva.filters) {
          console.error("Konva filters not available");
          return Konva;
        }
        
        console.log("Available Konva filters:", Object.keys(Konva.Filters || {}));
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
        return [Konva.Filters.Brightness, { brightness: settings.value || 0 }];
      
      case 'contrast':
        return [Konva.Filters.Contrast, { contrast: settings.value / 100 || 0 }];
      
      case 'saturation':
        return [Konva.Filters.HSL, { saturation: settings.value || 0 }];
      
      case 'hue':
        return [Konva.Filters.HSL, { hue: settings.value || 0 }];
      
      case 'blur':
        // Make sure blur value is positive and reasonable
        const blurRadius = Math.max(0, Math.min(40, settings.radius || 0));
        console.log("Applying blur with radius:", blurRadius);
        return [Konva.Filters.Blur, { blurRadius: blurRadius }];
      
      case 'sharpen':
        const sharpenAmount = Math.max(0, Math.min(5, settings.amount || 0));
        console.log("Applying sharpen with amount:", sharpenAmount);
        return [Konva.Filters.Sharpen, { amount: sharpenAmount }];
      
      case 'pixelate':
        const pixelSize = Math.max(1, Math.min(32, settings.pixelSize || 8));
        console.log("Applying pixelate with size:", pixelSize);
        return [Konva.Filters.Pixelate, { pixelSize: pixelSize }];
      
      case 'noise':
        const noise = Math.max(0, Math.min(1, settings.noise || 0.2));
        console.log("Applying noise with amount:", noise);
        return [Konva.Filters.Noise, { noise: noise }];
      
      case 'threshold':
        const threshold = Math.max(0, Math.min(1, settings.threshold || 0.5));
        console.log("Applying threshold with level:", threshold);
        return [Konva.Filters.Threshold, { threshold: threshold }];
      
      case 'posterize':
        const levels = Math.max(2, Math.min(8, settings.levels || 4));
        console.log("Applying posterize with levels:", levels);
        return [Konva.Filters.Posterize, { levels: levels }];
      
      case 'grayscale':
        return [Konva.Filters.Grayscale];
      
      case 'sepia':
        return [Konva.Filters.Sepia];
      
      case 'invert':
        return [Konva.Filters.Invert];
      
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
      
      case 'halftone':
        return [
          function(imageData: any) {
            if (!imageData || !imageData.data) return;
            
            const data = imageData.data;
            const width = imageData.width;
            const height = imageData.height;
            
            // Create a temporary canvas to draw the halftone pattern
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (!tempCtx) return;
            
            // Draw the original image to the temporary canvas
            const origImgData = tempCtx.createImageData(width, height);
            origImgData.data.set(data);
            tempCtx.putImageData(origImgData, 0, 0);
            
            // Clear the original image data
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = 255;
            }
            
            // Apply halftone pattern
            const dotSize = settings.size || 4;
            const spacing = settings.spacing || 5;
            
            tempCtx.fillStyle = 'black';
            
            for (let y = 0; y < height; y += spacing) {
              for (let x = 0; x < width; x += spacing) {
                // Get average brightness of the corresponding area in the original image
                const brightness = getBrightness(origImgData, x, y, spacing, width, height);
                
                // Draw a circle with size proportional to brightness
                const radius = brightness * dotSize / 255;
                tempCtx.beginPath();
                tempCtx.arc(x + spacing / 2, y + spacing / 2, radius, 0, Math.PI * 2);
                tempCtx.fill();
              }
            }
            
            // Copy the halftone pattern back to the original image data
            const halftoneData = tempCtx.getImageData(0, 0, width, height);
            data.set(halftoneData.data);
          }
        ];
      
      case 'dithering':
        return [
          function(imageData: any) {
            if (!imageData || !imageData.data) return;
            
            const data = imageData.data;
            const width = imageData.width;
            const height = imageData.height;
            
            // Convert to grayscale
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              data[i] = data[i + 1] = data[i + 2] = gray;
            }
            
            const threshold = settings.threshold * 255 || 128;
            
            // Apply Floyd-Steinberg dithering
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const oldPixel = data[i];
                const newPixel = oldPixel < threshold ? 0 : 255;
                data[i] = data[i + 1] = data[i + 2] = newPixel;
                
                const error = oldPixel - newPixel;
                
                // Distribute error to neighboring pixels
                if (x + 1 < width) {
                  data[i + 4] += error * 7 / 16;
                  data[i + 5] += error * 7 / 16;
                  data[i + 6] += error * 7 / 16;
                }
                
                if (y + 1 < height) {
                  if (x - 1 >= 0) {
                    data[i + width * 4 - 4] += error * 3 / 16;
                    data[i + width * 4 - 3] += error * 3 / 16;
                    data[i + width * 4 - 2] += error * 3 / 16;
                  }
                  
                  data[i + width * 4] += error * 5 / 16;
                  data[i + width * 4 + 1] += error * 5 / 16;
                  data[i + width * 4 + 2] += error * 5 / 16;
                  
                  if (x + 1 < width) {
                    data[i + width * 4 + 4] += error * 1 / 16;
                    data[i + width * 4 + 5] += error * 1 / 16;
                    data[i + width * 4 + 6] += error * 1 / 16;
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