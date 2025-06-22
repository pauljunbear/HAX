'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { effectsConfig, effectCategories } from '@/lib/effects';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { ARIA_LABELS, focusRingClass, announce, useKeyboardNavigation } from '@/lib/accessibility';
import { GroupedVirtualScroll } from './VirtualScroll';
import { EffectHoverPreview } from './EffectHoverPreview';

interface ControlPanelV3Props {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  hasImage?: boolean;
  currentImageId?: string;
}

// Keep track of recently used effects in localStorage
const getRecentEffects = (): string[] => {
  if (typeof window === 'undefined') return [];
  const recent = localStorage.getItem('recentEffects');
  return recent ? JSON.parse(recent) : [];
};

const addToRecentEffects = (effectId: string) => {
  if (typeof window === 'undefined') return;
  const recent = getRecentEffects();
  const updated = [effectId, ...recent.filter(id => id !== effectId)].slice(0, 6);
  localStorage.setItem('recentEffects', JSON.stringify(updated));
};

const ControlPanelV3: React.FC<ControlPanelV3Props> = ({
  activeEffect,
  effectSettings = {},
  onEffectChange,
  onSettingChange,
  hasImage = false,
  currentImageId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Adjust']));
  const [recentEffects, setRecentEffects] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [containerHeight, setContainerHeight] = useState(400);
  const [hoveredEffect, setHoveredEffect] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent effects on mount
  useEffect(() => {
    setRecentEffects(getRecentEffects());
  }, []);

  // Get settings for the active effect
  const currentEffectSettings = useMemo(() => {
    if (!activeEffect || !effectsConfig[activeEffect]?.settings) return [];
    return Object.entries(effectsConfig[activeEffect].settings).map(([key, setting]) => ({
      id: key,
      ...(setting as any),
      currentValue: effectSettings[key] ?? (setting as any).default,
    }));
  }, [activeEffect, effectSettings]);

  // Calculate container height based on content
  useEffect(() => {
    const calculateHeight = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Reserve space for settings panel if active effect has settings
      const settingsHeight =
        activeEffect && currentEffectSettings.length > 0
          ? Math.min(250, 80 + currentEffectSettings.length * 45)
          : 0;

      const availableHeight = window.innerHeight - rect.top - settingsHeight - 40; // Extra padding
      const minHeight = 300; // Minimum height to prevent UI breaking
      const calculatedHeight = Math.max(minHeight, availableHeight);

      setContainerHeight(calculatedHeight);
    };

    // Debounce the calculation to prevent excessive calls
    let timeoutId: NodeJS.Timeout;
    const debouncedCalculateHeight = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculateHeight, 100);
    };

    debouncedCalculateHeight();
    window.addEventListener('resize', debouncedCalculateHeight);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedCalculateHeight);
    };
  }, [activeEffect, currentEffectSettings.length]);

  // Update recent effects when active effect changes
  useEffect(() => {
    if (activeEffect) {
      addToRecentEffects(activeEffect);
      setRecentEffects(getRecentEffects());
    }
  }, [activeEffect]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Filter effects based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;

    const results: { id: string; category: string; score: number }[] = [];
    const query = searchQuery.toLowerCase();

    Object.entries(effectCategories).forEach(([category, data]) => {
      data.effects.forEach(effectId => {
        const effect = effectsConfig[effectId];
        if (effect) {
          const label = effect.label.toLowerCase();
          let score = 0;

          // Exact match
          if (label === query) score = 100;
          // Starts with
          else if (label.startsWith(query)) score = 80;
          // Contains
          else if (label.includes(query)) score = 60;
          // Category match
          else if (category.toLowerCase().includes(query)) score = 40;

          if (score > 0) {
            results.push({ id: effectId, category, score });
          }
        }
      });
    });

    return results.sort((a, b) => b.score - a.score).map(r => r.id);
  }, [searchQuery]);

  const handleEffectSelect = (effectId: string) => {
    onEffectChange?.(effectId);
    // Announce to screen readers
    const effectName = effectsConfig[effectId]?.label || effectId;
    announce(`${effectName} effect selected`);
    // Auto-scroll to settings if they exist
    if (effectsConfig[effectId]?.settings) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // Hover preview handlers
  const handleEffectHover = (effectId: string, event: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPosition({
      x: Math.min(rect.right + 10, window.innerWidth - 170),
      y: Math.min(rect.top, window.innerHeight - 200),
    });

    // Delay showing preview to avoid flashing
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEffect(effectId);
    }, 300);
  };

  const handleEffectLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEffect(null);
  };

  // Touch handler for mobile (press and hold)
  const handleEffectTouchStart = (effectId: string, event: React.TouchEvent) => {
    const touch = event.touches[0];
    setHoverPosition({
      x: Math.min(touch.clientX + 10, window.innerWidth - 170),
      y: Math.min(touch.clientY - 170, window.innerHeight - 200),
    });

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEffect(effectId);
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }, 500);
  };

  const handleEffectTouchEnd = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEffect(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  if (!hasImage) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-dark-surface flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-dark-textMuted"
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
        <h2 className="text-xl font-medium text-dark-text mb-3">No Image Selected</h2>
        <p className="text-sm text-dark-textMuted mb-6 max-w-xs">
          Upload an image to start applying effects
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-dark-surface border-b border-dark-border sticky top-0 z-10">
        {/* Effects Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-dark-text">EFFECTS</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className={`text-dark-textMuted hover:text-dark-text transition-colors p-1 rounded ${focusRingClass}`}
                aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                aria-pressed={viewMode === 'grid'}
              >
                {viewMode === 'grid' ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                )}
              </button>
              {activeEffect && (
                <button
                  onClick={() => {
                    onEffectChange?.(null);
                    announce('Effect cleared');
                  }}
                  className={`text-xs text-dark-textMuted hover:text-apple-red transition-colors px-2 py-1 rounded ${focusRingClass}`}
                  aria-label="Clear current effect"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Search Bar with keyboard shortcut hint */}
          <div className="relative">
            <label htmlFor="effect-search" className="sr-only">
              Search effects
            </label>
            <input
              id="effect-search"
              ref={searchInputRef}
              type="search"
              placeholder="SEARCH EFFECTS..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full px-4 py-2 text-xs bg-dark-bg border border-dark-border
                       text-dark-text placeholder-dark-textMuted ${focusRingClass}
                       font-mono tracking-wider uppercase`}
              aria-label="Search effects"
              aria-describedby="search-hint"
            />
            <kbd
              id="search-hint"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] text-dark-textMuted bg-dark-border px-1.5 py-0.5 font-mono"
              aria-label="Press Command K to focus search"
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Quick Access - Recent Effects */}
        {recentEffects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 mb-3 pb-3 border-b border-dark-border"
          >
            <h3 className="text-[10px] font-medium text-dark-textMuted uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {recentEffects.slice(0, 4).map(effectId => {
                const config = effectsConfig[effectId];
                if (!config) return null;

                return (
                  <motion.button
                    key={effectId}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onEffectChange?.(effectId);
                      // Store in recent
                      addToRecentEffects(effectId);
                    }}
                    onMouseEnter={e => handleEffectHover(effectId, e)}
                    onMouseLeave={handleEffectLeave}
                    onTouchStart={e => handleEffectTouchStart(effectId, e)}
                    onTouchEnd={handleEffectTouchEnd}
                    className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      activeEffect === effectId
                        ? 'bg-primary-accent text-white shadow-sm'
                        : 'bg-dark-bg text-dark-textMuted hover:bg-dark-surface'
                    }`}
                  >
                    {config.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Scrollable Effects Area */}
      <div ref={scrollContainerRef} className="flex-1 relative">
        {/* Search Results */}
        {searchQuery && searchResults ? (
          <div className="p-4">
            {searchResults.length === 0 ? (
              <p className="text-xs text-dark-textMuted text-center py-8">
                No effects found for "{searchQuery}"
              </p>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1'}>
                {searchResults.map(effectId => {
                  const effect = effectsConfig[effectId];
                  if (!effect) return null;

                  return (
                    <button
                      key={effectId}
                      onClick={() => handleEffectSelect(effectId)}
                      onMouseEnter={e => handleEffectHover(effectId, e)}
                      onMouseLeave={handleEffectLeave}
                      onTouchStart={e => handleEffectTouchStart(effectId, e)}
                      onTouchEnd={handleEffectTouchEnd}
                      className={`text-xs rounded-lg transition-all text-left ${
                        viewMode === 'grid'
                          ? 'px-3 py-2.5'
                          : 'w-full px-3 py-2 flex items-center justify-between'
                      } ${
                        activeEffect === effectId
                          ? 'bg-primary-accent text-white shadow-sm'
                          : 'bg-dark-bg hover:bg-dark-surface text-dark-textMuted hover:text-dark-text border border-dark-border'
                      }`}
                    >
                      <div className="font-medium truncate">{effect.label}</div>
                      {viewMode === 'list' && (
                        <div className="text-[10px] opacity-60">
                          {
                            Object.entries(effectCategories).find(([_, data]) =>
                              data.effects.includes(effectId)
                            )?.[0]
                          }
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Category Groups with Virtual Scrolling */
          <GroupedVirtualScroll
            groups={Object.entries(effectCategories).map(([category, data]) => ({
              label: category,
              items: expandedCategories.has(category) ? data.effects : [],
            }))}
            itemHeight={viewMode === 'grid' ? 40 : 32}
            groupHeaderHeight={40}
            containerHeight={containerHeight}
            renderGroupHeader={category => {
              const data = effectCategories[category];
              return (
                <button
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-xs transition-all hover:bg-dark-bg ${focusRingClass}`}
                  aria-expanded={expandedCategories.has(category)}
                  aria-controls={`category-${category.replace(/\s+/g, '-')}`}
                  aria-label={ARIA_LABELS.effectCategory(category)}
                >
                  <div className="flex items-center gap-4 w-full">
                    <svg
                      className={`w-3 h-3 transition-transform flex-shrink-0 ${expandedCategories.has(category) ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="font-medium text-dark-text flex-1 text-left">{category}</span>
                    <span className="text-[10px] text-dark-textMuted">{data.effects.length}</span>
                  </div>
                </button>
              );
            }}
            renderItem={effectId => {
              const effect = effectsConfig[effectId as string];
              if (!effect) return null;

              return (
                <div className={`px-3 ${viewMode === 'grid' ? 'w-1/2 float-left' : ''}`}>
                  <button
                    onClick={() => handleEffectSelect(effectId as string)}
                    onMouseEnter={e => handleEffectHover(effectId as string, e)}
                    onMouseLeave={handleEffectLeave}
                    onTouchStart={e => handleEffectTouchStart(effectId as string, e)}
                    onTouchEnd={handleEffectTouchEnd}
                    className={`text-xs rounded-md transition-all text-left ${focusRingClass} ${
                      viewMode === 'grid'
                        ? 'px-2.5 py-2 mb-1.5 mr-1.5'
                        : 'w-full px-2.5 py-1.5 flex items-center mb-0.5'
                    } ${
                      activeEffect === effectId
                        ? 'bg-primary-accent text-white'
                        : 'bg-dark-bg hover:bg-dark-surface text-dark-textMuted hover:text-dark-text'
                    }`}
                    aria-label={ARIA_LABELS.effectButton(effect.label)}
                    aria-pressed={activeEffect === effectId}
                  >
                    <span className="truncate">{effect.label}</span>
                  </button>
                </div>
              );
            }}
            className="p-4"
          />
        )}
      </div>

      {/* Sticky Effect Settings */}
      <AnimatePresence>
        {activeEffect && currentEffectSettings.length > 0 && (
          <motion.div
            key="effect-settings"
            ref={settingsRef}
            className="flex-shrink-0 border-t border-dark-border bg-dark-surface max-h-64 overflow-y-auto relative holographic-enter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-dark-text flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 mr-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                  {effectsConfig[activeEffect]?.label} Settings
                </h3>
                <button
                  onClick={() => {
                    // Reset all settings to default
                    currentEffectSettings.forEach(setting => {
                      onSettingChange?.(setting.id, setting.default);
                    });
                  }}
                  className="text-[10px] text-dark-textMuted hover:text-dark-text transition-colors"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-3">
                {currentEffectSettings.map(setting => (
                  <div key={setting.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-dark-text">
                        {setting.label}
                      </label>
                      <span className="text-[10px] text-dark-textMuted">
                        {setting.currentValue}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                      value={setting.currentValue}
                      onChange={e => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                      className="w-full h-1 bg-dark-border rounded-lg appearance-none cursor-pointer slider"
                      aria-label={setting.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effect Preview */}
      {hoveredEffect && currentImageId && (
        <EffectHoverPreview
          effectId={hoveredEffect}
          imageUrl={currentImageId}
          position={hoverPosition}
        />
      )}
    </div>
  );
};

export default ControlPanelV3;
