import { isGpuSupportedEffect, buildGpuPass, gpuEffectIds } from '../gpuEffects';
import { getWebGL2Renderer } from '../WebGL2Renderer';

describe('GPU effect routing', () => {
  test('supported set is the verified colour effects', () => {
    const ids = gpuEffectIds().sort();
    // Only Konva-built-in-backed effects + the byte-exact LUT exposure. grayscale/
    // brightness/saturation were removed — applyEffect routes them to custom
    // linear-light math the gamma-space shaders didn't match (verified at
    // /devtest/gpu: they diverged up to 74/255; the rest are ≤1, exposure 0).
    expect(ids).toEqual(['contrast', 'exposure', 'hue', 'invert', 'sepia'].sort());
  });

  test('isGpuSupportedEffect: true for shader-backed, false for others', () => {
    expect(isGpuSupportedEffect('invert')).toBe(true);
    expect(isGpuSupportedEffect('exposure')).toBe(true);
    // Removed (custom CPU math diverges from a gamma-space shader) → CPU path.
    expect(isGpuSupportedEffect('saturation')).toBe(false);
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
