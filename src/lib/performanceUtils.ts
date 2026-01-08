'use client';

// Minimal interface for particle containers (tsparticles or similar)
interface ParticleContainer {
  pause?: () => void;
  resume?: () => void;
  play?: () => void;
  destroy?: () => void;
}

// Minimal interface for Three.js canvas/renderer
interface ThreeCanvas {
  dispose?: () => void;
  forceContextLoss?: () => void;
}

// Performance monitoring and cleanup utilities
export class PerformanceManager {
  private static instance: PerformanceManager;
  private particleContainers: Set<ParticleContainer> = new Set();
  private threeCanvases: Set<ThreeCanvas> = new Set();
  private animationFrames: Set<number> = new Set();
  private timers: Set<number> = new Set();

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  // Register particle container for cleanup
  public registerParticleContainer(container: ParticleContainer): void {
    try {
      if (container && this.particleContainers.size < 10) {
        // Limit to prevent memory issues
        this.particleContainers.add(container);
      }
    } catch (error) {
      console.warn('Failed to register particle container:', error);
    }
  }

  // Unregister particle container
  public unregisterParticleContainer(container: ParticleContainer): void {
    try {
      this.particleContainers.delete(container);
    } catch (error) {
      console.warn('Failed to unregister particle container:', error);
    }
  }

  // Register Three.js canvas for cleanup
  public registerThreeCanvas(canvas: ThreeCanvas): void {
    this.threeCanvases.add(canvas);
  }

  // Unregister Three.js canvas
  public unregisterThreeCanvas(canvas: ThreeCanvas): void {
    this.threeCanvases.delete(canvas);
  }

  // Register animation frame for cleanup
  public registerAnimationFrame(frameId: number): void {
    this.animationFrames.add(frameId);
  }

  // Cancel and unregister animation frame
  public cancelAnimationFrame(frameId: number): void {
    cancelAnimationFrame(frameId);
    this.animationFrames.delete(frameId);
  }

  // Register timer for cleanup
  public registerTimer(timerId: number): void {
    this.timers.add(timerId);
  }

  // Clear and unregister timer
  public clearTimer(timerId: number): void {
    clearTimeout(timerId);
    this.timers.delete(timerId);
  }

  // Emergency cleanup - pause all effects
  public pauseAllEffects(): void {
    // Pause all particle containers
    this.particleContainers.forEach(container => {
      try {
        if (container && typeof container.pause === 'function') {
          container.pause();
        }
      } catch (error) {
        console.warn('Error pausing particle container:', error);
      }
    });

    // Cancel all animation frames
    this.animationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    this.animationFrames.clear();

    // Clear all timers
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.timers.clear();
  }

  // Resume all effects
  public resumeAllEffects(): void {
    // Resume all particle containers
    this.particleContainers.forEach(container => {
      try {
        if (container && typeof container.play === 'function') {
          container.play();
        }
      } catch (error) {
        console.warn('Error resuming particle container:', error);
      }
    });
  }

  // Complete cleanup - destroy all effects
  public cleanupAllEffects(): void {
    // Destroy all particle containers
    this.particleContainers.forEach(container => {
      try {
        if (container && typeof container.destroy === 'function') {
          container.destroy();
        }
      } catch (error) {
        console.warn('Error destroying particle container:', error);
      }
    });
    this.particleContainers.clear();

    // Cleanup Three.js canvases
    this.threeCanvases.forEach(canvas => {
      try {
        if (canvas && typeof canvas.dispose === 'function') {
          canvas.dispose();
        }
      } catch (error) {
        console.warn('Error disposing Three.js canvas:', error);
      }
    });
    this.threeCanvases.clear();

    // Cancel all animation frames
    this.animationFrames.forEach(frameId => {
      cancelAnimationFrame(frameId);
    });
    this.animationFrames.clear();

    // Clear all timers
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.timers.clear();

    // Force garbage collection if available (V8 debug mode only)
    if ('gc' in window && typeof (window as Window & { gc?: () => void }).gc === 'function') {
      (window as Window & { gc?: () => void }).gc?.();
    }
  }

  // Get performance metrics
  public getPerformanceMetrics(): {
    particleContainers: number;
    threeCanvases: number;
    animationFrames: number;
    timers: number;
    memoryUsage?: number;
  } {
    return {
      particleContainers: this.particleContainers.size,
      threeCanvases: this.threeCanvases.size,
      animationFrames: this.animationFrames.size,
      timers: this.timers.size,
      memoryUsage: (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory
        ?.usedJSHeapSize,
    };
  }

  // Check if performance is degraded
  public isPerformanceDegraded(): boolean {
    const metrics = this.getPerformanceMetrics();

    // Consider performance degraded if too many effects are running
    return (
      metrics.particleContainers > 3 ||
      metrics.threeCanvases > 2 ||
      metrics.animationFrames > 10 ||
      metrics.timers > 20
    );
  }
}

// Convenience functions
export const performanceManager = PerformanceManager.getInstance();

export const pauseAllEffects = () => performanceManager.pauseAllEffects();
export const resumeAllEffects = () => performanceManager.resumeAllEffects();
export const cleanupAllEffects = () => performanceManager.cleanupAllEffects();
export const getPerformanceMetrics = () => performanceManager.getPerformanceMetrics();
export const isPerformanceDegraded = () => performanceManager.isPerformanceDegraded();

// Performance reset function for UI
export const resetPerformance = (): void => {
  // Cleanup all effects
  cleanupAllEffects();

  // Wait a moment then force a reload if needed
  setTimeout(() => {
    if (isPerformanceDegraded()) {
      console.warn('Performance still degraded, consider refreshing the page');

      // Show user notification
      if (typeof window !== 'undefined') {
        const shouldReload = confirm(
          'The app is running slowly. Would you like to refresh the page to reset performance?'
        );

        if (shouldReload) {
          window.location.reload();
        }
      }
    }
  }, 1000);
};

// Performance monitoring hook for React components
export const usePerformanceMonitor = () => {
  return {
    pauseEffects: pauseAllEffects,
    resumeEffects: resumeAllEffects,
    cleanupEffects: cleanupAllEffects,
    resetPerformance,
    getMetrics: getPerformanceMetrics,
    isDegraded: isPerformanceDegraded,
  };
};

// Throttle function for performance
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
          timeoutId = null;
        },
        delay - (currentTime - lastExecTime)
      );
    }
  };
};

// Debounce function for performance
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
};
