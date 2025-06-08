import Konva from 'konva';

// Complex number operations for fractal calculations
export class Complex {
  constructor(public real: number, public imag: number) {}
  
  add(c: Complex): Complex {
    return new Complex(this.real + c.real, this.imag + c.imag);
  }
  
  multiply(c: Complex): Complex {
    return new Complex(
      this.real * c.real - this.imag * c.imag,
      this.real * c.imag + this.imag * c.real
    );
  }
  
  power(n: number): Complex {
    const r = Math.sqrt(this.real * this.real + this.imag * this.imag);
    const theta = Math.atan2(this.imag, this.real);
    const newR = Math.pow(r, n);
    const newTheta = theta * n;
    return new Complex(newR * Math.cos(newTheta), newR * Math.sin(newTheta));
  }
  
  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag);
  }
}

// Fractal displacement functions
export class FractalDisplacement {
  // Newton fractal function for displacement
  static newton(x: number, y: number, iterations: number = 10): { dx: number; dy: number; convergence: number } {
    let z = new Complex(x, y);
    let convergence = 0;
    
    for (let i = 0; i < iterations; i++) {
      // f(z) = z^3 - 1
      const z3 = z.power(3);
      const f = new Complex(z3.real - 1, z3.imag);
      
      // f'(z) = 3z^2
      const z2 = z.power(2);
      const df = new Complex(3 * z2.real, 3 * z2.imag);
      
      // Avoid division by zero
      if (df.magnitude() < 0.001) break;
      
      // Newton's method: z = z - f(z)/f'(z)
      const ratio = new Complex(
        (f.real * df.real + f.imag * df.imag) / (df.real * df.real + df.imag * df.imag),
        (f.imag * df.real - f.real * df.imag) / (df.real * df.real + df.imag * df.imag)
      );
      
      z = new Complex(z.real - ratio.real, z.imag - ratio.imag);
      convergence = i / iterations;
      
      // Check for convergence
      if (ratio.magnitude() < 0.001) break;
    }
    
    return { dx: z.real - x, dy: z.imag - y, convergence };
  }
  
  // Burning Ship fractal for displacement
  static burningShip(x: number, y: number, iterations: number = 20): { dx: number; dy: number; value: number } {
    let zx = 0, zy = 0;
    let i = 0;
    
    while (i < iterations && zx * zx + zy * zy < 4) {
      const xtemp = zx * zx - zy * zy + x;
      zy = Math.abs(2 * zx * zy) + y;
      zx = Math.abs(xtemp);
      i++;
    }
    
    const value = i / iterations;
    return { dx: zx - x, dy: zy - y, value };
  }
  
  // Tricorn/Mandelbar fractal
  static tricorn(x: number, y: number, iterations: number = 20): { dx: number; dy: number; value: number } {
    let zx = 0, zy = 0;
    let i = 0;
    
    while (i < iterations && zx * zx + zy * zy < 4) {
      const xtemp = zx * zx - zy * zy + x;
      zy = -2 * zx * zy + y; // Conjugate
      zx = xtemp;
      i++;
    }
    
    const value = i / iterations;
    return { dx: zx - x, dy: zy - y, value };
  }
  
  // Phoenix fractal
  static phoenix(x: number, y: number, p: number, q: number, iterations: number = 20): { dx: number; dy: number; value: number } {
    let zx = 0, zy = 0;
    let zxp = 0, zyp = 0;
    let i = 0;
    
    while (i < iterations && zx * zx + zy * zy < 4) {
      const xtemp = zx * zx - zy * zy + x + p * zxp;
      const ytemp = 2 * zx * zy + y + q * zyp;
      zxp = zx;
      zyp = zy;
      zx = xtemp;
      zy = ytemp;
      i++;
    }
    
    const value = i / iterations;
    return { dx: zx - x, dy: zy - y, value };
  }
}

// Main fractal displacement filter
export const FractalDisplacementFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Get settings
  const fractalType = this.fractalType() || 0; // 0: Newton, 1: Burning Ship, 2: Tricorn, 3: Phoenix
  const scale = this.fractalScale() || 0.002;
  const strength = this.fractalStrength() || 50;
  const iterations = this.fractalIterations() || 20;
  const centerX = this.fractalCenterX() || 0;
  const centerY = this.fractalCenterY() || 0;
  const colorMode = this.fractalColorMode() || 0; // 0: displacement only, 1: blend with fractal, 2: psychedelic
  const phoenixP = this.fractalPhoenixP() || 0.5626;
  const phoenixQ = this.fractalPhoenixQ() || -0.5;
  
  // Save original image
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  // Process each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Map to fractal space
      const fx = (x - width / 2) * scale + centerX;
      const fy = (y - height / 2) * scale + centerY;
      
      let dx = 0, dy = 0, value = 0;
      
      // Calculate displacement based on fractal type
      switch (Math.floor(fractalType)) {
        case 0: // Newton
          const newton = FractalDisplacement.newton(fx, fy, iterations);
          dx = newton.dx * strength;
          dy = newton.dy * strength;
          value = newton.convergence;
          break;
          
        case 1: // Burning Ship
          const ship = FractalDisplacement.burningShip(fx, fy, iterations);
          dx = ship.dx * strength;
          dy = ship.dy * strength;
          value = ship.value;
          break;
          
        case 2: // Tricorn
          const tricorn = FractalDisplacement.tricorn(fx, fy, iterations);
          dx = tricorn.dx * strength;
          dy = tricorn.dy * strength;
          value = tricorn.value;
          break;
          
        case 3: // Phoenix
          const phoenix = FractalDisplacement.phoenix(fx, fy, phoenixP, phoenixQ, iterations);
          dx = phoenix.dx * strength;
          dy = phoenix.dy * strength;
          value = phoenix.value;
          break;
      }
      
      // Apply displacement
      const srcX = Math.round(x + dx);
      const srcY = Math.round(y + dy);
      const destIdx = (y * width + x) * 4;
      
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * 4;
        
        switch (Math.floor(colorMode)) {
          case 0: // Displacement only
            data[destIdx] = tempData[srcIdx];
            data[destIdx + 1] = tempData[srcIdx + 1];
            data[destIdx + 2] = tempData[srcIdx + 2];
            data[destIdx + 3] = tempData[srcIdx + 3];
            break;
            
          case 1: // Blend with fractal
            const blend = 0.7;
            const fractalColor = value * 255;
            data[destIdx] = tempData[srcIdx] * blend + fractalColor * (1 - blend);
            data[destIdx + 1] = tempData[srcIdx + 1] * blend + fractalColor * (1 - blend);
            data[destIdx + 2] = tempData[srcIdx + 2] * blend + fractalColor * (1 - blend);
            data[destIdx + 3] = tempData[srcIdx + 3];
            break;
            
          case 2: // Psychedelic color mapping
            const hue = (value * 6 + dx / strength) % 1;
            const sat = 0.8 + 0.2 * Math.sin(value * Math.PI * 4);
            const light = 0.4 + 0.3 * Math.cos(value * Math.PI * 6);
            const [r, g, b] = hslToRgb(hue, sat, light);
            
            data[destIdx] = tempData[srcIdx] * 0.3 + r * 0.7;
            data[destIdx + 1] = tempData[srcIdx + 1] * 0.3 + g * 0.7;
            data[destIdx + 2] = tempData[srcIdx + 2] * 0.3 + b * 0.7;
            data[destIdx + 3] = tempData[srcIdx + 3];
            break;
        }
      } else {
        // Edge wrapping for out-of-bounds
        const wrapX = ((srcX % width) + width) % width;
        const wrapY = ((srcY % height) + height) % height;
        const wrapIdx = (wrapY * width + wrapX) * 4;
        
        data[destIdx] = tempData[wrapIdx];
        data[destIdx + 1] = tempData[wrapIdx + 1];
        data[destIdx + 2] = tempData[wrapIdx + 2];
        data[destIdx + 3] = tempData[wrapIdx + 3];
      }
    }
  }
};

// Psychedelic kaleidoscope displacement
export const PsychedelicKaleidoscopeFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const segments = this.psychSegments() || 6;
  const twist = this.psychTwist() || 1;
  const zoom = this.psychZoom() || 1.5;
  const time = this.psychTime() || 0; // For animation
  const colorShift = this.psychColorShift() || 0.5;
  
  const centerX = width / 2;
  const centerY = height / 2;
  const anglePerSegment = (Math.PI * 2) / segments;
  
  // Save original
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      let angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Apply zoom
      const zoomedDist = dist / zoom;
      
      // Apply twist based on distance
      angle += (twist * zoomedDist / Math.max(width, height)) + time;
      
      // Kaleidoscope mapping
      let segmentAngle = ((angle % anglePerSegment) + anglePerSegment) % anglePerSegment;
      if (segmentAngle > anglePerSegment / 2) {
        segmentAngle = anglePerSegment - segmentAngle;
      }
      
      // Add fractal-based perturbation
      const fractalScale = 0.01;
      const fx = zoomedDist * fractalScale * Math.cos(segmentAngle);
      const fy = zoomedDist * fractalScale * Math.sin(segmentAngle);
      const perturbation = Math.sin(fx * 5) * Math.cos(fy * 5) * 20;
      
      // Calculate source position
      const srcAngle = segmentAngle + perturbation * 0.01;
      const srcX = Math.round(centerX + Math.cos(srcAngle) * zoomedDist);
      const srcY = Math.round(centerY + Math.sin(srcAngle) * zoomedDist);
      
      const destIdx = (y * width + x) * 4;
      
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * 4;
        
        // Psychedelic color transformation
        const r = tempData[srcIdx];
        const g = tempData[srcIdx + 1];
        const b = tempData[srcIdx + 2];
        
        // RGB to HSL
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        let h = 0, s = 0;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          if (max === r / 255) {
            h = (g - b) / 255 / d + (g < b ? 6 : 0);
          } else if (max === g / 255) {
            h = (b - r) / 255 / d + 2;
          } else {
            h = (r - g) / 255 / d + 4;
          }
          h /= 6;
        }
        
        // Shift hue based on position and segment
        h = (h + colorShift * (segmentAngle / anglePerSegment) + time * 0.1) % 1;
        s = Math.min(1, s * 1.5); // Boost saturation
        
        // Convert back to RGB
        const [newR, newG, newB] = hslToRgb(h, s, l);
        
        data[destIdx] = newR;
        data[destIdx + 1] = newG;
        data[destIdx + 2] = newB;
        data[destIdx + 3] = tempData[srcIdx + 3];
      } else {
        // Trippy edge effect
        const edgeColor = Math.sin(angle * segments + time) * 127 + 128;
        data[destIdx] = edgeColor;
        data[destIdx + 1] = edgeColor * 0.7;
        data[destIdx + 2] = edgeColor * 1.3;
        data[destIdx + 3] = 255;
      }
    }
  }
};

// Fractal mirror effect
export const FractalMirrorFilter = function(this: Konva.Image, imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const divisions = this.mirrorDivisions() || 4;
  const offset = this.mirrorOffset() || 0.1;
  const recursion = this.mirrorRecursion() || 3;
  const blend = this.mirrorBlend() || 0.5;
  
  // Save original
  const tempData = new Uint8ClampedArray(data.length);
  tempData.set(data);
  
  // Apply recursive mirroring
  for (let level = 0; level < recursion; level++) {
    const scale = Math.pow(2, level);
    const blockSize = Math.max(1, Math.floor(Math.min(width, height) / (divisions * scale)));
    
    for (let by = 0; by < Math.ceil(height / blockSize); by++) {
      for (let bx = 0; bx < Math.ceil(width / blockSize); bx++) {
        // Determine mirror direction based on fractal pattern
        const fractalX = bx * offset;
        const fractalY = by * offset;
        const pattern = Math.sin(fractalX * 3) * Math.cos(fractalY * 5);
        
        const mirrorH = pattern > 0;
        const mirrorV = pattern < -0.5;
        
        // Apply mirroring within block
        for (let y = 0; y < blockSize && by * blockSize + y < height; y++) {
          for (let x = 0; x < blockSize && bx * blockSize + x < width; x++) {
            const px = bx * blockSize + x;
            const py = by * blockSize + y;
            
            let srcX = px;
            let srcY = py;
            
            if (mirrorH) {
              srcX = bx * blockSize + (blockSize - 1 - x);
            }
            if (mirrorV) {
              srcY = by * blockSize + (blockSize - 1 - y);
            }
            
            if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
              const destIdx = (py * width + px) * 4;
              const srcIdx = (srcY * width + srcX) * 4;
              
              // Blend with previous level
              const blendFactor = blend * (1 - level / recursion);
              data[destIdx] = data[destIdx] * (1 - blendFactor) + tempData[srcIdx] * blendFactor;
              data[destIdx + 1] = data[destIdx + 1] * (1 - blendFactor) + tempData[srcIdx + 1] * blendFactor;
              data[destIdx + 2] = data[destIdx + 2] * (1 - blendFactor) + tempData[srcIdx + 2] * blendFactor;
            }
          }
        }
      }
    }
  }
};

// Helper function for HSL to RGB conversion
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
  Konva.Filters.FractalDisplacement = FractalDisplacementFilter;
  Konva.Filters.PsychedelicKaleidoscope = PsychedelicKaleidoscopeFilter;
  Konva.Filters.FractalMirror = FractalMirrorFilter;
} 