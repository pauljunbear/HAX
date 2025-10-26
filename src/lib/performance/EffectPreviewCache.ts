import { applyEffect, effectsConfig } from '@/lib/effects';

type KonvaModule = typeof import('konva');

interface CacheEntry {
  imageUrl: string;
  effectId: string;
  settings: Record<string, number>;
  thumbnail: string; // Base64 data URL
  timestamp: number;
}

export class EffectPreviewCache {
  private cache = new Map<string, CacheEntry>();
  private maxCacheSize = 100; // Maximum number of cached previews
  private thumbnailSize = 150; // Thumbnail dimensions
  private cacheExpiryMs = 1000 * 60 * 30; // 30 minutes

  constructor() {
    // Load cache from localStorage if available
    this.loadFromStorage();
  }

  private getCacheKey(imageUrl: string, effectId: string, settings: Record<string, number>): string {
    return `${imageUrl}-${effectId}-${JSON.stringify(settings)}`;
  }

  async generatePreview(
    imageUrl: string,
    effectId: string,
    settings?: Record<string, number>
  ): Promise<string> {
    const effectSettings = settings || this.getDefaultSettings(effectId);
    const cacheKey = this.getCacheKey(imageUrl, effectId, effectSettings);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.thumbnail;
    }

    // Generate preview
    const thumbnail = await this.renderThumbnail(imageUrl, effectId, effectSettings);

    // Update cache
    this.cache.set(cacheKey, {
      imageUrl,
      effectId,
      settings: effectSettings,
      thumbnail,
      timestamp: Date.now()
    });

    // Manage cache size
    this.evictOldEntries();

    // Save to storage
    this.saveToStorage();

    return thumbnail;
  }

  private async renderThumbnail(
    imageUrl: string,
    effectId: string,
    settings: Record<string, number>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        try {
          // Create canvas for thumbnail
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get 2D context');

          // Calculate dimensions maintaining aspect ratio
          const scale = Math.min(this.thumbnailSize / img.width, this.thumbnailSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          // Draw scaled image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Apply effect
          const [filterFunc, filterParams] = await applyEffect(effectId, settings);

          if (filterFunc) {
            // Apply filter using a temporary Konva stage
            const konvaModule: KonvaModule = await import('konva');
            const Konva = konvaModule.default;
            const stage = new Konva.Stage({
              container: document.createElement('div'),
              width: canvas.width,
              height: canvas.height,
            });

            const layer = new Konva.Layer();
            stage.add(layer);

            const image = new Konva.Image({
              image: canvas,
              x: 0,
              y: 0,
              width: canvas.width,
              height: canvas.height,
            });

            image.filters([filterFunc]);
            if (filterParams) {
              Object.entries(filterParams).forEach(([key, value]) => {
                const maybeSetter = (image as Record<string, unknown>)[key];
                if (typeof maybeSetter === 'function') {
                  (maybeSetter as (input: unknown) => void)(value);
                }
              });
            }

            layer.add(image);
            image.cache();
            layer.batchDraw();

            // Get result
            const dataURL = stage.toDataURL({ pixelRatio: 1 });
            stage.destroy();

            resolve(dataURL);
          } else {
            // No filter, return original
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  private getDefaultSettings(effectId: string): Record<string, number> {
    const config = effectsConfig[effectId];
    if (!config?.settings) return {};

    const settings: Record<string, number> = {};
    for (const [key, setting] of Object.entries(config.settings)) {
      settings[key] = setting.default;
    }
    return settings;
  }

  private evictOldEntries(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by timestamp and remove oldest
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem('effectPreviewCache');
  }

  private saveToStorage(): void {
    try {
      // Only save metadata, not the actual thumbnails (too large)
      const metadata = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        effectId: entry.effectId,
        timestamp: entry.timestamp
      }));
      localStorage.setItem('effectPreviewCacheMetadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to save preview cache metadata:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const metadata = localStorage.getItem('effectPreviewCacheMetadata');
      if (metadata) {
        const entries = JSON.parse(metadata);
        // We only restore metadata, thumbnails will be regenerated on demand
        console.log(`Loaded ${entries.length} preview cache metadata entries`);
      }
    } catch (error) {
      console.warn('Failed to load preview cache metadata:', error);
    }
  }

  // Pregenerate previews for common effects
  async pregenerateCommonPreviews(imageUrl: string): Promise<void> {
    const commonEffects = [
      'brightness', 'contrast', 'saturation', 'blur', 
      'vintage', 'sepia', 'blackWhite', 'sharpen'
    ];

    const promises = commonEffects.map(effectId => 
      this.generatePreview(imageUrl, effectId).catch(err => 
        console.warn(`Failed to pregenerate preview for ${effectId}:`, err)
      )
    );

    await Promise.all(promises);
  }
}

// Singleton instance
let previewCache: EffectPreviewCache | null = null;

export function getEffectPreviewCache(): EffectPreviewCache {
  if (!previewCache) {
    previewCache = new EffectPreviewCache();
  }
  return previewCache;
}

export function clearEffectPreviewCache(): void {
  if (previewCache) {
    previewCache.clearCache();
  }
} 