import { isGpuSupportedEffect, buildGpuPass, gpuEffectIds } from '../gpuEffects';
import { getWebGL2Renderer } from '../WebGL2Renderer';

describe('GPU effect routing', () => {
  test('supported set is the verified colour effects', () => {
    const ids = gpuEffectIds().sort();
    expect(ids).toEqual(
      ['brightness', 'contrast', 'grayscale', 'hue', 'invert', 'saturation', 'sepia'].sort()
    );
  });

  test('isGpuSupportedEffect: true for shader-backed, false for others', () => {
    expect(isGpuSupportedEffect('invert')).toBe(true);
    expect(isGpuSupportedEffect('saturation')).toBe(true);
    expect(isGpuSupportedEffect('bloom')).toBe(false);
    expect(isGpuSupportedEffect('glitchArt')).toBe(false);
  });

  test('buildGpuPass returns a frag pass for supported, null otherwise', () => {
    const pass = buildGpuPass('invert', {});
    expect(pass).not.toBeNull();
    expect(typeof pass!.frag).toBe('string');
    expect(pass!.frag).toContain('outColor');
    expect(buildGpuPass('bloom', {})).toBeNull();
  });

  test('renderer is gracefully unsupported in jsdom (CPU fallback path)', () => {
    const r = getWebGL2Renderer();
    // No WebGL2 in jsdom -> isSupported() false and render() returns null, so
    // the live composite filter falls back to the CPU pipeline.
    expect(r.isSupported()).toBe(false);
    const img = new Uint8ClampedArray(4 * 4 * 4);
    const fakeImageData = { data: img, width: 4, height: 4 } as ImageData;
    expect(r.render(fakeImageData, [buildGpuPass('invert', {})!])).toBeNull();
  });
});
