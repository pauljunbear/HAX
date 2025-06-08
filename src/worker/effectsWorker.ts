// Web Worker for heavy pixel manipulations
// This runs off the main thread to keep UI responsive

export interface WorkerMessage {
  id: string;
  type: 'APPLY_EFFECT' | 'PROCESS_IMAGE' | 'GENERATE_FRAME' | 'OFFSCREEN_RENDER' | 'TERMINATE';
  payload: any;
}

export interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload: any;
  error?: string;
}

export interface EffectParams {
  effectId: string;
  settings: Record<string, number>;
  imageData: ImageData;
  width: number;
  height: number;
}

export interface FrameGenerationParams {
  imageData: ImageData;
  effectId: string;
  settings: Record<string, number>;
  frameIndex: number;
  totalFrames: number;
  width: number;
  height: number;
}

export interface OffscreenRenderParams {
  imageData: ImageData;
  operations: Array<{ effectId: string; settings: Record<string, number> }>;
  canvas?: OffscreenCanvas;
  width: number;
  height: number;
}

// Custom filter functions that can run in worker context
const workerFilters = {
  // Blur effect - CPU intensive
  blur: (imageData: ImageData, radius: number): ImageData => {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    // Copy alpha channel
    for (let i = 3; i < data.length; i += 4) {
      outputData[i] = data[i];
    }
    
    // Apply box blur
    const boxSize = Math.floor(radius) * 2 + 1;
    const half = Math.floor(boxSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              count++;
            }
          }
        }
        
        const idx = (y * width + x) * 4;
        outputData[idx] = r / count;
        outputData[idx + 1] = g / count;
        outputData[idx + 2] = b / count;
      }
    }
    
    return output;
  },

  // Noise effect - computationally heavy
  noise: (imageData: ImageData, intensity: number): ImageData => {
    const { data, width, height } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outputData = output.data;
    
    for (let i = 0; i < outputData.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      outputData[i] = Math.max(0, Math.min(255, outputData[i] + noise));     // R
      outputData[i + 1] = Math.max(0, Math.min(255, outputData[i + 1] + noise)); // G
      outputData[i + 2] = Math.max(0, Math.min(255, outputData[i + 2] + noise)); // B
    }
    
    return output;
  },

  // Emboss effect - edge detection heavy
  emboss: (imageData: ImageData, strength: number): ImageData => {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    // Emboss kernel
    const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        outputData[idx] = Math.max(0, Math.min(255, r * strength + 128));
        outputData[idx + 1] = Math.max(0, Math.min(255, g * strength + 128));
        outputData[idx + 2] = Math.max(0, Math.min(255, b * strength + 128));
        outputData[idx + 3] = data[idx + 3]; // Alpha
      }
    }
    
    return output;
  },

  // Oil painting effect - very CPU intensive
  oilPainting: (imageData: ImageData, radius: number, intensity: number): ImageData => {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    const intensityCount = Math.floor(intensity);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const intensityBins = new Array(intensityCount).fill(0).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
        
        // Sample neighborhood
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const idx = (ny * width + nx) * 4;
            
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Calculate intensity bin
            const intensity = Math.floor((r + g + b) / 3 / 255 * (intensityCount - 1));
            const bin = intensityBins[intensity];
            
            bin.r += r;
            bin.g += g;
            bin.b += b;
            bin.count++;
          }
        }
        
        // Find most frequent intensity
        let maxBin = intensityBins[0];
        for (const bin of intensityBins) {
          if (bin.count > maxBin.count) {
            maxBin = bin;
          }
        }
        
        const idx = (y * width + x) * 4;
        if (maxBin.count > 0) {
          outputData[idx] = maxBin.r / maxBin.count;
          outputData[idx + 1] = maxBin.g / maxBin.count;
          outputData[idx + 2] = maxBin.b / maxBin.count;
        } else {
          outputData[idx] = data[idx];
          outputData[idx + 1] = data[idx + 1];
          outputData[idx + 2] = data[idx + 2];
        }
        outputData[idx + 3] = data[idx + 3]; // Alpha
      }
    }
    
    return output;
  },

  // Edge detection - computationally intensive
  edgeDetection: (imageData: ImageData, threshold: number): ImageData => {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    // Sobel operators
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gradX = 0, gradY = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gradX += gray * sobelX[kernelIdx];
            gradY += gray * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
        const edge = magnitude > threshold ? 255 : 0;
        
        const idx = (y * width + x) * 4;
        outputData[idx] = edge;
        outputData[idx + 1] = edge;
        outputData[idx + 2] = edge;
        outputData[idx + 3] = data[idx + 3];
      }
    }
    
    return output;
  }
};

// OffscreenCanvas utilities for worker-side rendering
const offscreenUtils = {
  createCanvas: (width: number, height: number): OffscreenCanvas | null => {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    return null;
  },

  imageDataToCanvas: (imageData: ImageData, canvas?: OffscreenCanvas): OffscreenCanvas | null => {
    const offscreenCanvas = canvas || offscreenUtils.createCanvas(imageData.width, imageData.height);
    if (!offscreenCanvas) return null;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.putImageData(imageData, 0, 0);
    return offscreenCanvas;
  },

  canvasToImageData: (canvas: OffscreenCanvas): ImageData | null => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  },

  // Advanced canvas-based effects that leverage GPU acceleration
  applyCanvasEffect: (imageData: ImageData, effectId: string, settings: Record<string, number>): ImageData => {
    const canvas = offscreenUtils.imageDataToCanvas(imageData);
    if (!canvas) {
      // Fallback to CPU-based processing
      return workerFilters.blur(imageData, settings.intensity || 5);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return imageData;

    // Apply canvas-based effects using built-in canvas operations
    switch (effectId) {
      case 'blur':
        // Use canvas filter for hardware acceleration where supported
        ctx.filter = `blur(${settings.intensity || 5}px)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      case 'brightness':
        ctx.filter = `brightness(${100 + (settings.intensity || 0)}%)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      case 'contrast':
        ctx.filter = `contrast(${100 + (settings.intensity || 0)}%)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      case 'saturation':
        ctx.filter = `saturate(${100 + (settings.intensity || 0)}%)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      case 'sepia':
        ctx.filter = `sepia(${settings.intensity || 0.5})`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      case 'invert':
        ctx.filter = `invert(${settings.intensity || 1})`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
        break;

      default:
        // For unknown effects, try CPU fallback
        const result = offscreenUtils.canvasToImageData(canvas);
        return result || imageData;
    }

    const result = offscreenUtils.canvasToImageData(canvas);
    return result || imageData;
  }
};

// CPU-based effect application
const applyCPUEffect = (imageData: ImageData, effectId: string, settings: Record<string, number>): ImageData => {
  switch (effectId) {
    case 'blur':
      return workerFilters.blur(imageData, settings.intensity || 5);
    case 'noise':
      return workerFilters.noise(imageData, settings.intensity || 0.1);
    case 'emboss':
      return workerFilters.emboss(imageData, settings.strength || 1);
    case 'oilPainting':
      return workerFilters.oilPainting(imageData, settings.radius || 3, settings.intensity || 20);
    case 'edgeDetection':
      return workerFilters.edgeDetection(imageData, settings.threshold || 100);
    default:
      throw new Error(`Unknown effect: ${effectId}`);
  }
};

// Main worker message handler
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;
  
  try {
    switch (type) {
      case 'APPLY_EFFECT': {
        const { effectId, settings, imageData, width, height } = payload as EffectParams;
        
        // Send progress update
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: { progress: 0 }
        } as WorkerResponse);
        
        let result: ImageData;
        
        // Try OffscreenCanvas first for supported effects, fallback to CPU processing
        const canvasEffects = ['blur', 'brightness', 'contrast', 'saturation', 'sepia', 'invert'];
        
        if (canvasEffects.includes(effectId) && typeof OffscreenCanvas !== 'undefined') {
          try {
            result = offscreenUtils.applyCanvasEffect(imageData, effectId, settings);
          } catch (error) {
            console.warn('OffscreenCanvas failed, falling back to CPU:', error);
            result = applyCPUEffect(imageData, effectId, settings);
          }
        } else {
          result = applyCPUEffect(imageData, effectId, settings);
        }
        
        // Send progress update
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: { progress: 0.8 }
        } as WorkerResponse);
        
        // Send final result
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { imageData: result }
        } as WorkerResponse);
        
        break;
      }
      
      case 'GENERATE_FRAME': {
        const { imageData, effectId, settings, frameIndex, totalFrames, width, height } = payload as FrameGenerationParams;
        
        // Calculate animated parameters based on frame
        const progress = frameIndex / (totalFrames - 1);
        const animatedSettings = { ...settings };
        
        // Apply frame-based animations
        if (effectId === 'blur') {
          animatedSettings.intensity = settings.intensity * (0.5 + Math.sin(progress * Math.PI * 2) * 0.5);
        } else if (effectId === 'noise') {
          animatedSettings.intensity = settings.intensity * (0.3 + progress * 0.7);
        }
        
        // Apply effect with animated settings using optimized rendering
        let result: ImageData;
        const canvasEffects = ['blur', 'brightness', 'contrast', 'saturation', 'sepia', 'invert'];
        
        if (canvasEffects.includes(effectId) && typeof OffscreenCanvas !== 'undefined') {
          try {
            result = offscreenUtils.applyCanvasEffect(imageData, effectId, animatedSettings);
          } catch (error) {
            console.warn('OffscreenCanvas failed for animation, falling back to CPU:', error);
            result = applyCPUEffect(imageData, effectId, animatedSettings);
          }
        } else {
          result = applyCPUEffect(imageData, effectId, animatedSettings);
        }
        
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { imageData: result, frameIndex }
        } as WorkerResponse);
        
        break;
      }
      
      case 'OFFSCREEN_RENDER': {
        const { imageData, operations, width, height } = payload as OffscreenRenderParams;
        
        // Process multiple operations efficiently using OffscreenCanvas
        let result = imageData;
        
        if (typeof OffscreenCanvas !== 'undefined' && operations.length > 0) {
          try {
            // Create a single OffscreenCanvas for all operations
            const canvas = offscreenUtils.imageDataToCanvas(imageData);
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Apply all operations sequentially on the same canvas
                for (const operation of operations) {
                  const canvasEffects = ['blur', 'brightness', 'contrast', 'saturation', 'sepia', 'invert'];
                  
                  if (canvasEffects.includes(operation.effectId)) {
                    // Apply canvas filter
                    switch (operation.effectId) {
                      case 'blur':
                        ctx.filter = `blur(${operation.settings.intensity || 5}px)`;
                        break;
                      case 'brightness':
                        ctx.filter = `brightness(${100 + (operation.settings.intensity || 0)}%)`;
                        break;
                      case 'contrast':
                        ctx.filter = `contrast(${100 + (operation.settings.intensity || 0)}%)`;
                        break;
                      case 'saturation':
                        ctx.filter = `saturate(${100 + (operation.settings.intensity || 0)}%)`;
                        break;
                      case 'sepia':
                        ctx.filter = `sepia(${operation.settings.intensity || 0.5})`;
                        break;
                      case 'invert':
                        ctx.filter = `invert(${operation.settings.intensity || 1})`;
                        break;
                    }
                    
                    // Apply the filter by redrawing
                    ctx.drawImage(canvas, 0, 0);
                    ctx.filter = 'none';
                  } else {
                    // For non-canvas effects, extract ImageData, process, and put back
                    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const processedImageData = applyCPUEffect(currentImageData, operation.effectId, operation.settings);
                    ctx.putImageData(processedImageData, 0, 0);
                  }
                }
                
                // Extract final result
                result = ctx.getImageData(0, 0, canvas.width, canvas.height);
              }
            }
          } catch (error) {
            console.warn('OffscreenCanvas batch processing failed, falling back to sequential CPU:', error);
            // Fallback to sequential CPU processing
            for (const operation of operations) {
              result = applyCPUEffect(result, operation.effectId, operation.settings);
            }
          }
        } else {
          // Fallback: sequential CPU processing
          for (const operation of operations) {
            result = applyCPUEffect(result, operation.effectId, operation.settings);
          }
        }
        
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { imageData: result }
        } as WorkerResponse);
        
        break;
      }
      
      case 'TERMINATE':
        self.close();
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      payload: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
});

// Export types for main thread
export {}; 