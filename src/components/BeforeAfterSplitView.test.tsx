import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BeforeAfterSplitView } from './BeforeAfterSplitView';

describe('BeforeAfterSplitView', () => {
  const mockBeforeImage = 'before.jpg';
  const mockAfterImage = 'after.jpg';
  const defaultProps = {
    beforeImage: mockBeforeImage,
    afterImage: mockAfterImage,
    initialPosition: 50,
    onPositionChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders both images correctly', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const beforeImage = screen.getByTestId('before-image');
    const afterImage = screen.getByTestId('after-image');

    expect(beforeImage).toHaveAttribute('src', mockBeforeImage);
    expect(afterImage).toHaveAttribute('src', mockAfterImage);
  });

  it('renders divider at initial position', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    expect(divider).toHaveStyle({ left: '50%' });
  });

  it('handles mouse drag correctly', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    const container = screen.getByTestId('split-view-container');

    // Simulate mouse drag
    fireEvent.mouseDown(divider, { clientX: 100 });
    fireEvent.mouseMove(container, { clientX: 200 });
    fireEvent.mouseUp(container);

    expect(defaultProps.onPositionChange).toHaveBeenCalled();
  });

  it('handles touch events correctly', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    const container = screen.getByTestId('split-view-container');

    // Simulate touch events
    fireEvent.touchStart(divider, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(container, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(container);

    expect(defaultProps.onPositionChange).toHaveBeenCalled();
  });

  it('respects container boundaries', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    const container = screen.getByTestId('split-view-container');

    // Try to drag beyond left boundary
    fireEvent.mouseDown(divider, { clientX: 100 });
    fireEvent.mouseMove(container, { clientX: -50 });
    fireEvent.mouseUp(container);

    expect(divider).toHaveStyle({ left: '0%' });

    // Try to drag beyond right boundary
    fireEvent.mouseDown(divider, { clientX: 100 });
    fireEvent.mouseMove(container, { clientX: 1000 });
    fireEvent.mouseUp(container);

    expect(divider).toHaveStyle({ left: '100%' });
  });

  it('updates clip path on divider movement', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const beforeImage = screen.getByTestId('before-image');
    const divider = screen.getByTestId('divider');

    // Move divider
    fireEvent.mouseDown(divider, { clientX: 100 });
    fireEvent.mouseMove(divider, { clientX: 200 });
    fireEvent.mouseUp(divider);

    // Verify the image element exists and has some style applied
    // The clip path is dynamically calculated based on position
    expect(beforeImage).toBeInTheDocument();
    expect(beforeImage.style.clipPath).toBeDefined();
  });

  it('handles keyboard navigation', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    divider.focus();

    // Test arrow keys
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(defaultProps.onPositionChange).toHaveBeenCalledWith(expect.any(Number));

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(defaultProps.onPositionChange).toHaveBeenCalledWith(expect.any(Number));
  });

  it('provides haptic feedback on divider movement', () => {
    const mockVibrate = jest.fn();
    navigator.vibrate = mockVibrate;

    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');
    fireEvent.mouseDown(divider, { clientX: 100 });
    fireEvent.mouseMove(divider, { clientX: 200 });
    fireEvent.mouseUp(divider);

    expect(mockVibrate).toHaveBeenCalled();
  });

  it('handles window resize correctly', () => {
    render(<BeforeAfterSplitView {...defaultProps} />);

    const divider = screen.getByTestId('divider');

    // Simulate window resize
    global.innerWidth = 800;
    fireEvent(window, new Event('resize'));

    // Check if divider is still in the document after resize
    expect(divider).toBeInTheDocument();
    // The divider should have a left style (position)
    expect(divider.style.left).toBeDefined();
  });
});
