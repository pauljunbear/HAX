'use client';

import { useState, useEffect } from 'react';

const useImage = (src: string): [HTMLImageElement | null, { status: string }] => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [isBrowser, setIsBrowser] = useState(false);

  // Detect browser environment
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    // Only run this effect on the client side
    if (!isBrowser) return;

    if (!src) {
      setImage(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    const img = new Image();
    img.src = src;
    
    const onLoad = () => {
      setImage(img);
      setStatus('loaded');
    };
    
    const onError = () => {
      setImage(null);
      setStatus('error');
    };
    
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    
    return () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
  }, [src, isBrowser]);

  return [image, { status }];
};

export default useImage; 