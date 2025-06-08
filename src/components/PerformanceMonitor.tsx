'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Activity, Cpu, MemoryStick, Clock, Zap } from 'lucide-react';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  memoryLimit: number;
  renderTime: number;
  operationTime: number;
  activeWorkers: number;
  queueSize: number;
  frameDrops: number;
  isThrottled: boolean;
}

interface PerformanceMonitorProps {
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
  workerManager?: any; // WorkerManager instance
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible = false,
  position = 'top-right',
  onPerformanceChange,
  workerManager
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    memoryLimit: 0,
    renderTime: 0,
    operationTime: 0,
    activeWorkers: 0,
    queueSize: 0,
    frameDrops: 0,
    isThrottled: false
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const framesRef = useRef<number[]>([]);
  const renderStartRef = useRef<number>(0);
  const operationStartRef = useRef<number>(0);
  const frameDropCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Memory performance observer
  const memoryObserverRef = useRef<PerformanceObserver | null>(null);

  const getMemoryInfo = useCallback((): { usage: number; limit: number } => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usage: memory.usedJSHeapSize / 1024 / 1024, // MB
        limit: memory.jsHeapSizeLimit / 1024 / 1024  // MB
      };
    }
    return { usage: 0, limit: 0 };
  }, []);

  const updateFPS = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    
    if (deltaTime >= 1000) { // Update every second
      const currentFPS = (frameRef.current * 1000) / deltaTime;
      const avgFrameTime = deltaTime / frameRef.current;
      
      // Track frame drops (frames taking longer than 16.67ms for 60fps)
      if (avgFrameTime > 16.67) {
        frameDropCountRef.current++;
      }

      // Keep frame time history for smoothing
      framesRef.current.push(currentFPS);
      if (framesRef.current.length > 10) {
        framesRef.current.shift();
      }

      const smoothedFPS = framesRef.current.reduce((a, b) => a + b, 0) / framesRef.current.length;

      setMetrics(prev => ({
        ...prev,
        fps: Math.round(smoothedFPS),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        frameDrops: frameDropCountRef.current,
        isThrottled: smoothedFPS < 30
      }));

      frameRef.current = 0;
      lastTimeRef.current = now;
    }

    frameRef.current++;
    requestAnimationFrame(updateFPS);
  }, []);

  const updateMemoryAndWorkers = useCallback(() => {
    const memory = getMemoryInfo();
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage: Math.round(memory.usage * 100) / 100,
      memoryLimit: Math.round(memory.limit * 100) / 100,
      ...(workerManager && {
        activeWorkers: workerManager.getStatus().busyWorkers,
        queueSize: workerManager.getStatus().queueSize
      })
    }));
  }, [getMemoryInfo, workerManager]);

  // Start render timing
  const startRenderTiming = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  // End render timing
  const endRenderTiming = useCallback(() => {
    if (renderStartRef.current > 0) {
      const renderTime = performance.now() - renderStartRef.current;
      setMetrics(prev => ({
        ...prev,
        renderTime: Math.round(renderTime * 100) / 100
      }));
      renderStartRef.current = 0;
    }
  }, []);

  // Start operation timing
  const startOperationTiming = useCallback(() => {
    operationStartRef.current = performance.now();
  }, []);

  // End operation timing
  const endOperationTiming = useCallback(() => {
    if (operationStartRef.current > 0) {
      const operationTime = performance.now() - operationStartRef.current;
      setMetrics(prev => ({
        ...prev,
        operationTime: Math.round(operationTime * 100) / 100
      }));
      operationStartRef.current = 0;
    }
  }, []);

  // Expose timing functions globally for easy access
  useEffect(() => {
    (window as any).__performanceMonitor = {
      startRender: startRenderTiming,
      endRender: endRenderTiming,
      startOperation: startOperationTiming,
      endOperation: endOperationTiming
    };

    return () => {
      delete (window as any).__performanceMonitor;
    };
  }, [startRenderTiming, endRenderTiming, startOperationTiming, endOperationTiming]);

  useEffect(() => {
    if (!isVisible) return;

    // Start FPS monitoring
    const fpsAnimationFrame = requestAnimationFrame(updateFPS);

    // Start memory and worker monitoring
    const memoryInterval = setInterval(updateMemoryAndWorkers, 1000);

    // Setup performance observer for navigation timing
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            console.log('Performance entry:', entry);
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['measure', 'navigation'] });
        memoryObserverRef.current = observer;
      } catch (error) {
        console.warn('PerformanceObserver not supported for some entry types');
      }
    }

    return () => {
      cancelAnimationFrame(fpsAnimationFrame);
      clearInterval(memoryInterval);
      if (memoryObserverRef.current) {
        memoryObserverRef.current.disconnect();
      }
    };
  }, [isVisible, updateFPS, updateMemoryAndWorkers]);

  // Notify parent of performance changes
  useEffect(() => {
    if (onPerformanceChange) {
      onPerformanceChange(metrics);
    }
  }, [metrics, onPerformanceChange]);

  if (!isVisible) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getPerformanceColor = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return 'text-green-400';
    if (value <= thresholds[1]) return 'text-yellow-400';
    return 'text-red-400';
  };

  const fpsColor = getPerformanceColor(60 - metrics.fps, [15, 30]); // Reverse scale for FPS
  const memoryColor = getPerformanceColor((metrics.memoryUsage / metrics.memoryLimit) * 100, [70, 90]);
  const renderColor = getPerformanceColor(metrics.renderTime, [16, 33]);

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-lg p-3 font-mono text-xs transition-all duration-200 ${
        isExpanded ? 'w-80' : 'w-48'
      }`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer mb-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium">Performance</span>
        </div>
        <div className="flex items-center gap-1">
          {metrics.isThrottled && (
            <AlertTriangle className="w-3 h-3 text-red-400" />
          )}
          <span className="text-gray-400">{isExpanded ? '−' : '+'}</span>
        </div>
      </div>

      {/* Core Metrics (Always Visible) */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">FPS</span>
          <span className={fpsColor}>{metrics.fps}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Frame</span>
          <span className={renderColor}>{metrics.frameTime}ms</span>
        </div>

        {metrics.memoryLimit > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Memory</span>
            <span className={memoryColor}>
              {metrics.memoryUsage}MB / {metrics.memoryLimit}MB
            </span>
          </div>
        )}
      </div>

      {/* Expanded Metrics */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
          {/* Render Performance */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-purple-400" />
              <span className="text-gray-300 font-medium">Render</span>
            </div>
            <div className="ml-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Last render</span>
                <span className={renderColor}>{metrics.renderTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Operation</span>
                <span className="text-gray-300">{metrics.operationTime}ms</span>
              </div>
            </div>
          </div>

          {/* Memory Details */}
          {metrics.memoryLimit > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <MemoryStick className="w-3 h-3 text-green-400" />
                <span className="text-gray-300 font-medium">Memory</span>
              </div>
              <div className="ml-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Usage</span>
                  <span className={memoryColor}>
                    {Math.round((metrics.memoryUsage / metrics.memoryLimit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full transition-all duration-300 ${
                      (metrics.memoryUsage / metrics.memoryLimit) > 0.9 ? 'bg-red-400' :
                      (metrics.memoryUsage / metrics.memoryLimit) > 0.7 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min((metrics.memoryUsage / metrics.memoryLimit) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Worker Status */}
          {workerManager && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Cpu className="w-3 h-3 text-blue-400" />
                <span className="text-gray-300 font-medium">Workers</span>
              </div>
              <div className="ml-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active</span>
                  <span className="text-blue-300">{metrics.activeWorkers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Queue</span>
                  <span className="text-yellow-300">{metrics.queueSize}</span>
                </div>
              </div>
            </div>
          )}

          {/* Frame Quality */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-orange-400" />
              <span className="text-gray-300 font-medium">Quality</span>
            </div>
            <div className="ml-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Frame drops</span>
                <span className="text-red-300">{metrics.frameDrops}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Throttled</span>
                <span className={metrics.isThrottled ? 'text-red-400' : 'text-green-400'}>
                  {metrics.isThrottled ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Tips */}
          {(metrics.fps < 30 || (metrics.memoryUsage / metrics.memoryLimit) > 0.8) && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400 font-medium">Tips</span>
              </div>
              <div className="ml-4 text-xs text-gray-400">
                {metrics.fps < 30 && <div>• Reduce effect complexity</div>}
                {(metrics.memoryUsage / metrics.memoryLimit) > 0.8 && <div>• High memory usage detected</div>}
                {metrics.queueSize > 5 && <div>• Worker queue is full</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Hook for easy performance monitoring
export const usePerformanceMonitor = () => {
  const startRender = useCallback(() => {
    if ((window as any).__performanceMonitor) {
      (window as any).__performanceMonitor.startRender();
    }
  }, []);

  const endRender = useCallback(() => {
    if ((window as any).__performanceMonitor) {
      (window as any).__performanceMonitor.endRender();
    }
  }, []);

  const startOperation = useCallback(() => {
    if ((window as any).__performanceMonitor) {
      (window as any).__performanceMonitor.startOperation();
    }
  }, []);

  const endOperation = useCallback(() => {
    if ((window as any).__performanceMonitor) {
      (window as any).__performanceMonitor.endOperation();
    }
  }, []);

  return {
    startRender,
    endRender,
    startOperation,
    endOperation
  };
}; 