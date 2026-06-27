import { gifSampleIntervalFromQuality, buildFfmpegArgs } from './exportHelpers';

describe('GIF quality mapping (WS-5.1)', () => {
  test('inverts UI quality to gif.js sample interval (lower = better)', () => {
    expect(gifSampleIntervalFromQuality(10)).toBe(1); // best UI -> best sampling
    expect(gifSampleIntervalFromQuality(1)).toBe(19); // worst UI -> coarse sampling
    expect(gifSampleIntervalFromQuality(5)).toBe(11);
  });
  test('clamps out-of-range input', () => {
    expect(gifSampleIntervalFromQuality(0)).toBe(19);
    expect(gifSampleIntervalFromQuality(99)).toBe(1);
  });
});

describe('ffmpeg arg building (WS-5.4 colour, WS-5.5 even dims)', () => {
  test('mp4 args tag colour space/range and never force a raw -s rescale', () => {
    const args = buildFfmpegArgs({
      frameRate: 30,
      quality: 8,
      format: 'mp4',
      outputFileName: 'out.mp4',
    });
    expect(args).toContain('-colorspace');
    expect(args).toContain('bt709');
    expect(args).toContain('-color_range');
    expect(args).toContain('tv');
    expect(args).not.toContain('-s'); // no unconditional rescale
    const vfIdx = args.indexOf('-vf');
    expect(vfIdx).toBeGreaterThan(-1);
    expect(args[vfIdx + 1]).toMatch(/scale=trunc\(iw\/2\)\*2:trunc\(ih\/2\)\*2/); // even-dim guard
    expect(args).toContain('libx264');
  });

  test('webm args also carry colour tags + even-dim scale', () => {
    const args = buildFfmpegArgs({
      frameRate: 24,
      quality: 6,
      format: 'webm',
      outputFileName: 'out.webm',
    });
    expect(args).toContain('libvpx-vp9');
    expect(args).toContain('-colorspace');
    const vfIdx = args.indexOf('-vf');
    expect(args[vfIdx + 1]).toContain('format=yuv420p');
  });
});
