'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface VideoExportOptions {
  frames: HTMLCanvasElement[];
  frameRate: number;
  quality: number; // 1-10, where 10 is highest quality
  format: 'webm' | 'mp4';
  width: number;
  height: number;
  onProgress?: (progress: number) => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export class VideoExporter {
  private ffmpeg: FFmpeg;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      console.log('Initializing FFmpeg...');

      // Use public CDN URLs for ffmpeg-wasm
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isInitialized = true;
      console.log('FFmpeg initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      throw new Error(
        'Failed to initialize video encoder. Please check your internet connection and try again.'
      );
    } finally {
      this.isInitializing = false;
    }
  }

  async exportVideo(options: VideoExportOptions): Promise<Blob> {
    const { frames, frameRate, quality, format, width, height, onProgress, onComplete, onError } =
      options;

    try {
      // Ensure FFmpeg is initialized
      await this.initialize();

      if (frames.length === 0) {
        throw new Error('No frames provided for video export');
      }

      console.log(
        `Starting video export: ${frames.length} frames, ${frameRate}fps, ${format.toUpperCase()}`
      );

      // Convert canvases to image files
      const frameFiles: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        const frameFileName = `frame_${i.toString().padStart(4, '0')}.png`;
        const canvas = frames[i];

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to convert canvas to blob'));
          }, 'image/png');
        });

        // Write to FFmpeg filesystem
        await this.ffmpeg.writeFile(frameFileName, await fetchFile(blob));
        frameFiles.push(frameFileName);

        // Report progress for frame preparation
        if (onProgress) {
          onProgress(((i + 1) / frames.length) * 0.3); // 30% for frame preparation
        }
      }

      // Build FFmpeg command based on format and quality
      const outputFileName = `output.${format}`;
      const ffmpegArgs = this.buildFFmpegArgs({
        frameRate,
        quality,
        format,
        width,
        height,
        outputFileName,
      });

      console.log('FFmpeg command:', ffmpegArgs.join(' '));

      // Set up progress tracking
      let lastProgress = 0.3;
      this.ffmpeg.on('progress', ({ progress }) => {
        const currentProgress = 0.3 + progress * 0.7; // 70% for encoding
        if (currentProgress > lastProgress) {
          lastProgress = currentProgress;
          if (onProgress) {
            onProgress(Math.min(currentProgress, 1));
          }
        }
      });

      // Execute FFmpeg command
      await this.ffmpeg.exec(ffmpegArgs);

      // Read the output file
      const data = await this.ffmpeg.readFile(outputFileName);

      // Create blob from the video data
      const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
      const videoBlob = new Blob([data], { type: mimeType });

      // Clean up temporary files
      await this.cleanup(frameFiles.concat(outputFileName));

      console.log(`Video export completed. Size: ${videoBlob.size} bytes`);

      if (onProgress) {
        onProgress(1);
      }

      if (onComplete) {
        onComplete(videoBlob);
      }

      return videoBlob;
    } catch (error) {
      console.error('Video export failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during video export';
      const exportError = new Error(`Video export failed: ${errorMessage}`);

      if (onError) {
        onError(exportError);
      }

      throw exportError;
    }
  }

  private buildFFmpegArgs(options: {
    frameRate: number;
    quality: number;
    format: string;
    width: number;
    height: number;
    outputFileName: string;
  }): string[] {
    const { frameRate, quality, format, width, height, outputFileName } = options;

    const baseArgs = [
      '-y', // Overwrite output file
      '-framerate',
      frameRate.toString(),
      '-i',
      'frame_%04d.png',
      '-s',
      `${width}x${height}`,
    ];

    if (format === 'webm') {
      // WebM with VP9 codec
      const crf = Math.max(15, Math.min(63, 63 - quality * 4.8)); // Convert quality 1-10 to CRF 63-15
      return [
        ...baseArgs,
        '-c:v',
        'libvpx-vp9',
        '-crf',
        crf.toString(),
        '-b:v',
        '0', // Use CRF mode
        '-pix_fmt',
        'yuv420p',
        '-f',
        'webm',
        outputFileName,
      ];
    } else {
      // MP4 with H.264 codec
      const crf = Math.max(15, Math.min(51, 51 - quality * 3.6)); // Convert quality 1-10 to CRF 51-15
      return [
        ...baseArgs,
        '-c:v',
        'libx264',
        '-crf',
        crf.toString(),
        '-preset',
        'medium',
        '-pix_fmt',
        'yuv420p',
        '-f',
        'mp4',
        outputFileName,
      ];
    }
  }

  private async cleanup(files: string[]): Promise<void> {
    try {
      for (const file of files) {
        try {
          await this.ffmpeg.deleteFile(file);
        } catch {
          // Ignore individual file deletion errors
          console.warn(`Failed to delete temporary file: ${file}`);
        }
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  async getInfo(): Promise<{ isInitialized: boolean; version?: string }> {
    if (!this.isInitialized) {
      return { isInitialized: false };
    }

    try {
      // Try to get FFmpeg version
      await this.ffmpeg.exec(['-version']);
      return {
        isInitialized: true,
        version: 'FFmpeg WASM',
      };
    } catch {
      return { isInitialized: this.isInitialized };
    }
  }

  terminate(): void {
    if (this.isInitialized) {
      this.ffmpeg.terminate();
      this.isInitialized = false;
    }
  }
}

// Utility functions for video export
export async function exportFramesToVideo(
  frames: HTMLCanvasElement[],
  options: Omit<VideoExportOptions, 'frames'>
): Promise<Blob> {
  const exporter = new VideoExporter();
  return exporter.exportVideo({ frames, ...options });
}

export function downloadVideoBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper to estimate video file size
export function estimateVideoSize(
  frameCount: number,
  frameRate: number,
  quality: number,
  format: 'webm' | 'mp4',
  resolution: { width: number; height: number }
): { estimatedMB: number; estimatedSeconds: number } {
  const duration = frameCount / frameRate;
  const pixelCount = resolution.width * resolution.height;

  // Rough bitrate estimation based on quality and format
  let bitrateMbps: number;

  if (format === 'webm') {
    // VP9 is generally more efficient
    bitrateMbps = (pixelCount / 1000000) * (quality / 10) * 2.5;
  } else {
    // H.264
    bitrateMbps = (pixelCount / 1000000) * (quality / 10) * 3;
  }

  const estimatedMB = (bitrateMbps * duration) / 8; // Convert bits to bytes, then to MB

  return {
    estimatedMB: Math.round(estimatedMB * 100) / 100,
    estimatedSeconds: Math.round(duration * 100) / 100,
  };
}
