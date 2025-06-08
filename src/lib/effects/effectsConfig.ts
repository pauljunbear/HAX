import { effects } from './index'
import { EffectsConfig, EffectCategories } from '@/types/effects'

export const effectsConfig: EffectsConfig = {
  orton: {
    label: 'Orton Effect',
    description: 'Creates a dreamy, ethereal glow',
    settings: {
      intensity: {
        min: 0,
        max: 100,
        default: 50,
        step: 1,
        label: 'Intensity'
      },
      radius: {
        min: 0,
        max: 100,
        default: 30,
        step: 1,
        label: 'Radius'
      }
    },
    apply: effects.orton
  },
  lightLeak: {
    label: 'Light Leak',
    description: 'Adds vintage film light leak effects',
    settings: {
      intensity: {
        min: 0,
        max: 100,
        default: 50,
        step: 1,
        label: 'Intensity'
      },
      angle: {
        min: 0,
        max: 360,
        default: 45,
        step: 1,
        label: 'Angle'
      }
    },
    apply: effects.lightLeak
  },
  smartSharpen: {
    label: 'Smart Sharpen',
    description: 'Intelligently sharpens details while reducing noise',
    settings: {
      amount: {
        min: 0,
        max: 100,
        default: 50,
        step: 1,
        label: 'Amount'
      },
      radius: {
        min: 0.1,
        max: 3,
        default: 1,
        step: 0.1,
        label: 'Radius'
      },
      threshold: {
        min: 0,
        max: 100,
        default: 10,
        step: 1,
        label: 'Threshold'
      }
    },
    apply: effects.smartSharpen
  },
  clarity: {
    label: 'Clarity',
    description: 'Enhances local contrast and detail',
    settings: {
      amount: {
        min: -100,
        max: 100,
        default: 50,
        step: 1,
        label: 'Amount'
      },
      radius: {
        min: 0,
        max: 100,
        default: 50,
        step: 1,
        label: 'Radius'
      }
    },
    apply: effects.clarity
  }
}

export const effectCategories: EffectCategories = {
  Enhancement: {
    name: 'Enhancement',
    description: 'Tools to improve image quality and detail',
    effects: ['smartSharpen', 'clarity']
  },
  Artistic: {
    name: 'Artistic',
    description: 'Creative effects for artistic expression',
    effects: ['orton', 'lightLeak']
  }
} 