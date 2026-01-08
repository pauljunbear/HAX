import React, { useEffect, useRef } from 'react';

export interface TouchGesturesProps {
  onZoom?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  onPan?: (x: number, y: number) => void;
  onTap?: () => void;
  onPinchZoom?: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
  enabled?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export const TouchGestures: React.FC<TouchGesturesProps> = ({
  onZoom,
  onRotate,
  onPan,
  onTap,
  onPinchZoom,
  minScale = 0.5,
  maxScale = 3,
  enabled = true,
  disabled,
  children,
}) => {
  const isEnabled = disabled === true ? false : enabled;
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    startDistance: number;
    startAngle: number;
    startX: number;
    startY: number;
    currentScale: number;
    currentAngle: number;
    currentX: number;
    currentY: number;
  }>({
    startDistance: 0,
    startAngle: 0,
    startX: 0,
    startY: 0,
    currentScale: 1,
    currentAngle: 0,
    currentX: 0,
    currentY: 0,
  });

  const getCenter = (touches: TouchList) => {
    const x = (touches[0].clientX + touches[1].clientX) / 2;
    const y = (touches[0].clientY + touches[1].clientY) / 2;
    return { x, y };
  };

  const getDistance = (touches: TouchList) => {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getAngle = (touches: TouchList) => {
    return Math.atan2(
      touches[1].clientY - touches[0].clientY,
      touches[1].clientX - touches[0].clientX
    );
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (!isEnabled || !containerRef.current) return;

    if (e.touches.length === 2) {
      const { x, y } = getCenter(e.touches);
      touchStateRef.current = {
        startDistance: getDistance(e.touches),
        startAngle: getAngle(e.touches),
        startX: x,
        startY: y,
        currentScale: touchStateRef.current.currentScale,
        currentAngle: touchStateRef.current.currentAngle,
        currentX: touchStateRef.current.currentX,
        currentY: touchStateRef.current.currentY,
      };
      // notify pinch start
      const distance = touchStateRef.current.startDistance;
      const scale = Math.min(
        Math.max((distance / distance) * touchStateRef.current.currentScale, minScale),
        maxScale
      );
      if (onPinchZoom) onPinchZoom(scale);
      if (onZoom) onZoom(scale);
    } else if (e.touches.length === 1) {
      touchStateRef.current = {
        ...touchStateRef.current,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
      };
      if (onTap) onTap();
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isEnabled || !containerRef.current) return;

    if (e.touches.length === 2) {
      const { x, y } = getCenter(e.touches);
      const distance = getDistance(e.touches);
      const angle = getAngle(e.touches);

      const scale = Math.min(
        Math.max(
          (distance / touchStateRef.current.startDistance) * touchStateRef.current.currentScale,
          minScale
        ),
        maxScale
      );

      const rotation =
        angle - touchStateRef.current.startAngle + touchStateRef.current.currentAngle;

      const dx = x - touchStateRef.current.startX;
      const dy = y - touchStateRef.current.startY;

      if (onZoom) onZoom(scale);
      if (onPinchZoom) onPinchZoom(scale);
      if (onRotate) onRotate(rotation);
      if (onPan) onPan(dx, dy);

      touchStateRef.current = {
        ...touchStateRef.current,
        currentScale: scale,
        currentAngle: rotation,
        currentX: dx,
        currentY: dy,
      };
    } else if (e.touches.length === 1 && onPan) {
      const dx = e.touches[0].clientX - touchStateRef.current.startX;
      const dy = e.touches[0].clientY - touchStateRef.current.startY;
      onPan(dx, dy);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isEnabled || !containerRef.current) return;

    if (e.touches.length === 0) {
      if (e.changedTouches.length === 2) {
        touchStateRef.current = {
          ...touchStateRef.current,
          currentScale: 1,
          currentAngle: 0,
          currentX: 0,
          currentY: 0,
        };
        if (onZoom) onZoom(1);
        if (onRotate) onRotate(0);
        if (onPan) onPan(0, 0);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isEnabled, onZoom, onRotate, onPan, onTap, onPinchZoom, minScale, maxScale]);

  return (
    <div ref={containerRef} style={{ touchAction: 'none' }}>
      {children}
    </div>
  );
};
