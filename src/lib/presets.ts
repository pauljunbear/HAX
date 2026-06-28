/**
 * STUDIO "Looks" — curated multi-layer recipes.
 *
 * The whole point: a Look is NOT a monolithic effect. Applying one drops its
 * constituent layers into the stack as SEPARATE, editable, removable rows —
 * so you can pull "Vignette" out of "Faded" and keep the rest. The recipe is
 * built from real atomic effects; `setStack(recipe)` makes the engine render it.
 *
 * `preview` is a single representative effect used only for the tile thumbnail
 * (its default render reads the Look's vibe); the applied result is the recipe.
 */

export interface PresetLayer {
  effectId: string;
  settings: Record<string, number>;
}

export interface Preset {
  id: string;
  label: string;
  preview: string; // effectId used for the browse-tile thumbnail
  layers: PresetLayer[];
}

export const PRESETS: Preset[] = [
  {
    id: 'faded',
    label: 'Faded',
    preview: 'unifiedVintage',
    layers: [
      { effectId: 'colorTemperature', settings: { temperature: 20 } },
      { effectId: 'contrast', settings: { value: -10 } },
      { effectId: 'noise', settings: { value: 0.22, opacity: 0.5 } },
      { effectId: 'vignette', settings: { amount: 0.4 } },
    ],
  },
  {
    id: 'noir',
    label: 'Noir',
    preview: 'unifiedMono',
    layers: [
      { effectId: 'saturation', settings: { value: -100 } },
      { effectId: 'contrast', settings: { value: 26 } },
      { effectId: 'noise', settings: { value: 0.28, opacity: 0.6 } },
      { effectId: 'vignette', settings: { amount: 0.5 } },
    ],
  },
  {
    id: 'dreamy',
    label: 'Dreamy',
    preview: 'unifiedGlow',
    layers: [
      { effectId: 'unifiedGlow', settings: {} },
      { effectId: 'colorTemperature', settings: { temperature: 10 } },
      { effectId: 'noise', settings: { value: 0.12, opacity: 0.4 } },
    ],
  },
  {
    id: 'sun',
    label: 'Sun-bleached',
    preview: 'unifiedVintage',
    layers: [
      { effectId: 'colorTemperature', settings: { temperature: 30 } },
      { effectId: 'brightness', settings: { value: 12 } },
      { effectId: 'saturation', settings: { value: -16 } },
      { effectId: 'vignette', settings: { amount: 0.3 } },
    ],
  },
  {
    id: 'riso',
    label: 'Risograph',
    preview: 'unifiedPattern',
    layers: [
      { effectId: 'unifiedPattern', settings: {} },
      { effectId: 'saturation', settings: { value: 28 } },
      { effectId: 'contrast', settings: { value: 20 } },
    ],
  },
];
