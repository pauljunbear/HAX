'use client';

import { useState, useCallback } from 'react';

export interface HistoryState {
  activeEffect: string | null;
  effectSettings: Record<string, number>;
}

const useHistory = (initialState: HistoryState) => {
  const [history, setHistory] = useState<HistoryState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Add a new state to history
  const addToHistory = useCallback((newState: HistoryState) => {
    // If we're not at the end of the history, truncate it
    if (currentIndex < history.length - 1) {
      setHistory(prev => prev.slice(0, currentIndex + 1));
    }
    
    // Don't add identical states
    const lastState = history[currentIndex];
    const isIdentical = 
      lastState.activeEffect === newState.activeEffect && 
      JSON.stringify(lastState.effectSettings) === JSON.stringify(newState.effectSettings);
    
    if (isIdentical) return;

    setHistory(prev => [...prev, newState]);
    setCurrentIndex(prev => prev + 1);
  }, [history, currentIndex]);

  // Go one step back in history
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return history[currentIndex];
  }, [history, currentIndex]);

  // Go one step forward in history
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return history[currentIndex];
  }, [history, currentIndex]);

  // Check if undo/redo operations are available
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  // Current state based on history index
  const currentState = history[currentIndex];

  // Clear history (used when loading a new image)
  const clearHistory = useCallback((newInitialState: HistoryState) => {
    setHistory([newInitialState]);
    setCurrentIndex(0);
  }, []);

  // Jump to a specific history state by index
  const jumpToState = useCallback((index: number) => {
    if (index >= 0 && index < history.length) {
      setCurrentIndex(index);
      return history[index];
    }
    return currentState;
  }, [history, currentState]);

  return { 
    currentState,
    history,
    currentIndex,
    addToHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    clearHistory,
    jumpToState
  };
};

export default useHistory; 