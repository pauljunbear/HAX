/**
 * Haptic feedback utilities for enhanced user experience
 * Provides tactile feedback for various user interactions
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback if supported by the device
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  // Check if the device supports haptic feedback
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    let pattern: number | number[] = 0;
    
    switch (type) {
      case 'light':
        pattern = 10;
        break;
      case 'medium':
        pattern = 20;
        break;
      case 'heavy':
        pattern = 30;
        break;
      case 'success':
        pattern = [10, 50, 10];
        break;
      case 'warning':
        pattern = [20, 100, 20];
        break;
      case 'error':
        pattern = [50, 100, 50, 100, 50];
        break;
      default:
        pattern = 10;
    }
    
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      // Silently fail if vibration is not supported
      console.debug('Haptic feedback not supported:', error);
    }
  }
};

/**
 * Create a haptic feedback handler for toggle actions
 */
export const createToggleHapticHandler = (type: HapticType = 'light') => {
  return () => {
    triggerHaptic(type);
  };
};

/**
 * Create a haptic feedback handler for range/slider actions
 */
export const createRangeHapticHandler = (
  min: number,
  max: number,
  step: number,
  type: HapticType = 'light'
) => {
  let lastValue: number | null = null;
  
  return (value: number) => {
    // Only trigger haptic feedback when crossing step boundaries
    if (lastValue === null || Math.abs(value - lastValue) >= step) {
      triggerHaptic(type);
      lastValue = value;
    }
  };
};

/**
 * Create a haptic feedback handler for button presses
 */
export const createButtonHapticHandler = (type: HapticType = 'medium') => {
  return () => {
    triggerHaptic(type);
  };
};

/**
 * Create a haptic feedback handler for drag operations
 */
export const createDragHapticHandler = (type: HapticType = 'light') => {
  let isDragging = false;
  
  return {
    onDragStart: () => {
      isDragging = true;
      triggerHaptic(type);
    },
    onDragEnd: () => {
      if (isDragging) {
        triggerHaptic(type);
        isDragging = false;
      }
    }
  };
};

/**
 * Check if haptic feedback is supported on the current device
 */
export const isHapticSupported = (): boolean => {
  return typeof window !== 'undefined' && 
         'navigator' in window && 
         'vibrate' in navigator;
};

/**
 * Haptic feedback patterns for common UI interactions
 */
export const HapticPatterns = {
  // Basic interactions
  tap: () => triggerHaptic('light'),
  press: () => triggerHaptic('medium'),
  longPress: () => triggerHaptic('heavy'),
  
  // State changes
  toggle: () => triggerHaptic('medium'),
  select: () => triggerHaptic('light'),
  deselect: () => triggerHaptic('light'),
  
  // Feedback
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
  
  // Navigation
  swipe: () => triggerHaptic('light'),
  scroll: () => triggerHaptic('light'),
  
  // Effects
  effectApplied: () => triggerHaptic('success'),
  effectRemoved: () => triggerHaptic('warning'),
  effectAdjusted: () => triggerHaptic('light'),
  
  // Export/Save
  exportStart: () => triggerHaptic('medium'),
  exportComplete: () => triggerHaptic('success'),
  saveComplete: () => triggerHaptic('success'),
} as const; 