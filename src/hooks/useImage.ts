'use client';

import { useState, useEffect, useRef } from 'react';

export type DecodedImage = HTMLImageElement | ImageBitmap;
type Status = { status: string; error?: string };

/**
 * Decode an image source OFF the main thread via createImageBitmap, so a large
 * photo's full-res decode doesn't hitch the UI on first paint. Falls back to an
 * <img> + decode() when createImageBitmap is unavailable or fails.
 *
 * Fidelity guards (from the image-perf research): imageOrientation:'from-image'
 * (honor EXIF so phone photos aren't sideways), premultiplyAlpha:'none' +
 * default colorSpaceConversion (byte-identical color/alpha — do NOT set
 * colorSpaceConversion:'none', which shifts tagged/wide-gamut sources). Never
 * resize the master here — that would cap export detail.
 *
 * Konva, drawImage, and createImageBitmap all accept ImageBitmap, so the rest of
 * the pipeline is unchanged.
 */
const useImage = (src: string): [DecodedImage | null, Status] => {
  const [image, setImage] = useState<DecodedImage | null>(null);
  const [status, setStatus] = useState<Status>({ status: 'loading' });
  const [isBrowser, setIsBrowser] = useState(false);
  const liveBitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    if (!isBrowser) return;

    if (!src) {
      setImage(null);
      setStatus({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setStatus({ status: 'loading' });

    // Free the previously-decoded bitmap, but defer so any in-flight Konva draw
    // referencing it has completed (the node swaps to the new image on the React
    // commit before the next draw). Closing eagerly could draw a closed bitmap.
    const retirePrevBitmap = () => {
      const prev = liveBitmapRef.current;
      liveBitmapRef.current = null;
      if (prev) window.setTimeout(() => prev.close(), 2000);
    };

    const decodeViaImg = async () => {
      const img = new Image();
      img.src = src;
      if (typeof img.decode === 'function') {
        await img.decode();
      } else {
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('image load failed'));
        });
      }
      if (cancelled) return;
      retirePrevBitmap();
      setImage(img);
      setStatus({ status: 'loaded' });
    };

    (async () => {
      try {
        if (typeof createImageBitmap === 'function') {
          const resp = await fetch(src);
          const blob = await resp.blob();
          if (cancelled) return;
          const bmp = await createImageBitmap(blob, {
            imageOrientation: 'from-image',
            premultiplyAlpha: 'none',
          });
          if (cancelled) {
            bmp.close();
            return;
          }
          retirePrevBitmap();
          liveBitmapRef.current = bmp;
          setImage(bmp);
          setStatus({ status: 'loaded' });
          return;
        }
        await decodeViaImg();
      } catch {
        // Any failure in the fast path → fall back to the <img> decode.
        try {
          await decodeViaImg();
        } catch (err) {
          if (cancelled) return;
          setImage(null);
          setStatus({
            status: 'error',
            error: err instanceof Error ? err.message : 'decode failed',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, isBrowser]);

  // Close the live bitmap on unmount.
  useEffect(() => {
    return () => {
      if (liveBitmapRef.current) {
        liveBitmapRef.current.close();
        liveBitmapRef.current = null;
      }
    };
  }, []);

  return [image, status];
};

export default useImage;
