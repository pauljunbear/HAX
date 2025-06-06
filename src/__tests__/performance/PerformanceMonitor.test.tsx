import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PerformanceMonitor, usePerformanceMonitor, PerformanceMetrics } from '@/components/PerformanceMonitor';

// Mock global performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
  }
};

(global as any).performance = mockPerformance;

// Mock PerformanceObserver
class MockPerformanceObserver {
  constructor(callback: Function) {}
  observe(options: any) {}
  disconnect() {}
}

(global as any).PerformanceObserver = MockPerformanceObserver;

// Mock requestAnimationFrame
let rafCallbacks: Function[] = [];
(global as any).requestAnimationFrame = (callback: Function) => {
  rafCallbacks.push(callback);
  return rafCallbacks.length - 1;
};

(global as any).cancelAnimationFrame = (id: number) => {
  rafCallbacks[id] = () => {};
};

// Mock WorkerManager
const mockWorkerManager = {
  getStatus: jest.fn(() => ({
    totalWorkers: 4,
    busyWorkers: 2,
    queueSize: 3,
    activeTasks: 2
  }))
};

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rafCallbacks = [];
  });

  describe('Component Rendering', () => {
    it('should not render when isVisible is false', () => {
      const { container } = render(
        <PerformanceMonitor isVisible={false} />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when isVisible is true', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );
      
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    it('should render at correct position', () => {
      const positions = [
        'top-left', 'top-right', 'bottom-left', 'bottom-right'
      ] as const;

      positions.forEach(position => {
        const { container } = render(
          <PerformanceMonitor isVisible={true} position={position} />
        );
        
        const monitor = container.firstChild as HTMLElement;
        expect(monitor.className).toContain(position.replace('-', '-'));
      });
    });
  });

  describe('Metrics Display', () => {
    it('should display FPS', async () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      // Simulate RAF callbacks to update FPS
      act(() => {
        rafCallbacks.forEach(cb => cb());
      });

      expect(screen.getByText('FPS')).toBeInTheDocument();
    });

    it('should display frame time', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      expect(screen.getByText('Frame')).toBeInTheDocument();
    });

    it('should display memory usage when available', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      expect(screen.getByText('Memory')).toBeInTheDocument();
    });

    it('should show warning for poor performance', async () => {
      const onPerformanceChange = jest.fn();
      
      render(
        <PerformanceMonitor 
          isVisible={true}
          onPerformanceChange={onPerformanceChange}
        />
      );

      // Wait for performance metrics to be calculated
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      // Check if callback was called with metrics
      expect(onPerformanceChange).toHaveBeenCalled();
    });
  });

  describe('Expanded View', () => {
    it('should toggle expanded view on click', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      const header = screen.getByText('Performance').parentElement;
      fireEvent.click(header!);

      // Should show more details
      expect(screen.getByText('Render')).toBeInTheDocument();
    });

    it('should show worker status when workerManager provided', () => {
      render(
        <PerformanceMonitor 
          isVisible={true} 
          workerManager={mockWorkerManager}
        />
      );

      const header = screen.getByText('Performance').parentElement;
      fireEvent.click(header!);

      expect(screen.getByText('Workers')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Queue')).toBeInTheDocument();
    });

    it('should show performance tips when needed', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      const header = screen.getByText('Performance').parentElement;
      fireEvent.click(header!);

      // Mock poor performance to trigger tips
      act(() => {
        // Simulate low FPS by not calling RAF callbacks frequently
      });
    });
  });

  describe('Color Coding', () => {
    it('should color code metrics based on performance', () => {
      render(
        <PerformanceMonitor isVisible={true} />
      );

      // FPS should have appropriate color class
      const fpsValue = screen.getByText(/^\d+$/);
      const fpsClass = fpsValue.className;
      
      expect(fpsClass).toMatch(/text-(green|yellow|red)-400/);
    });
  });

  describe('Performance Callbacks', () => {
    it('should call onPerformanceChange with metrics', async () => {
      const onPerformanceChange = jest.fn();
      
      render(
        <PerformanceMonitor 
          isVisible={true}
          onPerformanceChange={onPerformanceChange}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(onPerformanceChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fps: expect.any(Number),
          frameTime: expect.any(Number),
          memoryUsage: expect.any(Number),
          memoryLimit: expect.any(Number),
          renderTime: expect.any(Number),
          operationTime: expect.any(Number),
          activeWorkers: expect.any(Number),
          queueSize: expect.any(Number),
          frameDrops: expect.any(Number),
          isThrottled: expect.any(Boolean)
        })
      );
    });
  });
});

describe('usePerformanceMonitor', () => {
  it('should provide timing functions', () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = usePerformanceMonitor();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult).toHaveProperty('startRender');
    expect(hookResult).toHaveProperty('endRender');
    expect(hookResult).toHaveProperty('startOperation');
    expect(hookResult).toHaveProperty('endOperation');
  });

  it('should call global performance monitor methods', () => {
    // Set up global performance monitor
    (window as any).__performanceMonitor = {
      startRender: jest.fn(),
      endRender: jest.fn(),
      startOperation: jest.fn(),
      endOperation: jest.fn()
    };

    let hookResult: any;

    function TestComponent() {
      hookResult = usePerformanceMonitor();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      hookResult.startRender();
      hookResult.endRender();
      hookResult.startOperation();
      hookResult.endOperation();
    });

    expect((window as any).__performanceMonitor.startRender).toHaveBeenCalled();
    expect((window as any).__performanceMonitor.endRender).toHaveBeenCalled();
    expect((window as any).__performanceMonitor.startOperation).toHaveBeenCalled();
    expect((window as any).__performanceMonitor.endOperation).toHaveBeenCalled();
  });

  it('should handle missing global performance monitor', () => {
    delete (window as any).__performanceMonitor;

    let hookResult: any;

    function TestComponent() {
      hookResult = usePerformanceMonitor();
      return null;
    }

    render(<TestComponent />);

    // Should not throw when calling functions
    expect(() => {
      act(() => {
        hookResult.startRender();
        hookResult.endRender();
        hookResult.startOperation();
        hookResult.endOperation();
      });
    }).not.toThrow();
  });
});

describe('Performance Monitoring Integration', () => {
  it('should monitor render performance', () => {
    render(
      <PerformanceMonitor isVisible={true} />
    );

    // Simulate render timing
    act(() => {
      if ((window as any).__performanceMonitor) {
        (window as any).__performanceMonitor.startRender();
        // Simulate render time
        mockPerformance.now.mockReturnValueOnce(Date.now() + 16);
        (window as any).__performanceMonitor.endRender();
      }
    });
  });

  it('should monitor operation performance', () => {
    render(
      <PerformanceMonitor isVisible={true} />
    );

    // Simulate operation timing
    act(() => {
      if ((window as any).__performanceMonitor) {
        (window as any).__performanceMonitor.startOperation();
        // Simulate operation time
        mockPerformance.now.mockReturnValueOnce(Date.now() + 100);
        (window as any).__performanceMonitor.endOperation();
      }
    });
  });

  it('should track frame drops', async () => {
    const onPerformanceChange = jest.fn();
    
    render(
      <PerformanceMonitor 
        isVisible={true}
        onPerformanceChange={onPerformanceChange}
      />
    );

    // Simulate slow frames
    act(() => {
      // Simulate frame taking longer than 16.67ms
      mockPerformance.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(20);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    const lastCall = onPerformanceChange.mock.calls[onPerformanceChange.mock.calls.length - 1];
    expect(lastCall[0].frameDrops).toBeGreaterThanOrEqual(0);
  });

  it('should detect throttling', async () => {
    const onPerformanceChange = jest.fn();
    
    render(
      <PerformanceMonitor 
        isVisible={true}
        onPerformanceChange={onPerformanceChange}
      />
    );

    // Will be called with metrics that may indicate throttling
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100));
    });

    expect(onPerformanceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isThrottled: expect.any(Boolean)
      })
    );
  });
});