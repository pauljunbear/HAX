import { supportsAnimation, getAnimationConfig } from './animationConfig';

describe('Animation Configuration - Generative Overlays', () => {
  const generativeEffects = [
    'generativeStars',
    'generativeBubbles',
    'generativeNetwork',
    'generativeSnow',
    'generativeConfetti',
    'generativeFireflies',
  ];

  describe('supportsAnimation', () => {
    generativeEffects.forEach(effectId => {
      it(`should return true for ${effectId}`, () => {
        expect(supportsAnimation(effectId)).toBe(true);
      });
    });

    it('should return false for non-existent effects', () => {
      expect(supportsAnimation('nonExistentEffect')).toBe(false);
    });

    it('should return false for static effects', () => {
      expect(supportsAnimation('blur')).toBe(false);
      expect(supportsAnimation('sharpen')).toBe(false);
    });
  });

  describe('getAnimationConfig', () => {
    generativeEffects.forEach(effectId => {
      it(`should return valid config for ${effectId}`, () => {
        const config = getAnimationConfig(effectId);

        expect(config).toBeDefined();
        expect(config.supportsAnimation).toBe(true);
        expect(config.defaultDuration).toBeGreaterThan(0);
        expect(config.defaultFrameRate).toBeGreaterThan(0);
        expect(config.animatedParameters).toBeDefined();
        expect(config.animationPresets).toBeDefined();
        expect(config.animationPresets.length).toBeGreaterThan(0);
      });

      it(`should have appropriate animation parameters for ${effectId}`, () => {
        const config = getAnimationConfig(effectId);

        // All generative effects should animate speed
        expect(config.animatedParameters).toContain('speed');
      });

      it(`should have valid animation presets for ${effectId}`, () => {
        const config = getAnimationConfig(effectId);

        config.animationPresets.forEach(preset => {
          expect(preset.name).toBeDefined();
          expect(preset.duration).toBeGreaterThan(0);
          expect(preset.frameRate).toBeGreaterThan(0);
          expect(preset.parameterCurves).toBeDefined();

          // Check that all animated parameters have curves
          config.animatedParameters.forEach(param => {
            expect(preset.parameterCurves[param]).toBeDefined();
            expect(typeof preset.parameterCurves[param]).toBe('function');
          });
        });
      });
    });

    it('should return null for non-animated effects', () => {
      expect(getAnimationConfig('blur')).toBeNull();
      expect(getAnimationConfig('nonExistentEffect')).toBeNull();
    });
  });

  describe('Animation parameter curves', () => {
    generativeEffects.forEach(effectId => {
      it(`should have valid parameter curves for ${effectId}`, () => {
        const config = getAnimationConfig(effectId);
        if (!config) return;

        const preset = config.animationPresets[0];

        // Test curve functions with various progress values
        const progressValues = [0, 0.25, 0.5, 0.75, 1];

        Object.entries(preset.parameterCurves).forEach(([param, curve]) => {
          progressValues.forEach(progress => {
            const value = curve(progress);

            expect(typeof value).toBe('number');
            expect(isFinite(value)).toBe(true);
            expect(isNaN(value)).toBe(false);

            // Speed should be positive
            if (param === 'speed') {
              expect(value).toBeGreaterThan(0);
              expect(value).toBeLessThanOrEqual(5); // Reasonable upper bound
            }

            // Opacity should be 0-1 (though animation might use layer opacity)
            if (param === 'opacity') {
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(1);
            }
          });
        });
      });
    });
  });

  describe('Animation durations and frame rates', () => {
    generativeEffects.forEach(effectId => {
      it(`should have reasonable animation timing for ${effectId}`, () => {
        const config = getAnimationConfig(effectId);
        if (!config) return;

        // Duration should be reasonable for overlays (not too short, not too long)
        expect(config.defaultDuration).toBeGreaterThanOrEqual(2000); // At least 2 seconds
        expect(config.defaultDuration).toBeLessThanOrEqual(10000); // At most 10 seconds

        // Frame rate should be reasonable for smooth animation
        expect(config.defaultFrameRate).toBeGreaterThanOrEqual(15); // At least 15 FPS
        expect(config.defaultFrameRate).toBeLessThanOrEqual(60); // At most 60 FPS

        // Check presets as well
        config.animationPresets.forEach(preset => {
          expect(preset.duration).toBeGreaterThanOrEqual(1000);
          expect(preset.duration).toBeLessThanOrEqual(15000);
          expect(preset.frameRate).toBeGreaterThanOrEqual(15);
          expect(preset.frameRate).toBeLessThanOrEqual(60);
        });
      });
    });
  });

  describe('Effect-specific animation characteristics', () => {
    it('should have appropriate duration for stars effect', () => {
      const config = getAnimationConfig('generativeStars');
      expect(config?.defaultDuration).toBe(3000); // Twinkling should be moderate duration
    });

    it('should have appropriate duration for bubbles effect', () => {
      const config = getAnimationConfig('generativeBubbles');
      expect(config?.defaultDuration).toBe(4000); // Bubbles rise slowly
    });

    it('should have appropriate duration for snow effect', () => {
      const config = getAnimationConfig('generativeSnow');
      expect(config?.defaultDuration).toBe(5000); // Snow falls slowly
    });

    it('should have appropriate duration for confetti effect', () => {
      const config = getAnimationConfig('generativeConfetti');
      expect(config?.defaultDuration).toBe(3000); // Confetti falls quickly
    });

    it('should have varied speed curves for different effects', () => {
      const effects = ['generativeStars', 'generativeBubbles', 'generativeNetwork'];
      const speedCurves = effects.map(effectId => {
        const config = getAnimationConfig(effectId);
        return config?.animationPresets[0]?.parameterCurves.speed;
      });

      // Check that different effects have different speed behaviors
      const midPointValues = speedCurves.map(curve => (curve ? curve(0.5) : 0));
      const uniqueValues = new Set(midPointValues);

      // We should have some variation in how different effects animate
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe('Performance considerations', () => {
    it('should not have excessive frame rates for complex effects', () => {
      const complexEffects = ['generativeNetwork', 'generativeConfetti'];

      complexEffects.forEach(effectId => {
        const config = getAnimationConfig(effectId);
        if (!config) return;

        // Complex effects should use moderate frame rates for performance
        expect(config.defaultFrameRate).toBeLessThanOrEqual(30);

        config.animationPresets.forEach(preset => {
          expect(preset.frameRate).toBeLessThanOrEqual(30);
        });
      });
    });

    it('should have reasonable particle count considerations in animation', () => {
      // This is more of a documentation test - we should ensure that
      // when we have high frame rates, we consider particle performance
      generativeEffects.forEach(effectId => {
        const config = getAnimationConfig(effectId);
        if (!config) return;

        // If frame rate is high (>30), duration shouldn't be too long
        config.animationPresets.forEach(preset => {
          if (preset.frameRate > 30) {
            expect(preset.duration).toBeLessThanOrEqual(5000);
          }
        });
      });
    });
  });
});
