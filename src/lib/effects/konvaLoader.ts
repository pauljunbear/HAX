'use client';

/**
 * Konva Loader
 * Handles dynamic loading of Konva and its filters for SSR compatibility
 */

import type { KonvaModule, KonvaFilterFunction } from './types';

// Konva module reference
let Konva: KonvaModule | null = null;
let konvaInitPromise: Promise<typeof import('konva')> | null = null;
let filtersInitPromise: Promise<void> | null = null;

/**
 * Ensure Konva filters are loaded
 */
export const ensureKonvaFiltersLoaded = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  if (filtersInitPromise) {
    return filtersInitPromise;
  }

  filtersInitPromise = (async () => {
    try {
      await Promise.all([
        import('konva/lib/filters/Blur'),
        import('konva/lib/filters/Brighten'),
        import('konva/lib/filters/Contrast'),
        import('konva/lib/filters/HSL'),
        import('konva/lib/filters/Pixelate'),
        import('konva/lib/filters/Noise'),
        import('konva/lib/filters/Grayscale'),
        import('konva/lib/filters/Sepia'),
        import('konva/lib/filters/Invert'),
        import('konva/lib/filters/Enhance'),
      ]);
    } catch (error) {
      console.warn('Some Konva filters failed to load.', error);
    }
  })();

  return filtersInitPromise;
};

/**
 * Load Konva module dynamically
 */
export const loadKonva = async (): Promise<KonvaModule | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!konvaInitPromise) {
    konvaInitPromise = import('konva');
  }

  Konva = (await konvaInitPromise) as unknown as KonvaModule;
  await ensureKonvaFiltersLoaded();

  if (Konva && Konva.Filters) {
    // Register custom filters if needed
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (Konva as unknown as Record<string, unknown>).noop = () => {};
  }

  return Konva;
};

/**
 * Get Konva module (must be loaded first)
 */
export const getKonva = (): KonvaModule | null => {
  return Konva;
};

/**
 * Check if Konva is loaded
 */
export const isKonvaLoaded = (): boolean => {
  return Konva !== null;
};

/**
 * Get a Konva filter by name
 */
export const getKonvaFilter = (name: string): KonvaFilterFunction | null => {
  if (!Konva || !Konva.Filters) {
    return null;
  }
  return Konva.Filters[name] || null;
};
