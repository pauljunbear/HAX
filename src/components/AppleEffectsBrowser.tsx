'use client';

import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { effectsConfig, effectCategories, hiddenLegacyEffects } from '@/lib/effects';
import { ChevronRight, Plus, Search, Star, Clock, Check } from 'lucide-react';
import { useEffectFavorites } from '@/hooks/useEffectFavorites';
import { getEffectPreviewCache } from '@/lib/performance/EffectPreviewCache';

interface AppleEffectsBrowserProps {
  activeEffect?: string | null;
  /** Set of effectIds currently applied as layers — drives the "ON" tile state. */
  appliedEffectIds?: Set<string>;
  onEffectChange?: (effectName: string | null) => void;
  hasImage?: boolean;
  imageUrl?: string | null;
  onNewImage?: () => void;
  onHidePanel?: () => void;
}

// Gradient colors for effect buttons - cached outside component
const EFFECT_GRADIENTS = [
  { from: 'from-blue-400', to: 'to-blue-600' },
  { from: 'from-purple-400', to: 'to-purple-600' },
  { from: 'from-pink-400', to: 'to-pink-600' },
  { from: 'from-emerald-400', to: 'to-emerald-600' },
  { from: 'from-orange-400', to: 'to-orange-600' },
  { from: 'from-cyan-400', to: 'to-cyan-600' },
  { from: 'from-indigo-400', to: 'to-indigo-600' },
  { from: 'from-rose-400', to: 'to-rose-600' },
  { from: 'from-violet-400', to: 'to-violet-600' },
  { from: 'from-amber-400', to: 'to-amber-600' },
  { from: 'from-teal-400', to: 'to-teal-600' },
  { from: 'from-lime-400', to: 'to-lime-600' },
];

// Cache for gradient lookups
const gradientCache = new Map<string, (typeof EFFECT_GRADIENTS)[0]>();

const getEffectGradient = (effectId: string) => {
  const cached = gradientCache.get(effectId);
  if (cached) return cached;

  const hash = effectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = EFFECT_GRADIENTS[hash % EFFECT_GRADIENTS.length];
  gradientCache.set(effectId, gradient);
  return gradient;
};

// Memoized effect button component - each button manages its own hover state
interface EffectButtonProps {
  effectId: string;
  label: string;
  isActive: boolean;
  hasImage: boolean;
  isCompact?: boolean;
  isFavorite: boolean;
  imageUrl?: string | null;
  onClick: (effectId: string) => void;
  onToggleFavorite: (effectId: string) => void;
}

// A live-preview tile: the user's photo rendered through this effect (lazy,
// IntersectionObserver-gated, cached). The "contact sheet" discovery move —
// browsing IS testing. Falls back to a colour shimmer while loading / no image.
const EffectButton = memo(function EffectButton({
  effectId,
  label,
  isActive,
  hasImage,
  isFavorite,
  imageUrl,
  onClick,
  onToggleFavorite,
}: EffectButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const gradient = useMemo(() => getEffectGradient(effectId), [effectId]);

  // Only render the preview once the tile scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '140px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Generate (or fetch cached) preview when visible + image present; reset on image change.
  useEffect(() => {
    let cancelled = false;
    setThumb(null);
    if (!visible || !hasImage || !imageUrl) return;
    getEffectPreviewCache()
      .generatePreview(imageUrl, effectId)
      .then(t => {
        if (!cancelled) setThumb(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, hasImage, imageUrl, effectId]);

  const handleClick = useCallback(() => onClick(effectId), [onClick, effectId]);
  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite(effectId);
    },
    [onToggleFavorite, effectId]
  );

  // Wrapper holds the tile button + the favorite button as SIBLINGS (never
  // nest interactive elements). The tile toggles the effect on re-click, so
  // aria-pressed reflects the applied state.
  return (
    <div
      ref={ref}
      className={`group relative w-full overflow-hidden rounded-lg
        ${isActive ? 'ring-2 ring-[#F53001]' : 'ring-1 ring-white/10'}
        ${!hasImage ? 'opacity-40' : ''}`}
      style={{ aspectRatio: '4 / 3', background: '#0c0c0e' }}
    >
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={!hasImage}
        aria-label={`${label}${isActive ? ' (applied)' : ''}`}
        aria-pressed={isActive}
        title={label}
        className={`absolute inset-0 h-full w-full text-left ${!hasImage ? 'cursor-not-allowed' : ''}`}
        whileHover={hasImage && !isActive ? { y: -1 } : {}}
        whileTap={hasImage ? { scale: 0.98 } : {}}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradient.from} ${gradient.to} opacity-50`}
          />
        )}

        <span
          className="absolute inset-x-0 bottom-0 truncate px-2 pb-1.5 pt-5 text-[11px] font-medium text-white"
          style={{ background: 'linear-gradient(180deg,transparent,rgba(0,0,0,.8))' }}
        >
          {label}
        </span>

        {isActive && (
          <span className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F53001]">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </span>
        )}
      </motion.button>

      <button
        type="button"
        onClick={handleFavoriteClick}
        aria-label={isFavorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
        aria-pressed={isFavorite}
        className={`absolute right-1 top-1 z-20 rounded p-0.5 transition-all hover:scale-110
          ${isFavorite ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-80'}`}
      >
        <Star
          className={`h-3.5 w-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/80'}`}
        />
      </button>
    </div>
  );
});

const AppleEffectsBrowser: React.FC<AppleEffectsBrowserProps> = ({
  appliedEffectIds,
  onEffectChange,
  hasImage = false,
  imageUrl,
  onNewImage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { favorites, recentlyUsed, isFavorite, toggleFavorite, addToRecent } = useEffectFavorites();

  // The contact sheet is the point: every category is OPEN by default so the
  // user lands on a wall of live previews of their own photo, not closed
  // accordions. Only the catch-all "More" bucket starts collapsed.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(['More'])
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

  const handleEffectClick = useCallback(
    (effectId: string) => {
      if (!hasImage) return;
      onEffectChange?.(effectId);
      addToRecent(effectId);
    },
    [hasImage, onEffectChange, addToRecent]
  );

  // Get favorite effects as array
  const favoriteEffects = useMemo(() => {
    return [...favorites]
      .filter(id => effectsConfig[id])
      .map(id => [id, effectsConfig[id]] as [string, (typeof effectsConfig)[string]]);
  }, [favorites]);

  // Get recently used effects as array
  const recentEffects = useMemo(() => {
    return recentlyUsed
      .filter(id => effectsConfig[id])
      .map(id => [id, effectsConfig[id]] as [string, (typeof effectsConfig)[string]]);
  }, [recentlyUsed]);

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

          {/* Favorites Section */}
          {hasImage && favoriteEffects.length > 0 && !searchTerm && (
            <div key="Favorites">
              <button
                onClick={() => toggleCategory('Favorites')}
                aria-expanded={!collapsedCategories.has('Favorites')}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 text-left
                  transition-all rounded-xl group relative overflow-hidden glass-effect-button
                  ${!collapsedCategories.has('Favorites') ? 'glass-active mb-1' : ''}
                `}
              >
                <div className="flex items-center gap-2 relative z-10">
                  <motion.div
                    animate={{ rotate: !collapsedCategories.has('Favorites') ? 90 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <h3 className="text-sm font-medium">Favorites</h3>
                  <span className="text-xs glass-badge px-2 py-0.5 rounded-full">
                    {favoriteEffects.length}
                  </span>
                </div>
              </button>

              <AnimatePresence mode="sync" initial={false}>
                {!collapsedCategories.has('Favorites') && (
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
                    <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                      {favoriteEffects.map(([effectId, effect]) => (
                        <EffectButton
                          key={effectId}
                          effectId={effectId}
                          label={effect.label}
                          isActive={appliedEffectIds?.has(effectId) ?? false}
                          hasImage={hasImage}
                          imageUrl={imageUrl}
                          isCompact={true}
                          isFavorite={true}
                          onClick={handleEffectClick}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Recently Used Section */}
          {hasImage && recentEffects.length > 0 && !searchTerm && (
            <div key="Recently Used">
              <button
                onClick={() => toggleCategory('Recently Used')}
                aria-expanded={!collapsedCategories.has('Recently Used')}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 text-left
                  transition-all rounded-xl group relative overflow-hidden glass-effect-button
                  ${!collapsedCategories.has('Recently Used') ? 'glass-active mb-1' : ''}
                `}
              >
                <div className="flex items-center gap-2 relative z-10">
                  <motion.div
                    animate={{ rotate: !collapsedCategories.has('Recently Used') ? 90 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                  <Clock className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-medium">Recently Used</h3>
                  <span className="text-xs glass-badge px-2 py-0.5 rounded-full">
                    {recentEffects.length}
                  </span>
                </div>
              </button>

              <AnimatePresence mode="sync" initial={false}>
                {!collapsedCategories.has('Recently Used') && (
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
                    <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                      {recentEffects.map(([effectId, effect]) => (
                        <EffectButton
                          key={effectId}
                          effectId={effectId}
                          label={effect.label}
                          isActive={appliedEffectIds?.has(effectId) ?? false}
                          hasImage={hasImage}
                          imageUrl={imageUrl}
                          isCompact={true}
                          isFavorite={isFavorite(effectId)}
                          onClick={handleEffectClick}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                    aria-expanded={isExpanded}
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
                  <AnimatePresence mode="sync" initial={false}>
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
                        <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                          {effects.map(([effectId, effect]) => (
                            <EffectButton
                              key={effectId}
                              effectId={effectId}
                              label={effect.label}
                              isActive={appliedEffectIds?.has(effectId) ?? false}
                              hasImage={hasImage}
                              imageUrl={imageUrl}
                              isCompact={effects.length > 8}
                              isFavorite={isFavorite(effectId)}
                              onClick={handleEffectClick}
                              onToggleFavorite={toggleFavorite}
                            />
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
