import { effectsConfig } from './effectsConfig'
import Konva from 'konva'

export interface EffectSettings {
  [key: string]: number
}

export const applyEffect = async (
  imageNode: Konva.Image,
  effectId: string | null,
  settings: EffectSettings = {}
): Promise<void> => {
  if (!effectId || !effectsConfig[effectId]) {
    // Clear filters if no effect
    imageNode.filters([])
    return
  }

  try {
    const effect = effectsConfig[effectId]
    await effect.apply(imageNode, settings)
  } catch (error) {
    console.error('Error applying effect:', error)
    // Reset filters on error
    imageNode.filters([])
  }
}

export const getFilterConfig = (effectId: string | null) => {
  if (!effectId || !effectsConfig[effectId]) {
    return null
  }
  return effectsConfig[effectId]
}

export const ensureKonvaInitialized = () => {
  // Initialize Konva filters if needed
  if (!Konva.Filters) {
    Konva.Filters = {}
  }
}

export const getEffectSettings = (effectId: string | null): EffectSettings => {
  if (!effectId || !effectsConfig[effectId]) {
    return {}
  }
  
  const settings: EffectSettings = {}
  const effectConfig = effectsConfig[effectId]
  
  Object.entries(effectConfig.settings).forEach(([key, config]) => {
    settings[key] = config.default
  })
  
  return settings
}

export const validateSettings = (
  effectId: string,
  settings: EffectSettings
): EffectSettings => {
  if (!effectsConfig[effectId]) {
    return settings
  }

  const validatedSettings: EffectSettings = {}
  const effectConfig = effectsConfig[effectId]

  Object.entries(settings).forEach(([key, value]) => {
    const settingConfig = effectConfig.settings[key]
    if (settingConfig) {
      // Clamp value between min and max
      validatedSettings[key] = Math.min(
        Math.max(value, settingConfig.min),
        settingConfig.max
      )
    }
  })

  return validatedSettings
} 