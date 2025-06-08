// Web Worker for heavy pixel manipulations
// This runs off the main thread to keep UI responsive

// Custom filter functions that can run in worker context
const workerFilters = {
  blur: (imageData, radius) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data);
    
    const kernel = Math.max(1, Math.round(radius));
    const kernelSize = 2 * kernel + 1;
    const kernelSum = kernelSize * kernelSize;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        
        for (let ky = -kernel; ky <= kernel; ky++) {
          for (let kx = -kernel; kx <= kernel; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const pi = (py * width + px) * 4;
            
            r += data[pi];
            g += data[pi + 1];
            b += data[pi + 2];
            a += data[pi + 3];
          }
        }
        
        const index = (y * width + x) * 4;
        output[index] = r / kernelSum;
        output[index + 1] = g / kernelSum;
        output[index + 2] = b / kernelSum;
        output[index + 3] = a / kernelSum;
      }
    }
    
    return new ImageData(output, width, height);
  },

  noise: (imageData, intensity) => {
    const data = new Uint8ClampedArray(imageData.data);
    const noise = intensity * 255;
    
    for (let i = 0; i < data.length; i += 4) {
      const random = (Math.random() - 0.5) * noise;
      data[i] = Math.max(0, Math.min(255, data[i] + random));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + random));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + random));
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  },

  emboss: (imageData, strength) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data.length);
    
    // Emboss kernel
    const kernel = [
      [-2, -1, 0],
      [-1, 1, 1],
      [0, 1, 2]
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const px = x + kx - 1;
            const py = y + ky - 1;
            const pi = (py * width + px) * 4;
            const weight = kernel[ky][kx] * strength;
            
            r += data[pi] * weight;
            g += data[pi + 1] * weight;
            b += data[pi + 2] * weight;
          }
        }
        
        const index = (y * width + x) * 4;
        output[index] = Math.max(0, Math.min(255, r + 128));
        output[index + 1] = Math.max(0, Math.min(255, g + 128));
        output[index + 2] = Math.max(0, Math.min(255, b + 128));
        output[index + 3] = data[index + 3];
      }
    }
    
    return new ImageData(output, width, height);
  },

  oilPainting: (imageData, radius, intensity) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data);
    
    const levels = Math.max(1, Math.round(intensity));
    const area = (radius * 2 + 1) * (radius * 2 + 1);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const intensityCount = new Array(levels).fill(0);
        const avgR = new Array(levels).fill(0);
        const avgG = new Array(levels).fill(0);
        const avgB = new Array(levels).fill(0);
        
        for (let yy = -radius; yy <= radius; yy++) {
          for (let xx = -radius; xx <= radius; xx++) {
            const px = x + xx;
            const py = y + yy;
            const pi = (py * width + px) * 4;
            
            const r = data[pi];
            const g = data[pi + 1];
            const b = data[pi + 2];
            const curIntensity = Math.round(((r + g + b) / 3) * (levels - 1) / 255);
            
            intensityCount[curIntensity]++;
            avgR[curIntensity] += r;
            avgG[curIntensity] += g;
            avgB[curIntensity] += b;
          }
        }
        
        let maxIndex = 0;
        for (let i = 1; i < levels; i++) {
          if (intensityCount[i] > intensityCount[maxIndex]) {
            maxIndex = i;
          }
        }
        
        const count = intensityCount[maxIndex];
        const index = (y * width + x) * 4;
        output[index] = avgR[maxIndex] / count;
        output[index + 1] = avgG[maxIndex] / count;
        output[index + 2] = avgB[maxIndex] / count;
        output[index + 3] = data[index + 3];
      }
    }
    
    return new ImageData(output, width, height);
  },

  edgeDetection: (imageData, threshold) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data.length);
    
    // Sobel kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const px = x + kx - 1;
            const py = y + ky - 1;
            const pi = (py * width + px) * 4;
            const intensity = (data[pi] + data[pi + 1] + data[pi + 2]) / 3;
            
            gx += intensity * sobelX[ky][kx];
            gy += intensity * sobelY[ky][kx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edge = magnitude > threshold ? 255 : 0;
        
        const index = (y * width + x) * 4;
        output[index] = edge;
        output[index + 1] = edge;
        output[index + 2] = edge;
        output[index + 3] = 255;
      }
    }
    
    return new ImageData(output, width, height);
  }
};

// OffscreenCanvas utilities for worker-side rendering
const offscreenUtils = {
  createCanvas: (width, height) => {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    return null;
  },

  imageDataToCanvas: (imageData, canvas) => {
    const offscreenCanvas = canvas || offscreenUtils.createCanvas(imageData.width, imageData.height);
    if (!offscreenCanvas) return null;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.putImageData(imageData, 0, 0);
    return offscreenCanvas;
  },

  canvasToImageData: (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  },

  // Advanced canvas-based effects that leverage GPU acceleration
  applyCanvasEffect: (imageData, effectId, settings) => {
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
        const result = offscreenUtils.canvasToImageData(canvas);
        return result || imageData;
    }

    const result = offscreenUtils.canvasToImageData(canvas);
    return result || imageData;
  }
};

// CPU-based effect application
const applyCPUEffect = (imageData, effectId, settings) => {
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
self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data;
  
  try {
    switch (type) {
      case 'APPLY_EFFECT': {
        const { effectId, settings, imageData } = payload;
        
        let result;
        
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
        
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { imageData: result }
        });
        
        break;
      }
      
      case 'GENERATE_FRAME': {
        const { imageData, effectId, settings, frameIndex, totalFrames } = payload;
        
        // Calculate animated settings based on frame
        const progress = frameIndex / (totalFrames - 1);
        const animatedSettings = {};
        
        // Animate each setting
        for (const [key, value] of Object.entries(settings)) {
          if (typeof value === 'number') {
            // Simple sinusoidal animation
            animatedSettings[key] = value * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
          } else {
            animatedSettings[key] = value;
          }
        }
        
        // Apply effect with animated settings using optimized rendering
        let result;
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
          payload: { 
            imageData: result,
            frameIndex 
          }
        });
        
        break;
      }
      
      case 'OFFSCREEN_RENDER': {
        const { imageData, operations, width, height } = payload;
        
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
        });
        
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
      error: error.message
    });
  }
});

// Handle uncaught errors
self.addEventListener('error', (error) => {
  console.error('Worker error:', error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('Worker unhandled rejection:', event.reason);
});

console.log('Effects worker loaded and ready'); 