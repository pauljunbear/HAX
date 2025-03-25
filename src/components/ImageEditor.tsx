'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect, getFilterConfig } from '@/lib/effects';

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
  const [image] = useImage(selectedImage || '');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<number>(0.9); // 0.0 to 1.0
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isBrowser, setIsBrowser] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Detect browser environment to avoid SSR issues
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    
    if (file) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
        return;
      }
      
      setIsLoading(true);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload?.(event.target.result as string);
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Error reading file. Please try again.');
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
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
      
      if (!file.type.startsWith('image/')) {
        setError('Please drop an image file.');
        return;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
        return;
      }
      
      setIsLoading(true);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload?.(event.target.result as string);
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Error reading file. Please try again.');
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
    if (!isBrowser) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setStageSize({
          width: clientWidth,
          height: clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isBrowser]);

  // Update image size when image loads
  useEffect(() => {
    if (!isBrowser || !image) return;

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

    setImageSize({
      width: newWidth,
      height: newHeight,
    });
  }, [image, stageSize, isBrowser]);

  // Apply filters to the image
  useEffect(() => {
    if (!isBrowser || !stageRef.current || !activeEffect) return;

    const imageNode = stageRef.current.findOne('Image');
    if (imageNode) {
      imageNode.cache();
      imageNode.filters(applyEffect(activeEffect, effectSettings || {}));
      
      // Apply filter configuration
      const config = getFilterConfig(activeEffect, effectSettings || {});
      Object.entries(config).forEach(([key, value]) => {
        imageNode[key] = value;
      });
      
      imageNode.getLayer().batchDraw();
    }
  }, [activeEffect, effectSettings, isBrowser]);

  // Export the image
  const handleExport = () => {
    if (!isBrowser || !stageRef.current) return;
    
    setIsLoading(true);
    
    // Use setTimeout to allow UI to update and show loading state
    setTimeout(() => {
      try {
        const dataURL = stageRef.current.toDataURL({
          mimeType: exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
          quality: exportQuality,
          pixelRatio: 2, // Higher quality export
        });
        
        const link = document.createElement('a');
        link.download = `imager-export.${exportFormat}`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsLoading(false);
      } catch (err) {
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

  return (
    <div 
      ref={containerRef} 
      className="h-full relative"
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-80">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-emerald-500 border-gray-200 mb-2"></div>
            <p className="text-gray-600 text-sm">Processing...</p>
          </div>
        </div>
      )}
      
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        className="bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2YxZjFmMSI+PC9yZWN0Pgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2YxZjFmMSI+PC9yZWN0Pgo8cmVjdCB4PSIxMCIgeT0iMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZmZmZmZmIj48L3JlY3Q+CjxyZWN0IHg9IjAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmZmZmYiPjwvcmVjdD4KPC9zdmc+')]"
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={imageSize.width}
              height={imageSize.height}
              x={(stageSize.width - imageSize.width) / 2}
              y={(stageSize.height - imageSize.height) / 2}
              shadowColor="rgba(0,0,0,0.2)"
              shadowBlur={20}
              shadowOffset={{ x: 0, y: 2 }}
              shadowOpacity={0.5}
            />
          )}
        </Layer>
      </Stage>
      
      {/* Control bar */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
        <div className="bg-white rounded-md shadow-md border border-gray-200 p-2 flex items-center space-x-4">
          <button
            onClick={handleUploadClick}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            New Image
          </button>
          
          <div className="h-8 border-r border-gray-200"></div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">Format:</span>
              <div className="flex">
                <button 
                  className={`px-2 py-1 text-xs rounded-l-md ${
                    exportFormat === 'png' 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleExportFormatChange('png')}
                >
                  PNG
                </button>
                <button 
                  className={`px-2 py-1 text-xs rounded-r-md ${
                    exportFormat === 'jpeg' 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleExportFormatChange('jpeg')}
                >
                  JPEG
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">Quality:</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={exportQuality}
                onChange={handleExportQualityChange}
                className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800"
              />
              <span className="text-xs text-gray-600 w-6">{Math.round(exportQuality * 100)}%</span>
            </div>
          </div>
          
          <div className="h-8 border-r border-gray-200"></div>
          
          <button
            onClick={handleExport}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {error && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 shadow-md">
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
};

export default ImageEditor; 