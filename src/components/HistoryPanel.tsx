'use client';

import React, { useState } from 'react';
import { HistoryState } from '@/hooks/useHistory';
import { effectsConfig } from '@/lib/effects';
import type { EffectConfig } from '@/lib/effects/types';

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
  onJumpToState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-dark-border bg-dark-surface">
      <div className="py-3 px-5 border-b border-dark-border">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h2 className="text-sm font-medium text-dark-text flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2 text-primary-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-dark-textMuted transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex items-center space-x-3 mt-3">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors 
                       bg-dark-surface text-dark-textMuted border border-dark-border hover:bg-dark-border hover:text-dark-text 
                       disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 mr-1 inline-block align-middle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors 
                       bg-dark-surface text-dark-textMuted border border-dark-border hover:bg-dark-border hover:text-dark-text 
                       disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Redo
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 ml-1 inline-block align-middle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-40 overflow-y-auto p-3 bg-dark-surface">
          {history.length === 0 ? (
            <div className="text-center text-dark-textMuted py-2">
              <p className="text-xs">No history yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((state, index) => (
                <button
                  key={index}
                  onClick={() => onJumpToState(index)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    index === currentIndex
                      ? 'bg-primary-accent/10 text-primary-accent'
                      : 'text-dark-textMuted hover:bg-dark-border hover:text-dark-text'
                  }`}
                >
                  <div
                    className={`font-medium truncate ${index === currentIndex ? 'text-primary-accent' : 'text-dark-text'}`}
                  >
                    {state.activeEffect
                      ? effectsConfig[state.activeEffect]?.label || state.activeEffect
                      : 'Initial State'}
                  </div>
                  {state.activeEffect && Object.keys(state.effectSettings).length > 0 && (
                    <div className="text-[10px] mt-0.5 opacity-70 truncate text-dark-textMuted">
                      {Object.entries(state.effectSettings).map(([key, value]) => {
                        const effectCfg = effectsConfig[state.activeEffect!] as
                          | EffectConfig
                          | undefined;
                        const setting = effectCfg?.settings?.find(s => s.id === key);
                        const settingLabel = setting?.label || key;
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
