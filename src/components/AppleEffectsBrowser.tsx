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
    <div className="w-full h-full flex flex-col bg-white/40 backdrop-blur-sm border-r border-gray-200/50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Effects</h2>
          <button
            onClick={onNewImage}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-md hover:bg-blue-50/50 transition-all"
          >
            New Image
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search effects..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-xs text-gray-900 bg-white/60 border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 backdrop-blur-sm transition-all placeholder-gray-500"
          />
          <svg
            className="absolute right-2.5 top-2.5 w-3 h-3 text-gray-400"
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
      </div>

      {/* Effects by Category */}
      <div className="flex-1 overflow-y-auto">
        {!hasImage ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
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
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Upload an Image</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed max-w-xs mx-auto">
              Choose an image to start applying effects
            </p>
            <button
              onClick={onNewImage}
              className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-all shadow-md hover:shadow-lg space-x-1.5"
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
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/40 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm">{getCategoryIcon(category)}</span>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700">
                        {category}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {effects.length} effect{effects.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <motion.svg
                    className="w-4 h-4 text-gray-400"
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
                            className={`p-2.5 text-center transition-all duration-200 rounded-lg border ${
                              activeEffect === effectId
                                ? 'bg-blue-50/80 border-blue-300/60 shadow-lg ring-2 ring-blue-500/20 scale-105'
                                : 'bg-white/60 border-gray-200/60 hover:bg-white/80 hover:border-gray-300/60 hover:shadow-md hover:scale-102'
                            }`}
                          >
                            <h4 className="text-xs font-medium text-gray-900 leading-tight">
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
                <div className="w-12 h-12 mx-auto mb-3 bg-gray-100/80 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-500"
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
                <h3 className="text-sm font-medium text-gray-900 mb-1">No Effects Found</h3>
                <p className="text-xs text-gray-500">Try adjusting your search term</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
