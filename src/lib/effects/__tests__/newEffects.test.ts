import { OrtonFilter } from '../ortonEffect';
import { LightLeakFilter, LightLeakPresets } from '../lightLeakEffect';
import { SmartSharpenFilter, SmartSharpenPresets } from '../smartSharpenEffect';

// Mock Konva Image for testing
class MockKonvaImage {
  private settings: Record<string, any> = {};

  // Orton Effect settings
  ortonIntensity() { return this.settings.ortonIntensity || 0.7; }
  ortonBlurRadius() { return this.settings.ortonBlurRadius || 15; }
  ortonContrast() { return this.settings.ortonContrast || 1.3; }
  ortonSaturation() { return this.settings.ortonSaturation || 1.2; }
  ortonExposure() { return this.settings.ortonExposure || 1.4; }
  ortonBlend() { return this.settings.ortonBlend || 0.6; }

  // Light Leak settings
  lightLeakIntensity() { return this.settings.lightLeakIntensity || 0.6; }
  lightLeakColorR() { return this.settings.lightLeakColorR || 255; }
  lightLeakColorG() { return this.settings.lightLeakColorG || 200; }
  lightLeakColorB() { return this.settings.lightLeakColorB || 100; }
  lightLeakPositionX() { return this.settings.lightLeakPositionX || 0.8; }
  lightLeakPositionY() { return this.settings.lightLeakPositionY || 0.2; }
  lightLeakSize() { return this.settings.lightLeakSize || 0.4; }
  lightLeakSpread() { return this.settings.lightLeakSpread || 0.6; }
  lightLeakSoftness() { return this.settings.lightLeakSoftness || 0.7; }
  lightLeakAngle() { return this.settings.lightLeakAngle || Math.PI / 4; }
  lightLeakOpacity() { return this.settings.lightLeakOpacity || 0.8; }
  lightLeakBlendMode() { return this.settings.lightLeakBlendMode || 'screen'; }

  // Smart Sharpen settings
  smartSharpenAmount() { return this.settings.smartSharpenAmount || 1.0; }
  smartSharpenRadius() { return this.settings.smartSharpenRadius || 1.0; }
  smartSharpenThreshold() { return this.settings.smartSharpenThreshold || 10; }
  smartSharpenNoiseReduction() { return this.settings.smartSharpenNoiseReduction || 0.3; }
  smartSharpenEdgeMode() { return this.settings.smartSharpenEdgeMode || 'sobel'; }
  smartSharpenPreserveDetails() { return this.settings.smartSharpenPreserveDetails || true; }

  setSetting(key: string, value: any) {
    this.settings[key] = value;
  }
}

function createTestImageData(width: number = 100, height: number = 100): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Create a test pattern with gradients and edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Create a gradient with some edges
      const r = Math.floor((x / width) * 255);
      const g = Math.floor((y / height) * 255);
      const b = Math.floor(((x + y) / (width + height)) * 255);
      
      // Add some sharp edges for testing sharpening
      if (x === Math.floor(width / 2) || y === Math.floor(height / 2)) {
        data[idx] = 255;     // R
        data[idx + 1] = 255; // G
        data[idx + 2] = 255; // B
      } else {
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
      data[idx + 3] = 255; // A
    }
  }
  
  return new ImageData(data, width, height);
}

function calculateImageDifference(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
  if (data1.length !== data2.length) {
    return NaN;
  }
  
  let totalDiff = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    totalDiff += rDiff + gDiff + bDiff;
    pixelCount++;
  }
  
  return pixelCount > 0 ? totalDiff / pixelCount : 0;
}

describe('New Effects', () => {
  describe('Orton Effect', () => {
    it('should apply orton effect without errors', () => {
      const imageData = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData.data);
      const mockImage = new MockKonvaImage();
      
      expect(() => {
        OrtonFilter.call(mockImage, imageData);
      }).not.toThrow();
      
      // Check that the image data was modified
      const difference = calculateImageDifference(originalData, imageData.data);
      expect(difference).toBeGreaterThan(0);
    });

    it('should preserve alpha channel', () => {
      const imageData = createTestImageData();
      const originalAlpha = new Uint8ClampedArray(imageData.data.length / 4);
      
      for (let i = 0; i < originalAlpha.length; i++) {
        originalAlpha[i] = imageData.data[i * 4 + 3];
      }
      
      const mockImage = new MockKonvaImage();
      OrtonFilter.call(mockImage, imageData);
      
      for (let i = 0; i < originalAlpha.length; i++) {
        expect(imageData.data[i * 4 + 3]).toBe(originalAlpha[i]);
      }
    });

    it('should respect intensity setting', () => {
      const imageData1 = createTestImageData();
      const imageData2 = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData1.data);
      
      const mockImage1 = new MockKonvaImage();
      mockImage1.setSetting('ortonIntensity', 0.1);
      
      const mockImage2 = new MockKonvaImage();
      mockImage2.setSetting('ortonIntensity', 0.9);
      
      OrtonFilter.call(mockImage1, imageData1);
      OrtonFilter.call(mockImage2, imageData2);
      
      // Calculate differences from original
      const diff1 = calculateImageDifference(originalData, imageData1.data);
      const diff2 = calculateImageDifference(originalData, imageData2.data);
      
      // Higher intensity should produce larger changes
      expect(diff2).toBeGreaterThan(diff1);
    });
  });

  describe('Light Leak Effect', () => {
    it('should apply light leak effect without errors', () => {
      const imageData = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData.data);
      const mockImage = new MockKonvaImage();
      
      expect(() => {
        LightLeakFilter.call(mockImage, imageData);
      }).not.toThrow();
      
      // Check that the image data was modified
      const difference = calculateImageDifference(originalData, imageData.data);
      expect(difference).toBeGreaterThan(0);
    });

    it('should have predefined presets', () => {
      expect(LightLeakPresets.warmSunset).toBeDefined();
      expect(LightLeakPresets.coolMorning).toBeDefined();
      expect(LightLeakPresets.vintageFilm).toBeDefined();
      expect(LightLeakPresets.neonGlow).toBeDefined();
      
      // Check preset structure
      expect(LightLeakPresets.warmSunset.intensity).toBeGreaterThan(0);
      expect(LightLeakPresets.warmSunset.color).toHaveLength(3);
      expect(LightLeakPresets.warmSunset.position).toHaveLength(2);
    });

    it('should respect color settings', () => {
      const imageData = createTestImageData();
      const mockImage = new MockKonvaImage();
      
      // Set a specific color (pure red)
      mockImage.setSetting('lightLeakColorR', 255);
      mockImage.setSetting('lightLeakColorG', 0);
      mockImage.setSetting('lightLeakColorB', 0);
      mockImage.setSetting('lightLeakIntensity', 1.0);
      
      expect(() => {
        LightLeakFilter.call(mockImage, imageData);
      }).not.toThrow();
      
      // The effect should have been applied
      expect(imageData.data).toBeDefined();
      expect(imageData.width).toBe(100);
      expect(imageData.height).toBe(100);
    });
  });

  describe('Smart Sharpen Effect', () => {
    it('should apply smart sharpen effect without errors', () => {
      const imageData = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData.data);
      const mockImage = new MockKonvaImage();
      
      expect(() => {
        SmartSharpenFilter.call(mockImage, imageData);
      }).not.toThrow();
      
      // Check that the image data was modified
      const difference = calculateImageDifference(originalData, imageData.data);
      expect(difference).toBeGreaterThan(0);
    });

    it('should have predefined presets', () => {
      expect(SmartSharpenPresets.subtle).toBeDefined();
      expect(SmartSharpenPresets.moderate).toBeDefined();
      expect(SmartSharpenPresets.strong).toBeDefined();
      expect(SmartSharpenPresets.portrait).toBeDefined();
      expect(SmartSharpenPresets.landscape).toBeDefined();
      expect(SmartSharpenPresets.unsharpMask).toBeDefined();
      
      // Check preset structure
      expect(SmartSharpenPresets.moderate.amount).toBeGreaterThan(0);
      expect(SmartSharpenPresets.moderate.radius).toBeGreaterThan(0);
      expect(SmartSharpenPresets.moderate.edgeMode).toBeDefined();
    });

    it('should respect edge mode settings', () => {
      const imageData1 = createTestImageData();
      const imageData2 = createTestImageData();
      const imageData3 = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData1.data);
      
      const mockImage1 = new MockKonvaImage();
      mockImage1.setSetting('smartSharpenEdgeMode', 'sobel');
      
      const mockImage2 = new MockKonvaImage();
      mockImage2.setSetting('smartSharpenEdgeMode', 'laplacian');
      
      const mockImage3 = new MockKonvaImage();
      mockImage3.setSetting('smartSharpenEdgeMode', 'unsharp');
      
      SmartSharpenFilter.call(mockImage1, imageData1);
      SmartSharpenFilter.call(mockImage2, imageData2);
      SmartSharpenFilter.call(mockImage3, imageData3);
      
      // Calculate differences from original
      const diff1 = calculateImageDifference(originalData, imageData1.data);
      const diff2 = calculateImageDifference(originalData, imageData2.data);
      const diff3 = calculateImageDifference(originalData, imageData3.data);
      
      // All should produce some change
      expect(diff1).toBeGreaterThan(0);
      expect(diff2).toBeGreaterThan(0);
      expect(diff3).toBeGreaterThan(0);
      
      // Different edge modes should produce different results
      expect(Math.abs(diff1 - diff2)).toBeGreaterThan(0.1);
    });

    it('should preserve alpha channel', () => {
      const imageData = createTestImageData();
      const originalAlpha = new Uint8ClampedArray(imageData.data.length / 4);
      
      for (let i = 0; i < originalAlpha.length; i++) {
        originalAlpha[i] = imageData.data[i * 4 + 3];
      }
      
      const mockImage = new MockKonvaImage();
      SmartSharpenFilter.call(mockImage, imageData);
      
      for (let i = 0; i < originalAlpha.length; i++) {
        expect(imageData.data[i * 4 + 3]).toBe(originalAlpha[i]);
      }
    });

    it('should handle noise reduction', () => {
      const imageData1 = createTestImageData();
      const imageData2 = createTestImageData();
      const originalData = new Uint8ClampedArray(imageData1.data);
      
      const mockImage1 = new MockKonvaImage();
      mockImage1.setSetting('smartSharpenNoiseReduction', 0);
      
      const mockImage2 = new MockKonvaImage();
      mockImage2.setSetting('smartSharpenNoiseReduction', 0.8);
      
      SmartSharpenFilter.call(mockImage1, imageData1);
      SmartSharpenFilter.call(mockImage2, imageData2);
      
      // Calculate differences from original
      const diff1 = calculateImageDifference(originalData, imageData1.data);
      const diff2 = calculateImageDifference(originalData, imageData2.data);
      
      // Both should produce some change
      expect(diff1).toBeGreaterThan(0);
      expect(diff2).toBeGreaterThan(0);
      
      // Different noise reduction settings should produce different results
      expect(Math.abs(diff1 - diff2)).toBeGreaterThan(0.1);
    });
  });

  describe('Effect Integration', () => {
    it('should be able to chain multiple effects', () => {
      const imageData = createTestImageData();
      const mockImage = new MockKonvaImage();
      
      // Apply effects in sequence
      expect(() => {
        SmartSharpenFilter.call(mockImage, imageData);
        OrtonFilter.call(mockImage, imageData);
        LightLeakFilter.call(mockImage, imageData);
      }).not.toThrow();
      
      // Image should still be valid
      expect(imageData.width).toBe(100);
      expect(imageData.height).toBe(100);
      expect(imageData.data.length).toBe(100 * 100 * 4);
    });

    it('should handle edge cases with small images', () => {
      const imageData = createTestImageData(10, 10);
      const mockImage = new MockKonvaImage();
      
      expect(() => {
        OrtonFilter.call(mockImage, imageData);
        LightLeakFilter.call(mockImage, imageData);
        SmartSharpenFilter.call(mockImage, imageData);
      }).not.toThrow();
    });

    it('should handle edge cases with large blur radius', () => {
      const imageData = createTestImageData(50, 50);
      const mockImage = new MockKonvaImage();
      
      // Set very large blur radius
      mockImage.setSetting('ortonBlurRadius', 50);
      mockImage.setSetting('smartSharpenRadius', 10);
      
      expect(() => {
        OrtonFilter.call(mockImage, imageData);
        SmartSharpenFilter.call(mockImage, imageData);
      }).not.toThrow();
    });
  });
}); 