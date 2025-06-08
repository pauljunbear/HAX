import { PerlinNoise, drawLine } from '../flowFieldEffect';

describe('Flow Field Effects', () => {
  describe('PerlinNoise', () => {
    let perlin: PerlinNoise;

    beforeEach(() => {
      perlin = new PerlinNoise();
    });

    it('should generate consistent noise for same inputs', () => {
      const value1 = perlin.noise(1.5, 2.5);
      const value2 = perlin.noise(1.5, 2.5);
      
      expect(value1).toBe(value2);
    });

    it('should generate different noise for different inputs', () => {
      const value1 = perlin.noise(1.5, 2.5);
      const value2 = perlin.noise(1.6, 2.5);
      
      expect(value1).not.toBe(value2);
    });

    it('should generate values between -1 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 10;
        const y = Math.random() * 10;
        const value = perlin.noise(x, y);
        
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    describe('Fractional Brownian Motion', () => {
      it('should generate values in reasonable range', () => {
        for (let i = 0; i < 100; i++) {
          const x = Math.random() * 10;
          const y = Math.random() * 10;
          const value = perlin.fbm(x, y);
          
          // FBM can go outside -1 to 1 range, but should be reasonable
          expect(value).toBeGreaterThanOrEqual(-2);
          expect(value).toBeLessThanOrEqual(2);
        }
      });

      it('should respect octaves parameter', () => {
        const x = 5.123, y = 5.456; // Use non-integer values to avoid edge cases
        const value1 = perlin.fbm(x, y, 1);
        const value2 = perlin.fbm(x, y, 4);
        
        // More octaves should generally produce different (more complex) values
        expect(value1).not.toBe(value2);
      });

      it('should respect persistence parameter', () => {
        const x = 5.123, y = 5.456; // Use non-integer values to avoid edge cases
        const value1 = perlin.fbm(x, y, 4, 0.2);
        const value2 = perlin.fbm(x, y, 4, 0.8);
        
        // Different persistence should produce different values
        expect(value1).not.toBe(value2);
      });
    });
  });

  describe('Line Drawing', () => {
    it('should draw line within image bounds', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Initialize with zeros
      data.fill(0);
      
      drawLine(data, width, height, 2, 2, 7, 7, 255, 0, 0);
      
      // Check if some pixels were modified (drawLine adds to existing values)
      let hasColoredPixels = false;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0) { // Red channel should be > 0
          hasColoredPixels = true;
          break;
        }
      }
      
      expect(hasColoredPixels).toBe(true);
    });

    it('should handle lines outside image bounds', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Initialize with zeros
      data.fill(0);
      
      // Draw line from outside bounds
      drawLine(data, width, height, -5, -5, 15, 15, 255, 0, 0);
      
      // Check if some pixels within bounds were modified
      let hasColoredPixels = false;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0) { // Red channel should be > 0
          hasColoredPixels = true;
          break;
        }
      }
      
      expect(hasColoredPixels).toBe(true);
    });

    it('should respect color parameters', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Initialize with zeros
      data.fill(0);
      
      drawLine(data, width, height, 2, 2, 7, 7, 255, 128, 0);
      
      // Find a colored pixel and check if colors are applied correctly
      let foundRedPixel = false;
      let foundGreenPixel = false;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0) { // Red channel
          foundRedPixel = true;
        }
        if (data[i + 1] > 0) { // Green channel
          foundGreenPixel = true;
        }
      }
      
      expect(foundRedPixel).toBe(true);
      expect(foundGreenPixel).toBe(true);
    });
  });
}); 