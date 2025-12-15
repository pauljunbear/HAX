'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig, effectCategories, hiddenLegacyEffects } from '@/lib/effects';
import { ChevronRight, Plus, Search } from 'lucide-react';

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredEffect, setHoveredEffect] = useState<string | null>(null);

  // Start with curated categories collapsed by default
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set([...Object.keys(effectCategories), 'More'])
  );

  // Group effects by category
  const effectsByCategory = useMemo(() => {
    const grouped: Record<string, Array<[string, (typeof effectsConfig)[string]]>> = {};

    // Use the curated UI categories (keeps menus compact and predictable)
    Object.entries(effectCategories).forEach(([category, data]) => {
      const items = (data.effects || [])
        .filter(effectId => !!effectsConfig[effectId])
        .map(
          effectId =>
            [effectId, effectsConfig[effectId]] as [string, (typeof effectsConfig)[string]]
        )
        .sort((a, b) => a[1].label.localeCompare(b[1].label));

      grouped[category] = items;
    });

    // Find any effects not in a category (should be minimal after proper categorization)
    // Filter out legacy effects that are now presets in unified Studios
    const included = new Set<string>();
    Object.values(grouped).forEach(items => {
      items.forEach(([id]) => included.add(id));
    });

    const remaining = Object.entries(effectsConfig)
      .filter(([id]) => !included.has(id) && !hiddenLegacyEffects.has(id))
      .sort((a, b) => a[1].label.localeCompare(b[1].label));

    // Only show "More" if there are truly uncategorized effects
    if (remaining.length > 0) {
      grouped['More'] = remaining;
    }

    return grouped;
  }, []);

  // Filter effects based on search
  const filteredEffectsByCategory = useMemo(() => {
    if (!searchTerm) return effectsByCategory;

    const filtered: Record<string, Array<[string, (typeof effectsConfig)[string]]>> = {};

    Object.entries(effectsByCategory).forEach(([category, effects]) => {
      const matchingEffects = effects.filter(
        ([, effect]) =>
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

  // Get beautiful gradient colors for each effect
  const getEffectGradient = (effectId: string) => {
    const gradients = [
      { from: 'from-blue-400', to: 'to-blue-600', hover: 'hover:from-blue-500 hover:to-blue-700' },
      {
        from: 'from-purple-400',
        to: 'to-purple-600',
        hover: 'hover:from-purple-500 hover:to-purple-700',
      },
      { from: 'from-pink-400', to: 'to-pink-600', hover: 'hover:from-pink-500 hover:to-pink-700' },
      {
        from: 'from-emerald-400',
        to: 'to-emerald-600',
        hover: 'hover:from-emerald-500 hover:to-emerald-700',
      },
      {
        from: 'from-orange-400',
        to: 'to-orange-600',
        hover: 'hover:from-orange-500 hover:to-orange-700',
      },
      { from: 'from-cyan-400', to: 'to-cyan-600', hover: 'hover:from-cyan-500 hover:to-cyan-700' },
      {
        from: 'from-indigo-400',
        to: 'to-indigo-600',
        hover: 'hover:from-indigo-500 hover:to-indigo-700',
      },
      { from: 'from-rose-400', to: 'to-rose-600', hover: 'hover:from-rose-500 hover:to-rose-700' },
      {
        from: 'from-violet-400',
        to: 'to-violet-600',
        hover: 'hover:from-violet-500 hover:to-violet-700',
      },
      {
        from: 'from-amber-400',
        to: 'to-amber-600',
        hover: 'hover:from-amber-500 hover:to-amber-700',
      },
      { from: 'from-teal-400', to: 'to-teal-600', hover: 'hover:from-teal-500 hover:to-teal-700' },
      { from: 'from-lime-400', to: 'to-lime-600', hover: 'hover:from-lime-500 hover:to-lime-700' },
    ];

    const hash = effectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Effects</h2>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 mb-4">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="w-4 h-4 text-gray-400" />
          </span>
          <input
            type="search"
            placeholder="Search effects"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-4 py-2 text-xs rounded-md glass-input"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {/* When no image is loaded */}
          {!hasImage && (
            <div className="text-center py-20 px-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center liquid-material">
                <svg
                  className="w-10 h-10 text-gray-400"
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
              <h3 className="text-lg font-semibold mb-2">No Image Selected</h3>
              <p className="text-sm text-gray-600 mb-5 max-w-xs mx-auto">
                Upload an image to start applying effects
              </p>
              <button
                onClick={onNewImage}
                className="glass-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl"
              >
                <Plus className="w-4 h-4" />
                Choose Image
              </button>
            </div>
          )}

          {/* Categories and Effects */}
          {hasImage &&
            Object.entries(filteredEffectsByCategory).map(([category, effects]) => {
              const isExpanded = !collapsedCategories.has(category);

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 text-left 
                      transition-all rounded-xl group relative overflow-hidden glass-effect-button
                      ${isExpanded ? 'glass-active mb-1' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2 relative z-10">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                      <h3 className="text-sm font-medium">{category}</h3>
                      <span className="text-xs glass-badge px-2 py-0.5 rounded-full">
                        {effects.length}
                      </span>
                    </div>
                  </button>

                  {/* Effects List */}
                  <AnimatePresence mode="sync">
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.2, ease: 'easeInOut' },
                          opacity: { duration: 0.15, ease: 'easeInOut' },
                        }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className={`
                          px-2 pb-2
                          ${effects.length > 8 ? 'grid grid-cols-2 gap-1.5' : 'space-y-0.5'}
                        `}
                        >
                          {effects.map(([effectId, effect]) => {
                            const gradient = getEffectGradient(effectId);
                            const isActive = activeEffect === effectId;

                            return (
                              <motion.button
                                key={effectId}
                                onClick={() => handleEffectClick(effectId)}
                                onMouseEnter={() => setHoveredEffect(effectId)}
                                onMouseLeave={() => setHoveredEffect(null)}
                                disabled={!hasImage}
                                className={`
                                  effect-button-modern glass-button
                                  ${isActive ? 'glass-active' : ''}
                                  ${!hasImage ? 'opacity-40 cursor-not-allowed' : ''}
                                  ${effects.length > 8 ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'}
                                `}
                                whileHover={hasImage && !isActive ? { scale: 1.02, y: -1 } : {}}
                                whileTap={hasImage ? { scale: 0.98 } : {}}
                              >
                                {/* Gradient background on hover */}
                                <div
                                  className={`
                                    absolute inset-0 rounded-md opacity-0 transition-opacity duration-200
                                    ${hoveredEffect === effectId && !isActive ? 'opacity-100' : ''}
                                    bg-gradient-to-r ${gradient.from} ${gradient.to}
                                  `}
                                />

                                <span
                                  className={`
                                  block relative z-10 transition-colors duration-200
                                  ${effects.length > 8 ? 'truncate' : ''}
                                  ${hoveredEffect === effectId && !isActive ? 'text-white' : ''}
                                `}
                                >
                                  {effect.label}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

          {/* No results */}
          {hasImage && Object.keys(filteredEffectsByCategory).length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center liquid-material">
                <Search className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium mb-1">No Effects Found</h3>
              <p className="text-xs text-gray-600">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
