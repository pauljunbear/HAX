'use client';

import React, { useState } from 'react';
import { SelectionType, MaskData } from './SelectionTool';

interface SelectionToolbarProps {
  selectionType: SelectionType;
  setSelectionType: (type: SelectionType) => void;
  canClearSelections: boolean;
  onClearSelections: () => void;
  onApplyToSelection: () => void;
  onApplyOutsideSelection: () => void;
  hasActiveSelection: boolean;
  // Magic wand props
  tolerance?: number;
  onToleranceChange?: (value: number) => void;
  contiguous?: boolean;
  onContiguousChange?: (value: boolean) => void;
  // Brush mask props
  brushSize?: number;
  onBrushSizeChange?: (value: number) => void;
  brushMode?: 'add' | 'subtract';
  onBrushModeChange?: (mode: 'add' | 'subtract') => void;
  // Mask/Export props
  currentMask?: MaskData | null;
  onClearMask?: () => void;
  onInvertMask?: () => void;
  onExportSVG?: (type: 'traced' | 'embedded') => void;
  onRemoveBackground?: () => void;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectionType,
  setSelectionType,
  canClearSelections,
  onClearSelections,
  onApplyToSelection,
  onApplyOutsideSelection,
  hasActiveSelection,
  // Magic wand props
  tolerance = 32,
  onToleranceChange,
  contiguous = true,
  onContiguousChange,
  // Brush mask props
  brushSize = 20,
  onBrushSizeChange,
  brushMode = 'add',
  onBrushModeChange,
  // Mask/Export props
  currentMask,
  onClearMask,
  onInvertMask,
  onExportSVG,
  onRemoveBackground,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const hasMask = currentMask && currentMask.mask.some(v => v > 0);
  
  return (
    <div className="p-4 border-t border-[rgb(var(--apple-gray-200))]">
      <h3 className="text-sm font-medium text-[rgb(var(--apple-gray-700))] mb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
        Selection Tools
      </h3>
      
      {/* Selection type buttons - Row 1: Shape tools */}
      <div className="grid grid-cols-3 gap-2 mb-2">
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
      
      {/* Row 2: Magic Wand and Brush tools */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setSelectionType('magicWand')}
          className={`p-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center ${
            selectionType === 'magicWand'
              ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
              : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Magic Wand
        </button>
        <button
          onClick={() => setSelectionType('brushMask')}
          className={`p-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center ${
            selectionType === 'brushMask'
              ? 'bg-[rgb(var(--primary-50))] text-[rgb(var(--primary))] border border-[rgb(var(--primary-200))]'
              : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Brush Mask
        </button>
      </div>
      
      {/* Magic Wand Settings */}
      {selectionType === 'magicWand' && (
        <div className="mb-4 p-3 bg-[rgb(var(--apple-gray-50))] rounded-lg">
          <label className="block text-xs font-medium text-[rgb(var(--apple-gray-600))] mb-2">
            Tolerance: {tolerance}
          </label>
          <input
            type="range"
            min="0"
            max="255"
            value={tolerance}
            onChange={(e) => onToleranceChange?.(parseInt(e.target.value))}
            className="w-full h-2 bg-[rgb(var(--apple-gray-200))] rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex items-center mt-2">
            <input
              type="checkbox"
              id="contiguous"
              checked={contiguous}
              onChange={(e) => onContiguousChange?.(e.target.checked)}
              className="w-4 h-4 text-[rgb(var(--primary))] rounded border-[rgb(var(--apple-gray-300))]"
            />
            <label htmlFor="contiguous" className="ml-2 text-xs text-[rgb(var(--apple-gray-600))]">
              Contiguous (connected pixels only)
            </label>
          </div>
        </div>
      )}
      
      {/* Brush Mask Settings */}
      {selectionType === 'brushMask' && (
        <div className="mb-4 p-3 bg-[rgb(var(--apple-gray-50))] rounded-lg">
          <label className="block text-xs font-medium text-[rgb(var(--apple-gray-600))] mb-2">
            Brush Size: {brushSize}px
          </label>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => onBrushSizeChange?.(parseInt(e.target.value))}
            className="w-full h-2 bg-[rgb(var(--apple-gray-200))] rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onBrushModeChange?.('add')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                brushMode === 'add'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
              }`}
            >
              + Add
            </button>
            <button
              onClick={() => onBrushModeChange?.('subtract')}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                brushMode === 'subtract'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))]'
              }`}
            >
              − Subtract
            </button>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--apple-gray-500))]">
            Tip: Hold Alt to temporarily switch to subtract mode
          </p>
        </div>
      )}
      
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
      
      {/* Mask Operations - only show when mask exists */}
      {hasMask && (
        <div className="mt-4 pt-4 border-t border-[rgb(var(--apple-gray-200))]">
          <h4 className="text-xs font-medium text-[rgb(var(--apple-gray-700))] mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Mask Operations
          </h4>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={onInvertMask}
              className="py-1.5 px-2 text-xs font-medium rounded-md bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))] transition-colors"
            >
              Invert Mask
            </button>
            <button
              onClick={onClearMask}
              className="py-1.5 px-2 text-xs font-medium rounded-md bg-white border border-[rgb(var(--apple-gray-200))] hover:bg-[rgb(var(--apple-gray-50))] transition-colors"
            >
              Clear Mask
            </button>
          </div>
          
          <button
            onClick={onRemoveBackground}
            className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors mb-3"
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove Background
            </div>
          </button>
        </div>
      )}
      
      {/* SVG Export Section */}
      {hasMask && (
        <div className="mt-4 pt-4 border-t border-[rgb(var(--apple-gray-200))]">
          <h4 className="text-xs font-medium text-[rgb(var(--apple-gray-700))] mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-[rgb(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export as SVG
          </h4>
          
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-colors flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Selection as SVG
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-[rgb(var(--apple-gray-200))] overflow-hidden z-10">
                <button
                  onClick={() => {
                    onExportSVG?.('traced');
                    setShowExportMenu(false);
                  }}
                  className="w-full py-2.5 px-3 text-xs text-left hover:bg-[rgb(var(--apple-gray-50))] transition-colors border-b border-[rgb(var(--apple-gray-100))]"
                >
                  <div className="font-medium text-[rgb(var(--apple-gray-800))]">Traced SVG (Vector)</div>
                  <div className="text-[rgb(var(--apple-gray-500))] mt-0.5">Best for simple illustrations & icons</div>
                </button>
                <button
                  onClick={() => {
                    onExportSVG?.('embedded');
                    setShowExportMenu(false);
                  }}
                  className="w-full py-2.5 px-3 text-xs text-left hover:bg-[rgb(var(--apple-gray-50))] transition-colors"
                >
                  <div className="font-medium text-[rgb(var(--apple-gray-800))]">Embedded PNG in SVG</div>
                  <div className="text-[rgb(var(--apple-gray-500))] mt-0.5">Preserves full detail, works in Figma</div>
                </button>
              </div>
            )}
          </div>
          
          <p className="mt-2 text-xs text-[rgb(var(--apple-gray-500))]">
            Tip: SVG will be copied to clipboard for easy pasting into Figma
          </p>
        </div>
      )}
      
      <div className="mt-3 text-xs text-[rgb(var(--apple-gray-500))] bg-[rgb(var(--apple-gray-50))] p-2 rounded">
        <p className="mb-1">Tips:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Use Delete key to remove a selected region</li>
          <li>Use Escape key to deselect</li>
          <li>Click and drag to create a selection</li>
          <li>Magic Wand: Click to select similar colors</li>
          <li>Brush: Paint to create custom mask</li>
        </ul>
      </div>
    </div>
  );
};

export default SelectionToolbar; 