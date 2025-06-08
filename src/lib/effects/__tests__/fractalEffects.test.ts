import { generateMandelbrot, generateJuliaSet, mapBlendMode } from '../fractalEffects';

describe('Fractal Effects', () => {
  describe('generateMandelbrot', () => {
    it('should generate correct image data dimensions', () => {
      const width = 100;
      const height = 80;
      const settings = {
        centerX: 0,
        centerY: 0,
        zoom: 1,
        maxIterations: 100,
        colorScheme: 'rainbow' as const
      };

      const result = generateMandelbrot(width, height, settings);

      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      expect(result.data.length).toBe(width * height * 4); // RGBA
    });

    it('should generate black pixels for points inside the set', () => {
      const width = 10;
      const height = 10;
      const settings = {
        centerX: 0,
        centerY: 0,
        zoom: 0.5, // Zoom out to include more of the set
        maxIterations: 100,
        colorScheme: 'rainbow' as const
      };

      const result = generateMandelbrot(width, height, settings);
      
      // Check center pixel (should be in the set)
      const centerIdx = ((height / 2) * width + width / 2) * 4;
      expect(result.data[centerIdx]).toBe(0); // R
      expect(result.data[centerIdx + 1]).toBe(0); // G
      expect(result.data[centerIdx + 2]).toBe(0); // B
      expect(result.data[centerIdx + 3]).toBe(255); // A
    });

    it('should generate colored pixels for points outside the set', () => {
      const width = 10;
      const height = 10;
      const settings = {
        centerX: 2, // Move to area definitely outside the set
        centerY: 0,
        zoom: 1,
        maxIterations: 100,
        colorScheme: 'rainbow' as const
      };

      const result = generateMandelbrot(width, height, settings);
      
      // Check center pixel (should be outside the set)
      const centerIdx = ((height / 2) * width + width / 2) * 4;
      const isColored = result.data[centerIdx] > 0 || 
                       result.data[centerIdx + 1] > 0 || 
                       result.data[centerIdx + 2] > 0;
      expect(isColored).toBe(true);
    });
  });

  describe('generateJuliaSet', () => {
    it('should generate correct image data dimensions', () => {
      const width = 100;
      const height = 80;
      const settings = {
        cReal: -0.7,
        cImag: 0.27,
        zoom: 1,
        maxIterations: 100,
        colorScheme: 'rainbow' as const
      };

      const result = generateJuliaSet(width, height, settings);

      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      expect(result.data.length).toBe(width * height * 4); // RGBA
    });

    it('should generate different patterns with different complex constants', () => {
      const width = 10;
      const height = 10;
      const baseSettings = {
        zoom: 1,
        maxIterations: 100,
        colorScheme: 'rainbow' as const
      };

      const result1 = generateJuliaSet(width, height, {
        ...baseSettings,
        cReal: -0.7,
        cImag: 0.27
      });

      const result2 = generateJuliaSet(width, height, {
        ...baseSettings,
        cReal: 0.285,
        cImag: 0
      });

      // Compare center pixels - should be different
      const centerIdx = ((height / 2) * width + width / 2) * 4;
      const pixelsDiffer = result1.data[centerIdx] !== result2.data[centerIdx] ||
                          result1.data[centerIdx + 1] !== result2.data[centerIdx + 1] ||
                          result1.data[centerIdx + 2] !== result2.data[centerIdx + 2];
      expect(pixelsDiffer).toBe(true);
    });
  });

  describe('mapBlendMode', () => {
    it('should map numeric values to blend modes', () => {
      expect(mapBlendMode(0)).toBe('overlay');
      expect(mapBlendMode(1)).toBe('multiply');
      expect(mapBlendMode(2)).toBe('screen');
      expect(mapBlendMode(3)).toBe('overlay'); // default
    });

    it('should pass through valid string blend modes', () => {
      expect(mapBlendMode('overlay')).toBe('overlay');
      expect(mapBlendMode('multiply')).toBe('multiply');
      expect(mapBlendMode('screen')).toBe('screen');
    });
  });
}); 