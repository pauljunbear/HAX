// Use a loose type for Konva image nodes to avoid tight coupling to Konva typings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KonvaImage = Record<string, unknown>;

export interface EffectSetting {
  min: number;
  max: number;
  default: number;
  step: number;
  label: string;
  description?: string;
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
