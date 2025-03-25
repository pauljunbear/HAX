'use client';

import { useState, useEffect, useRef } from 'react';

const useImage = (src: string): [HTMLImageElement | null, { status: string }] => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [isBrowser, setIsBrowser] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Detect browser environment
  useEffect(() => {
    setIsBrowser(true);
    console.log("useImage: Browser environment detected");
  }, []);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up resources when the component unmounts
      if (imgRef.current) {
        console.log("useImage: Cleaning up image references on unmount");
        imgRef.current.onload = null;
        imgRef.current.onerror = null;
        imgRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Only run this effect on the client side
    if (!isBrowser) return;

    console.log(`useImage: Processing image source: ${src ? 'Source provided' : 'No source'}`);

    if (!src) {
      console.log("useImage: No source provided, setting status to idle");
      setImage(null);
      setStatus('idle');
      return;
    }

    // First set loading state
    setStatus('loading');
    
    // Create a new image instance
    const img = new Image();
    imgRef.current = img;
    
    // Setup event handlers
    const onLoad = () => {
      console.log(`useImage: Image loaded successfully - dimensions: ${img.width}x${img.height}`);
      setImage(img);
      setStatus('loaded');
    };
    
    const onError = () => {
      console.error("useImage: Failed to load image:", src.substring(0, 100) + (src.length > 100 ? '...' : ''));
      setImage(null);
      setStatus('error');
    };
    
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    
    // Assign src after setting up event handlers
    img.src = src;
    
    // If image is already cached, it might trigger the onload event before we can attach the listener
    if (img.complete) {
      console.log("useImage: Image already in cache, triggering load event manually");
      onLoad();
    }
    
    // Clean up function
    return () => {
      console.log("useImage: Cleaning up event listeners for previous image");
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      
      // Cancel any pending image loads by nullifying src
      img.src = '';
    };
  }, [src, isBrowser]);

  return [image, { status }];
};

export default useImage; 