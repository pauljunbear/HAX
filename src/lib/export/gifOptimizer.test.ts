import { GifOptimizer, GIF_QUALITY_PRESETS } from './gifOptimizer';

// Mock canvas for testing
class MockCanvas {
  width: number;
  height: number;

  constructor(width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      getImageData: () => ({
        data: new Uint8ClampedArray(this.width * this.height * 4).fill(128), // Gray pixels
        width: this.width,
        height: this.height,
      }),
    };
  }
}

// Helper to create test canvas with specific color patterns
function createTestCanvas(
  width: number = 800,
  height: number = 600,
  colorPattern: 'simple' | 'complex' | 'photo' = 'simple'
): HTMLCanvasElement {
  const canvas = new MockCanvas(width, height) as any;

  // Override getImageData to return different patterns
  canvas.getContext = () => ({
    getImageData: () => {
      const data = new Uint8ClampedArray(width * height * 4);

      switch (colorPattern) {
        case 'simple':
          // Simple pattern with few colors
          for (let i = 0; i < data.length; i += 4) {
            const color = (i / 4) % 3; // 3 colors total
            data[i] = color === 0 ? 255 : 0; // R
            data[i + 1] = color === 1 ? 255 : 0; // G
            data[i + 2] = color === 2 ? 255 : 0; // B
            data[i + 3] = 255; // A
          }
          break;

        case 'complex':
          // Complex pattern with many colors and edges
          for (let i = 0; i < data.length; i += 4) {
            const pixel = i / 4;
            const x = pixel % width;
            const y = Math.floor(pixel / width);

            // Create noise-like pattern with many colors
            data[i] = (x * 7 + y * 11) % 256; // R
            data[i + 1] = (x * 13 + y * 17) % 256; // G
            data[i + 2] = (x * 19 + y * 23) % 256; // B
            data[i + 3] = 255; // A
          }
          break;

        case 'photo':
          // Photo-like pattern with gradients
          for (let i = 0; i < data.length; i += 4) {
            const pixel = i / 4;
            const x = pixel % width;
            const y = Math.floor(pixel / width);

            // Create gradient with smooth transitions
            const gradientR = Math.floor((x / width) * 255);
            const gradientG = Math.floor((y / height) * 255);
            const gradientB = Math.floor(((x + y) / (width + height)) * 255);

            data[i] = gradientR; // R
            data[i + 1] = gradientG; // G
            data[i + 2] = gradientB; // B
            data[i + 3] = 255; // A
          }
          break;
      }

      return { data, width, height };
    },
  });

  return canvas;
}

// Helper function to generate test frames
function generateTestFrames(count: number): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;

    // Mock the getContext method
    const mockImageData = new ImageData(100, 100);
    // Fill with some test data
    for (let j = 0; j < mockImageData.data.length; j += 4) {
      mockImageData.data[j] = (i * 50) % 255; // R
      mockImageData.data[j + 1] = (i * 100) % 255; // G
      mockImageData.data[j + 2] = (i * 150) % 255; // B
      mockImageData.data[j + 3] = 255; // A
    }

    const mockContext = {
      getImageData: jest.fn().mockReturnValue(mockImageData),
      fillStyle: '',
      fillRect: jest.fn(),
      font: '',
      fillText: jest.fn(),
    };

    canvas.getContext = jest.fn().mockReturnValue(mockContext);
    frames.push(canvas);
  }
  return frames;
}

describe('GifOptimizer', () => {
  describe('analyzeFrames', () => {
    it('should return zero metrics for empty frames array', () => {
      const result = GifOptimizer.analyzeFrames([]);

      expect(result.complexity).toBe(0);
      expect(result.colorCount).toBe(0);
      expect(result.motionIntensity).toBe(0);
      expect(result.recommendedQuality).toBe(5);
      expect(result.estimatedSizeKB).toBe(0);
    });

    it('should analyze simple graphics correctly', () => {
      const frames = [createTestCanvas(400, 300, 'simple')];
      const result = GifOptimizer.analyzeFrames(frames);

      expect(result.complexity).toBeLessThan(0.5); // Simple content
      expect(result.colorCount).toBeLessThan(20); // Few colors
      expect(result.recommendedQuality).toBeLessThanOrEqual(8); // Lower quality for simple content
      expect(result.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('should analyze complex content correctly', () => {
      const frames = [createTestCanvas(400, 300, 'complex')];
      const result = GifOptimizer.analyzeFrames(frames);

      expect(result.complexity).toBeGreaterThan(0.5); // Complex content
      expect(result.colorCount).toBeGreaterThan(50); // Many colors
      expect(result.recommendedQuality).toBeGreaterThanOrEqual(8); // Higher quality for complex content
    });

    it('should analyze photo-like content correctly', () => {
      const frames = [createTestCanvas(400, 300, 'photo')];
      const result = GifOptimizer.analyzeFrames(frames);

      expect(result.colorCount).toBeGreaterThan(100); // Many colors in photo
      expect(result.recommendedQuality).toBeGreaterThanOrEqual(8); // High quality for photos
    });

    it('should calculate motion intensity for multiple frames', () => {
      const frame1 = createTestCanvas(200, 200, 'simple');
      const frame2 = createTestCanvas(200, 200, 'complex'); // Different pattern
      const result = GifOptimizer.analyzeFrames([frame1, frame2]);

      expect(result.motionIntensity).toBeGreaterThan(0); // Should detect differences
    });
  });

  describe('optimizeSettings', () => {
    it('should optimize settings for target file size', () => {
      const frames = generateTestFrames(10);
      const options = {
        targetSizeKB: 100,
        quality: 10,
        dither: 0.5,
      };

      const result = GifOptimizer.optimizeSettings(frames, options);

      expect(result.quality).toBeLessThanOrEqual(10); // Quality should not exceed initial
      expect(result.estimatedSizeKB).toBeLessThanOrEqual(options.targetSizeKB * 1.2); // Within 20% of target
    });

    it('should enforce maximum file size limits', () => {
      const frames = [createTestCanvas(800, 600, 'complex')];
      const options = { maxSizeKB: 1000, quality: 10 };

      const result = GifOptimizer.optimizeSettings(frames, options);

      expect(result.estimatedSizeKB).toBeLessThanOrEqual(options.maxSizeKB);
    });

    it('should optimize for graphics content type', () => {
      const frames = [createTestCanvas(400, 300, 'simple')];
      const options = { contentType: 'graphics' as const, quality: 8 };

      const result = GifOptimizer.optimizeSettings(frames, options);

      expect(result.quality).toBeLessThanOrEqual(8); // Should reduce quality for graphics
      expect(result.dithering).toBe(false); // Should disable dithering for graphics
    });

    it('should optimize for photo content type', () => {
      const frames = [createTestCanvas(400, 300, 'photo')];
      const options = { contentType: 'photo' as const, quality: 6 };

      const result = GifOptimizer.optimizeSettings(frames, options);

      expect(result.dithering).toBe(true); // Should enable dithering for photos
    });

    it('should adjust workers based on motion intensity', () => {
      const frames = [
        createTestCanvas(200, 200, 'simple'),
        createTestCanvas(200, 200, 'complex'),
        createTestCanvas(200, 200, 'photo'),
      ];
      const options = { quality: 8 };

      const result = GifOptimizer.optimizeSettings(frames, options);

      // Should use more workers for complex animations
      expect(result.workers).toBeGreaterThanOrEqual(2);
      expect(result.workers).toBeLessThanOrEqual(4);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive analysis report', () => {
      const frames = [createTestCanvas(400, 300, 'complex')];
      const options = { quality: 8, targetSizeKB: 1000 };

      const report = GifOptimizer.generateReport(frames, options);

      expect(report.analysis).toBeDefined();
      expect(report.optimizedSettings).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);

      expect(report.analysis.complexity).toBeGreaterThanOrEqual(0);
      expect(report.analysis.complexity).toBeLessThanOrEqual(1);
      expect(report.optimizedSettings.quality).toBeGreaterThanOrEqual(1);
      expect(report.optimizedSettings.quality).toBeLessThanOrEqual(10);
    });

    it('should provide relevant recommendations', () => {
      const frames = Array(60)
        .fill(null)
        .map(() => createTestCanvas(800, 600, 'complex'));
      const options = { quality: 10 };

      const report = GifOptimizer.generateReport(frames, options);

      expect(report.recommendations.length).toBeGreaterThan(0);

      // Should recommend reducing frame count for many frames
      const hasFrameRecommendation = report.recommendations.some(
        r => r.includes('frame') || r.includes('reducing')
      );
      expect(hasFrameRecommendation).toBe(true);
    });

    it('should recommend color optimization for high color count', () => {
      const frames = [createTestCanvas(400, 300, 'complex')]; // Many colors
      const options = { quality: 8 };

      const report = GifOptimizer.generateReport(frames, options);

      if (report.analysis.colorCount > 200) {
        const hasColorRecommendation = report.recommendations.some(r => r.includes('color'));
        expect(hasColorRecommendation).toBe(true);
      }
    });
  });

  describe('Quality Presets', () => {
    it('should have valid preset configurations', () => {
      expect(GIF_QUALITY_PRESETS.web).toBeDefined();
      expect(GIF_QUALITY_PRESETS.social).toBeDefined();
      expect(GIF_QUALITY_PRESETS.highQuality).toBeDefined();
      expect(GIF_QUALITY_PRESETS.minimal).toBeDefined();

      // Check web preset
      expect(GIF_QUALITY_PRESETS.web.quality).toBeGreaterThanOrEqual(1);
      expect(GIF_QUALITY_PRESETS.web.quality).toBeLessThanOrEqual(10);
      expect(GIF_QUALITY_PRESETS.web.targetSizeKB).toBeGreaterThan(0);

      // Check minimal preset has lowest quality
      expect(GIF_QUALITY_PRESETS.minimal.quality).toBeLessThan(
        GIF_QUALITY_PRESETS.highQuality.quality
      );

      // Check high quality preset has largest max size
      expect(GIF_QUALITY_PRESETS.highQuality.maxSizeKB).toBeGreaterThan(
        GIF_QUALITY_PRESETS.minimal.maxSizeKB!
      );
    });

    it('should apply presets correctly in optimization', () => {
      const frames = generateTestFrames(5);

      const webResult = GifOptimizer.optimizeForWeb(frames);
      const minimalResult = GifOptimizer.optimizeForMinimal(frames);

      // Both presets should produce valid results
      expect(webResult.quality).toBeGreaterThanOrEqual(1);
      expect(minimalResult.quality).toBeGreaterThanOrEqual(1);

      // Minimal quality should be lower than or equal to web quality
      expect(minimalResult.quality).toBeLessThanOrEqual(webResult.quality);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small canvases', () => {
      const frames = [createTestCanvas(10, 10, 'simple')];
      const result = GifOptimizer.analyzeFrames(frames);

      expect(result.estimatedSizeKB).toBeGreaterThan(0);
      expect(result.complexity).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large canvases', () => {
      const frames = [createTestCanvas(2000, 2000, 'complex')];
      const options = { maxSizeKB: 5000 };

      const result = GifOptimizer.optimizeSettings(frames, options);

      expect(result.quality).toBeGreaterThanOrEqual(1);
      expect(result.estimatedSizeKB).toBeLessThanOrEqual(options.maxSizeKB);
    });

    it('should handle single frame animations', () => {
      const frames = [createTestCanvas(400, 300, 'photo')];
      const result = GifOptimizer.analyzeFrames(frames);

      expect(result.motionIntensity).toBe(0); // No motion for single frame
      expect(result.complexity).toBeGreaterThanOrEqual(0);
    });

    it('should gracefully handle canvas context errors', () => {
      const badCanvas = {
        width: 400,
        height: 300,
        getContext: () => null, // Simulate context failure
      } as any;

      expect(() => {
        GifOptimizer.analyzeFrames([badCanvas]);
      }).toThrow('Cannot get canvas context for analysis');
    });
  });

  describe('Performance', () => {
    it('should analyze frames efficiently', () => {
      const frames = Array(10)
        .fill(null)
        .map(() => createTestCanvas(800, 600, 'complex'));

      const startTime = performance.now();
      const result = GifOptimizer.analyzeFrames(frames);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toBeDefined();
    });

    it('should handle large frame counts without excessive memory usage', () => {
      const frames = Array(50)
        .fill(null)
        .map(() => createTestCanvas(400, 300, 'simple'));

      expect(() => {
        GifOptimizer.generateReport(frames, { quality: 8 });
      }).not.toThrow();
    });
  });
});
