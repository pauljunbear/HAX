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
          strength: (progress) => {
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            return eased * 100; // Animate from 0 to 100
          }
        }
      }
    ]
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
          amount: (progress) => {
            // Sine wave for pulsing effect
            return 0.3 + Math.sin(progress * Math.PI * 4) * 0.2;
          },
          distortion: (progress) => {
            // Random glitches
            return Math.random() * 0.5 + 0.1;
          }
        }
      }
    ]
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
          delay: (progress) => progress * 0.5,
          decay: (progress) => 0.95 - progress * 0.5
        }
      }
    ]
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
          amount: (progress) => Math.random() * 20,
          frequency: (progress) => 3 + Math.sin(progress * Math.PI * 2) * 2
        }
      }
    ]
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
          intensity: (progress) => {
            // Smooth oscillation
            return 0.3 + Math.sin(progress * Math.PI * 2) * 0.3;
          }
        }
      }
    ]
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
          strength: (progress) => {
            // Breathing effect
            return Math.sin(progress * Math.PI * 2) * 0.8;
          }
        }
      }
    ]
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
          segments: (progress) => {
            // Rotate through segment counts
            return 3 + Math.floor(progress * 8) % 8;
          }
        }
      }
    ]
  },

  // Generative Overlay Effects
  generativeStars: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Twinkling Stars',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          speed: (progress) => 1 + Math.sin(progress * Math.PI * 2) * 0.5, // Vary twinkle speed
        }
      }
    ]
  },

  generativeBubbles: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 24,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Rising Bubbles',
        duration: 4000,
        frameRate: 24,
        parameterCurves: {
          speed: (progress) => 1.5 + Math.sin(progress * Math.PI) * 0.5, // Vary float speed
        }
      }
    ]
  },

  generativeNetwork: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Network Pulse',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          speed: (progress) => 1 + Math.sin(progress * Math.PI * 4) * 0.3, // Pulsing movement
        }
      }
    ]
  },

  generativeSnow: {
    supportsAnimation: true,
    defaultDuration: 5000,
    defaultFrameRate: 24,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Falling Snow',
        duration: 5000,
        frameRate: 24,
        parameterCurves: {
          speed: (progress) => 2 + Math.sin(progress * Math.PI * 2) * 0.5, // Vary fall speed
        }
      }
    ]
  },

  generativeConfetti: {
    supportsAnimation: true,
    defaultDuration: 3000,
    defaultFrameRate: 30,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Confetti Shower',
        duration: 3000,
        frameRate: 30,
        parameterCurves: {
          speed: (progress) => 3 + Math.sin(progress * Math.PI) * 1, // Burst and settle
        }
      }
    ]
  },

  generativeFireflies: {
    supportsAnimation: true,
    defaultDuration: 4000,
    defaultFrameRate: 30,
    animatedParameters: ['speed'],
    animationPresets: [
      {
        name: 'Dancing Fireflies',
        duration: 4000,
        frameRate: 30,
        parameterCurves: {
          speed: (progress) => 0.8 + Math.sin(progress * Math.PI * 3) * 0.4, // Organic movement
        }
      }
    ]
  }
};

// Helper to check if an effect supports animation
export const supportsAnimation = (effectId: string): boolean => {
  return animatedEffects[effectId]?.supportsAnimation || false;
};

// Get animation config for an effect
export const getAnimationConfig = (effectId: string): AnimationConfig | null => {
  return animatedEffects[effectId] || null;
}; 