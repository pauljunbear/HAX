import { OrtonFilter } from '../ortonEffect';

// Mock Konva Image for testing
class MockKonvaImage {
  ortonIntensity() { return 0.7; }
  ortonBlurRadius() { return 15; }
  ortonContrast() { return 1.3; }
  ortonSaturation() { return 1.2; }
  ortonExposure() { return 1.4; }
  ortonBlend() { return 0.6; }
}

describe('Effects Debug', () => {
  it('should debug orton effect', () => {
    // Create simple test image
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Fill with a simple pattern
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;     // R
      data[i + 1] = 150; // G
      data[i + 2] = 200; // B
      data[i + 3] = 255; // A
    }
    
    const imageData = new ImageData(data, width, height);
    const originalData = new Uint8ClampedArray(imageData.data);
    
    console.log('Original first pixel:', originalData[0], originalData[1], originalData[2], originalData[3]);
    
    const mockImage = new MockKonvaImage();
    
    try {
      OrtonFilter.call(mockImage, imageData);
      console.log('Modified first pixel:', imageData.data[0], imageData.data[1], imageData.data[2], imageData.data[3]);
      
      // Check if any pixel changed
      let hasChanged = false;
      for (let i = 0; i < data.length; i++) {
        if (originalData[i] !== imageData.data[i]) {
          hasChanged = true;
          console.log(`Pixel ${i} changed from ${originalData[i]} to ${imageData.data[i]}`);
          break;
        }
      }
      
      console.log('Has changed:', hasChanged);
      expect(hasChanged).toBe(true);
    } catch (error) {
      console.error('Error applying effect:', error);
      throw error;
    }
  });
}); 