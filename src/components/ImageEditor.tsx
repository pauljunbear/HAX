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

interface ImageEditorProps {
  selectedImage?: string | null;
  effectLayers?: EffectLayer[];  // Changed from activeEffect to effectLayers
  onImageUpload?: (imageDataUrl: string) => void;
  onReady?: (ref: any) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Wrap component with forwardRef
const ImageEditor = forwardRef<any, ImageEditorProps>((
  {
    selectedImage,
    effectLayers,
    onImageUpload,
    onReady,
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
  
  // Define the imperative handle methods object in the main component scope
  const imperativeHandleMethods = {
    exportImage: async () => {
      console.log("Export method called on ImageEditor ref");
      
      if (!stageRef.current || !image) {
        console.error("Cannot export: Stage or image not ready");
        return;
      }
      
      try {
        if (exportFormat === 'gif' && hasAnimatedEffects && firstAnimatedEffect && animationConfig) {
          // Animated GIF export
          setIsExportingAnimation(true);
          setAnimationProgress(0);
          
          const options = {
            duration: animationDuration,
            frameRate: animationFrameRate,
            quality: 10, // GIF quality 1-10
            width: imageSize.width,
            height: imageSize.height,
            onProgress: (progress: number) => {
              setAnimationProgress(progress * 0.5); // First 50% for frame rendering
            }
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
          const blob = await exportAsGif(frames, {
            quality: 10,
            onProgress: (progress: number) => {
              setAnimationProgress(0.5 + progress * 0.5); // Last 50% for GIF encoding
            },
            onComplete: (blob: Blob) => {
              downloadBlob(blob, `animated-${Date.now()}.gif`);
              setIsExportingAnimation(false);
              setAnimationProgress(0);
            },
            onError: (error: Error) => {
              console.error('GIF export error:', error);
              setIsExportingAnimation(false);
              setAnimationProgress(0);
              alert('Failed to export GIF: ' + error.message);
            }
          });
          
        } else {
          // Static image export (existing code)
          const uri = stageRef.current.toDataURL({
            pixelRatio: window.devicePixelRatio || 1,
            mimeType: exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
            quality: exportFormat === 'jpeg' ? exportQuality : 1,
          });
          
          const link = document.createElement('a');
          link.download = `edited-image-${Date.now()}.${exportFormat}`;
          link.href = uri;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        console.log("Export completed successfully");
      } catch (error) {
        console.error("Export error:", error);
        setIsExportingAnimation(false);
        setAnimationProgress(0);
      }
    },
    // Add function to get current canvas data URL
    getCanvasDataURL: () => {
      if (!stageRef.current) return null;
      return stageRef.current.toDataURL({
        pixelRatio: window.devicePixelRatio || 1,
      });
    }
  };

  // Use imperative handle to expose methods
  useImperativeHandle(ref, () => (imperativeHandleMethods));

  // Call onReady when the component is ready
  useEffect(() => {
    if (stageRef.current && typeof onReady === 'function') {
      console.log("ImageEditor is ready, calling onReady callback");
      // Pass the object with the methods directly
      onReady(imperativeHandleMethods);
    }
    // Dependency array should include the object that onReady depends on
  }, [stageRef, onReady]); // Remove imperativeHandleMethods from deps here, it's stable

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

  // Update stage size based on container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        console.log("Container size update:", clientWidth, "x", clientHeight);
        setStageSize({
          width: clientWidth || 800, // Fallback size if clientWidth is 0
          height: clientHeight || 600, // Fallback size if clientHeight is 0
        });
      }
    };

    // Initial update with a slight delay to ensure DOM is ready
    setTimeout(updateSize, 10);
    
    // Add resize event with throttling
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        updateSize();
      }, 100); // Throttle to avoid excessive updates
    };
    
    window.addEventListener('resize', handleResize);
    
    // Force multiple redraws after mounting to ensure images show properly
    const redrawTimeouts = [100, 300, 800, 1500].map(delay => 
      setTimeout(() => {
        updateSize();
        if (stageRef.current) {
          const layer = stageRef.current.findOne('Layer');
          if (layer) {
            layer.batchDraw();
          }
        }
      }, delay)
    );
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      redrawTimeouts.forEach(timeout => clearTimeout(timeout));
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

  // Apply filters to the image
  useEffect(() => {
    if (!isBrowser || !image || !stageRef.current) return;
    
    const applyFiltersAsync = async () => {
      const imageNode = stageRef.current.findOne('Image');
      if (!imageNode) {
        console.error("Image node not found in Stage");
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
        imageNode.cache();
        imageNode.getLayer().batchDraw();
        return;
      }
      
      try {
        console.log("Applying effects:", effectLayers.map(layer => layer.effectId).join(', '));
        
        // Separate effects into built-in Konva filters and custom filters
        const builtInFilters: any[] = [];
        const builtInParams: Record<string, any> = {};
        const customEffects: Array<{ layer: EffectLayer, filterFunc: any }> = [];
        
        for (const layer of effectLayers) {
          if (!layer.visible) continue;
          
          const [filterFunc, filterParams] = await applyEffect(layer.effectId, layer.settings || {});
          if (!filterFunc) continue;
          
          // Check if this is a built-in Konva filter (has parameters)
          if (filterParams && Object.keys(filterParams).length > 0) {
            // Built-in Konva filter
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
            // Custom effect that modifies imageData
            customEffects.push({ layer, filterFunc });
          }
        }
        
        // If we have custom effects, create a composite filter
        if (customEffects.length > 0) {
          const compositeFilter = function(imageData: any) {
            // Store original for blending
            const originalData = new Uint8ClampedArray(imageData.data);
            
            // Apply each custom effect
            for (const { layer, filterFunc } of customEffects) {
              console.log(`Applying custom effect: ${layer.effectId} with opacity ${layer.opacity}`);
              
              if (layer.opacity < 1) {
                // Create a copy for this effect
                const effectData = {
                  data: new Uint8ClampedArray(originalData),
                  width: imageData.width,
                  height: imageData.height
                };
                
                // Apply the effect
                filterFunc(effectData);
                
                // Blend with original based on opacity
                for (let i = 0; i < imageData.data.length; i += 4) {
                  imageData.data[i] = originalData[i] * (1 - layer.opacity) + effectData.data[i] * layer.opacity;
                  imageData.data[i + 1] = originalData[i + 1] * (1 - layer.opacity) + effectData.data[i + 1] * layer.opacity;
                  imageData.data[i + 2] = originalData[i + 2] * (1 - layer.opacity) + effectData.data[i + 2] * layer.opacity;
                  imageData.data[i + 3] = originalData[i + 3];
                }
              } else {
                // Apply directly
                filterFunc(imageData);
              }
              
              // Update original for next effect
              originalData.set(imageData.data);
            }
          };
          
          // Add composite filter to the beginning
          builtInFilters.unshift(compositeFilter);
        }
        
        // Apply all filters
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
        
        // Update the canvas
        imageNode.cache();
        imageNode.getLayer().batchDraw();
        console.log(`Applied effects successfully`);
        
      } catch (error) {
        console.error("Error applying filters:", error);
        imageNode.filters([]);
        imageNode.cache();
        imageNode.getLayer()?.batchDraw();
      }
    };
    
    applyFiltersAsync();
  }, [effectLayers, image, isBrowser]);

  // Check if current effects support animation
  const hasAnimatedEffects = effectLayers?.some(layer => 
    layer.visible && supportsAnimation(layer.effectId)
  ) || false;

  // Get the first animated effect for settings
  const firstAnimatedEffect = effectLayers?.find(layer => 
    layer.visible && supportsAnimation(layer.effectId)
  );
  const animationConfig = firstAnimatedEffect ? getAnimationConfig(firstAnimatedEffect.effectId) : null;

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
      className="h-full relative w-full flex items-center justify-center"
      style={{ 
        minHeight: '400px',
        visibility: 'visible',
        display: 'block'
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full border-4 border-[rgb(var(--apple-gray-200))] border-t-[rgb(var(--primary))] animate-spin mb-3"></div>
            <p className="text-[rgb(var(--apple-gray-600))] font-medium">Processing...</p>
          </div>
        </div>
      )}
      
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        className="canvas-bg"
        style={{
          display: 'block',
          width: `${stageSize.width}px`,
          height: `${stageSize.height}px`,
          position: 'relative',
          zIndex: 1,
          visibility: 'visible',
        }}
      >
        {/* Main image layer */}
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              x={(stageSize.width - (imageSize.width * Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height, 1))) / 2}
              y={(stageSize.height - (imageSize.height * Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height, 1))) / 2}
              width={imageSize.width * Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height, 1)}
              height={imageSize.height * Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height, 1)}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Control bar */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[rgb(var(--apple-gray-200))] p-3 flex items-center space-x-4">
          <button
            onClick={handleUploadClick}
            className="btn-apple-primary flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            New Image
          </button>
          
          {image && (
            <>
              <div className="h-6 w-px bg-[rgb(var(--apple-gray-200))]"></div>
              
              <div className="flex gap-2">
                <button
                  onClick={imperativeHandleMethods.exportImage}
                  className="btn-apple-secondary flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export (Internal)
                </button>
                
                <div className="relative group">
                  <button
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    className="btn-apple-ghost p-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  
                  {showExportOptions && (
                    <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-sm border border-[rgb(var(--apple-gray-200))] p-3 min-w-[200px]">
                      <div className="mb-3">
                        <label className="text-xs text-[rgb(var(--apple-gray-600))] font-medium block mb-1">Format</label>
                        <div className="flex bg-[rgb(var(--apple-gray-100))] rounded-lg p-1">
                          <button
                            onClick={() => setExportFormat('png')}
                            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                              exportFormat === 'png'
                                ? 'bg-white text-[rgb(var(--apple-gray-800))] shadow-sm'
                                : 'text-[rgb(var(--apple-gray-600))]'
                            }`}
                          >
                            PNG
                          </button>
                          <button
                            onClick={() => setExportFormat('jpeg')}
                            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                              exportFormat === 'jpeg'
                                ? 'bg-white text-[rgb(var(--apple-gray-800))] shadow-sm'
                                : 'text-[rgb(var(--apple-gray-600))]'
                            }`}
                          >
                            JPEG
                          </button>
                          {hasAnimatedEffects && (
                            <button
                              onClick={() => setExportFormat('gif')}
                              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                                exportFormat === 'gif'
                                  ? 'bg-white text-[rgb(var(--apple-gray-800))] shadow-sm'
                                  : 'text-[rgb(var(--apple-gray-600))]'
                              }`}
                            >
                              GIF
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {exportFormat === 'jpeg' && (
                        <div className="mb-3">
                          <div className="flex justify-between mb-1">
                            <label className="text-xs text-[rgb(var(--apple-gray-600))] font-medium">Quality</label>
                            <span className="text-xs text-[rgb(var(--apple-gray-500))] font-mono">{Math.round(exportQuality * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={exportQuality}
                            onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                      
                      {exportFormat === 'gif' && hasAnimatedEffects && (
                        <>
                          <div className="mb-3">
                            <div className="flex justify-between mb-1">
                              <label className="text-xs text-[rgb(var(--apple-gray-600))] font-medium">Duration</label>
                              <span className="text-xs text-[rgb(var(--apple-gray-500))] font-mono">{animationDuration / 1000}s</span>
                            </div>
                            <input
                              type="range"
                              min={500}
                              max={5000}
                              step={500}
                              value={animationDuration}
                              onChange={(e) => setAnimationDuration(parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="mb-3">
                            <div className="flex justify-between mb-1">
                              <label className="text-xs text-[rgb(var(--apple-gray-600))] font-medium">Frame Rate</label>
                              <span className="text-xs text-[rgb(var(--apple-gray-500))] font-mono">{animationFrameRate} fps</span>
                            </div>
                            <input
                              type="range"
                              min={12}
                              max={30}
                              step={6}
                              value={animationFrameRate}
                              onChange={(e) => setAnimationFrameRate(parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                        </>
                      )}
                      
                      <button
                        onClick={imperativeHandleMethods.exportImage}
                        disabled={isExportingAnimation}
                        className="btn-apple-primary w-full"
                      >
                        {isExportingAnimation ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating GIF... {Math.round(animationProgress * 100)}%
                          </span>
                        ) : (
                          `Export ${exportFormat.toUpperCase()}`
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
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
    </div>
  );
});

export default ImageEditor; 