/**
 * Film-stock preview renderer (NOT a unit test). Guarded by RENDER=1 so it never
 * runs in the normal suite. Renders before/after contact sheets of every emulated
 * stock applied to real sample photos, so the looks can be eyeballed/approved.
 *
 *   RENDER=1 npx jest filmPreview
 *
 * Output PNGs land in the scratchpad film-preview dir.
 */
import { createCanvas, loadImage, type CanvasRenderingContext2D as NodeCtx } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { applyFilmStock, type FilmRecipe } from '../film/substrate';
import { KODAK_NEGATIVE_STOCKS } from '../film/stocks/kodak-negative';
import { KODAK_SLIDE_STOCKS } from '../film/stocks/kodak-slide';
import { FUJI_STOCKS } from '../film/stocks/fuji';
import { CINEMA_STOCKS } from '../film/stocks/cinema';
import { BW_STOCKS } from '../film/stocks/bw';

const RUN = process.env.RENDER === '1';
const REPO = path.resolve(__dirname, '../../../..');
const OUT =
  '/private/tmp/claude-501/-Users-paul/c8210d3d-5609-4ce7-adb2-65e6a1595eb4/scratchpad/film-preview';

const STOCKS: FilmRecipe[] = [
  ...KODAK_NEGATIVE_STOCKS,
  ...KODAK_SLIDE_STOCKS,
  ...FUJI_STOCKS,
  ...CINEMA_STOCKS,
  ...BW_STOCKS,
];

const SAMPLES = [
  'design-system/studio/samples/portrait.jpg',
  'design-system/studio/samples/color.jpg',
  'design-system/studio/samples/street.jpg',
];

(RUN ? describe : describe.skip)('film preview render', () => {
  it('renders contact sheets for every stock', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const MAXW = 340;

    for (const rel of SAMPLES) {
      const img = await loadImage(path.join(REPO, rel));
      const scale = Math.min(1, MAXW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const base = createCanvas(w, h);
      const bctx = base.getContext('2d') as unknown as NodeCtx;
      bctx.drawImage(img as unknown as HTMLImageElement, 0, 0, w, h);
      const baseData = bctx.getImageData(0, 0, w, h);

      const cells = STOCKS.length + 1;
      const cols = 6;
      const rows = Math.ceil(cells / cols);
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

      const draw = (i: number, label: string, data: ImageData) => {
        const cx = PAD + (i % cols) * cw;
        const cy = PAD + Math.floor(i / cols) * ch;
        const tmp = createCanvas(w, h);
        const tctx = tmp.getContext('2d') as unknown as NodeCtx;
        tctx.putImageData(data as unknown as import('canvas').ImageData, 0, 0);
        sctx.drawImage(tmp as unknown as HTMLImageElement, cx, cy);
        sctx.fillStyle = '#eceae3';
        sctx.fillText(label, cx + 2, cy + h + 2);
      };

      // original
      draw(0, 'Original', baseData);
      STOCKS.forEach((stock, idx) => {
        const copy = new Uint8ClampedArray(baseData.data);
        applyFilmStock(copy, w, h, stock, { grainSeed: 1234 });
        const out = bctx.createImageData(w, h);
        out.data.set(copy);
        draw(idx + 1, stock.displayName ?? stock.name, out);
      });

      const name = path.basename(rel, path.extname(rel));
      const file = path.join(OUT, `sheet-${name}.png`);
      fs.writeFileSync(file, sheet.toBuffer('image/png'));
      // eslint-disable-next-line no-console
      console.log('wrote', file, `(${STOCKS.length} stocks)`);
    }
    expect(STOCKS.length).toBeGreaterThan(0);
  }, 120000);
});
