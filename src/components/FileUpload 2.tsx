'use client';

import React, { useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const FileUpload: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setSelectedImage = useAppStore(state => state.setSelectedImage);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedImage(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setError('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

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
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please drop an image file.');
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
        }
      };
      reader.onerror = () => {
        setError('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

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
        <div className="mt-6 p-4 bg-white/80 rounded-lg border border-gray-200 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">File Requirements:</h3>
          <ul className="text-xs text-gray-600 space-y-1 text-left list-disc pl-5">
            <li>Supported formats: JPEG, PNG, GIF, WEBP</li>
            <li>Maximum file size: 10MB</li>
            <li>Recommended size for best performance: under 5MB</li>
            <li>Recommended dimensions: 1000-4000px on longest side</li>
            <li>For best results, use high-quality, well-lit images</li>
          </ul>
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
};

export default FileUpload; 