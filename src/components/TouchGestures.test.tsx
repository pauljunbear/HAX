import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { TouchGestures } from './TouchGestures'

describe('TouchGestures', () => {
  const mockOnPinchZoom = jest.fn()
  const mockOnTap = jest.fn()
  const mockOnDoubleTap = jest.fn()
  const mockOnPan = jest.fn()
  const mockOnRotate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders children correctly', () => {
    const { getByText } = render(
      <TouchGestures>
        <div>Test Content</div>
      </TouchGestures>
    )
    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('handles tap events', () => {
    const { container } = render(
      <TouchGestures onTap={mockOnTap}>
        <div>Test Content</div>
      </TouchGestures>
    )

    fireEvent.touchStart(container.firstChild!, {
      touches: [{ clientX: 0, clientY: 0 }]
    })

    expect(mockOnTap).toHaveBeenCalled()
  })

  it('handles pinch events', () => {
    const { container } = render(
      <TouchGestures onPinchZoom={mockOnPinchZoom}>
        <div>Test Content</div>
      </TouchGestures>
    )

    fireEvent.touchStart(container.firstChild!, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 100 }
      ]
    })

    expect(mockOnPinchZoom).toHaveBeenCalled()
  })

  it('handles pan events', () => {
    const { container } = render(
      <TouchGestures onPan={mockOnPan}>
        <div>Test Content</div>
      </TouchGestures>
    )

    fireEvent.touchStart(container.firstChild!, {
      touches: [{ clientX: 0, clientY: 0 }]
    })

    fireEvent.touchMove(container.firstChild!, {
      touches: [{ clientX: 100, clientY: 100 }]
    })

    expect(mockOnPan).toHaveBeenCalled()
  })

  it('handles rotate events', () => {
    const { container } = render(
      <TouchGestures onRotate={mockOnRotate}>
        <div>Test Content</div>
      </TouchGestures>
    )

    fireEvent.touchStart(container.firstChild!, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 100 }
      ]
    })

    fireEvent.touchMove(container.firstChild!, {
      touches: [
        { clientX: 100, clientY: 0 },
        { clientX: 0, clientY: 100 }
      ]
    })

    expect(mockOnRotate).toHaveBeenCalled()
  })

  it('disables gesture handling when disabled prop is true', () => {
    const { container } = render(
      <TouchGestures
        disabled
        onTap={mockOnTap}
        onPinchZoom={mockOnPinchZoom}
        onPan={mockOnPan}
        onRotate={mockOnRotate}
      >
        <div>Test Content</div>
      </TouchGestures>
    )

    fireEvent.touchStart(container.firstChild!, {
      touches: [{ clientX: 0, clientY: 0 }]
    })

    expect(mockOnTap).not.toHaveBeenCalled()
    expect(mockOnPinchZoom).not.toHaveBeenCalled()
    expect(mockOnPan).not.toHaveBeenCalled()
    expect(mockOnRotate).not.toHaveBeenCalled()
  })
}) 