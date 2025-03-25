'use client';

// Use a dynamic import approach for Konva to avoid SSR issues
// Import Konva only in browser environment
let Konva: any = null;

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

// Initialize Konva only in the browser
if (typeof window !== 'undefined') {
  // We're in the browser, so it's safe to import Konva
  import('konva').then((module) => {
    Konva = module.default;
  });
}

// Apply the selected effect
export const applyEffect = (effectName: string | null, settings: Record<string, number>) => {
  if (!effectName || typeof window === 'undefined' || !Konva) {
    return [];
  }

  // Rest of your applyEffect function
  switch (effectName) {
    case 'brightness':
      return [Konva.Filters.Brighten];
    case 'contrast':
      return [Konva.Filters.Contrast];
    case 'blur':
      return [Konva.Filters.Blur];
    case 'sharpen':
      return [Konva.Filters.Sharpen];
    case 'pixelate':
      return [Konva.Filters.Pixelate];
    case 'noise':
      return [Konva.Filters.Noise];
    case 'threshold':
      return [Konva.Filters.Threshold];
    case 'grayscale':
      return [Konva.Filters.Grayscale];
    case 'sepia':
      return [Konva.Filters.Sepia];
    case 'invert':
      return [Konva.Filters.Invert];
    // Custom filter implementations
    case 'duotone':
    case 'posterize':
    case 'dithering':
    case 'halftone':
      return [customFilter];
    case 'hue':
    case 'saturation':
      return [Konva.Filters.HSL];
    default:
      return [];
  }
};

// Get filter configuration for the selected effect
export const getFilterConfig = (effectName: string | null, settings: Record<string, number>) => {
  if (!effectName || typeof window === 'undefined') {
    return {};
  }

  // Set filter-specific configuration
  switch (effectName) {
    case 'brightness':
      return { brightness: settings.value || 0 };
    case 'contrast':
      return { contrast: settings.value || 0 };
    case 'blur':
      return { blurRadius: settings.radius || 10 };
    case 'sharpen':
      return { sharpenAmount: settings.amount || 0.5 };
    case 'pixelate':
      return { pixelSize: settings.pixelSize || 8 };
    case 'noise':
      return { noise: settings.noise || 0.2 };
    case 'threshold':
      return { threshold: settings.threshold || 0.5 };
    case 'hue':
      return { hue: settings.value || 0 };
    case 'saturation':
      return { saturation: settings.value || 0, luminance: 0 };
    case 'posterize':
    case 'dithering':
    case 'halftone':
    case 'duotone':
      return { 
        customFilter: {
          name: effectName,
          settings: settings,
        },
      };
    default:
      return {};
  }
};

// Custom filter implementation for Konva
const customFilter = function(imageData: ImageData) {
  if (typeof window === 'undefined' || !Konva) return;
  
  // The actual filter operation will be passed via the customFilter.func
  // @ts-ignore: Konva type augmentation
  const filterSettings = this.customFilter || {};
  const effectName = filterSettings.name;
  const settings = filterSettings.settings || {};
  
  if (effectName && customFilters[effectName]) {
    customFilters[effectName](imageData, settings);
  }
};

// Custom filters for effects not natively supported by Konva
const customFilters: Record<string, any> = {
  // Duotone implementation
  duotone: (imageData: ImageData, settings: Record<string, number>) => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    const { data } = imageData;
    const darkHue = settings.darkColor || 240;
    const lightHue = settings.lightColor || 60;
    const intensity = settings.intensity || 0.5;
    
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale first
      const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      
      // Map grayscale value to a position between dark and light color
      const hue = gray < 0.5 
        ? darkHue + (lightHue - darkHue) * (gray * 2) * intensity
        : lightHue;
      
      // Convert HSL to RGB
      const saturation = 0.8;
      const lightness = gray;
      
      const rgb = hslToRgb(hue / 360, saturation, lightness);
      
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  },
  
  // Halftone effect
  halftone: (imageData: ImageData, settings: Record<string, number>) => {
    const { data, width, height } = imageData;
    const size = settings.size || 4;
    const spacing = settings.spacing || 5;
    const fullSize = size + spacing;
    
    // Create a new ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return imageData;
    
    tempCtx.putImageData(imageData, 0, 0);
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, width, height);
    
    // Draw halftone pattern
    for (let y = 0; y < height; y += fullSize) {
      for (let x = 0; x < width; x += fullSize) {
        const pixelIndex = (y * width + x) * 4;
        if (pixelIndex >= data.length) continue;
        
        // Get the brightness of this region
        const brightness = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3 / 255;
        const dotSize = size * (1 - brightness);
        
        tempCtx.fillStyle = 'black';
        tempCtx.beginPath();
        tempCtx.arc(
          x + fullSize / 2,
          y + fullSize / 2,
          dotSize / 2,
          0,
          Math.PI * 2
        );
        tempCtx.fill();
      }
    }
    
    // Copy back to original imageData
    const processedData = tempCtx.getImageData(0, 0, width, height);
    for (let i = 0; i < data.length; i++) {
      data[i] = processedData.data[i];
    }
    
    return imageData;
  },
  
  // Dithering effect (Floyd-Steinberg algorithm)
  dithering: (imageData: ImageData, settings: Record<string, number>) => {
    const { data, width, height } = imageData;
    const threshold = settings.threshold || 0.5;
    const thresholdValue = threshold * 255;
    
    // First convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    // Copy the data to avoid modifying it while iterating
    const newData = new Uint8ClampedArray(data);
    
    // Apply Floyd-Steinberg dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const oldPixel = data[idx];
        const newPixel = oldPixel < thresholdValue ? 0 : 255;
        newData[idx] = newData[idx + 1] = newData[idx + 2] = newPixel;
        
        const error = oldPixel - newPixel;
        
        // Distribute error to neighboring pixels
        if (x < width - 1) {
          data[idx + 4] += error * 7 / 16;
        }
        if (y < height - 1) {
          if (x > 0) {
            data[idx + width * 4 - 4] += error * 3 / 16;
          }
          data[idx + width * 4] += error * 5 / 16;
          if (x < width - 1) {
            data[idx + width * 4 + 4] += error * 1 / 16;
          }
        }
      }
    }
    
    // Copy back the new data
    for (let i = 0; i < data.length; i++) {
      data[i] = newData[i];
    }
    
    return imageData;
  },
};

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (typeof window === 'undefined') return [0, 0, 0];
  
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
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