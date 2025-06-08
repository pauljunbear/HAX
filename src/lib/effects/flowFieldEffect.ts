import Konva from 'konva';

// Perlin noise implementation
export class PerlinNoise {
  private permutation: number[];
  private p: number[];

  constructor(seed?: number) {
    this.permutation = this.generatePermutation(seed);
    this.p = new Array(512);
    for (let i = 0; i < 256; i++) {
      this.p[256 + i] = this.p[i] = this.permutation[i];
    }
  }

  private generatePermutation(seed?: number): number[] {
    const perm = Array.from({ length: 256 }, (_, i) => i);
    
    // Shuffle using seed
    let rng = seed || 12345;
    for (let i = perm.length - 1; i > 0; i--) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((rng / 4294967296) * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    
    return perm;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const a = this.p[X] + Y;
    const aa = this.p[a];
    const ab = this.p[a + 1];
    const b = this.p[X + 1] + Y;
    const ba = this.p[b];
    const bb = this.p[b + 1];
    
    return this.lerp(v,
      this.lerp(u, this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y)),
      this.lerp(u, this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1))
    );
  }

  // Fractional Brownian Motion for more interesting patterns
  fbm(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
}

// Flow field particle system
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  color: { r: number; g: number; b: number; a: number };
}

// Advanced flow field effect with particles
export const FlowFieldFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Get settings
  const scale = this.flowFieldScale() || 0.01;
  const strength = this.flowFieldStrength() || 10;
  const particleCount = this.flowFieldParticles() || 1000;
  const fieldType = this.flowFieldType() || 0; // 0: swirl, 1: turbulence, 2: wave, 3: radial
  const blend = this.flowFieldBlend() || 0.7;
  const seed = this.flowFieldSeed() || 42;
  
  // Create noise generator
  const noise = new PerlinNoise(seed);
  
  // Save original image
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  // Create flow field
  const fieldWidth = Math.ceil(width / 10);
  const fieldHeight = Math.ceil(height / 10);
  const field: Array<{ angle: number; magnitude: number }> = [];
  
  for (let y = 0; y < fieldHeight; y++) {
    for (let x = 0; x < fieldWidth; x++) {
      let angle = 0;
      let magnitude = 1;
      
      const fx = x * 10;
      const fy = y * 10;
      
      switch (Math.floor(fieldType)) {
        case 0: // Swirl
          angle = noise.fbm(fx * scale, fy * scale, 4, 0.5) * Math.PI * 4;
          magnitude = 0.5 + noise.fbm(fx * scale + 100, fy * scale + 100, 2, 0.5) * 0.5;
          break;
          
        case 1: // Turbulence
          angle = Math.abs(noise.fbm(fx * scale, fy * scale, 6, 0.65)) * Math.PI * 2;
          magnitude = Math.abs(noise.fbm(fx * scale + 50, fy * scale + 50, 4, 0.5));
          break;
          
        case 2: // Wave
          angle = Math.sin(fx * scale * 2) * Math.cos(fy * scale * 2) * Math.PI;
          angle += noise.noise(fx * scale, fy * scale) * Math.PI * 0.5;
          magnitude = 0.8;
          break;
          
        case 3: // Radial
          const cx = width / 2;
          const cy = height / 2;
          const dx = fx - cx;
          const dy = fy - cy;
          angle = Math.atan2(dy, dx) + Math.PI / 2;
          angle += noise.noise(fx * scale, fy * scale) * Math.PI * 0.3;
          magnitude = Math.sqrt(dx * dx + dy * dy) / Math.max(width, height);
          break;
      }
      
      field.push({ angle, magnitude });
    }
  }
  
  // Create particles
  const particles: Particle[] = [];
  for (let i = 0; i < particleCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      age: 0,
      maxAge: 50 + Math.random() * 100,
      color: {
        r: tempData[idx],
        g: tempData[idx + 1],
        b: tempData[idx + 2],
        a: tempData[idx + 3]
      }
    });
  }
  
  // Clear canvas with slight fade for trails
  for (let i = 0; i < data.length; i += 4) {
    data[i] = tempData[i] * 0.95;
    data[i + 1] = tempData[i + 1] * 0.95;
    data[i + 2] = tempData[i + 2] * 0.95;
    data[i + 3] = tempData[i + 3];
  }
  
  // Simulate particles
  const steps = 20;
  for (let step = 0; step < steps; step++) {
    for (const particle of particles) {
      // Get field vector at particle position
      const fieldX = Math.floor(particle.x / 10);
      const fieldY = Math.floor(particle.y / 10);
      
      if (fieldX >= 0 && fieldX < fieldWidth && fieldY >= 0 && fieldY < fieldHeight) {
        const fieldIdx = fieldY * fieldWidth + fieldX;
        const fieldVector = field[fieldIdx];
        
        // Update velocity based on field
        const force = fieldVector.magnitude * strength * 0.1;
        particle.vx += Math.cos(fieldVector.angle) * force;
        particle.vy += Math.sin(fieldVector.angle) * force;
        
        // Apply friction
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x += width;
        if (particle.x >= width) particle.x -= width;
        if (particle.y < 0) particle.y += height;
        if (particle.y >= height) particle.y -= height;
        
        // Draw particle trail
        const px = Math.floor(particle.x);
        const py = Math.floor(particle.y);
        
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          const alpha = (1 - particle.age / particle.maxAge) * 0.1;
          
          // Additive blending for glow effect
          data[idx] = Math.min(255, data[idx] + particle.color.r * alpha);
          data[idx + 1] = Math.min(255, data[idx + 1] + particle.color.g * alpha);
          data[idx + 2] = Math.min(255, data[idx + 2] + particle.color.b * alpha);
        }
        
        // Age particle
        particle.age++;
        
        // Reset if too old
        if (particle.age > particle.maxAge) {
          particle.x = Math.random() * width;
          particle.y = Math.random() * height;
          particle.age = 0;
          particle.vx = 0;
          particle.vy = 0;
          
          // Sample new color
          const idx = (Math.floor(particle.y) * width + Math.floor(particle.x)) * 4;
          particle.color = {
            r: tempData[idx],
            g: tempData[idx + 1],
            b: tempData[idx + 2],
            a: tempData[idx + 3]
          };
        }
      }
    }
  }
  
  // Blend with original
  for (let i = 0; i < data.length; i += 4) {
    data[i] = tempData[i] * (1 - blend) + data[i] * blend;
    data[i + 1] = tempData[i + 1] * (1 - blend) + data[i + 1] * blend;
    data[i + 2] = tempData[i + 2] * (1 - blend) + data[i + 2] * blend;
  }
};

// Alternative: Vector field visualization
export const VectorFieldFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const scale = this.vectorFieldScale() || 0.02;
  const spacing = this.vectorFieldSpacing() || 20;
  const length = this.vectorFieldLength() || 15;
  const thickness = this.vectorFieldThickness() || 2;
  const colorMode = this.vectorFieldColorMode() || 0; // 0: direction, 1: magnitude, 2: original
  
  const noise = new PerlinNoise();
  
  // Save original
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  // Darken background
  for (let i = 0; i < data.length; i += 4) {
    data[i] *= 0.3;
    data[i + 1] *= 0.3;
    data[i + 2] *= 0.3;
  }
  
  // Draw vector field
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      // Calculate field at this point
      const angle = noise.fbm(x * scale, y * scale, 4, 0.5) * Math.PI * 2;
      const magnitude = 0.5 + noise.fbm(x * scale + 100, y * scale + 100, 2, 0.5) * 0.5;
      
      // Calculate vector end point
      const endX = x + Math.cos(angle) * length * magnitude;
      const endY = y + Math.sin(angle) * length * magnitude;
      
      // Determine color
      let r = 255, g = 255, b = 255;
      
      switch (Math.floor(colorMode)) {
        case 0: // Direction-based color
          const hue = (angle / (Math.PI * 2) + 1) % 1;
          [r, g, b] = hslToRgb(hue, 0.8, 0.6);
          break;
          
        case 1: // Magnitude-based color
          r = Math.floor(255 * magnitude);
          g = Math.floor(255 * (1 - magnitude));
          b = Math.floor(128);
          break;
          
        case 2: // Sample original color
          const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
          r = tempData[idx];
          g = tempData[idx + 1];
          b = tempData[idx + 2];
          break;
      }
      
      // Draw vector (simple line algorithm)
      const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Math.floor(x + (endX - x) * t);
        const py = Math.floor(y + (endY - y) * t);
        
        // Draw with thickness
        for (let dy = -thickness/2; dy <= thickness/2; dy++) {
          for (let dx = -thickness/2; dx <= thickness/2; dx++) {
            const fx = px + dx;
            const fy = py + dy;
            
            if (fx >= 0 && fx < width && fy >= 0 && fy < height) {
              const idx = (fy * width + fx) * 4;
              data[idx] = Math.min(255, data[idx] + r * 0.8);
              data[idx + 1] = Math.min(255, data[idx + 1] + g * 0.8);
              data[idx + 2] = Math.min(255, data[idx + 2] + b * 0.8);
            }
          }
        }
      }
      
      // Draw arrowhead
      const arrowSize = 5;
      const arrowAngle = Math.PI / 6;
      
      const arrow1X = endX - Math.cos(angle - arrowAngle) * arrowSize;
      const arrow1Y = endY - Math.sin(angle - arrowAngle) * arrowSize;
      const arrow2X = endX - Math.cos(angle + arrowAngle) * arrowSize;
      const arrow2Y = endY - Math.sin(angle + arrowAngle) * arrowSize;
      
      // Draw arrow lines (simplified)
      drawLine(data, width, height, endX, endY, arrow1X, arrow1Y, r, g, b);
      drawLine(data, width, height, endX, endY, arrow2X, arrow2Y, r, g, b);
    }
  }
};

// Helper function to draw a line
export function drawLine(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number
) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  
  while (true) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, data[idx] + r * 0.8);
      data[idx + 1] = Math.min(255, data[idx + 1] + g * 0.8);
      data[idx + 2] = Math.min(255, data[idx + 2] + b * 0.8);
    }
    
    if (x === Math.floor(x1) && y === Math.floor(y1)) break;
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Register filters with Konva
if (typeof window !== 'undefined' && window.Konva) {
  Konva.Filters.FlowField = FlowFieldFilter;
  Konva.Filters.VectorField = VectorFieldFilter;
} 