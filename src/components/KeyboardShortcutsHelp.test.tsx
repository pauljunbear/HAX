import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

describe('KeyboardShortcutsHelp', () => {
  const mockShortcuts = [
    {
      key: 'a',
      ctrlKey: true,
      action: () => {},
      description: 'Test shortcut 1',
      keyCombo: 'Ctrl + A'
    },
    {
      key: 'b',
      ctrlKey: true,
      shiftKey: true,
      action: () => {},
      description: 'Test shortcut 2',
      keyCombo: 'Ctrl + Shift + B'
    },
    {
      key: 'c',
      ctrlKey: true,
      metaKey: true,
      action: () => {},
      description: 'Test effect value',
      keyCombo: 'Ctrl + ⌘ + C'
    }
  ]

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <KeyboardShortcutsHelp
        isOpen={false}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders dialog when isOpen is true', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('groups shortcuts by category', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    // Check for category headers
    expect(screen.getByText('Effects')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('displays all shortcuts with their key combinations', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    // Check for shortcut descriptions
    expect(screen.getByText('Test shortcut 1')).toBeInTheDocument()
    expect(screen.getByText('Test shortcut 2')).toBeInTheDocument()
    expect(screen.getByText('Test effect value')).toBeInTheDocument()

    // Check for key combinations
    expect(screen.getByText('Ctrl + A')).toBeInTheDocument()
    expect(screen.getByText('Ctrl + Shift + B')).toBeInTheDocument()
    expect(screen.getByText('Ctrl + ⌘ + C')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    const backdrop = screen.getByRole('presentation')
    fireEvent.click(backdrop)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('displays keyboard shortcut for closing the dialog', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    expect(screen.getByText('Press')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
    expect(screen.getByText('to close')).toBeInTheDocument()
  })

  it('applies correct styling to key combinations', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    )

    const keyCombos = screen.getAllByText(/Ctrl \+/)
    keyCombos.forEach(combo => {
      expect(combo).toHaveClass('px-2', 'py-1', 'text-xs', 'font-medium')
    })
  })

  it('handles empty shortcuts array', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={[]}
      />
    )

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('maintains scroll position when content overflows', () => {
    const manyShortcuts = Array.from({ length: 20 }, (_, i) => ({
      key: String.fromCharCode(97 + i),
      ctrlKey: true,
      action: () => {},
      description: `Test shortcut ${i + 1}`,
      keyCombo: `Ctrl + ${String.fromCharCode(65 + i)}`
    }))

    render(
      <KeyboardShortcutsHelp
        isOpen={true}
        onClose={mockOnClose}
        shortcuts={manyShortcuts}
      />
    )

    const content = screen.getByRole('region')
    expect(content).toHaveStyle({ maxHeight: '70vh', overflowY: 'auto' })
  })
}) 