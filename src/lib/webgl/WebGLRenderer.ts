import * as PIXI from 'pixi.js';
import { BlurFilter } from '@pixi/filter-blur';
import { ColorMatrixFilter } from '@pixi/filter-color-matrix';
import { DisplacementFilter } from '@pixi/filter-displacement';

export interface WebGLEffect {
  name: string;
  filter: PIXI.Filter;
  params?: Record<string, any>;
}

export class WebGLRenderer {
  private app: PIXI.Application | null = null;
  private sprite: PIXI.Sprite | null = null;
  private container: HTMLElement | null = null;
  private effectsCache = new Map<string, WebGLEffect>();
  private currentFilters: PIXI.Filter[] = [];

  constructor() {
    // Initialize PIXI settings for better performance
    PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
    PIXI.settings.RENDER_OPTIONS.hello = false; // Disable console log
  }

  async initialize(container: HTMLElement, width: number, height: number): Promise<void> {
    this.container = container;
    
    // Clean up existing app if any
    if (this.app) {
      this.app.destroy(true);
    }

    // Create new PIXI application
    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      powerPreference: 'high-performance',
    });

    // Add canvas to container
    container.appendChild(this.app.view as HTMLCanvasElement);

    // Preload common filters
    this.preloadFilters();
  }

  private preloadFilters(): void {
    // Blur filter
    const blurFilter = new BlurFilter();
    this.effectsCache.set('blur', { name: 'blur', filter: blurFilter });

    // Color matrix filters
    const brightnessFilter = new ColorMatrixFilter();
    this.effectsCache.set('brightness', { name: 'brightness', filter: brightnessFilter });

    const contrastFilter = new ColorMatrixFilter();
    this.effectsCache.set('contrast', { name: 'contrast', filter: contrastFilter });

    const saturationFilter = new ColorMatrixFilter();
    this.effectsCache.set('saturation', { name: 'saturation', filter: saturationFilter });

    const hueFilter = new ColorMatrixFilter();
    this.effectsCache.set('hue', { name: 'hue', filter: hueFilter });

    // Vintage filter
    const vintageFilter = new ColorMatrixFilter();
    vintageFilter.vintage(true);
    this.effectsCache.set('vintage', { name: 'vintage', filter: vintageFilter });

    // Sepia filter
    const sepiaFilter = new ColorMatrixFilter();
    sepiaFilter.sepia(true);
    this.effectsCache.set('sepia', { name: 'sepia', filter: sepiaFilter });
  }

  async loadImage(imageUrl: string): Promise<void> {
    if (!this.app) throw new Error('WebGL renderer not initialized');

    // Remove existing sprite
    if (this.sprite) {
      this.sprite.destroy();
    }

    // Load texture
    const texture = await PIXI.Assets.load(imageUrl);
    this.sprite = new PIXI.Sprite(texture);

    // Scale sprite to fit canvas
    const scale = Math.min(
      this.app.screen.width / this.sprite.width,
      this.app.screen.height / this.sprite.height
    );
    this.sprite.scale.set(scale);

    // Center sprite
    this.sprite.x = (this.app.screen.width - this.sprite.width) / 2;
    this.sprite.y = (this.app.screen.height - this.sprite.height) / 2;

    // Add to stage
    this.app.stage.addChild(this.sprite);
  }

  applyEffect(effectName: string, params?: Record<string, any>): void {
    if (!this.sprite) return;

    const effect = this.effectsCache.get(effectName);
    if (!effect) {
      console.warn(`Effect ${effectName} not found in WebGL cache`);
      return;
    }

    // Apply parameters to filter
    if (params) {
      switch (effectName) {
        case 'blur':
          (effect.filter as BlurFilter).blur = params.intensity || 5;
          break;
        case 'brightness':
          (effect.filter as ColorMatrixFilter).brightness(params.value || 1, false);
          break;
        case 'contrast':
          (effect.filter as ColorMatrixFilter).contrast(params.value || 1, false);
          break;
        case 'saturation':
          (effect.filter as ColorMatrixFilter).saturate(params.value || 1, false);
          break;
        case 'hue':
          (effect.filter as ColorMatrixFilter).hue(params.value || 0, false);
          break;
      }
    }

    // Add filter to sprite
    if (!this.currentFilters.includes(effect.filter)) {
      this.currentFilters.push(effect.filter);
      this.sprite.filters = this.currentFilters;
    }
  }

  removeEffect(effectName: string): void {
    if (!this.sprite) return;

    const effect = this.effectsCache.get(effectName);
    if (!effect) return;

    // Remove filter
    this.currentFilters = this.currentFilters.filter(f => f !== effect.filter);
    this.sprite.filters = this.currentFilters.length > 0 ? this.currentFilters : null;
  }

  clearEffects(): void {
    if (!this.sprite) return;
    this.currentFilters = [];
    this.sprite.filters = null;
  }

  async exportCanvas(): Promise<HTMLCanvasElement> {
    if (!this.app) throw new Error('WebGL renderer not initialized');

    // Render current frame
    this.app.render();

    // Extract canvas
    const canvas = this.app.view as HTMLCanvasElement;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    
    ctx.drawImage(canvas, 0, 0);
    return exportCanvas;
  }

  getPerformanceStats(): { fps: number; drawCalls: number } {
    if (!this.app) return { fps: 0, drawCalls: 0 };

    return {
      fps: this.app.ticker.FPS,
      drawCalls: this.app.renderer.renderingToScreen ? 1 : 0,
    };
  }

  destroy(): void {
    this.clearEffects();
    
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }

    this.effectsCache.clear();
    this.currentFilters = [];
  }

  // Check if an effect can be GPU accelerated
  static canAccelerate(effectName: string): boolean {
    const acceleratedEffects = [
      'blur', 'brightness', 'contrast', 'saturation', 'hue',
      'vintage', 'sepia', 'pixelate', 'rgbSplit', 'glitch',
      'zoomBlur', 'radialBlur', 'motionBlur', 'tiltShift'
    ];
    return acceleratedEffects.includes(effectName);
  }
}

// Singleton instance
let webGLRenderer: WebGLRenderer | null = null;

export function getWebGLRenderer(): WebGLRenderer {
  if (!webGLRenderer) {
    webGLRenderer = new WebGLRenderer();
  }
  return webGLRenderer;
}

export function destroyWebGLRenderer(): void {
  if (webGLRenderer) {
    webGLRenderer.destroy();
    webGLRenderer = null;
  }
} 