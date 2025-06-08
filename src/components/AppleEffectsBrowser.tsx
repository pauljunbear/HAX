'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectCategories, effectsConfig } from '@/lib/effects';

interface AppleEffectsBrowserProps {
  activeEffect?: string | null;
  onEffectChange?: (effectName: string | null) => void;
  hasImage?: boolean;
}

const AppleEffectsBrowser: React.FC<AppleEffectsBrowserProps> = ({
  activeEffect,
  onEffectChange,
  hasImage = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Search functionality
  const filteredEffects = useMemo(() => {
    if (!searchQuery && !selectedCategory) {
      return Object.entries(effectCategories).map(([category, data]) => ({
        category,
        effects: data.effects.slice(0, 6) // Show first 6 effects per category
      }));
    }

    if (searchQuery) {
      const results: { category: string; effects: string[] }[] = [];
      const query = searchQuery.toLowerCase();
      
      Object.entries(effectCategories).forEach(([category, data]) => {
        const matchingEffects = data.effects.filter(effectId => {
          const effect = effectsConfig[effectId];
          return effect?.label.toLowerCase().includes(query) ||
                 category.toLowerCase().includes(query);
        });
        
        if (matchingEffects.length > 0) {
          results.push({ category, effects: matchingEffects });
        }
      });
      
      return results;
    }

    if (selectedCategory) {
      const categoryData = effectCategories[selectedCategory];
      return categoryData ? [{ category: selectedCategory, effects: categoryData.effects }] : [];
    }

    return [];
  }, [searchQuery, selectedCategory]);

  const toggleFavorite = (effectId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(effectId)) {
      newFavorites.delete(effectId);
    } else {
      newFavorites.add(effectId);
    }
    setFavorites(newFavorites);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Effects
        </h2>
        
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search effects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              !selectedCategory 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('favorites')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedCategory === 'favorites'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            ⭐ Favorites
          </button>
          {Object.keys(effectCategories).slice(0, 3).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedCategory === category
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasImage ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Upload an Image
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select an image to start applying effects
            </p>
          </div>
        ) : selectedCategory === 'favorites' ? (
          <div className="p-6">
            {favorites.size === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-yellow-600 dark:text-yellow-400 text-lg">⭐</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No favorite effects yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(favorites).map(effectId => {
                  const effect = effectsConfig[effectId];
                  if (!effect) return null;
                  
                  return (
                    <EffectCard
                      key={effectId}
                      effectId={effectId}
                      effect={effect}
                      isActive={activeEffect === effectId}
                      isFavorite={true}
                      onSelect={() => onEffectChange?.(effectId)}
                      onToggleFavorite={() => toggleFavorite(effectId)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEffects.map(({ category, effects }) => (
              <div key={category} className="px-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                    {category}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {effects.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {effects.map(effectId => {
                    const effect = effectsConfig[effectId];
                    if (!effect) return null;
                    
                    return (
                      <EffectCard
                        key={effectId}
                        effectId={effectId}
                        effect={effect}
                        isActive={activeEffect === effectId}
                        isFavorite={favorites.has(effectId)}
                        onSelect={() => onEffectChange?.(effectId)}
                        onToggleFavorite={() => toggleFavorite(effectId)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EffectCardProps {
  effectId: string;
  effect: any;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const EffectCard: React.FC<EffectCardProps> = ({
  effectId,
  effect,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all border ${
        isActive 
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-500' 
          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-transparent'
      }`}
      onClick={onSelect}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {effect.label}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {effect.category}
            </p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              isFavorite 
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' 
                : 'text-gray-400 hover:text-yellow-500 opacity-0 group-hover:opacity-100'
            }`}
          >
            <svg className="w-3 h-3" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>
      
      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full"></div>
        </div>
      )}
    </motion.div>
  );
};

const categoryIcons: Record<string, string> = {
  'Color': '🎨',
  'Artistic': '🖼️',
  'Distortion': '🌀',
  'Mathematical': '📐',
  'Filters': '🔍',
  'Generative': '✨',
  'Overlay': '📱'
};

export default AppleEffectsBrowser; 