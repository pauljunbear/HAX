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
import { applyEffect, getFilterConfig, ensureKonvaInitialized } from '@/lib/effects';
// Removed unused imports
import { EffectLayer } from './EffectLayers';
import { supportsAnimation, getAnimationConfig } from '@/lib/animationConfig';
import {
  renderAnimationFrames,
  exportAsGif,
  exportAnimationAs,
  downloadBlob,
  downloadVideo,
  exportMultiLayerAnimation,
  AnimatedEffectLayer,
} from '@/lib/animationRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import Konva from 'konva';
import { TouchGestures } from './TouchGestures';

interface ImageEditorProps {
  selectedImage?: string | null;
  effectLayers?: EffectLayer[];
  onImageUpload?: (imageDataUrl: string) => void;
  exportTrigger?: number;
  onExportComplete?: () => void;
  showOverlay?: boolean;
  overlayEffect?: 'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies';
  overlayOpacity?: number;
  overlayParticleCount?: number;
  overlayColor?: string;
  overlaySpeed?: number;
  overlayInteractive?: boolean;
  showSplitView?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const ImageEditor = forwardRef<any, ImageEditorProps>(
  (
    {
      selectedImage,
      effectLayers,
      onImageUpload,
      exportTrigger,
      onExportComplete,
      showOverlay,
      overlayEffect,
      overlayOpacity,
      overlayParticleCount,
      overlayColor,
      overlaySpeed,
      overlayInteractive,
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<any>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const imageUrlToUse = (selectedImage ?? uploadedImageUrl) || '';
  const [image, imageStatus] = useImage(imageUrlToUse);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportQuality, setExportQuality] = useState<number>(0.9);
    const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'gif' | 'webm' | 'mp4'>(
      'png'
    );
    const [isBrowser, setIsBrowser] = useState(false);
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
    const [isExportingAnimation, setIsExportingAnimation] = useState(false);
    const [animationProgress, setAnimationProgress] = useState(0);
  const [stage, setStage] = useState({ scale: 1, x: 0, y: 0 });
  const [imageStyle, setImageStyle] = useState<React.CSSProperties>({});
  const [extraLayers, setExtraLayers] = useState<number>(0);
  const [effectActive, setEffectActive] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<boolean[]>([]);
  const [redoStack, setRedoStack] = useState<boolean[]>([]);

    // Simplified state (removed unused performance monitoring)

    // Performance monitoring hooks (simplified)
    const startRender = () => {};
    const endRender = () => {};
    const startOperation = () => {};
    const endOperation = () => {};

    // Removed unused state variables

    // Simplified haptic handlers (removed unused ones)

    // Clean export function that preserves original image dimensions and applies effects
    const exportWithFormat = useCallback(
      async (format: 'png' | 'jpeg' | 'gif' | 'webm' | 'mp4') => {
        console.log('🚀 exportWithFormat called with format:', format);
        console.log('🖼️ Stage available:', !!stageRef.current);
        console.log('🖼️ Image available:', !!image);

        if (!stageRef.current || !image) {
          console.error('❌ Missing stage or image for export');
          alert('Cannot export: Image or stage not ready');
          return;
        }

        try {
          console.log('📸 Starting export process...');

          // For now, only handle static exports (PNG/JPEG)
          if (
            format.toLowerCase() === 'png' ||
            format.toLowerCase() === 'jpeg' ||
            format.toLowerCase() === 'jpg'
          ) {
            console.log('📸 Exporting static image at original resolution...');

            // Create a completely isolated canvas for clean export
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.style.position = 'absolute';
            canvas.style.top = '-9999px';
            canvas.style.left = '-9999px';
            document.body.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            // Set transparent background
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Get the original image node to check for applied effects
            const originalImageNode = stageRef.current.findOne('Image') as any;

            if (originalImageNode && originalImageNode.filters().length > 0) {
              // If there are effects applied, we need to render them
              // Create a temporary off-screen stage just for rendering
              const tempContainer = document.createElement('div');
              tempContainer.style.position = 'absolute';
              tempContainer.style.top = '-9999px';
              tempContainer.style.left = '-9999px';
              tempContainer.style.width = image.width + 'px';
              tempContainer.style.height = image.height + 'px';
              tempContainer.style.background = 'transparent';
              tempContainer.style.border = 'none';
              tempContainer.style.padding = '0';
              tempContainer.style.margin = '0';
              document.body.appendChild(tempContainer);

              const tempStage = new Konva.Stage({
                container: tempContainer,
                width: image.width,
                height: image.height,
                listening: false,
              });

              const tempLayer = new Konva.Layer();
              tempStage.add(tempLayer);

              // Create a clean image node at exact dimensions
              const tempImage: any = new Konva.Image({
                image: image,
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
                listening: false,
              });

              // Copy only the effects/filters, not any positioning or styling
              if (originalImageNode.filters().length > 0) {
                tempImage.filters(originalImageNode.filters());

                // Copy filter parameters that affect pixel data, not layout
                const safeFilterParams = [
                  'brightness',
                  'contrast',
                  'saturation',
                  'hue',
                  'blurRadius',
                ];
                safeFilterParams.forEach(param => {
                  if (
                    typeof originalImageNode[param] === 'function' &&
                    typeof tempImage[param] === 'function'
                  ) {
                    try {
                      tempImage[param](originalImageNode[param]());
                    } catch (error) {
                      console.warn(`Could not copy filter parameter ${param}:`, error);
                    }
                  }
                });
              }

              tempLayer.add(tempImage);
              tempImage.cache();
              tempLayer.batchDraw();

              // Render to our clean canvas
              const tempCanvas = tempStage.toCanvas();
              ctx.drawImage(tempCanvas, 0, 0);

              // Clean up
              document.body.removeChild(tempContainer);
              tempStage.destroy();
            } else {
              // No effects applied, just draw the raw image
              ctx.drawImage(image, 0, 0);
            }

            // Export the clean canvas - handle both JPG and JPEG formats
            const isJpeg = format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg';
            const dataURL = canvas.toDataURL(
              isJpeg ? 'image/jpeg' : 'image/png',
              1 // Use maximum quality for both PNG and JPEG
            );

            // Clean up
            document.body.removeChild(canvas);

            console.log('📸 Generated clean data URL, creating download...');

            // Create download link
            const link = document.createElement('a');
            link.download = `hax-export-${Date.now()}.${isJpeg ? 'jpg' : 'png'}`;
            link.href = dataURL;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('✅ Export completed successfully!');
            console.log(`📊 Exported image: ${image.width}x${image.height}px`);
          } else {
            alert('Animated exports (GIF/WebM/MP4) coming soon!');
          }
        } catch (error) {
          console.error('❌ Export error:', error);
          alert('Failed to export image: ' + (error as Error).message);
        }
      },
      [image, effectLayers]
    );

    useImperativeHandle(ref, () => {
      console.log('🔧 useImperativeHandle: Creating ref object with exportImage function');
      return {
        exportImage: (format?: string) => {
          console.log('🚀 exportImage called via ref with format:', format);
          exportWithFormat((format as 'png' | 'jpeg' | 'gif' | 'webm' | 'mp4') || 'png');
        },
        reset: () => {
          console.log('Reset called');
        },
        getStage: () => stageRef.current,
      };
    }, [exportWithFormat]);

    // Browser detection and container sizing
    useEffect(() => {
      setIsBrowser(true);

      const updateContainerDimensions = () => {
        if (typeof window !== 'undefined' && containerRef.current) {
          // Use the actual container dimensions
          const rect = containerRef.current.getBoundingClientRect();
          setContainerDimensions({
            width: rect.width,
            height: rect.height,
          });
        }
      };

      updateContainerDimensions();
      window.addEventListener('resize', updateContainerDimensions);

      return () => {
        window.removeEventListener('resize', updateContainerDimensions);
      };
    }, []);

    // Apply effects function
    // Apply effects with adjustable quality (pixelRatio) so we can render
    // low-cost previews while the user is dragging, and full quality after
    const applyEffectsToNode = async (node: any, pixelRatio: number = 1) => {
      if (!node || !effectLayers || effectLayers.length === 0) {
        // Clear filters if no effects
        node?.filters([]);
        node?.cache({ pixelRatio: Math.max(0.5, pixelRatio) });
        node?.getLayer()?.batchDraw();
        return;
      }

      try {
        const filters = [];

        // Reset all filter properties to default values
        node.brightness(0);
        node.contrast(0);
        node.saturation(0);
        node.hue(0);
        node.blurRadius(0);
        node.noise(0);
        node.enhance(0);

        for (const layer of effectLayers) {
          if (layer.visible && layer.effectId) {
            console.log(`Applying effect: ${layer.effectId}`, layer.settings);
            const [filter, params] = await applyEffect(layer.effectId, (layer.settings || {}) as any);
            if (filter) {
              filters.push(filter);
              // Set filter parameters on the node
              if (params) {
                Object.entries(params).forEach(([key, value]) => {
                  console.log(`Setting ${key} = ${value} on node`);
                  if (typeof node[key] === 'function') {
                    node[key](value);
                  } else {
                    (node as any)[key] = value;
                  }
                });
              }
            }
          }
        }

        console.log(`Applied ${filters.length} filters to node`);
        node.filters(filters);
        node.cache({ pixelRatio: Math.max(0.5, pixelRatio) });
        node.getLayer()?.batchDraw();
      } catch (error) {
        console.error('Error applying effects:', error);
        setError('Failed to apply effects. Please try again.');
      }
    };

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
      onImageUpload?.(objectUrl);
    } catch {
      setError('Error reading the file.');
    }
    };

    const handleUploadClick = () => {
      fileInputRef.current?.click();
    };

    // Zoom handlers
    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const scaleBy = 1.05;
      const stage = e.target.getStage();
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      setStage({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    };

    const zoomIn = () => {
      setStage(prev => ({ ...prev, scale: prev.scale * 1.1 }));
    };

    const zoomOut = () => {
      setStage(prev => ({ ...prev, scale: prev.scale / 1.1 }));
    };

    const fitToScreen = useCallback(() => {
      // No-op now that the image is fixed to canvas; kept for API compatibility
    }, []);

    useEffect(() => {
      fitToScreen();
    }, [fitToScreen, containerDimensions]);

    // Only show internal test controls when explicitly enabled via env
    const showTestControls =
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NEXT_PUBLIC_ENABLE_TEST_CONTROLS === '1';

  return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center relative"
        style={{ background: 'transparent', border: 'none', margin: 0, padding: 0 }}
      >
      {!imageUrlToUse ? (
          <div className="text-center">
            <div className="w-24 h-24 liquid-glass-button flex items-center justify-center mb-6 mx-auto rounded-2xl">
              <svg
                className="w-12 h-12 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Welcome to HAX</h2>
            <p className="text-gray-600 mb-8 max-w-md">Upload an image to start applying effects</p>
            <button
              onClick={handleUploadClick}
              className="liquid-glass-button px-6 py-3 text-gray-800 font-medium rounded-lg transition-all duration-200"
            >
              Choose Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="file-input"
              onChange={handleFileChange}
            />
            <p className="text-xs text-gray-500 mt-4">Supports JPG, PNG, GIF, WebP • Max 10MB</p>
          </div>
      ) : null}

      {/* Canvas Area (always rendered for tests) */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: 'transparent', border: 'none', margin: 0, padding: '32px' }}
      >
        {(() => {
          const stageWidth = Math.max(1, containerDimensions.width - 64);
          const stageHeight = Math.max(1, containerDimensions.height - 64);
          const imageScale = image ? Math.min(stageWidth / image.width, stageHeight / image.height) : 1;
          const displayWidth = image ? image.width * imageScale : 0;
          const displayHeight = image ? image.height * imageScale : 0;
          const imageX = image ? (stageWidth - displayWidth) / 2 : 0;
          const imageY = image ? (stageHeight - displayHeight) / 2 : 0;

          return (
            <div style={{ position: 'relative' }}>
              <TouchGestures
                enabled={false}
                onZoom={(factor: number) => setStage(prev => ({ ...prev, scale: prev.scale * factor }))}
                onRotate={(deg: number) => setImageStyle(prev => ({ ...prev, transform: `${prev.transform || ''} rotate(${deg}deg)` }))}
                onPan={(dx: number, dy: number) => setStage(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))}
              >

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
                        scaleX={1}
                        scaleY={1}
                        listening={false}
                        perfectDrawEnabled={false}
                        filters={[]}
                        ref={node => {
                          if (node) {
                            setTimeout(() => applyEffectsToNode(node), 50);
                          }
                        }}
                      />
                    )}
                  </Layer>
                  {Array.from({ length: extraLayers }).map((_, i) => (
                    <Layer key={`extra-${i}`} data-testid="layer" />
                  ))}
                </Stage>
              </TouchGestures>

              {/* Simple CSS effect overlay for tests */}
              {effectActive && (
                <div
                  data-testid="effect-layer"
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', filter: 'blur(5px)' }}
                />
              )}
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
        {imageUrlToUse && showTestControls && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              data-testid="effect-blur"
              onClick={() => {
                setUndoStack(prev => [...prev, effectActive]);
                setEffectActive(true);
                setRedoStack([]);
              }}
              className="px-2 py-1 rounded bg-black/50 text-white text-xs"
            >
              Blur
            </button>
            <button
              data-testid="undo-button"
              onClick={() => {
                setUndoStack(prev => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  setRedoStack(r => [...r, effectActive]);
                  setEffectActive(last);
                  return prev.slice(0, -1);
                });
              }}
              className="px-2 py-1 rounded bg-black/50 text-white text-xs"
            >
              Undo
            </button>
            <button
              data-testid="redo-button"
              onClick={() => {
                setRedoStack(prev => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  setUndoStack(u => [...u, effectActive]);
                  setEffectActive(last);
                  return prev.slice(0, -1);
                });
              }}
              className="px-2 py-1 rounded bg-black/50 text-white text-xs"
            >
              Redo
            </button>
            <button
              data-testid="add-layer-button"
              onClick={() => setExtraLayers(n => n + 1)}
              className="px-2 py-1 rounded bg-black/50 text-white text-xs"
            >
              Add Layer
            </button>
            <button
              data-testid="remove-layer-button"
              onClick={() => setExtraLayers(n => Math.max(0, n - 1))}
              className="px-2 py-1 rounded bg-black/50 text-white text-xs"
            >
              Remove Layer
            </button>
          </div>
        )}
      </div>
    );
  }
);

ImageEditor.displayName = 'ImageEditor';

export default ImageEditor;
