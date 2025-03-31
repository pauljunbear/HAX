'use client';

import React from 'react';
import { HistoryState } from '@/hooks/useHistory';
import { effectsConfig } from '@/lib/effects';

interface HistoryPanelProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  history: HistoryState[];
  currentIndex: number;
  onJumpToState: (index: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  currentIndex,
  onJumpToState
}) => {
  // Display only a limited number of history items for performance
  const displayLimit = 10;
  
  // Calculate start and end indices for displaying history items
  const startIndex = Math.max(0, currentIndex - displayLimit + 1);
  const endIndex = Math.min(history.length - 1, currentIndex + displayLimit);
  
  // Get the history items to display
  const displayedHistory = history.slice(
    Math.max(0, startIndex),
    endIndex + 1
  );

  // Format a history item for display
  const formatHistoryEntry = (state: HistoryState): string => {
    if (!state.activeEffect) return 'Original Image';
    
    const effectName = effectsConfig[state.activeEffect]?.label || state.activeEffect;
    
    // For simple effects with no settings, just return the effect name
    if (Object.keys(state.effectSettings).length === 0) {
      return effectName;
    }
    
    // For effects with settings, show the first setting value
    const firstSetting = Object.entries(state.effectSettings)[0];
    if (firstSetting) {
      const [key, value] = firstSetting;
      const setting = effectsConfig[state.activeEffect]?.settings?.[key];
      if (setting) {
        return `${effectName} (${setting.label}: ${value.toFixed(1)})`;
      }
    }
    
    return effectName;
  };

  return (
    <div className="border-t border-[rgb(var(--apple-gray-200))] bg-white/80">
      <div className="p-6 border-b border-[rgb(var(--apple-gray-100))]">
        <h2 className="text-lg font-medium text-[rgb(var(--apple-gray-800))] mb-6 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </h2>
        
        <div className="flex items-center space-x-3 mb-4">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`btn-apple-secondary flex-1 py-2 ${!canUndo && 'opacity-50 cursor-not-allowed'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`btn-apple-secondary flex-1 py-2 ${!canRedo && 'opacity-50 cursor-not-allowed'}`}
          >
            Redo
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-4">
        {history.length === 0 ? (
          <div className="text-center text-[rgb(var(--apple-gray-400))] py-4">
            <p className="text-sm">No history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((state, index) => (
              <button
                key={index}
                onClick={() => onJumpToState(index)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  index === currentIndex
                    ? 'bg-[rgb(var(--primary))] text-white'
                    : 'bg-white hover:bg-[rgb(var(--apple-gray-50))] text-[rgb(var(--apple-gray-700))] border border-[rgb(var(--apple-gray-200))]'
                }`}
              >
                <div className="font-medium">{state.activeEffect || 'No Effect'}</div>
                {state.activeEffect && Object.keys(state.effectSettings).length > 0 && (
                  <div className="text-xs mt-1 opacity-80">
                    {Object.entries(state.effectSettings).map(([key, value]) => (
                      <span key={key} className="mr-2">
                        {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel; 