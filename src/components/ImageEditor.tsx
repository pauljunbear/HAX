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
      newHeight = Math.min(stageSize.height, image.height);
      newWidth = newHeight * aspectRatio;
    } else {
      // Container is taller than image aspect ratio
      newWidth = Math.min(stageSize.width, image.width);
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

  // Render different states
  if (!selectedImage) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4">Upload an Image to Edit</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
          Select an image to start applying effects and filters.
        </p>
        <button
          onClick={handleUploadClick}
          className="button-primary mb-4"
        >
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        {error && (
          <p className="text-red-500 mt-4">{error}</p>
        )}
      </div>
    );
  }

  // Only render the Stage component if we're in the browser
  if (!isBrowser) {
    return <div className="h-full w-full flex items-center justify-center">Loading editor...</div>;
  }

  return (
    <div 
      ref={containerRef} 
      className="canvas-container h-full"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-70 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Processing...</p>
          </div>
        </div>
      )}
      
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={imageSize.width}
              height={imageSize.height}
              x={(stageSize.width - imageSize.width) / 2}
              y={(stageSize.height - imageSize.height) / 2}
            />
          )}
        </Layer>
      </Stage>
      
      <div className="absolute bottom-4 right-4 flex space-x-2">
        <button
          onClick={handleUploadClick}
          className="button-secondary"
        >
          New Image
        </button>
        <button
          onClick={handleExport}
          className="button-primary"
          disabled={!image}
        >
          Export
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {error && (
        <div className="absolute bottom-4 left-4 bg-red-500 text-white p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageEditor; 