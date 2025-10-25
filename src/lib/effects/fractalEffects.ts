import Konva from 'konva';

// Map numeric colorScheme to string values
function mapColorScheme(colorScheme: number | string): 'rainbow' | 'fire' | 'ocean' | 'psychedelic' {
  if (typeof colorScheme === 'string') {
    return colorScheme as any;
  }
  
  switch (colorScheme) {
    case 0: return 'rainbow';
    case 1: return 'fire';
    case 2: return 'ocean';
    case 3: return 'psychedelic';
    default: return 'rainbow';
  }
}

// Map numeric blend mode to string values
export function mapBlendMode(blendMode: number | string): 'overlay' | 'multiply' | 'screen' {
  if (typeof blendMode === 'string') {
    return blendMode as any;
  }
  
  switch (blendMode) {
    case 0: return 'overlay';
    case 1: return 'multiply';
    case 2: return 'screen';
    default: return 'overlay';
  }
}

// Mandelbrot fractal generator
export function generateMandelbrot(
  width: number,
  height: number,
  settings: {
    centerX: number;
    centerY: number;
    zoom: number;
    maxIterations: number;
    colorScheme: 'rainbow' | 'fire' | 'ocean' | 'psychedelic';
  }
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  const { centerX, centerY, zoom, maxIterations, colorScheme } = settings;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Convert pixel coordinates to complex plane
      const x0 = (px - width / 2) / (zoom * width / 4) + centerX;
      const y0 = (py - height / 2) / (zoom * height / 4) + centerY;

      let x = 0;
      let y = 0;
      let iteration = 0;

      // Mandelbrot iteration
      while (x * x + y * y <= 4 && iteration < maxIterations) {
        const xtemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xtemp;
        iteration++;
      }

      // Color based on iteration count
      const idx = (py * width + px) * 4;
      const color = getColorForIteration(iteration, maxIterations, colorScheme);
      
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}

// Julia set fractal generator
export function generateJuliaSet(
  width: number,
  height: number,
  settings: {
    cReal: number;
    cImag: number;
    zoom: number;
    maxIterations: number;
    colorScheme: 'rainbow' | 'fire' | 'ocean' | 'psychedelic';
  }
): ImageData {
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  const { cReal, cImag, zoom, maxIterations, colorScheme } = settings;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Convert pixel coordinates to complex plane
      let x = (px - width / 2) / (zoom * width / 4);
      let y = (py - height / 2) / (zoom * height / 4);

      let iteration = 0;

      // Julia set iteration
      while (x * x + y * y <= 4 && iteration < maxIterations) {
        const xtemp = x * x - y * y + cReal;
        y = 2 * x * y + cImag;
        x = xtemp;
        iteration++;
      }

      // Color based on iteration count
      const idx = (py * width + px) * 4;
      const color = getColorForIteration(iteration, maxIterations, colorScheme);
      
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}

// Color mapping functions
function getColorForIteration(
  iteration: number,
  maxIterations: number,
  scheme: 'rainbow' | 'fire' | 'ocean' | 'psychedelic'
): { r: number; g: number; b: number } {
  if (iteration === maxIterations) {
    return { r: 0, g: 0, b: 0 }; // Black for points in the set
  }

  const t = iteration / maxIterations;

  switch (scheme) {
    case 'rainbow':
      return {
        r: Math.floor(255 * (Math.sin(t * Math.PI * 2) * 0.5 + 0.5)),
        g: Math.floor(255 * (Math.sin(t * Math.PI * 2 + Math.PI * 2 / 3) * 0.5 + 0.5)),
        b: Math.floor(255 * (Math.sin(t * Math.PI * 2 + Math.PI * 4 / 3) * 0.5 + 0.5))
      };

    case 'fire':
      return {
        r: Math.floor(255 * Math.min(1, t * 3)),
        g: Math.floor(255 * Math.max(0, Math.min(1, (t - 0.33) * 3))),
        b: Math.floor(255 * Math.max(0, (t - 0.66) * 3))
      };

    case 'ocean':
      return {
        r: Math.floor(255 * t * t),
        g: Math.floor(255 * t),
        b: Math.floor(255 * Math.sqrt(t))
      };

    case 'psychedelic':
      const hue = t * 360 + iteration * 10;
      const saturation = 0.7 + 0.3 * Math.sin(iteration * 0.1);
      const lightness = 0.5 + 0.3 * Math.sin(iteration * 0.05);
      return hslToRgb(hue, saturation, lightness);
  }
}

// HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.floor((r + m) * 255),
    g: Math.floor((g + m) * 255),
    b: Math.floor((b + m) * 255)
  };
}

// Konva filter for Mandelbrot fractal overlay
export const MandelbrotFilter = function(this: Konva.Image, imageData: ImageData) {
  console.log('MandelbrotFilter called', {
    width: imageData.width,
    height: imageData.height,
    hasData: !!imageData.data,
    dataLength: imageData.data?.length
  });
  
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const self = this as any;
  const settings = {
    centerX: self.mandelbrotCenterX?.() || 0,
    centerY: self.mandelbrotCenterY?.() || 0,
    zoom: self.mandelbrotZoom?.() || 1,
    maxIterations: self.mandelbrotIterations?.() || 100,
    colorScheme: mapColorScheme(self.mandelbrotColorScheme?.() || 0),
  };
  
  console.log('Mandelbrot settings:', settings);

  // Generate fractal
  const fractalData = generateMandelbrot(width, height, settings);
  console.log('Generated fractal data:', {
    hasData: !!fractalData,
    dataLength: fractalData.data?.length
  });
  
  // Blend with original image
  const blendMode = mapBlendMode(self.mandelbrotBlendMode?.() || 0);
  const opacity = self.mandelbrotOpacity?.() || 0.5;

  try {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const fr = fractalData.data[i];
      const fg = fractalData.data[i + 1];
      const fb = fractalData.data[i + 2];

      // Apply blend mode
      let newR = r, newG = g, newB = b;

      switch (blendMode) {
        case 'overlay':
          newR = r < 128 ? (2 * r * fr) / 255 : 255 - (2 * (255 - r) * (255 - fr)) / 255;
          newG = g < 128 ? (2 * g * fg) / 255 : 255 - (2 * (255 - g) * (255 - fg)) / 255;
          newB = b < 128 ? (2 * b * fb) / 255 : 255 - (2 * (255 - b) * (255 - fb)) / 255;
          break;
        case 'multiply':
          newR = (r * fr) / 255;
          newG = (g * fg) / 255;
          newB = (b * fb) / 255;
          break;
        case 'screen':
          newR = 255 - ((255 - r) * (255 - fr)) / 255;
          newG = 255 - ((255 - g) * (255 - fg)) / 255;
          newB = 255 - ((255 - b) * (255 - fb)) / 255;
          break;
      }

      // Apply opacity
      data[i] = Math.round(r * (1 - opacity) + newR * opacity);
      data[i + 1] = Math.round(g * (1 - opacity) + newG * opacity);
      data[i + 2] = Math.round(b * (1 - opacity) + newB * opacity);
    }
    console.log('Mandelbrot filter applied successfully');
  } catch (error) {
    console.error('Error applying Mandelbrot filter:', error);
    throw error;
  }
};

// Konva filter for Julia set overlay
export const JuliaSetFilter = function(this: Konva.Image, imageData: ImageData) {
  console.log('JuliaSetFilter called', {
    width: imageData.width,
    height: imageData.height,
    hasData: !!imageData.data,
    dataLength: imageData.data?.length
  });
  
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const self = this as any;
  const settings = {
    cReal: self.juliaCReal?.() || -0.7,
    cImag: self.juliaCImag?.() || 0.27,
    zoom: self.juliaZoom?.() || 1,
    maxIterations: self.juliaIterations?.() || 100,
    colorScheme: mapColorScheme(self.juliaColorScheme?.() || 3),
  };
  
  console.log('Julia set settings:', settings);

  // Generate fractal
  const fractalData = generateJuliaSet(width, height, settings);
  console.log('Generated Julia set data:', {
    hasData: !!fractalData,
    dataLength: fractalData.data?.length
  });
  
  // Blend with original image
  const blendMode = mapBlendMode(self.juliaBlendMode?.() || 0);
  const opacity = self.juliaOpacity?.() || 0.5;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const fr = fractalData.data[i];
    const fg = fractalData.data[i + 1];
    const fb = fractalData.data[i + 2];

    // Apply blend mode
    let newR = r, newG = g, newB = b;

    switch (blendMode) {
      case 'overlay':
        newR = r < 128 ? (2 * r * fr) / 255 : 255 - (2 * (255 - r) * (255 - fr)) / 255;
        newG = g < 128 ? (2 * g * fg) / 255 : 255 - (2 * (255 - g) * (255 - fg)) / 255;
        newB = b < 128 ? (2 * b * fb) / 255 : 255 - (2 * (255 - b) * (255 - fb)) / 255;
        break;
      case 'multiply':
        newR = (r * fr) / 255;
        newG = (g * fg) / 255;
        newB = (b * fb) / 255;
        break;
      case 'screen':
        newR = 255 - ((255 - r) * (255 - fr)) / 255;
        newG = 255 - ((255 - g) * (255 - fg)) / 255;
        newB = 255 - ((255 - b) * (255 - fb)) / 255;
        break;
    }

    // Apply opacity
    data[i] = Math.round(r * (1 - opacity) + newR * opacity);
    data[i + 1] = Math.round(g * (1 - opacity) + newG * opacity);
    data[i + 2] = Math.round(b * (1 - opacity) + newB * opacity);
  }
};

// Register filters with Konva
if (typeof window !== 'undefined' && (window as any).Konva) {
  (Konva as any).Filters.Mandelbrot = MandelbrotFilter;
  (Konva as any).Filters.JuliaSet = JuliaSetFilter;
}

// Export registration function
export function registerFractalFilters(KonvaLib: any) {
  if (KonvaLib && KonvaLib.Filters) {
    KonvaLib.Filters.Mandelbrot = MandelbrotFilter;
    KonvaLib.Filters.JuliaSet = JuliaSetFilter;
    console.log('Fractal filters registered successfully');
  } else {
    console.error('Failed to register fractal filters: Konva.Filters not available');
  }
} 