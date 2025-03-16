'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from '@/hooks/useImage';
import { applyEffect } from '@/lib/effects';

interface ImageEditorProps {
  selectedImage: string | null;
  activeEffect: string | null;
  effectSettings: Record<string, number>;
  onImageUpload: (imageDataUrl: string) => void;
}

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

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload(event.target.result as string);
        }
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

  // Export the image
  const handleExport = () => {
    if (stageRef.current) {
      const dataURL = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = 'imager-export.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative" ref={containerRef}>
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
                filters={applyEffect(activeEffect, effectSettings)}
              />
            </Layer>
          </Stage>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
            <div className="text-center p-6">
              <h3 className="text-xl font-semibold mb-4">No Image Selected</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Upload an image to get started with editing
              </p>
              <button
                onClick={handleUploadClick}
                className="button-primary"
              >
                Upload Image
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="p-4 bg-gray-200 dark:bg-gray-800 flex justify-between">
          <button
            onClick={handleUploadClick}
            className="button-secondary"
          >
            Change Image
          </button>
          <button
            onClick={handleExport}
            className="button-primary"
          >
            Export Image
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default ImageEditor; 