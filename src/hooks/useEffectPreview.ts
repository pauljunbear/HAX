import { useState, useEffect, useRef } from 'react';
import { applyEffect, getEffectSettings } from '@/lib/effects';
import Konva from 'konva';

interface PreviewState {
  isLoading: boolean;
  error: string | null;
  canvas: HTMLCanvasElement | null;
}

export const useEffectPreview = (
  effectId: string | null,
  imageUrl: string | null,
  previewSize: { width: number; height: number }
) => {
  const [state, setState] = useState<PreviewState>({
    isLoading: false,
    error: null,
    canvas: null,
  });

  const imageRef = useRef<HTMLImageElement | null>(null);
  const konvaStageRef = useRef<Konva.Stage | null>(null);
  const konvaLayerRef = useRef<Konva.Layer | null>(null);
  const konvaImageRef = useRef<Konva.Image | null>(null);

  useEffect(() => {
    if (!effectId || !imageUrl) {
      setState(prev => ({ ...prev, canvas: null, error: null }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const img = new Image();
    imageRef.current = img;

    img.onload = () => {
      try {
        // Create Konva stage if it doesn't exist
        if (!konvaStageRef.current) {
          konvaStageRef.current = new Konva.Stage({
            container: document.createElement('div'),
            width: previewSize.width,
            height: previewSize.height,
          });
        }

        // Create layer if it doesn't exist
        if (!konvaLayerRef.current) {
          konvaLayerRef.current = new Konva.Layer();
          konvaStageRef.current.add(konvaLayerRef.current);
        }

        // Create or update Konva image
        if (!konvaImageRef.current) {
          konvaImageRef.current = new Konva.Image({
            image: img,
            width: previewSize.width,
            height: previewSize.height,
          });
          konvaLayerRef.current.add(konvaImageRef.current);
        } else {
          konvaImageRef.current.image(img);
        }

        // Apply effect
        const effectSettings = getEffectSettings(effectId);
        const defaultSettings: Record<string, number> = {};
        effectSettings.forEach(setting => {
          defaultSettings[setting.id] = setting.defaultValue;
        });

        applyEffect(effectId, defaultSettings)
          .then(([filterFunc, filterParams]) => {
            if (filterFunc && konvaImageRef.current) {
              // Apply the filter
              konvaImageRef.current.filters([filterFunc]);

              // Apply filter parameters if any
              if (filterParams) {
                for (const [key, value] of Object.entries(filterParams)) {
                  if (typeof (konvaImageRef.current as any)[key] === 'function') {
                    (konvaImageRef.current as any)[key](value);
                  }
                }
              }

              // Cache and redraw
              konvaImageRef.current.cache();
              konvaLayerRef.current?.batchDraw();
            }

            // Get canvas with applied effect
            const canvas = konvaStageRef.current?.toCanvas();
            setState({
              isLoading: false,
              error: null,
              canvas: canvas || null,
            });
          })
          .catch(error => {
            console.error('Error applying effect:', error);
            setState({
              isLoading: false,
              error: 'Failed to apply effect',
              canvas: null,
            });
          });
      } catch (error) {
        console.error('Error setting up preview:', error);
        setState({
          isLoading: false,
          error: 'Failed to set up preview',
          canvas: null,
        });
      }
    };

    img.onerror = () => {
      setState({
        isLoading: false,
        error: 'Failed to load image',
        canvas: null,
      });
    };

    img.src = imageUrl;

    return () => {
      if (imageRef.current) {
        imageRef.current.src = '';
      }
    };
  }, [effectId, imageUrl, previewSize.width, previewSize.height]);

  return state;
};
