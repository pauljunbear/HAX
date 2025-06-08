'use client';

// Performance monitoring and cleanup utilities
export class PerformanceManager {
  private static instance: PerformanceManager;
  private particleContainers: Set<any> = new Set();
  private threeCanvases: Set<any> = new Set();
  private animationFrames: Set<number> = new Set();
  private timers: Set<number> = new Set();

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  // Register particle container for cleanup
  public registerParticleContainer(container: any): void {
    try {
      if (container && this.particleContainers.size < 10) { // Limit to prevent memory issues
        this.particleContainers.add(container);
      }
    } catch (error) {
      console.warn('Failed to register particle container:', error);
    }
  }

  // Unregister particle container
  public unregisterParticleContainer(container: any): void {
    try {
      this.particleContainers.delete(container);
    } catch (error) {
      console.warn('Failed to unregister particle container:', error);
    }
  }

  // Register Three.js canvas for cleanup
  public registerThreeCanvas(canvas: any): void {
    this.threeCanvases.add(canvas);
  }

  // Unregister Three.js canvas
  public unregisterThreeCanvas(canvas: any): void {
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
    console.log('Pausing all effects for performance...');
    
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
    console.log('Resuming all effects...');
    
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
    console.log('Performing complete effects cleanup...');
    
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

    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
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
      memoryUsage: (performance as any).memory?.usedJSHeapSize || undefined
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
  console.log('Resetting performance...');
  
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
    isDegraded: isPerformanceDegraded
  };
};

// Throttle function for performance
export const throttle = <T extends (...args: any[]) => any>(
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
      
      timeoutId = window.setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  };
};

// Debounce function for performance
export const debounce = <T extends (...args: any[]) => any>(
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