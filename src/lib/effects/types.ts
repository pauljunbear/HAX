'use client';

/**
 * Effect Types and Interfaces
 * Central type definitions for the effects system
 */

// Define the structure for effect settings
export interface EffectSetting {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  type?: string;
}

// Define the structure for effect configuration
export interface EffectConfig {
  label: string;
  category: string;
  settings?: EffectSetting[];
}

// Define interface for image data (Konva-compatible)
export interface KonvaImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Filter function type
export type KonvaFilterFunction = (imageData: KonvaImageData) => void;

// Filter parameters
export type FilterParams = Record<string, unknown>;

// Konva module type
export type KonvaModule = typeof import('konva') & {
  Filters: Record<string, KonvaFilterFunction>;
};

// Effect category definition
export interface EffectCategory {
  icon: string;
  description: string;
  effects: string[];
}

// Legacy effect alias mapping
export interface LegacyEffectAlias {
  unified: string;
  preset: number;
}
