import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageEditor from './ImageEditor';

// Keep a reference to the latest mocked Konva image node so the stage can locate it
let latestImageNode: any = null;

// Mock useImage hook so tests don't rely on actual image loading
jest.mock('@/hooks/useImage', () => ({
  __esModule: true,
  default: jest.fn(() => [{ width: 100, height: 100 }, { status: 'loaded' }]),
}));

// Mock Konva components with ref-aware stubs
jest.mock('react-konva', () => {
  const React = require('react');

  const Stage = React.forwardRef(
    (
      { children, width, height, listening, perfectDrawEnabled, ...rest }: any,
      ref: React.Ref<any>
    ) => {
      let scale = 1;
      let position = { x: 0, y: 0 };

      const stageApi = {
        findOne: jest.fn(() => latestImageNode),
        scale: jest.fn(({ x, y }: { x: number; y: number }) => {
          scale = x;
        }),
        scaleX: jest.fn(() => scale),
        position: jest.fn(({ x, y }: { x: number; y: number }) => {
          position = { x, y };
        }),
        x: jest.fn(() => position.x),
        y: jest.fn(() => position.y),
        getPointerPosition: jest.fn(() => ({ x: 0, y: 0 })),
        batchDraw: jest.fn(),
      };

      React.useImperativeHandle(ref, () => stageApi);

      return (
        <div data-testid="stage" style={{ width, height, ...(rest.style || {}) }} {...rest}>
          {children}
        </div>
      );
    }
  );

  const Layer = ({ children, ...props }: any) => (
    <div data-testid="layer" {...props}>
      {children}
    </div>
  );

  const Image = React.forwardRef((props: any, ref: React.Ref<any>) => {
    let filters: any[] = [];

    const { listening, perfectDrawEnabled, ...rest } = props;

    const node = {
      cache: jest.fn(),
      clearCache: jest.fn(),
      filters: jest.fn((value?: any[]) => {
        if (Array.isArray(value)) {
          filters = value;
        }
        return filters;
      }),
      getLayer: jest.fn(() => ({ batchDraw: jest.fn(), draw: jest.fn() })),
      drawScene: jest.fn(),
      brightness: jest.fn(),
      contrast: jest.fn(),
      saturation: jest.fn(),
      hue: jest.fn(),
      blurRadius: jest.fn(),
      noise: jest.fn(),
      enhance: jest.fn(),
    };

    React.useEffect(() => {
      latestImageNode = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as any).current = node;
      }
    });

    return <div data-testid="image" {...rest} />;
  });

  return {
    Stage,
    Layer,
    Image,
    Transformer: ({ ...props }: any) => <div data-testid="transformer" {...props} />,
  };
});

// Mock file upload
const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
const mockImageUrl = 'data:image/png;base64,test';

describe('ImageEditor', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock URL.createObjectURL
    URL.createObjectURL = jest.fn(() => mockImageUrl);
  });

  it('renders without crashing', async () => {
    render(<ImageEditor />);
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    await userEvent.upload(input, file);
    await waitFor(() => expect(screen.getByTestId('image')).toBeInTheDocument());
  });

  it('handles image upload correctly', async () => {
    render(<ImageEditor />);

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, mockFile);

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile);
    await waitFor(() => expect(screen.getByTestId('image')).toBeInTheDocument());
  });

  it('handles layer management correctly', async () => {
    render(<ImageEditor />);

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, mockFile);

    const layers = screen.getAllByTestId('layer');
    expect(layers).toHaveLength(1);
  });
});
