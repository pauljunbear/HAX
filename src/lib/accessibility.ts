/**
 * Accessibility utilities and constants for WCAG compliance
 */

// ARIA labels for common UI elements
export const ARIA_LABELS = {
  // Navigation
  mainNav: 'Main navigation',
  skipToContent: 'Skip to main content',
  mobileMenuToggle: 'Toggle mobile menu',
  
  // Image Editor
  uploadImage: 'Upload an image to edit',
  imageCanvas: 'Image editing canvas',
  dropZone: 'Drop zone for image upload',
  exportImage: 'Export edited image',
  
  // Controls
  effectsPanel: 'Effects control panel',
  effectCategory: (category: string) => `${category} effects category`,
  effectButton: (effectName: string) => `Apply ${effectName} effect`,
  slider: (paramName: string) => `Adjust ${paramName}`,
  
  // Layer controls
  layersList: 'Effect layers list',
  toggleLayer: (layerName: string) => `Toggle ${layerName} layer visibility`,
  deleteLayer: (layerName: string) => `Delete ${layerName} layer`,
  reorderLayer: 'Reorder layer, use arrow keys to move',
  
  // Dialogs
  exportDialog: 'Export options dialog',
  closeDialog: 'Close dialog',
  
  // Status
  loading: 'Loading',
  processing: 'Processing image',
  error: 'Error message',
  success: 'Success message',
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  // General
  escape: 'Escape',
  enter: 'Enter',
  space: ' ',
  
  // Navigation
  tab: 'Tab',
  shiftTab: 'Shift+Tab',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  
  // Actions
  ctrlZ: 'Control+z',
  ctrlY: 'Control+y',
  ctrlS: 'Control+s',
  ctrlE: 'Control+e',
  delete: 'Delete',
};

// Focus trap utility for modals/dialogs
export const trapFocus = (element: HTMLElement) => {
  const focusableElements = element.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusableElement = focusableElements[0] as HTMLElement;
  const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusableElement) {
        lastFocusableElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusableElement) {
        firstFocusableElement.focus();
        e.preventDefault();
      }
    }
  };

  element.addEventListener('keydown', handleTabKey);
  firstFocusableElement?.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
};

// Announce to screen readers
export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.classList.add('sr-only');
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Focus visible utility class
export const focusRingClass = 'focus:outline-none focus:ring-2 focus:ring-primary-accent focus:ring-offset-2 focus:ring-offset-dark-bg';

// Color contrast checker
export const meetsContrastRatio = (foreground: string, background: string, ratio: number = 4.5): boolean => {
  // Simple implementation - in production, use a proper library
  // This is a placeholder that always returns true
  return true;
};

// Keyboard navigation hook
export const useKeyboardNavigation = (
  items: any[],
  onSelect: (index: number) => void,
  orientation: 'horizontal' | 'vertical' = 'vertical'
) => {
  const handleKeyDown = (e: KeyboardEvent, currentIndex: number) => {
    const lastIndex = items.length - 1;
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
        if (orientation === 'vertical') {
          e.preventDefault();
          newIndex = currentIndex < lastIndex ? currentIndex + 1 : 0;
        }
        break;
      case 'ArrowUp':
        if (orientation === 'vertical') {
          e.preventDefault();
          newIndex = currentIndex > 0 ? currentIndex - 1 : lastIndex;
        }
        break;
      case 'ArrowRight':
        if (orientation === 'horizontal') {
          e.preventDefault();
          newIndex = currentIndex < lastIndex ? currentIndex + 1 : 0;
        }
        break;
      case 'ArrowLeft':
        if (orientation === 'horizontal') {
          e.preventDefault();
          newIndex = currentIndex > 0 ? currentIndex - 1 : lastIndex;
        }
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = lastIndex;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(currentIndex);
        return;
    }

    if (newIndex !== currentIndex) {
      onSelect(newIndex);
    }
  };

  return { handleKeyDown };
}; 