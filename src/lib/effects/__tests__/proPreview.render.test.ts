/**
 * Pro-effect preview renderer (RENDER=1 guarded; not a unit test).
 *   RENDER=1 npx jest proPreview
 */
import { createCanvas, loadImage, type CanvasRenderingContext2D as NodeCtx } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { applyClarity } from '../pro/clarity';
import { applyColorBalance } from '../pro/colorBalance';
import { applySplitTone } from '../pro/splitTone';
import { applyProMist } from '../pro/proMist';
import { applyGradND } from '../pro/gradND';
import { applyHslSecondary } from '../pro/hslSecondary';
import { applyExposure } from '../pro/exposure';
import { applyChannelMixer } from '../pro/channelMixer';
import { applyBleachBypass } from '../pro/bleachBypass';
import { applySurfaceBlur } from '../pro/surfaceBlur';

const RUN = process.env.RENDER === '1';
const REPO = path.resolve(__dirname, '../../../..');
const OUT =
  '/private/tmp/claude-501/-Users-paul/c8210d3d-5609-4ce7-adb2-65e6a1595eb4/scratchpad/film-preview';

type Item = { label: string; fn: (d: Uint8ClampedArray, w: number, h: number) => void };
const ITEMS: Item[] = [
  { label: 'Original', fn: () => {} },
  { label: 'Clarity +60', fn: (d, w, h) => applyClarity(d, w, h, { amount: 60, radius: 40 }) },
  {
    label: 'Color Balance (teal-orange)',
    fn: (d, w, h) =>
      applyColorBalance(d, w, h, { shadowCR: -30, shadowYB: 35, highCR: 28, highYB: -28 }),
  },
  {
    label: 'Split Tone (blue/gold)',
    fn: (d, w, h) =>
      applySplitTone(d, w, h, {
        shadowHue: 220,
        shadowSat: 45,
        highlightHue: 42,
        highlightSat: 45,
      }),
  },
  { label: 'Pro-Mist 70', fn: (d, w, h) => applyProMist(d, w, h, { strength: 70, size: 50 }) },
  {
    label: 'Graduated ND',
    fn: (d, w, h) => applyGradND(d, w, h, { exposure: -55, angle: 90, position: 45, softness: 60 }),
  },
  {
    label: 'HSL Secondary (sky→teal)',
    fn: (d, w, h) =>
      applyHslSecondary(d, w, h, { targetHue: 210, range: 60, hueShift: 35, satShift: 30 }),
  },
  { label: 'Exposure +0.8', fn: (d, w, h) => applyExposure(d, w, h, { exposure: 80 }) },
  {
    label: 'Channel Mixer (mono)',
    fn: (d, w, h) =>
      applyChannelMixer(d, w, h, { monochrome: 1, rFromR: 40, rFromG: 35, rFromB: 25 }),
  },
  { label: 'Bleach Bypass 70', fn: (d, w, h) => applyBleachBypass(d, w, h, { strength: 70 }) },
  {
    label: 'Surface Blur',
    fn: (d, w, h) => applySurfaceBlur(d, w, h, { radius: 8, threshold: 30 }),
  },
];

const SAMPLES = [
  'design-system/studio/samples/color.jpg',
  'design-system/studio/samples/portrait.jpg',
];

(RUN ? describe : describe.skip)('pro effect preview render', () => {
  it('renders a pro-effect contact sheet', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const MAXW = 360;
    for (const rel of SAMPLES) {
      const img = await loadImage(path.join(REPO, rel));
      const scale = Math.min(1, MAXW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const base = createCanvas(w, h);
      const bctx = base.getContext('2d') as unknown as NodeCtx;
      bctx.drawImage(img as unknown as HTMLImageElement, 0, 0, w, h);
      const baseData = bctx.getImageData(0, 0, w, h);

      const cols = 4;
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

      ITEMS.forEach((item, i) => {
        const copy = new Uint8ClampedArray(baseData.data);
        item.fn(copy, w, h);
        const out = bctx.createImageData(w, h);
        out.data.set(copy);
        const cx = PAD + (i % cols) * cw;
        const cy = PAD + Math.floor(i / cols) * ch;
        const tmp = createCanvas(w, h);
        const tctx = tmp.getContext('2d') as unknown as NodeCtx;
        tctx.putImageData(out as unknown as import('canvas').ImageData, 0, 0);
        sctx.drawImage(tmp as unknown as HTMLImageElement, cx, cy);
        sctx.fillStyle = '#eceae3';
        sctx.fillText(item.label, cx + 2, cy + h + 2);
      });

      const name = path.basename(rel, path.extname(rel));
      fs.writeFileSync(path.join(OUT, `pro-${name}.png`), sheet.toBuffer('image/png'));
      // eslint-disable-next-line no-console
      console.log('wrote', path.join(OUT, `pro-${name}.png`));
    }
    expect(ITEMS.length).toBe(11);
  }, 120000);
});
