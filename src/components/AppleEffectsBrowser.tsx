'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface AppleEffectsBrowserProps {
  activeEffect?: string | null;
  onEffectChange?: (effectName: string | null) => void;
  hasImage?: boolean;
  onNewImage?: () => void;
  onHidePanel?: () => void;
}

const AppleEffectsBrowser: React.FC<AppleEffectsBrowserProps> = ({
  activeEffect,
  onEffectChange,
  hasImage = false,
  onNewImage,
  onHidePanel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Start with ALL categories collapsed by default
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(Object.values(effectsConfig).map(effect => effect.category))
  );

  // Group effects by category
  const effectsByCategory = useMemo(() => {
    const grouped: Record<string, Array<[string, (typeof effectsConfig)[string]]>> = {};

    Object.entries(effectsConfig).forEach(([id, effect]) => {
      if (!grouped[effect.category]) {
        grouped[effect.category] = [];
      }
      grouped[effect.category].push([id, effect]);
    });

    // Sort categories and effects within each category
    const sortedCategories = Object.keys(grouped).sort();
    const result: Record<string, Array<[string, (typeof effectsConfig)[string]]>> = {};

    sortedCategories.forEach(category => {
      result[category] = grouped[category].sort((a, b) => a[1].label.localeCompare(b[1].label));
    });

    return result;
  }, []);

  // Filter effects based on search
  const filteredEffectsByCategory = useMemo(() => {
    if (!searchTerm) return effectsByCategory;

    const filtered: Record<string, Array<[string, (typeof effectsConfig)[string]]>> = {};

    Object.entries(effectsByCategory).forEach(([category, effects]) => {
      const matchingEffects = effects.filter(
        ([id, effect]) =>
          effect.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (matchingEffects.length > 0) {
        filtered[category] = matchingEffects;
      }
    });

    return filtered;
  }, [effectsByCategory, searchTerm]);

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleEffectClick = (effectId: string) => {
    if (!hasImage) return;
    onEffectChange?.(effectId);
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Adjust: '⚖️',
      Artistic: '🎨',
      'Artistic Simulation': '🖼️',
      'Blur & Focus': '🔍',
      'Color Effects': '🌈',
      Distortion: '🌀',
      Filters: '🔧',
      Generative: '✨',
      Mathematical: '📐',
    };
    return icons[category] || '📁';
  };

  return (
    <div className="w-full h-full flex flex-col glass-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Effects</h2>
            <button
              onClick={onHidePanel}
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md transition-all"
              title="Hide Effects Panel"
            >
              <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
          <button
            onClick={onNewImage}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-white/20 hover:bg-white/30 transition-all px-3 py-1.5 rounded-full"
          >
            <Plus className="w-3 h-3" />
            New Image
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search effects..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:bg-white/10 focus:border-white/20 transition-all placeholder:text-white/40"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-edge-top scroll-edge-bottom">
        <div className="p-2">
          {/* When no image is loaded */}
          {!hasImage && (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">No Image Selected</h3>
              <p className="text-sm text-white/60 mb-4 max-w-xs mx-auto">
                Upload an image to start applying effects
              </p>
              <button
                onClick={onNewImage}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 transition-all rounded-full"
              >
                <Plus className="w-4 h-4" />
                Choose Image
              </button>
            </div>
          )}

          {/* Categories and Effects */}
          {hasImage &&
            Object.entries(filteredEffectsByCategory).map(([category, effects], categoryIndex) => (
              <div key={category} className={categoryIndex > 0 ? 'mt-2' : ''}>
                {/* Category Header Button */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 text-left transition-all hover:bg-white/5 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium">{category}</h3>
                    <span className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md font-medium">
                      {effects.length}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: collapsedCategories.has(category) ? 0 : 90 }}
                    transition={{
                      duration: 0.2,
                      ease: 'easeInOut',
                    }}
                    className="opacity-40 group-hover:opacity-60 transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </button>

                {/* Effects List */}
                <AnimatePresence mode="sync">
                  {!collapsedCategories.has(category) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: {
                          duration: 0.2,
                          ease: 'easeInOut',
                        },
                        opacity: {
                          duration: 0.15,
                          ease: 'easeInOut',
                        },
                      }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="pl-4 pr-2 pb-2 space-y-1">
                        {effects.map(([effectId, effect]) => (
                          <button
                            key={effectId}
                            onClick={() => handleEffectClick(effectId)}
                            disabled={!hasImage}
                            className={`
                            w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm
                            ${
                              activeEffect === effectId
                                ? 'bg-white/20 text-white font-medium shadow-sm'
                                : 'hover:bg-white/10 text-white/70 hover:text-white'
                            }
                            ${!hasImage ? 'opacity-40 cursor-not-allowed' : ''}
                          `}
                          >
                            {effect.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

          {/* No results */}
          {hasImage && Object.keys(filteredEffectsByCategory).length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-white/5 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-medium mb-1">No Effects Found</h3>
              <p className="text-xs text-white/50">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
