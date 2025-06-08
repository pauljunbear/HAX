import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatch = shortcut.ctrlKey === event.ctrlKey
      const shiftMatch = shortcut.shiftKey === event.shiftKey
      const altMatch = shortcut.altKey === event.altKey
      const metaMatch = shortcut.metaKey === event.metaKey

      return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
    })

    if (matchingShortcut) {
      event.preventDefault()
      matchingShortcut.action()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])

  // Return a function to get all available shortcuts for display
  const getShortcuts = useCallback(() => {
    return shortcuts.map(shortcut => ({
      ...shortcut,
      keyCombo: [
        shortcut.ctrlKey && 'Ctrl',
        shortcut.shiftKey && 'Shift',
        shortcut.altKey && 'Alt',
        shortcut.metaKey && '⌘',
        shortcut.key.toUpperCase()
      ].filter(Boolean).join(' + ')
    }))
  }, [shortcuts])

  return { getShortcuts }
}

// Predefined shortcuts for the image editor
export const EDITOR_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'z',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Undo last action'
  },
  {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Redo last action'
  },
  {
    key: 's',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Save image'
  },
  {
    key: 'o',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Open image'
  },
  {
    key: 'e',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Export image'
  },
  {
    key: 'b',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Toggle before/after view'
  },
  {
    key: 'r',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Reset image'
  },
  {
    key: 'f',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Toggle fullscreen'
  },
  {
    key: 'h',
    ctrlKey: true,
    action: () => {}, // Will be overridden by the component
    description: 'Show keyboard shortcuts help'
  },
  {
    key: 'Escape',
    action: () => {}, // Will be overridden by the component
    description: 'Close current dialog or panel'
  },
  {
    key: 'Delete',
    action: () => {}, // Will be overridden by the component
    description: 'Delete selected effect'
  },
  {
    key: 'ArrowLeft',
    action: () => {}, // Will be overridden by the component
    description: 'Previous effect'
  },
  {
    key: 'ArrowRight',
    action: () => {}, // Will be overridden by the component
    description: 'Next effect'
  },
  {
    key: 'ArrowUp',
    action: () => {}, // Will be overridden by the component
    description: 'Increase effect value'
  },
  {
    key: 'ArrowDown',
    action: () => {}, // Will be overridden by the component
    description: 'Decrease effect value'
  }
] 