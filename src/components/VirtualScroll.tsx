'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number; // Fixed height for each item
  containerHeight: number; // Height of the scroll container
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 2,
  className = '',
  onScroll
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEnd = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Get visible items
  const visibleItems = items.slice(visibleStart, visibleEnd);

  // Offset for positioning visible items
  const offsetY = visibleStart * itemHeight;

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Total height container for scrollbar */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleStart + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleStart + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Specialized virtual scroll for grouped items
interface GroupedVirtualScrollProps<T> {
  groups: Array<{
    label: string;
    items: T[];
  }>;
  itemHeight: number;
  groupHeaderHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderGroupHeader: (label: string) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function GroupedVirtualScroll<T>({
  groups,
  itemHeight,
  groupHeaderHeight,
  containerHeight,
  renderItem,
  renderGroupHeader,
  overscan = 2,
  className = ''
}: GroupedVirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Flatten groups with position info
  interface FlatItem {
    type: 'header' | 'item';
    data: string | T;
    height: number;
    position: number;
    groupIndex: number;
    itemIndex?: number;
  }

  const flatItems: FlatItem[] = [];
  let currentPosition = 0;

  groups.forEach((group, groupIndex) => {
    // Add group header
    flatItems.push({
      type: 'header',
      data: group.label,
      height: groupHeaderHeight,
      position: currentPosition,
      groupIndex
    });
    currentPosition += groupHeaderHeight;

    // Add group items
    group.items.forEach((item, itemIndex) => {
      flatItems.push({
        type: 'item',
        data: item,
        height: itemHeight,
        position: currentPosition,
        groupIndex,
        itemIndex
      });
      currentPosition += itemHeight;
    });
  });

  const totalHeight = currentPosition;

  // Find visible range
  let visibleStart = 0;
  let visibleEnd = flatItems.length;

  for (let i = 0; i < flatItems.length; i++) {
    if (flatItems[i].position + flatItems[i].height >= scrollTop - overscan * itemHeight) {
      visibleStart = Math.max(0, i - overscan);
      break;
    }
  }

  for (let i = visibleStart; i < flatItems.length; i++) {
    if (flatItems[i].position > scrollTop + containerHeight + overscan * itemHeight) {
      visibleEnd = Math.min(flatItems.length, i + overscan);
      break;
    }
  }

  const visibleItems = flatItems.slice(visibleStart, visibleEnd);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={`${item.groupIndex}-${item.type}-${item.itemIndex ?? 'header'}`}
            style={{
              position: 'absolute',
              top: item.position,
              left: 0,
              right: 0,
              height: item.height
            }}
          >
            {item.type === 'header' 
              ? renderGroupHeader(item.data as string)
              : renderItem(item.data as T, item.itemIndex!)
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for measuring dynamic item heights
export function useDynamicVirtualScroll<T>(items: T[], containerRef: React.RefObject<HTMLDivElement>) {
  const [itemHeights, setItemHeights] = useState<number[]>([]);
  const [averageHeight, setAverageHeight] = useState(100);

  const measureItem = useCallback((index: number, element: HTMLElement) => {
    const height = element.getBoundingClientRect().height;
    setItemHeights(prev => {
      const next = [...prev];
      next[index] = height;
      return next;
    });
  }, []);

  useEffect(() => {
    if (itemHeights.length > 0) {
      const sum = itemHeights.reduce((a, b) => a + b, 0);
      setAverageHeight(sum / itemHeights.length);
    }
  }, [itemHeights]);

  return {
    itemHeights,
    averageHeight,
    measureItem
  };
} 