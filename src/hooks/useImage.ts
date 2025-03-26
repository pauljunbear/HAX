'use client';

import { useState, useEffect, useRef } from 'react';

const useImage = (src: string): [HTMLImageElement | null, { status: string, error?: string }] => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<{ status: string, error?: string }>({ status: 'loading' });
  const [isBrowser, setIsBrowser] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Detect browser environment
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    if (!isBrowser) return;

    // Reset state if src is empty
    if (!src) {
      setImage(null);
      setStatus({ status: 'idle' });
      return;
    }

    // Set loading state
    setStatus({ status: 'loading' });
    
    // Create a new image instance
    const img = new Image();
    imgRef.current = img;
    
    const onLoad = () => {
      console.log(`Image loaded successfully: ${img.width}x${img.height}`);
      setImage(img);
      setStatus({ status: 'loaded' });
    };
    
    const onError = (e: ErrorEvent) => {
      console.error("Failed to load image:", e.message);
      setImage(null);
      setStatus({ 
        status: 'error',
        error: e.message || 'Failed to load image' 
      });
    };
    
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    
    // Set the source
    try {
      img.src = src;
      
      // Handle already cached images
      if (img.complete) {
        onLoad();
      }
    } catch (err) {
      onError(err as ErrorEvent);
    }
    
    return () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      if (imgRef.current) {
        imgRef.current.src = '';
        imgRef.current = null;
      }
    };
  }, [src, isBrowser]);

  return [image, status];
};

export default useImage; 