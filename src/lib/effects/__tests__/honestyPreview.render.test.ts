/**
 * Honesty-pass preview (RENDER=1 guarded). Renders the 6 rebuilt/content-aware
 * effects through the live dispatch to confirm they now respond to the image.
 *   RENDER=1 npx jest honestyPreview
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

const KEYS = [
  'relight',
  'stainedGlass',
  'crystalFacet',
  'neuralDream',
  'holographicInterference',
  'liquidMetal',
];

(RUN ? describe : describe.skip)('honesty pass preview', () => {
  it('renders rebuilt effects', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const img = await loadImage(path.join(REPO, 'design-system/studio/samples/color.jpg'));
    const MAXW = 340;
    const scale = Math.min(1, MAXW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const base = createCanvas(w, h);
    const bctx = base.getContext('2d') as unknown as NodeCtx;
    bctx.drawImage(img as unknown as HTMLImageElement, 0, 0, w, h);
    const baseData = bctx.getImageData(0, 0, w, h);

    const items = ['__original', ...KEYS];
    const cols = 4;
    const rows = Math.ceil(items.length / cols);
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

    for (let idx = 0; idx < items.length; idx++) {
      const key = items[idx];
      const copy = new Uint8ClampedArray(baseData.data);
      let label = 'Original';
      if (key !== '__original') {
        const cfg = (effectsConfig as Record<string, { label?: string }>)[key];
        label = cfg?.label ?? key;
        const res = await applyEffect(key, defaultsFor(key));
        if (Array.isArray(res) && typeof res[0] === 'function') {
          try {
            res[0]({ data: copy, width: w, height: h } as never);
          } catch (e) {
            label += ' (err)';
          }
        }
      }
      const out = bctx.createImageData(w, h);
      out.data.set(copy);
      const cx = PAD + (idx % cols) * cw;
      const cy = PAD + Math.floor(idx / cols) * ch;
      const tmp = createCanvas(w, h);
      (tmp.getContext('2d') as unknown as NodeCtx).putImageData(
        out as unknown as import('canvas').ImageData,
        0,
        0
      );
      sctx.drawImage(tmp as unknown as HTMLImageElement, cx, cy);
      sctx.fillStyle = '#eceae3';
      sctx.fillText(label, cx + 2, cy + h + 2);
    }
    fs.writeFileSync(path.join(OUT, 'honesty.png'), sheet.toBuffer('image/png'));
    // eslint-disable-next-line no-console
    console.log('wrote', path.join(OUT, 'honesty.png'));
    expect(items.length).toBe(7);
  }, 120000);
});
