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
        imageNode.filters(applyEffect(activeEffect, effectSettings || {}));
        
        // Apply filter configuration
        const config = getFilterConfig(activeEffect, effectSettings || {});
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
    <div className="h-full flex flex-col items-center justify-center">
      <p className="text-center">Image Editor Placeholder</p>
    </div>
  );
};

export default ImageEditor; 