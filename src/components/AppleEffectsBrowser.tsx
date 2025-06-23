'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig } from '@/lib/effects';
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
  onHidePanel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categoryMousePos, setCategoryMousePos] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Start with ALL categories collapsed by default
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(Object.values(effectsConfig).map(effect => effect.category))
  );

  // Handle mouse move for button light effect
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Handle mouse move for category buttons
  const handleCategoryMouseMove = (e: React.MouseEvent<HTMLButtonElement>, category: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCategoryMousePos(prev => ({
      ...prev,
      [category]: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      },
    }));
  };

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
    <div className="w-full h-full flex flex-col glass-material">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 glass-header">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Effects</h2>
          <button
            ref={buttonRef}
            onClick={onNewImage}
            onMouseMove={handleMouseMove}
            className="relative flex items-center gap-1 text-[11px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all px-2 py-1 rounded-md shadow-sm overflow-hidden"
            style={
              {
                '--mouse-x': `${mousePosition.x}px`,
                '--mouse-y': `${mousePosition.y}px`,
              } as React.CSSProperties
            }
          >
            <div className="button-light-effect" />
            <Plus className="w-3 h-3 relative z-10" />
            <span className="relative z-10">New</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="search"
            placeholder="Search effects"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs glass-input border border-white/10 rounded-md focus:border-white/20 focus:outline-none transition-all placeholder:text-white/40 text-white"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto glass-scroll">
        <div className="p-3 space-y-1">
          {/* When no image is loaded */}
          {!hasImage && (
            <div className="text-center py-20 px-4">
              <div className="w-20 h-20 mx-auto mb-4 glass-material rounded-2xl flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white/40"
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
              <h3 className="text-lg font-semibold mb-2 text-white">No Image Selected</h3>
              <p className="text-sm text-white/60 mb-5 max-w-xs mx-auto">
                Upload an image to start applying effects
              </p>
              <button
                onClick={onNewImage}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Choose Image
              </button>
            </div>
          )}

          {/* Categories and Effects */}
          {hasImage &&
            Object.entries(filteredEffectsByCategory).map(([category, effects], categoryIndex) => {
              const isExpanded = !collapsedCategories.has(category);
              const hasLongList = effects.length > 8;

              return (
                <div key={category}>
                  {/* Category Header Button */}
                  <button
                    onClick={() => toggleCategory(category)}
                    onMouseMove={e => handleCategoryMouseMove(e, category)}
                    onMouseEnter={() => setHoveredCategory(category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 text-left 
                      transition-all rounded-lg group glass-button relative overflow-hidden
                      ${isExpanded ? 'glass-active mb-1' : 'hover:glass-hover'}
                    `}
                    style={
                      {
                        '--mouse-x': `${categoryMousePos[category]?.x || 0}px`,
                        '--mouse-y': `${categoryMousePos[category]?.y || 0}px`,
                      } as React.CSSProperties
                    }
                  >
                    {hoveredCategory === category && <div className="button-light-effect" />}
                    <div className="flex items-center gap-2 relative z-10">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="text-white/60"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                      <h3 className="text-sm font-medium text-white">{category}</h3>
                      <span className="text-xs text-white/50 glass-badge px-2 py-0.5 rounded-full">
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
                          ${hasLongList ? 'grid grid-cols-2 gap-1' : 'space-y-0.5'}
                        `}
                        >
                          {effects.map(([effectId, effect]) => (
                            <button
                              key={effectId}
                              onClick={() => handleEffectClick(effectId)}
                              disabled={!hasImage}
                              className={`
                                w-full text-left px-3 rounded-md transition-all glass-effect-button
                                ${hasLongList ? 'py-1.5 text-xs' : 'py-2 text-sm'}
                                ${
                                  activeEffect === effectId
                                    ? 'bg-blue-500 text-white font-medium shadow-sm active-effect'
                                    : 'hover:glass-hover text-white/80 hover:text-white'
                                }
                                ${!hasImage ? 'opacity-40 cursor-not-allowed' : ''}
                              `}
                            >
                              <span className="block truncate">{effect.label}</span>
                            </button>
                          ))}
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
              <div className="w-14 h-14 mx-auto mb-3 glass-material rounded-xl flex items-center justify-center">
                <Search className="w-7 h-7 text-white/40" />
              </div>
              <h3 className="text-sm font-medium mb-1 text-white">No Effects Found</h3>
              <p className="text-xs text-white/60">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppleEffectsBrowser;
