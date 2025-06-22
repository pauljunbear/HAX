import GIF from 'gif.js';
import { applyEffect } from './effects';
import { AnimationConfig } from './animationConfig';
import Konva from 'konva';
import {
  VideoExporter,
  VideoExportOptions,
  downloadVideoBlob,
  estimateVideoSize,
} from './export/videoExporter';
import {
  GifOptimizer,
  GifOptimizationOptions,
  GIF_QUALITY_PRESETS,
  GifQualityPreset,
} from './export/gifOptimizer';

export interface AnimationOptions {
  duration: number;
  frameRate: number;
  quality: number; // GIF quality 1-10
  width: number;
  height: number;
  onProgress?: (progress: number) => void;
  // Overlay options
  overlayProps?: {
    effectType: 'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies';
    opacity: number;
    particleCount: number;
    color: string;
    speed: number;
    interactive: boolean;
  };
}

export interface AnimationFrame {
  canvas: HTMLCanvasElement;
  delay: number; // delay until next frame in ms
}

// Add new type for effect layer info
export interface AnimatedEffectLayer {
  effectId: string;
  settings: Record<string, number>;
  animationConfig: AnimationConfig;
}

// Render animation frames for an effect
export async function renderAnimationFrames(
  baseImage: HTMLImageElement,
  effectId: string,
  baseSettings: Record<string, number>,
  animationConfig: AnimationConfig,
  options: AnimationOptions
): Promise<AnimationFrame[]> {
  // Check if this is a generative overlay effect
  const isOverlayEffect = effectId.startsWith('generative');

  if (isOverlayEffect) {
    return renderOverlayAnimationFrames(
      baseImage,
      effectId,
      baseSettings,
      animationConfig,
      options
    );
  }
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
      console.log(`Frame ${i}: Applying effect ${effectId} with settings:`, animatedSettings);
      const [filterFunc, filterParams] = await applyEffect(effectId, animatedSettings);

      if (filterFunc) {
        console.log(`Frame ${i}: Filter function created successfully`);
        konvaImage.filters([filterFunc]);

        // Set filter parameters if any
        if (filterParams) {
          console.log(`Frame ${i}: Applying filter parameters:`, filterParams);
          for (const [key, value] of Object.entries(filterParams)) {
            if (typeof (konvaImage as any)[key] === 'function') {
              (konvaImage as any)[key](value);
            }
          }
        }
      } else {
        console.warn(`Frame ${i}: No filter function returned for effect ${effectId}`);
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
        // Clear canvas to transparent (remove black background)
        ctx.clearRect(0, 0, options.width, options.height);

        // Draw the Konva layer to our canvas
        const layerCanvas = layer.getCanvas()._canvas;
        ctx.drawImage(layerCanvas, 0, 0);

        // Debug: Check if the frame has content
        const imageData = ctx.getImageData(0, 0, options.width, options.height);
        const hasContent = Array.from(imageData.data).some((value, index) => {
          // Check if any pixel has non-zero RGB values (ignore alpha channel)
          return index % 4 !== 3 && value > 0;
        });

        console.log(
          `Frame ${i}: Has content: ${hasContent}, Canvas size: ${frameCanvas.width}x${frameCanvas.height}`
        );

        if (!hasContent) {
          console.warn(`Frame ${i}: Generated frame appears to be empty/black`);
        }

        // TODO: Add overlay rendering for animated exports
        // Currently overlays are not captured in animated exports due to complexity
        // of frame-by-frame particle system rendering. Future enhancement needed.
        if (options.overlayProps) {
          // For now, add a simple placeholder overlay effect
          await renderSimpleOverlayEffect(
            ctx,
            options.overlayProps,
            progress,
            options.width,
            options.height
          );
        }

        frames.push({
          canvas: frameCanvas,
          delay: frameDelay,
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

// Export frames as GIF with advanced optimization
export async function exportAsGif(
  frames: AnimationFrame[],
  options: {
    quality: number;
    qualityPreset?: GifQualityPreset;
    optimizationOptions?: GifOptimizationOptions;
    onProgress?: (progress: number) => void;
    onComplete?: (blob: Blob) => void;
    onError?: (error: Error) => void;
    onAnalysis?: (analysis: ReturnType<typeof GifOptimizer.generateReport>) => void;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      if (frames.length === 0) {
        throw new Error('No frames provided for GIF export');
      }

      const canvases = frames.map(frame => frame.canvas);

      // Apply GIF optimization
      let optimizationOptions: GifOptimizationOptions;

      if (options.qualityPreset) {
        // Use preset
        optimizationOptions = { ...GIF_QUALITY_PRESETS[options.qualityPreset] };
      } else if (options.optimizationOptions) {
        // Use custom options
        optimizationOptions = options.optimizationOptions;
      } else {
        // Auto-detect best settings
        optimizationOptions = {
          quality: options.quality,
          contentType: 'auto',
          optimizeColors: true,
          dithering: 'floyd-steinberg',
          frameOptimization: 'minimal',
        };
      }

      // Generate optimization report
      const report = GifOptimizer.generateReport(canvases, optimizationOptions);
      console.log('GIF Optimization Analysis:', report);

      // Notify about analysis results
      if (options.onAnalysis) {
        options.onAnalysis(report);
      }

      // Get optimized settings
      const optimizedSettings = report.optimizedSettings;

      console.log(
        `Creating optimized GIF with quality ${optimizedSettings.quality}, estimated size: ${optimizedSettings.estimatedSizeKB}KB`
      );

      // @ts-ignore - gif.js types are not perfect
      const gif = new GIF({
        quality: optimizedSettings.quality,
        workers: Math.min(optimizedSettings.workers, 4), // Cap workers for browser compatibility
        workerScript: '/gif.worker.js',
        width: frames[0]?.canvas.width || 800,
        height: frames[0]?.canvas.height || 600,
        debug: false, // Disable debug for production
        dithering: optimizedSettings.dithering,
        transparent: optimizedSettings.transparency ? 'rgba(0,0,0,0)' : undefined,
        background: '#ffffff',
        globalPalette: optimizationOptions.optimizeColors !== false,
        repeat: 0, // Loop forever
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

// Export animation frames as video (WebM/MP4)
export async function exportAsVideo(
  frames: AnimationFrame[],
  options: {
    format: 'webm' | 'mp4';
    quality: number; // 1-10
    frameRate: number;
    onProgress?: (progress: number) => void;
    onComplete?: (blob: Blob) => void;
    onError?: (error: Error) => void;
  }
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames provided for video export');
  }

  const { format, quality, frameRate, onProgress, onComplete, onError } = options;

  // Convert AnimationFrame canvases to regular canvas array
  const canvases = frames.map(frame => frame.canvas);
  const width = canvases[0].width;
  const height = canvases[0].height;

  console.log(`Exporting ${frames.length} frames as ${format.toUpperCase()} video`);
  console.log(
    `Resolution: ${width}x${height}, Quality: ${quality}/10, Frame rate: ${frameRate}fps`
  );

  // Estimate video file size
  const estimate = estimateVideoSize(frames.length, frameRate, quality, format, { width, height });
  console.log(
    `Estimated output: ${estimate.estimatedMB}MB, ${estimate.estimatedSeconds}s duration`
  );

  const videoExporter = new VideoExporter();

  try {
    const videoBlob = await videoExporter.exportVideo({
      frames: canvases,
      frameRate,
      quality,
      format,
      width,
      height,
      onProgress: progress => {
        console.log(`Video export progress: ${Math.round(progress * 100)}%`);
        onProgress?.(progress);
      },
      onComplete: blob => {
        console.log(
          `Video export completed. Final size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`
        );
        onComplete?.(blob);
      },
      onError: error => {
        console.error('Video export error:', error);
        onError?.(error);
      },
    });

    return videoBlob;
  } finally {
    // Clean up the video exporter
    videoExporter.terminate();
  }
}

// Combined export function for animations (GIF or Video)
export async function exportAnimationAs(
  baseImage: HTMLImageElement,
  effectId: string,
  baseSettings: Record<string, number>,
  animationConfig: AnimationConfig,
  options: AnimationOptions & {
    exportFormat: 'gif' | 'webm' | 'mp4';
    exportQuality?: number;
    onProgress?: (stage: string, progress: number) => void;
    onComplete?: (blob: Blob, format: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<Blob> {
  const { exportFormat, exportQuality = 8, onProgress, onComplete, onError } = options;

  try {
    // Stage 1: Render animation frames
    onProgress?.('Rendering frames', 0);

    const frames = await renderAnimationFrames(baseImage, effectId, baseSettings, animationConfig, {
      ...options,
      onProgress: progress => onProgress?.('Rendering frames', progress * 0.5),
    });

    // Stage 2: Export based on format
    if (exportFormat === 'gif') {
      onProgress?.('Creating GIF', 0.5);

      const gifBlob = await exportAsGif(frames, {
        quality: exportQuality,
        onProgress: progress => onProgress?.('Creating GIF', 0.5 + progress * 0.5),
        onComplete: blob => onComplete?.(blob, 'gif'),
        onError,
      });

      return gifBlob;
    } else {
      onProgress?.('Creating video', 0.5);

      const videoBlob = await exportAsVideo(frames, {
        format: exportFormat,
        quality: exportQuality,
        frameRate: options.frameRate,
        onProgress: progress => onProgress?.('Creating video', 0.5 + progress * 0.5),
        onComplete: blob => onComplete?.(blob, exportFormat),
        onError,
      });

      return videoBlob;
    }
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error('Unknown export error');
    onError?.(exportError);
    throw exportError;
  }
}

// Utility to download video with appropriate filename
export function downloadVideo(
  blob: Blob,
  format: 'webm' | 'mp4',
  prefix: string = 'animation'
): void {
  const timestamp = Date.now();
  const filename = `${prefix}-${timestamp}.${format}`;
  downloadVideoBlob(blob, filename);
}

// Simple overlay effect renderer for animations (placeholder implementation)
async function renderSimpleOverlayEffect(
  ctx: CanvasRenderingContext2D,
  overlayProps: NonNullable<AnimationOptions['overlayProps']>,
  progress: number,
  width: number,
  height: number
) {
  ctx.save();
  ctx.globalAlpha = overlayProps.opacity;

  // Parse color
  const color = overlayProps.color;
  const particleCount = Math.floor(overlayProps.particleCount * 0.3); // Reduced for performance

  // Set color and style
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Create deterministic but varied particles based on frame progress
  const seed = Math.floor(progress * 1000);

  for (let i = 0; i < particleCount; i++) {
    // Pseudo-random values based on particle index and animation progress
    const particleSeed = seed + i * 123;
    const x = (Math.sin(particleSeed * 0.01) * 0.5 + 0.5) * width;
    const y = (Math.cos(particleSeed * 0.007) * 0.5 + 0.5) * height;

    // Animation offset based on progress
    const animOffset = progress * overlayProps.speed * 100;

    switch (overlayProps.effectType) {
      case 'stars':
        // Draw simple star points
        const starSize = 2 + Math.sin(particleSeed * 0.1 + animOffset * 0.05) * 1;
        ctx.fillRect(x - starSize / 2, y - starSize / 2, starSize, starSize);
        // Add twinkle effect with cross pattern
        if (Math.sin(animOffset * 0.1 + particleSeed) > 0.5) {
          ctx.fillRect(x - starSize, y - 0.5, starSize * 2, 1);
          ctx.fillRect(x - 0.5, y - starSize, 1, starSize * 2);
        }
        break;

      case 'bubbles':
        // Draw circles moving upward
        const bubbleY = (y + animOffset * 2) % height;
        const bubbleSize = 3 + Math.sin(particleSeed * 0.1) * 2;
        ctx.globalAlpha =
          overlayProps.opacity * (0.3 + Math.sin(animOffset * 0.1 + particleSeed) * 0.3);
        ctx.beginPath();
        ctx.arc(x, bubbleY, bubbleSize, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'network':
        // Draw connected dots
        const nodeSize = 2;
        ctx.fillRect(x - nodeSize / 2, y - nodeSize / 2, nodeSize, nodeSize);
        // Draw lines to nearby particles (simplified)
        if (i % 3 === 0 && i < particleCount - 1) {
          const nextX = (Math.sin((seed + (i + 1) * 123) * 0.01) * 0.5 + 0.5) * width;
          const nextY = (Math.cos((seed + (i + 1) * 123) * 0.007) * 0.5 + 0.5) * height;
          const distance = Math.sqrt((nextX - x) ** 2 + (nextY - y) ** 2);
          if (distance < 100) {
            ctx.globalAlpha = overlayProps.opacity * 0.3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nextX, nextY);
            ctx.stroke();
          }
        }
        break;

      case 'snow':
        // Draw falling snowflakes
        const snowY = (y + animOffset * 3) % (height + 20);
        const snowSize = 1 + Math.sin(particleSeed * 0.1) * 1.5;
        const snowX = x + Math.sin(animOffset * 0.02 + particleSeed) * 10; // Wobble
        ctx.fillRect(snowX - snowSize / 2, snowY - snowSize / 2, snowSize, snowSize);
        break;

      case 'confetti':
        // Draw colorful falling shapes
        const confettiY = (y + animOffset * 4) % (height + 20);
        const rotation = animOffset * 0.1 + particleSeed;
        ctx.save();
        ctx.translate(x, confettiY);
        ctx.rotate(rotation);
        ctx.fillStyle = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][i % 6];
        if (i % 3 === 0) {
          // Rectangle
          ctx.fillRect(-2, -2, 4, 4);
        } else {
          // Triangle
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.lineTo(-3, 3);
          ctx.lineTo(3, 3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;

      case 'fireflies':
        // Draw glowing dots with varying opacity
        const glowIntensity = 0.5 + Math.sin(animOffset * 0.2 + particleSeed * 0.5) * 0.5;
        ctx.globalAlpha = overlayProps.opacity * glowIntensity;
        ctx.fillStyle = '#ffff88';
        const fireflySize = 2 + glowIntensity;
        ctx.beginPath();
        ctx.arc(x, y, fireflySize, 0, Math.PI * 2);
        ctx.fill();
        // Add glow effect
        ctx.globalAlpha = overlayProps.opacity * glowIntensity * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, fireflySize * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  ctx.restore();
}

// Dedicated function for rendering overlay-only animations
async function renderOverlayAnimationFrames(
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
    throw new Error('No animation preset available for overlay effect');
  }

  // Extract overlay type from effect ID
  const overlayType = effectId.replace('generative', '').toLowerCase() as
    | 'stars'
    | 'bubbles'
    | 'network'
    | 'snow'
    | 'confetti'
    | 'fireflies';

  for (let i = 0; i < frameCount; i++) {
    const progress = i / (frameCount - 1);

    // Calculate animated settings
    const animatedSettings = { ...baseSettings };
    for (const [param, curve] of Object.entries(preset.parameterCurves)) {
      animatedSettings[param] = curve(progress);
    }

    // Create frame canvas
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = options.width;
    frameCanvas.height = options.height;
    const ctx = frameCanvas.getContext('2d');

    if (ctx) {
      // Clear canvas to transparent (remove black background)
      ctx.clearRect(0, 0, options.width, options.height);

      // Draw the base image
      ctx.drawImage(baseImage, 0, 0, options.width, options.height);

      // Create overlay props from animated settings
      const overlayProps = {
        effectType: overlayType,
        opacity: baseSettings.opacity || 0.6, // Use layer opacity, not animated
        particleCount: baseSettings.particleCount || 50,
        color: baseSettings.color
          ? `#${Math.floor(baseSettings.color).toString(16).padStart(6, '0')}`
          : '#ffffff',
        speed: animatedSettings.speed || baseSettings.speed || 1, // Use animated speed
        interactive: (baseSettings.interactive || 1) > 0.5,
      };

      // Render the overlay effect
      await renderSimpleOverlayEffect(ctx, overlayProps, progress, options.width, options.height);

      frames.push({
        canvas: frameCanvas,
        delay: frameDelay,
      });
    }

    // Report progress
    if (options.onProgress) {
      options.onProgress((i + 1) / frameCount);
    }
  }

  return frames;
}

// Render animation frames with multiple effect layers
export async function renderMultiLayerAnimationFrames(
  baseImage: HTMLImageElement,
  effectLayers: AnimatedEffectLayer[],
  options: AnimationOptions
): Promise<AnimationFrame[]> {
  const frames: AnimationFrame[] = [];
  const frameCount = Math.floor((options.duration / 1000) * options.frameRate);
  const frameDelay = 1000 / options.frameRate;

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

      // Apply all effect layers in sequence
      const filters: any[] = [];
      const combinedFilterParams: Record<string, any> = {};

      for (const effectLayer of effectLayers) {
        const { effectId, settings, animationConfig } = effectLayer;

        // Skip non-animated effects
        const preset = animationConfig.animationPresets?.[0];
        if (!preset) continue;

        // Calculate animated settings for this effect
        const animatedSettings = { ...settings };
        for (const [param, curve] of Object.entries(preset.parameterCurves)) {
          animatedSettings[param] = curve(progress);
        }

        // Add frame-based seed for effects that need randomness per frame
        if (effectId === 'pixelExplosion') {
          animatedSettings.seed = i + 1;
        }

        // Apply the effect
        const [filterFunc, filterParams] = await applyEffect(effectId, animatedSettings);

        if (filterFunc && typeof filterFunc === 'function') {
          filters.push(filterFunc);

          // Merge filter parameters
          if (filterParams) {
            for (const [key, value] of Object.entries(filterParams)) {
              // For additive parameters, sum them up
              if (
                key === 'brightness' ||
                key === 'contrast' ||
                key === 'enhance' ||
                key === 'saturation' ||
                key === 'hue'
              ) {
                combinedFilterParams[key] = (combinedFilterParams[key] || 0) + value;
              } else {
                // For other parameters, use the last value
                combinedFilterParams[key] = value;
              }
            }
          }
        }
      }

      // Apply all filters at once
      if (filters.length > 0) {
        konvaImage.filters(filters);

        // Set combined filter parameters
        for (const [key, value] of Object.entries(combinedFilterParams)) {
          if (typeof (konvaImage as any)[key] === 'function') {
            (konvaImage as any)[key](value);
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
        ctx.clearRect(0, 0, options.width, options.height);
        const layerCanvas = layer.getCanvas()._canvas;
        ctx.drawImage(layerCanvas, 0, 0);

        frames.push({
          canvas: frameCanvas,
          delay: frameDelay,
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

// Export multiple animated layers as video or GIF
export async function exportMultiLayerAnimation(
  baseImage: HTMLImageElement,
  effectLayers: AnimatedEffectLayer[],
  options: AnimationOptions & {
    exportFormat: 'gif' | 'webm' | 'mp4';
    exportQuality?: number;
    onProgress?: (stage: string, progress: number) => void;
    onComplete?: (blob: Blob, format: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<Blob> {
  const { exportFormat, exportQuality = 8, onProgress, onComplete, onError } = options;

  try {
    // Stage 1: Render animation frames with all layers
    onProgress?.('Rendering frames', 0);

    const frames = await renderMultiLayerAnimationFrames(baseImage, effectLayers, {
      ...options,
      onProgress: progress => onProgress?.('Rendering frames', progress * 0.5),
    });

    // Stage 2: Export based on format
    if (exportFormat === 'gif') {
      onProgress?.('Creating GIF', 0.5);

      const gifBlob = await exportAsGif(frames, {
        quality: exportQuality,
        onProgress: progress => onProgress?.('Creating GIF', 0.5 + progress * 0.5),
        onComplete: blob => onComplete?.(blob, 'gif'),
        onError,
      });

      return gifBlob;
    } else {
      onProgress?.('Creating video', 0.5);

      const videoBlob = await exportAsVideo(frames, {
        format: exportFormat,
        quality: exportQuality,
        frameRate: options.frameRate,
        onProgress: progress => onProgress?.('Creating video', 0.5 + progress * 0.5),
        onComplete: blob => onComplete?.(blob, exportFormat),
        onError,
      });

      return videoBlob;
    }
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error('Unknown export error');
    onError?.(exportError);
    throw exportError;
  }
}
