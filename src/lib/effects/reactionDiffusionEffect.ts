import Konva from 'konva';

// Gray-Scott reaction-diffusion system
export function simulateReactionDiffusion(
  width: number,
  height: number,
  settings: {
    feedRate: number;
    killRate: number;
    diffusionA: number;
    diffusionB: number;
    iterations: number;
    initialPattern: 'random' | 'center' | 'stripes' | 'spots';
  }
): { a: Float32Array; b: Float32Array } {
  const size = width * height;
  
  // Initialize concentration grids
  let a = new Float32Array(size);
  let b = new Float32Array(size);
  let nextA = new Float32Array(size);
  let nextB = new Float32Array(size);
  
  // Initialize with pattern
  for (let i = 0; i < size; i++) {
    a[i] = 1.0;
    b[i] = 0.0;
  }
  
  // Seed initial pattern
  switch (settings.initialPattern) {
    case 'center':
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const radius = Math.min(width, height) / 10;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy < radius * radius) {
            const idx = y * width + x;
            b[idx] = 1.0;
          }
        }
      }
      break;
      
    case 'random':
      for (let i = 0; i < size * 0.1; i++) {
        const idx = Math.floor(Math.random() * size);
        b[idx] = 1.0;
      }
      break;
      
    case 'stripes':
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x % 20 < 10) {
            const idx = y * width + x;
            b[idx] = 1.0;
          }
        }
      }
      break;
      
    case 'spots':
      const spotSpacing = 30;
      for (let y = 0; y < height; y += spotSpacing) {
        for (let x = 0; x < width; x += spotSpacing) {
          const cx = x + Math.random() * spotSpacing;
          const cy = y + Math.random() * spotSpacing;
          const spotRadius = 5;
          for (let dy = -spotRadius; dy <= spotRadius; dy++) {
            for (let dx = -spotRadius; dx <= spotRadius; dx++) {
              const px = Math.floor(cx + dx);
              const py = Math.floor(cy + dy);
              if (px >= 0 && px < width && py >= 0 && py < height &&
                  dx * dx + dy * dy <= spotRadius * spotRadius) {
                const idx = py * width + px;
                b[idx] = 1.0;
              }
            }
          }
        }
      }
      break;
  }
  
  // Laplacian kernel weights
  const laplacianKernel = [
    0.05, 0.2, 0.05,
    0.2, -1, 0.2,
    0.05, 0.2, 0.05
  ];
  
  // Run simulation
  for (let iter = 0; iter < settings.iterations; iter++) {
    // Calculate Laplacian and reaction-diffusion
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Calculate Laplacian for A and B
        let laplacianA = 0;
        let laplacianB = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = (y + dy) * width + (x + dx);
            const kernelIdx = (dy + 1) * 3 + (dx + 1);
            laplacianA += a[nIdx] * laplacianKernel[kernelIdx];
            laplacianB += b[nIdx] * laplacianKernel[kernelIdx];
          }
        }
        
        // Gray-Scott equations
        const aVal = a[idx];
        const bVal = b[idx];
        const reaction = aVal * bVal * bVal;
        
        nextA[idx] = aVal + (
          settings.diffusionA * laplacianA -
          reaction +
          settings.feedRate * (1 - aVal)
        );
        
        nextB[idx] = bVal + (
          settings.diffusionB * laplacianB +
          reaction -
          (settings.killRate + settings.feedRate) * bVal
        );
        
        // Clamp values
        nextA[idx] = Math.max(0, Math.min(1, nextA[idx]));
        nextB[idx] = Math.max(0, Math.min(1, nextB[idx]));
      }
    }
    
    // Swap buffers
    [a, nextA] = [nextA, a];
    [b, nextB] = [nextB, b];
  }
  
  return { a, b };
}

// Konva filter for reaction-diffusion patterns
export const ReactionDiffusionFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Get settings
  const settings = {
    feedRate: this.reactionFeedRate() || 0.055,
    killRate: this.reactionKillRate() || 0.062,
    diffusionA: this.reactionDiffusionA() || 1.0,
    diffusionB: this.reactionDiffusionB() || 0.5,
    iterations: this.reactionIterations() || 100,
    initialPattern: this.reactionPattern() || 'random' as any,
  };
  
  // Run simulation
  const { a, b } = simulateReactionDiffusion(width, height, settings);
  
  // Color mapping
  const colorScheme = this.reactionColorScheme() || 0;
  const opacity = this.reactionOpacity() || 0.8;
  
  // Save original image
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  // Apply pattern to image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const dataIdx = idx * 4;
      
      const aVal = a[idx];
      const bVal = b[idx];
      
      // Different color mappings
      let r = 0, g = 0, b = 0;
      
      switch (Math.floor(colorScheme)) {
        case 0: // Organic (green-blue)
          r = Math.floor(aVal * 50);
          g = Math.floor((1 - bVal) * 200 + 55);
          b = Math.floor(bVal * 255);
          break;
          
        case 1: // Fire (red-yellow)
          r = Math.floor((1 - aVal) * 255);
          g = Math.floor(bVal * 200);
          b = Math.floor(aVal * 50);
          break;
          
        case 2: // Zebra (black-white)
          const zebra = bVal > 0.3 ? 255 : 0;
          r = g = b = zebra;
          break;
          
        case 3: // Psychedelic
          r = Math.floor(Math.sin(bVal * Math.PI * 8) * 127 + 128);
          g = Math.floor(Math.sin(aVal * Math.PI * 6 + Math.PI/3) * 127 + 128);
          b = Math.floor(Math.sin((aVal + bVal) * Math.PI * 4 + Math.PI*2/3) * 127 + 128);
          break;
      }
      
      // Blend with original image
      data[dataIdx] = Math.round(tempData[dataIdx] * (1 - opacity) + r * opacity);
      data[dataIdx + 1] = Math.round(tempData[dataIdx + 1] * (1 - opacity) + g * opacity);
      data[dataIdx + 2] = Math.round(tempData[dataIdx + 2] * (1 - opacity) + b * opacity);
    }
  }
};

// Different reaction-diffusion presets
export const RD_PRESETS = {
  coral: { feedRate: 0.0545, killRate: 0.062 },
  mitosis: { feedRate: 0.0367, killRate: 0.0649 },
  spots: { feedRate: 0.0175, killRate: 0.051 },
  stripes: { feedRate: 0.055, killRate: 0.062 },
  bubbles: { feedRate: 0.012, killRate: 0.05 },
  worms: { feedRate: 0.054, killRate: 0.063 },
  maze: { feedRate: 0.029, killRate: 0.057 },
  holes: { feedRate: 0.039, killRate: 0.058 }
};

// Register filter with Konva
if (typeof window !== 'undefined' && window.Konva) {
  Konva.Filters.ReactionDiffusion = ReactionDiffusionFilter;
} 