import { Image as KonvaImage } from 'konva';

export interface EffectSetting {
  min: number;
  max: number;
  default: number;
  step: number;
  label: string;
}

export interface EffectConfig {
  label: string;
  description: string;
  settings: {
    [key: string]: EffectSetting;
  };
  apply: (imageNode: KonvaImage, settings: EffectSettings) => Promise<void>;
}

export interface EffectSettings {
  [key: string]: number;
}

export interface EffectCategory {
  name: string;
  description: string;
  effects: string[];
}

export interface EffectCategories {
  [key: string]: EffectCategory;
}

export interface EffectsConfig {
  [key: string]: EffectConfig;
}

export interface EffectPreviewState {
  isLoading: boolean;
  error: string | null;
  canvas: HTMLCanvasElement | null;
}

export interface PreviewSize {
  width: number;
  height: number;
} 