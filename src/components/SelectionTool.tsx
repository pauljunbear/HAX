'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Transformer } from 'react-konva';

export type SelectionType = 'rectangle' | 'ellipse' | 'freehand' | null;
export type SelectionData = {
  type: SelectionType;
  points?: number[];  // For freehand
  x?: number;         // For rectangle, ellipse
  y?: number;         // For rectangle, ellipse
  width?: number;     // For rectangle, ellipse
  height?: number;    // For rectangle, ellipse
  id: string;
};

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
}

const SelectionTool: React.FC<SelectionToolProps> = ({
  stageWidth,
  stageHeight,
  selectionType,
  onSelectionComplete,
  existingSelections,
  onSelectExisting,
  selectedId,
  onDeleteSelection,
  isActive
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<Partial<SelectionData> | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const layerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  
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

  const handleMouseDown = (e: any) => {
    if (!isActive || !selectionType) return;
    
    // Clicked on stage
    const pos = e.target.getStage().getPointerPosition();
    
    // If we clicked on an existing selection, don't start drawing
    if (e.target !== e.target.getStage()) {
      return;
    }

    setIsDrawing(true);
    setStartPoint({ x: pos.x, y: pos.y });
    
    if (selectionType === 'freehand') {
      setPoints([pos.x, pos.y]);
    } else if (selectionType === 'rectangle' || selectionType === 'ellipse') {
      setSelection({
        type: selectionType,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0
      });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !isActive || !selectionType) return;
    
    const pos = e.target.getStage().getPointerPosition();
    
    if (selectionType === 'freehand') {
      setPoints([...points, pos.x, pos.y]);
    } else if (selectionType === 'rectangle' || selectionType === 'ellipse') {
      setSelection({
        ...selection,
        width: pos.x - startPoint.x,
        height: pos.y - startPoint.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !isActive || !selectionType) return;
    
    setIsDrawing(false);
    
    // Complete the selection
    if (selectionType === 'freehand' && points.length >= 4) {
      // Add a unique ID
      const id = `selection-${Date.now()}`;
      onSelectionComplete({ type: 'freehand', points, id });
      setPoints([]);
    } else if ((selectionType === 'rectangle' || selectionType === 'ellipse') && selection) {
      // Only create selection if it has a minimum size
      if (Math.abs(selection.width || 0) > 10 && Math.abs(selection.height || 0) > 10) {
        // Normalize negative width/height
        let x = selection.x || 0;
        let y = selection.y || 0;
        let width = selection.width || 0;
        let height = selection.height || 0;
        
        if (width < 0) {
          x += width;
          width = Math.abs(width);
        }
        
        if (height < 0) {
          y += height;
          height = Math.abs(height);
        }
        
        // Add a unique ID
        const id = `selection-${Date.now()}`;
        onSelectionComplete({ 
          type: selectionType, 
          x, 
          y, 
          width, 
          height, 
          id 
        });
      }
      
      setSelection(null);
    }
  };
  
  const handleTransformEnd = (e: any) => {
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