// Local types to avoid missing global references
interface EffectCategoryLocal {
  id: string;
  name: string;
  icon?: string;
  effects: string[];
}

interface EffectParamLocal {
  min: number;
  max: number;
  default: number;
  step: number;
  labels?: string[];
}

interface EffectConfigLocal {
  name: string;
  params: Record<string, EffectParamLocal>;
}

export const effectCategories: EffectCategoryLocal[] = [
  {
    id: 'artistic',
    name: 'Artistic',
    icon: '🎨',
    effects: [
      'vintage',
      'retro',
      'film',
      'crossProcess',
      'lomo',
      'polaroid',
      'nashville',
      'gotham',
      'toaster',
      'orton',
    ],
  },
];

export const effectsConfig: Record<string, EffectConfigLocal> = {
  vintage: {
    name: 'Vintage',
    params: {
      intensity: { min: 0, max: 1, default: 0.7, step: 0.1 },
      vignette: { min: 0, max: 1, default: 0.3, step: 0.1 }
    }
  },
  toaster: {
    name: 'Toaster',
    params: {
      intensity: { min: 0, max: 1, default: 0.8, step: 0.1 }
    }
  },
  orton: {
    name: 'Orton Effect',
    params: {
      blur: { min: 5, max: 50, default: 20, step: 1 },
      brightness: { min: 0, max: 0.5, default: 0.2, step: 0.05 },
      glow: { min: 0, max: 1, default: 0.5, step: 0.1 },
      blendMode: { 
        min: 0, 
        max: 2, 
        default: 0, 
        step: 1,
        labels: ['Screen', 'Overlay', 'Soft Light']
      }
    }
  },
}; 