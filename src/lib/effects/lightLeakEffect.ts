import Konva from 'konva';

/**
 * Light Leak Effect - Simulates light leaking into a camera
 * Creates organic, colorful light streaks and gradients that appear
 * to leak from the edges or corners of the image, mimicking analog film effects
 */

interface LightLeakSettings {
  intensity: number;      // Overall effect intensity (0-1)
  color: [number, number, number]; // RGB color of the light leak
  position: [number, number]; // Position of the leak source (0-1, 0-1)
  size: number;          // Size of the light leak (0-1)
  spread: number;        // How far the light spreads (0-1)
  softness: number;      // Edge softness (0-1)
  angle: number;         // Direction angle in radians
  opacity: number;       // Overall opacity (0-1)
  blendMode: 'screen' | 'overlay' | 'soft-light' | 'color-dodge';
}

// Generate a radial gradient for the light leak
function createRadialGradient(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  softness: number
): Float32Array {
  const gradient = new Float32Array(width * height);
  const maxRadius = radius * Math.max(width, height);
  const softRadius = maxRadius * (1 - softness);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX * width;
      const dy = y - centerY * height;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let intensity = 0;
      if (distance <= softRadius) {
        intensity = 1;
      } else if (distance <= maxRadius) {
        const t = (distance - softRadius) / (maxRadius - softRadius);
        intensity = 1 - (t * t); // Quadratic falloff for smoother edges
      }
      
      gradient[y * width + x] = Math.max(0, Math.min(1, intensity));
    }
  }
  
  return gradient;
}

// Generate a directional gradient for streak effects
function createDirectionalGradient(
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  angle: number,
  spread: number,
  softness: number
): Float32Array {
  const gradient = new Float32Array(width * height);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const maxSpread = spread * Math.max(width, height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX * width;
      const dy = y - centerY * height;
      
      // Project onto the direction vector
      const projection = dx * cos + dy * sin;
      const perpendicular = Math.abs(-dx * sin + dy * cos);
      
      let intensity = 0;
      if (projection > 0 && perpendicular <= maxSpread) {
        const distanceAlongRay = projection;
        const distanceFromRay = perpendicular;
        
        // Falloff along the ray
        const rayFalloff = Math.exp(-distanceAlongRay / (maxSpread * 2));
        
        // Falloff perpendicular to the ray
        const perpFalloff = distanceFromRay <= maxSpread * softness 
          ? 1 
          : Math.exp(-(distanceFromRay - maxSpread * softness) / (maxSpread * (1 - softness)));
        
        intensity = rayFalloff * perpFalloff;
      }
      
      gradient[y * width + x] = Math.max(0, Math.min(1, intensity));
    }
  }
  
  return gradient;
}

// Apply blend modes
function applyBlendMode(
  base: number,
  overlay: number,
  mode: string
): number {
  const b = base / 255;
  const o = overlay / 255;
  let result = 0;
  
  switch (mode) {
    case 'screen':
      result = 1 - (1 - b) * (1 - o);
      break;
    case 'overlay':
      result = b < 0.5 ? 2 * b * o : 1 - 2 * (1 - b) * (1 - o);
      break;
    case 'soft-light':
      if (o < 0.5) {
        result = 2 * b * o + b * b * (1 - 2 * o);
      } else {
        result = 2 * b * (1 - o) + Math.sqrt(b) * (2 * o - 1);
      }
      break;
    case 'color-dodge':
      result = b === 1 ? 1 : Math.min(1, o / (1 - b));
      break;
    default:
      result = o; // Normal blend
  }
  
  return Math.max(0, Math.min(255, result * 255));
}

// Generate noise for organic variation
function generateNoise(width: number, height: number, scale: number): Float32Array {
  const noise = new Float32Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Simple pseudo-random noise
      const seed = (x * 12.9898 + y * 78.233) * scale;
      const value = Math.sin(seed) * 43758.5453;
      noise[y * width + x] = (value - Math.floor(value)) * 0.3 + 0.7; // 0.7 to 1.0 range
    }
  }
  
  return noise;
}

// Main Light Leak filter
export const LightLeakFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Get settings from Konva node
  const intensity = this.lightLeakIntensity?.() || 0.6;
  const colorR = this.lightLeakColorR?.() || 255;
  const colorG = this.lightLeakColorG?.() || 200;
  const colorB = this.lightLeakColorB?.() || 100;
  const positionX = this.lightLeakPositionX?.() || 0.8;
  const positionY = this.lightLeakPositionY?.() || 0.2;
  const size = this.lightLeakSize?.() || 0.4;
  const spread = this.lightLeakSpread?.() || 0.6;
  const softness = this.lightLeakSoftness?.() || 0.7;
  const angle = this.lightLeakAngle?.() || Math.PI / 4;
  const opacity = this.lightLeakOpacity?.() || 0.8;
  const blendMode = this.lightLeakBlendMode?.() || 'screen';
  
  // Create gradients
  const radialGradient = createRadialGradient(width, height, positionX, positionY, size, softness);
  const directionalGradient = createDirectionalGradient(width, height, positionX, positionY, angle, spread, softness);
  const noise = generateNoise(width, height, 0.01);
  
  // Save original data
  const originalData = new Uint8ClampedArray(data);
  
  // Apply light leak effect
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gradientIdx = y * width + x;
      
      // Combine gradients
      const radialIntensity = radialGradient[gradientIdx];
      const directionalIntensity = directionalGradient[gradientIdx];
      const noiseValue = noise[gradientIdx];
      
      // Combine all intensity sources
      const combinedIntensity = Math.max(radialIntensity, directionalIntensity * 0.7) * noiseValue * intensity * opacity;
      
      if (combinedIntensity > 0.01) {
        // Calculate light leak color
        const leakR = colorR * combinedIntensity;
        const leakG = colorG * combinedIntensity;
        const leakB = colorB * combinedIntensity;
        
        // Apply blend mode
        const originalR = originalData[idx];
        const originalG = originalData[idx + 1];
        const originalB = originalData[idx + 2];
        
        data[idx] = applyBlendMode(originalR, leakR, blendMode);
        data[idx + 1] = applyBlendMode(originalG, leakG, blendMode);
        data[idx + 2] = applyBlendMode(originalB, leakB, blendMode);
      }
    }
  }
};

// Preset light leak configurations
export const LightLeakPresets = {
  warmSunset: {
    intensity: 0.7,
    color: [255, 180, 80] as [number, number, number],
    position: [0.9, 0.1] as [number, number],
    size: 0.5,
    spread: 0.8,
    softness: 0.8,
    angle: Math.PI / 3,
    opacity: 0.7,
    blendMode: 'screen' as const
  },
  
  coolMorning: {
    intensity: 0.5,
    color: [120, 180, 255] as [number, number, number],
    position: [0.1, 0.2] as [number, number],
    size: 0.3,
    spread: 0.6,
    softness: 0.9,
    angle: -Math.PI / 4,
    opacity: 0.6,
    blendMode: 'soft-light' as const
  },
  
  vintageFilm: {
    intensity: 0.8,
    color: [255, 220, 150] as [number, number, number],
    position: [0.8, 0.8] as [number, number],
    size: 0.6,
    spread: 0.4,
    softness: 0.6,
    angle: Math.PI,
    opacity: 0.5,
    blendMode: 'overlay' as const
  },
  
  neonGlow: {
    intensity: 0.9,
    color: [255, 100, 200] as [number, number, number],
    position: [0.5, 0.1] as [number, number],
    size: 0.4,
    spread: 0.9,
    softness: 0.7,
    angle: Math.PI / 2,
    opacity: 0.8,
    blendMode: 'color-dodge' as const
  }
};

// Register with Konva
if (typeof window !== 'undefined' && window.Konva) {
  Konva.Filters.LightLeak = LightLeakFilter;
}

export default LightLeakFilter; 