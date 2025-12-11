// Animation configuration for effects that support animated export

export interface AnimationConfig {
  supportsAnimation: boolean;
  defaultDuration: number; // in milliseconds
  defaultFrameRate: number; // fps
  animatedParameters: string[]; // which settings can be animated
  animationPresets?: {
    name: string;
    duration: number;
    frameRate: number;
    parameterCurves: Record<string, (progress: number) => number>;
  }[];
}

export const animatedEffects: Record<string, AnimationConfig> = {
  pixelExplosion: {
    supportsAnimation: true,
    defaultDuration: 2000,
    defaultFrameRate: 30,
    animatedParameters: ['strength'],
    animationPresets: [
      {
        name: 'Explode',
        duration: 2000,
        frameRate: 30,
        parameterCurves: {
          strength: progress => {
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            return eased * 100; // Animate from 0 to 100
          },
        },
      },
    ],
  },

  databending: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 24,
    animatedParameters: ['amount', 'distortion'],
    animationPresets: [
      {
        name: 'Glitch Wave',
        duration: 3000,
        frameRate: 24,
        parameterCurves: {
          amount: progress => {
            // Sine wave for pulsing effect
            return 0.3 + Math.sin(progress * Math.PI * 4) * 0.2;
          },
          distortion: () => {
            // Random glitches
            return Math.random() * 0.5 + 0.1;
          },
        },
      },
    ],
  },

  temporalEcho: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['delay', 'decay'],
    animationPresets: [
      {
        name: 'Echo Fade',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          delay: progress => progress * 0.5,
          decay: progress => 0.95 - progress * 0.5,
        },
      },
    ],
  },

  chromaticGlitch: {
    supportsAnimation: true,
    defaultDuration: 2000,
    defaultFrameRate: 24,
    animatedParameters: ['amount', 'frequency'],
    animationPresets: [
      {
        name: 'RGB Chaos',
        duration: 2000,
        frameRate: 24,
        parameterCurves: {
          amount: () => Math.random() * 20,
          frequency: progress => 3 + Math.sin(progress * Math.PI * 2) * 2,
        },
      },
    ],
  },

  liquidMetal: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 30,
    animatedParameters: ['intensity'],
    animationPresets: [
      {
        name: 'Metal Flow',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          intensity: progress => {
            // Smooth oscillation
            return 0.3 + Math.sin(progress * Math.PI * 2) * 0.3;
          },
        },
      },
    ],
  },

  fisheyeWarp: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['strength'],
    animationPresets: [
      {
        name: 'Warp Pulse',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          strength: progress => {
            // Breathing effect
            return Math.sin(progress * Math.PI * 2) * 0.8;
          },
        },
      },
    ],
  },

  kaleidoscopeFracture: {
    supportsAnimation: true,
    defaultDuration: 5000,
    defaultFrameRate: 30,
    animatedParameters: ['segments'],
    animationPresets: [
      {
        name: 'Fractal Spin',
        duration: 5000,
        frameRate: 30,
        parameterCurves: {
          segments: progress => {
            // Rotate through segment counts
            return 3 + (Math.floor(progress * 8) % 8);
          },
        },
      },
    ],
  },

  // Mathematical Effects with Animation Support
  mandelbrot: {
    supportsAnimation: true,
    defaultDuration: 5000,
    defaultFrameRate: 30,
    animatedParameters: ['zoom', 'centerX', 'centerY', 'iterations'],
    animationPresets: [
      {
        name: 'Fractal Zoom',
        duration: 5000,
        frameRate: 30,
        parameterCurves: {
          zoom: progress => 1 + progress * 9, // Zoom from 1x to 10x
          iterations: progress => 100 + Math.floor(progress * 400), // Increase detail as we zoom
        },
      },
      {
        name: 'Fractal Journey',
        duration: 6000,
        frameRate: 24,
        parameterCurves: {
          centerX: progress => Math.sin(progress * Math.PI * 2) * 0.5,
          centerY: progress => Math.cos(progress * Math.PI * 2) * 0.5,
          zoom: progress => 1 + Math.sin(progress * Math.PI) * 4,
        },
      },
      {
        name: 'Deep Dive',
        duration: 8000,
        frameRate: 30,
        parameterCurves: {
          centerX: progress => -0.7533 + progress * 0.001,
          centerY: progress => 0.1138 + progress * 0.0005,
          zoom: progress => Math.exp(progress * 5), // Exponential zoom
          iterations: progress => 100 + Math.floor(progress * 900), // Increase to 1000 iterations
        },
      },
      {
        name: 'Mandelbrot Dance',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          centerX: progress => Math.sin(progress * Math.PI * 4) * 0.3,
          centerY: progress => Math.sin(progress * Math.PI * 6) * 0.3,
          zoom: progress => 2 + Math.sin(progress * Math.PI * 2) * 1.5,
          iterations: progress => 50 + Math.floor(Math.sin(progress * Math.PI * 2) * 50 + 50),
        },
      },
    ],
  },

  juliaSet: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 30,
    animatedParameters: ['cReal', 'cImag', 'zoom'],
    animationPresets: [
      {
        name: 'Julia Morph',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          cReal: progress => -0.7 + Math.sin(progress * Math.PI * 2) * 0.3,
          cImag: progress => 0.27 + Math.cos(progress * Math.PI * 2) * 0.3,
        },
      },
      {
        name: 'Julia Spiral',
        duration: 5000,
        frameRate: 24,
        parameterCurves: {
          cReal: progress => -0.8 * Math.cos(progress * Math.PI * 4),
          cImag: progress => 0.156 * Math.sin(progress * Math.PI * 4),
          zoom: progress => 1 + progress * 2,
        },
      },
      {
        name: 'Julia Bloom',
        duration: 6000,
        frameRate: 30,
        parameterCurves: {
          cReal: progress => -0.4 + Math.sin(progress * Math.PI * 3) * 0.4,
          cImag: progress => 0.6 * Math.sin(progress * Math.PI * 2),
          zoom: progress => 0.5 + Math.abs(Math.sin(progress * Math.PI * 2)) * 2,
        },
      },
      {
        name: 'Julia Chaos',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          cReal: progress => -0.835 - Math.sin(progress * Math.PI * 8) * 0.1,
          cImag: progress => -0.2321 + Math.cos(progress * Math.PI * 6) * 0.1,
          zoom: progress => 1 + Math.sin(progress * Math.PI * 4) * 0.5,
        },
      },
      {
        name: 'Julia Breathing',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          cReal: () => -0.7269,
          cImag: progress => 0.1889 + Math.sin(progress * Math.PI * 4) * 0.05,
          zoom: progress => 1 + Math.sin(progress * Math.PI * 2) * 0.8,
        },
      },
    ],
  },

  voronoi: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 24,
    animatedParameters: ['numPoints'],
    animationPresets: [
      {
        name: 'Cell Division',
        duration: 3000,
        frameRate: 24,
        parameterCurves: {
          numPoints: progress => 10 + Math.floor(progress * 490), // Animate from 10 to 500 points
        },
      },
    ],
  },

  fractalNoise: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['scale', 'opacity'],
    animationPresets: [
      {
        name: 'Noise Evolution',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          scale: progress => 0.01 + Math.sin(progress * Math.PI * 2) * 0.4,
          opacity: progress => 0.3 + Math.sin(progress * Math.PI * 4) * 0.2,
        },
      },
    ],
  },

  fractalDisplacement: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 30,
    animatedParameters: ['strength', 'scale', 'centerX', 'centerY'],
    animationPresets: [
      {
        name: 'Fractal Warp',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          strength: progress => 50 + Math.sin(progress * Math.PI * 2) * 100,
          scale: progress => 0.002 + Math.sin(progress * Math.PI * 3) * 0.003,
        },
      },
      {
        name: 'Fractal Dance',
        duration: 5000,
        frameRate: 24,
        parameterCurves: {
          centerX: progress => Math.sin(progress * Math.PI * 2) * 1.5,
          centerY: progress => Math.cos(progress * Math.PI * 2) * 1.5,
          strength: progress => 30 + progress * 70,
        },
      },
      {
        name: 'Fractal Pulse',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          strength: progress => 100 + Math.sin(progress * Math.PI * 4) * 80,
          scale: progress => 0.001 + Math.abs(Math.sin(progress * Math.PI * 2)) * 0.005,
        },
      },
      {
        name: 'Fractal Storm',
        duration: 6000,
        frameRate: 24,
        parameterCurves: {
          strength: progress =>
            50 + Math.sin(progress * Math.PI * 6) * 50 + Math.sin(progress * Math.PI * 13) * 30,
          scale: progress => 0.002 + Math.sin(progress * Math.PI * 5) * 0.002,
          centerX: progress => Math.sin(progress * Math.PI * 3) * 0.5,
          centerY: progress => Math.cos(progress * Math.PI * 4) * 0.5,
        },
      },
    ],
  },

  psychedelicKaleidoscope: {
    supportsAnimation: true,
    defaultDuration: 6000,
    defaultFrameRate: 30,
    animatedParameters: ['segments', 'twist', 'zoom', 'time', 'colorShift'],
    animationPresets: [
      {
        name: 'Kaleidoscope Trip',
        duration: 6000,
        frameRate: 30,
        parameterCurves: {
          segments: progress => 3 + Math.floor(Math.sin(progress * Math.PI * 2) * 5 + 5),
          twist: progress => progress * 5,
          zoom: progress => 1 + Math.sin(progress * Math.PI * 2) * 0.5,
          time: progress => progress * 10,
          colorShift: progress => progress * 2,
        },
      },
      {
        name: 'Fractal Mandala',
        duration: 8000,
        frameRate: 24,
        parameterCurves: {
          segments: progress => 6 + Math.floor(Math.sin(progress * Math.PI) * 2),
          twist: progress => Math.sin(progress * Math.PI * 4) * 3,
          zoom: progress => 1.5 + Math.sin(progress * Math.PI * 3) * 1,
          time: progress => progress * 20,
          colorShift: progress => Math.sin(progress * Math.PI * 2) * 2,
        },
      },
      {
        name: 'Cosmic Flower',
        duration: 5000,
        frameRate: 30,
        parameterCurves: {
          segments: () => 8,
          twist: progress => progress * 3 + Math.sin(progress * Math.PI * 6) * 0.5,
          zoom: progress => 0.8 + Math.abs(Math.sin(progress * Math.PI * 2)) * 1.5,
          time: progress => progress * 15,
          colorShift: progress => progress * 3,
        },
      },
      {
        name: 'Hypnotic Spiral',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          segments: progress => 3 + (Math.floor(progress * 10) % 8),
          twist: progress => progress * 8,
          zoom: progress => 2 - progress * 1,
          time: progress => progress * 25,
          colorShift: progress => Math.sin(progress * Math.PI * 8) * 1.5,
        },
      },
    ],
  },

  fractalMirror: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 24,
    animatedParameters: ['divisions', 'offset', 'recursion'],
    animationPresets: [
      {
        name: 'Mirror Evolution',
        duration: 4000,
        frameRate: 24,
        parameterCurves: {
          divisions: progress => 2 + Math.floor(progress * 6),
          offset: progress => 0.01 + Math.sin(progress * Math.PI * 2) * 0.2,
          recursion: progress => 1 + Math.floor(progress * 4),
        },
      },
    ],
  },

  'reaction-diffusion': {
    supportsAnimation: true,
    defaultDuration: 5000,
    defaultFrameRate: 24,
    animatedParameters: ['feedRate', 'killRate', 'iterations'],
    animationPresets: [
      {
        name: 'Pattern Evolution',
        duration: 5000,
        frameRate: 24,
        parameterCurves: {
          feedRate: progress => 0.03 + Math.sin(progress * Math.PI * 2) * 0.03,
          killRate: progress => 0.055 + Math.cos(progress * Math.PI * 2) * 0.02,
          iterations: progress => 50 + Math.floor(progress * 100),
        },
      },
      {
        name: 'Turing Morph',
        duration: 6000,
        frameRate: 24,
        parameterCurves: {
          feedRate: () => 0.055,
          killRate: progress => 0.045 + Math.sin(progress * Math.PI * 4) * 0.02,
          iterations: () => 100,
        },
      },
      {
        name: 'Chemical Waves',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          feedRate: progress => 0.02 + progress * 0.06,
          killRate: progress => 0.05 + Math.sin(progress * Math.PI * 3) * 0.015,
          iterations: progress => 80 + Math.floor(Math.sin(progress * Math.PI * 2) * 40),
        },
      },
    ],
  },

  flowField: {
    supportsAnimation: true,
    defaultDuration: 5000,
    defaultFrameRate: 30,
    animatedParameters: ['scale', 'strength', 'seed'],
    animationPresets: [
      {
        name: 'Field Evolution',
        duration: 5000,
        frameRate: 30,
        parameterCurves: {
          scale: progress => 0.01 + Math.sin(progress * Math.PI * 2) * 0.02,
          strength: progress => 10 + Math.sin(progress * Math.PI * 3) * 5,
          seed: progress => Math.floor(progress * 100),
        },
      },
      {
        name: 'Turbulent Flow',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          scale: progress => 0.005 + Math.abs(Math.sin(progress * Math.PI * 4)) * 0.03,
          strength: progress => 20 + Math.sin(progress * Math.PI * 6) * 10,
          seed: progress => 42 + Math.floor(progress * 50),
        },
      },
    ],
  },
};

// Helper to check if an effect supports animation
export const supportsAnimation = (effectId: string): boolean => {
  return animatedEffects[effectId]?.supportsAnimation || false;
};

// Get animation config for an effect
export const getAnimationConfig = (effectId: string): AnimationConfig | null => {
  return animatedEffects[effectId] || null;
};
