/**
 * OKLCH harmony palettes for the randomizer. A single coherent palette feeds
 * every colour-aware effect (duotone, gradient map, etc.) so a random grade
 * reads as one deliberate decision rather than fighting hues.
 */

export type RGB = [number, number, number];
export interface Palette {
  shadow: RGB;
  mid: RGB;
  highlight: RGB;
  accent: RGB;
  baseHue: number;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** OKLCH (L 0..1, C chroma, h degrees) -> sRGB [0..255]. */
export function oklch2rgb(L: number, C: number, h: number): RGB {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gam = (c: number): number => {
    c = c < 0 ? 0 : c > 1 ? 1 : c;
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  return [clamp255(gam(lr) * 255), clamp255(gam(lg) * 255), clamp255(gam(lb) * 255)];
}

export function rgbToInt([r, g, b]: RGB): number {
  return (r << 16) | (g << 8) | b;
}

export type Scheme = 'analogous' | 'complementary' | 'triadic';

/** Build a coherent shadow/mid/highlight/accent palette from a base hue + scheme. */
export function makePalette(baseHue: number, scheme: Scheme, rng: () => number): Palette {
  const h2 =
    scheme === 'complementary'
      ? baseHue + 180
      : scheme === 'triadic'
        ? baseHue + 120
        : baseHue + (rng() * 40 - 20);
  const accHue = scheme === 'triadic' ? baseHue + 240 : baseHue + (scheme === 'analogous' ? 35 : 0);
  return {
    shadow: oklch2rgb(0.26, 0.09, baseHue),
    mid: oklch2rgb(0.55, 0.1, (baseHue + h2) / 2),
    highlight: oklch2rgb(0.9, 0.07, h2),
    accent: oklch2rgb(0.68, 0.16, accHue),
    baseHue,
  };
}
