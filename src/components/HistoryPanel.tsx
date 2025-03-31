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
    <div className="p-6 border-b border-[rgb(var(--apple-gray-100))]">
      <h3 className="text-sm font-medium text-[rgb(var(--apple-gray-700))] mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
      </h3>
      
      {/* Undo/Redo buttons */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            canUndo
              ? 'bg-[rgb(var(--apple-gray-200))] text-[rgb(var(--apple-gray-700))] hover:bg-[rgb(var(--apple-gray-300))]'
              : 'bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-400))] cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Undo
          </div>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            canRedo
              ? 'bg-[rgb(var(--apple-gray-200))] text-[rgb(var(--apple-gray-700))] hover:bg-[rgb(var(--apple-gray-300))]'
              : 'bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-400))] cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Redo
          </div>
        </button>
      </div>
      
      {/* History list */}
      <div className="mt-3 border border-[rgb(var(--apple-gray-200))] rounded-lg overflow-hidden">
        {displayedHistory.length === 0 ? (
          <div className="p-4 text-sm text-[rgb(var(--apple-gray-500))] text-center">
            No edit history yet
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {displayedHistory.map((state, index) => {
              const historyIndex = startIndex + index;
              return (
                <li 
                  key={historyIndex}
                  onClick={() => onJumpToState(historyIndex)}
                  className={`
                    px-3 py-2 text-sm border-b border-[rgb(var(--apple-gray-200))] last:border-b-0
                    cursor-pointer transition-colors
                    ${historyIndex === currentIndex 
                      ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))]' 
                      : 'text-[rgb(var(--apple-gray-700))] hover:bg-[rgb(var(--apple-gray-50))]'
                    }
                  `}
                >
                  <div className="flex items-center">
                    {historyIndex === currentIndex && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className={historyIndex === currentIndex ? 'font-medium' : ''}>
                      {formatHistoryEntry(state)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      {history.length > displayLimit && (
        <div className="mt-2 text-xs text-[rgb(var(--apple-gray-500))] text-center">
          {history.length - displayedHistory.length} more items in history
        </div>
      )}
    </div>
  );
};

export default HistoryPanel; 