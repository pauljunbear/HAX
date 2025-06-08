'use client';

// Advanced GIF optimization utility for better quality vs file size balance

export interface GifOptimizationOptions {
  /** Target file size in KB (optional - will auto-adjust quality) */
  targetSizeKB?: number;
  /** Maximum file size in KB (hard limit) */
  maxSizeKB?: number;
  /** Quality level 1-10 (10 = best quality) */
  quality?: number;
  /** Content type hint for optimization */
  contentType?: 'photo' | 'graphics' | 'animation' | 'auto';
  /** Enable advanced color optimization */
  optimizeColors?: boolean;
  /** Dithering algorithm */
  dithering?: 'none' | 'floyd-steinberg' | 'nearest';
  /** Frame optimization strategy */
  frameOptimization?: 'none' | 'delta' | 'minimal';
}

export interface GifQualityMetrics {
  /** Estimated complexity score (0-1) */
  complexity: number;
  /** Number of unique colors */
  colorCount: number;
  /** Motion intensity (0-1) */
  motionIntensity: number;
  /** Recommended quality (1-10) */
  recommendedQuality: number;
  /** Estimated file size in KB */
  estimatedSizeKB: number;
}

export class GifOptimizer {
  
  /**
   * Analyze frames to determine optimal quality settings
   */
  static analyzeFrames(frames: HTMLCanvasElement[]): GifQualityMetrics {
    if (frames.length === 0) {
      return {
        complexity: 0,
        colorCount: 0,
        motionIntensity: 0,
        recommendedQuality: 5,
        estimatedSizeKB: 0
      };
    }

    const sampleFrame = frames[0];
    const ctx = sampleFrame.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context for analysis');
    }

    const imageData = ctx.getImageData(0, 0, sampleFrame.width, sampleFrame.height);
    const pixels = imageData.data;

    // Analyze color complexity
    const colorSet = new Set<string>();
    let totalBrightness = 0;
    let edgePixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      // Quantize colors to reduce unique count for analysis
      const quantizedR = Math.floor(r / 16) * 16;
      const quantizedG = Math.floor(g / 16) * 16;
      const quantizedB = Math.floor(b / 16) * 16;
      colorSet.add(`${quantizedR},${quantizedG},${quantizedB}`);

      // Calculate brightness
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      // Detect edges (simplified)
      if (i > 4 && i < pixels.length - 4) {
        const prevR = pixels[i - 4];
        const nextR = pixels[i + 4];
        if (Math.abs(r - prevR) > 30 || Math.abs(r - nextR) > 30) {
          edgePixels++;
        }
      }
    }

    const pixelCount = pixels.length / 4;
    const averageBrightness = totalBrightness / pixelCount;
    const edgeRatio = edgePixels / pixelCount;

    // Analyze motion between frames
    let motionIntensity = 0;
    if (frames.length > 1) {
      motionIntensity = this.calculateMotionIntensity(frames.slice(0, Math.min(3, frames.length)));
    }

    // Calculate complexity score
    const colorComplexity = Math.min(colorSet.size / 256, 1); // Normalize to 0-1
    const edgeComplexity = Math.min(edgeRatio * 10, 1); // Normalize edge ratio
    const brightnessVariation = Math.abs(averageBrightness - 128) / 128; // Distance from middle gray

    const complexity = (colorComplexity * 0.4 + edgeComplexity * 0.4 + motionIntensity * 0.2);

    // Determine recommended quality based on complexity
    let recommendedQuality: number;
    if (complexity < 0.3) {
      recommendedQuality = 6; // Simple content, moderate quality is fine
    } else if (complexity < 0.6) {
      recommendedQuality = 8; // Medium complexity, higher quality
    } else {
      recommendedQuality = 10; // High complexity, max quality
    }

    // Adjust for color count
    if (colorSet.size < 16) {
      recommendedQuality = Math.max(4, recommendedQuality - 2); // Graphics with few colors
    } else if (colorSet.size > 128) {
      recommendedQuality = Math.min(10, recommendedQuality + 1); // Photo-like content
    }

    // Estimate file size (very rough approximation)
    const baseSize = Math.max(1, (sampleFrame.width * sampleFrame.height * frames.length) / 1000); // Base KB, minimum 1KB
    const qualityMultiplier = (11 - recommendedQuality) * 0.1 + 0.2; // Lower quality = smaller file
    const complexityMultiplier = 0.5 + complexity * 0.5; // More complex = larger file
    const estimatedSizeKB = Math.max(1, baseSize * qualityMultiplier * complexityMultiplier); // Minimum 1KB

    return {
      complexity,
      colorCount: colorSet.size,
      motionIntensity,
      recommendedQuality,
      estimatedSizeKB: Math.round(estimatedSizeKB)
    };
  }

  /**
   * Calculate motion intensity between frames
   */
  private static calculateMotionIntensity(frames: HTMLCanvasElement[]): number {
    if (frames.length < 2) return 0;

    let totalDifference = 0;
    let comparisons = 0;

    for (let i = 1; i < frames.length; i++) {
      const ctx1 = frames[i - 1].getContext('2d');
      const ctx2 = frames[i].getContext('2d');

      if (!ctx1 || !ctx2) continue;

      const imageData1 = ctx1.getImageData(0, 0, frames[i - 1].width, frames[i - 1].height);
      const imageData2 = ctx2.getImageData(0, 0, frames[i].width, frames[i].height);

      // Sample every 10th pixel for performance
      let difference = 0;
      let samples = 0;

      for (let j = 0; j < imageData1.data.length; j += 40) { // Sample every 10th pixel (4 bytes per pixel)
        const r1 = imageData1.data[j];
        const g1 = imageData1.data[j + 1];
        const b1 = imageData1.data[j + 2];

        const r2 = imageData2.data[j];
        const g2 = imageData2.data[j + 1];
        const b2 = imageData2.data[j + 2];

        const pixelDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        difference += pixelDiff;
        samples++;
      }

      if (samples > 0) {
        totalDifference += difference / samples / 765; // Normalize to 0-1 (765 = max diff per pixel)
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDifference / comparisons : 0;
  }

  /**
   * Optimize GIF settings based on target constraints
   */
  static optimizeSettings(
    frames: HTMLCanvasElement[],
    options: GifOptimizationOptions
  ): {
    quality: number;
    workers: number;
    dithering: boolean;
    transparency: number;
    optimizedFrames?: HTMLCanvasElement[];
    estimatedSizeKB: number;
  } {
    const metrics = this.analyzeFrames(frames);
    
    let quality = options.quality || metrics.recommendedQuality;
    let workers = 2;
    let dithering = options.dithering !== 'none';
    let transparency = 0;

    // Adjust quality based on target file size
    if (options.targetSizeKB && metrics.estimatedSizeKB > options.targetSizeKB) {
      const sizeRatio = options.targetSizeKB / metrics.estimatedSizeKB;
      
      if (sizeRatio < 0.5) {
        // Very aggressive reduction needed
        quality = Math.max(1, Math.round(quality * 0.5));
      } else {
        // Moderate reduction
        const qualityAdjustment = Math.log(sizeRatio) * 4; // Even more aggressive adjustment
        quality = Math.max(1, Math.min(8, quality + qualityAdjustment)); // Cap at 8 to ensure reduction
      }
    }

    // Hard file size limit
    if (options.maxSizeKB && metrics.estimatedSizeKB > options.maxSizeKB) {
      const maxRatio = options.maxSizeKB / metrics.estimatedSizeKB;
      quality = Math.max(1, Math.round(quality * maxRatio * 0.8)); // More aggressive
    }

    // Content-specific optimizations
    if (options.contentType === 'graphics' || metrics.colorCount < 32) {
      // Graphics with few colors can use lower quality
      quality = Math.max(1, quality - 2); // More aggressive reduction for graphics
      dithering = false; // Disable dithering for graphics
    } else if (options.contentType === 'photo' || metrics.colorCount > 128) {
      // Photo-like content benefits from dithering
      dithering = true;
    }
    
    // Additional adjustment for very aggressive presets
    if (options.targetSizeKB && options.targetSizeKB < 500) {
      quality = Math.max(1, quality - 1); // Extra reduction for small targets
    }

    // Motion-based optimizations
    if (metrics.motionIntensity > 0.7) {
      // High motion - can reduce quality slightly
      quality = Math.max(1, quality - 1);
      workers = 4; // Use more workers for complex animations
    }

    // Enable transparency optimization for frames with transparent areas
    if (this.hasTransparency(frames[0])) {
      transparency = 0; // Keep transparency
    }

    // Estimate final size with optimizations
    const qualityFactor = (11 - quality) * 0.1 + 0.1;
    const optimizedSizeKB = Math.round(metrics.estimatedSizeKB * qualityFactor);

    return {
      quality: Math.round(quality),
      workers,
      dithering,
      transparency,
      estimatedSizeKB: optimizedSizeKB
    };
  }

  /**
   * Check if frames contain transparency
   */
  private static hasTransparency(frame: HTMLCanvasElement): boolean {
    const ctx = frame.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
    const pixels = imageData.data;

    // Sample every 100th pixel for performance
    for (let i = 3; i < pixels.length; i += 400) {
      if (pixels[i] < 255) return true; // Found transparency
    }

    return false;
  }

  /**
   * Create optimized frame sequence (future enhancement for delta compression)
   */
  static optimizeFrameSequence(frames: HTMLCanvasElement[]): HTMLCanvasElement[] {
    // For now, return original frames
    // Future: implement delta compression, frame skipping, etc.
    return frames;
  }

  /**
   * Generate optimization report
   */
  static generateReport(
    frames: HTMLCanvasElement[],
    originalOptions: GifOptimizationOptions
  ): {
    analysis: GifQualityMetrics;
    optimizedSettings: ReturnType<typeof GifOptimizer.optimizeSettings>;
    recommendations: string[];
  } {
    const analysis = this.analyzeFrames(frames);
    const optimizedSettings = this.optimizeSettings(frames, originalOptions);
    
    const recommendations: string[] = [];

    // Generate recommendations
    if (analysis.colorCount > 200) {
      recommendations.push('Consider reducing color palette for smaller file size');
    }

    if (analysis.motionIntensity < 0.2) {
      recommendations.push('Low motion detected - consider lower quality setting');
    }

    if (analysis.complexity > 0.8) {
      recommendations.push('High complexity content - recommend maximum quality');
    }

    if (optimizedSettings.estimatedSizeKB > 2000) {
      recommendations.push('Large file size predicted - consider reducing dimensions or frame count');
    }

    if (frames.length > 50) {
      recommendations.push('Many frames detected - consider reducing frame rate');
    }

    return {
      analysis,
      optimizedSettings,
      recommendations
    };
  }

  /**
   * Optimize settings for web delivery
   */
  static optimizeForWeb(frames: HTMLCanvasElement[]): OptimizationResult {
    return this.optimizeSettings(frames, {
      targetSizeKB: 500, // 500KB target for web
      quality: 8,
      dithering: 'none'
    });
  }

  /**
   * Optimize settings for minimal file size
   */
  static optimizeForMinimal(frames: HTMLCanvasElement[]): OptimizationResult {
    return this.optimizeSettings(frames, {
      targetSizeKB: 100, // 100KB target for minimal
      quality: 4,
      dithering: 'none'
    });
  }

  /**
   * Optimize settings for high quality
   */
  static optimizeForQuality(frames: HTMLCanvasElement[]): OptimizationResult {
    return this.optimizeSettings(frames, {
      targetSizeKB: 2000, // 2MB target for quality
      quality: 15,
      dithering: 'floyd-steinberg'
    });
  }
}

// Quality presets for common use cases
export const GIF_QUALITY_PRESETS = {
  web: {
    quality: 6,
    targetSizeKB: 1000,
    maxSizeKB: 2000,
    contentType: 'graphics' as const,
    dithering: 'none' as const
  },
  social: {
    quality: 8,
    targetSizeKB: 3000,
    maxSizeKB: 5000,
    contentType: 'animation' as const,
    dithering: 'floyd-steinberg' as const
  },
  highQuality: {
    quality: 10,
    maxSizeKB: 10000,
    contentType: 'photo' as const,
    dithering: 'floyd-steinberg' as const
  },
  minimal: {
    quality: 3, // Lower than web
    targetSizeKB: 300, // Much smaller target
    maxSizeKB: 500,   // Smaller max limit
    contentType: 'graphics' as const,
    dithering: 'none' as const
  }
} as const;

export type GifQualityPreset = keyof typeof GIF_QUALITY_PRESETS; 