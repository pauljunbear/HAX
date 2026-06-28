'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useAppStore } from '@/lib/store';
import ImageEditor from '@/components/ImageEditor';
import IntroScreen from '@/components/IntroScreen';
import { motion } from 'framer-motion';

// Import new components
import AppleStyleLayout from '@/components/AppleStyleLayout';
import RandomizerBar from '@/components/RandomizerBar';
import useHistory from '@/hooks/useHistory';
import useEffectLayers from '@/hooks/useEffectLayers';
import type { EffectLayer } from '@/hooks/useEffectLayers';
import type { ImageEditorHandle } from './ImageEditor';
import { compose, type RecipeLayer } from '@/lib/randomizer/compose';
import { randSeed } from '@/lib/randomizer/seed';
import LooksGallery from '@/components/LooksGallery';
import { LOOKS, lookToStackLayers, type Look } from '@/lib/looks/looks';
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

export default function EditorApp() {
  const selectedImage = useAppStore(state => state.selectedImage);
  const setSelectedImage = useAppStore(state => state.setSelectedImage);

  // This prevents the intro screen from flashing on page load if an image is already selected
  const [isReady, setIsReady] = useState(false);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageEditorRef = useRef<ImageEditorHandle | null>(null);

  // Initialize history with empty state
  const { clearHistory } = useHistory({
    activeEffect: null,
    effectSettings: {},
  });

  // Initialize effect layers
  const {
    layers: effectLayers,
    activeLayerId: activeEffectLayerId,
    activeLayer: activeEffectLayer,
    addLayer: addEffectLayer,
    removeLayer: removeEffectLayer,
    updateLayer,
    reorderLayers,
    setActiveLayer: setActiveEffectLayer,
    updateLayerSettings,
    clearLayers: clearEffectLayers,
    setStack,
    toggleLayerLock,
  } = useEffectLayers();

  // Extract effectSettings from the active effect layer
  const effectSettings = activeEffectLayer?.settings || {};

  // Which effects are currently on the image — drives the contact-sheet "ON"
  // state. (Fixes the old name-vs-UUID compare that could never be true.)
  const appliedEffectIds = useMemo(
    () => new Set(effectLayers.map(l => l.effectId)),
    [effectLayers]
  );

  // ---- Smart Randomizer state ----
  const [moodId, setMoodId] = useState('faded');
  const [wildness, setWildness] = useState(0.42);
  const [seed, setSeed] = useState(''); // shown only after the first roll
  const undoStackRef = useRef<EffectLayer[][]>([]);

  const snapshot = useCallback(() => {
    undoStackRef.current.push(effectLayers.map(l => ({ ...l, settings: { ...l.settings } })));
    if (undoStackRef.current.length > 40) undoStackRef.current.shift();
  }, [effectLayers]);

  const lockedRecipe = useCallback(
    (): RecipeLayer[] =>
      effectLayers
        .filter(l => l.locked)
        .map(l => ({
          effectId: l.effectId,
          settings: l.settings,
          opacity: l.opacity,
          locked: true,
        })),
    [effectLayers]
  );

  const runRandomizer = useCallback(
    (fresh: boolean) => {
      snapshot();
      const locked = fresh ? [] : lockedRecipe();
      const s = randSeed();
      setSeed(s);
      setStack(compose(s, moodId, locked, wildness).layers);
    },
    [snapshot, lockedRecipe, moodId, wildness, setStack]
  );
  const handleSurprise = useCallback(() => runRandomizer(true), [runRandomizer]);
  const handleReroll = useCallback(() => runRandomizer(false), [runRandomizer]);

  // Apply a curated Look: replace the stack with its recipe (snapshot for undo).
  // Fully editable afterward — the stack stays decomposable.
  const handleApplyLook = useCallback(
    (look: Look) => {
      snapshot();
      setSeed('');
      setStack(lookToStackLayers(look));
    },
    [snapshot, setStack]
  );

  const handleMood = useCallback(
    (id: string) => {
      setMoodId(id);
      if (effectLayers.length) {
        snapshot();
        const s = randSeed();
        setSeed(s);
        setStack(compose(s, id, lockedRecipe(), wildness).layers);
      }
    },
    [effectLayers.length, snapshot, lockedRecipe, wildness, setStack]
  );

  // Live wildness: re-shape the CURRENT seed's look as you drag (no undo churn).
  const handleWildness = useCallback(
    (w: number) => {
      setWildness(w);
      if (effectLayers.length && seed) setStack(compose(seed, moodId, lockedRecipe(), w).layers);
    },
    [effectLayers.length, seed, moodId, lockedRecipe, setStack]
  );

  // keep latest reroll for the keydown effect so it doesn't re-subscribe per change
  const rerollRef = useRef(handleReroll);
  rerollRef.current = handleReroll;

  // SPACEBAR = roll; Cmd/Ctrl+Z = undo. Scoped so it never fires while typing or
  // when an interactive element is focused — avoids the destructive accidental-
  // Space footgun on a hand-built stack, and makes every roll reversible.
  useEffect(() => {
    if (!selectedImage) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const prev = undoStackRef.current.pop();
        if (prev) {
          e.preventDefault();
          setStack(prev);
        }
        return;
      }
      if (e.code !== 'Space') return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        el !== document.body &&
        el.closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]')
      ) {
        return;
      }
      e.preventDefault();
      rerollRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedImage, setStack]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const handleImageUpload = useCallback(
    (file: File) => {
      // Reset error state
      setImageError(null);
      setImageLoading(true);

      // Reset active effect and clear history when a new image is uploaded
      clearHistory({ activeEffect: null, effectSettings: {} });
      clearEffectLayers();

      const reader = new FileReader();
      reader.onload = e => {
        const imageDataUrl = e.target?.result as string;

        // Validate the image data
        if (!imageDataUrl.startsWith('data:image/')) {
          console.error('Invalid image data format:', imageDataUrl.substring(0, 50));
          setImageError('Invalid image data format');
          setImageLoading(false);
          return;
        }

        // Test load the image first
        const testImage = new Image();
        testImage.onload = () => {
          setSelectedImage(imageDataUrl);
          setImageLoading(false);
        };

        testImage.onerror = error => {
          console.error('Failed to load test image in Home component:', error);
          setImageError('Failed to load image. Please try another file.');
          setImageLoading(false);
        };

        // Set the source to trigger loading
        testImage.src = imageDataUrl;
      };

      reader.onerror = () => {
        setImageError('Failed to read file. Please try another file.');
        setImageLoading(false);
      };

      reader.readAsDataURL(file);
    },
    [clearHistory, clearEffectLayers, setSelectedImage]
  );

  const handleImageSelect = useCallback(() => {
    // This will be called by the AppleStyleLayout
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  }, [handleImageUpload]);

  const handleEffectChange = useCallback(
    (effectName: string | null) => {
      if (!effectName) {
        if (activeEffectLayerId) removeEffectLayer(activeEffectLayerId);
        return;
      }
      // Toggle: clicking an already-applied effect peels it off instead of
      // silently stacking a duplicate. (Apply contract from the audit.)
      const existing = effectLayers.find(l => l.effectId === effectName);
      if (existing) {
        removeEffectLayer(existing.id);
      } else {
        addEffectLayer(effectName);
      }
    },
    [addEffectLayer, removeEffectLayer, activeEffectLayerId, effectLayers]
  );

  const handleSettingChange = useCallback(
    (settingName: string, value: number) => {
      if (activeEffectLayerId) {
        updateLayerSettings(activeEffectLayerId, settingName, value);
      }
    },
    [activeEffectLayerId, updateLayerSettings]
  );

  // Per-layer edits for the unified "all effects in one view" controls stack.
  const handleLayerSettingChange = useCallback(
    (layerId: string, settingName: string, value: number) => {
      updateLayerSettings(layerId, settingName, value);
    },
    [updateLayerSettings]
  );

  const handleLayerOpacityChange = useCallback(
    (layerId: string, opacity: number) => {
      const layer = effectLayers.find(l => l.id === layerId);
      if (layer) updateLayer(layerId, { ...layer, opacity });
    },
    [effectLayers, updateLayer]
  );

  const handleResetSettings = useCallback(() => {
    if (!activeEffectLayerId || !activeEffectLayer) {
      return;
    }

    const effect = effectLayers.find(layer => layer.id === activeEffectLayerId);
    if (!effect) {
      return;
    }

    const defaultSettings = Object.fromEntries(
      Object.entries(effect.settings).map(([key, value]) => [key, value])
    );

    Object.entries(defaultSettings).forEach(([key, value]) => {
      updateLayerSettings(activeEffectLayerId, key, value as number);
    });
  }, [activeEffectLayerId, activeEffectLayer, effectLayers, updateLayerSettings]);

  const handleClearAllEffects = useCallback(() => {
    clearEffectLayers();
  }, [clearEffectLayers]);

  const handleRemoveEffect = useCallback(
    (layerId: string) => {
      removeEffectLayer(layerId);
    },
    [removeEffectLayer]
  );

  const handleToggleLayerVisibility = useCallback(
    (layerId: string) => {
      // This assumes your useEffectLayers hook has a function like toggleLayerVisibility
      // If not, you'll need to implement it. For now, let's add it to the hook.
      const layer = effectLayers.find(l => l.id === layerId);
      if (layer) {
        updateLayer(layerId, { ...layer, visible: !layer.visible });
      }
    },
    [effectLayers, updateLayer]
  );

  const handleExport = useCallback((format: string, quality?: number) => {
    if (!imageEditorRef.current) {
      return;
    }

    try {
      // Use the new options format if quality is provided
      if (quality !== undefined) {
        imageEditorRef.current.exportImage({
          format:
            format.toLowerCase() === 'jpg' ? 'jpeg' : (format.toLowerCase() as 'png' | 'jpeg'),
          quality,
        });
      } else {
        imageEditorRef.current.exportImage(format);
      }
    } catch (error) {
      console.error('exportImage failed', error);
    }
  }, []);

  const handleEstimateFileSize = useCallback(
    async (format: 'png' | 'jpeg', quality?: number): Promise<number> => {
      if (!imageEditorRef.current) {
        return 0;
      }

      try {
        return await imageEditorRef.current.estimateFileSize(format, quality);
      } catch (error) {
        console.error('estimateFileSize failed', error);
        return 0;
      }
    },
    []
  );

  // ---- Before/after compare ----
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [capturedEffectedUrl, setCapturedEffectedUrl] = useState<string | null>(null);

  const handleToggleBeforeAfter = useCallback(() => {
    setShowBeforeAfter(prev => {
      const next = !prev;
      if (next) {
        // Capture the current effected canvas at toggle time (accept ~1 frame lag).
        const url =
          imageEditorRef.current?.getStage()?.toDataURL({ mimeType: 'image/png', pixelRatio: 1 }) ??
          null;
        setCapturedEffectedUrl(url);
      }
      return next;
    });
  }, []);

  // ---- Keyboard shortcuts (Ctrl/Cmd + …). Undo (Cmd+Z) + reroll (Space) stay
  // in the scoped manual listener above; everything safe-to-fire lives here. ----
  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      { key: 'o', ctrlKey: true, action: handleImageSelect, description: 'Open image' },
      { key: 'e', ctrlKey: true, action: () => handleExport('png'), description: 'Export PNG' },
      { key: 'b', ctrlKey: true, action: handleToggleBeforeAfter, description: 'Before / after' },
      {
        key: 'Delete',
        action: () => {
          if (activeEffectLayerId) removeEffectLayer(activeEffectLayerId);
        },
        description: 'Remove selected effect',
      },
      {
        key: 'Backspace',
        action: () => {
          if (activeEffectLayerId) removeEffectLayer(activeEffectLayerId);
        },
        description: 'Remove selected effect',
      },
    ],
    [
      handleImageSelect,
      handleExport,
      handleToggleBeforeAfter,
      activeEffectLayerId,
      removeEffectLayer,
    ]
  );
  useKeyboardShortcuts({ shortcuts, enabled: !!selectedImage });

  if (!isReady) {
    return null; // Or a very minimal loader
  }

  return (
    <>
      <Head>
        <title>HAX - Real-time Image Effects</title>
        <meta
          name="description"
          content="A React-based image editing app with real-time artistic effects."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        {selectedImage ? (
          <AppleStyleLayout
            selectedImage={selectedImage}
            onImageSelect={handleImageSelect}
            onImageUpload={handleImageUpload}
            // Effect-related props
            effectLayers={effectLayers}
            activeEffect={activeEffectLayerId}
            appliedEffectIds={appliedEffectIds}
            effectSettings={effectSettings}
            onEffectChange={handleEffectChange}
            onSettingChange={handleSettingChange}
            onLayerSettingChange={handleLayerSettingChange}
            onLayerOpacityChange={handleLayerOpacityChange}
            onResetSettings={handleResetSettings}
            onClearAllEffects={handleClearAllEffects}
            onRemoveEffect={handleRemoveEffect}
            onToggleLayerLock={toggleLayerLock}
            onSetActiveLayer={setActiveEffectLayer}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            onReorderLayers={reorderLayers}
            onExport={handleExport}
            onEstimateFileSize={handleEstimateFileSize}
            showBeforeAfter={showBeforeAfter}
            onToggleBeforeAfter={handleToggleBeforeAfter}
            capturedEffectedUrl={capturedEffectedUrl}
          >
            <div id="main-content" className="w-full h-full flex flex-col">
              <div className="flex-1 min-h-0 relative">
                {imageLoading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div
                      className="animate-spin rounded-full h-8 w-8 border-2"
                      style={{ borderColor: 'rgba(255,255,255,.15)', borderTopColor: '#F53001' }}
                    ></div>
                    <span className="ml-3" style={{ color: '#A8A49A' }}>
                      Loading image…
                    </span>
                  </div>
                ) : (
                  <ImageEditor
                    ref={imageEditorRef}
                    selectedImage={selectedImage}
                    effectLayers={effectLayers}
                  />
                )}
                {imageError && (
                  <div
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg"
                    role="alert"
                    style={{
                      background: 'rgba(245,48,1,.12)',
                      border: '1px solid rgba(245,48,1,.4)',
                      color: '#FF6A42',
                    }}
                  >
                    <strong className="font-semibold">Error: </strong>
                    <span className="block sm:inline">{imageError}</span>
                  </div>
                )}
              </div>
              {!imageLoading && (
                <>
                  <LooksGallery looks={LOOKS} onApply={handleApplyLook} />
                  <RandomizerBar
                    moodId={moodId}
                    wildness={wildness}
                    seed={seed}
                    onMood={handleMood}
                    onWildness={handleWildness}
                    onSurprise={handleSurprise}
                    onReroll={handleReroll}
                  />
                </>
              )}
            </div>
          </AppleStyleLayout>
        ) : (
          <IntroScreen onImageSelect={handleImageSelect} />
        )}
      </motion.div>
    </>
  );
}
