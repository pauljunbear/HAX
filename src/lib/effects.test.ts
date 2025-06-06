import { effectsConfig, effectCategories, applyEffect } from './effects';

describe('Effects Configuration - Generative Overlays', () => {
  describe('effectsConfig', () => {
    const generativeEffects = [
      'generativeStars',
      'generativeBubbles', 
      'generativeNetwork',
      'generativeSnow',
      'generativeConfetti',
      'generativeFireflies'
    ];

    generativeEffects.forEach(effectId => {
      it(`includes ${effectId} in effectsConfig with proper configuration`, () => {
        expect(effectsConfig[effectId]).toBeDefined();
        expect(effectsConfig[effectId].label).toBeDefined();
        expect(effectsConfig[effectId].category).toBe('Generative Overlay');
        expect(effectsConfig[effectId].settings).toBeDefined();
      });

      it(`has required settings for ${effectId}`, () => {
        const effect = effectsConfig[effectId];
        const settings = effect.settings;

        // All generative effects should have these settings
        expect(settings.opacity).toBeDefined();
        expect(settings.particleCount).toBeDefined();
        expect(settings.speed).toBeDefined();
        expect(settings.color).toBeDefined();
        expect(settings.interactive).toBeDefined();

        // Check setting properties
        expect(settings.opacity.min).toBe(0);
        expect(settings.opacity.max).toBe(1);
        expect(settings.opacity.default).toBeGreaterThanOrEqual(0);
        expect(settings.opacity.default).toBeLessThanOrEqual(1);

        expect(settings.particleCount.min).toBeGreaterThan(0);
        expect(settings.particleCount.max).toBeGreaterThan(settings.particleCount.min);

        expect(settings.speed.min).toBeGreaterThan(0);
        expect(settings.speed.max).toBeGreaterThan(settings.speed.min);

        expect(settings.interactive.min).toBe(0);
        expect(settings.interactive.max).toBe(1);
        expect(settings.interactive.step).toBe(1);
      });

      it(`has appropriate default values for ${effectId}`, () => {
        const effect = effectsConfig[effectId];
        const settings = effect.settings;

        // Opacity should be reasonable for overlays
        expect(settings.opacity.default).toBeGreaterThanOrEqual(0.3);
        expect(settings.opacity.default).toBeLessThanOrEqual(0.8);

        // Particle count should be reasonable for performance
        expect(settings.particleCount.default).toBeGreaterThanOrEqual(10);
        expect(settings.particleCount.default).toBeLessThanOrEqual(100);

        // Speed should be reasonable for visible animation
        expect(settings.speed.default).toBeGreaterThanOrEqual(0.5);
        expect(settings.speed.default).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('effectCategories', () => {
    it('includes Generative Overlay category', () => {
      expect(effectCategories['Generative Overlay']).toBeDefined();
      expect(effectCategories['Generative Overlay'].icon).toBe('✨');
      expect(effectCategories['Generative Overlay'].description).toBe('Animated particle overlays');
    });

    it('lists all generative effects in the category', () => {
      const categoryEffects = effectCategories['Generative Overlay'].effects;
      const expectedEffects = [
        'generativeStars',
        'generativeBubbles', 
        'generativeNetwork',
        'generativeSnow',
        'generativeConfetti',
        'generativeFireflies'
      ];

      expectedEffects.forEach(effectId => {
        expect(categoryEffects).toContain(effectId);
      });

      expect(categoryEffects).toHaveLength(expectedEffects.length);
    });
  });

  describe('applyEffect - Generative Overlays', () => {
    const generativeEffects = [
      'generativeStars',
      'generativeBubbles', 
      'generativeNetwork',
      'generativeSnow',
      'generativeConfetti',
      'generativeFireflies'
    ];

    generativeEffects.forEach(effectId => {
      it(`returns overlay marker for ${effectId}`, async () => {
        const settings = {
          opacity: 0.7,
          particleCount: 40,
          speed: 1.5,
          color: 0xff0000, // Red
          interactive: 1
        };

        const [filterFunc, filterParams] = await applyEffect(effectId, settings);

        expect(filterFunc).toBe('GENERATIVE_OVERLAY');
        expect(filterParams).toBeDefined();
        expect(filterParams.effectType).toBe(effectId.replace('generative', '').toLowerCase());
        expect(filterParams.settings).toEqual(settings);
      });
    });

    it('handles missing settings gracefully', async () => {
      const [filterFunc, filterParams] = await applyEffect('generativeStars', {});

      expect(filterFunc).toBe('GENERATIVE_OVERLAY');
      expect(filterParams).toBeDefined();
      expect(filterParams.effectType).toBe('stars');
      expect(filterParams.settings).toEqual({});
    });

    it('preserves all settings for overlay effects', async () => {
      const settings = {
        opacity: 0.5,
        particleCount: 75,
        speed: 2.2,
        color: 0x00ff00,
        interactive: 0,
        customSetting: 999 // Should be preserved even if not standard
      };

      const [filterFunc, filterParams] = await applyEffect('generativeBubbles', settings);

      expect(filterFunc).toBe('GENERATIVE_OVERLAY');
      expect(filterParams.settings).toEqual(settings);
      expect(filterParams.settings.customSetting).toBe(999);
    });
  });

  describe('Settings validation', () => {
    it('validates setting ranges are appropriate', () => {
      const generativeEffects = Object.keys(effectsConfig).filter(key => 
        key.startsWith('generative')
      );

      generativeEffects.forEach(effectId => {
        const settings = effectsConfig[effectId].settings;

        // Opacity should be 0-1
        expect(settings.opacity.min).toBe(0);
        expect(settings.opacity.max).toBe(1);
        expect(settings.opacity.step).toBe(0.05);

        // Particle count should have reasonable limits
        expect(settings.particleCount.min).toBeGreaterThanOrEqual(10);
        expect(settings.particleCount.max).toBeLessThanOrEqual(200);
        expect(settings.particleCount.step).toBe(5);

        // Speed should allow fine-tuning
        expect(settings.speed.step).toBeLessThanOrEqual(0.1);

        // Interactive should be boolean (0-1, step 1)
        expect(settings.interactive.min).toBe(0);
        expect(settings.interactive.max).toBe(1);
        expect(settings.interactive.step).toBe(1);
      });
    });

    it('ensures color settings are properly configured', () => {
      const generativeEffects = Object.keys(effectsConfig).filter(key => 
        key.startsWith('generative')
      );

      generativeEffects.forEach(effectId => {
        const colorSetting = effectsConfig[effectId].settings.color;

        expect(colorSetting.min).toBe(0x000000);
        expect(colorSetting.max).toBe(0xffffff);
        expect(colorSetting.step).toBe(1);
        expect(colorSetting.default).toBeGreaterThanOrEqual(0x000000);
        expect(colorSetting.default).toBeLessThanOrEqual(0xffffff);
      });
    });
  });
}); 