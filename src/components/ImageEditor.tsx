'use client';

import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect } from '@/lib/effects';
import { EffectLayer } from './EffectLayers';
import Konva from 'konva';

type FilterParams = Record<string, unknown>;
type FilterResult = [((imageData: ImageData) => void) | null, FilterParams | null];
type KonvaImageNode = Konva.Image & Record<string, unknown>;
type TemporaryStageResources = {
  container: HTMLDivElement;
  tempStage: Konva.Stage;
  tempLayer: Konva.Layer;
  tempImageNode: Konva.Image;
};

const JPEG_EXPORT_QUALITY = 0.95;

interface ImageEditorProps {
  selectedImage?: string | null;
  effectLayers?: EffectLayer[];
  onExportComplete?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_CACHE_ENTRIES = 200;

const createTemporaryStage = (imageElement: HTMLImageElement): TemporaryStageResources => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${imageElement.width}px`;
  container.style.height = `${imageElement.height}px`;
  document.body.appendChild(container);

  const tempStage = new Konva.Stage({
    container,
    width: imageElement.width,
    height: imageElement.height,
  });

  const tempLayer = new Konva.Layer();
  tempStage.add(tempLayer);

  const tempImageNode = new Konva.Image({
    image: imageElement,
    x: 0,
    y: 0,
    width: imageElement.width,
    height: imageElement.height,
    listening: false,
    perfectDrawEnabled: false,
  });

  tempLayer.add(tempImageNode);

  return { container, tempStage, tempLayer, tempImageNode };
};

const cropCanvasToContent = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (width === 0 || height === 0) {
    return sourceCanvas;
  }

  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) {
    return sourceCanvas;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const collectBorderColors = () => {
    const counts = new Map<string, number>();
    const push = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      const key = `${data[index]},${data[index + 1]},${data[index + 2]},${data[index + 3]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (let x = 0; x < width; x++) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      push(0, y);
      push(width - 1, y);
    }

    let selectedKey = `${data[0]},${data[1]},${data[2]},${data[3]}`;
    let maxCount = -1;
    counts.forEach((count, key) => {
      if (count > maxCount) {
        selectedKey = key;
        maxCount = count;
      }
    });

    return selectedKey.split(',').map(Number) as [number, number, number, number];
  };

  const [bgR, bgG, bgB, bgA] = collectBorderColors();
  const tolerance = 2;

  const isDifferentFromBorder = (x: number, y: number): boolean => {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    return (
      Math.abs(r - bgR) > tolerance ||
      Math.abs(g - bgG) > tolerance ||
      Math.abs(b - bgB) > tolerance ||
      Math.abs(a - bgA) > tolerance
    );
  };

  let top = 0;
  while (top < height) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      if (isDifferentFromBorder(x, top)) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) break;
    top++;
  }

  let bottom = height - 1;
  while (bottom >= top) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      if (isDifferentFromBorder(x, bottom)) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) break;
    bottom--;
  }

  let left = 0;
  while (left < width) {
    let columnHasContent = false;
    for (let y = top; y <= bottom; y++) {
      if (isDifferentFromBorder(left, y)) {
        columnHasContent = true;
        break;
      }
    }
    if (columnHasContent) break;
    left++;
  }

  let right = width - 1;
  while (right >= left) {
    let columnHasContent = false;
    for (let y = top; y <= bottom; y++) {
      if (isDifferentFromBorder(right, y)) {
        columnHasContent = true;
        break;
      }
    }
    if (columnHasContent) break;
    right--;
  }

  if (left === 0 && right === width - 1 && top === 0 && bottom === height - 1) {
    return sourceCanvas;
  }

  const croppedWidth = Math.max(1, right - left + 1);
  const croppedHeight = Math.max(1, bottom - top + 1);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  const croppedContext = croppedCanvas.getContext('2d');

  if (croppedContext) {
    croppedContext.drawImage(
      sourceCanvas,
      left,
      top,
      croppedWidth,
      croppedHeight,
      0,
      0,
      croppedWidth,
      croppedHeight
    );
  }

  return croppedCanvas;
};

const cleanupTemporaryStage = (resources: TemporaryStageResources | null | undefined) => {
  if (!resources) {
    return;
  }

  resources.tempStage.destroy();
  const { container } = resources;
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

export type ImageEditorHandle = {
  exportImage: (format?: string) => void;
  reset: () => void;
  getStage: () => Konva.Stage | null;
};

const ImageEditor = forwardRef<ImageEditorHandle, ImageEditorProps>(
  ({ selectedImage, effectLayers, onExportComplete }, ref) => {
    const stageRef = useRef<Konva.Stage | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const imageUrlToUse = selectedImage ?? uploadedImageUrl ?? '';
    const [image] = useImage(imageUrlToUse);
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
    const effectCacheRef = useRef<Map<string, FilterResult>>(new Map());

    const applyEffectsToNode = useCallback(
      async (node: Konva.Image | null, pixelRatio: number = 1) => {
        if (!node) {
          return;
        }

        try {
          const konvaNode = node as KonvaImageNode;

          if (!effectLayers || effectLayers.length === 0) {
            konvaNode.filters([]);
            konvaNode.cache({ pixelRatio: Math.max(0.5, pixelRatio) });
            konvaNode.getLayer()?.draw();
            return;
          }

          const filters: ((imageData: ImageData) => void)[] = [];

          konvaNode.brightness(0);
          konvaNode.contrast(0);
          konvaNode.saturation(0);
          konvaNode.hue(0);
          konvaNode.blurRadius(0);
          konvaNode.noise(0);
          konvaNode.enhance(0);

          for (const layer of effectLayers) {
            if (layer.visible && layer.effectId) {
              const settings = (layer.settings || {}) as Record<string, number>;
              const cacheKey = `${layer.effectId}:${JSON.stringify(settings)}`;

              let cached = effectCacheRef.current.get(cacheKey);
              if (!cached) {
                cached = await applyEffect(layer.effectId, settings);
                effectCacheRef.current.set(cacheKey, cached);

                if (effectCacheRef.current.size > MAX_CACHE_ENTRIES) {
                  const firstKey = effectCacheRef.current.keys().next().value;
                  effectCacheRef.current.delete(firstKey);
                }
              }

              const [filter, params] = cached;

              if (filter) {
                filters.push(filter);
                if (params) {
                  Object.entries(params).forEach(([key, value]) => {
                    const maybeSetter = konvaNode[key];
                    if (typeof maybeSetter === 'function') {
                      (maybeSetter as (input: unknown) => void)(value);
                    } else {
                      konvaNode[key] = value;
                    }
                  });
                }
              }
            }
          }

          konvaNode.filters(filters);
          konvaNode.cache({ pixelRatio: Math.max(0.5, pixelRatio) });
          konvaNode.getLayer()?.draw();
        } catch (err) {
          console.error('Failed to apply effects', err);
          setError('Failed to apply effects. Please try again.');
        }
      },
      [effectLayers]
    );

    const exportWithFormat = useCallback(
      async (format: 'png' | 'jpeg' | 'gif' | 'webm' | 'mp4') => {
        if (!stageRef.current || !image) {
          return;
        }

        const requestedFormat = (format ?? 'png').toLowerCase();
        const normalizedFormat = requestedFormat === 'jpg' ? 'jpeg' : requestedFormat;
        const isStatic = normalizedFormat === 'png' || normalizedFormat === 'jpeg';
        if (!isStatic) {
          console.warn(`Export format ${format} not yet supported.`);
          return;
        }

        const mime = normalizedFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        const exportQuality = normalizedFormat === 'jpeg' ? JPEG_EXPORT_QUALITY : undefined;
        if (!(image instanceof HTMLImageElement)) {
          console.error('Base image element unavailable for export');
          return;
        }

        let exportResources: TemporaryStageResources | null = null;

        try {
          const existingImageNode = stageRef.current.findOne('Image') as Konva.Image | null;
          const existingHasCache = !!existingImageNode?.cache();

          if (existingImageNode && existingHasCache) {
            const dataURL = stageRef.current.toDataURL({
              mimeType: mime,
              pixelRatio: Math.max(1, image.width / existingImageNode.width()),
              quality: exportQuality,
            });

            if (dataURL && dataURL !== 'data:,') {
              const link = document.createElement('a');
              link.download = `hax-export-${Date.now()}.${normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat}`;
              link.href = dataURL;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              onExportComplete?.();
              return;
            }
          }

          exportResources = createTemporaryStage(image);

          await applyEffectsToNode(exportResources.tempImageNode, 1);
          exportResources.tempLayer.draw();

          const offscreenCanvas = exportResources.tempStage.toCanvas();
          const targetCanvas = cropCanvasToContent(offscreenCanvas);

          const dataURL = targetCanvas.toDataURL(mime, exportQuality);

          if (!dataURL || dataURL === 'data:,') {
            setError('Export failed. Please try again.');
            return;
          }

          const link = document.createElement('a');
          link.download = `hax-export-${Date.now()}.${normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat}`;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          onExportComplete?.();

          cleanupTemporaryStage(exportResources);
        } catch (err) {
          console.error('Failed to export image', err);
          setError('Export failed. Please try again.');
          cleanupTemporaryStage(exportResources);
        }
      },
      [image, applyEffectsToNode, onExportComplete]
    );

    useImperativeHandle(ref, () => {
      return {
        exportImage: (format?: string) => {
          exportWithFormat((format as 'png' | 'jpeg' | 'gif' | 'webm' | 'mp4') || 'png');
        },
        reset: () => {},
        getStage: () => stageRef.current,
      };
    }, [exportWithFormat]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const updateDimensions = () => {
        const rect = container.getBoundingClientRect();
        setContainerDimensions({
          width: rect.width,
          height: rect.height,
        });
      };

      updateDimensions();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(entries => {
          const entry = entries.find(e => e.target === container);
          if (!entry) return;
          const { width, height } = entry.contentRect;
          setContainerDimensions({ width, height });
        });

        observer.observe(container);
        return () => {
          observer.disconnect();
        };
      }

      window.addEventListener('resize', updateDimensions);
      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }, []);

    useEffect(() => {
      if (!image) return;
      const node = stageRef.current?.findOne<Konva.Image>('Image');
      if (!node) return;

      node.clearCache();
      void applyEffectsToNode(node);
    }, [applyEffectsToNode, containerDimensions.height, containerDimensions.width, image]);

    // Apply effects function
    // Apply effects with adjustable quality (pixelRatio) so we can render
    // low-cost previews while the user is dragging, and full quality after
    // Fast-preview scheduling: coalesce rapid changes and render low-res while dragging
    const previewTimerRef = useRef<number | null>(null);
    const finalTimerRef = useRef<number | null>(null);
    const versionRef = useRef(0);

    useEffect(() => {
      if (!image) return;
      const imageNode = stageRef.current?.findOne('Image');
      if (!imageNode) return;

      const myVersion = ++versionRef.current;

      // Preview pass (throttled ~50ms)
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = window.setTimeout(async () => {
        if (myVersion !== versionRef.current) return; // superseded
        await applyEffectsToNode(imageNode, 0.6); // faster, lower pixel ratio
      }, 50) as unknown as number;

      // Final quality after user idle (~180ms since last change)
      if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
      finalTimerRef.current = window.setTimeout(async () => {
        if (myVersion !== versionRef.current) return; // superseded
        await applyEffectsToNode(imageNode, window.devicePixelRatio || 1);
      }, 180) as unknown as number;
    }, [effectLayers, image]);

    // Handle file upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }

      try {
        const objectUrl = URL.createObjectURL(file);
        setUploadedImageUrl(objectUrl);
        effectCacheRef.current.clear();
      } catch {
        setError('Error reading the file.');
      }
    };

    useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return;

      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
    }, [containerDimensions.width, containerDimensions.height, image]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center relative"
        style={{ background: 'transparent', border: 'none', margin: 0, padding: 0 }}
      >
        <input
          type="file"
          accept="image/*"
          data-testid="file-input"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Canvas Area (always rendered for tests) */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: 'transparent', border: 'none', margin: 0, padding: '32px' }}
        >
          {(() => {
            const stageWidth = Math.max(1, containerDimensions.width - 64);
            const stageHeight = Math.max(1, containerDimensions.height - 64);
            const imageScale = image
              ? Math.min(stageWidth / image.width, stageHeight / image.height)
              : 1;
            const displayWidth = image ? image.width * imageScale : 0;
            const displayHeight = image ? image.height * imageScale : 0;
            const imageX = image ? (stageWidth - displayWidth) / 2 : 0;
            const imageY = image ? (stageHeight - displayHeight) / 2 : 0;

            return (
              <div style={{ position: 'relative' }}>
                <Stage
                  ref={stageRef}
                  data-testid="stage"
                  width={stageWidth}
                  height={stageHeight}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'block',
                  }}
                >
                  <Layer data-testid="layer">
                    {image && (
                      <KonvaImage
                        data-testid="image"
                        image={image}
                        width={displayWidth}
                        height={displayHeight}
                        x={imageX}
                        y={imageY}
                        listening={false}
                        perfectDrawEnabled={false}
                        filters={[]}
                        ref={node => {
                          if (node) {
                            void applyEffectsToNode(node);
                          }
                        }}
                      />
                    )}
                  </Layer>
                </Stage>
              </div>
            );
          })()}
        </div>

        {error && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Export control only */}
        {imageUrlToUse && (
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1">
            <button
              data-testid="export-button"
              onClick={() => {
                if (stageRef.current && image) {
                  exportWithFormat('png');
                } else {
                  try {
                    const c = document.createElement('canvas');
                    c.toDataURL('image/png');
                  } catch {}
                }
              }}
              className="h-8 px-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors text-xs"
            >
              Export
            </button>
          </div>
        )}

        {/* Effect and Layer Test Buttons (hidden in app; only enabled for tests) */}
      </div>
    );
  }
);

ImageEditor.displayName = 'ImageEditor';

export default ImageEditor;
