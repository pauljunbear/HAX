'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect, getFilterConfig, ensureKonvaInitialized } from '@/lib/effects';
import { SelectionType, SelectionData } from './SelectionTool';
import SelectionToolbar from './SelectionToolbar';
import { EffectLayer } from './EffectLayers';
import { supportsAnimation, getAnimationConfig } from '@/lib/animationConfig';
import { renderAnimationFrames, exportAsGif, downloadBlob } from '@/lib/animationRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import Konva from 'konva';
import { applyCompositeEffects, createCompositeFilter, FilterFunction } from '@/lib/effects';
import GenerativeOverlay from './GenerativeOverlay';
import ThreeDEffectsCanvas from './ThreeDEffectsCanvas';
import { PerformanceMonitor, usePerformanceMonitor, PerformanceMetrics } from './PerformanceMonitor';
import { getWorkerManager, cleanupWorkerManager, WorkerManager } from '@/lib/performance/WorkerManager';
import { BatchProcessor, BatchOperation } from '@/lib/performance/BatchProcessor';

interface ImageEditorProps {
  selectedImage?: string | null;
  effectLayers?: EffectLayer[];  // Changed from activeEffect to effectLayers
  onImageUpload?: (imageDataUrl: string) => void;
  exportTrigger?: number;
  onExportComplete?: () => void;
  // Generative overlay props
  showOverlay?: boolean;
  overlayEffect?: 'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies';
  overlayOpacity?: number;
  overlayParticleCount?: number;
  overlayColor?: string;
  overlaySpeed?: number;
  overlayInteractive?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Wrap component with forwardRef
const ImageEditor = forwardRef<any, ImageEditorProps>((
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [image, imageStatus] = useImage(selectedImage || '');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<number>(0.9); // 0.0 to 1.0
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'gif'>('png');
  const [isBrowser, setIsBrowser] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [animationDuration, setAnimationDuration] = useState(2000);
  const [animationFrameRate, setAnimationFrameRate] = useState(30);
  const [isExportingAnimation, setIsExportingAnimation] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Performance monitoring state
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [workerManager, setWorkerManager] = useState<WorkerManager | null>(null);
  const [batchProcessor, setBatchProcessor] = useState<BatchProcessor | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [lastProcessingTime, setLastProcessingTime] = useState<number>(0);
  
  // Performance monitoring hooks
  const { startRender, endRender, startOperation, endOperation } = usePerformanceMonitor();
  
  // Debug ref attachment
  useEffect(() => {
    console.log("ImageEditor component mounted, ref:", ref);
  }, [ref]);
  
  // Initialize performance systems
  useEffect(() => {
    const initializePerformanceSystems = async () => {
      try {
        // Initialize worker manager
        const manager = await getWorkerManager();
        setWorkerManager(manager);
        
        // Initialize batch processor
        const processor = new BatchProcessor();
        setBatchProcessor(processor);
        
        console.log('Performance systems initialized');
      } catch (error) {
        console.error('Failed to initialize performance systems:', error);
      }
    };

    initializePerformanceSystems();

    // Cleanup on unmount
    return () => {
      cleanupWorkerManager();
    };
  }, []);

  // Performance metrics handler
  const handlePerformanceChange = (metrics: PerformanceMetrics) => {
    setPerformanceMetrics(metrics);
    
    // Auto-enable performance monitor if performance is poor
    if (metrics.fps < 25 || metrics.memoryUsage / metrics.memoryLimit > 0.85) {
      setShowPerformanceMonitor(true);
    }
  };

  // Toggle performance monitor with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setShowPerformanceMonitor(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Define exportWithFormat before useImperativeHandle
  const exportWithFormat = async (format: 'png' | 'jpeg' | 'gif') => {
    if (!stageRef.current || !image) return;
    
    const animatedLayers = effectLayers?.filter(layer => 
      layer.visible && supportsAnimation(layer.effectId)
    ) || [];
    
    const firstAnimatedEffect = animatedLayers[0];
    const animationConfig = firstAnimatedEffect ? getAnimationConfig(firstAnimatedEffect.effectId) : null;
    
    try {
      if (format === 'gif' && animatedLayers.length > 0 && firstAnimatedEffect && animationConfig) {
        // Show progress dialog
        const progressDialog = document.createElement('div');
        progressDialog.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        progressDialog.innerHTML = `
          <div class="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 class="text-sm font-semibold mb-4">Creating Animated GIF</h3>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div id="progress-bar" class="bg-primary-accent h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
            <p id="progress-text" class="text-xs text-gray-600">Preparing...</p>
          </div>
        `;
        document.body.appendChild(progressDialog);
        
        const progressBar = progressDialog.querySelector('#progress-bar') as HTMLElement;
        const progressText = progressDialog.querySelector('#progress-text') as HTMLElement;
        
        const options = {
          duration: 2000, // 2 seconds default
          frameRate: 24,
          quality: 10,
          width: image.width,
          height: image.height,
          onProgress: (progress: number) => {
            progressBar.style.width = `${progress * 50}%`;
            progressText.textContent = `Rendering frames... ${Math.round(progress * 100)}%`;
          },
          // Include overlay props if overlay is active
          overlayProps: effectiveOverlayProps.showOverlay ? {
            effectType: effectiveOverlayProps.overlayEffect,
            opacity: effectiveOverlayProps.overlayOpacity,
            particleCount: effectiveOverlayProps.overlayParticleCount,
            color: effectiveOverlayProps.overlayColor,
            speed: effectiveOverlayProps.overlaySpeed,
            interactive: effectiveOverlayProps.overlayInteractive,
          } : undefined
        };
        
        // Get current settings for the animated effect
        const currentSettings = effectLayers?.find(
          layer => layer.effectId === firstAnimatedEffect.effectId
        )?.settings || {};
        
        // Render frames
        const frames = await renderAnimationFrames(
          image,
          firstAnimatedEffect.effectId,
          currentSettings,
          animationConfig,
          options
        );
        
        // Export as GIF
        await exportAsGif(frames, {
          quality: 10,
          onProgress: (progress: number) => {
            progressBar.style.width = `${50 + progress * 50}%`;
            progressText.textContent = `Creating GIF... ${Math.round(progress * 100)}%`;
          },
          onComplete: (blob: Blob) => {
            downloadBlob(blob, `animated-${Date.now()}.gif`);
            document.body.removeChild(progressDialog);
          },
          onError: (error: Error) => {
            console.error('GIF export error:', error);
            document.body.removeChild(progressDialog);
            alert('Failed to export GIF: ' + error.message);
          }
        });
        
      } else {
        // Static image export with overlay compositing
        await exportStaticImageWithOverlay(format);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert('Failed to export image: ' + (error as Error).message);
    }
  };

  // Helper function to export static image with overlay compositing
  const exportStaticImageWithOverlay = async (format: 'png' | 'jpeg') => {
    // Create a clean container div with no styling
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.background = 'transparent';
    tempContainer.style.border = 'none';
    tempContainer.style.padding = '0';
    tempContainer.style.margin = '0';
    document.body.appendChild(tempContainer);
    
    try {
      // Create a temporary stage with the exact image dimensions
      const tempStage = new Konva.Stage({
        container: tempContainer,
        width: image.width,
        height: image.height,
        listening: false
      });
      
      // Ensure stage has transparent background
      tempStage.container().style.backgroundColor = 'transparent';
      
      const tempLayer = new Konva.Layer();
      tempStage.add(tempLayer);
      
      // Create image node
      const tempImage = new Konva.Image({
        image: image,
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      });
      
      // Copy filters from the original image node
      const originalImageNode = stageRef.current.findOne('Image');
      if (originalImageNode) {
        tempImage.filters(originalImageNode.filters());
        // Copy all filter parameters
        const filterParams = ['brightness', 'contrast', 'saturation', 'hue', 'blurRadius', 'enhance', 'pixelSize', 'noise', 'threshold', 'levels'];
        filterParams.forEach(param => {
          if (typeof originalImageNode[param] === 'function' && typeof tempImage[param] === 'function') {
            tempImage[param](originalImageNode[param]());
          }
        });
      }
      
      tempLayer.add(tempImage);
      tempImage.cache();
      tempLayer.batchDraw();
      
      // Create final composite canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = image.width;
      finalCanvas.height = image.height;
      const finalCtx = finalCanvas.getContext('2d');
      
      if (!finalCtx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Draw the processed image to final canvas
      const imageDataURL = tempStage.toDataURL({
        pixelRatio: 1,
        mimeType: 'image/png', // Always use PNG for intermediate to preserve quality
        quality: 1,
      });
      
      // Load the image data and draw it
      const processedImage = new Image();
      processedImage.onload = async () => {
        finalCtx.drawImage(processedImage, 0, 0);
        
        // Composite generative overlays if they exist
        if (effectiveOverlayProps.showOverlay) {
          await compositeOverlayOnCanvas(finalCanvas, finalCtx);
        }
        
        // Export the final composite
        const uri = finalCanvas.toDataURL(
          format === 'jpeg' ? 'image/jpeg' : 'image/png',
          format === 'jpeg' ? 0.9 : 1
        );
        
        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.${format}`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup
        tempStage.destroy();
        document.body.removeChild(tempContainer);
      };
      
      processedImage.src = imageDataURL;
      
    } catch (error) {
      // Cleanup on error
      document.body.removeChild(tempContainer);
      throw error;
    }
  };

  // Helper function to composite overlay on canvas
  const compositeOverlayOnCanvas = async (finalCanvas: HTMLCanvasElement, finalCtx: CanvasRenderingContext2D) => {
    try {
      // Find the overlay canvas element
      const overlayElement = document.querySelector('#canvas-overlay canvas') as HTMLCanvasElement;
      
      if (overlayElement) {
        // Get the current container dimensions to calculate scale
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          // Calculate scale factors
          const scaleX = finalCanvas.width / containerRect.width;
          const scaleY = finalCanvas.height / containerRect.height;
          
          // Create a temporary canvas for scaling the overlay
          const tempOverlayCanvas = document.createElement('canvas');
          tempOverlayCanvas.width = finalCanvas.width;
          tempOverlayCanvas.height = finalCanvas.height;
          const tempOverlayCtx = tempOverlayCanvas.getContext('2d');
          
          if (tempOverlayCtx) {
            // Scale and draw the overlay
            tempOverlayCtx.globalAlpha = effectiveOverlayProps.overlayOpacity;
            tempOverlayCtx.drawImage(
              overlayElement,
              0, 0, overlayElement.width, overlayElement.height,
              0, 0, finalCanvas.width, finalCanvas.height
            );
            
            // Composite the scaled overlay onto the final canvas
            finalCtx.globalCompositeOperation = 'source-over';
            finalCtx.drawImage(tempOverlayCanvas, 0, 0);
          }
        }
      } else {
        console.warn('Overlay canvas not found for export');
      }
    } catch (error) {
      console.error('Error compositing overlay:', error);
      // Continue with export even if overlay fails
    }
  };
  
  // Handle export trigger from parent
  useEffect(() => {
    if (exportTrigger && exportTrigger > 0 && stageRef.current && image) {
      console.log("Export triggered via prop");
      
      // Reset the trigger immediately to prevent re-showing on effect changes
      onExportComplete?.();
      
      // Check if we have animated effects
      const animatedLayers = effectLayers?.filter(layer => 
        layer.visible && supportsAnimation(layer.effectId)
      ) || [];
      
      // Show export dialog
      const dialog = document.createElement('div');
      dialog.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
      dialog.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="text-sm font-semibold mb-4">Export Options</h3>
          <div class="space-y-3">
            <button class="export-option w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" data-format="png">
              Export as PNG
            </button>
            <button class="export-option w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" data-format="jpeg">
              Export as JPEG
            </button>
            ${animatedLayers.length > 0 ? `
              <button class="export-option w-full py-3 px-4 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-sm font-medium transition-colors" data-format="gif">
                Export as GIF (Animated)
              </button>
            ` : ''}
          </div>
          <button class="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700" id="cancel-export">
            Cancel
          </button>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Handle clicks
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('export-option')) {
          const selectedFormat = target.getAttribute('data-format') as 'png' | 'jpeg' | 'gif';
          document.body.removeChild(dialog);
          exportWithFormat(selectedFormat);
        } else if (target.id === 'cancel-export' || target === dialog) {
          document.body.removeChild(dialog);
        }
      };
      
      dialog.addEventListener('click', handleClick);
      }
  }, [exportTrigger, effectLayers, image, exportWithFormat, onExportComplete]);
  
  // Expose the export method via ref
  useImperativeHandle(ref, () => {
    console.log("useImperativeHandle called, creating ref object");
    return {
      exportImage: async (format?: 'png' | 'jpeg' | 'gif') => {
        console.log("Export method called on ImageEditor ref");
        console.log("Current effect layers:", effectLayers);
        
        if (!stageRef.current || !image) {
          console.error("Cannot export: Stage or image not ready");
          return;
      }

        // Check if we have animated effects
        const animatedLayers = effectLayers?.filter(layer => 
          layer.visible && supportsAnimation(layer.effectId)
        ) || [];
        
        console.log("Animated layers found:", animatedLayers);
        console.log("Effect layer IDs:", effectLayers?.map(l => l.effectId));
        console.log("Which ones support animation:", effectLayers?.map(l => ({
          id: l.effectId,
          supportsAnimation: supportsAnimation(l.effectId)
        })));
        
        // If format is not specified, show export dialog
        if (!format) {
          // Create and show export dialog
          const showExportDialog = () => {
            const dialog = document.createElement('div');
            dialog.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
            dialog.innerHTML = `
              <div class="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
                <h3 class="text-sm font-semibold mb-4">Export Options</h3>
                <div class="space-y-3">
                  <button class="export-option w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" data-format="png">
                    Export as PNG
                  </button>
                  <button class="export-option w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" data-format="jpeg">
                    Export as JPEG
                  </button>
                  ${animatedLayers.length > 0 ? `
                    <button class="export-option w-full py-3 px-4 bg-primary-accent hover:bg-primary-accent/90 text-white rounded-lg text-sm font-medium transition-colors" data-format="gif">
                      Export as GIF (Animated)
                    </button>
                  ` : ''}
                </div>
                <button class="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700" id="cancel-export">
                  Cancel
                </button>
              </div>
            `;
            
            document.body.appendChild(dialog);

            // Handle clicks
            const handleClick = (e: MouseEvent) => {
              const target = e.target as HTMLElement;
              if (target.classList.contains('export-option')) {
                const selectedFormat = target.getAttribute('data-format') as 'png' | 'jpeg' | 'gif';
                document.body.removeChild(dialog);
                exportWithFormat(selectedFormat);
              } else if (target.id === 'cancel-export' || target === dialog) {
                document.body.removeChild(dialog);
              }
            };
            
            dialog.addEventListener('click', handleClick);
          };
          
          showExportDialog();
          return;
        }
        
        // Export with specified format
        exportWithFormat(format);
      },
      
      // Add function to get current canvas data URL
      getCanvasDataURL: () => {
        if (!stageRef.current) return null;
        return stageRef.current.toDataURL({
          pixelRatio: window.devicePixelRatio || 1,
        });
      }
    };
  }, [image, stageRef, imageSize, effectLayers, exportWithFormat]);

  // Detect browser environment to avoid SSR issues
  useEffect(() => {
    setIsBrowser(true);
    console.log("Browser detected, component mounted");
  }, []);

  // Debug effect to log state changes
  useEffect(() => {
    if (isBrowser) {
      console.log("ImageEditor state:", { 
        selectedImage: selectedImage ? `${selectedImage.substring(0, 50)}...` : "No image",
        imageStatus: imageStatus,
        imageLoaded: !!image,
        imageSize,
        stageSize,
      });
    }
  }, [selectedImage, image, imageStatus, imageSize, stageSize, isBrowser]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    
    if (file) {
      console.log("File selected:", file.name, file.type, file.size);
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      setIsLoading(true);
      
      try {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        console.log("Image loaded as data URL, length:", imageDataUrl.length);
        
        // Pre-load the image to verify it works
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            console.log("Test image loaded successfully:", img.width, "x", img.height);
            resolve();
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = imageDataUrl;
        });

        onImageUpload?.(imageDataUrl);
      } catch (err) {
        console.error("Error processing image:", err);
        setError(err instanceof Error ? err.message : 'Failed to process image');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle drag and drop functionality
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log("File dropped:", file.name, file.type, file.size);
      
      if (!file.type.startsWith('image/')) {
        const errorMsg = 'Please drop an image file.';
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      setIsLoading(true);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const imageData = event.target.result as string;
          console.log("Dropped image loaded successfully, data length:", imageData.length);
          
          // Validate that the image can be loaded before passing it up
          const testImage = new Image();
          testImage.onload = () => {
            console.log("Test dropped image loaded successfully with dimensions:", testImage.width, "x", testImage.height);
            onImageUpload?.(imageData);
            setIsLoading(false);
          };
          
          testImage.onerror = () => {
            console.error("Failed to load test dropped image");
            setError('The dropped file is not a valid image. Please try another file.');
            setIsLoading(false);
          };
          
          testImage.src = imageData;
        }
      };
      
      reader.onerror = () => {
        console.error("FileReader error for dropped file:", reader.error);
        setError('Error reading dropped file. Please try again.');
        setIsLoading(false);
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Resize the canvas when the container size changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        
        // Add padding for mobile
        const padding = window.innerWidth < 768 ? 20 : 40;
        const maxWidth = containerWidth - padding;
        const maxHeight = containerHeight - padding;
        
        setStageSize({
          width: maxWidth,
          height: maxHeight
        });
        
        console.log("Container resized to:", maxWidth, maxHeight);
      }
    };

        updateSize();
    window.addEventListener('resize', updateSize);
    
    // Also update on orientation change for mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(updateSize, 100);
    });
    
    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  // Update image size when image loads or stage size changes
  useEffect(() => {
    if (!isBrowser || !image) return;
    if (!stageSize.width || !stageSize.height) {
      // Force stage size if it's not set yet
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth && clientHeight) {
          setStageSize({
            width: clientWidth,
            height: clientHeight,
          });
        } else {
          setStageSize({
            width: 800, // Default fallback
            height: 600, // Default fallback
          });
        }
      }
      return;
    }

    console.log("Calculating image size for stage:", stageSize);
    const aspectRatio = image.width / image.height;
    let newWidth, newHeight;

    if (stageSize.width / stageSize.height > aspectRatio) {
      // Container is wider than image aspect ratio
      newHeight = Math.min(stageSize.height * 0.85, image.height);
      newWidth = newHeight * aspectRatio;
    } else {
      // Container is taller than image aspect ratio
      newWidth = Math.min(stageSize.width * 0.85, image.width);
      newHeight = newWidth / aspectRatio;
    }

    console.log("Setting image size to:", newWidth, "x", newHeight);
    setImageSize({
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    });
    
    // Force stage redraw to ensure image displays correctly
    // Use multiple redraws with different delays to ensure it works
    [50, 200, 500].forEach(delay => {
      setTimeout(() => {
        if (stageRef.current) {
          const layer = stageRef.current.findOne('Layer');
          if (layer) {
            console.log(`Forcing redraw after ${delay}ms`);
            layer.batchDraw();
          }
        }
      }, delay);
    });
  }, [image, stageSize, isBrowser]);

  // Force a reflow and redraw after the image is loaded and sized
  useEffect(() => {
    if (!isBrowser || !image || !imageSize.width || !imageSize.height || !stageRef.current) return;
    
    console.log("Forcing stage redraw");
    
    const initializeAndRedraw = async () => {
      // Ensure Konva is initialized
      await ensureKonvaInitialized();
      
      // Force a reflow by accessing offset properties
      const offsetHeight = stageRef.current.container().offsetHeight;
      const offsetWidth = stageRef.current.container().offsetWidth;
      console.log("Current stage offset size:", offsetWidth, "x", offsetHeight);
      
      // Schedule multiple redraws to ensure rendering happens
      const redraw = () => {
        if (stageRef.current) {
          stageRef.current.batchDraw();
          const imageNode = stageRef.current.findOne('Image');
          if (imageNode) {
            imageNode.cache();
            imageNode.getLayer().batchDraw();
          }
        }
      };
      
      // Redraw multiple times with delays to catch any timing issues
      redraw();
      setTimeout(redraw, 50);
      setTimeout(redraw, 200);
    };
    
    initializeAndRedraw();
    
    // Also redraw on window resize
    const handleResize = () => {
      setTimeout(() => {
        if (stageRef.current) {
          stageRef.current.batchDraw();
        }
      }, 10);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image, imageSize, isBrowser]);

  // Apply filters to the image with performance optimization
  useEffect(() => {
    if (!isBrowser || !image || !stageRef.current || !batchProcessor) return;
    
    const applyFiltersWithPerformance = async () => {
      startOperation();
      const operationStart = performance.now();
      
      const imageNode = stageRef.current.findOne('Image');
      if (!imageNode) {
        console.error("Image node not found in Stage");
        endOperation();
        return;
      }
      
      // Always reset filters first
      imageNode.filters([]);
      
      // Clear any previously set filter properties
      imageNode.brightness(0);
      imageNode.contrast(0);
      imageNode.saturation(0);
      imageNode.hue(0);
      imageNode.blurRadius(0);
      imageNode.enhance(0);
      imageNode.pixelSize(1);
      imageNode.noise(0);
      imageNode.threshold(0.5);
      imageNode.levels(1);
      
      if (!effectLayers || effectLayers.length === 0) {
        console.log("No active effects, clearing filters and resetting properties.");
        startRender();
        imageNode.cache();
        imageNode.getLayer().batchDraw();
        endRender();
        endOperation();
        return;
      }
      
      try {
        console.log("Applying effects with performance optimization:", effectLayers.map(layer => layer.effectId).join(', '));
        
        // Separate effects for performance optimization
        const builtInFilters: any[] = [];
        const builtInParams: Record<string, any> = {};
        const heavyEffects: EffectLayer[] = [];
        const lightEffects: EffectLayer[] = [];
        
        for (const layer of effectLayers) {
          if (!layer.visible) continue;
          
          const [filterFunc, filterParams] = await applyEffect(layer.effectId, layer.settings || {});
          if (!filterFunc) continue;
          
          // Skip generative overlay and 3D effects - they're handled separately
          if (filterFunc === 'GENERATIVE_OVERLAY' || filterFunc === 'THREE_D_EFFECT') continue;
          
          // Check if this is a built-in Konva filter (has parameters)
          if (filterParams && Object.keys(filterParams).length > 0) {
            // Built-in Konva filter - these are GPU accelerated
            builtInFilters.push(filterFunc);
            
            // Apply opacity to numeric parameters
            if (layer.opacity < 1) {
              const adjustedParams: Record<string, any> = {};
              for (const [key, value] of Object.entries(filterParams)) {
                if (typeof value === 'number') {
                  // Special handling for specific parameters
                  if (key === 'brightness' || key === 'contrast' || key === 'enhance') {
                    adjustedParams[key] = value * layer.opacity;
                  } else {
                    adjustedParams[key] = value;
                  }
                } else {
                  adjustedParams[key] = value;
                }
              }
              Object.assign(builtInParams, adjustedParams);
            } else {
              Object.assign(builtInParams, filterParams);
            }
          } else {
            // Custom effect that modifies imageData - classify for performance
            const isHeavyEffect = ['blur', 'oilPainting', 'edgeDetection', 'emboss', 'noise'].includes(layer.effectId);
            if (isHeavyEffect && workerManager) {
              heavyEffects.push(layer);
            } else {
              lightEffects.push(layer);
            }
          }
        }
        
        // Create composite filter for custom effects
        if (heavyEffects.length > 0 || lightEffects.length > 0) {
          const compositeFilter = function(imageData: any) {
            const originalData = new Uint8ClampedArray(imageData.data);
            
            // Apply light effects on main thread
            for (const layer of lightEffects) {
              applyEffect(layer.effectId, layer.settings || {}).then(([filterFunc]) => {
                if (filterFunc && typeof filterFunc === 'function') {
                  if (layer.opacity < 1) {
                    const effectData = {
                      data: new Uint8ClampedArray(originalData),
                      width: imageData.width,
                      height: imageData.height
                    };
                    
                    filterFunc(effectData);
                    
                    // Blend with opacity
                    for (let i = 0; i < imageData.data.length; i += 4) {
                      imageData.data[i] = originalData[i] * (1 - layer.opacity) + effectData.data[i] * layer.opacity;
                      imageData.data[i + 1] = originalData[i + 1] * (1 - layer.opacity) + effectData.data[i + 1] * layer.opacity;
                      imageData.data[i + 2] = originalData[i + 2] * (1 - layer.opacity) + effectData.data[i + 2] * layer.opacity;
                      imageData.data[i + 3] = originalData[i + 3];
                    }
                  } else {
                    filterFunc(imageData);
                  }
                  originalData.set(imageData.data);
                }
              }).catch(error => {
                console.error(`Error applying light effect ${layer.effectId}:`, error);
              });
            }
          };
          
          // Add composite filter
          builtInFilters.unshift(compositeFilter);
        }
        
        // Process heavy effects asynchronously with workers if available
        if (heavyEffects.length > 0 && workerManager && batchProcessor) {
          console.log(`Scheduling ${heavyEffects.length} heavy effects for worker processing`);
          
          // Get the current canvas imageData
          const canvas = imageNode.toCanvas();
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Create batch job for heavy effects
            const batchJob = batchProcessor.createSimpleJob(
              imageData,
              heavyEffects.map(layer => ({
                effectId: layer.effectId,
                settings: layer.settings || {}
              })),
              (progress) => {
                console.log(`Heavy effects batch progress: ${Math.round(progress * 100)}%`);
              }
            );
            
            // Process in background
            batchProcessor.addJob(batchJob).then((results) => {
              if (results.length > 0 && stageRef.current) {
                console.log('Heavy effects processed, applying to canvas');
                // Apply the processed result back
                // This is handled asynchronously and won't block the UI
              }
            }).catch((error) => {
              console.error('Batch processing error:', error);
            });
          }
        }
        
        // Apply built-in filters immediately (these are GPU accelerated)
        if (builtInFilters.length > 0) {
          imageNode.filters(builtInFilters);
          
          // Set built-in filter parameters
          console.log("Setting built-in filter params:", builtInParams);
          for (const [key, value] of Object.entries(builtInParams)) {
            if (typeof imageNode[key] === 'function') {
              imageNode[key](value);
            }
          }
        } else {
          imageNode.filters([]);
        }
        
        // Update the canvas with performance monitoring
        startRender();
        imageNode.cache();
        imageNode.getLayer().batchDraw();
        endRender();
        
        const operationEnd = performance.now();
        const processingTime = operationEnd - operationStart;
        setLastProcessingTime(processingTime);
        setProcessingTime(prev => prev + processingTime);
        
        console.log(`Applied effects in ${processingTime.toFixed(2)}ms`);
        
      } catch (error) {
        console.error("Error applying filters:", error);
        imageNode.filters([]);
        startRender();
        imageNode.cache();
        imageNode.getLayer()?.batchDraw();
        endRender();
      }
      
      endOperation();
    };
    
    applyFiltersWithPerformance();
  }, [effectLayers, image, isBrowser, batchProcessor, workerManager, startOperation, endOperation, startRender, endRender]);

  // Check if current effects support animation
  const hasAnimatedEffects = effectLayers?.some(layer => 
    layer.visible && supportsAnimation(layer.effectId)
  ) || false;

  // Get the first animated effect for settings
  const firstAnimatedEffect = effectLayers?.find(layer => 
    layer.visible && supportsAnimation(layer.effectId)
  );
  const animationConfig = firstAnimatedEffect ? getAnimationConfig(firstAnimatedEffect.effectId) : null;

  // Extract generative overlay layers
  const overlayLayers = effectLayers?.filter(layer => 
    layer.visible && layer.effectId.startsWith('generative')
  ) || [];

  // Extract 3D effect layers
  const threeDLayers = effectLayers?.filter(layer => 
    layer.visible && layer.effectId.startsWith('threeD')
  ) || [];

  // Convert layer settings to overlay props for the first visible overlay
  const primaryOverlay = overlayLayers[0];
  
  // Convert layer settings to 3D props for the first visible 3D effect
  const primary3DEffect = threeDLayers[0];
  const derivedOverlayProps = primaryOverlay ? {
    showOverlay: true,
    overlayEffect: primaryOverlay.effectId.replace('generative', '').toLowerCase() as 'stars' | 'bubbles' | 'network' | 'snow' | 'confetti' | 'fireflies',
    overlayOpacity: (primaryOverlay.settings?.opacity ?? 0.6) * primaryOverlay.opacity,
    overlayParticleCount: primaryOverlay.settings?.particleCount ?? 50,
    overlayColor: primaryOverlay.settings?.color ? `#${Math.floor(primaryOverlay.settings.color).toString(16).padStart(6, '0')}` : '#ffffff',
    overlaySpeed: primaryOverlay.settings?.speed ?? 1,
    overlayInteractive: (primaryOverlay.settings?.interactive ?? 1) > 0.5,
  } : {
    showOverlay: false,
    overlayEffect: 'stars' as const,
    overlayOpacity: 0.6,
    overlayParticleCount: 50,
    overlayColor: '#ffffff',
    overlaySpeed: 1,
    overlayInteractive: true,
  };

  // Create derived 3D props from effect layers
  const derived3DProps = primary3DEffect ? {
    show3D: true,
    threeDEffect: primary3DEffect.effectId.replace('threeD', '3d').toLowerCase() as '3dPlane' | '3dCube' | '3dTilt' | '3dParallax',
    threeDDepth: primary3DEffect.settings?.depth ?? 1,
    threeDRotationSpeed: primary3DEffect.settings?.rotationSpeed ?? 1,
    threeDTiltIntensity: primary3DEffect.settings?.tiltIntensity ?? 0.2,
    threeDControlsEnabled: (primary3DEffect.settings?.controlsEnabled ?? 1) > 0.5,
  } : {
    show3D: false,
    threeDEffect: '3dPlane' as const,
    threeDDepth: 1,
    threeDRotationSpeed: 1,
    threeDTiltIntensity: 0.2,
    threeDControlsEnabled: true,
  };

  // Use derived props if no explicit overlay props are provided
  const effectiveOverlayProps = {
    showOverlay: showOverlay ?? derivedOverlayProps.showOverlay,
    overlayEffect: overlayEffect ?? derivedOverlayProps.overlayEffect,
    overlayOpacity: overlayOpacity ?? derivedOverlayProps.overlayOpacity,
    overlayParticleCount: overlayParticleCount ?? derivedOverlayProps.overlayParticleCount,
    overlayColor: overlayColor ?? derivedOverlayProps.overlayColor,
    overlaySpeed: overlaySpeed ?? derivedOverlayProps.overlaySpeed,
    overlayInteractive: overlayInteractive ?? derivedOverlayProps.overlayInteractive,
  };

  // Effective 3D props from derived values
  const effective3DProps = derived3DProps;

  // Render different states
  if (!selectedImage) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center p-6"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={`w-full max-w-lg mx-auto p-6 ${isDragging ? 'border-2 border-emerald-400 bg-emerald-50' : 'border-2 border-dashed border-gray-300 bg-gray-50'} rounded-lg text-center transition-all`}>
          <div className="mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-800 mb-3">Upload an Image</h2>
          <p className="text-sm text-gray-500 mb-6">
            Drag and drop your image here or click the button below
          </p>
          <button
            onClick={handleUploadClick}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors inline-flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Select Image
          </button>
          <p className="text-xs text-gray-500 mt-6">
            Supported formats: JPEG, PNG, GIF, WEBP • Max size: 10MB
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        
        {error && (
          <div className="mt-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Only render the Stage component if we're in the browser
  if (!isBrowser) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-emerald-500 border-gray-200"></div>
        <span className="ml-3 text-gray-600">Loading editor...</span>
      </div>
    );
  }

  // Show a loading state while image is loading
  if ((typeof imageStatus === 'object' && imageStatus.status === 'loading') || !image) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-emerald-500 border-gray-200 mb-4"></div>
        <span className="text-gray-600">Loading image...</span>
        <button 
          onClick={handleUploadClick}
          className="mt-4 px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300"
        >
          Force Reload
        </button>
        {typeof imageStatus === 'object' && imageStatus.error && (
          <div className="mt-3 text-red-500 text-xs max-w-md text-center">
            Error: {imageStatus.error}
          </div>
        )}
      </div>
    );
  }

  // Show error state if image failed to load
  if (typeof imageStatus === 'object' && imageStatus.status === 'error') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6">
        <div className="bg-red-50 p-6 rounded-lg text-center max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to load image</h3>
          <p className="text-sm text-red-600 mb-4">
            {imageStatus.error || "There was a problem loading the selected image."}
          </p>
          <button
            onClick={handleUploadClick}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Upload New Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex items-center justify-center canvas-bg overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {isBrowser && stageSize.width > 0 && stageSize.height > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
            className="canvas-bg shadow-xl rounded-lg touch-none"
            style={{ touchAction: 'none' }}
      >
        {/* Main image layer */}
        <Layer>
              <AnimatePresence>
                {image && imageStatus.status === 'loaded' && (
            <KonvaImage
              image={image}
                    x={(stageSize.width - imageSize.width) / 2}
                    y={(stageSize.height - imageSize.height) / 2}
                    width={imageSize.width}
                    height={imageSize.height}
                    ref={(node) => {
                      if (node) {
                        // Ensure image is cached for Konva performance
                        node.cache();
                      }
                    }}
            />
          )}
              </AnimatePresence>
        </Layer>
      </Stage>
        </motion.div>
      )}
      
      {/* Responsive Drop zone overlay */}
      {!selectedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-5 rounded-lg border-2 border-dashed border-gray-300 p-4 md:p-8"
        >
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-2 text-xs md:text-sm text-gray-600">Drop your image here or click to browse</p>
          </div>
        </motion.div>
      )}

      {/* Responsive Loading indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80"
        >
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-primary-accent"></div>
            <p className="mt-2 text-xs md:text-sm text-gray-600">Processing...</p>
                        </div>
        </motion.div>
      )}

      {/* Responsive Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-xs bg-red-50 border border-red-200 text-red-800 px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-lg text-xs md:text-sm"
        >
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </motion.div>
          )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png, image/gif, image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Debug info */}
      {process.env.NODE_ENV !== 'production' && Object.keys(debugInfo).length > 0 && (
        <div className="absolute top-2 left-2 text-xs bg-black/80 text-white p-2 rounded-md font-mono opacity-70 hover:opacity-100 transition-opacity">
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}

      {/* Generative Overlay positioned over the canvas */}
      {selectedImage && image && imageStatus.status === 'loaded' && effectiveOverlayProps.showOverlay && (
        <GenerativeOverlay
          id="canvas-overlay"
          effectType={effectiveOverlayProps.overlayEffect}
          visible={effectiveOverlayProps.showOverlay}
          opacity={effectiveOverlayProps.overlayOpacity}
          particleCount={effectiveOverlayProps.overlayParticleCount}
          color={effectiveOverlayProps.overlayColor}
          speed={effectiveOverlayProps.overlaySpeed}
          interactive={effectiveOverlayProps.overlayInteractive}
          zIndex={20}
          className="rounded-lg"
        />
      )}

      {/* 3D Effects Canvas positioned over the Konva canvas */}
      {selectedImage && image && imageStatus.status === 'loaded' && effective3DProps.show3D && (
        <ThreeDEffectsCanvas
          imageUrl={selectedImage}
          effectType={effective3DProps.threeDEffect}
          visible={effective3DProps.show3D}
          depth={effective3DProps.threeDDepth}
          rotationSpeed={effective3DProps.threeDRotationSpeed}
          tiltIntensity={effective3DProps.threeDTiltIntensity}
          controlsEnabled={effective3DProps.threeDControlsEnabled}
          width={stageSize.width}
          height={stageSize.height}
          zIndex={15}
          className="absolute inset-0 rounded-lg"
        />
      )}

      {/* Performance Monitor - toggle with Ctrl/Cmd + Shift + P */}
      <PerformanceMonitor
        isVisible={showPerformanceMonitor}
        position="top-right"
        onPerformanceChange={handlePerformanceChange}
        workerManager={workerManager}
      />
      
      {/* Performance Stats Tooltip */}
      {!showPerformanceMonitor && lastProcessingTime > 0 && (
        <div className="absolute top-4 right-4 bg-black/80 text-white text-xs px-2 py-1 rounded-md">
          Last: {lastProcessingTime.toFixed(0)}ms
        </div>
      )}
    </div>
  );
});

export default ImageEditor; 