'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';

interface AppleEffectsBrowserProps {
  activeEffect?: string | null;
  onEffectChange?: (effectName: string | null) => void;
  hasImage?: boolean;
  onNewImage?: () => void;
}

const AppleEffectsBrowser: React.FC<AppleEffectsBrowserProps> = ({
  activeEffect,
  onEffectChange,
  hasImage = false,
  onNewImage,
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
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider font-mono">
            Effects
          </h2>
          <button
            onClick={onNewImage}
            className="text-xs text-green-400 hover:text-green-300 font-medium px-2 py-1 hover:bg-green-400/10 transition-all font-mono uppercase tracking-wide"
          >
            New Image
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="search"
            placeholder="SEARCH EFFECTS..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Effects by Category */}
      <div className="flex-1 overflow-y-auto">
        {!hasImage ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-black border border-green-400/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
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
            <h3 className="text-sm font-semibold text-white mb-2 font-mono uppercase tracking-wide">
              Upload an Image
            </h3>
            <p className="text-xs text-white/70 mb-4 leading-relaxed max-w-xs mx-auto font-mono">
              Choose an image to start applying effects
            </p>
            <button
              onClick={onNewImage}
              className="inline-flex items-center px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium border border-green-400/30 hover:border-green-400/50 transition-all space-x-1.5 font-mono uppercase tracking-wide"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Choose Image</span>
            </button>
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(filteredEffectsByCategory).map(([category, effects]) => (
              <div key={category} className="mb-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div>
                      <h3 className="text-xs font-semibold text-white/80 group-hover:text-white font-mono uppercase tracking-wide">
                        {category}
                      </h3>
                      <p className="text-xs text-white/50 font-mono">[{effects.length}]</p>
                    </div>
                  </div>
                  <motion.svg
                    className="w-4 h-4 text-green-400/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    animate={{ rotate: collapsedCategories.has(category) ? 0 : 90 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </motion.svg>
                </button>

                {/* Category Effects */}
                <AnimatePresence>
                  {!collapsedCategories.has(category) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                        {effects.map(([effectId, effect]) => (
                          <motion.button
                            key={effectId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => handleEffectClick(effectId)}
                            className={`p-2.5 text-center transition-all duration-200 border ${
                              activeEffect === effectId
                                ? 'bg-green-600/20 border-green-400/60 shadow-lg ring-2 ring-green-500/20'
                                : 'bg-black/60 border-white/20 hover:bg-green-600/10 hover:border-green-400/40'
                            }`}
                          >
                            <h4 className="text-xs font-medium text-white/90 leading-tight font-mono uppercase tracking-wide">
                              {effect.label}
                            </h4>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {Object.keys(filteredEffectsByCategory).length === 0 && (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-black border border-green-400/30 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-400"
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
                <h3 className="text-sm font-medium text-white mb-1 font-mono uppercase tracking-wide">
                  No Effects Found
                </h3>
                <p className="text-xs text-white/70 font-mono">Try adjusting your search term</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
