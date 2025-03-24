'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect, getFilterConfig } from '@/lib/effects';

interface ImageEditorProps {
  selectedImage: string | null;
  activeEffect: string | null;
  effectSettings: Record<string, number>;
  onImageUpload: (imageDataUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

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
          onImageUpload(event.target.result as string);
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
  }, []);

  // Update image size when image loads
  useEffect(() => {
    if (image) {
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
    }
  }, [image, stageSize]);

  // Apply filters to the image
  useEffect(() => {
    if (stageRef.current && activeEffect) {
      const imageNode = stageRef.current.findOne('Image');
      if (imageNode) {
        imageNode.cache();
        imageNode.filters(applyEffect(activeEffect, effectSettings));
        
        // Apply filter configuration
        const config = getFilterConfig(activeEffect, effectSettings);
        Object.entries(config).forEach(([key, value]) => {
          imageNode[key] = value;
        });
        
        imageNode.getLayer().batchDraw();
      }
    }
  }, [activeEffect, effectSettings]);

  // Export the image
  const handleExport = () => {
    if (stageRef.current) {
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
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Processing...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-danger text-white p-3 rounded shadow-lg z-10">
            <p>{error}</p>
            <button 
              className="absolute top-2 right-2 text-white"
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}
        
        {selectedImage ? (
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            ref={stageRef}
          >
            <Layer>
              <KonvaImage
                image={image}
                width={imageSize.width}
                height={imageSize.height}
                x={(stageSize.width - imageSize.width) / 2}
                y={(stageSize.height - imageSize.height) / 2}
              />
            </Layer>
          </Stage>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
            <div className="text-center p-6 max-w-md">
              <h3 className="text-xl font-semibold mb-4">No Image Selected</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Upload an image to get started with editing. Supports JPG, PNG files up to 10MB.
              </p>
              <button
                onClick={handleUploadClick}
                className="button-primary"
              >
                Upload Image
              </button>
              <p className="mt-4 text-sm text-gray-500">
                Drag and drop is also supported
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="p-4 bg-gray-200 dark:bg-gray-800 flex flex-wrap justify-between items-center gap-2">
          <button
            onClick={handleUploadClick}
            className="button-secondary"
          >
            Change Image
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="exportFormat" className="text-sm">Format:</label>
              <select 
                id="exportFormat"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </div>
            
            {exportFormat === 'jpeg' && (
              <div className="flex items-center space-x-2">
                <label htmlFor="exportQuality" className="text-sm">Quality:</label>
                <input 
                  id="exportQuality"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={exportQuality}
                  onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm">{Math.round(exportQuality * 100)}%</span>
              </div>
            )}
          </div>
          
          <button
            onClick={handleExport}
            className="button-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Export Image'}
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png"
        className="hidden"
      />
    </div>
  );
};

export default ImageEditor; 