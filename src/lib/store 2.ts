'use client';

import { create } from 'zustand';

// Define the store interface
interface AppState {
  // Image state
  selectedImage: string | null;
  setSelectedImage: (image: string | null) => void;
  
  // Effect state
  activeEffect: string | null;
  setActiveEffect: (effect: string | null) => void;
  
  // Effect settings
  effectSettings: Record<string, number>;
  setEffectSettings: (settings: Record<string, number>) => void;
  updateEffectSetting: (key: string, value: number) => void;
  
  // History state
  history: string[];
  addToHistory: (imageData: string) => void;
  
  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

// Create the store
export const useAppStore = create<AppState>()((set) => ({
  // Image state
  selectedImage: null,
  setSelectedImage: (image) => set({ selectedImage: image }),
  
  // Effect state
  activeEffect: null,
  setActiveEffect: (effect) => set({ activeEffect: effect }),
  
  // Effect settings
  effectSettings: {},
  setEffectSettings: (settings) => set({ effectSettings: settings }),
  updateEffectSetting: (key, value) => 
    set((state) => ({
      effectSettings: {
        ...state.effectSettings,
        [key]: value,
      },
    })),
  
  // History state
  history: [],
  addToHistory: (imageData) =>
    set((state) => ({
      history: [...state.history, imageData],
    })),
  
  // UI state
  sidebarOpen: true,
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
})); 