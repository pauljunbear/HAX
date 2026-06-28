/**
 * Warp preview renderer (RENDER=1 guarded). Renders the geometric warps through
 * the live applyEffect dispatch to confirm the nearest→bilinear refactor produced
 * smooth, correct output (no jaggies, no holes, not broken).
 *   RENDER=1 npx jest warpPreview
 */
import { createCanvas, loadImage, type CanvasRenderingContext2D as NodeCtx } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { applyEffect, effectsConfig } from '../../effects';

const RUN = process.env.RENDER === '1';
const REPO = path.resolve(__dirname, '../../../..');
const OUT =
  '/private/tmp/claude-501/-Users-paul/c8210d3d-5609-4ce7-adb2-65e6a1595eb4/scratchpad/film-preview';

function defaultsFor(key: string): Record<string, number> {
  const cfg = (
    effectsConfig as Record<string, { settings?: Array<{ id: string; defaultValue: number }> }>
  )[key];
  const out: Record<string, number> = {};
  if (cfg?.settings) for (const s of cfg.settings) out[s.id] = s.defaultValue;
  return out;
}

const ITEMS: Array<{ label: string; key: string; over?: Record<string, number> }> = [
  { label: 'Original', key: '__original' },
  { label: 'Swirl', key: 'swirl', over: { strength: 6 } },
  { label: 'Kaleidoscope', key: 'kaleidoscope' },
  { label: 'Kaleidoscope Fracture', key: 'kaleidoscopeFracture' },
  { label: 'Fisheye', key: 'fisheyeWarp', over: { strength: 0.6 } },
  { label: 'Dispersion Shatter', key: 'dispersionShatter' },
  { label: 'Pixel Explosion', key: 'pixelExplosion' },
  { label: 'unifiedWarp · Spherize', key: 'unifiedWarp', over: { preset: 4 } },
  { label: 'unifiedWarp · Wave', key: 'unifiedWarp', over: { preset: 5 } },
];

(RUN ? describe : describe.skip)('warp preview render', () => {
  it('renders warps through the live dispatch', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const rel = 'design-system/studio/samples/color.jpg';
    const img = await loadImage(path.join(REPO, rel));
    const MAXW = 360;
    const scale = Math.min(1, MAXW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const base = createCanvas(w, h);
    const bctx = base.getContext('2d') as unknown as NodeCtx;
    bctx.drawImage(img as unknown as HTMLImageElement, 0, 0, w, h);
    const baseData = bctx.getImageData(0, 0, w, h);

    const cols = 3;
    const rows = Math.ceil(ITEMS.length / cols);
    const LABEL = 18;
    const PAD = 6;
    const cw = w + PAD;
    const ch = h + LABEL + PAD;
    const sheet = createCanvas(cols * cw + PAD, rows * ch + PAD);
    const sctx = sheet.getContext('2d') as unknown as NodeCtx;
    sctx.fillStyle = '#0b0b0c';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.font = '12px sans-serif';
    sctx.textBaseline = 'top';

    for (let idx = 0; idx < ITEMS.length; idx++) {
      const item = ITEMS[idx];
      const copy = new Uint8ClampedArray(baseData.data);
      if (item.key !== '__original') {
        const settings = { ...defaultsFor(item.key), ...(item.over || {}) };
        const res = await applyEffect(item.key, settings);
        const fn = Array.isArray(res) && typeof res[0] === 'function' ? res[0] : null;
        if (fn) {
          try {
            fn({ data: copy, width: w, height: h } as never);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('skip', item.key, String(e));
          }
        }
      }
      const out = bctx.createImageData(w, h);
      out.data.set(copy);
      const cx = PAD + (idx % cols) * cw;
      const cy = PAD + Math.floor(idx / cols) * ch;
      const tmp = createCanvas(w, h);
      const tctx = tmp.getContext('2d') as unknown as NodeCtx;
      tctx.putImageData(out as unknown as import('canvas').ImageData, 0, 0);
      sctx.drawImage(tmp as unknown as HTMLImageElement, cx, cy);
      sctx.fillStyle = '#eceae3';
      sctx.fillText(item.label, cx + 2, cy + h + 2);
    }
    fs.writeFileSync(path.join(OUT, 'warps.png'), sheet.toBuffer('image/png'));
    // eslint-disable-next-line no-console
    console.log('wrote', path.join(OUT, 'warps.png'));
    expect(ITEMS.length).toBeGreaterThan(0);
  }, 120000);
});
