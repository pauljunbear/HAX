'use client';

import React from 'react';
import { SelectionType } from './SelectionTool';

interface SelectionToolbarProps {
  selectionType: SelectionType;
  setSelectionType: (type: SelectionType) => void;
  canClearSelections: boolean;
  onClearSelections: () => void;
  onApplyToSelection: () => void;
  onApplyOutsideSelection: () => void;
  hasActiveSelection: boolean;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectionType,
  setSelectionType,
  canClearSelections,
  onClearSelections,
  onApplyToSelection,
  onApplyOutsideSelection,
  hasActiveSelection
}) => {
  return (
    <div className="p-4 border-t border-[rgb(var(--apple-gray-200))]">
      <h3 className="text-sm font-medium text-[rgb(var(--apple-gray-700))] mb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
        Selection Tools
      </h3>
      
      {/* Selection type buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setSelectionType('rectangle')}
          className={`p-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center ${
            selectionType === 'rectangle'
              ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
              : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="0" strokeWidth={2} />
          </svg>
          Rectangle
        </button>
        <button
          onClick={() => setSelectionType('ellipse')}
          className={`p-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center ${
            selectionType === 'ellipse'
              ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
              : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
          Ellipse
        </button>
        <button
          onClick={() => setSelectionType('freehand')}
          className={`p-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center ${
            selectionType === 'freehand'
              ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
              : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Freehand
        </button>
      </div>
      
      {/* Clear selection button */}
      <button
        onClick={() => setSelectionType(null)}
        className={`w-full mb-3 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
          selectionType === null
            ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
            : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
        }`}
      >
        <div className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          Select Mode: {selectionType ? 'On' : 'Off'}
        </div>
      </button>
      
      {/* Clear all selections button */}
      <button
        onClick={onClearSelections}
        disabled={!canClearSelections}
        className={`w-full mb-4 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
          canClearSelections
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            : 'bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-400))] cursor-not-allowed'
        }`}
      >
        <div className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All Selections
        </div>
      </button>
      
      {/* Apply to selection */}
      <div className="space-y-2">
        <button
          onClick={onApplyToSelection}
          disabled={!hasActiveSelection}
          className={`w-full py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
            hasActiveSelection
              ? 'bg-[rgb(var(--primary))] text-white hover:bg-[rgb(var(--primary-600))]'
              : 'bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-400))] cursor-not-allowed'
          }`}
        >
          Apply Effect Inside Selection
        </button>
        
        <button
          onClick={onApplyOutsideSelection}
          disabled={!hasActiveSelection}
          className={`w-full py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
            hasActiveSelection
              ? 'bg-[rgb(var(--apple-gray-700))] text-white hover:bg-[rgb(var(--apple-gray-800))]'
              : 'bg-[rgb(var(--apple-gray-100))] text-[rgb(var(--apple-gray-400))] cursor-not-allowed'
          }`}
        >
          Apply Effect Outside Selection
        </button>
      </div>
      
      <div className="mt-3 text-xs text-[rgb(var(--apple-gray-500))] bg-[rgb(var(--apple-gray-50))] p-2 rounded">
        <p className="mb-1">Tips:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Use Delete key to remove a selected region</li>
          <li>Use Escape key to deselect</li>
          <li>Click and drag to create a selection</li>
        </ul>
      </div>
    </div>
  );
};

export default SelectionToolbar; 