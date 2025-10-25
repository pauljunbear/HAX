import Konva from 'konva'
import OrtonFilter from './ortonEffect'
import LightLeakFilter from './lightLeakEffect'
import SmartSharpenFilter from './smartSharpenEffect'
import { effectsConfig, effectCategories } from './effectsConfig'
import { 
  applyEffect,
  getFilterConfig,
  ensureKonvaInitialized,
  getEffectSettings,
  validateSettings,
  type EffectSettings
} from './effectsUtils'

export const effects = {
  orton: async (imageNode: Konva.Image, settings: Record<string, number> = {}) => {
    imageNode.filters([OrtonFilter as any])
    ;(imageNode as any).ortonIntensity?.(settings.intensity ?? 0.7)
    ;(imageNode as any).ortonBlurRadius?.(settings.radius ?? 15)
    ;(imageNode as any).ortonContrast?.(settings.contrast ?? 1.3)
    ;(imageNode as any).ortonSaturation?.(settings.saturation ?? 1.2)
    ;(imageNode as any).ortonExposure?.(settings.exposure ?? 1.4)
    ;(imageNode as any).ortonBlend?.(settings.blend ?? 0.6)
  },
  lightLeak: async (imageNode: Konva.Image, settings: Record<string, number> = {}) => {
    imageNode.filters([LightLeakFilter as any])
    ;(imageNode as any).lightLeakIntensity?.(settings.intensity ?? 0.6)
    ;(imageNode as any).lightLeakColorR?.(settings.colorR ?? 255)
    ;(imageNode as any).lightLeakColorG?.(settings.colorG ?? 200)
    ;(imageNode as any).lightLeakColorB?.(settings.colorB ?? 100)
    ;(imageNode as any).lightLeakPositionX?.(settings.posX ?? 0.8)
    ;(imageNode as any).lightLeakPositionY?.(settings.posY ?? 0.2)
    ;(imageNode as any).lightLeakSize?.(settings.size ?? 0.4)
    ;(imageNode as any).lightLeakSpread?.(settings.spread ?? 0.6)
    ;(imageNode as any).lightLeakSoftness?.(settings.softness ?? 0.7)
    ;(imageNode as any).lightLeakAngle?.(settings.angle ?? Math.PI / 4)
    ;(imageNode as any).lightLeakOpacity?.(settings.opacity ?? 0.8)
    ;(imageNode as any).lightLeakBlendMode?.(settings.blendMode ?? 'screen')
  },
  smartSharpen: async (imageNode: Konva.Image, settings: Record<string, number> = {}) => {
    imageNode.filters([SmartSharpenFilter as any])
    ;(imageNode as any).smartSharpenAmount?.(settings.amount ?? 1.0)
    ;(imageNode as any).smartSharpenRadius?.(settings.radius ?? 1.0)
    ;(imageNode as any).smartSharpenThreshold?.(settings.threshold ?? 10)
    ;(imageNode as any).smartSharpenNoiseReduction?.(settings.noiseReduction ?? 0.3)
    ;(imageNode as any).smartSharpenEdgeMode?.(settings.edgeMode ?? 'sobel')
    ;(imageNode as any).smartSharpenPreserveDetails?.(settings.preserveDetails ?? true)
  },
}

export {
  effectsConfig,
  effectCategories,
  applyEffect,
  getFilterConfig,
  ensureKonvaInitialized,
  getEffectSettings,
  validateSettings,
  type EffectSettings
} 