/**
 * Golden-image regression harness.
 *
 * Applies every dispatchable effect to one fixed synthetic image and snapshots
 * a compact signature (size + FNV-1a hash of the output bytes). RNG is pinned
 * deterministic for the run so stochastic effects snapshot cleanly. Any change
 * to an effect's output trips its snapshot — so an intended change to one
 * effect can't silently alter another. Konva built-in filters (which read
 * params from a Konva node `this`) throw when called bare and are recorded as
 * skipped rather than covered.
 */
import { applyEffect, effectsConfig } from '../../effects';
import { mulberry32 } from '../color-space';

type Img = { data: Uint8ClampedArray; width: number; height: number };

function makeTestImage(w = 24, h = 24): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round((x * 255) / (w - 1)); // R ramp →
      data[i + 1] = Math.round((y * 255) / (h - 1)); // G ramp ↓
      data[i + 2] = Math.round(((x + y) * 255) / (w + h - 2)); // B diagonal
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

function fnv1a(data: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function defaultsFor(key: string): Record<string, number> {
  const cfg = (
    effectsConfig as Record<string, { settings?: Array<{ id: string; defaultValue: number }> }>
  )[key];
  const out: Record<string, number> = {};
  if (cfg?.settings) for (const s of cfg.settings) out[s.id] = s.defaultValue;
  return out;
}

describe('golden-image regression harness', () => {
  test('effect output signatures are stable', async () => {
    const origRandom = Math.random;
    const seeded = mulberry32(0xc0ffee);
    Math.random = () => seeded();

    const signatures: Record<string, string> = {};
    const skipped: string[] = [];
    try {
      for (const key of Object.keys(effectsConfig).sort()) {
        let fn: ((img: Img) => void) | null = null;
        try {
          const res = await applyEffect(key, defaultsFor(key));
          fn =
            Array.isArray(res) && typeof res[0] === 'function'
              ? (res[0] as (img: Img) => void)
              : null;
        } catch {
          skipped.push(`${key}:dispatch`);
          continue;
        }
        if (!fn) {
          skipped.push(`${key}:nonfn`);
          continue;
        }
        const img = makeTestImage();
        try {
          fn(img);
        } catch {
          skipped.push(`${key}:konva-or-async`);
          continue;
        }
        signatures[key] = `${img.width}x${img.height}:${img.data.length}:${fnv1a(img.data)}`;
      }
    } finally {
      Math.random = origRandom;
    }

    // Coverage is informational; the signatures map is the actual regression guard.
    // eslint-disable-next-line no-console
    console.log(
      `golden harness: ${Object.keys(signatures).length} covered, ${skipped.length} skipped`
    );
    expect(Object.keys(signatures).length).toBeGreaterThan(20);
    expect(signatures).toMatchSnapshot('effect-signatures');
  });
});
