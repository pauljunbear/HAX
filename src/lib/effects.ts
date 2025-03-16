'use client';

import Konva from 'konva';

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
};

// Function to apply the selected effect with settings
export const applyEffect = (
  effectName: string | null,
  settings: Record<string, number>
): Konva.Filter[] => {
  if (!effectName) return [];

  const filters: Konva.Filter[] = [];
  
  switch (effectName) {
    case 'brightness':
      filters.push(Konva.Filters.Brighten);
      return filters;
      
    case 'contrast':
      filters.push(Konva.Filters.Contrast);
      return filters;
      
    case 'saturation':
      filters.push(Konva.Filters.HSL);
      return filters;
      
    case 'hue':
      filters.push(Konva.Filters.HSL);
      return filters;
      
    case 'grayscale':
      filters.push(Konva.Filters.Grayscale);
      return filters;
      
    case 'blur':
      filters.push(Konva.Filters.Blur);
      return filters;
      
    case 'sharpen':
      filters.push(Konva.Filters.Enhance);
      return filters;
      
    case 'pixelate':
      filters.push(Konva.Filters.Pixelate);
      return filters;
      
    case 'noise':
      filters.push(Konva.Filters.Noise);
      return filters;
      
    case 'threshold':
      filters.push(Konva.Filters.Threshold);
      return filters;
      
    case 'invert':
      filters.push(Konva.Filters.Invert);
      return filters;
      
    case 'sepia':
      // Sepia is a combination of filters
      filters.push(Konva.Filters.Sepia);
      return filters;
      
    case 'posterize':
      // Custom implementation for posterize
      filters.push(Konva.Filters.Posterize);
      return filters;
      
    default:
      return [];
  }
};

// Function to get filter configuration for a specific effect
export const getFilterConfig = (
  effectName: string | null,
  settings: Record<string, number>
): Record<string, any> => {
  if (!effectName) return {};

  const config: Record<string, any> = {};
  
  switch (effectName) {
    case 'brightness':
      config.brightness = settings.value ?? effectsConfig.brightness.settings?.value.default ?? 0;
      return config;
      
    case 'contrast':
      config.contrast = settings.value ?? effectsConfig.contrast.settings?.value.default ?? 0;
      return config;
      
    case 'saturation':
      config.saturation = settings.value ?? effectsConfig.saturation.settings?.value.default ?? 0;
      return config;
      
    case 'hue':
      config.hue = settings.value ?? effectsConfig.hue.settings?.value.default ?? 0;
      return config;
      
    case 'blur':
      config.blurRadius = settings.radius ?? effectsConfig.blur.settings?.radius.default ?? 10;
      return config;
      
    case 'sharpen':
      config.enhance = settings.amount ?? effectsConfig.sharpen.settings?.amount.default ?? 0.5;
      return config;
      
    case 'pixelate':
      config.pixelSize = settings.pixelSize ?? effectsConfig.pixelate.settings?.pixelSize.default ?? 8;
      return config;
      
    case 'noise':
      config.noise = settings.noise ?? effectsConfig.noise.settings?.noise.default ?? 0.2;
      return config;
      
    case 'threshold':
      config.threshold = settings.threshold ?? effectsConfig.threshold.settings?.threshold.default ?? 0.5;
      return config;
      
    case 'posterize':
      config.levels = settings.levels ?? effectsConfig.posterize.settings?.levels.default ?? 4;
      return config;
      
    default:
      return {};
  }
}; 