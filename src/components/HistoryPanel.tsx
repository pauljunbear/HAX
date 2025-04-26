'use client';

import React, { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-apple-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80">
      <div className="py-2 px-4 border-b border-apple-gray-100 dark:border-dark-border">
        <div 
          className="flex items-center justify-between cursor-pointer" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h2 className="text-sm font-medium text-apple-gray-800 dark:text-dark-text flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-primary dark:text-primary-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </h2>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 text-apple-gray-500 dark:text-dark-textMuted transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Always visible undo/redo controls */}
        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`btn-apple-secondary dark:bg-dark-surface dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-border flex-1 py-1 text-xs ${!canUndo && 'opacity-50 cursor-not-allowed'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`btn-apple-secondary dark:bg-dark-surface dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-border flex-1 py-1 text-xs ${!canRedo && 'opacity-50 cursor-not-allowed'}`}
          >
            Redo
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible history list */}
      {isExpanded && (
        <div className="max-h-40 overflow-y-auto p-2">
          {history.length === 0 ? (
            <div className="text-center text-apple-gray-400 dark:text-dark-textMuted py-2">
              <p className="text-xs">No history yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((state, index) => (
                <button
                  key={index}
                  onClick={() => onJumpToState(index)}
                  className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${
                    index === currentIndex
                      ? 'bg-primary dark:bg-primary-accent text-white'
                      : 'bg-white dark:bg-dark-surface hover:bg-apple-gray-50 dark:hover:bg-dark-border text-apple-gray-700 dark:text-dark-text border border-apple-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="font-medium truncate">{state.activeEffect ? (effectsConfig[state.activeEffect]?.label || state.activeEffect) : 'Initial State'}</div>
                  {state.activeEffect && Object.keys(state.effectSettings).length > 0 && (
                    <div className="text-[10px] mt-0.5 opacity-80 dark:opacity-70 truncate">
                      {Object.entries(state.effectSettings).map(([key, value]) => {
                        const settingLabel = effectsConfig[state.activeEffect!]?.settings?.[key]?.label || key;
                        return (
                          <span key={key} className="mr-1.5">
                            {settingLabel}: {typeof value === 'number' ? value.toFixed(1) : value}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel; 