'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect, getFilterConfig, ensureKonvaInitialized } from '@/lib/effects';

interface ImageEditorProps {
  selectedImage?: string | null;
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onImageUpload?: (imageDataUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Make sure nothing related to canvas/konva is imported or used until we're in the browser
const ImageEditor: React.FC<ImageEditorProps> = ({
  selectedImage,
  activeEffect,
  effectSettings,
  onImageUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [image, imageStatus] = useImage(selectedImage || '');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<number>(0.9); // 0.0 to 1.0
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isBrowser, setIsBrowser] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showExportOptions, setShowExportOptions] = useState(false);

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
    
    const applyFilters = async () => {
      const imageNode = stageRef.current.findOne('Image');
      if (!imageNode) {
        console.error("Image node not found in Stage");
        return;
      }
      
      try {
        // Reset all filters
        imageNode.filters([]);
        imageNode.cache();
        
        // If no active effect, reset and return
        if (!activeEffect) {
          console.log("No active effect, clearing all filters");
          imageNode.getLayer().batchDraw();
          return;
        }
        
        console.log("Applying effect:", activeEffect, "with settings:", effectSettings);
        
        // Get filters and configuration for the active effect
        const filterResult = await applyEffect(activeEffect, effectSettings || {});
        
        if (!filterResult || !filterResult[0]) {
          console.warn("No filter class returned for effect:", activeEffect);
          return;
        }
        
        const [filterClass, filterConfig] = filterResult;
        
        // Apply the filter
        imageNode.filters([filterClass]);
        
        // Set filter-specific configuration
        if (filterConfig) {
          console.log("Applying filter config:", filterConfig);
          Object.entries(filterConfig).forEach(([key, value]) => {
            imageNode[key] = value;
          });
        }
        
        // Update the canvas
        imageNode.cache();
        imageNode.getLayer().batchDraw();
        console.log(`Applied ${activeEffect} effect successfully`);
      } catch (error) {
        console.error("Error applying filters:", error);
      }
    };
    
    applyFilters();
  }, [activeEffect, effectSettings, image, isBrowser]);

  // Export the image
  const handleExport = () => {
    if (!isBrowser || !stageRef.current) return;
    
    setIsLoading(true);
    console.log("Starting export process");
    
    // Use setTimeout to allow UI to update and show loading state
    setTimeout(() => {
      try {
        const dataURL = stageRef.current.toDataURL({
          mimeType: exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
          quality: exportQuality,
          pixelRatio: 2, // Higher quality export
        });
        console.log(`Exported image as ${exportFormat} with quality ${exportQuality}`);
        
        const link = document.createElement('a');
        link.download = `imager-export.${exportFormat}`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsLoading(false);
      } catch (err) {
        console.error("Export error:", err);
        setError('Error exporting image. Please try again.');
        setIsLoading(false);
      }
    }, 100);
  };

  // Export quality control
  const handleExportQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExportQuality(parseFloat(e.target.value));
  };

  // Export format control
  const handleExportFormatChange = (format: 'png' | 'jpeg') => {
    setExportFormat(format);
  };

  // Force reload the image if needed
  const handleForceReload = () => {
    if (!selectedImage) return;
    
    console.log("Force reloading image");
    const tempImage = new Image();
    tempImage.onload = () => {
      console.log("Force reload successful");
      // This will trigger the useImage hook to reload
      onImageUpload?.(selectedImage);
    };
    tempImage.src = selectedImage;
  };

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
          onClick={handleForceReload}
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
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={imageSize.width || 100}
              height={imageSize.height || 100}
              x={(stageSize.width - (imageSize.width || 0)) / 2}
              y={(stageSize.height - (imageSize.height || 0)) / 2}
              shadowColor="rgba(0,0,0,0.08)"
              shadowBlur={20}
              shadowOffset={{ x: 0, y: 2 }}
              shadowOpacity={0.4}
              listening={true}
              perfectDrawEnabled={true}
              transformsEnabled="all"
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
                  onClick={handleExport}
                  className="btn-apple-secondary flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
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
                      
                      <button
                        onClick={handleExport}
                        className="btn-apple-primary w-full"
                      >
                        Export Image
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
};

export default ImageEditor; 