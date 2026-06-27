/**
 * Pure export helpers — no heavy imports (no ffmpeg.wasm, no gif.js), so this
 * is unit-testable in isolation and reusable by both the GIF and video paths.
 */

/**
 * Convert our 1-10 higher-is-better UI quality to gif.js's NeuQuant SAMPLE
 * INTERVAL, where 1 = best/slowest and higher = coarser/faster. Must be
 * inverted: passing the UI value straight through gave the best preset the
 * coarsest sampling.
 */
export function gifSampleIntervalFromQuality(uiQuality: number): number {
  const q = Math.max(1, Math.min(10, uiQuality));
  return Math.round(1 + (10 - q) * 2); // q10 -> 1, q5 -> 11, q1 -> 19
}

export interface FfmpegArgOptions {
  frameRate: number;
  quality: number; // 1-10, higher = better
  format: 'mp4' | 'webm';
  outputFileName: string;
}

/**
 * Build the ffmpeg argument list for a frames -> video encode.
 * - Even-dimension guard via a scale filter (yuv420p needs even W/H) instead
 *   of an unconditional `-s WxH` rescale that crashed on odd dims and rescaled
 *   every frame needlessly.
 * - Explicit bt709 colour tags + limited range so players don't re-guess the
 *   matrix and shift the colour away from the canvas.
 */
export function buildFfmpegArgs(options: FfmpegArgOptions): string[] {
  const { frameRate, quality, format, outputFileName } = options;

  const baseArgs = ['-y', '-framerate', frameRate.toString(), '-i', 'frame_%04d.png'];
  const vf = 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p';
  const colorTags = [
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-color_range',
    'tv',
  ];

  if (format === 'webm') {
    const crf = Math.max(15, Math.min(63, 63 - quality * 4.8)); // quality 1-10 -> CRF 63-15
    return [
      ...baseArgs,
      '-vf',
      vf,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      crf.toString(),
      '-b:v',
      '0',
      ...colorTags,
      '-f',
      'webm',
      outputFileName,
    ];
  }

  const crf = Math.max(15, Math.min(51, 51 - quality * 3.6)); // quality 1-10 -> CRF 51-15
  return [
    ...baseArgs,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-crf',
    crf.toString(),
    '-preset',
    'medium',
    ...colorTags,
    '-f',
    'mp4',
    outputFileName,
  ];
}
