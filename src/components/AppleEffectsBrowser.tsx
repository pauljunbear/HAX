'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="w-full h-full flex flex-col glass-panel border-r border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider">Effects</h2>
            <button
              onClick={onHidePanel}
              className="w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded transition-all"
              title="Hide Effects Panel"
            >
              <ChevronLeft className="w-3 h-3 opacity-60" />
            </button>
          </div>
          <button
            onClick={onNewImage}
            className="text-xs text-green-400 hover:text-green-300 transition-colors shape-capsule px-3 py-1 bg-green-400/10 hover:bg-green-400/20"
          >
            New Image
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1.5 text-[11px] bg-white/5 border border-white/10 rounded focus:bg-white/10 focus:border-white/20 transition-all placeholder:text-white/30"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-edge-top scroll-edge-bottom">
        <div className="px-4 pt-4 pb-20">
          {/* Main Category */}
          {Object.entries(filteredEffectsByCategory).map(([category, effects]) => (
            <div key={category}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-all hover:bg-white/5 border-b border-white/10"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-[12px] font-medium">{category}</h3>
                  <span className="text-[10px] text-white/40 font-mono">{effects.length}</span>
                </div>
                <motion.div
                  animate={{ rotate: collapsedCategories.has(category) ? 0 : 90 }}
                  transition={{
                    duration: 0.35,
                    ease: 'easeInOut',
                  }}
                >
                  <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                </motion.div>
              </button>

              {/* Category Effects */}
              <AnimatePresence mode="sync">
                {!collapsedCategories.has(category) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: {
                        duration: 0.35,
                        ease: 'easeInOut',
                      },
                      opacity: {
                        duration: 0.25,
                        ease: 'easeInOut',
                      },
                    }}
                    style={{ overflow: 'hidden' }}
                  >
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="grid grid-cols-2 gap-1.5 px-4 py-2 bg-black/5">
                        {effects.map(([effectId, effect]) => (
                          <button
                            key={effectId}
                            onClick={() => handleEffectClick(effectId)}
                            className={`px-2 py-1 text-[10px] text-center transition-all rounded ${
                              activeEffect === effectId
                                ? 'bg-white/15 border border-white/25 font-medium'
                                : 'hover:bg-white/5 text-white/70 hover:text-white/90'
                            }`}
                          >
                            {effect.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {Object.keys(filteredEffectsByCategory).length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-10 h-10 mx-auto mb-3 bg-white/5 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white/30"
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
              <p className="text-[11px] text-white/50">Try adjusting your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
