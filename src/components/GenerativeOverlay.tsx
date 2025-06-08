'use client';

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from 'tsparticles-slim';
import type { Container, Engine } from 'tsparticles-engine';
import { performanceManager } from '@/lib/performanceUtils';

export interface GenerativeOverlayProps {
  /** Unique identifier for the particles instance */
  id?: string;
  /** Type of particle effect to render */
  effectType?: 'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies';
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Opacity of the particle overlay (0-1) */
  opacity?: number;
  /** Number of particles to render */
  particleCount?: number;
  /** Primary color for particles */
  color?: string;
  /** Animation speed multiplier */
  speed?: number;
  /** Whether particles should interact with mouse/touch */
  interactive?: boolean;
  /** Z-index for overlay positioning */
  zIndex?: number;
  /** Custom className for styling */
  className?: string;
}

const GenerativeOverlay: React.FC<GenerativeOverlayProps> = ({
  id = 'generative-overlay',
  effectType = 'stars',
  visible = true,
  opacity = 0.6,
  particleCount = 50,
  color = '#ffffff',
  speed = 1,
  interactive = true,
  zIndex = 10,
  className = ''
}) => {
  const containerRef = useRef<Container | null>(null);

  // Initialize tsParticles engine with slim bundle (only once)
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  // Handle particles loaded callback with performance optimizations
  const particlesLoaded = useCallback(async (container: Container | undefined) => {
    if (container) {
      containerRef.current = container;
      
      // Register with performance manager (non-blocking)
      try {
        performanceManager.registerParticleContainer(container);
      } catch (error) {
        console.warn('Failed to register particle container:', error);
      }
    }
  }, []);

  // Cleanup on unmount or when becoming invisible
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        // Unregister from performance manager (non-blocking)
        try {
          performanceManager.unregisterParticleContainer(containerRef.current);
        } catch (error) {
          console.warn('Failed to unregister particle container:', error);
        }
        
        try {
          containerRef.current.destroy();
        } catch (error) {
          console.warn('Failed to destroy particle container:', error);
        }
        
        containerRef.current = null;
      }
    };
  }, []);

  // Pause/resume particles based on visibility
  useEffect(() => {
    if (containerRef.current) {
      try {
        if (visible) {
          containerRef.current.play();
        } else {
          containerRef.current.pause();
        }
      } catch (error) {
        console.warn('Failed to pause/resume particles:', error);
      }
    }
  }, [visible]);

  // Generate particle configuration based on effect type
  const particleOptions = useMemo(() => {
    const baseConfig = {
      background: {
        color: {
          value: 'transparent',
        },
      },
      fpsLimit: 20, // Further reduced for stability
      detectRetina: false, // Disabled for better performance
              particles: {
          number: {
            value: Math.min(particleCount, 25), // Cap particle count for stability
            density: {
              enable: true,
              area: 1000, // Increased area to spread particles more
            },
          },
        color: {
          value: color,
        },
        opacity: {
          value: opacity * 0.8, // Slightly reduce particle opacity
        },
        size: {
          value: { min: 1, max: 3 },
        },
        move: {
          enable: true,
          speed: speed * 2,
          direction: 'none' as const,
          random: false,
          straight: false,
          outModes: {
            default: 'out' as const,
          },
        },
      },
      interactivity: interactive ? {
        detect_on: 'window' as const,
        events: {
          onHover: {
            enable: true,
            mode: 'grab' as const,
          },
          onClick: {
            enable: true,
            mode: 'push' as const,
          },
          resize: true,
        },
        modes: {
          grab: {
            distance: 140,
            links: {
              opacity: 0.5,
            },
          },
          push: {
            quantity: 4,
          },
        },
      } : {
        events: {
          resize: true,
        },
      },
    };

    // Customize based on effect type
    switch (effectType) {
      case 'stars':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: 'star' as const,
              star: {
                sides: 5,
              },
            },
            size: {
              value: { min: 1, max: 4 },
            },
            move: {
              ...baseConfig.particles.move,
              speed: speed * 0.5,
            },
            twinkle: {
              particles: {
                enable: true,
                frequency: 0.05,
                opacity: 1,
              },
            },
          },
        };

      case 'bubbles':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: 'circle' as const,
            },
            size: {
              value: { min: 3, max: 8 },
            },
            move: {
              ...baseConfig.particles.move,
              direction: 'top' as const,
              speed: speed * 1.5,
            },
            opacity: {
              value: { min: 0.1, max: 0.5 },
              animation: {
                enable: true,
                speed: 1,
                minimumValue: 0.1,
              },
            },
          },
        };

      case 'network':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: 'circle' as const,
            },
            size: {
              value: { min: 2, max: 5 },
            },
            links: {
              enable: true,
              distance: 150,
              color: color,
              opacity: opacity * 0.4,
              width: 1,
            },
            move: {
              ...baseConfig.particles.move,
              speed: speed * 1,
            },
          },
        };

      case 'snow':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: 'circle' as const,
            },
            size: {
              value: { min: 1, max: 5 },
            },
            move: {
              ...baseConfig.particles.move,
              direction: 'bottom' as const,
              speed: speed * 2,
              wobble: {
                enable: true,
                distance: 10,
                speed: 3,
              },
            },
          },
        };

      case 'confetti':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: ['square', 'triangle', 'polygon'] as const,
              polygon: {
                sides: 6,
              },
            },
            size: {
              value: { min: 2, max: 6 },
            },
            move: {
              ...baseConfig.particles.move,
              direction: 'bottom' as const,
              speed: speed * 3,
              gravity: {
                enable: true,
                acceleration: 2,
              },
              rotate: {
                value: { min: 0, max: 360 },
                direction: 'random' as const,
                animation: {
                  enable: true,
                  speed: 30,
                },
              },
            },
            color: {
              value: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
            },
          },
        };

      case 'fireflies':
        return {
          ...baseConfig,
          particles: {
            ...baseConfig.particles,
            shape: {
              type: 'circle' as const,
            },
            size: {
              value: { min: 1, max: 3 },
            },
            move: {
              ...baseConfig.particles.move,
              speed: speed * 0.8,
              path: {
                enable: true,
                delay: {
                  value: 0,
                },
                options: {
                  sides: 6,
                  turnSteps: 30,
                  angle: 30,
                },
              },
            },
            opacity: {
              value: { min: 0.3, max: 1 },
              animation: {
                enable: true,
                speed: 2,
                minimumValue: 0.3,
              },
            },
          },
        };

      default:
        return baseConfig;
    }
  }, [effectType, opacity, particleCount, color, speed, interactive]);

  return (
    <div
      data-testid={`generative-overlay-${id}`}
      className={`absolute inset-0 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${className}`}
      style={{
        zIndex,
        '--overlay-opacity': opacity.toString(),
      } as React.CSSProperties}
      role="img"
      aria-label={`Decorative ${effectType} overlay effect`}
      aria-hidden={!interactive}
    >
      <Particles
        id={id}
        init={particlesInit}
        loaded={particlesLoaded}
        options={particleOptions}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: interactive ? 'auto' : 'none',
          opacity: visible ? opacity : 0,
        }}
      />
    </div>
  );
};

export default GenerativeOverlay; 