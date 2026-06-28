/**
 * Phase 5 preview renderer (RENDER=1 guarded). Renders the color-space-corrected
 * effects through the live applyEffect dispatch on a smooth grayscale gradient
 * (reveals midtone muddiness in ramps) and a real photo.
 *   RENDER=1 npx jest phase5Preview
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
  { label: 'Saturation -100 (→ gray?)', key: 'saturation', over: { value: -100 } },
  { label: 'Saturation +70', key: 'saturation', over: { value: 70 } },
  { label: 'Brightness +50', key: 'brightness', over: { value: 50 } },
  { label: 'Brightness -50', key: 'brightness', over: { value: -50 } },
  { label: 'Grayscale (BT.709)', key: 'grayscale' },
  { label: 'Duotone (OKLab)', key: 'duotone' },
  { label: 'Gradient Map (OKLab)', key: 'gradientMap' },
  { label: 'unifiedMono · Gray', key: 'unifiedMono', over: { preset: 0 } },
  { label: 'unifiedMono · Duotone', key: 'unifiedMono', over: { preset: 2 } },
  { label: 'Selective Color', key: 'selectiveColor' },
  { label: 'Cinematic LUT', key: 'cinematicLut' },
];

function gradientStrip(w: number, h: number): ImageData {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d') as unknown as NodeCtx;
  for (let x = 0; x < w; x++) {
    const v = Math.round((x * 255) / (w - 1));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, h);
  }
  return ctx.getImageData(0, 0, w, h) as unknown as ImageData;
}

(RUN ? describe : describe.skip)('phase 5 preview render', () => {
  it('renders color-space-corrected effects', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const img = await loadImage(path.join(REPO, 'design-system/studio/samples/color.jpg'));
    const MAXW = 320;
    const scale = Math.min(1, MAXW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const photo = createCanvas(w, h);
    const pctx = photo.getContext('2d') as unknown as NodeCtx;
    pctx.drawImage(img as unknown as HTMLImageElement, 0, 0, w, h);
    const photoData = pctx.getImageData(0, 0, w, h);
    const gradH = 60;
    const grad = gradientStrip(w, gradH);

    const cols = 4;
    const rows = Math.ceil(ITEMS.length / cols);
    const LABEL = 16;
    const PAD = 6;
    const cellH = h + gradH + 4;
    const cw = w + PAD;
    const ch = cellH + LABEL + PAD;
    const sheet = createCanvas(cols * cw + PAD, rows * ch + PAD);
    const sctx = sheet.getContext('2d') as unknown as NodeCtx;
    sctx.fillStyle = '#0b0b0c';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.font = '11px sans-serif';
    sctx.textBaseline = 'top';

    for (let idx = 0; idx < ITEMS.length; idx++) {
      const item = ITEMS[idx];
      const pCopy = new Uint8ClampedArray(photoData.data);
      const gCopy = new Uint8ClampedArray(grad.data);
      if (item.key !== '__original') {
        const settings = { ...defaultsFor(item.key), ...(item.over || {}) };
        const resP = await applyEffect(item.key, settings);
        if (Array.isArray(resP) && typeof resP[0] === 'function') {
          try {
            resP[0]({ data: pCopy, width: w, height: h } as never);
          } catch (e) {
            /* skip */
          }
        }
        const resG = await applyEffect(item.key, settings);
        if (Array.isArray(resG) && typeof resG[0] === 'function') {
          try {
            resG[0]({ data: gCopy, width: w, height: gradH } as never);
          } catch (e) {
            /* skip */
          }
        }
      }
      const cx = PAD + (idx % cols) * cw;
      const cy = PAD + Math.floor(idx / cols) * ch;
      // photo
      const pOut = pctx.createImageData(w, h);
      pOut.data.set(pCopy);
      const t1 = createCanvas(w, h);
      (t1.getContext('2d') as unknown as NodeCtx).putImageData(
        pOut as unknown as import('canvas').ImageData,
        0,
        0
      );
      sctx.drawImage(t1 as unknown as HTMLImageElement, cx, cy);
      // gradient strip below
      const gOut = pctx.createImageData(w, gradH);
      gOut.data.set(gCopy);
      const t2 = createCanvas(w, gradH);
      (t2.getContext('2d') as unknown as NodeCtx).putImageData(
        gOut as unknown as import('canvas').ImageData,
        0,
        0
      );
      sctx.drawImage(t2 as unknown as HTMLImageElement, cx, cy + h + 4);
      sctx.fillStyle = '#eceae3';
      sctx.fillText(item.label, cx + 2, cy + cellH + 2);
    }
    fs.writeFileSync(path.join(OUT, 'phase5.png'), sheet.toBuffer('image/png'));
    // eslint-disable-next-line no-console
    console.log('wrote', path.join(OUT, 'phase5.png'));
    expect(ITEMS.length).toBeGreaterThan(0);
  }, 120000);
});
