'use client';

import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'imhax-effect-favorites';
const RECENT_KEY = 'imhax-recent-effects';
const MAX_RECENT = 8;

interface UseEffectFavoritesReturn {
  favorites: Set<string>;
  recentlyUsed: string[];
  isFavorite: (effectId: string) => boolean;
  toggleFavorite: (effectId: string) => void;
  addToRecent: (effectId: string) => void;
  clearRecent: () => void;
  clearFavorites: () => void;
}

export function useEffectFavorites(): UseEffectFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedFavorites = localStorage.getItem(FAVORITES_KEY);
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites);
        setFavorites(new Set(parsed));
      }

      const storedRecent = localStorage.getItem(RECENT_KEY);
      if (storedRecent) {
        const parsed = JSON.parse(storedRecent);
        setRecentlyUsed(parsed);
      }
    } catch (e) {
      console.warn('Failed to load effect favorites from localStorage:', e);
    }

    setIsInitialized(true);
  }, []);

  // Save favorites to localStorage when changed
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch (e) {
      console.warn('Failed to save favorites to localStorage:', e);
    }
  }, [favorites, isInitialized]);

  // Save recently used to localStorage when changed
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyUsed));
    } catch (e) {
      console.warn('Failed to save recent effects to localStorage:', e);
    }
  }, [recentlyUsed, isInitialized]);

  const isFavorite = useCallback(
    (effectId: string) => {
      return favorites.has(effectId);
    },
    [favorites]
  );

  const toggleFavorite = useCallback((effectId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(effectId)) {
        newFavorites.delete(effectId);
      } else {
        newFavorites.add(effectId);
      }
      return newFavorites;
    });
  }, []);

  const addToRecent = useCallback((effectId: string) => {
    setRecentlyUsed(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(id => id !== effectId);
      const newRecent = [effectId, ...filtered].slice(0, MAX_RECENT);
      return newRecent;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentlyUsed([]);
  }, []);

  const clearFavorites = useCallback(() => {
    setFavorites(new Set());
  }, []);

  return {
    favorites,
    recentlyUsed,
    isFavorite,
    toggleFavorite,
    addToRecent,
    clearRecent,
    clearFavorites,
  };
}
