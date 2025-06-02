import GIF from 'gif.js';
import { applyEffect } from './effects';
import { AnimationConfig } from './animationConfig';
import Konva from 'konva';

export interface AnimationOptions {
  duration: number;
  frameRate: number;
  quality: number; // GIF quality 1-10
  width: number;
  height: number;
  onProgress?: (progress: number) => void;
}

export interface AnimationFrame {
  canvas: HTMLCanvasElement;
  delay: number; // delay until next frame in ms
}

// Render animation frames for an effect
export async function renderAnimationFrames(
  baseImage: HTMLImageElement,
  effectId: string,
  baseSettings: Record<string, number>,
  animationConfig: AnimationConfig,
  options: AnimationOptions
): Promise<AnimationFrame[]> {
  const frames: AnimationFrame[] = [];
  const frameCount = Math.floor((options.duration / 1000) * options.frameRate);
  const frameDelay = 1000 / options.frameRate;
  
  // Get the preset (use first one for now)
  const preset = animationConfig.animationPresets?.[0];
  if (!preset) {
    throw new Error('No animation preset available');
  }
  
  // Create a Konva stage for rendering
  const container = document.createElement('div');
  container.style.visibility = 'hidden';
  container.style.position = 'absolute';
  document.body.appendChild(container);
  
  const stage = new Konva.Stage({
    container,
    width: options.width,
    height: options.height,
  });
  
  const layer = new Konva.Layer();
  stage.add(layer);
  
  try {
    for (let i = 0; i < frameCount; i++) {
      const progress = i / (frameCount - 1);
      
      // Calculate animated settings
      const animatedSettings = { ...baseSettings };
      for (const [param, curve] of Object.entries(preset.parameterCurves)) {
        animatedSettings[param] = curve(progress);
      }
      
      // Add frame-based seed for effects that need randomness per frame
      if (effectId === 'pixelExplosion') {
        animatedSettings.seed = i + 1; // Different seed for each frame
      }
      
      // Clear the layer
      layer.destroyChildren();
      
      // Create Konva image
      const konvaImage = new Konva.Image({
        image: baseImage,
        x: 0,
        y: 0,
        width: options.width,
        height: options.height,
      });
      
      layer.add(konvaImage);
      
      // Apply the effect with animated settings
      const [filterFunc, filterParams] = await applyEffect(effectId, animatedSettings);
      
      if (filterFunc) {
        konvaImage.filters([filterFunc]);
        
        // Set filter parameters if any
        if (filterParams) {
          for (const [key, value] of Object.entries(filterParams)) {
            if (typeof konvaImage[key] === 'function') {
              konvaImage[key](value);
            }
          }
        }
      }
      
      // Cache and draw
      konvaImage.cache();
      layer.batchDraw();
      
      // Get the canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = options.width;
      frameCanvas.height = options.height;
      const ctx = frameCanvas.getContext('2d');
      
      if (ctx) {
        // Draw the Konva layer to our canvas
        const layerCanvas = layer.getCanvas()._canvas;
        ctx.drawImage(layerCanvas, 0, 0);
        
        frames.push({
          canvas: frameCanvas,
          delay: frameDelay
        });
      }
      
      // Report progress
      if (options.onProgress) {
        options.onProgress((i + 1) / frameCount);
      }
    }
  } finally {
    // Cleanup
    stage.destroy();
    document.body.removeChild(container);
  }
  
  return frames;
}

// Export frames as GIF
export async function exportAsGif(
  frames: AnimationFrame[],
  options: {
    quality: number;
    onProgress?: (progress: number) => void;
    onComplete?: (blob: Blob) => void;
    onError?: (error: Error) => void;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore - gif.js types are not perfect
      const gif = new GIF({
        quality: options.quality,
        workers: 2,
        workerScript: '/gif.worker.js',
        width: frames[0]?.canvas.width || 800,
        height: frames[0]?.canvas.height || 600,
        debug: true
      });
      
      // Add frames
      frames.forEach(frame => {
        gif.addFrame(frame.canvas, { delay: frame.delay });
      });
      
      // Set up event handlers
      gif.on('progress', (progress: number) => {
        console.log('GIF progress:', progress);
        if (options.onProgress) {
          options.onProgress(progress);
        }
      });
      
      gif.on('finished', (blob: Blob) => {
        console.log('GIF finished, blob size:', blob.size);
        if (options.onComplete) {
          options.onComplete(blob);
        }
        resolve(blob);
      });
      
      gif.on('error', (error: any) => {
        console.error('GIF error:', error);
        const err = new Error(error.message || 'GIF generation failed');
        if (options.onError) {
          options.onError(err);
        }
        reject(err);
      });
      
      // Start rendering
      gif.render();
    } catch (error) {
      console.error('GIF creation error:', error);
      const err = error instanceof Error ? error : new Error('Failed to create GIF');
      if (options.onError) {
        options.onError(err);
      }
      reject(err);
    }
  });
}

// Helper to download a blob as file
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 