import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts, EDITOR_SHORTCUTS } from './useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  it('registers keyboard event listener when enabled', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: EDITOR_SHORTCUTS,
        enabled: true
      })
    )

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    )
  })

  it('does not register keyboard event listener when disabled', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: EDITOR_SHORTCUTS,
        enabled: false
      })
    )

    expect(addEventListenerSpy).not.toHaveBeenCalled()
  })

  it('triggers shortcut action when matching key combination is pressed', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts,
        enabled: true
      })
    )

    act(() => {
      // Simulate Ctrl + A
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true
      })
      window.dispatchEvent(event)
    })

    expect(mockAction).toHaveBeenCalled()
  })

  it('does not trigger shortcut action when key combination does not match', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts,
        enabled: true
      })
    )

    act(() => {
      // Simulate just 'A' without Ctrl
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: false
      })
      window.dispatchEvent(event)
    })

    expect(mockAction).not.toHaveBeenCalled()
  })

  it('formats key combinations correctly', () => {
    const { result } = renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [
          {
            key: 'a',
            ctrlKey: true,
            action: () => {},
            description: 'Test shortcut 1'
          },
          {
            key: 'b',
            ctrlKey: true,
            shiftKey: true,
            action: () => {},
            description: 'Test shortcut 2'
          },
          {
            key: 'c',
            ctrlKey: true,
            metaKey: true,
            action: () => {},
            description: 'Test shortcut 3'
          }
        ],
        enabled: true
      })
    )

    const shortcuts = result.current.getShortcuts()

    expect(shortcuts[0].keyCombo).toBe('Ctrl + A')
    expect(shortcuts[1].keyCombo).toBe('Ctrl + Shift + B')
    expect(shortcuts[2].keyCombo).toBe('Ctrl + ⌘ + C')
  })

  it('handles multiple shortcuts with the same key but different modifiers', () => {
    const mockAction1 = jest.fn()
    const mockAction2 = jest.fn()
    const shortcuts = [
      {
        key: 'z',
        ctrlKey: true,
        action: mockAction1,
        description: 'Undo'
      },
      {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        action: mockAction2,
        description: 'Redo'
      }
    ]

    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts,
        enabled: true
      })
    )

    act(() => {
      // Simulate Ctrl + Z
      const event1 = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: false
      })
      window.dispatchEvent(event1)
    })

    expect(mockAction1).toHaveBeenCalled()
    expect(mockAction2).not.toHaveBeenCalled()

    act(() => {
      // Simulate Ctrl + Shift + Z
      const event2 = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true
      })
      window.dispatchEvent(event2)
    })

    expect(mockAction2).toHaveBeenCalled()
  })

  it('prevents default behavior when shortcut is triggered', () => {
    const mockAction = jest.fn()
    const shortcuts = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Test shortcut'
      }
    ]

    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts,
        enabled: true
      })
    )

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true
    })
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

    act(() => {
      window.dispatchEvent(event)
    })

    expect(preventDefaultSpy).toHaveBeenCalled()
  })
}) 