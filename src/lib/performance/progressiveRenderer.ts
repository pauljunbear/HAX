import { applyEffect } from '../effects';
import Konva from 'konva';

type KonvaImage = Konva.Image & Record<string, unknown>;

export interface ProgressiveRenderOptions {
  previewScale?: number; // Scale factor for preview (0.1 - 0.5)
  enableTransition?: boolean; // Smooth transition from preview to full
  onPreviewReady?: (preview: ImageData) => void;
  onProgress?: (progress: number) => void;
}

export class ProgressiveRenderer {
  private currentRenderTask: AbortController | null = null;

  /**
   * Render effect progressively - low res preview first, then full resolution
   */
  async renderProgressively(
    image: HTMLImageElement | HTMLCanvasElement,
    effectName: string,
    settings: Record<string, number>,
    options: ProgressiveRenderOptions = {}
  ): Promise<{ preview: ImageData; full: ImageData }> {
    const {
      previewScale = 0.25,
      onPreviewReady,
      onProgress
    } = options;

    // Cancel any ongoing render
    this.cancelCurrentRender();
    
    // Create abort controller for this render
    this.currentRenderTask = new AbortController();
    const signal = this.currentRenderTask.signal;

    try {
      // Phase 1: Generate low-res preview
      if (onProgress) onProgress(0.1);
      
      const preview = await this.generatePreview(
        image,
        effectName,
        settings,
        previewScale,
        signal
      );
      
      if (signal.aborted) throw new Error('Render cancelled');
      
      if (onPreviewReady) {
        onPreviewReady(preview);
      }
      
      if (onProgress) onProgress(0.5);

      // Phase 2: Generate full resolution
      const full = await this.generateFullResolution(
        image,
        effectName,
        settings,
        signal
      );
      
      if (signal.aborted) throw new Error('Render cancelled');
      
      if (onProgress) onProgress(1);

      return { preview, full };
    } catch (error) {
      if (error instanceof Error && error.message === 'Render cancelled') {
        throw error;
      }
      console.error('Progressive render error:', error);
      throw error;
    } finally {
      this.currentRenderTask = null;
    }
  }

  /**
   * Generate low-resolution preview
   */
  private async generatePreview(
    image: HTMLImageElement | HTMLCanvasElement,
    effectName: string,
    settings: Record<string, number>,
    scale: number,
    signal: AbortSignal
  ): Promise<ImageData> {
    // Create scaled canvas
    const previewWidth = Math.max(1, Math.floor(image.width * scale));
    const previewHeight = Math.max(1, Math.floor(image.height * scale));
    
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Draw scaled image
    ctx.drawImage(image, 0, 0, previewWidth, previewHeight);
    
    if (signal.aborted) throw new Error('Render cancelled');
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, previewWidth, previewHeight);
    
    // Apply effect
    const [filter, params] = await applyEffect(effectName, settings);
    
    if (filter && !signal.aborted) {
      // Create temporary Konva image for filter application
      const tempImage = new Konva.Image({
        image: previewCanvas,
        x: 0,
        y: 0
      });
      
      // Apply filter parameters
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          const maybeSetter = (tempImage as KonvaImage)[key];
          if (typeof maybeSetter === 'function') {
            (maybeSetter as (input: unknown) => void)(value);
          }
        });
      }
      
      // Apply filter
      filter.call(tempImage, imageData);
    }
    
    return imageData;
  }

  /**
   * Generate full resolution image
   */
  private async generateFullResolution(
    image: HTMLImageElement | HTMLCanvasElement,
    effectName: string,
    settings: Record<string, number>,
    signal: AbortSignal
  ): Promise<ImageData> {
    // Create full size canvas
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Draw full image
    ctx.drawImage(image, 0, 0);
    
    if (signal.aborted) throw new Error('Render cancelled');
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    
    // Apply effect
    const [filter, params] = await applyEffect(effectName, settings);
    
    if (filter && !signal.aborted) {
      // Create temporary Konva image for filter application
      const tempImage = new Konva.Image({
        image: canvas,
        x: 0,
        y: 0
      });
      
      // Apply filter parameters
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          const maybeSetter = (tempImage as KonvaImage)[key];
          if (typeof maybeSetter === 'function') {
            (maybeSetter as (input: unknown) => void)(value);
          }
        });
      }
      
      // Apply filter
      filter.call(tempImage, imageData);
    }
    
    return imageData;
  }

  /**
   * Cancel current render task
   */
  cancelCurrentRender(): void {
    if (this.currentRenderTask) {
      this.currentRenderTask.abort();
      this.currentRenderTask = null;
    }
  }

  /**
   * Create smooth transition from preview to full resolution
   */
  createSmoothTransition(
    canvas: HTMLCanvasElement,
    preview: ImageData,
    full: ImageData,
    duration: number = 300
  ): Promise<void> {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve();
        return;
      }

      const startTime = performance.now();
      
      // Create temporary canvases
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = preview.width;
      previewCanvas.height = preview.height;
      const previewCtx = previewCanvas.getContext('2d');
      if (previewCtx) {
        previewCtx.putImageData(preview, 0, 0);
      }
      
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = full.width;
      fullCanvas.height = full.height;
      const fullCtx = fullCanvas.getContext('2d');
      if (fullCtx) {
        fullCtx.putImageData(full, 0, 0);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw preview with decreasing opacity
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(previewCanvas, 0, 0, canvas.width, canvas.height);
        
        // Draw full resolution with increasing opacity
        ctx.globalAlpha = progress;
        ctx.drawImage(fullCanvas, 0, 0, canvas.width, canvas.height);
        
        // Reset alpha
        ctx.globalAlpha = 1;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  }
}

// Singleton instance
let progressiveRendererInstance: ProgressiveRenderer | null = null;

export const getProgressiveRenderer = (): ProgressiveRenderer => {
  if (!progressiveRendererInstance) {
    progressiveRendererInstance = new ProgressiveRenderer();
  }
  return progressiveRendererInstance;
}; 