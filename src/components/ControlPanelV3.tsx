'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { effectsConfig, effectCategories } from '@/lib/effects';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface ControlPanelV3Props {
  activeEffect?: string | null;
  effectSettings?: Record<string, number>;
  onEffectChange?: (effectName: string | null) => void;
  onSettingChange?: (settingName: string, value: number) => void;
  hasImage?: boolean;
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Adjust']));
  const [recentEffects, setRecentEffects] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load recent effects on mount
  useEffect(() => {
    setRecentEffects(getRecentEffects());
  }, []);

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

  // Get settings for the active effect
  const currentEffectSettings = activeEffect && effectsConfig[activeEffect]?.settings
    ? Object.entries(effectsConfig[activeEffect].settings).map(([key, setting]) => ({
        id: key,
        ...(setting as any),
        currentValue: effectSettings[key] ?? (setting as any).default,
      }))
    : [];

  const handleEffectSelect = (effectId: string) => {
    onEffectChange?.(effectId);
    // Auto-scroll to settings if they exist
    if (effectsConfig[effectId]?.settings) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  if (!hasImage) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-dark-surface flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
    <div className="h-full flex flex-col">
      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-dark-surface border-b border-dark-border sticky top-0 z-10">
        {/* Effects Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-dark-text flex items-center">
              <span className="text-primary-accent mr-2">✨</span>
              Effects
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="text-dark-textMuted hover:text-dark-text transition-colors p-1"
                title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                {viewMode === 'grid' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
              </button>
              {activeEffect && (
                <button
                  onClick={() => onEffectChange?.(null)}
                  className="text-xs text-dark-textMuted hover:text-apple-red transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Search Bar with keyboard shortcut hint */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search effects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 pr-16 text-xs bg-dark-bg border border-dark-border rounded-md
                       text-dark-text placeholder-dark-textMuted focus:outline-none focus:ring-1 
                       focus:ring-primary-accent focus:border-primary-accent"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-2 text-dark-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <kbd className="absolute right-2 top-1.5 text-[10px] text-dark-textMuted bg-dark-border px-1.5 py-0.5 rounded">
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
            <h3 className="text-[10px] font-medium text-dark-textMuted uppercase tracking-wider mb-2">Recent</h3>
            <div className="flex flex-wrap gap-1.5">
              {recentEffects.slice(0, 4).map((effectId) => {
                const config = effectsConfig[effectId];
                if (!config) return null;
                
                return (
                  <motion.button
                    key={effectId}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEffectSelect(effectId)}
                    className={`px-2.5 py-1 text-[10px] rounded-md transition-all max-w-[45%] ${
                      activeEffect === effectId
                        ? 'bg-primary-accent text-white'
                        : 'bg-dark-surface hover:bg-dark-border text-dark-textMuted hover:text-dark-text'
                    }`}
                  >
                    <span className="truncate block">{config.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Scrollable Effects Area */}
      <div className="flex-1 overflow-y-auto">
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
                          {Object.entries(effectCategories).find(([_, data]) => 
                            data.effects.includes(effectId)
                          )?.[0]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Category Groups */
          <div className="p-4 space-y-1">
            {Object.entries(effectCategories).map(([category, data]) => (
              <div key={category} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center px-3 py-2 text-xs rounded-md transition-all hover:bg-dark-bg"
                >
                  <svg 
                    className={`w-3 h-3 mr-2 transition-transform flex-shrink-0 ${expandedCategories.has(category) ? 'rotate-90' : ''}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="mr-2 flex-shrink-0">{data.icon}</span>
                  <span className="font-medium text-dark-text flex-1 text-left truncate">{category}</span>
                  <span className="ml-2 text-[10px] text-dark-textMuted flex-shrink-0">
                    {data.effects.length}
                  </span>
                </button>
                
                {expandedCategories.has(category) && (
                  <div className={`mt-1 ${
                    viewMode === 'grid' 
                      ? 'grid grid-cols-2 gap-1.5 px-3 pb-2' 
                      : 'space-y-0.5 px-3 pb-2'
                  }`}>
                    {data.effects.map(effectId => {
                      const effect = effectsConfig[effectId];
                      if (!effect) return null;
                      
                      return (
                        <button
                          key={effectId}
                          onClick={() => handleEffectSelect(effectId)}
                          className={`text-xs rounded-md transition-all text-left ${
                            viewMode === 'grid'
                              ? 'px-2.5 py-2'
                              : 'w-full px-2.5 py-1.5 flex items-center'
                          } ${
                            activeEffect === effectId
                              ? 'bg-primary-accent text-white'
                              : 'bg-dark-bg hover:bg-dark-surface text-dark-textMuted hover:text-dark-text'
                          }`}
                        >
                          <span className="truncate">{effect.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Effect Settings */}
      {activeEffect && currentEffectSettings.length > 0 && (
        <div 
          ref={settingsRef}
          className="flex-shrink-0 border-t border-dark-border bg-dark-surface"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-dark-text flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
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
                <div key={setting.id}>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-dark-textMuted">{setting.label}</label>
                    <span className="text-xs text-dark-textMuted font-mono">
                      {setting.currentValue.toFixed(setting.step >= 0.1 ? 1 : 0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    value={setting.currentValue}
                    onChange={e => onSettingChange?.(setting.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-dark-border rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                             [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-accent 
                             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:scale-110
                             [&::-webkit-slider-thumb]:transition-transform"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanelV3; 