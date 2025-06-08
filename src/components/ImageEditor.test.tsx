import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageEditor from './ImageEditor'
import { KonvaEventObject } from 'konva/lib/Node'
import { TouchGestures } from './TouchGestures'

// Mock Konva components
jest.mock('react-konva', () => ({
  Stage: ({ children, ...props }: any) => <div data-testid="stage" {...props}>{children}</div>,
  Layer: ({ children, ...props }: any) => <div data-testid="layer" {...props}>{children}</div>,
  Image: ({ ...props }: any) => <div data-testid="image" {...props} />,
  Transformer: ({ ...props }: any) => <div data-testid="transformer" {...props} />,
}))

// Mock file upload
const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
const mockImageUrl = 'data:image/png;base64,test'

// Mock the TouchGestures component
jest.mock('./TouchGestures', () => ({
  TouchGestures: jest.fn(({ children, onZoom, onRotate, onPan }) => (
    <div data-testid="touch-gestures">
      {children}
      <button
        data-testid="test-zoom"
        onClick={() => onZoom?.(1.5)}
      >
        Test Zoom
      </button>
      <button
        data-testid="test-rotate"
        onClick={() => onRotate?.(45)}
      >
        Test Rotate
      </button>
      <button
        data-testid="test-pan"
        onClick={() => onPan?.(100, 100)}
      >
        Test Pan
      </button>
    </div>
  )),
}))

describe('ImageEditor', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Mock URL.createObjectURL
    URL.createObjectURL = jest.fn(() => mockImageUrl)
  })

  it('renders without crashing', () => {
    render(<ImageEditor />)
    expect(screen.getByTestId('stage')).toBeInTheDocument()
  })

  it('handles image upload correctly', async () => {
    render(<ImageEditor />)
    
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile)
    expect(screen.getByTestId('image')).toBeInTheDocument()
  })

  it('applies effects correctly', async () => {
    render(<ImageEditor />)
    
    // Upload image first
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    // Apply an effect
    const effectButton = screen.getByTestId('effect-blur')
    fireEvent.click(effectButton)
    
    // Check if effect was applied
    const effectLayer = screen.getByTestId('effect-layer')
    expect(effectLayer).toHaveStyle({ filter: 'blur(5px)' })
  })

  it('handles image transformation correctly', async () => {
    render(<ImageEditor />)
    
    // Upload image
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    // Simulate transform
    const image = screen.getByTestId('image')
    const transformEvent = {
      target: {
        x: () => 100,
        y: () => 100,
        width: () => 200,
        height: () => 200,
        rotation: () => 45,
      },
    } as KonvaEventObject<MouseEvent>
    
    fireEvent.transform(image, transformEvent)
    
    // Check if transform was applied
    expect(image).toHaveStyle({
      transform: 'translate(100px, 100px) rotate(45deg)',
    })
  })

  it('exports image correctly', async () => {
    render(<ImageEditor />)
    
    // Upload image
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    // Mock canvas toDataURL
    const mockToDataURL = jest.fn(() => 'data:image/png;base64,exported')
    HTMLCanvasElement.prototype.toDataURL = mockToDataURL
    
    // Click export
    const exportButton = screen.getByTestId('export-button')
    fireEvent.click(exportButton)
    
    expect(mockToDataURL).toHaveBeenCalledWith('image/png')
  })

  it('handles undo/redo correctly', async () => {
    render(<ImageEditor />)
    
    // Upload image
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    // Apply an effect
    const effectButton = screen.getByTestId('effect-blur')
    fireEvent.click(effectButton)
    
    // Undo
    const undoButton = screen.getByTestId('undo-button')
    fireEvent.click(undoButton)
    
    // Check if effect was removed
    const effectLayer = screen.queryByTestId('effect-layer')
    expect(effectLayer).not.toBeInTheDocument()
    
    // Redo
    const redoButton = screen.getByTestId('redo-button')
    fireEvent.click(redoButton)
    
    // Check if effect was reapplied
    expect(screen.getByTestId('effect-layer')).toBeInTheDocument()
  })

  it('handles layer management correctly', async () => {
    render(<ImageEditor />)
    
    // Upload image
    const fileInput = screen.getByTestId('file-input')
    await userEvent.upload(fileInput, mockFile)
    
    // Add a new layer
    const addLayerButton = screen.getByTestId('add-layer-button')
    fireEvent.click(addLayerButton)
    
    // Check if new layer was added
    const layers = screen.getAllByTestId('layer')
    expect(layers).toHaveLength(2)
    
    // Remove layer
    const removeLayerButton = screen.getByTestId('remove-layer-button')
    fireEvent.click(removeLayerButton)
    
    // Check if layer was removed
    expect(screen.getAllByTestId('layer')).toHaveLength(1)
  })
})

describe('ImageEditor with TouchGestures', () => {
  const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  it('renders TouchGestures component when image is loaded', () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    expect(getByTestId('touch-gestures')).toBeInTheDocument()
  })

  it('handles zoom gesture correctly', () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Trigger zoom through the mock
    fireEvent.click(getByTestId('test-zoom'))

    // Verify that the stage was updated
    const stage = getByTestId('touch-gestures').querySelector('canvas')
    expect(stage).toBeInTheDocument()
  })

  it('handles rotate gesture correctly', () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Trigger rotation through the mock
    fireEvent.click(getByTestId('test-rotate'))

    // Verify that the stage was updated
    const stage = getByTestId('touch-gestures').querySelector('canvas')
    expect(stage).toBeInTheDocument()
  })

  it('handles pan gesture correctly', () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Trigger pan through the mock
    fireEvent.click(getByTestId('test-pan'))

    // Verify that the stage was updated
    const stage = getByTestId('touch-gestures').querySelector('canvas')
    expect(stage).toBeInTheDocument()
  })

  it('disables touch gestures when split view is active', () => {
    const { getByTestId, rerender } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Initially, TouchGestures should be enabled
    expect(TouchGestures).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
      expect.any(Object)
    )

    // Rerender with split view active
    rerender(
      <ImageEditor
        selectedImage={mockImage}
        showSplitView={true}
      />
    )

    // TouchGestures should now be disabled
    expect(TouchGestures).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
      expect.any(Object)
    )
  })

  it('maintains image position after gestures', async () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Perform a series of gestures
    await act(async () => {
      fireEvent.click(getByTestId('test-zoom'))
      fireEvent.click(getByTestId('test-rotate'))
      fireEvent.click(getByTestId('test-pan'))
    })

    // Verify that the image is still visible and properly positioned
    const stage = getByTestId('touch-gestures').querySelector('canvas')
    expect(stage).toBeInTheDocument()
  })

  it('handles rapid gesture sequences', async () => {
    const { getByTestId } = render(
      <ImageEditor selectedImage={mockImage} />
    )

    // Perform rapid gesture sequences
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(getByTestId('test-zoom'))
        fireEvent.click(getByTestId('test-rotate'))
        fireEvent.click(getByTestId('test-pan'))
      }
    })

    // Verify that the stage remains stable
    const stage = getByTestId('touch-gestures').querySelector('canvas')
    expect(stage).toBeInTheDocument()
  })
}) 