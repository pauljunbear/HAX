'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layer, Rect, Ellipse, Line, Transformer } from 'react-konva';
import Konva from 'konva';
import { magicWandSelect, getMaskOutline } from '@/lib/imageProcessing/magicWand';

export type SelectionType = 'rectangle' | 'ellipse' | 'freehand' | 'magicWand' | 'brushMask' | null;
export type SelectionData = {
  type: SelectionType;
  points?: number[];  // For freehand
  x?: number;         // For rectangle, ellipse
  y?: number;         // For rectangle, ellipse
  width?: number;     // For rectangle, ellipse
  height?: number;    // For rectangle, ellipse
  id: string;
  mask?: Uint8ClampedArray; // For magic wand selections
  maskWidth?: number;
  maskHeight?: number;
};

export interface MaskData {
  mask: Uint8ClampedArray;
  width: number;
  height: number;
}

interface SelectionToolProps {
  stageWidth: number;
  stageHeight: number;
  selectionType: SelectionType;
  onSelectionComplete: (selection: SelectionData | null) => void;
  existingSelections: SelectionData[];
  onSelectExisting: (id: string | null) => void;
  selectedId: string | null;
  onDeleteSelection: (id: string) => void;
  isActive: boolean;
  // Magic wand props
  tolerance?: number;
  contiguous?: boolean;
  getImageData?: () => ImageData | null;
  imageOffset?: { x: number; y: number };
  imageScale?: number;
  // Brush mask props
  brushSize?: number;
  brushMode?: 'add' | 'subtract';
  onMaskUpdate?: (mask: MaskData | null) => void;
  currentMask?: MaskData | null;
}

const SelectionTool: React.FC<SelectionToolProps> = ({
  selectionType,
  onSelectionComplete,
  existingSelections,
  onSelectExisting,
  selectedId,
  onDeleteSelection,
  isActive,
  // Magic wand props
  tolerance = 32,
  contiguous = true,
  getImageData,
  imageOffset = { x: 0, y: 0 },
  imageScale = 1,
  // Brush mask props
  brushSize = 20,
  brushMode = 'add',
  onMaskUpdate,
  currentMask,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<Partial<SelectionData> | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const [magicWandOutlines, setMagicWandOutlines] = useState<number[][]>([]);
  const [brushPoints, setBrushPoints] = useState<number[]>([]);
  const layerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  
  // Handle key events for deleting selections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        onDeleteSelection(selectedId);
      } else if (e.key === 'Escape') {
        onSelectExisting(null);
      }
    };
    
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, onDeleteSelection, onSelectExisting, isActive]);
  
  // Update transformer on selection change
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      // Find the corresponding node
      const node = layerRef.current?.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, existingSelections]);

  // Handle magic wand click
  const handleMagicWandClick = useCallback((stageX: number, stageY: number) => {
    if (!getImageData) return;
    
    const imageData = getImageData();
    if (!imageData) return;

    // Convert stage coordinates to image coordinates
    const imageX = Math.floor((stageX - imageOffset.x) / imageScale);
    const imageY = Math.floor((stageY - imageOffset.y) / imageScale);

    // Check if click is within image bounds
    if (imageX < 0 || imageX >= imageData.width || imageY < 0 || imageY >= imageData.height) {
      return;
    }

    // Perform magic wand selection
    const result = magicWandSelect(imageData, imageX, imageY, tolerance, contiguous);
    
    // Get outline for visualization
    const outlines = getMaskOutline(result.mask, result.width, result.height);
    
    // Convert outline coordinates back to stage coordinates
    const scaledOutlines = outlines.map(outline => {
      const scaled: number[] = [];
      for (let i = 0; i < outline.length; i += 2) {
        scaled.push(outline[i] * imageScale + imageOffset.x);
        scaled.push(outline[i + 1] * imageScale + imageOffset.y);
      }
      return scaled;
    });
    
    setMagicWandOutlines(scaledOutlines);

    // Create selection data with mask
    const id = `selection-${Date.now()}`;
    const selectionData: SelectionData = {
      type: 'magicWand',
      id,
      mask: result.mask,
      maskWidth: result.width,
      maskHeight: result.height,
      x: result.bounds.minX * imageScale + imageOffset.x,
      y: result.bounds.minY * imageScale + imageOffset.y,
      width: (result.bounds.maxX - result.bounds.minX + 1) * imageScale,
      height: (result.bounds.maxY - result.bounds.minY + 1) * imageScale,
    };

    onSelectionComplete(selectionData);
    
    // Also update the mask for export
    if (onMaskUpdate) {
      onMaskUpdate({
        mask: result.mask,
        width: result.width,
        height: result.height,
      });
    }
  }, [getImageData, imageOffset, imageScale, tolerance, contiguous, onSelectionComplete, onMaskUpdate]);

  // Handle brush mask stroke
  const handleBrushStroke = useCallback((x: number, y: number) => {
    if (!getImageData || !onMaskUpdate) return;

    const imageData = getImageData();
    if (!imageData) return;

    // Convert to image coordinates
    const imageX = Math.floor((x - imageOffset.x) / imageScale);
    const imageY = Math.floor((y - imageOffset.y) / imageScale);

    // Initialize or get current mask
    let mask = currentMask?.mask;
    if (!mask || currentMask?.width !== imageData.width || currentMask?.height !== imageData.height) {
      mask = new Uint8ClampedArray(imageData.width * imageData.height);
    } else {
      mask = new Uint8ClampedArray(mask);
    }

    // Calculate brush radius in image coordinates
    const brushRadiusImg = Math.max(1, Math.floor(brushSize / (2 * imageScale)));

    // Draw circle on mask
    for (let dy = -brushRadiusImg; dy <= brushRadiusImg; dy++) {
      for (let dx = -brushRadiusImg; dx <= brushRadiusImg; dx++) {
        const px = imageX + dx;
        const py = imageY + dy;
        
        if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= brushRadiusImg) {
            const idx = py * imageData.width + px;
            mask[idx] = brushMode === 'add' ? 255 : 0;
          }
        }
      }
    }

    onMaskUpdate({
      mask,
      width: imageData.width,
      height: imageData.height,
    });
  }, [getImageData, imageOffset, imageScale, brushSize, brushMode, currentMask, onMaskUpdate]);
  
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    // Get the transformed node
    const node = e.target;
    const id = node.id();
    
    // Find the selection in existing selections
    const selectionIndex = existingSelections.findIndex(s => s.id === id);
    if (selectionIndex >= 0) {
      const updatedSelection = { ...existingSelections[selectionIndex] };
      
      // Update properties based on transformation
      if (updatedSelection.type === 'rectangle' || updatedSelection.type === 'ellipse') {
        updatedSelection.x = node.x();
        updatedSelection.y = node.y();
        updatedSelection.width = node.width() * node.scaleX();
        updatedSelection.height = node.height() * node.scaleY();
      } else if (updatedSelection.type === 'freehand' && updatedSelection.points) {
        // Calculate scale and translation
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const x = node.x();
        const y = node.y();
        
        // We need to transform all points
        const transformedPoints = [];
        for (let i = 0; i < updatedSelection.points.length; i += 2) {
          transformedPoints.push(
            updatedSelection.points[i] * scaleX + x,
            updatedSelection.points[i + 1] * scaleY + y
          );
        }
        
        updatedSelection.points = transformedPoints;
      }
      
      // Reset scale and update the selection
      node.scaleX(1);
      node.scaleY(1);
      
      // Update the selection
      const updatedSelections = [...existingSelections];
      updatedSelections[selectionIndex] = updatedSelection;
      onSelectionComplete(updatedSelection);
    }
  };
  
  return (
    <Layer ref={layerRef}>
      {/* Draw existing selections */}
      {existingSelections.map((sel) => {
        if (sel.type === 'rectangle') {
          return (
            <Rect
              key={sel.id}
              id={sel.id}
              x={sel.x}
              y={sel.y}
              width={sel.width}
              height={sel.height}
              stroke={selectedId === sel.id ? '#0096FF' : '#00FF00'}
              strokeWidth={2}
              dash={[5, 5]}
              draggable={selectedId === sel.id}
              onClick={() => onSelectExisting(sel.id)}
              onTap={() => onSelectExisting(sel.id)}
              onTransformEnd={handleTransformEnd}
            />
          );
        } else if (sel.type === 'ellipse') {
          return (
            <Ellipse
              key={sel.id}
              id={sel.id}
              x={(sel.x || 0) + (sel.width || 0) / 2}
              y={(sel.y || 0) + (sel.height || 0) / 2}
              radiusX={(sel.width || 0) / 2}
              radiusY={(sel.height || 0) / 2}
              stroke={selectedId === sel.id ? '#0096FF' : '#00FF00'}
              strokeWidth={2}
              dash={[5, 5]}
              draggable={selectedId === sel.id}
              onClick={() => onSelectExisting(sel.id)}
              onTap={() => onSelectExisting(sel.id)}
              onTransformEnd={handleTransformEnd}
            />
          );
        } else if (sel.type === 'freehand') {
          return (
            <Line
              key={sel.id}
              id={sel.id}
              points={sel.points}
              stroke={selectedId === sel.id ? '#0096FF' : '#00FF00'}
              strokeWidth={2}
              closed={true}
              fill="rgba(0, 255, 0, 0.1)"
              draggable={selectedId === sel.id}
              onClick={() => onSelectExisting(sel.id)}
              onTap={() => onSelectExisting(sel.id)}
              onTransformEnd={handleTransformEnd}
            />
          );
        }
        return null;
      })}
      
      {/* Draw current selection */}
      {isDrawing && selectionType === 'rectangle' && selection && (
        <Rect
          x={selection.x}
          y={selection.y}
          width={selection.width}
          height={selection.height}
          stroke="#00FFFF"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
      
      {isDrawing && selectionType === 'ellipse' && selection && (
        <Ellipse
          x={(selection.x || 0) + (selection.width || 0) / 2}
          y={(selection.y || 0) + (selection.height || 0) / 2}
          radiusX={Math.abs((selection.width || 0) / 2)}
          radiusY={Math.abs((selection.height || 0) / 2)}
          stroke="#00FFFF"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
      
      {isDrawing && selectionType === 'freehand' && points.length >= 4 && (
        <Line
          points={points}
          stroke="#00FFFF"
          strokeWidth={2}
          closed={false}
        />
      )}
      
      {/* Magic wand selection outlines */}
      {magicWandOutlines.map((outline, index) => (
        <Line
          key={`magicwand-outline-${index}`}
          points={outline}
          stroke="#00FFFF"
          strokeWidth={2}
          dash={[5, 5]}
          closed={true}
          listening={false}
        />
      ))}
      
      {/* Brush stroke preview */}
      {isDrawing && selectionType === 'brushMask' && brushPoints.length >= 2 && (
        <Line
          points={brushPoints}
          stroke={brushMode === 'add' ? '#00FF00' : '#FF0000'}
          strokeWidth={brushSize}
          lineCap="round"
          lineJoin="round"
          opacity={0.5}
          listening={false}
        />
      )}
      
      {/* Brush cursor indicator */}
      {selectionType === 'brushMask' && !isDrawing && (
        <Ellipse
          x={0}
          y={0}
          radiusX={brushSize / 2}
          radiusY={brushSize / 2}
          stroke={brushMode === 'add' ? '#00FF00' : '#FF0000'}
          strokeWidth={1}
          dash={[3, 3]}
          listening={false}
          visible={false}
        />
      )}
      
      {/* Transformer for selected shapes */}
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          // Limit resize to within stage
          if (newBox.width < 10 || newBox.height < 10) {
            return oldBox;
          }
          return newBox;
        }}
        rotateEnabled={false}
      />
    </Layer>
  );
};

export default SelectionTool; 